import { useLocale, useT } from '@/i18n/useLocale'
import { catalog } from '@/data/catalog'
import { Crumbs, Command } from '@/components/skill/parts'
import { Markdown } from '@/components/skill/Markdown'
import { checkCommand, checksList, folderTemplate, submitGuide } from '@/components/skill/submitContent'
import { CheckIcon, GithubIcon } from '@/components/skill/icons'
import { useDocumentMeta } from '@/i18n/useDocumentMeta'
import s from '@/components/skill/Detail.module.css'

export function Submit() {
  const locale = useLocale()
  const t = useT()
  useDocumentMeta(t('submit.title'), t('submit.lead'))

  return (
    <article className={s.page}>
      <Crumbs current={t('crumb.submit')} />
      <header>
        <div className={s.head}>
          <div className={s.headText}>
            <div className={s.titleRow}>
              <h1 className={s.title}>{t('submit.title')}</h1>
              <span className={s.badges}><span className={s.badge}>{t('badge.praktikum-2026')}</span></span>
            </div>
          </div>
        </div>
        <p className={s.desc}>{t('submit.lead')}</p>
      </header>

      <div className={s.grid} style={{ marginTop: 32 }}>
        <div className={s.tabs} style={{ paddingBottom: 0 }} aria-hidden />
        <div className={s.main}>
          <Markdown source={submitGuide[locale]} />
        </div>
        <aside className={s.side}>
          <section className={s.card} aria-labelledby="submit-card">
            <h2 id="submit-card" className={s.cardTitle}>{t('submit.cardTitle')}</h2>
            <p className={s.cardSub}>{t('submit.cardSub')}</p>
            <a className={s.linkBtn} href={catalog.repo.url} target="_blank" rel="noopener noreferrer">
              <GithubIcon />{t('submit.openRepo')}
            </a>
            <div className={s.block}>
              <div className={s.blockHead}><span className={s.blockLabel}>{t('submit.template')}</span></div>
              <Command text={folderTemplate} />
            </div>
            <div className={s.block}>
              <div className={s.blockHead}><span className={s.blockLabel}>{t('submit.checks')}</span></div>
              <ul className={s.checks}>
                {checksList[locale].map((c) => <li key={c}><CheckIcon />{c}</li>)}
              </ul>
              <p className={s.note}>{t('submit.review')}</p>
            </div>
            <div className={s.block}>
              <div className={s.blockHead}><span className={s.blockLabel}>{t('submit.local')}</span></div>
              <Command text={checkCommand} />
            </div>
          </section>
        </aside>
      </div>
    </article>
  )
}
