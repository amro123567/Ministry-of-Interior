import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import { translations } from '../i18n/translations.js'
import { renderWithProviders, signInAs } from '../test/renderWithProviders.jsx'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: [] })), post: vi.fn(), patch: vi.fn() },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}))

const en = translations.en
const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div> }
const shell = (ui) => renderWithProviders(<>{ui}<Routes><Route path="*" element={<Where />} /></Routes></>, { route: '/workflow' })

describe('Navbar', () => {
  it('renders nothing for a signed-out visitor', () => {
    shell(<Navbar />)
    expect(screen.queryByRole('banner')).toBeNull()
  })

  it('marks the current page and shows only the links the user may use', () => {
    signInAs({ username: 'Serhan Aoun', roles: ['VIEWER'], permissions: ['REPORTS_VIEW'] })
    shell(<Navbar />)
    const nav = screen.getAllByRole('navigation')[0]
    expect(within(nav).getByRole('link', { name: en.nav.workflow })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: en.nav.dashboard })).not.toHaveAttribute('aria-current')
    expect(within(nav).queryByRole('link', { name: en.nav.newRequest })).toBeNull() // no request permissions
    expect(within(nav).getByRole('button', { name: en.nav.admin })).toBeInTheDocument() // REPORTS_VIEW -> Admin menu
  })

  it('shows initials in the avatar and opens the user menu with the sign-out action', async () => {
    const user = userEvent.setup()
    signInAs({ username: 'Serhan Aoun', roles: ['ADMIN'], permissions: [] })
    shell(<Navbar />)
    const avatar = screen.getByRole('button', { name: 'Serhan Aoun' })
    expect(avatar).toHaveTextContent('SA')
    await user.click(avatar)
    expect(screen.getByRole('button', { name: new RegExp(en.common.signOut) })).toBeInTheDocument()
  })

  it('keeps focus in the search box while typing and sends the query to the list page', async () => {
    const user = userEvent.setup()
    signInAs({ username: 'Serhan Aoun', roles: [], permissions: [] })
    shell(<Navbar />)
    const box = screen.getAllByRole('searchbox', { name: en.nav.searchPlaceholder })[0]
    await user.type(box, 'REQ-12') // would lose focus after one letter if the input remounted
    expect(box).toHaveValue('REQ-12')
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('where')).toHaveTextContent('/requests?q=REQ-12')
  })

  it('switches language with the EN | AR control', async () => {
    const user = userEvent.setup()
    signInAs({ username: 'Serhan Aoun', roles: [], permissions: [] })
    shell(<Navbar />)
    await user.click(screen.getByRole('button', { name: 'العربية' }))
    expect(document.documentElement.dir).toBe('rtl')
    expect(screen.getAllByRole('link', { name: translations.ar.nav.dashboard }).length).toBeGreaterThan(0)
  })
})

describe('Footer', () => {
  it('shows branding, quick links, support phone and copyright', () => {
    shell(<Footer />)
    expect(screen.getByText(/Ministry of Interior and Municipalities/)).toBeInTheDocument()
    const nav = screen.getByRole('navigation')
    expect(within(nav).getByRole('link', { name: en.nav.dashboard })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: en.nav.correspondence })).toHaveAttribute('href', '/requests')
    expect(within(nav).getByRole('link', { name: en.footer.helpDesk })).toHaveAttribute('href', 'tel:+9611000000')
    expect(screen.getByText('+961 1 000 000')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()}`))).toHaveTextContent(en.footer.rights)
  })
})
