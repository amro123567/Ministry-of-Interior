import { useEffect, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { CalendarRange, Download, FilePlus2, Gauge, ListChecks, CheckCheck, X } from 'lucide-react'
import client from '../api/client.js'
import { SkeletonLine } from '../components/Skeleton.jsx'
import { downloadCsv } from '../api/download.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import Pagination, { usePagination } from '../components/Pagination.jsx'

// The backend labels each weekly window "Oct 2" (English). Re-render it with
// the browser's own month names so the chart follows the selected language.
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function localizeWeekLabel(label, lang) {
  const m = /^([A-Za-z]{3}) (\d{1,2})$/.exec(label ?? '')
  if (!m || lang === 'en') return label
  const month = EN_MONTHS.indexOf(m[1])
  if (month < 0) return label
  return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }).format(new Date(2024, month, Number(m[2])))
}

// Same wide-hue-spread categorical set already used for status colors
// elsewhere in the app (StatusBadge.jsx's STATUS_COLORS), reused here so
// the aging buckets read as distinct without introducing a new, unvetted
// palette. Each bar also carries its own axis label and a value label, so
// identity never depends on color alone.
const AGING_COLORS = ['#10B981', '#2563EB', '#F59E0B', '#EF4444']
const THROUGHPUT_COLORS = { created: '#4f46e5', closed: '#10b981' }

const TONES = {
  brand: 'bg-brand-tint text-brand',
  ok: 'bg-ok-tint text-ok-ink',
  crit: 'bg-crit-tint text-crit-ink',
  warn: 'bg-warn-tint text-warn-ink',
}

function KpiCard({ icon: Icon, value, label, tone = 'brand', accent }) {
  return (
    <div className="dash-card relative overflow-hidden p-5">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} aria-hidden="true" />
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}><Icon size={20} aria-hidden="true" /></span>
        <div className="min-w-0">
          <div className="text-2xl font-extrabold leading-none tracking-tight text-navy">{value}</div>
          <div className="mt-1 text-[13px] leading-snug text-slate-600">{label}</div>
        </div>
      </div>
    </div>
  )
}

