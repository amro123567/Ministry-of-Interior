import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import LangToggle from '../components/LangToggle.jsx'

export default function LoginPage() {
  const { login, user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  if (user) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(username, password)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message ?? t('login.errorDefault'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <LangToggle className="login-lang-toggle" />

      <div className="login-card-shell">
        <div className="login-brand">
          <div className="login-flag-strip" aria-hidden="true">
            <span className="flag-red" />
            <span className="flag-white" />
            <span className="flag-red" />
          </div>

          <div className="login-brand-body">
            <div className="login-seal-plate">
              <img src="/moi-seal.png" alt="Ministry of Interior and Municipalities seal" />
            </div>

            <div className="login-brand-titles">
              <p className="login-eyebrow">{t('login.republic')}</p>
              <h1 className="login-ministry">{t('login.ministry')}</h1>
              <div className="login-brand-divider" />
              <p className="login-dept">{t('login.directorate')}</p>
              <p className="login-system">{t('login.system')}</p>
            </div>
          </div>

          <div className="login-brand-footer">
            <p>{t('login.internalNotice')}</p>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-card">
            <h2 className="login-form-title">{t('login.staffSignIn')}</h2>
            <p className="login-form-hint">{t('login.hint')}</p>

            {location.state?.loggedOut && !error && (
              <div className="login-info-banner">{t('login.loggedOut')}</div>
            )}
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label className="field-label" htmlFor="login-username">{t('login.username')}</label>
                <input
                  id="login-username"
                  className="field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('login.usernamePlaceholder')}
                  autoFocus
                  autoComplete="username"
                  required
                />
              </div>

              <div className="login-field">
                <label className="field-label" htmlFor="login-password">{t('login.password')}</label>
                <div className="login-password-wrap">
                  <input
                    id="login-password"
                    className="field"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-eye-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6 0 9.5 5 10.5 7-0.4.8-1.3 2.2-2.7 3.5M6.6 6.6C4.4 8 2.9 10.3 1.5 12c1 2 4.5 7 10.5 7 1.4 0 2.7-.3 3.9-.8" />
                        <path d="M9.9 10a3 3 0 0 0 4.2 4.2" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button className="btn-primary login-submit" type="submit" disabled={busy}>
                {busy ? t('login.signingIn') : t('login.signIn')}
              </button>
            </form>

            <div className="login-audit-footer">
              <p>{t('login.auditNotice')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
