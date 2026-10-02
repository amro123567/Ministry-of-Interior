import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Breadcrumb from './components/Breadcrumb.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { useLanguage } from './context/LanguageContext.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import RequestsListPage from './pages/RequestsListPage.jsx'
import RequestCreatePage from './pages/RequestCreatePage.jsx'
import RequestDetailPage from './pages/RequestDetailPage.jsx'
import AdminUsersPage from './pages/AdminUsersPage.jsx'
import UserActivityPage from './pages/UserActivityPage.jsx'
import AuditLogPage from './pages/AuditLogPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import CitizenRegistryPage from './pages/CitizenRegistryPage.jsx'
import CitizenDetailPage from './pages/CitizenDetailPage.jsx'
import CitizenCreatePage from './pages/CitizenCreatePage.jsx'
import FamilyRecordCreatePage from './pages/FamilyRecordCreatePage.jsx'
import FamilyRecordDetailPage from './pages/FamilyRecordDetailPage.jsx'
import DocumentCreatePage from './pages/DocumentCreatePage.jsx'
import DocumentDetailPage from './pages/DocumentDetailPage.jsx'
import WorkflowEnginePage from './pages/WorkflowEnginePage.jsx'

export default function App() {
  const location = useLocation()
  const { t } = useLanguage()
  const isLoginRoute = location.pathname === '/login'

  // The login page keeps its own full-bleed, centered layout (no sidebar,
  // no header, no footer) -- it isn't part of the authenticated app shell.
  if (isLoginRoute) {
    return (
      <div className="app-shell">
        <main className="page-full">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:start-3 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t('common.skipToContent')}
      </a>

      <Navbar />

      <main id="main-content" className="flex-1 w-full max-w-[1400px] mx-auto px-5 sm:px-8 py-6">
        <Breadcrumb />
        <Routes>
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/requests" element={<ProtectedRoute><RequestsListPage /></ProtectedRoute>} />
          <Route path="/requests/new" element={<ProtectedRoute permissions={['REQUEST_TRANSITION_SUBMIT', 'REQUEST_TRANSITION_REVIEW', 'REQUEST_TRANSITION_DECIDE', 'REQUEST_TRANSITION_ARCHIVE']}><RequestCreatePage /></ProtectedRoute>} />
          <Route path="/requests/:id" element={<ProtectedRoute><RequestDetailPage /></ProtectedRoute>} />
          {/* No permissions prop -- CitizenController only requires
              authentication on the backend (SecurityConfig's
              anyRequest().authenticated() fallback), same as /offices
              and /document-types, so this route isn't gated any tighter
              than the API actually is. */}
          <Route path="/citizens" element={<ProtectedRoute><CitizenRegistryPage /></ProtectedRoute>} />
          {/* Registering a citizen is a write, unlike the two routes above
              -- gated on CITIZEN_MANAGE, matching SecurityConfig's own
              POST /api/citizens/** matcher (granted to ADMIN/MANAGER/
              OFFICER, not VIEWER, in DataSeeder). */}
          <Route
            path="/citizens/new"
            element={<ProtectedRoute permissions={['CITIZEN_MANAGE']}><CitizenCreatePage /></ProtectedRoute>}
          />
          <Route path="/citizens/:id" element={<ProtectedRoute><CitizenDetailPage /></ProtectedRoute>} />
          {/* Family records, guardianship, registry transfers and
              civil-status amendments are the same domain as the citizen
              registry above -- creating one is CITIZEN_MANAGE (matching
              SecurityConfig's POST /api/family-records/** matcher);
              viewing one has no dedicated matcher on the backend either
              (falls through to anyRequest().authenticated(), same as
              /citizens/:id), so this route isn't gated any tighter than
              the API actually is. */}
          <Route
            path="/family-records/new"
            element={<ProtectedRoute permissions={['CITIZEN_MANAGE']}><FamilyRecordCreatePage /></ProtectedRoute>}
          />
          <Route path="/family-records/:id" element={<ProtectedRoute><FamilyRecordDetailPage /></ProtectedRoute>} />
          {/* The 7 document subtypes (birth/marriage/divorce/death
              certificates, national ID cards, naturalization and
              name-change records) -- issuing any of them is CITIZEN_MANAGE
              (SecurityConfig's POST /api/documents/** matcher); reads have
              no dedicated matcher either, same as the routes above. */}
          <Route
            path="/documents/new"
            element={<ProtectedRoute permissions={['CITIZEN_MANAGE']}><DocumentCreatePage /></ProtectedRoute>}
          />
          <Route path="/documents/:apiSegment/:id" element={<ProtectedRoute><DocumentDetailPage /></ProtectedRoute>} />
          {/* The workflow engine's catalog (states/transitions) is
              USER_MANAGE-gated on the backend, but operating an instance
              (create / execute a transition) is deliberately NOT -- see
              WorkflowEnginePage's own comment -- so this route has no
              permissions prop at all, matching the citizen registry above:
              every authenticated user can reach the page, and the
              page itself hides the catalog-editing affordances inline via
              hasPermission('USER_MANAGE') rather than the route hiding the
              whole page from an Officer who can legitimately still start
              and operate an instance. */}
          <Route path="/workflow" element={<ProtectedRoute><WorkflowEnginePage /></ProtectedRoute>} />
          <Route
            path="/reports"
            element={<ProtectedRoute permissions={['REPORTS_VIEW']}><ReportsPage /></ProtectedRoute>}
          />
          <Route
            path="/admin/users"
            element={<ProtectedRoute permissions={['USER_MANAGE']}><AdminUsersPage /></ProtectedRoute>}
          />
          {/* Gated on AUDIT_VIEW, not USER_MANAGE -- this reads the same
              /api/audit/** endpoints as /admin/audit below (backend-only
              gate is AUDIT_VIEW; see UserActivityPage's own comment), so
              the route matches what the API actually requires rather than
              piggybacking on the USER_MANAGE gate of the page that links
              to it. Deliberately not in Navbar's links -- reached only via
              AdminUsersPage's "View activity" link, frontend integration
              pass Step 8. */}
          <Route
            path="/admin/users/:id/activity"
            element={<ProtectedRoute permissions={['AUDIT_VIEW']}><UserActivityPage /></ProtectedRoute>}
          />
          <Route
            path="/admin/audit"
            element={<ProtectedRoute permissions={['AUDIT_VIEW']}><AuditLogPage /></ProtectedRoute>}
          />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
