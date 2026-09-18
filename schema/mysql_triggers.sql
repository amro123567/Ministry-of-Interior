-- ====================================================================
-- Triggers - MySQL
--
-- The SQLite equivalents live in migrations/versions/0005_triggers.py.
-- They are written separately rather than generated from one source
-- because the two dialects differ on trigger syntax, on how a trigger
-- raises an error (RAISE(ABORT) against SIGNAL SQLSTATE), and on whether
-- one trigger may serve several events. A lowest-common-denominator
-- version would be worse on both engines.
-- ====================================================================

DELIMITER $$

-- --------------------------------------------------------------------
-- Automation: a state change writes its own history row.
-- The README states the audit tables are "meant to be populated by
-- application logic (or triggers), never hand-edited". There was neither,
-- so changing a request's state recorded nothing.
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_request_state_history$$
CREATE TRIGGER trg_request_state_history
AFTER UPDATE ON service_requests
FOR EACH ROW
BEGIN
    IF NOT (OLD.workflow_state_id <=> NEW.workflow_state_id) THEN
        INSERT INTO service_request_status_history
            (service_request_id, from_state_id, to_state_id, transition_id,
             changed_by, changed_at, comment)
        SELECT NEW.id, OLD.workflow_state_id, NEW.workflow_state_id,
               (SELECT t.id FROM workflow_transitions t
                 WHERE t.from_state_id = OLD.workflow_state_id
                   AND t.to_state_id   = NEW.workflow_state_id
                 LIMIT 1),
               COALESCE(NEW.approved_by, NEW.rejected_by, NEW.reviewed_by,
                        NEW.requested_by_user_id),
               NOW(),
               CASE WHEN NEW.rejection_reason IS NOT NULL
                      AND OLD.rejection_reason IS NULL
                    THEN NEW.rejection_reason END;
    END IF;
END$$

-- --------------------------------------------------------------------
-- Automation: reaching a final state settles the SLA record.
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_request_sla_close$$
CREATE TRIGGER trg_request_sla_close
AFTER UPDATE ON service_requests
FOR EACH ROW
BEGIN
    IF NOT (OLD.workflow_state_id <=> NEW.workflow_state_id) THEN
        UPDATE sla_records
           SET sla_status = CASE
                   WHEN (SELECT ws.is_final FROM workflow_states ws
                          WHERE ws.id = NEW.workflow_state_id) = 1
                        THEN CASE WHEN CURDATE() <= due_date THEN 'MET' ELSE 'BREACHED' END
                   WHEN CURDATE() > due_date THEN 'OVERDUE'
                   WHEN DATEDIFF(due_date, CURDATE()) <= 3 THEN 'DUE_SOON'
                   ELSE 'ON_TRACK' END,
               days_remaining  = DATEDIFF(due_date, CURDATE()),
               overdue_by_days = CASE WHEN CURDATE() > due_date
                                      THEN DATEDIFF(CURDATE(), due_date) END,
               breached_at     = CASE WHEN CURDATE() > due_date AND breached_at IS NULL
                                      THEN NOW() ELSE breached_at END,
               last_checked_at = NOW()
         WHERE service_request_id = NEW.id;
    END IF;
END$$

