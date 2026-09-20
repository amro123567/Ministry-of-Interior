import { useLanguage } from '../context/LanguageContext.jsx'

// PENDING/APPROVED/REJECTED is one shared enum on the backend
// (ApprovalStatus, used by both RegistryTransfer and
// CivilStatusAmendment) -- one badge for both, instead of duplicating
// this per domain the way StatusBadge is dedicated to correspondence
// request status.
const STYLES = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function ApprovalStatusBadge({ status }) {
  const { t } = useLanguage()
  const style = STYLES[status] || STYLES.PENDING
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {t(`approvalStatus.${status}`, status)}
    </span>
  )
}
