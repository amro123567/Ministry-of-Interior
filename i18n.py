# -*- coding: utf-8 -*-
"""
Language handling for the CTS.

The system runs in one language at a time — Arabic or English — chosen by the
user from the toggle in the navbar and remembered in their session. It is not
bilingual: the login page is, deliberately, because that is where a user
arrives before any preference exists, and a person who reads only one of the
two must still be able to sign in.

Two separate bodies of text have to be translated, and they are handled
differently on purpose:

1. Flask-Admin's own interface — "Create", "Export", "With selected",
   pagination, validation messages. Roughly 200 strings that ship with the
   package, which already includes an Arabic catalogue in
   flask_admin/translations/ar/. Flask-Babel is what loads it; install it and
   the whole built-in interface turns Arabic with no strings written here.
   This module degrades gracefully if it is absent (see init_babel).

2. Everything this project wrote — the dashboard, the page headers, the
   footer, the navigation labels. Those live in TEXT below.

TEXT is a plain dict rather than gettext .po files on purpose: .po requires a
compile step (pybabel compile) that has to be re-run on every text change and
produces binary .mo files in the repo. For a few hundred strings owned by one
team, a dict is editable by anyone, diffs readably in git, and cannot fall out
of sync with a compiled artefact. If this system ever grows a third language
or hands translation to non-developers, that trade flips — move to .po then.
"""

from flask import session, request, has_request_context
from markupsafe import escape

DEFAULT_LANG = "ar"
LANGS = ("ar", "en")
RTL_LANGS = ("ar",)

