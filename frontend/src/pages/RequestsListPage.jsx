import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Eye } from 'lucide-react'
import client from '../api/client.js'
import StatusBadge, { SlaBadge } from '../components/StatusBadge.jsx'
import { SkeletonTableRows } from '../components/Skeleton.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']
const PRIORITIES = ['NORMAL', 'HIGH', 'URGENT']
const SLA_STATES = ['ON_TRACK', 'DUE_SOON', 'OVERDUE']
const inputCls = 'rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

const PAGE_SIZES = [10, 25, 50]
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

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    client.get('/offices').then((r) => setOffices(r.data)).catch(() => setOffices([]))
  }, [])

  const anyFilter = Boolean(status || assignedToMe || officeId || priority || direction || sla || from || to)

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

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    client.get('/requests', { params: filterParams })
      .then((r) => { setRequests(r.data); setPage(1) })
      .catch(() => setError(t('requests.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [filterParams, t])

  useEffect(() => { load() }, [load])

  async function exportCsv() {
    const res = await client.get('/requests/export', { params: filterParams, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'correspondence_requests.csv'
    a.click()
    URL.revokeObjectURL(url)
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

  function SortHeader({ k, label }) {
    const active = sort.key === k
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200"
      >
        <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900">
          {label}
          <span aria-hidden="true" className={active ? 'text-indigo-600' : 'text-slate-300'}>
            {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  const showEmpty = !loading && !error && requests.length === 0

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-xl font-bold text-slate-900">{t('requests.title')}</h1>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t('requests.exportCsv')}
          </button>
          {hasPermission('REQUEST_TRANSITION_SUBMIT', 'REQUEST_TRANSITION_REVIEW', 'REQUEST_TRANSITION_DECIDE', 'REQUEST_TRANSITION_ARCHIVE') && (
            <Link
              to="/requests/new"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {t('requests.newRequest')}
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 mb-5 flex flex-wrap items-end gap-2.5">
        <input
          placeholder={t('requests.searchPlaceholder')}
          aria-label={t('requests.searchPlaceholder')}
          value={search}
          onChange={(e) => setParam('q', e.target.value)}
          className={`${inputCls} flex-1 min-w-[220px]`}
        />
        <select value={status} onChange={(e) => setParam('status', e.target.value)} className={`${inputCls} w-auto`} aria-label={t('requests.colStatus')}>
          <option value="">{t('requests.allStatuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`, s)}</option>)}
        </select>
        <select value={officeId} onChange={(e) => setParam('office', e.target.value)} className={`${inputCls} w-auto max-w-[200px]`} aria-label={t('requests.filterOffice')}>
          <option value="">{t('requests.allOffices')}</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>{document.dir === 'rtl' && o.nameAr ? o.nameAr : o.nameEn}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setParam('priority', e.target.value)} className={`${inputCls} w-auto`} aria-label={t('requests.filterPriority')}>
          <option value="">{t('requests.allPriorities')}</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{t(`requests.priority.${p}`, p)}</option>)}
        </select>
        <select value={direction} onChange={(e) => setParam('direction', e.target.value)} className={`${inputCls} w-auto`} aria-label={t('requests.colDirection')}>
          <option value="">{t('requests.allDirections')}</option>
          <option value="INCOMING">{t('requests.directionIncoming')}</option>
          <option value="OUTGOING">{t('requests.directionOutgoing')}</option>
        </select>
        <select value={sla} onChange={(e) => setParam('sla', e.target.value)} className={`${inputCls} w-auto`} aria-label={t('requests.filterSla')}>
          <option value="">{t('requests.allSla')}</option>
          {SLA_STATES.map((x) => <option key={x} value={x}>{t(`sla.${x}`, x)}</option>)}
        </select>
        <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t('requests.dateFrom')}
          <input type="date" value={from} max={to || undefined} onChange={(e) => setParam('from', e.target.value)} className={`${inputCls} mt-1 normal-case font-normal`} />
        </label>
        <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t('requests.dateTo')}
          <input type="date" value={to} min={from || undefined} onChange={(e) => setParam('to', e.target.value)} className={`${inputCls} mt-1 normal-case font-normal`} />
        </label>
        <button
          type="button"
          onClick={() => setParam('mine', assignedToMe ? '' : '1')}
          aria-pressed={assignedToMe}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold border transition-colors ${
            assignedToMe
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {t('requests.assignedToMe')}
        </button>
        {anyFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t('requests.clearFilters')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4" role="alert">
          {error}
        </div>
      )}

      {showEmpty ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-400">
          <p>{t('requests.noMatch')}</p>
        </div>
      ) : !error && (
        <>
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <SortHeader k="referenceNumber" label={t('requests.colReference')} />
                    <SortHeader k="direction" label={t('requests.colDirection')} />
                    <SortHeader k="citizenName" label={t('requests.colCitizen')} />
                    <SortHeader k="documentTypeName" label={t('requests.colDocType')} />
                    <SortHeader k="status" label={t('requests.colStatus')} />
                    <SortHeader k="assignedToName" label={t('requests.colAssignedTo')} />
                    <SortHeader k="dueAt" label={t('requests.colDue')} />
                    <th className="text-end text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200" aria-hidden="true"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonTableRows rows={6} cols={8} />
                  ) : visible.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3.5 font-semibold text-indigo-600">
                        <Link to={`/requests/${r.id}`}>{r.referenceNumber}</Link>
                        {r.subject && <div className="text-xs font-normal text-slate-500 mt-0.5 max-w-[16rem] truncate" title={r.subject}>{r.subject}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          r.direction === 'OUTGOING' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'
                        }`}>
                          {r.direction === 'OUTGOING' ? t('requests.directionOutgoing') : t('requests.directionIncoming')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">{r.citizenName}</td>
                      <td className="px-4 py-3.5 text-slate-700">{r.documentTypeName}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={r.status} /> <SlaBadge slaStatus={r.slaStatus} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {r.assignedToName ?? <span className="text-slate-400">{t('requests.unassigned')}</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">{r.dueAt ? format(new Date(r.dueAt), 'MMM d, yyyy') : '—'}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end">
                          <Link
                            to={`/requests/${r.id}`}
                            aria-label={t('requests.open')}
                            className="h-8 w-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Eye size={16} />
                          </Link>
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
                <div key={i} className="h-28 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
              ))
              : visible.map((r) => (
                <Link
                  to={`/requests/${r.id}`}
                  key={r.id}
                  className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-indigo-600 text-sm">{r.referenceNumber}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-sm text-slate-800 mb-1.5">{r.citizenName}</div>
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>{r.documentTypeName}</span>
                    <span>{r.dueAt ? format(new Date(r.dueAt), 'MMM d, yyyy') : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{r.assignedToName ?? t('requests.unassigned')}</span>
                    <SlaBadge slaStatus={r.slaStatus} />
                  </div>
                </Link>
              ))}
          </div>

          {!loading && sorted.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span>
                {t('requests.showing')} {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} {t('requests.of')} {sorted.length}
              </span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2">
                  {t('requests.perPage')}
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className={`${inputCls} py-1.5`}>
                    {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  {t('requests.prev')}
                </button>
                <span>{currentPage} / {pageCount}</span>
                <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  {t('requests.next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
