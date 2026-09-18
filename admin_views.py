from datetime import datetime

from flask import redirect, url_for, request, flash
from sqlalchemy import func
from flask_login import current_user
from flask_admin.contrib.sqla import ModelView
from flask_admin import AdminIndexView, expose
from markupsafe import Markup
from extensions import db
import models as m
from i18n import L, t as _t, get_lang, COLUMNS, column_header


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


# A permission code that no role can ever hold, used where an action must be
# closed off outright rather than left to be derived. Nothing issues it, so
# has_permission() always answers False for it.
NEVER = "__never__"


class PermissionMixin:
    """
    Ties a Flask-Admin view's visibility and its create/edit/delete actions to
    the current user's permission codes (looked up through Roles ->
    RolePermission -> Permission, based on the tables already in the schema).

    Subclasses set:
      - view_permission:   code required to see/browse this table
      - edit_permission:   code required to modify an existing row
      - create_permission: code required to add a row.   Left unset, it is
                           derived from edit_permission as <module>.create
      - delete_permission: code required to remove a row. Left unset, it is
                           derived from edit_permission as <module>.delete
                           Set to NEVER to close the action off entirely.

    Creating, amending and destroying a civil record are three different
    authorities in a registry, and a clerk who may open a file is not
    thereby entitled to erase one. Deriving the two extra codes rather than
    requiring every view to spell them out keeps that true by default: a view
    that says `edit_permission = "citizens.edit"` now demands citizens.create
    to add and citizens.delete to remove, without further ceremony.
    """
    view_permission = None
    edit_permission = None
    create_permission = None
    delete_permission = None

    def is_accessible(self):
        if not current_user.is_authenticated:
            return False
        return current_user.has_permission(self.view_permission)

    def inaccessible_callback(self, name, **kwargs):
        flash("You don't have permission to access that.", "error")
        if current_user.is_authenticated:
            return redirect(url_for("admin.index"))
        return redirect(url_for("login_page", next=request.url))

    def _derived(self, action):
        """<module>.<action> taken from this view's edit permission."""
        if not self.edit_permission or "." not in self.edit_permission:
            return None
        return f"{self.edit_permission.rsplit('.', 1)[0]}.{action}"

    def _allows(self, code):
        # has_permission(None) answers True by design (an unguarded view is
        # open to any signed-in user), so an absent code must be refused here
        # rather than handed on.
        if not code:
            return False
        return current_user.is_authenticated and current_user.has_permission(code)

    @property
    def can_create(self):
        return self._allows(self.create_permission or self._derived("create"))

    @property
    def can_edit(self):
        return self._allows(self.edit_permission)

    @property
    def can_delete(self):
        return self._allows(self.delete_permission or self._derived("delete"))


class BaseView(PermissionMixin, ModelView):
    def get_column_name(self, field):
        """Localized table headers, for every view, from one table.

        Flask-Admin's own version checks this view's `column_labels` and
        otherwise prettifies the field name, which leaves headers in English
        whatever language the interface is in. This keeps that order with the
        shared i18n.COLUMNS table slotted in between: a view's own
        column_labels still wins where one is set, and an unmapped field
        still falls back to the prettifier rather than raising.

        It returns a lazy Col rather than a finished string because this runs
        once per view at import time — before any request exists — and the
        result is cached for the life of the process. Col carries the English
        text as its actual value and resolves the language when Jinja renders
        it, so one cached header serves both languages.
        """
        if self.column_labels and field in self.column_labels:
            return self.column_labels[field]
        entry = COLUMNS.get(str(field))
        fallback = entry[0] if entry else self._prettify_name(field)
        return column_header(field, fallback)

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
    # Any role with audit.view can see validations; recording or amending one
    # requires the dedicated documents.validate permission. A validation is
    # never deleted through the UI — withdrawing an approval means recording
    # a new validation, not erasing the old one.
    view_permission = "audit.view"
    edit_permission = "documents.validate"
    create_permission = "documents.validate"
    delete_permission = NEVER
    column_filters = ["status", "validation_type"]
    column_default_sort = ("validation_date", True)
    column_list = ["document", "validator", "validation_type", "status", "validation_date"]
    column_formatters = {"validation_type": label, "status": badge}
    form_ajax_refs = {
        "document": {"fields": ["document_number"], "page_size": 10},
        "validator": {"fields": ["first_name", "last_name"], "page_size": 10},
    }


