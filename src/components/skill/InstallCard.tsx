import { useId, useState } from 'react'
import { agentPrompt, installCommand, pluginCommands, zipUrl } from '@/lib/install'
import { useLocale } from '@/i18n/useLocale'
import { useDT } from './strings'
import { CopyIconButton } from './parts'
import { DownloadIcon } from './icons'
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

/** Fixed-height mono box whose height is a whole number of lines, so nothing is cut mid-line; a toggle opens it. */
function MonoBox({ lines, label, rows }: { lines: Line[]; label: string; rows: number }) {
  const t = useDT()
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <div className={s.monoWrap}>
      <div id={id} className={s.mono} data-open={open || undefined} style={{ ['--rows' as string]: rows }}
        tabIndex={0} role="region" aria-label={label}>
        {lines.map((l, i) => (
          <span key={i} className={s.monoLine} style={{ paddingLeft: `${l.indent ?? 0}ch`, textIndent: `-${l.hang ?? 0}ch` }}>
            {l.parts.map((p, j) => p.href
              ? <a key={j} href={p.href} {...(p.download ? { download: true } : { target: '_blank', rel: 'noopener noreferrer' })}>{p.text}</a>
              : <span key={j}>{p.text}</span>)}
            {l.parts.every((p) => !p.text) ? ' ' : null}
          </span>
        ))}
      </div>
      <button type="button" className={s.monoToggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {open ? t('install.less') : t('install.more')}
      </button>
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
        <MonoBox lines={toLines(prompt)} label={t('install.agent')} rows={6} />
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
        <MonoBox lines={human} label={t('install.human')} rows={4 + Math.ceil(cmd.length / 34)} />
      </div>
    </section>
  )
}
