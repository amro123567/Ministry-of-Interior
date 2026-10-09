import CitizenSearchPicker from '../CitizenSearchPicker.jsx'
import DistrictScopedSelect from '../DistrictScopedSelect.jsx'
import { Field, inputCls, labelCls, num, text } from './fields.jsx'

// One entry per document kind (ERD domain 6). Each has:
//   initial   -- the kind's own field values (the page resets to this when the kind changes)
//   Fields    -- the kind-specific inputs
//   build     -- turns the values into { path, payload }, or null when a required value is missing.
//               `common` holds documentTypeId, documentNumber, issueDate and issuingOfficeId.
// Keeping the field lists apart means each kind can be read, tested and changed on its own, and
// a value typed for one kind can no longer leak into another one.

const withCommon = (c) => ({
  documentTypeId: c.documentTypeId,
  documentNumber: text(c.documentNumber),
  issueDate: text(c.issueDate),
  issuingOfficeId: num(c.issuingOfficeId),
})

function CourtSelect({ id, ctx, values, set }) {
  return (
    <div className="sm:col-span-2">
      <DistrictScopedSelect
        id={id}
        label={ctx.t('guardianship.court')}
        className={inputCls}
        labelClassName={labelCls}
        items={ctx.courts}
        districts={ctx.districts}
        governorates={ctx.governorates}
        value={values.courtId}
        onChange={(v) => set('courtId', v)}
        noneLabel={ctx.t('civilStatusAmendment.courtNone')}
      />
    </div>
  )
}

function ReligiousSelect({ id, ctx, values, set }) {
  return (
    <div>
      <label className={labelCls} htmlFor={id}>{ctx.t('documentRegistry.religiousAuthority')}</label>
      <select id={id} className={inputCls} value={values.religiousAuthorityId} onChange={(e) => set('religiousAuthorityId', e.target.value)}>
        <option value="">{ctx.t('civilStatusAmendment.courtNone')}</option>
        {ctx.religiousAuthorities.map((a) => <option key={a.id} value={a.id}>{a.nameEn}</option>)}
      </select>
    </div>
  )
}

const grid = 'grid grid-cols-1 sm:grid-cols-2 gap-5'

const birth = {
  needsCitizen: true,
  initial: { attestedByMukhtarId: '', birthPlace: '', birthHospital: '', birthAttendant: '', fatherFullNameSnapshot: '', motherFullNameSnapshot: '', registrationNumber: '', registrarName: '' },
  Fields({ values, set, ctx }) {
    const f = (id, name) => <Field id={id} name={name} values={values} set={set} label={ctx.t(`documentRegistry.${name}`)} />
    return (
      <div className={grid}>
        <div className="sm:col-span-2">
          <DistrictScopedSelect
            id="b-mukhtar"
            label={ctx.t('documentRegistry.attestedByMukhtar')}
            className={inputCls}
            labelClassName={labelCls}
            items={ctx.mukhtars}
            districts={ctx.districts}
            governorates={ctx.governorates}
            value={values.attestedByMukhtarId}
            onChange={(v) => set('attestedByMukhtarId', v)}
            noneLabel={ctx.t('civilStatusAmendment.courtNone')}
            itemLabel={(m) => [m.firstNameEn, m.lastNameEn].filter(Boolean).join(' ')}
          />
        </div>
        {f('b-place', 'birthPlace')}
        {f('b-hospital', 'birthHospital')}
        {f('b-attendant', 'birthAttendant')}
        {f('b-father', 'fatherFullNameSnapshot')}
        {f('b-mother', 'motherFullNameSnapshot')}
        {f('b-reg-number', 'registrationNumber')}
        {f('b-registrar', 'registrarName')}
      </div>
    )
  },
  build: (v, { common, citizen }) => !citizen.citizenId ? null : {
    path: '/documents/birth-certificates',
    payload: {
      citizenId: citizen.citizenId, ...withCommon(common),
      attestedByMukhtarId: num(v.attestedByMukhtarId),
      birthPlace: text(v.birthPlace), birthHospital: text(v.birthHospital), birthAttendant: text(v.birthAttendant),
      fatherFullNameSnapshot: text(v.fatherFullNameSnapshot), motherFullNameSnapshot: text(v.motherFullNameSnapshot),
      registrationNumber: text(v.registrationNumber), registrarName: text(v.registrarName),
    },
  },
}

