# MOI Civil Registry — User Manual

A guide to installing, running, and using the Civil Registry navigation application.

---

## 1. What this application is

This is an internal staff tool for browsing, searching, and editing the Ministry
of Interior's civil registry database — citizens, families, documents,
certificates (birth, marriage, divorce, death, national ID, passport,
naturalization, name change), service requests, and audit trails.

It is **not** a public-facing citizen portal. It is the back-office screen a
registry clerk, supervisor, or administrator would use.

---

## 2. Installation

### Requirements
- Python 3.10 or newer
- pip

### Steps

```bash
# 1. Unzip the project and enter it
unzip moi_flask_app.zip
cd moi_flask_app

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Load sample data (recommended for first run)
python seed.py

# 5. Start the app
python app.py
```

Open your browser to:

```
http://127.0.0.1:5000/
```

You'll be redirected automatically to the **login page**.

### Switching from SQLite to MySQL

By default the app stores data in a local file, `moi_registry.db` (SQLite) —
no server setup needed. To point it at a real MySQL database instead (e.g. the
`civil_registry_db` schema built earlier), set an environment variable before
starting the app:

```bash
export DATABASE_URL="mysql+pymysql://username:password@host:3306/civil_registry_db"
python app.py
```

---

## 3. Logging in as different users

The app now requires a real login. Every screen (including the dashboard) is
behind authentication — there is no anonymous access.

### Demo accounts

Running `python seed.py` creates six staff accounts, each with a different
role and a different set of permissions. Use any of these to sign in and see
how the interface changes based on role:

| Username | Password | Role | Name | Office |
|---|---|---|---|---|
| `amro.nasser` | `Adm!nSecure24` | Administrator | Amro Nasser | Central Civil Registry Office |
| `rana.khoury` | `Clerk#Rana77` | Registry Clerk | Rana Khoury | Central Civil Registry Office |
| `fadi.saab` | `Clerk#Fadi88` | Registry Clerk | Fadi Saab | Baabda Civil Registry Office |
| `nour.chami` | `Super#Nour55` | Office Supervisor | Nour Chami | Central Civil Registry Office |
| `layal.fares` | `Clerk#Layal21` | Registry Clerk | Layal Fares | General Directorate of Passports |
| `sara.yazbek` | `Audit#Sara33` | Auditor | Sara Yazbek | Central Civil Registry Office |

**These are demo credentials only.** Change them (or delete these accounts
and create real ones) before any real deployment — see Section 13.

### What each role can actually do

Access is enforced at the database/permission level, not just hidden in the
menu — a role without a permission gets redirected if it tries to reach a
blocked URL directly, and Create/Edit/Delete buttons only work if the
permission allows it.

| Module | Administrator | Registry Clerk | Office Supervisor | Auditor |
|---|---|---|---|---|
| Geography & Institutions | View + Edit | View only | View only | View only |
| Access Control (Users/Roles/Permissions) | View + Edit | No access | No access | View only |
| Citizens & Family | View + Edit | View + Edit | View + Edit | View only |
| Documents | View + Edit | View + Edit | View + Edit | View only |
| Certificates (all 8 subtypes) | View + Edit | View + Edit | View + Edit | View only |
| Document Validations | View + Approve | View only | View + Approve | View only |
| Physical Handling | View + Edit | View only | View + Edit | View only |
| Service Requests | View + Edit | View + Edit | View + Edit | View only |
| Citizen Audit Log / Record Access Log | View (read-only for everyone) | No access | View (read-only) | View (read-only) |

A module a role has **no access to** simply won't appear as a card on their
dashboard or as a menu item — logging in as `rana.khoury` (clerk), you won't
see "Access Control" or "Audit & Workflow" at all, because clerks don't have
`access_control.view` or `audit.view`.

### To log out

Click **Log out** in the top-right corner of the dashboard, or go directly to
`/logout`.

---

## 4. The Dashboard

The dashboard is the home screen. It's organized into six modules, each shown
as a card with live record counts:

