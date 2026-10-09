import { useLanguage } from '../context/LanguageContext.jsx'
import { Badge } from './ui/index.jsx'

// Tints for entity.AccessType (VIEW_RECORD, VIEW_DOCUMENT, SEARCH_RESULT,
// EXPORT) -- a small, closed enum (unlike the global audit log's free-form
// action strings, see AuditLogPage's ACTION_TINT_RULES), so a direct
// lookup table is simpler than a keyword-matching rule list. Used by
// CitizenAuditSection (per-citizen "who read this record") and
// UserActivityPage (per-employee "what has this employee been looking
// at") -- both consume RecordAccessLogDto from the same
// CitizenAuditController endpoints, frontend integration pass Step 8.
const ACCESS_TYPE_STYLES = {
  VIEW_RECORD: 'info',
  VIEW_DOCUMENT: 'info',
  SEARCH_RESULT: 'draft',
  EXPORT: 'warning',
}

export default function AccessTypeBadge({ accessType }) {
  const { t } = useLanguage()
  const style = ACCESS_TYPE_STYLES[accessType] || ACCESS_TYPE_STYLES.VIEW_RECORD
  return (
    <Badge tone={style}>
      {t(`accessType.${accessType}`, accessType?.replace('_', ' ') ?? '—')}
    </Badge>
  )
}
