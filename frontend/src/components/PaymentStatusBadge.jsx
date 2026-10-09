import { useLanguage } from '../context/LanguageContext.jsx'
import { Badge } from './ui/index.jsx'

// PAID/REVERSED/VOIDED (PaymentStatus) -- its own file, matching how
// ApprovalStatusBadge is a small shared-enum badge of its own rather than
// folded into StatusBadge (which is dedicated to correspondence-request
// status). Used on the request detail page's SLA/payments panel (frontend
// integration pass Step 7). VOIDED has no writer in this codebase yet
// (RequestFinanceService only ever sets PAID or REVERSED) but is included
// since it's a real value of the ERD's enum_payment_status.
const STYLES = {
  PAID: 'success',
  REVERSED: 'danger',
  VOIDED: 'draft',
}

export default function PaymentStatusBadge({ status }) {
  const { t } = useLanguage()
  const style = STYLES[status] || STYLES.PAID
  return <Badge tone={style}>{t(`paymentStatus.${status}`, status)}</Badge>
}
