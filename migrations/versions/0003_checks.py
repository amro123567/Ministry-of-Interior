"""SDD 6.5.7: check constraints, and a collation index for name search

Revision ID: 0003_checks
Revises: 0002_indexes

SDD 6.5.7 lists nine correctness-critical rules with, in its words, "no
database enforcement", and calls that list "the schema's most significant
systemic weakness". This migration enforces the rules a single-row CHECK can
express. SQLite cannot ALTER a table to add a constraint, so each table is
rebuilt in batch mode; rows are copied, not recreated, and the upgrade fails
rather than truncating if existing data violates a rule.

Adding ck_documents_expiry found four live rows -- reissued passports whose
expiry date preceded their issue date, because the reissue path copied the
original document's expiry onto a document issued years later. The generator
and the four rows were both corrected before this migration was applied.

The collation index is SQLite-only and deliberate. On SQLite a BTREE index
cannot serve LIKE 'name%' unless the indexed column carries NOCASE
collation, so the counter clerk's most frequent query stayed a full table
scan even after 0002. MySQL's utf8mb4_unicode_ci is already case-insensitive
and needs no equivalent.
"""
from alembic import op

revision = "0003_checks"
down_revision = "0002_indexes"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('citizens') as b:
        b.create_check_constraint('ck_citizens_gender', "gender IN ('MALE','FEMALE')")
        b.create_check_constraint('ck_citizens_marital', "marital_status IN ('SINGLE','MARRIED','DIVORCED','WIDOWED')")
        b.create_check_constraint('ck_citizens_dob_not_future', 'date_of_birth <= CURRENT_DATE')
    with op.batch_alter_table('documents') as b:
        b.create_check_constraint('ck_documents_version', 'version >= 1')
        b.create_check_constraint('ck_documents_expiry', 'expiry_date IS NULL OR expiry_date >= issue_date')
        b.create_check_constraint('ck_documents_soft_delete', 'is_deleted = 0 OR (deleted_by IS NOT NULL AND deleted_at IS NOT NULL)')
    with op.batch_alter_table('service_requests') as b:
        b.create_check_constraint('ck_requests_rejection_reason', 'rejected_by IS NULL OR rejection_reason IS NOT NULL')
        b.create_check_constraint('ck_requests_priority', "priority IN ('LOW','NORMAL','HIGH','URGENT')")
        b.create_check_constraint('ck_requests_direction', "direction IN ('INCOMING','OUTGOING')")
        b.create_check_constraint('ck_requests_fee', 'fee_amount IS NULL OR fee_amount >= 0')
    with op.batch_alter_table('payments') as b:
        b.create_check_constraint('ck_payments_amount', 'amount >= 0')
        b.create_check_constraint('ck_payments_currency', 'currency IS NULL OR length(currency) = 3')
    with op.batch_alter_table('marriage_certificates') as b:
        b.create_check_constraint('ck_marriage_dowry', 'dowry_amount IS NULL OR dowry_amount >= 0')
    with op.batch_alter_table('sla_records') as b:
        b.create_check_constraint('ck_sla_status', "sla_status IN ('ON_TRACK','DUE_SOON','OVERDUE','MET','BREACHED')")
    with op.batch_alter_table('death_certificates') as b:
        b.create_check_constraint('ck_death_burial_after_death', 'burial_date IS NULL OR burial_date >= death_date')
    with op.batch_alter_table('guardianship_records') as b:
        b.create_check_constraint('ck_guardianship_dates', 'end_date IS NULL OR end_date >= start_date')
        b.create_check_constraint('ck_guardianship_distinct', 'minor_citizen_id <> guardian_citizen_id')
    with op.batch_alter_table('registry_transfers') as b:
        b.create_check_constraint('ck_transfer_distinct_offices', 'from_office_id <> to_office_id')
    with op.batch_alter_table('users') as b:
        b.create_check_constraint('ck_users_failed_attempts', 'failed_login_attempts >= 0')
    with op.batch_alter_table('mukhtars') as b:
        b.create_check_constraint('ck_mukhtar_term', 'term_end IS NULL OR term_end >= term_start')

    if op.get_bind().dialect.name == "sqlite":
        op.execute(
            "CREATE INDEX ix_citizens_name_en_nocase ON citizens "
            "(last_name_en COLLATE NOCASE, first_name_en COLLATE NOCASE)"
        )


def downgrade():
    if op.get_bind().dialect.name == "sqlite":
        op.execute("DROP INDEX IF EXISTS ix_citizens_name_en_nocase")

    with op.batch_alter_table('citizens') as b:
        b.drop_constraint('ck_citizens_gender', type_="check")
        b.drop_constraint('ck_citizens_marital', type_="check")
        b.drop_constraint('ck_citizens_dob_not_future', type_="check")
    with op.batch_alter_table('documents') as b:
        b.drop_constraint('ck_documents_version', type_="check")
        b.drop_constraint('ck_documents_expiry', type_="check")
        b.drop_constraint('ck_documents_soft_delete', type_="check")
    with op.batch_alter_table('service_requests') as b:
        b.drop_constraint('ck_requests_rejection_reason', type_="check")
        b.drop_constraint('ck_requests_priority', type_="check")
        b.drop_constraint('ck_requests_direction', type_="check")
        b.drop_constraint('ck_requests_fee', type_="check")
    with op.batch_alter_table('payments') as b:
        b.drop_constraint('ck_payments_amount', type_="check")
        b.drop_constraint('ck_payments_currency', type_="check")
    with op.batch_alter_table('marriage_certificates') as b:
        b.drop_constraint('ck_marriage_dowry', type_="check")
    with op.batch_alter_table('sla_records') as b:
        b.drop_constraint('ck_sla_status', type_="check")
    with op.batch_alter_table('death_certificates') as b:
        b.drop_constraint('ck_death_burial_after_death', type_="check")
    with op.batch_alter_table('guardianship_records') as b:
        b.drop_constraint('ck_guardianship_dates', type_="check")
        b.drop_constraint('ck_guardianship_distinct', type_="check")
    with op.batch_alter_table('registry_transfers') as b:
        b.drop_constraint('ck_transfer_distinct_offices', type_="check")
    with op.batch_alter_table('users') as b:
        b.drop_constraint('ck_users_failed_attempts', type_="check")
    with op.batch_alter_table('mukhtars') as b:
        b.drop_constraint('ck_mukhtar_term', type_="check")
