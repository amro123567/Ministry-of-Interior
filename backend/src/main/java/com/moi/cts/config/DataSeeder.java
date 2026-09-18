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
import java.util.HashSet;
import java.util.List;

/**
 * Seeds a minimal demo dataset on first boot: the 4 roles, a handful of
 * offices/document types, the legal-transition matrix (the service-layer
 * replacement for trg_request_legal_transition), 4 demo logins -- one per
 * role, matching the plan's "4 test accounts" -- and a few sample citizens
 * and requests in different states so the dashboard and demo script have
 * something to show immediately. Idempotent: does nothing if roles already
 * exist.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final OfficeRepository officeRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final WorkflowTransitionRuleRepository transitionRuleRepository;
    private final AppUserRepository userRepository;
    private final CitizenRepository citizenRepository;
    private final CorrespondenceRequestRepository requestRepository;
    private final RequestStateHistoryRepository historyRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(RoleRepository roleRepository, OfficeRepository officeRepository,
                       DocumentTypeRepository documentTypeRepository,
                       WorkflowTransitionRuleRepository transitionRuleRepository,
                       AppUserRepository userRepository, CitizenRepository citizenRepository,
                       CorrespondenceRequestRepository requestRepository,
                       RequestStateHistoryRepository historyRepository, PasswordEncoder passwordEncoder) {
        this.roleRepository = roleRepository;
        this.officeRepository = officeRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.transitionRuleRepository = transitionRuleRepository;
        this.userRepository = userRepository;
        this.citizenRepository = citizenRepository;
        this.requestRepository = requestRepository;
        this.historyRepository = historyRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (roleRepository.count() > 0) {
            return;
        }

        Role admin = roleRepository.save(new Role(RoleName.ADMIN, "Full system access"));
        Role manager = roleRepository.save(new Role(RoleName.MANAGER, "Reviews and approves/rejects requests"));
        Role officer = roleRepository.save(new Role(RoleName.OFFICER, "Creates, submits and archives requests"));
        Role viewer = roleRepository.save(new Role(RoleName.VIEWER, "Read-only access"));

        Office beirut = officeRepository.save(office("BEY", "Beirut Civil Status Office", "دائرة النفوس - بيروت"));
        officeRepository.save(office("TRP", "Tripoli Civil Status Office", "دائرة النفوس - طرابلس"));

        DocumentType birth = documentTypeRepository.save(docType("BIRTH_CERT", "Birth Certificate", "إخراج قيد", 3));
        documentTypeRepository.save(docType("NATIONAL_ID", "National ID Card", "بطاقة هوية", 5));
        DocumentType passport = documentTypeRepository.save(docType("PASSPORT", "Passport", "جواز سفر", 7));

        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.DRAFT, RequestStatus.SUBMITTED, RoleName.OFFICER));
        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW, RoleName.MANAGER));
        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.UNDER_REVIEW, RequestStatus.APPROVED, RoleName.MANAGER));
        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.UNDER_REVIEW, RequestStatus.REJECTED, RoleName.MANAGER));
        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.APPROVED, RequestStatus.ARCHIVED, RoleName.OFFICER));
        transitionRuleRepository.save(new WorkflowTransitionRule(RequestStatus.REJECTED, RequestStatus.ARCHIVED, RoleName.OFFICER));

        AppUser adminUser = user("admin", "Admin1234!", "System Administrator", "admin@moi.gov.lb", admin, beirut);
        AppUser managerUser = user("manager", "Manager1234!", "Rana Haddad", "manager@moi.gov.lb", manager, beirut);
        AppUser officerUser = user("officer", "Officer1234!", "Karim Fares", "officer@moi.gov.lb", officer, beirut);
        AppUser viewerUser = user("viewer", "Viewer1234!", "Nadine Aoun", "viewer@moi.gov.lb", viewer, beirut);
        userRepository.save(adminUser);
        userRepository.save(managerUser);
        userRepository.save(officerUser);
        userRepository.save(viewerUser);

        Citizen c1 = citizenRepository.save(citizen("REG-100234", "Ziad", "Kanaan", "زياد", "كنعان",
                LocalDate.of(1990, 4, 12), "M", beirut));
        Citizen c2 = citizenRepository.save(citizen("REG-100589", "Layla", "Mansour", "ليلى", "منصور",
                LocalDate.of(1985, 11, 3), "F", beirut));
        Citizen c3 = citizenRepository.save(citizen("REG-101042", "Fadi", "Haidar", "فادي", "حيدر",
                LocalDate.of(2001, 7, 20), "M", beirut));

        seedRequest("CTS-DEMO-1", c1, birth, beirut, officerUser, officerUser, RequestStatus.APPROVED, -6, -1);
        seedRequest("CTS-DEMO-2", c2, passport, beirut, officerUser, managerUser, RequestStatus.UNDER_REVIEW, -2, 5);
        seedRequest("CTS-DEMO-3", c3, birth, beirut, officerUser, null, RequestStatus.SUBMITTED, -8, -3);
        seedRequest("CTS-DEMO-4", c1, passport, beirut, officerUser, null, RequestStatus.DRAFT, 0, 7);
    }

    private Office office(String code, String en, String ar) {
        Office o = new Office();
        o.setCode(code); o.setNameEn(en); o.setNameAr(ar);
        return o;
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

    private void seedRequest(String ref, Citizen citizen, DocumentType docType, Office office,
                              AppUser createdBy, AppUser assignedTo, RequestStatus status,
                              int createdDaysAgo, int dueInDays) {
        CorrespondenceRequest r = new CorrespondenceRequest();
        r.setReferenceNumber(ref);
        r.setCitizen(citizen);
        r.setDocumentType(docType);
        r.setOffice(office);
        r.setCreatedBy(createdBy);
        r.setAssignedTo(assignedTo);
        r.setStatus(status);
        r.setPriority("NORMAL");
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
