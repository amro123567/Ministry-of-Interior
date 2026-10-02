package com.moi.cts.config;

import com.moi.cts.entity.*;
import com.moi.cts.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Seeds a minimal demo dataset on first boot: the 4 roles and the
 * permission catalog each is granted (see {@code role_permissions} --
 * this is the actual source of truth for what a role can do; nothing
 * checks role names directly any more), a handful of offices/document
 * types, the legal-transition matrix (the service-layer replacement for
 * trg_request_legal_transition, now keyed by required permission instead
 * of required role), 4 demo logins -- one per role, matching the plan's
 * "4 test accounts" -- a few sample citizens and requests in different
 * states so the dashboard and demo script have something to show
 * immediately, and (as of the reference & organizational hierarchy item)
 * the real 8-governorate/26-district administrative division of Lebanon,
 * a small representative set of departments/courts/religious authorities/
 * mukhtars, and the two demo offices linked into that hierarchy.
 * Idempotent: does nothing if roles already exist.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final OfficeRepository officeRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final WorkflowTransitionRuleRepository transitionRuleRepository;
    private final AppUserRepository userRepository;
    private final CitizenRepository citizenRepository;
    private final CorrespondenceRequestRepository requestRepository;
    private final RequestStateHistoryRepository historyRepository;
    private final GovernorateRepository governorateRepository;
    private final DistrictRepository districtRepository;
    private final DepartmentRepository departmentRepository;
    private final CourtRepository courtRepository;
    private final ReligiousAuthorityRepository religiousAuthorityRepository;
    private final MukhtarRepository mukhtarRepository;
    private final FamilyRecordRepository familyRecordRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final GuardianshipRecordRepository guardianshipRepository;
    private final RegistryTransferRepository transferRepository;
    private final CivilStatusAmendmentRepository amendmentRepository;
    private final DocumentRepository documentRepository;
    private final BirthCertificateRepository birthCertificateRepository;
    private final MarriageCertificateRepository marriageCertificateRepository;
    private final DivorceCertificateRepository divorceCertificateRepository;
    private final DeathCertificateRepository deathCertificateRepository;
    private final NationalIdCardRepository nationalIdCardRepository;
    private final NaturalizationRecordRepository naturalizationRecordRepository;
    private final NameChangeRecordRepository nameChangeRecordRepository;
    private final WorkflowStateRepository workflowStateRepository;
    private final WorkflowTransitionRepository workflowTransitionRepository;
    private final WorkflowInstanceRepository workflowInstanceRepository;
    private final WorkflowInstanceHistoryRepository workflowInstanceHistoryRepository;
    private final PaymentRepository paymentRepository;
    private final CitizenAuditLogRepository citizenAuditLogRepository;
    private final RecordAccessLogRepository recordAccessLogRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final SessionLogRepository sessionLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final SeedDataInvariantChecker invariantChecker;

    public DataSeeder(RoleRepository roleRepository, PermissionRepository permissionRepository,
                       OfficeRepository officeRepository,
                       DocumentTypeRepository documentTypeRepository,
                       WorkflowTransitionRuleRepository transitionRuleRepository,
                       AppUserRepository userRepository, CitizenRepository citizenRepository,
                       CorrespondenceRequestRepository requestRepository,
                       RequestStateHistoryRepository historyRepository,
                       GovernorateRepository governorateRepository, DistrictRepository districtRepository,
                       DepartmentRepository departmentRepository, CourtRepository courtRepository,
                       ReligiousAuthorityRepository religiousAuthorityRepository,
                       MukhtarRepository mukhtarRepository, FamilyRecordRepository familyRecordRepository,
                       FamilyMemberRepository familyMemberRepository,
                       GuardianshipRecordRepository guardianshipRepository,
                       RegistryTransferRepository transferRepository,
                       CivilStatusAmendmentRepository amendmentRepository, DocumentRepository documentRepository,
                       BirthCertificateRepository birthCertificateRepository,
                       MarriageCertificateRepository marriageCertificateRepository,
                       DivorceCertificateRepository divorceCertificateRepository,
                       DeathCertificateRepository deathCertificateRepository,
                       NationalIdCardRepository nationalIdCardRepository,
                       NaturalizationRecordRepository naturalizationRecordRepository,
                       NameChangeRecordRepository nameChangeRecordRepository,
                       WorkflowStateRepository workflowStateRepository,
                       WorkflowTransitionRepository workflowTransitionRepository,
                       WorkflowInstanceRepository workflowInstanceRepository,
                       WorkflowInstanceHistoryRepository workflowInstanceHistoryRepository,
                       PaymentRepository paymentRepository,
                       CitizenAuditLogRepository citizenAuditLogRepository,
                       RecordAccessLogRepository recordAccessLogRepository,
                       LoginAttemptRepository loginAttemptRepository,
                       SessionLogRepository sessionLogRepository,
                       PasswordEncoder passwordEncoder,
                       SeedDataInvariantChecker invariantChecker) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.officeRepository = officeRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.transitionRuleRepository = transitionRuleRepository;
        this.userRepository = userRepository;
        this.citizenRepository = citizenRepository;
        this.requestRepository = requestRepository;
        this.historyRepository = historyRepository;
        this.governorateRepository = governorateRepository;
        this.districtRepository = districtRepository;
        this.departmentRepository = departmentRepository;
        this.courtRepository = courtRepository;
        this.religiousAuthorityRepository = religiousAuthorityRepository;
        this.mukhtarRepository = mukhtarRepository;
        this.familyRecordRepository = familyRecordRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.guardianshipRepository = guardianshipRepository;
        this.transferRepository = transferRepository;
        this.amendmentRepository = amendmentRepository;
        this.documentRepository = documentRepository;
        this.birthCertificateRepository = birthCertificateRepository;
        this.marriageCertificateRepository = marriageCertificateRepository;
        this.divorceCertificateRepository = divorceCertificateRepository;
        this.deathCertificateRepository = deathCertificateRepository;
        this.nationalIdCardRepository = nationalIdCardRepository;
        this.naturalizationRecordRepository = naturalizationRecordRepository;
        this.nameChangeRecordRepository = nameChangeRecordRepository;
        this.workflowStateRepository = workflowStateRepository;
        this.workflowTransitionRepository = workflowTransitionRepository;
        this.workflowInstanceRepository = workflowInstanceRepository;
        this.workflowInstanceHistoryRepository = workflowInstanceHistoryRepository;
        this.paymentRepository = paymentRepository;
        this.citizenAuditLogRepository = citizenAuditLogRepository;
        this.recordAccessLogRepository = recordAccessLogRepository;
        this.loginAttemptRepository = loginAttemptRepository;
        this.sessionLogRepository = sessionLogRepository;
        this.passwordEncoder = passwordEncoder;
        this.invariantChecker = invariantChecker;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (roleRepository.count() > 0) {
            return;
        }

        // ---- permission catalog -------------------------------------------
        Permission userView = permission("USER_VIEW", "View the staff directory");
        Permission userManage = permission("USER_MANAGE", "Create and manage staff accounts and roles");
        Permission auditView = permission("AUDIT_VIEW", "View the global audit log");
        Permission reportsView = permission("REPORTS_VIEW", "View reports & analytics");
        Permission transitionSubmit = permission("REQUEST_TRANSITION_SUBMIT", "Submit a draft request");
        Permission transitionReview = permission("REQUEST_TRANSITION_REVIEW", "Start review of a submitted request");
        Permission transitionDecide = permission("REQUEST_TRANSITION_DECIDE", "Approve or reject a request under review");
        Permission transitionArchive = permission("REQUEST_TRANSITION_ARCHIVE", "Archive an approved or rejected request");
        // Registering a new citizen or correcting a father/mother lineage
        // link (SecurityConfig gates POST/PATCH /api/citizens/** on this) --
        // added alongside the frontend's first citizen-registry write UI so
        // that screen isn't open to every authenticated user by default the
        // way a brand-new endpoint with no matcher would otherwise be.
        Permission citizenManage = permission("CITIZEN_MANAGE",
                "Register new citizens and correct civil-registry lineage");
        // Approve or reject a registry transfer or civil-status amendment
        // someone else requested (SecurityConfig gates the two PATCH .../
        // decide endpoints on this) -- deliberately separate from
        // CITIZEN_MANAGE, mirroring REQUEST_TRANSITION_DECIDE's own split
        // from REQUEST_TRANSITION_SUBMIT below: requesting is data entry,
        // deciding is a distinct review authority, and the service layer's
        // SI-12 check (approver != requester) only matters once someone
        // actually holds both permissions -- OFFICER holds only the first.
        Permission citizenRegistryDecide = permission("CITIZEN_REGISTRY_DECIDE",
                "Approve or reject a registry transfer or civil-status amendment");
        // Recording a fee payment (or waiver) against a request (SecurityConfig
        // gates POST /api/payments on this) -- the front-line "money changed
        // hands at the counter" action, granted alongside CITIZEN_MANAGE to
        // whoever does front-desk data entry.
        Permission paymentRecord = permission("PAYMENT_RECORD",
                "Record a fee payment or waiver against a request");
        // Reversing a payment someone else already recorded (SecurityConfig
        // gates PATCH /api/payments/*/reverse on this) -- deliberately
        // separate from PAYMENT_RECORD, the same "doing vs. correcting" split
        // as CITIZEN_MANAGE/CITIZEN_REGISTRY_DECIDE and
        // REQUEST_TRANSITION_SUBMIT/DECIDE above: collecting a fee is
        // front-line data entry, undoing that collection is a distinct
        // correction authority that OFFICER does not hold.
        Permission paymentReverse = permission("PAYMENT_REVERSE",
                "Reverse a previously recorded payment");

        // ---- roles, defined entirely by which permissions they're granted --
        // ADMIN gets every permission that exists -- that (not a hardcoded
        // "role == ADMIN" check anywhere in the code) is what makes ADMIN
        // able to do everything.
        Role admin = roleRepository.save(new Role(RoleName.ADMIN, "Full system access"));
        admin.setPermissions(new HashSet<>(Set.of(userView, userManage, auditView, reportsView,
                transitionSubmit, transitionReview, transitionDecide, transitionArchive, citizenManage,
                citizenRegistryDecide, paymentRecord, paymentReverse)));
        roleRepository.save(admin);

        Role manager = roleRepository.save(new Role(RoleName.MANAGER, "Reviews and approves/rejects requests"));
        manager.setPermissions(new HashSet<>(Set.of(userView, reportsView, transitionReview, transitionDecide,
                citizenManage, citizenRegistryDecide, paymentRecord, paymentReverse)));
        roleRepository.save(manager);

        // OFFICER is the front-line civil-status data-entry role -- this is
        // also who RequestWorkflowIntegrationTest's own createCitizen() test
        // helper already logs in as for every fixture citizen it creates, so
        // CITIZEN_MANAGE has to be here for that whole suite to keep passing,
        // not just for realism. Holds PAYMENT_RECORD (collects fees at the
        // counter) but not PAYMENT_REVERSE (see that permission's own note).
        Role officer = roleRepository.save(new Role(RoleName.OFFICER, "Creates, submits and archives requests"));
        officer.setPermissions(new HashSet<>(Set.of(transitionSubmit, transitionArchive, citizenManage,
                paymentRecord)));
        roleRepository.save(officer);

        Role viewer = roleRepository.save(new Role(RoleName.VIEWER, "Read-only access"));
        // No permissions granted -- read-only means exactly that.

        // ---- reference & organizational hierarchy --------------------------
        // Lebanon's real 8 governorates and their ~26 districts (qadas) --
        // not fabricated placeholder data. Kept in a map so offices/courts/
        // mukhtars below can look districts up by code instead of holding
        // onto 26 local variables.
        Map<String, District> districtsByCode = new HashMap<>();

        Governorate beirutGov = governorateRepository.save(governorate("BEY", "Beirut", "بيروت"));
        districtsByCode.put("BEY", districtRepository.save(district(beirutGov, "BEY", "Beirut", "بيروت")));

        Governorate mountLebanonGov = governorateRepository.save(governorate("ML", "Mount Lebanon", "جبل لبنان"));
        districtsByCode.put("JBL", districtRepository.save(district(mountLebanonGov, "JBL", "Jbeil", "جبيل")));
        districtsByCode.put("KSR", districtRepository.save(district(mountLebanonGov, "KSR", "Kesrwan", "كسروان")));
        districtsByCode.put("MET", districtRepository.save(district(mountLebanonGov, "MET", "Metn", "المتن")));
        districtsByCode.put("BAB", districtRepository.save(district(mountLebanonGov, "BAB", "Baabda", "بعبدا")));
        districtsByCode.put("ALE", districtRepository.save(district(mountLebanonGov, "ALE", "Aley", "عاليه")));
        districtsByCode.put("CHF", districtRepository.save(district(mountLebanonGov, "CHF", "Chouf", "الشوف")));

        Governorate northGov = governorateRepository.save(governorate("NL", "North Lebanon", "لبنان الشمالي"));
        districtsByCode.put("TRP", districtRepository.save(district(northGov, "TRP", "Tripoli", "طرابلس")));
        districtsByCode.put("ZGH", districtRepository.save(district(northGov, "ZGH", "Zgharta", "زغرتا")));
        districtsByCode.put("BSH", districtRepository.save(district(northGov, "BSH", "Bsharri", "بشري")));
        districtsByCode.put("KOU", districtRepository.save(district(northGov, "KOU", "Koura", "الكورة")));
        districtsByCode.put("BAT", districtRepository.save(district(northGov, "BAT", "Batroun", "البترون")));
        districtsByCode.put("MND", districtRepository.save(district(northGov, "MND", "Miniyeh-Danniyeh", "المنية الضنية")));

        Governorate akkarGov = governorateRepository.save(governorate("AKK", "Akkar", "عكار"));
        districtsByCode.put("AKK", districtRepository.save(district(akkarGov, "AKK", "Akkar", "عكار")));

        Governorate beqaaGov = governorateRepository.save(governorate("BEQ", "Beqaa", "البقاع"));
        districtsByCode.put("ZAH", districtRepository.save(district(beqaaGov, "ZAH", "Zahle", "زحلة")));
        districtsByCode.put("WBK", districtRepository.save(district(beqaaGov, "WBK", "West Bekaa", "البقاع الغربي")));
        districtsByCode.put("RAS", districtRepository.save(district(beqaaGov, "RAS", "Rashaya", "راشيا")));

        Governorate baalbekHermelGov = governorateRepository.save(governorate("BH", "Baalbek-Hermel", "بعلبك الهرمل"));
        districtsByCode.put("BAL", districtRepository.save(district(baalbekHermelGov, "BAL", "Baalbek", "بعلبك")));
        districtsByCode.put("HER", districtRepository.save(district(baalbekHermelGov, "HER", "Hermel", "الهرمل")));

        Governorate southGov = governorateRepository.save(governorate("SL", "South Lebanon", "لبنان الجنوبي"));
        districtsByCode.put("SID", districtRepository.save(district(southGov, "SID", "Sidon", "صيدا")));
        districtsByCode.put("TYR", districtRepository.save(district(southGov, "TYR", "Tyre", "صور")));
        districtsByCode.put("JEZ", districtRepository.save(district(southGov, "JEZ", "Jezzine", "جزين")));

        Governorate nabatiehGov = governorateRepository.save(governorate("NAB", "Nabatieh", "النبطية"));
        districtsByCode.put("NBT", districtRepository.save(district(nabatiehGov, "NBT", "Nabatieh", "النبطية")));
        districtsByCode.put("BIN", districtRepository.save(district(nabatiehGov, "BIN", "Bint Jbeil", "بنت جبيل")));
        districtsByCode.put("MAR", districtRepository.save(district(nabatiehGov, "MAR", "Marjeyoun", "مرجعيون")));
        districtsByCode.put("HAS", districtRepository.save(district(nabatiehGov, "HAS", "Hasbaya", "حاصبيا")));

        District beirutDistrict = districtsByCode.get("BEY");
        District tripoliDistrict = districtsByCode.get("TRP");

        // A representative, not exhaustive, department org chart (2 levels)
        // -- deliberately not linked to any office, matching the source
        // ERD's own (flagged-as-open-question) design.
        Department civilStatusAffairs = departmentRepository.save(
                department("CSA", "Civil Status Affairs", "شؤون الأحوال الشخصية", null,
                        "Oversees registration and certificate issuance nationwide"));
        departmentRepository.save(department("CSA-REG", "Registration Unit", "وحدة التسجيل", civilStatusAffairs,
                "Handles new-request intake and initial review"));
        departmentRepository.save(department("CSA-ISS", "Certificates & Issuance Unit", "وحدة إصدار الشهادات",
                civilStatusAffairs, "Issues approved certificates and documents"));
        Department legalAffairs = departmentRepository.save(
                department("LNA", "Legal & Nationality Affairs", "الشؤون القانونية والجنسية", null,
                        "Handles nationality and court-referred cases"));
        departmentRepository.save(department("LNA-NAT", "Nationality Cases Unit", "وحدة قضايا الجنسية",
                legalAffairs, "Processes naturalization and nationality disputes"));

        // A handful of courts/religious authorities/mukhtars tied to
        // Beirut, matching where the existing demo offices/citizens/
        // requests already live -- representative of the domain, not a
        // claim of exhaustive national coverage.
        Court beirutCivilCourt = courtRepository.save(court(beirutDistrict, "Beirut Civil Court of First Instance",
                "محكمة بيروت المدنية الابتدائية", CourtType.CIVIL, "Beirut"));
        courtRepository.save(court(beirutDistrict, "Beirut Sunni Sharia Court", "المحكمة الشرعية السنية - بيروت",
                CourtType.SHARIA, "Sunni personal status, Beirut"));
        Court maroniteCourt = courtRepository.save(court(beirutDistrict, "Maronite Archeparchy Tribunal of Beirut",
                "المحكمة المارونية - أبرشية بيروت", CourtType.ECCLESIASTICAL, "Maronite personal status, Beirut"));

        religiousAuthorityRepository.save(religiousAuthority("Dar al-Fatwa", "دار الفتوى", "Islam", "Sunni"));
        religiousAuthorityRepository.save(religiousAuthority("Jaafari Supreme Islamic Council",
                "المجلس الإسلامي الشيعي الأعلى", "Islam", "Jaafari (Shia)"));
        religiousAuthorityRepository.save(religiousAuthority("Druze Council", "المجلس المذهبي الدرزي", "Druze", "Druze"));
        ReligiousAuthority maronitePatriarchate = religiousAuthorityRepository.save(
                religiousAuthority("Maronite Patriarchate", "البطريركية المارونية", "Christianity", "Maronite"));
        religiousAuthorityRepository.save(religiousAuthority("Greek Orthodox Archdiocese of Beirut",
                "أبرشية بيروت للروم الأرثوذكس", "Christianity", "Greek Orthodox"));

        mukhtarRepository.save(mukhtar(beirutDistrict, "Georges", "Abou Chacra", "جورج", "أبو شقرا",
                "Achrafieh", "+961 1 200111", "g.abouchacra@example.gov.lb",
                LocalDate.of(2023, 5, 15), LocalDate.of(2029, 5, 15)));
        mukhtarRepository.save(mukhtar(beirutDistrict, "Hassan", "Zeaiter", "حسن", "زعيتر",
                "Basta", "+961 1 200222", "h.zeaiter@example.gov.lb",
                LocalDate.of(2023, 5, 15), LocalDate.of(2029, 5, 15)));

        Office beirut = officeRepository.save(office("BEY", "Beirut Civil Status Office", "دائرة النفوس - بيروت",
                beirutDistrict));
        Office tripoli = officeRepository.save(office("TRP", "Tripoli Civil Status Office", "دائرة النفوس - طرابلس",
                tripoliDistrict));

        DocumentType birth = documentTypeRepository.save(docType("BIRTH_CERT", "Birth Certificate", "إخراج قيد", 3));
        DocumentType nationalId = documentTypeRepository.save(docType("NATIONAL_ID", "National ID Card", "بطاقة هوية", 5));
        DocumentType passport = documentTypeRepository.save(docType("PASSPORT", "Passport", "جواز سفر", 7));
        // The 4 remaining certificate subtype document types (Item 3) --
        // BIRTH_CERT/NATIONAL_ID above already double as document_type_id
        // for the Document supertype rows of those two kinds.
        DocumentType marriageCertType = documentTypeRepository.save(
                docType("MARRIAGE_CERT", "Marriage Certificate", "عقد زواج", 5));
        DocumentType divorceCertType = documentTypeRepository.save(
                docType("DIVORCE_CERT", "Divorce Certificate", "حكم طلاق", 10));
        DocumentType deathCertType = documentTypeRepository.save(
                docType("DEATH_CERT", "Death Certificate", "إخراج وفاة", 3));
        DocumentType naturalizationType = documentTypeRepository.save(
                docType("NATURALIZATION", "Naturalization Record", "سجل تجنس", 15));
        DocumentType nameChangeType = documentTypeRepository.save(
                docType("NAME_CHANGE", "Name Change Record", "سجل تغيير اسم", 15));

        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.DRAFT, RequestStatus.SUBMITTED, transitionSubmit));
        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW, transitionReview));
        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.UNDER_REVIEW, RequestStatus.APPROVED, transitionDecide));
        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.UNDER_REVIEW, RequestStatus.REJECTED, transitionDecide));
        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.APPROVED, RequestStatus.ARCHIVED, transitionArchive));
        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.REJECTED, RequestStatus.ARCHIVED, transitionArchive));

        AppUser adminUser = user("admin", "Admin1234!", "System Administrator", "admin@moi.gov.lb", admin, beirut);
        AppUser managerUser = user("manager", "Manager1234!", "Rana Haddad", "manager@moi.gov.lb", manager, beirut);
        AppUser officerUser = user("officer", "Officer1234!", "Karim Fares", "officer@moi.gov.lb", officer, beirut);
        AppUser viewerUser = user("viewer", "Viewer1234!", "Nadine Aoun", "viewer@moi.gov.lb", viewer, beirut);
        userRepository.save(adminUser);
        userRepository.save(managerUser);
        userRepository.save(officerUser);
        userRepository.save(viewerUser);

        // ---- session/login hardening: login_attempts & session_logs (Item 7) ----
        // DataSeeder writes straight through the repositories, bypassing
        // AuthService/SessionSecurityService, so these demo rows are
        // hand-composed rather than produced by an actual login/logout
        // call -- same convention as every other seeded history table.
        LoginAttempt goodLogin = new LoginAttempt();
        goodLogin.setUsernameAttempted("officer");
        goodLogin.setUser(officerUser);
        goodLogin.setWasSuccessful(true);
        goodLogin.setIpAddress("10.20.30.41");
        goodLogin.setUserAgent("Mozilla/5.0 (demo seed)");
        goodLogin.setAttemptedAt(Instant.now().minus(6, ChronoUnit.HOURS));
        loginAttemptRepository.save(goodLogin);

        LoginAttempt badPassword = new LoginAttempt();
        badPassword.setUsernameAttempted("officer");
        badPassword.setUser(officerUser);
        badPassword.setWasSuccessful(false);
        badPassword.setFailureReason(LoginFailureReason.BAD_PASSWORD);
        badPassword.setIpAddress("41.32.201.7");
        badPassword.setAttemptedAt(Instant.now().minus(2, ChronoUnit.DAYS));
        loginAttemptRepository.save(badPassword);

        LoginAttempt unknownUser = new LoginAttempt();
        unknownUser.setUsernameAttempted("root");
        unknownUser.setWasSuccessful(false);
        unknownUser.setFailureReason(LoginFailureReason.UNKNOWN_USER);
        unknownUser.setIpAddress("198.51.100.23");
        unknownUser.setAttemptedAt(Instant.now().minus(2, ChronoUnit.DAYS).plus(3, ChronoUnit.MINUTES));
        loginAttemptRepository.save(unknownUser);

        SessionLog closedSession = new SessionLog();
        closedSession.setUser(officerUser);
        closedSession.setJti(java.util.UUID.randomUUID().toString());
        closedSession.setLoginAt(Instant.now().minus(1, ChronoUnit.DAYS));
        closedSession.setExpiresAt(Instant.now().minus(1, ChronoUnit.DAYS).plus(30, ChronoUnit.MINUTES));
        closedSession.setLogoutAt(Instant.now().minus(1, ChronoUnit.DAYS).plus(25, ChronoUnit.MINUTES));
        closedSession.setIpAddress("10.20.30.41");
        closedSession.setUserAgent("Mozilla/5.0 (demo seed)");
        sessionLogRepository.save(closedSession);

        SessionLog openSession = new SessionLog();
        openSession.setUser(managerUser);
        openSession.setJti(java.util.UUID.randomUUID().toString());
        openSession.setLoginAt(Instant.now().minus(10, ChronoUnit.MINUTES));
        openSession.setExpiresAt(Instant.now().plus(20, ChronoUnit.MINUTES));
        openSession.setIpAddress("10.20.30.55");
        openSession.setUserAgent("Mozilla/5.0 (demo seed)");
        sessionLogRepository.save(openSession);

        Citizen c1 = citizenRepository.save(citizen("REG-100234", "Ziad", "Kanaan", "زياد", "كنعان",
                LocalDate.of(1990, 4, 12), "M", beirut));
        Citizen c2 = citizenRepository.save(citizen("REG-100589", "Layla", "Mansour", "ليلى", "منصور",
                LocalDate.of(1985, 11, 3), "F", beirut));
        Citizen c3 = citizenRepository.save(citizen("REG-101042", "Fadi", "Haidar", "فادي", "حيدر",
                LocalDate.of(2001, 7, 20), "M", beirut));

        seedRequest("CTS-DEMO-1", c1, birth, beirut, officerUser, officerUser, RequestStatus.APPROVED, -6, -1,
                CorrespondenceDirection.OUTGOING, "Birth certificate issued to citizen");
        seedRequest("CTS-DEMO-2", c2, passport, beirut, officerUser, managerUser, RequestStatus.UNDER_REVIEW, -2, 5,
                CorrespondenceDirection.INCOMING, "Passport renewal request received from citizen");
        seedRequest("CTS-DEMO-3", c3, birth, beirut, officerUser, null, RequestStatus.SUBMITTED, -8, -3,
                CorrespondenceDirection.INCOMING, "Birth certificate request forwarded by the registry office");
        seedRequest("CTS-DEMO-4", c1, passport, beirut, officerUser, null, RequestStatus.DRAFT, 0, 7,
                CorrespondenceDirection.OUTGOING, "Draft notice: passport ready for collection");

        // ---- full service-request model: payments ---------------------------
        // (SlaRecord rows are deliberately NOT seeded here -- they're always
        // derived from a request's live SLA state, so RequestFinanceService
        // creates/refreshes one lazily on first read instead of DataSeeder
        // hand-computing the same logic a second time. See RequestFinanceService's
        // Javadoc for why request assignments are also absent from this item.)
        CorrespondenceRequest demoRequest1 = requestRepository.findAll().stream()
                .filter(r -> "CTS-DEMO-1".equals(r.getReferenceNumber())).findFirst().orElseThrow();
        CorrespondenceRequest demoRequest3 = requestRepository.findAll().stream()
                .filter(r -> "CTS-DEMO-3".equals(r.getReferenceNumber())).findFirst().orElseThrow();

        Payment paidFee = new Payment();
        paidFee.setRequest(demoRequest1);
        paidFee.setAmount(new java.math.BigDecimal("25.00"));
        paidFee.setCurrency("USD");
        paidFee.setMethod(PaymentMethod.CASH);
        paidFee.setStatus(PaymentStatus.PAID);
        paidFee.setReceiptNumber("RCPT-2026-000001");
        paidFee.setCollectedBy(officerUser);
        paidFee.setPaidAt(Instant.now().minus(5, ChronoUnit.DAYS));
        paymentRepository.save(paidFee);

        // A waived fee -- no collector, matching enum_payment_method's own
        // WAIVED value and Payment's Javadoc note on why collectedBy is nullable.
        Payment waivedFee = new Payment();
        waivedFee.setRequest(demoRequest3);
        waivedFee.setAmount(new java.math.BigDecimal("15.00"));
        waivedFee.setCurrency("USD");
        waivedFee.setMethod(PaymentMethod.WAIVED);
        waivedFee.setStatus(PaymentStatus.PAID);
        waivedFee.setPaidAt(Instant.now().minus(2, ChronoUnit.DAYS));
        paymentRepository.save(waivedFee);

        // ---- citizen registry core (lineage, family, guardianship, ---------
        // transfers, amendments) -- a minor (c4) with lineage to c1/c2, so
        // there's something real for family-record membership and
        // guardianship to attach to.
        Citizen c4 = citizen("REG-102310", "Tarek", "Kanaan", "طارق", "كنعان",
                LocalDate.of(2015, 3, 9), "M", beirut);
        c4.setFather(c1);
        c4.setMother(c2);
        c4 = citizenRepository.save(c4);

        // ---- Item 8: a third generation, so the seeded lineage graph is ----
        // realistic (a real family tree, not just one parent-child edge)
        // and genuinely exercises SeedDataInvariantChecker's bulk cycle/
        // date-ordering checks below rather than a graph too shallow for a
        // cycle to be possible. c1's own parents -- Tarek (c4) above is
        // named after his grandfather, a detail deliberately consistent
        // with real Lebanese naming convention, not just a random pick.
        Citizen grandfather = citizenRepository.save(citizen("REG-080015", "Hassan", "Kanaan", "حسن", "كنعان",
                LocalDate.of(1958, 2, 2), "M", beirut));
        Citizen grandmother = citizenRepository.save(citizen("REG-080190", "Nadia", "Rahal", "ناديا", "رحال",
                LocalDate.of(1962, 9, 14), "F", beirut));
        c1.setFather(grandfather);
        c1.setMother(grandmother);
        c1 = citizenRepository.save(c1);

        // Family record: c1 (head), c2 (spouse), c4 (child) -- exercises the
        // corrected (family_record_id, citizen_id, joined_date) unique
        // constraint (the SDD's own fix to a flagged ERD defect).
        FamilyRecord familyRecord = new FamilyRecord();
        familyRecord.setFamilyBookNumber("FB-100234");
        familyRecord.setHeadOfHousehold(c1);
        familyRecord.setRegistrationOffice(beirut);
        familyRecord.setCreatedBy(adminUser);
        familyRecord = familyRecordRepository.save(familyRecord);

        familyMemberRepository.save(familyMember(familyRecord, c1, FamilyRelationship.HEAD, LocalDate.of(2015, 3, 9)));
        familyMemberRepository.save(familyMember(familyRecord, c2, FamilyRelationship.SPOUSE, LocalDate.of(2015, 3, 9)));
        familyMemberRepository.save(familyMember(familyRecord, c4, FamilyRelationship.CHILD, LocalDate.of(2015, 3, 9)));

        // The grandparents' own, older family book -- c1 belonged to it as
        // a child from his own birth until he left to form the household
        // above at his 2014 marriage. This is the first seed data to set
        // FamilyMember.leftDate/leftReason, exercising the "historical, not
        // current-state, membership" design FamilyMember's own Javadoc
        // describes (and the very re-joinability the corrected
        // (family_record_id, citizen_id, joined_date) unique constraint,
        // rather than the ERD's flagged (family_record_id, citizen_id) one,
        // exists to allow -- though c1 doesn't rejoin this one).
        FamilyRecord grandparentsRecord = new FamilyRecord();
        grandparentsRecord.setFamilyBookNumber("FB-080015");
        grandparentsRecord.setHeadOfHousehold(grandfather);
        grandparentsRecord.setRegistrationOffice(beirut);
        grandparentsRecord.setCreatedBy(adminUser);
        grandparentsRecord = familyRecordRepository.save(grandparentsRecord);

        familyMemberRepository.save(
                familyMember(grandparentsRecord, grandfather, FamilyRelationship.HEAD, LocalDate.of(1990, 4, 12)));
        familyMemberRepository.save(
                familyMember(grandparentsRecord, grandmother, FamilyRelationship.SPOUSE, LocalDate.of(1990, 4, 12)));
        FamilyMember c1AsChild = familyMember(grandparentsRecord, c1, FamilyRelationship.CHILD,
                LocalDate.of(1990, 4, 12));
        c1AsChild.setLeftDate(LocalDate.of(2014, 6, 1));
        c1AsChild.setLeftReason("Married and formed own household (FB-100234)");
        familyMemberRepository.save(c1AsChild);

        // Guardianship: c1 is c4's court-appointed guardian -- court is a
        // mandatory FK per the ERD, unlike most of this domain's optional
        // court references.
        GuardianshipRecord guardianship = new GuardianshipRecord();
        guardianship.setMinorCitizen(c4);
        guardianship.setGuardianCitizen(c1);
        guardianship.setGuardianshipType(GuardianshipType.FULL);
        guardianship.setCourtDecisionNumber("BEY-CIV-2015-0456");
        guardianship.setCourt(beirutCivilCourt);
        guardianship.setStartDate(LocalDate.of(2015, 3, 9));
        guardianship.setStatus(GuardianshipStatus.ACTIVE);
        guardianship.setCreatedBy(adminUser);
        guardianshipRepository.save(guardianship);

        // Registry transfers: one still pending (c3, Beirut -> Tripoli) and
        // one already approved (c2, Beirut -> Tripoli, approver != requester
        // per SI-12). DataSeeder writes straight through the repositories,
        // bypassing CitizenRegistryService, so the approved transfer's
        // office change is applied here by hand to mirror what
        // decideTransfer() would actually do.
        RegistryTransfer pendingTransfer = new RegistryTransfer();
        pendingTransfer.setCitizen(c3);
        pendingTransfer.setFromOffice(beirut);
        pendingTransfer.setToOffice(tripoli);
        pendingTransfer.setRequestedBy(officerUser);
        pendingTransfer.setStatus(ApprovalStatus.PENDING);
        transferRepository.save(pendingTransfer);

        RegistryTransfer approvedTransfer = new RegistryTransfer();
        approvedTransfer.setCitizen(c2);
        approvedTransfer.setFromOffice(beirut);
        approvedTransfer.setToOffice(tripoli);
        approvedTransfer.setRequestedBy(officerUser);
        approvedTransfer.setApprovedBy(managerUser);
        approvedTransfer.setApprovedAt(Instant.now().minus(2, ChronoUnit.DAYS));
        approvedTransfer.setDecisionReference("REG-TRF-2026-0012");
        approvedTransfer.setStatus(ApprovalStatus.APPROVED);
        approvedTransfer.setTransferDate(LocalDate.now().minusDays(2));
        transferRepository.save(approvedTransfer);
        c2.setRegisteredOffice(tripoli);
        citizenRepository.save(c2);

        // Civil status amendment: c1's sect corrected, already approved --
        // mirrors CitizenRegistryService's whitelist auto-apply on approval
        // (SI-11 legal basis required, SI-12 approver != requester).
        CivilStatusAmendment amendment = new CivilStatusAmendment();
        amendment.setCitizen(c1);
        amendment.setFieldChanged("sect");
        amendment.setNewValue("Maronite");
        amendment.setLegalBasis("Baptismal certificate correction, Beirut Maronite Archeparchy, ref. 2026-0088");
        amendment.setRequestedBy(officerUser);
        amendment.setApprovedBy(managerUser);
        amendment.setApprovedAt(Instant.now().minus(1, ChronoUnit.DAYS));
        amendment.setAmendmentDate(LocalDate.now().minusDays(1));
        amendment.setStatus(ApprovalStatus.APPROVED);
        amendmentRepository.save(amendment);
        c1.setSect("Maronite");
        citizenRepository.save(c1);

        // ---- three-tier audit/access logging: tiers 2 & 3 (Item 6) ----------
        // DataSeeder bypasses CitizenRegistryService/CitizenAuditService for
        // the two approved changes above, so -- same convention as the
        // office/sect mutations themselves -- their field-level audit rows
        // are written by hand here too, mirroring exactly what
        // decideTransfer()/applyAmendmentIfWhitelisted() would have logged.
        CitizenAuditLog transferAudit = new CitizenAuditLog();
        transferAudit.setCitizen(c2);
        transferAudit.setFieldName("registeredOffice");
        transferAudit.setOldValue(beirut.getCode());
        transferAudit.setNewValue(tripoli.getCode());
        transferAudit.setChangedBy(managerUser);
        transferAudit.setChangedAt(approvedTransfer.getApprovedAt());
        transferAudit.setReason("Registry transfer #" + approvedTransfer.getId());
        citizenAuditLogRepository.save(transferAudit);

        CitizenAuditLog amendmentAudit = new CitizenAuditLog();
        amendmentAudit.setCitizen(c1);
        amendmentAudit.setAmendment(amendment);
        amendmentAudit.setFieldName("sect");
        amendmentAudit.setOldValue(null);
        amendmentAudit.setNewValue("Maronite");
        amendmentAudit.setChangedBy(managerUser);
        amendmentAudit.setChangedAt(amendment.getApprovedAt());
        amendmentAudit.setReason(amendment.getLegalBasis());
        citizenAuditLogRepository.save(amendmentAudit);

        // Tier 3 (record access log): a demo read and a demo search hit,
        // showing both AccessType branches this codebase actually writes
        // (CitizenController's get()/search() -- see RecordAccessLog's
        // Javadoc for the two ERD access types this item leaves unwired).
        RecordAccessLog viewAccess = new RecordAccessLog();
        viewAccess.setCitizen(c1);
        viewAccess.setAccessedBy(managerUser);
        viewAccess.setAccessType(AccessType.VIEW_RECORD);
        viewAccess.setAccessedAt(amendment.getApprovedAt());
        viewAccess.setReason("Reviewing amendment request before approval");
        recordAccessLogRepository.save(viewAccess);

        RecordAccessLog searchAccess = new RecordAccessLog();
        searchAccess.setCitizen(c2);
        searchAccess.setAccessedBy(officerUser);
        searchAccess.setAccessType(AccessType.SEARCH_RESULT);
        searchAccess.setAccessedAt(Instant.now().minus(3, ChronoUnit.HOURS));
        recordAccessLogRepository.save(searchAccess);

        // ---- documents: generic supertype + 7 subtypes (Item 3) -------------
        // Three more citizens, self-contained to this item's demo so they
        // don't disturb Item 2's family/guardianship setup above: a couple
        // who married then divorced, and an elderly citizen who has since
        // died.
        Citizen c5 = citizenRepository.save(citizen("REG-103115", "Rania", "Fakhoury", "رانيا", "فاخوري",
                LocalDate.of(1988, 2, 17), "F", beirut));
        Citizen c6 = citizenRepository.save(citizen("REG-103340", "Omar", "Bassil", "عمر", "باسيل",
                LocalDate.of(1984, 9, 5), "M", beirut));
        Citizen c7 = citizenRepository.save(citizen("REG-090021", "Nabil", "Chidiac", "نبيل", "شدياق",
                LocalDate.of(1940, 1, 30), "M", beirut));

        // Birth certificate for c4 (the minor from Item 2) -- father/mother
        // names are snapshotted onto the certificate rather than resolved
        // live from c1/c2, per BirthCertificate's own Javadoc.
        Document birthDoc = newDocumentRow(c4, birth, "BC-2015-000456", LocalDate.of(2015, 3, 12), beirut,
                adminUser, DocumentStatus.ISSUED);
        birthDoc = documentRepository.save(birthDoc);
        BirthCertificate birthCert = new BirthCertificate();
        birthCert.setDocument(birthDoc);
        birthCert.setBirthPlace("Beirut");
        birthCert.setBirthHospital("American University of Beirut Medical Center");
        birthCert.setBirthAttendant("Dr. Samir Khoury");
        birthCert.setFatherFullNameSnapshot("Ziad Kanaan");
        birthCert.setMotherFullNameSnapshot("Layla Mansour");
        birthCert.setRegistrationNumber("BC-2015-000456");
        birthCert.setRegistrarName("Karim Fares");
        birthCertificateRepository.save(birthCert);

        // Marriage certificate for c1 x c2 -- consistent with Item 2's
        // family record (c1 head, c2 spouse) and predates c4's birth above.
        Document marriageDoc = newDocumentRow(c1, marriageCertType, "MC-2014-000789", LocalDate.of(2014, 6, 1),
                beirut, adminUser, DocumentStatus.ISSUED);
        marriageDoc = documentRepository.save(marriageDoc);
        MarriageCertificate marriage = new MarriageCertificate();
        marriage.setDocument(marriageDoc);
        marriage.setHusband(c1);
        marriage.setWife(c2);
        marriage.setHusbandNameSnapshot("Ziad Kanaan");
        marriage.setWifeNameSnapshot("Layla Mansour");
        marriage.setMarriageDate(LocalDate.of(2014, 6, 1));
        marriage.setMarriagePlace("Beirut");
        marriage.setCourt(maroniteCourt);
        marriage.setReligiousAuthority(maronitePatriarchate);
        marriage.setContractNumber("MC-2014-000789");
        marriage.setDowryAmount(java.math.BigDecimal.valueOf(5000));
        marriage.setDowryCurrency("USD");
        marriage.setStatus(UnionStatus.ACTIVE);
        marriageCertificateRepository.save(marriage);
        c1.setMaritalStatus(MaritalStatus.MARRIED);
        c2.setMaritalStatus(MaritalStatus.MARRIED);
        citizenRepository.save(c1);
        citizenRepository.save(c2);

        // A second marriage (c5 x c6), then dissolved -- demonstrates the
        // divorce certificate's real effect on both the marriage record
        // and the citizens, mirroring what DocumentRegistryService.
        // createDivorceCertificate() would do (DataSeeder bypasses the
        // service layer, so the effect is applied here by hand).
        Document secondMarriageDoc = newDocumentRow(c5, marriageCertType, "MC-2010-000234", LocalDate.of(2010, 5, 20),
                beirut, adminUser, DocumentStatus.ISSUED);
        secondMarriageDoc = documentRepository.save(secondMarriageDoc);
        MarriageCertificate secondMarriage = new MarriageCertificate();
        secondMarriage.setDocument(secondMarriageDoc);
        secondMarriage.setHusband(c6);
        secondMarriage.setWife(c5);
        secondMarriage.setHusbandNameSnapshot("Omar Bassil");
        secondMarriage.setWifeNameSnapshot("Rania Fakhoury");
        secondMarriage.setMarriageDate(LocalDate.of(2010, 5, 20));
        secondMarriage.setMarriagePlace("Beirut");
        secondMarriage.setCourt(beirutCivilCourt);
        secondMarriage.setContractNumber("MC-2010-000234");
        secondMarriage.setStatus(UnionStatus.DISSOLVED);
        secondMarriage = marriageCertificateRepository.save(secondMarriage);

        Document divorceDoc = newDocumentRow(c6, divorceCertType, "DC-2018-000045", LocalDate.of(2018, 9, 12),
                beirut, adminUser, DocumentStatus.ISSUED);
        divorceDoc = documentRepository.save(divorceDoc);
        DivorceCertificate divorce = new DivorceCertificate();
        divorce.setDocument(divorceDoc);
        divorce.setMarriageCertificate(secondMarriage);
        divorce.setHusband(c6);
        divorce.setWife(c5);
        divorce.setDivorceDate(LocalDate.of(2018, 9, 12));
        divorce.setDivorcePlace("Beirut");
        divorce.setCourt(beirutCivilCourt);
        divorce.setCourtDecisionNumber("BEY-CIV-2018-0234");
        divorce.setDivorceType(DivorceType.JUDICIAL);
        divorce.setDivorceReason("Irreconcilable differences");
        divorce.setSettlementAmount(java.math.BigDecimal.valueOf(2000));
        divorce.setSettlementCurrency("USD");
        divorce.setStatus(RecordStatus.ACTIVE);
        divorceCertificateRepository.save(divorce);
        c5.setMaritalStatus(MaritalStatus.DIVORCED);
        c6.setMaritalStatus(MaritalStatus.DIVORCED);
        citizenRepository.save(c5);
        citizenRepository.save(c6);

        // Death certificate for c7 -- mirrors createDeathCertificate()'s
        // real effect (R-09: issuing one sets citizens.is_deceased).
        Document deathDoc = newDocumentRow(c7, deathCertType, "DTH-2024-000012", LocalDate.of(2024, 11, 3), beirut,
                adminUser, DocumentStatus.ISSUED);
        deathDoc = documentRepository.save(deathDoc);
        DeathCertificate death = new DeathCertificate();
        death.setDocument(deathDoc);
        death.setDeathDate(LocalDate.of(2024, 11, 2));
        death.setDeathPlace("Beirut");
        death.setDeathCause("Natural causes");
        death.setCertifyingPhysician("Dr. Elie Nassar");
        death.setBurialPlace("Beirut");
        death.setBurialDate(LocalDate.of(2024, 11, 5));
        deathCertificateRepository.save(death);
        c7.setDeceased(true);
        citizenRepository.save(c7);

        // National ID card for c3.
        Document cardDoc = newDocumentRow(c3, nationalId, "ID-2020-000321", LocalDate.of(2020, 1, 15), beirut,
                adminUser, DocumentStatus.ISSUED);
        cardDoc.setExpiryDate(LocalDate.of(2030, 1, 15));
        cardDoc = documentRepository.save(cardDoc);
        NationalIdCard card = new NationalIdCard();
        card.setDocument(cardDoc);
        card.setCardNumber("ID-2020-000321");
        card.setBiometricPhotoHash("f2c1a9de7b3e4f5a6c8d9e0b1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c");
        card.setFingerprintHash("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2");
        card.setChipSerialNumber("CHIP-000321");
        card.setStatus(CardStatus.ACTIVE);
        nationalIdCardRepository.save(card);

        // Naturalization record for c3 -- mirrors
        // createNaturalizationRecord()'s real effect on citizens.nationality.
        Document naturalizationDoc = newDocumentRow(c3, naturalizationType, "NAT-2019-005567",
                LocalDate.of(2019, 8, 20), beirut, adminUser, DocumentStatus.ISSUED);
        naturalizationDoc = documentRepository.save(naturalizationDoc);
        NaturalizationRecord naturalization = new NaturalizationRecord();
        naturalization.setDocument(naturalizationDoc);
        naturalization.setPreviousNationality("Syrian");
        naturalization.setNaturalizationDate(LocalDate.of(2019, 8, 20));
        naturalization.setDecreeNumber("DEC-2019-005567");
        naturalization.setDecreeDate(LocalDate.of(2019, 8, 1));
        naturalization.setStatus(RecordStatus.ACTIVE);
        naturalizationRecordRepository.save(naturalization);
        c3.setNationality("Lebanese");
        citizenRepository.save(c3);

        // Name change record for c3 -- documents a past change already
        // reflected in his current name (no further mutation needed), and
        // deliberately leaves amendmentId null: this predates the Item 2
        // civil_status_amendments domain, matching NameChangeRecord's own
        // Javadoc about the certificate/amendment link being optional.
        Document nameChangeDoc = newDocumentRow(c3, nameChangeType, "NC-2021-000089", LocalDate.of(2021, 3, 10),
                beirut, adminUser, DocumentStatus.ISSUED);
        nameChangeDoc = documentRepository.save(nameChangeDoc);
        NameChangeRecord nameChange = new NameChangeRecord();
        nameChange.setDocument(nameChangeDoc);
        nameChange.setOldFirstName("Farid");
        nameChange.setOldLastName("Haidar");
        nameChange.setNewFirstName("Fadi");
        nameChange.setNewLastName("Haidar");
        nameChange.setReason("Personal preference, court-approved");
        nameChange.setCourtDecisionNumber("BEY-CIV-2021-0089");
        nameChange.setChangeDate(LocalDate.of(2021, 3, 10));
        nameChangeRecordRepository.save(nameChange);

        // ---- admin-configurable workflow engine ----------------------------
        // Seeded to faithfully mirror the existing 6-status/6-transition
        // request workflow (RequestStatus/WorkflowTransitionRule), which
        // this catalog does NOT replace -- see WorkflowInstance's Javadoc.
        // Reuses the same 4 REQUEST_TRANSITION_* permissions seeded above
        // rather than inventing a parallel permission set.
        WorkflowState draft = workflowState("DRAFT", "Draft", "مسودة", true, false, 1, "#9CA3AF");
        WorkflowState submitted = workflowState("SUBMITTED", "Submitted", "مقدم", false, false, 2, "#3B82F6");
        WorkflowState underReview = workflowState("UNDER_REVIEW", "Under Review", "قيد المراجعة", false, false, 3,
                "#F59E0B");
        WorkflowState approved = workflowState("APPROVED", "Approved", "موافق عليه", false, false, 4, "#10B981");
        WorkflowState rejected = workflowState("REJECTED", "Rejected", "مرفوض", false, false, 5, "#EF4444");
        WorkflowState archived = workflowState("ARCHIVED", "Archived", "مؤرشف", false, true, 6, "#6B7280");

        // action_code is UNIQUE system-wide (not per from-state) in the ERD,
        // so the two roads into ARCHIVED need two distinct codes -- can't
        // both just be "ARCHIVE". See WorkflowTransition's Javadoc.
        workflowTransition(draft, submitted, "SUBMIT", "Submit", "تقديم", false, false, Set.of(transitionSubmit));
        workflowTransition(submitted, underReview, "START_REVIEW", "Start review", "بدء المراجعة", false, false,
                Set.of(transitionReview));
        workflowTransition(underReview, approved, "APPROVE", "Approve", "الموافقة", false, false,
                Set.of(transitionDecide));
        workflowTransition(underReview, rejected, "REJECT", "Reject", "رفض", true, false, Set.of(transitionDecide));
        workflowTransition(approved, archived, "ARCHIVE_APPROVED", "Archive", "أرشفة", false, false,
                Set.of(transitionArchive));
        workflowTransition(rejected, archived, "ARCHIVE_REJECTED", "Archive", "أرشفة", false, false,
                Set.of(transitionArchive));

        // One demo instance, walked through its first transition, so the
        // engine's runtime half (not just its configuration half) has
        // something real to show and to test against.
        WorkflowInstance demoInstance = new WorkflowInstance();
        demoInstance.setEntityType("DEMO_WORKFLOW");
        demoInstance.setEntityId(1L);
        demoInstance.setCurrentState(draft);
        demoInstance = workflowInstanceRepository.save(demoInstance);

        WorkflowTransition submitTransition = workflowTransitionRepository.findByActionCode("SUBMIT").orElseThrow();
        demoInstance.setCurrentState(submitted);
        workflowInstanceRepository.save(demoInstance);
        WorkflowInstanceHistory demoHistory = new WorkflowInstanceHistory();
        demoHistory.setInstance(demoInstance);
        demoHistory.setFromState(draft);
        demoHistory.setToState(submitted);
        demoHistory.setTransition(submitTransition);
        demoHistory.setActor(adminUser);
        demoHistory.setOccurredAt(Instant.now());
        workflowInstanceHistoryRepository.save(demoHistory);

        // ---- Item 8: verify the seed data against real invariants, ---------
        // not just eyeball it. Runs last, over the fully-seeded citizen
        // registry, so it sees every citizen/marriage/guardianship/family
        // record this method wrote above, not just the ones seeded early.
        // Deliberately allowed to propagate and abort startup on failure
        // (see SeedInvariantViolationException's Javadoc) rather than
        // caught and logged -- a seeding bug should fail loudly in
        // development, not quietly ship demo data with a lineage cycle in it.
        invariantChecker.verifyCitizenRegistry(citizenRepository.findAll());
        invariantChecker.verifyMarriages(marriageCertificateRepository.findAll());
        invariantChecker.verifyGuardianships(guardianshipRepository.findAll());
        invariantChecker.verifyFamilyRecords(familyRecordRepository.findAll(), familyMemberRepository.findAll());
    }

    private WorkflowState workflowState(String code, String nameEn, String nameAr, boolean isInitial,
                                         boolean isFinal, int displayOrder, String colorHex) {
        WorkflowState state = new WorkflowState();
        state.setCode(code);
        state.setNameEn(nameEn);
        state.setNameAr(nameAr);
        state.setInitial(isInitial);
        state.setFinal(isFinal);
        state.setDisplayOrder(displayOrder);
        state.setColorHex(colorHex);
        return workflowStateRepository.save(state);
    }

    private WorkflowTransition workflowTransition(WorkflowState from, WorkflowState to, String actionCode,
                                                    String labelEn, String labelAr, boolean requiresComment,
                                                    boolean requiresDocument, Set<Permission> requiredPermissions) {
        WorkflowTransition transition = new WorkflowTransition();
        transition.setFromState(from);
        transition.setToState(to);
        transition.setActionCode(actionCode);
        transition.setLabelEn(labelEn);
        transition.setLabelAr(labelAr);
        transition.setRequiresComment(requiresComment);
        transition.setRequiresDocument(requiresDocument);
        transition.setRequiredPermissions(new HashSet<>(requiredPermissions));
        return workflowTransitionRepository.save(transition);
    }

    private Permission permission(String code, String description) {
        return permissionRepository.save(new Permission(code, description));
    }

    private Office office(String code, String en, String ar, District district) {
        Office o = new Office();
        o.setCode(code); o.setNameEn(en); o.setNameAr(ar); o.setDistrict(district);
        return o;
    }

    private Governorate governorate(String code, String en, String ar) {
        Governorate g = new Governorate();
        g.setCode(code); g.setNameEn(en); g.setNameAr(ar);
        return g;
    }

    private District district(Governorate governorate, String code, String en, String ar) {
        District d = new District();
        d.setGovernorate(governorate); d.setCode(code); d.setNameEn(en); d.setNameAr(ar);
        return d;
    }

    private Department department(String code, String en, String ar, Department parent, String description) {
        Department d = new Department();
        d.setCode(code); d.setNameEn(en); d.setNameAr(ar); d.setParent(parent); d.setDescription(description);
        return d;
    }

    private Court court(District district, String en, String ar, CourtType type, String jurisdiction) {
        Court c = new Court();
        c.setDistrict(district); c.setNameEn(en); c.setNameAr(ar); c.setCourtType(type); c.setJurisdiction(jurisdiction);
        return c;
    }

    private ReligiousAuthority religiousAuthority(String en, String ar, String religion, String sect) {
        ReligiousAuthority r = new ReligiousAuthority();
        r.setNameEn(en); r.setNameAr(ar); r.setReligion(religion); r.setSect(sect);
        return r;
    }

    private Mukhtar mukhtar(District district, String firstEn, String lastEn, String firstAr, String lastAr,
                             String village, String phone, String email, LocalDate termStart, LocalDate termEnd) {
        Mukhtar m = new Mukhtar();
        m.setDistrict(district);
        m.setFirstNameEn(firstEn); m.setLastNameEn(lastEn);
        m.setFirstNameAr(firstAr); m.setLastNameAr(lastAr);
        m.setVillageOrNeighborhood(village); m.setPhone(phone); m.setEmail(email);
        m.setTermStart(termStart); m.setTermEnd(termEnd);
        return m;
    }

    private DocumentType docType(String code, String en, String ar, int slaDays) {
        DocumentType d = new DocumentType();
        d.setCode(code); d.setNameEn(en); d.setNameAr(ar); d.setSlaDays(slaDays);
        return d;
    }

    private AppUser user(String username, String rawPassword, String fullName, String email, Role role, Office office) {
        AppUser u = new AppUser();
        u.setUsername(username);
        u.setPasswordHash(passwordEncoder.encode(rawPassword));
        u.setFullName(fullName);
        u.setEmail(email);
        u.setOffice(office);
        u.setRoles(new HashSet<>(List.of(role)));
        return u;
    }

    private Citizen citizen(String reg, String firstEn, String lastEn, String firstAr, String lastAr,
                             LocalDate dob, String gender, Office office) {
        Citizen c = new Citizen();
        c.setRegistryNumber(reg);
        c.setFirstNameEn(firstEn); c.setLastNameEn(lastEn);
        c.setFirstNameAr(firstAr); c.setLastNameAr(lastAr);
        c.setDateOfBirth(dob); c.setGender(gender);
        c.setRegisteredOffice(office);
        return c;
    }

    private Document newDocumentRow(Citizen citizen, DocumentType documentType, String documentNumber,
                                     LocalDate issueDate, Office issuingOffice, AppUser createdBy,
                                     DocumentStatus status) {
        Document d = new Document();
        d.setCitizen(citizen);
        d.setDocumentType(documentType);
        d.setDocumentNumber(documentNumber);
        d.setIssueDate(issueDate);
        d.setIssuingOffice(issuingOffice);
        d.setCreatedBy(createdBy);
        d.setStatus(status);
        return d;
    }

    private FamilyMember familyMember(FamilyRecord record, Citizen citizen, FamilyRelationship relationship,
                                       LocalDate joinedDate) {
        FamilyMember m = new FamilyMember();
        m.setFamilyRecord(record);
        m.setCitizen(citizen);
        m.setRelationship(relationship);
        m.setJoinedDate(joinedDate);
        return m;
    }

    private void seedRequest(String ref, Citizen citizen, DocumentType docType, Office office,
                              AppUser createdBy, AppUser assignedTo, RequestStatus status,
                              int createdDaysAgo, int dueInDays,
                              CorrespondenceDirection direction, String subject) {
        CorrespondenceRequest r = new CorrespondenceRequest();
        r.setReferenceNumber(ref);
        r.setCitizen(citizen);
        r.setDocumentType(docType);
        r.setOffice(office);
        r.setCreatedBy(createdBy);
        r.setAssignedTo(assignedTo);
        r.setStatus(status);
        r.setPriority("NORMAL");
        r.setDirection(direction);
        r.setSubject(subject);
        Instant createdAt = Instant.now().plus(createdDaysAgo, ChronoUnit.DAYS);
        r.setCreatedAt(createdAt);
        r.setDueAt(Instant.now().plus(dueInDays, ChronoUnit.DAYS));
        if (status == RequestStatus.APPROVED || status == RequestStatus.REJECTED || status == RequestStatus.ARCHIVED) {
            r.setClosedAt(Instant.now().minus(1, ChronoUnit.DAYS));
        }
        if (status != RequestStatus.DRAFT) {
            r.setSubmittedAt(createdAt.plus(1, ChronoUnit.HOURS));
        }
        r = requestRepository.save(r);

        RequestStateHistory h = new RequestStateHistory();
        h.setRequest(r);
        h.setFromStatus(null);
        h.setToStatus(RequestStatus.DRAFT);
        h.setChangedBy(createdBy);
        h.setNote("Created (seed data)");
        historyRepository.save(h);
    }
}
