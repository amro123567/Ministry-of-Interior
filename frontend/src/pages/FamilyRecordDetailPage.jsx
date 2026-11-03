import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../api/client.js'
import CitizenSearchPicker from '../components/CitizenSearchPicker.jsx'
import { SkeletonLine } from '../components/Skeleton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { inputCls, labelCls } from '../ui.js'
import { fmtDate, todayISO } from '../utils/dates.js'

const emptyPick = { citizenId: null, citizenLabel: null }

// GET /api/family-records/{id} -- the only family-record read that isn't
// citizen-scoped, and the destination every "View family record" link
// (from a citizen's family-history section) points at. No permission
// gate on the read (falls through to anyRequest().authenticated(), same
// as the citizen registry); adding a member, and marking one as having
// left, are CITIZEN_MANAGE writes matching SecurityConfig's own
// /api/family-records/** matchers.
export default function FamilyRecordDetailPage() {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const { id } = useParams()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [adding, setAdding] = useState(false)
  const [newMember, setNewMember] = useState(emptyPick)
  const [relationship, setRelationship] = useState('CHILD')
  const [joinedDate, setJoinedDate] = useState(() => todayISO())
  const [addError, setAddError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [leavingMemberId, setLeavingMemberId] = useState(null)
  const [leftReason, setLeftReason] = useState('')
  const [leftDate, setLeftDate] = useState(() => todayISO())
  const [leaveError, setLeaveError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    client.get(`/family-records/${id}`)
      .then((r) => setRecord(r.data))
      .catch(() => setError(t('familyRecord.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [id, t])

  useEffect(() => { load() }, [load])

  function startAdding() {
    setNewMember(emptyPick)
    setRelationship('CHILD')
    setJoinedDate(todayISO())
    setAddError(null)
    setAdding(true)
  }

  async function handleAddMember(e) {
    e.preventDefault()
    setAddError(null)
    if (!newMember.citizenId) {
      setAddError(t('familyRecord.errorRequired'))
      return
    }
    setBusy(true)
    try {
      await client.post(`/family-records/${id}/members`, {
        citizenId: newMember.citizenId,
        relationship,
        joinedDate: joinedDate || null,
      })
      setAdding(false)
      load()
    } catch (err) {
      setAddError(err.response?.data?.message ?? t('familyRecord.addErrorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  function startLeaving(memberId) {
    setLeavingMemberId(memberId)
    setLeftReason('')
    setLeftDate(todayISO())
    setLeaveError(null)
  }

  async function handleLeave(memberId) {
    setLeaveError(null)
    if (!leftReason.trim()) {
      setLeaveError(t('familyRecord.errorRequired'))
      return
    }
    setBusy(true)
    try {
      await client.patch(`/family-records/${id}/members/${memberId}/leave`, {
        leftReason: leftReason.trim(),
        leftDate: leftDate || null,
      })
      setLeavingMemberId(null)
      load()
    } catch (err) {
      setLeaveError(err.response?.data?.message ?? t('familyRecord.leaveErrorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-5">
        <SkeletonLine width="40%" height={22} className="mb-3" />
        <SkeletonLine width="60%" height={14} />
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg" role="alert">
        {error ?? t('familyRecord.couldNotLoad')}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{record.familyBookNumber}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {t('familyRecord.headOfHousehold')}:{' '}
            <Link to={`/citizens/${record.headOfHouseholdId}`} className="font-semibold text-primary hover:underline">
              {record.headOfHouseholdName}
            </Link>
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
          record.active ? 'bg-badge-success-bg text-badge-success-fg border-badge-success-bd' : 'bg-badge-draft-bg text-badge-draft-fg border-badge-draft-bd'
        }`}>
          {record.active ? t('familyRecord.active') : t('familyRecord.inactive')}
        </span>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-text-primary">{t('familyRecord.members')}</h2>
          {!adding && hasPermission('CITIZEN_MANAGE') && (
            <button type="button" onClick={startAdding} className="text-sm font-semibold text-primary hover:underline">
              {t('familyRecord.addMember')}
            </button>
          )}
        </div>

        {adding && (
          <form onSubmit={handleAddMember} className="rounded-lg border border-border-subtle p-4 mb-4">
            {addError && (
              <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{addError}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="sm:col-span-2">
                <CitizenSearchPicker label={t('familyRecord.citizen')} value={newMember} onChange={setNewMember} />
              </div>
              <div>
                <label className={labelCls} htmlFor="fm-relationship">{t('familyRecord.relationship')}</label>
                <select id="fm-relationship" className={inputCls} value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                  <option value="HEAD">{t('familyRecord.relationshipLabel.HEAD')}</option>
                  <option value="SPOUSE">{t('familyRecord.relationshipLabel.SPOUSE')}</option>
                  <option value="CHILD">{t('familyRecord.relationshipLabel.CHILD')}</option>
                  <option value="OTHER">{t('familyRecord.relationshipLabel.OTHER')}</option>
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="fm-joined">{t('familyRecord.joinedDate')}</label>
                <input id="fm-joined" type="date" className={inputCls} value={joinedDate} onChange={(e) => setJoinedDate(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={() => setAdding(false)} className="btn-secondary">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={busy} className="btn-primary ">
                {busy ? t('familyRecord.addSubmitting') : t('familyRecord.addSubmit')}
              </button>
            </div>
          </form>
        )}

        <ul className="divide-y divide-slate-100">
          {record.members.map((m) => (
            <li key={m.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link to={`/citizens/${m.citizenId}`} className="text-sm font-semibold text-primary hover:underline">
                    {m.citizenName}
                  </Link>
                  <span className="text-xs text-text-secondary ms-2">{t(`familyRecord.relationshipLabel.${m.relationship}`, m.relationship)}</span>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  m.leftDate ? 'bg-badge-draft-bg text-badge-draft-fg border-badge-draft-bd' : 'bg-badge-success-bg text-badge-success-fg border-badge-success-bd'
                }`}>
                  {m.leftDate ? t('familyRecord.memberStatusLeft') : t('familyRecord.memberStatusActive')}
                </span>
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                {t('familyRecord.colJoined')}: {m.joinedDate ? fmtDate(m.joinedDate, 'MMM d, yyyy') : '—'}
                {m.leftDate && ` · ${t('familyRecord.colLeft')}: ${fmtDate(m.leftDate, 'MMM d, yyyy')} (${m.leftReason})`}
              </div>

              {!m.leftDate && hasPermission('CITIZEN_MANAGE') && (
                leavingMemberId === m.id ? (
                  <div className="mt-2 rounded-lg border border-border-subtle p-3">
                    {leaveError && <div className="text-xs text-badge-danger-fg mb-2">{leaveError}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                      <input
                        className={inputCls}
                        placeholder={t('familyRecord.leftReason')}
                        value={leftReason}
                        onChange={(e) => setLeftReason(e.target.value)}
                      />
                      <input type="date" className={inputCls} value={leftDate} onChange={(e) => setLeftDate(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setLeavingMemberId(null)} className="text-xs font-semibold text-text-secondary hover:underline">
                        {t('common.cancel')}
                      </button>
                      <button type="button" disabled={busy} onClick={() => handleLeave(m.id)} className="btn-primary btn-sm ">
                        {busy ? t('familyRecord.leaveSubmitting') : t('familyRecord.leaveSubmit')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => startLeaving(m.id)} className="mt-2 text-xs font-semibold text-primary hover:underline">
                    {t('familyRecord.markLeft')}
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
