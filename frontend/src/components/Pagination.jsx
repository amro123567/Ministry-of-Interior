import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext.jsx'

export const PAGE_SIZES = [10, 25, 50]

/**
 * Client-side paging for a list that is already loaded.
 * Returns the slice to render plus the props <Pagination /> needs. The page
 * snaps back to 1 whenever the number of rows changes (a filter, a reload).
 */
export function usePagination(items, initialSize = 10) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialSize)
  const total = items?.length ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pageCount)
  useEffect(() => { setPage(1) }, [total, pageSize])
  const pageItems = useMemo(
    () => (items ? items.slice((current - 1) * pageSize, current * pageSize) : []),
    [items, current, pageSize],
  )
  return {
    pageItems,
    pagination: { total, page: current, pageSize, onPage: setPage, onPageSize: setPageSize },
  }
}

// 1 … 4 5 [6] 7 8 … 20 -- always the first, last and the neighbours of the current page.
function windowed(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const set = new Set([1, count, page - 1, page, page + 1])
  if (page <= 3) { set.add(2); set.add(3); set.add(4) }
  if (page >= count - 2) { set.add(count - 1); set.add(count - 2); set.add(count - 3) }
  const sorted = [...set].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b)
  const out = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('gap')
    out.push(n)
  })
  return out
}

export default function Pagination({ total, page, pageSize, onPage, onPageSize, sizes = PAGE_SIZES, className = '' }) {
  const { t } = useLanguage()
  // Nothing to page through: stay out of the way.
  if (total <= Math.min(...sizes)) return null
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-semibold transition-colors'
  return (
    <nav aria-label={t('requests.pagination', 'Pagination')}
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-1 pt-4 text-sm text-slate-600 ${className}`}>
      <span>
        {t('requests.showing')} <b className="text-navy">{from}–{to}</b> {t('requests.of')} <b className="text-navy">{total}</b>
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          {t('requests.perPage')}
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="field !h-8 !w-auto">
            {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('requests.prev')}
            className={`${btn} border-hairline bg-white text-slate-700 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40`}>
            <ChevronLeft size={16} className="rtl:rotate-180" aria-hidden="true" />
            <span className="ms-0.5 hidden sm:inline">{t('requests.prev')}</span>
          </button>
          {windowed(page, pageCount).map((n, i) => (n === 'gap'
            ? <span key={`g${i}`} className="px-1 text-slate-400" aria-hidden="true">…</span>
            : (
              <button key={n} type="button" onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined}
                aria-label={`${t('requests.page', 'Page')} ${n}`}
                className={`${btn} ${n === page ? 'border-navy bg-navy text-white' : 'border-transparent text-slate-700 hover:bg-slate-100'}`}>
                {n}
              </button>
            )))}
          <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label={t('requests.next')}
            className={`${btn} border-hairline bg-white text-slate-700 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40`}>
            <span className="me-0.5 hidden sm:inline">{t('requests.next')}</span>
            <ChevronRight size={16} className="rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  )
}
