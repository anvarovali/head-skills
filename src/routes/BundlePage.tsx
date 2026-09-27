import { useEffect } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { getBundle, getSkill } from '@/data/catalog'
import type { Skill } from '@/data/types'
import { pick, useLocale } from '@/i18n/useLocale'
import { useDT } from '@/components/skill/strings'
import { Badges, Crumbs, Glyph, NotFoundBlock, ShareActions, YouTubeLite, youtubeId } from '@/components/skill/parts'
import { InstallCard } from '@/components/skill/InstallCard'
import { ExtensionCard } from '@/components/market/ExtensionCard'
import { getItems } from '@/components/market/items'
import { Markdown } from '@/components/skill/Markdown'
import { GridIcon } from '@/components/skill/icons'
import s from '@/components/skill/Detail.module.css'

export function BundlePage() {
  const { id = '' } = useParams()
  const bundle = getBundle(id)
  const locale = useLocale()
  const t = useDT()
  const [search] = useSearchParams()
  const { hash } = useLocation()
  const title = bundle ? pick(bundle.title, locale) ?? bundle.id : ''

  useEffect(() => {
    if (bundle) document.title = `${title} · HEAD skills`
  }, [bundle, title])

  if (!bundle) return <NotFoundBlock title={t('nf.bundle')} />

  const skills = bundle.skills.map(getSkill).filter((x): x is Skill => !!x)
  const ids = skills.map((k) => k.id)
  const yt = youtubeId(bundle.youtube, locale, search, hash)
  const body = pick(bundle.body, locale)

  return (
    <article className={s.page}>
      <Crumbs current={bundle.id} />
      <header>
        <div className={s.head}>
          <Glyph title={title} bundle />
          <div className={s.headText}>
            <div className={s.titleRow}>
              <div className={s.titleMain}>
                <h1 className={s.title}>{title}</h1>
                <Badges ids={bundle.badges ?? []} extra={<span className={`${s.badge} ${s.badgeGrey}`}>{t('bundle.kind')}</span>} />
              </div>
              <div className={s.actions}><ShareActions title={title} /></div>
            </div>
            <div className={s.meta}><span>{t('meta.skills', { n: skills.length })}</span><span className={s.metaAuthor}>{t('meta.by', { name: 'HEAD' })}</span></div>
          </div>
        </div>
        <p className={s.desc}>{pick(bundle.summary, locale)}</p>
      </header>

      <div className={s.grid}>
        <div className={s.tabs}>
          <h2 className={`${s.tab} ${s.tabActive}`}>
            <GridIcon />{t('tab.skills')}<span className={s.tabCount}>{skills.length}</span>
          </h2>
        </div>
        <div className={s.main}>
          {yt && <YouTubeLite id={yt} title={title} />}
          {body && <div className={s.bundleBody}><Markdown source={body} /></div>}
          <div className={s.cards}>
            {getItems().skills.filter((it) => ids.includes(it.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)).map((it) => <ExtensionCard key={it.id} item={it} />)}
          </div>
        </div>
        <aside className={s.side}>
          <InstallCard bundle ids={ids} pluginId={bundle.id} zips={skills.map((k) => ({ id: k.id, href: k.zip }))} />
        </aside>
      </div>
    </article>
  )
}
