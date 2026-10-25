import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import { LanguageProvider } from '../context/LanguageContext.jsx'

/**
 * Pretend someone is signed in. AuthProvider restores the user from
 * sessionStorage on mount (it needs both the stored user and an access
 * token), so this is the same path a page reload takes -- no need to mock
 * the auth context itself.
 */
export function signInAs({ username = 'tester', roles = [], permissions = [] } = {}) {
  sessionStorage.setItem('cts_access_token', 'test-access-token')
  sessionStorage.setItem('cts_user', JSON.stringify({ username, fullName: username, roles, permissions }))
}

/** Renders `ui` inside the real router, language and auth providers. */
export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LanguageProvider>
        <AuthProvider>{ui}</AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )
}
