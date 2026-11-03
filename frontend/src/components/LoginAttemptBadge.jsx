import { useLanguage } from '../context/LanguageContext.jsx'
import { Badge } from './ui/index.jsx'

// A login attempt either succeeded or failed with one of the
// LoginFailureReason values; both are shown as a single badge. Used by the
// audit log's Login Attempts tab and the per-user activity page.
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
