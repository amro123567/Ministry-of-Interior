import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import client from '../api/client.js'
import { SkeletonTableRows } from '../components/Skeleton.jsx'
import LoginAttemptBadge from '../components/LoginAttemptBadge.jsx'
import { downloadCsv } from '../api/download.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const inputCls = 'rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

// Soft-pill tints keyed by keyword rather than an exact action list, since
// the backend is free to log new action strings (e.g. "REASSIGN",
// "LOGIN_FAILED") without this page needing a matching update every time.
const ACTION_TINT_RULES = [
  { test: /CREATE|REGISTER|SUBMIT/i, style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { test: /DELETE|REJECT|FAIL|LOCK/i, style: 'bg-red-50 text-red-600 border-red-200' },
  { test: /UPDATE|ASSIGN|EDIT/i, style: 'bg-sky-50 text-sky-700 border-sky-200' },
  { test: /LOGIN|LOGOUT|AUTH/i, style: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  { test: /APPROVE|ARCHIVE/i, style: 'bg-amber-50 text-amber-700 border-amber-200' },
]
const DEFAULT_ACTION_TINT = 'bg-slate-50 text-slate-600 border-slate-200'

function actionTint(action) {
  return ACTION_TINT_RULES.find(({ test }) => test.test(action))?.style ?? DEFAULT_ACTION_TINT
}

function ActionBadge({ action }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${actionTint(action)}`}>
      {action}
    </span>
  )
}

// The session/login half of Item 7's session-hardening work (SessionSecurityController)
// -- GET /api/audit/login-attempts with no username filter returns the 50
// most recent attempts system-wide, mirroring the entity log tab's own
// "50 most recent" scope. Kept as its own tab on this page rather than a
// new top-level nav link, matching every choice in frontend integration
// pass Step 8 (see PROJECT_STATE.md's Navbar zero-slack note) -- this
// page is already AUDIT_VIEW-gated at the route level (App.jsx), so no
// extra permission check is needed inside it.
function LoginAttemptsTab() {
  const { t } = useLanguage()
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get('/audit/login-attempts')
      .then((r) => setAttempts(r.data))
      .catch(() => setError(t('auditLog.loginCouldNotLoad')))
      .finally(() => setLoading(false))
  }, [t])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">{error}</div>
    )
  }

  if (!loading && attempts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-400">
        <p>{t('auditLog.loginNoMatch')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('auditLog.loginColTime')}</th>
              <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('auditLog.loginColUsername')}</th>
              <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('auditLog.loginColOutcome')}</th>
              <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('auditLog.loginColIp')}</th>
              <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('auditLog.loginColUserAgent')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows rows={8} cols={5} />
            ) : attempts.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                  {format(new Date(a.attemptedAt), 'MMM d, yyyy HH:mm:ss')}
                </td>
                <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">{a.usernameAttempted}</td>
                <td className="px-4 py-3.5"><LoginAttemptBadge wasSuccessful={a.wasSuccessful} failureReason={a.failureReason} /></td>
                <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{a.ipAddress || '—'}</td>
                <td className="px-4 py-3.5 text-slate-500 max-w-[280px] truncate" title={a.userAgent ?? ''}>{a.userAgent || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AuditLogPage() {
  const { t } = useLanguage()
  const [tab, setTab] = useState('entity')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [facets, setFacets] = useState({ actions: [], entityTypes: [] })
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Filters are applied by the server over the whole log (not just the latest rows),
  // so older entries can be found and the export matches what is on screen.
  const params = useMemo(() => ({
    q: debouncedSearch.trim() || undefined,
    action: action || undefined,
    entityType: entityType || undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  }), [debouncedSearch, action, entityType, dateFrom, dateTo])

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(h)
  }, [search])

  useEffect(() => {
    client.get('/audit/facets').then((r) => setFacets(r.data)).catch(() => setFacets({ actions: [], entityTypes: [] }))
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    client.get('/audit', { params })
      .then((r) => setEntries(r.data))
      .catch(() => setError(t('auditLog.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [params, t])

  const actionOptions = facets.actions
  const entityTypeOptions = facets.entityTypes
  const filtered = entries
  const anyFilter = Boolean(search || action || entityType || dateFrom || dateTo)

  function clearFilters() {
    setSearch(''); setAction(''); setEntityType(''); setDateFrom(''); setDateTo('')
  }

  const showEmpty = !loading && !error && filtered.length === 0

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">{t('auditLog.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('auditLog.subtitle')}</p>
      </div>

      {/* Two tabs on one AUDIT_VIEW-gated route/nav link rather than a
          second top-level Navbar entry -- see the LoginAttemptsTab
          comment above for why. */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {[
          { key: 'entity', label: t('auditLog.tabEntity') },
          { key: 'logins', label: t('auditLog.tabLogins') },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3.5 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'entity' && (
        <>
          <div className="flex flex-wrap gap-2.5 mb-5">
            <input
              placeholder={t('auditLog.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} flex-1 min-w-[220px]`}
            />
            <select value={action} onChange={(e) => setAction(e.target.value)} className={`${inputCls} w-[180px]`}>
              <option value="">{t('auditLog.allActions')}</option>
              {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={`${inputCls} w-[180px]`}>
              <option value="">{t('auditLog.allEntities')}</option>
              {entityTypeOptions.map((et) => <option key={et} value={et}>{et}</option>)}
            </select>
            <input
              type="date"
              aria-label={t('auditLog.dateFrom')}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`${inputCls} w-[160px]`}
            />
            <input
              type="date"
              aria-label={t('auditLog.dateTo')}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={`${inputCls} w-[160px]`}
            />
            {anyFilter && (
              <button type="button" onClick={clearFilters}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {t('requests.clearFilters')}
              </button>
            )}
            <button type="button" onClick={() => downloadCsv('/audit/export', params, 'audit_log.csv')}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 ms-auto">
              {t('requests.exportCsv')}
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4" role="alert">
              {error}
            </div>
          )}

          {showEmpty ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-400">
              <p>{t('auditLog.noMatch')}</p>
            </div>
          ) : !error && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('auditLog.colTimestamp')}</th>
                      <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('auditLog.colAction')}</th>
                      <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('auditLog.colEntity')}</th>
                      <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('auditLog.colActor')}</th>
                      <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('auditLog.colDetails')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <SkeletonTableRows rows={8} cols={5} />
                    ) : filtered.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                          {format(new Date(e.occurredAt), 'MMM d, yyyy HH:mm:ss')}
                        </td>
                        <td className="px-4 py-3.5"><ActionBadge action={e.action} /></td>
                        <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">{e.entityType} #{e.entityId}</td>
                        <td className="px-4 py-3.5 text-slate-700">{e.actorName}</td>
                        <td className="px-4 py-3.5 text-slate-500 max-w-[420px] truncate" title={e.details ?? ''}>
                          {e.details || <span className="text-slate-300">{t('auditLog.noDetails')}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'logins' && <LoginAttemptsTab />}
    </div>
  )
}
