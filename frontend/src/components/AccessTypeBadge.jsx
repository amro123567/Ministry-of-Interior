import { useLanguage } from '../context/LanguageContext.jsx'

// Tints for entity.AccessType (VIEW_RECORD, VIEW_DOCUMENT, SEARCH_RESULT,
// EXPORT) -- a small, closed enum (unlike the global audit log's free-form
// action strings, see AuditLogPage's ACTION_TINT_RULES), so a direct
// lookup table is simpler than a keyword-matching rule list. Used by
// CitizenAuditSection (per-citizen "who read this record") and
// UserActivityPage (per-employee "what has this employee been looking
// at") -- both consume RecordAccessLogDto from the same
// CitizenAuditController endpoints, frontend integration pass Step 8.
const ACCESS_TYPE_STYLES = {
  VIEW_RECORD: 'bg-sky-50 text-sky-700 border-sky-200',
  VIEW_DOCUMENT: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  SEARCH_RESULT: 'bg-slate-50 text-slate-600 border-slate-200',
  EXPORT: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function AccessTypeBadge({ accessType }) {
  const { t } = useLanguage()
  const style = ACCESS_TYPE_STYLES[accessType] || ACCESS_TYPE_STYLES.VIEW_RECORD
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {t(`accessType.${accessType}`, accessType?.replace('_', ' ') ?? '—')}
    </span>
  )
}
