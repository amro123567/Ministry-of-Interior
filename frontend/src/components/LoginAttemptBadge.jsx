import { useLanguage } from '../context/LanguageContext.jsx'
import { Badge } from './ui/index.jsx'

// A LoginAttemptDto is either successful (failureReason is null) or one of
// the 4 LoginFailureReason values -- shown as a single badge rather than a
// boolean pill plus a separate reason column, since "why it failed" is the
// whole point of looking at this table. Used by AuditLogPage's Login
// Attempts tab (global, most-recent-50) and UserActivityPage (scoped to
// one employee's own username) -- frontend integration pass Step 8.
export default function LoginAttemptBadge({ wasSuccessful, failureReason }) {
  const { t } = useLanguage()
  if (wasSuccessful) {
    return <Badge tone="success">{t('loginAttempt.success')}</Badge>
  }
  return (
    <Badge tone="danger">
      {failureReason ? t(`loginFailureReason.${failureReason}`, failureReason.replace('_', ' ')) : t('loginAttempt.failed')}
    </Badge>
  )
}
