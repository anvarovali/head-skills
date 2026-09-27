import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { LOCALES, LOCALE_NAMES, switchLocale } from '@/i18n/locales'
import { useLocale, useT } from '@/i18n/useLocale'
import { CheckIcon, GlobeIcon } from '@/components/market/icons'
import s from './LangSwitch.module.css'

/** Globe button + menu of the three locales. Keeps the current path and query. */
export function LangSwitch() {
  const locale = useLocale()
  const t = useT()
  const { pathname, search } = useLocation()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className={s.root} ref={root}>
      <button type="button" className={s.btn} aria-label={t('nav.language')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <GlobeIcon size={20} />
      </button>
      {open ? (
        <div className={s.menu} role="menu">
          {LOCALES.map((l) => (
            <Link key={l} role="menuitemradio" aria-checked={l === locale} lang={l} className={s.item}
              to={switchLocale(pathname, l) + search} onClick={() => setOpen(false)}>
              <span>{LOCALE_NAMES[l]}</span>
              {l === locale ? <CheckIcon size={16} className={s.check} /> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** The same three locales as a flat segmented row (mobile menu, footer). */
export function LangRow({ className }: { className?: string }) {
  const locale = useLocale()
  const { pathname, search } = useLocation()
  return (
    <div className={`${s.row} ${className ?? ''}`}>
      {LOCALES.map((l) => (
        <Link key={l} lang={l} to={switchLocale(pathname, l) + search} className={s.rowItem} aria-current={l === locale ? 'true' : undefined}>
          {LOCALE_NAMES[l]}
        </Link>
      ))}
    </div>
  )
}
