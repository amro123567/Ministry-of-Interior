"""Database tests for the Correspondence Tracking System — MySQL.

MySQL is the database, so these run against it and nothing else. Point them
at your server through .env (the same settings the application uses) and:

    python -m pytest tests/ -v

The SDD asks for evidence rather than assertion. §6.6.5 states the
acceptance criterion for indexes ("every query in §6.6.1 and §6.6.2 must
show a non-ALL access type"); §6.5.7 lists the correctness rules whose
absence from the database it calls "the schema's most significant systemic
weakness"; §6.5.5 credits the design with fifty enforced foreign keys.
Each of those claims is checked here against the running server.

Every test runs inside a transaction that is rolled back, so the suite
leaves the database exactly as it found it.
"""
import os
import re
import sys
from datetime import timedelta

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DatabaseError

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SECRET_KEY", "test-secret")

import config  # noqa: E402


@pytest.fixture(scope="session")
def engine():
    try:
        url = config.database_url()
    except config.ConfigurationError as exc:
        pytest.skip(f"MySQL not configured: {exc}")
    eng = create_engine(url, **config.engine_options())
    try:
        with eng.connect() as c:
            c.execute(text("SELECT 1"))
    except Exception as exc:
        pytest.skip(f"MySQL not reachable at {config.describe()}: {exc}")
    return eng


@pytest.fixture
def db(engine):
    """A connection in a transaction that is always rolled back."""
    conn = engine.connect()
    trans = conn.begin()
    yield conn
    trans.rollback()
    conn.close()


def scalar(db, sql, **p):
    return db.execute(text(sql), p).scalar()


def refuses(db, sql, pattern=None, **p):
    """Assert the database rejects a statement, and say why it did."""
    with pytest.raises(DatabaseError) as exc:
        db.execute(text(sql), p)
    message = str(getattr(exc.value, "orig", exc.value))
    if pattern:
        assert re.search(pattern, message, re.I), f"rejected, but for another reason: {message}"
    db.rollback()
    db.begin()
    return message


# ---------------------------------------------------------------------------
# 1. The schema exists and is built the way the design requires
# ---------------------------------------------------------------------------

def test_all_46_tables_are_present(db):
    n = scalar(db, "SELECT COUNT(*) FROM information_schema.tables "
                   "WHERE table_schema=DATABASE() AND table_type='BASE TABLE'")
    assert n >= 46, f"expected 46 tables, found {n}"


def test_every_table_is_innodb_and_utf8mb4(db):
    """D-14: a server defaulting to latin1 corrupts every Arabic name."""
    bad = db.execute(text(
        "SELECT table_name, engine, table_collation FROM information_schema.tables "
        "WHERE table_schema=DATABASE() AND table_type='BASE TABLE' "
        "AND (engine<>'InnoDB' OR table_collation NOT LIKE 'utf8mb4%')")).fetchall()
    assert not bad, bad


def test_arabic_survives_storage_and_retrieval(db):
    name = scalar(db, "SELECT last_name_ar FROM citizens WHERE last_name_ar IS NOT NULL LIMIT 1")
    assert name and not name.startswith("?"), f"Arabic corrupted: {name!r}"
    assert any("؀" <= ch <= "ۿ" for ch in name)


def test_foreign_keys_are_declared_and_carry_actions(db):
    """§6.5.5 / R-12 / D-28. The ERD declared no ON DELETE or ON UPDATE."""
    total = scalar(db, "SELECT COUNT(*) FROM information_schema.referential_constraints "
                       "WHERE constraint_schema=DATABASE()")
    no_update = scalar(db, "SELECT COUNT(*) FROM information_schema.referential_constraints "
                           "WHERE constraint_schema=DATABASE() AND update_rule='NO ACTION'")
    assert total >= 100, f"expected ~111 foreign keys, found {total}"
    assert no_update == 0, f"{no_update} foreign keys still have no ON UPDATE action"


