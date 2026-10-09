import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import client from '../api/client.js'
import WorkflowEnginePage from '../pages/WorkflowEnginePage.jsx'
import { translations } from '../i18n/translations.js'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

const en = translations.en
const STATES = [
  { id: 1, code: 'OPEN', nameEn: 'Open', isInitial: true, isFinal: false, displayOrder: 1, colorHex: '#3B82F6' },
  { id: 2, code: 'REVIEW', nameEn: 'In review', isInitial: false, isFinal: false, displayOrder: 2, colorHex: '#F59E0B' },
  { id: 3, code: 'DONE', nameEn: 'Done', isInitial: false, isFinal: true, displayOrder: 3, colorHex: '#10B981' },
]
const TRANSITIONS = [
  { id: 1, fromStateCode: 'OPEN', toStateCode: 'REVIEW', actionCode: 'SEND', labelEn: 'Send for review', requiredPermissionCodes: [] },
  { id: 2, fromStateCode: 'REVIEW', toStateCode: 'DONE', actionCode: 'FINISH', labelEn: 'Finish', requiredPermissionCodes: [] },
  { id: 3, fromStateCode: 'REVIEW', toStateCode: 'OPEN', actionCode: 'RETURN', labelEn: 'Send back', requiredPermissionCodes: [] },
]

describe('WorkflowEnginePage', () => {
  beforeEach(() => {
    signInAs({ roles: ['ADMIN'], permissions: ['USER_MANAGE'] })
    client.get.mockImplementation((url) =>
      Promise.resolve({ data: url === '/workflow/states' ? STATES : url === '/workflow/transitions' ? TRANSITIONS : [] }))
  })

  it('draws the states and transitions as a diagram, and still offers the list', async () => {
    renderWithProviders(<WorkflowEnginePage />)
    const diagram = await screen.findByRole('img', { name: en.workflowEngine.diagramLabel })
    expect(within(diagram).getByText('In review')).toBeInTheDocument()
    expect(within(diagram).getByText('Send back')).toBeInTheDocument() // the backwards arrow is labelled too

    await userEvent.setup().click(screen.getByRole('button', { name: en.workflowEngine.view_list }))
    expect(screen.queryByRole('img', { name: en.workflowEngine.diagramLabel })).not.toBeInTheDocument()
    expect(screen.getByText('(RETURN)')).toBeInTheDocument()
  })
})
