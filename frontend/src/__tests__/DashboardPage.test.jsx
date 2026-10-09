import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import client from '../api/client.js'
import DashboardPage from '../pages/DashboardPage.jsx'
import { translations } from '../i18n/translations.js'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

// recharts measures its container; jsdom has no ResizeObserver
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }

const en = translations.en

const SUMMARY = { total: 4, overdueCount: 1, dueSoonCount: 0, closedThisWeek: 0, avgResolutionHours: 2, byStatus: { SUBMITTED: 2 } }
const ROWS = [
  { id: 1, referenceNumber: 'REQ-ON', subject: 'on track', status: 'SUBMITTED', slaStatus: 'ON_TRACK', dueAt: '2026-12-01T00:00:00' },
  { id: 2, referenceNumber: 'REQ-LATE', subject: 'late', status: 'UNDER_REVIEW', slaStatus: 'OVERDUE', dueAt: '2026-01-01T00:00:00' },
  { id: 3, referenceNumber: 'REQ-DONE', subject: 'done', status: 'APPROVED', slaStatus: 'ON_TRACK', dueAt: '2026-01-02T00:00:00' },
]

function renderAs(permissions) {
  signInAs({ roles: [], permissions })
  client.get.mockImplementation((url) =>
    Promise.resolve({ data: url === '/dashboard/summary' ? SUMMARY : ROWS }))
  return renderWithProviders(<DashboardPage />)
}

describe('Dashboard work queue', () => {
  beforeEach(() => client.get.mockReset())

  it('shows reviewers the open requests, most urgent first', async () => {
    renderAs(['REQUEST_TRANSITION_REVIEW'])
    const list = await screen.findByRole('list', { name: en.dashboard.queue.review.title })
    const refs = within(list).getAllByRole('link').map((a) => a.textContent)
    expect(refs).toEqual(['REQ-LATE', 'REQ-ON']) // approved one is not waiting on anyone
  })

  it('shows officers only their own assigned requests', async () => {
    renderAs(['REQUEST_TRANSITION_SUBMIT'])
    await screen.findByRole('list', { name: en.dashboard.queue.mine.title })
    expect(client.get).toHaveBeenCalledWith('/requests', { params: { assignedToMe: true } })
  })

  it('shows read-only users just the requests that need attention', async () => {
    renderAs([])
    const list = await screen.findByRole('list', { name: en.dashboard.queue.watch.title })
    expect(within(list).getAllByRole('link').map((a) => a.textContent)).toEqual(['REQ-LATE'])
  })
})
