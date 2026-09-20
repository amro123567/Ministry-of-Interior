import { useLanguage } from '../context/LanguageContext.jsx'

export default function LangToggle({ className = '' }) {
  const { lang, toggleLang } = useLanguage()
  return (
    <button
      type="button"
      className={`lang-toggle ${className}`}
      onClick={toggleLang}
      aria-label="Switch language / تبديل اللغة"
      title="EN / عربي"
    >
      <span className={lang === 'en' ? 'lang-option lang-active' : 'lang-option'}>EN</span>
      <span className="lang-sep">/</span>
      <span className={lang === 'ar' ? 'lang-option lang-active' : 'lang-option'}>ع</span>
    </button>
  )
}
