import { useEffect, useState } from 'react'
import client from '../api/client.js'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [offices, setOffices] = useState([])
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
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null); setBusy(true)
    try {
      await client.post('/users', { ...form, officeId: form.officeId ? Number(form.officeId) : null })
      setForm((f) => ({ ...f, username: '', password: '', fullName: '', email: '' }))
      reload()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Could not create the user.')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <h1>Users &amp; roles</h1>
      <div className="detail-grid">
        <div className="card">
          <h2>Staff accounts</h2>
          <table className="table">
            <thead><tr><th>Username</th><th>Full name</th><th>Roles</th><th>Office</th></tr></thead>
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
          <h2>Create a user</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <label>Username<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label>
          <label>Temporary password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          <label>Full name<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></label>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Role
            <select value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })}>
              {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </label>
          <label>Office
            <select value={form.officeId} onChange={(e) => setForm({ ...form, officeId: e.target.value })}>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.nameEn}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
        </form>
      </div>
    </div>
  )
}
