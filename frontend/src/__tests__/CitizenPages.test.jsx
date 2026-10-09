import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import client from '../api/client.js'
import CitizenRegistryPage from '../pages/CitizenRegistryPage.jsx'
import CitizenCreatePage from '../pages/CitizenCreatePage.jsx'
import CitizenDetailPage from '../pages/CitizenDetailPage.jsx'
import { translations } from '../i18n/translations.js'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

const en = translations.en

const CITIZENS = [
  { id: 1, registryNumber: 'REG-1', firstNameEn: 'Layla', lastNameEn: 'Mansour', officeName: 'Beirut office', maritalStatus: 'MARRIED', deceased: false },
  { id: 2, registryNumber: 'REG-2', firstNameEn: 'Omar', lastNameEn: 'Haddad', officeName: 'Tripoli office', maritalStatus: 'SINGLE', deceased: false },
  { id: 3, registryNumber: 'REG-3', firstNameEn: 'Samir', lastNameEn: 'Nasr', officeName: 'Beirut office', maritalStatus: 'WIDOWED', deceased: true },
]

const table = () => within(screen.getByRole('table'))

describe('CitizenRegistryPage', () => {
  beforeEach(() => {
    client.get.mockReset()
    client.get.mockImplementation(() => Promise.resolve({ data: CITIZENS }))
    signInAs({ roles: ['OFFICER'], permissions: ['CITIZEN_MANAGE'] })
  })

  function renderRegistry(route = '/citizens') {
    return renderWithProviders(<Routes><Route path="/citizens" element={<CitizenRegistryPage />} /></Routes>, { route })
  }

  it('narrows the list by office, and by deceased status', async () => {
    renderRegistry()
    await waitFor(() => expect(table().getByText('REG-1')).toBeInTheDocument())
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText(en.citizens.colOffice), 'Beirut office')
    expect(table().getByText('REG-1')).toBeInTheDocument()
    expect(table().queryByText('REG-2')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(en.citizens.lifeStatus), 'deceased')
    expect(table().getByText('REG-3')).toBeInTheDocument()
    expect(table().queryByText('REG-1')).not.toBeInTheDocument()
  })

  it('opens pre-filtered from the URL', async () => {
    renderRegistry('/citizens?marital=SINGLE')
    await waitFor(() => expect(table().getByText('REG-2')).toBeInTheDocument())
    expect(table().queryByText('REG-1')).not.toBeInTheDocument()
  })
})

describe('CitizenCreatePage', () => {
  beforeEach(() => {
    client.get.mockReset(); client.post.mockReset()
    client.get.mockImplementation(() => Promise.resolve({ data: [] }))
    signInAs({ roles: ['OFFICER'], permissions: ['CITIZEN_MANAGE'] })
  })

  it('shows what is missing next to the fields and posts nothing', async () => {
    renderWithProviders(<Routes><Route path="/citizens/new" element={<CitizenCreatePage />} /></Routes>, { route: '/citizens/new' })

    await userEvent.setup().click(screen.getByRole('button', { name: en.citizenCreate.submit }))

    expect(await screen.findByText(en.citizenCreate.errRegistry)).toBeInTheDocument()
    expect(screen.getByText(en.citizenCreate.errFirstName)).toBeInTheDocument()
    expect(client.post).not.toHaveBeenCalled()
  })
})

describe('CitizenDetailPage', () => {
  const citizen = { id: 1, registryNumber: 'REG-1', firstNameEn: 'Layla', lastNameEn: 'Mansour', officeName: 'Beirut office', maritalStatus: 'MARRIED' }

  function renderDetail(permissions) {
    client.get.mockReset()
    client.get.mockImplementation((url) => Promise.resolve({ data: url === '/citizens/1' ? citizen : [] }))
    signInAs({ roles: ['OFFICER'], permissions })
    return renderWithProviders(<Routes><Route path="/citizens/:id" element={<CitizenDetailPage />} /></Routes>, { route: '/citizens/1' })
  }

  it('splits the profile into tabs and hides the audit tab without AUDIT_VIEW', async () => {
    renderDetail(['CITIZEN_MANAGE'])
    await screen.findByRole('tab', { name: en.citizenDetail.tabOverview })

    expect(screen.getByRole('tab', { name: en.citizenDetail.tabDocuments })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: en.citizenDetail.tabFamily })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: en.citizenDetail.tabAudit })).not.toBeInTheDocument()
  })

  it('shows the audit tab to a user who holds AUDIT_VIEW', async () => {
    renderDetail(['AUDIT_VIEW'])
    expect(await screen.findByRole('tab', { name: en.citizenDetail.tabAudit })).toBeInTheDocument()
  })
})
