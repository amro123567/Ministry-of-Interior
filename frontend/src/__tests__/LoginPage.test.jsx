import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import client from '../api/client.js'
import LoginPage from '../pages/LoginPage.jsx'
import { translations } from '../i18n/translations.js'
import { renderWithProviders } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

const en = translations.en

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<div>home page</div>} />
    </Routes>,
    { route: '/login' },
  )
}

async function signIn(username, password) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(en.login.username), username)
  await user.type(screen.getByLabelText(en.login.password), password)
  await user.click(screen.getByRole('button', { name: en.login.signIn }))
}

describe('LoginPage', () => {
  it('shows the server message when the credentials are wrong and stays on the page', async () => {
    client.post.mockRejectedValue({ response: { status: 401, data: { message: 'Invalid username or password' } } })
    renderLogin()

    await signIn('officer', 'wrong-password')

    expect(await screen.findByText('Invalid username or password')).toBeInTheDocument()
    expect(screen.queryByText('home page')).not.toBeInTheDocument()
    expect(localStorage.getItem('cts_user')).toBeNull()
    // the button is usable again so the user can retry
    expect(screen.getByRole('button', { name: en.login.signIn })).toBeEnabled()
  })

  it('falls back to the default message when the server sends none (e.g. it is unreachable)', async () => {
    client.post.mockRejectedValue(new Error('Network Error'))
    renderLogin()

    await signIn('officer', 'whatever')

    expect(await screen.findByText(en.login.errorDefault)).toBeInTheDocument()
  })

  it('signs in with the typed credentials, remembers the user and leaves the login page', async () => {
    client.post.mockResolvedValue({
      data: {
        accessToken: 'access', refreshToken: 'refresh', username: 'officer',
        fullName: 'Olivia Officer', roles: ['OFFICER'], permissions: ['REQUEST_TRANSITION_SUBMIT'],
      },
    })
    renderLogin()

    await signIn('officer', 'Officer1234!')

    expect(client.post).toHaveBeenCalledWith('/auth/login', { username: 'officer', password: 'Officer1234!' })
    expect(await screen.findByText('home page')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('cts_user'))).toMatchObject({
      username: 'officer', permissions: ['REQUEST_TRANSITION_SUBMIT'],
    })
  })
})
