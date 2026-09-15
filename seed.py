"""
Seed the database with a realistic demo dataset spanning every module:
geography, role-based access control (with real login credentials), two
extended families across generations, all 8 document/certificate subtypes,
service requests in various states, and audit/access log samples.

Usage:
    python seed.py            # wipes and reloads all demo data
"""
from datetime import date, datetime

from app import create_app
from extensions import db
import models as m

app = create_app()

with app.app_context():
    print("Clearing existing data...")
    for model in [
        m.RecordAccessLog, m.CitizenAuditLog, m.ServiceRequest,
        m.PhysicalDocumentHandling, m.DocumentValidation,
        m.NameChangeRecord, m.NaturalizationRecord, m.Passport, m.NationalIdCard,
        m.DeathCertificate, m.DivorceCertificate, m.MarriageCertificate, m.BirthCertificate,
        m.Document, m.FamilyMember, m.FamilyRecord, m.Citizen,
        m.UserRole, m.User, m.RolePermission, m.Role, m.Permission,
        m.DocumentType, m.ReligiousAuthority, m.Court, m.Office, m.District, m.Governorate,
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
        office_type="civil_registry", address="Downtown Beirut", phone="+961-1-100200", is_active=True,
    )
    office_baabda = m.Office(
        district_id=dist_baabda.id, name_ar="مكتب نفوس بعبدا", name_en="Baabda Civil Registry Office",
        office_type="civil_registry", address="Baabda Serail", phone="+961-5-100300", is_active=True,
    )
    office_passport = m.Office(
        district_id=dist_beirut.id, name_ar="مديرية الجوازات", name_en="General Directorate of Passports",
        office_type="passport", address="Beirut", phone="+961-1-100400", is_active=True,
    )
    db.session.add_all([office_central, office_baabda, office_passport])
    db.session.flush()

    court_beirut = m.Court(
        name_ar="محكمة بيروت المدنية", name_en="Beirut Civil Court", court_type="civil",
        jurisdiction="Beirut", district_id=dist_beirut.id, is_active=True,
    )
    court_sharia = m.Court(
        name_ar="المحكمة الشرعية السنية - بيروت", name_en="Sunni Sharia Court - Beirut", court_type="sharia",
        jurisdiction="Beirut", district_id=dist_beirut.id, is_active=True,
    )
    db.session.add_all([court_beirut, court_sharia])
    db.session.flush()

    dar_fatwa = m.ReligiousAuthority(name_ar="دار الفتوى", name_en="Dar Al-Fatwa", religion="Islam", sect="Sunni", is_active=True)
    maronite_patriarchate = m.ReligiousAuthority(name_ar="البطريركية المارونية", name_en="Maronite Patriarchate", religion="Christianity", sect="Maronite", is_active=True)
    db.session.add_all([dar_fatwa, maronite_patriarchate])
    db.session.flush()

    # =================================================================
    # ACCESS CONTROL — permissions, roles, users with real credentials
    # =================================================================
    permission_defs = [
        ("geography.view", "View geography & institutions (governorates, districts, offices, courts)"),
        ("geography.edit", "Create/edit/delete geography & institutions"),
        ("access_control.view", "View users, roles, and permissions"),
        ("access_control.edit", "Create/edit/delete users, roles, and permissions"),
        ("citizens.view", "View citizens, family records, and family members"),
        ("citizens.edit", "Create/edit/delete citizens, family records, and family members"),
        ("documents.view", "View document types and documents"),
        ("documents.edit", "Create/edit/delete document types and documents"),
        ("documents.validate", "Approve/reject document validations"),
        ("certificates.view", "View all certificate subtypes (birth, marriage, divorce, death, ID, passport, naturalization, name change)"),
        ("certificates.edit", "Create/edit/delete all certificate subtypes"),
        ("requests.view", "View service requests"),
        ("requests.edit", "Create/edit/delete and process service requests"),
        ("audit.view", "View document validations, physical handling, citizen audit log, and record access log"),
    ]
    perms = {}
    for code, desc in permission_defs:
        p = m.Permission(code=code, description=desc)
        db.session.add(p)
        perms[code] = p
    db.session.flush()

    role_admin = m.Role(description="Administrator")
    role_clerk = m.Role(description="Registry Clerk")
    role_supervisor = m.Role(description="Office Supervisor")
    role_auditor = m.Role(description="Auditor")
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
            "geography.view", "citizens.view", "citizens.edit",
            "documents.view", "documents.edit", "documents.validate",
            "certificates.view", "certificates.edit",
            "requests.view", "requests.edit",
            "audit.view",
        ],
        role_auditor: [
            "geography.view", "access_control.view",
            "citizens.view", "documents.view", "certificates.view",
            "requests.view", "audit.view",
        ],
    }
    for role, codes in role_permission_map.items():
        for code in codes:
            db.session.add(m.RolePermission(role_id=role.id, permission_id=perms[code].id))
    db.session.flush()

    def make_user(username, password, first, last, office, role):
        u = m.User(username=username, first_name=first, last_name=last, office_id=office.id, active=True)
        u.set_password(password)
        db.session.add(u)
        db.session.flush()
        db.session.add(m.UserRole(user_id=u.id, role_id=role.id))
        return u

    # username / password are also listed in USER_MANUAL.md
    user_admin = make_user("amro.nasser", "Adm!nSecure24", "Amro", "Nasser", office_central, role_admin)
    user_clerk1 = make_user("rana.khoury", "Clerk#Rana77", "Rana", "Khoury", office_central, role_clerk)
    user_clerk2 = make_user("fadi.saab", "Clerk#Fadi88", "Fadi", "Saab", office_baabda, role_clerk)
    user_supervisor = make_user("nour.chami", "Super#Nour55", "Nour", "Chami", office_central, role_supervisor)
    user_passport_clerk = make_user("layal.fares", "Clerk#Layal21", "Layal", "Fares", office_passport, role_clerk)
    user_auditor = make_user("sara.yazbek", "Audit#Sara33", "Sara", "Yazbek", office_central, role_auditor)
    db.session.commit()

    # =================================================================
    # DOCUMENT TYPES
    # =================================================================
    dt_birth = m.DocumentType(code="BIRTH_CERT", name_ar="شهادة ميلاد", name_en="Birth Certificate", category="civil_status", is_active=True)
    dt_marriage = m.DocumentType(code="MARRIAGE_CERT", name_ar="عقد زواج", name_en="Marriage Certificate", category="civil_status", is_active=True)
    dt_divorce = m.DocumentType(code="DIVORCE_CERT", name_ar="وثيقة طلاق", name_en="Divorce Certificate", category="civil_status", is_active=True)
    dt_death = m.DocumentType(code="DEATH_CERT", name_ar="شهادة وفاة", name_en="Death Certificate", category="civil_status", is_active=True)
    dt_id = m.DocumentType(code="NATIONAL_ID", name_ar="بطاقة هوية", name_en="National ID Card", category="identity", validity_duration=3650, is_active=True)
    dt_passport = m.DocumentType(code="PASSPORT", name_ar="جواز سفر", name_en="Passport", category="identity", validity_duration=3650, is_active=True)
    dt_naturalization = m.DocumentType(code="NATURALIZATION", name_ar="مرسوم تجنس", name_en="Naturalization Decree", category="nationality", is_active=True)
    dt_name_change = m.DocumentType(code="NAME_CHANGE", name_ar="تصحيح اسم", name_en="Name Change Record", category="civil_status", is_active=True)
    db.session.add_all([dt_birth, dt_marriage, dt_divorce, dt_death, dt_id, dt_passport, dt_naturalization, dt_name_change])
    db.session.flush()

    # =================================================================
    # CITIZENS — two extended families across three generations
    # =================================================================
    def citizen(crn, fen, len_, far, lar, gender, dob, office, father=None, mother=None,
                marital="single", deceased=False, nationality="citizen", religion=None, sect=None):
        c = m.Citizen(
            civil_registry_number=crn, first_name_en=fen, last_name_en=len_,
            first_name_ar=far, last_name_ar=lar, gender=gender, date_of_birth=dob,
            registration_office_id=office.id, marital_status=marital, is_deceased=deceased,
            nationality=nationality, religion=religion, sect=sect,
            father_id=father, mother_id=mother,
        )
        db.session.add(c)
        return c

    gp_father = citizen("CRN-100001", "Khalil", "Haddad", "خليل", "حداد", "male", date(1948, 3, 14),
                         office_central, marital="widowed", deceased=True, religion="Christianity", sect="Maronite")
    gp_mother = citizen("CRN-100002", "Nabila", "Haddad", "نبيلة", "حداد", "female", date(1952, 6, 2),
                         office_central, marital="widowed", religion="Christianity", sect="Maronite")
    db.session.flush()

    father = citizen("CRN-100003", "Georges", "Haddad", "جورج", "حداد", "male", date(1974, 9, 10),
                      office_central, father=gp_father.civil_registry_number, mother=gp_mother.civil_registry_number,
                      marital="married", religion="Christianity", sect="Maronite")
    db.session.flush()

    mother = citizen("CRN-100004", "Rita", "Aoun", "ريتا", "عون", "female", date(1978, 1, 25),
                      office_baabda, marital="married", religion="Christianity", sect="Maronite")
    db.session.flush()

    child1 = citizen("CRN-100005", "Sami", "Haddad", "سامي", "حداد", "male", date(2001, 11, 20),
                      office_central, father=father.civil_registry_number, mother=mother.civil_registry_number,
                      marital="single", religion="Christianity", sect="Maronite")
    child2 = citizen("CRN-100006", "Maya", "Haddad", "مايا", "حداد", "female", date(2005, 4, 8),
                      office_central, father=father.civil_registry_number, mother=mother.civil_registry_number,
                      marital="single", religion="Christianity", sect="Maronite")
    db.session.flush()

    husband2 = citizen("CRN-200001", "Omar", "Khalil", "عمر", "خليل", "male", date(1985, 2, 17),
                        office_central, marital="divorced", religion="Islam", sect="Sunni")
    wife2 = citizen("CRN-200002", "Dina", "Mrad", "دينا", "مراد", "female", date(1988, 8, 30),
                     office_central, marital="divorced", religion="Islam", sect="Sunni")
    db.session.flush()

    kid2 = citizen("CRN-200003", "Yara", "Khalil", "يارا", "خليل", "female", date(2012, 5, 5),
                    office_central, father=husband2.civil_registry_number, mother=wife2.civil_registry_number,
                    marital="single", religion="Islam", sect="Sunni")

    naturalized = citizen("CRN-300001", "Elena", "Petrova", "إيلينا", "بتروفا", "female", date(1990, 7, 19),
                           office_central, marital="married", nationality="naturalized", religion="Christianity", sect="Orthodox")
    db.session.flush()
    db.session.commit()

    # =================================================================
    # HOUSEHOLDS
    # =================================================================
    family_haddad = m.FamilyRecord(family_book_number="FB-500001", head_of_household_id=father.civil_registry_number, registration_office_id=office_central.id)
    family_khalil = m.FamilyRecord(family_book_number="FB-500002", head_of_household_id=husband2.civil_registry_number, registration_office_id=office_central.id)
    db.session.add_all([family_haddad, family_khalil])
    db.session.flush()

    db.session.add_all([
        m.FamilyMember(family_record_id=family_haddad.id, citizen_id=father.civil_registry_number, relationship_="head", joined_date=date(2000, 6, 15)),
        m.FamilyMember(family_record_id=family_haddad.id, citizen_id=mother.civil_registry_number, relationship_="spouse", joined_date=date(2000, 6, 15)),
        m.FamilyMember(family_record_id=family_haddad.id, citizen_id=child1.civil_registry_number, relationship_="son", joined_date=date(2001, 11, 20)),
        m.FamilyMember(family_record_id=family_haddad.id, citizen_id=child2.civil_registry_number, relationship_="daughter", joined_date=date(2005, 4, 8)),
        m.FamilyMember(family_record_id=family_khalil.id, citizen_id=husband2.civil_registry_number, relationship_="head", joined_date=date(2010, 3, 1)),
        m.FamilyMember(family_record_id=family_khalil.id, citizen_id=wife2.civil_registry_number, relationship_="spouse", joined_date=date(2010, 3, 1), left_date=date(2023, 9, 1), left_reason="divorce"),
        m.FamilyMember(family_record_id=family_khalil.id, citizen_id=kid2.civil_registry_number, relationship_="daughter", joined_date=date(2012, 5, 5)),
    ])
    db.session.commit()

    # =================================================================
    # DOCUMENTS + SUBTYPES
    # =================================================================
    def new_document(dtype, crn, number, issue, office, status="issued", vstatus="approved",
                      created=user_clerk1, validated=user_supervisor, expiry=None):
        doc = m.Document(
            document_type_id=dtype.id, civil_registry_number=crn, document_number=number,
            issue_date=issue, expiry_date=expiry, issuing_office_id=office.id,
            status=status, validation_status=vstatus,
            created_by=created.id, updated_by=created.id,
            validated_by=validated.id if vstatus == "approved" else None,
            validated_at=datetime.combine(issue, datetime.min.time()) if vstatus == "approved" else None,
        )
        db.session.add(doc)
        db.session.flush()
        return doc

    bc1 = new_document(dt_birth, child1.civil_registry_number, "BC-2001-1120", date(2001, 11, 22), office_central)
    db.session.add(m.BirthCertificate(
        document_id=bc1.id, citizen_id=child1.civil_registry_number, birth_place="Beirut",
        birth_hospital="Hotel Dieu de France", father_full_name="Georges Haddad", mother_full_name="Rita Aoun",
        registration_number="REG-2001-1120", registrar_name="Rana Khoury",
    ))

    bc2 = new_document(dt_birth, child2.civil_registry_number, "BC-2005-0408", date(2005, 4, 10), office_central)
    db.session.add(m.BirthCertificate(
        document_id=bc2.id, citizen_id=child2.civil_registry_number, birth_place="Beirut",
        birth_hospital="Hotel Dieu de France", father_full_name="Georges Haddad", mother_full_name="Rita Aoun",
        registration_number="REG-2005-0408", registrar_name="Rana Khoury",
    ))

    bc3 = new_document(dt_birth, kid2.civil_registry_number, "BC-2012-0505", date(2012, 5, 7), office_central)
    db.session.add(m.BirthCertificate(
        document_id=bc3.id, citizen_id=kid2.civil_registry_number, birth_place="Beirut",
        birth_hospital="American University Hospital", father_full_name="Omar Khalil", mother_full_name="Dina Mrad",
        registration_number="REG-2012-0505", registrar_name="Fadi Saab",
    ))

    mc1 = new_document(dt_marriage, husband2.civil_registry_number, "MC-2010-0301", date(2010, 3, 1), office_central)
    marriage1 = m.MarriageCertificate(
        document_id=mc1.id, husband_id=husband2.civil_registry_number, wife_id=wife2.civil_registry_number,
        marriage_date=date(2010, 3, 1), marriage_place="Beirut", court_id=court_sharia.id,
        religious_authority_id=dar_fatwa.id, contract_number="CN-2010-0301", dowry_amount=5000.00, status="dissolved",
    )
    db.session.add(marriage1)
    db.session.flush()

    dc1 = new_document(dt_divorce, husband2.civil_registry_number, "DIV-2023-0901", date(2023, 9, 1), office_central)
    db.session.add(m.DivorceCertificate(
        document_id=dc1.id, marriage_certificate_id=marriage1.document_id,
        husband_id=husband2.civil_registry_number, wife_id=wife2.civil_registry_number,
        divorce_date=date(2023, 9, 1), divorce_place="Beirut", court_id=court_sharia.id,
        court_decision_number="SC-2023-4471", divorce_type="mutual_consent",
        divorce_reason="Irreconcilable differences", child_custody_agreement="Joint custody of Yara Khalil, primary residence with mother.",
        financial_settlement="One-time settlement of $10,000 paid by husband.",
        religious_authority_id=dar_fatwa.id, sharia_court_approval="Approved 2023-09-01", status="finalized",
    ))

    dth1 = new_document(dt_death, gp_father.civil_registry_number, "DTH-2020-0612", date(2020, 6, 12), office_central)
    db.session.add(m.DeathCertificate(
        document_id=dth1.id, deceased_id=gp_father.civil_registry_number, death_date=date(2020, 6, 10),
        death_place="Beirut", death_cause="Natural causes - cardiac arrest",
        certifying_physician="Dr. Elias Nader", burial_place="Our Lady of Lebanon Cemetery", burial_date=date(2020, 6, 13),
    ))

    for cz, num, iss in [
        (father, "ID-CRN100003", date(2019, 1, 15)),
        (mother, "ID-CRN100004", date(2019, 1, 15)),
        (child1, "ID-CRN100005", date(2020, 1, 20)),
        (husband2, "ID-CRN200001", date(2018, 5, 10)),
        (naturalized, "ID-CRN300001", date(2021, 3, 1)),
    ]:
        d = new_document(dt_id, cz.civil_registry_number, num.replace("ID-", "IDDOC-"), iss, office_central, expiry=iss.replace(year=iss.year + 10))
        db.session.add(m.NationalIdCard(
            document_id=d.id, citizen_id=cz.civil_registry_number, card_number=num,
            issue_date=iss, expiry_date=iss.replace(year=iss.year + 10),
            chip_serial_number=f"CHIP-{num[-6:]}", status="active",
        ))

    for cz, num, iss in [(father, "P-LB-0011234", date(2022, 2, 1)), (mother, "P-LB-0011235", date(2022, 2, 1))]:
        d = new_document(dt_passport, cz.civil_registry_number, num, iss, office_passport,
                          expiry=iss.replace(year=iss.year + 10), created=user_passport_clerk)
        db.session.add(m.Passport(
            document_id=d.id, citizen_id=cz.civil_registry_number, passport_number=num,
            passport_type="ordinary", issue_date=iss, expiry_date=iss.replace(year=iss.year + 10),
            issuing_office_id=office_passport.id, page_count=34, status="active",
        ))

    nat_doc = new_document(dt_naturalization, naturalized.civil_registry_number, "NAT-2021-0301", date(2021, 3, 1), office_central)
    db.session.add(m.NaturalizationRecord(
        document_id=nat_doc.id, citizen_id=naturalized.civil_registry_number,
        previous_nationality="Russian", naturalization_date=date(2021, 3, 1),
        decree_number="DEC-9821", decree_date=date(2021, 2, 15), status="approved",
    ))

    nc_doc = new_document(dt_name_change, naturalized.civil_registry_number, "NC-2021-0410", date(2021, 4, 10), office_central)
    db.session.add(m.NameChangeRecord(
        document_id=nc_doc.id, citizen_id=naturalized.civil_registry_number,
        old_first_name="Elena", old_middle_name=None, old_last_name="Petrova",
        new_first_name="Elena", new_middle_name="Georges", new_last_name="Haddad-Petrova",
        reason="Marriage-related name update", court_decision_number="CV-2021-771", change_date=date(2021, 4, 10),
    ))
    db.session.commit()

    # =================================================================
    # DOCUMENT VALIDATIONS & PHYSICAL HANDLING
    # =================================================================
    db.session.add_all([
        m.DocumentValidation(document_id=bc1.id, validator_id=user_supervisor.id, validation_type="standard",
                              status="approved", comments="Verified against hospital birth record.", ip_address="10.10.14.20"),
        m.DocumentValidation(document_id=mc1.id, validator_id=user_supervisor.id, validation_type="standard",
                              status="approved", comments="Contract verified with Sharia court registry.", ip_address="10.10.14.21"),
        m.DocumentValidation(document_id=dc1.id, validator_id=user_supervisor.id, validation_type="standard",
                              status="approved", comments="Court decision number confirmed.", ip_address="10.10.14.21"),
        m.DocumentValidation(document_id=nat_doc.id, validator_id=user_admin.id, validation_type="enhanced",
                              status="approved", comments="Decree cross-checked with Ministry gazette.", ip_address="10.10.14.10"),
    ])
    db.session.add_all([
        m.PhysicalDocumentHandling(document_id=bc1.id, action="filed", performed_by=user_clerk1.id,
                                    performed_by_name="Rana Khoury", performed_by_role="Registry Clerk",
                                    location="Central Archive - Shelf 12", notes="Initial filing after issuance."),
        m.PhysicalDocumentHandling(document_id=dth1.id, action="archived", performed_by=user_clerk1.id,
                                    performed_by_name="Rana Khoury", performed_by_role="Registry Clerk",
                                    location="Central Archive - Vault B", notes="Moved to long-term storage."),
        m.PhysicalDocumentHandling(document_id=mc1.id, action="retrieved", performed_by=user_clerk2.id,
                                    performed_by_name="Fadi Saab", performed_by_role="Registry Clerk",
                                    location="Baabda Office - Front Desk", action_reason="Requested by court for divorce proceedings."),
    ])
    db.session.commit()

    # =================================================================
    # SERVICE REQUESTS — various states
    # =================================================================
    db.session.add_all([
        m.ServiceRequest(
            request_number="REQ-2024-0001", citizen_id=father.civil_registry_number, document_type_id=dt_id.id,
            requested_by_user_id=user_clerk1.id, status="issued", submitted_at=datetime(2024, 1, 10, 9, 0),
            reviewed_by=user_supervisor.id, reviewed_at=datetime(2024, 1, 10, 14, 0), approved_at=datetime(2024, 1, 10, 14, 5),
            fee_amount=25.00, payment_status="paid", notes="Renewal of expiring ID card.",
        ),
        m.ServiceRequest(
            request_number="REQ-2024-0002", citizen_id=child2.civil_registry_number, document_type_id=dt_passport.id,
            requested_by_user_id=user_passport_clerk.id, status="in_review", submitted_at=datetime(2024, 6, 3, 10, 30),
            fee_amount=75.00, payment_status="paid", notes="First-time passport application.",
        ),
        m.ServiceRequest(
            request_number="REQ-2024-0003", citizen_id=wife2.civil_registry_number, document_type_id=dt_divorce.id,
            status="rejected", submitted_at=datetime(2024, 2, 20, 11, 0),
            reviewed_by=user_supervisor.id, reviewed_at=datetime(2024, 2, 21, 9, 0),
            rejection_reason="Missing court decision attachment.", fee_amount=15.00, payment_status="unpaid",
        ),
        m.ServiceRequest(
            request_number="REQ-2024-0004", citizen_id=naturalized.civil_registry_number, document_type_id=dt_name_change.id,
            requested_by_user_id=user_clerk1.id, status="submitted", submitted_at=datetime(2024, 7, 1, 8, 45),
            fee_amount=30.00, payment_status="unpaid", notes="Follow-up name correction after marriage.",
        ),
        m.ServiceRequest(
            request_number="REQ-2024-0005", citizen_id=kid2.civil_registry_number, document_type_id=dt_birth.id,
            status="approved", submitted_at=datetime(2024, 3, 15, 13, 0),
            reviewed_by=user_supervisor.id, reviewed_at=datetime(2024, 3, 15, 16, 0), approved_at=datetime(2024, 3, 15, 16, 10),
            issued_document_id=bc3.id, fee_amount=10.00, payment_status="paid", notes="Certified copy for school enrollment.",
        ),
    ])
    db.session.commit()

    # =================================================================
    # AUDIT & ACCESS LOGS
    # =================================================================
    db.session.add_all([
        m.CitizenAuditLog(citizen_id=naturalized.civil_registry_number, field_name="last_name_en",
                           old_value="Petrova", new_value="Haddad-Petrova", changed_by=user_admin.id,
                           reason="Approved name change record NC-2021-0410"),
        m.CitizenAuditLog(citizen_id=wife2.civil_registry_number, field_name="marital_status",
                           old_value="married", new_value="divorced", changed_by=user_supervisor.id,
                           reason="Divorce certificate DIV-2023-0901 finalized"),
        m.CitizenAuditLog(citizen_id=husband2.civil_registry_number, field_name="marital_status",
                           old_value="married", new_value="divorced", changed_by=user_supervisor.id,
                           reason="Divorce certificate DIV-2023-0901 finalized"),
    ])
    db.session.add_all([
        m.RecordAccessLog(citizen_id=father.civil_registry_number, accessed_by=user_clerk1.id,
                           access_type="view", ip_address="10.10.14.20", reason="ID renewal request lookup"),
        m.RecordAccessLog(citizen_id=husband2.civil_registry_number, accessed_by=user_supervisor.id,
                           access_type="export", ip_address="10.10.14.21", reason="Court-requested record export"),
        m.RecordAccessLog(citizen_id=naturalized.civil_registry_number, accessed_by=user_admin.id,
                           access_type="print", ip_address="10.10.14.10", reason="Name change verification"),
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
