import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Eye } from 'lucide-react'
import client from '../api/client.js'
import { SkeletonTableRows } from '../components/Skeleton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const inputCls = 'rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

function DeceasedBadge({ deceased, t }) {
  if (!deceased) return null
  return (
    <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
      {t('citizens.deceased')}
    </span>
  )
}

// Read-only search/browse over GET /api/citizens?q=... -- the first
// frontend screen for the full-requirements migration punch list's
// citizen-registry domain (Item 2). Deliberately read-only for now:
// registering a new citizen and correcting lineage are their own,
// separate increments. Every row this returns also writes a
// RecordAccessLog row on the backend (Item 6, tier 3) -- see
// CitizenController.search()'s own Javadoc.
export default function CitizenRegistryPage() {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [citizens, setCitizens] = useState([])
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    client.get('/citizens', { params: { q: search || undefined } })
      .then((r) => setCitizens(r.data))
      .catch(() => setError(t('citizens.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [search, t])

  useEffect(() => { load() }, [load])

  function handleSearchChange(value) {
    setSearch(value)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  function displayName(c) {
    const en = [c.firstNameEn, c.middleNameEn, c.lastNameEn].filter(Boolean).join(' ')
    return en || [c.firstNameAr, c.middleNameAr, c.lastNameAr].filter(Boolean).join(' ')
  }

  const showEmpty = !loading && !error && citizens.length === 0

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('citizens.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('citizens.subtitle')}</p>
        </div>
        {/* CITIZEN_MANAGE-gated, matching SecurityConfig's POST /api/
            citizens/** matcher -- a Viewer never sees a button whose
            action the backend would reject. */}
        {hasPermission('CITIZEN_MANAGE') && (
          <Link
            to="/citizens/new"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
          >
            {t('citizens.newCitizen')}
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5 mb-5">
        <input
          placeholder={t('citizens.searchPlaceholder')}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className={`${inputCls} flex-1 min-w-[220px]`}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4" role="alert">
          {error}
        </div>
      )}

      {showEmpty ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-400">
          <p>{t('citizens.noMatch')}</p>
        </div>
      ) : !error && (
        <>
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('citizens.colRegistryNumber')}</th>
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('citizens.colName')}</th>
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('citizens.colDateOfBirth')}</th>
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('citizens.colOffice')}</th>
                    <th className="text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200">{t('citizens.colMaritalStatus')}</th>
                    <th className="text-end text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200" aria-hidden="true"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonTableRows rows={6} cols={6} />
                  ) : citizens.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3.5 font-semibold text-indigo-600">
                        <Link to={`/citizens/${c.id}`}>{c.registryNumber}</Link>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        <div className="flex items-center gap-2">
                          <span>{displayName(c)}</span>
                          <DeceasedBadge deceased={c.deceased} t={t} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {c.dateOfBirth ? format(new Date(c.dateOfBirth), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">{c.officeName ?? '—'}</td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {c.maritalStatus ? t(`citizens.maritalStatus.${c.maritalStatus}`, c.maritalStatus) : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end">
                          <Link
                            to={`/citizens/${c.id}`}
                            aria-label={t('citizens.open')}
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
                <div key={i} className="h-24 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
              ))
              : citizens.map((c) => (
                <Link
                  to={`/citizens/${c.id}`}
                  key={c.id}
                  className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-indigo-600 text-sm">{c.registryNumber}</span>
                    <DeceasedBadge deceased={c.deceased} t={t} />
                  </div>
                  <div className="text-sm text-slate-800 mb-1.5">{displayName(c)}</div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{c.officeName ?? '—'}</span>
                    <span>{c.dateOfBirth ? format(new Date(c.dateOfBirth), 'MMM d, yyyy') : '—'}</span>
                  </div>
                </Link>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
