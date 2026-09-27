import type { ReactNode } from 'react'
import { catalog } from '@/data/catalog'
import { Slash } from '@/components/ui/HeadMark'
import { useT } from '@/i18n/useLocale'
import { CategoryGlyph } from './icons'
import { SearchBox } from './SearchBox'
import s from './Hero.module.css'

/* Small, scattered, mostly neutral (qoder's tiles are 36-52px at 1440): two real skill marks, three white glyph tiles
   and one blue accent, each at its own size, angle and height, all at least ~60px off the headline. */
const icons = catalog.skills.filter((k) => k.icon).map((k) => k.icon!)
const skillTile = (i: number, fallback: string): ReactNode =>
  icons[i] ? <img src={icons[i]} alt="" /> : <CategoryGlyph id={fallback} size={22} />

const TILES: { cls: string; tone?: 'blue' | 'far'; body: () => ReactNode }[] = [
  { cls: s.a, body: () => skillTile(0, 'design') },
  { cls: s.b, tone: 'far', body: () => <CategoryGlyph id="sparkle" size={17} /> },
  { cls: s.c, tone: 'blue', body: () => <Slash className={s.slash} /> },
  { cls: s.d, body: () => skillTile(1, 'workflow') },
  { cls: s.e, tone: 'far', body: () => <CategoryGlyph id="terminal" size={16} /> },
  { cls: s.f, body: () => <CategoryGlyph id="frontend" size={15} /> },
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
