import { X } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext.jsx'

// Shared pieces of the list-page filter panels (Correspondence, Citizen Registry),
// so both pages are laid out and behave the same way.

/** A small label above a filter control, so a row of selects reads as labelled fields. */
export function FilterField({ label, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{label}</span>
      {children}
    </div>
  )
}

/**
 * One removable chip per active filter, plus a "Clear filters" link.
 * chips: [{ key, label, onRemove }]; renders nothing when there are none.
 */
export function ActiveFilterChips({ chips, onClear }) {
  const { t } = useLanguage()
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3" role="group" aria-label={t('requests.activeFilters')}>
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('requests.activeFilters')}</span>
      {chips.map((c) => (
        <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary-tint py-0.5 ps-2.5 pe-1 text-xs font-semibold text-primary">
          {c.label}
          <button type="button" onClick={c.onRemove} aria-label={`${t('requests.removeFilter')}: ${c.label}`}
            className="grid h-5 w-5 place-items-center rounded-full hover:bg-primary/15">
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClear} className="ms-auto text-xs font-bold text-text-secondary hover:text-text-primary hover:underline">
        {t('requests.clearFilters')}
      </button>
    </div>
  )
}
