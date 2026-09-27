import type { ReactNode } from 'react'
import { catalog } from '@/data/catalog'
import { useT } from '@/i18n/useLocale'
import { CategoryGlyph } from './icons'
import { AGENT_NAME, AgentLogo } from './agentLogos'
import { SearchBox } from './SearchBox'
import s from './Hero.module.css'

/* Six white tiles around the headline: four agents our skills install into (colour brand marks, a compatibility signal)
   and our two skill marks, in two compact clusters of three hugging the ends of the headline. Slot names are positions. */
const icons = catalog.skills.filter((k) => k.icon).map((k) => ({ src: k.icon!, name: k.title.en }))
const skillTile = (i: number, fallback: string): ReactNode =>
  icons[i] ? <img src={icons[i].src} alt="" /> : <CategoryGlyph id={fallback} />

const TILES: { cls: string; label: string; body: () => ReactNode }[] = [
  { cls: s.braces, label: AGENT_NAME.cursor, body: () => <AgentLogo agent="cursor" /> },
  { cls: s.skillA, label: AGENT_NAME.claude, body: () => <AgentLogo agent="claude" /> },
  { cls: s.head, label: icons[0]?.name ?? '', body: () => skillTile(0, 'design') },
  { cls: s.skillB, label: AGENT_NAME.gemini, body: () => <AgentLogo agent="gemini" /> },
  { cls: s.prompt, label: icons[1]?.name ?? '', body: () => skillTile(1, 'workflow') },
  { cls: s.stack, label: AGENT_NAME.copilot, body: () => <AgentLogo agent="copilot" /> },
]

export function Hero({ q, onSearch }: { q: string; onSearch: (q: string) => void }) {
  const t = useT()
  return (
    <section className={s.hero}>
      <div className={s.inner}>
        <div className={s.titleWrap}>
          <div className={s.tiles} aria-hidden="true">
            {TILES.map((tile, i) => (
              <span key={i} className={`${s.tile} ${tile.cls}`} title={tile.label}>{tile.body()}</span>
            ))}
          </div>
          <h1 className={s.title}>{t('hero.title')}</h1>
        </div>
        <p className={s.sub}>{t('hero.sub')}</p>
        <SearchBox value={q} onSubmit={onSearch} />
      </div>
    </section>
  )
}
