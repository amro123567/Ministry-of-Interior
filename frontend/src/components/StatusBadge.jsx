import { useLanguage } from '../context/LanguageContext.jsx'

// Hex colors used by the dashboard bar chart's per-segment fill. This is
// the dataviz-skill validated categorical order (adjacent-pair CVD
// Delta-E >= 9.1 in light mode), kept as the single source of truth so the
// chart's colors never drift from any other place that might reuse them.
export const STATUS_COLORS = {
  DRAFT: '#2a78d6',
  SUBMITTED: '#eb6834',
  UNDER_REVIEW: '#1baf7a',
  APPROVED: '#eda100',
  REJECTED: '#e87ba4',
  ARCHIVED: '#008300',
}

// Independent Tailwind soft-pill treatment for the badge itself -- chosen
// for readability at small badge size, not tied to the chart's hexes above.
const STATUS_STYLES = {
  DRAFT: 'bg-slate-50 text-slate-600 border-slate-200',
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
  UNDER_REVIEW: 'bg-violet-50 text-violet-700 border-violet-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  ARCHIVED: 'bg-stone-50 text-stone-600 border-stone-200',
}

export default function StatusBadge({ status }) {
  const { t } = useLanguage()
  const style = STATUS_STYLES[status] || STATUS_STYLES.DRAFT
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {t(`status.${status}`, status.replace('_', ' '))}
    </span>
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
// the request detail page's SLA/payments panel (frontend integration pass
// Step 7).
export function SlaBadge({ slaStatus }) {
  const { t } = useLanguage()
  if (slaStatus === 'OVERDUE') {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
        {t('sla.OVERDUE')}
      </span>
    )
  }
  if (slaStatus === 'DUE_SOON') {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        {t('sla.DUE_SOON')}
      </span>
    )
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
const SLA_RECORD_STYLES = {
  ON_TRACK: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DUE_SOON: 'bg-amber-50 text-amber-700 border-amber-200',
  OVERDUE: 'bg-red-50 text-red-600 border-red-200',
  MET: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  BREACHED: 'bg-red-100 text-red-700 border-red-300',
}

export function SlaRecordBadge({ slaStatus }) {
  const { t } = useLanguage()
  if (!slaStatus) return <span className="text-slate-300">—</span>
  const style = SLA_RECORD_STYLES[slaStatus] || SLA_RECORD_STYLES.ON_TRACK
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {t(`sla.${slaStatus}`, slaStatus.replace('_', ' '))}
    </span>
  )
}
