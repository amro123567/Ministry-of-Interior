import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client.js'
import CitizenSearchPicker from '../components/CitizenSearchPicker.jsx'
import DistrictScopedSelect from '../components/DistrictScopedSelect.jsx'
import { DOCUMENT_KINDS } from '../documentKinds.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const inputCls = 'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5'
const emptyPick = { citizenId: null, citizenLabel: null }

// One form for all 7 document subtypes (ERD domain 6) rather than 7
// near-identical pages -- a "Document kind" selector swaps the visible
// fields and target endpoint, the same way a registrar would pick which
// paper form to fill out. Gated CITIZEN_MANAGE at the route level
// (App.jsx), matching SecurityConfig's POST /api/documents/** matcher.
//
// Reached either directly, or via "+ New document" on a citizen's own
// page (DocumentsSection), which pre-fills citizenId/citizenLabel --
// that citizen becomes the subject for every kind with a single
// `citizenId` field, and is pre-picked as husband or wife for a marriage
// certificate based on their recorded gender (just a convenience; either
// side can be changed).
export default function DocumentCreatePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetCitizenId = searchParams.get('citizenId')
  const presetCitizenLabel = searchParams.get('citizenLabel')
  const presetCitizen = presetCitizenId ? { citizenId: Number(presetCitizenId), citizenLabel: presetCitizenLabel } : emptyPick

  const [kind, setKind] = useState(searchParams.get('kind') || 'birth')
  const [documentTypes, setDocumentTypes] = useState([])
  const [offices, setOffices] = useState([])
  const [courts, setCourts] = useState([])
  const [religiousAuthorities, setReligiousAuthorities] = useState([])
  const [mukhtars, setMukhtars] = useState([])
  const [districts, setDistricts] = useState([])
  const [governorates, setGovernorates] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Common fields shared by (most of) the 7 create requests.
  const [documentNumber, setDocumentNumber] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [issuingOfficeId, setIssuingOfficeId] = useState('')

  // Single-citizen kinds: birth, death, nationalId, naturalization, nameChange.
  const [citizen, setCitizen] = useState(presetCitizen)

  // birth-only
  const [attestedByMukhtarId, setAttestedByMukhtarId] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [birthHospital, setBirthHospital] = useState('')
  const [birthAttendant, setBirthAttendant] = useState('')
  const [fatherFullNameSnapshot, setFatherFullNameSnapshot] = useState('')
  const [motherFullNameSnapshot, setMotherFullNameSnapshot] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [registrarName, setRegistrarName] = useState('')

  // marriage-only
  const [husband, setHusband] = useState(presetCitizen)
  const [wife, setWife] = useState(emptyPick)
  const [marriageDate, setMarriageDate] = useState('')
  const [marriagePlace, setMarriagePlace] = useState('')
  const [courtId, setCourtId] = useState('')
  const [religiousAuthorityId, setReligiousAuthorityId] = useState('')
  const [contractNumber, setContractNumber] = useState('')
  const [dowryAmount, setDowryAmount] = useState('')
  const [dowryCurrency, setDowryCurrency] = useState('')

  // divorce-only
  const [marriageCertificateId, setMarriageCertificateId] = useState('')
  const [divorceDate, setDivorceDate] = useState('')
  const [divorcePlace, setDivorcePlace] = useState('')
  const [courtDecisionNumber, setCourtDecisionNumber] = useState('')
  const [divorceType, setDivorceType] = useState('JUDICIAL')
  const [divorceReason, setDivorceReason] = useState('')
  const [childCustodyAgreement, setChildCustodyAgreement] = useState('')
  const [financialSettlement, setFinancialSettlement] = useState('')
  const [settlementAmount, setSettlementAmount] = useState('')
  const [settlementCurrency, setSettlementCurrency] = useState('')
  const [shariaCourtApproval, setShariaCourtApproval] = useState('')

  // death-only
  const [deathDate, setDeathDate] = useState('')
  const [deathPlace, setDeathPlace] = useState('')
  const [deathCause, setDeathCause] = useState('')
  const [certifyingPhysician, setCertifyingPhysician] = useState('')
  const [burialPlace, setBurialPlace] = useState('')
  const [burialDate, setBurialDate] = useState('')

  // nationalId-only
  const [expiryDate, setExpiryDate] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [chipSerialNumber, setChipSerialNumber] = useState('')

  // naturalization-only
  const [previousNationality, setPreviousNationality] = useState('')
  const [naturalizationDate, setNaturalizationDate] = useState('')
  const [decreeNumber, setDecreeNumber] = useState('')
  const [decreeDate, setDecreeDate] = useState('')

  // nameChange-only
  const [amendmentId, setAmendmentId] = useState('')
  const [oldFirstName, setOldFirstName] = useState('')
  const [oldMiddleName, setOldMiddleName] = useState('')
  const [oldLastName, setOldLastName] = useState('')
  const [newFirstName, setNewFirstName] = useState('')
  const [newMiddleName, setNewMiddleName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    client.get('/document-types').then((r) => setDocumentTypes(r.data))
    client.get('/offices').then((r) => setOffices(r.data))
    client.get('/courts').then((r) => setCourts(r.data.filter((c) => c.active !== false)))
    client.get('/religious-authorities').then((r) => setReligiousAuthorities(r.data.filter((a) => a.active !== false)))
    client.get('/mukhtars').then((r) => setMukhtars(r.data.filter((m) => m.active !== false)))
    client.get('/governorates').then((r) => setGovernorates(r.data.filter((g) => g.active !== false)))
    client.get('/districts').then((r) => setDistricts(r.data.filter((d) => d.active !== false)))
  }, [])

  // Pre-pick which side of a marriage certificate the incoming citizen
  // fills, from their recorded gender -- purely a convenience default,
  // either search picker can still be changed freely.
  useEffect(() => {
    if (!presetCitizenId) return
    client.get(`/citizens/${presetCitizenId}`).then((r) => {
      if (r.data.gender === 'F') { setWife(presetCitizen); setHusband(emptyPick) }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetCitizenId])

  const activeKind = useMemo(() => DOCUMENT_KINDS.find((k) => k.key === kind), [kind])

  function documentTypeIdFor(typeCode) {
    return documentTypes.find((d) => d.code === typeCode)?.id ?? null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const documentTypeId = documentTypeIdFor(activeKind.typeCode)
    if (!documentTypeId) {
      setError(t('documentRegistry.errorNoDocumentType'));
      return
    }
    let path;
    let payload;
    switch (kind) {
      case 'birth':
        if (!citizen.citizenId) { setError(t('documentRegistry.errorRequired')); return }
        path = '/documents/birth-certificates'
        payload = {
          citizenId: citizen.citizenId, documentTypeId, documentNumber: documentNumber || null,
          issueDate: issueDate || null, issuingOfficeId: issuingOfficeId ? Number(issuingOfficeId) : null,
          attestedByMukhtarId: attestedByMukhtarId ? Number(attestedByMukhtarId) : null,
          birthPlace: birthPlace || null, birthHospital: birthHospital || null, birthAttendant: birthAttendant || null,
          fatherFullNameSnapshot: fatherFullNameSnapshot || null, motherFullNameSnapshot: motherFullNameSnapshot || null,
          registrationNumber: registrationNumber || null, registrarName: registrarName || null,
        }
        break
      case 'marriage':
        if (!husband.citizenId || !wife.citizenId) { setError(t('documentRegistry.errorRequired')); return }
        path = '/documents/marriage-certificates'
        payload = {
          husbandId: husband.citizenId, wifeId: wife.citizenId, documentTypeId, documentNumber: documentNumber || null,
          issueDate: issueDate || null, issuingOfficeId: issuingOfficeId ? Number(issuingOfficeId) : null,
          marriageDate: marriageDate || null, marriagePlace: marriagePlace || null,
          courtId: courtId ? Number(courtId) : null, religiousAuthorityId: religiousAuthorityId ? Number(religiousAuthorityId) : null,
          contractNumber: contractNumber || null, dowryAmount: dowryAmount ? Number(dowryAmount) : null,
          dowryCurrency: dowryCurrency || null,
        }
        break
      case 'divorce':
        if (!marriageCertificateId) { setError(t('documentRegistry.errorRequired')); return }
        path = '/documents/divorce-certificates'
        payload = {
          marriageCertificateId: Number(marriageCertificateId), documentTypeId, documentNumber: documentNumber || null,
          issueDate: issueDate || null, issuingOfficeId: issuingOfficeId ? Number(issuingOfficeId) : null,
          divorceDate: divorceDate || null, divorcePlace: divorcePlace || null,
          courtId: courtId ? Number(courtId) : null, courtDecisionNumber: courtDecisionNumber || null,
          divorceType: divorceType || null, divorceReason: divorceReason || null,
          childCustodyAgreement: childCustodyAgreement || null, financialSettlement: financialSettlement || null,
          settlementAmount: settlementAmount ? Number(settlementAmount) : null, settlementCurrency: settlementCurrency || null,
          religiousAuthorityId: religiousAuthorityId ? Number(religiousAuthorityId) : null,
          shariaCourtApproval: shariaCourtApproval || null,
        }
        break
      case 'death':
        if (!citizen.citizenId || !deathDate) { setError(t('documentRegistry.errorRequired')); return }
        path = '/documents/death-certificates'
        payload = {
          citizenId: citizen.citizenId, documentTypeId, documentNumber: documentNumber || null,
          issueDate: issueDate || null, issuingOfficeId: issuingOfficeId ? Number(issuingOfficeId) : null,
          deathDate, deathPlace: deathPlace || null, deathCause: deathCause || null,
          certifyingPhysician: certifyingPhysician || null, burialPlace: burialPlace || null,
          burialDate: burialDate || null,
        }
        break
      case 'nationalId':
        if (!citizen.citizenId || !cardNumber.trim()) { setError(t('documentRegistry.errorRequired')); return }
        path = '/documents/national-id-cards'
        payload = {
          citizenId: citizen.citizenId, documentTypeId, documentNumber: documentNumber || null,
          issueDate: issueDate || null, expiryDate: expiryDate || null,
          issuingOfficeId: issuingOfficeId ? Number(issuingOfficeId) : null, cardNumber: cardNumber.trim(),
          chipSerialNumber: chipSerialNumber || null,
        }
        break
      case 'naturalization':
        if (!citizen.citizenId || !decreeNumber.trim()) { setError(t('documentRegistry.errorRequired')); return }
        path = '/documents/naturalization-records'
        payload = {
          citizenId: citizen.citizenId, documentTypeId, documentNumber: documentNumber || null,
          issueDate: issueDate || null, issuingOfficeId: issuingOfficeId ? Number(issuingOfficeId) : null,
          previousNationality: previousNationality || null, naturalizationDate: naturalizationDate || null,
          decreeNumber: decreeNumber.trim(), decreeDate: decreeDate || null,
        }
        break
      case 'nameChange':
        if (!citizen.citizenId || !newFirstName.trim()) { setError(t('documentRegistry.errorRequired')); return }
        path = '/documents/name-change-records'
        payload = {
          citizenId: citizen.citizenId, documentTypeId, documentNumber: documentNumber || null,
          issueDate: issueDate || null, issuingOfficeId: issuingOfficeId ? Number(issuingOfficeId) : null,
          amendmentId: amendmentId ? Number(amendmentId) : null,
          oldFirstName: oldFirstName || null, oldMiddleName: oldMiddleName || null, oldLastName: oldLastName || null,
          newFirstName: newFirstName.trim(), newMiddleName: newMiddleName || null, newLastName: newLastName || null,
          reason: reason || null, courtDecisionNumber: courtDecisionNumber || null, changeDate: null,
        }
        break
      default:
        return
    }

    setBusy(true)
    try {
      const res = await client.post(path, payload)
      const documentId = res.data.document.id
      if (activeKind.hasDetailRoute) navigate(`/documents/${activeKind.apiSegment}/${documentId}`)
      else if (citizen.citizenId) navigate(`/citizens/${citizen.citizenId}`)
      else navigate(-1)
    } catch (err) {
      setError(err.response?.data?.message ?? t('documentRegistry.errorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-5">{t('documentRegistry.createTitle')}</h1>
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-7 max-w-3xl">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-5" role="alert">{error}</div>
        )}

        <div className="mb-6">
          <label className={labelCls} htmlFor="doc-kind">{t('documentRegistry.kind')}</label>
          <select id="doc-kind" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
            {DOCUMENT_KINDS.map((k) => <option key={k.key} value={k.key}>{t(k.labelKey)}</option>)}
          </select>
        </div>

        <h2 className="text-sm font-bold text-slate-900 mb-4">{t('documentRegistry.sectionCommon')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-6 mb-6 border-b border-slate-100">
          <div>
            <label className={labelCls} htmlFor="doc-number">{t('documentRegistry.documentNumber')}</label>
            <input id="doc-number" className={inputCls} value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="doc-issue-date">{t('documentRegistry.issueDate')}</label>
            <input id="doc-issue-date" type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <DistrictScopedSelect
              id="doc-office"
              label={t('documentRegistry.issuingOffice')}
              className={inputCls}
              labelClassName={labelCls}
              items={offices}
              districts={districts}
              governorates={governorates}
              value={issuingOfficeId}
              onChange={setIssuingOfficeId}
              noneLabel={t('citizenCreate.officeNone')}
            />
          </div>
        </div>

        {(kind === 'birth' || kind === 'death' || kind === 'nationalId' || kind === 'naturalization' || kind === 'nameChange') && (
          <div className="mb-6">
            <CitizenSearchPicker label={`${t('documentRegistry.citizen')} *`} value={citizen} onChange={setCitizen} />
          </div>
        )}

        {kind === 'birth' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <DistrictScopedSelect
                id="b-mukhtar"
                label={t('documentRegistry.attestedByMukhtar')}
                className={inputCls}
                labelClassName={labelCls}
                items={mukhtars}
                districts={districts}
                governorates={governorates}
                value={attestedByMukhtarId}
                onChange={setAttestedByMukhtarId}
                noneLabel={t('civilStatusAmendment.courtNone')}
                itemLabel={(m) => [m.firstNameEn, m.lastNameEn].filter(Boolean).join(' ')}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="b-place">{t('documentRegistry.birthPlace')}</label>
              <input id="b-place" className={inputCls} value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="b-hospital">{t('documentRegistry.birthHospital')}</label>
              <input id="b-hospital" className={inputCls} value={birthHospital} onChange={(e) => setBirthHospital(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="b-attendant">{t('documentRegistry.birthAttendant')}</label>
              <input id="b-attendant" className={inputCls} value={birthAttendant} onChange={(e) => setBirthAttendant(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="b-father">{t('documentRegistry.fatherFullNameSnapshot')}</label>
              <input id="b-father" className={inputCls} value={fatherFullNameSnapshot} onChange={(e) => setFatherFullNameSnapshot(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="b-mother">{t('documentRegistry.motherFullNameSnapshot')}</label>
              <input id="b-mother" className={inputCls} value={motherFullNameSnapshot} onChange={(e) => setMotherFullNameSnapshot(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="b-reg-number">{t('documentRegistry.registrationNumber')}</label>
              <input id="b-reg-number" className={inputCls} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="b-registrar">{t('documentRegistry.registrarName')}</label>
              <input id="b-registrar" className={inputCls} value={registrarName} onChange={(e) => setRegistrarName(e.target.value)} />
            </div>
          </div>
        )}

        {kind === 'marriage' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <CitizenSearchPicker label={`${t('documentRegistry.husband')} *`} value={husband} onChange={setHusband} excludeCitizenId={wife.citizenId} />
            <CitizenSearchPicker label={`${t('documentRegistry.wife')} *`} value={wife} onChange={setWife} excludeCitizenId={husband.citizenId} />
            <div>
              <label className={labelCls} htmlFor="m-date">{t('documentRegistry.marriageDate')}</label>
              <input id="m-date" type="date" className={inputCls} value={marriageDate} onChange={(e) => setMarriageDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="m-place">{t('documentRegistry.marriagePlace')}</label>
              <input id="m-place" className={inputCls} value={marriagePlace} onChange={(e) => setMarriagePlace(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <DistrictScopedSelect
                id="m-court"
                label={t('guardianship.court')}
                className={inputCls}
                labelClassName={labelCls}
                items={courts}
                districts={districts}
                governorates={governorates}
                value={courtId}
                onChange={setCourtId}
                noneLabel={t('civilStatusAmendment.courtNone')}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="m-religious">{t('documentRegistry.religiousAuthority')}</label>
              <select id="m-religious" className={inputCls} value={religiousAuthorityId} onChange={(e) => setReligiousAuthorityId(e.target.value)}>
                <option value="">{t('civilStatusAmendment.courtNone')}</option>
                {religiousAuthorities.map((a) => <option key={a.id} value={a.id}>{a.nameEn}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="m-contract">{t('documentRegistry.contractNumber')}</label>
              <input id="m-contract" className={inputCls} value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="m-dowry">{t('documentRegistry.dowryAmount')}</label>
              <input id="m-dowry" type="number" step="0.01" className={inputCls} value={dowryAmount} onChange={(e) => setDowryAmount(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="m-dowry-currency">{t('documentRegistry.dowryCurrency')}</label>
              <input id="m-dowry-currency" className={inputCls} value={dowryCurrency} onChange={(e) => setDowryCurrency(e.target.value)} />
            </div>
          </div>
        )}

        {kind === 'divorce' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="d-marriage-id">
                {t('documentRegistry.marriageCertificateId')} <span className="text-red-500">*</span>
              </label>
              <input id="d-marriage-id" type="number" className={inputCls} required
                value={marriageCertificateId} onChange={(e) => setMarriageCertificateId(e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">{t('documentRegistry.marriageCertificateIdHint')}</p>
            </div>
            <div>
              <label className={labelCls} htmlFor="d-date">{t('documentRegistry.divorceDate')}</label>
              <input id="d-date" type="date" className={inputCls} value={divorceDate} onChange={(e) => setDivorceDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="d-place">{t('documentRegistry.divorcePlace')}</label>
              <input id="d-place" className={inputCls} value={divorcePlace} onChange={(e) => setDivorcePlace(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <DistrictScopedSelect
                id="d-court"
                label={t('guardianship.court')}
                className={inputCls}
                labelClassName={labelCls}
                items={courts}
                districts={districts}
                governorates={governorates}
                value={courtId}
                onChange={setCourtId}
                noneLabel={t('civilStatusAmendment.courtNone')}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="d-court-decision">{t('guardianship.courtDecisionNumber')}</label>
              <input id="d-court-decision" className={inputCls} value={courtDecisionNumber} onChange={(e) => setCourtDecisionNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="d-type">{t('documentRegistry.divorceType')}</label>
              <select id="d-type" className={inputCls} value={divorceType} onChange={(e) => setDivorceType(e.target.value)}>
                <option value="JUDICIAL">{t('documentRegistry.divorceTypeLabel.JUDICIAL')}</option>
                <option value="RELIGIOUS">{t('documentRegistry.divorceTypeLabel.RELIGIOUS')}</option>
                <option value="MUTUAL_CONSENT">{t('documentRegistry.divorceTypeLabel.MUTUAL_CONSENT')}</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="d-religious">{t('documentRegistry.religiousAuthority')}</label>
              <select id="d-religious" className={inputCls} value={religiousAuthorityId} onChange={(e) => setReligiousAuthorityId(e.target.value)}>
                <option value="">{t('civilStatusAmendment.courtNone')}</option>
                {religiousAuthorities.map((a) => <option key={a.id} value={a.id}>{a.nameEn}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="d-reason">{t('documentRegistry.divorceReason')}</label>
              <input id="d-reason" className={inputCls} value={divorceReason} onChange={(e) => setDivorceReason(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="d-custody">{t('documentRegistry.childCustodyAgreement')}</label>
              <input id="d-custody" className={inputCls} value={childCustodyAgreement} onChange={(e) => setChildCustodyAgreement(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="d-settlement">{t('documentRegistry.financialSettlement')}</label>
              <input id="d-settlement" className={inputCls} value={financialSettlement} onChange={(e) => setFinancialSettlement(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="d-settlement-amount">{t('documentRegistry.settlementAmount')}</label>
              <input id="d-settlement-amount" type="number" step="0.01" className={inputCls} value={settlementAmount} onChange={(e) => setSettlementAmount(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="d-settlement-currency">{t('documentRegistry.settlementCurrency')}</label>
              <input id="d-settlement-currency" className={inputCls} value={settlementCurrency} onChange={(e) => setSettlementCurrency(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="d-sharia">{t('documentRegistry.shariaCourtApproval')}</label>
              <input id="d-sharia" className={inputCls} value={shariaCourtApproval} onChange={(e) => setShariaCourtApproval(e.target.value)} />
            </div>
          </div>
        )}

        {kind === 'death' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls} htmlFor="de-date">
                {t('documentRegistry.deathDate')} <span className="text-red-500">*</span>
              </label>
              <input id="de-date" type="date" className={inputCls} required value={deathDate} onChange={(e) => setDeathDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="de-place">{t('documentRegistry.deathPlace')}</label>
              <input id="de-place" className={inputCls} value={deathPlace} onChange={(e) => setDeathPlace(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="de-cause">{t('documentRegistry.deathCause')}</label>
              <input id="de-cause" className={inputCls} value={deathCause} onChange={(e) => setDeathCause(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="de-physician">{t('documentRegistry.certifyingPhysician')}</label>
              <input id="de-physician" className={inputCls} value={certifyingPhysician} onChange={(e) => setCertifyingPhysician(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="de-burial-place">{t('documentRegistry.burialPlace')}</label>
              <input id="de-burial-place" className={inputCls} value={burialPlace} onChange={(e) => setBurialPlace(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="de-burial-date">{t('documentRegistry.burialDate')}</label>
              <input id="de-burial-date" type="date" className={inputCls} value={burialDate} onChange={(e) => setBurialDate(e.target.value)} />
            </div>
          </div>
        )}

        {kind === 'nationalId' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls} htmlFor="n-expiry">{t('documentRegistry.expiryDate')}</label>
              <input id="n-expiry" type="date" className={inputCls} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="n-card-number">
                {t('documentRegistry.cardNumber')} <span className="text-red-500">*</span>
              </label>
              <input id="n-card-number" className={inputCls} required value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="n-chip">{t('documentRegistry.chipSerialNumber')}</label>
              <input id="n-chip" className={inputCls} value={chipSerialNumber} onChange={(e) => setChipSerialNumber(e.target.value)} />
            </div>
          </div>
        )}

        {kind === 'naturalization' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls} htmlFor="nat-prev">{t('documentRegistry.previousNationality')}</label>
              <input id="nat-prev" className={inputCls} value={previousNationality} onChange={(e) => setPreviousNationality(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="nat-date">{t('documentRegistry.naturalizationDate')}</label>
              <input id="nat-date" type="date" className={inputCls} value={naturalizationDate} onChange={(e) => setNaturalizationDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="nat-decree">
                {t('documentRegistry.decreeNumber')} <span className="text-red-500">*</span>
              </label>
              <input id="nat-decree" className={inputCls} required value={decreeNumber} onChange={(e) => setDecreeNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="nat-decree-date">{t('documentRegistry.decreeDate')}</label>
              <input id="nat-decree-date" type="date" className={inputCls} value={decreeDate} onChange={(e) => setDecreeDate(e.target.value)} />
            </div>
          </div>
        )}

        {kind === 'nameChange' && (
          <div>
            <div className="mb-4">
              <label className={labelCls} htmlFor="nc-amendment">{t('documentRegistry.amendmentId')}</label>
              <input id="nc-amendment" type="number" className={inputCls} value={amendmentId} onChange={(e) => setAmendmentId(e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">{t('documentRegistry.amendmentIdHint')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-1">
              <div>
                <label className={labelCls} htmlFor="nc-old-first">{t('documentRegistry.oldFirstName')}</label>
                <input id="nc-old-first" className={inputCls} value={oldFirstName} onChange={(e) => setOldFirstName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="nc-old-middle">{t('documentRegistry.oldMiddleName')}</label>
                <input id="nc-old-middle" className={inputCls} value={oldMiddleName} onChange={(e) => setOldMiddleName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="nc-old-last">{t('documentRegistry.oldLastName')}</label>
                <input id="nc-old-last" className={inputCls} value={oldLastName} onChange={(e) => setOldLastName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="nc-new-first">
                  {t('documentRegistry.newFirstName')} <span className="text-red-500">*</span>
                </label>
                <input id="nc-new-first" className={inputCls} required value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="nc-new-middle">{t('documentRegistry.newMiddleName')}</label>
                <input id="nc-new-middle" className={inputCls} value={newMiddleName} onChange={(e) => setNewMiddleName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="nc-new-last">{t('documentRegistry.newLastName')}</label>
                <input id="nc-new-last" className={inputCls} value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelCls} htmlFor="nc-reason">{t('documentRegistry.reason')}</label>
                <input id="nc-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="nc-court-decision">{t('guardianship.courtDecisionNumber')}</label>
                <input id="nc-court-decision" className={inputCls} value={courtDecisionNumber} onChange={(e) => setCourtDecisionNumber(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2.5 mt-7 pt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? t('documentRegistry.submitting') : t('documentRegistry.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
