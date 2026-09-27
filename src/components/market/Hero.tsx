import type { ReactNode } from 'react'
import { catalog } from '@/data/catalog'
import { Slash } from '@/components/ui/HeadMark'
import { useT } from '@/i18n/useLocale'
import { CategoryGlyph } from './icons'
import { SearchBox } from './SearchBox'
import s from './Hero.module.css'

/* Six white tiles around the headline: the two real skill marks, the HEAD slash in blue, ">_", "{ }" and a stack.
   Weighty glyphs, one neutral shadow, staggered heights, an equal gap to the words on both sides. */
const icons = catalog.skills.filter((k) => k.icon).map((k) => k.icon!)
const skillTile = (i: number, fallback: string): ReactNode =>
  icons[i] ? <img src={icons[i]} alt="" /> : <CategoryGlyph id={fallback} />

const TILES: { cls: string; body: () => ReactNode }[] = [
  { cls: s.braces, body: () => <CategoryGlyph id="braces" /> },
  { cls: s.skillA, body: () => skillTile(0, 'design') },
  { cls: s.head, body: () => <Slash className={s.slash} /> },
  { cls: s.skillB, body: () => skillTile(1, 'workflow') },
  { cls: s.prompt, body: () => <CategoryGlyph id="prompt" /> },
  { cls: s.stack, body: () => <CategoryGlyph id="bundle" strokeWidth={2.3} /> },
]

export function Hero({ q, onSearch }: { q: string; onSearch: (q: string) => void }) {
  const t = useT()
  return (
    <section className={s.hero}>
      <div className={s.inner}>
        <div className={s.titleWrap}>
          <div className={s.tiles} aria-hidden="true">
            {TILES.map((tile, i) => (
              <span key={i} className={`${s.tile} ${tile.cls}`}>{tile.body()}</span>
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
