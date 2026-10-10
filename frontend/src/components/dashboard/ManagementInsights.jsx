import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { SkeletonLine } from '../Skeleton.jsx'
import { activeCount, agingBuckets, assigneeLoad, avatarTone, initials, priorityMix } from './dashboardUtils.js'

// Management view: where the deadline risk sits, how old the open work is, and who is carrying it.
// Every figure comes from the dashboard summary or the request rows -- nothing is estimated.

function StackBar({ parts, label }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  if (!total) return <div className="h-3 rounded-full bg-slate-100" role="img" aria-label={label} />
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={label}>
      {parts.filter((p) => p.value > 0).map((p) => (
        <span key={p.key} className={p.cls} style={{ width: `${(p.value / total) * 100}%` }} />
      ))}
    </div>
  )
}

function Legend({ parts, total }) {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-1.5 text-sm">
      {parts.map((p) => (
        <li key={p.key} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-slate-700"><span className={`h-2.5 w-2.5 rounded-full ${p.cls}`} aria-hidden="true" />{p.name}</span>
          <span className="font-bold tabular-nums text-navy">{p.value}{total > 0 && <span className="ms-1.5 text-xs font-semibold text-slate-500">{Math.round((p.value / total) * 100)}%</span>}</span>
        </li>
      ))}
    </ul>
  )
}

export default function ManagementInsights({ summary, rows }) {
  const { t } = useLanguage()
  const aging = useMemo(() => (rows ? agingBuckets(rows) : null), [rows])
  const prio = useMemo(() => (rows ? priorityMix(rows) : null), [rows])
  const load = useMemo(() => (rows ? assigneeLoad(rows) : null), [rows])

  const active = activeCount(summary.byStatus)
  const overdue = summary.overdueCount
  const soon = summary.dueSoonCount
  const onTrack = Math.max(0, active - overdue - soon)
  const slaParts = [
    { key: 'ok', name: t('dashboard.insights.onTrack'), value: onTrack, cls: 'bg-ok' },
    { key: 'soon', name: t('dashboard.dueSoon'), value: soon, cls: 'bg-warn' },
    { key: 'late', name: t('dashboard.overdue'), value: overdue, cls: 'bg-crit' },
  ]
  const prioParts = prio ? [
    { key: 'URGENT', name: t('dashboard.insights.prio.URGENT'), value: prio.URGENT, cls: 'bg-crit' },
    { key: 'HIGH', name: t('dashboard.insights.prio.HIGH'), value: prio.HIGH, cls: 'bg-warn' },
    { key: 'NORMAL', name: t('dashboard.insights.prio.NORMAL'), value: prio.NORMAL, cls: 'bg-brand' },
  ] : []
  const prioTotal = prioParts.reduce((n, p) => n + p.value, 0)
  const agingMax = aging ? Math.max(1, ...aging.map((b) => b.count)) : 1
  const agingTone = ['bg-ok', 'bg-brand', 'bg-warn', 'bg-crit']
  const loadMax = load ? Math.max(1, ...load.list.map((p) => p.active)) : 1

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="management-insights">
      {/* SLA posture + priority */}
      <section className="dash-card p-5 sm:p-6" aria-labelledby="ins-sla">
        <h2 id="ins-sla" className="text-base font-bold text-navy">{t('dashboard.insights.slaTitle')}</h2>
        <p className="mt-0.5 mb-4 text-xs text-slate-600">{t('dashboard.insights.slaHint')}</p>
        <StackBar parts={slaParts} label={t('dashboard.insights.slaTitle')} />
        <Legend parts={slaParts} total={active} />
        <div className="mt-5 border-t border-hairline pt-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{t('dashboard.insights.priorityTitle')}</h3>
          {prio === null ? <SkeletonLine height={40} /> : (
            <>
              <StackBar parts={prioParts} label={t('dashboard.insights.priorityTitle')} />
              <Legend parts={prioParts} total={prioTotal} />
            </>
          )}
        </div>
      </section>

      {/* Aging */}
      <section className="dash-card p-5 sm:p-6" aria-labelledby="ins-aging">
        <h2 id="ins-aging" className="text-base font-bold text-navy">{t('dashboard.insights.agingTitle')}</h2>
        <p className="mt-0.5 mb-4 text-xs text-slate-600">{t('dashboard.insights.agingHint')}</p>
        {aging === null ? <SkeletonLine height={180} /> : (
          <ul className="space-y-4">
            {aging.map((b, i) => (
              <li key={b.key}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-slate-700">{t(`dashboard.insights.age.${b.key}`)}</span>
                  <span className="font-bold tabular-nums text-navy">{b.count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${agingTone[i]}`} style={{ width: `${(b.count / agingMax) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {aging && aging[3].count > 0 && (
          <Link to="/requests" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
            {t('dashboard.insights.reviewOldest')}
          </Link>
        )}
      </section>

      {/* Team workload */}
      <section className="dash-card p-5 sm:p-6" aria-labelledby="ins-team">
        <h2 id="ins-team" className="text-base font-bold text-navy">{t('dashboard.insights.teamTitle')}</h2>
        <p className="mt-0.5 mb-4 text-xs text-slate-600">{t('dashboard.insights.teamHint')}</p>
        {load === null ? <SkeletonLine height={180} /> : load.list.length === 0 && load.unassigned === 0 ? (
          <p className="grid h-40 place-items-center text-sm text-slate-600">{t('dashboard.insights.teamEmpty')}</p>
        ) : (
          <ul className="space-y-3.5">
            {load.list.map((p) => (
              <li key={p.name} className="flex items-center gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ${avatarTone(p.name)}`} aria-hidden="true">{initials(p.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-semibold text-slate-800">{p.name}</span>
                    <span className="shrink-0 font-bold tabular-nums text-navy">
                      {p.active}
                      {p.overdue > 0 && <span className="ms-1.5 rounded-full bg-crit-tint px-1.5 py-0.5 text-[10.5px] font-bold text-crit-ink">{p.overdue} {t('dashboard.insights.late')}</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-active" style={{ width: `${(p.active / loadMax) * 100}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {load && load.unassigned > 0 && (
          <p className="mt-4 rounded-lg bg-warn-tint px-3 py-2 text-xs font-semibold text-warn-ink">
            {load.unassigned} {t('dashboard.insights.unassigned')}
          </p>
        )}
      </section>
    </div>
  )
}
