import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import client from '../api/client.js'
import ApprovalStatusBadge from './ApprovalStatusBadge.jsx'
import DistrictScopedSelect from './DistrictScopedSelect.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { inputCls, labelCls } from '../ui.js'


// Matches CitizenRegistryService.decideAmendment()'s AMENDABLE_FIELDS
// whitelist exactly -- those are the only fields the backend will ever
// auto-apply to the citizen record on approval (anything else is
// recorded but left for a manual follow-up), so the field picker only
// offers what approving here can actually do.
const AMENDABLE_FIELDS = ['firstNameEn', 'lastNameEn', 'firstNameAr', 'lastNameAr', 'religion', 'sect', 'maritalStatus', 'nationality']

export default function CivilStatusAmendmentSection({ citizenId, citizen, onDecided }) {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const [amendments, setAmendments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [requesting, setRequesting] = useState(false)
  const [courts, setCourts] = useState([])
  const [districts, setDistricts] = useState([])
  const [governorates, setGovernorates] = useState([])
  const [field, setField] = useState(AMENDABLE_FIELDS[0])
  const [oldValue, setOldValue] = useState('')
  const [newValue, setNewValue] = useState('')
  const [legalBasis, setLegalBasis] = useState('')
  const [courtDecisionNumber, setCourtDecisionNumber] = useState('')
  const [courtId, setCourtId] = useState('')
  const [amendmentDate, setAmendmentDate] = useState('')
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [decidingId, setDecidingId] = useState(null)

  const canDecide = hasPermission('CITIZEN_REGISTRY_DECIDE')

  const load = useCallback(() => {
    setLoading(true)
    client.get(`/citizens/${citizenId}/civil-status-amendments`)
      .then((r) => setAmendments(r.data))
      .catch(() => setError(t('civilStatusAmendment.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [citizenId, t])

  useEffect(() => { load() }, [load])

  function startRequesting() {
    const firstField = AMENDABLE_FIELDS[0]
    setField(firstField)
    setOldValue(citizen?.[firstField] ?? '')
    setNewValue('')
    setLegalBasis('')
    setCourtDecisionNumber('')
    setCourtId('')
    setAmendmentDate('')
    setFormError(null)
    setRequesting(true)
    if (courts.length === 0) client.get('/courts').then((r) => setCourts(r.data.filter((c) => c.active !== false))).catch(() => {})
    if (governorates.length === 0) client.get('/governorates').then((r) => setGovernorates(r.data.filter((g) => g.active !== false))).catch(() => {})
    if (districts.length === 0) client.get('/districts').then((r) => setDistricts(r.data.filter((d) => d.active !== false))).catch(() => {})
  }

  function handleFieldChange(next) {
    setField(next)
    setOldValue(citizen?.[next] ?? '')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    if (!newValue.trim() || !legalBasis.trim()) {
      setFormError(t('civilStatusAmendment.errorRequired'))
      return
    }
    setBusy(true)
    try {
      await client.post('/civil-status-amendments', {
        citizenId: Number(citizenId),
        fieldChanged: field,
        oldValue: oldValue || null,
        newValue: newValue.trim(),
        legalBasis: legalBasis.trim(),
        courtDecisionNumber: courtDecisionNumber || null,
        courtId: courtId ? Number(courtId) : null,
        amendmentDate: amendmentDate || null,
      })
      setRequesting(false)
      load()
    } catch (err) {
      setFormError(err.response?.data?.message ?? t('civilStatusAmendment.errorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  async function decide(id, decision) {
    setBusy(true); setError(null)
    try {
      await client.patch(`/civil-status-amendments/${id}/decide`, { decision })
      setDecidingId(null)
      load()
      if (decision === 'APPROVE') onDecided?.()
    } catch (err) {
      setError(err.response?.data?.message ?? t('civilStatusAmendment.decideErrorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-text-primary">{t('civilStatusAmendment.title')}</h2>
        {!requesting && hasPermission('CITIZEN_MANAGE') && (
          <button type="button" onClick={startRequesting} className="text-sm font-semibold text-primary hover:underline">
            {t('civilStatusAmendment.request')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{error}</div>
      )}

      {requesting && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-border-subtle p-4 mb-4">
          {formError && (
            <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{formError}</div>
          )}
          <p className="text-xs text-text-secondary mb-4">{t('civilStatusAmendment.applyNote')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelCls} htmlFor="a-field">{t('civilStatusAmendment.field')}</label>
              <select id="a-field" className={inputCls} value={field} onChange={(e) => handleFieldChange(e.target.value)}>
                {AMENDABLE_FIELDS.map((f) => <option key={f} value={f}>{t(`civilStatusAmendment.fieldNames.${f}`, f)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="a-old">{t('civilStatusAmendment.oldValue')}</label>
              <input id="a-old" className={inputCls} value={oldValue} onChange={(e) => setOldValue(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="a-new">
                {t('civilStatusAmendment.newValue')} <span className="text-required">*</span>
              </label>
              <input id="a-new" className={inputCls} required value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="a-legal">
                {t('civilStatusAmendment.legalBasis')} <span className="text-required">*</span>
              </label>
              <input id="a-legal" className={inputCls} required value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <DistrictScopedSelect
                id="a-court"
                label={t('civilStatusAmendment.court')}
                className={inputCls}
                labelClassName={labelCls}
                items={courts}
                districts={districts}
                governorates={governorates}
                value={courtId}
                onChange={setCourtId}
                noneLabel={t('civilStatusAmendment.courtNone')}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="a-court-decision">{t('guardianship.courtDecisionNumber')}</label>
              <input id="a-court-decision" className={inputCls} value={courtDecisionNumber} onChange={(e) => setCourtDecisionNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="a-date">{t('civilStatusAmendment.amendmentDate')}</label>
              <input id="a-date" type="date" className={inputCls} value={amendmentDate} onChange={(e) => setAmendmentDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setRequesting(false)} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={busy} className="btn-primary ">
              {busy ? t('civilStatusAmendment.submitting') : t('civilStatusAmendment.submit')}
            </button>
          </div>
        </form>
      )}

      {!loading && amendments.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('civilStatusAmendment.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {amendments.map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-text-primary">
                  {t(`civilStatusAmendment.fieldNames.${a.fieldChanged}`, a.fieldChanged)}: {a.oldValue || '—'} {t('common.to')} {a.newValue}
                </span>
                <ApprovalStatusBadge status={a.status} />
              </div>
              <div className="text-xs text-text-secondary">
                {t('civilStatusAmendment.colLegalBasis')}: {a.legalBasis}
                {a.requestedByName && ` · ${a.requestedByName}`}
                {a.approvedByName && ` · ${a.approvedByName}`}
                {a.amendmentDate && ` · ${format(new Date(a.amendmentDate), 'MMM d, yyyy')}`}
              </div>
              {a.status === 'PENDING' && canDecide && (
                decidingId === a.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" disabled={busy} onClick={() => decide(a.id, 'APPROVE')} className="btn-success btn-sm ">
                      {t('civilStatusAmendment.approve')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => decide(a.id, 'REJECT')} className="btn-danger btn-sm ">
                      {t('civilStatusAmendment.reject')}
                    </button>
                    <button type="button" onClick={() => setDecidingId(null)} className="text-xs font-semibold text-text-secondary hover:underline">
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDecidingId(a.id)} className="mt-2 text-xs font-semibold text-primary hover:underline">
                    {t('civilStatusAmendment.decide')}
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
