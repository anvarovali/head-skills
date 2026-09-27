import data from './catalog.json'
import type { Catalog, Skill, Bundle } from './types'

export const catalog = data as unknown as Catalog
export const getSkill = (id: string): Skill | undefined => catalog.skills.find((s) => s.id === id)
export const getBundle = (id: string): Bundle | undefined => catalog.bundles.find((b) => b.id === id)
export const categoryTitle = (id: string) => catalog.categories.find((c) => c.id === id)?.title