# Keys are English-ish slugs, not English sentences, so that rewording the
# English copy never silently detaches it from its Arabic counterpart.
TEXT = {
    # -- Identity -----------------------------------------------------------
    "country": {
        "ar": "الجمهورية اللبنانية",
        "en": "Republic of Lebanon",
    },
    "ministry": {
        "ar": "وزارة الداخلية والبلديات",
        "en": "Ministry of Interior and Municipalities",
    },
    "directorate": {
        "ar": "المديرية العامة للأحوال الشخصية",
        "en": "Directorate General of Civil Status",
    },
    "system_name": {
        "ar": "نظام تتبّع المراسلات — السجل المدني",
        "en": "Civil Registry — Correspondence Tracking System",
    },
    "flag_alt": {
        "ar": "علم لبنان",
        "en": "Flag of Lebanon",
    },
    "emblem_alt": {
        "ar": "شعار الجمهورية اللبنانية — وزارة الداخلية والبلديات",
        "en": "Republic of Lebanon — Ministry of Interior and Municipalities",
    },

    # -- Navigation / chrome -------------------------------------------------
    "dashboard": {"ar": "الرئيسية", "en": "Dashboard"},
    "account_menu": {"ar": "قائمة الحساب", "en": "Account menu"},
    "switch_account": {"ar": "الدخول بحساب آخر", "en": "Sign in to another account"},
    "sign_out": {"ar": "تسجيل الخروج", "en": "Sign out"},
    "language": {"ar": "اللغة", "en": "Language"},
    "switch_to_english": {"ar": "التبديل إلى الإنكليزية", "en": "Switch to English"},
    "switch_to_arabic": {"ar": "التبديل إلى العربية", "en": "Switch to Arabic"},

    # -- Dashboard -----------------------------------------------------------
    "welcome": {"ar": "مرحباً بك", "en": "Welcome back"},
    "scope_all": {
        "ar": "عرض على مستوى المديرية بالكامل — جميع الدوائر.",
        "en": "Directorate-wide view — all offices.",
    },
    "scope_office": {
        "ar": "الأرقام أدناه تخص دائرتك: %(office)s.",
        "en": "Figures below cover your office: %(office)s.",
    },
    "scope_none": {
        "ar": "لم يتم ربط حسابك بدائرة، لذا لا يمكن حصر الأرقام بدائرة معيّنة.",
        "en": "Your account is not linked to an office, so figures cannot be scoped to one.",
    },
    "no_requests_permission": {
        "ar": "لا تملك صلاحية الاطّلاع على طلبات الخدمة، لذا لا تتوفر مؤشرات الأداء. استخدم القائمة أعلاه للوصول إلى الوحدات المتاحة لك.",
        "en": "Your role does not include requests.view, so the service-request indicators are not available. Use the menu above to reach the modules you do have access to.",
    },

    "kpi_open": {"ar": "الطلبات المفتوحة", "en": "Open Requests"},
    "kpi_overdue": {"ar": "متأخرة عن المهلة", "en": "Overdue"},
    "kpi_due_soon": {"ar": "تستحق قريباً", "en": "Due Soon"},
    "kpi_avg": {"ar": "متوسط مدة الإنجاز", "en": "Avg. Resolution"},

    "of_total": {"ar": "من أصل %(n)d طلباً", "en": "of %(n)d total"},
    "worst_late": {"ar": "الأطول تأخراً %(n)d أيام", "en": "worst is %(n)d days late"},
    "nothing_late": {"ar": "لا تأخير", "en": "nothing late"},
    "next_due": {"ar": "أقرب استحقاق %(d)s", "en": "next due %(d)s"},
    "none_approaching": {"ar": "لا استحقاقات وشيكة", "en": "none approaching"},
    "across_completed": {"ar": "على %(n)d طلباً منجزاً", "en": "across %(n)d completed"},
    "unit_days": {"ar": "يوم", "en": "days"},
    "unit_hours": {"ar": "ساعة", "en": "hours"},

    "pill_action_required": {"ar": "يتطلب إجراء", "en": "Action required"},
    "pill_this_week": {"ar": "خلال أيام", "en": "Within days"},
    "sla_panel": {"ar": "الالتزام بالمهل", "en": "Service-level compliance"},
    "sla_view_records": {"ar": "عرض السجلات", "en": "View records"},
    "sla_empty": {
        "ar": "لا توجد سجلات مهل ضمن نطاقك.",
        "en": "No SLA records in your scope yet.",
    },
    "sla_chart_alt": {
        "ar": "توزّع الالتزام بالمهل على %(n)d طلباً",
        "en": "SLA distribution across %(n)d tracked requests",
    },

    "workflow_panel": {"ar": "توزّع الطلبات على مراحل سير العمل", "en": "Requests by workflow state"},
    "workflow_all": {"ar": "كل الطلبات", "en": "All requests"},
    "workflow_empty": {
        "ar": "لا توجد طلبات ضمن نطاقك.",
        "en": "No service requests in your scope yet.",
    },
    "workflow_total": {
        "ar": "إجمالي الطلبات ضمن نطاقك: %(n)d",
        "en": "%(n)d requests in scope",
    },

    # SLA status names. Kept here rather than in admin_views so every user-
    # visible string in the system has one home.
    "sla_ON_TRACK": {"ar": "ضمن المهلة", "en": "On Track"},
    "sla_DUE_SOON": {"ar": "تستحق قريباً", "en": "Due Soon"},
    "sla_OVERDUE": {"ar": "متأخرة", "en": "Overdue"},
    "sla_MET": {"ar": "منجزة ضمن المهلة", "en": "Met"},
    "sla_BREACHED": {"ar": "تجاوزت المهلة", "en": "Breached"},

    # -- Footer --------------------------------------------------------------
    "footer_rights": {
        "ar": "جميع الحقوق محفوظة",
        "en": "All rights reserved",
    },
    "footer_support": {"ar": "الدعم التقني", "en": "IT Support"},
    "footer_your_office": {"ar": "دائرتك", "en": "Your office"},
    "footer_no_office": {"ar": "غير مرتبط بدائرة", "en": "No office assigned"},
    "footer_ext": {"ar": "مقسم", "en": "ext."},
    "footer_signed_in_as": {"ar": "أنت مسجّل الدخول كـ", "en": "Signed in as"},
    "footer_blurb": {
        "ar": "نظام داخلي لتسجيل معاملات الأحوال الشخصية وتتبّعها بين الدوائر حتى إصدار الوثيقة.",
        "en": "Internal system for registering civil-status requests and tracking them between offices through to issuance.",
    },
    "footer_col_system": {"ar": "النظام", "en": "System"},
    "footer_col_support": {"ar": "الدعم", "en": "Support"},
    "footer_col_ministry": {"ar": "الوزارة", "en": "Ministry"},
    "footer_report_issue": {"ar": "الإبلاغ عن عطل", "en": "Report a problem"},
    "footer_ministry_site": {"ar": "موقع الوزارة", "en": "Ministry website"},
    "footer_dgcs_site": {"ar": "موقع المديرية", "en": "Directorate website"},
    "footer_contact": {"ar": "اتصل بنا", "en": "Contact"},
    "brand_short": {"ar": "نظام السجل المدني", "en": "Civil Registry System"},
    "brand_eyebrow": {"ar": "وزارة الداخلية والبلديات", "en": "Ministry of Interior & Municipalities"},
    "actions": {"ar": "إجراءات", "en": "Actions"},
    "footer_col_legal": {"ar": "معلومات قانونية", "en": "Legal & Ministry"},
    "footer_legal_notice": {
        "ar": "الوثائق والبيانات ضمن هذا النظام ملك للدولة اللبنانية، ويُمنع نسخها أو نشرها خارج المديرية.",
        "en": "Records in this system are property of the Lebanese State and may not be copied or disclosed outside the Directorate.",
    },
    "footer_audit_notice": {
        "ar": "نظام داخلي — تُسجَّل جميع عمليات الدخول والاطّلاع لأغراض التدقيق.",
        "en": "Internal system — all sign-ins and record access are logged for audit.",
    },
}



