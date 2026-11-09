import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const SUMMARY = { total: 4, overdueCount: 1, dueSoonCount: 0, closedThisWeek: 0, avgResolutionHours: 2, byStatus: { SUBMITTED: 2, UNDER_REVIEW: 1, APPROVED: 3, REJECTED: 1 } }
const ROWS = [
  { id: 1, referenceNumber: 'REQ-ON', subject: 'on track', citizenName: 'Rami Haddad', documentTypeName: 'Letter', priority: 'HIGH', status: 'SUBMITTED', slaStatus: 'ON_TRACK', dueAt: '2026-12-01T00:00:00' },
  { id: 2, referenceNumber: 'REQ-LATE', subject: 'late', citizenName: 'Layla Nasr', documentTypeName: 'Permit', priority: 'URGENT', status: 'UNDER_REVIEW', slaStatus: 'OVERDUE', dueAt: '2026-01-01T00:00:00' },
  { id: 3, referenceNumber: 'REQ-DONE', subject: 'done', citizenName: 'Omar Saad', documentTypeName: 'Letter', priority: 'NORMAL', status: 'APPROVED', slaStatus: 'ON_TRACK', dueAt: '2026-01-02T00:00:00' },
]

function renderAs(permissions) {
  signInAs({ roles: [], permissions })
  client.get.mockImplementation((url) =>
    Promise.resolve({ data: url === '/dashboard/summary' ? SUMMARY : ROWS }))
  return renderWithProviders(<DashboardPage />)
}

// The work-queue region (a <section> labelled by its title) and the request references inside it.
const queueRegion = (title) => screen.findByRole('region', { name: new RegExp(title) })
const refsIn = (region) => within(region).getAllByRole('link').map((a) => a.textContent).filter((x) => x.startsWith('REQ-'))

describe('Dashboard work queue', () => {
  beforeEach(() => { client.get.mockReset(); client.patch.mockReset() })

  it.each([
    ['reviewers', ['REQUEST_TRANSITION_REVIEW']],
    ['approvers', ['REQUEST_TRANSITION_DECIDE']],
    ['archivers', ['REQUEST_TRANSITION_ARCHIVE']],
    ['officers', ['REQUEST_TRANSITION_SUBMIT']],
  ])('shows %s only the requests assigned to them', async (_who, permissions) => {
    renderAs(permissions)
    await queueRegion(en.dashboard.queue.mine.title)
    expect(client.get).toHaveBeenCalledWith('/requests', { params: { assignedToMe: true } })
  })

  it('shows read-only users just the requests that need attention', async () => {
    renderAs([])
    const region = await queueRegion(en.dashboard.queue.watch.title)
    expect(refsIn(region)).toEqual(['REQ-LATE'])
  })

  it('filters the queue with the inline search box and filter pills', async () => {
    const user = userEvent.setup()
    renderAs(['REQUEST_TRANSITION_REVIEW'])
    const region = await queueRegion(en.dashboard.queue.mine.title)
    await user.type(within(region).getByRole('searchbox'), 'layla')
    expect(refsIn(region)).toEqual(['REQ-LATE'])
    await user.clear(within(region).getByRole('searchbox'))
    await user.click(within(region).getByRole('button', { name: en.requests.priority.HIGH }))
    expect(refsIn(region)).toEqual(['REQ-ON'])
  })

  it('has no row selection or batch actions, even for people who may approve', async () => {
    renderAs(['REQUEST_TRANSITION_DECIDE'])
    const region = await queueRegion(en.dashboard.queue.mine.title)
    expect(within(region).queryAllByRole('checkbox')).toHaveLength(0)
    expect(within(region).queryByRole('button', { name: /Batch approve/ })).toBeNull()
  })
})

describe('Dashboard KPI cards', () => {
  beforeEach(() => client.get.mockReset())

  it('derives the figures from the summary without inventing trends', async () => {
    renderAs(['REQUEST_TRANSITION_REVIEW'])
    const active = await screen.findByTestId('kpi-active')
    expect(within(active).getByText('3')).toBeInTheDocument() // submitted + under review (+ drafts: 0)
    expect(within(screen.getByTestId('kpi-overdue')).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-approval')).getByText('75')).toBeInTheDocument() // 3 approved / (3 + 1 rejected)
  })
})
