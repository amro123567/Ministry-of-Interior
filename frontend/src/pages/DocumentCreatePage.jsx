import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client.js'
import CitizenSearchPicker from '../components/CitizenSearchPicker.jsx'
import { FormActions, FormPage, FormSection } from '../components/FormShell.jsx'
import DistrictScopedSelect from '../components/DistrictScopedSelect.jsx'
import { DOCUMENT_FORMS } from '../components/documentForms/index.jsx'
import { Field, inputCls, labelCls } from '../components/documentForms/fields.jsx'
import { DOCUMENT_KINDS } from '../documentKinds.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const emptyPick = { citizenId: null, citizenLabel: null }
const emptyCommon = { documentNumber: '', issueDate: '', issuingOfficeId: '' }

// One page for all 7 document kinds (ERD domain 6). The kind picker decides which form from
// components/documentForms is shown; each kind owns its own fields and builds its own request,
// so switching kind starts that kind clean instead of carrying stray values across. Gated
// CITIZEN_MANAGE at the route level (App.jsx), matching SecurityConfig's POST /api/documents/**.
//
// Reached directly, or via "+ New document" on a citizen's page, which pre-fills the citizen
// (and, for a marriage certificate, picks husband or wife from their recorded gender --
// just a convenience, either side can be changed).
export default function DocumentCreatePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetCitizenId = searchParams.get('citizenId')
  const presetCitizenLabel = searchParams.get('citizenLabel')
  const presetCitizen = presetCitizenId ? { citizenId: Number(presetCitizenId), citizenLabel: presetCitizenLabel } : emptyPick

  const requestedKind = searchParams.get('kind')
  const [kind, setKindState] = useState(Object.hasOwn(DOCUMENT_FORMS, requestedKind) ? requestedKind : 'birth')
  const [values, setValues] = useState(DOCUMENT_FORMS[kind].initial)
  const [common, setCommon] = useState(emptyCommon)
  const [citizen, setCitizen] = useState(presetCitizen)
  const [husband, setHusband] = useState(presetCitizen)
  const [wife, setWife] = useState(emptyPick)

  const [documentTypes, setDocumentTypes] = useState([])
  const [offices, setOffices] = useState([])
  const [courts, setCourts] = useState([])
  const [religiousAuthorities, setReligiousAuthorities] = useState([])
  const [mukhtars, setMukhtars] = useState([])
  const [districts, setDistricts] = useState([])
  const [governorates, setGovernorates] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const active = DOCUMENT_FORMS[kind]
  const activeKind = useMemo(() => DOCUMENT_KINDS.find((k) => k.key === kind), [kind])

  function setKind(next) {
    setKindState(next)
    setValues(DOCUMENT_FORMS[next].initial)
    setError(null)
  }
  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }))
  const setCommonField = (name, value) => setCommon((c) => ({ ...c, [name]: value }))

  useEffect(() => {
    client.get('/document-types').then((r) => setDocumentTypes(r.data)).catch(() => {})
    client.get('/offices').then((r) => setOffices(r.data)).catch(() => {})
    client.get('/courts').then((r) => setCourts(r.data.filter((c) => c.active !== false))).catch(() => {})
    client.get('/religious-authorities').then((r) => setReligiousAuthorities(r.data.filter((a) => a.active !== false))).catch(() => {})
    client.get('/mukhtars').then((r) => setMukhtars(r.data.filter((m) => m.active !== false))).catch(() => {})
    client.get('/governorates').then((r) => setGovernorates(r.data.filter((g) => g.active !== false))).catch(() => {})
    client.get('/districts').then((r) => setDistricts(r.data.filter((d) => d.active !== false))).catch(() => {})
  }, [])

  // Pre-pick which side of a marriage certificate the incoming citizen fills, from their gender.
  useEffect(() => {
    if (!presetCitizenId) return
    client.get(`/citizens/${presetCitizenId}`).then((r) => {
      if (r.data.gender === 'F') { setWife(presetCitizen); setHusband(emptyPick) }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetCitizenId])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const documentTypeId = documentTypes.find((d) => d.code === activeKind.typeCode)?.id ?? null
    if (!documentTypeId) { setError(t('documentRegistry.errorNoDocumentType')); return }

    const built = active.build(values, { common: { ...common, documentTypeId }, citizen, husband, wife })
    if (!built) { setError(t('documentRegistry.errorRequired')); return }

    setBusy(true)
    try {
      const res = await client.post(built.path, built.payload)
      const documentId = res.data.document.id
      if (activeKind.hasDetailRoute) navigate(`/documents/${activeKind.apiSegment}/${documentId}`)
      else if (citizen.citizenId) navigate(`/citizens/${citizen.citizenId}`)
      else navigate(-1)
    } catch (err) {
      setError(err.response?.data?.message ?? t('documentRegistry.errorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  const ctx = { t, courts, religiousAuthorities, mukhtars, districts, governorates, husband, wife, setHusband, setWife }
  const Fields = active.Fields

  return (
      <FormPage title={t('documentRegistry.createTitle')} subtitle={t('documentRegistry.createSubtitle')} onSubmit={handleSubmit} error={error} requiredNote={false}>
        <FormSection title={t('documentRegistry.sectionDocument')}>
        <div className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="doc-kind">{t('documentRegistry.kind')}</label>
          <select id="doc-kind" className={`${inputCls} select-field`} value={kind} onChange={(e) => setKind(e.target.value)}>
            {DOCUMENT_KINDS.map((k) => <option key={k.key} value={k.key}>{t(k.labelKey)}</option>)}
          </select>
        </div>

        {active.needsCitizen && (
          <div>
            <CitizenSearchPicker label={`${t('documentRegistry.citizen')} *`} value={citizen} onChange={setCitizen} />
          </div>
        )}

        <Fields values={values} set={set} ctx={ctx} />
        </div>
        </FormSection>

        <FormSection collapsible defaultOpen title={t('documentRegistry.sectionCommon')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="doc-number" label={t('documentRegistry.documentNumber')} name="documentNumber" values={common} set={setCommonField} />
            <Field id="doc-issue-date" label={t('documentRegistry.issueDate')} name="issueDate" type="date" values={common} set={setCommonField} />
            <div className="sm:col-span-2">
              <DistrictScopedSelect
                id="doc-office"
                label={t('documentRegistry.issuingOffice')}
                className={inputCls}
                labelClassName={labelCls}
                items={offices}
                districts={districts}
                governorates={governorates}
                value={common.issuingOfficeId}
                onChange={(v) => setCommonField('issuingOfficeId', v)}
                noneLabel={t('citizenCreate.officeNone')}
              />
            </div>
          </div>
        </FormSection>

        <FormActions>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary "
          >
            {busy ? t('documentRegistry.submitting') : t('documentRegistry.submit')}
          </button>
        </FormActions>
      </FormPage>
  )
}
