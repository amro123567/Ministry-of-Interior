"""
SQLAlchemy models for the Correspondence Tracking System (CTS) — Directorate
of Civil Status, Lebanese Ministry of Interior and Municipalities.

Mirrors docs/database/CTS-Database-Design.eraser (45 tables) exactly:
table names, columns, primary/foreign keys, and uniqueness constraints match
that file 1:1. One addition not in the committed ERD: `passports`, restored
to keep the 8-certificate-type scope from the original design (see the note
in the migration hand-off message — flag this with whoever reviews the SDD).

Conventions:
  - Every table uses a `bigint` autoincrement surrogate primary key (`id`),
    except `citizens` (natural key: civil_registry_number) and the pure
    association tables (composite primary keys on their two FK columns).
  - ERD enum types (enum_*) are implemented as plain VARCHAR columns, not
    native MySQL ENUM — this keeps the app portable across SQLite (local
    dev) and MySQL (production), matching the existing dual-engine setup in
    app.py. Allowed values are documented in a comment above each column.
  - Money columns use Numeric(12, 2); the ERD doesn't specify precision.
"""
import uuid
from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db


def gen_uuid():
    return str(uuid.uuid4())


# BIGINT everywhere, except on SQLite where a single-column integer PRIMARY
# KEY has to be exactly the SQLite "INTEGER" affinity to alias the rowid and
# get autoincrement — BigInteger there maps to a plain BIGINT column and
# silently loses autoincrement, which is precisely what broke the first
# smoke test. `with_variant` keeps MySQL on real BIGINT and fixes SQLite.
BIGINT = db.BigInteger().with_variant(db.Integer, "sqlite")


# =====================================================================
# SECTION A — GEOGRAPHY & INSTITUTIONS
# =====================================================================

class Governorate(db.Model):
    __tablename__ = "governorates"
    id = db.Column(BIGINT, primary_key=True)
    name_ar = db.Column(db.String(100), nullable=False)
    name_en = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(10), unique=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return self.name_en or self.name_ar or f"Governorate #{self.id}"


class District(db.Model):
    __tablename__ = "districts"
    id = db.Column(BIGINT, primary_key=True)
    governorate_id = db.Column(BIGINT, db.ForeignKey("governorates.id"))
    name_ar = db.Column(db.String(100), nullable=False)
    name_en = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(10))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("governorate_id", "code"),)

    governorate = db.relationship("Governorate", foreign_keys=[governorate_id])

    def __repr__(self):
        return self.name_en or self.name_ar or f"District #{self.id}"


class Office(db.Model):
    __tablename__ = "offices"
    id = db.Column(BIGINT, primary_key=True)
    district_id = db.Column(BIGINT, db.ForeignKey("districts.id"))
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150), nullable=False)
    code = db.Column(db.String(20), unique=True)
    # enum_office_type: CENTRAL, REGIONAL, DISTRICT, MOBILE
    office_type = db.Column(db.String(20))
    address = db.Column(db.String(255))
    phone = db.Column(db.String(30))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    district = db.relationship("District", foreign_keys=[district_id])

    def __repr__(self):
        return self.name_en or self.name_ar or f"Office #{self.id}"


class Department(db.Model):
    __tablename__ = "departments"
    id = db.Column(BIGINT, primary_key=True)
    parent_id = db.Column(BIGINT, db.ForeignKey("departments.id"))
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150), nullable=False)
    code = db.Column(db.String(20), unique=True)
    description = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parent = db.relationship("Department", remote_side=[id], foreign_keys=[parent_id])

    def __repr__(self):
        return self.name_en or self.name_ar or f"Department #{self.id}"


class Court(db.Model):
    __tablename__ = "courts"
    id = db.Column(BIGINT, primary_key=True)
    district_id = db.Column(BIGINT, db.ForeignKey("districts.id"))
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150), nullable=False)
    # enum_court_type: CIVIL, SHARIA, JAAFARI, DRUZE, ECCLESIASTICAL
    court_type = db.Column(db.String(20))
    jurisdiction = db.Column(db.String(150))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    district = db.relationship("District", foreign_keys=[district_id])

    def __repr__(self):
        return self.name_en or self.name_ar or f"Court #{self.id}"


class ReligiousAuthority(db.Model):
    __tablename__ = "religious_authorities"
    id = db.Column(BIGINT, primary_key=True)
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150), nullable=False)
    religion = db.Column(db.String(50))
    sect = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return self.name_en or self.name_ar or f"Religious Authority #{self.id}"


class Mukhtar(db.Model):
    __tablename__ = "mukhtars"
    id = db.Column(BIGINT, primary_key=True)
    district_id = db.Column(BIGINT, db.ForeignKey("districts.id"))
    first_name_ar = db.Column(db.String(80))
    last_name_ar = db.Column(db.String(80))
    first_name_en = db.Column(db.String(80))
    last_name_en = db.Column(db.String(80))
    village_or_neighborhood = db.Column(db.String(150))
    phone = db.Column(db.String(30))
    email = db.Column(db.String(120))
    term_start = db.Column(db.Date)
    term_end = db.Column(db.Date)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    district = db.relationship("District", foreign_keys=[district_id])

    def __repr__(self):
        name = f"{self.first_name_en or self.first_name_ar or ''} {self.last_name_en or self.last_name_ar or ''}".strip()
        return name or f"Mukhtar #{self.id}"


# =====================================================================
# SECTION B — IDENTITY AND ACCESS CONTROL
# =====================================================================

class Permission(db.Model):
    __tablename__ = "permissions"
    id = db.Column(BIGINT, primary_key=True)
    code = db.Column(db.String(60), unique=True, nullable=False)
    description = db.Column(db.String(255))
    module = db.Column(db.String(40))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return self.code


class Role(db.Model):
    __tablename__ = "roles"
    id = db.Column(BIGINT, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(255))
    is_system = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return self.name


class RolePermission(db.Model):
    __tablename__ = "role_permissions"
    role_id = db.Column(BIGINT, db.ForeignKey("roles.id"), primary_key=True)
    permission_id = db.Column(BIGINT, db.ForeignKey("permissions.id"), primary_key=True)
    granted_at = db.Column(db.DateTime, default=datetime.utcnow)
    granted_by = db.Column(BIGINT, db.ForeignKey("users.id"))

    role = db.relationship("Role", foreign_keys=[role_id])
    permission = db.relationship("Permission", foreign_keys=[permission_id])
    granted_by_user = db.relationship("User", foreign_keys=[granted_by])

    def __repr__(self):
        return f"{self.role_id} -> {self.permission_id}"


