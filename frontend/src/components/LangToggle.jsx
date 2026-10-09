import { useLanguage } from '../context/LanguageContext.jsx'

// Segmented EN | ع control. Two real buttons (each with aria-pressed) inside
// one labelled group, so keyboard and screen-reader users can pick a
// language directly instead of cycling through a single toggle.
export default function LangToggle({ className = '', tone = 'light' }) {
  const dark = tone === 'dark'
  const { lang, setLang } = useLanguage()
  const seg = (active) =>
    `h-7 min-w-9 rounded px-2.5 text-xs font-semibold transition-colors ${
      active
        ? 'bg-surface-card text-primary shadow-sm'
        : dark ? 'text-slate-200 hover:text-white' : 'text-text-secondary hover:text-text-primary'
    }`
  return (
    <div
      role="group"
      aria-label="Switch language / تبديل اللغة"
      title="EN / عربي"
      dir="ltr"
      className={`inline-flex items-center gap-0.5 rounded-md border p-0.5 ${dark ? 'border-white/25 bg-white/10' : 'border-border-subtle bg-row-hover'} ${className}`}
    >
      <button type="button" className={seg(lang === 'en')} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
      <button type="button" className={seg(lang === 'ar')} aria-pressed={lang === 'ar'} onClick={() => setLang('ar')} lang="ar">ع</button>
    </div>
  )
}
