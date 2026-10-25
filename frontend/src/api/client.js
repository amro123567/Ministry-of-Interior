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

client.interceptors.request.use((config) => {
  const { accessToken } = getTokens()
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let refreshing = null

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && original && !original._retry && !original.url.includes('/auth/')) {
      original._retry = true
      const { refreshToken } = getTokens()
      if (!refreshToken) {
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(error)
      }
      try {
        refreshing = refreshing || axios.post('/api/auth/refresh', { refreshToken })
        const res = await refreshing
        refreshing = null
        setTokens(res.data.accessToken, res.data.refreshToken)
        original.headers.Authorization = `Bearer ${res.data.accessToken}`
        return client(original)
      } catch (refreshError) {
        refreshing = null
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  },
)

export default client
