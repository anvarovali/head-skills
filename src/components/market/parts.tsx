import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useHref, useT } from '@/i18n/useLocale'
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, SearchIcon } from './icons'
import { ExtensionCard } from './ExtensionCard'
import type { Item } from './items'
import s from './parts.module.css'

export function Grid({ items, wide = true }: { items: Item[]; wide?: boolean }) {
  return (
    <div className={wide ? s.grid : `${s.grid} ${s.gridNarrow}`} data-grid>
      {items.map((it) => <ExtensionCard key={it.id} item={it} />)}
    </div>
  )
}

export function SectionHead({ title, count, more }: { title: string; count?: number; more?: { to: string; label: string } }) {
  return (
    <div className={s.sectionHead}>
      <h2 className={s.sectionTitle}>{title}</h2>
      {count !== undefined ? <span className={s.count}>{count.toLocaleString('en-US')}</span> : null}
      {more ? <Link to={more.to} className={s.more}>{more.label}<ChevronRight size={14} /></Link> : null}
      <span className={s.spacer} />
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string
}) {
  return (
    <div className={s.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={s.segment}
          data-on={o.value === value || undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Pills<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string
}) {
  return (
    <div className={s.pills} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={s.pill}
          data-on={o.value === value || undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Facet({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  const [open, setOpen] = useState(true)
  return (
    <div className={s.facet} role="group" aria-labelledby={id}>
      <button type="button" id={id} className={s.facetTitle} aria-expanded={open} aria-controls={`${id}-list`} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span><ChevronDown size={16} className={s.facetChevron} />
      </button>
      <div id={`${id}-list`} className={s.facetList} hidden={!open}>{children}</div>
    </div>
  )
}

export function Check({ label, count, checked, onChange }: { label: string; count: number; checked: boolean; onChange: () => void }) {
  return (
    <label className={s.check} data-empty={count === 0 || undefined}>
      <input type="checkbox" checked={checked} onChange={onChange} className={s.checkInput} />
      <span className={s.box} aria-hidden="true" />
      <span className={s.checkLabel}>{label}</span>
      <span className={s.checkCount}>{count}</span>
    </label>
  )
}

export function Empty({ onReset }: { onReset?: () => void }) {
  const t = useT()
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon}><SearchIcon size={22} /></span>
      <p className={s.emptyTitle}>{t('empty.title')}</p>
      <p className={s.emptySub}>{t('empty.sub')}</p>
      {onReset ? <button type="button" className={s.emptyBtn} onClick={onReset}>{t('filter.reset')}</button> : null}
    </div>
  )
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <nav className={s.pager} aria-label="Pagination">
      <button type="button" className={s.pageBtn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous"><ChevronLeft size={14} /></button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button key={p} type="button" className={s.pageBtn} data-on={p === page || undefined} aria-current={p === page ? 'page' : undefined}
          onClick={() => onPage(p)}>{p}</button>
      ))}
      <button type="button" className={s.pageBtn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next"><ChevronRight size={14} /></button>
    </nav>
  )
}

export function CtaBand() {
  const t = useT()
  const href = useHref()
  return (
    <section className={s.cta}>
      <h2 className={s.ctaTitle}>{t('cta.title')}</h2>
      <p className={s.ctaSub}>{t('cta.sub')}</p>
      <Link to={href('submit')} className={s.ctaBtn}>{t('nav.submit')}<ArrowRight size={14} /></Link>
    </section>
  )
}

export function SideCta() {
  const t = useT()
  const href = useHref()
  return (
    <div className={s.sideCta}>
      <p className={s.sideCtaTitle}>{t('side.ctaTitle')}</p>
      <p className={s.sideCtaText}>{t('side.ctaText')}</p>
      <Link to={href('submit')} className={s.sideCtaLink}>{t('nav.submit')}<ArrowRight size={13} /></Link>
    </div>
  )
}
