import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, FileText, Paperclip, Send, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client.js'
import { apiErrorMessage } from '../api/errors.js'
import DistrictScopedSelect from '../components/DistrictScopedSelect.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { inputCls, labelCls } from '../ui.js'


// Mirrors the server-side allow-list and size limit (AttachmentService) so a
// bad file is refused here, before the request is created, instead of failing
// after the fact.
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx']
const MAX_FILE_BYTES = 15 * 1024 * 1024
const STEPS = ['stepSender', 'stepDetails', 'stepAttach']
const HINTS = ['hintSender', 'hintDetails', 'hintAttach']

function fileProblem(file, t) {
  const name = file.name || ''
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) return t('requestCreate.fileTypeBad')
  if (file.size > MAX_FILE_BYTES) return t('requestCreate.fileTooBig')
  if (file.size === 0) return t('requestCreate.fileEmpty')
  return null
}

function FieldError({ id, message }) {
  if (!message) return null
  return <p id={id} className="mt-1 text-xs text-badge-danger-fg" role="alert">{message}</p>
}

const STEP_ICONS = [UserRound, FileText, Paperclip]

function WizardSteps({ step, t }) {
  return (
    <ol className="mx-auto mb-8 grid max-w-3xl grid-cols-3 gap-3" aria-label={t('requestCreate.steps')}>
      {STEPS.map((key, i) => {
        const done = i < step
        const active = i === step
        const Icon = STEP_ICONS[i]
        return (
          <li key={key} aria-current={active ? 'step' : undefined} className="flex flex-col items-center text-center">
            <div className="mb-2 flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : done || active ? 'bg-brand' : 'bg-hairline'}`} />
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                active ? 'border-brand bg-brand text-white shadow-[0_0_0_4px_rgba(37,99,235,0.15)]'
                  : done ? 'border-ok bg-ok text-white' : 'border-hairline bg-white text-slate-400'
              }`}>{done ? <Check className="h-5 w-5" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}</span>
              <div className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? 'invisible' : done ? 'bg-brand' : 'bg-hairline'}`} />
            </div>
            <span className={`text-sm ${active ? 'font-bold text-navy' : done ? 'font-semibold text-ok-ink' : 'font-medium text-slate-500'}`}>{t(`requestCreate.${key}`)}</span>
            <span className="hidden text-xs text-slate-500 sm:block">{t(`requestCreate.${HINTS[i]}`)}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Section({ title, children }) {
  return (
    <fieldset className="rounded-xl border border-hairline bg-slate-50/60 p-5">
      <legend className="px-2 text-xs font-bold uppercase tracking-wider text-brand">{title}</legend>
      {children}
    </fieldset>
  )
}

export default function RequestCreatePage() {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const [citizens, setCitizens] = useState([])
  const [documentTypes, setDocumentTypes] = useState([])
  const [offices, setOffices] = useState([])
  const [departments, setDepartments] = useState([])
  const [districts, setDistricts] = useState([])
  const [governorates, setGovernorates] = useState([])
  const [citizenQuery, setCitizenQuery] = useState('')
  const [form, setForm] = useState({ citizenId: '', documentTypeId: '', officeId: '', priority: 'NORMAL', notes: '', direction: 'INCOMING', subject: '', departmentId: '' })
  const [showNewCitizen, setShowNewCitizen] = useState(false)
  const [newCitizen, setNewCitizen] = useState({ registryNumber: '', firstNameEn: '', lastNameEn: '', gender: 'M' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [files, setFiles] = useState([])
  const [fileError, setFileError] = useState(null)
  const [createdId, setCreatedId] = useState(null)
  const [failedUploads, setFailedUploads] = useState([])

  useEffect(() => {
    client.get('/document-types').then((r) => setDocumentTypes(r.data)).catch(() => setError(t('requestCreate.errorGeneric')))
    client.get('/offices').then((r) => {
      setOffices(r.data)
      setForm((f) => ({ ...f, officeId: r.data[0]?.id ?? '' }))
    }).catch(() => setError(t('requestCreate.errorGeneric')))
    client.get('/departments').then((r) => setDepartments(r.data.filter((d) => d.active !== false))).catch(() => setDepartments([]))
    client.get('/governorates').then((r) => setGovernorates(r.data.filter((g) => g.active !== false))).catch(() => setGovernorates([]))
    client.get('/districts').then((r) => setDistricts(r.data.filter((d) => d.active !== false))).catch(() => setDistricts([]))
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      client.get('/citizens', { params: { q: citizenQuery || undefined } }).then((r) => setCitizens(r.data)).catch(() => setCitizens([]))
    }, 250)
    return () => clearTimeout(handle)
  }, [citizenQuery])

  async function handleCreateCitizen(e) {
    e.preventDefault()
    setError(null)
    try {
      const res = await client.post('/citizens', newCitizen)
      setCitizens((c) => [res.data, ...c])
      setForm((f) => ({ ...f, citizenId: res.data.id }))
      setShowNewCitizen(false)
    } catch (err) {
      setError(apiErrorMessage(err, t('requestCreate.errorGeneric'), t))
    }
  }

  function validate(forStep) {
    const next = {}
    if (forStep === 0 && !form.citizenId) next.citizenId = t('requestCreate.errCitizen')
    if (forStep === 1) {
      if (!form.documentTypeId) next.documentTypeId = t('requestCreate.errDocType')
      if (!form.officeId) next.officeId = t('requestCreate.errOffice')
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function goNext() {
    setError(null)
    if (validate(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setError(null)
    setErrors({})
    setStep((s) => Math.max(s - 1, 0))
  }

  function addFiles(list) {
    setFileError(null)
    const accepted = []
    for (const f of Array.from(list)) {
      const problem = fileProblem(f, t)
      if (problem) { setFileError(`${f.name}: ${problem}`); continue }
      accepted.push(f)
    }
    if (accepted.length) setFiles((cur) => [...cur, ...accepted])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    // Enter on an earlier step moves forward; only the last step creates.
    if (step < STEPS.length - 1) { goNext(); return }
    if (!form.citizenId || !form.documentTypeId || !form.officeId) {
      setError(t('requestCreate.errorSelect'))
      return
    }
    setBusy(true)
    try {
      const res = await client.post('/requests', {
        citizenId: Number(form.citizenId),
        documentTypeId: Number(form.documentTypeId),
        officeId: Number(form.officeId),
        priority: form.priority,
        notes: form.notes || null,
        direction: form.direction,
        subject: form.subject.trim() || null,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
      })
      const newId = res.data.id
      const failed = []
      for (const file of files) {
        const data = new FormData()
        data.append('file', file)
        try {
          await client.post(`/requests/${newId}/documents`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
        } catch {
          failed.push(file.name)
        }
      }
      if (failed.length) {
        // The request exists; keep the user here long enough to see which files didn't make it.
        setCreatedId(newId)
        setFailedUploads(failed)
        return
      }
      navigate(`/requests/${newId}`)
    } catch (err) {
      setError(apiErrorMessage(err, t('requestCreate.errorGeneric'), t))
    } finally {
      setBusy(false)
    }
  }

  const selectedCitizen = citizens.find((c) => String(c.id) === String(form.citizenId))
  const selectedType = documentTypes.find((d) => String(d.id) === String(form.documentTypeId))
  const selectedOffice = offices.find((o) => String(o.id) === String(form.officeId))

  if (createdId) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="mb-5 text-center text-2xl font-extrabold text-navy">{t('requestCreate.title')}</h1>
        <div className="rounded-lg border border-badge-warning-bd bg-badge-warning-bg p-6" role="alert">
          <p className="text-sm font-semibold text-badge-warning-fg mb-2">{t('requestCreate.createdWithFailures')}</p>
          <ul className="list-disc ps-5 text-sm text-badge-warning-fg mb-4">
            {failedUploads.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <Link to={`/requests/${createdId}`} className="inline-flex btn-primary">
            {t('requestCreate.openRequest')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">{t('requestCreate.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('requestCreate.subtitle')}</p>
      </header>
      <form onSubmit={handleSubmit} noValidate className="dash-card p-6 sm:p-8">
        {error && (
          <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-5" role="alert">
            {error}
          </div>
        )}
        <WizardSteps step={step} t={t} />
        <p className="mb-4 text-end text-xs text-text-secondary"><span className="text-required">*</span> {t('common.required')}</p>

        {step === 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <Section title={t('requestCreate.secCitizen')}>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelCls} htmlFor="citizen-search">
              {t('requestCreate.citizen')} <span className="text-required">*</span>
            </label>
            <input
              id="citizen-search"
              className={inputCls}
              placeholder={t('requestCreate.searchCitizen')}
              value={citizenQuery}
              onChange={(e) => setCitizenQuery(e.target.value)}
            />
          </div>
          <div>
            <select
              value={form.citizenId}
              onChange={(e) => setForm({ ...form, citizenId: e.target.value })}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.citizenId)}
              aria-describedby={errors.citizenId ? 'err-citizen' : undefined}
              className={`${inputCls} select-field ${errors.citizenId ? '!border-required' : ''}`}
            >
              <option value="">{t('requestCreate.selectCitizen')}</option>
              {citizens.map((c) => (
                <option key={c.id} value={c.id}>{c.firstNameEn} {c.lastNameEn} — {c.registryNumber}</option>
              ))}
            </select>
            <FieldError id="err-citizen" message={errors.citizenId} />
          </div>
          {/* CITIZEN_MANAGE-gated -- this quick-add posts straight to
              POST /api/citizens, same endpoint CitizenCreatePage uses,
              which SecurityConfig now requires the permission for. A
              Viewer previously could reach this (no route-level gate on
              /requests/new), so without this check they'd see a button
              whose click would just come back as a 403. */}
          {hasPermission('CITIZEN_MANAGE') && (
            <div>
              <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setShowNewCitizen((v) => !v)}>
                {showNewCitizen ? t('requestCreate.cancel') : t('requestCreate.registerNew')}
              </button>
            </div>
          )}

          {showNewCitizen && hasPermission('CITIZEN_MANAGE') && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-dashed border-border-subtle bg-white p-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="reg-number">
                  {t('requestCreate.registryNumber')} <span className="text-required">*</span>
                </label>
                <input
                  id="reg-number"
                  className={inputCls}
                  value={newCitizen.registryNumber}
                  onChange={(e) => setNewCitizen({ ...newCitizen, registryNumber: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="first-name">
                  {t('requestCreate.firstName')} <span className="text-required">*</span>
                </label>
                <input
                  id="first-name"
                  className={inputCls}
                  value={newCitizen.firstNameEn}
                  onChange={(e) => setNewCitizen({ ...newCitizen, firstNameEn: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="last-name">{t('requestCreate.lastName')}</label>
                <input
                  id="last-name"
                  className={inputCls}
                  value={newCitizen.lastNameEn}
                  onChange={(e) => setNewCitizen({ ...newCitizen, lastNameEn: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCreateCitizen}
                >
                  {t('requestCreate.saveCitizen')}
                </button>
              </div>
            </div>
          )}
        </div>
        </Section>
        <Section title={t('requestCreate.secRouting')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="direction">{t('requestCreate.direction')}</label>
            <select
              id="direction"
              className={`${inputCls} select-field`}
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
            >
              <option value="INCOMING">{t('requestCreate.directionIncoming')}</option>
              <option value="OUTGOING">{t('requestCreate.directionOutgoing')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="department">{t('requestCreate.department')}</label>
            <select
              id="department"
              className={`${inputCls} select-field`}
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">{t('requestCreate.noDepartment')}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.nameEn}</option>)}
            </select>
          </div>
        </div>
        </Section>
        </div>
        )}

        {step === 1 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <Section title={t('requestCreate.secClassify')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="doc-type">
              {t('requestCreate.documentType')} <span className="text-required">*</span>
            </label>
            <select
              id="doc-type"
              className={`${inputCls} select-field`}
              value={form.documentTypeId}
              onChange={(e) => setForm({ ...form, documentTypeId: e.target.value })}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.documentTypeId)}
              aria-describedby={errors.documentTypeId ? 'err-doctype' : undefined}
            >
              <option value="">{t('common.select')}</option>
              {documentTypes.map((d) => <option key={d.id} value={d.id}>{d.nameEn} (SLA {d.slaDays}d)</option>)}
            </select>
            <FieldError id="err-doctype" message={errors.documentTypeId} />
          </div>
          <div className="sm:col-span-2">
            <DistrictScopedSelect
              id="office"
              label={<>{t('requestCreate.office')} <span className="text-required">*</span></>}
              required
              className={`${inputCls} select-field`}
              labelClassName={labelCls}
              items={offices}
              districts={districts}
              governorates={governorates}
              value={form.officeId}
              onChange={(v) => setForm((f) => ({ ...f, officeId: v }))}
            />
            <FieldError id="err-office" message={errors.officeId} />
          </div>
          <div>
            <label className={labelCls} htmlFor="priority">{t('requestCreate.priority')}</label>
            <select
              id="priority"
              className={`${inputCls} select-field`}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="NORMAL">{t('requestCreate.priorityNormal')}</option>
              <option value="HIGH">{t('requestCreate.priorityHigh')}</option>
              <option value="URGENT">{t('requestCreate.priorityUrgent')}</option>
            </select>
          </div>
        </div>
        </Section>
        <Section title={t('requestCreate.secContent')}>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelCls} htmlFor="subject">{t('requestCreate.subject')}</label>
            <input
              id="subject"
              maxLength={255}
              className={inputCls}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="notes">{t('requestCreate.notes')}</label>
            <textarea
              id="notes"
              rows={3}
              className={inputCls}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        </Section>
        </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="text-sm font-bold text-text-primary mb-1">{t('requestCreate.attachTitle')}</h2>
            <p className="text-xs text-text-secondary mb-3">{t('requestCreate.attachHint')}</p>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border-subtle bg-slate-50 px-4 py-8 text-center transition-colors hover:border-brand hover:bg-brand-tint">
              <Paperclip className="h-6 w-6 text-brand" aria-hidden="true" />
              <span className="text-sm font-semibold text-brand">{t('requestCreate.addFiles')}</span>
              <span className="text-xs text-text-secondary">{ALLOWED_EXTENSIONS.join(', ')} · 15 MB</span>
              <input
                type="file"
                multiple
                className="sr-only"
                aria-label={t('requestCreate.addFiles')}
                onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
              />
            </label>
            {fileError && <p className="mt-2 text-xs text-badge-danger-fg" role="alert">{fileError}</p>}
            {files.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-border-subtle">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="truncate text-text-primary">{f.name} <span className="text-xs text-text-secondary">({Math.max(1, Math.round(f.size / 1024))} KB)</span></span>
                    <button type="button" onClick={() => setFiles((cur) => cur.filter((_, k) => k !== i))}
                            className="text-xs font-semibold text-badge-danger-fg hover:underline">{t('requestCreate.removeFile')}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-sm font-bold text-text-primary mb-2">{t('requestCreate.reviewTitle')}</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-hairline bg-slate-50/60 p-5 text-sm sm:grid-cols-2">
              <div><dt className="text-[11px] font-bold uppercase text-text-secondary">{t('requestCreate.citizen')}</dt><dd>{selectedCitizen ? `${selectedCitizen.firstNameEn} ${selectedCitizen.lastNameEn} (${selectedCitizen.registryNumber})` : '—'}</dd></div>
              <div><dt className="text-[11px] font-bold uppercase text-text-secondary">{t('requestCreate.documentType')}</dt><dd>{selectedType?.nameEn ?? '—'}</dd></div>
              <div><dt className="text-[11px] font-bold uppercase text-text-secondary">{t('requestCreate.office')}</dt><dd>{selectedOffice?.nameEn ?? '—'}</dd></div>
              <div><dt className="text-[11px] font-bold uppercase text-text-secondary">{t('requestCreate.direction')}</dt><dd>{form.direction === 'OUTGOING' ? t('requestCreate.directionOutgoing') : t('requestCreate.directionIncoming')}</dd></div>
              {form.subject && <div className="sm:col-span-2"><dt className="text-[11px] font-bold uppercase text-text-secondary">{t('requestCreate.subject')}</dt><dd>{form.subject}</dd></div>}
            </dl>
          </div>
          </div>
        )}

        <div className="flex justify-between gap-2.5 mt-8 pt-5 border-t border-hairline">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
          >
            {t('requestCreate.cancel')}
          </button>
          <div className="flex gap-2.5">
            {step > 0 && (
              <button type="button" onClick={goBack}
                      className="btn-secondary">
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />{t('requestCreate.back')}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button key="next" type="button" onClick={goNext}
                      className="btn-primary">
                {t('requestCreate.next')}<ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            ) : (
              <button
                key="submit"
                type="submit"
                disabled={busy}
                className="relative btn-primary "
              >
                {busy && (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  </span>
                )}
                <span className={`inline-flex items-center gap-2 ${busy ? 'invisible' : ''}`}><Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />{t('requestCreate.submit')}</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
