import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import client from '../api/client.js'
import StatusBadge, { SlaBadge } from '../components/StatusBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

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

  const load = useCallback(() => {
    client.get(`/requests/${id}`).then((r) => setRequest(r.data))
    client.get(`/requests/${id}/history`).then((r) => setHistory(r.data))
    client.get(`/requests/${id}/assignments`).then((r) => setAssignments(r.data))
    client.get(`/requests/${id}/documents`).then((r) => setAttachments(r.data))
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

  if (!request) return <p className="muted">{t('common.loading')}</p>

  const available = (TRANSITIONS[request.status] ?? []).filter((tr) => hasPermission(tr.permission))

  return (
    <div>
      <div className="page-header">
        <h1>{request.referenceNumber}</h1>
        <div><StatusBadge status={request.status} /> <SlaBadge slaStatus={request.slaStatus} /></div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="detail-grid">
        <div className="card">
          <h2>{t('requestDetail.details')}</h2>
          <dl className="def-list">
            <dt>{t('requestDetail.citizen')}</dt><dd>{request.citizen.firstNameEn} {request.citizen.lastNameEn} ({request.citizen.registryNumber})</dd>
            <dt>{t('requestDetail.documentType')}</dt><dd>{request.documentType.nameEn}</dd>
            <dt>{t('requestDetail.office')}</dt><dd>{request.office.nameEn}</dd>
            <dt>{t('requestDetail.priority')}</dt><dd>{request.priority}</dd>
            <dt>{t('requestDetail.assignedTo')}</dt><dd>{request.assignedToName ?? '—'}</dd>
            <dt>{t('requestDetail.createdBy')}</dt><dd>{request.createdByName}</dd>
            <dt>{t('requestDetail.due')}</dt><dd>{request.dueAt ? format(new Date(request.dueAt), 'MMM d, yyyy p') : '—'}</dd>
            {request.rejectionReason && <><dt>{t('requestDetail.rejectionReason')}</dt><dd>{request.rejectionReason}</dd></>}
            {request.notes && <><dt>{t('requestDetail.notes')}</dt><dd>{request.notes}</dd></>}
          </dl>

          {available.length > 0 && (
            <div className="action-row">
              {available.map((tr) =>
                tr.needsReason ? (
                  <button key={tr.to} className="btn btn-danger" disabled={busy}
                          onClick={() => setPendingReject(true)}>{t(`workflow.${tr.label}`, tr.label)}</button>
                ) : (
                  <button key={tr.to} className="btn btn-primary" disabled={busy}
                          onClick={() => doTransition(tr.to)}>{t(`workflow.${tr.label}`, tr.label)}</button>
                ))}
            </div>
          )}
          {pendingReject && (
            <div className="subcard">
              <label>{t('requestDetail.rejectionReason')}
                <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
              </label>
              <button className="btn btn-danger" disabled={!rejectionReason || busy}
                      onClick={() => doTransition('REJECTED', rejectionReason)}>{t('requestDetail.confirmRejection')}</button>
            </div>
          )}

          {hasPermission('USER_VIEW') && (
            <div className="subcard">
              <label>{t('requestDetail.reassignTo')}
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">{t('requestDetail.selectUser')}</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.roles.join(',')})</option>)}
                </select>
              </label>
              <label>{t('requestDetail.noteOptional')}
                <input value={assignNote} onChange={(e) => setAssignNote(e.target.value)} />
              </label>
              <button className="btn" disabled={!assigneeId || busy} onClick={doAssign}>{t('requestDetail.assign')}</button>
            </div>
          )}
        </div>

        <div className="card">
          <h2>{t('requestDetail.documents')}</h2>
          <label className="btn btn-secondary file-btn">
            {t('requestDetail.uploadDocument')}
            <input type="file" onChange={handleUpload} style={{ display: 'none' }} />
          </label>
          {attachments.length === 0 ? <p className="muted">{t('requestDetail.noDocuments')}</p> : (
            <ul className="doc-list">
              {attachments.map((a) => (
                <li key={a.id}>
                  <button className="btn-link" onClick={() => download(a.id, a.fileName)}>{a.fileName}</button>
                  <span className="muted small"> {(a.sizeBytes / 1024).toFixed(1)} KB · SHA-256 {a.sha256.slice(0, 12)}… · {a.uploadedByName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>{t('requestDetail.assignmentHistory')}</h2>
          {assignments.length === 0 ? <p className="muted">{t('requestDetail.neverAssigned')}</p> : (
            <ul className="timeline">
              {assignments.map((a) => (
                <li key={a.id}>
                  <strong>{t('requestDetail.assignedToLabel')} {a.assignedToName}</strong>
                  <div className="muted small">{a.assignedByName} · {format(new Date(a.assignedAt), 'MMM d, yyyy p')}</div>
                  {a.note && <div className="small">{a.note}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>{t('requestDetail.auditTrail')}</h2>
          <ul className="timeline">
            {history.map((h) => (
              <li key={h.id}>
                <strong>{h.fromStatus ? `${t(`status.${h.fromStatus}`, h.fromStatus)} → ${t(`status.${h.toStatus}`, h.toStatus)}` : `${t('requestDetail.created')} (${t(`status.${h.toStatus}`, h.toStatus)})`}</strong>
                <div className="muted small">{h.changedByName} · {format(new Date(h.changedAt), 'MMM d, yyyy p')}</div>
                {h.note && <div className="small">{h.note}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
