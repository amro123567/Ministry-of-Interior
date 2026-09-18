"""Database-level automation and the integrity rules a CHECK cannot express

Revision ID: 0005_triggers
Revises: 0004_refactions

Three of these triggers close a gap the README already described and the
schema never filled: it says the audit tables "are meant to be populated by
application logic (or triggers), never hand-edited". There was no such logic
and there were no triggers, so changing a service request's state recorded
nothing, amending a citizen recorded nothing, and an SLA record kept whatever
value it was seeded with. The history tables held rows because the seed wrote
them, not because the system produced them.

  trg_request_state_history   a state change writes its own history row
  trg_request_sla_close       reaching a final state settles the SLA record
  trg_citizens_audit          an amended citizen field writes its own audit row

Two more enforce rules from SDD 6.5.7 that a single-row CHECK cannot reach,
because both need a second row to evaluate:

  trg_citizens_parent_dob     rule 9 -- a parent's date of birth precedes
                              their child's
  trg_documents_mukhtar_term  rule 7 -- a mukhtar's attestation falls within
                              their term of office

And one enforces rule 2, the legal transition sequence. The workflow_states
and workflow_transitions tables were added to describe which moves are legal
(D-17, CPP objective O3), but nothing consulted them: a request could go from
SUBMITTED straight to ISSUED, skipping review and approval entirely, and the
database would accept it. It no longer does.

MySQL equivalents are emitted by the DDL script rather than translated here;
the two dialects differ on trigger syntax, on how a trigger raises an error,
and on multi-event triggers, and a lowest-common-denominator version would be
worse on both.
"""
from alembic import op

revision = "0005_triggers"
down_revision = "0004_refactions"
branch_labels = None
depends_on = None


