import { useEffect, useState } from 'react'
import client from '../api/client.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import { inputCls } from '../ui.js'


// Shared by CitizenCreatePage (registering a brand-new citizen) and
// CitizenDetailPage's lineage-edit form (correcting an existing one) --
// mirrors the backend's own XOR rule one-for-one (CitizenService.
// applyParent(): a parent is either a registered citizen (fatherId/
// motherId) or a free-text name for someone not in the registry
// (fatherNameUnregistered/motherNameUnregistered), never both, and this
// picker's three-way mode makes that the only shape it's possible to
// build in the UI, rather than relying on the caller to enforce it.
//
// `value` is { mode: 'none' | 'registered' | 'unregistered', citizenId,
// citizenLabel, unregisteredName }. `excludeCitizenId` (the citizen being
// edited, when there is one) is filtered out of search results so nobody
// can pick themselves as their own parent from this UI -- the backend
// rejects that too (SI: "A citizen cannot be their own parent."), this
// just avoids surfacing an option that would only bounce back as an error.
export default function ParentLineagePicker({ label, value, onChange, excludeCitizenId }) {
  const { t } = useLanguage()
  const { mode, citizenId, citizenLabel, unregisteredName } = value
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  useEffect(() => {
    if (mode !== 'registered' || citizenId) { setResults([]); return }
    const handle = setTimeout(() => {
      client.get('/citizens', { params: { q: query || undefined } })
        .then((r) => setResults(r.data.filter((c) => c.id !== excludeCitizenId)))
    }, 250)
    return () => clearTimeout(handle)
  }, [query, mode, citizenId, excludeCitizenId])

  function setMode(next) {
    if (next === 'none') onChange({ mode: 'none', citizenId: null, citizenLabel: null, unregisteredName: null })
    else if (next === 'unregistered') onChange({ mode: 'unregistered', citizenId: null, citizenLabel: null, unregisteredName: unregisteredName || '' })
    else onChange({ mode: 'registered', citizenId: null, citizenLabel: null, unregisteredName: null })
  }

  const modeBtnCls = (active) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
      active ? 'bg-primary-tint border-primary/40 text-primary-hover' : 'border-border-subtle text-text-secondary hover:bg-row-hover'
    }`

  return (
    <div className="rounded-lg border border-border-subtle p-3.5">
      <div className="text-sm font-semibold text-slate-700 mb-2">{label}</div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button type="button" className={modeBtnCls(mode === 'none')} onClick={() => setMode('none')}>
          {t('lineagePicker.notSet')}
        </button>
        <button type="button" className={modeBtnCls(mode === 'registered')} onClick={() => setMode('registered')}>
          {t('lineagePicker.registered')}
        </button>
        <button type="button" className={modeBtnCls(mode === 'unregistered')} onClick={() => setMode('unregistered')}>
          {t('lineagePicker.unregistered')}
        </button>
      </div>

      {mode === 'registered' && (
        citizenId ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-app px-3 py-2 text-sm">
            <span className="text-text-primary">{citizenLabel}</span>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline flex-shrink-0"
              onClick={() => onChange({ mode: 'registered', citizenId: null, citizenLabel: null, unregisteredName: null })}
            >
              {t('lineagePicker.change')}
            </button>
          </div>
        ) : (
          <div>
            <input
              className={inputCls}
              placeholder={t('lineagePicker.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {results.length > 0 && (
              <div className="mt-1.5 max-h-40 overflow-y-auto card shadow-sm">
                {results.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className="block w-full text-start px-3 py-2 text-sm text-slate-700 hover:bg-row-hover"
                    onClick={() => onChange({
                      mode: 'registered',
                      citizenId: c.id,
                      citizenLabel: `${[c.firstNameEn, c.lastNameEn].filter(Boolean).join(' ')} — ${c.registryNumber}`,
                      unregisteredName: null,
                    })}
                  >
                    {[c.firstNameEn, c.lastNameEn].filter(Boolean).join(' ') || [c.firstNameAr, c.lastNameAr].filter(Boolean).join(' ')} — {c.registryNumber}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {mode === 'unregistered' && (
        <input
          className={inputCls}
          placeholder={t('lineagePicker.namePlaceholder')}
          value={unregisteredName || ''}
          onChange={(e) => onChange({ mode: 'unregistered', citizenId: null, citizenLabel: null, unregisteredName: e.target.value })}
        />
      )}
    </div>
  )
}
