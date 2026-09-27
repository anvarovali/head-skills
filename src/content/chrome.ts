import type { Locale } from '@/i18n/locales'

/* Interface strings. uz is the base; every key must exist in uz. Builders add keys here as they need them. */
const uz = {
  'site.name': 'HEAD skills',
  'nav.marketplace': 'Marketplace',
  'nav.submit': 'Skill yuborish',
  'nav.headuz': 'head.uz',
  'hero.title': 'Agentingizga yangi imkoniyatlar bering',
  'hero.sub': 'HEAD jamoasi va AI Praktikum bitiruvchilarining skill’lari — Claude Code, Codex, Cursor va boshqalar uchun.',
  'search.placeholder': 'Skill qidirish',
  'tab.all': 'Hammasi',
  'tab.skills': 'Skill’lar',
  'tab.bundles': 'To‘plamlar',
  'empty.title': 'Hech narsa topilmadi',
  'empty.sub': 'Boshqa so‘z bilan qidirib ko‘ring',
  'footer.replay': 'Introni qayta ko‘rish',
} as const

export type ChromeKey = keyof typeof uz
type Dict = Record<ChromeKey, string>

const ru: Dict = {
  'site.name': 'HEAD skills',
  'nav.marketplace': 'Маркетплейс',
  'nav.submit': 'Добавить скилл',
  'nav.headuz': 'head.uz',
  'hero.title': 'Дайте вашему агенту новые навыки',
  'hero.sub': 'Скиллы команды HEAD и выпускников AI Praktikum — для Claude Code, Codex, Cursor и других.',
  'search.placeholder': 'Поиск скиллов',
  'tab.all': 'Все',
  'tab.skills': 'Скиллы',
  'tab.bundles': 'Наборы',
  'empty.title': 'Ничего не найдено',
  'empty.sub': 'Попробуйте другое слово',
  'footer.replay': 'Посмотреть интро снова',
}

const en: Dict = {
  'site.name': 'HEAD skills',
  'nav.marketplace': 'Marketplace',
  'nav.submit': 'Submit a skill',
  'nav.headuz': 'head.uz',
  'hero.title': 'Supercharge your AI agents',
  'hero.sub': 'Skills by the HEAD team and AI Praktikum graduates — for Claude Code, Codex, Cursor and more.',
  'search.placeholder': 'Search skills',
  'tab.all': 'All',
  'tab.skills': 'Skills',
  'tab.bundles': 'Bundles',
  'empty.title': 'No matching results found',
  'empty.sub': 'Try a different keyword',
  'footer.replay': 'Replay the intro',
}

export const chrome: Record<Locale, Dict> = { uz, ru, en }
