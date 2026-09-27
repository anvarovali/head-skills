import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { HeadMark } from '@/components/ui/HeadMark'
import { useHref, useT } from '@/i18n/useLocale'
import { ArrowUpRight, CloseIcon, MenuIcon } from '@/components/market/icons'
import { LangRow, LangSwitch } from './LangSwitch'
import s from './Header.module.css'

export function Header() {
  const t = useT()
  const href = useHref()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className={s.header} data-open={open || undefined}>
      <div className={s.bar}>
        <Link to={href()} className={s.brand} aria-label={t('site.name')}>
          <HeadMark className={s.mark} slashClassName={s.slash} />
          <span className={s.word}>skills</span>
        </Link>
        <nav className={s.nav} aria-label="Primary">
          <NavLink to={href()} end className={s.link}>{t('nav.marketplace')}</NavLink>
          <a href="https://head.uz" className={s.link} target="_blank" rel="noreferrer">{t('nav.headuz')}<ArrowUpRight size={14} /></a>
        </nav>
        <div className={s.right}>
          <LangSwitch />
          <Link to={href('submit')} className={s.cta}>{t('nav.submit')}</Link>
          <button type="button" className={s.burger} aria-label={t('nav.menu')} aria-expanded={open} aria-controls="m-menu"
            onClick={() => setOpen((o) => !o)}>
            {open ? <CloseIcon size={24} /> : <MenuIcon size={24} />}
          </button>
        </div>
      </div>
      <div id="m-menu" className={s.sheet} hidden={!open}>
        <nav className={s.sheetNav} aria-label="Mobile">
          <NavLink to={href()} end className={s.sheetLink}>{t('nav.marketplace')}</NavLink>
          <NavLink to={href('submit')} className={s.sheetLink}>{t('nav.submit')}</NavLink>
          <a href="https://head.uz" className={s.sheetLink} target="_blank" rel="noreferrer">{t('nav.headuz')}<ArrowUpRight size={16} /></a>
        </nav>
        <div className={s.sheetLang}>
          <span className={s.sheetLabel}>{t('nav.language')}</span>
          <LangRow />
        </div>
        <Link to={href('submit')} className={s.sheetCta}>{t('nav.submit')}</Link>
      </div>
    </header>
  )
}
