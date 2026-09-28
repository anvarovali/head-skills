import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import clsx from 'clsx'
import { gsap, registerGsap, useGSAP } from '@/motion/easings'
import { catalog, categoryTitle } from '@/data/catalog'
import { chrome } from '@/content/chrome'
import { LocaleContext, pick } from '@/i18n/useLocale'
import { LOCALES, LOCALE_NAMES, switchLocale, type Locale } from '@/i18n/locales'
import { HeadMark, Slash } from '@/components/ui/HeadMark'
import { ExtensionCard } from '@/components/market/ExtensionCard'
import { AgentLogo, type Agent } from '@/components/market/agentLogos'
import { getItems } from '@/components/market/items'
import { INTRO_OFFSET, SEEN_KEY, introAudio, type IntroVariant } from './replay'
import { KICKS, T, spring, EIGHTH, BEAT } from './timing'
import s from './intro.module.css'

/* The show: language picker -> ~17.5 s keynote reveal cut to the track's beat map -> the real cards land in the
   real marketplace grid. Lazy chunk; mounted on its own root by Intro.tsx. */

const COPY: Record<Locale, { hi: string; rest: string; tag: string; cmd: string; done: string; skip: string; mute: string; unmute: string; dialog: string }> = {
  uz: { hi: 'Salom', rest: 'head.uzʼga xush kelibsiz', tag: 'AI agentlaringiz uchun skillʼlar', cmd: 'Bitta buyruq bilan oʻrnating', done: 'oʻrnatildi', skip: 'Oʻtkazib yuborish', mute: 'Ovozni oʻchirish', unmute: 'Ovozni yoqish', dialog: 'Tilni tanlang' },
  ru: { hi: 'Привет', rest: 'добро пожаловать в head.uz', tag: 'Скиллы для ваших AI‑агентов', cmd: 'Установка одной командой', done: 'установлены', skip: 'Пропустить', mute: 'Выключить звук', unmute: 'Включить звук', dialog: 'Выберите язык' },
  en: { hi: 'Hey', rest: 'welcome to head.uz', tag: 'Skills for your AI agents', cmd: 'Install with one command', done: 'installed', skip: 'Skip intro', mute: 'Mute', unmute: 'Unmute', dialog: 'Choose your language' },
}