SQLITE_TRIGGERS = {
    # ---- automation -------------------------------------------------------
    "trg_request_state_history": """
CREATE TRIGGER trg_request_state_history
AFTER UPDATE OF workflow_state_id ON service_requests
FOR EACH ROW WHEN OLD.workflow_state_id IS NOT NEW.workflow_state_id
BEGIN
    INSERT INTO service_request_status_history
        (service_request_id, from_state_id, to_state_id, transition_id,
         changed_by, changed_at, comment)
    SELECT NEW.id, OLD.workflow_state_id, NEW.workflow_state_id,
           (SELECT t.id FROM workflow_transitions t
             WHERE t.from_state_id = OLD.workflow_state_id
               AND t.to_state_id   = NEW.workflow_state_id),
           COALESCE(NEW.approved_by, NEW.rejected_by, NEW.reviewed_by,
                    NEW.requested_by_user_id),
           CURRENT_TIMESTAMP,
           CASE WHEN NEW.rejection_reason IS NOT NULL
                  AND OLD.rejection_reason IS NULL
                THEN NEW.rejection_reason END;
END;
""",
    "trg_request_sla_close": """
CREATE TRIGGER trg_request_sla_close
AFTER UPDATE OF workflow_state_id ON service_requests
FOR EACH ROW WHEN OLD.workflow_state_id IS NOT NEW.workflow_state_id
BEGIN
    UPDATE sla_records
       SET sla_status = CASE
               WHEN (SELECT ws.is_final FROM workflow_states ws
                      WHERE ws.id = NEW.workflow_state_id) = 1
                    THEN CASE WHEN DATE('now') <= due_date THEN 'MET' ELSE 'BREACHED' END
               WHEN DATE('now') > due_date THEN 'OVERDUE'
               WHEN JULIANDAY(due_date) - JULIANDAY(DATE('now')) <= 3 THEN 'DUE_SOON'
               ELSE 'ON_TRACK' END,
           days_remaining  = CAST(JULIANDAY(due_date) - JULIANDAY(DATE('now')) AS INTEGER),
           overdue_by_days = CASE WHEN DATE('now') > due_date
                THEN CAST(JULIANDAY(DATE('now')) - JULIANDAY(due_date) AS INTEGER) END,
           breached_at = CASE
                WHEN DATE('now') > due_date AND breached_at IS NULL
                THEN CURRENT_TIMESTAMP ELSE breached_at END,
           last_checked_at = CURRENT_TIMESTAMP
     WHERE service_request_id = NEW.id;
END;
""",
    # citizen_audit_log.changed_by is NOT NULL, so a row is written only when
    # the amending user is known. An update that does not say who made it
    # leaves no audit row rather than failing the update -- the alternative
    # would make the trigger a denial-of-service on any careless UPDATE.
    "trg_citizens_audit": """
CREATE TRIGGER trg_citizens_audit
AFTER UPDATE ON citizens
FOR EACH ROW WHEN COALESCE(NEW.updated_by, OLD.updated_by) IS NOT NULL
BEGIN
    INSERT INTO citizen_audit_log
        (citizen_id, field_name, old_value, new_value, changed_by, changed_at, reason)
    SELECT NEW.civil_registry_number, 'last_name_en', OLD.last_name_en, NEW.last_name_en,
           COALESCE(NEW.updated_by, OLD.updated_by), CURRENT_TIMESTAMP,
           'Recorded by database trigger'
     WHERE IFNULL(OLD.last_name_en,'') <> IFNULL(NEW.last_name_en,'');

    INSERT INTO citizen_audit_log
        (citizen_id, field_name, old_value, new_value, changed_by, changed_at, reason)
    SELECT NEW.civil_registry_number, 'first_name_en', OLD.first_name_en, NEW.first_name_en,
           COALESCE(NEW.updated_by, OLD.updated_by), CURRENT_TIMESTAMP,
           'Recorded by database trigger'
     WHERE IFNULL(OLD.first_name_en,'') <> IFNULL(NEW.first_name_en,'');

    INSERT INTO citizen_audit_log
        (citizen_id, field_name, old_value, new_value, changed_by, changed_at, reason)
    SELECT NEW.civil_registry_number, 'last_name_ar', OLD.last_name_ar, NEW.last_name_ar,
           COALESCE(NEW.updated_by, OLD.updated_by), CURRENT_TIMESTAMP,
           'Recorded by database trigger'
     WHERE IFNULL(OLD.last_name_ar,'') <> IFNULL(NEW.last_name_ar,'');

    INSERT INTO citizen_audit_log
        (citizen_id, field_name, old_value, new_value, changed_by, changed_at, reason)
    SELECT NEW.civil_registry_number, 'date_of_birth', OLD.date_of_birth, NEW.date_of_birth,
           COALESCE(NEW.updated_by, OLD.updated_by), CURRENT_TIMESTAMP,
           'Recorded by database trigger'
     WHERE IFNULL(OLD.date_of_birth,'') <> IFNULL(NEW.date_of_birth,'');

    INSERT INTO citizen_audit_log
        (citizen_id, field_name, old_value, new_value, changed_by, changed_at, reason)
    SELECT NEW.civil_registry_number, 'marital_status', OLD.marital_status, NEW.marital_status,
           COALESCE(NEW.updated_by, OLD.updated_by), CURRENT_TIMESTAMP,
           'Recorded by database trigger'
     WHERE IFNULL(OLD.marital_status,'') <> IFNULL(NEW.marital_status,'');

    INSERT INTO citizen_audit_log
        (citizen_id, field_name, old_value, new_value, changed_by, changed_at, reason)
    SELECT NEW.civil_registry_number, 'is_deceased', OLD.is_deceased, NEW.is_deceased,
           COALESCE(NEW.updated_by, OLD.updated_by), CURRENT_TIMESTAMP,
           'Recorded by database trigger'
     WHERE IFNULL(OLD.is_deceased,'') <> IFNULL(NEW.is_deceased,'');
END;
""",
    # ---- integrity rules that need a second row ---------------------------
    "trg_request_legal_transition": """
CREATE TRIGGER trg_request_legal_transition
BEFORE UPDATE OF workflow_state_id ON service_requests
FOR EACH ROW
WHEN OLD.workflow_state_id IS NOT NULL
 AND NEW.workflow_state_id IS NOT NULL
 AND OLD.workflow_state_id IS NOT NEW.workflow_state_id
 AND NOT EXISTS (SELECT 1 FROM workflow_transitions t
                  WHERE t.from_state_id = OLD.workflow_state_id
                    AND t.to_state_id   = NEW.workflow_state_id
                    AND t.is_active = 1)
BEGIN
    SELECT RAISE(ABORT, 'Illegal workflow transition: no active transition is defined between these states');
END;
""",
    "trg_citizens_parent_dob": """
CREATE TRIGGER trg_citizens_parent_dob
BEFORE UPDATE OF date_of_birth, father_id, mother_id ON citizens
FOR EACH ROW
WHEN NEW.date_of_birth IS NOT NULL
 AND (EXISTS (SELECT 1 FROM citizens p WHERE p.civil_registry_number = NEW.father_id
                AND p.date_of_birth >= NEW.date_of_birth)
   OR EXISTS (SELECT 1 FROM citizens p WHERE p.civil_registry_number = NEW.mother_id
                AND p.date_of_birth >= NEW.date_of_birth))
BEGIN
    SELECT RAISE(ABORT, 'A parent date of birth must precede the child date of birth');
END;
""",
    "trg_citizens_parent_dob_ins": """
CREATE TRIGGER trg_citizens_parent_dob_ins
BEFORE INSERT ON citizens
FOR EACH ROW
WHEN NEW.date_of_birth IS NOT NULL
 AND (EXISTS (SELECT 1 FROM citizens p WHERE p.civil_registry_number = NEW.father_id
                AND p.date_of_birth >= NEW.date_of_birth)
   OR EXISTS (SELECT 1 FROM citizens p WHERE p.civil_registry_number = NEW.mother_id
                AND p.date_of_birth >= NEW.date_of_birth))
BEGIN
    SELECT RAISE(ABORT, 'A parent date of birth must precede the child date of birth');
END;
""",
    "trg_documents_mukhtar_term": """
CREATE TRIGGER trg_documents_mukhtar_term
BEFORE INSERT ON documents
FOR EACH ROW
WHEN NEW.attested_by_mukhtar_id IS NOT NULL AND NEW.issue_date IS NOT NULL
 AND EXISTS (SELECT 1 FROM mukhtars mk
              WHERE mk.id = NEW.attested_by_mukhtar_id
                AND (NEW.issue_date < mk.term_start
                  OR (mk.term_end IS NOT NULL AND NEW.issue_date > mk.term_end)))
BEGIN
    SELECT RAISE(ABORT, 'Mukhtar attestation date falls outside the mukhtar term of office');
END;
""",
}


def upgrade():
    if op.get_bind().dialect.name != "sqlite":
        # MySQL triggers ship with the DDL script; see the module docstring.
        return
    for sql in SQLITE_TRIGGERS.values():
        op.execute(sql)


def downgrade():
    if op.get_bind().dialect.name != "sqlite":
        return
    for name in SQLITE_TRIGGERS:
        op.execute(f"DROP TRIGGER IF EXISTS {name}")
