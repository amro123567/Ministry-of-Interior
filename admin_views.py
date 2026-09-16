from flask import redirect, url_for, request, flash
from flask_login import current_user
from flask_admin.contrib.sqla import ModelView
from flask_admin import AdminIndexView, expose
from markupsafe import Markup
from extensions import db
import models as m


# ---------------------------------------------------------------------------
# Shared column formatters
#
# A lot of the raw text columns in this schema hold codes like "IN_REVIEW",
# "BANK_TRANSFER" or "PAID" — fine for the database, unreadable as a table
# column. These two small formatters are reused across ~20 ModelViews below:
#   - badge(...)  renders a status/priority-style field as a colored pill
#     (e.g. "PAID" -> a green "Paid" pill), so you can scan a list by color
#     instead of reading every row.
#   - label(...)  just turns "BANK_TRANSFER" into "Bank Transfer" for
#     descriptive/category fields that aren't really a status.
# Any raw value not in _BADGE_COLORS still gets humanized text with a
# neutral gray pill, so a value we didn't anticipate never breaks the page.
# ---------------------------------------------------------------------------

_BADGE_COLORS = {
    "ACTIVE": "success", "APPROVED": "success", "ISSUED": "success",
    "PAID": "success", "MET": "success", "COMPLETED": "success",
    "VALID": "success", "AUTHENTICITY": "success",
    "REJECTED": "danger", "REVOKED": "danger", "FAILED": "danger",
    "OVERDUE": "danger", "CANCELLED": "danger", "EXPIRED": "danger",
    "INACTIVE": "danger", "DISSOLVED": "danger", "URGENT": "danger",
    "PENDING": "warning", "IN_REVIEW": "warning", "HIGH": "warning",
    "DUE_SOON": "warning", "DRAFT": "warning",
    "SUBMITTED": "info", "ON_TRACK": "info",
    "NORMAL": "secondary", "LOW": "secondary",
}


def _humanize(raw):
    return str(raw).replace("_", " ").strip().title()


def badge(view, context, model, name):
    value = getattr(model, name)
    if value in (None, ""):
        return ""
    color = _BADGE_COLORS.get(str(value).upper(), "secondary")
    return Markup('<span class="moi-badge moi-badge-{}">{}</span>').format(color, _humanize(value))


def label(view, context, model, name):
    value = getattr(model, name)
    if value in (None, ""):
        return ""
    return _humanize(value)


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
    # Loaded on every list/edit/create screen for every table so the whole
    # app (not just the dashboard and login page) uses the MOI theme.
    extra_css = ["/static/css/moi-theme.css"]


class ReadOnlyView(BaseView):
    """For system-generated logs no role should hand-edit through the UI."""
    edit_permission = None
    can_create = False
    can_edit = False
    can_delete = False


# ---------- Geography & Institutions (view: geography.view / edit: geography.edit) ----------

class GeoView(BaseView):
    view_permission = "geography.view"
    edit_permission = "geography.edit"


class GovernorateView(GeoView):
    column_searchable_list = ["name_ar", "name_en", "code"]
    column_list = ["name_en", "name_ar", "code", "is_active"]


class DistrictView(GeoView):
    column_searchable_list = ["name_ar", "name_en"]
    column_filters = ["governorate", "is_active"]
    column_list = ["name_en", "name_ar", "governorate", "code", "is_active"]
    form_ajax_refs = {"governorate": {"fields": ["name_en", "name_ar"], "page_size": 10}}


class OfficeView(GeoView):
    column_searchable_list = ["name_ar", "name_en", "code"]
    column_filters = ["office_type", "is_active"]
    column_list = ["name_en", "name_ar", "code", "district", "office_type", "is_active"]
    column_formatters = {"office_type": label}
    form_ajax_refs = {"district": {"fields": ["name_en", "name_ar"], "page_size": 10}}


class DepartmentView(GeoView):
    column_searchable_list = ["name_ar", "name_en", "code"]
    column_filters = ["is_active"]
    column_list = ["name_en", "name_ar", "code", "parent", "is_active"]
    form_ajax_refs = {"parent": {"fields": ["name_en", "name_ar"], "page_size": 10}}


