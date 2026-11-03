#!/usr/bin/env node
/**
 * CTS demo-data seeder -- creates extra staff accounts (one admin, several
 * managers, officers and viewers), registers 34 citizens in many different
 * states and exercises every part of the system through the real REST API:
 *   citizens (4 marital states, alive/deceased, registered + unregistered
 *   parents, minors), family records (members joining / leaving), all 7
 *   certificate kinds with review validations and chain-of-custody events,
 *   guardianships (FULL / PARTIAL / TEMPORARY), civil-status amendments
 *   (pending / approved / rejected), registry transfers (pending / approved /
 *   rejected), correspondence requests in every status with assignments,
 *   attachments and payments (incl. a reversal), and workflow instances.
 *
 * Run from the project root:   node scripts/seed-demo.mjs
 * Needs Node 18+ and the backend reachable at http://localhost:8080 (docker
 * compose publishes it). Override with CTS_API=http://host:port/api.
 *
 * Run it once on a fresh database. Staff accounts and citizens that already
 * exist are skipped, and if every citizen is already registered the script
 * stops after the staff step instead of duplicating requests and certificates.
 * To reseed from scratch:  docker compose down -v ; docker compose up --build -d
 *
 * Extra staff (password = <Role>1234!, e.g. officer2 / Officer1234!):
 *   officer2-5, manager2-4, viewer2-5. The only admin stays "admin".
 */
const API = process.env.CTS_API ?? 'http://localhost:8080/api'
const PASS = { admin: 'Admin1234!', manager: 'Manager1234!', officer: 'Officer1234!' }
const ROLE_PASS = { OFFICER: 'Officer1234!', MANAGER: 'Manager1234!', VIEWER: 'Viewer1234!' }

// username, full name, role
const STAFF = [
  ['officer2', 'Rami Khoury', 'OFFICER'], ['officer3', 'Nour Haddad', 'OFFICER'],
  ['officer4', 'Hassan Mansour', 'OFFICER'], ['officer5', 'Tala Fakhoury', 'OFFICER'],
  ['manager2', 'Maya Saab', 'MANAGER'], ['manager3', 'Ziad Hamdan', 'MANAGER'],
  ['manager4', 'Dina Rahme', 'MANAGER'],
  ['viewer2', 'Karim Nasr', 'VIEWER'], ['viewer3', 'Lara Daher', 'VIEWER'],
  ['viewer4', 'Fadi Aoun', 'VIEWER'], ['viewer5', 'Joumana Sarkis', 'VIEWER'],
]
const officers = ['officer']
const managers = ['manager']

const log = (...a) => console.log(...a)
const stats = { ok: 0, fail: 0 }
const tokens = {}

async function call(role, method, path, body, { form } = {}) {
  const headers = { Authorization: `Bearer ${tokens[role]}` }
  if (body && !form) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API}${path}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) { const e = new Error(`${res.status} ${typeof data === 'object' ? (data?.message ?? JSON.stringify(data)) : data}`); e.status = res.status; throw e }
  return data
}
async function attempt(label, fn) {
  try { const r = await fn(); stats.ok++; return r } catch (e) { stats.fail++; log(`  ! ${label}: ${e.message}`); return null }
}
async function login(key, username = key, password = PASS[key]) {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
  if (!res.ok) throw new Error(`login ${username} failed (${res.status}) -- is the backend up and are the demo accounts unchanged?`)
  tokens[key] = (await res.json()).accessToken
}
const pick = (list, re, fallbackIndex = 0) => list.find((x) => re.test(`${x.code ?? ''} ${x.nameEn ?? x.name ?? ''}`)) ?? list[fallbackIndex % Math.max(list.length, 1)]
const dt = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const plusDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const today = new Date().toISOString().slice(0, 10)
// recent issue dates, spread over the last ~100 days and never in the future
const recentDate = (i) => plusDays(today, -(3 + ((i * 7) % 100)))

