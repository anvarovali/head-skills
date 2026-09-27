import { Link } from 'react-router'
import { pick, useHref, useLocale, useT } from '@/i18n/useLocale'
import { CategoryGlyph, ClockIcon, StackIcon } from './icons'
import { BADGE_LABEL, itemHref, type Item } from './items'
import s from './ExtensionCard.module.css'

export function ItemIcon({ item, className }: { item: Item; className?: string }) {
  return (
    <span className={className ?? s.icon} aria-hidden="true">
      {item.icon ? <img src={item.icon} alt="" /> : <CategoryGlyph id={item.kind === 'bundle' ? 'bundle' : item.category ?? ''} size={18} />}
    </span>
  )
}

/* Short dates by hand: Chromium ships no Uzbek month names (Intl gives "M09 27"), and one table keeps all three alike. */
const MONTHS: Record<string, string[]> = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
function shortDate(iso: string, locale: string) {
  const d = new Date(iso)
  const m = (MONTHS[locale] ?? MONTHS.en)[d.getMonth()]
  const short = locale === 'uz' ? `${d.getDate()}-${m}` : `${d.getDate()} ${m}`
  return { short, long: `${short} ${d.getFullYear()}` }
}

/** A marketplace card. The whole card is the link; hover only tints the ground. `data-card-id` is the intro's hook. */
export function ExtensionCard({ item }: { item: Item }) {
  const locale = useLocale()
  const t = useT()
  const href = useHref()
  const title = pick(item.title, locale) ?? item.id
  const badge = item.badges.map((b) => BADGE_LABEL[b]).find(Boolean)
  const date = item.updated ? shortDate(item.updated, locale) : undefined
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
        {item.kind === 'bundle' ? (
          <span className={s.meta} title={t('card.skillsN', { n: item.skillCount ?? 0 })}>
            <StackIcon size={13} /><span>{item.skillCount ?? 0}</span>
            <span className="sr-only">{t('card.skillsN', { n: item.skillCount ?? 0 })}</span>
          </span>
        ) : date ? (
          <span className={s.meta} title={t('card.updated', { date: date.long })}>
            <ClockIcon size={13} /><time dateTime={item.updated}>{date.short}</time>
          </span>
        ) : null}
      </div>
    </Link>
  )
}