class CourtView(GeoView):
    column_searchable_list = ["name_ar", "name_en"]
    column_filters = ["court_type", "is_active"]
    column_list = ["name_en", "name_ar", "court_type", "district", "is_active"]
    column_formatters = {"court_type": label}
    form_ajax_refs = {"district": {"fields": ["name_en", "name_ar"], "page_size": 10}}


class ReligiousAuthorityView(GeoView):
    column_searchable_list = ["name_ar", "name_en"]
    column_filters = ["religion", "sect"]
    column_list = ["name_en", "name_ar", "religion", "sect", "is_active"]


class MukhtarView(GeoView):
    column_searchable_list = ["first_name_ar", "last_name_ar", "first_name_en", "last_name_en"]
    column_filters = ["is_active", "district"]
    column_list = ["first_name_en", "last_name_en", "district", "village_or_neighborhood", "phone", "is_active"]
    form_ajax_refs = {"district": {"fields": ["name_en", "name_ar"], "page_size": 10}}


# ---------- Access Control & Security (view: access_control.view / edit: access_control.edit) ----------

class AccessControlView(BaseView):
    view_permission = "access_control.view"
    edit_permission = "access_control.edit"


class PermissionView(AccessControlView):
    column_searchable_list = ["code", "description"]
    column_filters = ["module"]
    column_list = ["code", "module", "description"]


class RoleView(AccessControlView):
    column_searchable_list = ["name", "description"]
    column_filters = ["is_active", "is_system"]
    column_list = ["name", "description", "is_system", "is_active"]


class RolePermissionView(AccessControlView):
    column_list = ["role", "permission", "granted_at", "granted_by_user"]
    form_ajax_refs = {
        "role": {"fields": ["name"], "page_size": 10},
        "permission": {"fields": ["code"], "page_size": 10},
    }


class UserView(AccessControlView):
    column_searchable_list = ["username", "employee_number", "email", "first_name", "last_name"]
    column_filters = ["is_active_flag", "office", "department"]
    column_list = ["username", "first_name", "last_name", "office", "department", "is_active_flag"]
    form_columns = [
        "employee_number", "username", "email", "first_name", "middle_name", "last_name",
        "office", "department", "supervisor", "job_title", "hire_date", "is_active_flag",
        "must_change_password",
    ]
    form_ajax_refs = {
        "office": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "department": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "supervisor": {"fields": ["username", "first_name", "last_name"], "page_size": 10},
    }

    def on_model_change(self, form, model, is_created):
        # New users get a default password they must be told to change;
        # existing users keep their password (this form never edits it directly).
        if is_created and not model.password_hash:
            model.set_password("ChangeMe!123")
            model.must_change_password = True
        super().on_model_change(form, model, is_created)


class UserRoleView(AccessControlView):
    column_list = ["user", "role", "granted_at", "revoked_at"]
    form_ajax_refs = {
        "user": {"fields": ["username", "first_name", "last_name"], "page_size": 10},
        "role": {"fields": ["name"], "page_size": 10},
    }


# ---------- Security & Sessions (view: security.view, always read-only) ----------
# Split out from Access Control & Security so neither nav dropdown nor the
# dashboard card is overloaded — matches the grouping build_stats() already
# uses in app.py.

class SecurityView(ReadOnlyView):
    view_permission = "security.view"


class SessionLogView(SecurityView):
    column_default_sort = ("login_at", True)
    column_list = ["user", "login_at", "logout_at", "ip_address"]
    form_ajax_refs = {"user": {"fields": ["username", "first_name", "last_name"], "page_size": 10}}


class LoginAttemptView(SecurityView):
    column_searchable_list = ["username_attempted"]
    column_filters = ["was_successful", "failure_reason"]
    column_default_sort = ("attempted_at", True)
    column_list = ["username_attempted", "was_successful", "failure_reason", "ip_address", "attempted_at"]
    column_formatters = {"failure_reason": label}


