import { createContext, useContext } from 'react'
import { DEFAULT_LOCALE, localePath, type Locale } from './locales'
import { chrome, type ChromeKey } from '@/content/chrome'

export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)
export const useLocale = (): Locale => useContext(LocaleContext)

/** Interface strings. Falls back to Uzbek. `{name}` placeholders are filled from vars. */
export function useT() {
  const locale = useLocale()
  return (key: ChromeKey, vars?: Record<string, string | number>): string => {
    let s: string = chrome[locale][key] ?? chrome.uz[key]
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
    return s
  }
}

/** Locale-aware path builder: href('skill/x') -> '/ru/skill/x' on the ru site. */
export function useHref() {
  const locale = useLocale()
  return (slug = '') => localePath(locale, slug)
}

/** Pick the current locale's value from a per-locale record, falling back to uz then en. */
export function pick<T>(rec: Partial<Record<Locale, T>> | undefined, locale: Locale): T | undefined {
  if (!rec) return undefined
  return rec[locale] ?? rec.uz ?? rec.en
}
