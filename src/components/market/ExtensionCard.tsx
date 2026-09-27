import { Link } from 'react-router'
import { pick, useHref, useLocale, useT } from '@/i18n/useLocale'
import { useEffect, useState, type MouseEvent } from 'react'
import { installCommand } from '@/lib/install'
import { CategoryGlyph, CheckIcon, CopyIcon, StackIcon } from './icons'
import { BADGE_LABEL, itemHref, type Item } from './items'
import s from './ExtensionCard.module.css'

export function ItemIcon({ item, className }: { item: Item; className?: string }) {
  return (
    <span className={className ?? s.icon} aria-hidden="true">
      {item.icon ? <img src={item.icon} alt="" /> : <CategoryGlyph id={item.kind === 'bundle' ? 'bundle' : item.category ?? ''} size={18} />}
    </span>
  )
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

/** Quiet text button at the right of the card footer: copies the one-line install command. Never follows the card link. */
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
      {copied ? <CheckIcon size={12} strokeWidth={2.2} /> : <CopyIcon size={12} strokeWidth={1.9} />}
      <span aria-hidden="true">{copied ? t('card.copied') : t('card.install')}</span>
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
  return (
    <article className={s.card} data-card-id={item.id}>
      <div className={s.head}>
        <ItemIcon item={item} />
        <h3 className={s.name} title={title}><Link to={href(itemHref(item))} className={s.link}>{title}</Link></h3>
      </div>
      <p className={s.desc}>{pick(item.summary, locale)}</p>
      <div className={s.foot}>
        {item.kind === 'bundle' ? (
          /* a bundle's "author" is just the repo owner: its footer carries the real signal instead, skill count + badge */
          <span className={s.metaRow}>
            <span className={s.meta} title={t('card.skillsN', { n: item.skillCount ?? 0 })}>
              <StackIcon size={13} /><span>{t('card.skillsN', { n: item.skillCount ?? 0 })}</span>
            </span>
            {badge ? <span className={s.badge}>{badge}</span> : null}
          </span>
        ) : (
          <span className={s.by}>
            {item.author ? t('card.by', { name: `@${item.author}` }) : null}
            {badge ? <span className={s.badge}>{badge}</span> : null}
          </span>
        )}
        <CopyInstall ids={item.skillIds.map((x) => x.split('~')[0])} />
      </div>
    </article>
  )
}
