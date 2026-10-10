import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { translations } from '../i18n/translations.js'

export default function LoginPage() {
  const { login, user } = useAuth()
  const { t } = useLanguage()
  // This page is always bilingual (English primary, Arabic secondary) and
  // does not depend on the app language toggle.
    const en = translations.en.login
  const ar = translations.ar.login
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

  const inputCls =
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1E2D50] focus:ring-4 focus:ring-[#1E2D50]/15'

  return (
    <div dir="ltr" className="flex min-h-screen items-center justify-center bg-[#EEF2F8] px-4 py-10 font-sans">
      <div className="grid w-full max-w-[1040px] overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] md:grid-cols-[1.05fr_1fr]">
        {/* Brand panel — always bilingual */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#10283f] via-[#0d3470] to-[#0a47a8] p-8 text-white sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -end-24 h-72 w-72 rounded-full bg-white/5" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-16 -start-16 h-56 w-56 rounded-full bg-white/5" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <svg aria-hidden="true" viewBox="0 0 90 60" className="h-8 w-12 rounded-[3px] shadow ring-1 ring-white/30">
                <rect width="90" height="60" fill="#fff" />
                <rect width="90" height="15" fill="#ED1C24" />
                <rect y="45" width="90" height="15" fill="#ED1C24" />
                <g fill="#00A651">
                  <polygon points="45,15 51,25 47,25 54,34 49,34 57,43 33,43 41,34 36,34 43,25 39,25" />
                  <rect x="43.5" y="43" width="3" height="3" />
                </g>
              </svg>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">{en.republic}</span>
            </div>

            <img src="/cts-logo.png" alt="Ministry of Interior and Municipalities seal" className="mt-8 h-24 w-auto drop-shadow-lg" />

            <h1 className="mt-6 text-3xl font-extrabold leading-tight text-[#F6C945]" lang="ar" dir="rtl">{ar.ministry}</h1>
            <p className="mt-2 text-lg font-semibold uppercase leading-snug tracking-wide text-white" lang="en" dir="ltr">{en.ministry}</p>

            <div className="my-6 h-px w-24 bg-gradient-to-r from-[#F6C945] to-transparent" />

            <p className="text-lg font-semibold leading-snug" lang="ar" dir="rtl">{ar.directorate}</p>
            <p className="mt-1 text-sm text-white/80" lang="en" dir="ltr">{en.directorate}</p>
            <p className="mt-4 text-base font-semibold" lang="ar" dir="rtl">{ar.system}</p>
            <p className="mt-0.5 text-sm text-white/80" lang="en" dir="ltr">{en.system}</p>
          </div>

          <div className="relative mt-10 flex items-start gap-2 border-t border-white/15 pt-4 text-xs text-white/75">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            <div>
              <p lang="ar" dir="rtl">{ar.internalNotice}</p>
              <p lang="en" dir="ltr">{en.internalNotice}</p>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex items-center p-8 sm:p-12">
          <div className="w-full">
            <h2 className="text-2xl font-bold text-slate-900">{en.staffSignIn}</h2>
            <p lang="ar" dir="rtl" className="mt-1 text-lg font-bold text-slate-500">{ar.staffSignIn}</p>
            <p className="mt-3 text-sm text-slate-600">{en.hint}</p>
            <p lang="ar" dir="rtl" className="mt-1 text-xs text-slate-400">{ar.hint}</p>

            {location.state?.loggedOut && !error && (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">{t('login.loggedOut')}</div>
            )}
            {error && <div className="alert alert-error mt-5">{error}</div>}

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="login-username">{en.username}</label>
                  <span aria-hidden="true" lang="ar" dir="rtl" className="text-xs text-slate-400">{ar.username}</span>
                </div>
                <input
                  id="login-username"
                  className={inputCls}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={en.usernamePlaceholder}
                  autoFocus
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="login-password">{en.password}</label>
                  <span aria-hidden="true" lang="ar" dir="rtl" className="text-xs text-slate-400">{ar.password}</span>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    className={`${inputCls} pe-12`}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-slate-800"
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

              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E2D50] px-4 py-3.5 text-[15px] font-bold text-white shadow-md transition hover:bg-[#263a66] focus:outline-none focus:ring-4 focus:ring-[#1E2D50]/30 disabled:opacity-60"
                type="submit"
                disabled={busy}
                aria-label={busy ? en.signingIn : en.signIn}
              >
                <span>{busy ? en.signingIn : en.signIn}</span>
                <span aria-hidden="true" lang="ar" className="text-sm font-medium text-white/70">· {busy ? ar.signingIn : ar.signIn}</span>
              </button>
            </form>

            <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
              <p>{en.auditNotice}</p>
              <p lang="ar" dir="rtl" className="mt-0.5 text-slate-400">{ar.auditNotice}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
