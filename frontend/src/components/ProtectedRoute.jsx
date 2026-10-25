import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children, roles, permissions }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  // permissions is checked when given -- it's what the backend actually
  // enforces (see AuthContext.hasPermission), so routes that map to a
  // real backend permission gate on that instead of a hardcoded role
  // name. roles stays supported for anything that isn't permission-gated.
  if (permissions && !permissions.some((p) => user.permissions?.includes(p))) {
    return <Navigate to="/" replace />
  }
  if (roles && !roles.some((r) => user.roles.includes(r))) {
    return <Navigate to="/" replace />
  }
  return children
}
