import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client.js'
import CitizenSearchPicker from '../components/CitizenSearchPicker.jsx'
import DistrictScopedSelect from '../components/DistrictScopedSelect.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const inputCls = 'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5'

// POST /api/family-records -- gated CITIZEN_MANAGE both at the route
// (App.jsx) and on the backend (SecurityConfig), same pattern as
// CitizenCreatePage. Reached either directly from the citizen registry
// domain, or via "Create family record" on a citizen's own page
// (FamilyHistorySection), which pre-fills headId/headLabel query params
// so the head of household doesn't have to be searched for twice.
export default function FamilyRecordCreatePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetHeadId = searchParams.get('headId')
  const presetHeadLabel = searchParams.get('headLabel')

  const [bookNumber, setBookNumber] = useState('')
  const [head, setHead] = useState(
    presetHeadId ? { citizenId: Number(presetHeadId), citizenLabel: presetHeadLabel } : { citizenId: null, citizenLabel: null },
  )
  const [offices, setOffices] = useState([])
  const [districts, setDistricts] = useState([])
  const [governorates, setGovernorates] = useState([])
  const [officeId, setOfficeId] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    client.get('/offices').then((r) => setOffices(r.data))
    client.get('/governorates').then((r) => setGovernorates(r.data.filter((g) => g.active !== false)))
    client.get('/districts').then((r) => setDistricts(r.data.filter((d) => d.active !== false)))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!bookNumber.trim() || !head.citizenId) {
      setError(t('familyRecord.errorRequired'))
      return
    }
    setBusy(true)
    try {
      const res = await client.post('/family-records', {
        familyBookNumber: bookNumber.trim(),
        headOfHouseholdId: head.citizenId,
        registrationOfficeId: officeId ? Number(officeId) : null,
      })
      navigate(`/family-records/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.message ?? t('familyRecord.errorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-5">{t('familyRecord.createTitle')}</h1>
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-7 max-w-xl">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-5" role="alert">{error}</div>
        )}
        <p className="text-xs text-slate-400 mb-5"><span className="text-red-500">*</span> {t('common.required')}</p>

        <div className="mb-5">
          <label className={labelCls} htmlFor="book-number">
            {t('familyRecord.bookNumber')} <span className="text-red-500">*</span>
          </label>
          <input id="book-number" className={inputCls} required value={bookNumber} onChange={(e) => setBookNumber(e.target.value)} />
        </div>

        <div className="mb-5">
          <CitizenSearchPicker label={`${t('familyRecord.headOfHousehold')} *`} value={head} onChange={setHead} />
        </div>

        <div className="mb-6">
          <DistrictScopedSelect
            id="reg-office"
            label={t('familyRecord.registrationOffice')}
            className={inputCls}
            labelClassName={labelCls}
            items={offices}
            districts={districts}
            governorates={governorates}
            value={officeId}
            onChange={setOfficeId}
            noneLabel={t('citizenCreate.officeNone')}
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-5 border-t border-slate-100">
          <button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {busy ? t('familyRecord.submitting') : t('familyRecord.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
