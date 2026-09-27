import { Link } from 'react-router'
import type { Skill } from '@/data/types'
import { categoryTitle } from '@/data/catalog'
import { pick, useHref, useLocale } from '@/i18n/useLocale'
import { formatDate, useDT } from './strings'
import { Badges, Glyph } from './parts'
import { ArrowRightIcon } from './icons'
import s from './Detail.module.css'

/** Skill row for the bundle page. Placeholder until the shell's market card is shared (lead will unify). */
export function SkillMiniCard({ skill }: { skill: Skill }) {
  const t = useDT()
  const locale = useLocale()
  const href = useHref()
  const title = pick(skill.title, locale) ?? skill.name
  const cat = pick(categoryTitle(skill.category), locale)
  return (
    <Link to={href(`skill/${skill.id}`)} className={s.mini}>
      <Glyph title={title} icon={skill.icon} />
      <div className={s.miniBody}>
        <div className={s.miniTitleRow}>
          <span className={s.miniTitle}>{title}</span>
          <Badges ids={skill.badges ?? []} />
        </div>
        <div className={s.miniId}>{skill.id}</div>
        <p className={s.miniSum}>{pick(skill.summary, locale)}</p>
        <div className={s.miniMeta}>
          {[cat, t('meta.updated', { date: formatDate(skill.updated, locale) })].filter(Boolean).join('  ·  ')}
        </div>
      </div>
      <span className={s.miniOpen}>{t('bundle.open')}<ArrowRightIcon size={14} /></span>
    </Link>
  )
}
