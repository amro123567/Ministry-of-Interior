import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from './context/LanguageContext.jsx'

// Name of the page for a path, in the current language -- the same route shapes
// App.jsx and Breadcrumb.jsx use. Returns null for a path it does not recognise.
export function pageNameFor(path, t) {
  const idOf = (prefix) => (path.startsWith(prefix) ? path.slice(prefix.length).split('/')[0] : '')

  if (path === '/login') return t('login.staffSignIn')
  if (path === '/') return t('nav.dashboard')
  if (path.startsWith('/requests/new')) return t('requestCreate.title')
  if (idOf('/requests/')) return `${t('nav.correspondence')} #${idOf('/requests/')}`
  if (path.startsWith('/requests')) return t('nav.correspondence')
  if (path.startsWith('/citizens') || path.startsWith('/family-records') || path.startsWith('/documents')) return t('nav.citizens')
  if (path.startsWith('/admin/users')) return t('nav.users')
  if (path.startsWith('/admin/audit')) return t('nav.auditLog')
  if (path.startsWith('/reports')) return t('nav.reports')
  if (path.startsWith('/workflow')) return t('nav.workflow')
  return null
}

// Browser tab title: "<Page> | CTS – Ministry of Interior" (Arabic when the UI is Arabic).
// The page name comes first so it stays readable when the tab is narrow.
export default function usePageTitle() {
  const { t } = useLanguage()
  const { pathname } = useLocation()
  const page = pageNameFor(pathname, t)
  const title = page ? `${page} | ${t('app.titleSuffix')}` : t('app.title')
  useEffect(() => { document.title = title }, [title])
}