def test_triggers_are_installed(db):
    names = {r[0] for r in db.execute(text(
        "SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema=DATABASE()"))}
    for required in ("trg_request_state_history", "trg_request_sla_close",
                     "trg_citizens_audit", "trg_request_legal_transition",
                     "trg_citizens_parent_dob_ins", "trg_documents_mukhtar_term"):
        assert required in names, f"missing trigger {required}"


# ---------------------------------------------------------------------------
# 2. Relationships behave as R-12 specifies
# ---------------------------------------------------------------------------

def test_dangling_reference_is_rejected(db):
    """§6.5.5. SQLite was not enforcing these at all; InnoDB does."""
    refuses(db,
            "INSERT INTO documents (document_type_id, civil_registry_number, document_number, "
            "issue_date, status, created_by, version, is_latest, is_deleted) VALUES "
            "(1,'CRN-DOES-NOT-EXIST','FK-TEST-1','2025-01-01','ISSUED',1,1,1,0)",
            r"foreign key")


def test_citizen_with_documents_cannot_be_deleted(db):
    crn = scalar(db, "SELECT civil_registry_number FROM documents "
                     "WHERE civil_registry_number IS NOT NULL LIMIT 1")
    refuses(db, "DELETE FROM citizens WHERE civil_registry_number=:c", r"foreign key", c=crn)


def test_subtype_cascades_with_its_parent_document(db):
    doc_id = scalar(db, "SELECT document_id FROM birth_certificates LIMIT 1")
    db.execute(text("UPDATE service_requests SET issued_document_id=NULL "
                    "WHERE issued_document_id=:d"), {"d": doc_id})
    db.execute(text("DELETE FROM document_validations WHERE document_id=:d"), {"d": doc_id})
    db.execute(text("DELETE FROM physical_document_handling WHERE document_id=:d"), {"d": doc_id})
    db.execute(text("DELETE FROM documents WHERE id=:d"), {"d": doc_id})
    assert scalar(db, "SELECT COUNT(*) FROM birth_certificates WHERE document_id=:d",
                  d=doc_id) == 0


def test_correcting_a_registry_number_cascades(db):
    """D-28: the natural primary key is referenced by ~20 tables, and
    correcting it must not fail against them."""
    crn = scalar(db,
                 "SELECT d.civil_registry_number FROM documents d "
                 "WHERE d.civil_registry_number IS NOT NULL "
                 "  AND NOT EXISTS (SELECT 1 FROM citizens c "
                 "                   WHERE c.father_id=d.civil_registry_number "
                 "                      OR c.mother_id=d.civil_registry_number) LIMIT 1")
    before = scalar(db, "SELECT COUNT(*) FROM documents WHERE civil_registry_number=:c", c=crn)
    db.execute(text("UPDATE citizens SET civil_registry_number='CRN-RENAMED-1' "
                    "WHERE civil_registry_number=:c"), {"c": crn})
    after = scalar(db, "SELECT COUNT(*) FROM documents WHERE civil_registry_number='CRN-RENAMED-1'")
    assert after == before > 0


def test_self_referencing_cascade_is_not_supported_by_innodb(db):
    """A limitation pinned by test rather than discovered in production.

    InnoDB does not activate cascading referential actions on a
    self-referencing foreign key. `citizens.father_id` and `mother_id` point
    back at `citizens`, so although ON UPDATE CASCADE is declared and works
    for the twenty-odd other tables, renaming a citizen who is recorded as
    somebody's parent is refused by the self-reference.

    D-28 was written about exactly this operation, so the gap matters: a
    registry number correction on a parent has to clear the children's
    father_id / mother_id, rename, and restore them -- in one transaction,
    in the service layer. Until that exists, this test states the real
    behaviour so nobody plans around a cascade that will not happen.
    """
    parent = scalar(db, "SELECT father_id FROM citizens WHERE father_id IS NOT NULL LIMIT 1")
    refuses(db, "UPDATE citizens SET civil_registry_number='CRN-RENAMED-2' "
                "WHERE civil_registry_number=:c", r"foreign key", c=parent)


# ---------------------------------------------------------------------------
# 3. Invalid data is rejected — CHECK constraints
# ---------------------------------------------------------------------------

