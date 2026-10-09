import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import client from '../api/client.js'
import RequestCreatePage from '../pages/RequestCreatePage.jsx'
import { translations } from '../i18n/translations.js'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

const en = translations.en

const REFERENCE = {
  '/document-types': [{ id: 2, nameEn: 'Birth certificate', slaDays: 3 }],
  '/offices': [{ id: 7, nameEn: 'Beirut office', districtId: null }],
  '/citizens': [{ id: 1, firstNameEn: 'Layla', lastNameEn: 'Mansour', registryNumber: 'REG-100589' }],
}

function renderForm() {
  signInAs({ roles: ['OFFICER'], permissions: ['REQUEST_TRANSITION_SUBMIT'] })
  return renderWithProviders(
    <Routes>
      <Route path="/requests/new" element={<RequestCreatePage />} />
      <Route path="/requests/:id" element={<div>request detail page</div>} />
    </Routes>,
    { route: '/requests/new' },
  )
}

const submitButton = () => screen.getByRole('button', { name: en.requestCreate.submit })

describe('RequestCreatePage', () => {
  beforeEach(() => {
    client.get.mockImplementation((url) => Promise.resolve({ data: REFERENCE[url] ?? [] }))
  })

  it('marks citizen and document type as required so the browser blocks an incomplete form', async () => {
    renderForm()
    await screen.findByRole('option', { name: /Layla/ })

    expect(screen.getByDisplayValue(en.requestCreate.selectCitizen)).toBeRequired()
    expect(screen.getByLabelText(new RegExp(en.requestCreate.documentType))).toBeRequired()

    // a real click on "Create request" with nothing chosen must not reach the API
    await userEvent.setup().click(submitButton())
    expect(client.post).not.toHaveBeenCalled()
  })

  it('still refuses to post when the form is submitted without a citizen or document type', async () => {
    const { container } = renderForm()
    await screen.findByRole('option', { name: /Layla/ })

    // bypasses the browser's own validation to exercise the page's own guard
    fireEvent.submit(container.querySelector('form'))

    expect(await screen.findByRole('alert')).toHaveTextContent(en.requestCreate.errorSelect)
    expect(client.post).not.toHaveBeenCalled()
  })

  it('creates the request with numeric ids and opens it', async () => {
    client.post.mockResolvedValue({ data: { id: 55 } })
    renderForm()
    const user = userEvent.setup()
    await screen.findByRole('option', { name: /Layla/ })

    await user.selectOptions(screen.getByDisplayValue(en.requestCreate.selectCitizen), '1')
    await user.selectOptions(screen.getByLabelText(new RegExp(en.requestCreate.documentType)), '2')
    await user.selectOptions(screen.getByLabelText(en.requestCreate.direction), 'OUTGOING')
    await user.type(screen.getByLabelText(en.requestCreate.subject), '  Reply to the Governorate  ')
    await user.click(submitButton())

    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(1))
    expect(client.post).toHaveBeenCalledWith('/requests', {
      citizenId: 1,
      documentTypeId: 2,
      officeId: 7,
      priority: 'NORMAL',
      notes: null,
      direction: 'OUTGOING',
      subject: 'Reply to the Governorate', // trimmed
      departmentId: null,
    })
    expect(await screen.findByText('request detail page')).toBeInTheDocument()
  })

  it('tells a user without permission so, instead of a generic failure', async () => {
    client.post.mockRejectedValue({ response: { status: 403 } })
    renderForm()
    const user = userEvent.setup()
    await screen.findByRole('option', { name: /Layla/ })

    await user.selectOptions(screen.getByDisplayValue(en.requestCreate.selectCitizen), '1')
    await user.selectOptions(screen.getByLabelText(new RegExp(en.requestCreate.documentType)), '2')
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(en.common.noPermission)
  })
})
