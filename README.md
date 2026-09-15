# MOI Civil Registry — Flask Admin Frontend

A full navigation frontend for the Civil Registry / Document Management database,
built with **Flask + Flask-SQLAlchemy + Flask-Admin**. It gives you list, search,
filter, view, create, edit, and delete screens for all 27 tables in the schema,
organized into a dashboard grouped by module (Geography & Institutions, Access
Control, Citizens & Family, Documents, Certificates, Audit & Workflow).

## What's included

- `models.py` — SQLAlchemy models for every table in the DBML schema (governorates,
  districts, offices, courts, religious authorities, users/roles/permissions,
  citizens with self-referencing lineage FKs, family records/members, documents,
  all 8 document subtypes, validations, physical handling, service requests, and
  the two audit/access log tables). `User` includes password hashing and
  permission lookup via Flask-Login's `UserMixin`.
- `admin_views.py` — Flask-Admin `ModelView` configuration per table: searchable
  columns, filters, AJAX-powered foreign-key pickers, and permission gating
  (`view_permission`/`edit_permission` per view, enforced via `is_accessible`
  and computed `can_create`/`can_edit`/`can_delete` properties).
- `app.py` — app factory, Flask-Login setup, `/login` and `/logout` routes, and
  a permission-aware dashboard (`admin/index.html`) that only shows modules the
  logged-in user can access, with live record counts.
- `templates/login.html` — standalone login page.
- `seed.py` — inserts a full demo dataset (two extended families, all 8
  certificate types, service requests, audit entries) **and** creates six staff
  accounts with real hashed passwords across four roles — see the User Manual
  for credentials.
- `templates/admin/index.html` — the custom dashboard template.

## Setup

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

By default the app uses a local SQLite file (`moi_registry.db`) so you can run it
immediately with zero external setup. To point it at MySQL instead (matching the
DDL script from earlier), set an environment variable before running:

```bash
export DATABASE_URL="mysql+pymysql://user:password@localhost/civil_registry_db"
```

## Run it

```bash
python app.py
```

Then open **http://localhost:5000/admin/** in your browser.

To load the sample demo records first:

```bash
python seed.py
python app.py
```

## Notes on design choices

- **Flask-Admin, not hand-built CRUD pages.** With 27 interlinked tables, a
  hand-rolled template per table would be enormous and inconsistent. Flask-Admin
  generates consistent, searchable, filterable list/detail/edit screens for every
  model automatically, while still letting each view be customized individually
  (which is what `admin_views.py` does).
- **Real authentication via Flask-Login.** Every screen, including the
  dashboard, requires login. Passwords are hashed with Werkzeug's
  `generate_password_hash`/`check_password_hash` (PBKDF2), never stored or
  compared in plaintext.
- **Role-based access control, enforced at the route level.** Permissions
  live in the `permissions`/`role`/`role_permissions` tables already in the
  schema. Each `ModelView` declares a `view_permission` (required to see the
  table at all) and an `edit_permission` (required to create/edit/delete —
  `can_create`/`can_edit`/`can_delete` are computed properties checked on
  every request, not just used to hide buttons). A user without a required
  permission is redirected, even if they guess the direct URL.
- **`__repr__` on every model.** Flask-Admin displays related objects using their
  Python string representation. Each model defines a human-readable `__repr__`
  (e.g. a citizen shows as `"Sami Haddad (CRN-100003)"` rather than a bare UUID)
  so foreign keys are actually navigable, not just IDs.
- **`form_ajax_refs` for foreign keys.** Rather than rendering giant `<select>`
  dropdowns with every citizen/office/court in the database, foreign-key fields
  use Select2 autocomplete search boxes — necessary once the `citizens` table has
  thousands of rows.
- **Audit tables are read-only in the UI, for every role.** `citizen_audit_log` and
  `record_access_log` have `can_create/edit/delete = False` regardless of
  permission — these are meant to be populated by application logic (or
  triggers), never hand-edited, to keep the audit trail trustworthy.
- **SQLite by default, MySQL via env var.** Keeps the app runnable out of the box
  for review/demo purposes while staying a one-line change away from the MySQL
  schema built earlier.

## Extending it

- To add a new document subtype (e.g. residency permits), add a model in
  `models.py` following the same 1-to-1-with-`documents` pattern, then register
  a `ModelView` for it in `admin_views.py` under the `Certificates` category.
- To restrict access, add Flask-Login and wrap `DashboardIndexView`/`ModelView`
  subclasses with an `is_accessible()` check tied to the `role`/`permissions`
  tables already in the schema.
