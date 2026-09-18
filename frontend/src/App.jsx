import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import RequestsListPage from './pages/RequestsListPage.jsx'
import RequestCreatePage from './pages/RequestCreatePage.jsx'
import RequestDetailPage from './pages/RequestDetailPage.jsx'
import AdminUsersPage from './pages/AdminUsersPage.jsx'

export default function App() {
  return (
    <>
      <Navbar />
      <main className="page">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/requests" element={<ProtectedRoute><RequestsListPage /></ProtectedRoute>} />
          <Route path="/requests/new" element={<ProtectedRoute><RequestCreatePage /></ProtectedRoute>} />
          <Route path="/requests/:id" element={<ProtectedRoute><RequestDetailPage /></ProtectedRoute>} />
          <Route
            path="/admin/users"
            element={<ProtectedRoute roles={['ADMIN']}><AdminUsersPage /></ProtectedRoute>}
          />
        </Routes>
      </main>
    </>
  )
}
