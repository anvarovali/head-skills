import type { Locale } from './locales'

/** '2026-09-27' -> '27-sentabr, 2026' / '27 сентября 2026 г.' / 'September 27, 2026'. */
export function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (locale === 'uz') {
    // Intl's uz data is uneven across browsers; spell it out.
    const m = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
    return `${d.getDate()}-${m[d.getMonth()]}, ${d.getFullYear()}`
  }
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(d)
}
