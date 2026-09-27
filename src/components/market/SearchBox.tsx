import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { pick, useHref, useLocale, useT } from '@/i18n/useLocale'
import { CloseIcon, SearchIcon } from './icons'
import { ItemIcon } from './ExtensionCard'
import { getItems, itemHref, matches, type Item } from './items'
import s from './SearchBox.module.css'

/** Hero search. Typing opens an autocomplete (up to 5 per type); Enter with no row picked filters the page (?q=). */
export function SearchBox({ value, onSubmit }: { value: string; onSubmit: (q: string) => void }) {
  const t = useT()
  const locale = useLocale()
  const href = useHref()
  const navigate = useNavigate()
  const listId = useId()
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => { setText(value) }, [value])
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const groups = useMemo(() => {
    const q = text.trim()
    if (!q) return []
    const { skills, bundles } = getItems()
    return ([['tab.skills', skills], ['tab.bundles', bundles]] as const)
      .map(([label, list]) => ({ label, rows: list.filter((it) => matches(it, q, locale)).slice(0, 5) }))
      .filter((g) => g.rows.length)
  }, [text, locale])
  const flat: Item[] = groups.flatMap((g) => g.rows)
  const showList = open && text.trim().length > 0

  const go = (it: Item) => { setOpen(false); navigate(href(itemHref(it))) }
  const submit = () => {
    if (active >= 0 && flat[active]) return go(flat[active])
    setOpen(false)
    onSubmit(text.trim())
  }

  return (
    <div className={s.wrap} ref={wrap}>
      <form role="search" className={s.box} onSubmit={(e) => { e.preventDefault(); submit() }}>
        <SearchIcon size={20} className={s.glass} />
        <input
          className={s.input} type="search" value={text} placeholder={t('search.placeholder')} aria-label={t('search.placeholder')}
          role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined} autoComplete="off" spellCheck={false}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && flat.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % flat.length) }
            else if (e.key === 'ArrowUp' && flat.length) { e.preventDefault(); setActive((a) => (a <= 0 ? flat.length - 1 : a - 1)) }
            else if (e.key === 'Escape') { setOpen(false); setActive(-1) }
          }}
        />
        {text ? (
          <button type="button" className={s.clear} aria-label={t('search.clear')}
            onClick={() => { setText(''); setActive(-1); onSubmit('') }}>
            <CloseIcon size={14} />
          </button>
        ) : null}
      </form>
      {showList ? (
        <div className={s.pop} id={listId} role="listbox">
          {groups.length === 0 ? (
            <div className={s.none}>{t('empty.title')}</div>
          ) : groups.map((g) => (
            <div key={g.label} className={s.group} role="group" aria-label={t(g.label)}>
              <div className={s.groupLabel}>{t(g.label)}</div>
              {g.rows.map((it) => {
                const i = flat.indexOf(it)
                return (
                  <div key={it.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                    className={s.row} data-active={i === active || undefined}
                    onPointerEnter={() => setActive(i)} onPointerDown={(e) => e.preventDefault()} onClick={() => go(it)}>
                    <ItemIcon item={it} className={s.rowIcon} />
                    <span className={s.rowTitle}>{pick(it.title, locale)}</span>
                    <span className={s.rowSub}>{pick(it.summary, locale)}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
