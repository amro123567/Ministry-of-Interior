import uuid
from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db


def gen_uuid():
    return str(uuid.uuid4())


# =====================================================================
# SECTION A — GEOGRAPHY & INSTITUTIONS
# =====================================================================

class Governorate(db.Model):
    __tablename__ = "governorates"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150), nullable=False)
    code = db.Column(db.String(20), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return self.name_en or self.name_ar or self.id


class District(db.Model):
    __tablename__ = "districts"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    governorate_id = db.Column(db.String(36), db.ForeignKey("governorates.id"))
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150), nullable=False)
    code = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    governorate = db.relationship("Governorate", foreign_keys=[governorate_id])

    def __repr__(self):
        return self.name_en or self.name_ar or self.id


class Office(db.Model):
    __tablename__ = "offices"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    district_id = db.Column(db.String(36), db.ForeignKey("districts.id"))
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150), nullable=False)
    office_type = db.Column(db.String(50))
    address = db.Column(db.String(255))
    phone = db.Column(db.String(30))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    district = db.relationship("District", foreign_keys=[district_id])

    def __repr__(self):
        return self.name_en or self.name_ar or self.id


class Court(db.Model):
    __tablename__ = "courts"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150), nullable=False)
    court_type = db.Column(db.String(50))
    jurisdiction = db.Column(db.String(150))
    district_id = db.Column(db.String(36), db.ForeignKey("districts.id"))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    district = db.relationship("District", foreign_keys=[district_id])

    def __repr__(self):
        return self.name_en or self.name_ar or self.id


class ReligiousAuthority(db.Model):
    __tablename__ = "religious_authorities"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150), nullable=False)
    religion = db.Column(db.String(50))
    sect = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return self.name_en or self.name_ar or self.id


# =====================================================================
# SECTION B — RBAC
# =====================================================================

class Permission(db.Model):
    __tablename__ = "permissions"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    code = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return self.code


class Role(db.Model):
    __tablename__ = "role"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    description = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return self.description


class RolePermission(db.Model):
    __tablename__ = "role_permissions"
    role_id = db.Column(db.String(36), db.ForeignKey("role.id"), primary_key=True)
    permission_id = db.Column(db.String(36), db.ForeignKey("permissions.id"), primary_key=True)

    role = db.relationship("Role", foreign_keys=[role_id])
    permission = db.relationship("Permission", foreign_keys=[permission_id])

    def __repr__(self):
        return f"{self.role_id} -> {self.permission_id}"


class User(UserMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    username = db.Column(db.String(60), unique=True, nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    middle_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100), nullable=False)
    office_id = db.Column(db.String(36), db.ForeignKey("offices.id"))
    active = db.Column(db.Boolean, default=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    office = db.relationship("Office", foreign_keys=[office_id])

    def __repr__(self):
        return f"{self.first_name} {self.last_name}"

    # ---- Flask-Login integration ----
    @property
    def is_active(self):
        return bool(self.active)

    def set_password(self, raw_password):
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password_hash, raw_password)

    # ---- Role-based permission lookup ----
    def get_role_names(self):
        role_ids = [ur.role_id for ur in UserRole.query.filter_by(user_id=self.id).all()]
        if not role_ids:
            return []
        roles = Role.query.filter(Role.id.in_(role_ids)).all()
        return [r.description for r in roles]

    def get_permission_codes(self):
        role_ids = [ur.role_id for ur in UserRole.query.filter_by(user_id=self.id).all()]
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
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), primary_key=True)
    role_id = db.Column(db.String(36), db.ForeignKey("role.id"), primary_key=True)

    user = db.relationship("User", foreign_keys=[user_id])
    role = db.relationship("Role", foreign_keys=[role_id])

    def __repr__(self):
        return f"{self.user_id} -> {self.role_id}"


# =====================================================================
# SECTION C — DOCUMENT TYPES
# =====================================================================

class DocumentType(db.Model):
    __tablename__ = "document_types"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    code = db.Column(db.String(50), unique=True, nullable=False)
    name_ar = db.Column(db.String(255), nullable=False)
    name_en = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100))
    validation_rules = db.Column(db.JSON)
    required_fields = db.Column(db.JSON)
    validity_duration = db.Column(db.Integer)
    issuing_authorities = db.Column(db.JSON)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return self.name_en or self.code


# =====================================================================
# SECTION D — CITIZENS, LINEAGE & HOUSEHOLDS
# =====================================================================

