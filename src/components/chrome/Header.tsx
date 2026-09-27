import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { catalog } from '@/data/catalog'
import { HeadMark } from '@/components/ui/HeadMark'
import { useHref, useT } from '@/i18n/useLocale'
import { ArrowUpRight, CloseIcon, MenuIcon } from '@/components/market/icons'
import { LangRow, LangSwitch } from './LangSwitch'
import s from './Header.module.css'

export function Header() {
  const t = useT()
  const href = useHref()
  const { pathname, search } = useLocation()
  const home = href()
  const tab = pathname === home || pathname === `${home}/` ? new URLSearchParams(search).get('tab') ?? 'all' : null
  /* six items like the ref: three places in the marketplace, the contribution guide, and two ways out */
  const items: { key: string; to: string; label: string; external?: boolean; current?: boolean; wide?: boolean }[] = [
    { key: 'market', to: home, label: t('nav.marketplace'), current: tab === 'all' },
    { key: 'skills', to: `${home}?tab=skills`, label: t('tab.skills'), current: tab === 'skills' },
    { key: 'bundles', to: `${home}?tab=bundles`, label: t('tab.bundles'), current: tab === 'bundles' },
    { key: 'guide', to: href('submit'), label: t('nav.guide'), current: pathname.endsWith('/submit'), wide: true },
    { key: 'github', to: catalog.repo.url, label: t('footer.github'), external: true, wide: true },
    { key: 'headuz', to: 'https://head.uz', label: t('nav.headuz'), external: true },
  ]
  const renderItem = (it: (typeof items)[number], cls: string, arrow: number) =>
    it.external ? (
      <a key={it.key} href={it.to} className={cls} data-wide={it.wide || undefined} target="_blank" rel="noreferrer">{it.label}<ArrowUpRight size={arrow} /></a>
    ) : (
      <Link key={it.key} to={it.to} className={cls} data-wide={it.wide || undefined} aria-current={it.current ? 'page' : undefined}>{it.label}</Link>
    )
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [pathname, search])
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
          {items.map((it) => renderItem(it, s.link, 14))}
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
          {items.map((it) => renderItem(it, s.sheetLink, 16))}
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
