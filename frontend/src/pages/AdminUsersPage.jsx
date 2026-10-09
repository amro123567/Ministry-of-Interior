import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client.js'
import DistrictScopedSelect from '../components/DistrictScopedSelect.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const inputCls = 'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5'

// Tailwind restyle folded into frontend integration pass Step 8, the same
// opportunistic cleanup RequestDetailPage got in Step 7 -- this was the
// last screen in the app still on the pre-Tailwind `card`/`table`/
// `detail-grid`/`btn` classes (see PROJECT_STATE.md's "Known visual
// inconsistency" note), so Step 8 closes that gap out entirely rather
// than leaving it for a 9th step that was never going to come. Functional
// changes are just the new "View activity" column/link -- everything
// else here is the same GET /api/users + POST /api/users flow as before.
export default function AdminUsersPage() {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [offices, setOffices] = useState([])
  const [districts, setDistricts] = useState([])
  const [governorates, setGovernorates] = useState([])
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', roleName: '', officeId: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)

  function reload() {
    client.get('/users').then((r) => setUsers(r.data))
  }

  useEffect(() => {
    reload()
    client.get('/roles').then((r) => { setRoles(r.data); setForm((f) => ({ ...f, roleName: r.data[0]?.name ?? '' })) })
    client.get('/offices').then((r) => { setOffices(r.data); setForm((f) => ({ ...f, officeId: r.data[0]?.id ?? '' })) })
    client.get('/governorates').then((r) => setGovernorates(r.data.filter((g) => g.active !== false)))
    client.get('/districts').then((r) => setDistricts(r.data.filter((d) => d.active !== false)))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null); setBusy(true)
    try {
      await client.post('/users', { ...form, officeId: form.officeId ? Number(form.officeId) : null })
      setForm((f) => ({ ...f, username: '', password: '', fullName: '', email: '' }))
      reload()
      setShowForm(false)
    } catch (err) {
      setError(err.response?.data?.message ?? t('adminUsers.errorGeneric'))
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{t('adminUsers.title')}</h1>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setError(null) }}
          aria-expanded={showForm}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {showForm ? t('adminUsers.cancel') : t('adminUsers.newUser')}
        </button>
      </div>

      <div className={`grid grid-cols-1 gap-4 items-start ${showForm ? 'lg:grid-cols-[1fr_380px]' : ''}`}>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">{t('adminUsers.staffAccounts')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('adminUsers.colUsername')}</th>
                  <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('adminUsers.colFullName')}</th>
                  <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('adminUsers.colRoles')}</th>
                  <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('adminUsers.colOffice')}</th>
                  {/* AUDIT_VIEW-gated, matching UserActivityPage's own
                      route gate in App.jsx (not USER_MANAGE, which is all
                      this page itself requires) -- an admin who somehow
                      held USER_MANAGE without AUDIT_VIEW would see this
                      column disappear rather than a link the API would
                      403 on. */}
                  {hasPermission('AUDIT_VIEW') && (
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('adminUsers.colActivity')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">{u.username}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{u.fullName}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{u.roles.join(', ')}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{u.officeName ?? '—'}</td>
                    {hasPermission('AUDIT_VIEW') && (
                      <td className="px-4 py-3.5 text-sm whitespace-nowrap">
                        <Link
                          to={`/admin/users/${u.id}/activity`}
                          state={{ username: u.username, fullName: u.fullName }}
                          className="font-semibold text-indigo-600 hover:underline"
                        >
                          {t('adminUsers.viewActivity')}
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showForm && (
        <form className="rounded-xl border border-slate-200 bg-white p-5" onSubmit={handleSubmit}>
          <h2 className="text-sm font-bold text-slate-900 mb-4">{t('adminUsers.createUser')}</h2>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4" role="alert">{error}</div>
          )}
          <div className="mb-4">
            <label className={labelCls} htmlFor="new-user-username">{t('adminUsers.username')}</label>
            <input id="new-user-username" className={inputCls} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div className="mb-4">
            <label className={labelCls} htmlFor="new-user-password">{t('adminUsers.tempPassword')}</label>
            <input id="new-user-password" type="password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div className="mb-4">
            <label className={labelCls} htmlFor="new-user-fullname">{t('adminUsers.fullName')}</label>
            <input id="new-user-fullname" className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          </div>
          <div className="mb-4">
            <label className={labelCls} htmlFor="new-user-email">{t('adminUsers.email')}</label>
            <input id="new-user-email" type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="mb-4">
            <label className={labelCls} htmlFor="new-user-role">{t('adminUsers.role')}</label>
            <select id="new-user-role" className={inputCls} value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })}>
              {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div className="mb-5">
            <DistrictScopedSelect
              id="new-user-office"
              label={t('adminUsers.office')}
              className={inputCls}
              labelClassName={labelCls}
              items={offices}
              districts={districts}
              governorates={governorates}
              value={form.officeId}
              onChange={(v) => setForm({ ...form, officeId: v })}
            />
          </div>
          <button
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            disabled={busy}
          >
            {busy ? t('adminUsers.creating') : t('adminUsers.create')}
          </button>
        </form>
        )}
      </div>
    </div>
  )
}