class User(UserMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(BIGINT, primary_key=True)
    employee_number = db.Column(db.String(30), unique=True)
    username = db.Column(db.String(60), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True)
    first_name = db.Column(db.String(80), nullable=False)
    middle_name = db.Column(db.String(80))
    last_name = db.Column(db.String(80), nullable=False)
    office_id = db.Column(BIGINT, db.ForeignKey("offices.id"))
    department_id = db.Column(BIGINT, db.ForeignKey("departments.id"))
    supervisor_id = db.Column(BIGINT, db.ForeignKey("users.id"))
    job_title = db.Column(db.String(120))
    hire_date = db.Column(db.Date)
    password_hash = db.Column(db.String(255), nullable=False)
    password_changed_at = db.Column(db.DateTime)
    must_change_password = db.Column(db.Boolean, default=False)
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime)
    last_login_at = db.Column(db.DateTime)
    is_active_flag = db.Column("is_active", db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    office = db.relationship("Office", foreign_keys=[office_id])
    department = db.relationship("Department", foreign_keys=[department_id])
    supervisor = db.relationship("User", remote_side=[id], foreign_keys=[supervisor_id])

    def __repr__(self):
        return f"{self.first_name} {self.last_name}"

    # ---- Flask-Login integration ----
    @property
    def is_active(self):
        return bool(self.is_active_flag)

    def set_password(self, raw_password):
        self.password_hash = generate_password_hash(raw_password)
        self.password_changed_at = datetime.utcnow()

    def check_password(self, raw_password):
        return check_password_hash(self.password_hash, raw_password)

    # ---- Role-based permission lookup ----
    def get_role_names(self):
        role_ids = [ur.role_id for ur in UserRole.query.filter_by(user_id=self.id, revoked_at=None).all()]
        if not role_ids:
            return []
        roles = Role.query.filter(Role.id.in_(role_ids)).all()
        return [r.name for r in roles]

    def get_permission_codes(self):
        role_ids = [ur.role_id for ur in UserRole.query.filter_by(user_id=self.id, revoked_at=None).all()]
        if not role_ids:
            return set()
        perm_ids = {
            rp.permission_id
            for rp in RolePermission.query.filter(RolePermission.role_id.in_(role_ids)).all()
        }
        if not perm_ids:
            return set()
        perms = Permission.query.filter(Permission.id.in_(perm_ids)).all()
        return {p.code for p in perms}

    def has_permission(self, code):
        if code is None:
            return True
        return code in self.get_permission_codes()


class UserRole(db.Model):
    __tablename__ = "users_roles"
    user_id = db.Column(BIGINT, db.ForeignKey("users.id"), primary_key=True)
    role_id = db.Column(BIGINT, db.ForeignKey("roles.id"), primary_key=True)
    granted_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    granted_at = db.Column(db.DateTime, default=datetime.utcnow)
    revoked_at = db.Column(db.DateTime)

    user = db.relationship("User", foreign_keys=[user_id])
    role = db.relationship("Role", foreign_keys=[role_id])
    granted_by_user = db.relationship("User", foreign_keys=[granted_by])

    def __repr__(self):
        return f"{self.user_id} -> {self.role_id}"


class SessionLog(db.Model):
    __tablename__ = "session_logs"
    id = db.Column(BIGINT, primary_key=True)
    user_id = db.Column(BIGINT, db.ForeignKey("users.id"))
    jti = db.Column(db.String(36), unique=True)
    login_at = db.Column(db.DateTime, default=datetime.utcnow)
    logout_at = db.Column(db.DateTime)
    expires_at = db.Column(db.DateTime)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(255))

    user = db.relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"Session {self.jti or self.id} · {self.user_id}"


class LoginAttempt(db.Model):
    __tablename__ = "login_attempts"
    id = db.Column(BIGINT, primary_key=True)
    username_attempted = db.Column(db.String(60))
    user_id = db.Column(BIGINT, db.ForeignKey("users.id"))
    was_successful = db.Column(db.Boolean, default=False)
    # enum_login_failure: UNKNOWN_USER, BAD_PASSWORD, ACCOUNT_LOCKED, ACCOUNT_INACTIVE
    failure_reason = db.Column(db.String(30))
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(255))
    attempted_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"{'OK' if self.was_successful else 'FAIL'} · {self.username_attempted}"


class TokenDenylist(db.Model):
    __tablename__ = "token_denylist"
    id = db.Column(BIGINT, primary_key=True)
    jti = db.Column(db.String(36), unique=True)
    user_id = db.Column(BIGINT, db.ForeignKey("users.id"))
    revoked_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    # enum_revoke_reason: LOGOUT, PASSWORD_CHANGE, ROLE_CHANGE, ADMIN_REVOKE, SUSPECTED_COMPROMISE
    revoked_reason = db.Column(db.String(30))

    user = db.relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"Revoked {self.jti or self.id}"


# =====================================================================
# SECTION C — WORKFLOW CONFIGURATION
# =====================================================================

class WorkflowState(db.Model):
    __tablename__ = "workflow_states"
    id = db.Column(BIGINT, primary_key=True)
    code = db.Column(db.String(40), unique=True, nullable=False)
    name_ar = db.Column(db.String(80))
    name_en = db.Column(db.String(80), nullable=False)
    is_initial = db.Column(db.Boolean, default=False)
    is_final = db.Column(db.Boolean, default=False)
    display_order = db.Column(db.Integer, default=0)
    color_hex = db.Column(db.String(7))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return self.name_en or self.code


class WorkflowTransition(db.Model):
    __tablename__ = "workflow_transitions"
    id = db.Column(BIGINT, primary_key=True)
    from_state_id = db.Column(BIGINT, db.ForeignKey("workflow_states.id"))
    to_state_id = db.Column(BIGINT, db.ForeignKey("workflow_states.id"))
    action_code = db.Column(db.String(40), unique=True)
    label_ar = db.Column(db.String(80))
    label_en = db.Column(db.String(80))
    requires_comment = db.Column(db.Boolean, default=False)
    requires_document = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("from_state_id", "to_state_id"),)

    from_state = db.relationship("WorkflowState", foreign_keys=[from_state_id])
    to_state = db.relationship("WorkflowState", foreign_keys=[to_state_id])

    def __repr__(self):
        return self.label_en or self.action_code


class WorkflowTransitionPermission(db.Model):
    __tablename__ = "workflow_transition_permissions"
    transition_id = db.Column(BIGINT, db.ForeignKey("workflow_transitions.id"), primary_key=True)
    permission_id = db.Column(BIGINT, db.ForeignKey("permissions.id"), primary_key=True)

    transition = db.relationship("WorkflowTransition", foreign_keys=[transition_id])
    permission = db.relationship("Permission", foreign_keys=[permission_id])

    def __repr__(self):
        return f"{self.transition_id} needs {self.permission_id}"


# =====================================================================
# SECTION D — DOCUMENT TYPE CONFIGURATION
# =====================================================================

class DocumentType(db.Model):
    __tablename__ = "document_types"
    id = db.Column(BIGINT, primary_key=True)
    code = db.Column(db.String(40), unique=True, nullable=False)
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150), nullable=False)
    # enum_document_category: CIVIL_STATUS, IDENTITY, FAMILY, JUDICIAL
    category = db.Column(db.String(20))
    subtype_table = db.Column(db.String(64))
    validation_rules = db.Column(db.JSON)
    required_fields = db.Column(db.JSON)
    validity_duration_days = db.Column(db.Integer)
    default_sla_days = db.Column(db.Integer)
    default_fee_amount = db.Column(db.Numeric(12, 2))
    default_fee_currency = db.Column(db.String(3))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return self.name_en or self.code


