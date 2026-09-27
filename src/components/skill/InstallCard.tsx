import { useId, useLayoutEffect, useRef, useState } from 'react'
import { agentPrompt, installCommand, pluginCommands, zipUrl } from '@/lib/install'
import { useLocale } from '@/i18n/useLocale'
import { useDT } from './strings'
import { CopyIconButton } from './parts'
import { ChevronDownIcon, DownloadIcon } from './icons'
import s from './Detail.module.css'

interface Props {
  /** skill ids to install (one for a skill page, all of them for a bundle) */
  ids: string[]
  /** the Claude Code plugin name: the skill id, or the bundle id */
  pluginId: string
  /** zip downloads for Claude.ai / desktop upload */
  zips: { id: string; href: string }[]
  bundle?: boolean
}

/** One line of a mono box. `indent` is in ch: the line is set in from the left, and a wrap continues at that
    column; `hang` puts the first `hang` ch (a "1. " / "- " marker) back out to the left, a hanging indent. */
interface Line { parts: { text: string; href?: string; download?: boolean }[]; indent?: number; hang?: number }

const plain = (lines: Line[]) => lines.map((l) => ' '.repeat(l.indent ?? 0) + l.parts.map((p) => p.text).join('')).join('\n')

/** Parse a plain-text block into lines with hanging indents for list markers and leading-space indents. */
function toLines(text: string): Line[] {
  return text.split('\n').map((raw) => {
    const lead = raw.match(/^ */)![0].length
    const body = raw.slice(lead)
    const marker = body.match(/^(\d+\.\s|-\s)/)?.[0].length ?? 0
    return { parts: [{ text: body }], indent: lead + marker, hang: marker }
  })
}

/** Offer a line break after each "/" so long URLs wrap at path segments, not mid-word. Copy text is unaffected. */
function breakable(text: string) {
  if (!text.includes('/')) return text
  return text.split('/').flatMap((seg, i, a) => (i < a.length - 1 ? [seg, '/', <wbr key={i} />] : [seg]))
}

const PILL_ZONE = 30 // px under the last fully visible line: the fade and the expand pill live here

/** Mono box cut on a line boundary: either after `rows` visual lines, or right after logical line `endAt`
    (measured, so wrapped lines count). Below the cut a fade into the box ground carries an expand pill. */
function MonoBox({ lines, label, rows = 5, endAt }: { lines: Line[]; label: string; rows?: number; endAt?: number }) {
  const t = useDT()
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [cut, setCut] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 19
      const top = parseFloat(getComputedStyle(el).paddingTop) || 0
      const end = endAt != null ? (el.children[endAt] as HTMLElement | undefined) : undefined
      const bottom = end ? end.offsetTop + end.offsetHeight : top + rows * lh
      setCut(Math.round(bottom + PILL_ZONE + 2)) // + the 1px top and bottom borders
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [rows, endAt, lines])
  const fits = cut != null && box.current != null && box.current.scrollHeight <= cut
  return (
    <div className={s.monoWrap} data-open={open || undefined}>
      <div ref={box} id={id} className={s.mono} style={open || fits ? undefined : { height: cut ?? `calc(${rows} * 19px + 10px + ${PILL_ZONE}px)` }}
        tabIndex={0} role="region" aria-label={label}>
        {lines.map((l, i) => (
          <span key={i} className={s.monoLine} style={{ paddingLeft: `${l.indent ?? 0}ch`, textIndent: `-${l.hang ?? 0}ch` }}>
            {l.parts.map((p, j) => p.href
              ? <a key={j} href={p.href} {...(p.download ? { download: true } : { target: '_blank', rel: 'noopener noreferrer' })}>{p.text}</a>
              : <span key={j}>{breakable(p.text)}</span>)}
            {l.parts.every((p) => !p.text) ? ' ' : null}
          </span>
        ))}
      </div>
      {!fits && (
        <button type="button" className={s.monoPill} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          {open ? t('install.less') : t('install.more')}<ChevronDownIcon size={12} />
        </button>
      )}
    </div>
  )
}

/** The owner's core requirement: every skill has two hand-offs, For Agent and For Human. Both blocks share
    one shape, as on Qoder: a label row with icon buttons, then one mono box of whole lines with a bottom fade. */
export function InstallCard({ ids, pluginId, zips, bundle }: Props) {
  const t = useDT()
  const locale = useLocale()
  const prompt = agentPrompt(ids, locale)
  const cmd = installCommand(ids)
  const plugin = pluginCommands(pluginId)
  const single = zips.length === 1 ? zips[0] : undefined

  const human: Line[] = [
    { parts: [{ text: `1. ${t('install.step1')} ` }, { text: 'https://nodejs.org', href: 'https://nodejs.org/' }], indent: 3, hang: 3 },
    { parts: [{ text: `2. ${t('install.step2')}` }], indent: 3, hang: 3 },
    { parts: [{ text: cmd }], indent: 3 },
    { parts: [{ text: `3. ${single ? t('install.step3') : t('install.step3Many')}` }], indent: 3, hang: 3 },
    ...zips.map((z): Line => ({ parts: [{ text: zipUrl(z.id), href: z.href, download: true }], indent: 3 })),
    { parts: [{ text: `4. ${t('install.step4')}` }], indent: 3, hang: 3 },
    { parts: [{ text: '' }] },
    { parts: [{ text: `${t('install.plugin')}:` }] },
    ...plugin.split('\n').map((l): Line => ({ parts: [{ text: l }] })),
  ]
  // copied text: the hanging markers are part of the text already, so only continuation indents are spaces
  const humanText = plain(human.map((l) => ({ ...l, indent: (l.indent ?? 0) - (l.hang ?? 0) })))

  return (
    <section className={s.card} aria-labelledby="install-title">
      <h2 id="install-title" className={s.cardTitle}>{t('install.title')}</h2>
      <p className={s.cardSub}>{bundle ? t('install.subBundle') : t('install.sub')}</p>

      <div className={s.block}>
        <div className={s.blockHead}>
          <span className={s.blockLabel}>{t('install.agent')}</span>
          <span className={s.blockTools}><CopyIconButton text={prompt} label={t('copy.agent')} /></span>
        </div>
        <MonoBox lines={toLines(prompt)} label={t('install.agent')} rows={5} />
      </div>

      <div className={s.block}>
        <div className={s.blockHead}>
          <span className={s.blockLabel}>{t('install.human')}</span>
          <span className={s.blockTools}>
            {single && (
              <a className={s.iconBtn} href={single.href} download aria-label={t('dl.zip')} title={t('dl.zip')}><DownloadIcon /></a>
            )}
            <CopyIconButton text={humanText} label={t('copy.steps')} />
          </span>
        </div>
        <MonoBox lines={human} label={t('install.human')} endAt={2} />
      </div>
    </section>
  )
}
