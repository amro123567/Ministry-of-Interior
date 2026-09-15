from flask import redirect, url_for, request, flash
from flask_login import current_user
from flask_admin.contrib.sqla import ModelView
from flask_admin import AdminIndexView, expose
from extensions import db
import models as m


class PermissionMixin:
    """
    Ties a Flask-Admin view's visibility and edit/create/delete actions to
    the current user's permission codes (looked up through Roles ->
    RolePermission -> Permission, based on the tables already in the schema).

    Subclasses set:
      - view_permission: permission code required to see/browse this table
      - edit_permission: permission code required to create/edit/delete
                          rows (None = never editable through the UI)
    """
    view_permission = None
    edit_permission = None

    def is_accessible(self):
        if not current_user.is_authenticated:
            return False
        return current_user.has_permission(self.view_permission)

    def inaccessible_callback(self, name, **kwargs):
        flash("You don't have permission to access that.", "error")
        if current_user.is_authenticated:
            return redirect(url_for("admin.index"))
        return redirect(url_for("login_page", next=request.url))

    @property
    def can_create(self):
        return current_user.is_authenticated and current_user.has_permission(self.edit_permission) and self.edit_permission is not None

    @property
    def can_edit(self):
        return current_user.is_authenticated and current_user.has_permission(self.edit_permission) and self.edit_permission is not None

    @property
    def can_delete(self):
        return current_user.is_authenticated and current_user.has_permission(self.edit_permission) and self.edit_permission is not None


class BaseView(PermissionMixin, ModelView):
    page_size = 25
    can_view_details = True
    can_export = True
    column_display_pk = True
    column_default_sort = None


# ---------- Geography & Institutions (view: geography.view / edit: geography.edit) ----------

class GeoView(BaseView):
    view_permission = "geography.view"
    edit_permission = "geography.edit"


class GovernorateView(GeoView):
    column_searchable_list = ["name_ar", "name_en", "code"]


class DistrictView(GeoView):
    column_searchable_list = ["name_ar", "name_en"]
    column_filters = ["governorate"]
    form_ajax_refs = {"governorate": {"fields": ["name_en", "name_ar"], "page_size": 10}}


class OfficeView(GeoView):
    column_searchable_list = ["name_ar", "name_en"]
    column_filters = ["office_type", "is_active"]
    form_ajax_refs = {"district": {"fields": ["name_en", "name_ar"], "page_size": 10}}


class CourtView(GeoView):
    column_searchable_list = ["name_ar", "name_en"]
    column_filters = ["court_type", "is_active"]
    form_ajax_refs = {"district": {"fields": ["name_en", "name_ar"], "page_size": 10}}


class ReligiousAuthorityView(GeoView):
    column_searchable_list = ["name_ar", "name_en"]
    column_filters = ["religion", "sect"]


# ---------- Access Control (view: access_control.view / edit: access_control.edit) ----------

class AccessControlView(BaseView):
    view_permission = "access_control.view"
    edit_permission = "access_control.edit"


class PermissionView(AccessControlView):
    column_searchable_list = ["code", "description"]


class RoleView(AccessControlView):
    column_searchable_list = ["description"]


class RolePermissionView(AccessControlView):
    form_ajax_refs = {
        "role": {"fields": ["description"], "page_size": 10},
        "permission": {"fields": ["code"], "page_size": 10},
    }


class UserView(AccessControlView):
    column_searchable_list = ["username", "first_name", "last_name"]
    column_filters = ["active", "office"]
    column_list = ["username", "first_name", "last_name", "office", "active"]
    form_columns = ["username", "first_name", "middle_name", "last_name", "office", "active"]
    form_ajax_refs = {"office": {"fields": ["name_en", "name_ar"], "page_size": 10}}

    def on_model_change(self, form, model, is_created):
        # New users get a default password they must be told to change;
        # existing users keep their password (this form never edits it directly).
        if is_created and not model.password_hash:
            model.set_password("ChangeMe!123")
        super().on_model_change(form, model, is_created)


class UserRoleView(AccessControlView):
    form_ajax_refs = {
        "user": {"fields": ["username", "first_name", "last_name"], "page_size": 10},
        "role": {"fields": ["description"], "page_size": 10},
    }


# ---------- Document Types (view/edit: documents.view / documents.edit) ----------

class DocumentTypeView(BaseView):
    view_permission = "documents.view"
    edit_permission = "documents.edit"
    column_searchable_list = ["code", "name_ar", "name_en"]
    column_filters = ["category", "is_active"]


