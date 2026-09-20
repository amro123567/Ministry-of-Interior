# CTS — 20-Day Plan vs. Actual: Reanalysis & Day-by-Day Checklist

_Reanalyzed 2026-09-19 directly against the live repo at
`C:\Users\moham\OneDrive\Documents\Ministry-of-Interior` (git history, file
timestamps, and source tree — not just PROJECT_STATE.md's summary) and
against `20_Day_Capstone_Plan_v2.docx`._

## Headline findings — read this before the day-by-day table

1. **Every single git commit, on every branch, has one author**: `MohammadWSaleh
   <mohammadwajih.saleh@gmail.com>` (Mohammad Wajih Saleh — the plan's
   "Backend & Security" developer). From the very first commit after
   cloning through the final commit today, there is no commit, on `master`,
   `mvp`, `main`, or `spring-rewrite`, authored by Mohammad Ali Amro (the
   plan's "Frontend & Integration" developer), even though the GitHub
   remote itself (`amro123567/Ministry-of-Interior`) is hosted under his
   account. This doesn't prove Mohammad Ali did zero work — pairing or
   screen-sharing without separate commits wouldn't show up in git — but
   there is no independent evidence in the repository of his individual
   contribution, and the plan's whole per-developer structure (separate
   report sections, separate presentation slides, hour-by-hour parallel
   tracks) assumes two people committing independently.
2. **Real elapsed time is 5 calendar days, not 20.** Git history runs
   2026-09-15 → 2026-09-19. Of those five days:
   - **Sept 15–17**: built a *different* system — a Flask + Flask-Admin
     MVP against a 45-table civil-status-registry schema. This was later
     deleted entirely (kept only as git tag `v1.0-flask-mysql`).
   - **Sept 18**: the actual graded system (Spring Boot + React CTS) starts
     from zero. File timestamps show the *entire* backend (14 entities, 10
     controllers, 10 services, repositories, security/JWT, DTOs, exception
     handling, `DataSeeder`, both JUnit test classes) and the *entire*
     original frontend (all 6 pages, routing, `AuthContext`, shared
     components) were written in an **11-minute window, 20:22–20:33 UTC**.
     Docker/env setup followed the same evening; committed 23:01–23:09 UTC.
   - **Sept 19 (today)**: a second ~1-hour window, 10:49–11:47 UTC, added
     everything described below as "post-submission gap-closing" (SLA
     tracking, AOP audit logging, assignment history, HTTPS, the
     recharts/date-fns swap, the Postman collection), then one final commit
     and push at 11:39 UTC.
   - There is no evidence in the repo of 20 days of 8-hour, two-person work.
     The plan's ~176 person-hours of Days 3–13 backend+frontend work maps
     onto roughly one hour of actual file changes on Sept 18.
3. **The project was already submitted for grading before today's (Sept
   19) work.** PROJECT_STATE.md is explicit: "Everything (report, SDD,
   demo) is already submitted... for completeness/portfolio, not grading."
   That means the version that was actually graded did **not** include AOP
   audit logging, full SLA tracking, assignment history, the Postman
   collection, or HTTPS — those were only added afterward. If any of
   Days 7, 9, 10, or 12's deliverables were required for the grade, they
   were missing at submission time.
4. **No `v0.9-integration-complete` tag, no `v1.0` tag for the Spring
   rewrite.** The only tag in the repo is `v1.0-flask-mysql`, on the
   *abandoned* prototype. Day 13's and Day 20's tagging milestones were not
   done as specified.
5. **The first design report and SDD documented the wrong system entirely**
   (a 37–45 table civil registry that was never built) and had to be
   fully rewritten from scratch on Sept 19, after submission, once someone
   noticed. So whatever was actually submitted for Days 17–19's report
   deliverable did not describe the system that exists in the repo.
6. **Artifacts the plan requires that don't exist anywhere in the repo or
   project files**: a CLO-mapping requirements doc, UI wireframes, a
   standalone API contract document, `/docs/screenshots/`, 5 written UAT
   scenario documents, cross-browser test notes, a standalone Installation
   Guide / User Manual, a slide deck (.pptx), an updated poster, a demo
   script, and a Reports/Analytics page. These are called for on Days
   1, 2, 14, 15, 16, and 19 respectively.

