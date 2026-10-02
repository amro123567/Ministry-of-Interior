# CTS Frontend — React

React 18 + Vite + Tailwind UI for the Correspondence Tracking System,
talking to the Spring Boot backend in `../backend`. English and Arabic
(RTL) are supported.

## Requirements

- Node.js 18+ and npm

## Run it

```powershell
npm install
npm run dev
```

Opens on **http://localhost:5173**. The dev server proxies `/api/**` to
`http://localhost:8080` (see `vite.config.js`), so start the backend first.

Production build: `npm run build` (output in `dist/`). The Docker image
runs this build and serves it with nginx over HTTPS on port 3443.

## Screens

- **Login** — JWT login; a 401 triggers one automatic refresh attempt before
  forcing a re-login (`src/api/client.js`).
- **Dashboard** — KPI cards and charts from `/api/dashboard/summary`.
- **Correspondence list** — search, status filter, "assigned to me",
  direction and SLA columns, CSV export.
- **New request** — direction (incoming / outgoing), subject, citizen
  search-or-create, document type, office, department, priority, notes.
- **Request detail** — full record, workflow action buttons limited to what
  the user's permissions allow, assignment with history, document
  upload/download with SHA-256, status history and SLA card.
- **Citizens, family records, certificates** — civil-registry screens.
- **Workflow** — view the transition rules.
- **Reports** — throughput, aging, by type, by office, breach rate.
- **Admin** — users and roles, per-user activity, audit log (entity log
  and login attempts).

## Access control in the UI

Menu items, routes and buttons are shown according to the permissions in
the token (`hasPermission()` in `src/context/AuthContext.jsx`;
`ProtectedRoute` accepts a `permissions` list, any of which grants access).
For example, a viewer sees no "New request" link or upload control. The
backend enforces the same rules regardless, and changes to a user's
permissions apply after the next login.
