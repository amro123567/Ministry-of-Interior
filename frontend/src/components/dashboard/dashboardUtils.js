// Pure helpers for the dashboard. Everything here is derived from rows the API
// already returns -- nothing is estimated or invented.

export const DAY = 86400000
export const ACTIVE_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW']
export const CHART_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']

export const parseDate = (v) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Initials for the avatar badge ("Rami Haddad" -> "RH"). */
export function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Stable avatar colour from a name, drawn from the dashboard palette. */
const AVATAR_TONES = [
  'bg-brand-tint text-brand', 'bg-active-tint text-active', 'bg-ok-tint text-ok-ink',
  'bg-warn-tint text-warn-ink', 'bg-crit-tint text-crit-ink', 'bg-slate-100 text-slate-700',
]
export function avatarTone(name) {
  let h = 0
  for (const ch of String(name ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_TONES[h % AVATAR_TONES.length]
}

/**
 * SLA countdown for one row.
 * Returns { state: 'overdue'|'soon'|'ok'|'none', hours, pct } where pct is the
 * share of the SLA window already used (createdAt -> dueAt), clamped to 0..100.
 */
export function slaCountdown(row, now = Date.now()) {
  const due = parseDate(row.dueAt)
  if (!due) return { state: 'none', hours: 0, pct: 0 }
  const created = parseDate(row.createdAt)
  const left = due.getTime() - now
  const total = created ? Math.max(due.getTime() - created.getTime(), 1) : null
  const pct = total ? Math.min(100, Math.max(0, ((total - left) / total) * 100)) : left <= 0 ? 100 : 50
  const hours = Math.abs(left) / 3600000
  const state = left <= 0 ? 'overdue' : row.slaStatus === 'DUE_SOON' || left <= 48 * 3600000 ? 'soon' : 'ok'
  return { state, hours, pct }
}

/** { value, unit } with unit in 'm' | 'h' | 'd' for a duration in hours. */
export function humanizeHours(hours) {
  if (hours < 1) return { value: Math.max(1, Math.round(hours * 60)), unit: 'm' }
  if (hours < 48) return { value: Math.round(hours), unit: 'h' }
  return { value: Math.round(hours / 24), unit: 'd' }
}

/** Active = draft / submitted / under review, summed from the summary's byStatus map. */
export function activeCount(byStatus = {}) {
  return ACTIVE_STATUSES.reduce((n, s) => n + (byStatus[s] ?? 0), 0)
}

/** Approved / (approved + rejected) as a whole percent; null when nothing has been decided. */
export function approvalRate(byStatus = {}) {
  const a = byStatus.APPROVED ?? 0
  const r = byStatus.REJECTED ?? 0
  return a + r === 0 ? null : Math.round((a / (a + r)) * 100)
}

/** Whole-percent share of active requests that are not overdue; null with no active requests. */
export function slaHealth(summary) {
  const active = activeCount(summary.byStatus)
  if (!active) return null
  return Math.max(0, Math.min(100, Math.round(((active - summary.overdueCount) / active) * 100)))
}

const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime() }

/**
 * Buckets rows by createdAt into the last `count` days or weeks (oldest first),
 * counting each bucket per *current* status. Rows outside the window are ignored.
 */
export function bucketByPeriod(rows, mode, now = Date.now(), lang = 'en') {
  const step = mode === 'weekly' ? 7 * DAY : DAY
  const count = mode === 'weekly' ? 8 : 14
  const end = startOfDay(now) + DAY // exclusive end of "today"
  const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric' })
  const buckets = Array.from({ length: count }, (_, i) => {
    const start = end - (count - i) * step
    return { start, label: fmt.format(new Date(start)), total: 0, ...Object.fromEntries(CHART_STATUSES.map((s) => [s, 0])) }
  })
  for (const r of rows) {
    const d = parseDate(r.createdAt)
    if (!d) continue
    const idx = Math.floor((d.getTime() - (end - count * step)) / step)
    if (idx < 0 || idx >= count) continue
    const key = CHART_STATUSES.includes(r.status) ? r.status : null
    if (key) buckets[idx][key] += 1
    buckets[idx].total += 1
  }
  return buckets
}

/**
 * Created-in-last-7-days vs the 7 days before that.
 * pct is null when the earlier week had no requests (a percentage would be meaningless).
 */
export function weekOverWeek(rows, now = Date.now()) {
  let cur = 0
  let prev = 0
  for (const r of rows) {
    const d = parseDate(r.createdAt)
    if (!d) continue
    const age = now - d.getTime()
    if (age < 0) continue
    if (age < 7 * DAY) cur += 1
    else if (age < 14 * DAY) prev += 1
  }
  return { cur, prev, pct: prev === 0 ? null : Math.round(((cur - prev) / prev) * 100) }
}

/** Count per document type, largest first, tail folded into "other". */
export function groupCounts(rows, keyOf, max = 5) {
  const map = new Map()
  for (const r of rows) {
    const k = keyOf(r)
    if (!k) continue
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  if (sorted.length <= max) return sorted
  const head = sorted.slice(0, max - 1)
  return [...head, { name: '__other__', value: sorted.slice(max - 1).reduce((n, x) => n + x.value, 0) }]
}

/** Most urgent first: overdue (longest overdue first), then due soon (soonest first). */
export function sortBySla(a, b) {
  const rank = { OVERDUE: 0, DUE_SOON: 1, ON_TRACK: 2 }
  return (rank[a.slaStatus] ?? 3) - (rank[b.slaStatus] ?? 3)
    || String(a.dueAt ?? '9').localeCompare(String(b.dueAt ?? '9'))
}

// ---- CSV -------------------------------------------------------------------
// Spreadsheet apps execute cells that start with = + - @; prefix those with an apostrophe.
const csvCell = (v) => {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers, records) {
  return [headers, ...records].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

/** Download text as a UTF-8 CSV file (with BOM so Excel reads Arabic correctly). */
export function downloadTextFile(text, filename) {
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}
