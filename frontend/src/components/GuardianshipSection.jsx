import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import client from '../api/client.js'
import CitizenSearchPicker from './CitizenSearchPicker.jsx'
import DistrictScopedSelect from './DistrictScopedSelect.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { inputCls, labelCls } from '../ui.js'

const emptyGuardian = { citizenId: null, citizenLabel: null }

// GET /api/citizens/{id}/guardians only ever returns ACTIVE guardianships
// of this citizen as the *minor* -- there's no endpoint for "wards this
// citizen guards" (the reverse direction), and no way to lapse/revoke a
// guardianship once created (GuardianshipStatus.LAPSED/REVOKED are
// unreachable via any API), so this section is deliberately create+view
// only, matching what the backend actually offers.
export default function GuardianshipSection({ citizenId }) {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const [guardianships, setGuardianships] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [adding, setAdding] = useState(false)
  const [courts, setCourts] = useState([])
  const [districts, setDistricts] = useState([])
  const [governorates, setGovernorates] = useState([])
  const [guardian, setGuardian] = useState(emptyGuardian)
  const [type, setType] = useState('FULL')
  const [courtDecisionNumber, setCourtDecisionNumber] = useState('')
  const [courtId, setCourtId] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    client.get(`/citizens/${citizenId}/guardians`)
      .then((r) => setGuardianships(r.data))
      .catch(() => setError(t('guardianship.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [citizenId, t])

  useEffect(() => { load() }, [load])

  function startAdding() {
    setGuardian(emptyGuardian)
    setType('FULL')
    setCourtDecisionNumber('')
    setCourtId('')
    setStartDate(new Date().toISOString().slice(0, 10))
    setEndDate('')
    setFormError(null)
    setAdding(true)
    if (courts.length === 0) client.get('/courts').then((r) => setCourts(r.data.filter((c) => c.active !== false))).catch(() => {})
    if (governorates.length === 0) client.get('/governorates').then((r) => setGovernorates(r.data.filter((g) => g.active !== false))).catch(() => {})
    if (districts.length === 0) client.get('/districts').then((r) => setDistricts(r.data.filter((d) => d.active !== false))).catch(() => {})
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    if (!guardian.citizenId || !courtDecisionNumber.trim() || !courtId || !startDate) {
      setFormError(t('guardianship.errorRequired'))
      return
    }
    setBusy(true)
    try {
      await client.post('/guardianships', {
        minorCitizenId: Number(citizenId),
        guardianCitizenId: guardian.citizenId,
        guardianshipType: type,
        courtDecisionNumber: courtDecisionNumber.trim(),
        courtId: Number(courtId),
        startDate,
        endDate: endDate || null,
      })
      setAdding(false)
      load()
    } catch (err) {
      setFormError(err.response?.data?.message ?? t('guardianship.errorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-text-primary">{t('guardianship.title')}</h2>
        {!adding && hasPermission('CITIZEN_MANAGE') && (
          <button type="button" onClick={startAdding} className="text-sm font-semibold text-primary hover:underline">
            {t('guardianship.add')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{error}</div>
      )}

      {adding && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-border-subtle p-4 mb-4">
          {formError && (
            <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{formError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <CitizenSearchPicker label={t('guardianship.guardian')} value={guardian} onChange={setGuardian} excludeCitizenId={Number(citizenId)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="g-type">{t('guardianship.type')}</label>
              <select id="g-type" className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="FULL">{t('guardianship.typeLabel.FULL')}</option>
                <option value="PARTIAL">{t('guardianship.typeLabel.PARTIAL')}</option>
                <option value="TEMPORARY">{t('guardianship.typeLabel.TEMPORARY')}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <DistrictScopedSelect
                id="g-court"
                label={t('guardianship.court')}
                required
                className={inputCls}
                labelClassName={labelCls}
                items={courts}
                districts={districts}
                governorates={governorates}
                value={courtId}
                onChange={setCourtId}
                noneLabel={t('common.select')}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="g-decision">{t('guardianship.courtDecisionNumber')}</label>
              <input id="g-decision" className={inputCls} value={courtDecisionNumber} onChange={(e) => setCourtDecisionNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="g-start">{t('guardianship.startDate')}</label>
              <input id="g-start" type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="g-end">{t('guardianship.endDate')}</label>
              <input id="g-end" type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={busy} className="btn-primary ">
              {busy ? t('guardianship.submitting') : t('guardianship.submit')}
            </button>
          </div>
        </form>
      )}

      {!loading && guardianships.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('guardianship.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {guardianships.map((g) => (
            <li key={g.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/citizens/${g.guardianCitizenId}`} className="text-sm font-semibold text-primary hover:underline">
                  {g.guardianName}
                </Link>
                <span className="text-xs font-semibold text-text-secondary">{t(`guardianship.typeLabel.${g.guardianshipType}`, g.guardianshipType)}</span>
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                {g.courtName ?? '—'} · {t('guardianship.courtDecisionNumber')} {g.courtDecisionNumber} ·{' '}
                {g.startDate ? format(new Date(g.startDate), 'MMM d, yyyy') : '—'}
                {g.endDate && ` ${t('common.to')} ${format(new Date(g.endDate), 'MMM d, yyyy')}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