class Citizen(db.Model):
    __tablename__ = "citizens"
    civil_registry_number = db.Column(db.String(50), primary_key=True)
    first_name_ar = db.Column(db.String(100))
    middle_name_ar = db.Column(db.String(100))
    last_name_ar = db.Column(db.String(100))
    first_name_en = db.Column(db.String(100))
    middle_name_en = db.Column(db.String(100))
    last_name_en = db.Column(db.String(100))
    father_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"))
    mother_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"))
    father_name = db.Column(db.String(150))
    mother_name = db.Column(db.String(150))
    date_of_birth = db.Column(db.Date)
    place_of_birth = db.Column(db.String(150))
    gender = db.Column(db.String(10))
    religion = db.Column(db.String(50))
    sect = db.Column(db.String(50))
    marital_status = db.Column(db.String(30))
    civil_status_record = db.Column(db.String(100))
    registration_office_id = db.Column(db.String(36), db.ForeignKey("offices.id"))
    nationality = db.Column(db.String(50), default="citizen")
    is_deceased = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    father = db.relationship("Citizen", remote_side=[civil_registry_number], foreign_keys=[father_id])
    mother = db.relationship("Citizen", remote_side=[civil_registry_number], foreign_keys=[mother_id])
    registration_office = db.relationship("Office", foreign_keys=[registration_office_id])

    def __repr__(self):
        name = f"{self.first_name_en or self.first_name_ar or ''} {self.last_name_en or self.last_name_ar or ''}".strip()
        return f"{name} ({self.civil_registry_number})" if name else self.civil_registry_number


class FamilyRecord(db.Model):
    __tablename__ = "family_records"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    family_book_number = db.Column(db.String(50), unique=True, nullable=False)
    head_of_household_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"))
    registration_office_id = db.Column(db.String(36), db.ForeignKey("offices.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    head_of_household = db.relationship("Citizen", foreign_keys=[head_of_household_id])
    registration_office = db.relationship("Office", foreign_keys=[registration_office_id])

    def __repr__(self):
        return self.family_book_number


class FamilyMember(db.Model):
    __tablename__ = "family_members"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    family_record_id = db.Column(db.String(36), db.ForeignKey("family_records.id"), nullable=False)
    citizen_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    relationship_ = db.Column("relationship", db.String(50))
    joined_date = db.Column(db.Date)
    left_date = db.Column(db.Date)
    left_reason = db.Column(db.String(150))
    __table_args__ = (db.UniqueConstraint("family_record_id", "citizen_id"),)

    family_record = db.relationship("FamilyRecord", foreign_keys=[family_record_id])
    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])

    def __repr__(self):
        return f"{self.citizen_id} in {self.family_record_id} ({self.relationship_})"


# =====================================================================
# SECTION E — DOCUMENTS (core table)
# =====================================================================

class Document(db.Model):
    __tablename__ = "documents"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    document_type_id = db.Column(db.String(36), db.ForeignKey("document_types.id"), nullable=False)
    civil_registry_number = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"))
    document_number = db.Column(db.String(100))
    issue_date = db.Column(db.Date)
    expiry_date = db.Column(db.Date)
    issuing_authority = db.Column(db.String(150))
    issuing_office_id = db.Column(db.String(36), db.ForeignKey("offices.id"))
    physical_file_location = db.Column(db.String(255))
    digital_file_path = db.Column(db.String(500))
    file_hash = db.Column(db.String(255))
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    status = db.Column(db.String(30), default="draft")
    validation_status = db.Column(db.String(30), default="pending")
    validated_by = db.Column(db.String(36), db.ForeignKey("users.id"))
    validated_at = db.Column(db.DateTime)
    rejection_reason = db.Column(db.Text)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_by = db.Column(db.String(36), db.ForeignKey("users.id"))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    version = db.Column(db.Integer, default=1)
    is_latest = db.Column(db.Boolean, default=True)

    document_type = db.relationship("DocumentType", foreign_keys=[document_type_id])
    citizen = db.relationship("Citizen", foreign_keys=[civil_registry_number])
    issuing_office = db.relationship("Office", foreign_keys=[issuing_office_id])
    validator = db.relationship("User", foreign_keys=[validated_by])
    creator = db.relationship("User", foreign_keys=[created_by])
    updater = db.relationship("User", foreign_keys=[updated_by])

    def __repr__(self):
        return f"{self.document_type.name_en if self.document_type else 'Document'} · {self.document_number or self.id[:8]}"


# =====================================================================
# SECTION F — DOCUMENT SUBTYPES (1-1 extensions of documents)
# =====================================================================

class BirthCertificate(db.Model):
    __tablename__ = "birth_certificates"
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), primary_key=True)
    citizen_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"))
    birth_place = db.Column(db.String(150))
    birth_hospital = db.Column(db.String(150))
    birth_attendant = db.Column(db.String(150))
    father_full_name = db.Column(db.String(150))
    mother_full_name = db.Column(db.String(150))
    registration_number = db.Column(db.String(100))
    registrar_name = db.Column(db.String(150))

    document = db.relationship("Document", foreign_keys=[document_id])
    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])

    def __repr__(self):
        return f"Birth Cert. {self.registration_number or self.document_id[:8]}"


