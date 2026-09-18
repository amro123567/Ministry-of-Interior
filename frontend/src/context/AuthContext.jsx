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
    const u = { username: res.data.username, fullName: res.data.fullName, roles: res.data.roles }
    localStorage.setItem('cts_user', JSON.stringify(u))
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('cts_refresh_token')
    try {
      if (refreshToken) await client.post('/auth/logout', { refreshToken })
    } catch { /* best-effort */ }
    clearTokens()
    setUser(null)
  }, [])

  const hasRole = useCallback((...roles) => !!user && roles.some((r) => user.roles.includes(r)), [user])

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