class DocumentTypeAuthority(db.Model):
    __tablename__ = "document_type_authorities"
    id = db.Column(BIGINT, primary_key=True)
    document_type_id = db.Column(BIGINT, db.ForeignKey("document_types.id"))
    # enum_authority_kind: OFFICE, COURT, RELIGIOUS_AUTHORITY
    authority_kind = db.Column(db.String(20))
    office_id = db.Column(BIGINT, db.ForeignKey("offices.id"))
    court_id = db.Column(BIGINT, db.ForeignKey("courts.id"))
    religious_authority_id = db.Column(BIGINT, db.ForeignKey("religious_authorities.id"))
    is_active = db.Column(db.Boolean, default=True)
    __table_args__ = (
        db.UniqueConstraint("document_type_id", "authority_kind", "office_id", "court_id", "religious_authority_id"),
    )

    document_type = db.relationship("DocumentType", foreign_keys=[document_type_id])
    office = db.relationship("Office", foreign_keys=[office_id])
    court = db.relationship("Court", foreign_keys=[court_id])
    religious_authority = db.relationship("ReligiousAuthority", foreign_keys=[religious_authority_id])

    def __repr__(self):
        return f"{self.document_type_id} <- {self.authority_kind}"


# =====================================================================
# SECTION E — CITIZEN REGISTRY
# =====================================================================

class Citizen(db.Model):
    __tablename__ = "citizens"
    civil_registry_number = db.Column(db.String(20), primary_key=True)
    first_name_ar = db.Column(db.String(80))
    middle_name_ar = db.Column(db.String(80))
    last_name_ar = db.Column(db.String(80))
    first_name_en = db.Column(db.String(80))
    middle_name_en = db.Column(db.String(80))
    last_name_en = db.Column(db.String(80))
    father_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    mother_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    father_name_unregistered = db.Column(db.String(200))
    mother_name_unregistered = db.Column(db.String(200))
    date_of_birth = db.Column(db.Date)
    place_of_birth = db.Column(db.String(150))
    # enum_gender: MALE, FEMALE
    gender = db.Column(db.String(10))
    religion = db.Column(db.String(50))
    sect = db.Column(db.String(50))
    # enum_marital_status: SINGLE, MARRIED, DIVORCED, WIDOWED
    marital_status = db.Column(db.String(20))
    sijill_reference = db.Column(db.String(50))
    registration_office_id = db.Column(BIGINT, db.ForeignKey("offices.id"))
    nationality = db.Column(db.String(60), default="citizen")
    is_deceased = db.Column(db.Boolean, default=False)
    created_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    father = db.relationship("Citizen", remote_side=[civil_registry_number], foreign_keys=[father_id])
    mother = db.relationship("Citizen", remote_side=[civil_registry_number], foreign_keys=[mother_id])
    registration_office = db.relationship("Office", foreign_keys=[registration_office_id])
    creator = db.relationship("User", foreign_keys=[created_by])
    updater = db.relationship("User", foreign_keys=[updated_by])

    def __repr__(self):
        name = f"{self.first_name_en or self.first_name_ar or ''} {self.last_name_en or self.last_name_ar or ''}".strip()
        return f"{name} ({self.civil_registry_number})" if name else self.civil_registry_number


class FamilyRecord(db.Model):
    __tablename__ = "family_records"
    id = db.Column(BIGINT, primary_key=True)
    family_book_number = db.Column(db.String(40), unique=True, nullable=False)
    head_of_household_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    registration_office_id = db.Column(BIGINT, db.ForeignKey("offices.id"))
    is_active = db.Column(db.Boolean, default=True)
    created_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    head_of_household = db.relationship("Citizen", foreign_keys=[head_of_household_id])
    registration_office = db.relationship("Office", foreign_keys=[registration_office_id])
    creator = db.relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return self.family_book_number


class FamilyMember(db.Model):
    __tablename__ = "family_members"
    id = db.Column(BIGINT, primary_key=True)
    family_record_id = db.Column(BIGINT, db.ForeignKey("family_records.id"), nullable=False)
    citizen_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    # enum_relationship: HEAD, SPOUSE, SON, DAUGHTER, FATHER, MOTHER, OTHER
    relationship_ = db.Column("relationship", db.String(20))
    joined_date = db.Column(db.Date)
    left_date = db.Column(db.Date)
    left_reason = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("family_record_id", "citizen_id", "joined_date"),)

    family_record = db.relationship("FamilyRecord", foreign_keys=[family_record_id])
    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])

    def __repr__(self):
        return f"{self.citizen_id} in {self.family_record_id} ({self.relationship_})"


class GuardianshipRecord(db.Model):
    __tablename__ = "guardianship_records"
    id = db.Column(BIGINT, primary_key=True)
    minor_citizen_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    guardian_citizen_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    # enum_guardianship_type: NATURAL, TESTAMENTARY, COURT_APPOINTED
    guardianship_type = db.Column(db.String(20))
    court_decision_number = db.Column(db.String(60))
    court_id = db.Column(BIGINT, db.ForeignKey("courts.id"))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    # enum_record_status: ACTIVE, INACTIVE, SUPERSEDED, CANCELLED
    status = db.Column(db.String(20), default="ACTIVE")
    created_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    minor = db.relationship("Citizen", foreign_keys=[minor_citizen_id])
    guardian = db.relationship("Citizen", foreign_keys=[guardian_citizen_id])
    court = db.relationship("Court", foreign_keys=[court_id])
    creator = db.relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"Guardianship {self.minor_citizen_id} <- {self.guardian_citizen_id}"


class RegistryTransfer(db.Model):
    __tablename__ = "registry_transfers"
    id = db.Column(BIGINT, primary_key=True)
    citizen_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    family_record_id = db.Column(BIGINT, db.ForeignKey("family_records.id"))
    from_office_id = db.Column(BIGINT, db.ForeignKey("offices.id"))
    to_office_id = db.Column(BIGINT, db.ForeignKey("offices.id"))
    requested_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    approved_at = db.Column(db.DateTime)
    decision_reference = db.Column(db.String(80))
    # enum_approval_status: PENDING, APPROVED, REJECTED
    status = db.Column(db.String(20), default="PENDING")
    transfer_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])
    family_record = db.relationship("FamilyRecord", foreign_keys=[family_record_id])
    from_office = db.relationship("Office", foreign_keys=[from_office_id])
    to_office = db.relationship("Office", foreign_keys=[to_office_id])
    requester = db.relationship("User", foreign_keys=[requested_by])
    approver = db.relationship("User", foreign_keys=[approved_by])

    def __repr__(self):
        return f"Transfer {self.citizen_id} ({self.status})"


class CivilStatusAmendment(db.Model):
    __tablename__ = "civil_status_amendments"
    id = db.Column(BIGINT, primary_key=True)
    citizen_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    field_changed = db.Column(db.String(60))
    old_value = db.Column(db.String(500))
    new_value = db.Column(db.String(500))
    legal_basis = db.Column(db.String(500))
    court_decision_number = db.Column(db.String(60))
    court_id = db.Column(BIGINT, db.ForeignKey("courts.id"))
    requested_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    approved_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    approved_at = db.Column(db.DateTime)
    amendment_date = db.Column(db.Date)
    status = db.Column(db.String(20), default="PENDING")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])
    court = db.relationship("Court", foreign_keys=[court_id])
    requester = db.relationship("User", foreign_keys=[requested_by])
    approver = db.relationship("User", foreign_keys=[approved_by])

    def __repr__(self):
        return f"Amendment {self.field_changed} · {self.citizen_id}"


