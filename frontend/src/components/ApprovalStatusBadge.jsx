import { useLanguage } from '../context/LanguageContext.jsx'
import { Badge } from './ui/index.jsx'

// PENDING/APPROVED/REJECTED is one shared enum on the backend
// (ApprovalStatus, used by both RegistryTransfer and
// CivilStatusAmendment) -- one badge for both, instead of duplicating
// this per domain the way StatusBadge is dedicated to correspondence
// request status.
const STYLES = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

export default function ApprovalStatusBadge({ status }) {
  const { t } = useLanguage()
  const style = STYLES[status] || STYLES.PENDING
  return <Badge tone={style}>{t(`approvalStatus.${status}`, status)}</Badge>
}
