import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import client from '../api/client.js'
import AdminUsersPage from '../pages/AdminUsersPage.jsx'
import AuditLogPage from '../pages/AuditLogPage.jsx'
import { translations } from '../i18n/translations.js'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

const en = translations.en

const USERS = [
  { id: 1, username: 'admin', fullName: 'Admin User', email: null, enabled: true, roles: ['ADMIN'], officeName: null },
  { id: 2, username: 'officer', fullName: 'Olive Officer', email: null, enabled: true, roles: ['OFFICER'], officeName: null },
  { id: 3, username: 'viewer', fullName: 'Vic Viewer', email: null, enabled: false, roles: ['VIEWER'], officeName: null },
]

describe('AdminUsersPage', () => {
  beforeEach(() => {
    client.get.mockReset(); client.patch.mockReset()
    client.get.mockImplementation((url) => Promise.resolve({ data: url === '/users' ? USERS : [] }))
    signInAs({ username: 'admin', roles: ['ADMIN'], permissions: ['USER_VIEW', 'USER_MANAGE'] })
  })

  const renderUsers = () =>
    renderWithProviders(<Routes><Route path="/admin/users" element={<AdminUsersPage />} /></Routes>, { route: '/admin/users' })

  it('asks for confirmation before deactivating, then patches the account', async () => {
    client.patch.mockResolvedValue({ data: {} })
    renderUsers()
    const user = userEvent.setup()
    await screen.findByText('Olive Officer')

    const buttons = screen.getAllByRole('button', { name: en.adminUsers.deactivate })
    await user.click(buttons[0])
    expect(client.patch).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: en.adminUsers.confirm }))
    await waitFor(() => expect(client.patch).toHaveBeenCalledWith('/users/2/enabled', { enabled: false }))
  })

  it('reactivates an inactive account in one click, and offers no control on your own row', async () => {
    client.patch.mockResolvedValue({ data: {} })
    renderUsers()
    const user = userEvent.setup()
    await screen.findByText('Vic Viewer')

    expect(screen.getByText(en.adminUsers.you)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en.adminUsers.activate }))
    await waitFor(() => expect(client.patch).toHaveBeenCalledWith('/users/3/enabled', { enabled: true }))
  })

  it('shows the server message when the change is refused', async () => {
    client.patch.mockRejectedValue({ response: { data: { message: 'At least one active administrator is required.' } } })
    renderUsers()
    const user = userEvent.setup()
    await screen.findByText('Olive Officer')

    await user.click(screen.getAllByRole('button', { name: en.adminUsers.deactivate })[0])
    await user.click(screen.getByRole('button', { name: en.adminUsers.confirm }))

    expect(await screen.findByRole('alert')).toHaveTextContent('At least one active administrator is required.')
  })
})

describe('AuditLogPage', () => {
  beforeEach(() => {
    client.get.mockReset()
    client.get.mockImplementation((url) => Promise.resolve({
      data: url === '/audit/facets' ? { actions: ['LOGIN', 'USER_DISABLED'], entityTypes: ['AppUser'] } : [],
    }))
    signInAs({ roles: ['ADMIN'], permissions: ['AUDIT_VIEW'] })
  })

  it('sends the chosen filters to the server and offers every action the log contains', async () => {
    renderWithProviders(<Routes><Route path="/admin/audit" element={<AuditLogPage />} /></Routes>, { route: '/admin/audit' })
    const user = userEvent.setup()

    await screen.findByRole('option', { name: 'USER_DISABLED' })
    await user.selectOptions(screen.getByDisplayValue(en.auditLog.allActions), 'USER_DISABLED')

    await waitFor(() => {
      const last = client.get.mock.calls.filter(([u]) => u === '/audit').pop()
      expect(last[1].params.action).toBe('USER_DISABLED')
    })
    expect(screen.getByRole('button', { name: en.requests.exportCsv })).toBeInTheDocument()
  })

  it('shows each active filter as a chip, and removing it clears just that filter', async () => {
    renderWithProviders(<Routes><Route path="/admin/audit" element={<AuditLogPage />} /></Routes>, { route: '/admin/audit' })
    const user = userEvent.setup()
    await screen.findByRole('option', { name: 'USER_DISABLED' })
    await user.selectOptions(screen.getByDisplayValue(en.auditLog.allActions), 'USER_DISABLED')

    const chips = within(await screen.findByRole('group', { name: en.requests.activeFilters }))
    expect(chips.getByText('USER_DISABLED')).toBeInTheDocument()
    await user.click(chips.getByRole('button', { name: new RegExp(`${en.requests.removeFilter}: USER_DISABLED`) }))

    await waitFor(() => {
      const last = client.get.mock.calls.filter(([u]) => u === '/audit').pop()
      expect(last[1].params.action).toBeUndefined()
    })
    expect(screen.queryByRole('group', { name: en.requests.activeFilters })).toBeNull()
  })
})
