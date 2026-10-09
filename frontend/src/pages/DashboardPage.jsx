import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileText, AlertTriangle, Clock, CheckCircle2, Gauge } from 'lucide-react'
import client from '../api/client.js'
import StatusBadge, { SlaBadge, STATUS_COLORS } from '../components/StatusBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { SkeletonKpiRow, SkeletonLine } from '../components/Skeleton.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const KPI_TINTS = {
  indigo: 'bg-primary-tint text-primary',
  red: 'bg-badge-danger-bg text-danger-solid',
  amber: 'bg-badge-warning-bg text-warning-solid',
  emerald: 'bg-badge-success-bg text-success-solid',
  sky: 'bg-badge-info-bg text-badge-info-fg',
}

const OPEN = ['SUBMITTED', 'UNDER_REVIEW']
const SLA_RANK = { OVERDUE: 0, DUE_SOON: 1, ON_TRACK: 2 }

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

function WorkQueue({ queue, t }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    client.get('/requests', { params: queue.params })
      .then((r) => setRows(r.data.filter(queue.keep)
        .sort((a, b) => (SLA_RANK[a.slaStatus] ?? 3) - (SLA_RANK[b.slaStatus] ?? 3)
          || String(a.dueAt ?? '9').localeCompare(String(b.dueAt ?? '9')))
        .slice(0, 6)))
      .catch(() => setRows([]))
  }, [queue])

  return (
    <div className="card p-6 mb-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-base font-bold text-text-primary">{t(`dashboard.queue.${queue.key}.title`)}</h2>
        <Link to={queue.more} className="text-sm font-semibold text-primary hover:underline whitespace-nowrap">{t('dashboard.queue.seeAll')}</Link>
      </div>
      <p className="text-sm text-text-secondary mb-4">{t(`dashboard.queue.${queue.key}.hint`)}</p>
      {rows === null ? (
        <SkeletonLine height={120} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-secondary py-4">{t(`dashboard.queue.${queue.key}.empty`)}</p>
      ) : (
        <ul className="divide-y divide-slate-100" aria-label={t(`dashboard.queue.${queue.key}.title`)}>
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <Link to={`/requests/${r.id}`} className="font-semibold text-primary hover:underline">{r.referenceNumber}</Link>
                <div className="text-xs text-text-secondary truncate max-w-[22rem]">{r.subject || r.citizenName}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={r.status} /> <SlaBadge slaStatus={r.slaStatus} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function KpiCard({ icon: Icon, value, label, tint, valueClassName = 'text-text-primary', to }) {
  const Wrapper = to ? Link : 'div'
  return (
    <Wrapper
      {...(to ? { to } : {})}
      className={`card p-5 shadow-sm flex flex-col gap-3.5 ${
        to ? 'transition-colors hover:border-primary/40 hover:shadow-md ' : ''
      }`}
    >
      <div className={`h-10 w-10 rounded-[10px] grid place-items-center ${KPI_TINTS[tint]}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className={`text-2xl font-extrabold ${valueClassName}`}>{value}</div>
        <div className="text-sm text-text-secondary mt-0.5">{label}</div>
      </div>
    </Wrapper>
  )
}

export default function DashboardPage() {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const queue = useMemo(() => queueFor(hasPermission), [hasPermission])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get('/dashboard/summary').then((r) => setSummary(r.data)).catch(() => setError(t('dashboard.couldNotLoad')))
  }, [t])

  if (error) {
    return (
      <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg" role="alert">
        {error}
      </div>
    )
  }

  if (!summary) {
    return (
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-5">{t('dashboard.title')}</h1>
        <SkeletonKpiRow count={5} />
        <div className="card p-6">
          <h2 className="text-base font-bold text-text-primary mb-4">{t('dashboard.requestsByStatus')}</h2>
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
      <h1 className="text-xl font-bold text-text-primary mb-5">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-sm:[&>:last-child:nth-child(odd)]:col-span-2 mb-6">
        <KpiCard icon={FileText} value={summary.total} label={t('dashboard.totalRequests')} tint="indigo" to="/requests" />
        <KpiCard icon={AlertTriangle} value={summary.overdueCount} label={t('dashboard.overdue')} tint="red" valueClassName="text-danger-solid" to="/requests?sla=OVERDUE" />
        <KpiCard icon={Clock} value={summary.dueSoonCount} label={t('dashboard.dueSoon')} tint="amber" valueClassName="text-warning-solid" to="/requests?sla=DUE_SOON" />
        <KpiCard icon={CheckCircle2} value={summary.closedThisWeek} label={t('dashboard.closedThisWeek')} tint="emerald" />
        <KpiCard icon={Gauge} value={`${summary.avgResolutionHours}h`} label={t('dashboard.avgResolution')} tint="sky" />
      </div>

      <WorkQueue queue={queue} t={t} />

      <div className="card p-6">
        <h2 className="text-base font-bold text-text-primary mb-4">{t('dashboard.requestsByStatus')}</h2>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 24, right: 32 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
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
          className="inline-flex items-center btn-primary"
          to="/requests"
        >
          {t('dashboard.viewAll')}
        </Link>
      </p>
    </div>
  )
}
