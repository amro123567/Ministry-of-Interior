import axios from 'axios'

const client = axios.create({ baseURL: '/api', timeout: 15000 })

function getTokens() {
  return {
    accessToken: sessionStorage.getItem('cts_access_token'),
    refreshToken: sessionStorage.getItem('cts_refresh_token'),
  }
}

export function setTokens(accessToken, refreshToken) {
  if (accessToken) sessionStorage.setItem('cts_access_token', accessToken)
  if (refreshToken) sessionStorage.setItem('cts_refresh_token', refreshToken)
}

export function clearTokens() {
  sessionStorage.removeItem('cts_access_token')
  sessionStorage.removeItem('cts_refresh_token')
  sessionStorage.removeItem('cts_user')
}

// Reads the `exp` claim of a JWT without verifying it (the server does that).
// Returns true when the token is already expired, or will be within `skewSeconds`.
export function isTokenExpired(token, skewSeconds = 15) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(part))
    return typeof exp === 'number' && exp * 1000 <= Date.now() + skewSeconds * 1000
  } catch {
    return false // not a JWT we can read: let the server decide
  }
}

let refreshing = null

// One refresh at a time: concurrent requests (the dashboard fires several, the
// notification bell polls) all wait on the same call, so the rotating refresh
// token is only spent once.
function refreshTokens() {
  if (!refreshing) {
    const { refreshToken } = getTokens()
    refreshing = axios.post('/api/auth/refresh', { refreshToken })
      .then((res) => {
        setTokens(res.data.accessToken, res.data.refreshToken)
        return res.data.accessToken
      })
      .finally(() => { refreshing = null })
  }
  return refreshing
}

function signOutToLogin() {
  clearTokens()
  window.location.href = '/login'
}

// The backend answers a request with an expired access token using 403 (not 401),
// so waiting for a 401 never triggers a refresh. Check the token's own expiry
// instead and refresh *before* sending, which keeps a signed-in user signed in
// for as long as their refresh token lives.
client.interceptors.request.use(async (config) => {
  let { accessToken, refreshToken } = getTokens()
  const isAuthCall = String(config.url || '').includes('/auth/')
  if (accessToken && refreshToken && !isAuthCall && isTokenExpired(accessToken)) {
    try {
      accessToken = await refreshTokens()
    } catch (err) {
      signOutToLogin()
      return Promise.reject(err)
    }
  }
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && original && !original._retry && !original.url.includes('/auth/')) {
      original._retry = true
      const { refreshToken } = getTokens()
      if (!refreshToken) {
        signOutToLogin()
        return Promise.reject(error)
      }
      try {
        const accessToken = await refreshTokens()
        original.headers.Authorization = `Bearer ${accessToken}`
        return client(original)
      } catch (refreshError) {
        signOutToLogin()
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  },
)

export default client
