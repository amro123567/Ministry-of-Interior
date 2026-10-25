import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function NotFoundPage() {
  const { t } = useLanguage()
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl font-extrabold text-navy">404</p>
      <h1 className="mt-3 text-xl font-bold text-text-primary">{t('common.notFoundTitle', 'Page not found')}</h1>
      <p className="mt-2 text-sm text-text-secondary">{t('common.notFoundMessage', 'The page you are looking for does not exist or was moved.')}</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">{t('common.backToDashboard', 'Back to dashboard')}</Link>
    </div>
  )
}