# ---------- Citizens & Family (view: citizens.view / edit: citizens.edit) ----------

class CitizenBaseView(BaseView):
    view_permission = "citizens.view"
    edit_permission = "citizens.edit"


class CitizenView(CitizenBaseView):
    column_searchable_list = [
        "civil_registry_number", "first_name_ar", "last_name_ar",
        "first_name_en", "last_name_en",
    ]
    column_filters = ["gender", "religion", "sect", "marital_status", "is_deceased", "nationality"]
    column_list = [
        "civil_registry_number", "first_name_en", "last_name_en",
        "gender", "date_of_birth", "marital_status", "is_deceased",
    ]
    form_ajax_refs = {
        "father": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "mother": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "registration_office": {"fields": ["name_en", "name_ar"], "page_size": 10},
    }


class FamilyRecordView(CitizenBaseView):
    column_searchable_list = ["family_book_number"]
    form_ajax_refs = {
        "head_of_household": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "registration_office": {"fields": ["name_en", "name_ar"], "page_size": 10},
    }


class FamilyMemberView(CitizenBaseView):
    column_filters = ["relationship_"]
    column_list = ["family_record", "citizen", "relationship_", "joined_date", "left_date"]
    form_ajax_refs = {
        "family_record": {"fields": ["family_book_number"], "page_size": 10},
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
    }


# ---------- Documents (view/edit: documents.view / documents.edit) ----------

class DocumentView(BaseView):
    view_permission = "documents.view"
    edit_permission = "documents.edit"
    column_searchable_list = ["id", "document_number"]
    column_filters = ["status", "validation_status", "document_type"]
    column_list = [
        "id", "document_type", "citizen", "document_number",
        "status", "validation_status", "issue_date", "expiry_date",
    ]
    form_ajax_refs = {
        "document_type": {"fields": ["name_en", "code"], "page_size": 10},
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "issuing_office": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "validator": {"fields": ["first_name", "last_name"], "page_size": 10},
        "creator": {"fields": ["first_name", "last_name"], "page_size": 10},
        "updater": {"fields": ["first_name", "last_name"], "page_size": 10},
    }


# ---------- Certificates (view/edit: certificates.view / certificates.edit) ----------

class CertificateBaseView(BaseView):
    view_permission = "certificates.view"
    edit_permission = "certificates.edit"


class BirthCertificateView(CertificateBaseView):
    column_searchable_list = ["registration_number"]
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
    }


class MarriageCertificateView(CertificateBaseView):
    column_searchable_list = ["contract_number"]
    column_filters = ["status"]
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "husband": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "wife": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "court": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "religious_authority": {"fields": ["name_en", "name_ar"], "page_size": 10},
    }


class DivorceCertificateView(CertificateBaseView):
    column_searchable_list = ["court_decision_number"]
    column_filters = ["status"]
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "marriage_certificate": {"fields": ["contract_number"], "page_size": 10},
        "husband": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "wife": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "court": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "religious_authority": {"fields": ["name_en", "name_ar"], "page_size": 10},
    }


class DeathCertificateView(CertificateBaseView):
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "deceased": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
    }


class NationalIdCardView(CertificateBaseView):
    column_searchable_list = ["card_number"]
    column_filters = ["status"]
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
    }


class PassportView(CertificateBaseView):
    column_searchable_list = ["passport_number"]
    column_filters = ["status", "passport_type"]
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "issuing_office": {"fields": ["name_en", "name_ar"], "page_size": 10},
    }


class NaturalizationRecordView(CertificateBaseView):
    column_searchable_list = ["decree_number"]
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
    }


class NameChangeRecordView(CertificateBaseView):
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
    }


# ---------- Audit & Workflow ----------

class DocumentValidationView(BaseView):
    # Any role with audit.view can see validations; editing requires the
    # dedicated documents.validate permission (only Admin & Supervisor).
    view_permission = "audit.view"
    edit_permission = "documents.validate"
    column_filters = ["status", "validation_type"]
    column_default_sort = ("validation_date", True)
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "validator": {"fields": ["first_name", "last_name"], "page_size": 10},
    }


class PhysicalDocumentHandlingView(BaseView):
    view_permission = "audit.view"
    edit_permission = "documents.edit"
    column_filters = ["action", "location"]
    column_default_sort = ("performed_at", True)
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "performer": {"fields": ["first_name", "last_name"], "page_size": 10},
    }


