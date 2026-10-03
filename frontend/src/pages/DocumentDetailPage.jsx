import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import client from '../api/client.js'
import { kindByApiSegment } from '../documentKinds.js'
import { SkeletonLine } from '../components/Skeleton.jsx'
import DocumentReviewSection from '../components/DocumentReviewSection.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

function fmt(d) { return d ? format(new Date(d), 'MMM d, yyyy') : null }

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</div>
      <div className="text-sm text-slate-800">{value ?? <span className="text-slate-300">—</span>}</div>
    </div>
  )
}

// One detail page for the 6 document subtypes that have a per-id GET
// endpoint (national ID cards don't -- see documentKinds.js), dispatching
// on the :apiSegment URL param rather than 6 near-identical pages. Every
// subtype DTO wraps the generic DocumentDto as `document`, shown the same
// way regardless of kind; the fields below it are kind-specific.
export default function DocumentDetailPage() {
  const { t } = useLanguage()
  const { apiSegment, id } = useParams()
  const kind = kindByApiSegment(apiSegment)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!kind) { setError(t('documentRegistry.couldNotLoad')); setLoading(false); return }
    setLoading(true)
    client.get(`/documents/${apiSegment}/${id}`)
      .then((r) => setData(r.data))
      .catch(() => setError(t('documentRegistry.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [apiSegment, id, kind, t])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <SkeletonLine width="40%" height={22} className="mb-3" />
        <SkeletonLine width="60%" height={14} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
        {error ?? t('documentRegistry.couldNotLoad')}
      </div>
    )
  }

  const doc = data.document

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{doc.documentTypeName}</h1>
          <p className="text-sm text-slate-500 mt-1">{doc.documentNumber || '—'}</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {t(`documentRegistry.status.${doc.status}`, doc.status)}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <h2 className="text-sm font-bold text-slate-900 mb-4">{t('documentRegistry.title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label={t('documentRegistry.issueDate')} value={fmt(doc.issueDate)} />
          <Field label={t('documentRegistry.issuingOffice')} value={doc.issuingOfficeName} />
          {kind.key !== 'marriage' && kind.key !== 'divorce' && (
            <Field
              label={t('documentRegistry.citizen')}
              value={<Link to={`/citizens/${doc.citizenId}`} className="font-semibold text-indigo-600 hover:underline">{doc.citizenName}</Link>}
            />
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4">{t('documentRegistry.subtypeDetails')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kind.key === 'birth' && (
            <>
              <Field label={t('documentRegistry.birthPlace')} value={data.birthPlace} />
              <Field label={t('documentRegistry.birthHospital')} value={data.birthHospital} />
              <Field label={t('documentRegistry.birthAttendant')} value={data.birthAttendant} />
              <Field label={t('documentRegistry.fatherFullNameSnapshot')} value={data.fatherFullNameSnapshot} />
              <Field label={t('documentRegistry.motherFullNameSnapshot')} value={data.motherFullNameSnapshot} />
              <Field label={t('documentRegistry.registrationNumber')} value={data.registrationNumber} />
              <Field label={t('documentRegistry.registrarName')} value={data.registrarName} />
            </>
          )}
          {kind.key === 'marriage' && (
            <>
              <Field label={t('documentRegistry.husband')} value={<Link to={`/citizens/${data.husbandId}`} className="font-semibold text-indigo-600 hover:underline">{data.husbandName}</Link>} />
              <Field label={t('documentRegistry.wife')} value={<Link to={`/citizens/${data.wifeId}`} className="font-semibold text-indigo-600 hover:underline">{data.wifeName}</Link>} />
              <Field label={t('documentRegistry.marriageDate')} value={fmt(data.marriageDate)} />
              <Field label={t('documentRegistry.marriagePlace')} value={data.marriagePlace} />
              <Field label={t('documentRegistry.contractNumber')} value={data.contractNumber} />
              <Field label={t('documentRegistry.dowryAmount')} value={data.dowryAmount != null ? `${data.dowryAmount} ${data.dowryCurrency || ''}`.trim() : null} />
              <Field label={t('documentRegistry.unionStatus')} value={t(`documentRegistry.unionStatusLabel.${data.status}`, data.status)} />
            </>
          )}
          {kind.key === 'divorce' && (
            <>
              <Field label={t('documentRegistry.husband')} value={<Link to={`/citizens/${data.husbandId}`} className="font-semibold text-indigo-600 hover:underline">{data.husbandName}</Link>} />
              <Field label={t('documentRegistry.wife')} value={<Link to={`/citizens/${data.wifeId}`} className="font-semibold text-indigo-600 hover:underline">{data.wifeName}</Link>} />
              <Field label={t('documentRegistry.divorceDate')} value={fmt(data.divorceDate)} />
              <Field label={t('documentRegistry.divorceType')} value={data.divorceType ? t(`documentRegistry.divorceTypeLabel.${data.divorceType}`, data.divorceType) : null} />
              <Field
                label={t('documentRegistry.marriageCertificateId')}
                value={<Link to={`/documents/marriage-certificates/${data.marriageCertificateId}`} className="font-semibold text-indigo-600 hover:underline">#{data.marriageCertificateId}</Link>}
              />
            </>
          )}
          {kind.key === 'death' && (
            <>
              <Field label={t('documentRegistry.deathDate')} value={fmt(data.deathDate)} />
              <Field label={t('documentRegistry.deathPlace')} value={data.deathPlace} />
              <Field label={t('documentRegistry.deathCause')} value={data.deathCause} />
              <Field label={t('documentRegistry.certifyingPhysician')} value={data.certifyingPhysician} />
              <Field label={t('documentRegistry.burialPlace')} value={data.burialPlace} />
              <Field label={t('documentRegistry.burialDate')} value={fmt(data.burialDate)} />
            </>
          )}
          {kind.key === 'naturalization' && (
            <>
              <Field label={t('documentRegistry.previousNationality')} value={data.previousNationality} />
              <Field label={t('documentRegistry.naturalizationDate')} value={fmt(data.naturalizationDate)} />
              <Field label={t('documentRegistry.decreeNumber')} value={data.decreeNumber} />
              <Field label={t('documentRegistry.decreeDate')} value={fmt(data.decreeDate)} />
            </>
          )}
          {kind.key === 'nameChange' && (
            <>
              <Field label={t('documentRegistry.oldFirstName')} value={data.oldFirstName} />
              <Field label={t('documentRegistry.newFirstName')} value={data.newFirstName} />
              <Field label={t('documentRegistry.reason')} value={data.reason} />
              <Field label={t('documentRegistry.changeDate')} value={fmt(data.changeDate)} />
              {data.amendmentId && <Field label={t('documentRegistry.amendmentId')} value={`#${data.amendmentId}`} />}
            </>
          )}
        </div>
      </div>

      <DocumentReviewSection documentId={doc.id} />
    </div>
  )
}
