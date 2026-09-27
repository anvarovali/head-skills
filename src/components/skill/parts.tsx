import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import clsx from 'clsx'
import { useHref } from '@/i18n/useLocale'
import { useCopy } from './useCopy'
import { useDT, type DetailKey } from './strings'
import { CheckIcon, CopyIcon, LinkIcon, PlayIcon, ShareIcon } from './icons'
import s from './Detail.module.css'

/** Square icon: the skill's own image when it has one, else its initials on ink (bundles on blue). */
export function Glyph({ title, icon, bundle, className }: { title: string; icon?: string; bundle?: boolean; className?: string }) {
  if (icon) return <span className={clsx(s.glyph, s.glyphImg, className)}><img src={icon} alt="" /></span>
  const words = title.replace(/[^\p{L}\p{N}\s-]/gu, '').split(/[\s-]+/).filter(Boolean)
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase()
  return <span className={clsx(s.glyph, bundle && s.glyphBundle, className)} aria-hidden>{initials}</span>
}

export function Badges({ ids, extra }: { ids: string[]; extra?: ReactNode }) {
  const t = useDT()
  if (!ids.length && !extra) return null
  return (
    <span className={s.badges}>
      {extra}
      {ids.map((b) => {
        const key = `badge.${b}` as DetailKey
        const label = (t(key) as string | undefined) ?? b
        return <span key={b} className={s.badge}>{label}</span>
      })}
    </span>
  )
}

export function Crumbs({ current }: { current: string }) {
  const t = useDT()
  const href = useHref()
  return (
    <nav className={s.crumbs} aria-label="Breadcrumb">
      <Link to={href('')}>{t('crumb.market')}</Link>
      <span className={s.crumbSep} aria-hidden>/</span>
      <span className={s.crumbNow} aria-current="page">{current}</span>
    </nav>
  )
}

/** Icon-only copy button with a blue "copied" state; the label is announced, the state is announced politely. */
export function CopyIconButton({ text, label }: { text: string; label: string }) {
  const t = useDT()
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
  const t = useDT()
  return (
    <div className={s.cmd}>
      <code>{text}</code>
      <CopyIconButton text={text} label={label ?? t('copy.command')} />
    </div>
  )
}

/** Share (native sheet where available, else copies) + Copy link. */
export function ShareActions({ title, className }: { title: string; className?: string }) {
  const t = useDT()
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
  return (
    <>
      <button type="button" className={clsx(s.action, s.actionIcon, className)} onClick={onShare} data-done={share.copied || undefined}
        aria-label={share.copied ? t('act.linkCopied') : t('act.share')}>
        {share.copied ? <CheckIcon /> : <ShareIcon />}<span className={s.actionLabel}>{share.copied ? t('act.linkCopied') : t('act.share')}</span>
      </button>
      <button type="button" className={clsx(s.action, s.actionIcon, className)} onClick={() => link.copy(url())} data-done={link.copied || undefined}
        aria-label={link.copied ? t('act.linkCopied') : t('act.copyLink')}>
        {link.copied ? <CheckIcon /> : <LinkIcon />}<span className={s.actionLabel}>{link.copied ? t('act.linkCopied') : t('act.copyLink')}</span>
      </button>
    </>
  )
}

/** Lite YouTube: a poster and a play button; the (nocookie) iframe only loads on click. */
export function YouTubeLite({ id, title }: { id: string; title: string }) {
  const t = useDT()
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

export function NotFoundBlock({ title }: { title: string }) {
  const t = useDT()
  const href = useHref()
  return (
    <div className={s.page}>
      <div className={s.empty}>
        <h1>{title}</h1>
        <p>{t('nf.sub')}</p>
        <Link to={href('')} className={s.action}>{t('nf.back')}</Link>
      </div>
    </div>
  )
}
