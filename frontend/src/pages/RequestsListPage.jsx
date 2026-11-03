import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, Eye, Search, SlidersHorizontal, UserCheck } from 'lucide-react'
import client from '../api/client.js'
import StatusBadge, { SlaBadge } from '../components/StatusBadge.jsx'
import { SkeletonTableRows } from '../components/Skeleton.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge, IconButton } from '../components/ui/index.jsx'
import { ActiveFilterChips, FilterField } from '../components/FilterBar.jsx'
import Pagination from '../components/Pagination.jsx'
import { fmtDate } from '../utils/dates.js'
import { downloadCsv } from '../api/download.js'

const STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']
const PRIORITIES = ['NORMAL', 'HIGH', 'URGENT']
const SLA_STATES = ['ON_TRACK', 'DUE_SOON', 'OVERDUE']

// Column key -> how to read a sortable value from a row.
const SORTERS = {
  referenceNumber: (r) => r.referenceNumber ?? '',
  direction: (r) => r.direction ?? '',
  citizenName: (r) => (r.citizenName ?? '').toLowerCase(),
  documentTypeName: (r) => (r.documentTypeName ?? '').toLowerCase(),
  status: (r) => r.status ?? '',
  assignedToName: (r) => (r.assignedToName ?? '').toLowerCase(),
  dueAt: (r) => (r.dueAt ? new Date(r.dueAt).getTime() : Number.POSITIVE_INFINITY),
}

