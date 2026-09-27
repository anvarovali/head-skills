import type { Locale } from '@/i18n/locales'

export type L10n<T = string> = Partial<Record<Locale, T>> & { en: T }

export interface SkillFile { path: string; size: number; text?: string }

export interface Skill {
  id: string                       // folder name == SKILL.md `name`
  name: string                     // frontmatter name
  description: string              // frontmatter description (English, as agents read it)
  title: L10n                      // display name per locale
  summary: L10n                    // one-line card description per locale
  category: string                 // category id, see catalog.categories
  author: { name: string; github?: string }
  icon?: string                    // path under /public, or omitted -> category icon
  featured?: boolean
  badges?: string[]                // e.g. 'praktikum-2026', 'official'
  youtube?: Partial<Record<Locale, string>>  // explainer video id per locale
  updated: string                  // ISO date (last git commit touching the folder, else mtime)
  version?: string
  frontmatter: Record<string, unknown>
  readme: string                   // SKILL.md body without frontmatter (markdown)
  files: SkillFile[]               // every file in the folder; text inlined when small and textual
  zip: string                      // '/dl/<id>.zip'
  repoPath: string                 // 'skills/<id>'
}

export interface Bundle {
  id: string
  title: L10n
  summary: L10n
  body?: L10n                      // longer intro, markdown
  skills: string[]
  badges?: string[]
  youtube?: Partial<Record<Locale, string>>
}

export interface Category { id: string; title: L10n }

export interface Catalog {
  repo: { owner: string; name: string; branch: string; url: string }
  site: string
  categories: Category[]
  skills: Skill[]
  bundles: Bundle[]
  builtAt: string
}
