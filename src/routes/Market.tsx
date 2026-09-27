import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { catalog } from '@/data/catalog'
import { pick, useLocale, useT } from '@/i18n/useLocale'
import { Hero } from '@/components/market/Hero'
import { getItems, matches, sortItems, sourceOf, SOURCES, type Item, type Sort } from '@/components/market/items'
import { Check, CtaBand, Empty, Facet, Grid, Pager, Pills, SectionHead, Segmented } from '@/components/market/parts'
import s from '@/components/market/Market.module.css'

type Tab = 'all' | 'skills' | 'bundles'
const TABS: Tab[] = ['all', 'skills', 'bundles']
const PAGE = 24
const PREVIEW = 8

/** The marketplace list. All state lives in the URL: ?tab= ?q= ?cat= (comma list) ?src= ?sort= ?page= */
export function Market() {
  const t = useT()
  const locale = useLocale()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'all') as Tab
  const q = params.get('q') ?? ''
  const sort: Sort = params.get('sort') === 'latest' ? 'latest' : 'featured'
  const cats = (params.get('cat') ?? '').split(',').filter(Boolean)
  const srcs = (params.get('src') ?? '').split(',').filter(Boolean)
  const page = Math.max(1, Number(params.get('page')) || 1)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace: true, preventScrollReset: true })
  }
  const tabLink = (to: Tab) => {
    const next = new URLSearchParams()
    if (to !== 'all') next.set('tab', to)
    if (q) next.set('q', q)
    for (const k of ['intro', 'demo']) if (params.has(k)) next.set(k, params.get(k)!)
    const qs = next.toString()
    return qs ? `?${qs}` : '?'
  }

  const all = useMemo(getItems, [])
  const found = useMemo(() => ({
    skills: all.skills.filter((it) => matches(it, q, locale)),
    bundles: all.bundles.filter((it) => matches(it, q, locale)),
  }), [all, q, locale])

  const toggle = (key: 'cat' | 'src', list: string[], v: string) =>
    set({ [key]: (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]).join(',') || null })
  const resetAll = () => set({ cat: null, src: null, q: null })

  const byFacets = (it: Item) => (!cats.length || cats.includes(it.category ?? '')) && (!srcs.length || srcs.includes(sourceOf(it)))

  return (
    <>
      <Hero q={q} onSearch={(v) => set({ q: v || null })} />
      <div className={s.body}>
        <div className={s.container}>
          <nav className={s.tabs} aria-label={t('nav.marketplace')}>
            {TABS.map((k) => (
              <Link key={k} to={tabLink(k)} replace preventScrollReset className={s.tab} aria-current={k === tab ? 'page' : undefined}>
                {t(`tab.${k}`)}
              </Link>
            ))}
          </nav>

          {q ? (
            <div className={s.resultsFor}>
              <span>{t('search.results', { q })}</span>
              <button type="button" className={s.linkBtn} onClick={() => set({ q: null })}>{t('search.clear')}</button>
            </div>
          ) : null}

          {tab === 'all' ? (
            found.skills.length + found.bundles.length === 0 ? <Empty onReset={resetAll} /> : (
              <div className={s.sections}>
                {found.skills.length ? (
                  <section>
                    <SectionHead title={t('tab.skills')} count={found.skills.length}
                      more={{ to: tabLink('skills'), label: t('section.viewAll') }} />
                    <Grid items={sortItems(found.skills, 'featured', locale).slice(0, PREVIEW)} />
                  </section>
                ) : null}
                {found.bundles.length ? (
                  <section>
                    <SectionHead title={t('tab.bundles')} count={found.bundles.length} more={{ to: tabLink('bundles'), label: t('section.viewAll') }} />
                    <Grid items={sortItems(found.bundles, 'featured', locale).slice(0, PREVIEW)} />
                  </section>
                ) : null}
              </div>
            )
          ) : tab === 'skills' ? (
            <SkillsView items={found.skills} cats={cats} srcs={srcs} sort={sort} page={page} byFacets={byFacets}
              onCat={(v) => toggle('cat', cats, v)} onCats={(v) => set({ cat: v })} onSrc={(v) => toggle('src', srcs, v)}
              onSort={(v) => set({ sort: v === 'featured' ? null : v })} onPage={(p) => set({ page: p > 1 ? String(p) : null })}
              onReset={resetAll} />
          ) : (
            <ListView items={found.bundles} title={t('tab.all')} sort={sort} page={page}
              onSort={(v) => set({ sort: v === 'featured' ? null : v })} onPage={(p) => set({ page: p > 1 ? String(p) : null })}
              onReset={resetAll} />
          )}
        </div>
        <CtaBand />
      </div>
    </>
  )
}