# ---------------------------------------------------------------------------
# Navigation vocabulary
#
# Arabic counterparts for the nav groups, categories and view names that
# admin_views.py passes to add_view() / add_category(). The English side is
# the key itself, so only one column has to be maintained.
# ---------------------------------------------------------------------------

NAV_AR = {
    'Dashboard': 'الرئيسية',
    'Reference Data': 'البيانات المرجعية',
    'Access & Security': 'الوصول والأمن',
    'Civil Registry': 'السجل المدني',
    'Geography & Institutions': 'الجغرافيا والمؤسسات',
    'Access Control & Security': 'التحكم بالصلاحيات',
    'Security & Sessions': 'الأمن والجلسات',
    'Workflow Configuration': 'إعدادات سير العمل',
    'Document Configuration': 'إعدادات الوثائق',
    'Citizens & Family': 'المواطنون والعائلات',
    'Documents': 'الوثائق',
    'Certificates': 'الشهادات',
    'Service Requests & Payments': 'طلبات الخدمة والمدفوعات',
    'Audit & Access Logs': 'التدقيق وسجلات الاطلاع',
    'Governorates': 'المحافظات',
    'Districts': 'الأقضية',
    'Offices': 'الدوائر',
    'Departments': 'الأقسام',
    'Courts': 'المحاكم',
    'Religious Authorities': 'المراجع الدينية',
    'Mukhtars': 'المخاتير',
    'Permissions': 'الصلاحيات',
    'Roles': 'الأدوار',
    'Role ↔ Permissions': 'صلاحيات الأدوار',
    'Users': 'المستخدمون',
    'User ↔ Roles': 'أدوار المستخدمين',
    'Session Logs': 'سجلات الجلسات',
    'Login Attempts': 'محاولات الدخول',
    'Token Denylist': 'الرموز الملغاة',
    'Workflow States': 'مراحل سير العمل',
    'Workflow Transitions': 'انتقالات سير العمل',
    'Transition Permissions': 'صلاحيات الانتقال',
    'Document Types': 'أنواع الوثائق',
    'Document Type Authorities': 'مراجع إصدار الوثائق',
    'Citizens': 'المواطنون',
    'Family Records': 'السجلات العائلية',
    'Family Members': 'أفراد العائلة',
    'Guardianship Records': 'سجلات الوصاية',
    'Registry Transfers': 'نقل القيد',
    'Civil Status Amendments': 'تصحيح القيد',
    'Document Validations': 'تصديق الوثائق',
    'Physical Handling': 'التداول الورقي',
    'Birth Certificates': 'شهادات الولادة',
    'Marriage Certificates': 'عقود الزواج',
    'Divorce Certificates': 'وثائق الطلاق',
    'Death Certificates': 'شهادات الوفاة',
    'National ID Cards': 'بطاقات الهوية',
    'Passports': 'جوازات السفر',
    'Naturalization Records': 'سجلات التجنّس',
    'Name Change Records': 'تبديل الأسماء',
    'Service Requests': 'طلبات الخدمة',
    'Request Assignments': 'إسناد الطلبات',
    'Status History': 'تسلسل الحالات',
    'SLA Records': 'سجلات المهل',
    'Payments': 'المدفوعات',
    'Notifications': 'الإشعارات',
    'Audit Logs': 'سجلات التدقيق',
    'Citizen Audit Log': 'سجل تدقيق المواطنين',
    'Record Access Log': 'سجل الاطلاع',
}


