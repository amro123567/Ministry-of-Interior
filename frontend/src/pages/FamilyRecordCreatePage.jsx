import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client.js'
import CitizenSearchPicker from '../components/CitizenSearchPicker.jsx'
import { FormActions, FormPage, FormSection } from '../components/FormShell.jsx'
import DistrictScopedSelect from '../components/DistrictScopedSelect.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { inputCls, labelCls } from '../ui.js'


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
    client.get('/offices').then((r) => setOffices(r.data)).catch(() => {})
    client.get('/governorates').then((r) => setGovernorates(r.data.filter((g) => g.active !== false))).catch(() => {})
    client.get('/districts').then((r) => setDistricts(r.data.filter((d) => d.active !== false))).catch(() => {})
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
      <FormPage title={t('familyRecord.createTitle')} subtitle={t('familyRecord.createSubtitle')} onSubmit={handleSubmit} error={error}>
        <FormSection title={t('familyRecord.sectionHousehold')}>
        <div className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="book-number">
            {t('familyRecord.bookNumber')} <span className="text-required">*</span>
          </label>
          <input id="book-number" className={inputCls} required value={bookNumber} onChange={(e) => setBookNumber(e.target.value)} />
        </div>

        <div>
          <CitizenSearchPicker label={`${t('familyRecord.headOfHousehold')} *`} value={head} onChange={setHead} />
        </div>

        <div>
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
        </div>
        </FormSection>

        <FormActions>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={busy} className="btn-primary ">
            {busy ? t('familyRecord.submitting') : t('familyRecord.submit')}
          </button>
        </FormActions>
      </FormPage>
  )
}
