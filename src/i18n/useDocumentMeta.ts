import { useEffect } from 'react'
import { useT } from './useLocale'

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el) }
  el.content = content
}

/** <title> and the meta/og description for the current route, in the current locale.
    `title` omitted = the marketplace home; `description` omitted = the site description. */
export function useDocumentMeta(title?: string, description?: string) {
  const t = useT()
  const site = t('site.name')
  const fullTitle = title ? `${title} · ${site}` : `${site} · ${t('hero.title')}`
  const desc = description?.trim() || t('meta.description')
  useEffect(() => {
    document.title = fullTitle
    setMeta('meta[name="description"]', 'name', 'description', desc)
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle)
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc)
  }, [fullTitle, desc])
}
