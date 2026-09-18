# CTS Backend — Spring Boot

REST API for the Correspondence Tracking System, rewritten from the Flask
prototype (kept at the repository root, tag `v1.0-flask-mysql`) to match the
proposal's required stack: Spring Boot 3, Spring Security with JWT, MySQL 8.

This is a **narrowed vertical slice**, not a port of all 46 tables. It
covers the full correspondence lifecycle end to end — the parts the demo
script and the rubric actually exercise — rather than every admin screen the
Flask system has. See "What was descoped" below.

## Requirements

- JDK 21 (Temurin/Adoptium recommended) — `java -version`
- Maven 3.9+ — `mvn -version` (or use the included `./mvnw` if present)
- A MySQL 8 server already reachable — reuse the one set up for the Flask
  system (`schema/setup_mysql.py` in the repository root), or point at any
  MySQL 8 instance. This backend uses **its own database**
  (`cts_spring_db` by default) — it does not read the Flask app's
  `civil_registry_db` schema, because the entity model here is a smaller,
  independent design (see "What was descoped").

## First-time setup

1. Create the database and an application user (adjust the password):

   ```sql
   CREATE DATABASE cts_spring_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'cts_spring'@'%' IDENTIFIED BY 'choose-a-real-password';
   GRANT ALL PRIVILEGES ON cts_spring_db.* TO 'cts_spring'@'%';
   FLUSH PRIVILEGES;
   ```

2. Copy `.env.example` to `.env` and fill in the password you just chose and
   a random `JWT_SECRET` (`openssl rand -base64 48`, or any long random
   string — a PowerShell one-liner: `[Convert]::ToBase64String((1..48|%{Get-Random -Max 256}))`).

3. Load the `.env` file into your shell before running Maven/Java. PowerShell
   has no built-in `.env` loader; the simplest is to set the variables
   directly for the session:

   ```powershell
   $env:MYSQL_HOST="127.0.0.1"; $env:MYSQL_PORT="3306"
   $env:MYSQL_DATABASE="cts_spring_db"; $env:MYSQL_USER="cts_spring"
   $env:MYSQL_PASSWORD="the password you chose"
   $env:JWT_SECRET="the random string you generated"
   ```

4. Run it:

   ```powershell
   mvn spring-boot:run
   ```

   The schema is created automatically on first boot (Hibernate
   `ddl-auto=update`) and a demo dataset is seeded once (4 users — one per
   role — 3 citizens, 4 correspondence requests in different states). The
   API listens on **http://localhost:8080**.

5. Run the tests (they use an in-memory H2 database, no MySQL needed):

   ```powershell
   mvn test
   ```

   19 tests: 5 unit tests on JWT issuing/validation, 14 end-to-end tests over
   the real REST API (login/refresh/logout, the full DRAFT → SUBMITTED →
   UNDER_REVIEW → APPROVED → ARCHIVED lifecycle, illegal-transition and
   wrong-role rejection, rejection-without-a-reason rejection, document
   upload with SHA-256 verified against the downloaded bytes, dashboard
   summary, CSV export, audit trail).

## Demo accounts (seeded on first boot)

| Username | Password | Role |
|---|---|---|
| admin | Admin1234! | ADMIN |
| manager | Manager1234! | MANAGER |
| officer | Officer1234! | OFFICER |
| viewer | Viewer1234! | VIEWER |

Change these before this ever runs outside a demo.

## What's in this slice

12 entities: `AppUser`, `Role`, `Office`, `DocumentType`, `Citizen`,
`CorrespondenceRequest`, `RequestStateHistory`, `WorkflowTransitionRule`,
`Attachment`, `AuditLogEntry`, `Notification`, `RefreshToken`.

~25 REST endpoints under `/api/**`: auth (login/refresh/logout), citizens
(search/get/create), requests (list/get/history/create/assign/transition),
documents (upload/list/download), dashboard summary, CSV export, audit log,
notifications, users & roles (admin only).

The workflow's legal-transition matrix (which status can move to which,
and which role is allowed to do it) is seeded data
(`WorkflowTransitionRule`) checked in `RequestService.transition()` — this
is the service-layer replacement for the Flask system's
`trg_request_legal_transition` database trigger. Moving that rule out of
the database and into application code is the central architectural
difference from the Flask/MySQL version, and it's a deliberate one: Spring
Data JPA entities don't carry triggers, so workflow rules that used to live
in the database now live in `RequestService`, `AuthService`, and
`AttachmentService`.

## What was descoped, and why

Built in under a week, solo, starting from zero prior Spring/React
experience — see `PROJECT_STATE.md` at the repository root for the full
reasoning. In short:

- **12 entities, not 46.** The full civil-registry schema (subtypes,
  guardianship, transfers, mukhtar terms, etc.) stays in the Flask/MySQL
  system. This slice models citizens, correspondence requests, and the
  workflow/document/audit machinery around them — everything the demo
  script and CLO3's "working application" criterion actually need to show.
- **4 roles, not 14.** `RoleName` is ADMIN/MANAGER/OFFICER/VIEWER, checked
  with Spring Security's `hasRole(...)`/`hasAnyRole(...)` rather than the
  Flask system's 31-permission create/edit/delete/view matrix per module.
- **BCrypt, not PBKDF2.** Spring Security's `DaoAuthenticationProvider`
  needs a `PasswordEncoder` it understands. The Flask system's PBKDF2
  hashes can't be verified by BCrypt, so this backend seeds its own demo
  users rather than importing the Flask ones — that's also why it uses a
  separate database (`cts_spring_db`) instead of `civil_registry_db`.
- **No refresh-token denylist beyond what `RefreshToken` does.** Logout and
  rotation revoke the specific token; there's no "log out everywhere" or
  admin-forced revocation across a user's whole session history.
- **SLA overdue/due-soon is computed on read**, not by a nightly job — see
  `CorrespondenceRequest.isOverdue()` and `DashboardService`. Correct for a
  demo; a real deployment would want a scheduled recompute plus a
  notification, not just a computed flag.