# Which top-level nav group each category was folded under, so the breadcrumb
# can show the same path the menu does. Mirrors the add_sub_category calls in
# register_all_views(); the two are edited together.
PARENT_CATEGORY = {
    "Geography & Institutions": "Reference Data",
    "Document Configuration": "Reference Data",
    "Workflow Configuration": "Reference Data",
    "Access Control & Security": "Access & Security",
    "Security & Sessions": "Access & Security",
    "Audit & Access Logs": "Access & Security",
    "Citizens & Family": "Civil Registry",
    "Documents": "Civil Registry",
    "Certificates": "Civil Registry",
}


def nav_label(name):
    """Localized label for a nav group, category or view name."""
    if get_lang() == "ar":
        return NAV_AR.get(str(name), str(name))
    return str(name)


class L(str):
    """A menu label that renders in the current language.

    Flask-Admin fixes menu names at registration time, long before a request
    exists, so a plain translated string would freeze the menu into whichever
    language happened to be active at import. This subclasses str and keeps
    the ENGLISH text as its actual value — so every dict key, category lookup
    and comparison inside Flask-Admin behaves exactly as before — while
    __html__ renders the localized text. Jinja calls __html__ on autoescape,
    which is on for templates, so the menu translates per request with no
    changes inside Flask-Admin itself.
    """

    def __html__(self):
        return escape(nav_label(str(self)))


# ---------------------------------------------------------------------------
# Table column headers
#
# Keyed by the model FIELD name, not by (view, field): the same field name
# means the same thing everywhere in this schema — `office` is the office on
# a request and on a user alike — so one entry serves every view that shows
# it. A view that genuinely needs its own wording still sets column_labels,
# which BaseView.get_column_name checks first.
#
# An unmapped field falls back to Flask-Admin's own prettifier
# ("civil_registry_number" -> "Civil Registry Number"), so adding a column
# without touching this table degrades to English rather than breaking.
# ---------------------------------------------------------------------------

