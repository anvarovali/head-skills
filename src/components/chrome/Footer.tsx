import { Link, useLocation } from 'react-router'
import { catalog } from '@/data/catalog'
import { HeadMark } from '@/components/ui/HeadMark'
import { LOCALES, LOCALE_NAMES, switchLocale } from '@/i18n/locales'
import { useHref, useLocale, useT } from '@/i18n/useLocale'
import { ArrowUp, ArrowUpRight } from '@/components/market/icons'
import { replayIntro } from '@/components/intro/replay'
import s from './Footer.module.css'

/** qoder footer: bg-layout, mark + two-line tagline left, link columns right, a small legal row with Back to top. */
export function Footer() {
  const t = useT()
  const href = useHref()
  const locale = useLocale()
  const { pathname, search } = useLocation()
  const headuz = (slug = '') => `https://head.uz${locale === 'uz' ? '' : `/${locale}`}${slug}`

  return (
    <footer className={s.footer}>
      <div className={s.inner}>
        <div className={s.lead}>
          <HeadMark className={s.mark} slashClassName={s.slash} title="HEAD" />
          <p className={s.tagline}>{t('footer.tagline')}</p>
        </div>
        <div className={s.cols}>
          <div className={s.col}>
            <p className={s.colTitle}>{t('footer.colMarket')}</p>
            <Link to={`${href()}?tab=skills`} className={s.link}>{t('tab.skills')}</Link>
            <Link to={`${href()}?tab=bundles`} className={s.link}>{t('tab.bundles')}</Link>
            <Link to={href('submit')} className={s.link}>{t('nav.submit')}</Link>
            <button type="button" onClick={replayIntro} className={s.link}>{t('footer.replay')}</button>
          </div>
          <div className={s.col}>
            <p className={s.colTitle}>{t('footer.colHead')}</p>
            <a href={headuz()} className={s.link}>head.uz</a>
            <a href={headuz('/consulting')} className={s.link}>{t('footer.consulting')}</a>
            <a href={headuz('/team')} className={s.link}>{t('footer.team')}</a>
            <a href={catalog.repo.url} className={s.link} target="_blank" rel="noreferrer">{t('footer.github')}<ArrowUpRight size={12} /></a>
          </div>
          <div className={s.col}>
            <p className={s.colTitle}>{t('footer.colLang')}</p>
            {LOCALES.map((l) => (
              <Link key={l} lang={l} to={switchLocale(pathname, l) + search} className={s.link} aria-current={l === locale ? 'true' : undefined}>
                {LOCALE_NAMES[l]}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className={s.legal}>
        <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
        <button type="button" className={s.top} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          {t('footer.top')}<ArrowUp size={12} />
        </button>
      </div>
    </footer>
  )
}
