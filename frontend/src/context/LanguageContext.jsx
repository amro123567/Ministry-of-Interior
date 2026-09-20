import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { translations } from '../i18n/translations.js'

const LanguageContext = createContext(null)

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('cts_lang') || 'en')

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('cts_lang', lang)
  }, [lang])

  const setLang = useCallback((next) => setLangState(next === 'ar' ? 'ar' : 'en'), [])
  const toggleLang = useCallback(() => setLangState((l) => (l === 'en' ? 'ar' : 'en')), [])

  const t = useCallback(
    (key, fallback) => {
      const value = getPath(translations[lang], key)
      if (value !== undefined) return value
      const enValue = getPath(translations.en, key)
      if (enValue !== undefined) return enValue
      return fallback ?? key
    },
    [lang],
  )

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, dir: lang === 'ar' ? 'rtl' : 'ltr', t }),
    [lang, setLang, toggleLang, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
