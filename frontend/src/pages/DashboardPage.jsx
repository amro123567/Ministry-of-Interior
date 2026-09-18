import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client.js'

const STATUS_LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get('/dashboard/summary').then((r) => setSummary(r.data)).catch(() => setError('Could not load the dashboard.'))
  }, [])

  if (error) return <div className="alert alert-error">{error}</div>
  if (!summary) return <p className="muted">Loading…</p>

  const maxCount = Math.max(1, ...Object.values(summary.byStatus))

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{summary.total}</div>
          <div className="kpi-label">Total requests</div>
        </div>
        <div className="kpi-card kpi-danger">
          <div className="kpi-value">{summary.overdueCount}</div>
          <div className="kpi-label">Overdue</div>
        </div>
        <div className="kpi-card kpi-warn">
          <div className="kpi-value">{summary.dueSoonCount}</div>
          <div className="kpi-label">Due within 48h</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{summary.closedThisWeek}</div>
          <div className="kpi-label">Closed this week</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{summary.avgResolutionHours}h</div>
          <div className="kpi-label">Avg. resolution</div>
        </div>
      </div>

      <div className="card">
        <h2>Requests by status</h2>
        <div className="bar-chart">
          {Object.entries(summary.byStatus).map(([status, count]) => (
            <div className="bar-row" key={status}>
              <span className="bar-label">{STATUS_LABELS[status] ?? status}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
              </div>
              <span className="bar-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <p><Link className="btn btn-primary" to="/requests">View all correspondence →</Link></p>
    </div>
  )
}
