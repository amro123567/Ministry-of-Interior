import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../api/client.js'
import { apiErrorMessage } from '../api/errors.js'
import ParentLineagePicker from '../components/ParentLineagePicker.jsx'
import FamilyHistorySection from '../components/FamilyHistorySection.jsx'
import GuardianshipSection from '../components/GuardianshipSection.jsx'
import RegistryTransferSection from '../components/RegistryTransferSection.jsx'
import CivilStatusAmendmentSection from '../components/CivilStatusAmendmentSection.jsx'
import DocumentsSection from '../components/DocumentsSection.jsx'
import CitizenAuditSection from '../components/CitizenAuditSection.jsx'
import { SkeletonLine } from '../components/Skeleton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { fmtDate } from '../utils/dates.js'

const emptyParent = { mode: 'none', citizenId: null, citizenLabel: null, unregisteredName: null }

function parentToPickerValue(id, name, unregisteredName) {
  if (id) return { mode: 'registered', citizenId: id, citizenLabel: name, unregisteredName: null }
  if (unregisteredName) return { mode: 'unregistered', citizenId: null, citizenLabel: null, unregisteredName }
  return emptyParent
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary mb-1">{label}</div>
      <div className="text-sm text-text-primary">{value ?? <span className="text-slate-300">—</span>}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card p-5 mb-4">
      <h2 className="text-sm font-bold text-text-primary mb-4">{title}</h2>
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
// CitizenAuditSection at the bottom is the odd one out: it's gated on
// AUDIT_VIEW rather than CITIZEN_MANAGE/read-access like everything above
// (frontend integration pass Step 8), so it renders nothing at all for
// the majority of users who can see this whole page but hold no audit
// permission.
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
  const [tab, setTab] = useState('overview')

  // Extracted (rather than left inline in the effect below) so a registry
  // transfer's or civil-status amendment's decide action -- both of which
  // can change fields shown in the Civil status section above (office,
  // name, marital status, ...) -- can refresh this page's own citizen
  // state without duplicating the fetch.
  const loadCitizen = useCallback(() => {
    setError(null)
    return client.get(`/citizens/${id}`)
      .then((r) => setCitizen(r.data))
      .catch((err) => {
        // Say why (not found / no permission / server error) instead of one generic line.
        const status = err?.response?.status
        const base = t('citizenDetail.couldNotLoad')
        const detail = apiErrorMessage(err, null, t)
        setError(detail && detail !== base ? `${base} (${status ?? ''} ${detail})`.replace('( ', '(') : status ? `${base} (${status})` : base)
      })
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
      <div className="card p-5">
        <SkeletonLine width="40%" height={22} className="mb-3" />
        <SkeletonLine width="60%" height={14} />
      </div>
    )
  }

  if (error || !citizen) {
    return (
      <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg" role="alert">
        {error ?? t('citizenDetail.couldNotLoad')}
      </div>
    )
  }

  const c = citizen
  const nameEn = [c.firstNameEn, c.middleNameEn, c.lastNameEn].filter(Boolean).join(' ')
  const nameAr = [c.firstNameAr, c.middleNameAr, c.lastNameAr].filter(Boolean).join(' ')
  const tabs = [
    ['overview', t('citizenDetail.tabOverview')],
    ['documents', t('citizenDetail.tabDocuments')],
    ['family', t('citizenDetail.tabFamily')],
    ['changes', t('citizenDetail.tabChanges')],
    ...(hasPermission('AUDIT_VIEW') ? [['audit', t('citizenDetail.tabAudit')]] : []),
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{nameEn || nameAr}</h1>
          <p className="text-sm text-text-secondary mt-1">{c.registryNumber}</p>
        </div>
        {c.deceased && (
          <span className="inline-flex items-center rounded-full border border-badge-draft-bd bg-badge-draft-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            {t('citizens.deceased')}
          </span>
        )}
      </div>

      <div className="card p-5 mb-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label={t('citizenDetail.registryNumber')} value={c.registryNumber} />
        <Field label={t('citizenDetail.dateOfBirth')} value={c.dateOfBirth ? fmtDate(c.dateOfBirth, 'MMM d, yyyy') : null} />
        <Field label={t('citizenDetail.registeredOffice')} value={c.officeName} />
        <Field label={t('citizenDetail.maritalStatus')} value={c.maritalStatus ? t(`citizens.maritalStatus.${c.maritalStatus}`, c.maritalStatus) : null} />
      </div>

      <div role="tablist" aria-label={t('citizenDetail.sections')} className="flex gap-1 border-b border-border-subtle mb-4 overflow-x-auto overflow-y-hidden">
        {tabs.map(([key, label]) => (
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

      {tab === 'overview' && (
      <>
      <Section title={t('citizenDetail.identity')}>
        <Field label={t('citizenDetail.nameEn')} value={nameEn} />
        <Field label={t('citizenDetail.nameAr')} value={nameAr} />
        <Field label={t('citizenDetail.registryNumber')} value={c.registryNumber} />
        <Field label={t('citizenDetail.sijillReference')} value={c.sijillReference} />
        <Field
          label={t('citizenDetail.dateOfBirth')}
          value={c.dateOfBirth ? fmtDate(c.dateOfBirth, 'MMM d, yyyy') : null}
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

      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-text-primary">{t('citizenDetail.lineage')}</h2>
          {/* CITIZEN_MANAGE-gated, matching the backend's own gate on
              PATCH /api/citizens/{id}/lineage (SecurityConfig) -- a user
              without it never sees an edit affordance the API would just
              reject anyway. */}
          {!editingLineage && hasPermission('CITIZEN_MANAGE') && (
            <button
              type="button"
              onClick={startEditingLineage}
              className="text-sm font-semibold text-primary hover:underline"
            >
              {t('citizenDetail.editLineage')}
            </button>
          )}
        </div>

        {editingLineage ? (
          <form onSubmit={handleSaveLineage}>
            {lineageError && (
              <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">
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
                className="btn-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={savingLineage}
                className="btn-primary "
              >
                {savingLineage ? t('citizenDetail.savingLineage') : t('citizenDetail.saveLineage')}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary mb-1">{t('citizenDetail.father')}</div>
              <div className="text-sm">
                {c.fatherId ? (
                  <Link to={`/citizens/${c.fatherId}`} className="font-semibold text-primary hover:underline">
                    {c.fatherName}
                  </Link>
                ) : c.fatherNameUnregistered ? (
                  <span className="text-text-primary">{c.fatherNameUnregistered} <span className="text-text-secondary">({t('citizenDetail.unregistered')})</span></span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary mb-1">{t('citizenDetail.mother')}</div>
              <div className="text-sm">
                {c.motherId ? (
                  <Link to={`/citizens/${c.motherId}`} className="font-semibold text-primary hover:underline">
                    {c.motherName}
                  </Link>
                ) : c.motherNameUnregistered ? (
                  <span className="text-text-primary">{c.motherNameUnregistered} <span className="text-text-secondary">({t('citizenDetail.unregistered')})</span></span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      </>
      )}

      {tab === 'documents' && <DocumentsSection citizenId={c.id} citizenLabel={nameEn || nameAr} />}
      {tab === 'family' && (
        <>
          <FamilyHistorySection citizenId={c.id} citizenLabel={nameEn || nameAr} />
          <GuardianshipSection citizenId={c.id} />
        </>
      )}
      {tab === 'changes' && (
        <>
          <RegistryTransferSection citizenId={c.id} currentOfficeName={c.officeName} onDecided={loadCitizen} />
          <CivilStatusAmendmentSection citizenId={c.id} citizen={c} onDecided={loadCitizen} />
        </>
      )}
      {tab === 'audit' && hasPermission('AUDIT_VIEW') && <CitizenAuditSection citizenId={c.id} />}
    </div>
  )
}