// ---------------------------------------------------------------- people --
// key, EN first/last, AR first/last, birth, gender, religion, sect, marital, place, [fatherKey, motherKey], extras
const P = [
  // Haddad (Maronite, Beirut)
  ['antoine', 'Antoine', 'Haddad', 'أنطوان', 'حداد', dt(1952, 3, 14), 'M', 'Christian', 'Maronite', 'MARRIED', 'Beirut'],
  ['marie', 'Marie', 'Khoury', 'ماري', 'خوري', dt(1956, 7, 2), 'F', 'Christian', 'Maronite', 'MARRIED', 'Jounieh'],
  ['georges', 'Georges', 'Haddad', 'جورج', 'حداد', dt(1980, 11, 21), 'M', 'Christian', 'Maronite', 'MARRIED', 'Beirut', 'antoine', 'marie'],
  ['rita', 'Rita', 'Haddad', 'ريتا', 'حداد', dt(1984, 5, 9), 'F', 'Christian', 'Maronite', 'SINGLE', 'Beirut', 'antoine', 'marie'],
  ['nadine', 'Nadine', 'Haddad', 'نادين', 'حداد', dt(1988, 1, 30), 'F', 'Christian', 'Maronite', 'DIVORCED', 'Beirut', 'antoine', 'marie'],
  ['carla', 'Carla', 'Saab', 'كارلا', 'صعب', dt(1982, 9, 17), 'F', 'Christian', 'Maronite', 'MARRIED', 'Zahle'],
  ['elie', 'Elie', 'Haddad', 'إيلي', 'حداد', dt(2012, 4, 5), 'M', 'Christian', 'Maronite', 'SINGLE', 'Beirut', 'georges', 'carla'],
  ['maya', 'Maya', 'Haddad', 'مايا', 'حداد', dt(2016, 8, 12), 'F', 'Christian', 'Maronite', 'SINGLE', 'Beirut', 'georges', 'carla'],
  // Mansour (Sunni, Tripoli)
  ['khaled', 'Khaled', 'Mansour', 'خالد', 'منصور', dt(1948, 2, 11), 'M', 'Muslim', 'Sunni', 'WIDOWED', 'Tripoli', null, null, { dies: dt(2024, 12, 3) }],
  ['salma', 'Salma', 'Itani', 'سلمى', 'عيتاني', dt(1953, 6, 25), 'F', 'Muslim', 'Sunni', 'WIDOWED', 'Tripoli'],
  ['omar', 'Omar', 'Mansour', 'عمر', 'منصور', dt(1978, 10, 8), 'M', 'Muslim', 'Sunni', 'MARRIED', 'Tripoli', 'khaled', 'salma'],
  ['layla', 'Layla', 'Mansour', 'ليلى', 'منصور', dt(1985, 12, 19), 'F', 'Muslim', 'Sunni', 'DIVORCED', 'Tripoli', 'khaled', 'salma'],
  ['hiba', 'Hiba', 'Daher', 'هبة', 'ضاهر', dt(2009, 3, 27), 'F', 'Muslim', 'Sunni', 'SINGLE', 'Tripoli', null, 'layla'],
  // Hamdan (Shia, Sidon)
  ['ali', 'Ali', 'Hamdan', 'علي', 'حمدان', dt(1975, 4, 1), 'M', 'Muslim', 'Shia', 'MARRIED', 'Sidon'],
  ['zeinab', 'Zeinab', 'Jaber', 'زينب', 'جابر', dt(1979, 9, 14), 'F', 'Muslim', 'Shia', 'MARRIED', 'Nabatieh'],
  ['hadi', 'Hadi', 'Hamdan', 'هادي', 'حمدان', dt(2005, 1, 22), 'M', 'Muslim', 'Shia', 'SINGLE', 'Sidon', 'ali', 'zeinab'],
  ['jana', 'Jana', 'Hamdan', 'جنى', 'حمدان', dt(2010, 6, 6), 'F', 'Muslim', 'Shia', 'SINGLE', 'Sidon', 'ali', 'zeinab'],
  // Others
  ['nabil', 'Nabil', 'Fakhoury', 'نبيل', 'فاخوري', dt(1940, 1, 30), 'M', 'Christian', 'Greek Orthodox', 'WIDOWED', 'Beirut', null, null, { dies: dt(2023, 5, 18) }],
  ['rima', 'Rima', 'Fakhoury', 'ريما', 'فاخوري', dt(1999, 2, 3), 'F', 'Christian', 'Greek Orthodox', 'SINGLE', 'Beirut', 'nabil', null, { amend: ['lastNameEn', 'Fakhoury', 'Fakhoury-Nassar', 'Marriage-related surname addition', 'APPROVE'] }],
  ['samir', 'Samir', 'Aoun', 'سمير', 'عون', dt(1990, 7, 15), 'M', 'Muslim', 'Druze', 'MARRIED', 'Aley'],
  ['lina', 'Lina', 'Abou Zeid', 'لينا', 'أبو زيد', dt(1993, 11, 9), 'F', 'Muslim', 'Druze', 'MARRIED', 'Aley'],
  ['karim', 'Karim', 'Sarkis', 'كريم', 'سركيس', dt(1968, 8, 23), 'M', 'Christian', 'Greek Orthodox', 'DIVORCED', 'Beirut'],
  ['dalia', 'Dalia', 'Rahal', 'داليا', 'رحال', dt(1972, 12, 2), 'F', 'Christian', 'Greek Orthodox', 'DIVORCED', 'Beirut'],
  ['vartan', 'Vartan', 'Boghossian', 'فارتان', 'بوغوصيان', dt(1985, 5, 28), 'M', 'Christian', 'Armenian Orthodox', 'MARRIED', 'Bourj Hammoud', null, null, { amend: ['firstNameEn', 'Vartan', 'Vahan', 'Spelling correction per civil registry', 'PENDING'] }],
  ['anahit', 'Anahit', 'Kalayjian', 'أناهيد', 'قلايجيان', dt(1988, 10, 16), 'F', 'Christian', 'Armenian Orthodox', 'MARRIED', 'Bourj Hammoud'],
  ['mohammad', 'Mohammad', 'Al-Ahmad', 'محمد', 'الأحمد', dt(1990, 3, 8), 'M', 'Muslim', 'Sunni', 'SINGLE', 'Aleppo', null, null, { naturalized: true, amend: ['religion', 'Muslim', 'Muslim - Sunni', 'Clerical correction', 'REJECT'] }],
  ['fatima', 'Fatima', 'Sayed', 'فاطمة', 'السيد', dt(1996, 4, 20), 'F', 'Muslim', 'Shia', 'SINGLE', 'Baalbek', null, null, { transfer: 'PENDING' }],
  ['joseph', 'Joseph', 'Rahme', 'يوسف', 'رحمة', dt(1960, 9, 5), 'M', 'Christian', 'Melkite', 'MARRIED', 'Zahle', null, null, { transfer: 'APPROVE' }],
  ['tony', 'Tony', 'Khalil', 'طوني', 'خليل', dt(2001, 6, 30), 'M', 'Christian', 'Maronite', 'SINGLE', 'Jbeil', null, null, { transfer: 'REJECT' }],
  ['yasmine', 'Yasmine', 'Nasr', 'ياسمين', 'نصر', dt(1950, 12, 12), 'F', 'Christian', 'Maronite', 'WIDOWED', 'Beirut'],
  ['michel', 'Michel', 'Daher', 'ميشال', 'ضاهر', dt(1944, 4, 9), 'M', 'Christian', 'Maronite', 'WIDOWED', 'Beirut', null, null, { dies: dt(2022, 9, 27) }],
  ['sara', 'Sara', 'Ibrahim', 'سارة', 'ابراهيم', dt(2010, 2, 14), 'F', 'Christian', 'Maronite', 'SINGLE', 'Beirut', null, null, { unregFather: 'Fadi Ibrahim', unregMother: 'Mona Ibrahim' }],
  ['ziad', 'Ziad', 'Barakat', 'زياد', 'بركات', dt(1999, 8, 1), 'M', 'Muslim', 'Sunni', 'SINGLE', 'Saida', null, null, { unregFather: 'Hussein Barakat' }],
]

