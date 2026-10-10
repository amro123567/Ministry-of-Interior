import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BarChart3, CheckCircle2, CirclePlus, Clock, Gauge as GaugeIcon, Layers, RefreshCw } from 'lucide-react'
import client from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { SkeletonKpiRow, SkeletonLine } from '../components/Skeleton.jsx'
import KpiCard, { Gauge, Sparkline, TrendPill } from '../components/dashboard/KpiCard.jsx'
import WaitingForReviewTable from '../components/dashboard/WaitingForReviewTable.jsx'
import RequestsOverviewChart from '../components/dashboard/RequestsOverviewChart.jsx'
import WorkloadDonut from '../components/dashboard/WorkloadDonut.jsx'
import ManagementInsights from '../components/dashboard/ManagementInsights.jsx'
import ActivityFeed from '../components/dashboard/ActivityFeed.jsx'
import {
  activeCount, approvalRate, bucketByPeriod, humanizeHours, slaHealth, sortBySla, weekOverWeek,
} from '../components/dashboard/dashboardUtils.js'

const OPEN = ['SUBMITTED', 'UNDER_REVIEW']

// What the signed-in person should look at first, decided by what they are allowed to do:
// reviewers see what is waiting for review, officers see what is assigned to them, and
// read-only users see the most urgent requests in the system.
function queueFor(hasPermission) {
  if (hasPermission('REQUEST_TRANSITION_REVIEW', 'REQUEST_TRANSITION_DECIDE')) {
    return { key: 'review', params: {}, keep: (r) => OPEN.includes(r.status), more: '/requests?status=SUBMITTED' }
  }
  if (hasPermission('REQUEST_TRANSITION_SUBMIT')) {
    return { key: 'mine', params: { assignedToMe: true }, keep: (r) => r.status !== 'ARCHIVED' && r.status !== 'REJECTED' && r.status !== 'APPROVED', more: '/requests?mine=1' }
  }
  return { key: 'watch', params: {}, keep: (r) => r.slaStatus !== 'ON_TRACK', more: '/requests?sla=OVERDUE' }
}