class PhysicalDocumentHandlingView(BaseView):
    # A custody trail is append-only: entries are added as the file moves and
    # corrected if mis-keyed, but removing one would break the chain it exists
    # to prove.
    view_permission = "audit.view"
    edit_permission = "documents.edit"
    create_permission = "documents.create"
    delete_permission = NEVER
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
    GEO = L("Geography & Institutions")
    ACL = L("Access Control & Security")
    SEC = L("Security & Sessions")
    WF = L("Workflow Configuration")
    DOCCFG = L("Document Configuration")
    FAM = L("Citizens & Family")
    DOC = L("Documents")
    CERT = L("Certificates")
    REQ = L("Service Requests & Payments")
    AUDIT = L("Audit & Access Logs")

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
    REF_DATA = L("Reference Data")
    ACCESS_SEC = L("Access & Security")
    REGISTRY = L("Civil Registry")

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

    admin.add_view(GovernorateView(m.Governorate, db.session, name=L("Governorates"), category=GEO))
    admin.add_view(DistrictView(m.District, db.session, name=L("Districts"), category=GEO))
    admin.add_view(OfficeView(m.Office, db.session, name=L("Offices"), category=GEO))
    admin.add_view(DepartmentView(m.Department, db.session, name=L("Departments"), category=GEO))
    admin.add_view(CourtView(m.Court, db.session, name=L("Courts"), category=GEO))
    admin.add_view(ReligiousAuthorityView(m.ReligiousAuthority, db.session, name=L("Religious Authorities"), category=GEO))
    admin.add_view(MukhtarView(m.Mukhtar, db.session, name=L("Mukhtars"), category=GEO))

    admin.add_view(PermissionView(m.Permission, db.session, name=L("Permissions"), category=ACL))
    admin.add_view(RoleView(m.Role, db.session, name=L("Roles"), category=ACL))
    admin.add_view(RolePermissionView(m.RolePermission, db.session, name=L("Role ↔ Permissions"), category=ACL))
    admin.add_view(UserView(m.User, db.session, name=L("Users"), category=ACL))
    admin.add_view(UserRoleView(m.UserRole, db.session, name=L("User ↔ Roles"), category=ACL))

    admin.add_view(SessionLogView(m.SessionLog, db.session, name=L("Session Logs"), category=SEC))
    admin.add_view(LoginAttemptView(m.LoginAttempt, db.session, name=L("Login Attempts"), category=SEC))
    admin.add_view(TokenDenylistView(m.TokenDenylist, db.session, name=L("Token Denylist"), category=SEC))

    admin.add_view(WorkflowStateView(m.WorkflowState, db.session, name=L("Workflow States"), category=WF))
    admin.add_view(WorkflowTransitionView(m.WorkflowTransition, db.session, name=L("Workflow Transitions"), category=WF))
    admin.add_view(WorkflowTransitionPermissionView(m.WorkflowTransitionPermission, db.session, name=L("Transition Permissions"), category=WF))

    admin.add_view(DocumentTypeView(m.DocumentType, db.session, name=L("Document Types"), category=DOCCFG))
    admin.add_view(DocumentTypeAuthorityView(m.DocumentTypeAuthority, db.session, name=L("Document Type Authorities"), category=DOCCFG))

    admin.add_view(CitizenView(m.Citizen, db.session, name=L("Citizens"), category=FAM))
    admin.add_view(FamilyRecordView(m.FamilyRecord, db.session, name=L("Family Records"), category=FAM))
    admin.add_view(FamilyMemberView(m.FamilyMember, db.session, name=L("Family Members"), category=FAM))
    admin.add_view(GuardianshipRecordView(m.GuardianshipRecord, db.session, name=L("Guardianship Records"), category=FAM))
    admin.add_view(RegistryTransferView(m.RegistryTransfer, db.session, name=L("Registry Transfers"), category=FAM))
    admin.add_view(CivilStatusAmendmentView(m.CivilStatusAmendment, db.session, name=L("Civil Status Amendments"), category=FAM))

    admin.add_view(DocumentView(m.Document, db.session, name=L("Documents"), category=DOC))
    admin.add_view(DocumentValidationView(m.DocumentValidation, db.session, name=L("Document Validations"), category=DOC))
    admin.add_view(PhysicalDocumentHandlingView(m.PhysicalDocumentHandling, db.session, name=L("Physical Handling"), category=DOC))

    admin.add_view(BirthCertificateView(m.BirthCertificate, db.session, name=L("Birth Certificates"), category=CERT))
    admin.add_view(MarriageCertificateView(m.MarriageCertificate, db.session, name=L("Marriage Certificates"), category=CERT))
    admin.add_view(DivorceCertificateView(m.DivorceCertificate, db.session, name=L("Divorce Certificates"), category=CERT))
    admin.add_view(DeathCertificateView(m.DeathCertificate, db.session, name=L("Death Certificates"), category=CERT))
    admin.add_view(NationalIdCardView(m.NationalIdCard, db.session, name=L("National ID Cards"), category=CERT))
    admin.add_view(PassportView(m.Passport, db.session, name=L("Passports"), category=CERT))
    admin.add_view(NaturalizationRecordView(m.NaturalizationRecord, db.session, name=L("Naturalization Records"), category=CERT))
    admin.add_view(NameChangeRecordView(m.NameChangeRecord, db.session, name=L("Name Change Records"), category=CERT))

    admin.add_view(ServiceRequestView(m.ServiceRequest, db.session, name=L("Service Requests"), category=REQ))
    admin.add_view(RequestAssignmentView(m.RequestAssignment, db.session, name=L("Request Assignments"), category=REQ))
    admin.add_view(ServiceRequestStatusHistoryView(m.ServiceRequestStatusHistory, db.session, name=L("Status History"), category=REQ))
    admin.add_view(SlaRecordView(m.SlaRecord, db.session, name=L("SLA Records"), category=REQ))
    admin.add_view(PaymentView(m.Payment, db.session, name=L("Payments"), category=REQ))
    admin.add_view(InternalNotificationView(m.InternalNotification, db.session, name=L("Notifications"), category=REQ))

    admin.add_view(AuditLogView(m.AuditLog, db.session, name=L("Audit Logs"), category=AUDIT))
    admin.add_view(CitizenAuditLogView(m.CitizenAuditLog, db.session, name=L("Citizen Audit Log"), category=AUDIT))
    admin.add_view(RecordAccessLogView(m.RecordAccessLog, db.session, name=L("Record Access Log"), category=AUDIT))


