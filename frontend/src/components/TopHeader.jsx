import { Search, ChevronDown, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import LangToggle from './LangToggle.jsx'

export default function TopHeader() {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    function onEscape(e) {
      if (e.key === 'Escape') setMenuOpen(false)
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
  }

  const initials = (user.fullName || user.username || '?')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-10 h-[68px] flex-shrink-0 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 sm:px-8">
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        className="hidden md:flex items-center gap-2 w-72 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-400 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400"
      >
        <Search size={16} className="flex-shrink-0" />
        <input
          type="search"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={t('nav.searchPlaceholder')}
          aria-label={t('nav.searchPlaceholder')}
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </form>

      <div className="flex items-center gap-4 ms-auto">
        <LangToggle className="header-lang-toggle" />
        <div className="w-px h-7 bg-slate-200 hidden sm:block" />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            className="flex items-center gap-2.5"
          >
            <span className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 grid place-items-center text-[13px] font-bold flex-shrink-0">
              {initials}
            </span>
            <span className="text-start leading-tight hidden sm:block">
              <span className="block text-sm font-bold text-slate-900 max-w-[140px] truncate">{user.fullName}</span>
              <span className="block text-[11px] text-slate-400">{user.roles?.[0]}</span>
            </span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
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
      </div>
    </header>
  )
}
