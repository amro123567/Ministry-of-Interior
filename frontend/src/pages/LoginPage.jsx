import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (user) {
    navigate('/', { replace: true })
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(username, password)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message ?? 'Login failed. Check your username and password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>Correspondence Tracking System</h1>
        <p className="muted">Directorate of Civil Status — Lebanese Ministry of Interior</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted small">
          Demo accounts: admin / Admin1234! · manager / Manager1234! · officer / Officer1234! · viewer / Viewer1234!
        </p>
      </form>
    </div>
  )
}