const marriage = {
  needsCitizen: false,
  initial: { marriageDate: '', marriagePlace: '', courtId: '', religiousAuthorityId: '', contractNumber: '', dowryAmount: '', dowryCurrency: '' },
  Fields({ values, set, ctx }) {
    const { husband, wife, setHusband, setWife } = ctx
    const f = (id, name, extra) => <Field id={id} name={name} values={values} set={set} label={ctx.t(`documentRegistry.${name}`)} {...extra} />
    return (
      <div className={grid}>
        <CitizenSearchPicker label={`${ctx.t('documentRegistry.husband')} *`} value={husband} onChange={setHusband} excludeCitizenId={wife.citizenId} />
        <CitizenSearchPicker label={`${ctx.t('documentRegistry.wife')} *`} value={wife} onChange={setWife} excludeCitizenId={husband.citizenId} />
        {f('m-date', 'marriageDate', { type: 'date' })}
        {f('m-place', 'marriagePlace')}
        <CourtSelect id="m-court" ctx={ctx} values={values} set={set} />
        <ReligiousSelect id="m-religious" ctx={ctx} values={values} set={set} />
        {f('m-contract', 'contractNumber')}
        {f('m-dowry', 'dowryAmount', { type: 'number', step: '0.01' })}
        {f('m-dowry-currency', 'dowryCurrency')}
      </div>
    )
  },
  build: (v, { common, husband, wife }) => (!husband.citizenId || !wife.citizenId) ? null : {
    path: '/documents/marriage-certificates',
    payload: {
      husbandId: husband.citizenId, wifeId: wife.citizenId, ...withCommon(common),
      marriageDate: text(v.marriageDate), marriagePlace: text(v.marriagePlace),
      courtId: num(v.courtId), religiousAuthorityId: num(v.religiousAuthorityId),
      contractNumber: text(v.contractNumber), dowryAmount: num(v.dowryAmount), dowryCurrency: text(v.dowryCurrency),
    },
  },
}

const divorce = {
  needsCitizen: false,
  initial: {
    marriageCertificateId: '', divorceDate: '', divorcePlace: '', courtId: '', courtDecisionNumber: '', divorceType: 'JUDICIAL',
    religiousAuthorityId: '', divorceReason: '', childCustodyAgreement: '', financialSettlement: '', settlementAmount: '',
    settlementCurrency: '', shariaCourtApproval: '',
  },
  Fields({ values, set, ctx }) {
    const f = (id, name, extra) => <Field id={id} name={name} values={values} set={set} label={ctx.t(`documentRegistry.${name}`)} {...extra} />
    return (
      <div className={grid}>
        {f('d-marriage-id', 'marriageCertificateId', { type: 'number', required: true, wide: true, hint: ctx.t('documentRegistry.marriageCertificateIdHint') })}
        {f('d-date', 'divorceDate', { type: 'date' })}
        {f('d-place', 'divorcePlace')}
        <CourtSelect id="d-court" ctx={ctx} values={values} set={set} />
        <Field id="d-court-decision" name="courtDecisionNumber" values={values} set={set} label={ctx.t('guardianship.courtDecisionNumber')} />
        <div>
          <label className={labelCls} htmlFor="d-type">{ctx.t('documentRegistry.divorceType')}</label>
          <select id="d-type" className={inputCls} value={values.divorceType} onChange={(e) => set('divorceType', e.target.value)}>
            {['JUDICIAL', 'RELIGIOUS', 'MUTUAL_CONSENT'].map((k) => (
              <option key={k} value={k}>{ctx.t(`documentRegistry.divorceTypeLabel.${k}`)}</option>
            ))}
          </select>
        </div>
        <ReligiousSelect id="d-religious" ctx={ctx} values={values} set={set} />
        {f('d-reason', 'divorceReason', { wide: true })}
        {f('d-custody', 'childCustodyAgreement', { wide: true })}
        {f('d-settlement', 'financialSettlement')}
        {f('d-settlement-amount', 'settlementAmount', { type: 'number', step: '0.01' })}
        {f('d-settlement-currency', 'settlementCurrency')}
        {f('d-sharia', 'shariaCourtApproval')}
      </div>
    )
  },
  build: (v, { common }) => !v.marriageCertificateId ? null : {
    path: '/documents/divorce-certificates',
    payload: {
      marriageCertificateId: Number(v.marriageCertificateId), ...withCommon(common),
      divorceDate: text(v.divorceDate), divorcePlace: text(v.divorcePlace),
      courtId: num(v.courtId), courtDecisionNumber: text(v.courtDecisionNumber),
      divorceType: text(v.divorceType), divorceReason: text(v.divorceReason),
      childCustodyAgreement: text(v.childCustodyAgreement), financialSettlement: text(v.financialSettlement),
      settlementAmount: num(v.settlementAmount), settlementCurrency: text(v.settlementCurrency),
      religiousAuthorityId: num(v.religiousAuthorityId), shariaCourtApproval: text(v.shariaCourtApproval),
    },
  },
}

