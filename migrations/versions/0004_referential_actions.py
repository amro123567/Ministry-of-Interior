"""SDD 6.5.5 / R-12 / D-28: referential actions

Revision ID: 0004_refactions
Revises: 0003_checks

The ERD declares roughly fifty foreign keys and states no ON DELETE or
ON UPDATE behaviour anywhere (D-28). R-12 sets out the intended actions by
relationship class; models.py now applies them, and this migration puts them
into an existing database.

Scope is deliberately narrower than the full R-12 matrix, and the reason is
worth stating rather than hiding. Under PRAGMA foreign_keys=ON, SQLite's
default NO ACTION already refuses to delete a referenced parent row, which
is the behaviour RESTRICT specifies -- so the ninety-two RESTRICT
relationships need no table rebuild to behave correctly. Only the
relationships whose action differs from that default are rebuilt here:

  * citizens self-reference        ON DELETE SET NULL  -- removing a parent
                                                          must not orphan a
                                                          child record
  * document -> subtype (8 tables) ON DELETE CASCADE   -- a subtype row has
                                                          no meaning without
                                                          its parent
  * grant/junction tables (4)      ON DELETE CASCADE   -- grants go with the
                                                          role or user

ON UPDATE CASCADE is carried on every rebuilt table. That is the clause
D-28 is really about: citizens uses a natural primary key, so correcting a
civil registry number would otherwise fail against every table referencing
it. The MySQL DDL script emits the complete matrix, RESTRICT included,
because InnoDB does not share SQLite's default.

This migration reads the table definitions from models.py rather than
repeating fifty foreign key declarations inline. That couples it to the
current model, which is normally poor migration practice; it is the
deliberate trade here because the alternative is several hundred lines of
hand-copied DDL whose divergence from the model would be silent.
"""
from alembic import op

revision = "0004_refactions"
down_revision = "0003_checks"
branch_labels = None
depends_on = None

SUBTYPE_TABLES = [
    "birth_certificates", "marriage_certificates", "divorce_certificates",
    "death_certificates", "national_id_cards", "passports",
    "naturalization_records", "name_change_records",
]
JUNCTION_TABLES = [
    "role_permissions", "users_roles",
    "workflow_transition_permissions", "document_type_authorities",
]
REBUILT = ["citizens"] + SUBTYPE_TABLES + JUNCTION_TABLES


def _metadata(strip_actions):
    """The model metadata, optionally with referential actions removed."""
    import models  # noqa: F401  -- see the note in the docstring
    from extensions import db

    md = db.metadata
    if strip_actions:
        import copy
        md = copy.deepcopy(md)
        for table in md.tables.values():
            for fk in table.foreign_key_constraints:
                fk.ondelete = None
                fk.onupdate = None
    return md


def _rebuild(strip_actions):
    md = _metadata(strip_actions)
    for name in REBUILT:
        with op.batch_alter_table(name, copy_from=md.tables[name], recreate="always"):
            pass


def upgrade():
    _rebuild(strip_actions=False)


def downgrade():
    _rebuild(strip_actions=True)