class MarriageCertificate(db.Model):
    __tablename__ = "marriage_certificates"
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), primary_key=True)
    husband_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"))
    wife_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"))
    marriage_date = db.Column(db.Date)
    marriage_place = db.Column(db.String(150))
    court_id = db.Column(db.String(36), db.ForeignKey("courts.id"))
    religious_authority_id = db.Column(db.String(36), db.ForeignKey("religious_authorities.id"))
    contract_number = db.Column(db.String(100))
    dowry_amount = db.Column(db.Numeric(12, 2))
    status = db.Column(db.String(30), default="active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document = db.relationship("Document", foreign_keys=[document_id])
    husband = db.relationship("Citizen", foreign_keys=[husband_id])
    wife = db.relationship("Citizen", foreign_keys=[wife_id])
    court = db.relationship("Court", foreign_keys=[court_id])
    religious_authority = db.relationship("ReligiousAuthority", foreign_keys=[religious_authority_id])

    def __repr__(self):
        return f"Marriage {self.contract_number or self.document_id[:8]}"


class DivorceCertificate(db.Model):
    __tablename__ = "divorce_certificates"
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), primary_key=True)
    marriage_certificate_id = db.Column(db.String(36), db.ForeignKey("marriage_certificates.document_id"), unique=True)
    husband_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"))
    wife_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"))
    divorce_date = db.Column(db.Date)
    divorce_place = db.Column(db.String(150))
    court_id = db.Column(db.String(36), db.ForeignKey("courts.id"))
    court_decision_number = db.Column(db.String(100))
    divorce_type = db.Column(db.String(50))
    divorce_reason = db.Column(db.Text)
    child_custody_agreement = db.Column(db.Text)
    financial_settlement = db.Column(db.Text)
    religious_authority_id = db.Column(db.String(36), db.ForeignKey("religious_authorities.id"))
    sharia_court_approval = db.Column(db.String(100))
    status = db.Column(db.String(30), default="finalized")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document = db.relationship("Document", foreign_keys=[document_id])
    marriage_certificate = db.relationship("MarriageCertificate", foreign_keys=[marriage_certificate_id])
    husband = db.relationship("Citizen", foreign_keys=[husband_id])
    wife = db.relationship("Citizen", foreign_keys=[wife_id])
    court = db.relationship("Court", foreign_keys=[court_id])
    religious_authority = db.relationship("ReligiousAuthority", foreign_keys=[religious_authority_id])

    def __repr__(self):
        return f"Divorce {self.court_decision_number or self.document_id[:8]}"


class DeathCertificate(db.Model):
    __tablename__ = "death_certificates"
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), primary_key=True)
    deceased_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"), unique=True)
    death_date = db.Column(db.Date)
    death_place = db.Column(db.String(150))
    death_cause = db.Column(db.Text)
    certifying_physician = db.Column(db.String(150))
    burial_place = db.Column(db.String(150))
    burial_date = db.Column(db.Date)

    document = db.relationship("Document", foreign_keys=[document_id])
    deceased = db.relationship("Citizen", foreign_keys=[deceased_id])

    def __repr__(self):
        return f"Death Cert. {self.document_id[:8]}"


class NationalIdCard(db.Model):
    __tablename__ = "national_id_cards"
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), primary_key=True)
    citizen_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    card_number = db.Column(db.String(50), unique=True, nullable=False)
    issue_date = db.Column(db.Date)
    expiry_date = db.Column(db.Date)
    biometric_photo_path = db.Column(db.String(500))
    fingerprint_hash = db.Column(db.String(255))
    chip_serial_number = db.Column(db.String(100))
    status = db.Column(db.String(30), default="active")

    document = db.relationship("Document", foreign_keys=[document_id])
    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])

    def __repr__(self):
        return f"ID Card {self.card_number}"


class Passport(db.Model):
    __tablename__ = "passports"
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), primary_key=True)
    citizen_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    passport_number = db.Column(db.String(50), unique=True, nullable=False)
    passport_type = db.Column(db.String(30))
    issue_date = db.Column(db.Date)
    expiry_date = db.Column(db.Date)
    issuing_office_id = db.Column(db.String(36), db.ForeignKey("offices.id"))
    page_count = db.Column(db.Integer)
    status = db.Column(db.String(30), default="active")

    document = db.relationship("Document", foreign_keys=[document_id])
    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])
    issuing_office = db.relationship("Office", foreign_keys=[issuing_office_id])

    def __repr__(self):
        return f"Passport {self.passport_number}"


