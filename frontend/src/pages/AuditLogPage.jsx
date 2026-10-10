import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Download, Search } from 'lucide-react'
import client from '../api/client.js'
import { SkeletonTableRows } from '../components/Skeleton.jsx'
import LoginAttemptBadge from '../components/LoginAttemptBadge.jsx'
import { Badge } from '../components/ui/index.jsx'
import { downloadCsv } from '../api/download.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import { inputCls } from '../ui.js'
import { ActiveFilterChips, FilterField } from '../components/FilterBar.jsx'


// Soft-pill tints keyed by keyword rather than an exact action list, since
// the backend is free to log new action strings (e.g. "REASSIGN",
// "LOGIN_FAILED") without this page needing a matching update every time.
const ACTION_TINT_RULES = [
  { test: /CREATE|REGISTER|SUBMIT/i, style: 'success' },
  { test: /DELETE|REJECT|FAIL|LOCK/i, style: 'danger' },
  { test: /UPDATE|ASSIGN|EDIT/i, style: 'info' },
  { test: /LOGIN|LOGOUT|AUTH/i, style: 'info' },
  { test: /APPROVE|ARCHIVE/i, style: 'warning' },
]
const DEFAULT_ACTION_TINT = 'draft'

function actionTint(action) {
  return ACTION_TINT_RULES.find(({ test }) => test.test(action))?.style ?? DEFAULT_ACTION_TINT
}

function ActionBadge({ action }) {
  return <Badge tone={actionTint(action)}>{action}</Badge>
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
      <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg" role="alert">{error}</div>
    )
  }

  if (!loading && attempts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-subtle bg-surface-card py-12 text-center text-text-secondary">
        <p>{t('auditLog.loginNoMatch')}</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="th-cell">{t('auditLog.loginColTime')}</th>
              <th className="th-cell">{t('auditLog.loginColUsername')}</th>
              <th className="th-cell">{t('auditLog.loginColOutcome')}</th>
              <th className="th-cell">{t('auditLog.loginColIp')}</th>
              <th className="th-cell">{t('auditLog.loginColUserAgent')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows rows={8} cols={5} />
            ) : attempts.map((a) => (
              <tr key={a.id} className="data-row">
                <td className="td-cell whitespace-nowrap">
                  {format(new Date(a.attemptedAt), 'MMM d, yyyy HH:mm:ss')}
                </td>
                <td className="td-cell text-text-primary whitespace-nowrap">{a.usernameAttempted}</td>
                <td className="td-cell"><LoginAttemptBadge wasSuccessful={a.wasSuccessful} failureReason={a.failureReason} /></td>
                <td className="td-cell whitespace-nowrap">{a.ipAddress || '—'}</td>
                <td className="td-cell max-w-[280px] truncate" title={a.userAgent ?? ''}>{a.userAgent || '—'}</td>
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
  // Search has its own box, so it is not repeated as a chip.
  const activeChips = [
    action && { key: 'action', label: action, onRemove: () => setAction('') },
    entityType && { key: 'entity', label: entityType, onRemove: () => setEntityType('') },
    dateFrom && { key: 'from', label: `${t('auditLog.dateFrom')}: ${dateFrom}`, onRemove: () => setDateFrom('') },
    dateTo && { key: 'to', label: `${t('auditLog.dateTo')}: ${dateTo}`, onRemove: () => setDateTo('') },
  ].filter(Boolean)

  function clearFilters() {
    setSearch(''); setAction(''); setEntityType(''); setDateFrom(''); setDateTo('')
  }

  const showEmpty = !loading && !error && filtered.length === 0

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-text-primary">{t('auditLog.title')}</h1>
        <p className="text-sm text-text-secondary mt-1">{t('auditLog.subtitle')}</p>
      </div>

      {/* Two tabs on one AUDIT_VIEW-gated route/nav link rather than a
          second top-level Navbar entry -- see the LoginAttemptsTab
          comment above for why. */}
      <div className="flex gap-1 mb-5 border-b border-border-subtle">
        {[
          { key: 'entity', label: t('auditLog.tabEntity') },
          { key: 'logins', label: t('auditLog.tabLogins') },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3.5 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'entity' && (
        <>
          {/* Same structure as the other list pages: search + Export on top, labelled filters in one
              row (action, entity type, date range), then a removable chip per active filter. */}
          <section className="card mb-5 divide-y divide-row-divider" aria-label={t('requests.filters')}>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="relative min-w-[240px] flex-1">
                <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input
                  type="search"
                  placeholder={t('auditLog.searchPlaceholder')}
                  aria-label={t('auditLog.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="field !ps-9"
                />
              </div>
              <button type="button" onClick={() => downloadCsv('/audit/export', params, 'audit_log.csv')} className="btn-secondary shrink-0">
                <Download size={16} aria-hidden="true" />{t('requests.exportCsv')}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <FilterField label={t('auditLog.colAction')}>
                <select value={action} onChange={(e) => setAction(e.target.value)} className="field select-field" aria-label={t('auditLog.allActions')}>
                  <option value="">{t('auditLog.allActions')}</option>
                  {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </FilterField>
              <FilterField label={t('auditLog.colEntity')}>
                <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="field select-field" aria-label={t('auditLog.allEntities')}>
                  <option value="">{t('auditLog.allEntities')}</option>
                  {entityTypeOptions.map((et) => <option key={et} value={et}>{et}</option>)}
                </select>
              </FilterField>
              <FilterField label={t('auditLog.dateFrom')}>
                <input type="date" aria-label={t('auditLog.dateFrom')} value={dateFrom} max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)} className="field" />
              </FilterField>
              <FilterField label={t('auditLog.dateTo')}>
                <input type="date" aria-label={t('auditLog.dateTo')} value={dateTo} min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)} className="field" />
              </FilterField>
            </div>

            <ActiveFilterChips chips={activeChips} onClear={clearFilters} />
          </section>

          {error && (
            <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">
              {error}
            </div>
          )}

          {showEmpty ? (
            <div className="rounded-lg border border-dashed border-border-subtle bg-surface-card py-12 text-center text-text-secondary">
              <p>{t('auditLog.noMatch')}</p>
            </div>
          ) : !error && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="th-cell">{t('auditLog.colTimestamp')}</th>
                      <th className="th-cell">{t('auditLog.colAction')}</th>
                      <th className="th-cell">{t('auditLog.colEntity')}</th>
                      <th className="th-cell">{t('auditLog.colActor')}</th>
                      <th className="th-cell">{t('auditLog.colDetails')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <SkeletonTableRows rows={8} cols={5} />
                    ) : filtered.map((e) => (
                      <tr key={e.id} className="data-row">
                        <td className="td-cell whitespace-nowrap">
                          {format(new Date(e.occurredAt), 'MMM d, yyyy HH:mm:ss')}
                        </td>
                        <td className="td-cell"><ActionBadge action={e.action} /></td>
                        <td className="td-cell text-text-primary whitespace-nowrap">{e.entityType} #{e.entityId}</td>
                        <td className="td-cell text-text-primary">{e.actorName}</td>
                        <td className="td-cell max-w-[420px] truncate" title={e.details ?? ''}>
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
