import { useLanguage } from '../context/LanguageContext.jsx'

// Compact single-row footer: brand mark + system name on one side, quick
// links and the copyright line on the other. It sits at the bottom of the
// flex app-shell naturally (no fixed/absolute positioning), so it never
// overlaps content on a short page and never crowds a long one.
export default function Footer() {
  const { lang, t } = useLanguage()
  const year = new Date().getFullYear()
  const ministryName = lang === 'ar' ? 'وزارة الداخلية والبلديات' : 'Ministry of Interior and Municipalities'

  return (
    <footer className="border-t-[3px] border-amber-500 bg-slate-900 text-slate-300">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex items-center gap-2 flex-wrap">
          <img src="/moi-seal.png" alt="" className="h-5 w-auto bg-white rounded-sm p-0.5" />
          <span className="font-semibold text-slate-100">{ministryName}</span>
          <span className="text-slate-500" aria-hidden="true">•</span>
          <span className="text-slate-400">{t('footer.system')}</span>
        </div>

        <nav className="flex items-center gap-4 flex-wrap" aria-label={t('footer.system')}>
          <a href="/" className="text-slate-300 hover:text-white hover:underline">{t('nav.dashboard')}</a>
          <a href="/requests" className="text-slate-300 hover:text-white hover:underline">{t('nav.correspondence')}</a>
          <span className="text-slate-500">{t('footer.support')}: <bdi>+961 1 000 000</bdi></span>
        </nav>

        <div className="text-slate-500 whitespace-nowrap">© {year} {t('footer.rights')}</div>
      </div>
    </footer>
  )
}
