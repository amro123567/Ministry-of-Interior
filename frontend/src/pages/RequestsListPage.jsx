import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client.js'
import StatusBadge, { SlaBadge } from '../components/StatusBadge.jsx'

const STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']

export default function RequestsListPage() {
  const [requests, setRequests] = useState([])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    client.get('/requests', { params: { status: status || undefined, search: search || undefined } })
      .then((r) => setRequests(r.data))
      .catch(() => setError('Could not load correspondence requests.'))
      .finally(() => setLoading(false))
  }, [status, search])

  useEffect(() => { load() }, [load])

  async function exportCsv() {
    const res = await client.get('/requests/export', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'correspondence_requests.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="page-header">
        <h1>Correspondence</h1>
        <div className="page-actions">
          <button className="btn" onClick={exportCsv}>Export CSV</button>
          <Link className="btn btn-primary" to="/requests/new">+ New request</Link>
        </div>
      </div>

      <div className="filter-bar">
        <input
          placeholder="Search by reference, citizen name or registry number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="muted">No correspondence requests match this filter.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Reference</th><th>Citizen</th><th>Document type</th><th>Status</th>
              <th>Assigned to</th><th>Due</th><th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td><Link to={`/requests/${r.id}`}>{r.referenceNumber}</Link></td>
                <td>{r.citizenName}</td>
                <td>{r.documentTypeName}</td>
                <td><StatusBadge status={r.status} /> <SlaBadge overdue={r.overdue} dueAt={r.dueAt} /></td>
                <td>{r.assignedToName ?? <span className="muted">Unassigned</span>}</td>
                <td>{r.dueAt ? new Date(r.dueAt).toLocaleDateString() : '—'}</td>
                <td><Link to={`/requests/${r.id}`}>Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
