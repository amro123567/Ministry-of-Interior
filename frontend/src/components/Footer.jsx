import { Link } from 'react-router-dom'
import {
  BookOpen, CalendarClock, FileText, Headset, LayoutGrid, LifeBuoy, Mail, MessageSquareWarning,
  Phone, ShieldCheck, Ticket, Users, Workflow, BarChart3,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import LangToggle from './LangToggle.jsx'

// Four-column footer: the footer band itself has rounded top corners (no nested card).
//   1 brand & identity   2 core modules   3 support & docs   4 contact widget
// followed by a sub-panel with the copyright and rounded chip links.
//
// Edit these constants to change what the footer points at. Links whose URL is '#'
// have no destination yet (the repo has no manual / ticketing / policy pages), so they
// stay inert instead of navigating anywhere.
const SUPPORT_PHONE = '+961 1 000 000'
const URLS = {
  manual: '#', ticketing: '#', sla: '#', feedback: '#', ticket: '#',
  privacy: '#', terms: '#', security: '#',
}

const linkCls = 'group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition-all hover:bg-slate-800/80 hover:text-white'
const chipCls = 'rounded-full bg-slate-800/40 px-3 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white'

function ColumnTitle({ icon: Icon, children }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
      <Icon className="h-4 w-4 text-blue-400" aria-hidden="true" />
      {children}
    </h2>
  )
}

// A link that is inert until a real URL is configured above.
function ResourceLink({ href, icon: Icon, children, className = linkCls }) {
  const inert = href === '#'
  return (
    <a href={href} className={className} onClick={inert ? (e) => e.preventDefault() : undefined}>
      {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-blue-400" aria-hidden="true" />}
      {children}
    </a>
  )
}

export default function Footer() {
  const { lang, t } = useLanguage()
  const { hasPermission } = useAuth()
  const year = new Date().getFullYear()
  const ministryName = lang === 'ar' ? 'وزارة الداخلية والبلديات' : 'Ministry of Interior and Municipalities'
  const tel = `tel:${SUPPORT_PHONE.replace(/\s/g, '')}`

  return (
    <footer className="rounded-t-[2rem] border-t border-white/10 bg-[#1E2D50] font-sans antialiased shadow-[0_-10px_40px_rgba(15,23,42,0.18)] sm:rounded-t-[2.5rem]">
      <div className="mx-auto max-w-[1800px] px-6 pb-8 pt-10 sm:px-8 lg:px-10 lg:pt-12 2xl:px-14">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr] lg:gap-10">
          {/* 1 - Brand & identity */}
          <div>
            <div className="mb-4 inline-grid place-items-center rounded-xl border border-slate-700 bg-slate-800/60 p-3">
              <img src="/cts-logo.png" alt="" className="h-16 w-auto object-contain" />
            </div>
            <p className="text-base font-bold leading-snug text-white">{ministryName}</p>
            <p className="mt-1 text-sm text-slate-400">{t('footer.system')} (CTS)</p>
          </div>

          {/* 2 - Core modules */}
          <nav aria-label={t('footer.modulesNav')}>
            <ColumnTitle icon={LayoutGrid}>{t('footer.modules')}</ColumnTitle>
            <ul className="space-y-0.5">
              <li><Link to="/" className={linkCls}><LayoutGrid className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-blue-400" aria-hidden="true" />{t('nav.dashboard')}</Link></li>
              <li><Link to="/requests" className={linkCls}><Mail className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-blue-400" aria-hidden="true" />{t('footer.correspondenceRegistry')}</Link></li>
              <li><Link to="/citizens" className={linkCls}><Users className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-blue-400" aria-hidden="true" />{t('nav.citizens')}</Link></li>
              <li><Link to="/workflow" className={linkCls}><Workflow className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-blue-400" aria-hidden="true" />{t('footer.workflowManagement')}</Link></li>
              {hasPermission('REPORTS_VIEW') && (
                <li><Link to="/reports" className={linkCls}><BarChart3 className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-blue-400" aria-hidden="true" />{t('footer.systemReports')}</Link></li>
              )}
            </ul>
          </nav>

          {/* 3 - Support & docs */}
          <nav aria-label={t('footer.resources')}>
            <ColumnTitle icon={LifeBuoy}>{t('footer.supportDocs')}</ColumnTitle>
            <ul className="space-y-0.5">
              <li><ResourceLink href={URLS.manual} icon={BookOpen}>{t('footer.userManual')}</ResourceLink></li>
              <li><ResourceLink href={tel} icon={Headset}>{t('footer.helpDesk')}</ResourceLink></li>
              <li><ResourceLink href={URLS.ticketing} icon={Ticket}>{t('footer.ticketing')}</ResourceLink></li>
              <li><ResourceLink href={URLS.sla} icon={FileText}>{t('footer.slaGuidelines')}</ResourceLink></li>
              <li><ResourceLink href={URLS.feedback} icon={MessageSquareWarning}>{t('footer.feedback')}</ResourceLink></li>
            </ul>
          </nav>

          {/* 4 - Contact widget */}
          <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-slate-800/80 to-blue-950/40 p-4">
            <ColumnTitle icon={Phone}>{t('footer.contact')}</ColumnTitle>
            <a href={tel} className="flex items-center gap-3 rounded-lg transition-colors hover:text-white">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-500/15 text-blue-300">
                <Phone className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xs text-slate-400">{t('footer.hotline')}</span>
                <bdi dir="ltr" className="block text-base font-bold text-white">{SUPPORT_PHONE}</bdi>
              </span>
            </a>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-500/15 text-blue-300">
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xs text-slate-400">{t('footer.hours')}</span>
                <span className="block text-sm font-medium text-slate-200">{t('footer.hoursValue')}</span>
              </span>
            </div>
            <ResourceLink
              href={URLS.ticket}
              icon={Ticket}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-500"
            >
              {t('footer.submitTicket')}
            </ResourceLink>
          </div>
        </div>

        {/* Sub-footer panel */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10/80 pt-6 text-center lg:flex-row lg:text-start">
          <p className="text-xs text-slate-400">© {year} {ministryName}. {t('footer.rights')}</p>
          <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label={t('footer.legal')}>
            <ResourceLink href={URLS.privacy} className={chipCls}>{t('footer.privacy')}</ResourceLink>
            <ResourceLink href={URLS.terms} className={chipCls}>{t('footer.terms')}</ResourceLink>
            <ResourceLink href={URLS.security} icon={ShieldCheck} className={`${chipCls} inline-flex items-center gap-1.5`}>{t('footer.security')}</ResourceLink>
            <LangToggle tone="dark" />
          </div>
        </div>
      </div>
    </footer>
  )
}
