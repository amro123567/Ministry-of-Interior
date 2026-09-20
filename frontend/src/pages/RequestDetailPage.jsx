import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import client from '../api/client.js'
import StatusBadge, { SlaBadge, SlaRecordBadge } from '../components/StatusBadge.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const inputCls = 'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5'

// Permission codes match the backend's WorkflowTransitionRule.requiredPermission
// exactly (seeded in DataSeeder) -- this map used to carry a role name and
// special-case 'ADMIN' in every hasRole() check below; now it carries the
// same permission the backend checks, so ADMIN needs no special case here
// either (ADMIN is simply granted every permission).
const TRANSITIONS = {
  DRAFT: [{ to: 'SUBMITTED', label: 'Submit', permission: 'REQUEST_TRANSITION_SUBMIT' }],
  SUBMITTED: [{ to: 'UNDER_REVIEW', label: 'Start review', permission: 'REQUEST_TRANSITION_REVIEW' }],
  UNDER_REVIEW: [
    { to: 'APPROVED', label: 'Approve', permission: 'REQUEST_TRANSITION_DECIDE' },
    { to: 'REJECTED', label: 'Reject', permission: 'REQUEST_TRANSITION_DECIDE', needsReason: true },
  ],
  APPROVED: [{ to: 'ARCHIVED', label: 'Archive', permission: 'REQUEST_TRANSITION_ARCHIVE' }],
  REJECTED: [{ to: 'ARCHIVED', label: 'Archive', permission: 'REQUEST_TRANSITION_ARCHIVE' }],
  ARCHIVED: [],
}

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'WAIVED']

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</div>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  )
}

