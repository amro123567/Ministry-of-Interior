import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileText, AlertTriangle, Clock, CheckCircle2, Gauge } from 'lucide-react'
import client from '../api/client.js'
import { STATUS_COLORS } from '../components/StatusBadge.jsx'
import { SkeletonKpiRow, SkeletonLine } from '../components/Skeleton.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const KPI_TINTS = {
  indigo: 'bg-indigo-50 text-indigo-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-600',
  sky: 'bg-sky-50 text-sky-700',
}

function KpiCard({ icon: Icon, value, label, tint, valueClassName = 'text-slate-900', to }) {
  const Wrapper = to ? Link : 'div'
  return (
    <Wrapper
      {...(to ? { to } : {})}
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-3.5 ${
        to ? 'transition-colors hover:border-indigo-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300' : ''
      }`}
    >
      <div className={`h-10 w-10 rounded-[10px] grid place-items-center ${KPI_TINTS[tint]}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className={`text-2xl font-extrabold ${valueClassName}`}>{value}</div>
        <div className="text-sm text-slate-500 mt-0.5">{label}</div>
      </div>
    </Wrapper>
  )
}

export default function DashboardPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get('/dashboard/summary').then((r) => setSummary(r.data)).catch(() => setError(t('dashboard.couldNotLoad')))
  }, [t])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
        {error}
      </div>
    )
  }

  if (!summary) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900 mb-5">{t('dashboard.title')}</h1>
        <SkeletonKpiRow count={5} />
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900 mb-4">{t('dashboard.requestsByStatus')}</h2>
          <SkeletonLine height={240} />
        </div>
      </div>
    )
  }

  const chartData = Object.entries(summary.byStatus).map(([status, count]) => ({
    status,
    label: t(`status.${status}`, status),
    count,
  }))

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-5">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard icon={FileText} value={summary.total} label={t('dashboard.totalRequests')} tint="indigo" to="/requests" />
        <KpiCard icon={AlertTriangle} value={summary.overdueCount} label={t('dashboard.overdue')} tint="red" valueClassName="text-red-600" to="/requests?sla=OVERDUE" />
        <KpiCard icon={Clock} value={summary.dueSoonCount} label={t('dashboard.dueSoon')} tint="amber" valueClassName="text-amber-600" to="/requests?sla=DUE_SOON" />
        <KpiCard icon={CheckCircle2} value={summary.closedThisWeek} label={t('dashboard.closedThisWeek')} tint="emerald" />
        <KpiCard icon={Gauge} value={`${summary.avgResolutionHours}h`} label={t('dashboard.avgResolution')} tint="sky" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900 mb-4">{t('dashboard.requestsByStatus')}</h2>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 24, right: 32 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 13, fill: '#475569' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [value, t('dashboard.totalRequests')]} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="count" radius={[6, 6, 6, 6]} maxBarSize={22} cursor="pointer" onClick={(d) => d?.status && navigate(`/requests?status=${d.status}`)}>
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                ))}
                <LabelList dataKey="count" position="right" style={{ fill: '#0f172a', fontSize: 13, fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="mt-5">
        <Link
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          to="/requests"
        >
          {t('dashboard.viewAll')}
        </Link>
      </p>
    </div>
  )
}
