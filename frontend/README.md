# CTS Frontend — React

React 18 + Vite UI for the Correspondence Tracking System, talking to the
Spring Boot backend in `../backend`. Matches the proposal's frontend stack
(React + JWT + Axios).

## Requirements

- Node.js 18+ and npm — `node -v`, `npm -v`

## Run it

```powershell
npm install
npm run dev
```

Opens on **http://localhost:5173**. The dev server proxies `/api/**` to
`http://localhost:8080` (see `vite.config.js`), so start the backend first.

For a production build: `npm run build` (outputs to `dist/`).

## Screens

- **Login** — JWT auth against `/api/auth/login`, access + refresh tokens
  kept in `localStorage`; a 401 automatically tries `/api/auth/refresh`
  once before forcing a re-login (`src/api/client.js`).
- **Dashboard** — KPI cards and a by-status bar chart from
  `/api/dashboard/summary`.
- **Correspondence list** — search, status filter, SLA badges
  (overdue/due-soon computed by the backend), CSV export.
- **New request** — citizen search-or-create, document type, office,
  priority, notes.
- **Request detail** — full record, role-gated workflow action buttons
  (only the transitions the logged-in user's role is allowed to perform are
  shown — the backend re-checks this regardless), reassignment, document
  upload/download with the SHA-256 shown per file, and the audit-trail
  timeline.
- **Users & roles** (admin only) — staff list and account creation.

## What was descoped

See `../PROJECT_STATE.md` and `../backend/README.md` for the full list —
this is a narrowed vertical slice built solo in under a week, not a port of
every Flask admin screen. The 6 screens above are the ones the demo script
and rubric actually exercise.