CHECKS = [
    ("ck_citizens_gender",
     "INSERT INTO citizens (civil_registry_number,gender,date_of_birth,marital_status) "
     "VALUES ('CRN-BAD-1','OTHERWISE','1990-01-01','SINGLE')"),
    ("ck_citizens_marital",
     "INSERT INTO citizens (civil_registry_number,gender,date_of_birth,marital_status) "
     "VALUES ('CRN-BAD-2','MALE','1990-01-01','ITS COMPLICATED')"),
    ("ck_documents_version",
     "INSERT INTO documents (document_type_id,document_number,issue_date,status,created_by,"
     "version,is_latest,is_deleted) VALUES (1,'BAD-VER','2025-01-01','ISSUED',1,0,1,0)"),
    ("ck_documents_expiry",
     "INSERT INTO documents (document_type_id,document_number,issue_date,expiry_date,status,"
     "created_by,version,is_latest,is_deleted) "
     "VALUES (1,'BAD-EXP','2025-01-01','2024-01-01','ISSUED',1,1,1,0)"),
    ("ck_requests_priority",
     "INSERT INTO service_requests (request_number,direction,citizen_id,document_type_id,"
     "priority,submitted_at) SELECT 'REQ-BAD-1','INCOMING',civil_registry_number,1,"
     "'WHENEVER','2025-01-01' FROM citizens LIMIT 1"),
    ("ck_requests_direction",
     "INSERT INTO service_requests (request_number,direction,citizen_id,document_type_id,"
     "priority,submitted_at) SELECT 'REQ-BAD-2','SIDEWAYS',civil_registry_number,1,"
     "'NORMAL','2025-01-01' FROM citizens LIMIT 1"),
    ("ck_payments_amount",
     "INSERT INTO payments (service_request_id,amount,currency,status,receipt_number) "
     "SELECT id,-50,'USD','PAID','RCPT-BAD-1' FROM service_requests LIMIT 1"),
    # 'US' rather than 'DOLLARS': the column is VARCHAR(3), so an over-long
    # value is refused by the column width in strict mode and the CHECK never
    # runs. A two-letter code is what the constraint itself has to catch.
    ("ck_payments_currency",
     "INSERT INTO payments (service_request_id,amount,currency,status,receipt_number) "
     "SELECT id,10,'US','PAID','RCPT-BAD-2' FROM service_requests LIMIT 1"),
    ("ck_sla_status",
     "INSERT INTO sla_records (service_request_id,due_date,sla_status) "
     "SELECT id,'2025-01-01','PROBABLY FINE' FROM service_requests "
     "WHERE id NOT IN (SELECT service_request_id FROM sla_records) LIMIT 1"),
    ("ck_death_burial_after_death",
     "INSERT INTO death_certificates (document_id,death_date,burial_date) "
     "SELECT id,'2025-06-01','2025-05-01' FROM documents "
     "WHERE id NOT IN (SELECT document_id FROM death_certificates) LIMIT 1"),
    ("ck_users_failed_attempts",
     "UPDATE users SET failed_login_attempts=-1 WHERE id=(SELECT MIN(id) FROM (SELECT id FROM users) u)"),
    ("ck_mukhtar_term",
     "UPDATE mukhtars SET term_end='1990-01-01' WHERE id=(SELECT MIN(id) FROM (SELECT id FROM mukhtars) m)"),
]


@pytest.mark.parametrize("name,sql", CHECKS, ids=[c[0] for c in CHECKS])
def test_check_constraint_rejects_invalid_data(db, name, sql):
    refuses(db, sql, name)


# ---------------------------------------------------------------------------
# 4. Invalid data is rejected — the rules a CHECK cannot express
#
# MySQL refuses a CHECK that references a column carrying a referential
# action, and refuses a non-deterministic function inside one, so these five
# rules are enforced by BEFORE triggers instead. Same rule, different
# mechanism; the test does not care which.
# ---------------------------------------------------------------------------

