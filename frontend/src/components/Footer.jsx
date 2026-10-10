import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext.jsx'

// Three-column footer on near-black slate (slate-950) with a hairline top border.
//   left   : ministry identity + system name
//   centre : quick links (flex gap, no wrapping mid-link)
//   right  : support line with phone icon, then the copyright, separated by a rule
// Stacks and centres below md. All text is slate-400 or lighter on slate-950,
// which is about 7.6:1 for the muted text and higher for the brighter lines (AAA).
const SUPPORT_PHONE = '+961 1 000 000'

export default function Footer() {
  const { lang, t } = useLanguage()
  const year = new Date().getFullYear()
  const ministryName = lang === 'ar' ? 'وزارة الداخلية والبلديات' : 'Ministry of Interior and Municipalities'
  const link = 'rounded-sm text-xs font-medium text-slate-400 transition-colors hover:text-slate-100'

  return (
    <footer className="border-t border-slate-800 bg-slate-950 font-sans antialiased">
      <div className="mx-auto grid min-h-[80px] max-w-[1400px] grid-cols-1 items-center gap-6 px-6 py-6 text-center sm:px-8 md:grid-cols-[1fr_auto_1fr] md:gap-8 md:text-start">
        {/* Left: branding */}
        <div className="flex flex-col items-center gap-3 md:flex-row md:items-center">
          <span className="grid shrink-0 place-items-center rounded-lg border border-white/10 bg-white/10 p-1.5">
            <img src="/moi-seal.png" alt="" className="h-6 w-6 rounded-md bg-white object-contain p-0.5" />
          </span>
          <p className="text-xs leading-relaxed text-slate-400">
            <span className="block font-semibold text-slate-200">{ministryName}</span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="hidden text-slate-600 md:inline">•</span>
              {t('footer.system')}
            </span>
          </p>
        </div>

        {/* Centre: quick navigation */}
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label={t('footer.system')}>
          <Link to="/" className={link}>{t('nav.dashboard')}</Link>
          <Link to="/requests" className={link}>{t('nav.correspondence')}</Link>
          <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className={link}>{t('footer.helpDesk')}</a>
        </nav>

        {/* Right: support + copyright */}
        <div className="flex flex-col items-center gap-2 md:items-end">
          <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 transition-colors hover:text-white">
            <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>{t('footer.support')}: <bdi dir="ltr">{SUPPORT_PHONE}</bdi></span>
          </a>
          <div className="h-px w-full max-w-[220px] bg-slate-800" aria-hidden="true" />
          <p className="text-xs text-slate-400">© {year} {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  )
}
