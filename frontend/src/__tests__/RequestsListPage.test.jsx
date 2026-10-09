import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import client from '../api/client.js'
import RequestsListPage from '../pages/RequestsListPage.jsx'
import { translations } from '../i18n/translations.js'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

const en = translations.en

const rows = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  referenceNumber: `CTS-2026-${String(i + 1).padStart(6, '0')}`,
  direction: 'INCOMING',
  citizenName: `Citizen ${String.fromCharCode(76 - i)}`, // L, K, J ... A (reverse alphabetical)
  documentTypeName: 'Birth certificate',
  status: 'SUBMITTED',
  slaStatus: 'ON_TRACK',
  assignedToName: null,
  dueAt: null,
}))

function renderList(route = '/requests') {
  signInAs({ roles: ['OFFICER'], permissions: ['REQUEST_TRANSITION_SUBMIT'] })
  return renderWithProviders(
    <Routes><Route path="/requests" element={<RequestsListPage />} /></Routes>,
    { route },
  )
}

// The page renders both a table (desktop) and cards (mobile); these tests look at the table.
const table = () => within(screen.getByRole('table'))
const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')
const waitForTable = () => waitFor(() => expect(table().getByText('CTS-2026-000001')).toBeInTheDocument())

describe('RequestsListPage', () => {
  beforeEach(() => {
    client.get.mockReset()
    client.get.mockImplementation((url) => Promise.resolve({ data: url === '/requests' ? rows : [] }))
  })

  it('opens pre-filtered when the URL carries filters (dashboard cards, bookmarks)', async () => {
    renderList('/requests?sla=OVERDUE&status=SUBMITTED')

    await waitFor(() => expect(client.get).toHaveBeenCalledWith('/requests', expect.anything()))
    const params = client.get.mock.calls.find(([u]) => u === '/requests')[1].params
    expect(params.sla).toBe('OVERDUE')
    expect(params.status).toBe('SUBMITTED')
    expect(screen.getByLabelText(en.requests.filterSla)).toHaveValue('OVERDUE')
  })

  it('shows the first page only and moves between pages', async () => {
    renderList()
    await waitForTable()

    expect(bodyRows()).toHaveLength(10)
    expect(table().queryByText('CTS-2026-000011')).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: en.requests.next }))

    await waitFor(() => expect(table().getByText('CTS-2026-000011')).toBeInTheDocument())
    expect(bodyRows()).toHaveLength(2)
  })

  it('sorts by a column header, ascending then descending', async () => {
    renderList()
    await waitForTable()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: new RegExp(en.requests.colCitizen, 'i') }))
    expect(within(bodyRows()[0]).getByText('Citizen A')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: new RegExp(en.requests.colCitizen, 'i') }))
    expect(within(bodyRows()[0]).getByText('Citizen L')).toBeInTheDocument()
  })
})
