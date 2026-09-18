"""SDD 6.6: secondary indexes

Revision ID: 0002_indexes
Revises: 97cf8ffed47d
Create Date: database hardening

SDD 6.6.1 tabulates roughly thirty indexes as present in the design, naming
the query each one serves. None of them existed in the database: it carried
primary-key and unique indexes only. 6.6.2 records the same finding for
`citizens` as D-04, Critical -- the largest and most-queried table in the
system had a primary key and nothing else, so name search, the counter
clerk's most frequent action, was a full table scan.

This migration is purely additive. It creates indexes and takes no other
action, so it cannot lose a row and the downgrade is exact.
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_indexes"
down_revision = "97cf8ffed47d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index('ix_audit_logs_actor_time', 'audit_logs', ['actor_user_id', sa.text('occurred_at DESC')], unique=False)
    op.create_index('ix_audit_logs_entity', 'audit_logs', ['entity_type', 'entity_id'], unique=False)
    op.create_index('ix_birth_cert_regno', 'birth_certificates', ['registration_number'], unique=False)
    op.create_index('ix_citizen_audit_actor', 'citizen_audit_log', ['changed_by'], unique=False)
    op.create_index('ix_citizen_audit_citizen', 'citizen_audit_log', ['citizen_id', sa.text('changed_at DESC')], unique=False)
    op.create_index('ix_citizens_dob', 'citizens', ['date_of_birth'], unique=False)
    op.create_index('ix_citizens_father', 'citizens', ['father_id'], unique=False)
    op.create_index('ix_citizens_mother', 'citizens', ['mother_id'], unique=False)
    op.create_index('ix_citizens_name_ar', 'citizens', ['last_name_ar', 'first_name_ar', 'date_of_birth'], unique=False)
    op.create_index('ix_citizens_name_en', 'citizens', ['last_name_en', 'first_name_en'], unique=False)
    op.create_index('ix_citizens_office', 'citizens', ['registration_office_id'], unique=False)
    op.create_index('ix_amendments_citizen', 'civil_status_amendments', ['citizen_id'], unique=False)
    op.create_index('ix_divorce_couple', 'divorce_certificates', ['husband_id', 'wife_id'], unique=False)
    op.create_index('ix_divorce_decision', 'divorce_certificates', ['court_decision_number'], unique=False)
    op.create_index('ix_divorce_wife', 'divorce_certificates', ['wife_id'], unique=False)
    op.create_index('ix_validations_doc_date', 'document_validations', ['document_id', sa.text('validation_date DESC')], unique=False)
    op.create_index('ix_documents_citizen_type', 'documents', ['civil_registry_number', 'document_type_id'], unique=False)
    op.create_index('ix_documents_created', 'documents', ['created_at'], unique=False)
    op.create_index('ix_documents_office', 'documents', ['issuing_office_id'], unique=False)
    op.create_index('ix_documents_status_latest', 'documents', ['status', 'is_latest'], unique=False)
    op.create_index('ix_family_members_citizen', 'family_members', ['citizen_id'], unique=False)
    op.create_index('ix_guardianship_guardian', 'guardianship_records', ['guardian_citizen_id'], unique=False)
    op.create_index('ix_guardianship_minor', 'guardianship_records', ['minor_citizen_id'], unique=False)
    op.create_index('ix_notifications_recent', 'internal_notifications', ['recipient_user_id', sa.text('created_at DESC')], unique=False)
    op.create_index('ix_notifications_unread', 'internal_notifications', ['recipient_user_id', 'is_read'], unique=False)
    op.create_index('ix_login_attempts_user_time', 'login_attempts', ['username_attempted', sa.text('attempted_at DESC')], unique=False)
    op.create_index('ix_marriage_contract', 'marriage_certificates', ['contract_number'], unique=False)
    op.create_index('ix_marriage_couple', 'marriage_certificates', ['husband_id', 'wife_id'], unique=False)
    op.create_index('ix_marriage_status', 'marriage_certificates', ['status'], unique=False)
    op.create_index('ix_marriage_wife', 'marriage_certificates', ['wife_id'], unique=False)
    op.create_index('ix_passports_citizen', 'passports', ['citizen_id'], unique=False)
    op.create_index('ix_payments_request', 'payments', ['service_request_id'], unique=False)
    op.create_index('ix_handling_doc_time', 'physical_document_handling', ['document_id', sa.text('performed_at DESC')], unique=False)
    op.create_index('ix_handling_location', 'physical_document_handling', ['location'], unique=False)
    op.create_index('ix_handling_performer', 'physical_document_handling', ['performed_by'], unique=False)
    op.create_index('ix_access_log_actor', 'record_access_log', ['accessed_by'], unique=False)
    op.create_index('ix_access_log_citizen', 'record_access_log', ['citizen_id', sa.text('accessed_at DESC')], unique=False)
    op.create_index('ix_registry_transfers_citizen', 'registry_transfers', ['citizen_id'], unique=False)
    op.create_index('ix_assignments_assignee', 'request_assignments', ['assigned_to', 'is_active'], unique=False)
    op.create_index('ix_role_perms_permission', 'role_permissions', ['permission_id'], unique=False)
    op.create_index('ix_history_request_time', 'service_request_status_history', ['service_request_id', sa.text('changed_at DESC')], unique=False)
    op.create_index('ix_requests_citizen', 'service_requests', ['citizen_id'], unique=False)
    op.create_index('ix_requests_due', 'service_requests', ['due_date'], unique=False)
    op.create_index('ix_requests_office_state', 'service_requests', ['office_id', 'workflow_state_id'], unique=False)
    op.create_index('ix_requests_state', 'service_requests', ['workflow_state_id'], unique=False)
    op.create_index('ix_requests_submitted', 'service_requests', ['submitted_at'], unique=False)
    op.create_index('ix_session_logs_user_login', 'session_logs', ['user_id', sa.text('login_at DESC')], unique=False)
    op.create_index('ix_sla_status_due', 'sla_records', ['sla_status', 'due_date'], unique=False)
    op.create_index('ix_users_department', 'users', ['department_id'], unique=False)
    op.create_index('ix_users_office', 'users', ['office_id'], unique=False)
    op.create_index('ix_users_supervisor', 'users', ['supervisor_id'], unique=False)
    op.create_index('ix_user_roles_role', 'users_roles', ['role_id'], unique=False)


def downgrade():
    op.drop_index('ix_user_roles_role', table_name='users_roles')
    op.drop_index('ix_users_supervisor', table_name='users')
    op.drop_index('ix_users_office', table_name='users')
    op.drop_index('ix_users_department', table_name='users')
    op.drop_index('ix_sla_status_due', table_name='sla_records')
    op.drop_index('ix_session_logs_user_login', table_name='session_logs')
    op.drop_index('ix_requests_submitted', table_name='service_requests')
    op.drop_index('ix_requests_state', table_name='service_requests')
    op.drop_index('ix_requests_office_state', table_name='service_requests')
    op.drop_index('ix_requests_due', table_name='service_requests')
    op.drop_index('ix_requests_citizen', table_name='service_requests')
    op.drop_index('ix_history_request_time', table_name='service_request_status_history')
    op.drop_index('ix_role_perms_permission', table_name='role_permissions')
    op.drop_index('ix_assignments_assignee', table_name='request_assignments')
    op.drop_index('ix_registry_transfers_citizen', table_name='registry_transfers')
    op.drop_index('ix_access_log_citizen', table_name='record_access_log')
    op.drop_index('ix_access_log_actor', table_name='record_access_log')
    op.drop_index('ix_handling_performer', table_name='physical_document_handling')
    op.drop_index('ix_handling_location', table_name='physical_document_handling')
    op.drop_index('ix_handling_doc_time', table_name='physical_document_handling')
    op.drop_index('ix_payments_request', table_name='payments')
    op.drop_index('ix_passports_citizen', table_name='passports')
    op.drop_index('ix_marriage_wife', table_name='marriage_certificates')
    op.drop_index('ix_marriage_status', table_name='marriage_certificates')
    op.drop_index('ix_marriage_couple', table_name='marriage_certificates')
    op.drop_index('ix_marriage_contract', table_name='marriage_certificates')
    op.drop_index('ix_login_attempts_user_time', table_name='login_attempts')
    op.drop_index('ix_notifications_unread', table_name='internal_notifications')
    op.drop_index('ix_notifications_recent', table_name='internal_notifications')
    op.drop_index('ix_guardianship_minor', table_name='guardianship_records')
    op.drop_index('ix_guardianship_guardian', table_name='guardianship_records')
    op.drop_index('ix_family_members_citizen', table_name='family_members')
    op.drop_index('ix_documents_status_latest', table_name='documents')
    op.drop_index('ix_documents_office', table_name='documents')
    op.drop_index('ix_documents_created', table_name='documents')
    op.drop_index('ix_documents_citizen_type', table_name='documents')
    op.drop_index('ix_validations_doc_date', table_name='document_validations')
    op.drop_index('ix_divorce_wife', table_name='divorce_certificates')
    op.drop_index('ix_divorce_decision', table_name='divorce_certificates')
    op.drop_index('ix_divorce_couple', table_name='divorce_certificates')
    op.drop_index('ix_amendments_citizen', table_name='civil_status_amendments')
    op.drop_index('ix_citizens_office', table_name='citizens')
    op.drop_index('ix_citizens_name_en', table_name='citizens')
    op.drop_index('ix_citizens_name_ar', table_name='citizens')
    op.drop_index('ix_citizens_mother', table_name='citizens')
    op.drop_index('ix_citizens_father', table_name='citizens')
    op.drop_index('ix_citizens_dob', table_name='citizens')
    op.drop_index('ix_citizen_audit_citizen', table_name='citizen_audit_log')
    op.drop_index('ix_citizen_audit_actor', table_name='citizen_audit_log')
    op.drop_index('ix_birth_cert_regno', table_name='birth_certificates')
    op.drop_index('ix_audit_logs_entity', table_name='audit_logs')
    op.drop_index('ix_audit_logs_actor_time', table_name='audit_logs')
