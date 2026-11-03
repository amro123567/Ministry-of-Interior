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
const LAYLA = { id: 1, firstNameEn: 'Layla', lastNameEn: 'Mansour', registryNumber: 'REG-100589' }
const OMAR = { id: 2, firstNameEn: 'Omar', lastNameEn: 'Khoury', registryNumber: 'REG-200100' }

describe('RequestCreatePage: the chosen citizen', () => {
  beforeEach(() => {
    client.post.mockReset()
    client.get.mockImplementation((url, cfg) => {
      if (url === '/citizens') return Promise.resolve({ data: cfg?.params?.q === 'omar' ? [OMAR] : [LAYLA, OMAR] })
      if (url === '/document-types') return Promise.resolve({ data: [{ id: 2, nameEn: 'Birth certificate' }] })
      if (url === '/offices') return Promise.resolve({ data: [{ id: 7, nameEn: 'Beirut office' }] })
      return Promise.resolve({ data: [] })
    })
    signInAs({ roles: ['OFFICER'], permissions: ['REQUEST_CREATE'] })
  })

  it('stays chosen, in the list and on the review step, after the search box is changed to something that no longer finds them', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValue({ data: { id: 99 } })
    renderWithProviders(
      <Routes>
        <Route path="/requests/new" element={<RequestCreatePage />} />
        <Route path="/requests/:id" element={<div>request detail page</div>} />
      </Routes>,
      { route: '/requests/new' },
    )
    await screen.findByRole('option', { name: /Layla/ })
    await user.selectOptions(screen.getByDisplayValue(en.requestCreate.selectCitizen), '1')

    // search for someone else: Layla is no longer among the results
    await user.type(screen.getByLabelText(new RegExp(en.requestCreate.citizen)), 'omar')
    // wait for the answer to the final search ("omar" -> only Omar) to be on screen
    await waitFor(() => expect(client.get).toHaveBeenCalledWith('/citizens', { params: { q: 'omar' } }))
    await new Promise((r) => setTimeout(r, 60))
    expect(screen.getByRole('option', { name: /Omar/ })).toBeInTheDocument()

    // the dropdown still shows Layla as the selected one
    expect(screen.getByDisplayValue(/Layla Mansour/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en.requestCreate.next }))
    await user.selectOptions(screen.getByLabelText(new RegExp(en.requestCreate.documentType)), '2')
    await user.click(screen.getByRole('button', { name: en.requestCreate.next }))

    // the review step names the citizen (it used to show a dash)
    expect(await screen.findByText(/Layla Mansour \(REG-100589\)/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en.requestCreate.submit }))
    expect(client.post).toHaveBeenCalledWith('/requests', expect.objectContaining({ citizenId: 1 }))
  })

  it('does not let a slow, older search overwrite the newer results', async () => {
    const user = userEvent.setup()
    let releaseSlow
    client.get.mockImplementation((url, cfg) => {
      if (url === '/citizens') {
        if (cfg?.params?.q === 'o') return new Promise((resolve) => { releaseSlow = () => resolve({ data: [LAYLA] }) })
        if (cfg?.params?.q === 'om') return Promise.resolve({ data: [OMAR] })
        return Promise.resolve({ data: [] })
      }
      if (url === '/offices') return Promise.resolve({ data: [{ id: 7, nameEn: 'Beirut office' }] })
      return Promise.resolve({ data: [] })
    })
    renderWithProviders(<Routes><Route path="/requests/new" element={<RequestCreatePage />} /></Routes>, { route: '/requests/new' })
    const box = await screen.findByLabelText(new RegExp(en.requestCreate.citizen))
    await user.type(box, 'o')
    await waitFor(() => expect(typeof releaseSlow).toBe('function'))
    await user.type(box, 'm')
    expect(await screen.findByRole('option', { name: /Omar/ })).toBeInTheDocument()
    releaseSlow() // the older answer arrives last
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByRole('option', { name: /Layla/ })).toBeNull()
    expect(screen.getByRole('option', { name: /Omar/ })).toBeInTheDocument()
  })
})
