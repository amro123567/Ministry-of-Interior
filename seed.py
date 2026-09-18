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
import hashlib
import random
from datetime import date, datetime, timedelta

from app import create_app
from extensions import db
import models as m

app = create_app()

# Anchors for every generated date. Defined once, at the top, so the
# hand-written examples below and the bulk population at the end agree on
# what "now" means.
TODAY = date.today()
NOW = datetime.now()

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
    # REFERENCE POOLS
    #
    # Defined once, up here, because everything below draws on them —
    # mukhtars and staff as well as the bulk citizen population. The seed
    # is fixed so two runs produce byte-identical data.
    #
    # Surnames of prominent political families are deliberately left out:
    # this is a demo registry, and a screen full of recognisable names
    # reads as a joke rather than as records.
    # =================================================================
    random.seed(20260917)

    FAMILY_NAMES = [
        ("Haddad", "حداد"), ("Khoury", "خوري"), ("Nassar", "نصار"), ("Saad", "سعد"),
        ("Aoun", "عون"), ("Rizk", "رزق"), ("Sleiman", "سليمان"), ("Chami", "شامي"),
        ("Fares", "فارس"), ("Saab", "صعب"), ("Mrad", "مراد"), ("Khalil", "خليل"),
        ("Zeidan", "زيدان"), ("Ghanem", "غانم"), ("Abou Zeid", "أبو زيد"), ("Daher", "ضاهر"),
        ("Hobeika", "حبيقة"), ("Chidiac", "شدياق"), ("Kassem", "قاسم"), ("Hamdan", "حمدان"),
        ("Issa", "عيسى"), ("Ayoub", "أيوب"), ("Bou Karam", "بو كرم"), ("Tannous", "طنوس"),
        ("Jaber", "جابر"), ("Younes", "يونس"), ("Sfeir", "صفير"), ("Matar", "مطر"),
        ("Assaf", "عساف"), ("Hayek", "حايك"), ("Zouein", "زوين"), ("Bassil", "باسيل"),
        ("Rahme", "رحمة"), ("Sarkis", "سركيس"), ("Merhi", "مرعي"), ("Kanaan", "كنعان"),
        ("Maalouf", "معلوف"), ("Chalhoub", "شلهوب"), ("Azar", "عازار"), ("Rahal", "رحال"),
        ("Diab", "دياب"), ("Hallak", "حلاق"), ("Srour", "سرور"), ("Zakhia", "زخيا"),
        ("Barakat", "بركات"), ("Nehme", "نعمة"), ("Khattar", "خطار"), ("Dagher", "داغر"),
        ("Habib", "حبيب"), ("Salameh", "سلامة"), ("Mansour", "منصور"), ("Wehbe", "وهبة"),
        ("Semaan", "سمعان"), ("Abdallah", "عبد الله"), ("Ammar", "عمار"), ("Baroudi", "بارودي"),
        ("Doumit", "ضومط"), ("Eid", "عيد"), ("Farhat", "فرحات"), ("Gerges", "جرجس"),
        ("Hachem", "هاشم"), ("Jammal", "جمال"), ("Kfoury", "كفوري"), ("Mouawad", "معوض"),
        ("Naaman", "نعمان"), ("Obeid", "عبيد"), ("Rustom", "رستم"), ("Sader", "صادر"),
        ("Tawil", "طويل"), ("Wakim", "وكيم"), ("Yammine", "يمين"), ("Zgheib", "زغيب"),
        ("Abboud", "عبود"), ("Achkar", "أشقر"), ("Bejjani", "بجاني"), ("Chehade", "شحادة"),
        ("Darwish", "درويش"), ("Ezzeddine", "عز الدين"), ("Fakhoury", "فاخوري"), ("Ghosn", "غصن"),
        ("Hoteit", "حطيط"), ("Itani", "عيتاني"), ("Jurdi", "جردي"), ("Kabbani", "قباني"),
        ("Labaki", "لبكي"), ("Nasr", "نصر"), ("Rifai", "الرفاعي"), ("Sayegh", "صايغ"),
        ("Traboulsi", "طرابلسي"), ("Moukalled", "مقلد"), ("Osseiran", "عسيران"), ("Zein", "زين"),
    ]
    MALE_NAMES = [
        ("Ali", "علي"), ("Georges", "جورج"), ("Hassan", "حسن"), ("Elie", "إيلي"),
        ("Karim", "كريم"), ("Tony", "طوني"), ("Mohammad", "محمد"), ("Marwan", "مروان"),
        ("Fadi", "فادي"), ("Ziad", "زياد"), ("Sami", "سامي"), ("Bilal", "بلال"),
        ("Charbel", "شربل"), ("Omar", "عمر"), ("Nabil", "نبيل"), ("Rami", "رامي"),
        ("Hadi", "هادي"), ("Wissam", "وسام"), ("Joseph", "جوزيف"), ("Ahmad", "أحمد"),
        ("Khalil", "خليل"), ("Ibrahim", "إبراهيم"), ("Youssef", "يوسف"), ("Michel", "ميشال"),
        ("Antoine", "أنطوان"), ("Pierre", "بيار"), ("Walid", "وليد"), ("Samir", "سمير"),
        ("Bassam", "بسام"), ("Riad", "رياض"), ("Jad", "جاد"), ("Naji", "ناجي"),
        ("Fouad", "فؤاد"), ("Elias", "إلياس"), ("Nadim", "نديم"), ("Hisham", "هشام"),
        ("Tarek", "طارق"), ("Amer", "عامر"), ("Mounir", "منير"), ("Raymond", "ريمون"),
        ("Wael", "وائل"), ("Ghassan", "غسان"), ("Imad", "عماد"), ("Salim", "سليم"),
        ("Nizar", "نزار"), ("Kamal", "كمال"), ("Maher", "ماهر"), ("Adnan", "عدنان"),
        ("Rabih", "ربيع"), ("Toufic", "توفيق"), ("Assaad", "أسعد"), ("Jamil", "جميل"),
        ("Mazen", "مازن"), ("Hani", "هاني"), ("Chadi", "شادي"), ("Roger", "روجيه"),
    ]
    FEMALE_NAMES = [
        ("Rana", "رنا"), ("Maya", "مايا"), ("Nour", "نور"), ("Layal", "ليال"),
        ("Rita", "ريتا"), ("Zeina", "زينة"), ("Hiba", "هبة"), ("Carla", "كارلا"),
        ("Yara", "يارا"), ("Dina", "دينا"), ("Mirna", "ميرنا"), ("Sara", "سارة"),
        ("Joelle", "جويل"), ("Rasha", "رشا"), ("Nadine", "نادين"), ("Salma", "سلمى"),
        ("Christelle", "كريستيل"), ("Fatima", "فاطمة"), ("Lara", "لارا"), ("Maria", "ماريا"),
        ("Amal", "أمل"), ("Hanan", "حنان"), ("Rima", "ريما"), ("Nada", "ندى"),
        ("Leila", "ليلى"), ("Samira", "سميرة"), ("Mona", "منى"), ("Therese", "تريز"),
        ("Marie", "ماري"), ("Jocelyne", "جوسلين"), ("Randa", "رندة"), ("Ghada", "غادة"),
        ("Zahra", "زهراء"), ("Aya", "آية"), ("Farah", "فرح"), ("Diala", "ديالا"),
        ("Rouba", "روبا"), ("Nisrine", "نسرين"), ("Wafaa", "وفاء"), ("Souad", "سعاد"),
        ("Nayla", "نايلة"), ("Abeer", "عبير"), ("Reem", "ريم"), ("Hala", "هالة"),
        ("Jana", "جنى"), ("Lina", "لينا"), ("Mayssa", "ميساء"), ("Tala", "تالا"),
        ("Nathalie", "ناتالي"), ("Sandra", "ساندرا"), ("Rola", "رولا"), ("Iman", "إيمان"),
        ("Batoul", "بتول"), ("Kawthar", "كوثر"), ("Cynthia", "سينثيا"), ("Perla", "بيرلا"),
    ]

    # =================================================================
    # GEOGRAPHY & INSTITUTIONS
    # =================================================================
    # The real Lebanese administrative map: 9 governorates and their qadas.
    # A civil registry that only knows Beirut and Baabda cannot demonstrate
    # registry transfers, jurisdiction, or office-scoped permissions.
    GOVERNORATES = [
        ("BRT", "بيروت", "Beirut", "1", [
            ("BRT-1", "بيروت", "Beirut District", "Beirut", "بيروت"),
        ]),
        ("MLB", "جبل لبنان", "Mount Lebanon", "5", [
            ("MLB-1", "بعبدا", "Baabda District", "Baabda", "بعبدا"),
            ("MLB-2", "المتن", "Metn District", "Jdeideh", "الجديدة"),
            ("MLB-3", "عاليه", "Aley District", "Aley", "عاليه"),
            ("MLB-4", "الشوف", "Chouf District", "Beiteddine", "بيت الدين"),
        ]),
        ("KSJ", "كسروان - جبيل", "Keserwan-Jbeil", "9", [
            ("KSJ-1", "كسروان", "Keserwan District", "Jounieh", "جونية"),
            ("KSJ-2", "جبيل", "Jbeil District", "Jbeil", "جبيل"),
        ]),
        ("NRT", "الشمال", "North", "6", [
            ("NRT-1", "طرابلس", "Tripoli District", "Tripoli", "طرابلس"),
            ("NRT-2", "الكورة", "Koura District", "Amioun", "أميون"),
            ("NRT-3", "زغرتا", "Zgharta District", "Zgharta", "زغرتا"),
            ("NRT-4", "بشري", "Bcharre District", "Bcharre", "بشري"),
            ("NRT-5", "البترون", "Batroun District", "Batroun", "البترون"),
            ("NRT-6", "المنية - الضنية", "Minieh-Danniyeh District", "Sir El Danniyeh", "سير الضنية"),
        ]),
        ("AKR", "عكار", "Akkar", "6", [
            ("AKR-1", "عكار", "Akkar District", "Halba", "حلبا"),
        ]),
        ("BQA", "البقاع", "Beqaa", "8", [
            ("BQA-1", "زحلة", "Zahle District", "Zahle", "زحلة"),
            ("BQA-2", "البقاع الغربي", "West Beqaa District", "Joub Jannine", "جب جنين"),
            ("BQA-3", "راشيا", "Rashaya District", "Rashaya", "راشيا"),
        ]),
        ("BHM", "بعلبك - الهرمل", "Baalbek-Hermel", "8", [
            ("BHM-1", "بعلبك", "Baalbek District", "Baalbek", "بعلبك"),
            ("BHM-2", "الهرمل", "Hermel District", "Hermel", "الهرمل"),
        ]),
        ("STH", "الجنوب", "South", "7", [
            ("STH-1", "صيدا", "Saida District", "Saida", "صيدا"),
            ("STH-2", "صور", "Tyre District", "Tyre", "صور"),
            ("STH-3", "جزين", "Jezzine District", "Jezzine", "جزين"),
        ]),
        ("NBT", "النبطية", "Nabatieh", "7", [
            ("NBT-1", "النبطية", "Nabatieh District", "Nabatieh", "النبطية"),
            ("NBT-2", "مرجعيون", "Marjeyoun District", "Marjeyoun", "مرجعيون"),
            ("NBT-3", "حاصبيا", "Hasbaya District", "Hasbaya", "حاصبيا"),
            ("NBT-4", "بنت جبيل", "Bint Jbeil District", "Bint Jbeil", "بنت جبيل"),
        ]),
    ]

    govs, districts, district_seat, district_area_code = {}, {}, {}, {}
    for gcode, g_ar, g_en, area_code, qadas in GOVERNORATES:
        g = m.Governorate(name_ar=g_ar, name_en=g_en, code=gcode)
        db.session.add(g)
        db.session.flush()
        govs[gcode] = g
        for dcode, d_ar, d_en, seat_en, seat_ar in qadas:
            d = m.District(governorate_id=g.id, name_ar=d_ar, name_en=d_en, code=dcode)
            db.session.add(d)
            districts[dcode] = d
            district_seat[dcode] = (seat_en, seat_ar)
            district_area_code[dcode] = area_code
    db.session.flush()

    gov_beirut = govs["BRT"]
    gov_mount_lebanon = govs["MLB"]
    dist_beirut = districts["BRT-1"]
    dist_baabda = districts["MLB-1"]
    dist_metn = districts["MLB-2"]

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

    # One district registry office per remaining qada, seated in the qada's
    # administrative centre. These are what make registry transfers between
    # offices, and office-scoped work queues, mean anything.
    regional_offices = []
    for dcode, d in districts.items():
        if dcode in ("BRT-1", "MLB-1"):
            continue  # already covered by the central and Baabda offices
        seat_en, seat_ar = district_seat[dcode]
        short_en = d.name_en.replace(" District", "")
        o = m.Office(
            district_id=d.id,
            name_ar=f"مكتب نفوس {d.name_ar}",
            name_en=f"{short_en} Civil Registry Office",
            code=f"OFC-{dcode}", office_type="DISTRICT",
            address=f"{seat_en}, {short_en}",
            phone=f"+961-{district_area_code[dcode]}-{random.randint(100000, 999999)}",
            is_active=True,
        )
        db.session.add(o)
        regional_offices.append(o)
    db.session.flush()

    dept_registry = m.Department(name_ar="قسم النفوس", name_en="Civil Registry Department", code="DEPT-REG")
    dept_docs = m.Department(name_ar="قسم الوثائق", name_en="Documents Department", code="DEPT-DOC")
    db.session.add_all([dept_registry, dept_docs])
    db.session.flush()

    # Sub-departments, so the departments tree is a tree and not a flat pair.
    dept_archives = m.Department(parent_id=dept_docs.id, name_ar="دائرة الأرشيف", name_en="Archives Division",
                                 code="DEPT-ARC", description="Physical and digital custody of issued documents.")
    dept_travel = m.Department(parent_id=dept_docs.id, name_ar="دائرة وثائق السفر", name_en="Travel Documents Division",
                               code="DEPT-TRV", description="Passports and travel document issuance.")
    dept_legal = m.Department(parent_id=dept_registry.id, name_ar="دائرة الشؤون القانونية", name_en="Legal Affairs Division",
                              code="DEPT-LEG", description="Court-ordered amendments, naturalisation and name changes.")
    dept_vital = m.Department(parent_id=dept_registry.id, name_ar="دائرة الأحوال الشخصية", name_en="Vital Records Division",
                              code="DEPT-VIT", description="Births, marriages, divorces and deaths.")
    dept_it = m.Department(name_ar="دائرة المعلوماتية", name_en="Information Systems Division",
                           code="DEPT-ITS", description="Registry system administration and support.")
    # A division that was folded into Legal Affairs; kept inactive because
    # older records still reference it.
    dept_old_claims = m.Department(parent_id=dept_registry.id, name_ar="دائرة المطالبات",
                                   name_en="Claims Division (merged into Legal Affairs)",
                                   code="DEPT-CLM", description="Superseded — retained for historic records.",
                                   is_active=False)
    db.session.add_all([dept_archives, dept_travel, dept_legal, dept_vital, dept_it, dept_old_claims])
    db.session.flush()

    # Courts: a civil court in each governorate seat, plus the confessional
    # courts that actually hold jurisdiction over marriage and divorce in
    # Lebanon. Personal status is not one jurisdiction here, it is several,
    # and the schema's court_type column is where that shows.
    COURT_SPECS = [
        ("BRT-1", "CIVIL", "Beirut Civil Court", "محكمة بيروت المدنية"),
        ("MLB-1", "CIVIL", "Baabda Civil Court", "محكمة بعبدا المدنية"),
        ("NRT-1", "CIVIL", "Tripoli Civil Court", "محكمة طرابلس المدنية"),
        ("BQA-1", "CIVIL", "Zahle Civil Court", "محكمة زحلة المدنية"),
        ("STH-1", "CIVIL", "Saida Civil Court", "محكمة صيدا المدنية"),
        ("NBT-1", "CIVIL", "Nabatieh Civil Court", "محكمة النبطية المدنية"),
        ("KSJ-1", "CIVIL", "Jounieh Civil Court", "محكمة جونية المدنية"),
        ("BRT-1", "SHARIA", "Sunni Sharia Court - Beirut", "المحكمة الشرعية السنية - بيروت"),
        ("NRT-1", "SHARIA", "Sunni Sharia Court - Tripoli", "المحكمة الشرعية السنية - طرابلس"),
        ("STH-1", "SHARIA", "Sunni Sharia Court - Saida", "المحكمة الشرعية السنية - صيدا"),
        ("BRT-1", "JAAFARI", "Jaafari Court - Beirut", "المحكمة الجعفرية - بيروت"),
        ("NBT-1", "JAAFARI", "Jaafari Court - Nabatieh", "المحكمة الجعفرية - النبطية"),
        ("BHM-1", "JAAFARI", "Jaafari Court - Baalbek", "المحكمة الجعفرية - بعلبك"),
        ("MLB-3", "DRUZE", "Druze Confessional Court - Aley", "محكمة المذهب الدرزي - عاليه"),
        ("BQA-3", "DRUZE", "Druze Confessional Court - Rashaya", "محكمة المذهب الدرزي - راشيا"),
        ("BRT-1", "ECCLESIASTICAL", "Maronite Ecclesiastical Court - Beirut", "المحكمة الروحية المارونية - بيروت"),
        ("KSJ-1", "ECCLESIASTICAL", "Maronite Ecclesiastical Court - Keserwan", "المحكمة الروحية المارونية - كسروان"),
        ("NRT-2", "ECCLESIASTICAL", "Greek Orthodox Ecclesiastical Court - Koura", "المحكمة الروحية للروم الأرثوذكس - الكورة"),
        ("BQA-1", "ECCLESIASTICAL", "Greek Catholic Ecclesiastical Court - Zahle", "المحكمة الروحية للروم الكاثوليك - زحلة"),
    ]
    courts_by_type = {}
    courts_by_key = {}
    for dcode, ctype, c_en, c_ar in COURT_SPECS:
        d = districts[dcode]
        c = m.Court(name_ar=c_ar, name_en=c_en, court_type=ctype,
                    jurisdiction=d.name_en.replace(" District", ""),
                    district_id=d.id, is_active=True)
        db.session.add(c)
        courts_by_type.setdefault(ctype, []).append(c)
        courts_by_key[(dcode, ctype)] = c
    db.session.flush()

    court_beirut = courts_by_key[("BRT-1", "CIVIL")]
    court_sharia = courts_by_key[("BRT-1", "SHARIA")]

    # One court has been merged into a neighbouring one. Historic records
    # still point at it, which is why it is deactivated rather than deleted —
    # and why the is_active filter on this screen is not decoration.
    courts_by_key[("BQA-3", "DRUZE")].is_active = False

    RELIGIOUS_AUTHORITY_SPECS = [
        ("دار الفتوى", "Dar Al-Fatwa", "Islam", "Sunni"),
        ("المجلس الإسلامي الشيعي الأعلى", "Higher Shia Islamic Council", "Islam", "Shia"),
        ("مشيخة عقل طائفة الموحدين الدروز", "Druze Community Sheikh Aql Office", "Islam", "Druze"),
        ("البطريركية المارونية", "Maronite Patriarchate", "Christianity", "Maronite"),
        ("بطريركية أنطاكية للروم الأرثوذكس", "Greek Orthodox Patriarchate of Antioch", "Christianity", "Orthodox"),
        ("بطريركية أنطاكية للروم الكاثوليك", "Greek Catholic Patriarchate of Antioch", "Christianity", "Catholic"),
    ]
    authorities_by_sect = {}
    for a_ar, a_en, religion, sect in RELIGIOUS_AUTHORITY_SPECS:
        ra = m.ReligiousAuthority(name_ar=a_ar, name_en=a_en, religion=religion, sect=sect, is_active=True)
        db.session.add(ra)
        authorities_by_sect[sect] = ra
    db.session.flush()

    dar_fatwa = authorities_by_sect["Sunni"]
    maronite_patriarchate = authorities_by_sect["Maronite"]

    def court_type_for(religion, sect):
        if religion == "Islam":
            return {"Shia": "JAAFARI", "Druze": "DRUZE"}.get(sect, "SHARIA")
        return "ECCLESIASTICAL"

    def court_for(religion, sect, district_id=None):
        """Pick a court with jurisdiction over this person's personal status,
        preferring one in their own district when there is one."""
        pool = courts_by_type[court_type_for(religion, sect)]
        local = [c for c in pool if district_id is not None and c.district_id == district_id]
        return random.choice(local or pool)

    def authority_for(sect):
        return authorities_by_sect.get(sect)

    # Mukhtars — one or two per qada. They are who attests a birth or death
    # before it reaches the registry, so documents point back at them.
    mukhtars_by_district = {}
    NEIGHBOURHOODS = ["Upper quarter", "Lower quarter", "Old souk quarter", "Station quarter",
                      "Church square", "Mosque square", "New quarter", "Hill quarter"]
    for dcode, d in districts.items():
        seat_en, seat_ar = district_seat[dcode]
        for n in range(random.choice([1, 1, 2])):
            f_en, f_ar = random.choice(MALE_NAMES)
            l_en, l_ar = random.choice(FAMILY_NAMES)
            term_start = date(random.choice([2016, 2022]), random.randint(1, 6), random.randint(1, 28))
            mk = m.Mukhtar(
                district_id=d.id, first_name_ar=f_ar, last_name_ar=l_ar,
                first_name_en=f_en, last_name_en=l_en,
                village_or_neighborhood=f"{seat_en} — {random.choice(NEIGHBOURHOODS)}" if n else seat_en,
                phone=f"+961-3-{random.randint(100000, 999999)}",
                email=f"{f_en.lower()}.{l_en.lower().replace(' ', '')}@mukhtar.gov.lb",
                term_start=term_start,
                term_end=term_start.replace(year=term_start.year + 6),
                is_active=term_start.year == 2022,
            )
            db.session.add(mk)
            mukhtars_by_district.setdefault(dcode, []).append(mk)
    db.session.flush()

    mukhtar1 = mukhtars_by_district["BRT-1"][0]
    all_mukhtars = [mk for lst in mukhtars_by_district.values() for mk in lst]

    # =================================================================
    # ACCESS CONTROL, SECURITY & RBAC
    # =================================================================
    # Opening a record, amending one and destroying one are three separate
    # authorities. Collapsing them into a single "edit" code is what let a
    # front-desk clerk delete a citizen outright, so each module carries its
    # own create / edit / delete, and the views check them separately.
    ACTION_WORDS = {"view": "View", "create": "Create", "edit": "Amend", "delete": "Delete"}
    MODULE_SUBJECTS = {
        "geography": "governorates, districts, offices, courts and mukhtars",
        "access_control": "users, roles and permissions",
        "workflow": "workflow states, transitions and transition permissions",
        "citizens": "citizens, family records, guardianship, transfers and amendments",
        "documents": "documents and document types",
        "certificates": "all certificate subtypes",
        "requests": "service requests, assignments, SLA, payments and notifications",
    }
    permission_defs = []
    for module, subject in MODULE_SUBJECTS.items():
        for action, word in ACTION_WORDS.items():
            permission_defs.append((f"{module}.{action}", f"{word} {subject}", module))
    permission_defs += [
        ("documents.validate", "Record and amend document validations", "documents"),
        ("security.view", "View session logs, login attempts and the token denylist", "security"),
        ("audit.view", "View audit logs, the citizen audit log and the record access log", "audit"),
    ]
    perms = {}
    for code, desc, module in permission_defs:
        p = m.Permission(code=code, description=desc, module=module)
        db.session.add(p)
        perms[code] = p
    db.session.flush()

    ALL_PERMISSIONS = list(perms.keys())

    def grants(*specs):
        """"citizens:view,create" -> ["citizens.view", "citizens.create"]"""
        out = []
        for spec in specs:
            module, actions = spec.split(":")
            for action in actions.split(","):
                code = f"{module}.{action}"
                assert code in perms, f"unknown permission {code}"
                out.append(code)
        return out

    # Fourteen roles: the original four, whose names USER_MANUAL.md pins and
    # whose permissions are now sharpened, plus ten positions that a registry
    # office actually staffs. Each set is distinct — no two roles see and do
    # the same things.
    ROLE_SPECS = [
        ("Administrator", "Full system access", True, ALL_PERMISSIONS),

        ("Office Supervisor", "Reviews, validates and approves the office's work", False, grants(
            "geography:view", "workflow:view", "audit:view",
            "citizens:view,create,edit",
            "documents:view,create,edit,validate",
            "certificates:view,create,edit",
            "requests:view,create,edit,delete")),

        ("Registry Clerk", "General civil registry work at an office", False, grants(
            "geography:view",
            "citizens:view,create,edit",
            "documents:view,create",
            "certificates:view,create",
            "requests:view,create,edit")),

        ("Auditor", "Read-only oversight across every module", False, grants(
            "geography:view", "access_control:view", "security:view", "workflow:view",
            "citizens:view", "documents:view", "certificates:view", "requests:view",
            "audit:view")),

        # ---- the ten positions ----
        ("Counter Clerk", "Front desk: takes applications in, amends nothing", False, grants(
            "geography:view", "citizens:view,create",
            "documents:view", "certificates:view",
            "requests:view,create")),

        ("Vital Records Officer", "Births, marriages, divorces and deaths", False, grants(
            "geography:view",
            "citizens:view,create,edit",
            "documents:view,create,edit",
            "certificates:view,create,edit",
            "requests:view,create,edit")),

        ("Travel Documents Officer", "National ID cards and passports", False, grants(
            "geography:view", "citizens:view",
            "documents:view,create,edit",
            "certificates:view,create,edit",
            "requests:view,create,edit")),

        ("Archives Officer", "Custody of the document archive, physical and digital", False, grants(
            "geography:view", "citizens:view", "audit:view",
            "documents:view,create,edit,delete",
            "certificates:view", "requests:view")),

        ("Legal Affairs Officer", "Court-ordered amendments, naturalisation and name changes", False, grants(
            "geography:view", "audit:view",
            "citizens:view,edit",
            "documents:view",
            "certificates:view,create,edit",
            "requests:view,edit")),

        ("Document Validation Officer", "Checks documents against the register before issue", False, grants(
            "geography:view", "citizens:view", "audit:view",
            "documents:view,validate",
            "certificates:view", "requests:view")),

        ("Workflow Administrator", "Owns the request lifecycle and its transitions", False, grants(
            "geography:view",
            "workflow:view,create,edit,delete",
            "documents:view",
            "requests:view,edit")),

        ("Information Security Officer", "Sessions, sign-ins and the audit trail — no citizen data", False, grants(
            "geography:view", "access_control:view", "security:view", "audit:view")),

        ("Access Control Officer", "Provisions staff accounts and role grants", False, grants(
            "geography:view", "security:view", "audit:view",
            "access_control:view,create,edit")),

        ("Geography & Institutions Officer", "Maintains the administrative map and institutions", False, grants(
            "geography:view,create,edit,delete",
            "citizens:view", "requests:view")),
    ]
    roles = {}
    for name, description, is_system, codes in ROLE_SPECS:
        role = m.Role(name=name, description=description, is_system=is_system)
        db.session.add(role)
        db.session.flush()
        for code in codes:
            db.session.add(m.RolePermission(role_id=role.id, permission_id=perms[code].id))
        roles[name] = role
    db.session.flush()

    role_admin = roles["Administrator"]
    role_clerk = roles["Registry Clerk"]
    role_supervisor = roles["Office Supervisor"]
    role_auditor = roles["Auditor"]

    emp_seq = 0
    # user id -> role name, so the generator can ask what a given member of
    # staff is actually allowed to do before attributing work to them.
    user_role_name = {}
    role_codes = {name: set(codes) for name, _desc, _sys, codes in ROLE_SPECS}

    def make_user(username, password, first, last, office, dept, role, employee_number, email,
                  job_title=None, hire_date=None, supervisor=None, middle=None, is_active=True):
        u = m.User(
            username=username, first_name=first, middle_name=middle, last_name=last,
            office_id=office.id, department_id=dept.id, employee_number=employee_number,
            email=email, job_title=job_title, hire_date=hire_date,
            supervisor_id=supervisor.id if supervisor else None,
            is_active_flag=is_active,
        )
        # The middle name on a staff record is the father's name, exactly as
        # it is on a citizen record.
        u.middle_name = middle or random.choice(MALE_NAMES)[0]
        u.set_password(password)
        db.session.add(u)
        db.session.flush()
        db.session.add(m.UserRole(user_id=u.id, role_id=role.id))
        user_role_name[u.id] = role.name
        return u

    # The six documented accounts. Usernames and passwords are also listed in
    # USER_MANUAL.md — do not change them without changing the manual.
    user_admin = make_user("amro.nasser", "Adm!nSecure24", "Amro", "Nasser", office_central, dept_it, role_admin, "EMP-0001", "amro.nasser@moi.gov.lb",
                           job_title="Registry System Administrator", hire_date=date(2016, 3, 1))
    user_supervisor = make_user("nour.chami", "Super#Nour55", "Nour", "Chami", office_central, dept_docs, role_supervisor, "EMP-0004", "nour.chami@moi.gov.lb",
                                job_title="Office Supervisor", hire_date=date(2017, 9, 11), supervisor=user_admin)
    user_clerk1 = make_user("rana.khoury", "Clerk#Rana77", "Rana", "Khoury", office_central, dept_vital, role_clerk, "EMP-0002", "rana.khoury@moi.gov.lb",
                            job_title="Senior Registry Clerk", hire_date=date(2019, 2, 4), supervisor=user_supervisor)
    user_clerk2 = make_user("fadi.saab", "Clerk#Fadi88", "Fadi", "Saab", office_baabda, dept_vital, role_clerk, "EMP-0003", "fadi.saab@moi.gov.lb",
                            job_title="Registry Clerk", hire_date=date(2021, 6, 14), supervisor=user_supervisor)
    user_passport_clerk = make_user("layal.fares", "Clerk#Layal21", "Layal", "Fares", office_passport, dept_travel, role_clerk, "EMP-0005", "layal.fares@moi.gov.lb",
                                    job_title="Travel Documents Clerk", hire_date=date(2020, 11, 2), supervisor=user_supervisor)
    user_auditor = make_user("sara.yazbek", "Audit#Sara33", "Sara", "Yazbek", office_central, dept_registry, role_auditor, "EMP-0006", "sara.yazbek@moi.gov.lb",
                             job_title="Internal Auditor", hire_date=date(2018, 5, 21), supervisor=user_admin)
    emp_seq = 6
    db.session.commit()

    # Staff for the regional offices. Without them, every review, approval and
    # assignment in the system traces back to one supervisor, and the "who did
    # this" columns are decoration.
    STAFF_PASSWORD = "Moi#Demo2026"
    generated_staff = []
    supervisors_by_office = {office_central.id: [user_supervisor],
                             office_baabda.id: [user_supervisor],
                             office_passport.id: [user_supervisor]}
    clerks_by_office = {office_central.id: [user_clerk1],
                        office_baabda.id: [user_clerk2],
                        office_passport.id: [user_passport_clerk]}
    # The ten named position-holders below are created after the regional
    # staff, so their usernames are reserved up front to keep the generator
    # from taking one of them.
    POSITION_STAFF = [
        # role name, first, last, username, password, office, department
        ("Counter Clerk", "Rabih", "Chalhoub", "rabih.chalhoub", "Counter#Rabih31"),
        ("Vital Records Officer", "Joelle", "Sfeir", "joelle.sfeir", "Vital#Joelle42"),
        ("Travel Documents Officer", "Karim", "Doumit", "karim.doumit", "Travel#Karim53"),
        ("Archives Officer", "Nisrine", "Zgheib", "nisrine.zgheib", "Archive#Nisrine64"),
        ("Legal Affairs Officer", "Walid", "Moukalled", "walid.moukalled", "Legal#Walid75"),
        ("Document Validation Officer", "Hala", "Bejjani", "hala.bejjani", "Valid#Hala86"),
        ("Workflow Administrator", "Elias", "Kfoury", "elias.kfoury", "Flow#Elias97"),
        ("Information Security Officer", "Maya", "Traboulsi", "maya.traboulsi", "Sec#Maya18"),
        ("Access Control Officer", "Bassam", "Naaman", "bassam.naaman", "Access#Bassam29"),
        ("Geography & Institutions Officer", "Randa", "Achkar", "randa.achkar", "Geo#Randa40"),
    ]
    taken_usernames = {"amro.nasser", "rana.khoury", "fadi.saab", "nour.chami", "layal.fares", "sara.yazbek"}
    taken_usernames |= {row[3] for row in POSITION_STAFF}

    def staff_name():
        """A name not already used by another staff member."""
        while True:
            female = random.random() < 0.55
            f_en, f_ar = random.choice(FEMALE_NAMES if female else MALE_NAMES)
            l_en, l_ar = random.choice(FAMILY_NAMES)
            username = f"{f_en.lower()}.{l_en.lower().replace(' ', '')}"
            if username not in taken_usernames:
                taken_usernames.add(username)
                return f_en, l_en, username

    for office in regional_offices:
        # Each regional office is run by a supervisor with one to three clerks
        # under them — the shape of an actual district registry office.
        emp_seq += 1
        f_en, l_en, username = staff_name()
        hired = date(random.randint(2013, 2022), random.randint(1, 12), random.randint(1, 28))
        sup = make_user(username, STAFF_PASSWORD, f_en, l_en, office, dept_registry, role_supervisor,
                        f"EMP-{emp_seq:04d}", f"{username}@moi.gov.lb",
                        job_title="Office Supervisor", hire_date=hired, supervisor=user_admin)
        generated_staff.append(sup)
        supervisors_by_office[office.id] = [sup]
        clerks_by_office[office.id] = []

        # Staff hold a position, and the position is the role. A job title
        # that does not decide what its holder may do is decoration, which is
        # what the old "Archives Clerk with identical access to everyone
        # else" amounted to.
        OFFICE_POSITIONS = [
            ("Registry Clerk", dept_vital, 30),
            ("Counter Clerk", dept_registry, 22),
            ("Vital Records Officer", dept_vital, 18),
            ("Archives Officer", dept_archives, 12),
            ("Travel Documents Officer", dept_travel, 8),
            ("Legal Affairs Officer", dept_legal, 6),
            ("Document Validation Officer", dept_docs, 4),
        ]
        for _ in range(random.choices([1, 2, 3], weights=[38, 42, 20])[0]):
            emp_seq += 1
            f_en, l_en, username = staff_name()
            hired = date(random.randint(2015, 2025), random.randint(1, 12), random.randint(1, 28))
            position, dept, _w = random.choices(
                OFFICE_POSITIONS, weights=[w for *_, w in OFFICE_POSITIONS])[0]
            # A couple of former staff, left inactive — a registry that has
            # never had anyone leave is not a registry that has been running.
            still_here = random.random() < 0.94
            clerk = make_user(username, STAFF_PASSWORD, f_en, l_en, office,
                              dept, roles[position],
                              f"EMP-{emp_seq:04d}", f"{username}@moi.gov.lb",
                              job_title=position,
                              hire_date=hired, supervisor=sup, is_active=still_here)
            generated_staff.append(clerk)
            if still_here:
                clerks_by_office[office.id].append(clerk)

    # A second auditor and a second administrator, so those roles are not
    # single-holder either.
    emp_seq += 1
    f_en, l_en, username = staff_name()
    generated_staff.append(make_user(username, STAFF_PASSWORD, f_en, l_en, office_central, dept_registry,
                                     role_auditor, f"EMP-{emp_seq:04d}", f"{username}@moi.gov.lb",
                                     job_title="Compliance Auditor", hire_date=date(2022, 1, 17),
                                     supervisor=user_admin))
    emp_seq += 1
    f_en, l_en, username = staff_name()
    generated_staff.append(make_user(username, STAFF_PASSWORD, f_en, l_en, office_central, dept_it,
                                     role_admin, f"EMP-{emp_seq:04d}", f"{username}@moi.gov.lb",
                                     job_title="Deputy System Administrator", hire_date=date(2020, 8, 3),
                                     supervisor=user_admin))

    # ---- The ten named position-holders ------------------------------------
    #
    # One person per position, at a named office, with their own login, so
    # each role can be signed into and seen for what it actually permits.
    POSITION_PLACEMENT = {
        "Counter Clerk": (office_central, dept_registry),
        "Vital Records Officer": (office_central, dept_vital),
        "Travel Documents Officer": (office_passport, dept_travel),
        "Archives Officer": (office_central, dept_archives),
        "Legal Affairs Officer": (office_central, dept_legal),
        "Document Validation Officer": (office_central, dept_docs),
        "Workflow Administrator": (office_central, dept_it),
        "Information Security Officer": (office_central, dept_it),
        "Access Control Officer": (office_central, dept_it),
        "Geography & Institutions Officer": (office_baabda, dept_registry),
    }
    position_staff = []
    for position, first, last, username, password in POSITION_STAFF:
        emp_seq += 1
        office, dept = POSITION_PLACEMENT[position]
        u = make_user(username, password, first, last, office, dept, roles[position],
                      f"EMP-{emp_seq:04d}", f"{username}@moi.gov.lb",
                      job_title=position,
                      hire_date=date(random.randint(2017, 2024), random.randint(1, 12), random.randint(1, 28)),
                      supervisor=user_admin if office is office_central else user_supervisor)
        position_staff.append(u)
        # They work at their office like anyone else, so the operational
        # pools below can draw on them.
        clerks_by_office.setdefault(office.id, []).append(u)
    db.session.flush()

    # Grants are made by somebody. The administrator is who signed off the
    # role and permission assignments in this dataset.
    for rp in m.RolePermission.query.all():
        rp.granted_by = user_admin.id
    for ur in m.UserRole.query.all():
        ur.granted_by = user_admin.id
    # A clerk who moved role: the old grant is revoked rather than deleted.
    moved = random.choice([u for u in generated_staff if u.job_title != "Office Supervisor"])
    old_grant = m.UserRole.query.filter_by(user_id=moved.id).first()
    if old_grant:
        old_grant.revoked_at = NOW - timedelta(days=random.randint(30, 400))
        db.session.add(m.UserRole(user_id=moved.id, role_id=role_supervisor.id,
                                  granted_by=user_admin.id,
                                  granted_at=old_grant.revoked_at))
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

    # label_ar is not optional in a bilingual interface: without it the Arabic
    # side of the workflow screen falls back to English.
    wt_start_review = m.WorkflowTransition(from_state_id=ws_submitted.id, to_state_id=ws_in_review.id, action_code="START_REVIEW", label_en="Start Review", label_ar="بدء المراجعة")
    wt_approve = m.WorkflowTransition(from_state_id=ws_in_review.id, to_state_id=ws_approved.id, action_code="APPROVE", label_en="Approve", label_ar="موافقة", requires_comment=False)
    wt_reject = m.WorkflowTransition(from_state_id=ws_in_review.id, to_state_id=ws_rejected.id, action_code="REJECT", label_en="Reject", label_ar="رفض", requires_comment=True)
    wt_issue = m.WorkflowTransition(from_state_id=ws_approved.id, to_state_id=ws_issued.id, action_code="ISSUE", label_en="Issue Document", label_ar="إصدار الوثيقة", requires_document=True)
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
    # The configuration columns are the point of this table: which subtype
    # table holds the detail, what a clerk must collect before the request can
    # be accepted, what it costs and how long it may take. Left empty, the
    # table is a list of names and the fee has to be hard-coded somewhere else.
    DOCUMENT_TYPE_SPECS = [
        ("BIRTH_CERT", "شهادة ميلاد", "Birth Certificate", "CIVIL_STATUS", "birth_certificates",
         None, 5, 10, ["birth_place", "birth_hospital", "father_full_name", "mother_full_name"],
         {"max_days_after_birth": 30, "requires_mukhtar_attestation": True}),
        ("MARRIAGE_CERT", "عقد زواج", "Marriage Certificate", "CIVIL_STATUS", "marriage_certificates",
         None, 7, 35, ["husband_id", "wife_id", "marriage_date", "contract_number"],
         {"requires_religious_authority": True, "both_parties_must_be_registered": True}),
        ("DIVORCE_CERT", "وثيقة طلاق", "Divorce Certificate", "CIVIL_STATUS", "divorce_certificates",
         None, 10, 15, ["marriage_certificate_id", "court_decision_number", "divorce_date"],
         {"requires_court_decision": True}),
        ("DEATH_CERT", "شهادة وفاة", "Death Certificate", "CIVIL_STATUS", "death_certificates",
         None, 3, 10, ["death_date", "death_place", "certifying_physician"],
         {"max_days_after_death": 7, "requires_physician_certificate": True}),
        ("NATIONAL_ID", "بطاقة هوية", "National ID Card", "IDENTITY", "national_id_cards",
         3650, 14, 25, ["biometric_photo", "fingerprints", "proof_of_registry"],
         {"minimum_age_years": 15, "requires_biometrics": True}),
        ("PASSPORT", "جواز سفر", "Passport", "IDENTITY", "passports",
         1825, 14, 75, ["national_id_card", "biometric_photo", "proof_of_registry"],
         {"requires_valid_id_card": True, "issued_by_office_code": "OFC-PSP"}),
        ("NATURALIZATION", "مرسوم تجنس", "Naturalization Decree", "JUDICIAL", "naturalization_records",
         None, 30, 0, ["decree_number", "decree_date", "previous_nationality"],
         {"requires_decree": True, "central_office_only": True}),
        ("NAME_CHANGE", "تصحيح اسم", "Name Change Record", "CIVIL_STATUS", "name_change_records",
         None, 21, 30, ["court_decision_number", "reason"],
         {"requires_court_decision": True, "creates_amendment": True}),
    ]
    document_types = {}
    for (code, n_ar, n_en, category, subtype, validity, sla, fee,
         required, rules) in DOCUMENT_TYPE_SPECS:
        dt = m.DocumentType(
            code=code, name_ar=n_ar, name_en=n_en, category=category,
            subtype_table=subtype, validity_duration_days=validity,
            default_sla_days=sla, default_fee_amount=fee, default_fee_currency="USD",
            required_fields=required, validation_rules=rules, is_active=True)
        db.session.add(dt)
        document_types[code] = dt
    db.session.flush()

    dt_birth = document_types["BIRTH_CERT"]
    dt_marriage = document_types["MARRIAGE_CERT"]
    dt_divorce = document_types["DIVORCE_CERT"]
    dt_death = document_types["DEATH_CERT"]
    dt_id = document_types["NATIONAL_ID"]
    dt_passport = document_types["PASSPORT"]
    dt_naturalization = document_types["NATURALIZATION"]
    dt_name_change = document_types["NAME_CHANGE"]

    # Who may issue what. Marriage and divorce answer to the confessional
    # courts and authorities, which is why there is a row per sect rather
    # than one row per document type.
    authority_rows = [
        m.DocumentTypeAuthority(document_type_id=dt_id.id, authority_kind="OFFICE", office_id=office_central.id),
        m.DocumentTypeAuthority(document_type_id=dt_passport.id, authority_kind="OFFICE", office_id=office_passport.id),
        m.DocumentTypeAuthority(document_type_id=dt_birth.id, authority_kind="OFFICE", office_id=office_central.id),
        m.DocumentTypeAuthority(document_type_id=dt_birth.id, authority_kind="OFFICE", office_id=office_baabda.id),
        m.DocumentTypeAuthority(document_type_id=dt_naturalization.id, authority_kind="OFFICE", office_id=office_central.id),
    ]
    for ctype in ("SHARIA", "JAAFARI", "DRUZE", "ECCLESIASTICAL"):
        for c in courts_by_type[ctype]:
            authority_rows.append(m.DocumentTypeAuthority(
                document_type_id=dt_marriage.id, authority_kind="COURT", court_id=c.id))
            authority_rows.append(m.DocumentTypeAuthority(
                document_type_id=dt_divorce.id, authority_kind="COURT", court_id=c.id))
    for ra in authorities_by_sect.values():
        authority_rows.append(m.DocumentTypeAuthority(
            document_type_id=dt_marriage.id, authority_kind="RELIGIOUS_AUTHORITY", religious_authority_id=ra.id))
    db.session.add_all(authority_rows)
    db.session.commit()

    # =================================================================
    # CITIZENS — two extended families across three generations
    # =================================================================
    district_code_by_id = {d.id: dcode for dcode, d in districts.items()}
    all_offices = [office_central, office_baabda, office_passport] + regional_offices
    office_district_code = {o.id: district_code_by_id[o.district_id] for o in all_offices}

    # Where people are actually born: mostly the seat town of the qada they
    # are registered in, but a real share in the cities with the hospitals.
    HOSPITAL_CITIES = ["Beirut", "Tripoli", "Saida", "Zahle", "Jounieh"]
    sijill_seq = {}

    def sijill_for(office):
        """Registry book and entry number — the paper record this row stands
        in for. Books run to 200 entries before a new one is opened."""
        n = sijill_seq.get(office.id, 0) + 1
        sijill_seq[office.id] = n
        return f"{office.code}/{(n // 200) + 1:02d}/{(n % 200) + 1:04d}"

    def birthplace_for(office):
        dcode = office_district_code[office.id]
        seat = district_seat[dcode][0]
        if random.random() < 0.22:
            return random.choice(HOSPITAL_CITIES)
        return seat

    def citizen(crn, fen, len_, far, lar, gender, dob, office, father=None, mother=None,
                marital="SINGLE", deceased=False, nationality="citizen", religion=None, sect=None,
                creator=None, middle_en=None, middle_ar=None, place_of_birth=None):
        c = m.Citizen(
            civil_registry_number=crn, first_name_en=fen, last_name_en=len_,
            first_name_ar=far, last_name_ar=lar,
            middle_name_en=middle_en, middle_name_ar=middle_ar,
            gender=gender, date_of_birth=dob,
            place_of_birth=place_of_birth or birthplace_for(office),
            sijill_reference=sijill_for(office),
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
    # Documents are scanned into the archive, so every row carries both where
    # the paper sits and where the scan sits. ATTESTED_TYPES are the ones a
    # mukhtar signs before they reach the registry counter.
    ATTESTED_TYPES = {"BIRTH_CERT", "DEATH_CERT", "MARRIAGE_CERT"}
    ARCHIVE_ROOMS = ["A", "B", "C", "D"]

    def new_document(dtype, crn, number, issue, office, status="ISSUED",
                      created=user_clerk1, expiry=None, attested=True):
        # A scan exists for most of the archive; the older paper-only records
        # are exactly the gap a digitisation programme is meant to close.
        digitised = issue.year >= 2008 or random.random() < 0.35
        mukhtar = None
        if attested and dtype.code in ATTESTED_TYPES and random.random() < 0.55:
            dcode = office_district_code.get(office.id)
            pool = mukhtars_by_district.get(dcode) or all_mukhtars
            # SDD §6.5.7 rule 7: the attestation must fall inside the
            # mukhtar's term of office. Choosing any mukhtar in the district
            # produced 200 of 221 attestations signed by someone who did not
            # hold office on the day — a document dated 1998 attested by a
            # mukhtar whose term began in 2022.
            in_term = [mk for mk in pool
                       if mk.term_start <= issue and (mk.term_end is None or issue <= mk.term_end)]
            mukhtar = random.choice(in_term) if in_term else None
        mime = random.choices(["application/pdf", "image/tiff", "image/jpeg"],
                              weights=[86, 9, 5])[0] if digitised else None
        ext = {"application/pdf": "pdf", "image/tiff": "tif", "image/jpeg": "jpg"}.get(mime)
        doc = m.Document(
            document_type_id=dtype.id, civil_registry_number=crn, document_number=number,
            issue_date=issue, expiry_date=expiry, issuing_office_id=office.id,
            attested_by_mukhtar_id=mukhtar.id if mukhtar else None,
            physical_file_location=(
                f"{office.code} Archive / Room {random.choice(ARCHIVE_ROOMS)} / "
                f"Shelf {random.randint(1, 40):02d} / Box {random.randint(1, 99):02d}"
            ),
            digital_file_path=(f"/archive/{issue.year}/{dtype.code}/{number}.{ext}" if digitised else None),
            file_hash=(hashlib.sha256(number.encode()).hexdigest() if digitised else None),
            file_size=(random.randint(84_000, 2_400_000) if digitised else None),
            mime_type=mime,
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
    # A correspondence tracking system whose subject line is blank is a
    # correspondence tracking system you cannot search. One per document type,
    # in the words a counter clerk would actually write.
    INCOMING_SUBJECTS = {
        "BIRTH_CERT": ["Certified copy of birth certificate", "Birth registration — late entry",
                       "Birth certificate for school enrolment"],
        "MARRIAGE_CERT": ["Registration of marriage contract", "Certified copy of marriage certificate"],
        "DIVORCE_CERT": ["Registration of divorce judgment", "Certified copy of divorce record"],
        "DEATH_CERT": ["Registration of death", "Certified copy of death certificate"],
        "NATIONAL_ID": ["First-time national ID card", "National ID card renewal",
                        "Replacement of lost national ID card"],
        "PASSPORT": ["First-time passport application", "Passport renewal",
                     "Replacement of lost passport"],
        "NATURALIZATION": ["Registration of naturalisation decree"],
        "NAME_CHANGE": ["Correction of name spelling in the registry",
                        "Court-ordered name change", "Surname update following marriage"],
    }
    OUTGOING_SUBJECTS = [
        "Transmittal of certified record to {court}",
        "Registry extract requested by another office",
        "Verification of civil status for a public authority",
        "Return of an incomplete file to the originating office",
    ]

    def subject_for(dtype, citizen, direction):
        name = f"{citizen.first_name_en} {citizen.last_name_en}"
        if direction == "OUTGOING":
            base = random.choice(OUTGOING_SUBJECTS).replace(
                "{court}", random.choice(courts_by_type["CIVIL"]).name_en)
            return f"{base} — {name} ({citizen.civil_registry_number})"[:255]
        base = random.choice(INCOMING_SUBJECTS.get(dtype.code, [dtype.name_en]))
        return f"{base} — {name} ({citizen.civil_registry_number})"[:255]

    def new_request(number, citizen, dtype, office, dept, state, requested_by,
                     submitted, due, priority="NORMAL", fee=0, currency="USD",
                     direction=None, subject=None, **extra):
        direction = direction or ("OUTGOING" if random.random() < 0.11 else "INCOMING")
        r = m.ServiceRequest(
            request_number=number, direction=direction, citizen_id=citizen.civil_registry_number,
            document_type_id=dtype.id, office_id=office.id, department_id=dept.id,
            workflow_state_id=state.id, priority=priority, requested_by_user_id=requested_by.id,
            subject=subject or subject_for(dtype, citizen, direction),
            submitted_at=submitted, due_date=due, fee_amount=fee, fee_currency=currency, **extra,
        )
        db.session.add(r)
        db.session.flush()
        return r

    req1 = new_request("REQ-2024-0001", father, dt_id, office_central, dept_registry, ws_issued, user_clerk1,
                        datetime(2024, 1, 10, 9, 0), date(2024, 1, 24), fee=25.00,
                        reviewed_by=user_supervisor.id, reviewed_at=datetime(2024, 1, 10, 14, 0), approved_by=user_supervisor.id, approved_at=datetime(2024, 1, 10, 14, 5),
                        issued_document_id=None, notes="Renewal of expiring ID card.")
    # Open examples are anchored to today: a request frozen in 2024 would sit
    # in the dashboard as 800 days overdue and make the SLA panel meaningless.
    req2_submitted = NOW - timedelta(days=12, hours=3)
    req2 = new_request("REQ-2024-0002", child2, dt_passport, office_passport, dept_docs, ws_in_review, user_passport_clerk,
                        req2_submitted, (req2_submitted + timedelta(days=14)).date(), fee=75.00, notes="First-time passport application.")
    req3 = new_request("REQ-2024-0003", wife2, dt_divorce, office_central, dept_registry, ws_rejected, user_clerk1,
                        datetime(2024, 2, 20, 11, 0), date(2024, 3, 1), fee=15.00,
                        reviewed_by=user_supervisor.id, reviewed_at=datetime(2024, 2, 21, 9, 0),
                        rejected_by=user_supervisor.id, rejected_at=datetime(2024, 2, 21, 9, 0),
                        rejection_reason="Missing court decision attachment.")
    req4_submitted = NOW - timedelta(days=21, hours=6)
    req4 = new_request("REQ-2024-0004", naturalized, dt_name_change, office_central, dept_registry, ws_submitted, user_clerk1,
                        req4_submitted, (req4_submitted + timedelta(days=14)).date(), fee=30.00, notes="Follow-up name correction after marriage.")
    req5 = new_request("REQ-2024-0005", kid2, dt_birth, office_central, dept_registry, ws_issued, user_clerk2,
                        datetime(2024, 3, 15, 13, 0), date(2024, 3, 20), fee=10.00,
                        reviewed_by=user_supervisor.id, reviewed_at=datetime(2024, 3, 15, 16, 0), approved_by=user_supervisor.id, approved_at=datetime(2024, 3, 15, 16, 10),
                        issued_document_id=bc3.id, notes="Certified copy for school enrollment.")
    db.session.commit()

    db.session.add_all([
        m.RequestAssignment(service_request_id=req2.id, assigned_to=user_passport_clerk.id, assigned_by=user_supervisor.id, assigned_at=req2_submitted + timedelta(hours=1), is_active=True),
        m.RequestAssignment(service_request_id=req4.id, assigned_to=user_clerk1.id, assigned_by=user_supervisor.id, assigned_at=req4_submitted + timedelta(hours=1), is_active=True),
    ])
    db.session.add_all([
        m.ServiceRequestStatusHistory(service_request_id=req1.id, from_state_id=ws_submitted.id, to_state_id=ws_in_review.id, transition_id=wt_start_review.id, changed_by=user_supervisor.id, changed_at=datetime(2024, 1, 10, 13, 0)),
        m.ServiceRequestStatusHistory(service_request_id=req1.id, from_state_id=ws_in_review.id, to_state_id=ws_approved.id, transition_id=wt_approve.id, changed_by=user_supervisor.id, changed_at=datetime(2024, 1, 10, 14, 5)),
        m.ServiceRequestStatusHistory(service_request_id=req1.id, from_state_id=ws_approved.id, to_state_id=ws_issued.id, transition_id=wt_issue.id, changed_by=user_clerk1.id, changed_at=datetime(2024, 1, 11, 9, 0)),
        m.ServiceRequestStatusHistory(service_request_id=req3.id, from_state_id=ws_in_review.id, to_state_id=ws_rejected.id, transition_id=wt_reject.id, changed_by=user_supervisor.id, changed_at=datetime(2024, 2, 21, 9, 0), comment="Missing court decision attachment."),
    ])
    db.session.add_all([
        m.SlaRecord(service_request_id=req1.id, due_date=date(2024, 1, 24), sla_status="MET", days_remaining=0, last_checked_at=datetime(2024, 1, 11, 9, 0)),
        m.SlaRecord(service_request_id=req2.id, due_date=req2.due_date, sla_status="DUE_SOON",
                    days_remaining=(req2.due_date - TODAY).days, last_checked_at=NOW),
        m.SlaRecord(service_request_id=req4.id, due_date=req4.due_date, sla_status="OVERDUE",
                    days_remaining=(req4.due_date - TODAY).days,
                    overdue_by_days=(TODAY - req4.due_date).days, last_checked_at=NOW),
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

    # =================================================================
    # BULK POPULATION
    #
    # Everything above this point is hand-written: the reference tables, the
    # staff accounts, and two extended families whose relationships are
    # deliberate examples. Everything below is generated around them so that
    # lists paginate, filters have something to filter, search has misses as
    # well as hits, and the dashboard's SLA and workflow panels show live
    # numbers instead of a frozen 2024 snapshot.
    #
    # Two properties matter more than volume:
    #
    #   Deterministic. random.seed() is fixed, so re-running produces the
    #   same database. A demo that looks different every time is impossible
    #   to write documentation or a report against.
    #
    #   Anchored to today. Requests are laid down relative to date.today(),
    #   not to hard-coded 2024 dates, so "Due Soon" and "Overdue" are real
    #   the day anyone runs this. The trade is that screenshots taken months
    #   apart will differ — that is the right trade for a live dashboard.
    # =================================================================
    print("Generating bulk demo population...")
    # Confession is not distributed evenly across Lebanon, and a registry that
    # pretends it is looks generated. Each governorate draws from its own
    # weighting, so Bcharre is not statistically identical to Nabatieh.
    MARONITE = ("Christianity", "Maronite")
    ORTHODOX = ("Christianity", "Orthodox")
    CATHOLIC = ("Christianity", "Catholic")
    SUNNI = ("Islam", "Sunni")
    SHIA = ("Islam", "Shia")
    DRUZE = ("Islam", "Druze")

    def mix(**parts):
        pool = []
        for key, weight in parts.items():
            pool += [{"maronite": MARONITE, "orthodox": ORTHODOX, "catholic": CATHOLIC,
                      "sunni": SUNNI, "shia": SHIA, "druze": DRUZE}[key]] * weight
        return pool

    CONFESSIONS_BY_GOV = {
        "BRT": mix(sunni=34, shia=18, orthodox=14, maronite=16, catholic=8, druze=10),
        "MLB": mix(maronite=34, shia=16, druze=18, orthodox=12, sunni=13, catholic=7),
        "KSJ": mix(maronite=78, catholic=8, orthodox=8, shia=3, sunni=3),
        "NRT": mix(sunni=42, maronite=22, orthodox=26, catholic=8, shia=2),
        "AKR": mix(sunni=62, orthodox=20, maronite=12, shia=6),
        "BQA": mix(catholic=26, sunni=28, shia=26, maronite=12, orthodox=8),
        "BHM": mix(shia=72, sunni=14, catholic=8, maronite=6),
        "STH": mix(sunni=38, shia=40, maronite=12, catholic=6, orthodox=4),
        "NBT": mix(shia=76, sunni=10, druze=6, maronite=5, orthodox=3),
    }
    # Kept as a national fallback for the hand-written examples above.
    CONFESSIONS = mix(maronite=26, orthodox=10, catholic=7, sunni=25, shia=25, druze=7)

    def confession_for(office):
        gov_code = office_district_code[office.id].split("-")[0]
        return random.choice(CONFESSIONS_BY_GOV.get(gov_code, CONFESSIONS))

    BIRTH_PLACES = sorted({seat for seat, _ in district_seat.values()} | set(HOSPITAL_CITIES))
    HOSPITALS = ["Hotel Dieu de France", "American University Hospital", "Mount Lebanon Hospital",
                 "Saint George Hospital", "Rafik Hariri University Hospital", "Bellevue Medical Center",
                 "Nini Hospital — Tripoli", "Hammoud Hospital — Saida", "Notre Dame de Secours — Jbeil",
                 "Bekaa Hospital — Zahle", "Najdeh Hospital — Nabatieh"]

    # Every office that registers citizens (the passport directorate issues
    # travel documents but does not hold civil registers).
    offices = all_offices
    registry_offices = [o for o in all_offices if o is not office_passport]
    clerks = [c for lst in clerks_by_office.values() for c in lst]
    supervisors = sorted({s for lst in supervisors_by_office.values() for s in lst}, key=lambda u: u.id)
    all_staff = sorted(set(clerks + supervisors + position_staff + [user_admin, user_auditor]),
                       key=lambda u: u.id)

    # The seeded history has to obey the same permission model the running
    # application enforces. Attributing a citizen record to the Information
    # Security Officer — who holds no citizens permission at all — would
    # produce a database the system itself would never have allowed, and the
    # audit screens would be quietly lying.
    def holds(u, code):
        return code in role_codes.get(user_role_name.get(u.id), set())

    def staff_at(office, code):
        """Someone at this office who is permitted to do `code`, falling back
        to anyone in the service who is."""
        pool = [u for u in clerks_by_office.get(office.id, []) if holds(u, code)]
        if not pool:
            pool = [u for u in all_staff if holds(u, code)]
        return random.choice(pool)

    def clerk_at(office):
        """Registers and amends citizen records."""
        return staff_at(office, "citizens.create")

    def doc_clerk_at(office):
        """Issues documents and handles the physical file."""
        return staff_at(office, "documents.create")

    def request_clerk_at(office):
        """Takes service requests in at the counter and collects the fee."""
        return staff_at(office, "requests.create")

    def validator_at(office):
        """Holds documents.validate — supervisors and validation officers."""
        return staff_at(office, "documents.validate")

    def supervisor_at(office):
        return random.choice(supervisors_by_office.get(office.id) or supervisors)

    # Staff sign in from their own office's subnet, which is what makes an
    # access log worth reading when something looks off.
    BROWSERS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/127.0",
        "Mozilla/5.0 (Windows NT 6.1; Win64; x64) Chrome/109.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) Chrome/125.0 Safari/537.36",
    ]
    office_subnet = {o.id: 10 + i for i, o in enumerate(all_offices)}

    def staff_ip(u):
        return f"10.{office_subnet.get(u.office_id, 10)}.14.{random.randint(10, 60)}"

    def rdate(start_year, end_year):
        start = date(start_year, 1, 1)
        end = date(end_year, 12, 31)
        return start + timedelta(days=random.randint(0, (end - start).days))

    # ---- Citizens, grouped into households --------------------------------
    crn_seq = 400000
    fb_seq = 500002
    bulk_citizens = []
    bulk_adults = []
    married_couples = []
    families = []

    # Households are spread across every registry office, weighted roughly by
    # where Lebanon's population actually is — but with a floor of two per
    # office, so no district office opens to an empty citizens list.
    GOV_HOUSEHOLD_WEIGHT = {"BRT": 12, "MLB": 28, "KSJ": 10, "NRT": 18,
                            "AKR": 8, "BQA": 10, "BHM": 7, "STH": 12, "NBT": 9}
    offices_per_gov = {}
    for o in registry_offices:
        offices_per_gov.setdefault(office_district_code[o.id].split("-")[0], []).append(o)
    office_weights = [GOV_HOUSEHOLD_WEIGHT[office_district_code[o.id].split("-")[0]]
                      / len(offices_per_gov[office_district_code[o.id].split("-")[0]])
                      for o in registry_offices]

    HOUSEHOLDS = 140
    home_plan = list(registry_offices) * 2
    home_plan += random.choices(registry_offices, weights=office_weights,
                                k=max(0, HOUSEHOLDS - len(home_plan)))
    random.shuffle(home_plan)

    for home in home_plan:
        fb_seq += 1
        sur_en, sur_ar = random.choice(FAMILY_NAMES)
        religion, sect = confession_for(home)

        crn_seq += 1
        h_en, h_ar = random.choice(MALE_NAMES)
        # The middle name in a Lebanese record is the father's first name.
        h_mid_en, h_mid_ar = random.choice(MALE_NAMES)
        head_born = rdate(1950, 1992)
        # A small share of the oldest heads are deceased, so death
        # certificates and the "Deceased" filter have real rows behind them.
        head_deceased = head_born.year < 1960 and random.random() < 0.35
        head = citizen(f"CRN-{crn_seq}", h_en, sur_en, h_ar, sur_ar, "MALE", head_born,
                       home, marital="MARRIED", deceased=head_deceased,
                       religion=religion, sect=sect, creator=clerk_at(home),
                       middle_en=h_mid_en, middle_ar=h_mid_ar)
        db.session.flush()
        bulk_citizens.append(head)
        bulk_adults.append(head)

        has_spouse = random.random() < 0.88
        spouse = None
        if has_spouse:
            crn_seq += 1
            w_en, w_ar = random.choice(FEMALE_NAMES)
            w_mid_en, w_mid_ar = random.choice(MALE_NAMES)
            m_sur_en, m_sur_ar = random.choice(FAMILY_NAMES)   # maiden name
            spouse_status = random.choices(
                ["MARRIED", "DIVORCED", "WIDOWED"],
                weights=[86, 9, 5] if not head_deceased else [0, 10, 90])[0]
            spouse = citizen(f"CRN-{crn_seq}", w_en, m_sur_en, w_ar, m_sur_ar, "FEMALE",
                             rdate(1955, 1996), home, marital=spouse_status,
                             religion=religion, sect=sect, creator=clerk_at(home),
                             middle_en=w_mid_en, middle_ar=w_mid_ar)
            db.session.flush()
            bulk_citizens.append(spouse)
            bulk_adults.append(spouse)
            if spouse_status in ("MARRIED", "DIVORCED"):
                married_couples.append((head, spouse, spouse_status))

        children = []
        # A child cannot be born before their parents, and a registry that
        # says otherwise is not a registry. The earlier version drew the
        # child's year from a fixed 1985..last-year range with no reference
        # to the parents at all, which produced 29 children born before a
        # parent and 105 parents under fifteen at the birth.
        parent_years = [head_born.year] + ([spouse.date_of_birth.year] if spouse else [])
        earliest_birth_year = max([1985] + [y + 18 for y in parent_years])
        for _ in range(random.choices([0, 1, 2, 3, 4], weights=[12, 22, 30, 24, 12])[0]):
            if earliest_birth_year > TODAY.year - 1:
                break   # the couple are too young to have registered children
            crn_seq += 1
            is_boy = random.random() < 0.51
            g_en, g_ar = random.choice(MALE_NAMES if is_boy else FEMALE_NAMES)
            born = rdate(earliest_birth_year, TODAY.year - 1)
            kid = citizen(f"CRN-{crn_seq}", g_en, sur_en, g_ar, sur_ar,
                          "MALE" if is_boy else "FEMALE", born, home,
                          father=head.civil_registry_number,
                          mother=spouse.civil_registry_number if spouse else None,
                          marital="MARRIED" if (TODAY.year - born.year) > 28 and random.random() < 0.4 else "SINGLE",
                          religion=religion, sect=sect, creator=clerk_at(home),
                          middle_en=h_en, middle_ar=h_ar)
            db.session.flush()
            bulk_citizens.append(kid)
            children.append(kid)
            if (TODAY.year - born.year) >= 18:
                bulk_adults.append(kid)

        fam = m.FamilyRecord(family_book_number=f"FB-{fb_seq}",
                             head_of_household_id=head.civil_registry_number,
                             registration_office_id=home.id, created_by=clerk_at(home).id)
        db.session.add(fam)
        db.session.flush()
        families.append((fam, head, spouse, children))

        # People leave a family book as well as joining it: a spouse on
        # divorce, a member on death, a daughter onto her husband's book.
        # left_date and left_reason are how the register says so.
        head_joined = rdate(1975, 2015)
        members = [m.FamilyMember(
            family_record_id=fam.id, citizen_id=head.civil_registry_number,
            relationship_="HEAD", joined_date=head_joined,
            left_date=rdate(2016, TODAY.year) if head.is_deceased else None,
            left_reason="death" if head.is_deceased else None)]
        if spouse is not None:
            left_reason = ("divorce" if spouse.marital_status == "DIVORCED"
                           else ("death" if spouse.is_deceased else None))
            members.append(m.FamilyMember(
                family_record_id=fam.id, citizen_id=spouse.civil_registry_number,
                relationship_="SPOUSE", joined_date=rdate(1975, 2015),
                left_date=rdate(2015, TODAY.year) if left_reason else None,
                left_reason=left_reason))
        for kid in children:
            # A married daughter moves onto her husband's family book; an
            # adult son occasionally opens his own.
            moved_out = None
            if kid.marital_status == "MARRIED":
                moved_out = "marriage" if kid.gender == "FEMALE" else (
                    "own_family_book" if random.random() < 0.3 else None)
            members.append(m.FamilyMember(
                family_record_id=fam.id, citizen_id=kid.civil_registry_number,
                relationship_="SON" if kid.gender == "MALE" else "DAUGHTER",
                joined_date=kid.date_of_birth,
                left_date=rdate(2012, TODAY.year) if moved_out else None,
                left_reason=moved_out))
        db.session.add_all(members)

    db.session.commit()

    # Parents who predate the electronic registry are not rows anyone can
    # point a foreign key at — they are recorded by name, which is what the
    # two *_unregistered columns exist for.
    for cz in bulk_citizens:
        if cz.father_id is None:
            cz.father_name_unregistered = f"{cz.middle_name_en or random.choice(MALE_NAMES)[0]} {cz.last_name_en}"
        if cz.mother_id is None:
            cz.mother_name_unregistered = (f"{random.choice(FEMALE_NAMES)[0]} "
                                           f"{random.choice(FAMILY_NAMES)[0]}")
    db.session.commit()

    # ---- Documents and their subtypes -------------------------------------
    doc_seq = 0
    office_by_id = {o.id: o for o in all_offices}

    def home_office(cz):
        """The office holding this citizen's register — where their documents
        are issued and their file physically sits."""
        return office_by_id[cz.registration_office_id]

    def seat_near(office):
        return district_seat[office_district_code[office.id]][0]

    def doc_number(prefix, when):
        global_seq = doc_seq
        return f"{prefix}-{when.year}-{global_seq:05d}"

    # Birth certificates for citizens born from 1985 on — the cohort whose
    # births were registered electronically.
    for cz in bulk_citizens:
        if cz.date_of_birth.year < 1985 or random.random() > 0.72:
            continue
        doc_seq += 1
        issued = cz.date_of_birth + timedelta(days=random.randint(2, 30))
        office = home_office(cz)
        registrar = doc_clerk_at(office)
        d = new_document(dt_birth, cz.civil_registry_number, f"BC-{issued.year}-{doc_seq:05d}",
                         issued, office, created=registrar)
        # A hospital birth has a physician; a home birth has a midwife and
        # no hospital. Both happen, and the registry records which.
        at_hospital = random.random() < 0.88
        db.session.add(m.BirthCertificate(
            document_id=d.id, birth_place=cz.place_of_birth,
            birth_hospital=random.choice(HOSPITALS) if at_hospital else None,
            birth_attendant=(f"Dr. {random.choice(MALE_NAMES + FEMALE_NAMES)[0]} "
                             f"{random.choice(FAMILY_NAMES)[0]}" if at_hospital else
                             f"Midwife {random.choice(FEMALE_NAMES)[0]} {random.choice(FAMILY_NAMES)[0]}"),
            father_full_name_snapshot=f"{cz.first_name_en} {cz.last_name_en}"
                                      if not cz.father_id else None,
            registration_number=f"REG-{issued.year}-{doc_seq:05d}",
            registrar_name=f"{registrar.first_name} {registrar.last_name}",
        ))

    # National ID cards for adults.
    for cz in bulk_adults:
        if random.random() > 0.65:
            continue
        doc_seq += 1
        issued = rdate(2015, TODAY.year)
        expiry = issued.replace(year=issued.year + 10)
        num = f"IDC-{doc_seq:06d}"
        office = home_office(cz)
        d = new_document(dt_id, cz.civil_registry_number, num, issued,
                         office, expiry=expiry, created=doc_clerk_at(office))
        # Cards issued from 2018 on are biometric; the older stock is not,
        # which is exactly the kind of thing a migration plan turns on.
        biometric = issued.year >= 2018
        db.session.add(m.NationalIdCard(
            document_id=d.id, card_number=num, chip_serial_number=f"CHIP-{doc_seq:06d}",
            biometric_photo_path=(f"/biometrics/{issued.year}/{num}.jpg" if biometric else None),
            biometric_photo_hash=(hashlib.sha256(f"photo:{num}".encode()).hexdigest() if biometric else None),
            fingerprint_hash=(hashlib.sha256(f"print:{num}".encode()).hexdigest() if biometric else None),
            status=random.choices(["ACTIVE", "LOST", "DAMAGED"], weights=[94, 4, 2])[0]
                   if expiry > TODAY else "EXPIRED",
        ))

    # Passports — issued out of the passport office only.
    for cz in bulk_adults:
        if random.random() > 0.28:
            continue
        doc_seq += 1
        issued = rdate(2017, TODAY.year)
        expiry = issued.replace(year=issued.year + 5)   # Lebanese passports run five years
        num = f"P-LB-{doc_seq:07d}"
        d = new_document(dt_passport, cz.civil_registry_number, num, issued, office_passport,
                         expiry=expiry, created=user_passport_clerk)
        db.session.add(m.Passport(
            document_id=d.id, citizen_id=cz.civil_registry_number, passport_number=num,
            passport_type=random.choices(["ordinary", "diplomatic", "service"], weights=[94, 2, 4])[0],
            issue_date=issued, expiry_date=expiry, issuing_office_id=office_passport.id,
            page_count=random.choice([34, 34, 34, 64]),
            status=random.choices(["ACTIVE", "LOST", "CANCELLED"], weights=[95, 3, 2])[0]
                   if expiry > TODAY else "EXPIRED",
        ))

    # Marriage certificates, and divorce records for the dissolved ones.
    for husband, wife, status in married_couples:
        doc_seq += 1
        wed = rdate(1975, min(TODAY.year, 2024))
        office = home_office(husband)
        mcourt = court_for(husband.religion, husband.sect, office.district_id)
        mdoc = new_document(dt_marriage, husband.civil_registry_number,
                            f"MC-{wed.year}-{doc_seq:05d}", wed,
                            office, created=doc_clerk_at(office))
        cert = m.MarriageCertificate(
            document_id=mdoc.id, husband_id=husband.civil_registry_number,
            wife_id=wife.civil_registry_number,
            husband_name_snapshot=f"{husband.first_name_en} {husband.last_name_en}",
            wife_name_snapshot=f"{wife.first_name_en} {wife.last_name_en}",
            marriage_date=wed, marriage_place=seat_near(office),
            court_id=mcourt.id,
            religious_authority_id=authority_for(husband.sect).id,
            contract_number=f"CN-{wed.year}-{doc_seq:05d}",
            **(lambda cur: {"dowry_currency": cur,
                            "dowry_amount": random.choice([0, 1000, 2500, 5000, 7500]) if cur == "USD"
                            else random.choice([0, 50_000_000, 150_000_000, 400_000_000])}
               )(random.choices(["USD", "LBP"], weights=[62, 38])[0]),
            status="DISSOLVED" if status == "DIVORCED" else "ACTIVE",
        )
        db.session.add(cert)
        db.session.flush()

        if status == "DIVORCED":
            doc_seq += 1
            div = wed + timedelta(days=random.randint(900, 7000))
            if div > TODAY:
                div = TODAY - timedelta(days=random.randint(30, 900))
            ddoc = new_document(dt_divorce, husband.civil_registry_number,
                                f"DIV-{div.year}-{doc_seq:05d}", div,
                                office, created=doc_clerk_at(office))
            db.session.add(m.DivorceCertificate(
                document_id=ddoc.id, marriage_certificate_id=cert.document_id,
                husband_id=husband.civil_registry_number, wife_id=wife.civil_registry_number,
                divorce_date=div, divorce_place=seat_near(office),
                court_id=mcourt.id,
                religious_authority_id=authority_for(husband.sect).id,
                court_decision_number=f"SC-{div.year}-{doc_seq:04d}",
                divorce_type=random.choice(["MUTUAL_CONSENT", "JUDICIAL", "REVOCABLE"]),
                divorce_reason=random.choice([
                    "Irreconcilable differences.", "Separation exceeding three years.",
                    "Mutual petition filed by both parties.", "Desertion.",
                    "Failure to provide maintenance."]),
                child_custody_agreement=random.choice([
                    "Joint custody; primary residence with the mother.",
                    "Sole custody to the mother; visitation every second weekend.",
                    "Joint custody; primary residence with the father.",
                    None, None]),
                financial_settlement=random.choice([
                    "One-time settlement paid on registration.",
                    "Monthly maintenance ordered by the court.",
                    "No financial claims by either party.", None]),
                settlement_amount=random.choice([None, 2000, 5000, 8000, 12000, 20000]),
                settlement_currency="USD",
                sharia_court_approval=(f"Approved {div:%Y-%m-%d}"
                                       if husband.religion == "Islam" else None),
                status=random.choices(["ACTIVE", "UNDER_APPEAL"], weights=[94, 6])[0],
            ))

    # Death certificates for the deceased.
    for cz in bulk_citizens:
        if not cz.is_deceased:
            continue
        doc_seq += 1
        died = rdate(2015, TODAY.year)
        office = home_office(cz)
        ddoc = new_document(dt_death, cz.civil_registry_number,
                            f"DTH-{died.year}-{doc_seq:05d}", died + timedelta(days=2),
                            office, created=doc_clerk_at(office))
        db.session.add(m.DeathCertificate(
            document_id=ddoc.id, death_date=died, death_place=seat_near(office),
            death_cause=random.choice(["Natural causes", "Cardiac arrest", "Respiratory failure",
                                       "Traffic accident", "Prolonged illness"]),
            certifying_physician=(f"Dr. {random.choice(MALE_NAMES + FEMALE_NAMES)[0]} "
                                  f"{random.choice(FAMILY_NAMES)[0]}"),
            burial_place=(f"{seat_near(office)} "
                          f"{'Cemetery' if cz.religion == 'Christianity' else 'Muslim Cemetery'}"),
            burial_date=died + timedelta(days=random.randint(1, 4)),
        ))

    # Naturalisations and name changes — low-volume but real, so the two
    # thinnest certificate screens have something to show.
    for _ in range(22):   # loop index is used to pin the revoked decrees below
        cz = random.choice(bulk_adults)
        doc_seq += 1
        when = rdate(2016, TODAY.year)
        # Naturalisation decrees are registered centrally, wherever the
        # person's own register happens to sit.
        d = new_document(dt_naturalization, cz.civil_registry_number,
                         f"NAT-{when.year}-{doc_seq:05d}", when,
                         office_central, created=doc_clerk_at(office_central))
        db.session.add(m.NaturalizationRecord(
            document_id=d.id,
            previous_nationality=random.choice(["Syrian", "Palestinian", "Armenian", "Russian",
                                                "Egyptian", "Jordanian", "Iraqi"]),
            naturalization_date=when, decree_number=f"DEC-{random.randint(1000, 9999)}",
            decree_date=when - timedelta(days=random.randint(14, 120)),
            # Three of the twenty-two were revoked — kept deterministic so the
            # REVOKED filter is never empty by luck of the draw.
            status="REVOKED" if _ in (4, 11, 17) else "ACTIVE"))

    for _ in range(20):
        cz = random.choice(bulk_adults)
        doc_seq += 1
        when = rdate(2016, TODAY.year)
        office = home_office(cz)
        d = new_document(dt_name_change, cz.civil_registry_number,
                         f"NC-{when.year}-{doc_seq:05d}", when,
                         office, created=doc_clerk_at(office))
        # Either the given name or the surname changes, not both — and a
        # correction produces a different spelling, not the same string back.
        reason, new_first, new_last = random.choice([
            ("Spelling correction on original entry.",
             random.choice(MALE_NAMES if cz.gender == "MALE" else FEMALE_NAMES)[0], cz.last_name_en),
            ("Court-ordered change.",
             cz.first_name_en, random.choice(FAMILY_NAMES)[0]),
            ("Transliteration corrected against the Arabic entry.",
             cz.first_name_en, random.choice(FAMILY_NAMES)[0]),
            ("Marriage-related name update.",
             cz.first_name_en, random.choice(FAMILY_NAMES)[0]),
        ])
        db.session.add(m.NameChangeRecord(
            document_id=d.id,
            old_first_name=cz.first_name_en, old_middle_name=cz.middle_name_en,
            old_last_name=cz.last_name_en,
            new_first_name=new_first, new_middle_name=cz.middle_name_en,
            new_last_name=new_last,
            reason=reason,
            court_decision_number=f"CV-{when.year}-{random.randint(100, 999)}",
            change_date=when))

    db.session.commit()

    # ---- Document lifecycle ------------------------------------------------
    #
    # Up to here every document is a pristine ISSUED row at version 1. Real
    # archives are not like that: copies get reissued, files get cancelled,
    # old records get retired to the stacks, and a few get withdrawn without
    # being destroyed. This pass gives the status, version, is_latest and
    # soft-delete columns something to filter on.
    all_documents = m.Document.query.all()

    # Reissues: the original is superseded and a version 2 takes its place,
    # both sharing a document_group_id so the pair can be found together.
    for original in random.sample(all_documents, int(len(all_documents) * 0.07)):
        original.status = "REPLACED"
        original.is_latest = False
        original.document_group_id = original.id
        reissued_on = original.issue_date + timedelta(days=random.randint(180, 2400))
        if reissued_on > TODAY:
            reissued_on = TODAY - timedelta(days=random.randint(10, 300))
        office = office_by_id[original.issuing_office_id]
        # A reissued document runs its own validity period from its own issue
        # date. Copying the original's expiry produced passports that expired
        # before they were issued — caught by ck_documents_expiry.
        new_expiry = None
        if original.expiry_date:
            validity = (original.expiry_date - original.issue_date)
            new_expiry = reissued_on + validity
        replacement = new_document(
            db.session.get(m.DocumentType, original.document_type_id),
            original.civil_registry_number, f"{original.document_number}/R2",
            reissued_on, office, created=doc_clerk_at(office),
            expiry=new_expiry, attested=False)
        replacement.document_group_id = original.id
        replacement.version = 2

    # Cancelled and archived files.
    remaining = [d for d in all_documents if d.status == "ISSUED"]
    for d in random.sample(remaining, int(len(remaining) * 0.03)):
        d.status = "CANCELLED"
    remaining = [d for d in all_documents if d.status == "ISSUED" and d.issue_date.year < 2012]
    for d in random.sample(remaining, int(len(remaining) * 0.4)):
        d.status = "ARCHIVED"

    # A handful withdrawn from circulation — soft-deleted, never removed,
    # because an audit trail you can delete rows from is not an audit trail.
    for d in random.sample([x for x in all_documents if x.status in ("CANCELLED", "REPLACED")],
                           min(9, len([x for x in all_documents if x.status in ("CANCELLED", "REPLACED")]))):
        # Withdrawing a document from circulation needs documents.delete,
        # which supervisors do not hold — archives officers and the
        # administrator do.
        #
        # The lookup runs first on purpose. staff_at() issues a query, which
        # triggers an autoflush; assigning is_deleted before that call let
        # SQLAlchemy flush a half-set row and trip ck_documents_soft_delete,
        # which requires is_deleted to arrive together with who deleted it
        # and when. All three fields are now assigned with no query between.
        deleter = staff_at(office_by_id[d.issuing_office_id], "documents.delete").id
        deleted_when = NOW - timedelta(days=random.randint(5, 700))
        d.is_deleted = True
        d.deleted_by = deleter
        d.deleted_at = deleted_when

    db.session.commit()

    # ---- Validation and physical custody -----------------------------------
    #
    # Two of the thinnest screens in the system. A document that was validated
    # by nobody and has never been in a filing cabinet is not a document a
    # registry would recognise.
    live_documents = [d for d in m.Document.query.filter_by(is_deleted=False).all()]

    for d in random.sample(live_documents, int(len(live_documents) * 0.45)):
        office = office_by_id[d.issuing_office_id]
        validator = validator_at(office)
        status = random.choices(["APPROVED", "REJECTED", "PENDING"], weights=[84, 9, 7])[0]
        when = datetime.combine(d.issue_date, datetime.min.time()) + timedelta(
            days=random.randint(0, 6), hours=random.randint(8, 16))
        signed = status == "APPROVED"
        db.session.add(m.DocumentValidation(
            document_id=d.id, validator_id=validator.id,
            validation_type=random.choices(
                ["CONTENT_REVIEW", "IDENTITY_CHECK", "SUPPORTING_DOCS", "SIGNATURE_CHECK"],
                weights=[42, 26, 22, 10])[0],
            status=status,
            comments=random.choice([
                "Checked against the register entry.", "Supporting documents seen in original.",
                "Verified with the issuing office by phone.", None]),
            rejection_reason=(random.choice([
                "Supporting document illegible.",
                "Name spelling does not match the register.",
                "Attestation missing from the mukhtar.",
                "Fee receipt not attached."]) if status == "REJECTED" else None),
            validation_date=when,
            digital_signature=(hashlib.sha256(f"sig:{d.document_number}".encode()).hexdigest()
                               if signed else None),
            signature_key_id=(f"KEY-{office.code}-{when.year}" if signed else None),
            ip_address=staff_ip(validator), user_agent=random.choice(BROWSERS)))

    HANDLING_ACTIONS = ["RECEIVED", "FILED", "RETRIEVED", "COPIED", "DISPATCHED", "RETURNED"]
    for d in random.sample(live_documents, int(len(live_documents) * 0.5)):
        office = office_by_id[d.issuing_office_id]
        when = datetime.combine(d.issue_date, datetime.min.time())
        for action in random.sample(HANDLING_ACTIONS, random.choice([1, 2, 2, 3])):
            actor = doc_clerk_at(office)
            when = when + timedelta(days=random.randint(1, 120), hours=random.randint(1, 8))
            if when > NOW:
                break
            witness = supervisor_at(office) if action in ("DISPATCHED", "RETURNED") else None
            db.session.add(m.PhysicalDocumentHandling(
                document_id=d.id, action=action, performed_by=actor.id,
                performed_by_name_snapshot=f"{actor.first_name} {actor.last_name}",
                performed_by_role_snapshot=actor.job_title,
                performed_at=when,
                location=d.physical_file_location.split(" / ")[0],
                location_details=d.physical_file_location,
                notes=random.choice([
                    "Handled at the counter.", "Pulled for a certified copy.",
                    "Returned to the shelf the same day.", None]),
                action_reason=random.choice([
                    "Counter request by the record holder.",
                    "Court-ordered production.",
                    "Internal verification.",
                    "Transfer to another office."]),
                witness_user_id=witness.id if witness else None,
                witness_name=(f"{witness.first_name} {witness.last_name}" if witness else None),
                witness_signature=(hashlib.sha256(
                    f"witness:{d.document_number}:{action}".encode()).hexdigest() if witness else None)))
    db.session.commit()

    # Citizens whose record has been touched since it was created carry the
    # clerk who touched it, which is what updated_by is for.
    for cz in random.sample(bulk_citizens, int(len(bulk_citizens) * 0.34)):
        cz.updated_by = staff_at(home_office(cz), "citizens.edit").id
    db.session.commit()

    # ---- Service requests, SLA, payments, assignments, history ------------
    #
    # Each request gets a submission date in the last ~18 months, weighted
    # toward recent weeks, then a workflow state consistent with its age:
    # something filed yesterday is rarely already issued. The SLA record is
    # then derived from the due date against TODAY, exactly as the nightly
    # SLA job would compute it, so the dashboard's Overdue / Due Soon panels
    # agree with the underlying rows.
    req_seq = 5
    rcpt_seq = 3
    open_requests = []
    audit_rows = []
    notif_rows = []

    request_types = [dt_birth, dt_id, dt_passport, dt_marriage, dt_death, dt_divorce, dt_name_change]
    fee_by_type = {dt_birth: 10, dt_id: 25, dt_passport: 75, dt_marriage: 35,
                   dt_death: 10, dt_divorce: 15, dt_name_change: 30}

    # Documents already on file, so an issued request can point at the thing
    # it actually produced instead of leaving issued_document_id empty.
    docs_by_citizen_type = {}
    for d in m.Document.query.filter_by(is_latest=True, is_deleted=False).all():
        docs_by_citizen_type.setdefault((d.civil_registry_number, d.document_type_id), []).append(d)

    dept_by_type = {dt_passport: dept_travel, dt_id: dept_travel,
                    dt_naturalization: dept_legal, dt_name_change: dept_legal}

    for _ in range(450):
        req_seq += 1
        cz = random.choice(bulk_citizens)
        # Most counter traffic is about a document the person already holds —
        # a certified copy, a renewal, a replacement. Picking the type from
        # what is actually on their file is what lets an issued request point
        # at the document it produced.
        held = [dt for dt in request_types
                if (cz.civil_registry_number, dt.id) in docs_by_citizen_type]
        if held and random.random() < 0.7:
            dtype = random.choice(held)
        else:
            dtype = random.choices(request_types, weights=[22, 26, 18, 10, 6, 6, 12])[0]
        # A request is filed where the citizen's register is held, except for
        # passports, which only the passport directorate issues.
        office = office_passport if dtype is dt_passport else home_office(cz)
        dept = dept_by_type.get(dtype, dept_vital)
        clerk = request_clerk_at(office)
        reviewer = supervisor_at(office)

        # Age in days, skewed recent: most of the caseload is from this quarter.
        age_days = int(random.choices(
            [random.randint(0, 30), random.randint(31, 120), random.randint(121, 365), random.randint(366, 540)],
            weights=[34, 28, 26, 12])[0])
        submitted = datetime.combine(TODAY - timedelta(days=age_days),
                                     datetime.min.time()) + timedelta(hours=random.randint(8, 15),
                                                                      minutes=random.choice([0, 15, 30, 45]))
        sla_days = dtype.default_sla_days or 14
        due = (submitted + timedelta(days=sla_days)).date()

        # Older requests have had time to finish; new ones have not.
        if age_days > 60:
            state = random.choices([ws_issued, ws_rejected], weights=[84, 16])[0]
        elif age_days > 14:
            state = random.choices([ws_issued, ws_approved, ws_in_review, ws_submitted, ws_rejected],
                                   weights=[58, 8, 18, 4, 12])[0]
        else:
            state = random.choices([ws_submitted, ws_in_review, ws_approved, ws_issued],
                                   weights=[46, 34, 12, 8])[0]

        priority = random.choices(["NORMAL", "HIGH", "URGENT", "LOW"], weights=[74, 14, 5, 7])[0]
        extra = {}
        finished_at = None
        if state in (ws_in_review, ws_approved, ws_issued, ws_rejected):
            extra["reviewed_by"] = reviewer.id
            extra["reviewed_at"] = submitted + timedelta(days=random.randint(0, 3), hours=random.randint(1, 6))
        if state in (ws_approved, ws_issued):
            finished_at = submitted + timedelta(days=random.randint(1, max(2, sla_days + 4)), hours=random.randint(1, 7))
            extra["approved_by"] = reviewer.id
            extra["approved_at"] = finished_at
        if state is ws_issued:
            # The document the request produced, when the citizen has one of
            # that type on file.
            issued_pool = docs_by_citizen_type.get((cz.civil_registry_number, dtype.id))
            if issued_pool:
                extra["issued_document_id"] = random.choice(issued_pool).id
        if state is ws_rejected:
            finished_at = submitted + timedelta(days=random.randint(1, max(2, sla_days)), hours=random.randint(1, 7))
            extra["rejected_by"] = reviewer.id
            extra["rejected_at"] = finished_at
            extra["rejection_reason"] = random.choice([
                "Missing court decision attachment.",
                "Identity documents do not match the registry record.",
                "Fee not settled within the allowed period.",
                "Application filed at the wrong office.",
            ])

        r = new_request(f"REQ-{submitted.year}-{req_seq:04d}", cz, dtype, office, dept, state, clerk,
                        submitted, due, priority=priority, fee=fee_by_type[dtype], **extra)

        # SLA, derived the way the scheduled job would derive it.
        is_final = state in (ws_issued, ws_rejected)
        if is_final and finished_at is not None:
            met = finished_at.date() <= due
            sla_status = "MET" if met else "BREACHED"
            db.session.add(m.SlaRecord(
                service_request_id=r.id, due_date=due, sla_status=sla_status,
                days_remaining=(due - finished_at.date()).days,
                overdue_by_days=None if met else (finished_at.date() - due).days,
                breached_at=None if met else finished_at,
                last_checked_at=finished_at))
        elif not is_final:
            remaining = (due - TODAY).days
            if remaining < 0:
                sla_status, overdue = "OVERDUE", -remaining
            elif remaining <= 3:
                sla_status, overdue = "DUE_SOON", None
            else:
                sla_status, overdue = "ON_TRACK", None
            db.session.add(m.SlaRecord(
                service_request_id=r.id, due_date=due, sla_status=sla_status,
                days_remaining=remaining, overdue_by_days=overdue, last_checked_at=NOW))
            open_requests.append((r, sla_status, reviewer))

        # Status history along the path actually taken.
        hist = []
        if state is not ws_submitted:
            hist.append((ws_submitted, ws_in_review, wt_start_review,
                         extra.get("reviewed_at", submitted + timedelta(hours=6))))
        if state in (ws_approved, ws_issued):
            hist.append((ws_in_review, ws_approved, wt_approve, extra["approved_at"]))
        if state is ws_issued:
            hist.append((ws_approved, ws_issued, wt_issue, extra["approved_at"] + timedelta(hours=random.randint(1, 30))))
        if state is ws_rejected:
            hist.append((ws_in_review, ws_rejected, wt_reject, extra["rejected_at"]))
        for from_s, to_s, trans, when in hist:
            db.session.add(m.ServiceRequestStatusHistory(
                service_request_id=r.id, from_state_id=from_s.id, to_state_id=to_s.id,
                transition_id=trans.id,
                changed_by=(clerk.id if to_s is ws_issued else reviewer.id), changed_at=when,
                comment=extra.get("rejection_reason") if to_s is ws_rejected else None))
            actor = clerk if to_s is ws_issued else reviewer
            audit_rows.append(m.AuditLog(
                actor_user_id=actor.id,
                action="WORKFLOW_TRANSITION",
                entity_type="service_request", entity_id=str(r.id), service_request_id=r.id,
                old_value={"workflow_state": from_s.code},
                new_value={"workflow_state": to_s.code},
                was_successful=True,
                occurred_at=when, ip_address=staff_ip(actor),
                user_agent=random.choice(BROWSERS)))

        # Payment on most requests; a few unpaid or reversed so the Payments
        # list is not uniformly green.
        if random.random() < 0.78:
            rcpt_seq += 1
            pay_status = random.choices(["PAID", "PENDING", "REVERSED"], weights=[90, 7, 3])[0]
            db.session.add(m.Payment(
                service_request_id=r.id, amount=fee_by_type[dtype], currency="USD",
                method=random.choices(["CASH", "BANK_TRANSFER", "CARD"], weights=[64, 26, 10])[0],
                status=pay_status, receipt_number=f"RCPT-{rcpt_seq:05d}",
                collected_by=clerk.id, paid_at=submitted + timedelta(minutes=random.randint(5, 90)),
                reversed_by=reviewer.id if pay_status == "REVERSED" else None,
                reversed_at=submitted + timedelta(days=2) if pay_status == "REVERSED" else None,
                reversal_reason=random.choice([
                    "Duplicate payment refunded.",
                    "Request withdrawn by the applicant.",
                    "Fee charged at the wrong rate.",
                    "Paid at the wrong office; refunded and re-collected.",
                ]) if pay_status == "REVERSED" else None))

        # Open work gets assigned to someone; that is what a queue is.
        if not is_final and random.random() < 0.72:
            assignee = staff_at(office, "requests.edit")
            assigned_at = submitted + timedelta(hours=random.randint(1, 20))
            # Work gets handed on. An assignment table where nothing was ever
            # reassigned cannot show a queue moving.
            reassigned = random.random() < 0.18
            db.session.add(m.RequestAssignment(
                service_request_id=r.id, assigned_to=assignee.id, assigned_by=reviewer.id,
                assigned_at=assigned_at,
                unassigned_at=(assigned_at + timedelta(days=random.randint(1, 9))) if reassigned else None,
                is_active=not reassigned,
                note=random.choice([
                    "Front-desk queue.", "Reassigned — original clerk on leave.",
                    "Priority file, handle same day.", None])))
            if reassigned:
                second = staff_at(office, "requests.edit")
                db.session.add(m.RequestAssignment(
                    service_request_id=r.id, assigned_to=second.id, assigned_by=reviewer.id,
                    assigned_at=assigned_at + timedelta(days=random.randint(1, 9), hours=1),
                    is_active=True, note="Picked up after reassignment."))
            notified_at = submitted + timedelta(hours=random.randint(1, 20))
            was_read = random.random() < 0.55
            notif_rows.append(m.InternalNotification(
                recipient_user_id=assignee.id, related_entity_type="service_request",
                related_entity_id=str(r.id), notification_type="ASSIGNMENT",
                message=f"You were assigned request {r.request_number}.",
                is_read=was_read,
                read_at=(notified_at + timedelta(hours=random.randint(1, 60))) if was_read else None,
                created_at=notified_at))

    db.session.commit()

    # Overdue work raises a warning to the supervisor.
    for r, sla_status, reviewer in open_requests:
        if sla_status == "OVERDUE":
            raised_at = NOW - timedelta(days=random.randint(0, 5))
            was_read = random.random() < 0.3
            notif_rows.append(m.InternalNotification(
                recipient_user_id=reviewer.id, related_entity_type="service_request",
                related_entity_id=str(r.id), notification_type="SLA_WARNING",
                message=f"{r.request_number} is past its due date.",
                is_read=was_read,
                read_at=(raised_at + timedelta(hours=random.randint(1, 40))) if was_read else None,
                created_at=raised_at))

    # Notifications that are not about a service request, so the entity-type
    # filter has more than one value to filter on.
    for u in random.sample(all_staff, min(30, len(all_staff))):
        raised_at = NOW - timedelta(days=random.randint(0, 60))
        was_read = random.random() < 0.5
        kind, msg = random.choice([
            ("ACCOUNT", "Your password expires in 14 days."),
            ("TRANSFER", "A registry transfer into your office is awaiting approval."),
            ("AMENDMENT", "A civil status amendment you requested was approved."),
            ("SYSTEM", "Scheduled maintenance this Sunday from 22:00."),
        ])
        notif_rows.append(m.InternalNotification(
            recipient_user_id=u.id, related_entity_type=kind.lower(),
            related_entity_id=str(u.id), notification_type=kind, message=msg,
            is_read=was_read,
            read_at=(raised_at + timedelta(hours=random.randint(1, 50))) if was_read else None,
            created_at=raised_at))

    # Actions the system refused. An audit log that only records what worked
    # is the half of the log nobody needs.
    for _ in range(60):
        actor = random.choice(all_staff)
        audit_rows.append(m.AuditLog(
            actor_user_id=actor.id,
            action=random.choice(["VIEW_CITIZEN", "EXPORT_RECORDS", "EDIT_CITIZEN",
                                  "DELETE_DOCUMENT", "WORKFLOW_TRANSITION"]),
            entity_type=random.choice(["citizen", "document", "service_request"]),
            entity_id=str(random.randint(1, 500)),
            was_successful=False,
            failure_reason=random.choice([
                "Permission denied: citizens.edit",
                "Permission denied: audit.view",
                "Record is outside the user's office scope",
                "Session expired",
                "Workflow transition not allowed from the current state"]),
            occurred_at=NOW - timedelta(days=random.randint(0, 300), hours=random.randint(0, 23)),
            ip_address=staff_ip(actor), user_agent=random.choice(BROWSERS)))

    db.session.add_all(notif_rows)
    db.session.add_all(audit_rows)
    db.session.commit()

    # ---- Access and amendment trails --------------------------------------
    access_rows = []
    for _ in range(700):
        cz = random.choice(bulk_citizens)
        # Mostly staff at the office holding the record, but not only — an
        # access log that can never show a cross-office lookup cannot show
        # the one thing an auditor is looking for.
        actor = (staff_at(home_office(cz), "citizens.view") if random.random() < 0.82
                 else random.choice([u for u in all_staff if holds(u, "citizens.view")]))
        access_rows.append(m.RecordAccessLog(
            citizen_id=cz.civil_registry_number, accessed_by=actor.id,
            access_type=random.choices(["VIEW_RECORD", "SEARCH_RESULT", "EXPORT", "PRINT"],
                                       weights=[58, 26, 8, 8])[0],
            ip_address=staff_ip(actor),
            accessed_at=NOW - timedelta(days=random.randint(0, 400), hours=random.randint(0, 23)),
            reason=random.choice(["Counter enquiry", "Request verification", "Court-requested export",
                                  "Document issuance check", "Family book update"])))
    db.session.add_all(access_rows)

    amendment_rows = []
    citizen_audit_rows = []
    for _ in range(70):
        cz = random.choice(bulk_adults)
        office = home_office(cz)
        approver = supervisor_at(office)
        field, old, new = random.choice([
            ("last_name_en", cz.last_name_en, random.choice(FAMILY_NAMES)[0]),
            ("first_name_en", cz.first_name_en,
             random.choice(MALE_NAMES if cz.gender == "MALE" else FEMALE_NAMES)[0]),
            ("marital_status", "SINGLE", "MARRIED"),
            ("date_of_birth", str(cz.date_of_birth), str(cz.date_of_birth - timedelta(days=1))),
            ("place_of_birth", cz.place_of_birth, random.choice(BIRTH_PLACES)),
            ("first_name_ar", cz.first_name_ar,
             random.choice(MALE_NAMES if cz.gender == "MALE" else FEMALE_NAMES)[1]),
        ])
        when = rdate(2020, TODAY.year)
        status = random.choices(["APPROVED", "PENDING", "REJECTED"], weights=[72, 20, 8])[0]
        am = m.CivilStatusAmendment(
            citizen_id=cz.civil_registry_number, field_changed=field,
            old_value=str(old), new_value=str(new),
            legal_basis=random.choice(["Clerical error in original entry.",
                                       "Court-ordered correction.",
                                       "Supporting documents produced by citizen.",
                                       "Discrepancy with the Arabic register entry."]),
            court_decision_number=f"CV-{when.year}-{random.randint(100, 999)}",
            court_id=court_for(cz.religion, cz.sect, office.district_id).id,
            requested_by=staff_at(office, "citizens.edit").id,
            approved_by=approver.id if status == "APPROVED" else None,
            approved_at=(datetime.combine(when, datetime.min.time())
                         + timedelta(days=random.randint(1, 45), hours=random.randint(8, 16))
                         if status == "APPROVED" else None),
            status=status, amendment_date=when)
        db.session.add(am)
        amendment_rows.append((am, cz, field, old, new, status, approver))
    db.session.flush()

    for am, cz, field, old, new, status, approver in amendment_rows:
        if status != "APPROVED":
            continue
        citizen_audit_rows.append(m.CitizenAuditLog(
            citizen_id=cz.civil_registry_number, amendment_id=am.id, field_name=field,
            old_value=str(old), new_value=str(new), changed_by=approver.id,
            changed_at=am.approved_at,
            reason=f"Approved amendment {am.id}", ip_address=staff_ip(approver)))
    db.session.add_all(citizen_audit_rows)
    db.session.flush()

    # Every name change record stands on an amendment to the register. Without
    # the link, the record says a name changed and nothing says who authorised
    # it.
    for ncr in m.NameChangeRecord.query.all():
        doc = db.session.get(m.Document, ncr.document_id)
        cz = db.session.get(m.Citizen, doc.civil_registry_number)
        office = home_office(cz)
        approver = supervisor_at(office)
        changed_first = ncr.new_first_name != ncr.old_first_name
        am = m.CivilStatusAmendment(
            citizen_id=cz.civil_registry_number,
            field_changed="first_name_en" if changed_first else "last_name_en",
            old_value=ncr.old_first_name if changed_first else ncr.old_last_name,
            new_value=ncr.new_first_name if changed_first else ncr.new_last_name,
            legal_basis=ncr.reason,
            court_decision_number=ncr.court_decision_number,
            court_id=court_for(cz.religion, cz.sect, office.district_id).id,
            requested_by=staff_at(office, "citizens.edit").id,
            approved_by=approver.id,
            approved_at=datetime.combine(ncr.change_date, datetime.min.time()),
            status="APPROVED", amendment_date=ncr.change_date)
        db.session.add(am)
        db.session.flush()
        ncr.amendment_id = am.id
    db.session.commit()

    # Registry transfers — people moving their register from one office to
    # another, which is only meaningful now that there are offices to move
    # between.
    for _ in range(55):
        cz = random.choice(bulk_citizens)
        frm = home_office(cz)
        to = random.choice([o for o in registry_offices if o is not frm])
        asked = NOW - timedelta(days=random.randint(5, 500))
        status = random.choices(["APPROVED", "PENDING", "REJECTED"], weights=[70, 22, 8])[0]
        # About a third of transfers move a whole family book rather than one
        # person — a household relocating, not an individual.
        fam_row = (m.FamilyMember.query.filter_by(citizen_id=cz.civil_registry_number).first()
                   if random.random() < 0.35 else None)
        db.session.add(m.RegistryTransfer(
            citizen_id=cz.civil_registry_number,
            family_record_id=fam_row.family_record_id if fam_row else None,
            from_office_id=frm.id, to_office_id=to.id,
            requested_by=staff_at(frm, "citizens.edit").id, requested_at=asked,
            approved_by=supervisor_at(to).id if status == "APPROVED" else None,
            approved_at=asked + timedelta(days=random.randint(1, 10)) if status == "APPROVED" else None,
            decision_reference=(f"TRF-{asked.year}-{random.randint(1000, 9999)}"
                                if status != "PENDING" else None),
            status=status,
            transfer_date=(asked + timedelta(days=random.randint(2, 14))).date() if status == "APPROVED" else None))

    # Guardianships for minors whose parent is deceased or divorced.
    minors = [c for c in bulk_citizens if (TODAY.year - c.date_of_birth.year) < 18]
    for cz in random.sample(minors, min(40, len(minors))):
        guardian = random.choice(bulk_adults)
        start = rdate(2018, TODAY.year)
        # A guardianship ends when the minor comes of age or the court lifts
        # it; an end_date is what makes the ENDED status verifiable.
        end = (start + timedelta(days=random.randint(200, 1800))
               if random.random() < 0.18 else None)
        if end and end > TODAY:
            end = None
        office = home_office(cz)
        db.session.add(m.GuardianshipRecord(
            minor_citizen_id=cz.civil_registry_number,
            guardian_citizen_id=guardian.civil_registry_number,
            guardianship_type=random.choice(["COURT_APPOINTED", "PARENTAL", "TESTAMENTARY"]),
            court_decision_number=f"GRD-{start.year}-{random.randint(1000, 9999)}",
            court_id=court_for(cz.religion, cz.sect, office.district_id).id,
            start_date=start, end_date=end,
            status="ENDED" if end else "ACTIVE",
            created_by=supervisor_at(office).id))

    # Sign-in history, so the security screens are not empty. Staff sign in
    # from their own office's subnet, which is what makes an access log worth
    # reading when something looks off.
    login_rows = []
    last_seen = {}
    jti_seq = 1000
    for _ in range(420):
        u = random.choice(all_staff)
        when = NOW - timedelta(days=random.randint(0, 120), hours=random.randint(0, 23),
                               minutes=random.randint(0, 59))
        ok = random.random() < 0.87
        login_rows.append(m.LoginAttempt(
            username_attempted=u.username, user_id=u.id if ok else None,
            was_successful=ok,
            failure_reason=None if ok else random.choice(["BAD_PASSWORD", "ACCOUNT_INACTIVE"]),
            ip_address=staff_ip(u), attempted_at=when,
            user_agent=random.choice(BROWSERS)))
        if ok:
            jti_seq += 1
            # Each session needs its own token id — a JWT identifier shared
            # across sessions cannot be revoked for one user without
            # revoking it for everyone.
            login_rows.append(m.SessionLog(
                user_id=u.id, jti=f"sess-{when:%Y%m%d}-{jti_seq:06d}",
                login_at=when, logout_at=when + timedelta(hours=random.randint(1, 8)),
                expires_at=when + timedelta(hours=12),
                ip_address=staff_ip(u),
                user_agent=random.choice(BROWSERS)))
            last_seen[u.id] = max(last_seen.get(u.id, when), when)
    db.session.add_all(login_rows)

    # Sign-in history that never reaches the user record is history the Users
    # screen cannot show.
    for u in all_staff:
        if u.id in last_seen:
            u.last_login_at = last_seen[u.id]
        u.password_changed_at = (u.hire_date and datetime.combine(
            u.hire_date + timedelta(days=random.randint(1, 400)), datetime.min.time()))
    # A few accounts in the states a helpdesk actually sees.
    for u in random.sample(generated_staff, 6):
        u.must_change_password = True
    for u in random.sample(generated_staff, 4):
        u.failed_login_attempts = random.randint(1, 3)
    locked = random.choice(generated_staff)
    locked.failed_login_attempts = 5
    locked.locked_until = NOW + timedelta(minutes=random.randint(5, 30))

    # Revoked tokens for the sessions that ended in a forced sign-out.
    for s in random.sample([r for r in login_rows if isinstance(r, m.SessionLog)], 12):
        db.session.add(m.TokenDenylist(
            jti=s.jti, user_id=s.user_id, expires_at=s.expires_at,
            revoked_reason=random.choice(["LOGOUT", "PASSWORD_CHANGE", "ADMIN_REVOKE", "SESSION_TIMEOUT"])))
    db.session.commit()

    print("\nSeed data inserted successfully.\n")
    print("Row counts:")
    for label, model in [
        ("governorates", m.Governorate), ("districts", m.District), ("offices", m.Office),
        ("courts", m.Court), ("mukhtars", m.Mukhtar), ("staff users", m.User),
        ("citizens", m.Citizen), ("family records", m.FamilyRecord), ("family members", m.FamilyMember),
        ("documents", m.Document), ("service requests", m.ServiceRequest),
        ("SLA records", m.SlaRecord), ("payments", m.Payment), ("assignments", m.RequestAssignment),
        ("status history", m.ServiceRequestStatusHistory), ("audit logs", m.AuditLog),
        ("record access logs", m.RecordAccessLog), ("login attempts", m.LoginAttempt),
    ]:
        print(f"  {label:<20} {db.session.query(model).count():>6}")

    print("\nLogin credentials:")
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

    print("\nThe ten positions:")
    print(f"  {'Username':<18} {'Password':<18} {'Role / position':<34} Perms")
    for position, first, last, username, password in POSITION_STAFF:
        print(f"  {username:<18} {password:<18} {position:<34} {len(role_codes[position]):>2}")

    print(f"\n  The other {len(generated_staff)} regional staff accounts all share the demo")
    print(f"  password {STAFF_PASSWORD!r} — usernames are firstname.lastname,")
    print("  listed under Access Control -> Users.")

    print("\nStaff per role:")
    for name, _d, _s, codes in ROLE_SPECS:
        n = db.session.query(m.UserRole).filter_by(role_id=roles[name].id, revoked_at=None).count()
        print(f"  {name:<34} {len(codes):>2} perms   {n:>3} staff")