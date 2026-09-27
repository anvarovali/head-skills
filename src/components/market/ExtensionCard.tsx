import { Link } from 'react-router'
import { pick, useHref, useLocale, useT } from '@/i18n/useLocale'
import { useEffect, useState, type MouseEvent } from 'react'
import { installCommand } from '@/lib/install'
import { CategoryGlyph, CheckIcon, ClockIcon, CopyIcon, StackIcon } from './icons'
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

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fall through */ }
  const ta = document.createElement('textarea')
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
  document.body.appendChild(ta); ta.select()
  const ok = document.execCommand('copy')
  ta.remove()
  return ok
}

/** 24px ghost button in the card's top-right: copies the one-line install command. Never follows the card link. */
function CopyInstall({ ids }: { ids: string[] }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(id)
  }, [copied])
  const onClick = async (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (await copyText(installCommand(ids))) setCopied(true)
  }
  const label = copied ? t('card.copied') : t('card.copy')
  return (
    <button type="button" className={s.copy} onClick={onClick} aria-label={label} title={label} data-copied={copied || undefined}>
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      <span className="sr-only" aria-live="polite">{copied ? t('card.copied') : ''}</span>
    </button>
  )
}

/** A marketplace card. The title link stretches over the whole card (so the copy button can sit inside without nesting
    interactive elements); hover only tints the ground. `data-card-id` is the intro's hook. */
export function ExtensionCard({ item }: { item: Item }) {
  const locale = useLocale()
  const t = useT()
  const href = useHref()
  const title = pick(item.title, locale) ?? item.id
  const badge = item.badges.map((b) => BADGE_LABEL[b]).find(Boolean)
  const date = item.updated ? shortDate(item.updated, locale) : undefined
  return (
    <article className={s.card} data-card-id={item.id}>
      <div className={s.head}>
        <ItemIcon item={item} />
        <h3 className={s.name} title={title}><Link to={href(itemHref(item))} className={s.link}>{title}</Link></h3>
        {badge ? <span className={s.badge}>{badge}</span> : null}
        <CopyInstall ids={item.skillIds.map((x) => x.split('~')[0])} />
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
    </article>
  )
}
