import { ChevronDown } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext.jsx'

// One shared shell for every data-entry form so they all look and behave alike:
// a centered column, a centered title + subtitle, one white card, grouped sections
// and a single action bar.

export function FormPage({ title, subtitle, onSubmit, noValidate, error, requiredNote = true, width = 'max-w-[1400px]', children }) {
  const { t } = useLanguage()
  return (
    <div className={`mx-auto w-full ${width}`}>
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </header>
      <form onSubmit={onSubmit} noValidate={noValidate} className="dash-card p-6 sm:p-8">
        {error && (
          <div className="mb-5 rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg" role="alert">
            {error}
          </div>
        )}
        {requiredNote && (
          <p className="mb-4 text-end text-xs text-text-secondary"><span className="text-required">*</span> {t('common.required')}</p>
        )}
        <div className="space-y-5">{children}</div>
      </form>
    </div>
  )
}

// A titled group of fields. With `collapsible` it becomes a native <details>,
// so optional blocks stay out of the way until opened.
export function FormSection({ title, collapsible = false, defaultOpen = false, children }) {
  if (collapsible) {
    return (
      <details open={defaultOpen || undefined} className="group rounded-xl border border-hairline bg-slate-50/60 open:bg-slate-50/60">
        <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-3 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-brand [&::-webkit-details-marker]:hidden">
          <span>{title}</span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="px-5 pb-5">{children}</div>
      </details>
    )
  }
  return (
    <fieldset className="rounded-xl border border-hairline bg-slate-50/60 p-5">
      <legend className="px-2 text-xs font-bold uppercase tracking-wider text-brand">{title}</legend>
      {children}
    </fieldset>
  )
}

export function FormActions({ children }) {
  return <div className="flex justify-end gap-2.5 border-t border-hairline pt-5">{children}</div>
}
