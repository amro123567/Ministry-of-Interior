import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import client from '../api/client.js'
import ParentLineagePicker from '../components/ParentLineagePicker.jsx'
import FamilyHistorySection from '../components/FamilyHistorySection.jsx'
import GuardianshipSection from '../components/GuardianshipSection.jsx'
import RegistryTransferSection from '../components/RegistryTransferSection.jsx'
import CivilStatusAmendmentSection from '../components/CivilStatusAmendmentSection.jsx'
import DocumentsSection from '../components/DocumentsSection.jsx'
import { SkeletonLine } from '../components/Skeleton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const emptyParent = { mode: 'none', citizenId: null, citizenLabel: null, unregisteredName: null }

function parentToPickerValue(id, name, unregisteredName) {
  if (id) return { mode: 'registered', citizenId: id, citizenLabel: name, unregisteredName: null }
  if (unregisteredName) return { mode: 'unregistered', citizenId: null, citizenLabel: null, unregisteredName }
  return emptyParent
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</div>
      <div className="text-sm text-slate-800">{value ?? <span className="text-slate-300">—</span>}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
      <h2 className="text-sm font-bold text-slate-900 mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  )
}

// Read-only detail view over GET /api/citizens/{id} -- the companion page
// to CitizenRegistryPage. Lineage links (father/mother) navigate to
// another citizen's own page when registered, matching how registered
// vs. unregistered parents are distinguished on the backend
// (Citizen.father/mother vs. fatherNameUnregistered/motherNameUnregistered
// -- see CitizenService's XOR validation). Family history, guardianship,
// registry transfers and civil-status amendments live in their own
// section components below (each is citizen-scoped on the backend too --
// there's no global list/search for any of those four, only
// GET /api/family-records/{id} by id and these citizen-scoped reads).
export default function CitizenDetailPage() {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const { id } = useParams()
  const [citizen, setCitizen] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingLineage, setEditingLineage] = useState(false)
  const [father, setFather] = useState(emptyParent)
  const [mother, setMother] = useState(emptyParent)
  const [lineageError, setLineageError] = useState(null)
  const [savingLineage, setSavingLineage] = useState(false)

  // Extracted (rather than left inline in the effect below) so a registry
  // transfer's or civil-status amendment's decide action -- both of which
  // can change fields shown in the Civil status section above (office,
  // name, marital status, ...) -- can refresh this page's own citizen
  // state without duplicating the fetch.
  const loadCitizen = useCallback(() => {
    return client.get(`/citizens/${id}`)
      .then((r) => setCitizen(r.data))
      .catch(() => setError(t('citizenDetail.couldNotLoad')))
  }, [id, t])

  useEffect(() => {
    setLoading(true)
    setCitizen(null)
    setEditingLineage(false)
    loadCitizen().finally(() => setLoading(false))
  }, [id, loadCitizen])

  function startEditingLineage() {
    setFather(parentToPickerValue(citizen.fatherId, citizen.fatherName, citizen.fatherNameUnregistered))
    setMother(parentToPickerValue(citizen.motherId, citizen.motherName, citizen.motherNameUnregistered))
    setLineageError(null)
    setEditingLineage(true)
  }

  async function handleSaveLineage(e) {
    e.preventDefault()
    setLineageError(null)
    setSavingLineage(true)
    try {
      const res = await client.patch(`/citizens/${id}/lineage`, {
        fatherId: father.mode === 'registered' ? father.citizenId : null,
        fatherNameUnregistered: father.mode === 'unregistered' ? (father.unregisteredName || '').trim() || null : null,
        motherId: mother.mode === 'registered' ? mother.citizenId : null,
        motherNameUnregistered: mother.mode === 'unregistered' ? (mother.unregisteredName || '').trim() || null : null,
      })
      setCitizen(res.data)
      setEditingLineage(false)
    } catch (err) {
      setLineageError(err.response?.data?.message ?? t('citizenDetail.lineageUpdateError'))
    } finally {
      setSavingLineage(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <SkeletonLine width="40%" height={22} className="mb-3" />
        <SkeletonLine width="60%" height={14} />
      </div>
    )
  }

  if (error || !citizen) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
        {error ?? t('citizenDetail.couldNotLoad')}
      </div>
    )
  }

  const c = citizen
  const nameEn = [c.firstNameEn, c.middleNameEn, c.lastNameEn].filter(Boolean).join(' ')
  const nameAr = [c.firstNameAr, c.middleNameAr, c.lastNameAr].filter(Boolean).join(' ')

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{nameEn || nameAr}</h1>
          <p className="text-sm text-slate-500 mt-1">{c.registryNumber}</p>
        </div>
        {c.deceased && (
          <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
            {t('citizens.deceased')}
          </span>
        )}
      </div>

      <Section title={t('citizenDetail.identity')}>
        <Field label={t('citizenDetail.nameEn')} value={nameEn} />
        <Field label={t('citizenDetail.nameAr')} value={nameAr} />
        <Field label={t('citizenDetail.registryNumber')} value={c.registryNumber} />
        <Field label={t('citizenDetail.sijillReference')} value={c.sijillReference} />
        <Field
          label={t('citizenDetail.dateOfBirth')}
          value={c.dateOfBirth ? format(new Date(c.dateOfBirth), 'MMM d, yyyy') : null}
        />
        <Field label={t('citizenDetail.placeOfBirth')} value={c.placeOfBirth} />
        <Field label={t('citizenDetail.gender')} value={c.gender} />
        <Field label={t('citizenDetail.nationality')} value={c.nationality} />
      </Section>

      <Section title={t('citizenDetail.civilStatus')}>
        <Field label={t('citizenDetail.religion')} value={c.religion} />
        <Field label={t('citizenDetail.sect')} value={c.sect} />
        <Field
          label={t('citizenDetail.maritalStatus')}
          value={c.maritalStatus ? t(`citizens.maritalStatus.${c.maritalStatus}`, c.maritalStatus) : null}
        />
        <Field label={t('citizenDetail.registeredOffice')} value={c.officeName} />
      </Section>

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">{t('citizenDetail.lineage')}</h2>
          {/* CITIZEN_MANAGE-gated, matching the backend's own gate on
              PATCH /api/citizens/{id}/lineage (SecurityConfig) -- a user
              without it never sees an edit affordance the API would just
              reject anyway. */}
          {!editingLineage && hasPermission('CITIZEN_MANAGE') && (
            <button
              type="button"
              onClick={startEditingLineage}
              className="text-sm font-semibold text-indigo-600 hover:underline"
            >
              {t('citizenDetail.editLineage')}
            </button>
          )}
        </div>

        {editingLineage ? (
          <form onSubmit={handleSaveLineage}>
            {lineageError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4" role="alert">
                {lineageError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <ParentLineagePicker label={t('citizenDetail.father')} value={father} onChange={setFather} excludeCitizenId={c.id} />
              <ParentLineagePicker label={t('citizenDetail.mother')} value={mother} onChange={setMother} excludeCitizenId={c.id} />
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingLineage(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={savingLineage}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {savingLineage ? t('citizenDetail.savingLineage') : t('citizenDetail.saveLineage')}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{t('citizenDetail.father')}</div>
              <div className="text-sm">
                {c.fatherId ? (
                  <Link to={`/citizens/${c.fatherId}`} className="font-semibold text-indigo-600 hover:underline">
                    {c.fatherName}
                  </Link>
                ) : c.fatherNameUnregistered ? (
                  <span className="text-slate-800">{c.fatherNameUnregistered} <span className="text-slate-400">({t('citizenDetail.unregistered')})</span></span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{t('citizenDetail.mother')}</div>
              <div className="text-sm">
                {c.motherId ? (
                  <Link to={`/citizens/${c.motherId}`} className="font-semibold text-indigo-600 hover:underline">
                    {c.motherName}
                  </Link>
                ) : c.motherNameUnregistered ? (
                  <span className="text-slate-800">{c.motherNameUnregistered} <span className="text-slate-400">({t('citizenDetail.unregistered')})</span></span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <DocumentsSection citizenId={c.id} citizenLabel={nameEn || nameAr} />
      <FamilyHistorySection citizenId={c.id} citizenLabel={nameEn || nameAr} />
      <GuardianshipSection citizenId={c.id} />
      <RegistryTransferSection citizenId={c.id} currentOfficeName={c.officeName} onDecided={loadCitizen} />
      <CivilStatusAmendmentSection citizenId={c.id} citizen={c} onDecided={loadCitizen} />
    </div>
  )
}