# =====================================================================
# SECTION F — DOCUMENTS (supertype) & SUBTYPES
# =====================================================================

class Document(db.Model):
    __tablename__ = "documents"
    id = db.Column(BIGINT, primary_key=True)
    document_type_id = db.Column(BIGINT, db.ForeignKey("document_types.id"), nullable=False)
    civil_registry_number = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    document_group_id = db.Column(BIGINT)
    document_number = db.Column(db.String(60), unique=True)
    issue_date = db.Column(db.Date)
    expiry_date = db.Column(db.Date)
    issuing_office_id = db.Column(BIGINT, db.ForeignKey("offices.id"))
    attested_by_mukhtar_id = db.Column(BIGINT, db.ForeignKey("mukhtars.id"))
    physical_file_location = db.Column(db.String(255))
    digital_file_path = db.Column(db.String(500))
    file_hash = db.Column(db.String(64))
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    # enum_document_status: DRAFT, ACTIVE, SUPERSEDED, EXPIRED, CANCELLED
    status = db.Column(db.String(20), default="DRAFT")
    version = db.Column(db.Integer, default=1)
    is_latest = db.Column(db.Boolean, default=True)
    is_deleted = db.Column(db.Boolean, default=False)
    deleted_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    deleted_at = db.Column(db.DateTime)
    created_by = db.Column(BIGINT, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("document_group_id", "is_latest"),)

    document_type = db.relationship("DocumentType", foreign_keys=[document_type_id])
    citizen = db.relationship("Citizen", foreign_keys=[civil_registry_number])
    issuing_office = db.relationship("Office", foreign_keys=[issuing_office_id])
    attested_by_mukhtar = db.relationship("Mukhtar", foreign_keys=[attested_by_mukhtar_id])
    deleter = db.relationship("User", foreign_keys=[deleted_by])
    creator = db.relationship("User", foreign_keys=[created_by])
    updater = db.relationship("User", foreign_keys=[updated_by])

    def __repr__(self):
        return f"{self.document_type.name_en if self.document_type else 'Document'} · {self.document_number or self.id}"


class BirthCertificate(db.Model):
    __tablename__ = "birth_certificates"
    document_id = db.Column(BIGINT, db.ForeignKey("documents.id"), primary_key=True)
    birth_place = db.Column(db.String(150))
    birth_hospital = db.Column(db.String(150))
    birth_attendant = db.Column(db.String(150))
    father_full_name_snapshot = db.Column(db.String(200))
    mother_full_name_snapshot = db.Column(db.String(200))
    registration_number = db.Column(db.String(60))
    registrar_name = db.Column(db.String(150))

    document = db.relationship("Document", foreign_keys=[document_id])

    def __repr__(self):
        return f"Birth Cert. {self.registration_number or self.document_id}"


class MarriageCertificate(db.Model):
    __tablename__ = "marriage_certificates"
    document_id = db.Column(BIGINT, db.ForeignKey("documents.id"), primary_key=True)
    husband_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    wife_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    husband_name_snapshot = db.Column(db.String(200))
    wife_name_snapshot = db.Column(db.String(200))
    marriage_date = db.Column(db.Date)
    marriage_place = db.Column(db.String(150))
    court_id = db.Column(BIGINT, db.ForeignKey("courts.id"))
    religious_authority_id = db.Column(BIGINT, db.ForeignKey("religious_authorities.id"))
    contract_number = db.Column(db.String(60), unique=True)
    dowry_amount = db.Column(db.Numeric(12, 2))
    dowry_currency = db.Column(db.String(3))
    # enum_union_status: ACTIVE, DISSOLVED, ANNULLED
    status = db.Column(db.String(20), default="ACTIVE")

    document = db.relationship("Document", foreign_keys=[document_id])
    husband = db.relationship("Citizen", foreign_keys=[husband_id])
    wife = db.relationship("Citizen", foreign_keys=[wife_id])
    court = db.relationship("Court", foreign_keys=[court_id])
    religious_authority = db.relationship("ReligiousAuthority", foreign_keys=[religious_authority_id])

    def __repr__(self):
        return f"Marriage {self.contract_number or self.document_id}"


class DivorceCertificate(db.Model):
    __tablename__ = "divorce_certificates"
    document_id = db.Column(BIGINT, db.ForeignKey("documents.id"), primary_key=True)
    marriage_certificate_id = db.Column(BIGINT, db.ForeignKey("marriage_certificates.document_id"), unique=True)
    husband_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    wife_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"))
    divorce_date = db.Column(db.Date)
    divorce_place = db.Column(db.String(150))
    court_id = db.Column(BIGINT, db.ForeignKey("courts.id"))
    court_decision_number = db.Column(db.String(60))
    # enum_divorce_type: TALAQ, KHULA, JUDICIAL, MUTUAL_CONSENT, ANNULMENT
    divorce_type = db.Column(db.String(20))
    divorce_reason = db.Column(db.Text)
    child_custody_agreement = db.Column(db.Text)
    financial_settlement = db.Column(db.Text)
    settlement_amount = db.Column(db.Numeric(12, 2))
    settlement_currency = db.Column(db.String(3))
    religious_authority_id = db.Column(BIGINT, db.ForeignKey("religious_authorities.id"))
    sharia_court_approval = db.Column(db.String(80))
    # enum_record_status
    status = db.Column(db.String(20), default="ACTIVE")

    document = db.relationship("Document", foreign_keys=[document_id])
    marriage_certificate = db.relationship("MarriageCertificate", foreign_keys=[marriage_certificate_id])
    husband = db.relationship("Citizen", foreign_keys=[husband_id])
    wife = db.relationship("Citizen", foreign_keys=[wife_id])
    court = db.relationship("Court", foreign_keys=[court_id])
    religious_authority = db.relationship("ReligiousAuthority", foreign_keys=[religious_authority_id])

    def __repr__(self):
        return f"Divorce {self.court_decision_number or self.document_id}"


class DeathCertificate(db.Model):
    __tablename__ = "death_certificates"
    document_id = db.Column(BIGINT, db.ForeignKey("documents.id"), primary_key=True)
    death_date = db.Column(db.Date)
    death_place = db.Column(db.String(150))
    death_cause = db.Column(db.String(255))
    certifying_physician = db.Column(db.String(150))
    burial_place = db.Column(db.String(150))
    burial_date = db.Column(db.Date)

    document = db.relationship("Document", foreign_keys=[document_id])

    def __repr__(self):
        return f"Death Cert. {self.document_id}"


class NationalIdCard(db.Model):
    __tablename__ = "national_id_cards"
    document_id = db.Column(BIGINT, db.ForeignKey("documents.id"), primary_key=True)
    card_number = db.Column(db.String(40), unique=True)
    biometric_photo_path = db.Column(db.String(500))
    biometric_photo_hash = db.Column(db.String(64))
    fingerprint_hash = db.Column(db.String(64))
    chip_serial_number = db.Column(db.String(60))
    # enum_card_status: ACTIVE, EXPIRED, LOST, STOLEN, REPLACED, CANCELLED
    status = db.Column(db.String(20), default="ACTIVE")

    document = db.relationship("Document", foreign_keys=[document_id])

    def __repr__(self):
        return f"ID Card {self.card_number}"


