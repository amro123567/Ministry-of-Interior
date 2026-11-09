import { useState, useRef, useEffect, useMemo, useCallback, useId } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { differenceInCalendarDays, formatDistanceToNowStrict } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'
import { Bell, ChevronRight, CheckCircle2, AlertTriangle, Clock, FileText, UserRound, CalendarClock } from 'lucide-react'
import client from '../api/client.js'
import StatusBadge from './StatusBadge.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fmtDate, toDate } from '../utils/dates.js'

const REFRESH_MS = 30_000
const CLOSED = new Set(['APPROVED', 'REJECTED', 'ARCHIVED'])
const MAX_LISTED = 6

// Colours come from the @theme tokens in tailwind.css so the card matches the
// white cards used on the Dashboard and list pages.
const TONES = {
  OVERDUE: { bar: 'border-crit', tile: 'bg-crit-tint text-crit-ink', text: 'text-crit-ink', Icon: AlertTriangle },
  DUE_SOON: { bar: 'border-warn', tile: 'bg-warn-tint text-warn-ink', text: 'text-warn-ink', Icon: Clock },
  DEFAULT: { bar: 'border-brand', tile: 'bg-brand-tint text-brand', text: 'text-slate-500', Icon: FileText },
}

const slaGroup = (r) => (r.slaStatus === 'OVERDUE' ? 'OVERDUE' : r.slaStatus === 'DUE_SOON' ? 'DUE_SOON' : 'ON_TRACK')

