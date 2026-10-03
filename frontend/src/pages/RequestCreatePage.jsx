import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client.js'
import { apiErrorMessage } from '../api/errors.js'
import DistrictScopedSelect from '../components/DistrictScopedSelect.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const inputCls = 'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5'

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

  useEffect(() => {
    client.get('/document-types').then((r) => setDocumentTypes(r.data))
    client.get('/offices').then((r) => {
      setOffices(r.data)
      setForm((f) => ({ ...f, officeId: r.data[0]?.id ?? '' }))
    })
    client.get('/departments').then((r) => setDepartments(r.data.filter((d) => d.active !== false))).catch(() => setDepartments([]))
    client.get('/governorates').then((r) => setGovernorates(r.data.filter((g) => g.active !== false)))
    client.get('/districts').then((r) => setDistricts(r.data.filter((d) => d.active !== false)))
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      client.get('/citizens', { params: { q: citizenQuery || undefined } }).then((r) => setCitizens(r.data))
    }, 250)
    return () => clearTimeout(handle)
  }, [citizenQuery])

  async function handleCreateCitizen(e) {
    e.preventDefault()
    const res = await client.post('/citizens', newCitizen)
    setCitizens((c) => [res.data, ...c])
    setForm((f) => ({ ...f, citizenId: res.data.id }))
    setShowNewCitizen(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
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
      navigate(`/requests/${res.data.id}`)
    } catch (err) {
      setError(apiErrorMessage(err, t('requestCreate.errorGeneric'), t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-5">{t('requestCreate.title')}</h1>
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-7 max-w-3xl">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-5" role="alert">
            {error}
          </div>
        )}
        <p className="text-xs text-slate-400 mb-5"><span className="text-red-500">*</span> {t('common.required')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-6 mb-6 border-b border-slate-100">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="citizen-search">
              {t('requestCreate.citizen')} <span className="text-red-500">*</span>
            </label>
            <input
              id="citizen-search"
              className={inputCls}
              placeholder={t('requestCreate.searchCitizen')}
              value={citizenQuery}
              onChange={(e) => setCitizenQuery(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <select
              value={form.citizenId}
              onChange={(e) => setForm({ ...form, citizenId: e.target.value })}
              required
              aria-required="true"
              className={inputCls}
            >
              <option value="">{t('requestCreate.selectCitizen')}</option>
              {citizens.map((c) => (
                <option key={c.id} value={c.id}>{c.firstNameEn} {c.lastNameEn} — {c.registryNumber}</option>
              ))}
            </select>
          </div>
          {/* CITIZEN_MANAGE-gated -- this quick-add posts straight to
              POST /api/citizens, same endpoint CitizenCreatePage uses,
              which SecurityConfig now requires the permission for. A
              Viewer previously could reach this (no route-level gate on
              /requests/new), so without this check they'd see a button
              whose click would just come back as a 403. */}
          {hasPermission('CITIZEN_MANAGE') && (
            <div className="sm:col-span-2">
              <button type="button" className="text-sm font-semibold text-indigo-600 hover:underline" onClick={() => setShowNewCitizen((v) => !v)}>
                {showNewCitizen ? t('requestCreate.cancel') : t('requestCreate.registerNew')}
              </button>
            </div>
          )}

          {showNewCitizen && hasPermission('CITIZEN_MANAGE') && (
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
              <div>
                <label className={labelCls} htmlFor="reg-number">
                  {t('requestCreate.registryNumber')} <span className="text-red-500">*</span>
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
                  {t('requestCreate.firstName')} <span className="text-red-500">*</span>
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
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  onClick={handleCreateCitizen}
                >
                  {t('requestCreate.saveCitizen')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelCls} htmlFor="doc-type">
              {t('requestCreate.documentType')} <span className="text-red-500">*</span>
            </label>
            <select
              id="doc-type"
              className={inputCls}
              value={form.documentTypeId}
              onChange={(e) => setForm({ ...form, documentTypeId: e.target.value })}
              required
              aria-required="true"
            >
              <option value="">{t('common.select')}</option>
              {documentTypes.map((d) => <option key={d.id} value={d.id}>{d.nameEn} (SLA {d.slaDays}d)</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <DistrictScopedSelect
              id="office"
              label={<>{t('requestCreate.office')} <span className="text-red-500">*</span></>}
              required
              className={inputCls}
              labelClassName={labelCls}
              items={offices}
              districts={districts}
              governorates={governorates}
              value={form.officeId}
              onChange={(v) => setForm((f) => ({ ...f, officeId: v }))}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="priority">{t('requestCreate.priority')}</label>
            <select
              id="priority"
              className={inputCls}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="NORMAL">{t('requestCreate.priorityNormal')}</option>
              <option value="HIGH">{t('requestCreate.priorityHigh')}</option>
              <option value="URGENT">{t('requestCreate.priorityUrgent')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="direction">{t('requestCreate.direction')}</label>
            <select
              id="direction"
              className={inputCls}
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
              className={inputCls}
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">{t('requestCreate.noDepartment')}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.nameEn}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="subject">{t('requestCreate.subject')}</label>
            <input
              id="subject"
              maxLength={255}
              className={inputCls}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
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

        <div className="flex justify-end gap-2.5 mt-7 pt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t('requestCreate.cancel')}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="relative rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy && (
              <span className="absolute inset-0 grid place-items-center">
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              </span>
            )}
            <span className={busy ? 'invisible' : ''}>{t('requestCreate.submit')}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