class Passport(db.Model):
    """Not present in the committed ERD (docs/database/CTS-Database-Design.eraser) —
    restored here to preserve the original 8-certificate-type scope from the
    earlier design work. Flag this with whoever reviews the SDD/ERD so the
    committed schema and this table get reconciled one way or the other."""
    __tablename__ = "passports"
    document_id = db.Column(BIGINT, db.ForeignKey("documents.id"), primary_key=True)
    citizen_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    passport_number = db.Column(db.String(50), unique=True, nullable=False)
    passport_type = db.Column(db.String(30))
    issue_date = db.Column(db.Date)
    expiry_date = db.Column(db.Date)
    issuing_office_id = db.Column(BIGINT, db.ForeignKey("offices.id"))
    page_count = db.Column(db.Integer)
    status = db.Column(db.String(20), default="ACTIVE")

    document = db.relationship("Document", foreign_keys=[document_id])
    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])
    issuing_office = db.relationship("Office", foreign_keys=[issuing_office_id])

    def __repr__(self):
        return f"Passport {self.passport_number}"


class NaturalizationRecord(db.Model):
    __tablename__ = "naturalization_records"
    document_id = db.Column(BIGINT, db.ForeignKey("documents.id"), primary_key=True)
    previous_nationality = db.Column(db.String(60))
    naturalization_date = db.Column(db.Date)
    decree_number = db.Column(db.String(60))
    decree_date = db.Column(db.Date)
    status = db.Column(db.String(20), default="ACTIVE")

    document = db.relationship("Document", foreign_keys=[document_id])

    def __repr__(self):
        return f"Naturalization {self.decree_number or self.document_id}"


class NameChangeRecord(db.Model):
    __tablename__ = "name_change_records"
    document_id = db.Column(BIGINT, db.ForeignKey("documents.id"), primary_key=True)
    amendment_id = db.Column(BIGINT, db.ForeignKey("civil_status_amendments.id"))
    old_first_name = db.Column(db.String(80))
    old_middle_name = db.Column(db.String(80))
    old_last_name = db.Column(db.String(80))
    new_first_name = db.Column(db.String(80))
    new_middle_name = db.Column(db.String(80))
    new_last_name = db.Column(db.String(80))
    reason = db.Column(db.Text)
    court_decision_number = db.Column(db.String(60))
    change_date = db.Column(db.Date)

    document = db.relationship("Document", foreign_keys=[document_id])
    amendment = db.relationship("CivilStatusAmendment", foreign_keys=[amendment_id])

    def __repr__(self):
        return f"Name Change {self.document_id}"


# =====================================================================
# SECTION G — DOCUMENT VALIDATION & PHYSICAL CUSTODY
# =====================================================================

class DocumentValidation(db.Model):
    __tablename__ = "document_validations"
    id = db.Column(BIGINT, primary_key=True)
    document_id = db.Column(BIGINT, db.ForeignKey("documents.id"), nullable=False)
    validator_id = db.Column(BIGINT, db.ForeignKey("users.id"), nullable=False)
    # enum_validation_type: AUTHENTICITY, COMPLETENESS, LEGAL_SUFFICIENCY
    validation_type = db.Column(db.String(30))
    # enum_validation_status: PENDING, APPROVED, REJECTED
    status = db.Column(db.String(20), default="PENDING")
    comments = db.Column(db.Text)
    rejection_reason = db.Column(db.String(500))
    validation_date = db.Column(db.DateTime, default=datetime.utcnow)
    digital_signature = db.Column(db.Text)
    signature_key_id = db.Column(db.String(80))
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(255))

    document = db.relationship("Document", foreign_keys=[document_id])
    validator = db.relationship("User", foreign_keys=[validator_id])

    def __repr__(self):
        return f"Validation {self.status} · {self.document_id}"


class PhysicalDocumentHandling(db.Model):
    __tablename__ = "physical_document_handling"
    id = db.Column(BIGINT, primary_key=True)
    document_id = db.Column(BIGINT, db.ForeignKey("documents.id"), nullable=False)
    # enum_custody_action: RECEIVED, ARCHIVED, RETRIEVED, TRANSFERRED, ISSUED_TO_CITIZEN, RETURNED, DESTROYED
    action = db.Column(db.String(30), nullable=False)
    performed_by = db.Column(BIGINT, db.ForeignKey("users.id"), nullable=False)
    performed_by_name_snapshot = db.Column(db.String(200))
    performed_by_role_snapshot = db.Column(db.String(80))
    performed_at = db.Column(db.DateTime, default=datetime.utcnow)
    location = db.Column(db.String(150))
    location_details = db.Column(db.String(500))
    notes = db.Column(db.Text)
    action_reason = db.Column(db.String(500))
    witness_user_id = db.Column(BIGINT, db.ForeignKey("users.id"))
    witness_name = db.Column(db.String(200))
    witness_signature = db.Column(db.Text)

    document = db.relationship("Document", foreign_keys=[document_id])
    performer = db.relationship("User", foreign_keys=[performed_by])
    witness = db.relationship("User", foreign_keys=[witness_user_id])

    def __repr__(self):
        return f"{self.action} · {self.document_id}"


# =====================================================================
# SECTION H — SERVICE REQUESTS / WORKFLOW
# =====================================================================

class ServiceRequest(db.Model):
    __tablename__ = "service_requests"
    id = db.Column(BIGINT, primary_key=True)
    request_number = db.Column(db.String(30), unique=True, nullable=False)
    # enum_direction: INCOMING, OUTGOING
    direction = db.Column(db.String(10))
    citizen_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    document_type_id = db.Column(BIGINT, db.ForeignKey("document_types.id"), nullable=False)
    office_id = db.Column(BIGINT, db.ForeignKey("offices.id"))
    department_id = db.Column(BIGINT, db.ForeignKey("departments.id"))
    workflow_state_id = db.Column(BIGINT, db.ForeignKey("workflow_states.id"))
    # enum_priority: LOW, NORMAL, HIGH, URGENT
    priority = db.Column(db.String(10), default="NORMAL")
    subject = db.Column(db.String(255))
    notes = db.Column(db.Text)
    requested_by_user_id = db.Column(BIGINT, db.ForeignKey("users.id"))
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.Date)
    reviewed_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    reviewed_at = db.Column(db.DateTime)
    approved_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    approved_at = db.Column(db.DateTime)
    rejected_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    rejected_at = db.Column(db.DateTime)
    rejection_reason = db.Column(db.String(500))
    issued_document_id = db.Column(BIGINT, db.ForeignKey("documents.id"))
    fee_amount = db.Column(db.Numeric(12, 2))
    fee_currency = db.Column(db.String(3))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])
    document_type = db.relationship("DocumentType", foreign_keys=[document_type_id])
    office = db.relationship("Office", foreign_keys=[office_id])
    department = db.relationship("Department", foreign_keys=[department_id])
    workflow_state = db.relationship("WorkflowState", foreign_keys=[workflow_state_id])
    requested_by = db.relationship("User", foreign_keys=[requested_by_user_id])
    reviewer = db.relationship("User", foreign_keys=[reviewed_by])
    approver = db.relationship("User", foreign_keys=[approved_by])
    rejecter = db.relationship("User", foreign_keys=[rejected_by])
    issued_document = db.relationship("Document", foreign_keys=[issued_document_id])

    def __repr__(self):
        return f"Request {self.request_number}"


