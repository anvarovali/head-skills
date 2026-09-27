import type { ReactNode } from 'react'
import { catalog } from '@/data/catalog'
import { HeadMark } from '@/components/ui/HeadMark'
import { useT } from '@/i18n/useLocale'
import { CategoryGlyph } from './icons'
import { SearchBox } from './SearchBox'
import s from './Hero.module.css'

/* Five white tiles around the headline: the two real skill marks, the HEAD wordmark, a ">_" prompt and a "{ }".
   Weighty glyphs, one neutral shadow, staggered heights, an equal gap to the words on both sides. */
const icons = catalog.skills.filter((k) => k.icon).map((k) => k.icon!)
const skillTile = (i: number, fallback: string): ReactNode =>
  icons[i] ? <img src={icons[i]} alt="" /> : <CategoryGlyph id={fallback} />

const TILES: { cls: string; tone?: 'blue'; body: () => ReactNode }[] = [
  { cls: s.braces, body: () => <CategoryGlyph id="braces" /> },
  { cls: s.skillA, body: () => skillTile(0, 'design') },
  { cls: s.head, tone: 'blue', body: () => <HeadMark className={s.mark} slashClassName={s.markSlash} /> },
  { cls: s.skillB, body: () => skillTile(1, 'workflow') },
  { cls: s.prompt, body: () => <CategoryGlyph id="prompt" /> },
]

export function Hero({ q, onSearch }: { q: string; onSearch: (q: string) => void }) {
  const t = useT()
  return (
    <section className={s.hero}>
      <div className={s.inner}>
        <div className={s.titleWrap}>
          <div className={s.tiles} aria-hidden="true">
            {TILES.map((tile, i) => (
              <span key={i} className={`${s.tile} ${tile.cls}`} data-tone={tile.tone}>{tile.body()}</span>
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
