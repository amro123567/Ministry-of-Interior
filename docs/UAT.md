# User Acceptance Testing (UAT) — CTS

**Date:** 2026-10-09  **Tester:** Mohammad Serhan  **Branch:** `spring-rewrite`
**Environment:** Spring Boot backend + MySQL in Docker (port 8080); React front end on the **Vite dev server** (`http://localhost:5173`, API proxied). The Docker HTTPS build (`https://localhost:3443`, self-signed certificate) was not used because the test browser cannot open it. The front-end code is identical.
**Data:** demo seed data plus earlier Postman runs (20 requests).
**Scope (from the CPP):** correspondence registration, assignment, workflow transitions, reporting, plus RBAC, audit and SLA.

## Summary

| # | Scenario | Role | Result | Evidence |
|---|----------|------|--------|----------|
| 1 | Register an outgoing request and submit it | Officer | PASS | `uat1-01`, `uat1-02` |
| 2 | Review: rejection requires a reason; approve | Manager | PASS (F1) | `uat2-01`, `uat2-02` |
| 3 | Assign, then reassign; history keeps both | Admin | PASS | activity log text |
| 4 | Read-only access: no "New request" button | Viewer | PASS | `uat4-01` |
| 5 | Audit trail: global and per-request logs | Admin | PASS | `uat5-01` |
| 6 | Overdue SLA warning and filter | Admin | PASS (N1) | `uat6-01` |
| 7 | Attachments: upload with SHA-256; reject bad type | Admin | PASS after fix (D1) | page text |
| 8 | Search and CSV export match | Admin | PASS | exported CSV text |
| 9 | Reports consistency and Arabic/RTL | Admin | PASS (N3) | `uat9-01` |
| 10 | User administration and RBAC enforcement | Admin, then new Viewer | PASS | `uat10-01` |

**Result: 10 of 10 pass. One defect (D1) was found during the run and fixed; scenario 7 was re-run after the fix.**

## Details

**3. Assignment.** Request CTS-2026-000006 was assigned to Karim Fares with a note, then reassigned to Rana Haddad. The assignment history lists both entries newest first with their notes, the "Assigned to" field shows only Rana, and the activity log has two ASSIGN rows.

**7. Attachments.** `uat7-sample.txt` uploaded and is listed with its SHA-256 hash and a DOCUMENT_UPLOAD activity row. **`malware.exe` was also accepted** on the first run and listed with a hash (defect D1).

*Re-run after the fix* (backend rebuilt): `second-malware.exe` was refused with "File type not allowed. Allowed types: csv, doc, docx, gif, jpeg, jpg, pdf, png, txt, xls, xlsx." and was not listed; `uat7-after-fix.pdf` uploaded normally.

**8. Search and CSV.** Searching "Mansour" returned 2 requests (000003, 000020). Export CSV, with the search active, contained exactly those 2 rows. This confirms the section-1 fix, where the export honours the active filters. The search is also kept in the URL (`?q=Mansour`).

**9. Reports and Arabic.** Totals agree: 20 requests = 18 open + 2 closed; by document type 17 + 1 + 2; by office 19 + 1. Switching to Arabic sets `dir=rtl` and `lang=ar`, and the headings, KPIs and table headers are translated.

**10. User administration.** The admin created `uat10viewer` (role VIEWER) from Users & roles. Signing in as that user succeeded, `/admin/users` redirected to the dashboard, the admin menu entries were absent, and the API refused the call: `GET /api/users` returned 403 while `GET /api/requests` returned 200.

## Defects and findings

- **D1 (security, medium — FIXED):** the upload endpoint accepted any file type, including `.exe`. The design (SDD §12.3) says allowed types are listed and others refused. Fix: server-side extension allow-list in `AttachmentService` (last extension, case-insensitive, so `report.pdf.exe` is refused) plus `AttachmentTypeValidationTest` (3 tests). Verified by re-running scenario 7.
- **F1 (UI, minor):** the detail page shows the "Reassign to" form on APPROVED / REJECTED / ARCHIVED requests, although the backend refuses it (HTTP 400). Fix: hide the form for closed statuses.
- **N1:** a DRAFT request counts as overdue because the SLA clock starts at creation. Document it, or start the clock on submission.
- **N2:** `?sla=OVERDUE` in the URL does not pre-select the filter (the search term does persist).
- **N3:** week labels in the throughput chart stay in English (`Aug 14`) in Arabic mode.
- **N4:** there is no user deactivation control in the UI; the Postman runs left six "New Officer" test accounts and an uploaded `malware.exe` on request 6 that should be cleaned up before the demo.