class RequestAssignment(db.Model):
    __tablename__ = "request_assignments"
    id = db.Column(BIGINT, primary_key=True)
    service_request_id = db.Column(BIGINT, db.ForeignKey("service_requests.id"))
    assigned_to = db.Column(BIGINT, db.ForeignKey("users.id"))
    assigned_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    unassigned_at = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    note = db.Column(db.String(500))
    __table_args__ = (db.UniqueConstraint("service_request_id", "is_active"),)

    service_request = db.relationship("ServiceRequest", foreign_keys=[service_request_id])
    assignee = db.relationship("User", foreign_keys=[assigned_to])
    assigner = db.relationship("User", foreign_keys=[assigned_by])

    def __repr__(self):
        return f"Assignment {self.service_request_id} -> {self.assigned_to}"


class ServiceRequestStatusHistory(db.Model):
    __tablename__ = "service_request_status_history"
    id = db.Column(BIGINT, primary_key=True)
    service_request_id = db.Column(BIGINT, db.ForeignKey("service_requests.id"))
    from_state_id = db.Column(BIGINT, db.ForeignKey("workflow_states.id"))
    to_state_id = db.Column(BIGINT, db.ForeignKey("workflow_states.id"))
    transition_id = db.Column(BIGINT, db.ForeignKey("workflow_transitions.id"))
    changed_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    comment = db.Column(db.Text)

    service_request = db.relationship("ServiceRequest", foreign_keys=[service_request_id])
    from_state = db.relationship("WorkflowState", foreign_keys=[from_state_id])
    to_state = db.relationship("WorkflowState", foreign_keys=[to_state_id])
    transition = db.relationship("WorkflowTransition", foreign_keys=[transition_id])
    changed_by_user = db.relationship("User", foreign_keys=[changed_by])

    def __repr__(self):
        return f"History {self.service_request_id}: -> {self.to_state_id}"


class SlaRecord(db.Model):
    __tablename__ = "sla_records"
    id = db.Column(BIGINT, primary_key=True)
    service_request_id = db.Column(BIGINT, db.ForeignKey("service_requests.id"), unique=True)
    due_date = db.Column(db.Date)
    # enum_sla_status: ON_TRACK, DUE_SOON, OVERDUE, MET, BREACHED
    sla_status = db.Column(db.String(15), default="ON_TRACK")
    days_remaining = db.Column(db.Integer)
    overdue_by_days = db.Column(db.Integer)
    breached_at = db.Column(db.DateTime)
    last_checked_at = db.Column(db.DateTime, default=datetime.utcnow)

    service_request = db.relationship("ServiceRequest", foreign_keys=[service_request_id])

    def __repr__(self):
        return f"SLA {self.service_request_id} ({self.sla_status})"


class Payment(db.Model):
    __tablename__ = "payments"
    id = db.Column(BIGINT, primary_key=True)
    service_request_id = db.Column(BIGINT, db.ForeignKey("service_requests.id"))
    amount = db.Column(db.Numeric(12, 2))
    currency = db.Column(db.String(3))
    # enum_payment_method: CASH, BANK_TRANSFER, CHEQUE, WAIVED
    method = db.Column(db.String(20))
    # enum_payment_status: PAID, REVERSED, VOIDED
    status = db.Column(db.String(15), default="PAID")
    receipt_number = db.Column(db.String(40), unique=True)
    collected_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    paid_at = db.Column(db.DateTime, default=datetime.utcnow)
    reversed_by = db.Column(BIGINT, db.ForeignKey("users.id"))
    reversed_at = db.Column(db.DateTime)
    reversal_reason = db.Column(db.String(255))

    service_request = db.relationship("ServiceRequest", foreign_keys=[service_request_id])
    collector = db.relationship("User", foreign_keys=[collected_by])
    reverser = db.relationship("User", foreign_keys=[reversed_by])

    def __repr__(self):
        return f"Payment {self.receipt_number or self.id}"


class InternalNotification(db.Model):
    __tablename__ = "internal_notifications"
    id = db.Column(BIGINT, primary_key=True)
    recipient_user_id = db.Column(BIGINT, db.ForeignKey("users.id"))
    related_entity_type = db.Column(db.String(60))
    related_entity_id = db.Column(db.String(40))
    # enum_notification_type: ASSIGNMENT, TRANSITION, SLA_WARNING, SLA_BREACH, VALIDATION_REQUIRED, APPROVAL_REQUIRED
    notification_type = db.Column(db.String(30))
    message = db.Column(db.String(500))
    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    recipient = db.relationship("User", foreign_keys=[recipient_user_id])

    def __repr__(self):
        return f"Notification -> {self.recipient_user_id}"


# =====================================================================
# SECTION I — AUDIT & ACCESS LOGGING
# =====================================================================

class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    id = db.Column(BIGINT, primary_key=True)
    actor_user_id = db.Column(BIGINT, db.ForeignKey("users.id"))
    # enum_audit_action — see docs/database/CTS-Database-Design.eraser for the full list
    action = db.Column(db.String(40))
    entity_type = db.Column(db.String(60))
    entity_id = db.Column(db.String(40))
    service_request_id = db.Column(BIGINT, db.ForeignKey("service_requests.id"))
    old_value = db.Column(db.JSON)
    new_value = db.Column(db.JSON)
    was_successful = db.Column(db.Boolean, default=True)
    failure_reason = db.Column(db.String(255))
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(255))
    occurred_at = db.Column(db.DateTime, default=datetime.utcnow)

    actor = db.relationship("User", foreign_keys=[actor_user_id])
    service_request = db.relationship("ServiceRequest", foreign_keys=[service_request_id])

    def __repr__(self):
        return f"{self.action} · {self.entity_type}:{self.entity_id}"


class CitizenAuditLog(db.Model):
    __tablename__ = "citizen_audit_log"
    id = db.Column(BIGINT, primary_key=True)
    citizen_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    amendment_id = db.Column(BIGINT, db.ForeignKey("civil_status_amendments.id"))
    field_name = db.Column(db.String(60), nullable=False)
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    changed_by = db.Column(BIGINT, db.ForeignKey("users.id"), nullable=False)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    reason = db.Column(db.String(500))
    ip_address = db.Column(db.String(45))

    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])
    amendment = db.relationship("CivilStatusAmendment", foreign_keys=[amendment_id])
    changed_by_user = db.relationship("User", foreign_keys=[changed_by])

    def __repr__(self):
        return f"{self.field_name} changed on {self.citizen_id}"


class RecordAccessLog(db.Model):
    __tablename__ = "record_access_log"
    id = db.Column(BIGINT, primary_key=True)
    citizen_id = db.Column(db.String(20), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    accessed_by = db.Column(BIGINT, db.ForeignKey("users.id"), nullable=False)
    # enum_access_type: VIEW_RECORD, VIEW_DOCUMENT, SEARCH_RESULT, EXPORT
    access_type = db.Column(db.String(20), nullable=False)
    accessed_at = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(45))
    reason = db.Column(db.String(500))

    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])
    accessed_by_user = db.relationship("User", foreign_keys=[accessed_by])

    def __repr__(self):
        return f"{self.access_type} on {self.citizen_id}"

