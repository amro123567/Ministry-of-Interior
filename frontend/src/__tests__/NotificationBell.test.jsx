import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import NotificationBell from '../components/NotificationBell.jsx'
import { translations } from '../i18n/translations.js'
import client from '../api/client.js'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

const en = translations.en
const row = (id, over = {}) => ({
  id, referenceNumber: `CTS-2026-00000${id}`, subject: `Subject ${id}`,
  status: 'UNDER_REVIEW', slaStatus: 'ON_TRACK', dueAt: '2026-12-01T00:00:00Z', ...over,
})
const shell = () => renderWithProviders(<Routes><Route path="*" element={<NotificationBell />} /></Routes>)

// Answer /requests with the given rows and every /requests/{id}/assignments with `assignments`.
const serve = (rows, assignments = []) =>
  client.get.mockImplementation((url) =>
    Promise.resolve({ data: url === '/requests' ? rows : assignments }))
const requestCalls = () => client.get.mock.calls.filter(([url]) => url === '/requests').length
const openBell = (user) => user.click(screen.getByRole('button', { name: new RegExp(en.notifications.title) }))

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signInAs({ username: 'Officer', roles: ['OFFICER'], permissions: [] })
  })

  it('asks only for requests assigned to the user and counts the open ones', async () => {
    serve([row(1), row(2), row(3, { status: 'ARCHIVED' }), row(4, { status: 'APPROVED' })])
    shell()
    await waitFor(() => expect(screen.getByTestId('notification-badge')).toHaveTextContent('2'))
    expect(client.get).toHaveBeenCalledWith('/requests', { params: { assignedToMe: true } })
  })

  it('shows no badge when nothing is assigned', async () => {
    serve([])
    shell()
    await waitFor(() => expect(client.get).toHaveBeenCalled())
    expect(screen.queryByTestId('notification-badge')).toBeNull()
    expect(screen.getByRole('button', { name: en.notifications.none })).toBeInTheDocument()
  })

  it('turns the badge red when something is overdue', async () => {
    serve([row(1), row(2, { slaStatus: 'OVERDUE' })])
    shell()
    const badge = await screen.findByTestId('notification-badge')
    expect(badge.className).toContain('bg-red-500')
  })

  it('lists overdue requests first and links to the full filtered list', async () => {
    const user = userEvent.setup()
    serve([row(1), row(2, { slaStatus: 'OVERDUE' })])
    shell()
    await screen.findByTestId('notification-badge')
    await openBell(user)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/requests/2')
    expect(links[1]).toHaveAttribute('href', '/requests/1')
    expect(screen.getByRole('link', { name: new RegExp(en.notifications.viewAll) })).toHaveAttribute('href', '/requests?mine=1')
  })

  it('says how long a request has been overdue', async () => {
    const user = userEvent.setup()
    serve([row(1, { slaStatus: 'OVERDUE', dueAt: '2020-01-01T00:00:00Z' })])
    shell()
    await screen.findByTestId('notification-badge')
    await openBell(user)
    expect(await screen.findByText(new RegExp(`${en.notifications.overdueBy} \\d+d`))).toBeInTheDocument()
  })

  it('shows who assigned each request, using the newest assignment', async () => {
    const user = userEvent.setup()
    serve([row(1)], [
      { assignedByName: 'Old Manager', assignedAt: '2026-10-01T10:00:00Z' },
      { assignedByName: 'Maya Khoury', assignedAt: '2026-10-30T10:00:00Z' },
    ])
    shell()
    await screen.findByTestId('notification-badge')
    await openBell(user)
    expect(await screen.findByText('Maya Khoury')).toBeInTheDocument()
    expect(screen.queryByText('Old Manager')).toBeNull()
    expect(client.get).toHaveBeenCalledWith('/requests/1/assignments')
  })

  it('still lists the request when the assigner cannot be loaded', async () => {
    const user = userEvent.setup()
    client.get.mockImplementation((url) =>
      (url === '/requests' ? Promise.resolve({ data: [row(1)] }) : Promise.reject(new Error('nope'))))
    shell()
    await screen.findByTestId('notification-badge')
    await openBell(user)
    expect(await screen.findByText('CTS-2026-000001')).toBeInTheDocument()
    expect(screen.queryByText(en.notifications.assignedBy, { exact: false })).toBeNull()
  })

  it('filters the card by SLA group and points "view all" at the matching list', async () => {
    const user = userEvent.setup()
    serve([row(1), row(2, { slaStatus: 'OVERDUE' }), row(3, { slaStatus: 'DUE_SOON' })])
    shell()
    await screen.findByTestId('notification-badge')
    await openBell(user)
    await user.click(screen.getByRole('button', { name: new RegExp(en.notifications.statOverdue) }))
    const links = screen.getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/requests/2', '/requests?mine=1&sla=OVERDUE'])
  })

  it('shows an empty state when the dropdown is opened with nothing to do', async () => {
    const user = userEvent.setup()
    serve([])
    shell()
    await waitFor(() => expect(client.get).toHaveBeenCalled())
    await user.click(screen.getByRole('button'))
    expect(await screen.findByText(en.notifications.empty)).toBeInTheDocument()
  })

  it('keeps the last count if a refresh fails', async () => {
    const user = userEvent.setup()
    client.get.mockResolvedValueOnce({ data: [row(1)] })
    shell()
    await screen.findByTestId('notification-badge')
    client.get.mockRejectedValue(new Error('network'))
    await openBell(user) // opening triggers a refresh
    await waitFor(() => expect(requestCalls()).toBe(2))
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('1')
  })
})
