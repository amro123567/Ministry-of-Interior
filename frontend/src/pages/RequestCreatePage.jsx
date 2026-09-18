import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client.js'

export default function RequestCreatePage() {
  const navigate = useNavigate()
  const [citizens, setCitizens] = useState([])
  const [documentTypes, setDocumentTypes] = useState([])
  const [offices, setOffices] = useState([])
  const [citizenQuery, setCitizenQuery] = useState('')
  const [form, setForm] = useState({ citizenId: '', documentTypeId: '', officeId: '', priority: 'NORMAL', notes: '' })
  const [showNewCitizen, setShowNewCitizen] = useState(false)
  const [newCitizen, setNewCitizen] = useState({ registryNumber: '', firstNameEn: '', lastNameEn: '', gender: 'M' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    client.get('/document-types').then((r) => setDocumentTypes(r.data))
    client.get('/offices').then((r) => {
      setOffices(r.data)
      setForm((f) => ({ ...f, officeId: r.data[0]?.id ?? '' }))
    })
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      client.get('/citizens', { params: { q: citizenQuery || undefined } }).then((r) => setCitizens(r.data))
    }, 250)
    return () => clearTimeout(handle)
  }, [citizenQuery])

  async function handleCreateCitizen(e) {
    e.preventDefault()
    const res = await client.post('/citizens', newCitizen)
    setCitizens((c) => [res.data, ...c])
    setForm((f) => ({ ...f, citizenId: res.data.id }))
    setShowNewCitizen(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.citizenId || !form.documentTypeId || !form.officeId) {
      setError('Select a citizen, document type and office.')
      return
    }
    setBusy(true)
    try {
      const res = await client.post('/requests', {
        citizenId: Number(form.citizenId),
        documentTypeId: Number(form.documentTypeId),
        officeId: Number(form.officeId),
        priority: form.priority,
        notes: form.notes || null,
      })
      navigate(`/requests/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Could not create the request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1>New correspondence request</h1>
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
        {error && <div className="alert alert-error">{error}</div>}

        <label>
          Citizen
          <input placeholder="Search by name or registry number…" value={citizenQuery}
                 onChange={(e) => setCitizenQuery(e.target.value)} />
        </label>
        <select value={form.citizenId} onChange={(e) => setForm({ ...form, citizenId: e.target.value })} required>
          <option value="">Select a citizen…</option>
          {citizens.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstNameEn} {c.lastNameEn} — {c.registryNumber}
            </option>
          ))}
        </select>
        <button type="button" className="btn-link" onClick={() => setShowNewCitizen((v) => !v)}>
          {showNewCitizen ? 'Cancel' : '+ Register a new citizen'}
        </button>

        {showNewCitizen && (
          <div className="subcard">
            <label>Registry number
              <input value={newCitizen.registryNumber}
                     onChange={(e) => setNewCitizen({ ...newCitizen, registryNumber: e.target.value })} required />
            </label>
            <label>First name
              <input value={newCitizen.firstNameEn}
                     onChange={(e) => setNewCitizen({ ...newCitizen, firstNameEn: e.target.value })} required />
            </label>
            <label>Last name
              <input value={newCitizen.lastNameEn}
                     onChange={(e) => setNewCitizen({ ...newCitizen, lastNameEn: e.target.value })} />
            </label>
            <button className="btn btn-primary" onClick={handleCreateCitizen}>Save citizen</button>
          </div>
        )}

        <label>
          Document type
          <select value={form.documentTypeId} onChange={(e) => setForm({ ...form, documentTypeId: e.target.value })} required>
            <option value="">Select…</option>
            {documentTypes.map((d) => <option key={d.id} value={d.id}>{d.nameEn} (SLA {d.slaDays}d)</option>)}
          </select>
        </label>

        <label>
          Office
          <select value={form.officeId} onChange={(e) => setForm({ ...form, officeId: e.target.value })} required>
            {offices.map((o) => <option key={o.id} value={o.id}>{o.nameEn}</option>)}
          </select>
        </label>

        <label>
          Priority
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </label>

        <label>
          Notes
          <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create request (saved as Draft)'}
        </button>
      </form>
    </div>
  )
}
