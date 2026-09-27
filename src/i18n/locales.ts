export const LOCALES = ['uz', 'ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'uz'
export const LOCALE_NAMES: Record<Locale, string> = { uz: 'Oʻzbekcha', ru: 'Русский', en: 'English' }
export const LOCALE_SHORT: Record<Locale, string> = { uz: 'UZ', ru: 'RU', en: 'EN' }

export function isLocale(x: string): x is Locale {
  return (LOCALES as readonly string[]).includes(x)
}

/** '/'  '/skill/x'  '/ru'  '/ru/skill/x' … */
export function localePath(locale: Locale, slug: string = ''): string {
  const s = slug.replace(/^\/+|\/+$/g, '')
  const base = locale === DEFAULT_LOCALE ? '' : `/${locale}`
  return `${base}${s ? `/${s}` : ''}` || '/'
}

export function parseLocale(pathname: string): { locale: Locale; rest: string } {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length && isLocale(parts[0]) && parts[0] !== DEFAULT_LOCALE) {
    return { locale: parts[0], rest: parts.slice(1).join('/') }
  }
  return { locale: DEFAULT_LOCALE, rest: parts.join('/') }
}

export function switchLocale(pathname: string, target: Locale): string {
  const { rest } = parseLocale(pathname)
  return localePath(target, rest)
}
