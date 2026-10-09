# CTS — Project Milestone Log

Source: the git history of `github.com/amro123567/Ministry-of-Interior` (branch `spring-rewrite`), 15 September to 9 October 2026, plus the project plan (CPP work-breakdown structure).

## Timeline

| Phase (CPP WBS) | Dates | Milestone | Evidence (commit message) |
|---|---|---|---|
| 1.0 Requirements and 2.0 Design | 15–17 Sep | Repository created; ERD for the civil-status registry; first working prototype (Flask) with the agreed database design and a bilingual Arabic/English interface with right-to-left layout and a data-driven dashboard | "Add ERD schema for civil status registry"; "Updated MVP with the exact database design and enhanced UI"; "UI/UX overhaul: bilingual AR/EN with RTL…" |
| 3.0 Development | 18 Sep | MySQL migration, schema hardening, role-based access control, first tests | "MySQL migration, schema hardening, RBAC, tests, cleanup" |
| 3.0 Development / 5.0 Deployment | 19 Sep | **Rewrite to the proposal's stack** (Spring Boot + React); Flask prototype preserved at tag `v1.0-flask-mysql`; Docker Compose; Postman collection; audit logging; SLA tracking; assignment history; HTTPS | "Remove Flask/Python prototype…; add Docker Compose setup"; "Add Postman collection, AOP audit logging, SLA tracking, assignment history, and HTTPS fixes" |
| 3.0 Development | 20 Sep | Full-requirements migration: documents with seven certificate subtypes, citizen registry, workflow engine, SLA records and payments, three-tier audit, sessions, permission-based RBAC; matching front-end screens | "Full-requirements migration (Items 1-8) + permission-based RBAC + frontend integration pass" |
| 6.0 Documentation | 21 Sep | Repository cleanup; Software Design Document updated | "Update SDD" |
| 3.0 / 4.0 Hardening | 2–3 Oct | Gap closure against the requirements: write-access limited to workflow roles (viewer is read-only); incoming/outgoing direction, subject and department routing; list filters; readable references `CTS-YYYY-NNNNNN`; append-only audit tables with MySQL triggers; closed requests cannot be assigned; workflow catalog drives transitions; document validation and physical-custody records (FR-11); document-type authority catalog (FR-05) | 20 commits on 3 Oct, see `git log` |
| 4.0 Testing and Validation | 9 Oct | CSV export honours filters; non-fatal reference migration; audit rows for seeded data; Postman collection with assertions on every request (44 requests, 51 assertions, run with newman); 12 front-end component tests; 10 user-acceptance scenarios (one defect found and fixed: executable uploads were accepted) | commits of 9 Oct; `docs/UAT.md` |
| 6.0 Documentation | 9 Oct | README refresh, installation guide, user manual with real screenshots | "Add installation guide, user manual with screenshots" |

## Test status at the last milestone

| Layer | Result |
|---|---|
| Backend (JUnit, in-memory H2) | 110 tests, 0 failures |
| API (Postman / newman) | 44 requests, 51 assertions, 0 failed |
| Front end (Vitest + Testing Library) | 12 tests, 0 failures |
| User acceptance | 10 scenarios, all pass after one fix (`docs/UAT.md`) |

## Remaining

Final report, slide deck, demo script (`docs/DEMO_SCRIPT.md`), refreshed poster. Documented deviations from the proposal that are not planned: single backend service instead of microservices; no database replica or scheduled backup.

## Team and collaboration

*To be completed with the team member's details:* who contributed what, the dates of the working meetings, and the decisions taken in them. All source commits come from one workstation; contribution by the second team member took place in meetings and is recorded here, not in the commit history.
