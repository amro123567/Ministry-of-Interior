import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
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

  const navLinkCls = ({ isActive }) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  const SearchForm = ({ className = '', autoFocus = false }) => (
    <form
      onSubmit={handleSearchSubmit}
      role="search"
      className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-400 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400 ${className}`}
    >
      <Search size={16} className="flex-shrink-0" />
      <input
        type="search"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder={t('nav.searchPlaceholder')}
        aria-label={t('nav.searchPlaceholder')}
        autoFocus={autoFocus}
        className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
    </form>
  )

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="h-[64px] max-w-[1400px] mx-auto px-5 sm:px-8 flex items-center gap-4">
        <NavLink to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <img
            src="/moi-seal.png"
            alt=""
            className="h-8 w-8 rounded-md bg-white ring-1 ring-slate-200 object-contain p-0.5"
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
            <NavLink key={to} to={to} end={end} className={navLinkCls}>
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
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Settings size={16} className="flex-shrink-0" />
                {t('nav.admin')}
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
              </button>
              {adminOpen && (
                <div className="absolute start-0 top-[calc(100%+8px)] w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg z-30">
                  {adminLinks.map(({ to, end, label, icon: Icon }) => (
                    <NavLink key={to} to={to} end={end} onClick={() => setAdminOpen(false)} className={navLinkCls}>
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
              className={`h-9 w-9 grid place-items-center rounded-lg transition-colors ${
                searchOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Search size={18} />
            </button>
            {searchOpen && (
              <div className="absolute end-0 top-[calc(100%+8px)] w-72 z-30">
                <SearchForm className="flex w-full shadow-lg" autoFocus />
              </div>
            )}
          </div>
          <div className="w-px h-7 bg-slate-200 hidden sm:block" />
          <LangToggle className="hidden sm:inline-flex" />
          <div className="w-px h-7 bg-slate-200 hidden sm:block" />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              className="flex items-center gap-2"
            >
              <span className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 grid place-items-center text-[13px] font-bold flex-shrink-0">
                {initials}
              </span>
              {/* Name/role text next to the avatar is deliberately dropped
                  for the same reason as the brand subtitle above -- it's
                  still shown in full inside the dropdown opened by this
                  button, one click away. */}
              <ChevronDown size={14} className={`hidden sm:block text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div className="absolute end-0 top-[calc(100%+8px)] w-56 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-30">
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="text-sm font-bold text-slate-900">{user.fullName}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{user.roles?.join(', ')}</div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-start text-sm font-semibold text-red-600 hover:bg-red-50"
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
            className="xl:hidden h-9 w-9 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="xl:hidden border-t border-slate-200 bg-white px-5 sm:px-8 py-3">
          <SearchForm className="md:hidden mb-3" />
          <nav className="flex flex-col gap-1">
            {allLinks.map(({ to, end, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={navLinkCls}>
                <Icon size={18} className="flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="sm:hidden mt-3 pt-3 border-t border-slate-100">
            <LangToggle />
          </div>
        </div>
      )}
    </header>
  )
}
