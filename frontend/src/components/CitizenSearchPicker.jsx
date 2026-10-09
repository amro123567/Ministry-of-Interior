import { useEffect, useState } from 'react'
import client from '../api/client.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import { inputCls } from '../ui.js'


// A plain "pick an existing citizen" search box -- the same debounced
// GET /api/citizens?q= lookup ParentLineagePicker uses, but without its
// registered/unregistered/none mode toggle (nothing here can point at an
// unregistered person, so there's nothing to toggle). Used wherever a
// registry-domain form just needs one existing citizen: a family record's
// head of household, a family member being added, a guardian.
//
// `value` is { citizenId, citizenLabel }. `excludeCitizenId` filters a
// citizen out of the results -- e.g. so a guardian can't be picked as
// their own ward's guardian from this UI (the backend rejects
// self-guardianship too; this just avoids surfacing a dead-end option).
export default function CitizenSearchPicker({ label, value, onChange, excludeCitizenId, placeholder }) {
  const { t } = useLanguage()
  const { citizenId, citizenLabel } = value
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  useEffect(() => {
    if (citizenId) { setResults([]); return }
    const handle = setTimeout(() => {
      client.get('/citizens', { params: { q: query || undefined } })
        .then((r) => setResults(r.data.filter((c) => c.id !== excludeCitizenId)))
    }, 250)
    return () => clearTimeout(handle)
  }, [query, citizenId, excludeCitizenId])

  return (
    <div>
      {label && <div className="text-sm font-semibold text-slate-700 mb-1.5">{label}</div>}
      {citizenId ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-app px-3 py-2 text-sm">
          <span className="text-text-primary">{citizenLabel}</span>
          <button
            type="button"
            className="text-xs font-semibold text-primary hover:underline flex-shrink-0"
            onClick={() => onChange({ citizenId: null, citizenLabel: null })}
          >
            {t('lineagePicker.change')}
          </button>
        </div>
      ) : (
        <div>
          <input
            className={inputCls}
            placeholder={placeholder || t('lineagePicker.searchPlaceholder')}
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
                    citizenId: c.id,
                    citizenLabel: `${[c.firstNameEn, c.lastNameEn].filter(Boolean).join(' ')} — ${c.registryNumber}`,
                  })}
                >
                  {[c.firstNameEn, c.lastNameEn].filter(Boolean).join(' ') || [c.firstNameAr, c.lastNameAr].filter(Boolean).join(' ')} — {c.registryNumber}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
