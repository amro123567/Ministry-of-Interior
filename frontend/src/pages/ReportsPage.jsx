import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Gauge, ListChecks } from 'lucide-react'
import client from '../api/client.js'
import { SkeletonLine } from '../components/Skeleton.jsx'
import { downloadCsv } from '../api/download.js'
import { useLanguage } from '../context/LanguageContext.jsx'

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
const AGING_COLORS = ['#1baf7a', '#2a78d6', '#eda100', '#e11d48']
const THROUGHPUT_COLORS = { created: '#4f46e5', closed: '#10b981' }

function KpiCard({ icon: Icon, value, label }) {
  return (
    <div className="card p-5 shadow-sm flex flex-col gap-3.5">
      <div className="h-10 w-10 rounded-[10px] grid place-items-center bg-primary-tint text-primary">
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-extrabold text-text-primary">{value}</div>
        <div className="text-sm text-text-secondary mt-0.5">{label}</div>
      </div>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="card p-6">
      <h2 className="text-base font-bold text-text-primary mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function ReportsPage() {
  const { t, lang } = useLanguage()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

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
        <h1 className="text-xl font-bold text-text-primary mb-5">{t('reports.title')}</h1>
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

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('reports.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('reports.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            {t('reports.dateFrom')}
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
              className="field mt-1 font-normal normal-case" />
          </label>
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            {t('reports.dateTo')}
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
              className="field mt-1 font-normal normal-case" />
          </label>
          {(from || to) && (
            <button type="button" onClick={() => { setFrom(''); setTo('') }}
              className="btn-secondary">
              {t('reports.clearRange')}
            </button>
          )}
          <button type="button" onClick={() => downloadCsv('/reports/export', range, 'reports_summary.csv')}
            className="btn-primary">
            {t('reports.exportCsv')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard icon={Gauge} value={`${data.slaBreachRate}%`} label={t('reports.slaBreachRate')} />
        <KpiCard icon={ListChecks} value={totalOpen} label={t('reports.openRequests')} />
      </div>

      <div className="mb-6">
        <Card title={t('reports.throughputTitle')}>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={data.throughput} margin={{ left: 8, right: 16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="periodLabel" tickFormatter={(v) => localizeWeekLabel(v, lang)} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={(v) => localizeWeekLabel(v, lang)} />
                <Legend wrapperStyle={{ fontSize: 13 }} formatter={(v) => t(`reports.${v}`, v)} />
                <Line type="monotone" dataKey="created" name="created" stroke={THROUGHPUT_COLORS.created}
                      strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="closed" name="closed" stroke={THROUGHPUT_COLORS.closed}
                      strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* A plain-text readout of the same numbers, since the chart's
              relief for its two close-in-lightness series is a visible,
              color-independent alternative -- not just a hover tooltip. */}
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
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
                    <td className="td-cell num-cell text-text-primary">{p.created}</td>
                    <td className="td-cell num-cell text-text-primary">{p.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mb-6">
        <Card title={t('reports.agingTitle')}>
          <p className="text-xs text-text-secondary mb-3 -mt-2">{t('reports.agingHint')}</p>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={data.aging} margin={{ top: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                ) : data.byDocumentType.map((row) => (
                  <tr key={row.documentTypeName} className="data-row">
                    <td className="td-cell text-text-primary">{row.documentTypeName}</td>
                    <td className="td-cell num-cell text-text-primary">{row.total}</td>
                    <td className="td-cell num-cell">{row.avgResolutionHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                ) : data.byOffice.map((row) => (
                  <tr key={row.officeName} className="data-row">
                    <td className="td-cell text-text-primary">{row.officeName}</td>
                    <td className="td-cell num-cell text-text-primary">{row.total}</td>
                    <td className={`td-cell num-cell ${row.overdueCount > 0 ? '!text-badge-danger-fg font-semibold' : ''}`}>
                      {row.overdueCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
