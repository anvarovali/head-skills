import { catalog } from '@/data/catalog'
import type { L10n } from '@/data/types'
import type { Locale } from '@/i18n/locales'
import { pick } from '@/i18n/useLocale'

/** One card's worth of data, the same shape for a skill and a bundle. Nothing here is invented: every field comes from the catalog. */
export interface Item {
  kind: 'skill' | 'bundle'
  id: string
  title: L10n
  summary: L10n
  category?: string
  icon?: string
  badges: string[]
  author?: string            // github handle (skills) or null
  featured: boolean
  updated?: string
  skillCount?: number
}

export type Source = 'head' | 'praktikum' | 'community'
export const SOURCES: Source[] = ['head', 'praktikum', 'community']
export const sourceOf = (it: Item): Source =>
  it.badges.includes('official') ? 'head' : it.badges.some((b) => b.startsWith('praktikum')) ? 'praktikum' : 'community'

/** Badge ids -> the short label on a card. Unknown badges are not shown. */
export const BADGE_LABEL: Record<string, string> = { official: 'HEAD', 'praktikum-2026': 'Praktikum 2026' }

const skills: Item[] = catalog.skills.map((s) => ({
  kind: 'skill', id: s.id, title: s.title, summary: s.summary, category: s.category, icon: s.icon,
  badges: s.badges ?? [], author: s.author.github ?? s.author.name, featured: !!s.featured, updated: s.updated,
}))
const bundles: Item[] = catalog.bundles.map((b) => ({
  kind: 'bundle', id: b.id, title: b.title, summary: b.summary, badges: b.badges ?? [], featured: true,
  author: catalog.repo.owner, skillCount: b.skills.length,
}))

/* DEV-ONLY fixture: `?demo=1` repeats the real cards so the grid can be judged at scale. Never active in a build. */
function demo(list: Item[], n: number): Item[] {
  const out: Item[] = []
  for (let i = 0; out.length < n; i++) {
    const it = list[i % list.length]
    out.push(i < list.length ? it : { ...it, id: `${it.id}~${i}`, featured: i < 8 })
  }
  return out
}
const isDemo = () => import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')

export function getItems(): { skills: Item[]; bundles: Item[] } {
  if (!isDemo()) return { skills, bundles }
  const cats = catalog.categories.map((c) => c.id)
  return {
    skills: demo(skills, 30).map((it, i) => (i < skills.length ? it : { ...it, category: cats[i % cats.length] })),
    bundles: demo(bundles, 6),
  }
}

export const itemHref = (it: Item) => `${it.kind}/${it.id.split('~')[0]}`

export function matches(it: Item, q: string, locale: Locale): boolean {
  if (!q) return true
  const cat = it.category ? catalog.categories.find((c) => c.id === it.category)?.title : undefined
  const hay = [it.id, ...Object.values(it.title), pick(it.summary, locale), it.summary.en, cat && pick(cat, locale), it.author]
    .filter(Boolean).join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
}

export type Sort = 'featured' | 'latest'
export function sortItems(list: Item[], sort: Sort, locale: Locale): Item[] {
  const title = (it: Item) => pick(it.title, locale) ?? it.id
  return [...list].sort((a, b) =>
    sort === 'latest'
      ? (b.updated ?? '').localeCompare(a.updated ?? '') || title(a).localeCompare(title(b))
      : Number(b.featured) - Number(a.featured) || title(a).localeCompare(title(b)))
}
