import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertOctagon, CheckCircle2, Clock, FileText, UserCheck } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'
import client from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { SkeletonLine } from '../Skeleton.jsx'
import { parseDate, slaCountdown, sortBySla } from './dashboardUtils.js'

function ago(value, lang) {
  const d = parseDate(value)
  return d ? formatDistanceToNowStrict(d, { addSuffix: true, locale: lang === 'ar' ? arLocale : undefined }) : ''
}

function Bottlenecks({ rows }) {
  const { t, lang } = useLanguage()
  if (rows === null) return <SkeletonLine height={200} />
  const hot = rows.filter((r) => r.slaStatus === 'OVERDUE' || r.slaStatus === 'DUE_SOON').sort(sortBySla).slice(0, 6)
  if (!hot.length) {
    return (
      <p className="grid min-h-[160px] place-items-center text-center text-sm text-slate-600">
        <span><CheckCircle2 className="mx-auto mb-2 text-ok" size={22} aria-hidden="true" />{t('dashboard.feed.noBottlenecks')}</span>
      </p>
    )
  }
  return (
    <ul className="space-y-1" aria-label={t('dashboard.feed.bottlenecks')}>
      {hot.map((r) => {
        const sla = slaCountdown(r)
        const late = sla.state === 'overdue'
        return (
          <li key={r.id}>
            <Link to={`/requests/${r.id}`} className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50">
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${late ? 'bg-crit-tint text-crit-ink' : 'bg-warn-tint text-warn-ink'}`}>
                {late ? <AlertOctagon size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-navy">{r.referenceNumber}</span>
                <span className="block truncate text-xs text-slate-600">{r.subject || r.citizenName}</span>
              </span>
              <span className={`shrink-0 text-xs font-bold ${late ? 'text-crit-ink' : 'text-warn-ink'}`}>
                {ago(r.dueAt, lang)}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

const ACTION_ICON = (action = '') => {
  const a = action.toUpperCase()
  if (a.includes('APPROV')) return [CheckCircle2, 'bg-ok-tint text-ok-ink']
  if (a.includes('REJECT') || a.includes('DELETE')) return [AlertOctagon, 'bg-crit-tint text-crit-ink']
  if (a.includes('ASSIGN')) return [UserCheck, 'bg-active-tint text-active']
  if (a.includes('CREATE') || a.includes('UPLOAD')) return [FileText, 'bg-brand-tint text-brand']
  return [Activity, 'bg-slate-100 text-slate-700']
}

function RecentActivity() {
  const { t, lang } = useLanguage()
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    client.get('/audit')
      .then((r) => setEntries([...r.data].sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0, 6)))
      .catch(() => setEntries([]))
  }, [])

  if (entries === null) return <SkeletonLine height={200} />
  if (!entries.length) return <p className="grid min-h-[160px] place-items-center text-sm text-slate-600">{t('dashboard.feed.noActivity')}</p>
  return (
    <ul className="space-y-1" aria-label={t('dashboard.feed.activity')}>
      {entries.map((e) => {
        const [Icon, tone] = ACTION_ICON(e.action)
        return (
          <li key={e.id} className="flex items-start gap-3 rounded-lg p-2">
            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}><Icon size={16} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-navy">{String(e.action).replace(/_/g, ' ')}</span>
              <span className="block truncate text-xs text-slate-600" title={e.details ?? ''}>
                {e.actorName} · {e.entityType} #{e.entityId}
              </span>
            </span>
            <span className="shrink-0 text-xs text-slate-600">{ago(e.occurredAt, lang)}</span>
          </li>
        )
      })}
    </ul>
  )
}

// Side widget: always shows live bottlenecks (from the request list); people who
// may read the audit log also get a "Recent activity" tab.
export default function ActivityFeed({ rows }) {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const canAudit = hasPermission('AUDIT_VIEW')
  const [tab, setTab] = useState('bottlenecks')
  const tabs = canAudit ? ['bottlenecks', 'activity'] : ['bottlenecks']

  return (
    <section className="dash-card flex flex-col p-5 sm:p-6" aria-labelledby="feed-title">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="feed-title" className="text-base font-bold text-navy">{t('dashboard.feed.title')}</h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ok-ink">
          <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />{t('dashboard.feed.live')}
        </span>
      </div>
      {tabs.length > 1 && (
        <div role="tablist" aria-label={t('dashboard.feed.title')} className="mb-3 grid grid-cols-2 rounded-lg border border-hairline bg-slate-50 p-0.5">
          {tabs.map((k) => (
            <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`h-7 rounded-md text-xs font-bold transition-colors ${tab === k ? 'bg-navy text-white shadow-sm' : 'text-slate-600 hover:text-navy'}`}>
              {t(`dashboard.feed.${k}`)}
            </button>
          ))}
        </div>
      )}
      {tab === 'activity' && canAudit ? <RecentActivity /> : <Bottlenecks rows={rows} />}
    </section>
  )
}
