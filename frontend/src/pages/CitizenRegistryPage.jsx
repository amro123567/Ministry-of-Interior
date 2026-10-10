import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Eye, Search } from 'lucide-react'
import client from '../api/client.js'
import { SkeletonTableRows } from '../components/Skeleton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { ActiveFilterChips, FilterField } from '../components/FilterBar.jsx'

const PAGE_SIZE = 15
const MARITAL = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']
const SORTERS = {
  registryNumber: (c) => c.registryNumber ?? '',
  name: (c) => displayNameOf(c).toLowerCase(),
  dateOfBirth: (c) => (c.dateOfBirth ? new Date(c.dateOfBirth).getTime() : Number.POSITIVE_INFINITY),
  officeName: (c) => (c.officeName ?? '').toLowerCase(),
  maritalStatus: (c) => c.maritalStatus ?? '',
}

function displayNameOf(c) {
  const en = [c.firstNameEn, c.middleNameEn, c.lastNameEn].filter(Boolean).join(' ')
  return en || [c.firstNameAr, c.middleNameAr, c.lastNameAr].filter(Boolean).join(' ')
}


function DeceasedBadge({ deceased, t }) {
  if (!deceased) return null
  return (
    <span className="inline-flex items-center rounded-full border border-badge-draft-bd bg-badge-draft-bg px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
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
  const [debounced, setDebounced] = useState(search)
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [page, setPage] = useState(1)
  const office = searchParams.get('office') || ''
  const marital = searchParams.get('marital') || ''
  const life = searchParams.get('life') || '' // '', 'alive' or 'deceased'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    client.get('/citizens', { params: { q: debounced || undefined } })
      .then((r) => setCitizens(r.data))
      .catch(() => setError(t('citizens.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [debounced, t])

  useEffect(() => { load() }, [load])

  // Search as you type, but only hit the API once the typing pauses.
  useEffect(() => {
    const h = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(h)
  }, [search])

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
    setPage(1)
  }

  function clearFilters() {
    const next = new URLSearchParams()
    if (search) next.set('q', search)
    setSearchParams(next, { replace: true })
    setPage(1)
  }

  const offices = useMemo(
    () => [...new Set(citizens.map((c) => c.officeName).filter(Boolean))].sort(),
    [citizens],
  )

  const filtered = useMemo(() => citizens.filter((c) =>
    (!office || c.officeName === office) &&
    (!marital || c.maritalStatus === marital) &&
    (!life || (life === 'deceased') === Boolean(c.deceased)),
  ), [citizens, office, marital, life])

  const sorted = useMemo(() => {
    if (!sort.key) return filtered
    const read = SORTERS[sort.key]
    const f = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => { const x = read(a); const y = read(b); return x < y ? -f : x > y ? f : 0 })
  }, [filtered, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const anyFilter = Boolean(office || marital || life)
  const activeChips = [
    office && { key: 'office', onRemove: () => setParam('office', ''), label: office },
    marital && { key: 'marital', onRemove: () => setParam('marital', ''), label: t(`citizens.maritalStatus.${marital}`, marital) },
    life && { key: 'life', onRemove: () => setParam('life', ''), label: t(life === 'deceased' ? 'citizens.deceased' : 'citizens.alive') },
  ].filter(Boolean)

  function toggleSort(key) {
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setPage(1)
  }

  function SortHeader({ k, label, align }) {
    const active = sort.key === k
    return (
      <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
          className={`th-cell ${align === 'end' ? '!text-end' : ''}`}>
        <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-text-primary">
          {label}
          <span aria-hidden="true" className={active ? 'text-primary' : 'text-slate-300'}>{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
        </button>
      </th>
    )
  }

  function handleSearchChange(value) {
    setSearch(value)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  const displayName = displayNameOf

  const showEmpty = !loading && !error && filtered.length === 0

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('citizens.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('citizens.subtitle')}</p>
        </div>
        {/* CITIZEN_MANAGE-gated, matching SecurityConfig's POST /api/
            citizens/** matcher -- a Viewer never sees a button whose
            action the backend would reject. */}
        {hasPermission('CITIZEN_MANAGE') && (
          <Link
            to="/citizens/new"
            className="btn-primary whitespace-nowrap"
          >
            {t('citizens.newCitizen')}
          </Link>
        )}
      </div>

      {/* Same structure as the Correspondence filters: search on top, labelled selects in one
          row, then a removable chip for each active filter. Filters apply live (URL = state). */}
      <section className="card mb-5 divide-y divide-row-divider" aria-label={t('requests.filters')}>
        <div className="p-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              placeholder={t('citizens.searchPlaceholder')}
              aria-label={t('citizens.searchPlaceholder')}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="field !ps-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <FilterField label={t('citizens.colOffice')}>
            <select value={office} onChange={(e) => setParam('office', e.target.value)} className="field select-field" aria-label={t('citizens.colOffice')}>
              <option value="">{t('citizens.allOffices')}</option>
              {offices.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </FilterField>
          <FilterField label={t('citizens.colMaritalStatus')}>
            <select value={marital} onChange={(e) => setParam('marital', e.target.value)} className="field select-field" aria-label={t('citizens.colMaritalStatus')}>
              <option value="">{t('citizens.allMarital')}</option>
              {MARITAL.map((m) => <option key={m} value={m}>{t(`citizens.maritalStatus.${m}`, m)}</option>)}
            </select>
          </FilterField>
          <FilterField label={t('citizens.lifeStatus')}>
            <select value={life} onChange={(e) => setParam('life', e.target.value)} className="field select-field" aria-label={t('citizens.lifeStatus')}>
              <option value="">{t('citizens.allLife')}</option>
              <option value="alive">{t('citizens.alive')}</option>
              <option value="deceased">{t('citizens.deceased')}</option>
            </select>
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
          <p>{t('citizens.noMatch')}</p>
        </div>
      ) : !error && (
        <>
          <div className="hidden md:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortHeader k="registryNumber" label={t('citizens.colRegistryNumber')} />
                    <SortHeader k="name" label={t('citizens.colName')} />
                    <SortHeader k="dateOfBirth" label={t('citizens.colDateOfBirth')} align="end" />
                    <SortHeader k="officeName" label={t('citizens.colOffice')} />
                    <SortHeader k="maritalStatus" label={t('citizens.colMaritalStatus')} />
                    <th className="th-cell !text-end" aria-hidden="true"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonTableRows rows={6} cols={6} />
                  ) : visible.map((c) => (
                    <tr key={c.id} className="data-row">
                      <td className="td-cell font-semibold text-primary">
                        <Link to={`/citizens/${c.id}`}>{c.registryNumber}</Link>
                      </td>
                      <td className="td-cell text-text-primary">
                        <div className="flex items-center gap-2">
                          <span>{displayName(c)}</span>
                          <DeceasedBadge deceased={c.deceased} t={t} />
                        </div>
                      </td>
                      <td className="td-cell num-cell whitespace-nowrap">
                        {c.dateOfBirth ? format(new Date(c.dateOfBirth), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="td-cell text-text-primary">{c.officeName ?? '—'}</td>
                      <td className="td-cell">
                        {c.maritalStatus ? t(`citizens.maritalStatus.${c.maritalStatus}`, c.maritalStatus) : '—'}
                      </td>
                      <td className="td-cell">
                        <div className="flex justify-end">
                          <Link
                            to={`/citizens/${c.id}`}
                            aria-label={t('citizens.open')}
                            title={t('citizens.open')}
                            className="icon-btn"
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
                <div key={i} className="h-24 rounded-lg border border-border-subtle bg-row-divider animate-pulse" />
              ))
              : visible.map((c) => (
                <Link
                  to={`/citizens/${c.id}`}
                  key={c.id}
                  className="block card p-4 shadow-sm hover:border-primary/40"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-primary text-sm">{c.registryNumber}</span>
                    <DeceasedBadge deceased={c.deceased} t={t} />
                  </div>
                  <div className="text-sm text-text-primary mb-1.5">{displayName(c)}</div>
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>{c.officeName ?? '—'}</span>
                    <span>{c.dateOfBirth ? format(new Date(c.dateOfBirth), 'MMM d, yyyy') : '—'}</span>
                  </div>
                </Link>
              ))}
          </div>

          {!loading && sorted.length > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-text-secondary">
              <span>{t('requests.showing')} {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} {t('requests.of')} {sorted.length}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}
                  className="btn-secondary btn-sm">{t('requests.prev')}</button>
                <span>{currentPage} / {pageCount}</span>
                <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}
                  className="btn-secondary btn-sm">{t('requests.next')}</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
