import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { SkeletonLine } from '../Skeleton.jsx'
import { bucketByPeriod } from './dashboardUtils.js'

// Dashboard palette: submitted = blue, under review = amber, approved = emerald,
// rejected = coral, plus neutral slates for draft / archived.
const SERIES = [
  { key: 'SUBMITTED', color: '#2563EB' },
  { key: 'UNDER_REVIEW', color: '#F59E0B' },
  { key: 'APPROVED', color: '#10B981' },
  { key: 'REJECTED', color: '#EF4444' },
  { key: 'DRAFT', color: '#94A3B8' },
  { key: 'ARCHIVED', color: '#CBD5E1' },
]

export default function RequestsOverviewChart({ rows }) {
  const { t, lang } = useLanguage()
  const [mode, setMode] = useState('daily')
  const data = useMemo(() => (rows ? bucketByPeriod(rows, mode, Date.now(), lang) : []), [rows, mode, lang])
  const total = data.reduce((n, b) => n + b.total, 0)

  return (
    <section className="dash-card p-5 sm:p-6" aria-labelledby="overview-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="overview-title" className="text-base font-bold text-navy">{t('dashboard.overview.title')}</h2>
          <p className="mt-0.5 text-xs text-slate-600">{t('dashboard.overview.hint')}</p>
        </div>
        <div role="group" aria-label={t('dashboard.overview.range')} className="inline-flex rounded-lg border border-hairline bg-slate-50 p-0.5">
          {['daily', 'weekly'].map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
              className={`h-7 rounded-md px-3 text-xs font-bold transition-colors ${
                mode === m ? 'bg-navy text-white shadow-sm' : 'text-slate-600 hover:text-navy'}`}>
              {t(`dashboard.overview.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <SkeletonLine height={260} />
      ) : total === 0 ? (
        <p className="grid h-[260px] place-items-center text-sm text-slate-600">{t('dashboard.overview.empty')}</p>
      ) : (
        <>
          <div style={{ width: '100%', height: 260 }} dir="ltr">
            <ResponsiveContainer>
              <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  {SERIES.map((s) => (
                    <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity="0.55" />
                      <stop offset="100%" stopColor={s.color} stopOpacity="0.08" />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ stroke: '#CBD5E1' }}
                  contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(15,23,42,.08)', fontSize: 12 }}
                  formatter={(v, name) => [v, t(`status.${name}`, name)]}
                />
                {SERIES.map((s) => (
                  <Area key={s.key} type="monotone" dataKey={s.key} stackId="1" stroke={s.color} strokeWidth={2}
                    fill={`url(#fill-${s.key})`} activeDot={{ r: 4 }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label={t('dashboard.overview.legend')}>
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {t(`status.${s.key}`, s.key)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