class TokenDenylistView(SecurityView):
    column_filters = ["revoked_reason"]
    column_default_sort = ("revoked_at", True)
    column_list = ["user", "revoked_reason", "revoked_at", "expires_at"]
    column_formatters = {"revoked_reason": label}


# ---------- Workflow Configuration (view/edit: workflow.view / workflow.edit) ----------

class WorkflowView(BaseView):
    view_permission = "workflow.view"
    edit_permission = "workflow.edit"


class WorkflowStateView(WorkflowView):
    column_searchable_list = ["code", "name_ar", "name_en"]
    column_filters = ["is_initial", "is_final", "is_active"]
    column_default_sort = ("display_order", False)
    column_list = ["code", "name_en", "is_initial", "is_final", "display_order", "is_active"]


class WorkflowTransitionView(WorkflowView):
    column_searchable_list = ["action_code", "label_ar", "label_en"]
    column_filters = ["is_active"]
    column_list = ["action_code", "label_en", "from_state", "to_state", "is_active"]
    form_ajax_refs = {
        "from_state": {"fields": ["name_en", "code"], "page_size": 10},
        "to_state": {"fields": ["name_en", "code"], "page_size": 10},
    }


class WorkflowTransitionPermissionView(WorkflowView):
    column_list = ["transition", "permission"]
    form_ajax_refs = {
        "transition": {"fields": ["action_code", "label_en"], "page_size": 10},
        "permission": {"fields": ["code"], "page_size": 10},
    }


# ---------- Document Configuration (view/edit: documents.view / documents.edit) ----------

class DocumentTypeView(BaseView):
    view_permission = "documents.view"
    edit_permission = "documents.edit"
    column_searchable_list = ["code", "name_ar", "name_en"]
    column_filters = ["category", "is_active"]
    column_list = ["code", "name_en", "name_ar", "category", "default_sla_days", "is_active"]


class DocumentTypeAuthorityView(BaseView):
    view_permission = "documents.view"
    edit_permission = "documents.edit"
    column_filters = ["authority_kind", "is_active"]
    column_list = ["document_type", "authority_kind", "office", "court", "religious_authority", "is_active"]
    column_formatters = {"authority_kind": label}
    form_ajax_refs = {
        "document_type": {"fields": ["name_en", "code"], "page_size": 10},
        "office": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "court": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "religious_authority": {"fields": ["name_en", "name_ar"], "page_size": 10},
    }


# ---------- Citizens & Family (view: citizens.view / edit: citizens.edit) ----------

class CitizenBaseView(BaseView):
    view_permission = "citizens.view"
    edit_permission = "citizens.edit"