export default function DashboardPage() {
  const { t, lang } = useLanguage()
  const { hasPermission, user } = useAuth()
  const queue = useMemo(() => queueFor(hasPermission), [hasPermission])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [allRows, setAllRows] = useState(null)   // every request: feeds charts, KPIs and the feed
  const [queueRows, setQueueRows] = useState(null) // the signed-in person's queue (may equal allRows)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    client.get('/dashboard/summary').then((r) => setSummary(r.data)).catch(() => setError(t('dashboard.couldNotLoad')))
  }, [t, reloadKey])

  useEffect(() => {
    const own = Object.keys(queue.params).length > 0
    const scoped = client.get('/requests', { params: queue.params })
    const everything = own ? client.get('/requests', { params: {} }) : scoped
    scoped.then((r) => setQueueRows(r.data.filter(queue.keep).sort(sortBySla).slice(0, 50))).catch(() => setQueueRows([]))
    everything.then((r) => setAllRows(r.data)).catch(() => setAllRows([]))
  }, [queue, reloadKey])

  const week = useMemo(() => (allRows ? weekOverWeek(allRows) : null), [allRows])
  const spark = useMemo(() => (allRows ? bucketByPeriod(allRows, 'weekly', Date.now(), lang).map((b) => b.total) : null), [allRows, lang])
  const nextDue = useMemo(() => (allRows
    ? allRows.filter((r) => r.slaStatus === 'DUE_SOON' && r.dueAt).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0]
    : null), [allRows])

  if (error) {
    return (
      <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg" role="alert">
        {error}
      </div>
    )
  }

  const hour = new Date().getHours()
  const greet = t(`dashboard.greeting.${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}`)
  const firstName = String(user?.fullName || user?.username || '').trim().split(/\s+/)[0]
  const today = new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const canCreate = hasPermission('REQUEST_TRANSITION_SUBMIT', 'REQUEST_TRANSITION_REVIEW', 'REQUEST_TRANSITION_DECIDE', 'REQUEST_TRANSITION_ARCHIVE')
  const heading = (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">{firstName ? `${greet}, ${firstName} · ` : ''}{today}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('dashboard.subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={reload} className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:text-navy">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />{t('dashboard.refresh')}
        </button>
        {hasPermission('REPORTS_VIEW') && (
          <Link to="/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:text-navy">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />{t('dashboard.openReports')}
          </Link>
        )}
        {canCreate && (
          <Link to="/requests/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white shadow-sm hover:opacity-90">
            <CirclePlus className="h-4 w-4" aria-hidden="true" />{t('dashboard.newRequest')}
          </Link>
        )}
      </div>
    </div>
  )

  if (!summary) {
    return (
      <div>
        {heading}
        <SkeletonKpiRow count={5} />
        <div className="dash-card p-6"><SkeletonLine height={240} /></div>
      </div>
    )
  }

  const active = activeCount(summary.byStatus)
  const overduePct = active ? Math.round((summary.overdueCount / active) * 100) : 0
  const health = slaHealth(summary)
  const rate = approvalRate(summary.byStatus)
  const avg = humanizeHours(summary.avgResolutionHours || 0)
  const approved = summary.byStatus.APPROVED ?? 0
  const rejected = summary.byStatus.REJECTED ?? 0
  const nextDueHours = nextDue ? Math.max(0, (new Date(nextDue.dueAt).getTime() - Date.now()) / 3600000) : null
  const nextDueLabel = nextDueHours == null ? null : humanizeHours(nextDueHours)

  return (
    <div>
      {heading}

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          testId="kpi-active" icon={Layers} tone="brand" label={t('dashboard.totalRequests')} value={active} to="/requests"
          visual={spark ? (c) => <Sparkline values={spark} stroke={c} label={t('dashboard.kpi.volumeTrend')} /> : null}
          footer={week && (week.pct != null
            ? <><TrendPill pct={week.pct} suffix={` ${t('dashboard.kpi.vsLastWeek')}`} /></>
            : <span><b className="text-navy">{week.cur}</b> {t('dashboard.kpi.newThisWeek')}</span>)}
        />
        <KpiCard
          testId="kpi-overdue" icon={AlertTriangle} tone="crit" label={t('dashboard.overdue')} value={summary.overdueCount}
          to="/requests?sla=OVERDUE" emphasis={summary.overdueCount > 0}
          footer={active > 0 && (
            <span className="dash-chip border-crit/30 bg-crit-tint text-crit-ink">{overduePct}% {t('dashboard.kpi.ofActive')}</span>
          )}
        />
        <KpiCard
          testId="kpi-due-soon" icon={Clock} tone="warn" label={t('dashboard.dueSoon')} value={summary.dueSoonCount}
          to="/requests?sla=DUE_SOON"
          footer={nextDue
            ? <span>{t('dashboard.kpi.nextDue')} <b className="text-navy">{nextDue.referenceNumber}</b> · {nextDueLabel.value}{t(`dashboard.table.unit.${nextDueLabel.unit}`)}</span>
            : <span>{t('dashboard.kpi.nothingDueSoon')}</span>}
        />
        <KpiCard
          testId="kpi-resolution" icon={GaugeIcon} tone="active" label={t('dashboard.avgResolution')}
          value={summary.closedThisWeek ? avg.value : '—'} unit={summary.closedThisWeek ? t(`dashboard.table.unit.${avg.unit}`) : null}
          visual={health != null ? (c) => <Gauge percent={health} stroke={c} label={`${t('dashboard.kpi.slaHealth')} ${health}%`} /> : null}
          footer={<span><b className="text-navy">{summary.closedThisWeek}</b> {t('dashboard.closedThisWeek').toLowerCase()}{health != null && <> · <b className="text-navy">{health}%</b> {t('dashboard.kpi.slaHealth')}</>}</span>}
        />
        <KpiCard
          testId="kpi-approval" icon={CheckCircle2} tone="ok" label={t('dashboard.kpi.approvalRate')}
          value={rate == null ? '—' : rate} unit={rate == null ? null : '%'}
          visual={rate != null ? (c) => <Gauge percent={rate} stroke={c} label={`${t('dashboard.kpi.approvalRate')} ${rate}%`} /> : null}
          footer={<span><b className="text-ok-ink">{approved}</b> {t('status.APPROVED')} · <b className="text-crit-ink">{rejected}</b> {t('status.REJECTED')}</span>}
        />
      </div>

      <ManagementInsights summary={summary} rows={allRows} />

      <div className="mb-6">
        <WaitingForReviewTable queue={queue} rows={queueRows} loading={queueRows === null} onChanged={reload} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <div className="lg:col-span-2 xl:col-span-6"><RequestsOverviewChart rows={allRows} /></div>
        <div className="xl:col-span-3"><WorkloadDonut rows={allRows} /></div>
        <div className="xl:col-span-3"><ActivityFeed rows={allRows} /></div>
      </div>
    </div>
  )
}