Because of (1) and (2), a literal "what did each developer do on each
plan-day" checklist would be fiction — the work wasn't done that way. The
table below instead marks, for each plan day, whether that day's *deliverable*
exists in the current repo, on which track (backend/Wajih vs.
frontend/Ali per the plan's own division of labor), regardless of which
calendar day it was actually written on.

**Legend**: ✅ Done and verified in repo · ⚠️ Partial / built differently
than specified · ❌ Not found anywhere in the repo or project files ·
❓ Can't be verified from files alone (e.g. a Google Doc, an in-person sync)

---

## Phase 1 — Planning & Design (Days 1–3)

**Day 1 — Kickoff, docs read, environment setup**
- Wajih: Spring Boot init, folder structure, GitHub repo, docker-compose stub — ✅ (done, but as part of the Sept 18 scaffold, not "Day 1")
- Wajih: Requirements/CLO-mapping Google Doc — ❓ not in repo, can't confirm
- Ali: React 18 + Vite init, routing stub, Axios interceptors — ✅ (present: `api/client.js` has an interceptor; done Sept 18)
- Ali: UI screen inventory (~12 screens) — ❌ not found
- Ali: Design-report Google Doc skeleton — ❓ not in repo

**Day 2 — Architecture, ERD, API contract, wireframes**
- Wajih: Architecture diagram, workflow state machine diagram — ⚠️ diagrams exist but were produced later (Sept 19, via Claude) for documentation, not as a Day-2 design artifact
- Wajih: Full MySQL schema + ERD — ⚠️ an ERD exists (`docs/database/CTS-Database-Design.eraser`, Sept 15) but it's the **45-table civil registry** schema for the abandoned Flask MVP, not the 13-table CTS Spring schema actually built
- Wajih: API contract document — ❌ not found as a standalone doc (only implicit in the Postman collection, added Sept 19)
- Ali: Wireframes for 12 screens — ❌ not found
- Ali: Component hierarchy / state-mgmt plan doc — ❌ not found
- Ali: API contract review/annotation — ❓ can't verify

**Day 3 — Docker Compose, JPA entities, Spring Security, React routing**
- Wajih: Docker Compose finalized, init.sql/9-table schema, indexes — ⚠️ Docker Compose exists and works (verified in `PROJECT_STATE.md` via real `docker compose up`), but schema is 13 tables named differently (`AppUser`, `Office`, `Citizen`, `CorrespondenceRequest`... ) not the plan's `Correspondence`/`Department`/`SLARecord` naming
- Wajih: JPA entities + repos, Spring Security + JWT filter — ✅ present (`SecurityConfig.java`, `JwtService.java`, `JwtAuthFilter.java`, full repository layer)
- Wajih/Ali: Day-3 joint sync, connectivity test — ❓ can't verify a "sync" happened; the connectivity itself works today
- Ali: React structure, Layout, role-based nav, 12 placeholder routes, NotFound page — ⚠️ `App.jsx`/`ProtectedRoute.jsx` exist but only 6 real pages, not 12 placeholder routes; no dedicated `NotFound.jsx` found
- Ali: Shared components (StatusBadge, PriorityBadge, Modal, etc.) — ⚠️ only `StatusBadge.jsx`/`SlaBadge` and `Navbar.jsx`/`ProtectedRoute.jsx` found; no `PriorityBadge`, `LoadingSpinner`, `EmptyState`, `ConfirmModal`, `PageHeader` as separate components

## Phase 2 — Core Backend & Frontend Foundation (Days 4–8)

**Day 4 — Authentication & user management**
- Wajih: JWT filter chain, `AuthController`, `UserController`, `DataSeeder` (4 roles + demo users), 3 JUnit auth tests — ✅ present and working (demo accounts confirmed: `admin/Admin1234!`, `manager/Manager1234!`, `officer/Officer1234!`, `viewer/Viewer1234!`); exact test count not confirmed at 3 (tests are consolidated into 2 test classes, 19 tests total across the whole suite)
- Ali: Login page, `AuthContext`, `ProtectedRoute`/`RoleGuard`, full E2E auth flow test — ✅ `LoginPage.jsx`, `AuthContext.jsx`, `ProtectedRoute.jsx` present; note `AuthContext` stores the JWT in `localStorage` (PROJECT_STATE.md), which the plan explicitly says **not** to do ("not localStorage — keep in memory")
- Ali: Separate `RoleGuard` component — ❌ not found as its own file (role checks appear inlined via `hasRole()`)

**Day 5 — Correspondence registration**
- Wajih: Correspondence entity + reference-ID generator, service/controller, `@PreAuthorize`, global exception handler, 4 JUnit tests — ✅ present as `CorrespondenceRequest` entity + `RequestController`/`RequestService`; `GlobalExceptionHandler` present; reference-number format not independently verified
- Ali: Create/List/Detail pages wired end-to-end — ✅ `RequestCreatePage.jsx`, `RequestsListPage.jsx`, `RequestDetailPage.jsx` all present and confirmed wired to the API (verified by reading the actual source)

**Day 6 — Workflow state machine**
- Wajih: `WorkflowTransitionRule` entity, `available-transitions` endpoint, transition service with audit-on-transition — ⚠️ `WorkflowTransitionRule` entity/repo exist and `RequestService.transition()` enforces roles, but there is **no** `GET /available-transitions` endpoint — the frontend hardcodes the same transition/role map independently (confirmed by reading `RequestDetailPage.jsx`: a `TRANSITIONS` constant, not an API call) — a duplicated-logic deviation from the plan's design
- Ali: Workflow section + dynamic `WorkflowTransitionModal`, status refresh, role-specific test — ⚠️ status/transition buttons exist inline in `RequestDetailPage.jsx`, but as static buttons driven by the hardcoded map above, not a dynamic modal fetching allowed transitions from the backend

**Day 7 — Assignment & routing**
- Wajih: `Assignment` entity with active/inactive history, `AssignmentService`/`Controller`, 3 JUnit tests — ⚠️ **only landed Sept 19, after submission**, as `RequestAssignmentHistory` + `RequestAssignmentHistoryRepository`; before that, PROJECT_STATE.md confirms only "a single `assignedToId` field + `PATCH /assign`" existed — i.e. Day 7's design was not actually built until the post-submission pass
- Ali: Assignment section, `AssignmentModal`, history timeline, "Assigned to me" filters — ⚠️ same timing issue: the "Assigned to me" toggle and assignment-history card in `RequestDetailPage.jsx`/`RequestsListPage.jsx` were also added Sept 19, not during initial development; no separate `AssignmentModal` component (reassign form is inlined)

**Day 8 — Document management**
- Wajih: `AttachedDocument` entity, upload/download/checksum service, MIME/size validation, 3 JUnit tests — ✅ `Attachment` entity + `AttachmentController`/`AttachmentService` present; SHA-256 checksum confirmed (visible in `RequestDetailPage.jsx`: `a.sha256.slice(0,12)`)
- Ali: Documents tab, drag-and-drop upload with progress bar, download-with-checksum-tooltip — ⚠️ a documents card exists in `RequestDetailPage.jsx` with upload and download-by-blob, and the SHA-256 is shown (not as a tooltip, just inline text); there is **no** drag-and-drop zone, no upload progress bar, and no dedicated reusable file-upload component — single native `<input type="file">`

## Phase 3 — Feature Completion (Days 9–13)

**Day 9 — Audit logging (AOP)**
- Wajih: `AuditLog` entity, **AOP aspect** auto-logging every controller method, global + per-item audit endpoints, 3 JUnit tests — ⚠️ **the AOP aspect (`AuditLoggingAspect.java`, `@Audited` annotation) was only added Sept 19, after submission.** Before that, audit logging was manual `AuditService.log(...)` calls scattered in service code — the opposite of what Day 9 specifies (no `@AfterReturning` catch-all pointcut across every controller; the new aspect only covers 4 specific methods, not "every successful action")
- Ali: Audit Log tab per-correspondence, **Global Audit Log page** (Admin-only, filterable), dashboard activity feed — ⚠️ a per-request "Audit trail" card exists in `RequestDetailPage.jsx`; there is **no** standalone Global Audit Log page or Admin data table anywhere in `frontend/src/pages`, despite the backend `AuditController` existing to support one

**Day 10 — SLA tracking**
- Wajih: `SLARecord` entity, `SLAService`, `@Scheduled` daily job, SLA endpoints, 3 JUnit tests — ⚠️ **also only added Sept 19, after submission** (`SlaStatus.java`, `SlaController.java`, `SlaNotificationScheduler.java` all timestamped ~10:49 UTC today). Before that, SLA was "a plain `overdue` boolean" per PROJECT_STATE.md — Day 10's design wasn't actually built until today
- Ali: SLA badges on list/detail, warning banners, Dashboard SLA Alert panel + breakdown chart — ⚠️ an `SlaBadge` component exists and renders on both list and detail pages (added today), but no dedicated Dashboard "Overdue/Due Soon" alert cards or SLA-breakdown-by-department chart were found in `DashboardPage.jsx`

**Day 11 — Dashboards & reporting APIs**
- Wajih: `DashboardController` (4 endpoints), `ReportsController` (throughput/aging/export), Postman tests for all 7 — ⚠️ `DashboardController`/`DashboardService` exist (a single summary-style endpoint, per PROJECT_STATE's "4 total requests, 1 Overdue..." dashboard); **no `ReportsController` exists at all** — no throughput or aging endpoints
- Ali: 4 KPI cards, Bar/Pie/Line charts, recent-activity feed, 60s auto-refresh — ⚠️ `DashboardPage.jsx` exists with a recharts bar chart (only added/swapped-in Sept 19 — before that it was, per PROJECT_STATE.md, "a hand-rolled div/bar-fill chart"); no pie chart, no line chart, no recent-activity feed panel, no auto-refresh found

**Day 12 — Search, advanced filtering, reports UI, Postman**
- Wajih: `Specification`-based dynamic multi-filter search, CSV export, DB index verification, final Postman export — ⚠️ CSV export confirmed (`GET /requests/export`, wired in `RequestsListPage.jsx`); search is a single free-text `search` param plus a status dropdown and an `assignedToMe` flag — not the full status/department/priority/SLA/date-range filter set the plan calls for; the **Postman collection itself was only created Sept 19**, after submission, not on Day 12
- Ali: Advanced filter drawer, **URL-persisted filters** via `useSearchParams`, Reports & Analytics page with 3 tabs — ❌ none of this exists: `RequestsListPage.jsx` has a plain search box, a status dropdown, and one toggle button — no filter drawer, no URL query-string persistence, no Reports/Analytics page anywhere in the frontend

**Day 13 — Full integration day**
- Wajih: Full Postman sweep, realistic seed data (20 correspondences, 6 users, 3 departments, 50 audit entries, 3 overdue), merge to `main`, tag `v0.9-integration-complete` — ⚠️ `DataSeeder.java` exists and seeds roles/offices/demo users, but the dashboard's own numbers ("4 total requests... 1 Closed this week") indicate a much smaller seed set than the 20-correspondence/50-audit-entry target; **no `v0.9` tag exists in the repo**, and the branch that carries this work is `spring-rewrite`, never merged to `main`
- Ali: Full frontend sweep across 4 roles, 3 end-to-end flow traces, responsive check at 3 breakpoints, screenshots stored to `/docs/screenshots/` — ❌ no `/docs/screenshots/` directory exists anywhere in the repo (`docs/` only contains `database/` and `postman/`); no responsive-check notes found

## Phase 4 — Integration, Testing & Early Documentation (Days 14–16)

**Day 14 — Integration/security testing, UAT**
- Wajih: `@SpringBootTest` lifecycle/security tests, a 5-point security test battery (expired JWT, tampered claim, SQLi, .exe upload, cross-user access), 25+ JUnit tests total — ⚠️ only **2 test classes, 19 tests total** exist (`RequestWorkflowIntegrationTest`: 14, `JwtServiceTest`: 5) — short of the 25+ target; the specific security-battery scenarios (SQLi attempt, tampered-role-claim JWT, `.exe` rejection) were not independently confirmed present
- Ali: 5 written UAT scenario docs + execution log, cross-browser testing notes — ❌ none found anywhere in the project or repo

**Day 15 — Bug fixing, performance, UI polish**
- Wajih: DB `EXPLAIN` pass, N+1 fixes, standardized API error envelope, logging/Javadoc cleanup — ❓ not independently verifiable without reading full source; no evidence either way
- Ali: Visual consistency pass, loading/empty/error states, final 1280×800 screenshots of all 12 screens — ⚠️ basic loading/error states exist inline (`"Loading…"`, `alert-error` divs) but there are only 6 real screens, not 12, and — as PROJECT_STATE.md states outright — **no screenshots have ever been captured** ("Section 5 (Interface Design) has no real screenshots yet")

**Day 16 — Final verification, Docker demo, early report drafting**
- Wajih: Clean `docker-compose down -v && up` demo test, API documentation table, Postman collection exported to `/docs/postman/`, draft Sections 3/4/7 — ⚠️ the Docker demo test genuinely happened and is verified (real bug found and fixed — a CORS gap), and the Postman collection is in `/docs/postman/CTS_API_Collection.json` — but both happened **Sept 19, after submission**, not Day 16; no standalone API-documentation table found
- Ali: Installation Guide, User Manual, draft Sections 1/2 — ❌ no standalone Installation Guide or User Manual file exists (only a root `README.md`); the original report sections that were drafted described the wrong system and were fully discarded and rewritten Sept 19

## Phase 5 — Report, Presentation & Submission (Days 17–20)

**Days 17–18 — Design report writing, all diagrams**
- Both: 13-section Watfa-template report with 6 UML diagrams and full database section — ⚠️ a report exists (`CTS_Design_Report_v3.docx`, 39 pages, in `Claude outputs/`) with all 6 UML diagrams — but it is **v3**, entirely rewritten on Sept 19 (today) because the original report from these plan-days documented a completely different, never-built 37–45 table civil-registry system. Whatever was drafted on the actual Days 17–18 did not describe the real system.

**Day 19 — Formatting, slides, poster, demo script**
- Wajih: Report formatted to spec (TNR 12, double-spaced, roman/Arabic pagination), slides 1–9 — ⚠️ the *design document* (SDD v4) went through a dedicated formatting/polish pass (fixed TOC, cover page, redrawn figures) — but that's the SDD, not this report; **no slide deck (.pptx) exists anywhere in the repo or project files**
- Ali: Copy-edit pass, poster updated to final tech stack, slides 10–19, demo script — ❌ no evidence the poster (`Capstone Project Poster.png`, last touched in May) was ever updated for the final stack; no slide deck; no demo script file found anywhere

**Day 20 — Final demo, submission, presentation**
- Both: Full clean demo run, submission-deliverable checklist, GitHub tagged `v1.0`, joint rehearsal — ⚠️ **submission has already happened** per PROJECT_STATE.md, and a genuine live Docker demo run did occur (Sept 19, catching the CORS bug) — but there is **no `v1.0` tag** on the actual Spring+React system (only `v1.0-flask-mysql` on the discarded prototype), and no evidence of a rehearsal, backup demo video, or joint Q&A prep

---

## Rubric-relevant bottom line (CLO mapping, from the plan's own table)

| CLO | What the plan wanted as evidence | What actually exists |
| --- | --- | --- |
| CLO1 (Problem analysis) | Formal FR/NFR tables, 8+ APA lit-review refs | Present in the rewritten report (v3), but produced Sept 19 by Claude reconstructing it, not from Days 1/16/17 work |
| CLO2 (Entrepreneurial thinking) | Feasibility, innovation, ethics sections | Present in v3, same caveat as above |
| CLO3 (CS theory & implementation) | Working app, 6 UML diagrams, 25+ JUnit tests, Postman | App works and is Docker-verified; 6 diagrams exist; **only 19 JUnit tests, not 25+**; Postman collection exists but was built after submission |
| CLO4 (Communication) | 40–60 page report, slide deck, live demo | Report exists (39–30 pages depending on document) but was substantively wrong until today's rewrite; **no slide deck found**; live demo capability confirmed working |
| CLO5 (Collaboration & PM) | GitHub commits from **both** developers, Gantt chart, milestone log | **Every commit has one author**; no Gantt chart found; no milestone log found; branch never merged to `main`, no `v0.9`/`v1.0` tags |

## What this means practically

If grading already happened against this repository, the strongest, most
verifiable claim about the codebase is: a working, Docker-deployable Spring
Boot + React system with real RBAC, a workflow state machine, document
upload with SHA-256 integrity, and (as of today, post-submission) audit
logging, SLA tracking, and assignment history — built almost entirely in
two short sessions on Sept 18–19, by one identifiable contributor, without
most of the process documentation (wireframes, UAT logs, screenshots,
Gantt chart, slide deck, updated poster) the 20-Day Plan and the CSC599
rubric ask for as *evidence* of the 20-day, two-person process — separately
from whether the code itself works.