# =====================================================================
# SCHEMA HARDENING — indexes, referential actions and check constraints
#
# Declared here, after the models, rather than scattered through forty-six
# `__table_args__` blocks. Every entry cites the clause of the Software
# Design Document it implements, so the schema can be read against the
# design rather than taken on trust.
#
# SDD §6.6.1 tabulates roughly thirty indexes as "present, and the query
# each supports". None of them existed in the implementation: the database
# carried primary-key and unique indexes only, and the three highest
# -frequency queries in the system each resolved to a full table scan.
# §6.6.2 records the same finding for `citizens` as D-04 (Critical).
#
# Where a clause names a column the corrected v2 schema does not have, the
# deviation is stated rather than silently dropped — see DEVIATIONS below.
# =====================================================================

def _ix(name, *columns):
    """Register an index on the mapped columns' table."""
    return db.Index(name, *columns)


# ---- §6.6.2 / D-04 (Critical): citizens carried a primary key and nothing
# ---- else, on the largest and most-queried table in the system.
_ix("ix_citizens_name_ar", Citizen.last_name_ar, Citizen.first_name_ar, Citizen.date_of_birth)
_ix("ix_citizens_name_en", Citizen.last_name_en, Citizen.first_name_en)
_ix("ix_citizens_office", Citizen.registration_office_id)
_ix("ix_citizens_father", Citizen.father_id)
_ix("ix_citizens_mother", Citizen.mother_id)
_ix("ix_citizens_dob", Citizen.date_of_birth)

# ---- §6.6.1 — reference, identity and access
_ix("ix_session_logs_user_login", SessionLog.user_id, SessionLog.login_at.desc())
_ix("ix_login_attempts_user_time", LoginAttempt.username_attempted, LoginAttempt.attempted_at.desc())

# ---- §6.6.1 — registry domain
_ix("ix_family_members_citizen", FamilyMember.citizen_id)
_ix("ix_guardianship_minor", GuardianshipRecord.minor_citizen_id)
_ix("ix_guardianship_guardian", GuardianshipRecord.guardian_citizen_id)
_ix("ix_registry_transfers_citizen", RegistryTransfer.citizen_id)
_ix("ix_amendments_citizen", CivilStatusAmendment.citizen_id)

# ---- §6.6.1 — document domain.
# (civil_registry_number, document_type_id) is described in the SDD as "the
# best index in the schema": by leftmost prefix it also serves "all
# documents for this citizen", so no separate single-column index is added.
_ix("ix_documents_citizen_type", Document.civil_registry_number, Document.document_type_id)
_ix("ix_documents_status_latest", Document.status, Document.is_latest)
_ix("ix_documents_office", Document.issuing_office_id)
_ix("ix_documents_created", Document.created_at)          # §6.6.3 — dashboard date ranges
_ix("ix_birth_cert_regno", BirthCertificate.registration_number)
_ix("ix_marriage_contract", MarriageCertificate.contract_number)
_ix("ix_marriage_couple", MarriageCertificate.husband_id, MarriageCertificate.wife_id)
_ix("ix_marriage_wife", MarriageCertificate.wife_id)      # §6.6.3 — wife-first search
_ix("ix_marriage_status", MarriageCertificate.status)
_ix("ix_divorce_couple", DivorceCertificate.husband_id, DivorceCertificate.wife_id)
_ix("ix_divorce_wife", DivorceCertificate.wife_id)        # §6.6.3
_ix("ix_divorce_decision", DivorceCertificate.court_decision_number)
_ix("ix_passports_citizen", Passport.citizen_id)
_ix("ix_validations_doc_date", DocumentValidation.document_id, DocumentValidation.validation_date.desc())
_ix("ix_handling_doc_time", PhysicalDocumentHandling.document_id, PhysicalDocumentHandling.performed_at.desc())
_ix("ix_handling_performer", PhysicalDocumentHandling.performed_by)
_ix("ix_handling_location", PhysicalDocumentHandling.location)

# ---- §6.6.1 — request / workflow domain
_ix("ix_requests_citizen", ServiceRequest.citizen_id)
_ix("ix_requests_state", ServiceRequest.workflow_state_id)
_ix("ix_requests_office_state", ServiceRequest.office_id, ServiceRequest.workflow_state_id)
_ix("ix_requests_submitted", ServiceRequest.submitted_at)  # §6.6.3 — throughput KPIs
_ix("ix_requests_due", ServiceRequest.due_date)
# "My work queue" — §6.6.1 calls this the single most important index in the
# application, run by every officer on every login.
_ix("ix_assignments_assignee", RequestAssignment.assigned_to, RequestAssignment.is_active)
_ix("ix_history_request_time", ServiceRequestStatusHistory.service_request_id,
    ServiceRequestStatusHistory.changed_at.desc())
_ix("ix_sla_status_due", SlaRecord.sla_status, SlaRecord.due_date)
_ix("ix_payments_request", Payment.service_request_id)
_ix("ix_notifications_unread", InternalNotification.recipient_user_id, InternalNotification.is_read)
_ix("ix_notifications_recent", InternalNotification.recipient_user_id,
    InternalNotification.created_at.desc())            # §6.6.3 — ordering by recency

# ---- §6.6.1 / §6.6.3 — audit domain
_ix("ix_citizen_audit_citizen", CitizenAuditLog.citizen_id, CitizenAuditLog.changed_at.desc())
_ix("ix_citizen_audit_actor", CitizenAuditLog.changed_by)   # §6.6.3 — "what has this employee changed"
_ix("ix_access_log_citizen", RecordAccessLog.citizen_id, RecordAccessLog.accessed_at.desc())
_ix("ix_access_log_actor", RecordAccessLog.accessed_by)     # insider-misuse detection
_ix("ix_audit_logs_actor_time", AuditLog.actor_user_id, AuditLog.occurred_at.desc())
_ix("ix_audit_logs_entity", AuditLog.entity_type, AuditLog.entity_id)

# ---- §6.6.3 — unindexed foreign keys on the staff tables
_ix("ix_users_office", User.office_id)
_ix("ix_users_department", User.department_id)
_ix("ix_users_supervisor", User.supervisor_id)
_ix("ix_role_perms_permission", RolePermission.permission_id)
_ix("ix_user_roles_role", UserRole.role_id)

# DEVIATIONS from §6.6.1, stated rather than silently dropped:
#   * documents(status, validation_status) — `validation_status` was removed
#     from `documents` when D-06 was resolved and `document_validations`
#     declared the single source of truth. Implemented as
#     (status, is_latest), which serves the same work-queue filter and also
#     covers the §6.6.3 request for an is_latest index.
#   * death_certificates(deceased_id), national_id_cards(citizen_id),
#     naturalization_records(citizen_id), name_change_records(citizen_id) —
#     these subtype tables carry no citizen column in the corrected schema;
#     the subject is reached through documents.civil_registry_number, which
#     ix_documents_citizen_type already serves. D-07 is the reason the
#     duplicate reference was removed.
#   * documents(document_number), family_members(family_record_id, …) and
#     request_assignments(service_request_id) are already covered by UNIQUE
#     constraints, whose indexes serve the same lookups.
#   * FULLTEXT (first_name_ar, middle_name_ar, last_name_ar) with an ngram
#     parser is MySQL-only and is emitted by the MySQL DDL script, not here.


