import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import client from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  setTokens: (a, r) => { if (a) sessionStorage.setItem('cts_access_token', a); if (r) sessionStorage.setItem('cts_refresh_token', r) },
  clearTokens: () => {
    sessionStorage.removeItem('cts_access_token'); sessionStorage.removeItem('cts_refresh_token'); sessionStorage.removeItem('cts_user')
  },
}))

function Probe() {
  const { user, login, logout, hasPermission, hasRole } = useAuth()
  return (
    <div>
      <p data-testid="who">{user ? user.username : 'nobody'}</p>
      <p data-testid="can">{String(hasPermission('AUDIT_VIEW'))}/{String(hasPermission('NOPE', 'USER_MANAGE'))}/{String(hasRole('ADMIN'))}</p>
      <button onClick={() => login('admin', 'pw')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => { client.post.mockReset() })

  it('starts signed out and has no permissions', () => {
    renderWithProviders(<Probe />)
    expect(screen.getByTestId('who')).toHaveTextContent('nobody')
    expect(screen.getByTestId('can')).toHaveTextContent('false/false/false')
  })

  it('signs in, keeps the issued permissions and roles, and stores the tokens for this tab', async () => {
    client.post.mockResolvedValue({ data: { accessToken: 'A', refreshToken: 'R', username: 'admin', fullName: 'Ada Min', roles: ['ADMIN'], permissions: ['AUDIT_VIEW', 'USER_MANAGE'] } })
    renderWithProviders(<Probe />)
    await userEvent.setup().click(screen.getByText('login'))
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('admin'))
    expect(screen.getByTestId('can')).toHaveTextContent('true/true/true') // any one of several permissions is enough
    expect(sessionStorage.getItem('cts_access_token')).toBe('A')
    expect(sessionStorage.getItem('cts_refresh_token')).toBe('R')
  })

  it('treats a login response without a permission list as having none', async () => {
    client.post.mockResolvedValue({ data: { accessToken: 'A', refreshToken: 'R', username: 'old', roles: ['VIEWER'] } })
    renderWithProviders(<Probe />)
    await userEvent.setup().click(screen.getByText('login'))
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('old'))
    expect(screen.getByTestId('can')).toHaveTextContent('false/false/false')
  })

  it('signs out at once, then tells the server which session to revoke, with the token it is revoking', async () => {
    signInAs({ roles: ['ADMIN'], permissions: ['AUDIT_VIEW'] })
    sessionStorage.setItem('cts_refresh_token', 'REFRESH-1')
    client.post.mockResolvedValue({ data: {} })
    renderWithProviders(<Probe />)
    expect(screen.getByTestId('who')).toHaveTextContent('tester')

    await userEvent.setup().click(screen.getByText('logout'))

    expect(screen.getByTestId('who')).toHaveTextContent('nobody')
    expect(sessionStorage.getItem('cts_access_token')).toBeNull()
    expect(sessionStorage.getItem('cts_refresh_token')).toBeNull()
    // the tokens were cleared before the call, so the header has to be passed explicitly
    expect(client.post).toHaveBeenCalledWith(
      '/auth/logout',
      { refreshToken: 'REFRESH-1' },
      { headers: { Authorization: 'Bearer test-access-token' } },
    )
  })

  it('still signs out when the server cannot be reached', async () => {
    signInAs({ permissions: [] })
    sessionStorage.setItem('cts_refresh_token', 'R2')
    client.post.mockRejectedValue(new Error('network down'))
    renderWithProviders(<Probe />)
    await userEvent.setup().click(screen.getByText('logout'))
    expect(screen.getByTestId('who')).toHaveTextContent('nobody')
  })

  it('does not call the server when there is no refresh token to revoke', async () => {
    signInAs({ permissions: [] })
    renderWithProviders(<Probe />)
    await userEvent.setup().click(screen.getByText('logout'))
    expect(client.post).not.toHaveBeenCalled()
  })

  it('does not restore a stored user that has no access token (a stale or half-cleared session)', () => {
    sessionStorage.setItem('cts_user', JSON.stringify({ username: 'ghost', roles: [], permissions: [] }))
    renderWithProviders(<Probe />)
    expect(screen.getByTestId('who')).toHaveTextContent('nobody')
  })
})
