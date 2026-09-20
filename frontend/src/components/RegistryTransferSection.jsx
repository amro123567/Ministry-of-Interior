import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import client from '../api/client.js'
import ApprovalStatusBadge from './ApprovalStatusBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const inputCls = 'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5'

// Requesting a transfer is CITIZEN_MANAGE; *deciding* one needs the
// separate CITIZEN_REGISTRY_DECIDE authority (SecurityConfig), which also
// backs the service layer's own SI-12 rule that the decider can't be the
// requester -- the permission gate and the business rule are independent
// checks, so a manager who requested a transfer still can't approve that
// specific one even though they hold CITIZEN_REGISTRY_DECIDE.
//
// Approving moves the citizen's registered office on the backend, so
// `onDecided` lets the parent page refresh the citizen record and pick up
// the new office name shown elsewhere on the page.
//
// CitizenDto only ever carries officeName (not an id), so the destination
// picker excludes the current office by name rather than id -- a purely
// cosmetic filter; the backend is what actually enforces "can't transfer
// to the same office" (CitizenRegistryService.requestTransfer()) and its
// rejection message would surface here regardless.
export default function RegistryTransferSection({ citizenId, currentOfficeName, onDecided }) {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [requesting, setRequesting] = useState(false)
  const [offices, setOffices] = useState([])
  const [toOfficeId, setToOfficeId] = useState('')
  const [transferDate, setTransferDate] = useState('')
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [decidingId, setDecidingId] = useState(null)
  const [decisionReference, setDecisionReference] = useState('')

  const canDecide = hasPermission('CITIZEN_REGISTRY_DECIDE')

  const load = useCallback(() => {
    setLoading(true)
    client.get(`/citizens/${citizenId}/registry-transfers`)
      .then((r) => setTransfers(r.data))
      .catch(() => setError(t('registryTransfer.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [citizenId, t])

  useEffect(() => { load() }, [load])

  function startRequesting() {
    setToOfficeId('')
    setTransferDate('')
    setFormError(null)
    setRequesting(true)
    if (offices.length === 0) client.get('/offices').then((r) => setOffices(r.data))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    if (!toOfficeId) {
      setFormError(t('registryTransfer.errorRequired'))
      return
    }
    setBusy(true)
    try {
      await client.post('/registry-transfers', {
        citizenId: Number(citizenId),
        toOfficeId: Number(toOfficeId),
        transferDate: transferDate || null,
      })
      setRequesting(false)
      load()
    } catch (err) {
      setFormError(err.response?.data?.message ?? t('registryTransfer.errorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  async function decide(id, decision) {
    setBusy(true); setError(null)
    try {
      await client.patch(`/registry-transfers/${id}/decide`, { decision, decisionReference: decisionReference || null })
      setDecidingId(null)
      setDecisionReference('')
      load()
      if (decision === 'APPROVE') onDecided?.()
    } catch (err) {
      setError(err.response?.data?.message ?? t('registryTransfer.decideErrorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-900">{t('registryTransfer.title')}</h2>
        {!requesting && hasPermission('CITIZEN_MANAGE') && (
          <button type="button" onClick={startRequesting} className="text-sm font-semibold text-indigo-600 hover:underline">
            {t('registryTransfer.request')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4" role="alert">{error}</div>
      )}

      {requesting && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 p-4 mb-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4" role="alert">{formError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelCls} htmlFor="t-office">{t('registryTransfer.toOffice')}</label>
              <select id="t-office" className={inputCls} value={toOfficeId} onChange={(e) => setToOfficeId(e.target.value)}>
                <option value="">{t('common.select')}</option>
                {offices.filter((o) => o.nameEn !== currentOfficeName).map((o) => <option key={o.id} value={o.id}>{o.nameEn}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="t-date">{t('registryTransfer.transferDate')}</label>
              <input id="t-date" type="date" className={inputCls} value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setRequesting(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {busy ? t('registryTransfer.submitting') : t('registryTransfer.submit')}
            </button>
          </div>
        </form>
      )}

      {!loading && transfers.length === 0 ? (
        <p className="text-sm text-slate-400">{t('registryTransfer.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {transfers.map((tr) => (
            <li key={tr.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-slate-800">{tr.fromOfficeName ?? '—'} → {tr.toOfficeName}</span>
                <ApprovalStatusBadge status={tr.status} />
              </div>
              <div className="text-xs text-slate-400">
                {t('registryTransfer.colRequestedBy')}: {tr.requestedByName}
                {tr.approvedByName && ` · ${tr.approvedByName} (${tr.status === 'APPROVED' ? t('approvalStatus.APPROVED') : t('approvalStatus.REJECTED')})`}
                {tr.decisionReference && ` · ${tr.decisionReference}`}
              </div>
              {tr.status === 'PENDING' && canDecide && (
                decidingId === tr.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      className={`${inputCls} flex-1 min-w-[160px]`}
                      placeholder={t('registryTransfer.decisionReference')}
                      value={decisionReference}
                      onChange={(e) => setDecisionReference(e.target.value)}
                    />
                    <button type="button" disabled={busy} onClick={() => decide(tr.id, 'APPROVE')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                      {t('registryTransfer.approve')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => decide(tr.id, 'REJECT')} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                      {t('registryTransfer.reject')}
                    </button>
                    <button type="button" onClick={() => { setDecidingId(null); setDecisionReference('') }} className="text-xs font-semibold text-slate-500 hover:underline">
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDecidingId(tr.id)} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">
                    {t('registryTransfer.decide')}
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