export interface MountOpts {
  mode: 'picker' | 'show'
  variant: IntroVariant
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

/* ---------- the deck: the real items only, one folder each ---------- */
function library() {
  const { skills, bundles } = getItems()
  // fan order = the order they fly to their seats without crossing: first skill, the bundles (their row is below-left),
  // then the other skills to the right
  const fan = [...skills.slice(0, 1), ...bundles.slice(0, 1), ...skills.slice(1)].slice(0, 4)
  return { fan }
}
/** The flying cards are laid out this many times larger than a market card and only ever scaled DOWN, so they stay
    crisp at hero size (~2.2×) and at their seat (1.0). */
const CARD_ZOOM = 2.5

/** Version B: the six hero icons (their `data-hero-tile` ids in src/components/market/Hero.tsx) and the card each one is
    born from, so every icon clearly comes from a specific card on its own side: the left card (Apple Design) becomes
    Cursor + the Apple Design mark (left seats), the centre card (the starter pack) becomes Claude + Copilot (the pair
    either side of the words), the right card (Gauntlet Loop) becomes Gemini + the Gauntlet Loop mark (right seats). */
const skillIcons = catalog.skills.filter((k) => k.icon).map((k) => ({ id: k.id, src: k.icon! }))
type HeroTile = { id: string; agent?: Agent; src?: string; card: number }
const HERO_TILES: HeroTile[] = [
  { id: 'cursor', agent: 'cursor', card: 0 },
  { id: skillIcons[0]?.id ?? 'skill-0', src: skillIcons[0]?.src, card: 0 },
  { id: 'claude', agent: 'claude', card: 1 },
  { id: 'copilot', agent: 'copilot', card: 1 },
  { id: 'gemini', agent: 'gemini', card: 2 },
  { id: skillIcons[1]?.id ?? 'skill-1', src: skillIcons[1]?.src, card: 2 },
]
/** Apple's two-parameter spring, solved in closed form from ANY state (position x0, velocity v0) toward T: re-targeting
    from the live state keeps the velocity (the momentum carries through the morph -> split -> flight). Returns [x, v]. */
function springState(x0: number, v0: number, T: number, damping: number, response: number, t: number): [number, number] {
  const w = (2 * Math.PI) / response, c1 = x0 - T
  if (damping >= 1) {
    const c2 = v0 + w * c1, e = Math.exp(-w * t)
    return [T + (c1 + c2 * t) * e, (c2 - w * (c1 + c2 * t)) * e]
  }
  const wd = w * Math.sqrt(1 - damping * damping), c2 = (v0 + damping * w * c1) / wd, e = Math.exp(-damping * w * t)
  const cos = Math.cos(wd * t), sin = Math.sin(wd * t)
  return [T + e * (c1 * cos + c2 * sin), e * ((c2 * wd - damping * w * c1) * cos - (c1 * wd + damping * w * c2) * sin)]
}
/** one channel: at rest until `t1`, springs toward `a` (split), then from its live state at `t2` toward `b` (the seat) */
function twoStage(x0: number, a: number, b: number, t1: number, t2: number, s1: [number, number], s2: [number, number]) {
  return (t: number) => {
    if (t <= t1) return x0
    const [x1, v1] = springState(x0, 0, a, s1[0], s1[1], Math.min(t, t2) - t1)
    return t <= t2 ? x1 : springState(x1, v1, b, s2[0], s2[1], t - t2)[0]
  }
}
/** a flying tile is laid out TILE_ZOOM× a 52 px tile and only ever scaled down (crisp at its 1.8× birth and its seat) */
const TILE_BASE = 52, TILE_ZOOM = 3

/* ---------- the component ---------- */
function IntroShow({ mode, variant, locale: startLocale, navigate, audio: givenAudio, onReady, onClose }: MountOpts & { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(givenAudio ?? null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const doneRef = useRef(false)
  const hiddenCards = useRef<HTMLElement[]>([])
  const bSkip = useRef<(() => unknown) | null>(null)
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [phase, setPhase] = useState<'picker' | 'show'>(mode)
  const [locale, setLocale] = useState<Locale>(startLocale)
  const [muted, setMuted] = useState(reduced)
  const fromPicker = useRef(mode === 'picker')
  const copy = COPY[locale]
  const lib = useMemo(() => library(), [])
  const CW = 313, CH = 152 // the marketplace card at 1440 (ExtensionCard); the finale rescales to the live rect anyway

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
    if (!audioRef.current) { const a = new Audio(introAudio(variant)); a.preload = 'auto'; audioRef.current = a }
    if (reduced && audioRef.current) audioRef.current.muted = true
    return () => { const a = audioRef.current; if (a && !doneRef.current) a.pause() }
  }, [reduced, variant])

  const restoreCards = () => {
    for (const el of hiddenCards.current) { el.style.opacity = ''; el.style.transition = ''; el.style.animationPlayState = ''; el.style.transform = '' }
    hiddenCards.current = []
  }

  const finish = (fast: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    try { window.localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode */ }
    const a = audioRef.current
    const live = variant === 'b' ? (bSkip.current?.() as { seat: { x: number; y: number; rot: number; scale: number } }[] | null) : null
    if (fast && live) {
      tlRef.current?.pause()
      if (a) gsap.to(a, { volume: 0, duration: 0.45, ease: 'none', onComplete: () => a.pause() })
      const q = gsap.utils.selector(rootRef)
      gsap.to(q('[data-ground], [data-blue], [data-light], [data-dawn], [data-wcard], [data-plate2], [data-plate3], [data-brand], [data-cmd-stage], [data-cmd-cap], [data-controls]'), { opacity: 0, duration: 0.3, ease: 'power1.out' })
      // animate from the presentation value: GSAP starts each spring from where the icon is on screen right now
      q('[data-btile]').forEach((el, i) => { const p = live[i]; if (p && p.seat.scale) gsap.to(el, { x: p.seat.x, y: p.seat.y, rotation: p.seat.rot, scale: p.seat.scale, overwrite: true, ...spring(1, 0.36) }) })
      gsap.to([document.querySelector('[data-hero-title]'), document.querySelector('[data-hero-sub]'), document.querySelector('[data-hero-search] > *')].filter(Boolean), { opacity: 1, y: 0, duration: 0.3, ease: 'power1.out' })
      window.setTimeout(() => { restoreCards(); gsap.to(rootRef.current, { opacity: 0, duration: 0.15, onComplete: onClose }) }, 480)
    } else if (fast) {
      tlRef.current?.pause()
      if (a) gsap.to(a, { volume: 0, duration: 0.45, ease: 'none', onComplete: () => a.pause() })
      restoreCards()
      gsap.to(rootRef.current, { opacity: 0, duration: reduced ? 0.2 : 0.35, ease: 'power2.out', onComplete: onClose })
    } else {
      restoreCards()
      onClose()
      if (a) a.addEventListener('ended', () => a.removeAttribute('src'), { once: true })
      if (variant === 'b' && window.matchMedia('(pointer: fine)').matches) {
        // after the root is un-inerted: the page is live and the real caret blinks in the search
        window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-hero-search] input')?.focus({ preventScroll: true }), 60)
      }
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
    if (a && !reduced) { a.currentTime = INTRO_OFFSET; a.play().catch(() => setMuted(true)) }
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
      a.currentTime = reduced ? INTRO_OFFSET : tlRef.current?.time() ?? INTRO_OFFSET
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
  }, { scope: rootRef })