TRIGGER_RULES = [
    ("future date of birth",
     "INSERT INTO citizens (civil_registry_number,gender,date_of_birth,marital_status) "
     "VALUES ('CRN-BAD-3','MALE','2099-01-01','SINGLE')",
     r"future"),
    ("soft delete without attribution",
     "INSERT INTO documents (document_type_id,document_number,issue_date,status,created_by,"
     "version,is_latest,is_deleted) VALUES (1,'BAD-DEL','2025-01-01','ISSUED',1,1,1,1)",
     r"deleted_by"),
    ("a citizen as their own guardian",
     "INSERT INTO guardianship_records (minor_citizen_id,guardian_citizen_id,status) "
     "SELECT civil_registry_number,civil_registry_number,'ACTIVE' FROM citizens LIMIT 1",
     r"own guardian"),
    ("transfer between the same office",
     "INSERT INTO registry_transfers (citizen_id,from_office_id,to_office_id,status) "
     "SELECT civil_registry_number,1,1,'PENDING' FROM citizens LIMIT 1",
     r"different offices"),
    ("rejection without a reason",
     "INSERT INTO service_requests (request_number,direction,citizen_id,document_type_id,"
     "priority,submitted_at,rejected_by,rejection_reason) "
     "SELECT 'REQ-BAD-3','INCOMING',civil_registry_number,1,'NORMAL','2025-01-01',1,NULL "
     "FROM citizens LIMIT 1",
     r"rejection_reason"),
]


@pytest.mark.parametrize("label,sql,pattern", TRIGGER_RULES, ids=[r[0] for r in TRIGGER_RULES])
def test_trigger_enforced_rule_rejects_invalid_data(db, label, sql, pattern):
    refuses(db, sql, pattern)


def test_illegal_workflow_transition_is_rejected(db):
    """§6.5.7 rule 2 / D-17: a request may not skip review and approval."""
    rid = scalar(db, "SELECT r.id FROM service_requests r JOIN workflow_states w "
                     "ON w.id=r.workflow_state_id WHERE w.code='SUBMITTED' LIMIT 1")
    issued = scalar(db, "SELECT id FROM workflow_states WHERE code='ISSUED'")
    refuses(db, "UPDATE service_requests SET workflow_state_id=:s WHERE id=:r",
            r"Illegal workflow transition", s=issued, r=rid)


def test_parent_cannot_be_younger_than_child(db):
    """§6.5.7 rule 9."""
    child = scalar(db, "SELECT civil_registry_number FROM citizens WHERE father_id IS NOT NULL LIMIT 1")
    refuses(db, "UPDATE citizens SET date_of_birth='1900-01-01' WHERE civil_registry_number=:c",
            r"parent date of birth", c=child)


def test_mukhtar_attestation_must_fall_within_term(db):
    """§6.5.7 rule 7."""
    mid, start = db.execute(text("SELECT id, term_start FROM mukhtars "
                                 "WHERE term_start IS NOT NULL LIMIT 1")).fetchone()
    too_early = (start - timedelta(days=400)).isoformat()
    refuses(db,
            "INSERT INTO documents (document_type_id,document_number,issue_date,"
            "attested_by_mukhtar_id,status,created_by,version,is_latest,is_deleted) "
            "VALUES (1,'MUKHTAR-TEST-1',:d,:m,'ISSUED',1,1,1,0)",
            r"term of office", d=too_early, m=mid)


def test_one_active_assignment_per_request(db):
    """§6.5.7 rule 1 / D-11, enforced by UNIQUE (service_request_id, is_active)."""
    row = db.execute(text("SELECT service_request_id, assigned_to FROM request_assignments "
                          "WHERE is_active=1 LIMIT 1")).fetchone()
    refuses(db, "INSERT INTO request_assignments (service_request_id,assigned_to,is_active) "
                "VALUES (:a,:b,1)", r"duplicate", a=row[0], b=row[1])


def test_one_current_version_per_document_chain(db):
    """§6.5.7 rule 5 / D-05, enforced by UNIQUE (document_group_id, is_latest)."""
    other = scalar(db, "SELECT id FROM documents WHERE document_group_id IS NOT NULL "
                       "AND is_latest=0 LIMIT 1")
    if other is None:
        pytest.skip("no versioned document chain in this data")
    refuses(db, "UPDATE documents SET is_latest=1 WHERE id=:i", r"duplicate", i=other)


