import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import clsx from 'clsx'
import { useHref, useT } from '@/i18n/useLocale'
import { useCopy } from './useCopy'
import type { ChromeKey } from '@/content/chrome'
import { CheckIcon, CopyIcon, DownloadIcon, LinkIcon, PlayIcon, ShareIcon } from './icons'
import { NotFoundView } from '@/routes/NotFound'
import { CategoryGlyph } from '@/components/market/icons'
import s from './Detail.module.css'

/** Square icon, the same mark the marketplace card shows: the skill's own image, else its category glyph
    (a bundle gets the bundle glyph). Decorative: the title sits right next to it. */
export function Glyph({ icon, category, bundle, className }: { icon?: string; category?: string; bundle?: boolean; className?: string }) {
  return (
    <span className={clsx(s.glyph, className)} aria-hidden>
      {icon ? <img src={icon} alt="" /> : <CategoryGlyph id={bundle ? 'bundle' : category ?? ''} size={30} />}
    </span>
  )
}

export function Badges({ ids, extra }: { ids: string[]; extra?: ReactNode }) {
  const t = useT()
  if (!ids.length && !extra) return null
  return (
    <span className={s.badges}>
      {extra}
      {ids.map((b) => {
        const key = `badge.${b}` as ChromeKey
        const label = (t(key) as string | undefined) ?? b
        return <span key={b} className={s.badge}>{label}</span>
      })}
    </span>
  )
}

export function Crumbs({ current, actions }: { current: string; actions?: ReactNode }) {
  const t = useT()
  const href = useHref()
  return (
    <div className={s.crumbBar}>
      <nav className={s.crumbs} aria-label="Breadcrumb">
        <Link to={href('')}>{t('crumb.market')}</Link>
        <span className={s.crumbSep} aria-hidden>/</span>
        <span className={s.crumbNow} aria-current="page">{current}</span>
      </nav>
      {actions && <div className={s.actions}>{actions}</div>}
    </div>
  )
}

/** Icon-only copy button with a blue "copied" state; the label is announced, the state is announced politely. */
export function CopyIconButton({ text, label }: { text: string; label: string }) {
  const t = useT()
  const { copied, copy } = useCopy()
  return (
    <button type="button" className={s.iconBtn} data-done={copied || undefined} onClick={() => copy(text)}
      aria-label={copied ? t('copy.copied') : label} title={copied ? t('copy.copied') : label}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span className="sr-only" aria-live="polite">{copied ? t('copy.copied') : ''}</span>
    </button>
  )
}

export function Command({ text, label }: { text: string; label?: string }) {
  const t = useT()
  return (
    <div className={s.cmd}>
      <code>{text}</code>
      <CopyIconButton text={text} label={label ?? t('copy.command')} />
    </div>
  )
}

/** Share (native sheet where available, else copies) + Copy link, as quiet icon buttons with tooltips. */
export function ShareActions({ title }: { title: string }) {
  const t = useT()
  const link = useCopy()
  const share = useCopy()
  const url = () => window.location.href.replace(/#.*$/, '').replace(/[?&](intro|yt)=[^&]*/g, '').replace(/\?$/, '')
  const onShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, url: url() }) } catch { /* sheet dismissed */ }
      return
    }
    share.copy(url())
  }
  const shareLabel = share.copied ? t('act.linkCopied') : t('act.share')
  const linkLabel = link.copied ? t('act.linkCopied') : t('act.copyLink')
  return (
    <>
      <button type="button" className={s.action} onClick={onShare} data-done={share.copied || undefined} aria-label={shareLabel} data-tip={shareLabel}>
        {share.copied ? <CheckIcon /> : <ShareIcon />}
      </button>
      <button type="button" className={`${s.action} ${s.actionLink}`} onClick={() => link.copy(url())} data-done={link.copied || undefined} aria-label={linkLabel} data-tip={linkLabel}>
        {link.copied ? <CheckIcon /> : <LinkIcon />}
      </button>
    </>
  )
}

export function DownloadAction({ href }: { href: string }) {
  const t = useT()
  return <a className={s.action} href={href} download aria-label={t('dl.zip')} data-tip={t('dl.zip')}><DownloadIcon /></a>
}

/** Lite YouTube: a poster and a play button; the (nocookie) iframe only loads on click. */
export function YouTubeLite({ id, title }: { id: string; title: string }) {
  const t = useT()
  const [on, setOn] = useState(false)
  const safe = id.replace(/[^\w-]/g, '')
  if (!safe) return null
  return (
    <div className={s.video}>
      {on ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${safe}?autoplay=1&rel=0`} title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      ) : (
        <button type="button" className={s.videoBtn} onClick={() => setOn(true)} aria-label={t('video.play', { title })}>
          <img src={`https://i.ytimg.com/vi/${safe}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className={s.videoPlay}><PlayIcon size={26} /></span>
        </button>
      )}
    </div>
  )
}

/** The explainer id for this page: the data's, or (dev only) a ?yt=<id> / #yt:<id> override for screenshots. */
export function youtubeId(rec: Partial<Record<string, string>> | undefined, locale: string, search: URLSearchParams, hash = ''): string | undefined {
  if (import.meta.env.DEV) {
    const o = search.get('yt') ?? hash.match(/yt:([\w-]+)/)?.[1]
    if (o) return o
  }
  return rec?.[locale] || undefined
}

/** An unknown skill/bundle id: the site's one 404 look, with the detail wording. */
export function NotFoundBlock({ title }: { title: string }) {
  const t = useT()
  return <NotFoundView title={title} sub={t('nf.sub')} />
}
