import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client.js'
import StatusBadge, { SlaBadge } from '../components/StatusBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const TRANSITIONS = {
  DRAFT: [{ to: 'SUBMITTED', label: 'Submit', role: 'OFFICER' }],
  SUBMITTED: [{ to: 'UNDER_REVIEW', label: 'Start review', role: 'MANAGER' }],
  UNDER_REVIEW: [
    { to: 'APPROVED', label: 'Approve', role: 'MANAGER' },
    { to: 'REJECTED', label: 'Reject', role: 'MANAGER', needsReason: true },
  ],
  APPROVED: [{ to: 'ARCHIVED', label: 'Archive', role: 'OFFICER' }],
  REJECTED: [{ to: 'ARCHIVED', label: 'Archive', role: 'OFFICER' }],
  ARCHIVED: [],
}

export default function RequestDetailPage() {
  const { id } = useParams()
  const { hasRole } = useAuth()
  const [request, setRequest] = useState(null)
  const [history, setHistory] = useState([])
  const [attachments, setAttachments] = useState([])
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [pendingReject, setPendingReject] = useState(false)
  const [assigneeId, setAssigneeId] = useState('')

  const load = useCallback(() => {
    client.get(`/requests/${id}`).then((r) => setRequest(r.data))
    client.get(`/requests/${id}/history`).then((r) => setHistory(r.data))
    client.get(`/requests/${id}/documents`).then((r) => setAttachments(r.data))
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (hasRole('ADMIN', 'MANAGER')) client.get('/users').then((r) => setUsers(r.data)) }, [hasRole])

  async function doTransition(to, reason) {
    setBusy(true); setError(null)
    try {
      await client.patch(`/requests/${id}/transition`, { toStatus: to, rejectionReason: reason ?? null })
      setPendingReject(false); setRejectionReason('')
      load()
    } catch (err) {
      setError(err.response?.data?.message ?? 'That transition was refused.')
    } finally { setBusy(false) }
  }

  async function doAssign() {
    if (!assigneeId) return
    setBusy(true); setError(null)
    try {
      await client.patch(`/requests/${id}/assign`, { userId: Number(assigneeId) })
      load()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Could not assign this request.')
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
      setError(err.response?.data?.message ?? 'Upload failed.')
    } finally { setBusy(false); e.target.value = '' }
  }

  async function download(attachmentId, fileName) {
    const res = await client.get(`/documents/${attachmentId}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = fileName; a.click()
    URL.revokeObjectURL(url)
  }

  if (!request) return <p className="muted">Loading…</p>

  const available = (TRANSITIONS[request.status] ?? []).filter((t) => hasRole('ADMIN', t.role))

  return (
    <div>
      <div className="page-header">
        <h1>{request.referenceNumber}</h1>
        <div><StatusBadge status={request.status} /> <SlaBadge overdue={request.overdue} dueAt={request.dueAt} /></div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="detail-grid">
        <div className="card">
          <h2>Details</h2>
          <dl className="def-list">
            <dt>Citizen</dt><dd>{request.citizen.firstNameEn} {request.citizen.lastNameEn} ({request.citizen.registryNumber})</dd>
            <dt>Document type</dt><dd>{request.documentType.nameEn}</dd>
            <dt>Office</dt><dd>{request.office.nameEn}</dd>
            <dt>Priority</dt><dd>{request.priority}</dd>
            <dt>Assigned to</dt><dd>{request.assignedToName ?? '—'}</dd>
            <dt>Created by</dt><dd>{request.createdByName}</dd>
            <dt>Due</dt><dd>{request.dueAt ? new Date(request.dueAt).toLocaleString() : '—'}</dd>
            {request.rejectionReason && <><dt>Rejection reason</dt><dd>{request.rejectionReason}</dd></>}
            {request.notes && <><dt>Notes</dt><dd>{request.notes}</dd></>}
          </dl>

          {available.length > 0 && (
            <div className="action-row">
              {available.map((t) =>
                t.needsReason ? (
                  <button key={t.to} className="btn btn-danger" disabled={busy}
                          onClick={() => setPendingReject(true)}>{t.label}</button>
                ) : (
                  <button key={t.to} className="btn btn-primary" disabled={busy}
                          onClick={() => doTransition(t.to)}>{t.label}</button>
                ))}
            </div>
          )}
          {pendingReject && (
            <div className="subcard">
              <label>Rejection reason
                <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
              </label>
              <button className="btn btn-danger" disabled={!rejectionReason || busy}
                      onClick={() => doTransition('REJECTED', rejectionReason)}>Confirm rejection</button>
            </div>
          )}

          {hasRole('ADMIN', 'MANAGER') && (
            <div className="subcard">
              <label>Reassign to
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Select a user…</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.roles.join(',')})</option>)}
                </select>
              </label>
              <button className="btn" disabled={!assigneeId || busy} onClick={doAssign}>Assign</button>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Documents</h2>
          <label className="btn btn-secondary file-btn">
            Upload document
            <input type="file" onChange={handleUpload} style={{ display: 'none' }} />
          </label>
          {attachments.length === 0 ? <p className="muted">No documents attached.</p> : (
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
          <h2>Audit trail</h2>
          <ul className="timeline">
            {history.map((h) => (
              <li key={h.id}>
                <strong>{h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `Created (${h.toStatus})`}</strong>
                <div className="muted small">{h.changedByName} · {new Date(h.changedAt).toLocaleString()}</div>
                {h.note && <div className="small">{h.note}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
