import { useEffect, useId, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { getSkill } from '@/data/catalog'
import { pick, useLocale } from '@/i18n/useLocale'
import { useDT, formatDate } from '@/components/skill/strings'
import { Badges, Crumbs, DownloadAction, Glyph, NotFoundBlock, ShareActions, YouTubeLite, youtubeId } from '@/components/skill/parts'
import { InstallCard } from '@/components/skill/InstallCard'
import { FrontmatterTable } from '@/components/skill/FrontmatterTable'
import { FileBrowser } from '@/components/skill/FileBrowser'
import { Markdown } from '@/components/skill/Markdown'
import { DocIcon, FolderIcon } from '@/components/skill/icons'
import s from '@/components/skill/Detail.module.css'

type Tab = 'guides' | 'files'

export function SkillPage() {
  const { id = '' } = useParams()
  const skill = getSkill(id)
  const locale = useLocale()
  const t = useDT()
  const [search] = useSearchParams()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const uid = useId()
  // the tab lives in the hash (#files) so it is linkable without a query string
  const tab: Tab = hash === '#files' || search.get('tab') === 'files' ? 'files' : 'guides'
  const title = skill ? pick(skill.title, locale) ?? skill.name : ''

  useEffect(() => {
    if (skill) document.title = `${title} · HEAD skills`
  }, [skill, title])

  if (!skill) return <NotFoundBlock title={t('nf.skill')} />

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(search)
    p.delete('tab')
    const q = p.toString()
    navigate({ search: q ? `?${q}` : '', hash: next === 'files' ? 'files' : '' }, { replace: true, preventScrollReset: true })
  }
  const yt = youtubeId(skill.youtube, locale, search, hash)
  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'guides', label: t('tab.guides'), icon: <DocIcon /> },
    { id: 'files', label: t('tab.files'), icon: <FolderIcon /> },
  ]

  return (
    <article className={s.page}>
      <Crumbs current={skill.id} actions={<><ShareActions title={title} /><DownloadAction href={skill.zip} /></>} />
      <header>
        <div className={s.head}>
          <Glyph title={title} icon={skill.icon} />
          <div className={s.headText}>
            <div className={s.titleRow}>
              <h1 className={s.title}>{title}</h1>
              <Badges ids={skill.badges ?? []} />
            </div>
            <div className={s.meta}>
              <span>{t('meta.updated', { date: formatDate(skill.updated, locale) })}</span>
              <span className={s.metaAuthor}>
                {skill.author.github
                  ? <a href={`https://github.com/${skill.author.github}`} target="_blank" rel="noopener noreferrer">{t('meta.by', { name: skill.author.name })}</a>
                  : t('meta.by', { name: skill.author.name })}
              </span>
            </div>
          </div>
        </div>
        <p className={s.desc}>{pick(skill.summary, locale) ?? skill.description}</p>
      </header>

      <div className={s.grid}>
        <div className={s.tabs} role="tablist" aria-label={title}>
          {tabs.map((x) => (
            <button key={x.id} type="button" role="tab" id={`${uid}-${x.id}`} aria-controls={`${uid}-panel`}
              aria-selected={tab === x.id} tabIndex={tab === x.id ? 0 : -1} className={s.tab} onClick={() => setTab(x.id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                const next = tab === 'guides' ? 'files' : 'guides'
                setTab(next)
                document.getElementById(`${uid}-${next}`)?.focus()
              }}>
              {x.icon}{x.label}
            </button>
          ))}
        </div>

        <div className={s.main} role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${tab}`}>
          {tab === 'guides' ? (
            <>
              {yt && <YouTubeLite id={yt} title={title} />}
              <FrontmatterTable skill={skill} />
              <Markdown source={skill.readme} />
            </>
          ) : (
            <FileBrowser skill={skill} />
          )}
        </div>

        <aside className={s.side}>
          <InstallCard ids={[skill.id]} pluginId={skill.id} zips={[{ id: skill.id, href: skill.zip }]} />
        </aside>
      </div>
    </article>
  )
}