function Card({ title, hint, children, className = '' }) {
  return (
    <section className={`dash-card p-6 ${className}`}>
      <div className="mb-4">
        <h2 className="text-base font-bold text-navy">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

// A number with a proportional bar behind it, so a table doubles as a bar chart.
function BarCell({ value, max, color = 'bg-brand', children }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center justify-end gap-3">
      <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-slate-100 sm:block" aria-hidden="true">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value > 0 ? pct : 0}%` }} />
      </div>
      <span className="w-8 text-end font-semibold tabular-nums text-navy">{children ?? value}</span>
    </div>
  )
}

export default function ReportsPage() {
  const { t, lang } = useLanguage()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const typePaging = usePagination(data?.byDocumentType ?? [])
  const officePaging = usePagination(data?.byOffice ?? [])

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const range = { from: from || undefined, to: to || undefined }

  useEffect(() => {
    client.get('/reports/summary', { params: { from: from || undefined, to: to || undefined } })
      .then((r) => { setData(r.data); setError(null) })
      .catch(() => setError(t('reports.couldNotLoad')))
  }, [t, from, to])

  if (error) {
    return (
      <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg" role="alert">
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <h1 className="mb-5 text-2xl font-extrabold text-navy">{t('reports.title')}</h1>
        <div className="card p-6 mb-6">
          <SkeletonLine height={280} />
        </div>
        <div className="card p-6">
          <SkeletonLine height={220} />
        </div>
      </div>
    )
  }

  const totalOpen = data.aging.reduce((sum, b) => sum + b.count, 0)
  const createdSum = data.throughput.reduce((n, p) => n + p.created, 0)
  const closedSum = data.throughput.reduce((n, p) => n + p.closed, 0)
  const maxType = Math.max(0, ...data.byDocumentType.map((r) => r.total))
  const maxOffice = Math.max(0, ...data.byOffice.map((r) => r.total))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">{t('reports.title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('reports.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-hairline bg-white p-3 shadow-sm">
          <span className="hidden items-center gap-1.5 self-center pe-1 text-xs font-bold uppercase tracking-wide text-slate-500 md:flex">
            <CalendarRange className="h-4 w-4 text-brand" aria-hidden="true" />{t('reports.period')}
          </span>
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t('reports.dateFrom')}
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
              className="field mt-1 w-40 font-normal normal-case" />
          </label>
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t('reports.dateTo')}
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
              className="field mt-1 w-40 font-normal normal-case" />
          </label>
          {(from || to) && (
            <button type="button" onClick={() => { setFrom(''); setTo('') }} className="btn-secondary">
              <X className="h-4 w-4" aria-hidden="true" />{t('reports.clearRange')}
            </button>
          )}
          <button type="button" onClick={() => downloadCsv('/reports/export', range, 'reports_summary.csv')} className="btn-primary">
            <Download className="h-4 w-4" aria-hidden="true" />{t('reports.exportCsv')}
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={ListChecks} tone="brand" accent="#2563EB" value={totalOpen} label={t('reports.openRequests')} />
        <KpiCard icon={Gauge} tone={data.slaBreachRate > 0 ? 'crit' : 'ok'} accent={data.slaBreachRate > 0 ? '#EF4444' : '#10B981'} value={`${data.slaBreachRate}%`} label={t('reports.slaBreachRate')} />
        <KpiCard icon={FilePlus2} tone="warn" accent="#F59E0B" value={createdSum} label={t('reports.createdTotal')} />
        <KpiCard icon={CheckCheck} tone="ok" accent="#10B981" value={closedSum} label={t('reports.closedTotal')} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title={t('reports.throughputTitle')} className="xl:col-span-2">
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={data.throughput} margin={{ left: 0, right: 16, top: 8 }}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={THROUGHPUT_COLORS.created} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={THROUGHPUT_COLORS.created} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gClosed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={THROUGHPUT_COLORS.closed} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={THROUGHPUT_COLORS.closed} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="periodLabel" tickFormatter={(v) => localizeWeekLabel(v, lang)} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} width={32} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={(v) => localizeWeekLabel(v, lang)} />
                <Legend verticalAlign="top" align="end" height={28} wrapperStyle={{ fontSize: 13 }} formatter={(v) => t(`reports.${v}`, v)} />
                <Area type="monotone" dataKey="created" name="created" stroke={THROUGHPUT_COLORS.created}
                      strokeWidth={2.5} fill="url(#gCreated)" dot={{ r: 3 }} />
                <Area type="monotone" dataKey="closed" name="closed" stroke={THROUGHPUT_COLORS.closed}
                      strokeWidth={2.5} fill="url(#gClosed)" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Plain-text readout of the same numbers: a colour-independent alternative to the chart. */}
        <Card title={t('reports.weeklyBreakdown')}>
          <div className="max-h-[320px] overflow-auto rounded-lg border border-hairline">
            <table className="data-table">
              <thead className="sticky top-0">
                <tr>
                  <th className="th-cell">{t('reports.colPeriod')}</th>
                  <th className="th-cell !text-end">{t('reports.created')}</th>
                  <th className="th-cell !text-end">{t('reports.closed')}</th>
                </tr>
              </thead>
              <tbody>
                {data.throughput.map((p) => (
                  <tr key={p.periodLabel} className="data-row">
                    <td className="td-cell">{localizeWeekLabel(p.periodLabel, lang)}</td>
                    <td className={`td-cell num-cell ${p.created ? 'font-semibold text-navy' : 'text-slate-400'}`}>{p.created}</td>
                    <td className={`td-cell num-cell ${p.closed ? 'font-semibold text-ok-ink' : 'text-slate-400'}`}>{p.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mb-6">
        <Card title={t('reports.agingTitle')} hint={t('reports.agingHint')}>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={data.aging} margin={{ top: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} width={32} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={64}>
                  {data.aging.map((entry, i) => (
                    <Cell key={entry.bucket} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                  ))}
                  <LabelList dataKey="count" position="top" style={{ fill: '#0f172a', fontSize: 13, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t('reports.byDocumentTypeTitle')}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="th-cell">{t('reports.colDocumentType')}</th>
                  <th className="th-cell !text-end">{t('reports.colTotal')}</th>
                  <th className="th-cell !text-end">{t('reports.colAvgResolution')}</th>
                </tr>
              </thead>
              <tbody>
                {data.byDocumentType.length === 0 ? (
                  <tr><td colSpan={3} className="td-cell !py-6 text-center">{t('common.noResults')}</td></tr>
                ) : typePaging.pageItems.map((row) => (
                  <tr key={row.documentTypeName} className="data-row">
                    <td className="td-cell font-medium text-navy">{row.documentTypeName}</td>
                    <td className="td-cell"><BarCell value={row.total} max={maxType} /></td>
                    <td className="td-cell num-cell">{row.avgResolutionHours > 0 ? `${row.avgResolutionHours}h` : '<1h'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination className="mt-3" {...typePaging.pagination} />
        </Card>

        <Card title={t('reports.byOfficeTitle')}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="th-cell">{t('reports.colOffice')}</th>
                  <th className="th-cell !text-end">{t('reports.colTotal')}</th>
                  <th className="th-cell !text-end">{t('reports.colOverdue')}</th>
                </tr>
              </thead>
              <tbody>
                {data.byOffice.length === 0 ? (
                  <tr><td colSpan={3} className="td-cell !py-6 text-center">{t('common.noResults')}</td></tr>
                ) : officePaging.pageItems.map((row) => (
                  <tr key={row.officeName} className="data-row">
                    <td className="td-cell font-medium text-navy">{row.officeName}</td>
                    <td className="td-cell"><BarCell value={row.total} max={maxOffice} /></td>
                    <td className="td-cell num-cell">
                      {row.overdueCount > 0
                        ? <span className="dash-chip border-crit/30 bg-crit-tint text-crit-ink">{row.overdueCount}</span>
                        : <span className="text-slate-400">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination className="mt-3" {...officePaging.pagination} />
        </Card>
      </div>
    </div>
  )
}
