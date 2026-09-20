import { useLanguage } from '../context/LanguageContext.jsx'

// PAID/REVERSED/VOIDED (PaymentStatus) -- its own file, matching how
// ApprovalStatusBadge is a small shared-enum badge of its own rather than
// folded into StatusBadge (which is dedicated to correspondence-request
// status). Used on the request detail page's SLA/payments panel (frontend
// integration pass Step 7). VOIDED has no writer in this codebase yet
// (RequestFinanceService only ever sets PAID or REVERSED) but is included
// since it's a real value of the ERD's enum_payment_status.
const STYLES = {
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REVERSED: 'bg-rose-50 text-rose-700 border-rose-200',
  VOIDED: 'bg-slate-100 text-slate-500 border-slate-300',
}

export default function PaymentStatusBadge({ status }) {
  const { t } = useLanguage()
  const style = STYLES[status] || STYLES.PAID
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {t(`paymentStatus.${status}`, status)}
    </span>
  )
}
