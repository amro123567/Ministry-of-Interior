# CTS — Correspondence Tracking System

Ministry of Interior, Directorate of Civil Status — CSC599 capstone project.

A Spring Boot + React system for tracking correspondence requests (certificate
requests, document lookups) through their workflow, from submission to
archival, with role-gated actions, document attachments, and a full audit
trail.

## Structure

| Folder | What it is |
|---|---|
| `backend/` | Spring Boot 3 REST API — see `backend/README.md` for setup, the demo accounts, and what was descoped |
| `frontend/` | React 18 + Vite UI — see `frontend/README.md` for the screens and setup |
| `docs/` | Design documentation (ERD source, etc.) |
| `PROJECT_STATE.md` | Working notes on project status, decisions, and what's left before submission |

## Quick start — Docker (recommended)

The whole system — MySQL, backend, frontend — starts with one command:

```powershell
copy .env.example .env
# edit .env: set MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, JWT_SECRET

docker compose up --build
```

Open **https://localhost:3443**. The frontend container serves the built
React app and proxies `/api/**` to the backend internally, so there's no
CORS configuration to worry about and no separate frontend/backend startup
order to get right. First boot takes a bit longer while images build and
Hibernate creates the schema; after that `docker compose up` is fast.

### HTTPS

The frontend container only serves HTTPS (there is no plain-HTTP port) and
terminates TLS with a self-signed certificate generated fresh at image
build time (see `frontend/Dockerfile` and `frontend/nginx.conf`). Your
browser will show a "not private" / certificate warning the first time —
that's expected for a self-signed cert; click through it (or add an
exception) to proceed. This is sufficient for a capstone demo but is not
how you'd terminate TLS for a real Ministry deployment: there you'd mount
in a certificate from an internal CA (or a public one, against a real
domain) instead of generating one at build time.

To reset to a clean slate (wipes the database):

```powershell
docker compose down -v
docker compose up --build
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

Then open **http://localhost:5173**. See `backend/README.md` for first-time
database setup (creating `cts_spring_db` and the `.env` file) before the
backend will start this way — the Docker path above handles that
automatically instead. This path is plain HTTP only; the self-signed HTTPS
setup above applies to the Docker Compose path.

## History

This system was originally prototyped in Flask + Flask-Admin against a
46-table `civil_registry_db` MySQL schema (see the original capstone
proposal, `CPP.docx`, in the project docs). It was rewritten in Spring Boot +
React to match that proposal's required stack, as a narrowed vertical slice
covering the full correspondence workflow end to end rather than every
admin screen of the original design.

The Flask prototype is no longer part of this working tree, but it isn't
lost: it's preserved at the git tag **`v1.0-flask-mysql`**. To look at it
again:

```powershell
git checkout v1.0-flask-mysql
```

Its own database (`civil_registry_db`) was left untouched by the rewrite and
the cleanup that removed its code — only the application code was removed,
never any data.

## Schema reference

A generated ERD and full table reference for the current `cts_spring_db`
schema is available as a published page (ask Claude for the link if you've
lost it, or regenerate it from a live boot of the backend).
