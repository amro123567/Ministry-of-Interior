import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutGrid, Mail, CirclePlus, IdCard, Workflow, Users, ScrollText, BarChart3, Search, Settings, ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import LangToggle from './LangToggle.jsx'

// Single horizontal header replacing the old Sidebar + TopHeader pair --
// brand, permission-gated nav links, global search, language toggle and
// the user menu all live in one bar now, so the content column below it
// is full-width on every page. (There was an older, unused Navbar.jsx
// from before the Tailwind redesign; this replaces it rather than
// reviving it -- that one used hardcoded hasRole('ADMIN') checks and was
// missing the Reports/Audit/Citizens links entirely.)
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

  // /requests/new is its own tab, so it must not also light up "Correspondence".
  const linkCls = (to) => ({ isActive }) =>
    navLinkCls({ isActive: isActive && !(to === '/requests' && pathname.startsWith('/requests/new')) })

  // Items inside the white admin dropdown sit on a light surface, so they
  // can't share the dark-bar link colours.
  const dropLinkCls = ({ isActive }) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-primary-tint text-primary' : 'text-text-secondary hover:bg-row-hover hover:text-text-primary'
    }`

  const navLinkCls = ({ isActive }) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-nav-active text-white' : 'text-slate-200 hover:bg-white/10 hover:text-white'
    }`

  // One control, one border: the magnifier is an absolutely-positioned icon
  // inside the input's own box (no bordered wrapper around a second,
  // outline-less input, which is what drew two nested outlines before).
  const SearchForm = ({ className = '', autoFocus = false }) => (
    <form onSubmit={handleSearchSubmit} role="search" className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
      <input
        type="search"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder={t('nav.searchPlaceholder')}
        aria-label={t('nav.searchPlaceholder')}
        autoFocus={autoFocus}
        className="field ps-9"
      />
    </form>
  )

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-header shadow-md">
      <div className="h-[64px] max-w-[1400px] mx-auto px-5 sm:px-8 flex items-center gap-4">
        <NavLink to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <img
            src="/moi-seal.png"
            alt=""
            className="h-8 w-8 rounded-md bg-white ring-1 ring-border-subtle object-contain p-0.5"
          />
          {/* Brand name/subtitle text is deliberately never shown here (not
              even at very wide viewports): the header's content column is
              capped at max-w-[1400px], so there is no width at which extra
              text can appear without taking room back from a full-permission
              admin's 7-link nav -- see PROJECT_STATE.md's Navbar write-up.
              The seal image alone identifies the ministry; the full brand
              name still appears on the login page. */}
          <span className="sr-only">{t('nav.brand')}</span>
        </NavLink>

        <nav className="hidden xl:flex items-center gap-1 min-w-0">
          {links.map(({ to, end, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={end} className={linkCls(to)}>
              <Icon size={16} className="flex-shrink-0" />
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
                className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Settings size={16} className="flex-shrink-0" />
                {t('nav.admin')}
                <ChevronDown size={14} className={`text-slate-300 transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
              </button>
              {adminOpen && (
                <div className="absolute start-0 top-[calc(100%+8px)] w-48 rounded-lg border border-border-subtle bg-surface-card p-1 shadow-lg z-30">
                  {adminLinks.map(({ to, end, label, icon: Icon }) => (
                    <NavLink key={to} to={to} end={end} onClick={() => setAdminOpen(false)} className={dropLinkCls}>
                      <Icon size={16} className="flex-shrink-0" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="flex items-center gap-3 ms-auto flex-shrink-0">
          <div className="hidden md:block relative" ref={searchRef}>
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={t('nav.searchPlaceholder')}
              aria-haspopup="true"
              aria-expanded={searchOpen}
              className={`h-9 w-9 grid place-items-center rounded-md transition-colors ${
                searchOpen ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <Search size={18} />
            </button>
            {searchOpen && (
              <div className="absolute end-0 top-[calc(100%+8px)] w-72 z-30 rounded-md shadow-lg">
                <SearchForm autoFocus />
              </div>
            )}
          </div>
          <div className="w-px h-7 bg-white/20 hidden sm:block" />
          <LangToggle tone="dark" className="hidden sm:inline-flex" />
          <div className="w-px h-7 bg-white/20 hidden sm:block" />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              className="flex items-center gap-2"
            >
              <span className="h-9 w-9 rounded-full bg-white/10 text-white border border-white/30 grid place-items-center text-[13px] font-bold flex-shrink-0">
                {initials}
              </span>
              {/* Name/role text next to the avatar is deliberately dropped
                  for the same reason as the brand subtitle above -- it's
                  still shown in full inside the dropdown opened by this
                  button, one click away. */}
              <ChevronDown size={14} className={`hidden sm:block text-slate-300 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div className="absolute end-0 top-[calc(100%+8px)] w-56 rounded-lg border border-border-subtle bg-surface-card shadow-lg overflow-hidden z-30">
                <div className="px-4 py-3 border-b border-row-divider">
                  <div className="text-sm font-bold text-text-primary">{user.fullName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{user.roles?.join(', ')}</div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-start text-sm font-semibold text-badge-danger-fg hover:bg-red-50"
                >
                  <LogOut size={15} /> {t('common.signOut')}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={t('common.menu')}
            aria-expanded={mobileOpen}
            className="xl:hidden h-9 w-9 grid place-items-center rounded-md text-slate-200 hover:bg-white/10"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="xl:hidden border-t border-white/10 bg-header px-5 sm:px-8 py-3">
          <SearchForm className="md:hidden mb-3" />
          <nav className="flex flex-col gap-1">
            {allLinks.map(({ to, end, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={linkCls(to)}>
                <Icon size={18} className="flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="sm:hidden mt-3 pt-3 border-t border-white/10">
            <LangToggle tone="dark" />
          </div>
        </div>
      )}
    </header>
  )
}
