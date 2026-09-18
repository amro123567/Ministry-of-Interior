const COLORS = {
  DRAFT: '#6b7280',
  SUBMITTED: '#2563eb',
  UNDER_REVIEW: '#a855f7',
  APPROVED: '#16a34a',
  REJECTED: '#dc2626',
  ARCHIVED: '#78716c',
}

export default function StatusBadge({ status }) {
  const color = COLORS[status] || '#6b7280'
  return (
    <span className="badge" style={{ backgroundColor: color + '22', color, borderColor: color + '55' }}>
      {status.replace('_', ' ')}
    </span>
  )
}

export function SlaBadge({ overdue, dueAt }) {
  if (!dueAt) return null
  if (overdue) return <span className="badge badge-overdue">OVERDUE</span>
  const hoursLeft = (new Date(dueAt).getTime() - Date.now()) / 3_600_000
  if (hoursLeft <= 48) return <span className="badge badge-due-soon">DUE SOON</span>
  return null
}