COLUMNS = {
    'access_type': ('Access Type', 'نوع الاطّلاع'),
    'accessed_at': ('Accessed At', 'تاريخ الاطّلاع'),
    'accessed_by_user': ('Accessed By', 'اطّلع عليه'),
    'action': ('Action', 'الإجراء'),
    'action_code': ('Action Code', 'رمز الإجراء'),
    'actor': ('Actor', 'المنفّذ'),
    'amendment_date': ('Amendment Date', 'تاريخ التصحيح'),
    'amount': ('Amount', 'المبلغ'),
    'assigned_at': ('Assigned At', 'تاريخ الإسناد'),
    'assignee': ('Assignee', 'المُسنَد إليه'),
    'assigner': ('Assigned By', 'أسندها'),
    'attempted_at': ('Attempted At', 'وقت المحاولة'),
    'authority_kind': ('Authority Kind', 'نوع المرجع'),
    'birth_place': ('Birth Place', 'مكان الولادة'),
    'card_number': ('Card Number', 'رقم البطاقة'),
    'category': ('Category', 'الفئة'),
    'change_date': ('Change Date', 'تاريخ التبديل'),
    'changed_at': ('Changed At', 'تاريخ التعديل'),
    'changed_by_user': ('Changed By', 'عدّلها'),
    'citizen': ('Citizen', 'المواطن'),
    'civil_registry_number': ('Civil Registry No.', 'رقم السجل المدني'),
    'code': ('Code', 'الرمز'),
    'contract_number': ('Contract Number', 'رقم العقد'),
    'court': ('Court', 'المحكمة'),
    'court_decision_number': ('Court Decision No.', 'رقم القرار القضائي'),
    'court_type': ('Court Type', 'نوع المحكمة'),
    'created_at': ('Created', 'تاريخ الإنشاء'),
    'currency': ('Currency', 'العملة'),
    'date_of_birth': ('Date of Birth', 'تاريخ الولادة'),
    'days_remaining': ('Days Remaining', 'الأيام المتبقية'),
    'death_cause': ('Cause of Death', 'سبب الوفاة'),
    'death_date': ('Death Date', 'تاريخ الوفاة'),
    'death_place': ('Place of Death', 'مكان الوفاة'),
    'decree_number': ('Decree Number', 'رقم المرسوم'),
    'default_sla_days': ('SLA (days)', 'المهلة (أيام)'),
    'department': ('Department', 'القسم'),
    'description': ('Description', 'الوصف'),
    'display_order': ('Order', 'الترتيب'),
    'district': ('District', 'القضاء'),
    'divorce_date': ('Divorce Date', 'تاريخ الطلاق'),
    'divorce_type': ('Divorce Type', 'نوع الطلاق'),
    'document': ('Document', 'الوثيقة'),
    'document_number': ('Document Number', 'رقم الوثيقة'),
    'document_type': ('Document Type', 'نوع الوثيقة'),
    'due_date': ('Due Date', 'تاريخ الاستحقاق'),
    'email': ('Email', 'البريد الإلكتروني'),
    'employee_number': ('Employee No.', 'الرقم الوظيفي'),
    'entity_id': ('Entity ID', 'معرّف السجل'),
    'entity_type': ('Entity Type', 'نوع السجل'),
    'expires_at': ('Expires', 'تاريخ الانتهاء'),
    'expiry_date': ('Expiry Date', 'تاريخ الانتهاء'),
    'failure_reason': ('Failure Reason', 'سبب الإخفاق'),
    'family_book_number': ('Family Book No.', 'رقم الدفتر العائلي'),
    'family_record': ('Family Record', 'السجل العائلي'),
    'father_full_name_snapshot': ("Father's Name", 'اسم الأب'),
    'field_changed': ('Field Changed', 'الحقل المعدَّل'),
    'field_name': ('Field', 'الحقل'),
    'first_name': ('First Name', 'الاسم'),
    'first_name_ar': ('First Name (AR)', 'الاسم (عربي)'),
    'first_name_en': ('First Name (EN)', 'الاسم (إنكليزي)'),
    'from_office': ('From Office', 'من دائرة'),
    'from_state': ('From State', 'من مرحلة'),
    'gender': ('Gender', 'الجنس'),
    'governorate': ('Governorate', 'المحافظة'),
    'granted_at': ('Granted At', 'تاريخ المنح'),
    'granted_by_user': ('Granted By', 'منحها'),
    'guardian': ('Guardian', 'الوصي'),
    'guardianship_type': ('Guardianship Type', 'نوع الوصاية'),
    'head_of_household': ('Head of Household', 'رب العائلة'),
    'husband': ('Husband', 'الزوج'),
    'id': ('ID', 'المعرّف'),
    'ip_address': ('IP Address', 'عنوان IP'),
    'is_active': ('Active', 'مفعّل'),
    'is_active_flag': ('Active', 'مفعّل'),
    'is_deceased': ('Deceased', 'متوفّى'),
    'is_deleted': ('Deleted', 'محذوف'),
    'is_final': ('Final', 'مرحلة نهائية'),
    'is_initial': ('Initial', 'مرحلة أولى'),
    'is_read': ('Read', 'مقروء'),
    'is_system': ('System Role', 'دور نظامي'),
    'issue_date': ('Issue Date', 'تاريخ الإصدار'),
    'joined_date': ('Joined', 'تاريخ الانضمام'),
    'label_ar': ('Label (AR)', 'التسمية (عربي)'),
    'label_en': ('Label (EN)', 'التسمية (إنكليزي)'),
    'last_name': ('Last Name', 'الشهرة'),
    'last_name_ar': ('Last Name (AR)', 'الشهرة (عربي)'),
    'last_name_en': ('Last Name (EN)', 'الشهرة (إنكليزي)'),
    'left_date': ('Left', 'تاريخ المغادرة'),
    'location': ('Location', 'الموقع'),
    'login_at': ('Login', 'وقت الدخول'),
    'logout_at': ('Logout', 'وقت الخروج'),
    'marital_status': ('Marital Status', 'الحالة الزوجية'),
    'marriage_date': ('Marriage Date', 'تاريخ الزواج'),
    'message': ('Message', 'الرسالة'),
    'method': ('Method', 'الطريقة'),
    'minor': ('Minor', 'القاصر'),
    'module': ('Module', 'الوحدة'),
    'mother_full_name_snapshot': ("Mother's Name", 'اسم الأم'),
    'name': ('Name', 'الاسم'),
    'name_ar': ('Name (AR)', 'الاسم (عربي)'),
    'name_en': ('Name (EN)', 'الاسم (إنكليزي)'),
    'nationality': ('Nationality', 'الجنسية'),
    'naturalization_date': ('Naturalization Date', 'تاريخ التجنّس'),
    'new_last_name': ('New Last Name', 'الشهرة الجديدة'),
    'notes': ('Notes', 'ملاحظات'),
    'notification_type': ('Type', 'نوع الإشعار'),
    'occurred_at': ('Occurred At', 'وقت الحدث'),
    'office': ('Office', 'الدائرة'),
    'office_type': ('Office Type', 'نوع الدائرة'),
    'old_last_name': ('Old Last Name', 'الشهرة السابقة'),
    'overdue_by_days': ('Overdue (days)', 'التأخير (أيام)'),
    'paid_at': ('Paid At', 'تاريخ الدفع'),
    'parent': ('Parent', 'التابع لـ'),
    'passport_number': ('Passport Number', 'رقم الجواز'),
    'passport_type': ('Passport Type', 'نوع الجواز'),
    'performed_at': ('Performed At', 'وقت التنفيذ'),
    'performer': ('Performed By', 'نفّذها'),
    'permission': ('Permission', 'الصلاحية'),
    'phone': ('Phone', 'الهاتف'),
    'previous_nationality': ('Previous Nationality', 'الجنسية السابقة'),
    'priority': ('Priority', 'الأولوية'),
    'reason': ('Reason', 'السبب'),
    'receipt_number': ('Receipt No.', 'رقم الإيصال'),
    'recipient': ('Recipient', 'المستلم'),
    'registration_number': ('Registration No.', 'رقم التسجيل'),
    'registration_office': ('Registration Office', 'دائرة التسجيل'),
    'relationship_': ('Relationship', 'صلة القرابة'),
    'religion': ('Religion', 'الدين'),
    'religious_authority': ('Religious Authority', 'المرجع الديني'),
    'request_number': ('Request Number', 'رقم الطلب'),
    'revoked_at': ('Revoked At', 'تاريخ الإلغاء'),
    'revoked_reason': ('Revocation Reason', 'سبب الإلغاء'),
    'role': ('Role', 'الدور'),
    'sect': ('Sect', 'المذهب'),
    'service_request': ('Service Request', 'طلب الخدمة'),
    'sijill_reference': ('Sijill Reference', 'مرجع السجل'),
    'sla_status': ('SLA Status', 'حالة المهلة'),
    'status': ('Status', 'الحالة'),
    'subject': ('Subject', 'الموضوع'),
    'submitted_at': ('Submitted', 'تاريخ التقديم'),
    'to_office': ('To Office', 'إلى دائرة'),
    'to_state': ('To State', 'إلى مرحلة'),
    'transfer_date': ('Transfer Date', 'تاريخ النقل'),
    'transition': ('Transition', 'الانتقال'),
    'updated_at': ('Updated', 'تاريخ التعديل'),
    'user': ('User', 'المستخدم'),
    'username': ('Username', 'اسم المستخدم'),
    'username_attempted': ('Username Tried', 'اسم المستخدم المُدخل'),
    'validation_date': ('Validation Date', 'تاريخ التصديق'),
    'validation_type': ('Validation Type', 'نوع التصديق'),
    'validator': ('Validator', 'المصدِّق'),
    'village_or_neighborhood': ('Village / Quarter', 'القرية أو الحي'),
    'was_successful': ('Successful', 'ناجحة'),
    'wife': ('Wife', 'الزوجة'),
    'workflow_state': ('Workflow State', 'مرحلة سير العمل'),
}