function SkillsView({ items, cats, srcs, sort, page, byFacets, onCat, onCats, onSrc, onSort, onPage, onReset }: {
  items: Item[]; cats: string[]; srcs: string[]; sort: Sort; page: number; byFacets: (it: Item) => boolean
  onCat: (v: string) => void; onCats: (v: string | null) => void; onSrc: (v: string) => void; onSort: (v: Sort) => void
  onPage: (p: number) => void; onReset: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const filtered = items.filter(byFacets)
  // a Featured row only earns its place when it is a subset of a longer list; otherwise it just repeats it
  const featuredAll = items.filter((it) => it.featured)
  const showFeatured = !cats.length && !srcs.length && items.length > 8 && featuredAll.length < items.length
  const featured = showFeatured ? sortItems(featuredAll, 'featured', locale).slice(0, 8) : []
  const pages = Math.ceil(filtered.length / PAGE)
  const shown = sortItems(filtered, sort, locale).slice((page - 1) * PAGE, page * PAGE)
  const catCount = (id: string) => items.filter((it) => it.category === id && (!srcs.length || srcs.includes(sourceOf(it)))).length
  const srcCount = (id: string) => items.filter((it) => sourceOf(it) === id && (!cats.length || cats.includes(it.category ?? ''))).length
  const pillValue = cats.length === 1 ? cats[0] : cats.length ? '__multi' : ''

  return (
    <div className={s.split}>
      <aside className={s.side}>
        <Facet title={t('filter.category')}>
          {catalog.categories.filter((c) => catCount(c.id) > 0 || cats.includes(c.id)).map((c) => (
            <Check key={c.id} label={pick(c.title, locale) ?? c.id} count={catCount(c.id)} checked={cats.includes(c.id)} onChange={() => onCat(c.id)} />
          ))}
        </Facet>
        <Facet title={t('filter.source')}>
          {SOURCES.filter((id) => srcCount(id) > 0 || srcs.includes(id)).map((id) => (
            <Check key={id} label={t(`source.${id}`)} count={srcCount(id)} checked={srcs.includes(id)} onChange={() => onSrc(id)} />
          ))}
        </Facet>
      </aside>
      <div className={s.main}>
        {featured.length ? (
          <section className={s.block}>
            <SectionHead title={t('list.featured')} />
            <Grid items={featured} wide={false} />
          </section>
        ) : null}
        <section className={s.block}>
          <SectionHead title={t('tab.all')} count={filtered.length} />
          <div className={s.toolbar}>
            <Pills label={t('filter.category')} value={pillValue}
              options={[{ value: '', label: t('filter.allCategories') }, ...catalog.categories.filter((c) => items.some((it) => it.category === c.id) || cats.includes(c.id)).map((c) => ({ value: c.id, label: pick(c.title, locale) ?? c.id }))]}
              onChange={(v) => onCats(v || null)} />
            <Segmented label="Sort" value={sort} onChange={onSort}
              options={[{ value: 'featured', label: t('sort.featured') }, { value: 'latest', label: t('sort.latest') }]} />
          </div>
          {shown.length ? <Grid items={shown} wide={false} /> : <Empty onReset={onReset} />}
          <Pager page={page} pages={pages} onPage={onPage} />
        </section>
      </div>
    </div>
  )
}

function ListView({ items, title, sort, page, onSort, onPage, onReset }: {
  items: Item[]; title: string; sort: Sort; page: number; onSort: (v: Sort) => void; onPage: (p: number) => void; onReset: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const pages = Math.ceil(items.length / PAGE)
  const shown = sortItems(items, sort, locale).slice((page - 1) * PAGE, page * PAGE)
  return (
    <section className={s.block}>
      <div className={s.listHead}>
        <SectionHead title={title} count={items.length} />
        <Segmented label="Sort" value={sort} onChange={onSort}
          options={[{ value: 'featured', label: t('sort.featured') }, { value: 'latest', label: t('sort.latest') }]} />
      </div>
      {shown.length ? <Grid items={shown} /> : <Empty onReset={onReset} />}
      <Pager page={page} pages={pages} onPage={onPage} />
    </section>
  )
}