// Bell in the header showing how many open requests are assigned to the
// signed-in user. It reuses GET /requests?assignedToMe=true (the same filter as
// the "Assigned to me" button on the list page), so no backend change is needed
// and the count always agrees with that page. Closed requests are dropped here.
//
// - Badge: blue normally, red with a soft ping once anything is overdue; it
//   pops when the number changes and the bell rings when new work arrives.
// - Panel: a white card with filter tabs (All / Overdue / Due soon / On track).
//   Each row shows who assigned the request (from GET /requests/{id}/assignments,
//   fetched for the listed rows only when the card is opened) and its deadline.
// - On >= 640px the card hangs under the bell with a caret; on phones it is a
//   full-width sheet under the header so it can never overflow the screen.
// - Refreshes every 30s while the tab is visible, on focus, and on open.
// - All motion is disabled for users who prefer reduced motion.
export default function NotificationBell() {
  const { t, lang } = useLanguage()
  const { pathname } = useLocation()
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const { hasPermission } = useAuth()
  // Whoever can archive also sees decided (approved/rejected) requests: those are theirs to archive.
  const canArchive = hasPermission('REQUEST_TRANSITION_ARCHIVE')
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState('ALL')
  const [assigners, setAssigners] = useState({}) // id -> { by, at } | null (unknown) ; undefined = still loading
  const [ringKey, setRingKey] = useState(0)
  const ref = useRef(null)
  const buttonRef = useRef(null)
  const latest = useRef(0)
  const prevCount = useRef(null)

  const load = useCallback(() => {
    const mine = ++latest.current
    client.get('/requests', { params: { assignedToMe: true } })
      .then((res) => {
        if (mine !== latest.current) return
        const rows = Array.isArray(res.data) ? res.data : []
        setItems(rows.filter((r) => (canArchive ? r.status !== 'ARCHIVED' : !CLOSED.has(r.status))))
        setLoaded(true)
      })
      // Keep showing the last known count on a failed refresh instead of flashing 0.
      .catch(() => {})
  }, [canArchive])

  useEffect(() => {
    load()
    const tick = () => { if (document.visibilityState === 'visible') load() }
    const timer = setInterval(tick, REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      latest.current++
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  useEffect(() => {
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    function onEscape(e) {
      if (e.key === 'Escape') setOpen((wasOpen) => { if (wasOpen) buttonRef.current?.focus(); return false })
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  // Any navigation (including the browser back button) closes the panel; it always reopens on "All".
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => { if (!open) setFilter('ALL') }, [open])

  const count = items.length
  const groups = useMemo(() => {
    const g = { OVERDUE: 0, DUE_SOON: 0, ON_TRACK: 0 }
    items.forEach((r) => { g[slaGroup(r)] += 1 })
    return g
  }, [items])
  const overdue = groups.OVERDUE

  // Ring the bell when the count goes UP after the first load (never on first paint).
  useEffect(() => {
    if (!loaded) return
    if (prevCount.current !== null && count > prevCount.current) setRingKey((k) => k + 1)
    prevCount.current = count
  }, [count, loaded])

  // Filter, then overdue first / due-soon next / earliest deadline.
  const shown = useMemo(() => {
    const rank = (r) => (r.slaStatus === 'OVERDUE' ? 0 : r.slaStatus === 'DUE_SOON' ? 1 : 2)
    const due = (r) => toDate(r.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY
    return items
      .filter((r) => filter === 'ALL' || slaGroup(r) === filter)
      .sort((a, b) => rank(a) - rank(b) || due(a) - due(b))
  }, [items, filter])
  const listed = shown.slice(0, MAX_LISTED)
  const listedKey = listed.map((r) => r.id).join(',')

  // Who assigned each listed request: the newest entry of its assignment history.
  // Fetched only while the card is open, for at most MAX_LISTED rows.
  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    listedKey.split(',').filter(Boolean).forEach((id) => {
      client.get(`/requests/${id}/assignments`)
        .then((res) => {
          if (cancelled) return
          const rows = Array.isArray(res.data) ? res.data : []
          const newest = rows
            .filter((a) => typeof a?.assignedByName === 'string' && a.assignedByName)
            .sort((a, b) => (toDate(b.assignedAt)?.getTime() ?? 0) - (toDate(a.assignedAt)?.getTime() ?? 0))[0]
          setAssigners((m) => ({ ...m, [id]: newest ? { by: newest.assignedByName, at: newest.assignedAt } : null }))
        })
        .catch(() => { if (!cancelled) setAssigners((m) => ({ ...m, [id]: null })) })
    })
    return () => { cancelled = true }
  }, [open, listedKey])

  function dueText(r) {
    if (!r.dueAt) return t('notifications.noDeadline')
    const dueDate = toDate(r.dueAt)
    if (!dueDate) return t('notifications.noDeadline')
    const days = differenceInCalendarDays(dueDate, new Date())
    const unit = t('notifications.dayUnit')
    if (r.slaStatus === 'OVERDUE' || days < 0) {
      return days < 0 ? `${t('notifications.overdueBy')} ${Math.abs(days)}${unit}` : t('notifications.overdueToday')
    }
    return days === 0 ? t('notifications.dueToday') : `${t('notifications.dueIn')} ${days}${unit}`
  }

  function ago(at) {
    const d = toDate(at)
    if (!d) return null
    return formatDistanceToNowStrict(d, { addSuffix: true, locale: lang === 'ar' ? arLocale : undefined })
  }

  const label = count === 0
    ? t('notifications.none')
    : `${t('notifications.title')}: ${count}${overdue ? ` (${overdue} ${t('notifications.overdue')})` : ''}`

  const tabs = [
    { key: 'ALL', label: t('notifications.filterAll'), n: count, chip: 'bg-brand-tint text-brand' },
    { key: 'OVERDUE', label: t('notifications.statOverdue'), n: groups.OVERDUE, chip: 'bg-crit-tint text-crit-ink' },
    { key: 'DUE_SOON', label: t('notifications.statDueSoon'), n: groups.DUE_SOON, chip: 'bg-warn-tint text-warn-ink' },
    { key: 'ON_TRACK', label: t('notifications.statOnTrack'), n: groups.ON_TRACK, chip: 'bg-ok-tint text-ok-ink' },
  ]
  const moreHref = `/requests?mine=1${filter === 'ALL' ? '' : `&sla=${filter}`}`

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) load() }}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`relative grid h-10 w-10 place-items-center rounded-full border transition-all duration-150 active:scale-95
          focus:!outline-none focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
          open
            ? 'border-blue-500/50 bg-blue-600/25 text-blue-200'
            : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:bg-slate-700/60 hover:text-white'
        }`}
      >
        <Bell
          key={ringKey}
          className={`h-[18px] w-[18px] origin-top ${ringKey ? 'animate-[cts-bell-ring_800ms_ease-in-out] motion-reduce:animate-none' : ''}`}
          aria-hidden="true"
        />
        {count > 0 && (
          <span className="pointer-events-none absolute -end-1 -top-1 flex">
            {overdue > 0 && (
              <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-red-400/60 motion-reduce:hidden" />
            )}
            <span
              key={count}
              data-testid="notification-badge"
              aria-hidden="true"
              className={`relative grid h-5 min-w-5 animate-[cts-badge-pop_300ms_ease-out] place-items-center rounded-full border-2 border-[#1E2D50] px-1 text-[11px] font-bold leading-none tabular-nums text-white motion-reduce:animate-none ${
                overdue > 0 ? 'bg-red-500' : 'bg-blue-500'
              }`}
            >
              {count > 99 ? '99+' : count}
            </span>
          </span>
        )}
      </button>

      {open && (
        // Phones: fixed sheet under the header (never wider than the screen).
        // >= 640px: dropdown anchored under the bell, 26rem wide, with a caret.
        <div
          id={panelId}
          role="region"
          aria-label={t('notifications.title')}
          className="fixed inset-x-3 top-24 z-30 origin-top animate-[cts-pop-in_170ms_cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:animate-none
            sm:absolute sm:inset-x-auto sm:end-0 sm:top-[calc(100%+14px)] sm:w-[26rem] sm:origin-top-right rtl:sm:origin-top-left"
        >
          <span
            aria-hidden="true"
            className="absolute -top-1.5 end-3.5 hidden h-3 w-3 rotate-45 rounded-tl-sm border-s border-t border-hairline bg-white sm:block"
          />
          <div className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-[0_20px_48px_rgba(15,23,42,0.22)]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pb-3 pt-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
                <Bell className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold leading-5 text-navy">{t('notifications.title')}</div>
                <div className="text-xs text-slate-500">{loaded ? `${count}${t('notifications.openSuffix')}` : '…'}</div>
              </div>
            </div>

            {/* Filter tabs */}
            {loaded && count > 0 && (
              <div className="mx-4 mb-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label={t('notifications.title')}>
                {tabs.map(({ key, label: l, n, chip }) => {
                  const active = filter === key
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      disabled={n === 0 && key !== 'ALL'}
                      onClick={() => setFilter(key)}
                      className={`flex min-w-0 flex-col items-center rounded-lg px-1 py-1.5 transition-colors
                        focus:!outline-none focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-brand/60
                        disabled:cursor-not-allowed ${
                        active ? 'bg-white shadow-sm ring-1 ring-hairline' : 'hover:bg-white/60 disabled:hover:bg-transparent'
                      }`}
                    >
                      <span className={`min-w-6 rounded-full px-1.5 text-center text-sm font-bold leading-5 tabular-nums ${n === 0 ? 'bg-transparent text-slate-400' : chip}`}>{n}</span>
                      <span className={`mt-0.5 w-full truncate text-center text-[11px] font-medium ${active ? 'text-navy' : 'text-slate-500'}`}>{l}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Body */}
            <div className="border-t border-hairline">
              {!loaded ? (
                <ul className="divide-y divide-hairline" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex animate-pulse items-center gap-3 px-4 py-3.5">
                      <span className="h-10 w-10 rounded-xl bg-slate-100" />
                      <span className="flex-1 space-y-2">
                        <span className="block h-3 w-2/5 rounded bg-slate-200" />
                        <span className="block h-2.5 w-4/5 rounded bg-slate-100" />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : count === 0 ? (
                <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
                  <span className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-ok-tint text-ok">
                    <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="text-sm font-bold text-navy">{t('notifications.empty')}</div>
                  <div className="text-xs text-slate-500">{t('notifications.emptyHint')}</div>
                </div>
              ) : listed.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-slate-500">{t('notifications.filterEmpty')}</div>
              ) : (
                <ul className="max-h-[min(50vh,24rem)] divide-y divide-hairline overflow-y-auto overscroll-contain [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin]">
                  {listed.map((r) => {
                    const tone = TONES[r.slaStatus] || TONES.DEFAULT
                    const { Icon } = tone
                    const who = assigners[r.id]
                    const when = who?.at ? ago(who.at) : null
                    return (
                      <li key={r.id}>
                        <Link
                          to={`/requests/${r.id}`}
                          onClick={() => setOpen(false)}
                          className={`group flex items-start gap-3 border-s-[3px] ${tone.bar} px-4 py-3 transition-colors
                            hover:bg-slate-50 focus:!outline-none focus-visible:!outline-none focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60`}
                        >
                          <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.tile}`}>
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-bold text-navy">{r.referenceNumber}</span>
                              <span className="shrink-0"><StatusBadge status={r.status} /></span>
                            </span>
                            {r.subject && <span className="mt-0.5 block truncate text-[13px] text-slate-600">{r.subject}</span>}
                            <span className="mt-1.5 flex flex-col gap-1 text-xs">
                              {who === undefined ? (
                                <span className="h-3.5 w-36 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                              ) : who ? (
                                <span className="flex min-w-0 items-center gap-1.5 text-slate-500">
                                  <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                                  <span className="truncate">
                                    {t('notifications.assignedBy')} <b className="font-semibold text-slate-800">{who.by}</b>
                                    {when && <span className="text-slate-400"> · {when}</span>}
                                  </span>
                                </span>
                              ) : null}
                              <span className={`flex items-center gap-1.5 font-semibold ${tone.text}`}>
                                <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                {dueText(r)}
                                {r.dueAt && <span className="font-normal text-slate-400">· {fmtDate(r.dueAt, 'MMM d')}</span>}
                              </span>
                            </span>
                          </span>
                          <ChevronRight
                            className="mt-3 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <Link
              to={moreHref}
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 border-t border-hairline bg-slate-50 px-4 py-3 text-sm font-semibold text-brand transition-colors
                hover:bg-brand-tint hover:text-brand-hover focus:!outline-none focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60"
            >
              {t('notifications.viewAll')}{shown.length > MAX_LISTED ? ` (${shown.length})` : ''}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
