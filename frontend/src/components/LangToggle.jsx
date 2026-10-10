import { useLanguage } from '../context/LanguageContext.jsx'

// Segmented EN | AR control. Two real buttons (each with aria-pressed) inside
// one labelled group, so keyboard and screen-reader users can pick a
// language directly instead of cycling through a single toggle.
// tone="dark" is the header variant (blue active segment on a slate pill);
// the light variant is used on the login page and keeps the Arabic "ع" glyph.
export default function LangToggle({ className = '', tone = 'light' }) {
  const dark = tone === 'dark'
  const soft = tone === 'soft'
  const { lang, setLang } = useLanguage()
  const seg = (active) =>
    `h-7 min-w-9 rounded-md px-2.5 text-xs font-semibold transition-colors ${
      dark
        ? active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
        : soft
        ? active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
        : active ? 'bg-surface-card text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
    }`
  return (
    <div
      role="group"
      aria-label="Switch language / تبديل اللغة"
      title="EN / عربي"
      dir="ltr"
      className={`inline-flex items-center gap-0.5 rounded-lg border p-0.5 ${
        dark ? 'border-slate-700 bg-slate-800/60' : soft ? 'border-slate-200 bg-slate-50' : 'border-border-subtle bg-row-hover'
      } ${className}`}
    >
      <button type="button" className={seg(lang === 'en')} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
      <button type="button" className={seg(lang === 'ar')} aria-pressed={lang === 'ar'} onClick={() => setLang('ar')} lang="ar"
        aria-label="العربية">{dark || soft ? 'AR' : 'ع'}</button>
    </div>
  )
}
