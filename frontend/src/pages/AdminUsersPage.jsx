import { useEffect, useState } from 'react'
import client from '../api/client.js'
import DistrictScopedSelect from '../components/DistrictScopedSelect.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function AdminUsersPage() {
  const { t } = useLanguage()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [offices, setOffices] = useState([])
  const [districts, setDistricts] = useState([])
  const [governorates, setGovernorates] = useState([])
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', roleName: '', officeId: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

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
    } catch (err) {
      setError(err.response?.data?.message ?? t('adminUsers.errorGeneric'))
    } finally { setBusy(false) }
  }

  return (
    <div>
      <h1>{t('adminUsers.title')}</h1>
      <div className="detail-grid">
        <div className="card">
          <h2>{t('adminUsers.staffAccounts')}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>{t('adminUsers.colUsername')}</th><th>{t('adminUsers.colFullName')}</th>
                <th>{t('adminUsers.colRoles')}</th><th>{t('adminUsers.colOffice')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td><td>{u.fullName}</td><td>{u.roles.join(', ')}</td><td>{u.officeName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="card" onSubmit={handleSubmit}>
          <h2>{t('adminUsers.createUser')}</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <label>{t('adminUsers.username')}<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label>
          <label>{t('adminUsers.tempPassword')}<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          <label>{t('adminUsers.fullName')}<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></label>
          <label>{t('adminUsers.email')}<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>{t('adminUsers.role')}
            <select value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })}>
              {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </label>
          <DistrictScopedSelect
            id="new-user-office"
            label={t('adminUsers.office')}
            items={offices}
            districts={districts}
            governorates={governorates}
            value={form.officeId}
            onChange={(v) => setForm({ ...form, officeId: v })}
          />
          <button className="btn btn-primary" disabled={busy}>{busy ? t('adminUsers.creating') : t('adminUsers.create')}</button>
        </form>
      </div>
    </div>
  )
}
