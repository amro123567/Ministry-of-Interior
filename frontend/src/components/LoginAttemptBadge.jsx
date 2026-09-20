import { useLanguage } from '../context/LanguageContext.jsx'

// A LoginAttemptDto is either successful (failureReason is null) or one of
// the 4 LoginFailureReason values -- shown as a single badge rather than a
// boolean pill plus a separate reason column, since "why it failed" is the
// whole point of looking at this table. Used by AuditLogPage's Login
// Attempts tab (global, most-recent-50) and UserActivityPage (scoped to
// one employee's own username) -- frontend integration pass Step 8.
export default function LoginAttemptBadge({ wasSuccessful, failureReason }) {
  const { t } = useLanguage()
  if (wasSuccessful) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        {t('loginAttempt.success')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
      {failureReason ? t(`loginFailureReason.${failureReason}`, failureReason.replace('_', ' ')) : t('loginAttempt.failed')}
    </span>
  )
}