async function main() {
  await Promise.all(Object.keys(PASS).map((k) => login(k)))
  log('Signed in as admin / manager / officer.')

  // ------------------------------------------------------------- staff --
  log('\nStaff accounts…')
  const offices0 = (await attempt('offices', () => call('admin', 'GET', '/offices'))) ?? []
  const existingUsers = (await attempt('users', () => call('admin', 'GET', '/users'))) ?? []
  for (const [i, [username, fullName, roleName]] of STAFF.entries()) {
    if (!existingUsers.some((u) => u.username === username)) {
      const made = await attempt(`user ${username}`, () => call('admin', 'POST', '/users', {
        username, password: ROLE_PASS[roleName], fullName, email: `${username}@moi.gov.lb`, roleName,
        officeId: offices0.length ? offices0[i % offices0.length].id : null,
      }))
      if (made) log(`  + ${username}  ${fullName}  (${roleName})`)
    }
    if (roleName === 'VIEWER') continue
    try {
      await login(username, username, ROLE_PASS[roleName])
      ;(roleName === 'OFFICER' ? officers : managers).push(username)
    } catch (e) { log(`  ! ${e.message}`) }
  }
  log(`Working staff: ${officers.length} officers, ${managers.length} managers.`)

  const ref = {}
  for (const [k, p] of Object.entries({ offices: '/offices', docTypes: '/document-types', departments: '/departments', courts: '/courts', authorities: '/religious-authorities', mukhtars: '/mukhtars', users: '/users' })) {
    ref[k] = (await attempt(k, () => call('admin', 'GET', p))) ?? []
  }
  if (!ref.offices.length || !ref.docTypes.length) throw new Error('No offices / document types found -- has the backend finished its first boot?')
  const office = (i) => ref.offices[i % ref.offices.length]
  const userId = (name) => ref.users.find((u) => u.username === name)?.id
  const docType = (code) => ref.docTypes.find((d) => d.code === code) ?? ref.docTypes[0]
  const court = (i) => ref.courts.length ? ref.courts[i % ref.courts.length].id : null
  const authority = (i) => ref.authorities.length ? ref.authorities[i % ref.authorities.length].id : null
  const mukhtar = (i) => ref.mukhtars.length ? ref.mukhtars[i % ref.mukhtars.length].id : null

  // ---------------------------------------------------------- citizens --
  log(`\nRegistering ${P.length} citizens…`)
  const id = {}
  let n = 0
  let newCitizens = 0
  for (const row of P) {
    const [key, fe, le, fa, la, dob, gender, religion, sect, marital, place, fk, mk, x = {}] = row
    const registryNumber = `REG-3${String(++n).padStart(5, '0')}`
    const found = await attempt(`search ${registryNumber}`, () => call('admin', 'GET', `/citizens?q=${registryNumber}`))
    const existing = (found ?? []).find((c) => c.registryNumber === registryNumber)
    if (existing) { id[key] = existing.id; continue }
    const body = {
      registryNumber, sijillReference: `SJ-${1000 + n}`,
      firstNameEn: fe, lastNameEn: le, firstNameAr: fa, lastNameAr: la,
      dateOfBirth: dob, placeOfBirth: place, gender, nationality: 'Lebanese', religion, sect, maritalStatus: marital,
      officeId: office(n).id,
      fatherId: fk ? id[fk] ?? null : null, motherId: mk ? id[mk] ?? null : null,
      fatherNameUnregistered: x.unregFather ?? null, motherNameUnregistered: x.unregMother ?? null,
    }
    const created = await attempt(`citizen ${fe} ${le}`, () => call('officer', 'POST', '/citizens', body))
    if (created) { id[key] = created.id; newCitizens++; log(`  + ${registryNumber}  ${fe} ${le}`) }
  }
  if (newCitizens === 0 && Object.keys(id).length === P.length) {
    log('\nAll demo citizens already exist, so the data was seeded before. Nothing more to add.')
    log('To start over: docker compose down -v ; docker compose up --build -d, then run this script again.')
    return
  }
  const have = (...keys) => keys.every((k) => id[k])

  // ----------------------------------------------------- family records --
  log('\nFamily records…')
  const families = [
    ['FB-3001', 'antoine', [['marie', 'SPOUSE'], ['georges', 'CHILD'], ['rita', 'CHILD'], ['nadine', 'CHILD']]],
    ['FB-3002', 'georges', [['carla', 'SPOUSE'], ['elie', 'CHILD'], ['maya', 'CHILD']]],
    ['FB-3003', 'omar', [['salma', 'OTHER'], ['layla', 'OTHER'], ['hiba', 'OTHER']]],
    ['FB-3004', 'ali', [['zeinab', 'SPOUSE'], ['hadi', 'CHILD'], ['jana', 'CHILD']]],
  ]
  for (const [book, head, members] of families) {
    if (!have(head)) continue
    const rec = await attempt(`family ${book}`, () => call('officer', 'POST', '/family-records', { familyBookNumber: book, headOfHouseholdId: id[head], registrationOfficeId: office(0).id }))
    if (!rec) continue
    for (const [m, relationship] of members) {
      if (!id[m]) continue
      await attempt(`member ${m}`, () => call('officer', 'POST', `/family-records/${rec.id}/members`, { citizenId: id[m], relationship, joinedDate: dt(2020, 1, 15) }))
    }
    if (book === 'FB-3003') {
      const full = await attempt('family detail', () => call('admin', 'GET', `/family-records/${rec.id}`))
      const leaver = (full?.members ?? []).find((m) => m.citizenId === id.layla || m.citizen?.id === id.layla)
      if (leaver) await attempt('member leaves', () => call('officer', 'PATCH', `/family-records/${rec.id}/members/${leaver.id}/leave`, { leftReason: 'Moved to a separate household after divorce', leftDate: dt(2023, 6, 1) }))
    }
  }

  // ------------------------------------------------------- certificates --
  log('\nCertificates…')
  const issue = (code, i) => ({ documentTypeId: docType(code).id, documentNumber: `${code.slice(0, 3)}-3${String(i).padStart(4, '0')}`, issueDate: recentDate(i), issuingOfficeId: office(i).id })
  const docs = []
  let di = 0
  const make = async (label, path, payload) => {
    const r = await attempt(label, () => call('officer', 'POST', path, payload))
    if (r) docs.push({ label, id: r.document?.id ?? r.documentId, raw: r })
    return r
  }
  for (const k of ['antoine', 'georges', 'rita', 'omar', 'layla', 'ali', 'hadi', 'samir', 'elie', 'maya', 'hiba', 'jana']) {
    if (!id[k]) continue
    di++
    await make(`birth ${k}`, '/documents/birth-certificates', {
      citizenId: id[k], ...issue('BIRTH_CERT', di), attestedByMukhtarId: mukhtar(di), birthPlace: 'Beirut', birthHospital: ['Saint George Hospital', 'AUBMC', 'Rafik Hariri Hospital', 'Home birth'][di % 4],
      birthAttendant: 'Dr. Rami Khalil', fatherFullNameSnapshot: null, motherFullNameSnapshot: null, registrationNumber: `BR-3${di}`, registrarName: 'Registrar Office',
    })
  }
  const couples = [['georges', 'carla', 2005], ['omar', null, 2003], ['ali', 'zeinab', 2002], ['samir', 'lina', 2018], ['vartan', 'anahit', 2012], ['karim', 'dalia', 1996], ['antoine', 'marie', 1977]]
  const marriages = {}
  for (const [h, w, year] of couples) {
    if (!w || !have(h, w)) continue
    di++
    const m = await make(`marriage ${h}+${w}`, '/documents/marriage-certificates', {
      husbandId: id[h], wifeId: id[w], ...issue('MARRIAGE_CERT', di), marriageDate: dt(year, 6, 12), marriagePlace: 'Beirut',
      courtId: court(di), religiousAuthorityId: authority(di), contractNumber: `MC-${year}-${di}`, dowryAmount: 5000, dowryCurrency: 'USD',
    })
    if (m) marriages[h] = m.document?.id ?? m.documentId
  }
  for (const [h, why, type] of [['karim', 'Irreconcilable differences', 'RELIGIOUS'], ['nadine', null, null]]) {
    if (!marriages[h]) continue
    di++
    await make(`divorce ${h}`, '/documents/divorce-certificates', {
      marriageCertificateId: marriages[h], ...issue('DIVORCE_CERT', di), divorceDate: dt(2021, 3, 18), divorcePlace: 'Beirut', courtId: court(di), courtDecisionNumber: `CD-${2021}-${di}`,
      divorceType: type ?? 'MUTUAL_CONSENT', divorceReason: why, childCustodyAgreement: 'Joint custody', financialSettlement: 'Settled', settlementAmount: 12000, settlementCurrency: 'USD', religiousAuthorityId: authority(di), shariaCourtApproval: null,
    })
  }
  for (const k of Object.entries({ khaled: 'Cardiac arrest', nabil: 'Natural causes', michel: 'Long illness' })) {
    const [key, cause] = k
    if (!id[key]) continue
    di++
    const p = P.find((r) => r[0] === key)[13]
    await make(`death ${key}`, '/documents/death-certificates', { citizenId: id[key], ...issue('DEATH_CERT', di), issueDate: plusDays(p.dies, 3), deathDate: p.dies, deathPlace: 'Beirut', deathCause: cause, certifyingPhysician: 'Dr. Hanna Karam', burialPlace: 'Local cemetery', burialDate: p.dies })
  }
  for (const k of ['georges', 'rita', 'omar', 'ali', 'samir', 'lina', 'vartan', 'karim']) {
    if (!id[k]) continue
    di++
    await make(`national id ${k}`, '/documents/national-id-cards', { citizenId: id[k], ...issue('NATIONAL_ID', di), expiryDate: dt(2034, 6, 30), cardNumber: `ID-3${String(di).padStart(6, '0')}`, chipSerialNumber: `CHIP-${9000 + di}` })
  }
  if (id.mohammad) {
    di++
    await make('naturalization', '/documents/naturalization-records', { citizenId: id.mohammad, ...issue('NATURALIZATION', di), previousNationality: 'Syrian', naturalizationDate: dt(2019, 7, 4), decreeNumber: 'DEC-2019-411', decreeDate: dt(2019, 6, 20) })
  }

  // ---------------------------------------------------------- amendments --
  log('\nCivil-status amendments…')
  let nameChangeCandidate = null
  for (const row of P) {
    const x = row[13] ?? {}
    if (!x.amend || !id[row[0]]) continue
    const [field, oldV, newV, basis, decision] = x.amend
    const a = await attempt(`amendment ${row[0]}`, () => call('officer', 'POST', '/civil-status-amendments', {
      citizenId: id[row[0]], fieldChanged: field, oldValue: oldV, newValue: newV, legalBasis: basis, courtDecisionNumber: `CSA-${row[0].toUpperCase()}`, courtId: court(3), amendmentDate: dt(2026, 2, 10),
    }))
    if (!a) continue
    if (decision !== 'PENDING') await attempt(`decide amendment ${row[0]}`, () => call('manager', 'PATCH', `/civil-status-amendments/${a.id}/decide`, { decision }))
    if (decision === 'APPROVE' && !nameChangeCandidate) nameChangeCandidate = { citizenKey: row[0], amendmentId: a.id }
  }
  if (nameChangeCandidate) {
    di++
    await make('name change record', '/documents/name-change-records', {
      citizenId: id[nameChangeCandidate.citizenKey], ...issue('NAME_CHANGE', di), amendmentId: nameChangeCandidate.amendmentId,
      oldFirstName: 'Rima', oldLastName: 'Fakhoury', newFirstName: 'Rima', newLastName: 'Fakhoury-Nassar', reason: 'Marriage-related surname addition', courtDecisionNumber: 'CSA-RIMA', changeDate: null,
    })
  }

  // ------------------------------------------------------------ transfers --
  log('\nRegistry transfers…')
  for (const row of P) {
    const x = row[13] ?? {}
    if (!x.transfer || !id[row[0]]) continue
    const cur = (await attempt('citizen', () => call('admin', 'GET', `/citizens/${id[row[0]]}`)))
    const target = ref.offices.find((o) => o.id !== (cur?.officeId ?? cur?.office?.id) && o.nameEn !== cur?.officeName) ?? office(1)
    const t = await attempt(`transfer ${row[0]}`, () => call('officer', 'POST', '/registry-transfers', { citizenId: id[row[0]], toOfficeId: target.id, transferDate: dt(2026, 3, 1) }))
    if (t && x.transfer !== 'PENDING') await attempt(`decide transfer ${row[0]}`, () => call('manager', 'PATCH', `/registry-transfers/${t.id}/decide`, { decision: x.transfer, decisionReference: `TR-DEC-${row[0].toUpperCase()}` }))
  }

  // ------------------------------------------------------- guardianships --
  log('\nGuardianships…')
  for (const [minor, guardian, type, end] of [['hiba', 'omar', 'PARTIAL', null], ['jana', 'zeinab', 'FULL', null], ['sara', 'yasmine', 'FULL', null], ['maya', 'rita', 'TEMPORARY', dt(2027, 1, 1)], ['elie', 'nadine', 'TEMPORARY', dt(2026, 12, 31)]]) {
    if (!have(minor, guardian)) continue
    await attempt(`guardianship ${minor}`, () => call('officer', 'POST', '/guardianships', { minorCitizenId: id[minor], guardianCitizenId: id[guardian], guardianshipType: type, courtDecisionNumber: `GD-${minor.toUpperCase()}-26`, courtId: court(1), startDate: dt(2025, 9, 1), endDate: end }))
  }

  // ----------------------------------------------- document review & custody --
  log('\nDocument validations and custody…')
  let k = 0
  for (const d of docs.filter((x) => x.id).slice(0, 18)) {
    k++
    await attempt(`validate ${d.label}`, () => call('manager', 'POST', `/documents/${d.id}/validations`, { decision: k % 6 === 0 ? 'REJECTED' : 'APPROVED', comment: k % 6 === 0 ? 'Missing seal on the original' : 'Verified against the civil registry' }))
    // the chain of custody must start with RECEIVED; some documents then move on
    const received = await attempt(`custody ${d.label}`, () => call('officer', 'POST', `/documents/${d.id}/custody`, { eventType: 'RECEIVED', location: 'Front desk', note: 'Received at the counter' }))
    if (received && k % 2 === 0) await attempt(`custody (stored) ${d.label}`, () => call('officer', 'POST', `/documents/${d.id}/custody`, { eventType: 'STORED', location: ['Archive room B', 'Vault 2'][k % 4 === 0 ? 0 : 1], note: 'Filed in the archive' }))
  }

  // ------------------------------------------------------------- requests --
  log('\nCorrespondence requests…')
  const types = ['BIRTH_CERT', 'MARRIAGE_CERT', 'DIVORCE_CERT', 'DEATH_CERT', 'NATIONAL_ID', 'NAME_CHANGE', 'NATURALIZATION']
  const subjects = ['Request for a civil status extract', 'Reply to the Governorate on a family record amendment', 'Certified copy of an individual civil record', 'Verification of marital status for embassy', 'Correction of a registry entry', 'Request to reissue a lost certificate', 'Inheritance proceedings: family-record extract', 'Court request for citizen data', 'Municipality inquiry on residence', 'Pension eligibility verification']
  const plan = [ // [citizenKey, finalStatus]
    ['georges', 'DRAFT'], ['rita', 'DRAFT'], ['hadi', 'DRAFT'], ['jana', 'DRAFT'], ['samir', 'DRAFT'], ['lina', 'DRAFT'],
    ['omar', 'SUBMITTED'], ['layla', 'SUBMITTED'], ['ali', 'SUBMITTED'], ['vartan', 'SUBMITTED'], ['anahit', 'SUBMITTED'], ['karim', 'SUBMITTED'], ['dalia', 'SUBMITTED'],
    ['mohammad', 'UNDER_REVIEW'], ['fatima', 'UNDER_REVIEW'], ['joseph', 'UNDER_REVIEW'], ['tony', 'UNDER_REVIEW'], ['yasmine', 'UNDER_REVIEW'], ['sara', 'UNDER_REVIEW'],
    ['nadine', 'APPROVED'], ['carla', 'APPROVED'], ['elie', 'APPROVED'], ['maya', 'APPROVED'], ['hiba', 'APPROVED'], ['ziad', 'APPROVED'],
    ['antoine', 'REJECTED'], ['marie', 'REJECTED'], ['salma', 'REJECTED'],
    ['khaled', 'ARCHIVED'], ['nabil', 'ARCHIVED'], ['michel', 'ARCHIVED'], ['rima', 'ARCHIVED'],
  ]
  const priorities = ['NORMAL', 'HIGH', 'URGENT', 'NORMAL']
  const requests = []
  let r = 0
  for (const [key, final] of plan) {
    if (!id[key]) continue
    const i = r++
    const officerKey = officers[i % officers.length]
    const managerKey = managers[i % managers.length]
    const created = await attempt(`request ${key}`, () => call(officerKey, 'POST', '/requests', {
      citizenId: id[key], documentTypeId: docType(types[i % types.length]).id, officeId: office(i).id,
      departmentId: ref.departments.length ? ref.departments[i % ref.departments.length].id : null,
      direction: i % 3 === 2 ? 'OUTGOING' : 'INCOMING', priority: priorities[i % 4],
      subject: `[Demo] ${subjects[i % subjects.length]}`, notes: 'Seeded demo correspondence.',
    }))
    if (!created) continue
    const rid = created.id
    requests.push({ id: rid, final, key })
    const step = (role, to, extra = {}) => attempt(`${key}: ${to}`, () => call(role, 'PATCH', `/requests/${rid}/transition`, { toStatus: to, note: extra.note ?? null, rejectionReason: extra.reason ?? null })).then((x) => x ?? attempt(`${key}: ${to} (admin)`, () => call('admin', 'PATCH', `/requests/${rid}/transition`, { toStatus: to, note: extra.note ?? null, rejectionReason: extra.reason ?? null })))
    if (final !== 'DRAFT') await step(officerKey, 'SUBMITTED', { note: 'Submitted for review' })
    if (['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'].includes(final)) await step(managerKey, 'UNDER_REVIEW', { note: 'Review started' })
    if (['APPROVED', 'ARCHIVED'].includes(final)) await step(managerKey, 'APPROVED', { note: 'Approved' })
    if (final === 'REJECTED') await step(managerKey, 'REJECTED', { reason: ['Incomplete supporting documents', 'Citizen record does not match the request', 'Outside the Directorate’s competence'][i % 3], note: 'Rejected' })
    if (final === 'ARCHIVED') await step('admin', 'ARCHIVED', { note: 'Filed' })
    // assignment (open requests only -- closed ones are refused by design)
    if (['SUBMITTED', 'UNDER_REVIEW'].includes(final)) {
      const pool = [...officers, ...managers]
      const assignee = userId(pool[i % pool.length])
      if (assignee) await attempt(`assign ${key}`, () => call('admin', 'PATCH', `/requests/${rid}/assign`, { userId: assignee, note: 'Assigned by the Directorate' }))
      if (i % 4 === 0 && userId(officerKey)) await attempt(`reassign ${key}`, () => call('admin', 'PATCH', `/requests/${rid}/assign`, { userId: userId(officerKey), note: 'Reassigned to balance the workload' }))
    }
    // attachment
    if (i % 3 === 0) {
      const form = new FormData()
      form.append('file', new Blob([`Supporting note for request ${rid}\nSeeded by seed-demo.mjs\n`], { type: 'text/plain' }), `supporting-note-${rid}.txt`)
      await attempt(`attach ${key}`, () => call(officerKey, 'POST', `/requests/${rid}/documents`, null, { form }))
    }
  }

  // ------------------------------------------------------------- payments --
  log('\nPayments…')
  let reversed = false
  const payable = requests.filter((q) => ['APPROVED', 'ARCHIVED', 'UNDER_REVIEW'].includes(q.final)).slice(0, 8)
  const methods = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'WAIVED', 'CASH', 'BANK_TRANSFER', 'CASH', 'CHEQUE']
  for (const [i, q] of payable.entries()) {
    const pay = await attempt(`payment ${q.key}`, () => call('officer', 'POST', '/payments', {
      requestId: q.id, amount: methods[i] === 'WAIVED' ? 0.01 : [150000, 75000, 300000, 50, 100000][i % 5], currency: i % 4 === 1 ? 'USD' : 'LBP', method: methods[i], receiptNumber: `RC-3${String(i + 1).padStart(4, '0')}`,
    }))
    if (pay && !reversed && methods[i] === 'CHEQUE') {
      reversed = true
      await attempt('reverse payment', () => call('admin', 'PATCH', `/payments/${pay.id}/reverse`, { reversalReason: 'Cheque bounced -- payment reversed' }))
    }
  }

  // ----------------------------------------------------- workflow instances --
  log('\nWorkflow engine instances…')
  for (const [type, key] of [['CITIZEN', 'ziad'], ['CITIZEN', 'fatima'], ['CITIZEN', 'tony']]) {
    if (!id[key]) continue
    const inst = await attempt(`instance ${key}`, () => call('admin', 'POST', '/workflow/instances', { entityType: type, entityId: id[key] }))
    if (!inst) continue
    const avail = await attempt('available', () => call('admin', 'GET', `/workflow/instances/${inst.id}/available-transitions`))
    const first = (avail ?? []).find((a) => !a.requiresComment)
    if (first && key !== 'tony') await attempt(`advance ${key}`, () => call('admin', 'POST', `/workflow/instances/${inst.id}/transition`, { actionCode: first.actionCode, comment: null }))
  }

  log(`\nDone. ${Object.keys(id).length} citizens, ${requests.length} requests, ${docs.length} certificates. ${stats.ok} calls succeeded, ${stats.fail} were refused (listed above with "!").`)
  log('Refresh the browser and sign in as any of the demo accounts.')
}

main().catch((e) => { console.error('\nSeeding stopped:', e.message); process.exit(1) })
