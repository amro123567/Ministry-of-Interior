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
| `docs/postman/` | Postman collection for the REST API |
| `docs/database/` | Database design source (ERD) |
| `docker-compose.yml` | MySQL 8 + backend + HTTPS frontend, one command |

## What the system does

- **Correspondence registration** — unique reference number, direction
  (incoming / outgoing), subject, citizen, document type, office,
  department, priority, notes.
- **Workflow** — DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED →
  ARCHIVED. Legal transitions are data-driven and each one requires its own
  permission; rejection requires a reason. Every transition is recorded.
- **Assignment** — assign a request to a staff member, with assignment history.
- **Due dates and SLA** — due date per request, live status (on track / due
  soon / overdue), persisted MET / BREACHED records, and a scheduled daily job.
- **Documents** — upload and download, 15 MB limit, SHA-256 hash per file.
- **Audit** — global audit log, per-request status history, citizen field
  changes, record access, login attempts and sessions.
- **Search and reporting** — free-text search (reference, subject, citizen),
  status filter, "assigned to me", CSV export, dashboard KPIs, reports
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

```powershell
cd backend
mvn test
```

84 tests on an in-memory H2 database (no MySQL needed): 65 end-to-end
workflow tests over the real REST API, 5 JWT unit tests and 14 seed-data
invariant checks.

## Documented deviations from the proposal

- **Modular monolith, not microservices.** One deployable Spring Boot
  service with clear package boundaries.
- **No MySQL primary-replica and no scheduled backups** in the Compose setup.
- **Audit log immutability is by convention** (no database-level protection).

## History

The system was first prototyped in Flask + Flask-Admin against a 46-table
`civil_registry_db` schema, then rewritten in Spring Boot + React to match
the proposal's stack. The Flask prototype is preserved at the git tag
**`v1.0-flask-mysql`**:

```powershell
git checkout v1.0-flask-mysql
```

The Spring Boot system is tagged **`v1.0`**.
