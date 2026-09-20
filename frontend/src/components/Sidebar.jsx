import { NavLink } from 'react-router-dom'
import { LayoutGrid, Mail, CirclePlus, Users, IdCard, ScrollText, BarChart3, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function Sidebar({ collapsed, onToggle }) {
  const { hasPermission } = useAuth()
  const { t } = useLanguage()

  // Gated by the same permission codes the backend enforces (see
  // ProtectedRoute's permissions prop on these routes in App.jsx) --
  // not a hardcoded role name, so this link's visibility can never drift
  // from what the API actually allows.
  const links = [
    { to: '/', end: true, label: t('nav.dashboard'), icon: LayoutGrid },
    { to: '/requests', end: false, label: t('nav.correspondence'), icon: Mail },
    { to: '/requests/new', end: false, label: t('nav.newRequest'), icon: CirclePlus },
    // No permission gate -- CitizenController only requires authentication,
    // same as every other link above this line.
    { to: '/citizens', end: false, label: t('nav.citizens'), icon: IdCard },
    ...(hasPermission('REPORTS_VIEW') ? [{ to: '/reports', end: false, label: t('nav.reports'), icon: BarChart3 }] : []),
    ...(hasPermission('USER_MANAGE') ? [{ to: '/admin/users', end: false, label: t('nav.users'), icon: Users }] : []),
    ...(hasPermission('AUDIT_VIEW') ? [{ to: '/admin/audit', end: false, label: t('nav.auditLog'), icon: ScrollText }] : []),
  ]

  return (
    <aside
      className={`sticky top-0 h-screen flex-shrink-0 border-e border-slate-200 bg-white flex flex-col
        transition-[width] duration-200 ${collapsed ? 'w-[76px]' : 'w-[248px]'}`}
    >
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-100">
        <img
          src="/moi-seal.png"
          alt=""
          className="h-8 w-8 flex-shrink-0 rounded-md bg-white ring-1 ring-slate-200 object-contain p-0.5"
        />
        {!collapsed && (
          <div className="leading-tight overflow-hidden">
            <div className="text-sm font-bold text-slate-900 whitespace-nowrap">{t('nav.brand')}</div>
            <div className="text-[11px] text-slate-400 whitespace-nowrap">{t('nav.brandSub')}</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {links.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `mx-3 my-0.5 flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 border-s-[3px] border-indigo-600 -ms-[3px]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon size={20} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
          className="w-full h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 grid place-items-center"
        >
          {/* These icons depict a layout (panel on the left) so they are
              mirrored in RTL to match the sidebar's actual (end) side. */}
          {collapsed ? (
            <PanelLeftOpen size={18} className="rtl:-scale-x-100" />
          ) : (
            <PanelLeftClose size={18} className="rtl:-scale-x-100" />
          )}
        </button>
      </div>
    </aside>
  )
}
