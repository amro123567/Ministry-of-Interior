# CTS Backend — Spring Boot

REST API for the Correspondence Tracking System: Spring Boot 3.3, Java 21,
Spring Security with JWT, Spring Data JPA, MySQL 8.

## Requirements

- JDK 21 (`java -version`)
- Maven 3.9+ (`mvn -version`)
- MySQL 8 (not needed for tests, which use H2, or for the Docker setup)

## Run with MySQL (without Docker)

1. Create the database and user:

   ```sql
   CREATE DATABASE cts_spring_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'cts_spring'@'%' IDENTIFIED BY 'choose-a-real-password';
   GRANT ALL PRIVILEGES ON cts_spring_db.* TO 'cts_spring'@'%';
   FLUSH PRIVILEGES;
   ```

2. Set the environment for your shell session:

   ```powershell
   $env:MYSQL_HOST="127.0.0.1"; $env:MYSQL_PORT="3306"
   $env:MYSQL_DATABASE="cts_spring_db"; $env:MYSQL_USER="cts_spring"
   $env:MYSQL_PASSWORD="the password you chose"
   $env:JWT_SECRET="a long random string"
   ```

3. Start it:

   ```powershell
   mvn spring-boot:run
   ```

   The schema is created on first boot (Hibernate `ddl-auto=update`) and a
   demo dataset is seeded once. The API listens on **http://localhost:8080**;
   health is at `/actuator/health`.

With Docker, none of this is needed; see the root `README.md`.

## Tests

```powershell
mvn test
```

122 tests, all on in-memory H2 (no MySQL needed):

- End-to-end workflow tests over the real REST API: login, refresh,
  logout, lockout, the full request lifecycle, illegal-transition and
  wrong-permission rejection, role-based 403 checks (including a viewer being
  unable to create, upload or assign), direction/subject/department,
  attachments with SHA-256 verified against the downloaded bytes, dashboard,
  reports, CSV export and audit trails.
- JWT unit tests and seed-data invariant checks.
- Focused tests: audit-table immutability, seeded assignment history and audit
  rows, the workflow catalog driving request transitions (changed inside a
  rolled-back transaction), CSV export honouring list filters, reference-number
  migration failing safely, and upload file-type validation.

## Demo accounts (seeded on first boot)

| Username | Password | Role |
|---|---|---|
| admin | Admin1234! | ADMIN |
| manager | Manager1234! | MANAGER |
| officer | Officer1234! | OFFICER |
| viewer | Viewer1234! | VIEWER |

Change these before this runs anywhere other than a demo.

## Architecture

A modular monolith organised by package under `com.moi.cts`: `config`,
`controller`, `service`, `repository`, `entity`, `dto`, `security`.

**Domain.** About 45 tables: the correspondence workflow (requests, state
history, assignments, SLA records, attachments,
notifications) plus the civil-registry model (governorates, citizens,
lineage, family records, guardianship, transfers, amendments, certificate
subtypes, payments).

**Correspondence request.** Reference `CTS-YYYY-NNNNNN` (unique, a counter per
year taken under a row lock; references created before this format were
renumbered once at startup), direction
(`INCOMING` / `OUTGOING`, default `INCOMING`), subject, citizen, document
type, office, optional department, priority, status, due date, assignee.

**Security.**
- Four roles (ADMIN, MANAGER, OFFICER, VIEWER) map to 12 permission codes,
  issued as authorities in the JWT and checked in `SecurityConfig`.
  Request creation, document upload and assignment require one of the
  request-workflow permissions, so a viewer is read-only.
- Each status transition needs its own permission
  (`REQUEST_TRANSITION_SUBMIT`, `_REVIEW`, `_DECIDE`, `_ARCHIVE`). Which moves
  are legal, and the permission each needs, is read from the workflow engine
  catalog (`WorkflowState` / `WorkflowTransition`) in
  `RequestService.transition()`; `GET /api/requests/{id}/transitions` returns
  the moves the caller may make now. Assigning an approved, rejected or
  archived request is refused.
- Access tokens last 30 minutes; refresh tokens last 7 days, rotate on use
  and can be revoked. Logout adds the token to a denylist.
- Five failed logins lock an account for 15 minutes; every attempt is logged.
- Passwords are hashed with BCrypt.
- After changing a user's role or permissions, that user must log in again,
  because permissions are read from the token issued at login.

**SLA.** The live status (on track / due soon / overdue) is computed on read;
a scheduled job runs daily at 08:00 to persist MET / BREACHED records and
raise notifications.

**Audit.** Three layers: the global `audit_log` written through
`AuditService` (request transitions, document uploads), an `@Audited` aspect
on controller methods (downloads, citizen creation and so on), and dedicated
logs for citizen field changes, record access, login attempts and sessions.
`GET /api/requests/{id}/audit` returns a request's logged actions to any
signed-in user. The six audit and history tables are append-only: Hibernate
`@Immutable` entities, repositories with no delete methods, and MySQL
`BEFORE UPDATE` / `BEFORE DELETE` triggers created at startup.

**Documents.** Files are stored on disk (`DOCUMENTS_DIR`), metadata and a
SHA-256 hash in the database, 15 MB limit. Only pdf, png, jpg, jpeg, gif,
txt, csv, doc, docx, xls and xlsx are accepted (checked on the last file
extension); anything else is refused with HTTP 400.

## Known limitations

- Single service and single MySQL instance (no replica, no scheduled backups).
- The workflow catalog drives the six built-in request statuses; a state added
  only in the catalog cannot be reached by a request.
- Audit triggers are created on MySQL/MariaDB only; H2 (tests) relies on the
  code-level protection.
