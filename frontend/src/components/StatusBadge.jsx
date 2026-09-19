const COLORS = {
  DRAFT: '#6b7280',
  SUBMITTED: '#2563eb',
  UNDER_REVIEW: '#a855f7',
  APPROVED: '#16a34a',
  REJECTED: '#dc2626',
  ARCHIVED: '#78716c',
}

// Exported so other views (e.g. the dashboard chart) use the exact same
// per-status colors as the badges, instead of maintaining a second copy.
export { COLORS as STATUS_COLORS }

export default function StatusBadge({ status }) {
  const color = COLORS[status] || '#6b7280'
  return (
    <span className="badge" style={{ backgroundColor: color + '22', color, borderColor: color + '55' }}>
      {status.replace('_', ' ')}
    </span>
  )
}

// slaStatus is now computed authoritatively on the backend
// (CorrespondenceRequest.getSlaStatus()) instead of being derived here from
// a raw dueAt timestamp -- every consumer of the API agrees on what "due
// soon" means instead of each client recomputing its own 48h window.
export function SlaBadge({ slaStatus }) {
  if (slaStatus === 'OVERDUE') return <span className="badge badge-overdue">OVERDUE</span>
  if (slaStatus === 'DUE_SOON') return <span className="badge badge-due-soon">DUE SOON</span>
  return null
}