# =====================================================================
# REFERENTIAL ACTIONS — SDD §6.5.5 / R-12, D-28
#
# The ERD declared roughly fifty foreign keys and no ON DELETE or ON UPDATE
# behaviour anywhere. That matters most because `citizens` uses a natural
# primary key: correcting a civil registry number would fail against every
# table referencing it without ON UPDATE CASCADE.
#
# Applied by relationship class, exactly as R-12 specifies, rather than
# hand-edited onto fifty declarations.
# =====================================================================

_SUBTYPE_TABLES = {
    "birth_certificates", "marriage_certificates", "divorce_certificates",
    "death_certificates", "national_id_cards", "passports",
    "naturalization_records", "name_change_records",
}
_AUDIT_TABLES = {"audit_logs", "citizen_audit_log", "record_access_log",
                 "service_request_status_history", "document_validations",
                 "physical_document_handling", "session_logs", "login_attempts"}


def _apply_referential_actions():
    applied = {"CASCADE": 0, "RESTRICT": 0, "SET NULL": 0}
    for table in db.metadata.tables.values():
        for fk in table.foreign_key_constraints:
            target = fk.referred_table.name

            # Citizen self-reference: removing a parent must not orphan a
            # child record.
            if table.name == "citizens" and target == "citizens":
                fk.ondelete, fk.onupdate = "SET NULL", "CASCADE"
            # A subtype row has no meaning without its parent document.
            elif table.name in _SUBTYPE_TABLES and target == "documents":
                fk.ondelete, fk.onupdate = "CASCADE", "CASCADE"
            # Audit must survive: deleting an audited subject is blocked.
            elif table.name in _AUDIT_TABLES:
                fk.ondelete, fk.onupdate = "RESTRICT", "CASCADE"
            # Users are deactivated, never deleted.
            elif target == "users":
                fk.ondelete, fk.onupdate = "RESTRICT", "CASCADE"
            # A citizen with documents must never be deletable.
            elif target == "citizens":
                fk.ondelete, fk.onupdate = "RESTRICT", "CASCADE"
            # Grants are removed with the role or user they belong to.
            elif table.name in ("role_permissions", "users_roles",
                                "workflow_transition_permissions",
                                "document_type_authorities"):
                fk.ondelete, fk.onupdate = "CASCADE", "CASCADE"
            else:
                fk.ondelete, fk.onupdate = "RESTRICT", "CASCADE"

            applied[fk.ondelete] = applied.get(fk.ondelete, 0) + 1
    return applied


REFERENTIAL_ACTIONS_APPLIED = _apply_referential_actions()


# =====================================================================
# CHECK CONSTRAINTS — SDD §6.5.7
#
# §6.5.7 lists nine correctness-critical rules with "no database
# enforcement", and calls that list "the schema's most significant systemic
# weakness". The rules a single-row CHECK can express are enforced here.
# The remainder need cross-row or cross-table context; those that are
# implemented as triggers are in migrations/triggers, and those still left
# to the service layer are listed at the bottom of this block.
# =====================================================================

_CHECKS = [
    (Citizen, "ck_citizens_gender", "gender IN ('MALE','FEMALE')"),
    (Citizen, "ck_citizens_marital",
     "marital_status IN ('SINGLE','MARRIED','DIVORCED','WIDOWED')"),
    (Citizen, "ck_citizens_dob_not_future", "date_of_birth <= CURRENT_DATE"),

    (Document, "ck_documents_version", "version >= 1"),
    (Document, "ck_documents_expiry", "expiry_date IS NULL OR expiry_date >= issue_date"),
    # D-23: soft deletion must record who and when.
    (Document, "ck_documents_soft_delete",
     "is_deleted = 0 OR (deleted_by IS NOT NULL AND deleted_at IS NOT NULL)"),

    # §6.5.7 rule 3: rejection_reason is populated when a request is rejected.
    (ServiceRequest, "ck_requests_rejection_reason",
     "rejected_by IS NULL OR rejection_reason IS NOT NULL"),
    (ServiceRequest, "ck_requests_priority",
     "priority IN ('LOW','NORMAL','HIGH','URGENT')"),
    (ServiceRequest, "ck_requests_direction", "direction IN ('INCOMING','OUTGOING')"),
    (ServiceRequest, "ck_requests_fee", "fee_amount IS NULL OR fee_amount >= 0"),

    # D-10: an amount without a currency is meaningless in a dual-currency
    # economy, and the currency must be a three-letter code.
    (Payment, "ck_payments_amount", "amount >= 0"),
    (Payment, "ck_payments_currency", "currency IS NULL OR length(currency) = 3"),
    (MarriageCertificate, "ck_marriage_dowry", "dowry_amount IS NULL OR dowry_amount >= 0"),

    (SlaRecord, "ck_sla_status",
     "sla_status IN ('ON_TRACK','DUE_SOON','OVERDUE','MET','BREACHED')"),
    (DeathCertificate, "ck_death_burial_after_death",
     "burial_date IS NULL OR burial_date >= death_date"),
    (GuardianshipRecord, "ck_guardianship_dates",
     "end_date IS NULL OR end_date >= start_date"),
    (GuardianshipRecord, "ck_guardianship_distinct",
     "minor_citizen_id <> guardian_citizen_id"),
    (RegistryTransfer, "ck_transfer_distinct_offices", "from_office_id <> to_office_id"),
    (User, "ck_users_failed_attempts", "failed_login_attempts >= 0"),
    (Mukhtar, "ck_mukhtar_term", "term_end IS NULL OR term_end >= term_start"),
]

for _model, _name, _expr in _CHECKS:
    _model.__table__.append_constraint(db.CheckConstraint(_expr, name=_name))

# Still enforced only in the service layer, and still listed in §6.5.7 as
# such: at most one legal status transition sequence (rule 2 — the
# workflow_transitions table describes the legal moves but nothing forces a
# request to follow them), subtype matching its parent's document_type_id
# (rule 4, D-22), acyclic lineage and supervision (rule 6, D-20), and
# is_deceased agreeing with the existence of a death certificate (rule 8,
# R-09). Rules 1 and 5 are enforced by the UNIQUE constraints on
# (service_request_id, is_active) and (document_group_id, is_latest);
# rules 7 and 9 are enforced by trigger.


# =====================================================================
# MySQL storage parameters — SDD D-14
#
# "Arabic requires utf8mb4. A server defaulting to latin1 corrupts every
# Arabic name silently and irreversibly." Declared on every table so that a
# create_all() against MySQL, and the generated DDL script, both carry it
# rather than inheriting whatever the server happens to default to.
# These keywords are ignored by SQLite, so the models stay dual-engine.
# =====================================================================
for _table in db.metadata.tables.values():
    _table.kwargs.setdefault("mysql_engine", "InnoDB")
    _table.kwargs.setdefault("mysql_charset", "utf8mb4")
    _table.kwargs.setdefault("mysql_collate", "utf8mb4_unicode_ci")
