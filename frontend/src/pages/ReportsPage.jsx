import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Gauge, ListChecks } from 'lucide-react'
import client from '../api/client.js'
import { SkeletonLine } from '../components/Skeleton.jsx'
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-3.5">
      <div className="h-10 w-10 rounded-[10px] grid place-items-center bg-indigo-50 text-indigo-600">
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-extrabold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-bold text-slate-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function ReportsPage() {
  const { t, lang } = useLanguage()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get('/reports/summary')
      .then((r) => setData(r.data))
      .catch(() => setError(t('reports.couldNotLoad')))
  }, [t])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900 mb-5">{t('reports.title')}</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
          <SkeletonLine height={280} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <SkeletonLine height={220} />
        </div>
      </div>
    )
  }

  const totalOpen = data.aging.reduce((sum, b) => sum + b.count, 0)

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">{t('reports.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('reports.subtitle')}</p>
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
                <XAxis dataKey="periodLabel" tickFormatter={(v) => localizeWeekLabel(v, lang)} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
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
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="text-start px-2 py-1.5">{t('reports.colPeriod')}</th>
                  <th className="text-end px-2 py-1.5">{t('reports.created')}</th>
                  <th className="text-end px-2 py-1.5">{t('reports.closed')}</th>
                </tr>
              </thead>
              <tbody>
                {data.throughput.map((p) => (
                  <tr key={p.periodLabel} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 text-slate-600">{localizeWeekLabel(p.periodLabel, lang)}</td>
                    <td className="px-2 py-1.5 text-end text-slate-700">{p.created}</td>
                    <td className="px-2 py-1.5 text-end text-slate-700">{p.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mb-6">
        <Card title={t('reports.agingTitle')}>
          <p className="text-xs text-slate-400 mb-3 -mt-2">{t('reports.agingHint')}</p>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={data.aging} margin={{ top: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
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
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="text-start px-2 py-2">{t('reports.colDocumentType')}</th>
                  <th className="text-end px-2 py-2">{t('reports.colTotal')}</th>
                  <th className="text-end px-2 py-2">{t('reports.colAvgResolution')}</th>
                </tr>
              </thead>
              <tbody>
                {data.byDocumentType.length === 0 ? (
                  <tr><td colSpan={3} className="px-2 py-4 text-center text-slate-400">{t('common.noResults')}</td></tr>
                ) : data.byDocumentType.map((row) => (
                  <tr key={row.documentTypeName} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-slate-700">{row.documentTypeName}</td>
                    <td className="px-2 py-2 text-end text-slate-700">{row.total}</td>
                    <td className="px-2 py-2 text-end text-slate-500">{row.avgResolutionHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={t('reports.byOfficeTitle')}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="text-start px-2 py-2">{t('reports.colOffice')}</th>
                  <th className="text-end px-2 py-2">{t('reports.colTotal')}</th>
                  <th className="text-end px-2 py-2">{t('reports.colOverdue')}</th>
                </tr>
              </thead>
              <tbody>
                {data.byOffice.length === 0 ? (
                  <tr><td colSpan={3} className="px-2 py-4 text-center text-slate-400">{t('common.noResults')}</td></tr>
                ) : data.byOffice.map((row) => (
                  <tr key={row.officeName} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-slate-700">{row.officeName}</td>
                    <td className="px-2 py-2 text-end text-slate-700">{row.total}</td>
                    <td className={`px-2 py-2 text-end ${row.overdueCount > 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
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
