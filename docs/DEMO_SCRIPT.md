# CTS — Live Demo Script (about 10 minutes)

## Before the demo (do this the day before and again 30 minutes before)

1. `docker compose down -v` then `docker compose up --build -d`. This gives the clean seed data: 4 requests, 4 users.
2. Open **https://localhost:3443** once and accept the certificate warning, so it does not appear in front of the audience.
3. Check `docker compose ps`: mysql and backend *healthy*, frontend *running*.
4. Open four browser profiles or private windows, one per role, already signed in: officer, manager, admin, viewer (passwords in `docs/INSTALLATION.md`). Zoom to 110%.
5. Have `docs/postman/CTS_API_Collection.json` imported in Postman, and a terminal ready with `mvn test` already run (110 tests).
6. Keep a small `sample.pdf` and a `test.exe` on the desktop for the upload step.
7. **Backup**: a screen recording of the full run (the 5 UAT screenshots and `docs/screens/manual/` are the fallback if the system fails).

## Story in one sentence

"Every letter the Directorate receives or sends becomes a tracked request with an owner, a deadline, a defined review process, and a permanent audit trail."

## Run of show

| Time | Who | What you do | What you say |
|---|---|---|---|
| 0:00 | — | Slide: problem and objectives | Correspondence tracked on paper and spreadsheets: no owner, no deadline, no history. |
| 1:00 | Officer | Sign in. Show the dashboard: total, **overdue**, due within 48 h, status chart. | One screen tells the officer what is late. |
| 1:30 | Officer | **Correspondence** list: search "Kanaan", filter status and **Overdue**, press **Export CSV**. | Filters and export are consistent: the CSV contains exactly the filtered rows. |
| 2:30 | Officer | **New Request**: pick a citizen, document type *Birth Certificate*, direction **Outgoing**, subject "Reply to the Governorate", **Create request**, then **Submit**. | A reference number `CTS-2026-…` and a due date from the document type's SLA are generated automatically. |
| 4:00 | Manager | Open the request: **Start review**, then **Reject** with an empty comment. | The system refuses: a rejection needs a written reason. |
| 4:45 | Manager | Reject is cancelled; press **Approve**. | Legal moves and who may make them are read from the workflow catalog, not hard-coded. |
| 5:30 | Admin | Open the approved request. Try to assign it. | Approved requests cannot be reassigned, and the server enforces it. |
| 6:00 | Admin | Open an open request (e.g. the *under review* one). **Assign** to the officer with a note; reassign to the manager. Show *Assignment history*. | One current owner, full history. |
| 6:45 | Admin | **Upload document**: `sample.pdf` succeeds and shows its SHA-256; `test.exe` is refused. | Files are fingerprinted so later tampering is detectable, and only allowed types are accepted. |
| 7:30 | Admin | Show *Audit trail* and *Activity log* on the request; then **Audit** (global log, login attempts). | Nothing can be edited or deleted: the audit tables are append-only, protected by MySQL triggers. |
| 8:15 | Manager | **Reports**: breach rate, throughput, by type, by office. | Live figures, no spreadsheet. |
| 8:45 | Viewer | Sign in: no **New Request**, no Reports, no Users. Open a request: no action buttons. | Four roles over twelve permissions, enforced on the server and mirrored in the interface. |
| 9:15 | Any | Press **EN** to switch to Arabic. | Full right-to-left Arabic interface. |
| 9:30 | Terminal | Show `mvn test`: 110 passed; newman 44 requests, 51 assertions; UAT table. | Tested at API, component and user-acceptance level. |
| 10:00 | — | Slide: deviations and future work. | Honest limits (below). |

## Honest limits to state before they are asked

- One backend service (modular monolith), not separate microservices, to keep the system deployable and testable by a two-person team.
- No database replica and no scheduled backup in this deployment; the design describes both.
- The demo certificate is self-signed.
- User acceptance was run by the team, not by Ministry staff.
- Accounts cannot be deleted or deactivated from the interface yet.

## Likely questions

| Question | Short answer |
|---|---|
| How is access controlled? | Four roles map to 12 permission codes in a JWT; every endpoint checks them server-side; the UI hides what you cannot do. |
| What stops someone editing the audit log? | Entities are immutable, repositories have no delete, and MySQL triggers reject UPDATE and DELETE. |
| How do you know a file was not changed? | SHA-256 stored at upload; verified in tests against the downloaded bytes. |
| What happens when a deadline passes? | The state is computed live; a daily job records MET or BREACHED and raises notifications. |
| Why Spring Boot and React? | The proposal's stack; the earlier Flask prototype is preserved at tag `v1.0-flask-mysql`. |
| What would you do next? | Backups and replication, account deactivation, Ministry-run acceptance testing, notifications by email. |

## If something goes wrong

| Problem | Recovery |
|---|---|
| Page will not load | `docker compose logs backend`; if needed, `docker compose restart backend` (about 30 s). |
| Login locked | Wait 15 minutes, or use another demo account. |
| Data looks wrong | Reset with `docker compose down -v && docker compose up --build -d` (about 2 minutes) while talking through the slides. |
| Total failure | Play the recording; walk the screenshots in `docs/screens/`. |
