import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext.jsx'

// Lightweight route -> breadcrumb trail. No new dependency: derived from the
// current pathname using the same route shapes defined in App.jsx.
export default function Breadcrumb() {
  const { t } = useLanguage()
  const location = useLocation()
  const path = location.pathname
  // Rendered outside <Routes>, so useParams() is always empty here; read the id from the path.
  const idOf = (prefix) => (path.startsWith(prefix) ? path.slice(prefix.length).split('/')[0] : '')

  const trail = [{ label: t('nav.dashboard'), to: '/' }]

  if (path.startsWith('/requests/new')) {
    trail.push({ label: t('nav.correspondence'), to: '/requests' })
    trail.push({ label: t('requestCreate.title') })
  } else if (idOf('/requests/')) {
    trail.push({ label: t('nav.correspondence'), to: '/requests' })
    trail.push({ label: `#${idOf('/requests/')}` })
  } else if (path.startsWith('/requests')) {
    trail.push({ label: t('nav.correspondence') })
  } else if (path.startsWith('/citizens/new')) {
    trail.push({ label: t('nav.citizens'), to: '/citizens' })
    trail.push({ label: t('citizenCreate.title') })
  } else if (idOf('/citizens/')) {
    trail.push({ label: t('nav.citizens'), to: '/citizens' })
    trail.push({ label: `#${idOf('/citizens/')}` })
  } else if (path.startsWith('/citizens')) {
    trail.push({ label: t('nav.citizens') })
  } else if (idOf('/admin/users/')) {
    trail.push({ label: t('nav.users'), to: '/admin/users' })
    trail.push({ label: t('userActivity.breadcrumb') })
  } else if (path.startsWith('/admin/users')) {
    trail.push({ label: t('nav.users') })
  } else if (path.startsWith('/admin/audit')) {
    trail.push({ label: t('nav.auditLog') })
  } else if (path.startsWith('/reports')) {
    trail.push({ label: t('nav.reports') })
  } else if (path.startsWith('/workflow')) {
    trail.push({ label: t('nav.workflow') })
  } else {
    return null // dashboard itself -- no trail needed beyond the page title
  }

  return (
    <nav className="flex items-center flex-wrap gap-1.5 text-sm text-text-secondary mb-4" aria-label="Breadcrumb">
      {trail.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-primary hover:underline">{crumb.label}</Link>
          ) : (
            <span aria-current="page" className="font-semibold text-slate-700">{crumb.label}</span>
          )}
          {i < trail.length - 1 && <span className="text-slate-300" aria-hidden="true">/</span>}
        </span>
      ))}
    </nav>
  )
}
