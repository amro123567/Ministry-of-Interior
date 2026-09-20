import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import client from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

// Shows every family-record membership a citizen has ever had (GET
// /api/citizens/{id}/family-history returns across *every* family, not
// just a "current family" -- there is no such shortcut on the backend,
// see CitizenRegistryService.familyHistoryForCitizen()) and offers a way
// to start a new family record with this citizen as head of household.
//
// There's no global family-record search/list endpoint (only GET
// /api/family-records/{id} by id, and this citizen-scoped history) --
// so "view family record" links, reached via the familyRecordId this
// domain's DTO carries, are the only way into a record's own page from
// here.
export default function FamilyHistorySection({ citizenId, citizenLabel }) {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const [memberships, setMemberships] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    client.get(`/citizens/${citizenId}/family-history`)
      .then((r) => setMemberships(r.data))
      .catch(() => setError(t('familyRecord.couldNotLoadHistory')))
      .finally(() => setLoading(false))
  }, [citizenId, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-900">{t('familyRecord.historyTitle')}</h2>
        {/* CITIZEN_MANAGE-gated, matching SecurityConfig's POST
            /api/family-records/** matcher. */}
        {hasPermission('CITIZEN_MANAGE') && (
          <Link
            to={`/family-records/new?headId=${citizenId}&headLabel=${encodeURIComponent(citizenLabel || '')}`}
            className="text-sm font-semibold text-indigo-600 hover:underline"
          >
            {t('familyRecord.createRecord')}
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">{error}</div>
      )}

      {!error && loading && <p className="text-sm text-slate-400">{t('common.loading')}</p>}

      {!error && !loading && (
        memberships.length === 0 ? (
          <p className="text-sm text-slate-400">{t('familyRecord.historyEmpty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {memberships.map((m) => (
              <li key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-slate-800">
                    {t(`familyRecord.relationshipLabel.${m.relationship}`, m.relationship)}
                  </span>
                  <span className="text-xs text-slate-400 ms-2">
                    {m.joinedDate ? format(new Date(m.joinedDate), 'MMM d, yyyy') : '—'}
                    {m.leftDate && ` → ${format(new Date(m.leftDate), 'MMM d, yyyy')} (${m.leftReason})`}
                  </span>
                </div>
                <Link to={`/family-records/${m.familyRecordId}`} className="text-sm font-semibold text-indigo-600 hover:underline whitespace-nowrap">
                  {t('familyRecord.viewRecord')}
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
