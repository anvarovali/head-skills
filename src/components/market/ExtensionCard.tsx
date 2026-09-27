import { Link } from 'react-router'
import { categoryTitle } from '@/data/catalog'
import { pick, useHref, useLocale, useT } from '@/i18n/useLocale'
import { CategoryGlyph } from './icons'
import { BADGE_LABEL, itemHref, type Item } from './items'
import s from './ExtensionCard.module.css'

export function ItemIcon({ item, className }: { item: Item; className?: string }) {
  return (
    <span className={className ?? s.icon} aria-hidden="true">
      {item.icon ? <img src={item.icon} alt="" /> : <CategoryGlyph id={item.kind === 'bundle' ? 'bundle' : item.category ?? ''} size={18} />}
    </span>
  )
}

/** A marketplace card. The whole card is the link; hover only tints the ground. `data-card-id` is the intro's hook. */
export function ExtensionCard({ item }: { item: Item }) {
  const locale = useLocale()
  const t = useT()
  const href = useHref()
  const title = pick(item.title, locale) ?? item.id
  const badge = item.badges.map((b) => BADGE_LABEL[b]).find(Boolean)
  const meta = item.kind === 'bundle'
    ? t('card.skillsN', { n: item.skillCount ?? 0 })
    : item.category ? pick(categoryTitle(item.category), locale) : undefined
  return (
    <Link to={href(itemHref(item))} className={s.card} data-card-id={item.id}>
      <div className={s.head}>
        <ItemIcon item={item} />
        <h3 className={s.name} title={title}>{title}</h3>
        {badge ? <span className={s.badge}>{badge}</span> : null}
      </div>
      <p className={s.desc}>{pick(item.summary, locale)}</p>
      <div className={s.foot}>
        <span className={s.by}>{item.author ? t('card.by', { name: `@${item.author}` }) : null}</span>
        {meta ? <span className={s.meta}>{meta}</span> : null}
      </div>
    </Link>
  )
}
