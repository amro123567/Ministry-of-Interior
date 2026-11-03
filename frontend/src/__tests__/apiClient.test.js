import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import client, { isTokenExpired } from '../api/client.js'

// Builds an unsigned JWT-shaped string whose `exp` is `secondsFromNow` away.
const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (secondsFromNow) => `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + secondsFromNow })}.sig`

const realAdapter = client.defaults.adapter
const okAdapter = async (config) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config })

describe('isTokenExpired', () => {
  it('knows an expired token, a fresh one, and one about to expire', () => {
    expect(isTokenExpired(jwt(-60))).toBe(true)
    expect(isTokenExpired(jwt(1800))).toBe(false)
    expect(isTokenExpired(jwt(5))).toBe(true) // inside the 15s safety margin
  })

  it('leaves anything it cannot read to the server', () => {
    expect(isTokenExpired('not-a-jwt')).toBe(false)
    expect(isTokenExpired('')).toBe(false)
  })
})

describe('API client token refresh', () => {
  beforeEach(() => {
    sessionStorage.clear()
    client.defaults.adapter = okAdapter
  })
  afterEach(() => {
    client.defaults.adapter = realAdapter
    vi.restoreAllMocks()
  })

  it('refreshes an expired access token before the request is sent', async () => {
    const fresh = jwt(1800)
    sessionStorage.setItem('cts_access_token', jwt(-60))
    sessionStorage.setItem('cts_refresh_token', 'r1')
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { accessToken: fresh, refreshToken: 'r2' } })

    const res = await client.get('/dashboard/summary')

    expect(post).toHaveBeenCalledWith('/api/auth/refresh', { refreshToken: 'r1' })
    expect(res.config.headers.get('Authorization')).toBe(`Bearer ${fresh}`)
    expect(sessionStorage.getItem('cts_refresh_token')).toBe('r2')
  })

  it('does not refresh while the access token is still valid', async () => {
    const live = jwt(1800)
    sessionStorage.setItem('cts_access_token', live)
    sessionStorage.setItem('cts_refresh_token', 'r1')
    const post = vi.spyOn(axios, 'post')

    const res = await client.get('/requests')

    expect(post).not.toHaveBeenCalled()
    expect(res.config.headers.get('Authorization')).toBe(`Bearer ${live}`)
  })

  it('spends the refresh token once when several requests go out together', async () => {
    sessionStorage.setItem('cts_access_token', jwt(-60))
    sessionStorage.setItem('cts_refresh_token', 'r1')
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { accessToken: jwt(1800), refreshToken: 'r2' } })

    await Promise.all([client.get('/dashboard/summary'), client.get('/requests'), client.get('/requests?assignedToMe=true')])

    expect(post).toHaveBeenCalledTimes(1)
  })
})