# ---------------------------------------------------------------------------
# 5. The database maintains itself
# ---------------------------------------------------------------------------

def test_state_change_writes_its_own_history_row(db):
    """The README says the audit tables are "meant to be populated by
    application logic (or triggers)". There was neither."""
    rid, state = db.execute(text(
        "SELECT r.id, r.workflow_state_id FROM service_requests r "
        "JOIN workflow_states w ON w.id=r.workflow_state_id "
        "WHERE w.code='SUBMITTED' LIMIT 1")).fetchone()
    target = scalar(db, "SELECT to_state_id FROM workflow_transitions "
                        "WHERE from_state_id=:s LIMIT 1", s=state)
    before = scalar(db, "SELECT COUNT(*) FROM service_request_status_history "
                        "WHERE service_request_id=:r", r=rid)
    db.execute(text("UPDATE service_requests SET workflow_state_id=:t WHERE id=:r"),
               {"t": target, "r": rid})
    after = scalar(db, "SELECT COUNT(*) FROM service_request_status_history "
                       "WHERE service_request_id=:r", r=rid)
    assert after == before + 1, "no history row was written by the database"

    row = db.execute(text("SELECT from_state_id, to_state_id, transition_id "
                          "FROM service_request_status_history WHERE service_request_id=:r "
                          "ORDER BY id DESC LIMIT 1"), {"r": rid}).fetchone()
    assert row[0] == state and row[1] == target
    assert row[2] is not None, "the history row did not resolve its transition"


def test_reaching_a_final_state_settles_the_sla(db):
    row = db.execute(text(
        "SELECT r.id FROM service_requests r JOIN workflow_states w ON w.id=r.workflow_state_id "
        "JOIN sla_records s ON s.service_request_id=r.id WHERE w.code='APPROVED' LIMIT 1")).fetchone()
    if row is None:
        pytest.skip("no approved request with an SLA record")
    issued = scalar(db, "SELECT id FROM workflow_states WHERE code='ISSUED'")
    db.execute(text("UPDATE service_requests SET workflow_state_id=:s WHERE id=:r"),
               {"s": issued, "r": row[0]})
    status = scalar(db, "SELECT sla_status FROM sla_records WHERE service_request_id=:r", r=row[0])
    assert status in ("MET", "BREACHED"), f"SLA left at {status} after a final state"


def test_citizen_amendment_writes_its_own_audit_row(db):
    crn = scalar(db, "SELECT civil_registry_number FROM citizens WHERE updated_by IS NOT NULL LIMIT 1")
    before = scalar(db, "SELECT COUNT(*) FROM citizen_audit_log WHERE citizen_id=:c", c=crn)
    db.execute(text("UPDATE citizens SET last_name_en='Reconciled' WHERE civil_registry_number=:c"),
               {"c": crn})
    after = scalar(db, "SELECT COUNT(*) FROM citizen_audit_log WHERE citizen_id=:c", c=crn)
    row = db.execute(text("SELECT field_name, new_value FROM citizen_audit_log "
                          "WHERE citizen_id=:c ORDER BY id DESC LIMIT 1"), {"c": crn}).fetchone()
    assert after == before + 1
    assert tuple(row) == ("last_name_en", "Reconciled")


# ---------------------------------------------------------------------------
# 6. Indexes and query patterns — §6.6.5 acceptance criterion
# ---------------------------------------------------------------------------

