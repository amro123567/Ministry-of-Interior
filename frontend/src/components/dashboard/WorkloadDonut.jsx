import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import client from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { SkeletonLine } from '../Skeleton.jsx'
import { groupCounts } from './dashboardUtils.js'

const COLORS = ['#2563EB', '#4F46E5', '#10B981', '#F59E0B', '#94A3B8']

// Workload distribution. The request list does not carry a department, so the
// split is by document type; people with REPORTS_VIEW can also switch to the
// per-office split from /reports/summary.
export default function WorkloadDonut({ rows }) {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const canReport = hasPermission('REPORTS_VIEW')
  const [by, setBy] = useState('type')
  const [offices, setOffices] = useState(null)

  useEffect(() => {
    if (!canReport || by !== 'office' || offices) return
    client.get('/reports/summary')
      .then((r) => setOffices((r.data.byOffice ?? []).map((o) => ({ name: o.officeName ?? o.name ?? o.label, value: o.count ?? o.total ?? 0 })).filter((o) => o.name && o.value > 0)))
      .catch(() => setOffices([]))
  }, [by, canReport, offices])

  const data = useMemo(() => {
    if (by === 'office') return offices
    return rows ? groupCounts(rows, (r) => r.documentTypeName) : null
  }, [by, offices, rows])

  const total = data ? data.reduce((n, d) => n + d.value, 0) : 0
  const nameOf = (d) => (d.name === '__other__' ? t('dashboard.workload.other') : d.name)

  return (
    <section className="dash-card flex h-full min-h-[27rem] flex-col p-5 sm:p-6" aria-labelledby="workload-title">
      <div className="mb-4 flex min-h-[3.25rem] flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="workload-title" className="text-base font-bold text-navy">{t('dashboard.workload.title')}</h2>
          <p className="mt-0.5 text-xs text-slate-600">{t(by === 'office' ? 'dashboard.workload.hintOffice' : 'dashboard.workload.hintType')}</p>
        </div>
        {canReport && (
          <div role="group" aria-label={t('dashboard.workload.groupBy')} className="inline-flex rounded-lg border border-hairline bg-slate-50 p-0.5">
            {['type', 'office'].map((m) => (
              <button key={m} type="button" aria-pressed={by === m} onClick={() => setBy(m)}
                className={`h-7 rounded-md px-2.5 text-xs font-bold transition-colors ${by === m ? 'bg-navy text-white shadow-sm' : 'text-slate-600 hover:text-navy'}`}>
                {t(`dashboard.workload.by.${m}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {data === null ? (
        <SkeletonLine height={200} />
      ) : total === 0 ? (
        <p className="grid h-[200px] place-items-center text-sm text-slate-600">{t('dashboard.workload.empty')}</p>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-4">
          <div className="relative h-[180px] w-[180px] shrink-0" dir="ltr">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                  {data.map((d, i) => <Cell key={d.name} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n === '__other__' ? t('dashboard.workload.other') : n]}
                  contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-2xl font-extrabold leading-none text-navy tabular-nums">{total}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{t('dashboard.workload.requests')}</div>
              </div>
            </div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-2" aria-label={t('dashboard.workload.title')}>
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center gap-2 text-[13px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-700" title={nameOf(d)}>{nameOf(d)}</span>
                <span className="font-bold text-navy tabular-nums">{d.value}</span>
                <span className="w-9 text-end text-xs text-slate-600 tabular-nums">{Math.round((d.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
