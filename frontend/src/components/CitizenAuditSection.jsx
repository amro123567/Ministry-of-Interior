import { useEffect, useState, useCallback } from 'react'
import client from '../api/client.js'
import AccessTypeBadge from './AccessTypeBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { tdCls, thCls } from '../ui.js'
import Pagination, { usePagination } from './Pagination.jsx'
import { fmtDate } from '../utils/dates.js'


// The two citizen-scoped audit views (CitizenAuditController) -- GET /api/audit/citizen/{id} (tier 2:
// field-level "what changed on this citizen, from what to what, why") and
// GET /api/audit/access/citizen/{id} (tier 3: "who read this citizen's
// record"). Both endpoints, like every /api/audit/** route, are gated by
// AUDIT_VIEW on the backend (SecurityConfig) -- this whole section is
// omitted (not just an inner action) for a viewer without it, since there
// is nothing behind either fetch they're allowed to see, unlike the
// CITIZEN_MANAGE-gated *edit* affordance on the lineage panel above,
// which still shows the read-only data underneath to everyone.
export default function CitizenAuditSection({ citizenId }) {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const [changes, setChanges] = useState([])
  const [access, setAccess] = useState([])
  const chg = usePagination(changes, 5)
  const acc = usePagination(access, 5)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const canView = hasPermission('AUDIT_VIEW')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      client.get(`/audit/citizen/${citizenId}`),
      client.get(`/audit/access/citizen/${citizenId}`),
    ])
      .then(([changesRes, accessRes]) => {
        setChanges(changesRes.data)
        setAccess(accessRes.data)
      })
      .catch(() => setError(t('citizenAudit.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [citizenId, t])

  useEffect(() => {
    if (canView) load()
  }, [canView, load])

  if (!canView) return null

  return (
    <div className="card p-5 mb-4">
      <h2 className="text-sm font-bold text-text-primary mb-4">{t('citizenAudit.title')}</h2>

      {error && (
        <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{error}</div>
      )}

      {!error && loading && <p className="text-sm text-text-secondary">{t('common.loading')}</p>}

      {!error && !loading && (
        <>
          <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2">{t('citizenAudit.changeHistory')}</h3>
          {changes.length === 0 ? (
            <p className="text-sm text-text-secondary mb-5">{t('citizenAudit.changeHistoryEmpty')}</p>
          ) : (
            <div className="overflow-x-auto mb-5">
              <table className="data-table">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className={thCls}>{t('citizenAudit.colField')}</th>
                    <th className={thCls}>{t('citizenAudit.colChange')}</th>
                    <th className={thCls}>{t('citizenAudit.colChangedBy')}</th>
                    <th className={thCls}>{t('citizenAudit.colWhen')}</th>
                    <th className={thCls}>{t('citizenAudit.colReason')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chg.pageItems.map((c) => (
                    <tr key={c.id}>
                      <td className={`${tdCls} font-semibold text-text-primary whitespace-nowrap`}>{c.fieldName}</td>
                      <td className={tdCls}>
                        <span className="text-text-secondary">{c.oldValue || '—'}</span>
                        <span className="mx-1.5 text-slate-400">{t('common.to')}</span>
                        <span className="text-text-primary">{c.newValue || '—'}</span>
                      </td>
                      <td className={`${tdCls} whitespace-nowrap`}>{c.changedByName}</td>
                      <td className={`${tdCls} text-text-secondary whitespace-nowrap`}>{fmtDate(c.changedAt, 'MMM d, yyyy HH:mm')}</td>
                      <td className={`${tdCls} text-text-secondary max-w-[220px] truncate`} title={c.reason ?? ''}>{c.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination sizes={[5, 10, 25]} className="mt-3" {...chg.pagination} />
            </div>
          )}

          <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-2 pt-4 border-t border-row-divider">{t('citizenAudit.accessHistory')}</h3>
          {access.length === 0 ? (
            <p className="text-sm text-text-secondary">{t('citizenAudit.accessHistoryEmpty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className={thCls}>{t('citizenAudit.colAccessedBy')}</th>
                    <th className={thCls}>{t('citizenAudit.colAccessType')}</th>
                    <th className={thCls}>{t('citizenAudit.colWhen')}</th>
                    <th className={thCls}>{t('citizenAudit.colReason')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {acc.pageItems.map((a) => (
                    <tr key={a.id}>
                      <td className={`${tdCls} font-semibold text-text-primary whitespace-nowrap`}>{a.accessedByName}</td>
                      <td className={tdCls}><AccessTypeBadge accessType={a.accessType} /></td>
                      <td className={`${tdCls} text-text-secondary whitespace-nowrap`}>{fmtDate(a.accessedAt, 'MMM d, yyyy HH:mm')}</td>
                      <td className={`${tdCls} text-text-secondary max-w-[220px] truncate`} title={a.reason ?? ''}>{a.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination sizes={[5, 10, 25]} className="mt-3" {...acc.pagination} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