  /* the show */
  useGSAP(() => {
    if (phase !== 'show') return
    const q = gsap.utils.selector(rootRef)
    const one = (sel: string) => q(sel)[0] as HTMLElement | undefined
    const vw = window.innerWidth, vh = window.innerHeight
    const tl = gsap.timeline({ paused: true })
    tlRef.current = tl

    const picker = one('[data-picker]'), greet = one('[data-greet]'), brand = one('[data-brand]'), line = one('[data-line]')
    const skillsWord = one('[data-base] [data-skills]'), uz = one('[data-base] [data-uz]'), tag = one('[data-tag]')
    const light = one('[data-light]'), ground = one('[data-ground]'), blue = one('[data-blue]'), controls = one('[data-controls]')
    const sweep = one('[data-sweep]'), sweepIn = one('[data-sweep-in]')
    const glyphs = ['H', 'E', 'slash', 'A', 'D'].map((g) => one(`[data-base] [data-glyph="${g}"]`))
    const sheen = one('[data-sheen]'), rig = one('[data-rig]'), dawns = q('[data-dawn]') as HTMLElement[], fieldPlate = one('[data-field-plate]')
    const plates2 = q('[data-plate2]') as HTMLElement[], plates3 = q('[data-plate3]') as HTMLElement[]
    const cmdCap = one('[data-cmd-cap]'), cmdStage = one('[data-cmd-stage]'), cmdClip = one('[data-cmd-clip]'), cmdIn = one('[data-cmd-in]')
    const caret = one('[data-caret]'), done = one('[data-done]')
    const backs = q('[data-fback]'), fronts = q('[data-ffront]'), wall = one('[data-wall]')
    const cards = q('[data-wcard]') as HTMLElement[], uzChars = q('[data-base] [data-uzc]'), tiles = q('[data-btile]') as HTMLElement[]
    const chosenBtn = one(`[data-option="${locale}"]`)
    const otherBtns = q('[data-option]').filter((b) => b !== chosenBtn)

    // measure before any tween renders a from-state
    let cmdW = 0, cmdFs = 40
    if (cmdStage && cmdIn) {
      const fs = parseFloat(getComputedStyle(cmdStage).fontSize)
      cmdFs = (fs * vw * 0.65) / cmdIn.offsetWidth
      cmdStage.style.fontSize = `${cmdFs}px`
      cmdW = cmdIn.offsetWidth
    }
    // the success line never runs wider than the command
    if (done && cmdStage) { const dw = done.scrollWidth; if (dw > cmdW * 0.96) done.style.fontSize = `${(cmdFs * cmdW * 0.96) / dw}px` }
    // the card faces: centre each on its shell by its real height (the market card's height follows its content)
    const faces = cards.map((c) => c.firstElementChild as HTMLElement | null)
    const faceH = faces.map((f) => { const h = f?.offsetHeight ?? CH; if (f) f.style.marginTop = `${-h / 2}px`; return h })
    // the lockup is centred as a block (absolute, -50 %); during the riser HEAD.uz alone is centred on its ink
    gsap.set(brand!, { xPercent: -50, yPercent: -50 })
    const lineBox = line!.getBoundingClientRect(), svgBox = one('[data-base] svg')!.getBoundingClientRect(), uzBox = uz!.getBoundingClientRect()
    const huCentre = (svgBox.left + uzBox.right) / 2 - (lineBox.left + lineBox.width / 2) // px, unscaled
    const lineW = line?.offsetWidth ?? vw * 0.9
    const skillsW = skillsWord?.offsetWidth ?? 0
    const unit = (one('[data-base] svg')?.getBoundingClientRect().height ?? 45.8) / 45.7984 // px per SVG unit
    const fitLine = Math.min(1, (vw * 0.8) / lineW) // the peak: ~80 % of the frame, confident, not crowded
    const riserA = (vw * 0.3) / (lineW - skillsW), riserB = riserA * 1.18 // HEAD.uz alone at ~30 % → 35 % of the width
    void skillsW
    const K = CARD_ZOOM
    const R = (rendered: number) => rendered / K // a rendered size (1 = a market card) → the transform scale

    if (reduced) {
      // reduced motion: short opacity cross-fades, nothing travels
      if (fromPicker.current) tl.to(picker!, { opacity: 0, duration: 0.3, ease: 'none' }, 0)
      tl.set([greet, brand], { opacity: 0 }, 0)
      tl.set(q('[data-hi], [data-rest] > span'), { opacity: 1 }, 0)
      tl.to(greet!, { opacity: 1, duration: 0.35, ease: 'none' }, 0.3)
      tl.to(greet!, { opacity: 0, duration: 0.3, ease: 'none' }, 2.1)
      tl.set([skillsWord, uz, ...glyphs, tag], { opacity: 1 }, 0)
      tl.set(line!, { scale: fitLine * 0.8 }, 0)
      tl.to(brand!, { opacity: 1, duration: 0.35, ease: 'none' }, 2.4)
      tl.to([ground, brand, controls], { opacity: 0, duration: 0.5, ease: 'none' }, 4.2)
      tl.add(() => finishRef.current(false), 4.75)
      tl.play(0)
      return
    }

    /* The timeline runs in the track's own time; playback starts at O, so nothing is placed before it. */
    const O = INTRO_OFFSET
    const DB1 = 3.912, DB2 = 5.863 // the riser's two downbeats before the drop

    /* 0 — the picker gives way */
    if (fromPicker.current && picker) {
      tl.to(otherBtns, { opacity: 0, y: 18, duration: 0.3, ease: 'power2.in', stagger: 0.03 }, O)
      tl.to(q('[data-pmark]'), { opacity: 0, duration: 0.22, ease: 'power1.in' }, O)
      tl.to(chosenBtn ?? [], { opacity: 0, scale: 0.9, duration: 0.3, ease: 'power2.in' }, O + 0.02)
      tl.set(picker, { autoAlpha: 0 }, O + 0.4)
    } else if (picker) {
      tl.set(picker, { autoAlpha: 0 }, O)
    }

    /* 1 — the greeting lands on the riser's downbeat and holds two beats */
    const hi = one('[data-hi]'), words = q('[data-rest] > span')
    tl.fromTo(hi!, { opacity: 0, y: '0.14em', scale: 0.965 }, { opacity: 1, y: 0, scale: 1, ...spring(1, 0.55) }, DB1 - 0.06)
    tl.fromTo(words, { opacity: 0, y: 22 }, { opacity: 1, y: 0, ...spring(1, 0.5), stagger: EIGHTH / 2 }, DB1 + EIGHTH)
    const SNAP = DB2 - BEAT // HEAD.uz arrives one beat before the riser's second downbeat
    tl.to(greet!, { opacity: 0, scale: 1.1, duration: 0.3, ease: 'power2.in' }, SNAP - 0.3)

    /* 2 — HEAD.uz snaps in one beat before the downbeat, tracked out evenly (the same step between every unit, .uz
          included), and the riser pulls the SAME mark together; it is whole before "skills." joins it */
    const TRACK = 13 // SVG units between neighbouring units
    tl.set(skillsWord!, { opacity: 0 }, O)
    tl.fromTo(line!, { scale: riserA, x: -riserA * huCentre }, { scale: riserB, x: -riserB * huCentre, duration: T.drop - SNAP, ease: 'sine.in' }, SNAP - 0.04)
    // no dead air: a slow camera push through the riser, and the room light breathes on each beat
    tl.fromTo(brand!, { scale: 1 }, { scale: 1.06, duration: T.drop - SNAP, ease: 'none' }, SNAP)
    for (let b = SNAP + BEAT; b < T.drop - 0.1; b += BEAT) {
      tl.to(light!, { opacity: '+=0.14', duration: 0.06, ease: 'power1.out' }, b)
      tl.to(light!, { opacity: '-=0.14', duration: 0.4, ease: 'power2.out' }, b + 0.06)
    }
    // one step between every unit: H E (/A) D . u z (the slash is the A's leg: they travel together)
    const steps = [-3.5, -2.5, -1.5, -1.5, -0.5] // centred on the middle of HEAD.uz, so the spread never shifts it
    glyphs.forEach((g, i) => {
      if (!g) return
      const at = SNAP - 0.04 + i * 0.03, x = steps[i] * TRACK
      if (i === 2) tl.fromTo(g, { opacity: 0, x: x + 9, y: -26 }, { opacity: 1, x, y: 0, ...spring(0.85, 0.34) }, at)
      else tl.fromTo(g, { opacity: 0, x: x * 1.5, yPercent: 18 }, { opacity: 1, x, yPercent: 0, ...spring(0.85, 0.34) }, at)
    })
    tl.fromTo(uz!, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out' }, SNAP + 0.1)
    uzChars.forEach((c, i) => tl.fromTo(c, { x: (i + 0.5) * TRACK * unit * 1.5 }, { x: (i + 0.5) * TRACK * unit, ...spring(0.85, 0.34) }, SNAP + 0.1 + i * 0.03))
    const pullFrom = SNAP + 0.2, pull = T.drop - 0.25 - pullFrom
    glyphs.forEach((g) => { if (g) tl.to(g, { x: 0, duration: pull, ease: 'sine.inOut' }, pullFrom) })
    tl.to(uzChars, { x: 0, duration: pull, ease: 'sine.inOut' }, pullFrom)
    tl.fromTo(light!, { opacity: 0, scale: 0.6 }, { opacity: 0.55, scale: 0.9, duration: T.drop - SNAP, ease: 'sine.in' }, SNAP)

    /* 3 — THE DROP: the line punches from ~35 % to ~80 % of the frame with a physical overshoot, "skills." lands, the
          room light flashes and a light sweep crosses the letters. One colour for the word; only the slash is blue. */
    tl.fromTo(skillsWord!, { opacity: 0, x: '-0.3em' }, { opacity: 1, x: 0, ...spring(0.7, 0.4) }, T.drop - 0.03)
    tl.to(line!, { scale: fitLine, x: 0, ...spring(0.68, 0.5) }, T.drop - 0.03)
    tl.to(brand!, { scale: 1, ...spring(1, 0.5) }, T.drop - 0.03)
    tl.set(light!, { opacity: 0.9, scale: 1.2 }, T.drop)
    tl.to(light!, { opacity: 0.3, scale: 1, duration: 1.8, ease: 'expo.out' }, T.drop + 0.02)
    const sw = lineW * 0.28
    gsap.set(sweep!, { skewX: -16 })
    gsap.set(sweepIn!, { skewX: 16 })
    tl.set(sweep!, { opacity: 1 }, T.drop)
    tl.fromTo(sweep!, { x: -sw * 1.4 }, { x: lineW + sw * 0.4, duration: 0.95, ease: 'power2.inOut' }, T.drop + 0.08)
    tl.fromTo(sweepIn!, { x: sw * 1.4 }, { x: -(lineW + sw * 0.4), duration: 0.95, ease: 'power2.inOut' }, T.drop + 0.08)
    tl.fromTo(tag!, { opacity: 0, y: 14 }, { opacity: 1, y: 0, ...spring(1, 0.45) }, KICKS[1])

    /* 4 — the title and tagline hold a full bar, then lift; three HEAD folders arrive together, centre first */
    const n = lib.fan.length
    const mid = (n - 1) / 2
    const fw = Math.min(230, Math.max(vw < 768 ? 96 : 160, vw * 0.15))
    rootRef.current?.style.setProperty('--fw', `${fw}px`)
    const folderAt = (i: number) => ({ x: (i - mid) * fw * 1.45, y: vh * 0.14 })
    const lift = KICKS[5] - 0.08
    tl.to(tag!, { opacity: 0, duration: 0.2, ease: 'power1.in', overwrite: 'auto' }, lift - 0.16)
    tl.to(brand!, { y: -vh * 0.395, scale: 230 / (lineW * fitLine), ...spring(1, 0.62) }, lift)
    tl.to(light!, { opacity: 0.22, y: vh * 0.14, duration: 1.0, ease: 'power2.inOut' }, lift)
    for (let i = 0; i < n; i++) {
      const p = folderAt(i), at = lift + 0.06 + Math.abs(i - mid) * 0.06
      tl.fromTo([backs[i], fronts[i]], { opacity: 0, x: p.x * 0.55, y: p.y + vh * 0.1, scale: 0.5 },
        { opacity: 1, x: p.x, y: p.y, scale: 1, ...spring(0.8, 0.5) }, at)
    }

    /* the camera pushes into the centre folder while the flaps open */
    const c0 = folderAt(Math.round(mid))
    gsap.set(rig!, { transformOrigin: `${vw / 2 + c0.x}px ${vh / 2 + c0.y - fw * 0.2}px` })
    const PUSH = 1.9
    tl.to(fronts, { rotationX: -36, transformPerspective: 700, transformOrigin: '50% 100%', ...spring(0.8, 0.42), stagger: 0.035 }, KICKS[7] - 0.04)
    tl.to(rig!, { scale: PUSH, duration: T.bar3 - KICKS[7] + 0.03, ease: 'power2.in' }, KICKS[7])
    const caps = q('[data-fcap]')
    tl.to(caps, { opacity: 0, duration: 0.2, ease: 'power1.in' }, KICKS[7]) // never under the skip pill during the push
    tl.to(caps, { opacity: 1, duration: 0.3, ease: 'power1.out' }, KICKS[10] + 0.3)

    /* 5 — bar 3, the hero shot: on the downbeat the cards burst out of that folder at ~2× and fill the frame; on the next
          kick the camera pulls back and they settle into a fan above the folders */
    const mouth = { x: c0.x, y: c0.y - fw * 0.2 - fw * 0.36 * PUSH }
    const fanStep = CW + 44
    lib.fan.forEach((_, j) => {
      const card = cards[j], c = j - mid
      if (!card) return
      const side = Math.abs(c) > 0
      // hero sizes, capped: the centre card <= 70 % of the width, the side cards wholly inside the frame (24 px margin)
      const sC = Math.min(2.2, (vw * 0.7) / CW), sS = Math.min(1.5, sC * 0.72), rot = 8 * Math.sign(c)
      const hS = faceH[j] ?? CH, rad = (Math.abs(rot) * Math.PI) / 180
      const halfW = (sS * (CW * Math.cos(rad) + hS * Math.sin(rad))) / 2
      const b = side
        ? { x: Math.sign(c) * (vw / 2 - 24 - halfW) * Math.min(1, Math.abs(c)), y: -vh * 0.07, r: rot, s: sS, z: -180 }
        : { x: 0, y: -vh * 0.02, r: 0, s: sC, z: 0 }
      const at = T.bar3 - 0.03 + Math.abs(c) * 0.05
      tl.set(card, { x: mouth.x, y: mouth.y, z: 0, scale: R(0.45), rotation: 0, opacity: 1 }, at - 0.02)
      tl.to(card, { x: b.x, scale: R(b.s), z: b.z, ...spring(0.92, 0.4) }, at)
      tl.to(card, { y: b.y, ...spring(0.66, 0.4) }, at)
      tl.to(card, { rotation: b.r, ...spring(0.7, 0.42) }, at)
      // pull back into the fan
      const f = { x: c * fanStep, y: -vh * 0.13 + Math.abs(c) * 14, r: c * 3 }
      // the hero holds a full kick, then the camera pulls back and the cards settle into a fan
      const back = KICKS[10] + Math.abs(c) * 0.03
      tl.to(card, { x: f.x, scale: R(1), z: 0, ...spring(1, 0.5) }, back)
      tl.to(card, { y: f.y, ...spring(0.8, 0.46) }, back)
      tl.to(card, { rotation: f.r, ...spring(0.85, 0.46) }, back)
    })
    tl.to(rig!, { scale: 1, ...spring(1, 0.6) }, KICKS[10])
    // everything clears before the caption: the cards go back into depth, the folders sink
    tl.to(cards, { z: -1400, opacity: 0, duration: 0.42, ease: 'power2.in' }, KICKS[11] - 0.06)
    tl.to(fronts, { rotationX: 0, duration: 0.24, ease: 'power2.in' }, KICKS[11] - 0.1)
    tl.to([...backs, ...fronts], { opacity: 0, y: `+=${vh * 0.2}`, scale: 0.86, duration: 0.42, ease: 'power2.in', stagger: 0.03 }, KICKS[11])

    /* 6 — bar 4: the caption, then the command laid out whole and centred, revealed left→right within two beats; the
          return hit on the kick turns it into the result, and the next kick pulses it */
    tl.to(brand!, { opacity: 0.5, duration: 0.4 }, T.bar4)
    tl.fromTo(cmdCap!, { opacity: 0, y: 14 }, { opacity: 1, y: 0, ...spring(1, 0.5) }, T.bar4 + 0.02)
    tl.set(cmdStage!, { opacity: 1 }, T.bar4)
    const hit = KICKS[14], typeD = hit - 0.1 - (T.bar4 + 0.08)
    tl.fromTo(cmdClip!, { x: -cmdW }, { x: 0, duration: typeD, ease: 'power1.inOut' }, T.bar4 + 0.08)
    tl.fromTo(cmdIn!, { x: cmdW }, { x: 0, duration: typeD, ease: 'power1.inOut' }, T.bar4 + 0.08)
    tl.fromTo(caret!, { x: 0, opacity: 1 }, { x: cmdW, duration: typeD, ease: 'power1.inOut' }, T.bar4 + 0.08)
    tl.to([cmdClip, caret], { y: -cmdFs * 0.45, opacity: 0, duration: 0.2, ease: 'power2.in' }, hit - 0.08)
    tl.fromTo(done!, { opacity: 0, y: cmdFs * 0.45, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, ...spring(0.72, 0.4) }, hit)
    tl.set(light!, { opacity: 0.55 }, hit)
    tl.to(light!, { opacity: 0.18, duration: 0.9, ease: 'expo.out' }, hit + 0.02)
    tl.fromTo(done!, { scale: 1.035 }, { scale: 1, immediateRender: false, ...spring(0.55, 0.34) }, KICKS[15])

    /* 7 — bar 5, finale: a deep HEAD-blue iris opens, the camera pushes in, the three cards come forward out of depth,
          large, a band of light crosses them; then only the real cards fly to their live seats and hand over */
    tl.to([cmdStage, cmdCap, brand], { opacity: 0, y: '-=16', duration: 0.34, ease: 'power2.in' }, T.bar5 - 0.1)
    tl.fromTo(blue!, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.36, ease: 'power2.out' }, T.bar5 - 0.06)
    tl.to(light!, { opacity: 0, duration: 0.3 }, T.bar5)
    tl.fromTo(wall!, { scale: 0.9 }, { scale: 1, immediateRender: false, ...spring(1, 0.6) }, T.bar5)
    const bigStep = CW * 1.3 + 44
    // immediateRender: false: a fromTo would otherwise park the cards in depth from the start
    cards.forEach((card, j) => {
      const at = T.bar5 + Math.abs(j - mid) * 0.05
      tl.fromTo(card, { x: (j - mid) * bigStep, y: 0, z: -1400, scale: R(1.3), rotation: 0 }, { z: 0, immediateRender: false, ...spring(0.86, 0.5) }, at)
      tl.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power1.out', immediateRender: false }, at) // solid early, not a ghost
    })
    tl.fromTo(sheen!, { xPercent: -120, opacity: 1 }, { xPercent: 120, duration: 0.7, ease: 'power2.inOut', immediateRender: false }, T.bar5 + 0.12)
    if (variant === 'b') {
      /* B's ending (all of A until here): each card MORPHS into hero icons - iOS app-close in reverse: it shrinks, its
         corners round up to the icon squircle and its material tightens (card shadow -> tile shadow) while the content
         cross-fades into the glyphs - then SPLITS into two icons with a spring, and the icons fly on that momentum (the
         re-target keeps their velocity) along curved paths (independent X/Y springs) to their exact hero seats. The paper
         lights up from the cards outward; the hero builds around the icons: headline, subtitle, then the search opens. */
      const heroText = () => ([document.querySelector('[data-hero-title]'), document.querySelector('[data-hero-sub]'),
        document.querySelector('[data-hero-search] > *')].filter(Boolean) as HTMLElement[])
      const heroTile = (id: string) => document.querySelector<HTMLElement>(`[data-hero-tile="${CSS.escape(id)}"]`)
      tl.add(() => {
        gsap.set(heroText(), { opacity: 0 }) // via GSAP: the context's revert on unmount returns the text to its own state
        for (const t of HERO_TILES) { const el = heroTile(t.id); if (el) { el.style.opacity = '0'; el.style.animationPlayState = 'paused'; hiddenCards.current.push(el) } }
      }, T.bar5 - 0.3)

      const M0 = KICKS[17] // the morph starts on the kick
      const SPLIT = M0 + 0.3, FLY = KICKS[18] - 0.12, STAGGER = 0.07
      const S0 = Math.min(118, Math.max(72, vw * 0.082)) // the squircle a card becomes (rendered px)
      const P3 = TILE_BASE * TILE_ZOOM, P2W = 200, P2H = 128
      const cardAt = (j: number) => ({ x: (j - mid) * bigStep, y: 0 })

      // 1 - the morph (transform/opacity only): the card shrinks toward a square while two rounder plates take over
      cards.forEach((card, j) => {
        const c = cardAt(j), h = faceH[j] ?? CH, cw = CW * 1.3, ch = h * 1.3
        const m = spring(1, 0.34)
        tl.to(card, { scaleX: R(S0 / CW), scaleY: R(S0 / h), ...m }, M0)
        tl.to(card, { opacity: 0, duration: 0.2, ease: 'power1.in' }, M0 + 0.06)
        tl.set([plates2[j], plates3[j]], { x: c.x, y: c.y }, M0 - 0.01)
        tl.fromTo(plates2[j], { scaleX: cw / P2W, scaleY: ch / P2H }, { scaleX: S0 / P2W, scaleY: S0 / P2H, immediateRender: false, ...m }, M0)
        tl.to(plates2[j], { opacity: 1, duration: 0.08 }, M0 + 0.04)
        tl.to(plates2[j], { opacity: 0, duration: 0.12 }, M0 + 0.18)
        tl.fromTo(plates3[j], { scaleX: cw / P3, scaleY: ch / P3 }, { scaleX: S0 / P3, scaleY: S0 / P3, immediateRender: false, ...m }, M0)
        tl.to(plates3[j], { opacity: 1, duration: 0.1 }, M0 + 0.14)
        tl.to(plates3[j], { opacity: 0, duration: 0.08 }, SPLIT + 0.02)
        // the paper lights up from this card outward
        tl.fromTo(dawns[j], { x: c.x, y: c.y, scale: 0.02, opacity: 1 }, { scale: 1, duration: 0.8, ease: 'power2.inOut', immediateRender: false }, M0 + Math.abs(j - mid) * 0.05)
      })
      // the icons appear in the squircle as its glyphs cross in
      HERO_TILES.forEach((t, i) => {
        const c = cardAt(t.card)
        tl.set(tiles[i], { x: c.x, y: c.y, scale: S0 / P3, rotation: 0, opacity: 0 }, M0)
        tl.to(tiles[i], { opacity: 1, duration: 0.1, ease: 'power1.out' }, M0 + 0.22)
      })
      tl.set([ground, blue, light], { opacity: 0 }, M0 + 0.8)
      tl.to(dawns, { opacity: 0, duration: 0.25, ease: 'power1.inOut' }, M0 + 0.8) // the page underneath is the same paper
      tl.to(controls!, { opacity: 0, duration: 0.3 }, M0 + 0.3)

      // 2 - split + flight, driven by the closed-form springs (a pure function of timeline time: seekable, audio-clocked)
      let paths: { x: (t: number) => number; y: (t: number) => number; r: (t: number) => number; s: (t: number) => number; seat: { x: number; y: number; rot: number; scale: number } }[] | null = null
      const flyAt = (i: number) => FLY + i * STAGGER
      tl.add(() => {
        paths = HERO_TILES.map((t, i) => {
          const c = cardAt(t.card), real = heroTile(t.id), r = real?.getBoundingClientRect()
          const seat = real && r && r.width > 0
            ? { x: r.left + r.width / 2 - vw / 2, y: r.top + r.height / 2 - vh / 2, rot: parseFloat(getComputedStyle(real).getPropertyValue('--r')) || 0, scale: real.offsetHeight / P3 }
            : { x: c.x, y: c.y, rot: 0, scale: 0 }
          // split: shoot out toward the seat (the path points at the destination from the first frame) + a little apart
          const dx = seat.x - c.x, dy = seat.y - c.y, len = Math.hypot(dx, dy) || 1, sib = HERO_TILES.filter((u) => u.card === t.card).indexOf(t) ? 1 : -1
          const sep = Math.min(96, vw * 0.066)
          const ax = c.x + (dx / len) * sep - (dy / len) * sib * 18, ay = c.y + (dy / len) * sep + (dx / len) * sib * 18
          const t1 = SPLIT, t2 = flyAt(i)
          return {
            seat,
            x: twoStage(c.x, ax, seat.x, t1, t2, [0.72, 0.3], [0.8, 0.46]),
            y: twoStage(c.y, ay, seat.y, t1, t2, [0.72, 0.3], [0.8, 0.38]), // a different Y response curves the path
            r: twoStage(0, Math.sign(dx) * 12, seat.rot, t1, t2, [0.7, 0.3], [0.8, 0.4]),
            s: twoStage(S0 / P3, (S0 / P3) * 0.92, seat.scale, t1, t2, [1, 0.3], [1, 0.4]),
          }
        })
      }, M0 - 0.05)
      const setters = tiles.map((el) => ({ x: gsap.quickSetter(el, 'x', 'px'), y: gsap.quickSetter(el, 'y', 'px'), r: gsap.quickSetter(el, 'rotation', 'deg'), sx: gsap.quickSetter(el, 'scaleX'), sy: gsap.quickSetter(el, 'scaleY') })) // ('scale' is not a quickSetter channel)
      const DRIVE_END = flyAt(HERO_TILES.length - 1) + 0.9
      const drive = { t: 0 }
      tl.to(drive, {
        t: DRIVE_END - SPLIT, duration: DRIVE_END - SPLIT, ease: 'none',
        onUpdate: () => { if (!paths) return; const now = SPLIT + drive.t; paths.forEach((p, i) => { const q = setters[i]; if (!q) return; q.x(p.x(now)); q.y(p.y(now)); q.r(p.r(now)); const k = p.s(now); q.sx(k); q.sy(k) }) },
      }, SPLIT)
      bSkip.current = () => paths // for Skip/Esc mid-flight: settle from the live values
      // hand over, icon by icon, once each has settled on its seat (an underdamped spring is within 0.5 px by then)
      HERO_TILES.forEach((t, i) => {
        tl.add(() => { const real = heroTile(t.id); if (real) { real.style.transition = 'opacity .15s ease-out'; real.style.opacity = '1' } }, flyAt(i) + 0.64)
        tl.to(tiles[i], { opacity: 0, duration: 0.12, ease: 'power1.in' }, flyAt(i) + 0.66)
      })

      // 3 - the hero builds around the icons: the headline rises on the last kick, the subtitle follows, the search opens
      tl.add(() => {
        const [title, subtitle, search] = heroText()
        if (title) gsap.fromTo(title, { opacity: 0, y: 30 }, { opacity: 1, y: 0, clearProps: 'transform', ...spring(0.82, 0.5) })
        if (subtitle) gsap.fromTo(subtitle, { opacity: 0, y: 18 }, { opacity: 1, y: 0, delay: 0.1, clearProps: 'transform', ...spring(1, 0.45) })
        const field = search?.querySelector('input')?.getBoundingClientRect()
        if (search && field && fieldPlate) {
          // the search opens from its centre: a matching field plate springs from a sliver to full width (its border
          // draws out), then the real search - icon and placeholder, never stretched - takes over
          Object.assign(fieldPlate.style, { left: `${field.left}px`, top: `${field.top}px`, width: `${field.width}px`, height: `${field.height}px` })
          gsap.set(fieldPlate, { opacity: 0, scaleX: 0.04 })
          gsap.to(fieldPlate, { opacity: 1, duration: 0.06, delay: 0.22 }) // visible only as it starts to open
          gsap.to(fieldPlate, { scaleX: 1, delay: 0.22, ...spring(0.85, 0.45) })
          gsap.to(search, { opacity: 1, duration: 0.2, delay: 0.62, ease: 'power1.out' })
          gsap.to(fieldPlate, { opacity: 0, duration: 0.15, delay: 0.8 })
        } else if (search) gsap.to(search, { opacity: 1, duration: 0.3, delay: 0.3 })
      }, KICKS[19])
      tl.add(() => finishRef.current(false), KICKS[19] + 1.0)
    } else {
      tl.to([ground, blue], { opacity: 0, duration: 0.42, ease: 'power1.inOut' }, KICKS[17] - 0.02)
      tl.to(controls!, { opacity: 0, duration: 0.3 }, KICKS[17])
      tl.add(() => {
        const sub = gsap.timeline()
        const land = T.lastKick - (KICKS[17] - 0.04)
        // targets first; the card travelling furthest down leaves first, so each clears the row before the next moves
        const flights = lib.fan.map((it, j) => {
          const real = document.querySelector<HTMLElement>(`[data-grid] [data-card-id="${CSS.escape(it.id)}"]`)
          const r = real?.getBoundingClientRect()
          const ok = !!real && !!r && r.width > 0 && r.bottom > 0 && r.top < vh
          return { c: cards[j], h: faceH[j] ?? CH, real, r, ok, y: ok ? r!.top : -1 }
        })
        const order = flights.filter((f) => f.ok).sort((a, b) => b.y - a.y)
        flights.forEach((f) => {
          if (!f.ok || !f.real || !f.r) {
            sub.to(f.c, { opacity: 0, scale: R(0.94), duration: 0.5, ease: 'power2.inOut' }, 0.05)
            return
          }
          const { real, r } = f
          real.style.opacity = '0'
          hiddenCards.current.push(real)
          const x = r.left + r.width / 2 - vw / 2, y = r.top + r.height / 2 - vh / 2
          sub.set(f.c, { zIndex: 10 - order.indexOf(f) }, 0)
          // independent X and Y springs: Y answers first, so a card drops out of the row before it slides across
          const at = order.indexOf(f) * 0.08
          sub.to(f.c, { y, scaleX: r.width / (CW * K), scaleY: r.height / (f.h * K), rotation: 0, ...spring(1, 0.36) }, at)
          sub.to(f.c, { x, ...spring(1, 0.5) }, at + 0.08)
          sub.add(() => { real.style.transition = 'opacity .2s ease-out'; real.style.opacity = '1' }, land - 0.12)
          sub.to(f.c, { opacity: 0, duration: 0.16, ease: 'power1.in' }, land - 0.04)
        })
        tl.add(sub, KICKS[17] - 0.04)
      }, KICKS[17] - 0.04)
      tl.add(() => finishRef.current(false), T.stop + 0.1)
    }

    /* clock: the music is the master. Start with the audio; correct drift if the tab stalls. */
    const a = audioRef.current
    const audioLive = () => !!a && !a.paused && !a.ended && a.currentTime > 0
    tl.play(audioLive() && !fromPicker.current ? a!.currentTime : O)
    // a soft phase lock: the picture eases onto the music's clock (timeScale 0.8-1.2) and the music is never seeked, so
    // the click tap and every baked-in effect play whole; only a real stall (a background tab) jumps
    const onTick = () => {
      if (!a || !audioLive() || doneRef.current) { tl.timeScale(1); return }
      const drift = a.currentTime - tl.time()
      if (Math.abs(drift) > 0.25 && a.currentTime < T.stop) { tl.time(a.currentTime); tl.timeScale(1); return }
      tl.timeScale(Math.abs(drift) < 0.008 ? 1 : gsap.utils.clamp(0.8, 1.2, 1 + drift * 2))
    }
    gsap.ticker.add(onTick)
    if (import.meta.env.DEV) (window as unknown as { __hsIntro?: unknown }).__hsIntro = { time: () => tl.time() - O, drift: () => (a && !a.paused ? a.currentTime - tl.time() : null) } // seconds since the click
    return () => { gsap.ticker.remove(onTick); restoreCards() }
  }, { scope: rootRef, dependencies: [phase] })

