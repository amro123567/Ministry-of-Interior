import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client.js'
import { apiErrorMessage } from '../api/errors.js'
import StatusBadge, { SlaBadge, SlaRecordBadge } from '../components/StatusBadge.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { inputCls, labelCls } from '../ui.js'
import { fmtDate } from '../utils/dates.js'
import { downloadFile } from '../api/download.js'


// The status changes offered on this page come from the backend (GET /requests/{id}/transitions),
// which reads the workflow catalog and filters it by the signed-in user's permissions.

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'WAIVED']

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary mb-1">{label}</div>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  )
}

// Visual progress of the request through its lifecycle. REJECTED and
// APPROVED share the "decision" step; the label shows whichever applies.
const LIFECYCLE = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DECISION', 'ARCHIVED']

function Stepper({ status, wasRejected, t }) {
  // An archived request keeps the decision it was archived with, so a rejected one must not read "Approved".
  const rejectedOutcome = status === 'REJECTED' || (status === 'ARCHIVED' && wasRejected)
  const current = ['APPROVED', 'REJECTED'].includes(status) ? 3 : LIFECYCLE.indexOf(status)
  return (
    <ol className="flex items-center" aria-label={t('requestDetail.progress')}>
      {LIFECYCLE.map((step, i) => {
        const done = i < current
        const active = i === current
        const rejected = step === 'DECISION' && rejectedOutcome
        const label = step === 'DECISION' ? t(`status.${rejectedOutcome ? 'REJECTED' : 'APPROVED'}`) : t(`status.${step}`, step)
        const dot = rejected && active ? 'bg-badge-danger-fg text-white'
          : active ? 'bg-primary text-white'
          : done ? 'bg-badge-success-fg text-white' : 'bg-border-subtle text-text-secondary'
        return (
          <li key={step} className={`flex items-center ${i < LIFECYCLE.length - 1 ? 'flex-1' : ''}`} aria-current={active ? 'step' : undefined}>
            <div className="flex flex-col items-center gap-1.5 min-w-[64px]">
              <span className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${dot}`}>{done ? '✓' : i + 1}</span>
              <span className={`text-[11px] text-center leading-tight ${active ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>{label}</span>
            </div>
            {i < LIFECYCLE.length - 1 && <div className={`h-0.5 flex-1 mx-1 mb-5 ${done ? 'bg-badge-success-fg' : 'bg-border-subtle'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

// The request detail page: request data, workflow actions, assignment,
// documents, history, and a panel for the persisted SLA record and the
// request's payment history (RequestFinanceController).
// The backend refuses to assign a closed request, so the form is not offered for one.
const CLOSED_STATUSES = ['APPROVED', 'REJECTED', 'ARCHIVED']

export default function RequestDetailPage() {
  const { id } = useParams()
  const { hasPermission } = useAuth()
  const { t } = useLanguage()
  const [request, setRequest] = useState(null)
  const [history, setHistory] = useState([])
  const [auditEntries, setAuditEntries] = useState([])
  const [nextTransitions, setNextTransitions] = useState([])
  const [pendingTo, setPendingTo] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [attachments, setAttachments] = useState([])
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('details')
  const [rejectionReason, setRejectionReason] = useState('')
  const [pendingReject, setPendingReject] = useState(false)
  const [assigneeId, setAssigneeId] = useState('')
  const [assignNote, setAssignNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [editOptions, setEditOptions] = useState({ documentTypes: [], offices: [], departments: [] })

  // ---- SLA record & payments ----
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

  const [loadError, setLoadError] = useState(null)
  const load = useCallback(() => {
    setLoadError(null)
    client.get(`/requests/${id}`).then((r) => setRequest(r.data)).catch((err) => setLoadError(apiErrorMessage(err, t('requestDetail.couldNotLoad'), t)))
    client.get(`/requests/${id}/history`).then((r) => setHistory(r.data)).catch(() => {})
    client.get(`/requests/${id}/transitions`).then((r) => setNextTransitions(r.data)).catch(() => setNextTransitions([]))
    client.get(`/requests/${id}/audit`).then((r) => setAuditEntries(r.data)).catch(() => setAuditEntries([]))
    client.get(`/requests/${id}/assignments`).then((r) => setAssignments(r.data)).catch(() => {})
    client.get(`/requests/${id}/documents`).then((r) => setAttachments(r.data)).catch(() => {})
    // GET /api/sla-records/{id} lazily recomputes the snapshot from the
    // request's current state on every read (RequestFinanceService), so
    // this always reflects the latest status -- the "Refresh" button below
    // calls the dedicated POST .../refresh endpoint instead, mainly to
    // keep that endpoint genuinely wired to something in the UI.
    client.get(`/sla-records/${id}`).then((r) => setSlaRecord(r.data)).catch(() => {})
    client.get(`/requests/${id}/payments`).then((r) => setPayments(r.data)).catch(() => {})
  }, [id, t])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (hasPermission('REQUEST_ASSIGN') && hasPermission('USER_VIEW')) client.get('/users').then((r) => setUsers(r.data)).catch(() => setUsers([])) }, [hasPermission])

  async function doTransition(to, reason) {
    setBusy(true); setError(null)
    try {
      await client.patch(`/requests/${id}/transition`, { toStatus: to, rejectionReason: to === 'REJECTED' ? (reason ?? null) : null, note: reason ?? null })
      setPendingReject(false); setPendingTo(null); setRejectionReason('')
      load()
    } catch (err) {
      setError(apiErrorMessage(err, t('requestDetail.transitionRefused'), t))
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
      setError(apiErrorMessage(err, t('requestDetail.assignFailed'), t))
    } finally { setBusy(false) }
  }

  const canEditDraft = hasPermission('REQUEST_CREATE')

  function startEditing() {
    setError(null)
    setEditForm({
      documentTypeId: String(request.documentType.id),
      officeId: String(request.office.id),
      departmentId: request.departmentId ? String(request.departmentId) : '',
      direction: request.direction || 'INCOMING',
      priority: request.priority || 'NORMAL',
      subject: request.subject || '',
      notes: request.notes || '',
    })
    Promise.all([
      client.get('/document-types').then((r) => r.data).catch(() => []),
      client.get('/offices').then((r) => r.data).catch(() => []),
      client.get('/departments').then((r) => r.data.filter((d) => d.active !== false)).catch(() => []),
    ]).then(([documentTypes, offices, departments]) => setEditOptions({ documentTypes, offices, departments }))
    setEditing(true)
  }

  async function saveDraft(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await client.put(`/requests/${id}`, {
        citizenId: request.citizen.id,
        documentTypeId: Number(editForm.documentTypeId),
        officeId: Number(editForm.officeId),
        departmentId: editForm.departmentId ? Number(editForm.departmentId) : null,
        direction: editForm.direction,
        priority: editForm.priority,
        subject: editForm.subject.trim() || null,
        notes: editForm.notes.trim() || null,
      })
      setEditing(false)
      load()
    } catch (err) {
      setError(apiErrorMessage(err, t('requestDetail.editFailed', 'Could not save the changes.'), t))
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
      setError(apiErrorMessage(err, t('requestDetail.uploadFailed'), t))
    } finally { setBusy(false); e.target.value = '' }
  }

  async function download(attachmentId, fileName) {
    try {
      await downloadFile(`/documents/${attachmentId}/download`, undefined, fileName)
    } catch (err) {
      setError(apiErrorMessage(err, t('requestDetail.downloadFailed', 'Could not download the file.'), t))
    }
  }

  async function refreshSla() {
    setSlaBusy(true); setFinanceError(null)
    try {
      const r = await client.post(`/sla-records/${id}/refresh`)
      setSlaRecord(r.data)
    } catch (err) {
      setFinanceError(apiErrorMessage(err, t('requestFinance.errorGeneric'), t))
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
      setPaymentFormError(apiErrorMessage(err, t('requestFinance.errorGeneric'), t))
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
      setFinanceError(apiErrorMessage(err, t('requestFinance.errorGeneric'), t))
    } finally {
      setReverseBusy(false)
    }
  }

  if (loadError && !request) {
    return <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg" role="alert">{loadError}</div>
  }
  if (!request) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>

  const available = nextTransitions.map((tr) => ({
    to: tr.toStatus,
    label: tr.labelEn ?? tr.actionCode,
    needsReason: tr.requiresComment || tr.toStatus === 'REJECTED',
    destructive: tr.toStatus === 'REJECTED',
  }))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-xl font-bold text-text-primary">{request.referenceNumber}</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={request.status} />
          <SlaBadge slaStatus={request.slaStatus} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{error}</div>
      )}

      <div className="card p-5 mb-4">
        <Stepper status={request.status} wasRejected={Boolean(request.rejectionReason) || history.some((h) => h.toStatus === 'REJECTED')} t={t} />
        <div className={available.length > 0 || pendingReject ? 'mt-4 pt-4 border-t border-row-divider' : 'hidden'}>
        {available.length > 0 && (
          <div className="flex flex-wrap gap-2.5 mb-0">
            {available.map((tr) =>
              tr.needsReason ? (
                <button key={tr.to} type="button" disabled={busy} onClick={() => { setPendingTo(tr.to); setPendingReject(true) }}
                        className={`${tr.destructive ? 'btn-danger' : 'btn-primary'}`}>
                  {t(`workflow.${tr.label}`, tr.label)}
                </button>
              ) : (
                <button key={tr.to} type="button" disabled={busy} onClick={() => doTransition(tr.to)}
                        className="btn-primary ">
                  {t(`workflow.${tr.label}`, tr.label)}
                </button>
              ))}
          </div>
        )}
        {pendingReject && (
          <div className="rounded-lg border border-badge-warning-bd bg-badge-warning-bg p-3 mb-0">
            <label className={labelCls} htmlFor="rd-reject-reason">{t('requestDetail.rejectionReason')}</label>
            <input id="rd-reject-reason" className={inputCls} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
            <div className="flex justify-end mt-2">
              <button type="button" className="btn-danger "
                      disabled={!rejectionReason || busy} onClick={() => doTransition(pendingTo ?? 'REJECTED', rejectionReason)}>
                {t('requestDetail.confirmRejection')}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      <div role="tablist" aria-label={t('requestDetail.sections')} className="flex gap-1 border-b border-border-subtle mb-4 overflow-x-auto overflow-y-hidden">
        {[
          ['details', t('requestDetail.tabDetails')],
          ['finance', t('requestFinance.title')],
          ['attachments', `${t('requestDetail.documents')} (${attachments.length})`],
          ['history', t('requestDetail.tabHistory')],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-text-primary">{t('requestDetail.details')}</h2>
          {request.status === 'DRAFT' && canEditDraft && !editing && (
            <button type="button" className="btn-primary" onClick={startEditing}>{t('requestDetail.editDraft', 'Edit draft')}</button>
          )}
        </div>
        {editing && editForm && request.status === 'DRAFT' && (
          <form onSubmit={saveDraft} className="rounded-lg border border-border-subtle p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="ed-type">{t('requestDetail.documentType')}</label>
              <select id="ed-type" required className={inputCls} value={editForm.documentTypeId} onChange={(e) => setEditForm({ ...editForm, documentTypeId: e.target.value })}>
                {editOptions.documentTypes.map((d) => <option key={d.id} value={d.id}>{d.nameEn}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ed-office">{t('requestDetail.office')}</label>
              <select id="ed-office" required className={inputCls} value={editForm.officeId} onChange={(e) => setEditForm({ ...editForm, officeId: e.target.value })}>
                {editOptions.offices.map((o) => <option key={o.id} value={o.id}>{o.nameEn}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ed-dept">{t('requestDetail.department')}</label>
              <select id="ed-dept" className={inputCls} value={editForm.departmentId} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}>
                <option value="">—</option>
                {editOptions.departments.map((d) => <option key={d.id} value={d.id}>{d.nameEn}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ed-dir">{t('requestDetail.direction')}</label>
              <select id="ed-dir" className={inputCls} value={editForm.direction} onChange={(e) => setEditForm({ ...editForm, direction: e.target.value })}>
                <option value="INCOMING">{t('requestDetail.directionIncoming')}</option>
                <option value="OUTGOING">{t('requestDetail.directionOutgoing')}</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ed-prio">{t('requestDetail.priority')}</label>
              <select id="ed-prio" className={inputCls} value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                {['NORMAL', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ed-subject">{t('requestDetail.subject')}</label>
              <input id="ed-subject" className={inputCls} maxLength={255} value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="ed-notes">{t('requestDetail.notes')}</label>
              <textarea id="ed-notes" rows={3} className={inputCls} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setEditing(false)}>{t('common.cancel', 'Cancel')}</button>
              <button type="submit" className="btn-primary" disabled={busy}>{t('requestDetail.saveChanges', 'Save changes')}</button>
            </div>
          </form>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <Field label={t('requestDetail.citizen')}>{request.citizen.firstNameEn} {request.citizen.lastNameEn} ({request.citizen.registryNumber})</Field>
          <Field label={t('requestDetail.documentType')}>{request.documentType.nameEn}</Field>
          <Field label={t('requestDetail.office')}>{request.office.nameEn}</Field>
          <Field label={t('requestDetail.direction')}>
            {request.direction === 'OUTGOING' ? t('requestDetail.directionOutgoing') : t('requestDetail.directionIncoming')}
          </Field>
          {request.subject && <Field label={t('requestDetail.subject')}>{request.subject}</Field>}
          {request.departmentName && <Field label={t('requestDetail.department')}>{request.departmentName}</Field>}
          <Field label={t('requestDetail.priority')}>{request.priority}</Field>
          <Field label={t('requestDetail.assignedTo')}>{request.assignedToName ?? '—'}</Field>
          <Field label={t('requestDetail.createdBy')}>{request.createdByName}</Field>
          <Field label={t('requestDetail.createdOn')}>{fmtDate(request.createdAt, 'MMM d, yyyy HH:mm', '—')}</Field>
          {request.submittedAt && <Field label={t('requestDetail.submittedOn')}>{fmtDate(request.submittedAt, 'MMM d, yyyy HH:mm')}</Field>}
          <Field label={t('requestDetail.due')}>{request.dueAt ? fmtDate(request.dueAt, 'MMM d, yyyy HH:mm') : '—'}</Field>
          {request.closedAt && <Field label={t('requestDetail.closedOn')}>{fmtDate(request.closedAt, 'MMM d, yyyy HH:mm')}</Field>}
          {request.rejectionReason && <Field label={t('requestDetail.rejectionReason')}>{request.rejectionReason}</Field>}
          {request.notes && <Field label={t('requestDetail.notes')}>{request.notes}</Field>}
        </div>


        {hasPermission('REQUEST_ASSIGN') && !CLOSED_STATUSES.includes(request.status) && (
          <div className="rounded-lg border border-border-subtle p-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              <div>
                <label className={labelCls} htmlFor="rd-reassign">{t('requestDetail.reassignTo')}</label>
                <select id="rd-reassign" className={inputCls} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">{t('requestDetail.selectUser')}</option>
                  {users.filter((u) => u.enabled !== false).map((u) => <option key={u.id} value={u.id}>{u.fullName} ({(u.roles ?? []).join(',')})</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="rd-assign-note">{t('requestDetail.noteOptional')}</label>
                <input id="rd-assign-note" className={inputCls} value={assignNote} onChange={(e) => setAssignNote(e.target.value)} />
              </div>
            </div>
            <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-border-subtle "
                    disabled={!assigneeId || busy} onClick={doAssign}>
              {t('requestDetail.assign')}
            </button>
          </div>
        )}
      </div>
      )}

      {/* ---- SLA & payments ---- */}
      {tab === 'finance' && (
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-text-primary">{t('requestFinance.title')}</h2>
            <p className="text-xs text-text-secondary mt-0.5">{t('requestFinance.subtitle')}</p>
          </div>
          <button type="button" onClick={refreshSla} disabled={slaBusy}
                  className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-border-subtle  whitespace-nowrap">
            {slaBusy ? t('requestFinance.refreshing') : t('requestFinance.refresh')}
          </button>
        </div>

        {financeError && (
          <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{financeError}</div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <Field label={t('requestFinance.slaStatus')}><SlaRecordBadge slaStatus={slaRecord?.slaStatus} /></Field>
          <Field label={t('requestFinance.dueDate')}>{request.dueAt
            ? fmtDate(request.dueAt, 'MMM d, yyyy')
            : (slaRecord?.dueDate ? fmtDate(slaRecord.dueDate, 'MMM d, yyyy') : '—')}</Field>
          <Field label={t('requestFinance.daysRemaining')}>{slaRecord?.daysRemaining ?? '—'}</Field>
          <Field label={t('requestFinance.overdueByDays')}>{slaRecord?.overdueByDays ?? '—'}</Field>
        </div>

        <div className="border-t border-row-divider pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{t('requestFinance.paymentsTitle')}</h3>
            {!addingPayment && hasPermission('PAYMENT_RECORD') && (
              <button type="button" onClick={startAddingPayment} className="text-sm font-semibold text-primary hover:underline">
                {t('requestFinance.recordPayment')}
              </button>
            )}
          </div>

          {addingPayment && (
            <form onSubmit={handleRecordPayment} className="rounded-lg border border-border-subtle p-4 mb-4">
              {paymentFormError && (
                <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{paymentFormError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelCls} htmlFor="pf-amount">
                    {t('requestFinance.amount')} <span className="text-required">*</span>
                  </label>
                  <input id="pf-amount" type="number" step="0.01" min="0.01" className={inputCls}
                         value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="pf-currency">
                    {t('requestFinance.currency')} <span className="text-required">*</span>
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
                <button type="button" onClick={() => setAddingPayment(false)} className="btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={paymentBusy} className="btn-primary ">
                  {paymentBusy ? t('requestFinance.submitting') : t('requestFinance.submit')}
                </button>
              </div>
            </form>
          )}

          {payments.length === 0 ? (
            <p className="text-sm text-text-secondary">{t('requestFinance.noPayments')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{p.amount} {p.currency}</span>
                      <span className="text-xs font-mono text-text-secondary">{t(`paymentMethod.${p.method}`, p.method)}</span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                    {p.status === 'PAID' && hasPermission('PAYMENT_REVERSE') && (
                      <button type="button" onClick={() => startReversing(p.id)}
                              className="btn-danger btn-sm ">
                        {t('requestFinance.reverse')}
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    {p.receiptNumber && <>{t('requestFinance.receiptNumber')}: {p.receiptNumber} · </>}
                    {p.collectedByName && <>{t('requestFinance.collectedBy')} {p.collectedByName} · </>}
                    {fmtDate(p.paidAt, 'MMM d, yyyy HH:mm')}
                  </div>
                  {p.status === 'REVERSED' && (
                    <div className="text-xs text-badge-danger-fg mt-1">
                      {t('requestFinance.reversedBy')} {p.reversedByName} · {fmtDate(p.reversedAt, 'MMM d, yyyy HH:mm')}
                      {p.reversalReason && ` — ${p.reversalReason}`}
                    </div>
                  )}
                  {reversingPaymentId === p.id && (
                    <div className="rounded-lg border border-badge-warning-bd bg-badge-warning-bg p-3 mt-2">
                      <label className={labelCls} htmlFor={`pf-reverse-reason-${p.id}`}>{t('requestFinance.reversalReason')}</label>
                      <input id={`pf-reverse-reason-${p.id}`} className={inputCls} value={reversalReason} onChange={(e) => setReversalReason(e.target.value)} />
                      <div className="flex justify-end gap-2 mt-2">
                        <button type="button" onClick={() => setReversingPaymentId(null)} className="btn-secondary btn-sm">
                          {t('common.cancel')}
                        </button>
                        <button type="button" disabled={!reversalReason.trim() || reverseBusy} onClick={() => doReversePayment(p.id)}
                                className="btn-danger btn-sm ">
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
      )}

      {tab === 'attachments' && (
      <div className="card p-5 mb-4">
        <h2 className="text-sm font-bold text-text-primary mb-4">{t('requestDetail.documents')}</h2>
        {hasPermission('REQUEST_CREATE') && (
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-border-subtle mb-4">
            {t('requestDetail.uploadDocument')}
            <input type="file" onChange={handleUpload} className="hidden" />
          </label>
        )}
        {attachments.length === 0 ? <p className="text-sm text-text-secondary">{t('requestDetail.noDocuments')}</p> : (
          <ul className="divide-y divide-slate-100">
            {attachments.map((a) => (
              <li key={a.id} className="py-3">
                <button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => download(a.id, a.fileName)}>{a.fileName}</button>
                <div className="text-xs text-text-secondary mt-0.5">{((a.sizeBytes ?? 0) / 1024).toFixed(1)} KB{a.sha256 ? ` · SHA-256 ${a.sha256.slice(0, 12)}…` : ''} · {a.uploadedByName}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      {tab === 'history' && (
        <>
      <div className="card p-5 mb-4">
        <h2 className="text-sm font-bold text-text-primary mb-4">{t('requestDetail.assignmentHistory')}</h2>
        {assignments.length === 0 ? <p className="text-sm text-text-secondary">{t('requestDetail.neverAssigned')}</p> : (
          <ul className="divide-y divide-slate-100">
            {assignments.map((a) => (
              <li key={a.id} className="py-3">
                <div className="text-sm font-semibold text-text-primary">{t('requestDetail.assignedToLabel')} {a.assignedToName}</div>
                <div className="text-xs text-text-secondary mt-0.5">{a.assignedByName} · {fmtDate(a.assignedAt, 'MMM d, yyyy HH:mm')}</div>
                {a.note && <div className="text-sm text-text-secondary mt-1">{a.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-bold text-text-primary mb-4">{t('requestDetail.auditTrail')}</h2>
        <ul className="divide-y divide-slate-100">
          {history.map((h) => (
            <li key={h.id} className="py-3">
              <div className="text-sm font-semibold text-text-primary">
                {h.fromStatus ? `${t(`status.${h.fromStatus}`, h.fromStatus)} → ${t(`status.${h.toStatus}`, h.toStatus)}` : `${t('requestDetail.created')} (${t(`status.${h.toStatus}`, h.toStatus)})`}
              </div>
              <div className="text-xs text-text-secondary mt-0.5">{h.changedByName} · {fmtDate(h.changedAt, 'MMM d, yyyy HH:mm')}</div>
              {h.note && <div className="text-sm text-text-secondary mt-1">{h.note}</div>}
            </li>
          ))}
        </ul>
        <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary mt-6 mb-2">{t('requestDetail.activityLog')}</h3>
        {auditEntries.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('requestDetail.noActivity')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {auditEntries.map((a) => (
              <li key={a.id} className="py-3">
                <div className="text-sm font-semibold text-text-primary">{a.action}</div>
                <div className="text-xs text-text-secondary mt-0.5">{a.actorName} · {fmtDate(a.occurredAt, 'MMM d, yyyy HH:mm')}</div>
                {a.details && <div className="text-sm text-text-secondary mt-1">{a.details}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
        </>
      )}
    </div>
  )
}
