import { Slash } from '@/components/ui/HeadMark'
import { useT } from '@/i18n/useLocale'
import { CategoryGlyph } from './icons'
import { SearchBox } from './SearchBox'
import s from './Hero.module.css'

/* The six tilted tiles around the title: qoder's composition (offsets measured at 1440), our category glyphs, and one
   solid blue tile carrying the HEAD slash where qoder puts its one colourful icon. */
const TILES = [
  { k: 'frontend', cls: s.t1 },
  { k: 'sparkle', cls: s.t2 },
  { k: 'slash', cls: s.t3 },
  { k: 'terminal', cls: s.t4 },
  { k: 'design', cls: s.t5 },
  { k: 'workflow', cls: s.t6 },
] as const

export function Hero({ q, onSearch }: { q: string; onSearch: (q: string) => void }) {
  const t = useT()
  return (
    <section className={s.hero}>
      <div className={s.inner}>
        <div className={s.titleWrap}>
          <div className={s.tiles} aria-hidden="true">
            {TILES.map((tile) => (
              <span key={tile.k} className={`${s.tile} ${tile.cls}`}>
                {tile.k === 'slash' ? <Slash className={s.slash} /> : <CategoryGlyph id={tile.k} size={18} />}
              </span>
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
