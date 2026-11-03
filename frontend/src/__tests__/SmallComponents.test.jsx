import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useState } from 'react'
import { LanguageProvider } from '../context/LanguageContext.jsx'
import StatusBadge, { SlaBadge, SlaRecordBadge } from '../components/StatusBadge.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import Breadcrumb from '../components/Breadcrumb.jsx'
import Pagination, { usePagination } from '../components/Pagination.jsx'
import { ActiveFilterChips, FilterField } from '../components/FilterBar.jsx'
import LangToggle from '../components/LangToggle.jsx'
import { SkeletonKpiRow, SkeletonTableRows, SkeletonLine } from '../components/Skeleton.jsx'
import { translations } from '../i18n/translations.js'

const en = translations.en
const wrap = (ui, route = '/') => render(
  <MemoryRouter initialEntries={[route]}><LanguageProvider>{ui}</LanguageProvider></MemoryRouter>,
)

describe('StatusBadge / SlaBadge / SlaRecordBadge', () => {
  it.each(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'])('names %s in words', (s) => {
    wrap(<StatusBadge status={s} />)
    expect(screen.getByText(en.status[s])).toBeInTheDocument()
  })

  it('does not crash on an unknown or missing status', () => {
    const { unmount } = wrap(<StatusBadge status="SOMETHING_NEW" />)
    expect(screen.getByText('SOMETHING NEW')).toBeInTheDocument()
    unmount()
    wrap(<StatusBadge />)
  })

  it('shows the live SLA badge only for risk, and stays silent for on-track', () => {
    const { container, rerender } = wrap(<SlaBadge slaStatus="OVERDUE" />)
    expect(screen.getByText(en.sla.OVERDUE)).toBeInTheDocument()
    rerender(<MemoryRouter><LanguageProvider><SlaBadge slaStatus="DUE_SOON" /></LanguageProvider></MemoryRouter>)
    expect(screen.getByText(en.sla.DUE_SOON)).toBeInTheDocument()
    rerender(<MemoryRouter><LanguageProvider><SlaBadge slaStatus="ON_TRACK" /></LanguageProvider></MemoryRouter>)
    expect(container).toBeEmptyDOMElement()
  })

  it('always shows something for the SLA record, with a dash when there is no record yet', () => {
    const { rerender } = wrap(<SlaRecordBadge slaStatus="MET" />)
    expect(screen.getByText(en.sla.MET)).toBeInTheDocument()
    rerender(<MemoryRouter><LanguageProvider><SlaRecordBadge slaStatus="BREACHED" /></LanguageProvider></MemoryRouter>)
    expect(screen.getByText(en.sla.BREACHED)).toBeInTheDocument()
    rerender(<MemoryRouter><LanguageProvider><SlaRecordBadge /></LanguageProvider></MemoryRouter>)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('names every payment status', () => {
    for (const s of ['PAID', 'REVERSED']) {
      const { unmount } = wrap(<PaymentStatusBadge status={s} />)
      expect(screen.getByText(en.paymentStatus[s])).toBeInTheDocument()
      unmount()
    }
  })
})

describe('ErrorBoundary', () => {
  function Boom({ explode }) { if (explode) throw new Error('kaboom'); return <p>fine</p> }

  it('replaces a crashed page by a message with a retry that brings the page back', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let explode = true
    const { rerender } = render(
      <ErrorBoundary title="Oops" message="Could not show" retryLabel="Again"><Boom explode={explode} /></ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Oops')
    expect(screen.getByRole('alert')).toHaveTextContent('Could not show')
    explode = false
    rerender(<ErrorBoundary title="Oops" message="Could not show" retryLabel="Again"><Boom explode={explode} /></ErrorBoundary>)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Again' }))
    expect(screen.getByText('fine')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders its children untouched when nothing fails', () => {
    render(<ErrorBoundary title="t" message="m" retryLabel="r"><p>all good</p></ErrorBoundary>)
    expect(screen.getByText('all good')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Breadcrumb', () => {
  const trail = () => screen.queryByRole('navigation', { name: 'Breadcrumb' })

  it('shows nothing on the dashboard', () => {
    wrap(<Breadcrumb />, '/')
    expect(trail()).toBeNull()
  })

  it('links back to the list from a request page', () => {
    wrap(<Breadcrumb />, '/requests/42')
    expect(within(trail()).getByRole('link', { name: en.nav.correspondence })).toHaveAttribute('href', '/requests')
    expect(within(trail()).getByText('#42')).toHaveAttribute('aria-current', 'page')
  })

  it('calls the new-request page by its title', () => {
    wrap(<Breadcrumb />, '/requests/new')
    expect(within(trail()).getByText(en.requestCreate.title)).toBeInTheDocument()
    expect(within(trail()).queryByText('#new')).toBeNull()
  })

  it('does not mistake "new" for a citizen number', () => {
    wrap(<Breadcrumb />, '/citizens/new')
    expect(within(trail()).queryByText('#new')).toBeNull()
    expect(within(trail()).getByText(en.citizenCreate.title)).toBeInTheDocument()
    expect(within(trail()).getByRole('link', { name: en.nav.citizens })).toHaveAttribute('href', '/citizens')
  })

  it('shows a citizen by number', () => {
    wrap(<Breadcrumb />, '/citizens/7')
    expect(within(trail()).getByText('#7')).toBeInTheDocument()
  })

  it.each([['/admin/audit', en.nav.auditLog], ['/reports', en.nav.reports], ['/workflow', en.nav.workflow], ['/admin/users', en.nav.users]])(
    '%s ends in %s', (route, label) => {
      wrap(<Breadcrumb />, route)
      expect(within(trail()).getByText(label)).toHaveAttribute('aria-current', 'page')
    },
  )
})

describe('Pagination', () => {
  function Harness({ count, initialSize = 10 }) {
    const items = Array.from({ length: count }, (_, i) => `row-${i + 1}`)
    const { pageItems, pagination } = usePagination(items, initialSize)
    return (<div><ul>{pageItems.map((x) => <li key={x}>{x}</li>)}</ul><Pagination {...pagination} /></div>)
  }

  it('stays out of the way when everything fits on one page', () => {
    wrap(<Harness count={8} />)
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
  })

  it('shows the first page, then the next, with the right range', async () => {
    wrap(<Harness count={25} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByText('row-1')).toBeInTheDocument()
    expect(screen.getByText('1–10')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Page 2' }))
    expect(screen.getByText('row-11')).toBeInTheDocument()
    expect(screen.queryByText('row-1')).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Page 3' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('21–25')).toBeInTheDocument()
  })

  it('goes back to page 1 when the page size changes', async () => {
    const user = userEvent.setup()
    wrap(<Harness count={60} />)
    await user.click(screen.getByRole('button', { name: 'Page 3' }))
    await user.selectOptions(screen.getByRole('combobox'), '25')
    expect(screen.getByText('row-1')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(25)
  })

  it('collapses a long range of pages into a window with gaps', () => {
    wrap(<Harness count={500} />)
    const labels = within(screen.getByRole('navigation')).getAllByRole('button').map((b) => b.textContent).filter((x) => /^\d+$/.test(x))
    expect(labels).toContain('1')
    expect(labels).toContain('50')
    expect(labels.length).toBeLessThan(10)
  })
})

describe('FilterBar', () => {
  it('lists each active filter as a removable chip and can clear them all', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn(); const onClear = vi.fn()
    wrap(<ActiveFilterChips chips={[{ key: 'status', label: 'Draft', onRemove }, { key: 'p', label: 'Urgent', onRemove: vi.fn() }]} onClear={onClear} />)
    await user.click(screen.getByRole('button', { name: `${en.requests.removeFilter}: Draft` }))
    expect(onRemove).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: en.requests.clearFilters }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('renders nothing without active filters', () => {
    const { container } = wrap(<ActiveFilterChips chips={[]} onClear={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('labels a filter control', () => {
    wrap(<FilterField label="Office"><select /></FilterField>)
    expect(screen.getByText('Office')).toBeInTheDocument()
  })
})

describe('LangToggle', () => {
  it('switches the page language and direction, and remembers the choice', async () => {
    const user = userEvent.setup()
    function Page() { const [n] = useState(0); return <p>{n}<LangToggle /></p> }
    wrap(<Page />)
    expect(document.documentElement.lang).toBe('en')
    await user.click(screen.getByRole('button', { name: 'العربية' }))
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(localStorage.getItem('cts_lang')).toBe('ar')
    expect(screen.getByRole('button', { name: 'العربية' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(document.documentElement.dir).toBe('ltr')
  })
})

describe('Skeletons', () => {
  it('draw the requested number of placeholders', () => {
    const { container } = wrap(<table><tbody><SkeletonTableRows rows={3} cols={4} /></tbody></table>)
    expect(container.querySelectorAll('tr')).toHaveLength(3)
    expect(container.querySelectorAll('td')).toHaveLength(12)
    wrap(<SkeletonKpiRow count={4} />)
    wrap(<SkeletonLine />)
  })
})