-- --------------------------------------------------------------------
-- Automation: an amended citizen field writes its own audit row.
-- citizen_audit_log.changed_by is NOT NULL, so a row is written only when
-- the amending user is known.
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_citizens_audit$$
CREATE TRIGGER trg_citizens_audit
AFTER UPDATE ON citizens
FOR EACH ROW
BEGIN
    DECLARE actor BIGINT;
    SET actor = COALESCE(NEW.updated_by, OLD.updated_by);
    IF actor IS NOT NULL THEN
        IF NOT (OLD.last_name_en <=> NEW.last_name_en) THEN
            INSERT INTO citizen_audit_log (citizen_id, field_name, old_value, new_value,
                                           changed_by, changed_at, reason)
            VALUES (NEW.civil_registry_number, 'last_name_en', OLD.last_name_en,
                    NEW.last_name_en, actor, NOW(), 'Recorded by database trigger');
        END IF;
        IF NOT (OLD.first_name_en <=> NEW.first_name_en) THEN
            INSERT INTO citizen_audit_log (citizen_id, field_name, old_value, new_value,
                                           changed_by, changed_at, reason)
            VALUES (NEW.civil_registry_number, 'first_name_en', OLD.first_name_en,
                    NEW.first_name_en, actor, NOW(), 'Recorded by database trigger');
        END IF;
        IF NOT (OLD.last_name_ar <=> NEW.last_name_ar) THEN
            INSERT INTO citizen_audit_log (citizen_id, field_name, old_value, new_value,
                                           changed_by, changed_at, reason)
            VALUES (NEW.civil_registry_number, 'last_name_ar', OLD.last_name_ar,
                    NEW.last_name_ar, actor, NOW(), 'Recorded by database trigger');
        END IF;
        IF NOT (OLD.date_of_birth <=> NEW.date_of_birth) THEN
            INSERT INTO citizen_audit_log (citizen_id, field_name, old_value, new_value,
                                           changed_by, changed_at, reason)
            VALUES (NEW.civil_registry_number, 'date_of_birth', OLD.date_of_birth,
                    NEW.date_of_birth, actor, NOW(), 'Recorded by database trigger');
        END IF;
        IF NOT (OLD.marital_status <=> NEW.marital_status) THEN
            INSERT INTO citizen_audit_log (citizen_id, field_name, old_value, new_value,
                                           changed_by, changed_at, reason)
            VALUES (NEW.civil_registry_number, 'marital_status', OLD.marital_status,
                    NEW.marital_status, actor, NOW(), 'Recorded by database trigger');
        END IF;
        IF NOT (OLD.is_deceased <=> NEW.is_deceased) THEN
            INSERT INTO citizen_audit_log (citizen_id, field_name, old_value, new_value,
                                           changed_by, changed_at, reason)
            VALUES (NEW.civil_registry_number, 'is_deceased', OLD.is_deceased,
                    NEW.is_deceased, actor, NOW(), 'Recorded by database trigger');
        END IF;
    END IF;
END$$

-- --------------------------------------------------------------------
-- SDD 6.5.7 rule 2 / D-17: status transitions follow a legal sequence.
-- workflow_transitions describes which moves are legal; without this,
-- nothing consulted it and a request could go from SUBMITTED straight to
-- ISSUED, skipping review and approval.
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_request_legal_transition$$
CREATE TRIGGER trg_request_legal_transition
BEFORE UPDATE ON service_requests
FOR EACH ROW
BEGIN
    IF OLD.workflow_state_id IS NOT NULL
       AND NEW.workflow_state_id IS NOT NULL
       AND NOT (OLD.workflow_state_id <=> NEW.workflow_state_id)
       AND NOT EXISTS (SELECT 1 FROM workflow_transitions t
                        WHERE t.from_state_id = OLD.workflow_state_id
                          AND t.to_state_id   = NEW.workflow_state_id
                          AND t.is_active = 1) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Illegal workflow transition: no active transition is defined between these states';
    END IF;
END$$

-- --------------------------------------------------------------------
-- SDD 6.5.7 rule 9: a parent's date of birth precedes their child's.
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_citizens_parent_dob_ins$$
CREATE TRIGGER trg_citizens_parent_dob_ins
BEFORE INSERT ON citizens
FOR EACH ROW
BEGIN
    IF NEW.date_of_birth IS NOT NULL
       AND (EXISTS (SELECT 1 FROM citizens p
                     WHERE p.civil_registry_number = NEW.father_id
                       AND p.date_of_birth >= NEW.date_of_birth)
         OR EXISTS (SELECT 1 FROM citizens p
                     WHERE p.civil_registry_number = NEW.mother_id
                       AND p.date_of_birth >= NEW.date_of_birth)) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A parent date of birth must precede the child date of birth';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_citizens_parent_dob$$