| Module | Contains |
|---|---|
| **Geography & Institutions** | Governorates, Districts, Offices, Courts, Religious Authorities |
| **Access Control** | Permissions, Roles, Role↔Permission links, Users, User↔Role links |
| **Citizens & Family** | Citizens, Family Records (household books), Family Members |
| **Documents** | Document Types, Documents (the core record) |
| **Certificates** | Birth, Marriage, Divorce, Death Certificates, National ID Cards, Passports, Naturalization Records, Name Change Records |
| **Audit & Workflow** | Document Validations, Physical Handling log, Service Requests, Citizen Audit Log, Record Access Log |

Click any item's name (e.g. **"Citizens 10"**) to open that table's list view.
You can also use the menu bar at the top of every page to jump between tables
without going back to the dashboard.

---

## 5. Navigating a table (List view)

Every table you open shows a **list view** with:

- **Search box** (top left) — searches across the fields configured for that
  table (e.g. Citizens can be searched by registry number or name; Passports
  by passport number).
- **Filter panel** — click **"Filters"** or the funnel icon to narrow results
  by fields like status, gender, or active/inactive. Click a filter, choose an
  operator (equals, contains, etc.), and a value, then hit **Apply**.
- **Column sort** — click any column header to sort ascending/descending.
- **Row actions** (icons on the left of each row):
  - **Eye icon** — view full details (read-only)
  - **Pencil icon** — edit the record
  - **Trash icon** — delete the record (asks for confirmation)
- **"Create"** button (top right) — add a new record.
- **Export** button — download the current filtered list as CSV.
- **Page size / pagination** — bottom of the table.

---

## 6. Creating a new record

1. Open the relevant table from the dashboard or top menu.
2. Click **Create** (top right).
3. Fill in the form. Required fields are marked; optional fields can be left
   blank.
4. **Foreign-key fields** (e.g. "Father", "Registration Office", "Document
   Type") are autocomplete search boxes — start typing a name and pick from
   the dropdown, rather than scrolling a long list.
5. Click **Save**, or **Save and Add Another** to keep creating similar records.

**Example — registering a new citizen:**
- Go to **Citizens & Family → Citizens → Create**.
- Enter the civil registry number (must be unique), names in Arabic and/or
  English, date of birth, gender.
- If the parents are already registered citizens, search and select them in
  the **Father** / **Mother** autocomplete fields — this links the family tree.
  If a parent isn't in the registry, leave that field blank and use the plain
  text **Father Name** / **Mother Name** fields instead.
- Pick the **Registration Office** from the autocomplete list.
- Save.

---

## 7. Editing a record

Click the pencil icon next to any row, or open a record's detail view and
click **Edit**. Change the fields you need and click **Save**. Some tables
are intentionally **read-only** through the UI (see Section 10).

---

## 8. Working with linked records (typical workflows)

The tables are connected the same way they are in the database. A few common
staff workflows:

### Register a birth
1. **Citizens** → Create the newborn's citizen record (with parents linked if
   they're registered).
2. **Documents** → Create a new document: pick Document Type = *Birth
   Certificate*, link the citizen, set issue date and issuing office.
3. **Birth Certificates** → Create a record with the same `document_id`,
   fill in hospital, attendant, and registration number.
4. Optionally, **Family Members** → add the newborn to the household's
   **Family Record**.

### Process a marriage
1. **Documents** → Create a document, Document Type = *Marriage Certificate*.
2. **Marriage Certificates** → Create with the same `document_id`, link
   husband and wife (autocomplete search by name/registry number), court,
   religious authority, and contract number.

### Process a divorce
1. **Documents** → Create a document, Document Type = *Divorce Certificate*.
2. **Divorce Certificates** → Create with the same `document_id`, and in the
   **Marriage Certificate** field, search and select the original marriage
   being dissolved — this is what formally links the two records.

### Handle a citizen's service request
1. **Service Requests** → Create a request: select the citizen, the document
   type they're requesting, and leave **Status** as `submitted`.
2. A supervisor reviews it, sets **Status** to `in_review`, then `approved`
   or `rejected` (with a reason if rejected).
3. Once the actual document is issued (created in the **Documents** table),
   go back to the service request and link it via the **Issued Document**
   field, and set status to `issued`.

---

## 9. Searching for a citizen and viewing their full history

1. Go to **Citizens**, use the search box with a name or registry number.
2. Click the eye icon to view their detail page — this shows all fields at
   a glance, including linked father/mother.
3. To see all documents tied to that citizen, go to **Documents**, and use
   the filter panel to filter by the citizen's registry number, or search
   documents by their number if known.
4. To see their household, check **Family Members** filtered by that citizen,
   which points to their **Family Record** (household book).

There isn't currently a single combined "citizen profile" page — each linked
table is browsed separately by filtering on the citizen. (See Section 13 for
how this could be added.)

---

## 10. Read-only tables (by design)

Two tables cannot be created, edited, or deleted from the interface:

- **Citizen Audit Log** — a historical record of changes made to citizen data
  (e.g. "marital_status changed from married to divorced").
- **Record Access Log** — a historical record of who viewed/exported/printed
  a citizen's file.

These are meant to be populated automatically by the application logic (or by
database triggers) whenever a real change or access happens, not edited by
hand — this keeps the audit trail trustworthy. You can still view and filter
them, just not modify them here.

---

## 11. Tips & troubleshooting

- **"Field is required" on save** — check for a red-outlined field; hover
  over it for the specific validation message.
- **Foreign-key search box shows nothing** — you may be searching a field
  that isn't indexed for that box (each autocomplete only searches specific
  fields, e.g. citizen boxes search name and registry number, not date of
  birth).