class NaturalizationRecord(db.Model):
    __tablename__ = "naturalization_records"
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), primary_key=True)
    citizen_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    previous_nationality = db.Column(db.String(100))
    naturalization_date = db.Column(db.Date)
    decree_number = db.Column(db.String(100))
    decree_date = db.Column(db.Date)
    status = db.Column(db.String(30), default="approved")

    document = db.relationship("Document", foreign_keys=[document_id])
    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])

    def __repr__(self):
        return f"Naturalization {self.decree_number or self.document_id[:8]}"


class NameChangeRecord(db.Model):
    __tablename__ = "name_change_records"
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), primary_key=True)
    citizen_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    old_first_name = db.Column(db.String(100))
    old_middle_name = db.Column(db.String(100))
    old_last_name = db.Column(db.String(100))
    new_first_name = db.Column(db.String(100))
    new_middle_name = db.Column(db.String(100))
    new_last_name = db.Column(db.String(100))
    reason = db.Column(db.Text)
    court_decision_number = db.Column(db.String(100))
    change_date = db.Column(db.Date)

    document = db.relationship("Document", foreign_keys=[document_id])
    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])

    def __repr__(self):
        return f"Name Change {self.document_id[:8]}"


# =====================================================================
# SECTION G — VALIDATION & PHYSICAL HANDLING
# =====================================================================

class DocumentValidation(db.Model):
    __tablename__ = "document_validations"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=False)
    validator_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    validation_type = db.Column(db.String(50))
    status = db.Column(db.String(30), default="pending")
    comments = db.Column(db.Text)
    validation_date = db.Column(db.DateTime, default=datetime.utcnow)
    digital_signature = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(255))

    document = db.relationship("Document", foreign_keys=[document_id])
    validator = db.relationship("User", foreign_keys=[validator_id])

    def __repr__(self):
        return f"Validation {self.status} · {self.document_id[:8]}"


class PhysicalDocumentHandling(db.Model):
    __tablename__ = "physical_document_handling"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    performed_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    performed_by_name = db.Column(db.String(150))
    performed_by_role = db.Column(db.String(100))
    performed_at = db.Column(db.DateTime, default=datetime.utcnow)
    location = db.Column(db.String(150))
    location_details = db.Column(db.Text)
    notes = db.Column(db.Text)
    action_reason = db.Column(db.Text)
    witness_id = db.Column(db.String(36))
    witness_signature = db.Column(db.Text)

    document = db.relationship("Document", foreign_keys=[document_id])
    performer = db.relationship("User", foreign_keys=[performed_by])

    def __repr__(self):
        return f"{self.action} · {self.document_id[:8]}"


# =====================================================================
# SECTION H — SERVICE REQUEST WORKFLOW
# =====================================================================

class ServiceRequest(db.Model):
    __tablename__ = "service_requests"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    request_number = db.Column(db.String(50), unique=True, nullable=False)
    citizen_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    document_type_id = db.Column(db.String(36), db.ForeignKey("document_types.id"), nullable=False)
    requested_by_user_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    status = db.Column(db.String(30), default="submitted")
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_by = db.Column(db.String(36), db.ForeignKey("users.id"))
    reviewed_at = db.Column(db.DateTime)
    approved_at = db.Column(db.DateTime)
    rejection_reason = db.Column(db.Text)
    issued_document_id = db.Column(db.String(36), db.ForeignKey("documents.id"))
    fee_amount = db.Column(db.Numeric(10, 2))
    payment_status = db.Column(db.String(30), default="unpaid")
    notes = db.Column(db.Text)

    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])
    document_type = db.relationship("DocumentType", foreign_keys=[document_type_id])
    requested_by = db.relationship("User", foreign_keys=[requested_by_user_id])
    reviewer = db.relationship("User", foreign_keys=[reviewed_by])
    issued_document = db.relationship("Document", foreign_keys=[issued_document_id])

    def __repr__(self):
        return f"Request {self.request_number} ({self.status})"


# =====================================================================
# SECTION I — AUDIT & ACCESS LOGS
# =====================================================================

class CitizenAuditLog(db.Model):
    __tablename__ = "citizen_audit_log"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    citizen_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    field_name = db.Column(db.String(100), nullable=False)
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    changed_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    reason = db.Column(db.String(255))

    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])
    changed_by_user = db.relationship("User", foreign_keys=[changed_by])

    def __repr__(self):
        return f"{self.field_name} changed on {self.citizen_id}"


class RecordAccessLog(db.Model):
    __tablename__ = "record_access_log"
    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    citizen_id = db.Column(db.String(50), db.ForeignKey("citizens.civil_registry_number"), nullable=False)
    accessed_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    access_type = db.Column(db.String(50), nullable=False)
    accessed_at = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(45))
    reason = db.Column(db.String(255))

    citizen = db.relationship("Citizen", foreign_keys=[citizen_id])
    accessed_by_user = db.relationship("User", foreign_keys=[accessed_by])

    def __repr__(self):
        return f"{self.access_type} on {self.citizen_id}"
