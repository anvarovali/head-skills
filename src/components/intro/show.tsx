import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createRoot } from 'react-dom/client'
import clsx from 'clsx'
import { gsap, registerGsap, useGSAP } from '@/motion/easings'
import { catalog } from '@/data/catalog'
import { pick } from '@/i18n/useLocale'
import { LOCALES, LOCALE_NAMES, switchLocale, type Locale } from '@/i18n/locales'
import { HeadMark, Slash } from '@/components/ui/HeadMark'
import { INTRO_AUDIO, SEEN_KEY } from './replay'
import { KICKS, T, tick, spring, EIGHTH, BEAT } from './timing'
import s from './intro.module.css'

/* The show: language picker -> ~17.5 s keynote reveal cut to the track's beat map -> the skill cards land in the
   real marketplace grid. Lazy chunk; mounted on its own root by Intro.tsx. */

const COPY: Record<Locale, { hi: string; rest: string; tag: string; skip: string; mute: string; unmute: string; dialog: string }> = {
  uz: { hi: 'Salom', rest: 'head.uz’ga xush kelibsiz', tag: 'AI agentlaringiz uchun skill’lar', skip: 'O‘tkazib yuborish', mute: 'Ovozni o‘chirish', unmute: 'Ovozni yoqish', dialog: 'Tilni tanlang' },
  ru: { hi: 'Привет', rest: 'добро пожаловать в head.uz', tag: 'Скиллы для ваших AI‑агентов', skip: 'Пропустить', mute: 'Выключить звук', unmute: 'Включить звук', dialog: 'Выберите язык' },
  en: { hi: 'Hey', rest: 'welcome to head.uz', tag: 'Skills for your AI agents', skip: 'Skip intro', mute: 'Mute', unmute: 'Unmute', dialog: 'Choose your language' },
}
const HINT = 'Tilni tanlang · Выберите язык · Choose your language'

export interface MountOpts {
  mode: 'picker' | 'show'
  locale: Locale
  navigate: (to: string) => void
  audio?: HTMLAudioElement
  onReady?: () => void
  onClosed: () => void
}

export function mountIntro(o: MountOpts) {
  registerGsap()
  const host = document.createElement('div')
  host.id = 'hs-intro'
  document.body.appendChild(host)
  const root = createRoot(host)
  const close = () => window.setTimeout(() => { root.unmount(); host.remove(); o.onClosed() }, 0)
  root.render(<IntroShow {...o} onClose={close} />)
}

/* ---------- data ---------- */
type Folder = { id: string; title: string }
type Deal = { id: string; title: string; summary: string; cat: string; author: string; folder: number }

function deck(locale: Locale): { folders: Folder[]; deals: Deal[] } {
  const skills = [...catalog.skills].sort((a, b) => Number(!!b.featured) - Number(!!a.featured)).slice(0, 6)
  const cats: string[] = []
  for (const sk of skills) if (!cats.includes(sk.category) && cats.length < 3) cats.push(sk.category)
  const folders = cats.map((id) => ({ id, title: pick(catalog.categories.find((c) => c.id === id)?.title, locale) ?? id }))
  const deals = skills.map((sk, i) => {
    const f = cats.indexOf(sk.category)
    const folder = f >= 0 ? f : i % Math.max(1, cats.length)
    return {
      id: sk.id, title: pick(sk.title, locale) ?? sk.name, summary: pick(sk.summary, locale) ?? '',
      cat: pick(catalog.categories.find((c) => c.id === sk.category)?.title, locale) ?? sk.category,
      author: sk.author.name, folder,
    }
  })
  return { folders, deals }
}