class ServiceRequestView(BaseView):
    view_permission = "requests.view"
    edit_permission = "requests.edit"
    column_searchable_list = ["request_number"]
    column_filters = ["status", "payment_status"]
    column_default_sort = ("submitted_at", True)
    form_ajax_refs = {
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "document_type": {"fields": ["name_en", "code"], "page_size": 10},
        "requested_by": {"fields": ["first_name", "last_name"], "page_size": 10},
        "reviewer": {"fields": ["first_name", "last_name"], "page_size": 10},
        "issued_document": {"fields": ["document_number"], "page_size": 10},
    }


class CitizenAuditLogView(BaseView):
    view_permission = "audit.view"
    edit_permission = None  # always read-only, regardless of role
    can_create = False
    can_edit = False
    can_delete = False
    column_filters = ["field_name"]
    column_default_sort = ("changed_at", True)


class RecordAccessLogView(BaseView):
    view_permission = "audit.view"
    edit_permission = None  # always read-only, regardless of role
    can_create = False
    can_edit = False
    can_delete = False
    column_filters = ["access_type"]
    column_default_sort = ("accessed_at", True)


def register_all_views(admin):
    GEO = "Geography & Institutions"
    ACL = "Access Control"
    FAM = "Citizens & Family"
    DOC = "Documents"
    CERT = "Certificates"
    AUDIT = "Audit & Workflow"

    admin.add_view(GovernorateView(m.Governorate, db.session, name="Governorates", category=GEO))
    admin.add_view(DistrictView(m.District, db.session, name="Districts", category=GEO))
    admin.add_view(OfficeView(m.Office, db.session, name="Offices", category=GEO))
    admin.add_view(CourtView(m.Court, db.session, name="Courts", category=GEO))
    admin.add_view(ReligiousAuthorityView(m.ReligiousAuthority, db.session, name="Religious Authorities", category=GEO))

    admin.add_view(PermissionView(m.Permission, db.session, name="Permissions", category=ACL))
    admin.add_view(RoleView(m.Role, db.session, name="Roles", category=ACL))
    admin.add_view(RolePermissionView(m.RolePermission, db.session, name="Role ↔ Permissions", category=ACL))
    admin.add_view(UserView(m.User, db.session, name="Users", category=ACL))
    admin.add_view(UserRoleView(m.UserRole, db.session, name="User ↔ Roles", category=ACL))

    admin.add_view(CitizenView(m.Citizen, db.session, name="Citizens", category=FAM))
    admin.add_view(FamilyRecordView(m.FamilyRecord, db.session, name="Family Records", category=FAM))
    admin.add_view(FamilyMemberView(m.FamilyMember, db.session, name="Family Members", category=FAM))

    admin.add_view(DocumentTypeView(m.DocumentType, db.session, name="Document Types", category=DOC))
    admin.add_view(DocumentView(m.Document, db.session, name="Documents", category=DOC))

    admin.add_view(BirthCertificateView(m.BirthCertificate, db.session, name="Birth Certificates", category=CERT))
    admin.add_view(MarriageCertificateView(m.MarriageCertificate, db.session, name="Marriage Certificates", category=CERT))
    admin.add_view(DivorceCertificateView(m.DivorceCertificate, db.session, name="Divorce Certificates", category=CERT))
    admin.add_view(DeathCertificateView(m.DeathCertificate, db.session, name="Death Certificates", category=CERT))
    admin.add_view(NationalIdCardView(m.NationalIdCard, db.session, name="National ID Cards", category=CERT))
    admin.add_view(PassportView(m.Passport, db.session, name="Passports", category=CERT))
    admin.add_view(NaturalizationRecordView(m.NaturalizationRecord, db.session, name="Naturalization Records", category=CERT))
    admin.add_view(NameChangeRecordView(m.NameChangeRecord, db.session, name="Name Change Records", category=CERT))

    admin.add_view(DocumentValidationView(m.DocumentValidation, db.session, name="Document Validations", category=AUDIT))
    admin.add_view(PhysicalDocumentHandlingView(m.PhysicalDocumentHandling, db.session, name="Physical Handling", category=AUDIT))
    admin.add_view(ServiceRequestView(m.ServiceRequest, db.session, name="Service Requests", category=AUDIT))
    admin.add_view(CitizenAuditLogView(m.CitizenAuditLog, db.session, name="Citizen Audit Log", category=AUDIT))
    admin.add_view(RecordAccessLogView(m.RecordAccessLog, db.session, name="Record Access Log", category=AUDIT))


class DashboardIndexView(AdminIndexView):
    """Dashboard itself requires login; permission-based content filtering
    happens in app.py's build_stats()."""

    def is_accessible(self):
        return current_user.is_authenticated

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for("login_page", next=request.url))
