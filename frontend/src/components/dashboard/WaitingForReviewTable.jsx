import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronRight, Copy, Download, Eye, Inbox, MoreVertical, Search, Send, User, X,
} from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext.jsx'
import StatusBadge from '../StatusBadge.jsx'
import { SkeletonLine } from '../Skeleton.jsx'
import Pagination, { usePagination } from '../Pagination.jsx'
import {
  avatarTone, downloadTextFile, humanizeHours, initials, slaCountdown, toCsv,
} from './dashboardUtils.js'
import { todayISO } from '../../utils/dates.js'

const PRIORITY_STYLE = {
  URGENT: 'border-crit/30 bg-crit-tint text-crit-ink',
  HIGH: 'border-warn/40 bg-warn-tint text-warn-ink',
  NORMAL: 'border-hairline bg-slate-50 text-slate-600',
}
const SLA_STYLE = {
  overdue: { bar: 'bg-crit', text: 'text-crit-ink' },
  soon: { bar: 'bg-warn', text: 'text-warn-ink' },
  ok: { bar: 'bg-ok', text: 'text-slate-700' },
  none: { bar: 'bg-slate-300', text: 'text-slate-600' },
  closed: { bar: 'bg-slate-300', text: 'text-slate-600' },
}

function Pill({ active, onClick, children, count }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${
        active ? 'border-brand bg-brand text-white' : 'border-hairline bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}>
      {children}
      {count != null && <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/25' : 'bg-slate-100 text-slate-600'}`}>{count}</span>}
    </button>
  )
}

function SlaCell({ row, t }) {
  const sla = slaCountdown(row)
  const style = SLA_STYLE[sla.state]
  if (sla.state === 'none') return <span className="text-xs text-slate-600">{t('dashboard.table.noDeadline')}</span>
  if (sla.state === 'closed') return <span className="text-xs text-slate-600">{t('dashboard.table.closedRequest')}</span>
  const h = humanizeHours(sla.hours)
  const label = `${h.value}${t(`dashboard.table.unit.${h.unit}`)}`
  return (
    <div className="min-w-[150px]">
      <div className={`text-xs font-bold ${style.text}`}>
        {sla.state === 'overdue' ? `${label} ${t('dashboard.table.overdueBy')}` : `${label} ${t('dashboard.table.remaining')}`}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(sla.pct)} aria-label={t('dashboard.table.slaUsed')}>
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.max(sla.pct, 4)}%` }} />
      </div>
    </div>
  )
}

function RowMenu({ row, t }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const item = 'flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] font-semibold text-slate-700 hover:bg-slate-50'
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`${t('dashboard.table.moreActions')} ${row.referenceNumber}`}
        onClick={() => setOpen((o) => !o)} className="icon-btn"><MoreVertical size={16} aria-hidden="true" /></button>
      {open && (
        <div role="menu" className="absolute end-0 top-9 z-20 w-48 overflow-hidden rounded-lg border border-hairline bg-white py-1 shadow-lg">
          <button role="menuitem" type="button" className={item} onClick={() => navigate(`/requests/${row.id}`)}>
            <Eye size={15} aria-hidden="true" />{t('dashboard.table.openDetails')}
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => navigate(`/requests/${row.id}`)}>
            <Send size={15} aria-hidden="true" />{t('dashboard.table.forward')}
          </button>
          <button role="menuitem" type="button" className={item}
            onClick={() => { navigator.clipboard?.writeText(row.referenceNumber); setOpen(false) }}>
            <Copy size={15} aria-hidden="true" />{t('dashboard.table.copyRef')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function WaitingForReviewTable({ queue, rows, loading }) {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [docType, setDocType] = useState('')

  const docTypes = useMemo(() => [...new Set((rows ?? []).map((r) => r.documentTypeName).filter(Boolean))].sort(), [rows])
  const statuses = useMemo(() => [...new Set((rows ?? []).map((r) => r.status))], [rows])
  const priorities = useMemo(() => ['URGENT', 'HIGH', 'NORMAL'].filter((p) => (rows ?? []).some((r) => (r.priority || 'NORMAL') === p)), [rows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (rows ?? []).filter((r) =>
      (!status || r.status === status)
      && (!priority || (r.priority || 'NORMAL') === priority)
      && (!docType || r.documentTypeName === docType)
      && (!q || [r.referenceNumber, r.subject, r.citizenName, r.assignedToName, r.documentTypeName].some((v) => String(v ?? '').toLowerCase().includes(q))),
    )
  }, [rows, search, status, priority, docType])

  const { pageItems, pagination } = usePagination(visible)
  const anyFilter = Boolean(search || status || priority || docType)

  const clearFilters = () => { setSearch(''); setStatus(''); setPriority(''); setDocType('') }

  const exportCsv = () => {
    const headers = [t('dashboard.table.colRef'), t('dashboard.table.colSubject'), t('dashboard.table.colCitizen'), t('dashboard.table.colType'),
      t('dashboard.table.colDue'), t('dashboard.table.colAssigned'), t('dashboard.table.colStatus'), t('dashboard.table.colPriority'), t('dashboard.table.colSla')]
    const records = visible.map((r) => [r.referenceNumber, r.subject, r.citizenName, r.documentTypeName, r.dueAt, r.assignedToName,
      t(`status.${r.status}`, r.status), t(`requests.priority.${r.priority || 'NORMAL'}`, r.priority || 'NORMAL'), r.slaStatus])
    downloadTextFile(toCsv(headers, records), `cts-${queue.key}-${todayISO()}.csv`)
  }

  const th = 'sticky top-0 z-10 whitespace-nowrap border-b border-hairline bg-slate-50 px-4 py-3 text-start text-[11px] font-bold uppercase tracking-wider text-slate-600'

  return (
    <section className="dash-card overflow-hidden" aria-labelledby="queue-title">
      {/* Header + controls */}
      <div className="border-b border-hairline p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="queue-title" className="flex items-center gap-2 text-base font-bold text-navy">
              {t(`dashboard.queue.${queue.key}.title`)}
              {rows && <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-bold text-brand">{rows.length}</span>}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">{t(`dashboard.queue.${queue.key}.hint`)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={exportCsv} disabled={!visible.length}>
              <Download size={15} aria-hidden="true" />{t('dashboard.table.exportCsv')}
            </button>
            <Link to={queue.more} className="inline-flex h-8 items-center gap-0.5 px-1 text-[13px] font-bold text-brand hover:underline">
              {t('dashboard.queue.seeAll')}<ChevronRight size={15} className="rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('dashboard.table.search')}
              placeholder={t('dashboard.table.search')} className="field !ps-9 !h-9" />
          </div>
          {statuses.length > 1 && statuses.map((s) => (
            <Pill key={s} active={status === s} onClick={() => setStatus(status === s ? '' : s)}>{t(`status.${s}`, s)}</Pill>
          ))}
          {priorities.length > 1 && (
            <>
              <span className="mx-1 hidden h-5 w-px bg-hairline sm:block" aria-hidden="true" />
              {priorities.map((p) => (
                <Pill key={p} active={priority === p} onClick={() => setPriority(priority === p ? '' : p)}>{t(`requests.priority.${p}`, p)}</Pill>
              ))}
            </>
          )}
          {docTypes.length > 1 && (
            <select value={docType} onChange={(e) => setDocType(e.target.value)} aria-label={t('dashboard.table.filterType')}
              className="field !h-8 !w-auto max-w-[200px] !rounded-full !py-0 !text-xs !font-bold">
              <option value="">{t('dashboard.table.allTypes')}</option>
              {docTypes.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {anyFilter && (
            <button type="button" onClick={clearFilters} className="inline-flex h-8 items-center gap-1 px-2 text-xs font-bold text-slate-600 hover:text-navy">
              <X size={14} aria-hidden="true" />{t('requests.clearFilters')}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3 p-6">{[0, 1, 2, 3].map((i) => <SkeletonLine key={i} height={44} />)}</div>
      ) : visible.length === 0 ? (
        <div className="grid place-items-center gap-2 px-6 py-14 text-center text-sm text-slate-600">
          <Inbox size={28} className="text-slate-300" aria-hidden="true" />
          {anyFilter ? t('common.noResults', 'No results') : t(`dashboard.queue.${queue.key}.empty`)}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr>
                <th className={th}>{t('dashboard.table.colRequest')}</th>
                <th className={th}>{t('dashboard.table.colCitizen')}</th>
                <th className={th}>{t('dashboard.table.colSla')}</th>
                <th className={th}>{t('dashboard.table.colAssigned')}</th>
                <th className={th}>{t('dashboard.table.colStatus')}</th>
                <th className={`${th} text-end`}>{t('dashboard.table.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r) => {
                const prio = r.priority || 'NORMAL'
                return (
                  <tr key={r.id} className="border-b border-hairline last:border-0 transition-colors hover:bg-brand-tint/50">
                    <td className="px-4 py-3 align-middle">
                      <Link to={`/requests/${r.id}`} className="text-sm font-bold text-navy hover:text-brand hover:underline">{r.referenceNumber}</Link>
                      <div className="mt-0.5 max-w-[260px] truncate text-xs text-slate-600" title={r.subject || r.documentTypeName}>
                        {r.subject || r.documentTypeName}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${avatarTone(r.citizenName)}`}>
                          {initials(r.citizenName)}
                        </span>
                        <span className="max-w-[160px] truncate text-sm font-semibold text-slate-800" title={r.citizenName}>{r.citizenName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle"><SlaCell row={r} t={t} /></td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex max-w-[180px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        r.assignedToName ? 'border-hairline bg-slate-50 text-slate-700' : 'border-dashed border-slate-300 text-slate-600'}`}>
                        <User size={13} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{r.assignedToName || t('dashboard.table.unassigned')}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={r.status} />
                        <span className={`dash-chip uppercase tracking-wide ${PRIORITY_STYLE[prio] ?? PRIORITY_STYLE.NORMAL}`}>
                          {t(`requests.priority.${prio}`, prio)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link to={`/requests/${r.id}`} className="inline-flex h-8 items-center gap-1 rounded-md bg-brand px-3 text-xs font-bold text-white transition-colors hover:bg-brand-hover">
                          {t('dashboard.table.review')}
                        </Link>
                        <Link to={`/requests/${r.id}`} className="hidden h-8 items-center gap-1 rounded-md border border-hairline px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 xl:inline-flex">
                          <Send size={13} aria-hidden="true" />{t('dashboard.table.forward')}
                        </Link>
                        <RowMenu row={r} t={t} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && visible.length > 0 && (
        <div className="bg-slate-50 px-5 pb-4">
          <Pagination className="!border-t-0" {...pagination} />
          {visible.length <= 10 && (
            <div className="pt-2.5 text-xs text-slate-600">{t('requests.showing')} {visible.length} {t('requests.of')} {rows.length}</div>
          )}
        </div>
      )}
    </section>
  )
}
