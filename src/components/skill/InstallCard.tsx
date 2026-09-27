import { agentPrompt, installCommand, pluginCommands, zipUrl } from '@/lib/install'
import { useLocale } from '@/i18n/useLocale'
import { useDT } from './strings'
import { Command, CopyIconButton } from './parts'
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

/** The owner's core requirement: every skill has two hand-offs. For Agent = one prompt any agent can run;
    For Human = numbered steps in the reader's language, each command with its own copy button. */
export function InstallCard({ ids, pluginId, zips, bundle }: Props) {
  const t = useDT()
  const locale = useLocale()
  const prompt = agentPrompt(ids, locale)
  const cmd = installCommand(ids)
  const plugin = pluginCommands(pluginId)
  const single = zips.length === 1 ? zips[0] : undefined

  const stepsText = [
    `1. ${t('install.step1')} https://nodejs.org`,
    `2. ${t('install.step2')}\n   ${cmd}`,
    `3. ${single ? t('install.step3') : t('install.step3Many')}\n${zips.map((z) => `   ${zipUrl(z.id)}`).join('\n')}`,
    `4. ${t('install.step4')}`,
    '',
    `${t('install.plugin')}:\n${plugin}`,
  ].join('\n')

  return (
    <section className={s.card} aria-labelledby="install-title">
      <h2 id="install-title" className={s.cardTitle}>{t('install.title')}</h2>
      <p className={s.cardSub}>{bundle ? t('install.subBundle') : t('install.sub')}</p>

      <div className={s.block}>
        <div className={s.blockHead}>
          <span className={s.blockLabel}>{t('install.agent')}</span>
          <span className={s.blockTools}><CopyIconButton text={prompt} label={t('copy.agent')} /></span>
        </div>
        <p className={s.hint}>{t('install.agentHint')}</p>
        <pre className={s.prompt} tabIndex={0} aria-label={t('install.agent')}>{prompt}</pre>
      </div>

      <div className={s.block}>
        <div className={s.blockHead}>
          <span className={s.blockLabel}>{t('install.human')}</span>
          <span className={s.blockTools}>
            {single && (
              <a className={s.iconBtn} href={single.href} download aria-label={t('dl.zip')} title={t('dl.zip')}><DownloadIcon /></a>
            )}
            <CopyIconButton text={stepsText} label={t('copy.steps')} />
          </span>
        </div>
        <ol className={s.steps}>
          <li className={s.step}>
            <span className={s.stepNum} aria-hidden>1</span>
            <div className={s.stepBody}>
              {t('install.step1')}{' '}
              <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer">{t('install.step1Link')}</a>
            </div>
          </li>
          <li className={s.step}>
            <span className={s.stepNum} aria-hidden>2</span>
            <div className={s.stepBody}>
              {t('install.step2')}
              <Command text={cmd} />
            </div>
          </li>
          <li className={s.step}>
            <span className={s.stepNum} aria-hidden>3</span>
            <div className={s.stepBody}>
              {single ? t('install.step3') : t('install.step3Many')}
              <div className={s.zips}>
                {zips.map((z) => (
                  <a key={z.id} className={s.zip} href={z.href} download><DownloadIcon size={14} />{t('install.step3Zip', { name: z.id })}</a>
                ))}
              </div>
            </div>
          </li>
          <li className={s.step}>
            <span className={s.stepNum} aria-hidden>4</span>
            <div className={s.stepBody}>{t('install.step4')}</div>
          </li>
        </ol>
        <div className={s.plugin}>
          <span className={s.pluginLabel}>{t('install.plugin')}</span>
          <Command text={plugin} />
        </div>
      </div>
    </section>
  )
}