class CitizenView(CitizenBaseView):
    column_searchable_list = [
        "civil_registry_number", "first_name_ar", "last_name_ar",
        "first_name_en", "last_name_en", "sijill_reference",
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
    column_filters = ["is_active"]
    column_list = ["family_book_number", "head_of_household", "registration_office", "is_active"]
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


class GuardianshipRecordView(CitizenBaseView):
    column_filters = ["guardianship_type", "status"]
    column_list = ["minor", "guardian", "guardianship_type", "court", "status"]
    column_formatters = {"guardianship_type": label, "status": badge}
    form_ajax_refs = {
        "minor": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "guardian": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "court": {"fields": ["name_en", "name_ar"], "page_size": 10},
    }


class RegistryTransferView(CitizenBaseView):
    column_filters = ["status"]
    column_default_sort = ("requested_at", True)
    column_list = ["citizen", "from_office", "to_office", "status", "transfer_date"]
    column_formatters = {"status": badge}
    form_ajax_refs = {
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "family_record": {"fields": ["family_book_number"], "page_size": 10},
        "from_office": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "to_office": {"fields": ["name_en", "name_ar"], "page_size": 10},
    }


class CivilStatusAmendmentView(CitizenBaseView):
    column_filters = ["status"]
    column_default_sort = ("amendment_date", True)
    column_list = ["citizen", "field_changed", "status", "amendment_date"]
    column_formatters = {"status": badge}
    form_ajax_refs = {
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "court": {"fields": ["name_en", "name_ar"], "page_size": 10},
    }


# ---------- Documents (view/edit: documents.view / documents.edit) ----------

class DocumentView(BaseView):
    view_permission = "documents.view"
    edit_permission = "documents.edit"
    column_searchable_list = ["document_number"]
    column_filters = ["status", "document_type", "is_deleted"]
    column_list = [
        "id", "document_type", "citizen", "document_number",
        "status", "issue_date", "expiry_date",
    ]
    column_formatters = {"status": badge}
    form_ajax_refs = {
        "document_type": {"fields": ["name_en", "code"], "page_size": 10},
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "issuing_office": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "attested_by_mukhtar": {"fields": ["first_name_en", "last_name_en"], "page_size": 10},
    }


# ---------- Certificates (view/edit: certificates.view / certificates.edit) ----------

class CertificateBaseView(BaseView):
    view_permission = "certificates.view"
    edit_permission = "certificates.edit"


class BirthCertificateView(CertificateBaseView):
    column_searchable_list = ["registration_number"]
    column_list = ["document", "registration_number", "birth_place", "father_full_name_snapshot", "mother_full_name_snapshot"]
    form_ajax_refs = {"document": {"fields": ["document_number"], "page_size": 10}}


class MarriageCertificateView(CertificateBaseView):
    column_searchable_list = ["contract_number"]
    column_filters = ["status"]
    column_list = ["document", "contract_number", "husband", "wife", "marriage_date", "status"]
    column_formatters = {"status": badge}
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
    column_list = ["document", "court_decision_number", "husband", "wife", "divorce_date", "divorce_type", "status"]
    column_formatters = {"divorce_type": label, "status": badge}
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "marriage_certificate": {"fields": ["contract_number"], "page_size": 10},
        "husband": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "wife": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "court": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "religious_authority": {"fields": ["name_en", "name_ar"], "page_size": 10},
    }


class DeathCertificateView(CertificateBaseView):
    column_list = ["document", "death_date", "death_place", "death_cause"]
    form_ajax_refs = {"document": {"fields": ["document_number"], "page_size": 10}}


class NationalIdCardView(CertificateBaseView):
    column_searchable_list = ["card_number"]
    column_filters = ["status"]
    column_list = ["document", "card_number", "status"]
    column_formatters = {"status": badge}
    form_ajax_refs = {"document": {"fields": ["document_number"], "page_size": 10}}


class PassportView(CertificateBaseView):
    column_searchable_list = ["passport_number"]
    column_filters = ["status", "passport_type"]
    column_list = ["document", "citizen", "passport_number", "passport_type", "expiry_date", "status"]
    column_formatters = {"passport_type": label, "status": badge}
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "issuing_office": {"fields": ["name_en", "name_ar"], "page_size": 10},
    }


class NaturalizationRecordView(CertificateBaseView):
    column_searchable_list = ["decree_number"]
    column_list = ["document", "decree_number", "naturalization_date", "previous_nationality", "status"]
    column_formatters = {"status": badge}
    form_ajax_refs = {"document": {"fields": ["document_number"], "page_size": 10}}


class NameChangeRecordView(CertificateBaseView):
    column_list = ["document", "old_last_name", "new_last_name", "change_date"]
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "amendment": {"fields": ["field_changed"], "page_size": 10},
    }


# ---------- Validation & Physical Custody (view: audit.view / edit varies) ----------

class DocumentValidationView(BaseView):
    # Any role with audit.view can see validations; editing requires the
    # dedicated documents.validate permission (only Admin & Supervisor).
    view_permission = "audit.view"
    edit_permission = "documents.validate"
    column_filters = ["status", "validation_type"]
    column_default_sort = ("validation_date", True)
    column_list = ["document", "validator", "validation_type", "status", "validation_date"]
    column_formatters = {"validation_type": label, "status": badge}
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "validator": {"fields": ["first_name", "last_name"], "page_size": 10},
    }