CREATE TRIGGER trg_citizens_parent_dob
BEFORE UPDATE ON citizens
FOR EACH ROW
BEGIN
    IF NEW.date_of_birth IS NOT NULL
       AND (EXISTS (SELECT 1 FROM citizens p
                     WHERE p.civil_registry_number = NEW.father_id
                       AND p.date_of_birth >= NEW.date_of_birth)
         OR EXISTS (SELECT 1 FROM citizens p
                     WHERE p.civil_registry_number = NEW.mother_id
                       AND p.date_of_birth >= NEW.date_of_birth)) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A parent date of birth must precede the child date of birth';
    END IF;
END$$

-- --------------------------------------------------------------------
-- SDD 6.5.7 rule 7: a mukhtar's attestation falls within their term.
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_documents_mukhtar_term$$
CREATE TRIGGER trg_documents_mukhtar_term
BEFORE INSERT ON documents
FOR EACH ROW
BEGIN
    IF NEW.attested_by_mukhtar_id IS NOT NULL AND NEW.issue_date IS NOT NULL
       AND EXISTS (SELECT 1 FROM mukhtars mk
                    WHERE mk.id = NEW.attested_by_mukhtar_id
                      AND (NEW.issue_date < mk.term_start
                        OR (mk.term_end IS NOT NULL AND NEW.issue_date > mk.term_end))) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Mukhtar attestation date falls outside the mukhtar term of office';
    END IF;
END$$

DELIMITER ;

DELIMITER $$

-- ====================================================================
-- Rules held as CHECK constraints on SQLite but not expressible as CHECK
-- constraints here. MySQL and MariaDB both refuse a CHECK that references
-- a column carrying a foreign key referential action, and both refuse a
-- non-deterministic function inside one. The rules are identical; only the
-- mechanism differs.
-- ====================================================================

DROP TRIGGER IF EXISTS trg_ck_citizens_dob_ins$$
CREATE TRIGGER trg_ck_citizens_dob_ins BEFORE INSERT ON citizens FOR EACH ROW
BEGIN
    IF NEW.date_of_birth > CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'date_of_birth may not be in the future';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ck_citizens_dob_upd$$
CREATE TRIGGER trg_ck_citizens_dob_upd BEFORE UPDATE ON citizens FOR EACH ROW
BEGIN
    IF NEW.date_of_birth > CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'date_of_birth may not be in the future';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ck_documents_soft_delete_ins$$
CREATE TRIGGER trg_ck_documents_soft_delete_ins BEFORE INSERT ON documents FOR EACH ROW
BEGIN
    IF NEW.is_deleted = 1 AND (NEW.deleted_by IS NULL OR NEW.deleted_at IS NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A soft-deleted document must record deleted_by and deleted_at';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ck_documents_soft_delete_upd$$
CREATE TRIGGER trg_ck_documents_soft_delete_upd BEFORE UPDATE ON documents FOR EACH ROW
BEGIN
    IF NEW.is_deleted = 1 AND (NEW.deleted_by IS NULL OR NEW.deleted_at IS NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A soft-deleted document must record deleted_by and deleted_at';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ck_guardianship_distinct_ins$$
CREATE TRIGGER trg_ck_guardianship_distinct_ins BEFORE INSERT ON guardianship_records FOR EACH ROW
BEGIN
    IF NEW.minor_citizen_id = NEW.guardian_citizen_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A citizen may not be their own guardian';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ck_transfer_offices_ins$$
CREATE TRIGGER trg_ck_transfer_offices_ins BEFORE INSERT ON registry_transfers FOR EACH ROW
BEGIN
    IF NEW.from_office_id = NEW.to_office_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A registry transfer must move between two different offices';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ck_requests_rejection_ins$$
CREATE TRIGGER trg_ck_requests_rejection_ins BEFORE INSERT ON service_requests FOR EACH ROW
BEGIN
    IF NEW.rejected_by IS NOT NULL AND NEW.rejection_reason IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A rejected request must record a rejection_reason';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_ck_requests_rejection_upd$$
CREATE TRIGGER trg_ck_requests_rejection_upd BEFORE UPDATE ON service_requests FOR EACH ROW
BEGIN
    IF NEW.rejected_by IS NOT NULL AND NEW.rejection_reason IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A rejected request must record a rejection_reason';
    END IF;
END$$

DELIMITER ;