- **Deleted the wrong record** — there's no built-in "undo." If you're using
  the default SQLite database, you can stop the app, delete `moi_registry.db`,
  and re-run `python seed.py` to reset to the demo dataset. On a real MySQL
  deployment, restore from a backup.
- **Want to reset all demo data** — run `python seed.py` again at any time;
  it clears every table and reloads the standard demo dataset.
- **Changed something in `models.py`** — after editing model fields, delete
  `moi_registry.db` (SQLite only) and restart the app so the schema regenerates,
  or use a migration tool (Flask-Migrate/Alembic) for a production MySQL setup
  where you can't just drop the database.

---

## 12. Demo data included with `seed.py`

Running `python seed.py` loads:

- 2 governorates, 3 districts, 3 offices, 2 courts, 2 religious authorities
- 4 roles, 4 permissions, 5 staff users (admin, two clerks, a supervisor, a
  passport-office clerk)
- 10 citizens across two extended families (three generations in one family;
  a married-then-divorced couple with a child in the other; plus a naturalized
  citizen with a name-change record)
- 2 household records with family members
- 15 documents covering all 8 certificate/document subtypes: birth
  certificates, a marriage certificate, a linked divorce certificate, a death
  certificate, national ID cards, passports, a naturalization record, and a
  name change record
- 5 service requests in different states: issued, in review, rejected,
  submitted, and approved
- Sample document validations, physical handling log entries, citizen audit
  log entries, and record access log entries

This gives you enough interlinked data to click through every table and see
realistic relationships (e.g. open the divorce certificate and follow its link
back to the original marriage certificate).

---

## 13. Who to contact / next steps

This is a demo/reference build. Authentication and role-based permissions are
now implemented (Section 3), tied to the `Users`/`Roles`/`Permissions` tables
already in the schema. Before any real deployment:

- **Replace the demo accounts.** Delete or deactivate the six seeded accounts
  (`amro.nasser`, `rana.khoury`, etc.) and their known passwords, and create
  real staff accounts through **Access Control → Users** (an Administrator
  account can do this). New users created through the UI get a temporary
  password (`ChangeMe!123`) that should be rotated immediately — there's no
  self-service "change my password" screen yet, so add one before rollout.
- **Rotate `SECRET_KEY`.** The app currently falls back to a hardcoded dev
  key if `SECRET_KEY` isn't set. Always set a real one via environment
  variable in production — session cookies are signed with it.
- **Use HTTPS.** Login submits a plaintext password over the connection;
  without TLS in front of the app (e.g. via a reverse proxy), credentials are
  exposed on the network.
- **Point `DATABASE_URL` at the production MySQL instance.**
- **Consider a single combined "citizen profile" page** that pulls a citizen's
  documents, certificates, family, and audit history onto one screen, instead
  of filtering each table separately (see Section 9).
- **Add a "my account" page** so each user can change their own password
  without an Administrator's involvement.
