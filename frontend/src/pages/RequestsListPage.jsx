import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Eye } from 'lucide-react'
import client from '../api/client.js'
import StatusBadge, { SlaBadge } from '../components/StatusBadge.jsx'
import { SkeletonTableRows } from '../components/Skeleton.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']
const inputCls = 'rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

export default function RequestsListPage() {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [requests, setRequests] = useState([])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [assignedToMe, setAssignedToMe] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // The header's global search links here as /requests?q=... -- pick up a
  // change to that param without fighting the user's own typing below.
  useEffect(() => {
    const q = searchParams.get('q') || ''
    setSearch((current) => (current === q ? current : q))
  }, [searchParams])

  const load = useCallback(() => {
    setLoading(true)
    client.get('/requests', {
      params: {
        status: status || undefined,
        search: search || undefined,
        assignedToMe: assignedToMe || undefined,
      },
    })
      .then((r) => setRequests(r.data))
      .catch(() => setError(t('requests.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [status, search, assignedToMe, t])

  useEffect(() => { load() }, [load])

  function handleSearchChange(value) {
    setSearch(value)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  async function exportCsv() {
    const res = await client.get('/requests/export', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'correspondence_requests.csv'
    a.click()
    URL.revokeObjectURL(url)
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

      <div className="flex flex-wrap gap-2.5 mb-5">
        <input
          placeholder={t('requests.searchPlaceholder')}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className={`${inputCls} flex-1 min-w-[220px]`}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} w-[200px]`}>
          <option value="">{t('requests.allStatuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`, s)}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setAssignedToMe((v) => !v)}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold border transition-colors ${
            assignedToMe
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {t('requests.assignedToMe')}
        </button>
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
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('requests.colReference')}</th>
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('requests.colCitizen')}</th>
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('requests.colDocType')}</th>
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('requests.colStatus')}</th>
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('requests.colAssignedTo')}</th>
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('requests.colDue')}</th>
                    <th className="text-end text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200" aria-hidden="true"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonTableRows rows={6} cols={7} />
                  ) : requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3.5 font-semibold text-indigo-600">
                        <Link to={`/requests/${r.id}`}>{r.referenceNumber}</Link>
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
              : requests.map((r) => (
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
        </>
      )}
    </div>
  )
}
