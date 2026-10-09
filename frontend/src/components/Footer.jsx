import { useLanguage } from '../context/LanguageContext.jsx'

// Compact single-row footer on the dark footer token (#0B132B) with a 2px
// primary-indigo top border. Text sits on slate-200 / slate-300 only: both
// clear WCAG AAA (>= 7:1) against #0B132B (about 14:1 and 12:1); the old
// slate-500 copy was ~3.9:1 and failed even AA.
export default function Footer() {
  const { lang, t } = useLanguage()
  const year = new Date().getFullYear()
  const ministryName = lang === 'ar' ? 'وزارة الداخلية والبلديات' : 'Ministry of Interior and Municipalities'

  return (
    <footer className="border-t-2 border-primary bg-footer text-slate-300">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex items-center gap-2 flex-wrap">
          <img src="/moi-seal.png" alt="" className="h-5 w-auto bg-white rounded-sm p-0.5" />
          <span className="font-semibold text-slate-100">{ministryName}</span>
          <span className="text-slate-300" aria-hidden="true">•</span>
          <span className="text-slate-300">{t('footer.system')}</span>
        </div>

        <nav className="flex items-center gap-4 flex-wrap" aria-label={t('footer.system')}>
          <a href="/" className="rounded-sm text-slate-200 underline-offset-4 hover:text-white hover:underline">{t('nav.dashboard')}</a>
          <a href="/requests" className="rounded-sm text-slate-200 underline-offset-4 hover:text-white hover:underline">{t('nav.correspondence')}</a>
          <span className="text-slate-300">{t('footer.support')}: <bdi>+961 1 000 000</bdi></span>
        </nav>

        <div className="text-slate-300 whitespace-nowrap">© {year} {t('footer.rights')}</div>
      </div>
    </footer>
  )
}
