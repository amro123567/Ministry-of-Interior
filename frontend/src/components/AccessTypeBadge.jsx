import { useLanguage } from '../context/LanguageContext.jsx'
import { Badge } from './ui/index.jsx'

// Tints for AccessType (VIEW_RECORD, VIEW_DOCUMENT, SEARCH_RESULT, EXPORT).
// The enum is small and closed, so a lookup table is enough. Used by the
// citizen audit section and the per-user activity page.
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
