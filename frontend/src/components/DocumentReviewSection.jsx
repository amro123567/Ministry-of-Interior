import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import client from '../api/client.js'
import { apiErrorMessage } from '../api/errors.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const CUSTODY_EVENTS = ['RECEIVED', 'TRANSFERRED', 'STORED', 'RELEASED', 'RETURNED']

const STATUS_STYLE = {
  PENDING: 'border-slate-200 bg-slate-50 text-slate-600',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
}

function when(d) { return d ? format(new Date(d), 'MMM d, yyyy HH:mm') : '' }

// Validation sign-offs and the physical chain of custody for one document (FR-11).
// Anyone signed in can read it; validating needs CITIZEN_REGISTRY_DECIDE and recording
// custody needs CITIZEN_MANAGE -- the same permissions the API enforces.
export default function DocumentReviewSection({ documentId }) {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const [review, setReview] = useState(null)
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [decision, setDecision] = useState('APPROVED')
  const [comment, setComment] = useState('')
  const [eventType, setEventType] = useState('RECEIVED')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    client.get(`/documents/${documentId}/review`)
      .then((r) => { setReview(r.data); setError(null) })
      .catch(() => setError(t('documentReview.couldNotLoad')))
  }, [documentId, t])

  useEffect(() => { load() }, [load])

  async function submit(path, body, reset) {
    setBusy(true)
    setFormError(null)
    try {
      await client.post(`/documents/${documentId}/${path}`, body)
      reset()
      load()
    } catch (err) {
      setFormError(apiErrorMessage(err, t('documentReview.errorGeneric'), t))
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mt-4" role="alert">{error}</div>
  }
  if (!review) return null

  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'
  const btnCls = 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">{t('documentReview.validationTitle')}</h2>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLE[review.validationStatus]}`}>
            {t(`documentReview.status.${review.validationStatus}`, review.validationStatus)}
          </span>
        </div>
        {review.validations.length === 0 ? (
          <p className="text-sm text-slate-400">{t('documentReview.noValidations')}</p>
        ) : (
          <ul className="space-y-3">
            {review.validations.map((v) => (
              <li key={v.id} className="text-sm border-s-2 border-slate-200 ps-3">
                <div className="font-semibold text-slate-800">
                  {t(`documentReview.status.${v.decision}`, v.decision)} — {v.validatorName}
                </div>
                {v.comment && <div className="text-slate-600">{v.comment}</div>}
                <div className="text-xs text-slate-400">{when(v.validatedAt)}</div>
              </li>
            ))}
          </ul>
        )}
        {hasPermission('CITIZEN_REGISTRY_DECIDE') && (
          <form
            className="mt-4 space-y-2 border-t border-slate-100 pt-4"
            onSubmit={(e) => {
              e.preventDefault()
              submit('validations', { decision, comment: comment.trim() || null }, () => setComment(''))
            }}
          >
            <select className={inputCls} value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="APPROVED">{t('documentReview.status.APPROVED')}</option>
              <option value="REJECTED">{t('documentReview.status.REJECTED')}</option>
            </select>
            <input className={inputCls} value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)}
              placeholder={t('documentReview.commentPlaceholder')} />
            <button type="submit" disabled={busy} className={btnCls}>{t('documentReview.validate')}</button>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4">{t('documentReview.custodyTitle')}</h2>
        {review.custody.length === 0 ? (
          <p className="text-sm text-slate-400">{t('documentReview.noCustody')}</p>
        ) : (
          <ol className="space-y-3">
            {review.custody.map((c) => (
              <li key={c.id} className="text-sm border-s-2 border-indigo-200 ps-3">
                <div className="font-semibold text-slate-800">
                  {t(`documentReview.event.${c.eventType}`, c.eventType)} — {c.location}
                </div>
                {c.note && <div className="text-slate-600">{c.note}</div>}
                <div className="text-xs text-slate-400">{c.handledByName} ({c.handledByRole}) · {when(c.handledAt)}</div>
              </li>
            ))}
          </ol>
        )}
        {hasPermission('CITIZEN_MANAGE') && (
          <form
            className="mt-4 space-y-2 border-t border-slate-100 pt-4"
            onSubmit={(e) => {
              e.preventDefault()
              submit('custody', { eventType, location: location.trim(), note: note.trim() || null },
                () => { setLocation(''); setNote('') })
            }}
          >
            <select className={inputCls} value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {CUSTODY_EVENTS.map((ev) => <option key={ev} value={ev}>{t(`documentReview.event.${ev}`)}</option>)}
            </select>
            <input className={inputCls} value={location} maxLength={200} required onChange={(e) => setLocation(e.target.value)}
              placeholder={t('documentReview.locationPlaceholder')} />
            <input className={inputCls} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)}
              placeholder={t('documentReview.notePlaceholder')} />
            <button type="submit" disabled={busy} className={btnCls}>{t('documentReview.recordCustody')}</button>
          </form>
        )}
      </section>

      {formError && (
        <div className="lg:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">{formError}</div>
      )}
    </div>
  )
}
