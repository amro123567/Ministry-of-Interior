# CTS — Correspondence Tracking System

Ministry of Interior, Directorate of Civil Status — CSC599 capstone project.

A Spring Boot + React system that tracks civil-registry correspondence
(incoming and outgoing) through a defined workflow, from registration to
archival, with role-based access, SLA tracking, document attachments with
integrity hashes, reporting, and a full audit trail. The interface is
available in English and Arabic (RTL).

## Structure

| Folder | What it is |
|---|---|
| `backend/` | Spring Boot 3.3 / Java 21 REST API — setup, demo accounts, architecture notes in `backend/README.md` |
| `frontend/` | React 18 + Vite UI — screens and setup in `frontend/README.md` |
| `docs/postman/` | Postman collection for the REST API (44 requests, 51 assertions; run with newman) |
| `docs/UAT.md`, `docs/screens/` | User acceptance test log (10 scenarios) and screenshots |
| `docs/database/` | Database design source (ERD) |
| `docker-compose.yml` | MySQL 8 + backend + HTTPS frontend, one command |

## What the system does

- **Correspondence registration** — readable sequential reference
  (`CTS-2026-000123`, restarting each year), direction
  (incoming / outgoing), subject, citizen, document type, office,
  department, priority, notes.
- **Workflow** — DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED →
  ARCHIVED. Legal transitions and their required permissions are read from the
  admin-configurable workflow catalog (the UI shows only the actions the
  signed-in user may take); rejection requires a reason. Every transition is
  recorded. Closed requests (approved, rejected, archived) cannot be assigned.
- **Assignment** — assign a request to a staff member, with assignment history.
- **Due dates and SLA** — due date per request, live status (on track / due
  soon / overdue), persisted MET / BREACHED records, and a scheduled daily job.
- **Documents** — upload and download, 15 MB limit, SHA-256 hash per file.
  Only listed file types are accepted (pdf, png, jpg, jpeg, gif, txt, csv, doc,
  docx, xls, xlsx); executables and scripts are refused.
- **Audit** — global audit log, per-request status history and activity log,
  citizen field changes, record access, login attempts and sessions. These
  tables are append-only: immutable entities, repositories without delete
  methods, and MySQL triggers that reject UPDATE and DELETE.
- **Search and reporting** — free-text search (reference, subject, citizen),
  filters for status, office, priority, direction, SLA state and created date
  range, "assigned to me", CSV export, dashboard KPIs, reports
  (throughput, aging, by type, by office, breach rate).
- **Security** — JWT access tokens (30 min) with rotating refresh tokens
  (7 days) and a revocation denylist, account lockout after 5 failed
  attempts (15 min), BCrypt password hashing, 4 roles mapped to 12
  permission codes enforced server-side and mirrored in the UI.
- **Civil-registry domain** — governorates, lineage, family records,
  guardianship, transfers, amendments, 7 certificate subtypes and payments
  (about 45 tables in total).

## Quick start — Docker (recommended)

```powershell
copy .env.example .env
# edit .env: set MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, JWT_SECRET

docker compose up --build -d
```

Open **https://localhost:3443**. The frontend container serves the built
React app and proxies `/api/**` to the backend, so no CORS setup or startup
ordering is needed. The first boot is slower while images build and Hibernate
creates the schema (the backend reports healthy after roughly a minute).

Demo accounts (seeded on first boot; change them for anything beyond a demo):

| Username | Password | Role |
|---|---|---|
| admin | Admin1234! | ADMIN |
| manager | Manager1234! | MANAGER |
| officer | Officer1234! | OFFICER |
| viewer | Viewer1234! | VIEWER |

### HTTPS

The frontend container serves HTTPS only, with a self-signed certificate
generated at image build time (`frontend/Dockerfile`, `frontend/nginx.conf`).
Your browser will warn the first time; click through it. This is fine for a
demo. A real deployment would mount a certificate from an internal CA.

Reset to a clean slate (this wipes the database):

```powershell
docker compose down -v
docker compose up --build -d
```

## Quick start — without Docker

```powershell
# Terminal 1
cd backend
mvn spring-boot:run

# Terminal 2
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** (plain HTTP). The backend needs a MySQL
database first; see `backend/README.md`.

## Tests

Backend — 122 tests on an in-memory H2 database (no MySQL needed): end-to-end
workflow tests over the real REST API, JWT unit tests, seed-data invariant
checks, audit immutability, CSV export filtering, reference-number migration,
and upload file-type validation.

```powershell
cd backend
mvn test
```

Frontend — 50 component tests (Vitest + React Testing Library): login, route
and button permission gating, dashboard, request and document forms, citizen
and admin pages, navigation and the workflow page.

```powershell
cd frontend
npm install
npm test
```

API — import `docs/postman/CTS_API_Collection.json` into Postman, or run it
from the command line against a running backend:

```powershell
npx newman run docs/postman/CTS_API_Collection.json
```

User acceptance — ten scenarios (registration, review, assignment, viewer
access, audit, SLA, attachments, search and export, reports and Arabic, user
administration) are recorded in `docs/UAT.md`.

## Documented deviations from the proposal

- **Modular monolith, not microservices.** One deployable Spring Boot
  service with clear package boundaries.
- **No MySQL primary-replica and no scheduled backups** in the Compose setup.
- **The workflow catalog drives the six request statuses only.** Admins can
  change which moves are legal and who may make them, but a request still
  stores one of the six built-in statuses; a brand-new state added in the
  catalog cannot be reached by a request.
- **Audit triggers need MySQL.** The database-level append-only protection is
  created at startup on MySQL/MariaDB (the Compose file starts MySQL with
  `--log-bin-trust-function-creators=1` for this); the in-memory test database
  relies on the code-level protection only.

## History

The system was first prototyped in Flask + Flask-Admin against a 46-table
`civil_registry_db` schema, then rewritten in Spring Boot + React to match
the proposal's stack. The Flask prototype is preserved at the git tag
**`v1.0-flask-mysql`**:

```powershell
git checkout v1.0-flask-mysql
```

The Spring Boot system is tagged **`v1.0`**.