const death = {
  needsCitizen: true,
  initial: { deathDate: '', deathPlace: '', deathCause: '', certifyingPhysician: '', burialPlace: '', burialDate: '' },
  Fields({ values, set, ctx }) {
    const f = (id, name, extra) => <Field id={id} name={name} values={values} set={set} label={ctx.t(`documentRegistry.${name}`)} {...extra} />
    return (
      <div className={grid}>
        {f('de-date', 'deathDate', { type: 'date', required: true })}
        {f('de-place', 'deathPlace')}
        {f('de-cause', 'deathCause')}
        {f('de-physician', 'certifyingPhysician')}
        {f('de-burial-place', 'burialPlace')}
        {f('de-burial-date', 'burialDate', { type: 'date' })}
      </div>
    )
  },
  build: (v, { common, citizen }) => (!citizen.citizenId || !v.deathDate) ? null : {
    path: '/documents/death-certificates',
    payload: {
      citizenId: citizen.citizenId, ...withCommon(common),
      deathDate: v.deathDate, deathPlace: text(v.deathPlace), deathCause: text(v.deathCause),
      certifyingPhysician: text(v.certifyingPhysician), burialPlace: text(v.burialPlace), burialDate: text(v.burialDate),
    },
  },
}

const nationalId = {
  needsCitizen: true,
  initial: { expiryDate: '', cardNumber: '', chipSerialNumber: '' },
  Fields({ values, set, ctx }) {
    const f = (id, name, extra) => <Field id={id} name={name} values={values} set={set} label={ctx.t(`documentRegistry.${name}`)} {...extra} />
    return (
      <div className={grid}>
        {f('n-expiry', 'expiryDate', { type: 'date' })}
        {f('n-card-number', 'cardNumber', { required: true })}
        {f('n-chip', 'chipSerialNumber')}
      </div>
    )
  },
  build: (v, { common, citizen }) => (!citizen.citizenId || !v.cardNumber.trim()) ? null : {
    path: '/documents/national-id-cards',
    payload: {
      citizenId: citizen.citizenId, ...withCommon(common),
      expiryDate: text(v.expiryDate), cardNumber: v.cardNumber.trim(), chipSerialNumber: text(v.chipSerialNumber),
    },
  },
}

const naturalization = {
  needsCitizen: true,
  initial: { previousNationality: '', naturalizationDate: '', decreeNumber: '', decreeDate: '' },
  Fields({ values, set, ctx }) {
    const f = (id, name, extra) => <Field id={id} name={name} values={values} set={set} label={ctx.t(`documentRegistry.${name}`)} {...extra} />
    return (
      <div className={grid}>
        {f('nat-prev', 'previousNationality')}
        {f('nat-date', 'naturalizationDate', { type: 'date' })}
        {f('nat-decree', 'decreeNumber', { required: true })}
        {f('nat-decree-date', 'decreeDate', { type: 'date' })}
      </div>
    )
  },
  build: (v, { common, citizen }) => (!citizen.citizenId || !v.decreeNumber.trim()) ? null : {
    path: '/documents/naturalization-records',
    payload: {
      citizenId: citizen.citizenId, ...withCommon(common),
      previousNationality: text(v.previousNationality), naturalizationDate: text(v.naturalizationDate),
      decreeNumber: v.decreeNumber.trim(), decreeDate: text(v.decreeDate),
    },
  },
}

const nameChange = {
  needsCitizen: true,
  initial: { amendmentId: '', oldFirstName: '', oldMiddleName: '', oldLastName: '', newFirstName: '', newMiddleName: '', newLastName: '', reason: '', courtDecisionNumber: '' },
  Fields({ values, set, ctx }) {
    const f = (id, name, extra) => <Field id={id} name={name} values={values} set={set} label={ctx.t(`documentRegistry.${name}`)} {...extra} />
    return (
      <div className="space-y-5">
        {f('nc-amendment', 'amendmentId', { type: 'number', hint: ctx.t('documentRegistry.amendmentIdHint') })}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {f('nc-old-first', 'oldFirstName')}
          {f('nc-old-middle', 'oldMiddleName')}
          {f('nc-old-last', 'oldLastName')}
          {f('nc-new-first', 'newFirstName', { required: true })}
          {f('nc-new-middle', 'newMiddleName')}
          {f('nc-new-last', 'newLastName')}
        </div>
        <div className={grid}>
          {f('nc-reason', 'reason')}
          <Field id="nc-court-decision" name="courtDecisionNumber" values={values} set={set} label={ctx.t('guardianship.courtDecisionNumber')} />
        </div>
      </div>
    )
  },
  build: (v, { common, citizen }) => (!citizen.citizenId || !v.newFirstName.trim()) ? null : {
    path: '/documents/name-change-records',
    payload: {
      citizenId: citizen.citizenId, ...withCommon(common),
      amendmentId: num(v.amendmentId),
      oldFirstName: text(v.oldFirstName), oldMiddleName: text(v.oldMiddleName), oldLastName: text(v.oldLastName),
      newFirstName: v.newFirstName.trim(), newMiddleName: text(v.newMiddleName), newLastName: text(v.newLastName),
      reason: text(v.reason), courtDecisionNumber: text(v.courtDecisionNumber), changeDate: null,
    },
  },
}

export const DOCUMENT_FORMS = { birth, marriage, divorce, death, nationalId, naturalization, nameChange }
