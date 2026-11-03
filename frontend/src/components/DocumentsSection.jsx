import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client.js'
import { kindByTypeCode } from '../documentKinds.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { Badge } from './ui/index.jsx'
import { fmtDate } from '../utils/dates.js'

const DOC_STATUS_STYLES = {
  DRAFT: 'draft',
  ISSUED: 'success',
  REVOKED: 'danger',
  SUPERSEDED: 'warning',
  EXPIRED: 'draft',
}

function DocStatusBadge({ status, t }) {
  const style = DOC_STATUS_STYLES[status] || DOC_STATUS_STYLES.DRAFT
  return <Badge tone={style}>{t(`documentRegistry.status.${status}`, status)}</Badge>
}

// The generic Document supertype list (GET /api/citizens/{id}/documents)
// for a citizen, covering all 7 subtypes issued to them. Each row links
// to its own subtype detail page via documentTypeCode -> DOCUMENT_KINDS,
// except National ID cards, which have no per-id GET endpoint on the
// backend (only the citizen-scoped list) -- those are expanded inline
// from a second fetch instead of linking to a route the API can't serve.
export default function DocumentsSection({ citizenId, citizenLabel }) {
  const { t } = useLanguage()
  const { hasPermission } = useAuth()
  const [documents, setDocuments] = useState([])
  const [nationalIdCards, setNationalIdCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedCardId, setExpandedCardId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      client.get(`/citizens/${citizenId}/documents`),
      client.get(`/citizens/${citizenId}/national-id-cards`),
    ])
      .then(([docsRes, cardsRes]) => {
        setDocuments(docsRes.data)
        setNationalIdCards(cardsRes.data)
      })
      .catch(() => setError(t('documentRegistry.couldNotLoad')))
      .finally(() => setLoading(false))
  }, [citizenId, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-text-primary">{t('documentRegistry.title')}</h2>
        {hasPermission('CITIZEN_MANAGE') && (
          <Link
            to={`/documents/new?citizenId=${citizenId}&citizenLabel=${encodeURIComponent(citizenLabel || '')}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t('documentRegistry.newDocument')}
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg" role="alert">{error}</div>
      )}

      {!error && loading && <p className="text-sm text-text-secondary">{t('common.loading')}</p>}

      {!error && !loading && (
        documents.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('documentRegistry.empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((d) => {
              const kind = kindByTypeCode(d.documentTypeCode)
              const card = d.documentTypeCode === 'NATIONAL_ID'
                ? nationalIdCards.find((c) => c.document.id === d.id)
                : null
              return (
                <li key={d.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold text-text-primary">{d.documentTypeName}</span>
                      {d.documentNumber && <span className="text-xs text-text-secondary ms-2">{d.documentNumber}</span>}
                    </div>
                    <DocStatusBadge status={d.status} t={t} />
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    {d.issueDate ? fmtDate(d.issueDate, 'MMM d, yyyy') : '—'}
                    {d.issuingOfficeName && ` · ${d.issuingOfficeName}`}
                  </div>
                  {kind?.hasDetailRoute && (
                    <Link to={`/documents/${kind.apiSegment}/${d.id}`} className="mt-1 inline-block text-xs font-semibold text-primary hover:underline">
                      {t('documentRegistry.viewDocument')}
                    </Link>
                  )}
                  {card && (
                    expandedCardId === d.id ? (
                      <div className="mt-2 rounded-lg bg-app p-3 text-xs text-text-secondary grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div><span className="font-semibold text-text-secondary">{t('documentRegistry.cardNumber')}:</span> {card.cardNumber}</div>
                        <div><span className="font-semibold text-text-secondary">{t('documentRegistry.cardStatus')}:</span> {card.status}</div>
                        {card.chipSerialNumber && <div><span className="font-semibold text-text-secondary">{t('documentRegistry.chipSerialNumber')}:</span> {card.chipSerialNumber}</div>}
                        {d.expiryDate && <div><span className="font-semibold text-text-secondary">{t('documentRegistry.expiryDate')}:</span> {fmtDate(d.expiryDate, 'MMM d, yyyy')}</div>}
                      </div>
                    ) : (
                      <button type="button" onClick={() => setExpandedCardId(d.id)} className="mt-1 block text-xs font-semibold text-primary hover:underline">
                        {t('documentRegistry.viewDocument')}
                      </button>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        )
      )}
    </div>
  )
}
