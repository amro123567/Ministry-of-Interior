import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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

const nextButton = () => screen.getByRole('button', { name: en.requestCreate.next })
const submitButton = () => screen.getByRole('button', { name: en.requestCreate.submit })

// Walks the wizard: step 1 (citizen + direction), step 2 (type + subject), then lands on step 3.
async function fillToLastStep(user, { direction, subject } = {}) {
  await screen.findByRole('option', { name: /Layla/ })
  await user.selectOptions(screen.getByDisplayValue(en.requestCreate.selectCitizen), '1')
  if (direction) await user.selectOptions(screen.getByLabelText(en.requestCreate.direction), direction)
  await user.click(nextButton())
  await user.selectOptions(screen.getByLabelText(new RegExp(en.requestCreate.documentType)), '2')
  if (subject) await user.type(screen.getByLabelText(en.requestCreate.subject), subject)
  await user.click(nextButton())
  await screen.findByText(en.requestCreate.reviewTitle)
}

describe('RequestCreatePage', () => {
  beforeEach(() => {
    client.get.mockImplementation((url) => Promise.resolve({ data: REFERENCE[url] ?? [] }))
    client.post.mockReset()
  })

  it('will not leave step 1 without a citizen and says why next to the field', async () => {
    renderForm()
    await screen.findByRole('option', { name: /Layla/ })
    expect(screen.getByDisplayValue(en.requestCreate.selectCitizen)).toBeRequired()

    await userEvent.setup().click(nextButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(en.requestCreate.errCitizen)
    // still on step 1: the citizen picker is still there, the review step is not
    expect(screen.getByDisplayValue(en.requestCreate.selectCitizen)).toBeInTheDocument()
    expect(screen.queryByText(en.requestCreate.reviewTitle)).not.toBeInTheDocument()
    expect(client.post).not.toHaveBeenCalled()
  })

  it('will not leave step 2 without a document type', async () => {
    renderForm()
    const user = userEvent.setup()
    await screen.findByRole('option', { name: /Layla/ })
    await user.selectOptions(screen.getByDisplayValue(en.requestCreate.selectCitizen), '1')
    await user.click(nextButton())

    expect(screen.getByLabelText(new RegExp(en.requestCreate.documentType))).toBeRequired()
    await user.click(nextButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(en.requestCreate.errDocType)
    expect(screen.queryByText(en.requestCreate.reviewTitle)).not.toBeInTheDocument()
  })

  it('keeps earlier answers when going back', async () => {
    renderForm()
    const user = userEvent.setup()
    await fillToLastStep(user, { direction: 'OUTGOING' })

    await user.click(screen.getByRole('button', { name: en.requestCreate.back }))
    await user.click(screen.getByRole('button', { name: en.requestCreate.back }))

    expect(screen.getByLabelText(en.requestCreate.direction)).toHaveValue('OUTGOING')
    expect(screen.getByDisplayValue(/Layla/)).toBeInTheDocument()
  })

  it('creates the request with numeric ids and opens it', async () => {
    client.post.mockResolvedValue({ data: { id: 55 } })
    renderForm()
    const user = userEvent.setup()
    await fillToLastStep(user, { direction: 'OUTGOING', subject: '  Reply to the Governorate  ' })
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

  it('uploads the chosen files to the new request, then opens it', async () => {
    client.post.mockResolvedValue({ data: { id: 55 } })
    renderForm()
    const user = userEvent.setup()
    await fillToLastStep(user)
    await user.upload(
      screen.getByLabelText(en.requestCreate.addFiles),
      new File(['hello'], 'letter.pdf', { type: 'application/pdf' }),
    )
    expect(screen.getByText(/letter\.pdf/)).toBeInTheDocument()
    await user.click(submitButton())

    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(2))
    expect(client.post.mock.calls[0][0]).toBe('/requests')
    expect(client.post.mock.calls[1][0]).toBe('/requests/55/documents')
    expect(client.post.mock.calls[1][1]).toBeInstanceOf(FormData)
    expect(await screen.findByText('request detail page')).toBeInTheDocument()
  })

  it('refuses a disallowed file type before anything is sent', async () => {
    renderForm()
    const user = userEvent.setup({ applyAccept: false })
    await fillToLastStep(user)
    await user.upload(
      screen.getByLabelText(en.requestCreate.addFiles),
      new File(['MZ'], 'malware.exe', { type: 'application/octet-stream' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(en.requestCreate.fileTypeBad)
    expect(screen.queryByText(/malware\.exe \(/)).not.toBeInTheDocument()
    expect(client.post).not.toHaveBeenCalled()
  })

  it('keeps the user on the page, naming the file, when an upload fails after the request was created', async () => {
    client.post.mockImplementation((url) =>
      url === '/requests' ? Promise.resolve({ data: { id: 55 } }) : Promise.reject({ response: { status: 500 } }))
    renderForm()
    const user = userEvent.setup()
    await fillToLastStep(user)
    await user.upload(
      screen.getByLabelText(en.requestCreate.addFiles),
      new File(['hello'], 'scan.png', { type: 'image/png' }),
    )
    await user.click(submitButton())

    expect(await screen.findByText('scan.png')).toBeInTheDocument()
    expect(screen.getByText(en.requestCreate.createdWithFailures)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: en.requestCreate.openRequest })).toHaveAttribute('href', '/requests/55')
    expect(screen.queryByText('request detail page')).not.toBeInTheDocument()
  })

  it('tells a user without permission so, instead of a generic failure', async () => {
    client.post.mockRejectedValue({ response: { status: 403 } })
    renderForm()
    const user = userEvent.setup()
    await fillToLastStep(user)
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(en.common.noPermission)
  })
})
