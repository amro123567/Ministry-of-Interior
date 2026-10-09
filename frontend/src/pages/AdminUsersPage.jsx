import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client.js'
import DistrictScopedSelect from '../components/DistrictScopedSelect.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { inputCls, labelCls } from '../ui.js'


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
  const { hasPermission, user: me } = useAuth()
  const [confirmId, setConfirmId] = useState(null)
  const [rowError, setRowError] = useState(null)
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

  async function toggleEnabled(u) {
    setRowError(null)
    try {
      await client.patch(`/users/${u.id}/enabled`, { enabled: !u.enabled })
      setConfirmId(null)
      reload()
    } catch (err) {
      setConfirmId(null)
      setRowError(err.response?.data?.message ?? t('adminUsers.errorGeneric'))
    }
  }

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
        <h1 className="text-xl font-bold text-text-primary">{t('adminUsers.title')}</h1>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setError(null) }}
          aria-expanded={showForm}
          className="btn-primary"
        >
          {showForm ? t('adminUsers.cancel') : t('adminUsers.newUser')}
        </button>
      </div>

      <div className={`grid grid-cols-1 gap-4 items-start ${showForm ? 'lg:grid-cols-[1fr_380px]' : ''}`}>
        <div className="card p-5">
          <h2 className="text-sm font-bold text-text-primary mb-4">{t('adminUsers.staffAccounts')}</h2>
          {rowError && (
            <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{rowError}</div>
          )}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="th-cell">{t('adminUsers.colUsername')}</th>
                  <th className="th-cell">{t('adminUsers.colFullName')}</th>
                  <th className="th-cell">{t('adminUsers.colRoles')}</th>
                  <th className="th-cell">{t('adminUsers.colOffice')}</th>
                  <th className="th-cell">{t('adminUsers.colStatus')}</th>
                  {/* AUDIT_VIEW-gated, matching UserActivityPage's own
                      route gate in App.jsx (not USER_MANAGE, which is all
                      this page itself requires) -- an admin who somehow
                      held USER_MANAGE without AUDIT_VIEW would see this
                      column disappear rather than a link the API would
                      403 on. */}
                  {hasPermission('AUDIT_VIEW') && (
                    <th className="th-cell">{t('adminUsers.colActivity')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="data-row">
                    <td className="td-cell text-sm font-semibold text-text-primary whitespace-nowrap">{u.username}</td>
                    <td className="td-cell text-sm text-slate-700">{u.fullName}</td>
                    <td className="td-cell text-sm text-slate-700">{u.roles.join(', ')}</td>
                    <td className="td-cell text-sm text-slate-700">{u.officeName ?? '—'}</td>
                    <td className="td-cell text-sm whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        u.enabled ? 'bg-badge-success-bg text-badge-success-fg border-badge-success-bd' : 'bg-badge-draft-bg text-badge-draft-fg border-badge-draft-bd'
                      }`}>
                        {u.enabled ? t('adminUsers.active') : t('adminUsers.inactive')}
                      </span>
                      {u.username === me?.username ? (
                        <span className="ms-2 text-xs text-text-secondary">{t('adminUsers.you')}</span>
                      ) : confirmId === u.id ? (
                        <span className="ms-2 inline-flex items-center gap-2">
                          <button type="button" onClick={() => toggleEnabled(u)} className="text-xs font-bold text-badge-danger-fg hover:underline">
                            {t('adminUsers.confirm')}
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className="text-xs text-text-secondary hover:underline">
                            {t('adminUsers.cancel')}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => (u.enabled ? setConfirmId(u.id) : toggleEnabled(u))}
                          className="ms-2 text-xs font-semibold text-primary hover:underline"
                        >
                          {u.enabled ? t('adminUsers.deactivate') : t('adminUsers.activate')}
                        </button>
                      )}
                    </td>
                    {hasPermission('AUDIT_VIEW') && (
                      <td className="td-cell text-sm whitespace-nowrap">
                        <Link
                          to={`/admin/users/${u.id}/activity`}
                          state={{ username: u.username, fullName: u.fullName }}
                          className="font-semibold text-primary hover:underline"
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
        <form className="card p-5" onSubmit={handleSubmit}>
          <h2 className="text-sm font-bold text-text-primary mb-4">{t('adminUsers.createUser')}</h2>
          {error && (
            <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{error}</div>
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
            className="w-full btn-primary "
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
