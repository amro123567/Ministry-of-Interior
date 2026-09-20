import { useEffect, useState, useCallback } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import client from '../api/client.js'
import AccessTypeBadge from '../components/AccessTypeBadge.jsx'
import LoginAttemptBadge from '../components/LoginAttemptBadge.jsx'
import { SkeletonLine } from '../components/Skeleton.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const thCls = 'text-start text-[11px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 border-b border-slate-200'
const tdCls = 'px-4 py-3.5 text-sm text-slate-700'

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
      <h2 className="text-sm font-bold text-slate-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

// The "what has this employee been doing" screen -- reached only from a
// link on AdminUsersPage, never from the Navbar (frontend integration
// pass Step 8, same zero-slack-nav constraint as CitizenAuditSection and
// AuditLogPage's new tab). Surfaces the 3 employee-scoped reads that Item
// 7's session hardening and Item 6's audit domain added:
// GET /api/audit/login-attempts?username= (this user's own sign-in
// history -- the only one of the three keyed by username, not id, since
// LoginAttempt is recorded before a userId can always be resolved -- see
// LoginAttemptDto's own nullable userId), GET /api/audit/sessions/user/{id}
// (this user's session log) and GET /api/audit/access/user/{id} (every
// citizen record this user has read). All three endpoints, like every
// /api/audit/** route, require AUDIT_VIEW on the backend -- that's this
// route's own permissions gate in App.jsx, not USER_MANAGE (which governs
// AdminUsersPage itself), matching the "gate a route exactly as tight as
// the API actually is" rule this migration has followed throughout.
//
// There's no GET /api/users/{id} on the backend (UserController only
// exposes list-all and create -- see AdminUsersPage's own note), so the
// username/fullName shown in the header come from router state passed by
// the "View activity" link and fall back to a lookup against the same
// GET /api/users list AdminUsersPage already uses, for a direct visit or
// a page refresh where that state isn't available.
export default function UserActivityPage() {
  const { t } = useLanguage()
  const { id } = useParams()
  const location = useLocation()
  const [identity, setIdentity] = useState(location.state ?? null)
  const [attempts, setAttempts] = useState([])
  const [sessions, setSessions] = useState([])
  const [access, setAccess] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadIdentity = useCallback(() => {
    if (identity?.username) return Promise.resolve()
    return client.get('/users').then((r) => {
      const match = r.data.find((u) => String(u.id) === String(id))
      setIdentity(match ? { username: match.username, fullName: match.fullName } : { username: null, fullName: null })
    })
  }, [id, identity])

  useEffect(() => {
    setLoading(true)
    setError(null)
    loadIdentity()
      .then(() => Promise.all([
        client.get('/audit/sessions/user/' + id),
        client.get('/audit/access/user/' + id),
      ]))
      .then(([sessionsRes, accessRes]) => {
        setSessions(sessionsRes.data)
        setAccess(accessRes.data)
      })
      .catch(() => setError(t('userActivity.couldNotLoad')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Login attempts are keyed by username, resolved only once identity is
  // known -- fetched separately so a slow/failed identity lookup doesn't
  // block the two id-keyed requests above.
  useEffect(() => {
    if (!identity?.username) return
    client.get('/audit/login-attempts', { params: { username: identity.username } })
      .then((r) => setAttempts(r.data))
      .catch(() => { /* surfaced via the shared error state only if everything fails */ })
  }, [identity])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <SkeletonLine width="40%" height={22} className="mb-3" />
        <SkeletonLine width="60%" height={14} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">{error}</div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">{identity?.fullName || identity?.username || `#${id}`}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {identity?.username ? `@${identity.username}` : ''} · {t('userActivity.subtitle')}
        </p>
      </div>

      <Card title={t('userActivity.loginAttempts')}>
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-400">{t('userActivity.loginAttemptsEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>{t('auditLog.loginColTime')}</th>
                  <th className={thCls}>{t('auditLog.loginColOutcome')}</th>
                  <th className={thCls}>{t('auditLog.loginColIp')}</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0">
                    <td className={`${tdCls} whitespace-nowrap`}>{format(new Date(a.attemptedAt), 'MMM d, yyyy HH:mm:ss')}</td>
                    <td className={tdCls}><LoginAttemptBadge wasSuccessful={a.wasSuccessful} failureReason={a.failureReason} /></td>
                    <td className={`${tdCls} whitespace-nowrap`}>{a.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('userActivity.sessions')}>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-400">{t('userActivity.sessionsEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>{t('userActivity.colLoginAt')}</th>
                  <th className={thCls}>{t('userActivity.colLogoutAt')}</th>
                  <th className={thCls}>{t('userActivity.colExpiresAt')}</th>
                  <th className={thCls}>{t('auditLog.loginColIp')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className={`${tdCls} whitespace-nowrap`}>{format(new Date(s.loginAt), 'MMM d, yyyy HH:mm:ss')}</td>
                    <td className={`${tdCls} whitespace-nowrap`}>
                      {s.logoutAt ? format(new Date(s.logoutAt), 'MMM d, yyyy HH:mm:ss') : (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          {t('userActivity.stillActive')}
                        </span>
                      )}
                    </td>
                    <td className={`${tdCls} text-slate-500 whitespace-nowrap`}>{format(new Date(s.expiresAt), 'MMM d, yyyy HH:mm:ss')}</td>
                    <td className={`${tdCls} whitespace-nowrap`}>{s.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('userActivity.accessHistory')}>
        {access.length === 0 ? (
          <p className="text-sm text-slate-400">{t('userActivity.accessHistoryEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>{t('userActivity.colCitizen')}</th>
                  <th className={thCls}>{t('citizenAudit.colAccessType')}</th>
                  <th className={thCls}>{t('citizenAudit.colWhen')}</th>
                  <th className={thCls}>{t('citizenAudit.colReason')}</th>
                </tr>
              </thead>
              <tbody>
                {access.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0">
                    <td className={`${tdCls} whitespace-nowrap`}>
                      <Link to={`/citizens/${a.citizenId}`} className="font-semibold text-indigo-600 hover:underline">
                        {a.citizenRegistryNumber}
                      </Link>
                    </td>
                    <td className={tdCls}><AccessTypeBadge accessType={a.accessType} /></td>
                    <td className={`${tdCls} text-slate-500 whitespace-nowrap`}>{format(new Date(a.accessedAt), 'MMM d, yyyy HH:mm')}</td>
                    <td className={`${tdCls} text-slate-500 max-w-[240px] truncate`} title={a.reason ?? ''}>{a.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
