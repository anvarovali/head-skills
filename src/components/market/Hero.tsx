import type { ReactNode } from 'react'
import { catalog } from '@/data/catalog'
import { Slash } from '@/components/ui/HeadMark'
import { useT } from '@/i18n/useLocale'
import { CategoryGlyph } from './icons'
import { SearchBox } from './SearchBox'
import s from './Hero.module.css'

/* The orbit around the headline: two real skill marks up close (big, crisp), two glyph tiles further back (small,
   softened), and two solid blue marks riding over the ends of the line. Left and right carry the same weight. */
const icons = catalog.skills.filter((k) => k.icon).map((k) => k.icon!)
const skillTile = (i: number, fallback: string): ReactNode =>
  icons[i] ? <img src={icons[i]} alt="" /> : <CategoryGlyph id={fallback} size={26} />

const TILES: { cls: string; tone?: 'blue' | 'far'; body: () => ReactNode }[] = [
  { cls: s.l1, body: () => skillTile(0, 'design') },
  { cls: s.l2, tone: 'far', body: () => <CategoryGlyph id="sparkle" size={18} /> },
  { cls: s.l3, tone: 'blue', body: () => <Slash className={s.slash} /> },
  { cls: s.r1, body: () => skillTile(1, 'workflow') },
  { cls: s.r2, tone: 'far', body: () => <CategoryGlyph id="terminal" size={18} /> },
  { cls: s.r3, tone: 'blue', body: () => <CategoryGlyph id="frontend" size={20} strokeWidth={2.2} /> },
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
