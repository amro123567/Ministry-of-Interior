import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import client from '../api/client.js'
import RequestDetailPage from '../pages/RequestDetailPage.jsx'
import { translations } from '../i18n/translations.js'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

const en = translations.en

const REQUEST = {
  id: 5, referenceNumber: 'CTS-2026-000005', status: 'DRAFT', slaStatus: 'ON_TRACK', priority: 'NORMAL', direction: 'INCOMING',
  subject: 'Birth certificate for Layla', notes: null, dueAt: '2026-11-10T09:00:00Z',
  citizen: { id: 1, firstNameEn: 'Layla', lastNameEn: 'Mansour', registryNumber: 'REG-100589' },
  documentType: { id: 2, nameEn: 'Birth certificate' }, office: { id: 7, nameEn: 'Beirut office' },
  departmentId: null, departmentName: null, assignedToName: null, createdByName: 'Officer One',
}

let data
function serve(overrides = {}) {
  data = {
    '/requests/5': REQUEST,
    '/requests/5/history': [{ id: 1, fromStatus: null, toStatus: 'DRAFT', changedByName: 'Officer One', changedAt: '2026-11-03T08:00:00' }],
    '/requests/5/transitions': [{ toStatus: 'SUBMITTED', actionCode: 'Submit', labelEn: 'Submit', requiresComment: false }],
    '/requests/5/audit': [],
    '/requests/5/assignments': [],
    '/requests/5/documents': [],
    '/sla-records/5': { slaStatus: 'ON_TRACK', daysRemaining: 7 },
    '/requests/5/payments': [],
    '/document-types': [{ id: 2, nameEn: 'Birth certificate' }],
    '/offices': [{ id: 7, nameEn: 'Beirut office' }],
    '/departments': [],
    '/users': [],
    ...overrides,
  }
  client.get.mockImplementation((url) => (url in data ? Promise.resolve({ data: data[url] }) : Promise.reject(new Error(`unexpected GET ${url}`))))
}

function renderPage(permissions) {
  signInAs({ roles: ['OFFICER'], permissions })
  return renderWithProviders(
    <Routes><Route path="/requests/:id" element={<RequestDetailPage />} /></Routes>,
    { route: '/requests/5' },
  )
}