// The request detail page -- restyled to the same Tailwind conventions as
// every other screen (it was the last of two pages still on the pre-
// Tailwind CSS classes; see PROJECT_STATE's Item 6 discrepancy note) while
// adding this item's actual scope: a panel for the persisted SlaRecord
// snapshot and the request's payment history (RequestFinanceController,
// frontend integration pass Step 7). Every other section's behavior is
// unchanged from before this restyle.
export default function RequestDetailPage() {
  const { id } = useParams()
  const { hasPermission } = useAuth()
  const { t } = useLanguage()
  const [request, setRequest] = useState(null)
  const [history, setHistory] = useState([])
  const [assignments, setAssignments] = useState([])
  const [attachments, setAttachments] = useState([])
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [pendingReject, setPendingReject] = useState(false)
  const [assigneeId, setAssigneeId] = useState('')
  const [assignNote, setAssignNote] = useState('')

  // ---- SLA record & payments (Step 7) ----------------------------------
  const [slaRecord, setSlaRecord] = useState(null)
  const [payments, setPayments] = useState([])
  const [financeError, setFinanceError] = useState(null)
  const [slaBusy, setSlaBusy] = useState(false)
  const [addingPayment, setAddingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', currency: 'USD', method: 'CASH', receiptNumber: '' })
  const [paymentFormError, setPaymentFormError] = useState(null)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [reversingPaymentId, setReversingPaymentId] = useState(null)
  const [reversalReason, setReversalReason] = useState('')
  const [reverseBusy, setReverseBusy] = useState(false)

  const load = useCallback(() => {
    client.get(`/requests/${id}`).then((r) => setRequest(r.data))
    client.get(`/requests/${id}/history`).then((r) => setHistory(r.data))
    client.get(`/requests/${id}/assignments`).then((r) => setAssignments(r.data))
    client.get(`/requests/${id}/documents`).then((r) => setAttachments(r.data))
    // GET /api/sla-records/{id} lazily recomputes the snapshot from the
    // request's current state on every read (RequestFinanceService), so
    // this always reflects the latest status -- the "Refresh" button below
    // calls the dedicated POST .../refresh endpoint instead, mainly to
    // keep that endpoint genuinely wired to something in the UI.
    client.get(`/sla-records/${id}`).then((r) => setSlaRecord(r.data))
    client.get(`/requests/${id}/payments`).then((r) => setPayments(r.data))
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (hasPermission('USER_VIEW')) client.get('/users').then((r) => setUsers(r.data)) }, [hasPermission])

  async function doTransition(to, reason) {
    setBusy(true); setError(null)
    try {
      await client.patch(`/requests/${id}/transition`, { toStatus: to, rejectionReason: reason ?? null })
      setPendingReject(false); setRejectionReason('')
      load()
    } catch (err) {
      setError(err.response?.data?.message ?? t('requestDetail.transitionRefused'))
    } finally { setBusy(false) }
  }

  async function doAssign() {
    if (!assigneeId) return
    setBusy(true); setError(null)
    try {
      await client.patch(`/requests/${id}/assign`, { userId: Number(assigneeId), note: assignNote || null })
      setAssignNote('')
      load()
    } catch (err) {
      setError(err.response?.data?.message ?? t('requestDetail.assignFailed'))
    } finally { setBusy(false) }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const data = new FormData()
    data.append('file', file)
    setBusy(true); setError(null)
    try {
      await client.post(`/requests/${id}/documents`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
      load()
    } catch (err) {
      setError(err.response?.data?.message ?? t('requestDetail.uploadFailed'))
    } finally { setBusy(false); e.target.value = '' }
  }

  async function download(attachmentId, fileName) {
    const res = await client.get(`/documents/${attachmentId}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = fileName; a.click()
    URL.revokeObjectURL(url)
  }

  async function refreshSla() {
    setSlaBusy(true); setFinanceError(null)
    try {
      const r = await client.post(`/sla-records/${id}/refresh`)
      setSlaRecord(r.data)
    } catch (err) {
      setFinanceError(err.response?.data?.message ?? t('requestFinance.errorGeneric'))
    } finally {
      setSlaBusy(false)
    }
  }

  function startAddingPayment() {
    setPaymentForm({ amount: '', currency: 'USD', method: 'CASH', receiptNumber: '' })
    setPaymentFormError(null)
    setAddingPayment(true)
  }

  async function handleRecordPayment(e) {
    e.preventDefault()
    setPaymentFormError(null)
    const amountNum = Number(paymentForm.amount)
    if (!paymentForm.amount || Number.isNaN(amountNum) || amountNum <= 0) {
      setPaymentFormError(t('requestFinance.errorAmountRequired'))
      return
    }
    if (!paymentForm.currency.trim()) {
      setPaymentFormError(t('requestFinance.errorCurrencyRequired'))
      return
    }
    setPaymentBusy(true)
    try {
      await client.post('/payments', {
        requestId: Number(id),
        amount: amountNum,
        currency: paymentForm.currency.trim().toUpperCase(),
        method: paymentForm.method,
        receiptNumber: paymentForm.receiptNumber.trim() || null,
      })
      setAddingPayment(false)
      load()
    } catch (err) {
      setPaymentFormError(err.response?.data?.message ?? t('requestFinance.errorGeneric'))
    } finally {
      setPaymentBusy(false)
    }
  }

  function startReversing(paymentId) {
    setReversingPaymentId(paymentId)
    setReversalReason('')
    setFinanceError(null)
  }

  async function doReversePayment(paymentId) {
    if (!reversalReason.trim()) return
    setReverseBusy(true); setFinanceError(null)
    try {
      await client.patch(`/payments/${paymentId}/reverse`, { reversalReason: reversalReason.trim() })
      setReversingPaymentId(null); setReversalReason('')
      load()
    } catch (err) {
      setFinanceError(err.response?.data?.message ?? t('requestFinance.errorGeneric'))
    } finally {
      setReverseBusy(false)
    }
  }

  if (!request) return <p className="text-sm text-slate-400">{t('common.loading')}</p>

  const available = (TRANSITIONS[request.status] ?? []).filter((tr) => hasPermission(tr.permission))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-xl font-bold text-slate-900">{request.referenceNumber}</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={request.status} />
          <SlaBadge slaStatus={request.slaStatus} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4" role="alert">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <h2 className="text-sm font-bold text-slate-900 mb-4">{t('requestDetail.details')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <Field label={t('requestDetail.citizen')}>{request.citizen.firstNameEn} {request.citizen.lastNameEn} ({request.citizen.registryNumber})</Field>
          <Field label={t('requestDetail.documentType')}>{request.documentType.nameEn}</Field>
          <Field label={t('requestDetail.office')}>{request.office.nameEn}</Field>
          <Field label={t('requestDetail.priority')}>{request.priority}</Field>
          <Field label={t('requestDetail.assignedTo')}>{request.assignedToName ?? '—'}</Field>
          <Field label={t('requestDetail.createdBy')}>{request.createdByName}</Field>
          <Field label={t('requestDetail.due')}>{request.dueAt ? format(new Date(request.dueAt), 'MMM d, yyyy p') : '—'}</Field>
          {request.rejectionReason && <Field label={t('requestDetail.rejectionReason')}>{request.rejectionReason}</Field>}
          {request.notes && <Field label={t('requestDetail.notes')}>{request.notes}</Field>}
        </div>

        {available.length > 0 && (
          <div className="flex flex-wrap gap-2.5 mb-2">
            {available.map((tr) =>
              tr.needsReason ? (
                <button key={tr.to} type="button" disabled={busy} onClick={() => setPendingReject(true)}
                        className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                  {t(`workflow.${tr.label}`, tr.label)}
                </button>
              ) : (
                <button key={tr.to} type="button" disabled={busy} onClick={() => doTransition(tr.to)}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                  {t(`workflow.${tr.label}`, tr.label)}
                </button>
              ))}
          </div>
        )}
        {pendingReject && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-2">
            <label className={labelCls} htmlFor="rd-reject-reason">{t('requestDetail.rejectionReason')}</label>
            <input id="rd-reject-reason" className={inputCls} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
            <div className="flex justify-end mt-2">
              <button type="button" className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                      disabled={!rejectionReason || busy} onClick={() => doTransition('REJECTED', rejectionReason)}>
                {t('requestDetail.confirmRejection')}
              </button>
            </div>
          </div>
        )}

        {hasPermission('USER_VIEW') && (
          <div className="rounded-lg border border-slate-200 p-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              <div>
                <label className={labelCls} htmlFor="rd-reassign">{t('requestDetail.reassignTo')}</label>
                <select id="rd-reassign" className={inputCls} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">{t('requestDetail.selectUser')}</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.roles.join(',')})</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="rd-assign-note">{t('requestDetail.noteOptional')}</label>
                <input id="rd-assign-note" className={inputCls} value={assignNote} onChange={(e) => setAssignNote(e.target.value)} />
              </div>
            </div>
            <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                    disabled={!assigneeId || busy} onClick={doAssign}>
              {t('requestDetail.assign')}
            </button>
          </div>
        )}
      </div>

      {/* ---- SLA & payments (Step 7) ---- */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{t('requestFinance.title')}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t('requestFinance.subtitle')}</p>
          </div>
          <button type="button" onClick={refreshSla} disabled={slaBusy}
                  className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 whitespace-nowrap">
            {slaBusy ? t('requestFinance.refreshing') : t('requestFinance.refresh')}
          </button>
        </div>

        {financeError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4" role="alert">{financeError}</div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <Field label={t('requestFinance.slaStatus')}><SlaRecordBadge slaStatus={slaRecord?.slaStatus} /></Field>
          <Field label={t('requestFinance.dueDate')}>{slaRecord?.dueDate ? format(new Date(slaRecord.dueDate), 'MMM d, yyyy') : '—'}</Field>
          <Field label={t('requestFinance.daysRemaining')}>{slaRecord?.daysRemaining ?? '—'}</Field>
          <Field label={t('requestFinance.overdueByDays')}>{slaRecord?.overdueByDays ?? '—'}</Field>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('requestFinance.paymentsTitle')}</h3>
            {!addingPayment && hasPermission('PAYMENT_RECORD') && (
              <button type="button" onClick={startAddingPayment} className="text-sm font-semibold text-indigo-600 hover:underline">
                {t('requestFinance.recordPayment')}
              </button>
            )}
          </div>

          {addingPayment && (
            <form onSubmit={handleRecordPayment} className="rounded-lg border border-slate-200 p-4 mb-4">
              {paymentFormError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4" role="alert">{paymentFormError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelCls} htmlFor="pf-amount">
                    {t('requestFinance.amount')} <span className="text-red-500">*</span>
                  </label>
                  <input id="pf-amount" type="number" step="0.01" min="0.01" className={inputCls}
                         value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="pf-currency">
                    {t('requestFinance.currency')} <span className="text-red-500">*</span>
                  </label>
                  <input id="pf-currency" className={inputCls} maxLength={3}
                         value={paymentForm.currency} onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="pf-method">{t('requestFinance.method')}</label>
                  <select id="pf-method" className={inputCls} value={paymentForm.method}
                          onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`paymentMethod.${m}`, m)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="pf-receipt">{t('requestFinance.receiptNumber')}</label>
                  <input id="pf-receipt" className={inputCls}
                         value={paymentForm.receiptNumber} onChange={(e) => setPaymentForm({ ...paymentForm, receiptNumber: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2.5">
                <button type="button" onClick={() => setAddingPayment(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={paymentBusy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                  {paymentBusy ? t('requestFinance.submitting') : t('requestFinance.submit')}
                </button>
              </div>
            </form>
          )}

          {payments.length === 0 ? (
            <p className="text-sm text-slate-400">{t('requestFinance.noPayments')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{p.amount} {p.currency}</span>
                      <span className="text-xs font-mono text-slate-400">{t(`paymentMethod.${p.method}`, p.method)}</span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                    {p.status === 'PAID' && hasPermission('PAYMENT_REVERSE') && (
                      <button type="button" onClick={() => startReversing(p.id)}
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                        {t('requestFinance.reverse')}
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {p.receiptNumber && <>{t('requestFinance.receiptNumber')}: {p.receiptNumber} · </>}
                    {p.collectedByName && <>{t('requestFinance.collectedBy')} {p.collectedByName} · </>}
                    {format(new Date(p.paidAt), 'MMM d, yyyy p')}
                  </div>
                  {p.status === 'REVERSED' && (
                    <div className="text-xs text-rose-600 mt-1">
                      {t('requestFinance.reversedBy')} {p.reversedByName} · {format(new Date(p.reversedAt), 'MMM d, yyyy p')}
                      {p.reversalReason && ` — ${p.reversalReason}`}
                    </div>
                  )}
                  {reversingPaymentId === p.id && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mt-2">
                      <label className={labelCls} htmlFor={`pf-reverse-reason-${p.id}`}>{t('requestFinance.reversalReason')}</label>
                      <input id={`pf-reverse-reason-${p.id}`} className={inputCls} value={reversalReason} onChange={(e) => setReversalReason(e.target.value)} />
                      <div className="flex justify-end gap-2 mt-2">
                        <button type="button" onClick={() => setReversingPaymentId(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          {t('common.cancel')}
                        </button>
                        <button type="button" disabled={!reversalReason.trim() || reverseBusy} onClick={() => doReversePayment(p.id)}
                                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                          {t('requestFinance.confirmReversal')}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <h2 className="text-sm font-bold text-slate-900 mb-4">{t('requestDetail.documents')}</h2>
        <label className="inline-flex cursor-pointer items-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 mb-4">
          {t('requestDetail.uploadDocument')}
          <input type="file" onChange={handleUpload} className="hidden" />
        </label>
        {attachments.length === 0 ? <p className="text-sm text-slate-400">{t('requestDetail.noDocuments')}</p> : (
          <ul className="divide-y divide-slate-100">
            {attachments.map((a) => (
              <li key={a.id} className="py-3">
                <button type="button" className="text-sm font-semibold text-indigo-600 hover:underline" onClick={() => download(a.id, a.fileName)}>{a.fileName}</button>
                <div className="text-xs text-slate-400 mt-0.5">{(a.sizeBytes / 1024).toFixed(1)} KB · SHA-256 {a.sha256.slice(0, 12)}… · {a.uploadedByName}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <h2 className="text-sm font-bold text-slate-900 mb-4">{t('requestDetail.assignmentHistory')}</h2>
        {assignments.length === 0 ? <p className="text-sm text-slate-400">{t('requestDetail.neverAssigned')}</p> : (
          <ul className="divide-y divide-slate-100">
            {assignments.map((a) => (
              <li key={a.id} className="py-3">
                <div className="text-sm font-semibold text-slate-900">{t('requestDetail.assignedToLabel')} {a.assignedToName}</div>
                <div className="text-xs text-slate-400 mt-0.5">{a.assignedByName} · {format(new Date(a.assignedAt), 'MMM d, yyyy p')}</div>
                {a.note && <div className="text-sm text-slate-600 mt-1">{a.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4">{t('requestDetail.auditTrail')}</h2>
        <ul className="divide-y divide-slate-100">
          {history.map((h) => (
            <li key={h.id} className="py-3">
              <div className="text-sm font-semibold text-slate-900">
                {h.fromStatus ? `${t(`status.${h.fromStatus}`, h.fromStatus)} → ${t(`status.${h.toStatus}`, h.toStatus)}` : `${t('requestDetail.created')} (${t(`status.${h.toStatus}`, h.toStatus)})`}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{h.changedByName} · {format(new Date(h.changedAt), 'MMM d, yyyy p')}</div>
              {h.note && <div className="text-sm text-slate-600 mt-1">{h.note}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
