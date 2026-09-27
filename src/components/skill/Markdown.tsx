import { useMemo } from 'react'
import { Marked, type Tokens } from 'marked'
import clsx from 'clsx'
import s from './Markdown.module.css'

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Only http(s), mailto, in-page anchors and relative paths survive; javascript:, data:, vbscript: … are dropped. */
function safeUrl(href: string): string | null {
  const h = href.trim()
  if (/^(https?:|mailto:)/i.test(h)) return h
  if (/^[a-z][a-z0-9+.-]*:/i.test(h)) return null
  return h
}

/** 'https://www.github.com/a/b/c/d.md' -> 'github.com/a/b…/d.md': host + path, middle-truncated past 44 chars. */
export function shortUrl(href: string, max = 44): string {
  const s = href.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
  if (s.length <= max) return s
  const head = Math.ceil((max - 1) * 0.6), tail = max - 1 - head
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}

const slug = (t: string) => t.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')

/* A marked instance whose output is safe to inject: raw HTML (block + inline) is escaped, not passed through;
   link/image URLs are allow-listed; code is escaped by marked itself. */
const md = new Marked({ gfm: true, breaks: false })
md.use({
  renderer: {
    html(token: Tokens.HTML | Tokens.Tag) {
      return esc(token.text)
    },
    link(this: { parser: { parseInline: (t: Tokens.Link['tokens']) => string } }, token: Tokens.Link) {
      const url = safeUrl(token.href)
      const bare = /^https?:\/\//i.test(token.text) && (token.text === token.href || token.text === token.href.replace(/^mailto:/, ''))
      const text = bare ? esc(shortUrl(token.text)) : this.parser.parseInline(token.tokens)
      if (!url) return text
      const ext = /^https?:/i.test(url)
      const title = token.title ? token.title : bare ? token.href : ''
      return `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ''}${bare ? ' data-url' : ''}${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`
    },
    image(token: Tokens.Image) {
      const url = safeUrl(token.href)
      if (!url || !/^https:/i.test(url)) return esc(token.text)
      return `<img src="${esc(url)}" alt="${esc(token.text)}" loading="lazy" />`
    },
    heading(this: { parser: { parseInline: (t: Tokens.Heading['tokens']) => string } }, token: Tokens.Heading) {
      const inner = this.parser.parseInline(token.tokens)
      return `<h${token.depth} id="${esc(slug(inner))}">${inner}</h${token.depth}>\n`
    },
    table(this: { parser: { parseInline: (t: Tokens.TableCell['tokens']) => string } }, token: Tokens.Table) {
      const cell = (c: Tokens.TableCell, tag: 'th' | 'td') => {
        const align = c.align ? ` style="text-align:${c.align}"` : ''
        return `<${tag}${align}>${this.parser.parseInline(c.tokens)}</${tag}>`
      }
      const head = `<tr>${token.header.map((c) => cell(c, 'th')).join('')}</tr>`
      const body = token.rows.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('')
      return `<div class="${s.tableWrap}"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>\n`
    },
  },
})

export function renderMarkdown(src: string): string {
  return md.parse(src, { async: false }) as string
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(source), [source])
  // html is produced by the escaping renderer above: no raw HTML from the source reaches the DOM.
  return <div className={clsx(s.md, className)} dangerouslySetInnerHTML={{ __html: html }} />
}
