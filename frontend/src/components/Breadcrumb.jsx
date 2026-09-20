import { Link, useLocation, useParams } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext.jsx'

// Lightweight route -> breadcrumb trail. No new dependency: derived from the
// current pathname using the same route shapes defined in App.jsx.
export default function Breadcrumb() {
  const { t } = useLanguage()
  const location = useLocation()
  const params = useParams()
  const path = location.pathname

  const trail = [{ label: t('nav.dashboard'), to: '/' }]

  if (path.startsWith('/requests/new')) {
    trail.push({ label: t('nav.correspondence'), to: '/requests' })
    trail.push({ label: t('requestCreate.title') })
  } else if (path.startsWith('/requests/') && params.id) {
    trail.push({ label: t('nav.correspondence'), to: '/requests' })
    trail.push({ label: `#${params.id}` })
  } else if (path.startsWith('/requests')) {
    trail.push({ label: t('nav.correspondence') })
  } else if (path.startsWith('/citizens/') && params.id) {
    trail.push({ label: t('nav.citizens'), to: '/citizens' })
    trail.push({ label: `#${params.id}` })
  } else if (path.startsWith('/citizens')) {
    trail.push({ label: t('nav.citizens') })
  } else if (path.startsWith('/admin/users')) {
    trail.push({ label: t('nav.users') })
  } else if (path.startsWith('/admin/audit')) {
    trail.push({ label: t('nav.auditLog') })
  } else if (path.startsWith('/reports')) {
    trail.push({ label: t('nav.reports') })
  } else {
    return null // dashboard itself -- no trail needed beyond the page title
  }

  return (
    <nav className="flex items-center flex-wrap gap-1.5 text-sm text-slate-400 mb-4" aria-label="Breadcrumb">
      {trail.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-indigo-600 hover:underline">{crumb.label}</Link>
          ) : (
            <span aria-current="page" className="font-semibold text-slate-700">{crumb.label}</span>
          )}
          {i < trail.length - 1 && <span className="text-slate-300" aria-hidden="true">/</span>}
        </span>
      ))}
    </nav>
  )
}
