import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Navbar() {
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header className="navbar">
      <div className="navbar-brand">CTS <span>Directorate of Civil Status</span></div>
      <nav className="navbar-links">
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/requests">Correspondence</NavLink>
        <NavLink to="/requests/new">New Request</NavLink>
        {hasRole('ADMIN') && <NavLink to="/admin/users">Users</NavLink>}
      </nav>
      <div className="navbar-user">
        <span>{user.fullName} <em>({user.roles.join(', ')})</em></span>
        <button onClick={handleLogout} className="btn-link">Log out</button>
      </div>
    </header>
  )
}
