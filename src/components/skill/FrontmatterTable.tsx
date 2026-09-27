import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Skill } from '@/data/types'
import { categoryTitle } from '@/data/catalog'
import { pick, useLocale, useT } from '@/i18n/useLocale'
import { repoFolderUrl } from '@/lib/install'
import type { ChromeKey } from '@/content/chrome'
import s from './Detail.module.css'

const KNOWN: Record<string, ChromeKey> = { name: 'fm.name', version: 'fm.version', description: 'fm.description', license: 'fm.license' }

function show(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map(show).join(', ')
  return JSON.stringify(v)
}

/** Long values clamp to four lines with a toggle; the toggle only appears when the text actually overflows. */
function Clamp({ text }: { text: string }) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [over, setOver] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || open) return
    const measure = () => setOver(el.scrollHeight > el.clientHeight + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, text])
  return (
    <div className={s.clampWrap}>
      <div ref={ref} className={open ? undefined : s.clamp}>
        {text}
        {open && <> <button type="button" className={s.more} aria-expanded onClick={() => setOpen(false)}>{t('fm.less')}</button></>}
      </div>
      {!open && over && (
        <button type="button" className={`${s.more} ${s.moreFloat}`} aria-expanded={false} onClick={() => setOpen(true)}>{t('fm.more')}</button>
      )}
    </div>
  )
}

/** SKILL.md frontmatter as Qoder's key/value table, plus the catalog facts a reader wants (category, author, folder). */
export function FrontmatterTable({ skill }: { skill: Skill }) {
  const t = useT()
  const locale = useLocale()
  const fm = skill.frontmatter ?? {}
  const rows: { k: string; v: ReactNode }[] = []
  rows.push({ k: t('fm.name'), v: skill.name })
  if (skill.version) rows.push({ k: t('fm.version'), v: skill.version })
  rows.push({ k: t('fm.description'), v: <Clamp text={skill.description} /> })
  for (const [key, val] of Object.entries(fm)) {
    if (key === 'name' || key === 'description' || key === 'version') continue
    rows.push({ k: KNOWN[key] ? t(KNOWN[key]) : key, v: show(val) })
  }
  const cat = pick(categoryTitle(skill.category), locale)
  if (cat) rows.push({ k: t('fm.category'), v: cat })
  const author = skill.author.github
    ? <a className={s.kvLink} href={`https://github.com/${skill.author.github}`} target="_blank" rel="noopener noreferrer">{skill.author.name}</a>
    : skill.author.name
  rows.push({ k: t('fm.author'), v: author })
  rows.push({ k: t('fm.folder'), v: <a className={s.kvLink} href={repoFolderUrl(skill.id)} target="_blank" rel="noopener noreferrer">{skill.repoPath}</a> })

  return (
    <div className={s.kv} role="table" aria-label="SKILL.md">
      {rows.map((r, i) => (
        <div className={s.kvRow} role="row" key={i}>
          <div className={s.kvKey} role="rowheader">{r.k}</div>
          <div className={s.kvVal} role="cell">{r.v}</div>
        </div>
      ))}
    </div>
  )
}