/* ---------- layout (px offsets from the viewport centre; every stage element is centred by CSS) ---------- */
function layout(nFolders: number, nCards: number) {
  const vw = window.innerWidth, vh = window.innerHeight
  const fw = Math.min(270, Math.max(vw < 768 ? 96 : 160, vw * (vw < 768 ? 0.26 : 0.17)))
  const fgap = fw * (vw < 768 ? 1.25 : 1.7)
  const folders = Array.from({ length: nFolders }, (_, i) => ({ x: (i - (nFolders - 1) / 2) * fgap, y: vh * 0.25 }))
  const gap = Math.max(16, vw * 0.018)
  const cw0 = Math.min(nCards <= 3 ? 360 : 320, Math.max(200, vw * (nCards <= 3 ? 0.24 : 0.21)))
  const cols = Math.max(1, Math.min(nCards, Math.floor((vw * 0.9 + gap) / (cw0 + gap))))
  const cw = Math.min(cw0, (vw * 0.9 - gap * (cols - 1)) / cols)
  const ch = cw * 0.7
  const rows = Math.ceil(nCards / cols)
  const cards = Array.from({ length: nCards }, (_, i) => {
    const r = Math.floor(i / cols), c = i % cols
    const inRow = r === rows - 1 ? nCards - r * cols : cols
    return { x: (c - (inRow - 1) / 2) * (cw + gap), y: (r - (rows - 1) / 2) * (ch + gap) }
  })
  return { vw, vh, fw, folders, cards, cw, ch }
}

