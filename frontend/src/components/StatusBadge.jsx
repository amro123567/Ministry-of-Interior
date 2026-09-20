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