def column_label(field):
    """Localized header for a model field, or None if this table has none."""
    entry = COLUMNS.get(str(field))
    if not entry:
        return None
    en, ar = entry
    return ar if get_lang() == "ar" else en


class Col(str):
    """A table header that resolves in the language of the current request.

    Flask-Admin computes every view's column headers once, in the view's
    __init__, and caches them for the life of the process (_refresh_cache ->
    get_list_columns). A plain translated string would therefore freeze the
    headers into whichever language happened to be active at startup — which
    is no language at all, since there is no request yet.

    So this behaves exactly like the English header as far as Python is
    concerned (it IS that str), and localizes only in __html__, which Jinja
    calls when it escapes the value into the page. Same trick as L for the
    menu; different because the lookup key is the field name, not the text.
    """

    def __new__(cls, field, fallback):
        obj = super().__new__(cls, fallback)
        obj.field = str(field)
        return obj

    def __html__(self):
        return escape(column_label(self.field) or str(self))


def column_header(field, fallback):
    """Lazy header for `field`, falling back to `fallback` where unmapped."""
    return Col(field, fallback)


def get_lang():
    """Language for this request: the user's stored choice, else the default.

    Read from the session rather than a cookie so it follows the user rather
    than the browser, and so signing out on a shared counter terminal resets
    it with everything else.

    Flask-Admin builds each view at import time — outside any request — so
    this has to answer there too rather than raising on a missing session.
    Startup gets the default; the answer only matters once a page renders.
    """
    if not has_request_context():
        return DEFAULT_LANG
    lang = session.get("lang")
    if lang in LANGS:
        return lang
    return DEFAULT_LANG