/* ---------- the component ---------- */
function IntroShow({ mode, locale: startLocale, navigate, audio: givenAudio, onReady, onClose }: MountOpts & { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(givenAudio ?? null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const doneRef = useRef(false)
  const hiddenCards = useRef<HTMLElement[]>([])
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [phase, setPhase] = useState<'picker' | 'show'>(mode)
  const [locale, setLocale] = useState<Locale>(startLocale)
  const [muted, setMuted] = useState(reduced)
  const fromPicker = useRef(mode === 'picker')
  const copy = COPY[locale]
  const { folders, deals } = useMemo(() => deck(locale), [locale])
  const cmd = `npx skills add ${catalog.repo.owner}/${catalog.repo.name}`

  // lock the page underneath; hand focus to the dialog
  useLayoutEffect(() => {
    const html = document.documentElement
    const prevOverflow = html.style.overflow
    html.style.overflow = 'hidden'
    const app = document.getElementById('root')
    if (app) app.inert = true
    onReady?.()
    return () => { html.style.overflow = prevOverflow; if (app) app.inert = false }
  }, [onReady])

  useEffect(() => {
    if (!audioRef.current) { const a = new Audio(INTRO_AUDIO); a.preload = 'auto'; audioRef.current = a }
    if (reduced && audioRef.current) audioRef.current.muted = true
    return () => { const a = audioRef.current; if (a && !doneRef.current) a.pause() }
  }, [reduced])

  const restoreCards = () => { for (const el of hiddenCards.current) { el.style.opacity = ''; el.style.transition = '' } hiddenCards.current = [] }

  const finish = (fast: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    try { window.localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode */ }
    const a = audioRef.current
    if (fast) {
      tlRef.current?.pause()
      if (a) gsap.to(a, { volume: 0, duration: 0.45, ease: 'none', onComplete: () => a.pause() })
      restoreCards()
      gsap.to(rootRef.current, { opacity: 0, duration: reduced ? 0.2 : 0.35, ease: 'power2.out', onComplete: onClose })
    } else {
      restoreCards()
      onClose()
      // let the last hit ring out, then free the element
      if (a) a.addEventListener('ended', () => a.removeAttribute('src'), { once: true })
    }
  }
  const finishRef = useRef(finish)
  useEffect(() => { finishRef.current = finish })

  // Esc skips, always
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') finishRef.current(true) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const choose = (l: Locale) => {
    if (phase !== 'picker') return
    try { window.localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode */ }
    const a = audioRef.current
    // the click is the gesture that unlocks audio; play() must be called right here, synchronously
    if (a && !reduced) { a.currentTime = 0; a.play().catch(() => setMuted(true)) }
    const target = switchLocale(window.location.pathname, l)
    if (target !== window.location.pathname || window.location.search) navigate(target)
    setLocale(l)
    setPhase('show')
  }

  const toggleMute = () => {
    const a = audioRef.current
    if (!a) return
    const next = !muted
    a.muted = next
    if (!next && a.paused) {
      const t = tlRef.current?.time() ?? 0
      a.currentTime = reduced ? 0 : t
      a.play().catch(() => {})
    }
    setMuted(next)
  }

  const onOptionsKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const btns = Array.from(e.currentTarget.querySelectorAll('button'))
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    const n = e.key === 'ArrowDown' ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length
    btns[n]?.focus()
  }

  /* picker entrance */
  useGSAP(() => {
    if (mode !== 'picker') return
    const q = gsap.utils.selector(rootRef)
    const first = q('[data-option]')[0] as HTMLButtonElement | undefined
    first?.focus({ focusVisible: false } as FocusOptions)
    if (reduced) { gsap.fromTo(q('[data-picker] > *'), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'none' }); return }
    gsap.fromTo(q('[data-pmark]'), { opacity: 0, y: -12 }, { opacity: 1, y: 0, ...spring(1, 0.6), delay: 0.1 })
    gsap.fromTo(q('[data-option]'), { opacity: 0, y: 36 }, { opacity: 1, y: 0, ...spring(1, 0.62), stagger: 0.07, delay: 0.18 })
    gsap.fromTo(q('[data-hint]'), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out', delay: 0.55 })
  }, { scope: rootRef })

  /* the show */
  useGSAP(() => {
    if (phase !== 'show') return
    const q = gsap.utils.selector(rootRef)
    const L = layout(folders.length, deals.length)
    const tl = gsap.timeline({ paused: true })
    tlRef.current = tl
    const one = (sel: string) => q(sel)[0] as HTMLElement | undefined

    const picker = one('[data-picker]'), greet = one('[data-greet]'), brand = one('[data-brand]'), line = one('[data-line]')
    const skillsWord = one('[data-skills]'), tag = one('[data-tag]'), light = one('[data-light]'), ground = one('[data-ground]')
    const glyphs = ['H', 'E', 'slash', 'A', 'D'].map((g) => one(`[data-line] [data-glyph="${g}"]`))
    const uz = one('[data-uz]'), cmdEl = one('[data-cmd]'), controls = one('[data-controls]')
    const backs = q('[data-fback]'), fronts = q('[data-ffront]'), cards = q('[data-card]') as HTMLElement[]
    const chosenBtn = one(`[data-option="${locale}"]`)
    const otherBtns = q('[data-option]').filter((b) => b !== chosenBtn)
    rootRef.current?.style.setProperty('--cw', `${L.cw}px`)
    rootRef.current?.style.setProperty('--fw', `${L.fw}px`)

    if (reduced) {
      // reduced motion: short opacity cross-fades, nothing travels
      if (fromPicker.current) tl.to(picker!, { opacity: 0, duration: 0.3, ease: 'none' }, 0)
      tl.set([greet, brand], { opacity: 0 }, 0)
      tl.set(q('[data-hi], [data-rest] > span'), { opacity: 1 }, 0)
      tl.to(greet!, { opacity: 1, duration: 0.35, ease: 'none' }, 0.3)
      tl.to(greet!, { opacity: 0, duration: 0.3, ease: 'none' }, 2.1)
      tl.set([skillsWord, uz, ...glyphs, tag], { opacity: 1 }, 0)
      tl.to(brand!, { opacity: 1, duration: 0.35, ease: 'none' }, 2.4)
      tl.to([ground, brand, controls], { opacity: 0, duration: 0.5, ease: 'none' }, 4.2)
      tl.add(() => finishRef.current(false), 4.75)
      tl.play(0)
      return
    }

    /* 0 — the picker gives way (only when we came from it) */
    if (fromPicker.current && picker) {
      tl.to(otherBtns, { opacity: 0, y: 18, duration: 0.32, ease: 'power2.in', stagger: 0.03 }, 0)
      tl.to(q('[data-pmark], [data-hint]'), { opacity: 0, duration: 0.25, ease: 'power1.in' }, 0)
      tl.to(chosenBtn ?? [], { opacity: 0, scale: 0.9, duration: 0.42, ease: 'power2.in' }, 0.08)
      tl.set(picker, { autoAlpha: 0 }, 0.55)
    } else if (picker) {
      tl.set(picker, { autoAlpha: 0 }, 0)
    }

    /* 1 — greeting (riser, 0–3.4 s) */
    const hi = one('[data-hi]'), words = q('[data-rest] > span')
    tl.fromTo(hi!, { opacity: 0, y: '0.14em', scale: 0.965 }, { opacity: 1, y: 0, scale: 1, ...spring(1, 0.7) }, 0.42)
    tl.fromTo(words, { opacity: 0, y: 22 }, { opacity: 1, y: 0, ...spring(1, 0.6), stagger: EIGHTH / 2 }, tick(-3))
    tl.to(greet!, { opacity: 0, scale: 0.97, duration: 0.42, ease: 'power2.in' }, tick(4) - 0.42)

    /* 2 — the wordmark builds glyph by glyph on the 8ths, then a slow push-in rides the riser */
    const skillsW = skillsWord?.getBoundingClientRect().width ?? 0
    tl.set(line!, { x: -skillsW / 2 }, 0) // centre HEAD.uz alone while "skills." is hidden
    tl.set(skillsWord!, { opacity: 0 }, 0)
    // glyphs arrive spread wide (SVG user units; the mark is 113 wide) and are pulled together by the riser,
    // locking into the wordmark exactly on the drop
    // H, E, slash, A, D — the slash is the A's left leg, so those two travel together
    const spread = [-26, -13, 0, 0, 13]
    const unit = (one('[data-line] svg')?.getBoundingClientRect().height ?? 45.8) / 45.7984 // px per SVG unit
    glyphs.forEach((g, i) => {
      if (!g) return
      const at = tick(6 + i)
      if (i === 2) tl.fromTo(g, { opacity: 0, x: 9, y: -26 }, { opacity: 1, x: 0, y: 0, ...spring(1, 0.45) }, at)
      else tl.fromTo(g, { opacity: 0, x: spread[i], yPercent: 22 }, { opacity: 1, x: spread[i], yPercent: 0, ...spring(1, 0.5) }, at)
    })
    const uzEl = uz!
    tl.fromTo(uzEl, { opacity: 0, x: 26 * unit + 16 }, { opacity: 1, x: 26 * unit, ...spring(1, 0.5) }, tick(12))
    const pull = T.drop - tick(13)
    glyphs.forEach((g, i) => { if (g && i !== 2) tl.to(g, { x: 0, duration: pull, ease: 'power3.in' }, tick(13)) })
    tl.to(uzEl, { x: 0, duration: pull, ease: 'power3.in' }, tick(13))
    tl.fromTo(light!, { opacity: 0, scale: 0.7 }, { opacity: 0.55, scale: 1, duration: T.drop - tick(8), ease: 'sine.in' }, tick(8))
    tl.fromTo(line!, { scale: 0.94 }, { scale: 1.1, duration: T.drop - tick(8), ease: 'sine.in' }, tick(8) - 0.01)

    /* 3 — THE DROP: "skills." lands, the line recentres with a physical overshoot, the light blooms and decays */
    tl.fromTo(skillsWord!, { opacity: 0, x: '-0.45em', scale: 0.92 }, { opacity: 1, x: 0, scale: 1, ...spring(0.72, 0.42) }, T.drop - 0.04)
    tl.to(line!, { x: 0, scale: 1, ...spring(0.72, 0.42) }, T.drop - 0.04)
    tl.set(light!, { opacity: 1, scale: 1.12 }, T.drop)
    tl.to(light!, { opacity: 0.32, scale: 1, duration: 1.6, ease: 'expo.out' }, T.drop + 0.02)
    tl.fromTo(tag!, { opacity: 0, y: 18 }, { opacity: 1, y: 0, ...spring(1, 0.55) }, KICKS[2])

    /* 4 — bar 2: the title lifts away, folders fly in from depth, one per kick */
    tl.to(tag!, { opacity: 0, duration: 0.3, ease: 'power1.in' }, T.bar2 - 0.45)
    tl.to(brand!, { y: -L.vh * 0.36, scale: 0.36, ...spring(1, 0.62) }, T.bar2 - 0.3)
    tl.to(light!, { opacity: 0.18, y: L.vh * 0.2, duration: 1.2, ease: 'power2.inOut' }, T.bar2 - 0.3)
    L.folders.forEach((p, i) => {
      const at = KICKS[4 + i] - 0.3
      const pair = [backs[i], fronts[i]]
      tl.fromTo(pair, { opacity: 0, x: p.x * 0.35, y: p.y - L.vh * 0.1, scale: 0.12, rotation: (i - 1) * -9 },
        { opacity: 1, x: p.x, y: p.y, scale: 1, rotation: 0, ...spring(0.78, 0.5) }, at)
    })
    // the fronts swing open toward you on the next kick
    tl.to(fronts, { rotationX: -34, transformPerspective: 700, transformOrigin: '50% 100%', ...spring(0.8, 0.42), stagger: 0.05 }, KICKS[7] - 0.04)

    /* 5 — bar 3: a card is dealt out of its folder on each kick (8ths when the deck is large) */
    const step = deals.length > 4 ? EIGHTH : BEAT
    deals.forEach((d, j) => {
      const card = cards[j], f = L.folders[d.folder], slot = L.cards[j]
      if (!card || !f) return
      const at = T.bar3 + j * step
      const lift = f.y - L.fw * 0.36
      tl.set(card, { x: f.x, y: f.y + L.fw * 0.05, scale: 0.5, rotation: 0, opacity: 1, zIndex: 2 }, at - 0.34)
      tl.to(card, { y: lift, duration: 0.3, ease: 'power2.out' }, at - 0.34)
      tl.set(card, { zIndex: 4 + j }, at - 0.02)
      tl.fromTo(card, { rotation: (slot.x - f.x) > 0 ? 7 : -7 }, { x: slot.x, y: slot.y - L.vh * 0.04, scale: 1, rotation: 0, ...spring(0.8, 0.5) }, at - 0.02)
    })

    /* 6 — bar 4: folders sink, cards settle to centre, the install line types itself */
    tl.to(fronts, { rotationX: 0, duration: 0.3, ease: 'power2.in' }, T.bar4 - 0.3)
    tl.to([...backs, ...fronts], { opacity: 0, y: `+=${L.vh * 0.16}`, scale: 0.86, duration: 0.55, ease: 'power2.in', stagger: 0.03 }, T.bar4 - 0.1)
    cards.forEach((c, j) => {
      const slot = L.cards[j]
      if (slot) tl.to(c, { y: slot.y - L.vh * 0.02, ...spring(1, 0.6) }, T.bar4)
    })
    const chars = q('[data-cmd] [data-ch]')
    const cmdY = Math.min(L.vh * 0.3, (L.cards.at(-1)?.y ?? 0) + L.ch / 2 + 64)
    tl.fromTo(cmdEl!, { opacity: 0, y: cmdY + 14 }, { opacity: 1, y: cmdY, ...spring(1, 0.5) }, KICKS[13])
    tl.to(chars, { opacity: 1, duration: 0.01, stagger: Math.min(0.035, 1.05 / Math.max(1, chars.length)), ease: 'none' }, KICKS[13] + 0.12)

    /* 7 — bar 5, finale: the stage dissolves and the cards travel to their seats in the real grid, landing on the last kick */
    tl.to([brand, cmdEl, controls], { opacity: 0, y: '-=10', duration: 0.4, ease: 'power2.in' }, T.bar5)
    tl.to(light!, { opacity: 0, duration: 0.8, ease: 'power1.out' }, T.bar5)
    tl.to(ground!, { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, T.bar5 + 0.05)
    tl.add(() => {
      const grid = document.querySelector('[data-grid]')
      const sub = gsap.timeline()
      const land = T.lastKick - (T.bar5 + 0.2)
      cards.forEach((c, j) => {
        const id = deals[j]?.id
        const real = grid && id ? grid.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`) : null
        const r = real?.getBoundingClientRect()
        const visible = r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight
        if (!real || !r || !visible) {
          sub.to(c, { opacity: 0, scale: grid ? 0.9 : 1.04, y: grid ? '+=24' : '-=24', duration: 0.7, ease: 'power2.inOut' }, 0.15 + j * 0.04)
          return
        }
        real.style.opacity = '0'
        hiddenCards.current.push(real)
        const x = r.left + r.width / 2 - L.vw / 2, y = r.top + r.height / 2 - L.vh / 2
        sub.to(c, { x, y, scaleX: r.width / L.cw, scaleY: r.height / L.ch, rotation: 0, ...spring(1, 0.72) }, 0.2 + j * 0.06)
        // hand over to the real card on the last kick: it fades in under ours, ours lets go
        sub.add(() => { real.style.transition = 'opacity .2s ease-out'; real.style.opacity = '1' }, land - 0.12)
        sub.to(c, { opacity: 0, duration: 0.16, ease: 'power1.in' }, land - 0.04)
      })
      tl.add(sub, T.bar5 + 0.02)
    }, T.bar5)
    tl.add(() => finishRef.current(false), T.stop + 0.1)

    /* clock: the music is the master. Start with the audio; correct drift if the tab stalls. */
    const a = audioRef.current
    const audioLive = () => !!a && !a.paused && !a.ended && a.currentTime > 0
    tl.play(audioLive() && !fromPicker.current ? a!.currentTime : 0)
    let aligned = false
    const onTick = () => {
      if (!a || !audioLive() || doneRef.current) return
      const drift = a.currentTime - tl.time()
      if (!aligned) {
        aligned = true
        // first real audio frame: pull the audio to the picture (a ~100 ms seek in the quiet riser is inaudible)
        if (Math.abs(drift) > 0.04 && tl.time() < 6) { a.currentTime = tl.time(); return }
      }
      if (Math.abs(drift) > 0.12 && a.currentTime < T.stop) tl.time(a.currentTime)
    }
    gsap.ticker.add(onTick)
    if (import.meta.env.DEV) (window as unknown as { __hsIntro?: unknown }).__hsIntro = { time: () => tl.time() }
    return () => { gsap.ticker.remove(onTick); restoreCards() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, { scope: rootRef, dependencies: [phase] })

  const isRu = locale === 'ru'
  return (
    <div ref={rootRef} className={clsx(s.root, isRu && s.ru)} role="dialog" aria-modal="true" aria-label={copy.dialog}>
      <div className={s.ground} data-ground />
      <div className={s.light} data-light />

      <div className={s.stage} aria-hidden={phase === 'picker'}>
        {phase === 'show' && <p className="sr-only" aria-live="polite">{`${copy.hi} — ${copy.rest}. skills.head.uz — ${copy.tag}.`}</p>}
        <div className={s.fill}>
          <div className={s.greet} data-greet aria-hidden="true">
            <div className={s.hi} data-hi style={{ opacity: 0 }}>{copy.hi}</div>
            <div className={s.rest} data-rest>
              {copy.rest.split(' ').map((w, i) => <span key={i} className={s.word} style={{ opacity: 0 }}>{w}</span>)}
            </div>
          </div>
        </div>
        <div className={s.fill}>
          <div className={s.brand} data-brand aria-hidden="true">
            <div className={s.line} data-line>
              <span className={s.word} data-skills style={{ opacity: 0 }}>skills.</span>
              <HeadMark className={s.mark} slashClassName={s.slashBlue} />
              <span className={s.word} data-uz style={{ opacity: 0 }}>.uz</span>
            </div>
            <div className={s.tag} data-tag style={{ opacity: 0 }}>{copy.tag}</div>
          </div>
        </div>

        {folders.map((f) => (
          <div key={f.id} className={s.fBack} data-fback aria-hidden="true">
            <span className={s.fShadow} />
            <FolderBack />
            <span className={s.fCap}>{f.title}</span>
          </div>
        ))}
        {deals.map((d) => (
          <div key={d.id} className={s.card} data-card aria-hidden="true">
            <span className={s.cardCat}>{d.cat}</span>
            <span className={s.cardTitle}>{d.title}</span>
            <span className={s.cardSum}>{d.summary}</span>
            <span className={s.cardFoot}><span>{d.author}</span><Slash className={s.cardSlash} /></span>
          </div>
        ))}
        {folders.map((f) => (
          <div key={f.id} className={s.fFront} data-ffront aria-hidden="true">
            <div className={s.flap}><Slash className={s.emboss} /></div>
          </div>
        ))}

        <div className={s.fill}>
          <div className={s.cmd} data-cmd aria-hidden="true">
            <span className={s.cmdPrompt}>$</span>
            <span>{Array.from(cmd).map((ch, i) => <span key={i} className={s.ch} data-ch>{ch === ' ' ? ' ' : ch}</span>)}</span>
          </div>
        </div>
      </div>

      {phase === 'picker' || mode === 'picker' ? (
        <div className={s.picker} data-picker>
          <div className={s.pickerInner}>
            <div data-pmark><HeadMark className={s.pickerMark} slashClassName={s.slashBlue} title="HEAD" /></div>
            <div className={s.options} role="group" aria-label={HINT} onKeyDown={onOptionsKey}>
              {LOCALES.map((l) => (
                <button key={l} type="button" lang={l} data-option={l} className={clsx(s.option, l === 'ru' && s.optionRu)}
                  onClick={() => choose(l)} disabled={phase !== 'picker'}>
                  {LOCALE_NAMES[l]}
                  <span className={s.go} aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none"><path d="M3 8h9m-3.5-4L12.5 8 8.5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </button>
              ))}
            </div>
            <p className={s.hint} data-hint>{HINT}</p>
          </div>
        </div>
      ) : null}

      <div className={s.controls} data-controls>
        {phase === 'show' && (
          <button type="button" className={clsx(s.ctl, s.ctlRound)} onClick={toggleMute} aria-pressed={muted} aria-label={muted ? copy.unmute : copy.mute}>
            {muted ? <SpeakerOff /> : <SpeakerOn />}
          </button>
        )}
        <button type="button" className={s.ctl} onClick={() => finish(true)}>{copy.skip}</button>
      </div>
    </div>
  )
}

/* ---------- drawn bits ---------- */
function FolderBack() {
  const id = useMemo(() => `fb${Math.random().toString(36).slice(2, 8)}`, [])
  return (
    <svg viewBox="0 0 200 156" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f55ff" />
          <stop offset="1" stopColor="#0019b8" />
        </linearGradient>
      </defs>
      <path d="M12 8h50c5 0 8 2 11 6l6 8h109a12 12 0 0 1 12 12v110a12 12 0 0 1-12 12H12A12 12 0 0 1 0 144V20A12 12 0 0 1 12 8z" fill={`url(#${id})`} />
      <path d="M12 8h50c5 0 8 2 11 6l6 8h109a12 12 0 0 1 12 12" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.2" />
      <rect x="14" y="30" width="172" height="100" rx="6" fill="#dfe5ff" />
      <rect x="10" y="38" width="180" height="100" rx="6" fill="#f4f6ff" />
    </svg>
  )
}
function SpeakerOn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
  )
}
function SpeakerOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" /><path d="M16 9.5l5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
  )
}