export default function RequestsListPage() {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [requests, setRequests] = useState([])
  const [offices, setOffices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exportError, setExportError] = useState(null)
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // The URL is the single source of truth for filters, so dashboard cards,
  // the header search and bookmarks all open this page pre-filtered.
  const get = (k) => searchParams.get(k) || ''
  const status = get('status')
  const search = get('q')
  const assignedToMe = get('mine') === '1'
  const officeId = get('office')
  const priority = get('priority')
  const direction = get('direction')
  const sla = get('sla')
  const from = get('from')
  const to = get('to')
  // Secondary filters live behind a toggle, but open by default when the URL already uses one.
  const [moreOpen, setMoreOpen] = useState(Boolean(officeId || direction || from || to))

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    client.get('/offices').then((r) => setOffices(r.data)).catch(() => setOffices([]))
  }, [])


  function clearFilters() {
    const next = new URLSearchParams()
    if (search) next.set('q', search)
    setSearchParams(next, { replace: true })
  }

  // One source of truth for the active filters: the list and the CSV export both use it.
  const filterParams = useMemo(() => ({
    status: status || undefined,
    search: search || undefined,
    assignedToMe: assignedToMe || undefined,
    officeId: officeId || undefined,
    priority: priority || undefined,
    direction: direction || undefined,
    sla: sla || undefined,
    from: from || undefined,
    to: to || undefined,
  }), [status, search, assignedToMe, officeId, priority, direction, sla, from, to])

  const latestLoad = useRef(0)
  const load = useCallback(() => {
    // Only the most recent request may update the screen, so a slow earlier
    // filter can't overwrite the results of a newer one.
    const mine = ++latestLoad.current
    setLoading(true)
    setError(null)
    client.get('/requests', { params: filterParams })
      .then((r) => { if (mine === latestLoad.current) { setRequests(r.data); setPage(1) } })
      .catch(() => { if (mine === latestLoad.current) setError(t('requests.couldNotLoad')) })
      .finally(() => { if (mine === latestLoad.current) setLoading(false) })
  }, [filterParams, t])

  useEffect(() => { load() }, [load])

  async function exportCsv() {
    setExportError(null)
    try {
      await downloadCsv('/requests/export', filterParams, 'correspondence_requests.csv')
    } catch {
      setExportError(t('requests.exportFailed', 'Could not export the list.'))
    }
  }

  function toggleSort(key) {
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setPage(1)
  }

  const sorted = useMemo(() => {
    if (!sort.key) return requests
    const read = SORTERS[sort.key]
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...requests].sort((x, y) => {
      const a = read(x); const b = read(y)
      return a < b ? -factor : a > b ? factor : 0
    })
  }, [requests, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // A plain render helper (not a component) so the header buttons keep keyboard focus across re-renders.
  function sortHeader(k, label, align) {
    const active = sort.key === k
    return (
      <th
        key={k}
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`th-cell ${align === 'center' ? '!text-center' : align === 'end' ? '!text-end' : ''}`}
      >
        <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-text-primary">
          {label}
          <span aria-hidden="true" className={active ? 'text-primary' : 'text-slate-300'}>
            {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  const showEmpty = !loading && !error && requests.length === 0

  const secondaryCount = [officeId, direction, from, to].filter(Boolean).length
  const officeName = (id) => {
    const o = offices.find((x) => String(x.id) === String(id))
    return o ? (document.dir === 'rtl' && o.nameAr ? o.nameAr : o.nameEn) : id
  }
  // One removable chip per active filter (search has its own box, so it is not repeated here).
  const activeChips = [
    status && { key: 'status', onRemove: () => setParam('status', ''), label: t(`status.${status}`, status) },
    priority && { key: 'priority', onRemove: () => setParam('priority', ''), label: t(`requests.priority.${priority}`, priority) },
    sla && { key: 'sla', onRemove: () => setParam('sla', ''), label: t(`sla.${sla}`, sla) },
    assignedToMe && { key: 'mine', onRemove: () => setParam('mine', ''), label: t('requests.assignedToMe') },
    officeId && { key: 'office', onRemove: () => setParam('office', ''), label: officeName(officeId) },
    direction && { key: 'direction', onRemove: () => setParam('direction', ''), label: t(direction === 'INCOMING' ? 'requests.directionIncoming' : 'requests.directionOutgoing') },
    from && { key: 'from', onRemove: () => setParam('from', ''), label: `${t('requests.dateFrom')}: ${from}` },
    to && { key: 'to', onRemove: () => setParam('to', ''), label: `${t('requests.dateTo')}: ${to}` },
  ].filter(Boolean)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-xl font-bold text-text-primary">{t('requests.title')}</h1>
        <div className="flex gap-2.5">
          {/* The export endpoint needs REPORTS_VIEW, so only offer it to people who can use it. */}
          {hasPermission('REPORTS_VIEW') && (
            <button
              type="button"
              onClick={exportCsv}
              className="btn-secondary"
            >
              {t('requests.exportCsv')}
            </button>
          )}
          {hasPermission('REQUEST_CREATE') && (
            <Link
              to="/requests/new"
              className="btn-primary"
            >
              {t('requests.newRequest')}
            </Link>
          )}
        </div>
      </div>

      {/* Filters apply live (the URL is the source of truth), so there is no "Apply" step.
          Layout: search + quick toggles on top; the three filters people use most (status,
          priority, SLA) in one labelled row; the rest (office, direction, dates) behind
          "More filters"; and every active filter echoed as a removable chip. */}
      <section className="card mb-5 divide-y divide-row-divider" aria-label={t('requests.filters')}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              placeholder={t('requests.searchPlaceholder')}
              aria-label={t('requests.searchPlaceholder')}
              value={search}
              onChange={(e) => setParam('q', e.target.value)}
              className="field !ps-9"
            />
          </div>
          <button
            type="button"
            onClick={() => setParam('mine', assignedToMe ? '' : '1')}
            aria-pressed={assignedToMe}
            className={`${assignedToMe ? 'btn-primary' : 'btn-secondary'} shrink-0`}
          >
            <UserCheck size={16} aria-hidden="true" />{t('requests.assignedToMe')}
          </button>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-controls="more-filters"
            className="btn-secondary shrink-0"
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            {moreOpen ? t('requests.fewerFilters') : t('requests.moreFilters')}
            {secondaryCount > 0 && !moreOpen && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">{secondaryCount}</span>
            )}
            <ChevronDown size={14} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <FilterField label={t('requests.colStatus')}>
            <select value={status} onChange={(e) => setParam('status', e.target.value)} className="field select-field" aria-label={t('requests.colStatus')}>
              <option value="">{t('requests.allStatuses')}</option>
              {STATUSES.map((x) => <option key={x} value={x}>{t(`status.${x}`, x)}</option>)}
            </select>
          </FilterField>
          <FilterField label={t('requests.labelPriority')}>
            <select value={priority} onChange={(e) => setParam('priority', e.target.value)} className="field select-field" aria-label={t('requests.filterPriority')}>
              <option value="">{t('requests.allPriorities')}</option>
              {PRIORITIES.map((x) => <option key={x} value={x}>{t(`requests.priority.${x}`, x)}</option>)}
            </select>
          </FilterField>
          <FilterField label={t('requests.labelSla')}>
            <select value={sla} onChange={(e) => setParam('sla', e.target.value)} className="field select-field" aria-label={t('requests.filterSla')}>
              <option value="">{t('requests.allSla')}</option>
              {SLA_STATES.map((x) => <option key={x} value={x}>{t(`sla.${x}`, x)}</option>)}
            </select>
          </FilterField>
        </div>

        {moreOpen && (
          <div id="more-filters" className="grid grid-cols-1 gap-3 bg-app/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label={t('requests.labelOffice')}>
              <select value={officeId} onChange={(e) => setParam('office', e.target.value)} className="field select-field" aria-label={t('requests.filterOffice')}>
                <option value="">{t('requests.allOffices')}</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{document.dir === 'rtl' && o.nameAr ? o.nameAr : o.nameEn}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label={t('requests.colDirection')}>
              <select value={direction} onChange={(e) => setParam('direction', e.target.value)} className="field select-field" aria-label={t('requests.colDirection')}>
                <option value="">{t('requests.allDirections')}</option>
                <option value="INCOMING">{t('requests.directionIncoming')}</option>
                <option value="OUTGOING">{t('requests.directionOutgoing')}</option>
              </select>
            </FilterField>
            <FilterField label={t('requests.dateFrom')}>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setParam('from', e.target.value)} className="field" aria-label={t('requests.dateFrom')} />
            </FilterField>
            <FilterField label={t('requests.dateTo')}>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setParam('to', e.target.value)} className="field" aria-label={t('requests.dateTo')} />
            </FilterField>
          </div>
        )}

        <ActiveFilterChips chips={activeChips} onClear={clearFilters} />
      </section>

      {exportError && (
        <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{exportError}</div>
      )}
      {error && (
        <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">
          {error}
        </div>
      )}

      {showEmpty ? (
        <div className="rounded-lg border border-dashed border-border-subtle bg-surface-card py-12 text-center text-text-secondary">
          <p>{t('requests.noMatch')}</p>
        </div>
      ) : !error && (
        <>
          <div className="hidden md:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {sortHeader('referenceNumber', t('requests.colReference'))}
                    {sortHeader('direction', t('requests.colDirection'))}
                    {sortHeader('citizenName', t('requests.colCitizen'))}
                    {sortHeader('documentTypeName', t('requests.colDocType'))}
                    {sortHeader('status', t('requests.colStatus'), "center")}
                    {sortHeader('assignedToName', t('requests.colAssignedTo'))}
                    {sortHeader('dueAt', t('requests.colDue'), "end")}
                    <th className="th-cell !text-end" aria-hidden="true"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonTableRows rows={6} cols={8} />
                  ) : visible.map((r) => (
<tr key={r.id} className="data-row">
                      <td className="td-cell font-semibold text-primary">
                        <Link to={`/requests/${r.id}`} className="rounded-sm hover:underline">{r.referenceNumber}</Link>
                        {r.subject && <div className="text-xs font-normal text-text-secondary mt-0.5 max-w-[16rem] truncate" title={r.subject}>{r.subject}</div>}
                      </td>
                      <td className="td-cell">
                        <Badge tone={r.direction === 'OUTGOING' ? 'warning' : 'info'}>
                          {r.direction === 'OUTGOING' ? t('requests.directionOutgoing') : t('requests.directionIncoming')}
                        </Badge>
                      </td>
                      <td className="td-cell text-text-primary">{r.citizenName}</td>
                      <td className="td-cell text-text-primary">{r.documentTypeName}</td>
                      <td className="td-cell center-cell">
                        <div className="flex items-center justify-center gap-1.5">
                          <StatusBadge status={r.status} /> <SlaBadge slaStatus={r.slaStatus} />
                        </div>
                      </td>
                      <td className="td-cell">
                        {r.assignedToName ?? <span className="text-text-secondary">{t('requests.unassigned')}</span>}
                      </td>
                      <td className="td-cell num-cell whitespace-nowrap">{r.dueAt ? fmtDate(r.dueAt, 'MMM d, yyyy') : '—'}</td>
                      <td className="td-cell">
                        <div className="flex justify-end">
                          <IconButton to={`/requests/${r.id}`} label={t('requests.open')}>
                            <Eye size={16} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden flex flex-col gap-3">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-lg border border-border-subtle bg-row-divider animate-pulse" />
              ))
              : visible.map((r) => (
                <Link
                  to={`/requests/${r.id}`}
                  key={r.id}
                  className="block card p-4 shadow-sm hover:border-primary/40"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-primary text-sm">{r.referenceNumber}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-sm text-text-primary mb-1.5">{r.citizenName}</div>
                  <div className="flex justify-between text-xs text-text-secondary mb-2">
                    <span>{r.documentTypeName}</span>
                    <span>{r.dueAt ? fmtDate(r.dueAt, 'MMM d, yyyy') : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">{r.assignedToName ?? t('requests.unassigned')}</span>
                    <SlaBadge slaStatus={r.slaStatus} />
                  </div>
                </Link>
              ))}
          </div>

          {!loading && (
            <Pagination className="mt-4" total={sorted.length} page={currentPage} pageSize={pageSize}
              onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1) }} />
          )}
        </>
      )}
    </div>
  )
}