# ---------------------------------------------------------------------------
# Dashboard
#
# What this builds, and why it is shaped this way:
#
# The dashboard answers the three questions a Directorate employee opens the
# system to ask — "how much work is open?", "what is late?", and "where is it
# stuck?" — and nothing else. It deliberately does NOT list every table in the
# schema with a row count; that is a database browser, and the navbar menu
# already does it better.
#
# The panels map 1:1 onto the wireframe in CTS_Design_Artifacts.pdf §5.2 and
# the dashboard endpoints specified in the 20-day plan (Day 11): KPI summary,
# SLA alerts, and workflow distribution.
#
# Scope: an Administrator or Auditor sees the whole Directorate. Everyone else
# sees their own office only. Office rather than personal assignment, because
# request_assignments covers only a fraction of requests — a clerk scoped to
# her own assignments would open the system to an empty screen, which is worse
# than slightly-too-wide a view. Section 6.9 of the SDD is where a per-user
# queue would belong once assignment coverage is enforced.
# ---------------------------------------------------------------------------

# Only the colours live here now; the status names come from i18n.TEXT so the
# whole system has one translation table. A status the seed data invents and
# this map does not know still renders, in grey, with its raw code.
_SLA_COLORS = {
    "ON_TRACK": "#1E7A4C",
    "DUE_SOON": "#C9A227",
    "OVERDUE": "#A13A2F",
    "MET": "#174A7E",
    "BREACHED": "#7B241C",
}