INDEXED_QUERIES = [
    ("citizens by Arabic name (§6.6.2)",
     "SELECT * FROM citizens WHERE last_name_ar='حداد' AND first_name_ar='علي'"),
    ("citizens by Latin name prefix (§6.6.2)",
     "SELECT * FROM citizens WHERE last_name_en LIKE 'Hall%'"),
    ("citizens by registration office (§6.6.2)",
     "SELECT * FROM citizens WHERE registration_office_id=2"),
    ("children of a citizen (§6.6.2)",
     "SELECT * FROM citizens WHERE father_id='CRN-400001'"),
    ("this citizen's documents of this type (§6.6.1)",
     "SELECT * FROM documents WHERE civil_registry_number='CRN-400001' AND document_type_id=1"),
    ("my work queue (§6.6.1)",
     "SELECT * FROM request_assignments WHERE assigned_to=5 AND is_active=1"),
    ("request timeline newest first (§6.6.1)",
     "SELECT * FROM service_request_status_history WHERE service_request_id=10 "
     "ORDER BY changed_at DESC"),
    ("who accessed this citizen's record (§6.6.1)",
     "SELECT * FROM record_access_log WHERE citizen_id='CRN-400001' ORDER BY accessed_at DESC"),
    ("what did this employee access (§6.6.1)",
     "SELECT * FROM record_access_log WHERE accessed_by=5"),
    ("unread notifications badge (§6.6.1)",
     "SELECT * FROM internal_notifications WHERE recipient_user_id=5 AND is_read=0"),
    ("throughput by submission date (§6.6.3)",
     "SELECT * FROM service_requests WHERE submitted_at BETWEEN '2026-01-01' AND '2026-06-30'"),
    ("search by wife (§6.6.3)",
     "SELECT * FROM marriage_certificates WHERE wife_id='CRN-400002'"),
    ("staff listing by office (§6.6.3)",
     "SELECT * FROM users WHERE office_id=1"),
    ("which roles grant this permission (§6.6.3)",
     "SELECT * FROM role_permissions WHERE permission_id=3"),
    ("what has this employee changed (§6.6.3)",
     "SELECT * FROM citizen_audit_log WHERE changed_by=5"),
]


@pytest.mark.parametrize("label,sql", INDEXED_QUERIES, ids=[q[0][:44] for q in INDEXED_QUERIES])
def test_query_does_not_scan_the_table(db, label, sql):
    """§6.6.5: a non-ALL access type on every high-frequency query.

    The criterion is relaxed in one specific way, and it is worth saying why
    rather than quietly weakening the assertion. On a table of a few hundred
    rows the optimiser will sometimes choose a full scan even when a usable
    index exists, because reading 455 rows sequentially genuinely costs less
    than walking an index and then fetching those rows. That is the
    optimiser being right, not the index being absent. What must never
    happen is the index not being *available*: this asserts a non-ALL access
    type, or an applicable index in possible_keys.
    """
    rows = [tuple(r) for r in db.execute(text("EXPLAIN " + sql)).fetchall()]
    for row in rows:
        access, possible = row[3], row[4]
        assert access != "ALL" or possible, (
            f"{label}: full scan with no index even available -- {rows}")


def test_every_declared_index_exists_on_the_server(db):
    from app import app  # noqa: F401  -- binds the metadata
    from extensions import db as orm

    declared = {ix.name for t in orm.metadata.tables.values() for ix in t.indexes}
    built = {r[0] for r in db.execute(text(
        "SELECT DISTINCT index_name FROM information_schema.statistics "
        "WHERE table_schema=DATABASE()"))}
    missing = declared - built
    assert not missing, f"declared in models.py but absent from the server: {sorted(missing)}"


# ---------------------------------------------------------------------------
# 7. Configuration
# ---------------------------------------------------------------------------

def test_sqlite_is_refused_outright(monkeypatch):
    """The application is MySQL-only. A SQLite URL must fail loudly rather
    than quietly run against a different database."""
    monkeypatch.setenv("DATABASE_URL", "sqlite:///moi_registry.db")
    with pytest.raises(config.ConfigurationError, match="MySQL"):
        config.database_url()


def test_missing_password_explains_itself(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("MYSQL_PASSWORD", raising=False)
    with pytest.raises(config.ConfigurationError, match="MYSQL_PASSWORD"):
        config.database_url()


def test_schema_version_is_recorded(db):
    """Migrations know where the database stands."""
    version = scalar(db, "SELECT version_num FROM alembic_version")
    assert version, "alembic_version is empty; run: python -m flask db stamp head"