describe('RequestDetailPage', () => {
  beforeEach(() => { client.patch.mockReset(); client.put.mockReset(); client.post.mockReset(); serve() })

  it('shows the request, its reference, status and the chosen citizen', async () => {
    renderPage(['REQUEST_CREATE'])
    expect(await screen.findByRole('heading', { name: 'CTS-2026-000005' })).toBeInTheDocument()
    expect(screen.getAllByText(en.status.DRAFT).length).toBeGreaterThan(0)
    expect(screen.getByText(/Layla Mansour \(REG-100589\)/)).toBeInTheDocument()
    expect(screen.getByText('Birth certificate for Layla')).toBeInTheDocument()
  })

  it('says so, instead of staying on "loading", when the request cannot be loaded', async () => {
    client.get.mockImplementation((url) => (url === '/requests/5'
      ? Promise.reject({ response: { status: 403 } })
      : Promise.resolve({ data: [] })))
    renderPage([])
    expect(await screen.findByRole('alert')).toHaveTextContent(en.common.noPermission)
  })

  it('does not call a rejected request "Approved" once it has been archived', async () => {
    serve({
      '/requests/5': { ...REQUEST, status: 'ARCHIVED', rejectionReason: 'Incomplete documents' },
      '/requests/5/history': [
        { id: 1, fromStatus: null, toStatus: 'DRAFT', changedByName: 'Officer One', changedAt: '2026-11-03T08:00:00' },
        { id: 2, fromStatus: 'UNDER_REVIEW', toStatus: 'REJECTED', changedByName: 'Manager', changedAt: '2026-11-04T08:00:00' },
        { id: 3, fromStatus: 'REJECTED', toStatus: 'ARCHIVED', changedByName: 'Admin', changedAt: '2026-11-05T08:00:00' },
      ],
      '/requests/5/transitions': [],
    })
    renderPage([])
    const steps = within(await screen.findByRole('list', { name: en.requestDetail.progress }))
    expect(steps.getByText(en.status.REJECTED)).toBeInTheDocument()
    expect(steps.queryByText(en.status.APPROVED)).toBeNull()
  })

  it('only offers active staff when reassigning', async () => {
    serve({
      '/requests/5': { ...REQUEST, status: 'SUBMITTED' },
      '/users': [
        { id: 1, fullName: 'Active Officer', roles: ['OFFICER'], enabled: true },
        { id: 2, fullName: 'Deactivated Officer', roles: ['OFFICER'], enabled: false },
      ],
    })
    renderPage(['REQUEST_ASSIGN', 'USER_VIEW'])
    expect(await screen.findByRole('option', { name: /Active Officer/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Deactivated Officer/ })).toBeNull()
  })

  it('offers exactly the next steps the server allows and sends the chosen one', async () => {
    client.patch.mockResolvedValue({ data: {} })
    renderPage(['REQUEST_TRANSITION_SUBMIT'])
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Submit' }))
    expect(client.patch).toHaveBeenCalledWith('/requests/5/transition', { toStatus: 'SUBMITTED', rejectionReason: null, note: null })
  })

  it('offers no status buttons when the server allows none (a viewer)', async () => {
    serve({ '/requests/5/transitions': [] })
    renderPage([])
    await screen.findByRole('heading', { name: 'CTS-2026-000005' })
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
    expect(screen.queryByRole('button', { name: en.requestDetail.editDraft })).toBeNull()
  })

  it('will not reject without a reason, then sends the reason with the rejection', async () => {
    const user = userEvent.setup()
    serve({
      '/requests/5': { ...REQUEST, status: 'UNDER_REVIEW' },
      '/requests/5/transitions': [{ toStatus: 'REJECTED', actionCode: 'Reject', labelEn: 'Reject', requiresComment: true }],
    })
    client.patch.mockResolvedValue({ data: {} })
    renderPage(['REQUEST_TRANSITION_DECIDE'])
    await user.click(await screen.findByRole('button', { name: 'Reject' }))
    const confirm = screen.getByRole('button', { name: en.requestDetail.confirmRejection })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText(en.requestDetail.rejectionReason), 'Missing stamp')
    await user.click(confirm)
    expect(client.patch).toHaveBeenCalledWith('/requests/5/transition', { toStatus: 'REJECTED', rejectionReason: 'Missing stamp', note: 'Missing stamp' })
  })

  it('shows the refusal message when the server turns a status change down', async () => {
    client.patch.mockRejectedValue({ response: { status: 409, data: { message: 'Not allowed from this state' } } })
    renderPage(['REQUEST_TRANSITION_SUBMIT'])
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Submit' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed from this state')
  })

  it('limits the draft subject to 255 characters, the same as when the request was created', async () => {
    const user = userEvent.setup()
    renderPage(['REQUEST_CREATE'])
    await user.click(await screen.findByRole('button', { name: en.requestDetail.editDraft }))
    expect(await screen.findByLabelText(en.requestDetail.subject)).toHaveAttribute('maxLength', '255')
  })

  it('saves draft edits with numeric ids and the citizen unchanged', async () => {
    const user = userEvent.setup()
    client.put.mockResolvedValue({ data: {} })
    renderPage(['REQUEST_CREATE'])
    await user.click(await screen.findByRole('button', { name: en.requestDetail.editDraft }))
    const subject = await screen.findByLabelText(en.requestDetail.subject)
    await user.clear(subject)
    await user.type(subject, 'New subject')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(client.put).toHaveBeenCalledWith('/requests/5', expect.objectContaining({
      citizenId: 1, documentTypeId: 2, officeId: 7, departmentId: null, subject: 'New subject', direction: 'INCOMING', priority: 'NORMAL',
    }))
  })

  it('does not offer to edit a request that has left draft', async () => {
    serve({ '/requests/5': { ...REQUEST, status: 'SUBMITTED' } })
    renderPage(['REQUEST_CREATE'])
    await screen.findByRole('heading', { name: 'CTS-2026-000005' })
    expect(screen.queryByRole('button', { name: en.requestDetail.editDraft })).toBeNull()
  })

  it('hides re-assignment for a closed request', async () => {
    serve({ '/requests/5': { ...REQUEST, status: 'APPROVED' } })
    renderPage(['REQUEST_ASSIGN', 'USER_VIEW'])
    await screen.findByRole('heading', { name: 'CTS-2026-000005' })
    expect(screen.queryByLabelText(en.requestDetail.reassignTo)).toBeNull()
  })

  it('assigns the chosen person with a note', async () => {
    const user = userEvent.setup()
    serve({ '/users': [{ id: 9, fullName: 'Rami Haddad', roles: ['OFFICER'] }] })
    client.patch.mockResolvedValue({ data: {} })
    renderPage(['REQUEST_ASSIGN', 'USER_VIEW'])
    await user.selectOptions(await screen.findByLabelText(en.requestDetail.reassignTo), '9')
    await user.type(screen.getByLabelText(en.requestDetail.noteOptional), 'please check')
    await user.click(screen.getByRole('button', { name: en.requestDetail.assign }))
    expect(client.patch).toHaveBeenCalledWith('/requests/5/assign', { userId: 9, note: 'please check' })
  })

  describe('documents tab', () => {
    const ATTACHMENT = { id: 11, fileName: 'scan.pdf', sizeBytes: 2048, sha256: 'abcdef0123456789abcdef', uploadedByName: 'Officer One' }
    let click
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn()
      click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    })
    afterEach(() => { vi.useRealTimers(); click.mockRestore() })

    it('lists attachments with size and a short checksum, and downloads one as a real file', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      serve({ '/requests/5/documents': [ATTACHMENT], '/documents/11/download': new Blob(['pdf']) })
      renderPage(['REQUEST_CREATE'])
      await user.click(await screen.findByRole('tab', { name: new RegExp(en.requestDetail.documents) }))
      expect(screen.getByText(/2\.0 KB · SHA-256 abcdef012345…/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'scan.pdf' }))
      await waitFor(() => expect(click).toHaveBeenCalled())
      expect(client.get).toHaveBeenCalledWith('/documents/11/download', { params: undefined, responseType: 'blob' })
      expect(URL.revokeObjectURL).not.toHaveBeenCalled() // revoked only later, so the browser can finish starting the download
    })

    it('shows a message when the download fails', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      serve({ '/requests/5/documents': [ATTACHMENT] })
      client.get.mockImplementation((url) => (url === '/documents/11/download'
        ? Promise.reject({ response: { status: 404 } })
        : Promise.resolve({ data: data[url] ?? [] })))
      renderPage([])
      await user.click(await screen.findByRole('tab', { name: new RegExp(en.requestDetail.documents) }))
      await user.click(screen.getByRole('button', { name: 'scan.pdf' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not download the file.')
    })
  })

  describe('finance tab', () => {
    it('shows payments and does not crash on one with no payment time', async () => {
      const user = userEvent.setup()
      serve({ '/requests/5/payments': [
        { id: 1, amount: 25, currency: 'USD', method: 'CASH', status: 'PAID', paidAt: '2026-11-02T10:00:00', receiptNumber: 'R-1', collectedByName: 'Cashier' },
        { id: 2, amount: 0.5, currency: 'USD', method: 'WAIVED', status: 'PAID', paidAt: null },
      ] })
      renderPage(['PAYMENT_RECORD'])
      await user.click(await screen.findByRole('tab', { name: en.requestFinance.title }))
      expect(screen.getByText('25 USD')).toBeInTheDocument()
      expect(screen.getByText('0.5 USD')).toBeInTheDocument()
    })

    it('rejects a zero or empty amount before sending anything', async () => {
      const user = userEvent.setup()
      serve({ '/requests/5/transitions': [] })
      renderPage(['PAYMENT_RECORD'])
      await user.click(await screen.findByRole('tab', { name: en.requestFinance.title }))
      await user.click(screen.getByText(en.requestFinance.recordPayment))
      await user.click(screen.getByRole('button', { name: en.requestFinance.submit }))
      expect(await screen.findByRole('alert')).toHaveTextContent(en.requestFinance.errorAmountRequired)
      expect(client.post).not.toHaveBeenCalled()
    })

    it('records a payment with the currency in capitals', async () => {
      const user = userEvent.setup()
      serve({ '/requests/5/transitions': [] })
      client.post.mockResolvedValue({ data: {} })
      renderPage(['PAYMENT_RECORD'])
      await user.click(await screen.findByRole('tab', { name: en.requestFinance.title }))
      await user.click(screen.getByText(en.requestFinance.recordPayment))
      await user.type(screen.getByLabelText(new RegExp(en.requestFinance.amount)), '12.5')
      const cur = screen.getByLabelText(new RegExp(en.requestFinance.currency))
      await user.clear(cur); await user.type(cur, 'eur')
      await user.click(screen.getByRole('button', { name: en.requestFinance.submit }))
      expect(client.post).toHaveBeenCalledWith('/payments', { requestId: 5, amount: 12.5, currency: 'EUR', method: 'CASH', receiptNumber: null })
    })

    it('only lets someone with the permission reverse a paid payment, and needs a reason', async () => {
      const user = userEvent.setup()
      serve({ '/requests/5/payments': [{ id: 1, amount: 25, currency: 'USD', method: 'CASH', status: 'PAID', paidAt: '2026-11-02T10:00:00' }] })
      client.patch.mockResolvedValue({ data: {} })
      const view = renderPage([])
      await user.click(await screen.findByRole('tab', { name: en.requestFinance.title }))
      expect(screen.queryByRole('button', { name: en.requestFinance.reverse })).toBeNull()
      view.unmount()

      renderPage(['PAYMENT_REVERSE'])
      await user.click(await screen.findByRole('tab', { name: en.requestFinance.title }))
      await user.click(screen.getByRole('button', { name: en.requestFinance.reverse }))
      const confirm = screen.getByRole('button', { name: en.requestFinance.confirmReversal })
      expect(confirm).toBeDisabled()
      await user.type(screen.getByLabelText(en.requestFinance.reversalReason), 'duplicate')
      await user.click(confirm)
      expect(client.patch).toHaveBeenCalledWith('/payments/1/reverse', { reversalReason: 'duplicate' })
    })
  })

  it('shows the status history and the activity log on the history tab', async () => {
    const user = userEvent.setup()
    serve({ '/requests/5/audit': [{ id: 1, action: 'CREATE', actorName: 'Officer One', occurredAt: '2026-11-03T08:00:00', details: 'created' }] })
    renderPage([])
    await user.click(await screen.findByRole('tab', { name: en.requestDetail.tabHistory }))
    expect(screen.getByText(new RegExp(`${en.requestDetail.created}`))).toBeInTheDocument()
    expect(screen.getByText('CREATE')).toBeInTheDocument()
    const log = screen.getByText(en.requestDetail.activityLog).parentElement
    expect(within(log).getByText('created')).toBeInTheDocument()
  })
})