class PhysicalDocumentHandlingView(BaseView):
    view_permission = "audit.view"
    edit_permission = "documents.edit"
    column_filters = ["action", "location"]
    column_default_sort = ("performed_at", True)
    column_list = ["document", "action", "performer", "location", "performed_at"]
    column_formatters = {"action": label}
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "performer": {"fields": ["first_name", "last_name"], "page_size": 10},
        "witness": {"fields": ["first_name", "last_name"], "page_size": 10},
    }


# ---------- Service Requests & Payments (view: requests.view / edit: requests.edit) ----------

class RequestBaseView(BaseView):
    view_permission = "requests.view"
    edit_permission = "requests.edit"


class ServiceRequestView(RequestBaseView):
    column_searchable_list = ["request_number", "subject"]
    column_filters = ["workflow_state", "priority"]
    column_default_sort = ("submitted_at", True)
    column_list = [
        "request_number", "citizen", "document_type", "workflow_state",
        "priority", "due_date", "submitted_at",
    ]
    column_formatters = {"priority": badge}
    form_ajax_refs = {
        "citizen": {"fields": ["civil_registry_number", "first_name_en", "last_name_en"], "page_size": 10},
        "document_type": {"fields": ["name_en", "code"], "page_size": 10},
        "office": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "department": {"fields": ["name_en", "name_ar"], "page_size": 10},
        "workflow_state": {"fields": ["name_en", "code"], "page_size": 10},
        "requested_by": {"fields": ["first_name", "last_name"], "page_size": 10},
        "reviewer": {"fields": ["first_name", "last_name"], "page_size": 10},
        "approver": {"fields": ["first_name", "last_name"], "page_size": 10},
        "issued_document": {"fields": ["document_number"], "page_size": 10},
    }


class RequestAssignmentView(RequestBaseView):
    column_filters = ["is_active"]
    column_default_sort = ("assigned_at", True)
    column_list = ["service_request", "assignee", "assigner", "assigned_at", "is_active"]
    form_ajax_refs = {
        "service_request": {"fields": ["request_number"], "page_size": 10},
        "assignee": {"fields": ["first_name", "last_name"], "page_size": 10},
        "assigner": {"fields": ["first_name", "last_name"], "page_size": 10},
    }


class ServiceRequestStatusHistoryView(RequestBaseView, ReadOnlyView):
    column_default_sort = ("changed_at", True)
    column_list = ["service_request", "from_state", "to_state", "changed_by_user", "changed_at"]
    form_ajax_refs = {"service_request": {"fields": ["request_number"], "page_size": 10}}


class SlaRecordView(RequestBaseView, ReadOnlyView):
    column_filters = ["sla_status"]
    column_default_sort = ("due_date", False)
    column_list = ["service_request", "due_date", "sla_status", "days_remaining", "overdue_by_days"]
    column_formatters = {"sla_status": badge}
    form_ajax_refs = {"service_request": {"fields": ["request_number"], "page_size": 10}}


class PaymentView(RequestBaseView):
    column_searchable_list = ["receipt_number"]
    column_filters = ["status", "method"]
    column_default_sort = ("paid_at", True)
    column_list = ["service_request", "receipt_number", "amount", "currency", "method", "status", "paid_at"]
    column_formatters = {"method": label, "status": badge}
    form_ajax_refs = {
        "service_request": {"fields": ["request_number"], "page_size": 10},
        "collector": {"fields": ["first_name", "last_name"], "page_size": 10},
    }


class InternalNotificationView(RequestBaseView, ReadOnlyView):
    column_filters = ["notification_type", "is_read"]
    column_default_sort = ("created_at", True)
    column_list = ["recipient", "notification_type", "message", "is_read", "created_at"]
    column_formatters = {"notification_type": label}
    form_ajax_refs = {"recipient": {"fields": ["first_name", "last_name"], "page_size": 10}}


# ---------- Audit & Access Logs (view: audit.view, always read-only) ----------

class AuditLogView(ReadOnlyView):
    view_permission = "audit.view"
    column_filters = ["action", "entity_type", "was_successful"]
    column_default_sort = ("occurred_at", True)
    column_list = ["actor", "action", "entity_type", "entity_id", "was_successful", "occurred_at"]
    column_formatters = {"action": label}


