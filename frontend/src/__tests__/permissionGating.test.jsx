import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import client from '../api/client.js'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import RequestsListPage from '../pages/RequestsListPage.jsx'
import { translations } from '../i18n/translations.js'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: [] })), post: vi.fn(), patch: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

const en = translations.en

describe('ProtectedRoute', () => {
  function renderGuarded() {
    return renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/" element={<div>home page</div>} />
        <Route
          path="/secret"
          element={<ProtectedRoute permissions={['AUDIT_VIEW']}><div>audit page</div></ProtectedRoute>}
        />
      </Routes>,
      { route: '/secret' },
    )
  }

  it('sends a signed-out visitor to the login page', () => {
    renderGuarded()
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('sends a signed-in user who lacks the permission back home', () => {
    signInAs({ roles: ['MANAGER'], permissions: ['REPORTS_VIEW'] })
    renderGuarded()
    expect(screen.getByText('home page')).toBeInTheDocument()
    expect(screen.queryByText('audit page')).not.toBeInTheDocument()
  })

  it('lets a user with the permission in', () => {
    signInAs({ roles: ['ADMIN'], permissions: ['AUDIT_VIEW'] })
    renderGuarded()
    expect(screen.getByText('audit page')).toBeInTheDocument()
  })
})

describe('"New request" button on the requests list', () => {
  async function renderList() {
    renderWithProviders(<RequestsListPage />, { route: '/requests' })
    // wait for the page's first data load so nothing updates after the test ends
    await waitFor(() => expect(client.get).toHaveBeenCalledWith('/requests', expect.anything()))
  }

  it('is hidden from a viewer, who has none of the request-workflow permissions', async () => {
    signInAs({ roles: ['VIEWER'], permissions: ['REPORTS_VIEW'] })
    await renderList()
    expect(screen.queryByRole('link', { name: en.requests.newRequest })).not.toBeInTheDocument()
  })

  it('is shown to an officer', async () => {
    signInAs({ roles: ['OFFICER'], permissions: ['REQUEST_CREATE', 'REQUEST_TRANSITION_SUBMIT'] })
    await renderList()
    expect(screen.getByRole('link', { name: en.requests.newRequest })).toHaveAttribute('href', '/requests/new')
  })

  it('is hidden from a manager: reviewing and deciding do not include creating', async () => {
    signInAs({ roles: ['MANAGER'], permissions: ['REQUEST_ASSIGN', 'REQUEST_TRANSITION_REVIEW', 'REQUEST_TRANSITION_DECIDE', 'REPORTS_VIEW'] })
    await renderList()
    expect(screen.queryByRole('link', { name: en.requests.newRequest })).not.toBeInTheDocument()
  })
})

describe('"Export CSV" button on the requests list', () => {
  async function renderList() {
    renderWithProviders(<RequestsListPage />, { route: '/requests' })
    await waitFor(() => expect(client.get).toHaveBeenCalledWith('/requests', expect.anything()))
  }

  it('is hidden from an officer, because the export endpoint needs REPORTS_VIEW', async () => {
    signInAs({ roles: ['OFFICER'], permissions: ['REQUEST_CREATE', 'REQUEST_TRANSITION_SUBMIT'] })
    await renderList()
    expect(screen.queryByRole('button', { name: en.requests.exportCsv })).not.toBeInTheDocument()
  })

  it('is shown to someone who may view reports', async () => {
    signInAs({ roles: ['MANAGER'], permissions: ['REPORTS_VIEW'] })
    await renderList()
    expect(screen.getByRole('button', { name: en.requests.exportCsv })).toBeInTheDocument()
  })
})
