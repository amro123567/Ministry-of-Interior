import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutGrid, Mail, CirclePlus, IdCard, Workflow, Users, ScrollText, BarChart3, Search, Settings, ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import LangToggle from './LangToggle.jsx'

// Single horizontal header: brand, permission-gated nav links, an inline
// expandable search pill, the EN | AR switch and the user menu in one 64px bar.
//
// Width budget (why the search is a pill only from 1400px): a full-permission
// admin has six nav entries (five links + the Admin menu). Below 1400px the
// search collapses to an icon button that opens a popover, so the bar never
// wraps or scrolls sideways; below 1280px the links move into the mobile menu.
export default function Navbar() {
  const { user, logout, hasPermission } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const adminRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false)
      if (adminRef.current && !adminRef.current.contains(e.target)) setAdminOpen(false)
    }
    function onEscape(e) {
      if (e.key === 'Escape') { setMenuOpen(false); setMobileOpen(false); setSearchOpen(false); setAdminOpen(false) }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  if (!user) return null

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    navigate('/login', { state: { loggedOut: true } })
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    navigate(`/requests${searchValue ? `?q=${encodeURIComponent(searchValue)}` : ''}`)
    setMobileOpen(false)
    setSearchOpen(false)
  }

  const initials = (user.fullName || user.username || '?')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Gated by the same permission codes the backend enforces (see
  // ProtectedRoute's permissions prop on these routes in App.jsx) --
  // not a hardcoded role name, so a link's visibility can never drift
  // from what the API actually allows. This is what makes every user's
  // header genuinely different: an Officer or Viewer simply never
  // receives the Reports/Users/Audit links because hasPermission()
  // reads the permissions AuthService.effectivePermissions() issued
  // them at login, not a role name this file would have to keep in sync.
  const links = [
    { to: '/', end: true, label: t('nav.dashboard'), icon: LayoutGrid },
    { to: '/requests', end: false, label: t('nav.correspondence'), icon: Mail },
    ...(hasPermission('REQUEST_TRANSITION_SUBMIT', 'REQUEST_TRANSITION_REVIEW', 'REQUEST_TRANSITION_DECIDE', 'REQUEST_TRANSITION_ARCHIVE') ? [{ to: '/requests/new', end: false, label: t('nav.newRequest'), icon: CirclePlus }] : []),
    { to: '/citizens', end: false, label: t('nav.citizens'), icon: IdCard },
    // Ungated like the three links above -- the backend leaves both
    // /api/workflow/instances and its transition endpoint open to any
    // authenticated user (only the catalog-editing POSTs require
    // USER_MANAGE, checked inline on the page itself), so this link isn't
    // hidden from anyone who can actually use what's behind it.
    { to: '/workflow', end: false, label: t('nav.workflow'), icon: Workflow },
  ]

  // Administration links are grouped under one dropdown on desktop so a
  // full-permission admin's bar never outgrows the header (it used to scroll
  // sideways at 1280px). The mobile menu still lists every link flat.
  const adminLinks = [
    ...(hasPermission('REPORTS_VIEW') ? [{ to: '/reports', end: false, label: t('nav.reports'), icon: BarChart3 }] : []),
    ...(hasPermission('USER_MANAGE') ? [{ to: '/admin/users', end: false, label: t('nav.users'), icon: Users }] : []),
    ...(hasPermission('AUDIT_VIEW') ? [{ to: '/admin/audit', end: false, label: t('nav.auditLog'), icon: ScrollText }] : []),
  ]

  const allLinks = [...links, ...adminLinks]

  // Inactive links sit at reduced opacity; the active tab is a quiet blue pill
  // (tinted fill + hairline border) instead of a solid block. Every link carries a
  // transparent border so activating one never shifts its neighbours.
  const pill = 'flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium leading-5 transition-colors'
  const navLinkCls = ({ isActive }) => `${pill} ${
    isActive
      ? 'border-blue-500/30 bg-blue-600/20 text-blue-400'
      : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
  }`
  // /requests/new is its own tab, so it must not also light up "Correspondence".
  const linkCls = (to) => ({ isActive }) =>
    navLinkCls({ isActive: isActive && !(to === '/requests' && pathname.startsWith('/requests/new')) })
  const dropLinkCls = ({ isActive }) =>
    `flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`
  const popover = 'absolute end-0 top-[calc(100%+10px)] z-30 rounded-xl border border-slate-700 bg-slate-900 shadow-xl shadow-black/30'

  // A render function, not a component: declaring a component inside render gives it a new
  // identity every keystroke, which remounts the <input> and drops focus after each letter.
  const renderSearch = ({ className = '', autoFocus = false, expandable = false } = {}) => (
    <form onSubmit={handleSearchSubmit} role="search" className={`relative ${expandable ? 'w-52 shrink-0' : ''} ${className}`}>
      <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="search"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder={expandable ? t('nav.search') : t('nav.searchPlaceholder')}
        aria-label={t('nav.searchPlaceholder')}
        autoFocus={autoFocus}
        className={`h-9 rounded-lg border border-slate-700 bg-slate-800/60 ps-9 pe-3 text-xs text-slate-100 placeholder:text-slate-400
          transition-colors hover:border-slate-600 focus:border-blue-500/70 focus:bg-slate-800 focus:!outline-none focus-visible:!outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500/40 w-full`}
      />
    </form>
  )

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-header font-sans antialiased shadow-lg shadow-black/10">
      <div className="mx-auto flex min-h-16 max-w-[1400px] items-center gap-6 px-6 py-3 sm:px-8">
        {/* Identity: seal in a soft rounded box + system name */}
        <NavLink to="/" className="flex shrink-0 items-center gap-3 rounded-lg" aria-label={t('nav.brand')}>
          <span className="grid place-items-center rounded-lg border border-white/10 bg-white/10 p-1.5">
            <img src="/moi-seal.png" alt="" className="h-7 w-7 rounded-md bg-white object-contain p-0.5" />
          </span>
          <span className="text-[15px] font-extrabold leading-none tracking-wide text-white">CTS</span>
        </NavLink>

        <nav className="hidden min-w-0 items-center gap-1 xl:flex" aria-label={t('nav.brand')}>
          {links.map(({ to, end, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={end} className={linkCls(to)}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          {adminLinks.length > 0 && (
            <div className="relative" ref={adminRef}>
              <button
                type="button"
                onClick={() => setAdminOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={adminOpen}
                className={`${pill} ${adminOpen || adminLinks.some((l) => pathname.startsWith(l.to))
                  ? 'border-blue-500/30 bg-blue-600/20 text-blue-400'
                  : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'}`}
              >
                <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('nav.admin')}
                <ChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform ${adminOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {adminOpen && (
                <div className={`${popover} !end-auto start-0 w-52 p-1.5`}>
                  {adminLinks.map(({ to, end, label, icon: Icon }) => (
                    <NavLink key={to} to={to} end={end} onClick={() => setAdminOpen(false)} className={dropLinkCls}>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Right action bar */}
        <div className="ms-auto flex shrink-0 items-center gap-3">
          {/* >= 1400px: inline pill that widens on focus */}
          <div className="hidden min-[1400px]:block">{renderSearch({ expandable: true })}</div>
          {/* md..1400px: icon button + popover */}
          <div className="relative hidden md:max-[1399px]:block" ref={searchRef}>
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={t('nav.searchPlaceholder')}
              aria-haspopup="true"
              aria-expanded={searchOpen}
              className={`grid h-9 w-9 place-items-center rounded-lg border transition-colors ${
                searchOpen ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:text-white'
              }`}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
            {searchOpen && <div className={`${popover} w-72 p-2`}>{renderSearch({ autoFocus: true })}</div>}
          </div>

          <LangToggle tone="dark" className="hidden sm:inline-flex" />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-label={user.fullName || user.username}
              className="flex items-center gap-1.5 rounded-full py-0.5 ps-0.5 pe-1.5 transition-colors hover:bg-white/5"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-600 bg-slate-700 text-xs font-semibold text-white">
                {initials}
              </span>
              <ChevronDown className={`hidden h-3.5 w-3.5 text-slate-400 transition-transform sm:block ${menuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className={`${popover} w-60 overflow-hidden`}>
                <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-600 bg-slate-700 text-xs font-semibold text-white">{initials}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{user.fullName}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-400">{user.roles?.join(', ')}</div>
                  </div>
                </div>
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-start text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" /> {t('common.signOut')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={t('common.menu')}
            aria-expanded={mobileOpen}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 transition-colors hover:text-white xl:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-800 bg-header px-6 py-4 sm:px-8 xl:hidden">
          {renderSearch({ className: 'mb-3 md:hidden' })}
          <nav className="flex flex-col gap-1" aria-label={t('nav.brand')}>
            {allLinks.map(({ to, end, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={linkCls(to)}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 border-t border-slate-800 pt-3 sm:hidden">
            <LangToggle tone="dark" />
          </div>
        </div>
      )}
    </header>
  )
}
