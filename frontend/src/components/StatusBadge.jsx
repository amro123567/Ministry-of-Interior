import { useLanguage } from '../context/LanguageContext.jsx'
import { Badge } from './ui/index.jsx'

// Hex colours for the dashboard bar chart's per-segment fill. They follow the
// same semantics as the badge tones (draft = slate, submitted = blue, under
// review = amber, approved = green, rejected = red, archived = light slate)
// so a status reads the same colour in the chart and in the table. Every bar
// also carries a text label and a value, so colour is never the only cue.
export const STATUS_COLORS = {
  DRAFT: '#64748B',
  SUBMITTED: '#2563EB',
  UNDER_REVIEW: '#D97706',
  APPROVED: '#059669',
  REJECTED: '#DC2626',
  ARCHIVED: '#94A3B8',
}

// Semantic tone per request status (colours live in the @theme tokens in
// tailwind.css): Draft = neutral, Submitted = info, Under Review = warning,
// Approved = success, Rejected = danger, Archived = neutral.
const STATUS_TONES = {
  DRAFT: 'draft',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  ARCHIVED: 'draft',
}

export default function StatusBadge({ status }) {
  const { t } = useLanguage()
  return (
    <Badge tone={STATUS_TONES[status] || 'draft'}>
      {t(`status.${status}`, String(status ?? '').replace(/_/g, ' '))}
    </Badge>
  )
}

// slaStatus is computed authoritatively on the backend
// (CorrespondenceRequest.getSlaStatus()) -- every consumer of the API
// agrees on what "due soon" means instead of each client recomputing it.
// Deliberately silent (renders nothing) for ON_TRACK -- this badge sits in
// page headers next to StatusBadge and is meant to surface only what's
// actually noteworthy about an *open* request's risk. It never sees
// MET/BREACHED (those only exist on the persisted SlaRecord, not this live
// field) -- see SlaRecordBadge below for the full 5-value badge used on
// the request detail page's SLA/payments panel.
export function SlaBadge({ slaStatus }) {
  const { t } = useLanguage()
  if (slaStatus === 'OVERDUE') {
    return <Badge tone="danger">{t('sla.OVERDUE')}</Badge>
  }
  if (slaStatus === 'DUE_SOON') {
    return <Badge tone="warning">{t('sla.DUE_SOON')}</Badge>
  }
  return null
}

// The persisted SlaRecord's own slaStatus (RequestFinanceService) can be
// any of all 5 SlaStatus values -- ON_TRACK/DUE_SOON/OVERDUE describe an
// *open* request's current risk (same three SlaBadge above already
// renders), MET/BREACHED describe a *closed* request's final outcome.
// Unlike SlaBadge, this always renders something -- it's the sole status
// indicator inside the SLA/payments panel, not a secondary badge next to
// StatusBadge, so silently showing nothing for the "good" outcomes
// (ON_TRACK/MET) would leave that panel looking broken.
const SLA_RECORD_TONES = {
  ON_TRACK: 'success',
  DUE_SOON: 'warning',
  OVERDUE: 'danger',
  MET: 'success',
  BREACHED: 'danger',
}

export function SlaRecordBadge({ slaStatus }) {
  const { t } = useLanguage()
  if (!slaStatus) return <span className="text-slate-300">—</span>
  return (
    <Badge tone={SLA_RECORD_TONES[slaStatus] || 'success'}>
      {t(`sla.${slaStatus}`, slaStatus.replace('_', ' '))}
    </Badge>
  )
}