def _dashboard_scope():
    """Return (scope_code, office) for the signed-in user.

    access_control.view is held only by Administrator and Auditor in the
    seeded role set, which makes it a reasonable proxy for "may see the whole
    Directorate" without inventing a new permission code.
    """
    if current_user.has_permission("access_control.view"):
        return "ALL", None
    return "OFFICE", current_user.office


def _scoped_requests(scope, office):
    """Base ServiceRequest query, narrowed to the user's scope."""
    q = db.session.query(m.ServiceRequest)
    if scope == "OFFICE" and office is not None:
        q = q.filter(m.ServiceRequest.office_id == office.id)
    return q


def build_dashboard():
    """Everything admin/index.html renders, computed in one place.

    Returns a dict rather than a dozen template variables so the template
    stays declarative and this function stays the single thing to read when a
    figure on screen looks wrong.
    """
    scope, office = _dashboard_scope()

    # A user without requests.view gets the identity header and nothing else,
    # rather than an error or a page of zeros they cannot explain.
    if not current_user.has_permission("requests.view"):
        return {"scope": scope, "office": office, "permitted": False}

    base = _scoped_requests(scope, office)

    # -- Workflow distribution ------------------------------------------------
    # Counts per state, left-joined from workflow_states so a state with no
    # requests still appears (an empty column is information: nothing is
    # sitting in REJECTED is a good thing to be able to see).
    state_counts = dict(
        base.with_entities(m.ServiceRequest.workflow_state_id, func.count(m.ServiceRequest.id))
            .group_by(m.ServiceRequest.workflow_state_id).all()
    )
    states = (db.session.query(m.WorkflowState)
              .filter(m.WorkflowState.is_active.is_(True))
              .order_by(m.WorkflowState.display_order).all())
    wf_total = sum(state_counts.values()) or 0
    # workflow_states carries both names in the database, so the chart labels
    # follow the interface language straight from the data.
    arabic = get_lang() == "ar"
    workflow_rows = [{
        "code": s.code,
        "name": (s.name_ar or s.name_en) if arabic else s.name_en,
        "color": s.color_hex or "#667085",
        "count": state_counts.get(s.id, 0),
        "pct": round(state_counts.get(s.id, 0) * 100.0 / wf_total) if wf_total else 0,
        "is_final": bool(s.is_final),
    } for s in states]

    open_count = sum(r["count"] for r in workflow_rows if not r["is_final"])
    closed_count = sum(r["count"] for r in workflow_rows if r["is_final"])

    # -- SLA ------------------------------------------------------------------
    # sla_records is 1:1 with service_requests, so the join is safe to count
    # against directly.
    sla_q = (db.session.query(m.SlaRecord.sla_status, func.count(m.SlaRecord.id))
             .join(m.ServiceRequest, m.SlaRecord.service_request_id == m.ServiceRequest.id))
    if scope == "OFFICE" and office is not None:
        sla_q = sla_q.filter(m.ServiceRequest.office_id == office.id)
    sla_counts = dict(sla_q.group_by(m.SlaRecord.sla_status).all())
    sla_total = sum(sla_counts.values()) or 0
    sla_rows = []
    for code, count in sorted(sla_counts.items(), key=lambda kv: -kv[1]):
        label = _t("sla_" + code)
        if label == "sla_" + code:          # unmapped status: show it raw
            label = code.replace("_", " ").title()
        sla_rows.append({
            "code": code,
            "label": label,
            "color": _SLA_COLORS.get(code, "#667085"),
            "count": count,
            "pct": round(count * 100.0 / sla_total) if sla_total else 0,
        })

    overdue = sla_counts.get("OVERDUE", 0)
    due_soon = sla_counts.get("DUE_SOON", 0)

    # Worst current breach, so the Overdue card says how bad rather than only
    # how many — "3 overdue" and "3 overdue, worst 41 days" are different
    # operational situations.
    worst_q = (db.session.query(func.max(m.SlaRecord.overdue_by_days))
               .join(m.ServiceRequest, m.SlaRecord.service_request_id == m.ServiceRequest.id)
               .filter(m.SlaRecord.sla_status == "OVERDUE"))
    if scope == "OFFICE" and office is not None:
        worst_q = worst_q.filter(m.ServiceRequest.office_id == office.id)
    worst_overdue = worst_q.scalar() or 0

    # Nearest upcoming due date among requests still open.
    next_due_q = (db.session.query(func.min(m.SlaRecord.due_date))
                  .join(m.ServiceRequest, m.SlaRecord.service_request_id == m.ServiceRequest.id)
                  .filter(m.SlaRecord.sla_status == "DUE_SOON"))
    if scope == "OFFICE" and office is not None:
        next_due_q = next_due_q.filter(m.ServiceRequest.office_id == office.id)
    next_due = next_due_q.scalar()

    # -- Average resolution time ---------------------------------------------
    # Computed in Python over completed requests: SQLite and MySQL disagree on
    # date arithmetic, and the row count here is small enough that pulling the
    # two timestamps back is cheaper than maintaining two dialects of SQL.
    completed = base.with_entities(
        m.ServiceRequest.submitted_at,
        m.ServiceRequest.approved_at,
        m.ServiceRequest.rejected_at,
    ).all()
    spans = []
    for submitted_at, approved_at, rejected_at in completed:
        finished = approved_at or rejected_at
        if submitted_at and finished and finished >= submitted_at:
            spans.append((finished - submitted_at).total_seconds())
    # Same-day turnaround is normal for a counter service, and "0.0 days" reads
    # like a broken figure rather than a fast one — so anything under a day is
    # reported in hours.
    if spans:
        avg_seconds = sum(spans) / len(spans)
        if avg_seconds < 86400:
            avg_value = round(avg_seconds / 3600, 1)
            avg_unit = _t("unit_hours")
        else:
            avg_value = round(avg_seconds / 86400, 1)
            avg_unit = _t("unit_days")
    else:
        avg_value, avg_unit = None, _t("unit_days")

    total_requests = base.count()

    # -- KPI cards ------------------------------------------------------------
    kpis = [
        {
            "key": "open", "tone": "royal",
            "label": _t("kpi_open"),
            "value": open_count,
            "sub": _t("of_total", n=total_requests),
        },
        {
            # The pill is a status, not a repeat of the figure beside it: the
            # number says how many, the pill says whether it needs action
            # today. It is omitted when the count is zero, so a clean card
            # carries no decoration at all.
            "key": "overdue", "tone": "danger",
            "label": _t("kpi_overdue"),
            "value": overdue,
            "pill": _t("pill_action_required") if overdue else None,
            "sub": _t("worst_late", n=worst_overdue) if overdue else _t("nothing_late"),
        },
        {
            "key": "due_soon", "tone": "gold",
            "label": _t("kpi_due_soon"),
            "value": due_soon,
            "pill": _t("pill_this_week") if due_soon else None,
            "sub": _t("next_due", d=next_due.strftime("%d/%m/%Y")) if next_due else _t("none_approaching"),
        },
        {
            "key": "avg", "tone": "green",
            "label": _t("kpi_avg"),
            "value": ("%s" % avg_value) if avg_value is not None else "\u2014",
            "unit": avg_unit,
            "sub": _t("across_completed", n=closed_count),
        },
    ]

    return {
        "permitted": True,
        "scope": scope,
        "office": office,
        "kpis": kpis,
        "sla_rows": sla_rows,
        "sla_total": sla_total,
        "workflow_rows": workflow_rows,
        "workflow_total": wf_total,
        "workflow_max": max([r["count"] for r in workflow_rows], default=0),
        "today": datetime.now(),
    }


class DashboardIndexView(AdminIndexView):
    """The dashboard. Requires login; the figures it shows are scoped to the
    signed-in user by build_dashboard() above."""

    extra_css = ["/static/css/moi-theme.css"]

    def is_accessible(self):
        return current_user.is_authenticated

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for("login_page", next=request.url))

    @expose("/")
    def index(self):
        """Override AdminIndexView.index() so the template receives its data.
        Flask-Admin's _handle_view has already run is_accessible() by the time
        this is called, so an anonymous visitor never reaches it."""
        return self.render("admin/index.html", dash=build_dashboard())
