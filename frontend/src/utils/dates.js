import { format, parseISO, isValid } from 'date-fns'
import { ar } from 'date-fns/locale/ar'

/**
 * Parses an API date. Date-only values ("1990-05-10") become local midnight
 * (new Date("1990-05-10") is UTC midnight, which shows the previous day in
 * time zones west of UTC); full timestamps keep their exact instant.
 * Returns null for empty or unreadable input.
 */
export function toDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date || typeof value === 'number') {
    const d = value instanceof Date ? value : new Date(value)
    return isValid(d) ? d : null
  }
  let s = String(value)
  // The API sends server timestamps in UTC. When one arrives without a zone marker
  // ("2026-11-03T22:41:00"), parseISO would read it as local time and show it hours
  // off, so mark it as UTC first. Date-only values keep their local-midnight handling.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    s = s.replace(' ', 'T') + 'Z'
  }
  const d = parseISO(s)
  return isValid(d) ? d : null
}

/** Formats an API date, or returns `fallback` ('' by default) when it is missing or invalid. Never throws. */
export function fmtDate(value, pattern = 'MMM d, yyyy', fallback = '') {
  const d = toDate(value)
  if (!d) return fallback
  // month names follow the interface language (LanguageContext keeps <html lang> in step)
  const locale = typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? ar : undefined
  return format(d, pattern, { locale })
}

/** Today's date as YYYY-MM-DD in the user's own time zone (toISOString() would give the UTC date). */
export function todayISO(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