class CitizenAuditLogView(ReadOnlyView):
    view_permission = "audit.view"
    column_filters = ["field_name"]
    column_default_sort = ("changed_at", True)
    column_list = ["citizen", "field_name", "changed_by_user", "changed_at"]


class RecordAccessLogView(ReadOnlyView):
    view_permission = "audit.view"
    column_filters = ["access_type"]
    column_default_sort = ("accessed_at", True)
    column_list = ["citizen", "accessed_by_user", "access_type", "reason", "accessed_at"]
    column_formatters = {"access_type": label}


def register_all_views(admin):
    GEO = "Geography & Institutions"
    ACL = "Access Control & Security"
    SEC = "Security & Sessions"
    WF = "Workflow Configuration"
    DOCCFG = "Document Configuration"
    FAM = "Citizens & Family"
    DOC = "Documents"
    CERT = "Certificates"
    REQ = "Service Requests & Payments"
    AUDIT = "Audit & Access Logs"

    # ---- Nav grouping -----------------------------------------------
    # The 10 categories above used to all sit flat in the top nav bar
    # (11 items counting Dashboard), which wrapped onto 3 lines on
    # normal screens. Flask-Admin natively supports a second menu
    # level (Admin.add_category + Admin.add_sub_category render real
    # Bootstrap dropdown-submenus, already styled by Flask-Admin's own
    # bundled CSS) so we fold the 10 into 3 parent groups plus one
    # category that stays top-level because it's already a single,
    # self-contained workflow area. Every admin.add_view(...) call
    # below is unchanged — it still passes category=GEO / ACL / etc,
    # and Flask-Admin nests it under the right parent automatically
    # because that name was pre-registered as a sub-category here.
    REF_DATA = "Reference Data"
    ACCESS_SEC = "Access & Security"
    REGISTRY = "Civil Registry"

    admin.add_category(REF_DATA)
    admin.add_category(ACCESS_SEC)
    admin.add_category(REGISTRY)
    # REQ ("Service Requests & Payments") intentionally stays flat/top-level.

    admin.add_sub_category(GEO, REF_DATA)
    admin.add_sub_category(DOCCFG, REF_DATA)
    admin.add_sub_category(WF, REF_DATA)

    admin.add_sub_category(ACL, ACCESS_SEC)
    admin.add_sub_category(SEC, ACCESS_SEC)
    admin.add_sub_category(AUDIT, ACCESS_SEC)

    admin.add_sub_category(FAM, REGISTRY)
    admin.add_sub_category(DOC, REGISTRY)
    admin.add_sub_category(CERT, REGISTRY)

    admin.add_view(GovernorateView(m.Governorate, db.session, name="Governorates", category=GEO))
    admin.add_view(DistrictView(m.District, db.session, name="Districts", category=GEO))
    admin.add_view(OfficeView(m.Office, db.session, name="Offices", category=GEO))
    admin.add_view(DepartmentView(m.Department, db.session, name="Departments", category=GEO))
    admin.add_view(CourtView(m.Court, db.session, name="Courts", category=GEO))
    admin.add_view(ReligiousAuthorityView(m.ReligiousAuthority, db.session, name="Religious Authorities", category=GEO))
    admin.add_view(MukhtarView(m.Mukhtar, db.session, name="Mukhtars", category=GEO))

    admin.add_view(PermissionView(m.Permission, db.session, name="Permissions", category=ACL))
    admin.add_view(RoleView(m.Role, db.session, name="Roles", category=ACL))
    admin.add_view(RolePermissionView(m.RolePermission, db.session, name="Role ↔ Permissions", category=ACL))
    admin.add_view(UserView(m.User, db.session, name="Users", category=ACL))
    admin.add_view(UserRoleView(m.UserRole, db.session, name="User ↔ Roles", category=ACL))

    admin.add_view(SessionLogView(m.SessionLog, db.session, name="Session Logs", category=SEC))
    admin.add_view(LoginAttemptView(m.LoginAttempt, db.session, name="Login Attempts", category=SEC))
    admin.add_view(TokenDenylistView(m.TokenDenylist, db.session, name="Token Denylist", category=SEC))

    admin.add_view(WorkflowStateView(m.WorkflowState, db.session, name="Workflow States", category=WF))
    admin.add_view(WorkflowTransitionView(m.WorkflowTransition, db.session, name="Workflow Transitions", category=WF))
    admin.add_view(WorkflowTransitionPermissionView(m.WorkflowTransitionPermission, db.session, name="Transition Permissions", category=WF))

    admin.add_view(DocumentTypeView(m.DocumentType, db.session, name="Document Types", category=DOCCFG))
    admin.add_view(DocumentTypeAuthorityView(m.DocumentTypeAuthority, db.session, name="Document Type Authorities", category=DOCCFG))

    admin.add_view(CitizenView(m.Citizen, db.session, name="Citizens", category=FAM))
    admin.add_view(FamilyRecordView(m.FamilyRecord, db.session, name="Family Records", category=FAM))
    admin.add_view(FamilyMemberView(m.FamilyMember, db.session, name="Family Members", category=FAM))
    admin.add_view(GuardianshipRecordView(m.GuardianshipRecord, db.session, name="Guardianship Records", category=FAM))
    admin.add_view(RegistryTransferView(m.RegistryTransfer, db.session, name="Registry Transfers", category=FAM))
    admin.add_view(CivilStatusAmendmentView(m.CivilStatusAmendment, db.session, name="Civil Status Amendments", category=FAM))

    admin.add_view(DocumentView(m.Document, db.session, name="Documents", category=DOC))
    admin.add_view(DocumentValidationView(m.DocumentValidation, db.session, name="Document Validations", category=DOC))
    admin.add_view(PhysicalDocumentHandlingView(m.PhysicalDocumentHandling, db.session, name="Physical Handling", category=DOC))

    admin.add_view(BirthCertificateView(m.BirthCertificate, db.session, name="Birth Certificates", category=CERT))
    admin.add_view(MarriageCertificateView(m.MarriageCertificate, db.session, name="Marriage Certificates", category=CERT))
    admin.add_view(DivorceCertificateView(m.DivorceCertificate, db.session, name="Divorce Certificates", category=CERT))
    admin.add_view(DeathCertificateView(m.DeathCertificate, db.session, name="Death Certificates", category=CERT))
    admin.add_view(NationalIdCardView(m.NationalIdCard, db.session, name="National ID Cards", category=CERT))
    admin.add_view(PassportView(m.Passport, db.session, name="Passports", category=CERT))
    admin.add_view(NaturalizationRecordView(m.NaturalizationRecord, db.session, name="Naturalization Records", category=CERT))
    admin.add_view(NameChangeRecordView(m.NameChangeRecord, db.session, name="Name Change Records", category=CERT))

    admin.add_view(ServiceRequestView(m.ServiceRequest, db.session, name="Service Requests", category=REQ))
    admin.add_view(RequestAssignmentView(m.RequestAssignment, db.session, name="Request Assignments", category=REQ))
    admin.add_view(ServiceRequestStatusHistoryView(m.ServiceRequestStatusHistory, db.session, name="Status History", category=REQ))
    admin.add_view(SlaRecordView(m.SlaRecord, db.session, name="SLA Records", category=REQ))
    admin.add_view(PaymentView(m.Payment, db.session, name="Payments", category=REQ))
    admin.add_view(InternalNotificationView(m.InternalNotification, db.session, name="Notifications", category=REQ))

    admin.add_view(AuditLogView(m.AuditLog, db.session, name="Audit Logs", category=AUDIT))
    admin.add_view(CitizenAuditLogView(m.CitizenAuditLog, db.session, name="Citizen Audit Log", category=AUDIT))
    admin.add_view(RecordAccessLogView(m.RecordAccessLog, db.session, name="Record Access Log", category=AUDIT))


class DashboardIndexView(AdminIndexView):
    """Dashboard itself requires login; permission-based content filtering
    happens in app.py's build_stats()."""

    extra_css = ["/static/css/moi-theme.css"]

    def is_accessible(self):
        return current_user.is_authenticated

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for("login_page", next=request.url))