  const isRu = locale === 'ru'
  const lineText = (
    <>
      <span className={clsx(s.word, s.txt)}>skills.</span>
      <HeadMark className={s.mark} slashClassName={s.slashBlue} />
      <span className={clsx(s.word, s.txt)}>.uz</span>
    </>
  )
  return (
    <div ref={rootRef} className={clsx(s.root, isRu && s.ru)} role="dialog" aria-modal="true" aria-label={copy.dialog}>
      <div className={s.ground} data-ground />
      <div className={s.blue} data-blue />
      {variant === 'b' && [0, 1, 2].map((k) => <div key={k} className={s.dawn} data-dawn />)}
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

        <div className={s.rig} data-rig aria-hidden="true">
          {lib.fan.map((it) => (
            <div key={it.id} className={s.fBack} data-fback>
              <span className={s.fShadow} />
              <FolderBack />
              <span className={s.fCap} data-fcap>{it.kind === 'bundle' ? chrome[locale]['tab.bundles'] : pick(categoryTitle(it.category ?? ''), locale) ?? it.category}</span>
            </div>
          ))}
          {lib.fan.map((it) => (
            <div key={it.id} className={s.fFront} data-ffront>
              <div className={s.flap}><Slash className={s.emboss} /></div>
            </div>
          ))}

        </div>

        <div className={s.wall} data-wall aria-hidden="true">
          {variant === 'b' && lib.fan.map((it) => <div key={`p2-${it.id}`} className={s.plate2} data-plate2 />)}
          {variant === 'b' && lib.fan.map((it) => <div key={`p3-${it.id}`} className={s.plate3} data-plate3><span /></div>)}
          {variant === 'b' && HERO_TILES.map((t) => (
            <div key={t.id} className={s.tileShell} data-btile>
              <span className={s.tileFace}>{t.agent ? <AgentLogo agent={t.agent} /> : t.src ? <img src={t.src} alt="" /> : null}</span>
            </div>
          ))}
          {lib.fan.map((it) => (
            <div key={it.id} className={s.wcard} data-wcard>
              <div className={s.face}>
                <MemoryRouter><LocaleContext.Provider value={locale}><ExtensionCard item={it} /></LocaleContext.Provider></MemoryRouter>
              </div>
            </div>
          ))}
        </div>

        {variant === 'b' && <div className={s.fieldPlate} data-field-plate aria-hidden="true" />}

        <div className={s.sheen} data-sheen aria-hidden="true" />

        <div className={s.fill}>
          <div className={s.brand} data-brand aria-hidden="true">
            <div className={s.line} data-line>
              <div className={s.base} data-base>
                <span className={clsx(s.word, s.txt)} data-skills style={{ opacity: 0 }}>skills.</span>
                <HeadMark className={s.mark} slashClassName={s.slashBlue} />
                <span className={clsx(s.word, s.txt)} data-uz style={{ opacity: 0 }}>{['.', 'u', 'z'].map((ch) => <span key={ch} className={s.char} data-uzc>{ch}</span>)}</span>
              </div>
              <div className={s.sweep} data-sweep><div className={s.sweepIn} data-sweep-in>{lineText}</div></div>
            </div>
            <div className={s.tag} data-tag style={{ opacity: 0 }}>{copy.tag}</div>
          </div>
        </div>

        <div className={s.fill}>
          <div className={s.cmdWrap}>
            <div className={s.cmdCap} data-cmd-cap style={{ opacity: 0 }}>{copy.cmd}</div>
            <div className={s.cmdStage} data-cmd-stage aria-hidden="true">
              <div className={s.cmdClip} data-cmd-clip>
                <div className={s.cmdIn} data-cmd-in><span className={s.cmdPrompt}>$</span>{`npx skills add ${catalog.repo.owner}/${catalog.repo.name}`}</div>
              </div>
              <span className={s.caret} data-caret />
              <div className={s.done} data-done><span className={s.check}>✓</span>{lib.fan.filter((it) => it.kind === 'skill').map((it) => it.id).join(' · ')} {copy.done}</div>
            </div>
          </div>
        </div>
      </div>

      {phase === 'picker' || mode === 'picker' ? (
        <div className={s.picker} data-picker>
          <div className={s.pickerInner}>
            <div data-pmark><HeadMark className={s.pickerMark} slashClassName={s.slashBlue} title="HEAD" /></div>
            <div className={s.options} role="group" aria-label="Tilni tanlang · Выберите язык · Choose your language" onKeyDown={onOptionsKey}>
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
