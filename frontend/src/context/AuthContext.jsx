import { createContext, useContext, useState, useCallback } from 'react'
import client, { setTokens, clearTokens } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('cts_user')
    return raw ? JSON.parse(raw) : null
  })

  const login = useCallback(async (username, password) => {
    const res = await client.post('/auth/login', { username, password })
    setTokens(res.data.accessToken, res.data.refreshToken)
    const u = {
      username: res.data.username,
      fullName: res.data.fullName,
      roles: res.data.roles,
      // The union of every permission res.data.roles actually grants (see
      // AuthService.effectivePermissions() on the backend) -- this, not
      // the role names above, is what hasPermission() below checks, so
      // the frontend's idea of "who can do what" always matches what the
      // backend will actually allow.
      permissions: res.data.permissions ?? [],
    }
    localStorage.setItem('cts_user', JSON.stringify(u))
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    // Clear client-side state first so logging out always works instantly,
    // even if the backend is unreachable or slow — the server-side call
    // below is best-effort and must never block the user from logging out.
    const refreshToken = localStorage.getItem('cts_refresh_token')
    clearTokens()
    setUser(null)
    if (refreshToken) {
      client.post('/auth/logout', { refreshToken }).catch(() => { /* best-effort */ })
    }
  }, [])

  const hasRole = useCallback((...roles) => !!user && roles.some((r) => user.roles.includes(r)), [user])

  // Prefer this over hasRole() for gating anything the backend also
  // enforces (a route, a nav link, an action button) -- it checks the
  // same permission codes SecurityConfig/RequestService actually check,
  // instead of the frontend keeping its own separate idea of which role
  // name is allowed to do what.
  const hasPermission = useCallback(
    (...permissions) => !!user && permissions.some((p) => user.permissions?.includes(p)),
    [user],
  )

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
