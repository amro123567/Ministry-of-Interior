import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client.js'
import ParentLineagePicker from '../components/ParentLineagePicker.jsx'
import { FormActions, FormPage, FormSection } from '../components/FormShell.jsx'
import DistrictScopedSelect from '../components/DistrictScopedSelect.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { inputCls, labelCls } from '../ui.js'

const emptyParent = { mode: 'none', citizenId: null, citizenLabel: null, unregisteredName: null }

// POST /api/citizens -- gated on the CITIZEN_MANAGE permission both here
// (route-level, see App.jsx) and on the backend (SecurityConfig), since
// registering a citizen is a real civil-registry write, not a read like
// CitizenRegistryPage/CitizenDetailPage. Mirrors CreateCitizenRequest's
// fields one-for-one; lineage uses the same ParentLineagePicker as the
// detail page's lineage-edit form so both places enforce the backend's
// father/mother XOR rule the same way.
export default function CitizenCreatePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [offices, setOffices] = useState([])
  const [districts, setDistricts] = useState([])
  const [governorates, setGovernorates] = useState([])
  const [form, setForm] = useState({
    registryNumber: '', sijillReference: '',
    firstNameEn: '', middleNameEn: '', lastNameEn: '',
    firstNameAr: '', middleNameAr: '', lastNameAr: '',
    dateOfBirth: '', placeOfBirth: '', gender: 'M', nationality: 'Lebanese',
    religion: '', sect: '', maritalStatus: '', officeId: '',
  })
  const [father, setFather] = useState(emptyParent)
  const [mother, setMother] = useState(emptyParent)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    client.get('/offices').then((r) => setOffices(r.data)).catch(() => {})
    client.get('/governorates').then((r) => setGovernorates(r.data.filter((g) => g.active !== false))).catch(() => {})
    client.get('/districts').then((r) => setDistricts(r.data.filter((d) => d.active !== false))).catch(() => {})
  }, [])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const missing = {}
    if (!form.registryNumber.trim()) missing.registryNumber = t('citizenCreate.errRegistry')
    if (!form.firstNameEn.trim()) missing.firstNameEn = t('citizenCreate.errFirstName')
    setErrors(missing)
    if (Object.keys(missing).length) {
      setError(t('citizenCreate.errorRequired'))
      return
    }
    setBusy(true)
    try {
      const res = await client.post('/citizens', {
        registryNumber: form.registryNumber.trim(),
        sijillReference: form.sijillReference || null,
        firstNameEn: form.firstNameEn.trim(),
        middleNameEn: form.middleNameEn || null,
        lastNameEn: form.lastNameEn || null,
        firstNameAr: form.firstNameAr || null,
        middleNameAr: form.middleNameAr || null,
        lastNameAr: form.lastNameAr || null,
        dateOfBirth: form.dateOfBirth || null,
        placeOfBirth: form.placeOfBirth || null,
        gender: form.gender || null,
        nationality: form.nationality || null,
        religion: form.religion || null,
        sect: form.sect || null,
        maritalStatus: form.maritalStatus || null,
        officeId: form.officeId ? Number(form.officeId) : null,
        fatherId: father.mode === 'registered' ? father.citizenId : null,
        fatherNameUnregistered: father.mode === 'unregistered' ? (father.unregisteredName || '').trim() || null : null,
        motherId: mother.mode === 'registered' ? mother.citizenId : null,
        motherNameUnregistered: mother.mode === 'unregistered' ? (mother.unregisteredName || '').trim() || null : null,
      })
      navigate(`/citizens/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.message ?? t('citizenCreate.errorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  const Err = ({ id, text }) => (text ? <p id={id} className="mt-1 text-xs text-badge-danger-fg">{text}</p> : null)

  return (
      <FormPage title={t('citizenCreate.title')} subtitle={t('citizenCreate.subtitle')} onSubmit={handleSubmit} noValidate error={error}>
        <FormSection title={t('citizenCreate.sectionEssentials')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="registry-number">
              {t('citizenCreate.registryNumber')} <span className="text-required">*</span>
            </label>
            <input id="registry-number" className={inputCls} required aria-required="true"
              aria-invalid={Boolean(errors.registryNumber)} aria-describedby={errors.registryNumber ? 'err-registry' : undefined}
              value={form.registryNumber} onChange={(e) => update('registryNumber', e.target.value)} />
            <Err id="err-registry" text={errors.registryNumber} />
          </div>
          <div>
            <label className={labelCls} htmlFor="first-en">
              {t('citizenCreate.firstNameEn')} <span className="text-required">*</span>
            </label>
            <input id="first-en" className={inputCls} required aria-required="true"
              aria-invalid={Boolean(errors.firstNameEn)} aria-describedby={errors.firstNameEn ? 'err-first' : undefined}
              value={form.firstNameEn} onChange={(e) => update('firstNameEn', e.target.value)} />
            <Err id="err-first" text={errors.firstNameEn} />
          </div>
          <div>
            <label className={labelCls} htmlFor="last-en">{t('citizenCreate.lastNameEn')}</label>
            <input id="last-en" className={inputCls}
              value={form.lastNameEn} onChange={(e) => update('lastNameEn', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="dob">{t('citizenCreate.dateOfBirth')}</label>
            <input id="dob" type="date" className={inputCls}
              value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="gender">{t('citizenCreate.gender')}</label>
            <select id="gender" className={`${inputCls} select-field`} value={form.gender} onChange={(e) => update('gender', e.target.value)}>
              <option value="M">{t('citizenCreate.genderMale')}</option>
              <option value="F">{t('citizenCreate.genderFemale')}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <DistrictScopedSelect
              id="office"
              label={t('citizenCreate.registeredOffice')}
              className={inputCls}
              labelClassName={labelCls}
              items={offices}
              districts={districts}
              governorates={governorates}
              value={form.officeId}
              onChange={(v) => update('officeId', v)}
              noneLabel={t('citizenCreate.officeNone')}
            />
          </div>
        </div>
        </FormSection>

        <FormSection collapsible title={t('citizenCreate.sectionNames')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="middle-en">{t('citizenCreate.middleNameEn')}</label>
              <input id="middle-en" className={inputCls}
                value={form.middleNameEn} onChange={(e) => update('middleNameEn', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="first-ar">{t('citizenCreate.firstNameAr')}</label>
              <input id="first-ar" dir="rtl" className={inputCls}
                value={form.firstNameAr} onChange={(e) => update('firstNameAr', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="middle-ar">{t('citizenCreate.middleNameAr')}</label>
              <input id="middle-ar" dir="rtl" className={inputCls}
                value={form.middleNameAr} onChange={(e) => update('middleNameAr', e.target.value)} />
            </div>
            <div className="sm:col-start-2">
              <label className={labelCls} htmlFor="last-ar">{t('citizenCreate.lastNameAr')}</label>
              <input id="last-ar" dir="rtl" className={inputCls}
                value={form.lastNameAr} onChange={(e) => update('lastNameAr', e.target.value)} />
            </div>
          </div>
        </FormSection>

        <FormSection collapsible title={t('citizenCreate.sectionCivilStatus')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="sijill">{t('citizenCreate.sijillReference')}</label>
              <input id="sijill" className={inputCls}
                value={form.sijillReference} onChange={(e) => update('sijillReference', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="pob">{t('citizenCreate.placeOfBirth')}</label>
              <input id="pob" className={inputCls}
                value={form.placeOfBirth} onChange={(e) => update('placeOfBirth', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="nationality">{t('citizenCreate.nationality')}</label>
              <input id="nationality" className={inputCls}
                value={form.nationality} onChange={(e) => update('nationality', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="marital">{t('citizenCreate.maritalStatus')}</label>
              <select id="marital" className={`${inputCls} select-field`} value={form.maritalStatus} onChange={(e) => update('maritalStatus', e.target.value)}>
                <option value="">{t('citizenCreate.maritalStatusNone')}</option>
                <option value="SINGLE">{t('citizens.maritalStatus.SINGLE')}</option>
                <option value="MARRIED">{t('citizens.maritalStatus.MARRIED')}</option>
                <option value="DIVORCED">{t('citizens.maritalStatus.DIVORCED')}</option>
                <option value="WIDOWED">{t('citizens.maritalStatus.WIDOWED')}</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="religion">{t('citizenCreate.religion')}</label>
              <input id="religion" className={inputCls}
                value={form.religion} onChange={(e) => update('religion', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="sect">{t('citizenCreate.sect')}</label>
              <input id="sect" className={inputCls}
                value={form.sect} onChange={(e) => update('sect', e.target.value)} />
            </div>
          </div>
        </FormSection>

        <FormSection collapsible title={t('citizenCreate.sectionLineage')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ParentLineagePicker label={t('citizenCreate.father')} value={father} onChange={setFather} />
            <ParentLineagePicker label={t('citizenCreate.mother')} value={mother} onChange={setMother} />
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
            className="relative btn-primary "
          >
            {busy && (
              <span className="absolute inset-0 grid place-items-center">
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              </span>
            )}
            <span className={busy ? 'invisible' : ''}>{t('citizenCreate.submit')}</span>
          </button>
        </FormActions>
      </FormPage>
  )
}
