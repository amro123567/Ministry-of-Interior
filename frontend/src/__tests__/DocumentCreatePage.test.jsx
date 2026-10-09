import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import client from '../api/client.js'
import DocumentCreatePage from '../pages/DocumentCreatePage.jsx'
import { translations } from '../i18n/translations.js'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

const en = translations.en.documentRegistry
const TYPES = [
  { id: 11, code: 'NATIONAL_ID' }, { id: 12, code: 'DEATH_CERT' }, { id: 13, code: 'DIVORCE_CERT' }, { id: 14, code: 'BIRTH_CERT' },
]

function renderForm(route = '/documents/new') {
  signInAs({ roles: ['REGISTRAR'], permissions: ['CITIZEN_MANAGE'] })
  return renderWithProviders(
    <Routes>
      <Route path="/documents/new" element={<DocumentCreatePage />} />
      <Route path="/documents/:segment/:id" element={<div>document detail</div>} />
      <Route path="/citizens/:id" element={<div>citizen page</div>} />
    </Routes>,
    { route },
  )
}

describe('DocumentCreatePage', () => {
  beforeEach(() => {
    client.get.mockImplementation((url) => Promise.resolve({ data: url === '/document-types' ? TYPES : [] }))
    client.post.mockReset()
  })

  it('shows only the fields of the chosen kind, and starts a kind clean when switching', async () => {
    renderForm()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(en.birthPlace), 'Tyre')

    await user.selectOptions(screen.getByLabelText(en.kind), 'death')
    expect(screen.queryByLabelText(en.birthPlace)).not.toBeInTheDocument()
    expect(screen.getByLabelText(new RegExp(en.deathDate))).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(en.kind), 'birth')
    expect(screen.getByLabelText(en.birthPlace)).toHaveValue('')
  })

  it('will not submit without the subject citizen', async () => {
    renderForm('/documents/new?kind=death')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(new RegExp(en.deathDate)), '2026-01-02')
    await user.click(screen.getByRole('button', { name: en.submit }))
    // the date input is filled but no citizen was picked
    expect(await screen.findByRole('alert')).toHaveTextContent(en.errorRequired)
    expect(client.post).not.toHaveBeenCalled()
  })

  it('posts a national ID card for the preset citizen and returns to their page', async () => {
    client.post.mockResolvedValue({ data: { document: { id: 9 } } })
    renderForm('/documents/new?kind=nationalId&citizenId=4&citizenLabel=Layla')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(new RegExp(en.cardNumber)), ' 1234 ')
    await user.click(screen.getByRole('button', { name: en.submit }))

    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(1))
    const [path, payload] = client.post.mock.calls[0]
    expect(path).toBe('/documents/national-id-cards')
    expect(payload).toMatchObject({ citizenId: 4, documentTypeId: 11, cardNumber: '1234', documentNumber: null, issuingOfficeId: null })
    expect(await screen.findByText('citizen page')).toBeInTheDocument() // national IDs have no detail route
  })

  it('opens the detail page of a new divorce certificate', async () => {
    client.post.mockResolvedValue({ data: { document: { id: 21 } } })
    renderForm('/documents/new?kind=divorce')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(new RegExp(en.marriageCertificateId)), '7')
    await user.click(screen.getByRole('button', { name: en.submit }))

    await waitFor(() => expect(client.post).toHaveBeenCalled())
    expect(client.post.mock.calls[0][0]).toBe('/documents/divorce-certificates')
    expect(client.post.mock.calls[0][1]).toMatchObject({ marriageCertificateId: 7, divorceType: 'JUDICIAL', documentTypeId: 13 })
    expect(await screen.findByText('document detail')).toBeInTheDocument()
  })
})