def set_lang(lang):
    """Store a language choice. Anything unrecognised is ignored, so a
    hand-typed /language/de cannot put the interface into a broken state."""
    if lang in LANGS:
        session["lang"] = lang
        return True
    return False


def is_rtl():
    return get_lang() in RTL_LANGS


def direction():
    return "rtl" if is_rtl() else "ltr"


def t(key, **kwargs):
    """Translate one of this project's own strings.

    An unknown key returns the key itself rather than raising: a missing
    translation should look wrong on screen, not take the page down.
    """
    entry = TEXT.get(key)
    if entry is None:
        return key
    text = entry.get(get_lang()) or entry.get("en") or key
    if kwargs:
        try:
            return text % kwargs
        except (KeyError, TypeError, ValueError):
            return text
    return text


def init_babel(app):
    """Wire up Flask-Babel so Flask-Admin's own catalogue is used.

    Optional by design. Flask-Babel is what gives Arabic to the ~200 strings
    that ship inside Flask-Admin; without it the interface still switches
    language, but those built-in labels stay English. Rather than making the
    whole app fail to import over a missing package, this reports the
    situation once at startup and carries on.
    """
    try:
        from flask_babel import Babel
    except ImportError:
        app.config["BABEL_AVAILABLE"] = False
        print(
            "NOTE: flask-babel is not installed, so Flask-Admin's own labels "
            "(Create / Export / Search / filters) stay English in Arabic mode. "
            "Install it with:  pip install flask-babel"
        )
        return None

    app.config["BABEL_DEFAULT_LOCALE"] = DEFAULT_LANG
    app.config["BABEL_AVAILABLE"] = True
    return Babel(app, locale_selector=lambda: get_lang())


def register(app):
    """Everything the app needs from this module, in one call."""
    init_babel(app)

    # Templates reach these directly; no per-view plumbing.
    app.jinja_env.globals.update(
        t=t,
        get_lang=get_lang,
        is_rtl=is_rtl,
        direction=direction,
        nav_label=nav_label,
        column_label=column_label,
        column_header=column_header,
        parent_category=PARENT_CATEGORY.get,
    )

    @app.context_processor
    def _inject_year():
        from datetime import datetime
        return {"now_year": datetime.now().year}

    @app.route("/language/<lang>")
    def set_language(lang):
        from flask import redirect, url_for
        set_lang(lang)
        # Return the user to the page they were on. request.referrer is
        # checked for being one of ours so the parameter cannot be used to
        # bounce someone off-site.
        target = request.referrer
        if target and target.startswith(request.host_url):
            return redirect(target)
        return redirect(url_for("admin.index"))

    return app
