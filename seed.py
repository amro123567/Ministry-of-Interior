"""
Seed the database with a realistic demo dataset spanning all 46 tables
(45 from the corrected ERD + `passports`): geography, RBAC with real login
credentials, workflow configuration, document type configuration, two
extended families across generations, all 9 document/certificate subtypes,
service requests moving through the workflow with SLA/payment/notification
records, and audit/access/security log samples.

Usage:
    python seed.py            # wipes and reloads all demo data
"""
from datetime import date, datetime, timedelta

from app import create_app
from extensions import db
import models as m

app = create_app()

with app.app_context():
    print("Clearing existing data...")
    for model in [
        m.RecordAccessLog, m.CitizenAuditLog, m.AuditLog,
        m.InternalNotification, m.Payment, m.SlaRecord,
        m.ServiceRequestStatusHistory, m.RequestAssignment, m.ServiceRequest,
        m.PhysicalDocumentHandling, m.DocumentValidation,
        m.NameChangeRecord, m.NaturalizationRecord, m.Passport, m.NationalIdCard,
        m.DeathCertificate, m.DivorceCertificate, m.MarriageCertificate, m.BirthCertificate,
        m.Document, m.DocumentTypeAuthority, m.DocumentType,
        m.CivilStatusAmendment, m.RegistryTransfer, m.GuardianshipRecord,
        m.FamilyMember, m.FamilyRecord, m.Citizen,
        m.WorkflowTransitionPermission, m.WorkflowTransition, m.WorkflowState,
        m.TokenDenylist, m.LoginAttempt, m.SessionLog,
        m.UserRole, m.User, m.RolePermission, m.Role, m.Permission,
        m.Mukhtar, m.ReligiousAuthority, m.Court, m.Department, m.Office, m.District, m.Governorate,
    ]:
        model.query.delete()
    db.session.commit()

    # =================================================================
    # GEOGRAPHY & INSTITUTIONS
    # =================================================================
    gov_beirut = m.Governorate(name_ar="بيروت", name_en="Beirut", code="BRT")
    gov_mount_lebanon = m.Governorate(name_ar="جبل لبنان", name_en="Mount Lebanon", code="MLB")
    db.session.add_all([gov_beirut, gov_mount_lebanon])
    db.session.flush()

    dist_beirut = m.District(governorate_id=gov_beirut.id, name_ar="بيروت", name_en="Beirut District", code="BRT-1")
    dist_baabda = m.District(governorate_id=gov_mount_lebanon.id, name_ar="بعبدا", name_en="Baabda District", code="MLB-1")
    dist_metn = m.District(governorate_id=gov_mount_lebanon.id, name_ar="المتن", name_en="Metn District", code="MLB-2")
    db.session.add_all([dist_beirut, dist_baabda, dist_metn])
    db.session.flush()

    office_central = m.Office(
        district_id=dist_beirut.id, name_ar="مكتب النفوس المركزي", name_en="Central Civil Registry Office",
        code="OFC-CTR", office_type="CENTRAL", address="Downtown Beirut", phone="+961-1-100200", is_active=True,
    )
    office_baabda = m.Office(
        district_id=dist_baabda.id, name_ar="مكتب نفوس بعبدا", name_en="Baabda Civil Registry Office",
        code="OFC-BAB", office_type="DISTRICT", address="Baabda Serail", phone="+961-5-100300", is_active=True,
    )
    office_passport = m.Office(
        district_id=dist_beirut.id, name_ar="مديرية الجوازات", name_en="General Directorate of Passports",
        code="OFC-PSP", office_type="CENTRAL", address="Beirut", phone="+961-1-100400", is_active=True,
    )
    db.session.add_all([office_central, office_baabda, office_passport])
    db.session.flush()

    dept_registry = m.Department(name_ar="قسم النفوس", name_en="Civil Registry Department", code="DEPT-REG")
    dept_docs = m.Department(name_ar="قسم الوثائق", name_en="Documents Department", code="DEPT-DOC")
    db.session.add_all([dept_registry, dept_docs])
    db.session.flush()

    court_beirut = m.Court(
        name_ar="محكمة بيروت المدنية", name_en="Beirut Civil Court", court_type="CIVIL",
        jurisdiction="Beirut", district_id=dist_beirut.id, is_active=True,
    )
    court_sharia = m.Court(
        name_ar="المحكمة الشرعية السنية - بيروت", name_en="Sunni Sharia Court - Beirut", court_type="SHARIA",
        jurisdiction="Beirut", district_id=dist_beirut.id, is_active=True,
    )
    db.session.add_all([court_beirut, court_sharia])
    db.session.flush()

    dar_fatwa = m.ReligiousAuthority(name_ar="دار الفتوى", name_en="Dar Al-Fatwa", religion="Islam", sect="Sunni", is_active=True)
    maronite_patriarchate = m.ReligiousAuthority(name_ar="البطريركية المارونية", name_en="Maronite Patriarchate", religion="Christianity", sect="Maronite", is_active=True)
    db.session.add_all([dar_fatwa, maronite_patriarchate])
    db.session.flush()

    mukhtar1 = m.Mukhtar(
        district_id=dist_beirut.id, first_name_ar="زياد", last_name_ar="كرم",
        first_name_en="Ziad", last_name_en="Karam", village_or_neighborhood="Ashrafieh",
        phone="+961-3-500100", term_start=date(2022, 1, 1), term_end=date(2028, 1, 1), is_active=True,
    )
    db.session.add(mukhtar1)
    db.session.flush()

    # =================================================================
    # ACCESS CONTROL, SECURITY & RBAC
    # =================================================================
    permission_defs = [
        ("geography.view", "View geography & institutions", "geography"),
        ("geography.edit", "Create/edit/delete geography & institutions", "geography"),
        ("access_control.view", "View users, roles, and permissions", "access_control"),
        ("access_control.edit", "Create/edit/delete users, roles, and permissions", "access_control"),
        ("security.view", "View session logs, login attempts, and token denylist", "security"),
        ("workflow.view", "View workflow states, transitions, and transition permissions", "workflow"),
        ("workflow.edit", "Create/edit/delete workflow configuration", "workflow"),
        ("citizens.view", "View citizens, family records, guardianship, transfers, amendments", "citizens"),
        ("citizens.edit", "Create/edit/delete citizens, family and amendment records", "citizens"),
        ("documents.view", "View document types and documents", "documents"),
        ("documents.edit", "Create/edit/delete document types and documents", "documents"),
        ("documents.validate", "Approve/reject document validations", "documents"),
        ("certificates.view", "View all certificate subtypes", "certificates"),
        ("certificates.edit", "Create/edit/delete all certificate subtypes", "certificates"),
        ("requests.view", "View service requests, assignments, SLA, payments, notifications", "requests"),
        ("requests.edit", "Create/edit/delete and process service requests", "requests"),
        ("audit.view", "View audit logs, citizen audit log, and record access log", "audit"),
    ]
    perms = {}
    for code, desc, module in permission_defs:
        p = m.Permission(code=code, description=desc, module=module)
        db.session.add(p)
        perms[code] = p
    db.session.flush()

    role_admin = m.Role(name="Administrator", description="Full system access", is_system=True)
    role_clerk = m.Role(name="Registry Clerk", description="Front-desk civil registry work")
    role_supervisor = m.Role(name="Office Supervisor", description="Reviews and validates staff work")
    role_auditor = m.Role(name="Auditor", description="Read-only oversight across all modules")
    db.session.add_all([role_admin, role_clerk, role_supervisor, role_auditor])
    db.session.flush()

    role_permission_map = {
        role_admin: list(perms.keys()),  # full access
        role_clerk: [
            "geography.view", "citizens.view", "citizens.edit",
            "documents.view", "documents.edit",
            "certificates.view", "certificates.edit",
            "requests.view", "requests.edit",
        ],
        role_supervisor: [
            "geography.view", "workflow.view", "citizens.view", "citizens.edit",
            "documents.view", "documents.edit", "documents.validate",
            "certificates.view", "certificates.edit",
            "requests.view", "requests.edit",
            "audit.view",
        ],
        role_auditor: [
            "geography.view", "access_control.view", "security.view", "workflow.view",
            "citizens.view", "documents.view", "certificates.view",
            "requests.view", "audit.view",
        ],
    }
    for role, codes in role_permission_map.items():
        for code in codes:
            db.session.add(m.RolePermission(role_id=role.id, permission_id=perms[code].id))
    db.session.flush()

    def make_user(username, password, first, last, office, dept, role, employee_number, email):
        u = m.User(
            username=username, first_name=first, last_name=last, office_id=office.id,
            department_id=dept.id, employee_number=employee_number, email=email,
            is_active_flag=True,
        )
        u.set_password(password)
        db.session.add(u)
        db.session.flush()
        db.session.add(m.UserRole(user_id=u.id, role_id=role.id))
        return u

    # username / password are also listed in USER_MANUAL.md
    user_admin = make_user("amro.nasser", "Adm!nSecure24", "Amro", "Nasser", office_central, dept_registry, role_admin, "EMP-0001", "amro.nasser@moi.gov.lb")
    user_clerk1 = make_user("rana.khoury", "Clerk#Rana77", "Rana", "Khoury", office_central, dept_registry, role_clerk, "EMP-0002", "rana.khoury@moi.gov.lb")
    user_clerk2 = make_user("fadi.saab", "Clerk#Fadi88", "Fadi", "Saab", office_baabda, dept_registry, role_clerk, "EMP-0003", "fadi.saab@moi.gov.lb")
    user_supervisor = make_user("nour.chami", "Super#Nour55", "Nour", "Chami", office_central, dept_docs, role_supervisor, "EMP-0004", "nour.chami@moi.gov.lb")
    user_passport_clerk = make_user("layal.fares", "Clerk#Layal21", "Layal", "Fares", office_passport, dept_docs, role_clerk, "EMP-0005", "layal.fares@moi.gov.lb")
    user_auditor = make_user("sara.yazbek", "Audit#Sara33", "Sara", "Yazbek", office_central, dept_registry, role_auditor, "EMP-0006", "sara.yazbek@moi.gov.lb")
    db.session.commit()

    db.session.add_all([
        m.SessionLog(user_id=user_admin.id, jti="sess-0001", login_at=datetime(2024, 1, 5, 8, 0), ip_address="10.10.14.10"),
        m.LoginAttempt(username_attempted="amro.nasser", user_id=user_admin.id, was_successful=True, ip_address="10.10.14.10", attempted_at=datetime(2024, 1, 5, 8, 0)),
        m.LoginAttempt(username_attempted="rana.khoury", was_successful=False, failure_reason="BAD_PASSWORD", ip_address="10.10.14.20", attempted_at=datetime(2024, 1, 5, 8, 5)),
        m.TokenDenylist(jti="sess-old-001", user_id=user_clerk1.id, expires_at=datetime(2024, 1, 1), revoked_reason="LOGOUT"),
    ])
    db.session.commit()

    # =================================================================
    # WORKFLOW CONFIGURATION
    # =================================================================
    ws_submitted = m.WorkflowState(code="SUBMITTED", name_ar="مقدّم", name_en="Submitted", is_initial=True, display_order=1, color_hex="#7F8C8D")
    ws_in_review = m.WorkflowState(code="IN_REVIEW", name_ar="قيد المراجعة", name_en="In Review", display_order=2, color_hex="#d4ac0d")
    ws_approved = m.WorkflowState(code="APPROVED", name_ar="موافق عليه", name_en="Approved", display_order=3, color_hex="#27AE60")
    ws_rejected = m.WorkflowState(code="REJECTED", name_ar="مرفوض", name_en="Rejected", is_final=True, display_order=4, color_hex="#C0392B")
    ws_issued = m.WorkflowState(code="ISSUED", name_ar="صادر", name_en="Issued", is_final=True, display_order=5, color_hex="#2E86C1")
    db.session.add_all([ws_submitted, ws_in_review, ws_approved, ws_rejected, ws_issued])
    db.session.flush()

    wt_start_review = m.WorkflowTransition(from_state_id=ws_submitted.id, to_state_id=ws_in_review.id, action_code="START_REVIEW", label_en="Start Review")
    wt_approve = m.WorkflowTransition(from_state_id=ws_in_review.id, to_state_id=ws_approved.id, action_code="APPROVE", label_en="Approve", requires_comment=False)
    wt_reject = m.WorkflowTransition(from_state_id=ws_in_review.id, to_state_id=ws_rejected.id, action_code="REJECT", label_en="Reject", requires_comment=True)
    wt_issue = m.WorkflowTransition(from_state_id=ws_approved.id, to_state_id=ws_issued.id, action_code="ISSUE", label_en="Issue Document", requires_document=True)
    db.session.add_all([wt_start_review, wt_approve, wt_reject, wt_issue])
    db.session.flush()

    db.session.add_all([
        m.WorkflowTransitionPermission(transition_id=wt_approve.id, permission_id=perms["documents.validate"].id),
        m.WorkflowTransitionPermission(transition_id=wt_reject.id, permission_id=perms["documents.validate"].id),
        m.WorkflowTransitionPermission(transition_id=wt_issue.id, permission_id=perms["requests.edit"].id),
    ])
    db.session.commit()

    # =================================================================
    # DOCUMENT TYPE CONFIGURATION
    # =================================================================
    dt_birth = m.DocumentType(code="BIRTH_CERT", name_ar="شهادة ميلاد", name_en="Birth Certificate", category="CIVIL_STATUS", default_sla_days=5, is_active=True)
    dt_marriage = m.DocumentType(code="MARRIAGE_CERT", name_ar="عقد زواج", name_en="Marriage Certificate", category="CIVIL_STATUS", default_sla_days=7, is_active=True)
    dt_divorce = m.DocumentType(code="DIVORCE_CERT", name_ar="وثيقة طلاق", name_en="Divorce Certificate", category="CIVIL_STATUS", default_sla_days=10, is_active=True)
    dt_death = m.DocumentType(code="DEATH_CERT", name_ar="شهادة وفاة", name_en="Death Certificate", category="CIVIL_STATUS", default_sla_days=3, is_active=True)
    dt_id = m.DocumentType(code="NATIONAL_ID", name_ar="بطاقة هوية", name_en="National ID Card", category="IDENTITY", validity_duration_days=3650, default_sla_days=14, is_active=True)
    dt_passport = m.DocumentType(code="PASSPORT", name_ar="جواز سفر", name_en="Passport", category="IDENTITY", validity_duration_days=3650, default_sla_days=14, is_active=True)
    dt_naturalization = m.DocumentType(code="NATURALIZATION", name_ar="مرسوم تجنس", name_en="Naturalization Decree", category="JUDICIAL", is_active=True)
    dt_name_change = m.DocumentType(code="NAME_CHANGE", name_ar="تصحيح اسم", name_en="Name Change Record", category="CIVIL_STATUS", is_active=True)
    db.session.add_all([dt_birth, dt_marriage, dt_divorce, dt_death, dt_id, dt_passport, dt_naturalization, dt_name_change])
    db.session.flush()

    db.session.add_all([
        m.DocumentTypeAuthority(document_type_id=dt_marriage.id, authority_kind="COURT", court_id=court_sharia.id),
        m.DocumentTypeAuthority(document_type_id=dt_marriage.id, authority_kind="RELIGIOUS_AUTHORITY", religious_authority_id=dar_fatwa.id),
        m.DocumentTypeAuthority(document_type_id=dt_id.id, authority_kind="OFFICE", office_id=office_central.id),
        m.DocumentTypeAuthority(document_type_id=dt_passport.id, authority_kind="OFFICE", office_id=office_passport.id),
    ])
    db.session.commit()

    # =================================================================
    # CITIZENS — two extended families across three generations
    # =================================================================
    def citizen(crn, fen, len_, far, lar, gender, dob, office, father=None, mother=None,
                marital="SINGLE", deceased=False, nationality="citizen", religion=None, sect=None, creator=None):
        c = m.Citizen(
            civil_registry_number=crn, first_name_en=fen, last_name_en=len_,
            first_name_ar=far, last_name_ar=lar, gender=gender, date_of_birth=dob,
            registration_office_id=office.id, marital_status=marital, is_deceased=deceased,
            nationality=nationality, religion=religion, sect=sect,
            father_id=father, mother_id=mother, created_by=(creator.id if creator else None),
        )
        db.session.add(c)
        return c

    gp_father = citizen("CRN-100001", "Khalil", "Haddad", "خليل", "حداد", "MALE", date(1948, 3, 14),
                         office_central, marital="WIDOWED", deceased=True, religion="Christianity", sect="Maronite", creator=user_clerk1)
    gp_mother = citizen("CRN-100002", "Nabila", "Haddad", "نبيلة", "حداد", "FEMALE", date(1952, 6, 2),
                         office_central, marital="WIDOWED", religion="Christianity", sect="Maronite", creator=user_clerk1)
    db.session.flush()

    father = citizen("CRN-100003", "Georges", "Haddad", "جورج", "حداد", "MALE", date(1974, 9, 10),
                      office_central, father=gp_father.civil_registry_number, mother=gp_mother.civil_registry_number,
                      marital="MARRIED", religion="Christianity", sect="Maronite", creator=user_clerk1)
    db.session.flush()

    mother = citizen("CRN-100004", "Rita", "Aoun", "ريتا", "عون", "FEMALE", date(1978, 1, 25),
                      office_baabda, marital="MARRIED", religion="Christianity", sect="Maronite", creator=user_clerk2)
    db.session.flush()

    child1 = citizen("CRN-100005", "Sami", "Haddad", "سامي", "حداد", "MALE", date(2001, 11, 20),
                      office_central, father=father.civil_registry_number, mother=mother.civil_registry_number,
                      marital="SINGLE", religion="Christianity", sect="Maronite", creator=user_clerk1)
    child2 = citizen("CRN-100006", "Maya", "Haddad", "مايا", "حداد", "FEMALE", date(2005, 4, 8),
                      office_central, father=father.civil_registry_number, mother=mother.civil_registry_number,
                      marital="SINGLE", religion="Christianity", sect="Maronite", creator=user_clerk1)
    db.session.flush()

    husband2 = citizen("CRN-200001", "Omar", "Khalil", "عمر", "خليل", "MALE", date(1985, 2, 17),
                        office_central, marital="DIVORCED", religion="Islam", sect="Sunni", creator=user_clerk1)
    wife2 = citizen("CRN-200002", "Dina", "Mrad", "دينا", "مراد", "FEMALE", date(1988, 8, 30),
                     office_central, marital="DIVORCED", religion="Islam", sect="Sunni", creator=user_clerk1)
    db.session.flush()

    kid2 = citizen("CRN-200003", "Yara", "Khalil", "يارا", "خليل", "FEMALE", date(2012, 5, 5),
                    office_central, father=husband2.civil_registry_number, mother=wife2.civil_registry_number,
                    marital="SINGLE", religion="Islam", sect="Sunni", creator=user_clerk1)

    naturalized = citizen("CRN-300001", "Elena", "Petrova", "إيلينا", "بتروفا", "FEMALE", date(1990, 7, 19),
                           office_central, marital="MARRIED", nationality="naturalized", religion="Christianity", sect="Orthodox", creator=user_clerk1)
    db.session.flush()
    db.session.commit()

    # ---- Guardianship, transfers, amendments (new modules) ----
    guardianship = m.GuardianshipRecord(
        minor_citizen_id=kid2.civil_registry_number, guardian_citizen_id=wife2.civil_registry_number,
        guardianship_type="COURT_APPOINTED", court_decision_number="GRD-2023-0091", court_id=court_sharia.id,
        start_date=date(2023, 9, 1), status="ACTIVE", created_by=user_supervisor.id,
    )
    transfer = m.RegistryTransfer(
        citizen_id=child2.civil_registry_number, from_office_id=office_baabda.id, to_office_id=office_central.id,
        requested_by=user_clerk2.id, requested_at=datetime(2023, 6, 1, 9, 0), approved_by=user_supervisor.id,
        approved_at=datetime(2023, 6, 2, 10, 0), status="APPROVED", transfer_date=date(2023, 6, 3),
    )
    amendment_name_change = m.CivilStatusAmendment(
        citizen_id=naturalized.civil_registry_number, field_changed="last_name_en",
        old_value="Petrova", new_value="Haddad-Petrova", legal_basis="Marriage-related name update",
        court_decision_number="CV-2021-771", court_id=court_beirut.id, requested_by=user_clerk1.id,
        approved_by=user_admin.id, approved_at=datetime(2021, 4, 9), amendment_date=date(2021, 4, 10), status="APPROVED",
    )
    db.session.add_all([guardianship, transfer, amendment_name_change])
    db.session.flush()

    # =================================================================
    # HOUSEHOLDS
    # =================================================================
    family_haddad = m.FamilyRecord(family_book_number="FB-500001", head_of_household_id=father.civil_registry_number, registration_office_id=office_central.id, created_by=user_clerk1.id)
    family_khalil = m.FamilyRecord(family_book_number="FB-500002", head_of_household_id=husband2.civil_registry_number, registration_office_id=office_central.id, created_by=user_clerk1.id)
    db.session.add_all([family_haddad, family_khalil])
    db.session.flush()

    db.session.add_all([
        m.FamilyMember(family_record_id=family_haddad.id, citizen_id=father.civil_registry_number, relationship_="HEAD", joined_date=date(2000, 6, 15)),
        m.FamilyMember(family_record_id=family_haddad.id, citizen_id=mother.civil_registry_number, relationship_="SPOUSE", joined_date=date(2000, 6, 15)),
        m.FamilyMember(family_record_id=family_haddad.id, citizen_id=child1.civil_registry_number, relationship_="SON", joined_date=date(2001, 11, 20)),
        m.FamilyMember(family_record_id=family_haddad.id, citizen_id=child2.civil_registry_number, relationship_="DAUGHTER", joined_date=date(2005, 4, 8)),
        m.FamilyMember(family_record_id=family_khalil.id, citizen_id=husband2.civil_registry_number, relationship_="HEAD", joined_date=date(2010, 3, 1)),
        m.FamilyMember(family_record_id=family_khalil.id, citizen_id=wife2.civil_registry_number, relationship_="SPOUSE", joined_date=date(2010, 3, 1), left_date=date(2023, 9, 1), left_reason="divorce"),
        m.FamilyMember(family_record_id=family_khalil.id, citizen_id=kid2.civil_registry_number, relationship_="DAUGHTER", joined_date=date(2012, 5, 5)),
    ])
    db.session.commit()

    # =================================================================
    # DOCUMENTS + SUBTYPES
    # =================================================================
    def new_document(dtype, crn, number, issue, office, status="ISSUED",
                      created=user_clerk1, expiry=None):
        doc = m.Document(
            document_type_id=dtype.id, civil_registry_number=crn, document_number=number,
            issue_date=issue, expiry_date=expiry, issuing_office_id=office.id,
            status=status, created_by=created.id, updated_by=created.id,
        )
        db.session.add(doc)
        db.session.flush()
        return doc

    bc1 = new_document(dt_birth, child1.civil_registry_number, "BC-2001-1120", date(2001, 11, 22), office_central)
    db.session.add(m.BirthCertificate(
        document_id=bc1.id, birth_place="Beirut",
        birth_hospital="Hotel Dieu de France", father_full_name_snapshot="Georges Haddad", mother_full_name_snapshot="Rita Aoun",
        registration_number="REG-2001-1120", registrar_name="Rana Khoury",
    ))

    bc2 = new_document(dt_birth, child2.civil_registry_number, "BC-2005-0408", date(2005, 4, 10), office_central)
    db.session.add(m.BirthCertificate(
        document_id=bc2.id, birth_place="Beirut",
        birth_hospital="Hotel Dieu de France", father_full_name_snapshot="Georges Haddad", mother_full_name_snapshot="Rita Aoun",
        registration_number="REG-2005-0408", registrar_name="Rana Khoury",
    ))

    bc3 = new_document(dt_birth, kid2.civil_registry_number, "BC-2012-0505", date(2012, 5, 7), office_central)
    db.session.add(m.BirthCertificate(
        document_id=bc3.id, birth_place="Beirut",
        birth_hospital="American University Hospital", father_full_name_snapshot="Omar Khalil", mother_full_name_snapshot="Dina Mrad",
        registration_number="REG-2012-0505", registrar_name="Fadi Saab",
    ))

    mc1 = new_document(dt_marriage, husband2.civil_registry_number, "MC-2010-0301", date(2010, 3, 1), office_central)
    marriage1 = m.MarriageCertificate(
        document_id=mc1.id, husband_id=husband2.civil_registry_number, wife_id=wife2.civil_registry_number,
        husband_name_snapshot="Omar Khalil", wife_name_snapshot="Dina Mrad",
        marriage_date=date(2010, 3, 1), marriage_place="Beirut", court_id=court_sharia.id,
        religious_authority_id=dar_fatwa.id, contract_number="CN-2010-0301", dowry_amount=5000.00,
        dowry_currency="USD", status="DISSOLVED",
    )
    db.session.add(marriage1)
    db.session.flush()

    dc1 = new_document(dt_divorce, husband2.civil_registry_number, "DIV-2023-0901", date(2023, 9, 1), office_central)
    db.session.add(m.DivorceCertificate(
        document_id=dc1.id, marriage_certificate_id=marriage1.document_id,
        husband_id=husband2.civil_registry_number, wife_id=wife2.civil_registry_number,
        divorce_date=date(2023, 9, 1), divorce_place="Beirut", court_id=court_sharia.id,
        court_decision_number="SC-2023-4471", divorce_type="MUTUAL_CONSENT",
        divorce_reason="Irreconcilable differences", child_custody_agreement="Joint custody of Yara Khalil, primary residence with mother.",
        financial_settlement="One-time settlement.", settlement_amount=10000.00, settlement_currency="USD",
        religious_authority_id=dar_fatwa.id, sharia_court_approval="Approved 2023-09-01", status="ACTIVE",
    ))

    dth1 = new_document(dt_death, gp_father.civil_registry_number, "DTH-2020-0612", date(2020, 6, 12), office_central)
    db.session.add(m.DeathCertificate(
        document_id=dth1.id, death_date=date(2020, 6, 10),
        death_place="Beirut", death_cause="Natural causes - cardiac arrest",
        certifying_physician="Dr. Elias Nader", burial_place="Our Lady of Lebanon Cemetery", burial_date=date(2020, 6, 13),
    ))

    for cz, num, iss in [
        (father, "IDDOC-CRN100003", date(2019, 1, 15)),
        (mother, "IDDOC-CRN100004", date(2019, 1, 15)),
        (child1, "IDDOC-CRN100005", date(2020, 1, 20)),
        (husband2, "IDDOC-CRN200001", date(2018, 5, 10)),
        (naturalized, "IDDOC-CRN300001", date(2021, 3, 1)),
    ]:
        d = new_document(dt_id, cz.civil_registry_number, num, iss, office_central, expiry=iss.replace(year=iss.year + 10))
        db.session.add(m.NationalIdCard(
            document_id=d.id, card_number=num, chip_serial_number=f"CHIP-{num[-6:]}", status="ACTIVE",
        ))

    for cz, num, iss in [(father, "P-LB-0011234", date(2022, 2, 1)), (mother, "P-LB-0011235", date(2022, 2, 1))]:
        d = new_document(dt_passport, cz.civil_registry_number, num, iss, office_passport,
                          expiry=iss.replace(year=iss.year + 10), created=user_passport_clerk)
        db.session.add(m.Passport(
            document_id=d.id, citizen_id=cz.civil_registry_number, passport_number=num,
            passport_type="ordinary", issue_date=iss, expiry_date=iss.replace(year=iss.year + 10),
            issuing_office_id=office_passport.id, page_count=34, status="ACTIVE",
        ))

    nat_doc = new_document(dt_naturalization, naturalized.civil_registry_number, "NAT-2021-0301", date(2021, 3, 1), office_central)
    db.session.add(m.NaturalizationRecord(
        document_id=nat_doc.id,
        previous_nationality="Russian", naturalization_date=date(2021, 3, 1),
        decree_number="DEC-9821", decree_date=date(2021, 2, 15), status="ACTIVE",
    ))

    nc_doc = new_document(dt_name_change, naturalized.civil_registry_number, "NC-2021-0410", date(2021, 4, 10), office_central)
    db.session.add(m.NameChangeRecord(
        document_id=nc_doc.id, amendment_id=amendment_name_change.id,
        old_first_name="Elena", old_middle_name=None, old_last_name="Petrova",
        new_first_name="Elena", new_middle_name="Georges", new_last_name="Haddad-Petrova",
        reason="Marriage-related name update", court_decision_number="CV-2021-771", change_date=date(2021, 4, 10),
    ))
    db.session.commit()

    # =================================================================
    # DOCUMENT VALIDATIONS & PHYSICAL HANDLING
    # =================================================================
    db.session.add_all([
        m.DocumentValidation(document_id=bc1.id, validator_id=user_supervisor.id, validation_type="AUTHENTICITY",
                              status="APPROVED", comments="Verified against hospital birth record.", ip_address="10.10.14.20"),
        m.DocumentValidation(document_id=mc1.id, validator_id=user_supervisor.id, validation_type="LEGAL_SUFFICIENCY",
                              status="APPROVED", comments="Contract verified with Sharia court registry.", ip_address="10.10.14.21"),
        m.DocumentValidation(document_id=dc1.id, validator_id=user_supervisor.id, validation_type="LEGAL_SUFFICIENCY",
                              status="APPROVED", comments="Court decision number confirmed.", ip_address="10.10.14.21"),
        m.DocumentValidation(document_id=nat_doc.id, validator_id=user_admin.id, validation_type="COMPLETENESS",
                              status="APPROVED", comments="Decree cross-checked with Ministry gazette.", ip_address="10.10.14.10"),
    ])
    db.session.add_all([
        m.PhysicalDocumentHandling(document_id=bc1.id, action="ARCHIVED", performed_by=user_clerk1.id,
                                    performed_by_name_snapshot="Rana Khoury", performed_by_role_snapshot="Registry Clerk",
                                    location="Central Archive - Shelf 12", notes="Initial filing after issuance."),
        m.PhysicalDocumentHandling(document_id=dth1.id, action="ARCHIVED", performed_by=user_clerk1.id,
                                    performed_by_name_snapshot="Rana Khoury", performed_by_role_snapshot="Registry Clerk",
                                    location="Central Archive - Vault B", notes="Moved to long-term storage."),
        m.PhysicalDocumentHandling(document_id=mc1.id, action="RETRIEVED", performed_by=user_clerk2.id,
                                    performed_by_name_snapshot="Fadi Saab", performed_by_role_snapshot="Registry Clerk",
                                    location="Baabda Office - Front Desk", action_reason="Requested by court for divorce proceedings."),
    ])
    db.session.commit()

    # =================================================================
    # SERVICE REQUESTS — moving through the workflow, with SLA/payments
    # =================================================================
    def new_request(number, citizen, dtype, office, dept, state, requested_by,
                     submitted, due, priority="NORMAL", fee=0, currency="USD", **extra):
        r = m.ServiceRequest(
            request_number=number, direction="INCOMING", citizen_id=citizen.civil_registry_number,
            document_type_id=dtype.id, office_id=office.id, department_id=dept.id,
            workflow_state_id=state.id, priority=priority, requested_by_user_id=requested_by.id,
            submitted_at=submitted, due_date=due, fee_amount=fee, fee_currency=currency, **extra,
        )
        db.session.add(r)
        db.session.flush()
        return r

    req1 = new_request("REQ-2024-0001", father, dt_id, office_central, dept_registry, ws_issued, user_clerk1,
                        datetime(2024, 1, 10, 9, 0), date(2024, 1, 24), fee=25.00,
                        reviewed_by=user_supervisor.id, reviewed_at=datetime(2024, 1, 10, 14, 0), approved_by=user_supervisor.id, approved_at=datetime(2024, 1, 10, 14, 5),
                        issued_document_id=None, notes="Renewal of expiring ID card.")
    req2 = new_request("REQ-2024-0002", child2, dt_passport, office_passport, dept_docs, ws_in_review, user_passport_clerk,
                        datetime(2024, 6, 3, 10, 30), date(2024, 6, 17), fee=75.00, notes="First-time passport application.")
    req3 = new_request("REQ-2024-0003", wife2, dt_divorce, office_central, dept_registry, ws_rejected, user_clerk1,
                        datetime(2024, 2, 20, 11, 0), date(2024, 3, 1), fee=15.00,
                        reviewed_by=user_supervisor.id, reviewed_at=datetime(2024, 2, 21, 9, 0),
                        rejected_by=user_supervisor.id, rejected_at=datetime(2024, 2, 21, 9, 0),
                        rejection_reason="Missing court decision attachment.")
    req4 = new_request("REQ-2024-0004", naturalized, dt_name_change, office_central, dept_registry, ws_submitted, user_clerk1,
                        datetime(2024, 7, 1, 8, 45), date(2024, 7, 15), fee=30.00, notes="Follow-up name correction after marriage.")
    req5 = new_request("REQ-2024-0005", kid2, dt_birth, office_central, dept_registry, ws_issued, user_clerk2,
                        datetime(2024, 3, 15, 13, 0), date(2024, 3, 20), fee=10.00,
                        reviewed_by=user_supervisor.id, reviewed_at=datetime(2024, 3, 15, 16, 0), approved_by=user_supervisor.id, approved_at=datetime(2024, 3, 15, 16, 10),
                        issued_document_id=bc3.id, notes="Certified copy for school enrollment.")
    db.session.commit()

    db.session.add_all([
        m.RequestAssignment(service_request_id=req2.id, assigned_to=user_passport_clerk.id, assigned_by=user_supervisor.id, assigned_at=datetime(2024, 6, 3, 11, 0), is_active=True),
        m.RequestAssignment(service_request_id=req4.id, assigned_to=user_clerk1.id, assigned_by=user_supervisor.id, assigned_at=datetime(2024, 7, 1, 9, 0), is_active=True),
    ])
    db.session.add_all([
        m.ServiceRequestStatusHistory(service_request_id=req1.id, from_state_id=ws_submitted.id, to_state_id=ws_in_review.id, transition_id=wt_start_review.id, changed_by=user_supervisor.id, changed_at=datetime(2024, 1, 10, 13, 0)),
        m.ServiceRequestStatusHistory(service_request_id=req1.id, from_state_id=ws_in_review.id, to_state_id=ws_approved.id, transition_id=wt_approve.id, changed_by=user_supervisor.id, changed_at=datetime(2024, 1, 10, 14, 5)),
        m.ServiceRequestStatusHistory(service_request_id=req1.id, from_state_id=ws_approved.id, to_state_id=ws_issued.id, transition_id=wt_issue.id, changed_by=user_clerk1.id, changed_at=datetime(2024, 1, 11, 9, 0)),
        m.ServiceRequestStatusHistory(service_request_id=req3.id, from_state_id=ws_in_review.id, to_state_id=ws_rejected.id, transition_id=wt_reject.id, changed_by=user_supervisor.id, changed_at=datetime(2024, 2, 21, 9, 0), comment="Missing court decision attachment."),
    ])
    db.session.add_all([
        m.SlaRecord(service_request_id=req1.id, due_date=date(2024, 1, 24), sla_status="MET", days_remaining=0, last_checked_at=datetime(2024, 1, 11, 9, 0)),
        m.SlaRecord(service_request_id=req2.id, due_date=date(2024, 6, 17), sla_status="DUE_SOON", days_remaining=2, last_checked_at=datetime.utcnow()),
        m.SlaRecord(service_request_id=req4.id, due_date=date(2024, 7, 15), sla_status="OVERDUE", days_remaining=-3, overdue_by_days=3, last_checked_at=datetime.utcnow()),
    ])
    db.session.add_all([
        m.Payment(service_request_id=req1.id, amount=25.00, currency="USD", method="CASH", status="PAID", receipt_number="RCPT-0001", collected_by=user_clerk1.id, paid_at=datetime(2024, 1, 10, 9, 5)),
        m.Payment(service_request_id=req2.id, amount=75.00, currency="USD", method="BANK_TRANSFER", status="PAID", receipt_number="RCPT-0002", collected_by=user_passport_clerk.id, paid_at=datetime(2024, 6, 3, 10, 35)),
        m.Payment(service_request_id=req5.id, amount=10.00, currency="USD", method="CASH", status="PAID", receipt_number="RCPT-0003", collected_by=user_clerk2.id, paid_at=datetime(2024, 3, 15, 13, 5)),
    ])
    db.session.add_all([
        m.InternalNotification(recipient_user_id=user_passport_clerk.id, related_entity_type="service_request", related_entity_id=str(req2.id), notification_type="ASSIGNMENT", message="You were assigned request REQ-2024-0002."),
        m.InternalNotification(recipient_user_id=user_supervisor.id, related_entity_type="service_request", related_entity_id=str(req4.id), notification_type="SLA_WARNING", message="REQ-2024-0004 is overdue."),
    ])
    db.session.commit()

    # =================================================================
    # AUDIT & ACCESS LOGS
    # =================================================================
    db.session.add_all([
        m.AuditLog(actor_user_id=user_admin.id, action="ROLE_GRANTED", entity_type="user", entity_id=str(user_clerk1.id), occurred_at=datetime(2024, 1, 1, 9, 0), ip_address="10.10.14.10"),
        m.AuditLog(actor_user_id=user_supervisor.id, action="WORKFLOW_TRANSITION", entity_type="service_request", entity_id=str(req1.id), service_request_id=req1.id, occurred_at=datetime(2024, 1, 10, 14, 5), ip_address="10.10.14.21"),
        m.AuditLog(actor_user_id=user_supervisor.id, action="REQUEST_REJECTED", entity_type="service_request", entity_id=str(req3.id), service_request_id=req3.id, occurred_at=datetime(2024, 2, 21, 9, 0), ip_address="10.10.14.21"),
    ])
    db.session.add_all([
        m.CitizenAuditLog(citizen_id=naturalized.civil_registry_number, amendment_id=amendment_name_change.id, field_name="last_name_en",
                           old_value="Petrova", new_value="Haddad-Petrova", changed_by=user_admin.id,
                           reason="Approved name change record NC-2021-0410"),
        m.CitizenAuditLog(citizen_id=wife2.civil_registry_number, field_name="marital_status",
                           old_value="MARRIED", new_value="DIVORCED", changed_by=user_supervisor.id,
                           reason="Divorce certificate DIV-2023-0901 finalized"),
        m.CitizenAuditLog(citizen_id=husband2.civil_registry_number, field_name="marital_status",
                           old_value="MARRIED", new_value="DIVORCED", changed_by=user_supervisor.id,
                           reason="Divorce certificate DIV-2023-0901 finalized"),
    ])
    db.session.add_all([
        m.RecordAccessLog(citizen_id=father.civil_registry_number, accessed_by=user_clerk1.id,
                           access_type="VIEW_RECORD", ip_address="10.10.14.20", reason="ID renewal request lookup"),
        m.RecordAccessLog(citizen_id=husband2.civil_registry_number, accessed_by=user_supervisor.id,
                           access_type="EXPORT", ip_address="10.10.14.21", reason="Court-requested record export"),
        m.RecordAccessLog(citizen_id=naturalized.civil_registry_number, accessed_by=user_admin.id,
                           access_type="SEARCH_RESULT", ip_address="10.10.14.10", reason="Name change verification"),
    ])
    db.session.commit()

    print("\nSeed data inserted successfully.\n")
    print("Login credentials:")
    print(f"  {'Username':<16} {'Password':<16} {'Role':<20} Name")
    for u in [
        (user_admin, "Adm!nSecure24", "Administrator"),
        (user_clerk1, "Clerk#Rana77", "Registry Clerk"),
        (user_clerk2, "Clerk#Fadi88", "Registry Clerk"),
        (user_supervisor, "Super#Nour55", "Office Supervisor"),
        (user_passport_clerk, "Clerk#Layal21", "Registry Clerk"),
        (user_auditor, "Audit#Sara33", "Auditor"),
    ]:
        user_obj, pw, role_name = u
        print(f"  {user_obj.username:<16} {pw:<16} {role_name:<20} {user_obj.first_name} {user_obj.last_name}")