import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import client from '../api/client.js'
import { STATUS_COLORS } from '../components/StatusBadge.jsx'

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

  const chartData = Object.entries(summary.byStatus).map(([status, count]) => ({
    status,
    label: STATUS_LABELS[status] ?? status,
    count,
  }))

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
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 24, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={110} />
              <Tooltip formatter={(value) => [value, 'Requests']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p><Link className="btn btn-primary" to="/requests">View all correspondence →</Link></p>
    </div>
  )
}
