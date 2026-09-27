import type { ReactNode } from 'react'
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

/** The owner's core requirement: every skill has two hand-offs, For Agent and For Human. Both blocks share
    one shape, as on Qoder: a label row with icon buttons, then one fixed-height mono box with a bottom fade. */
export function InstallCard({ ids, pluginId, zips, bundle }: Props) {
  const t = useDT()
  const locale = useLocale()
  const prompt = agentPrompt(ids, locale)
  const cmd = installCommand(ids)
  const plugin = pluginCommands(pluginId)
  const single = zips.length === 1 ? zips[0] : undefined
  const step3 = single ? t('install.step3') : t('install.step3Many')

  // one source for both the rendered box (with live links) and the copied plain text
  const lines: { text: string; href?: string; download?: boolean }[][] = [
    [{ text: `1. ${t('install.step1')} ` }, { text: 'https://nodejs.org', href: 'https://nodejs.org/' }],
    [{ text: `2. ${t('install.step2')}` }],
    [{ text: `   ${cmd}` }],
    [{ text: `3. ${step3}` }],
    ...zips.map((z) => [{ text: '   ' }, { text: zipUrl(z.id), href: z.href, download: true }]),
    [{ text: `4. ${t('install.step4')}` }],
    [{ text: '' }],
    [{ text: `${t('install.plugin')}:` }],
    ...plugin.split('\n').map((l) => [{ text: l }]),
  ]
  const humanText = lines.map((l) => l.map((p) => p.text).join('')).join('\n')
  const humanNodes: ReactNode[] = lines.map((l, i) => (
    <span key={i}>
      {l.map((p, j) => p.href
        ? <a key={j} href={p.href} {...(p.download ? { download: true } : { target: '_blank', rel: 'noopener noreferrer' })}>{p.text}</a>
        : p.text)}
      {'\n'}
    </span>
  ))

  return (
    <section className={s.card} aria-labelledby="install-title">
      <h2 id="install-title" className={s.cardTitle}>{t('install.title')}</h2>
      <p className={s.cardSub}>{bundle ? t('install.subBundle') : t('install.sub')}</p>

      <div className={s.block}>
        <div className={s.blockHead}>
          <span className={s.blockLabel}>{t('install.agent')}</span>
          <span className={s.blockTools}><CopyIconButton text={prompt} label={t('copy.agent')} /></span>
        </div>
        <pre className={s.prompt} tabIndex={0} aria-label={t('install.agent')}>{prompt}</pre>
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
        <pre className={s.prompt} tabIndex={0} aria-label={t('install.human')}>{humanNodes}</pre>
      </div>
    </section>
  )
}
