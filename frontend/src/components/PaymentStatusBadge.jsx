import { useLanguage } from '../context/LanguageContext.jsx'
import { Badge } from './ui/index.jsx'

// Badge for PaymentStatus (PAID, REVERSED, VOIDED), used on the request
// detail page's SLA/payments panel. VOIDED is never set by
// RequestFinanceService today but is a valid value of the enum.
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
