import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createRoot } from 'react-dom/client'
import clsx from 'clsx'
import { gsap, registerGsap, useGSAP } from '@/motion/easings'
import { catalog, categoryTitle } from '@/data/catalog'
import { chrome } from '@/content/chrome'
import { pick } from '@/i18n/useLocale'
import { LOCALES, LOCALE_NAMES, switchLocale, type Locale } from '@/i18n/locales'
import { HeadMark, Slash } from '@/components/ui/HeadMark'
import { ItemIcon } from '@/components/market/ExtensionCard'
import { ClockIcon, CopyIcon, StackIcon } from '@/components/market/icons'
import { BADGE_LABEL, getItems, type Item } from '@/components/market/items'
import cardCss from '@/components/market/ExtensionCard.module.css'
import { INTRO_AUDIO, INTRO_OFFSET, SEEN_KEY } from './replay'
import { KICKS, T, spring, EIGHTH, BEAT } from './timing'
import s from './intro.module.css'

/* The show: language picker -> ~17.5 s keynote reveal cut to the track's beat map -> the real cards land in the
   real marketplace grid. Lazy chunk; mounted on its own root by Intro.tsx. */

const COPY: Record<Locale, { hi: string; rest: string; tag: string; cmd: string; skip: string; mute: string; unmute: string; dialog: string }> = {
  uz: { hi: 'Salom', rest: 'head.uz’ga xush kelibsiz', tag: 'AI agentlaringiz uchun skill’lar', cmd: 'Bitta buyruq bilan o‘rnating', skip: 'O‘tkazib yuborish', mute: 'Ovozni o‘chirish', unmute: 'Ovozni yoqish', dialog: 'Tilni tanlang' },
  ru: { hi: 'Привет', rest: 'добро пожаловать в head.uz', tag: 'Скиллы для ваших AI‑агентов', cmd: 'Установка одной командой', skip: 'Пропустить', mute: 'Выключить звук', unmute: 'Включить звук', dialog: 'Выберите язык' },
  en: { hi: 'Hey', rest: 'welcome to head.uz', tag: 'Skills for your AI agents', cmd: 'Install with one command', skip: 'Skip intro', mute: 'Mute', unmute: 'Unmute', dialog: 'Choose your language' },
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

/* ---------- the deck: the real items only, one folder each ---------- */
function library() {
  const { skills, bundles } = getItems()
  // fan order = the order they fly to their seats without crossing: first skill, the bundles (their row is below-left),
  // then the other skills to the right
  const fan = [...skills.slice(0, 1), ...bundles.slice(0, 1), ...skills.slice(1)].slice(0, 4)
  return { fan }
}
const SOFT_BACKS = 4

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
  const lib = useMemo(() => library(), [])
  const CW = 313, CH = 152 // the marketplace card at 1440 (ExtensionCard); the finale rescales to the live rect anyway
  const cmdWords = ['npx', 'skills', 'add', `${catalog.repo.owner}/${catalog.repo.name}`]

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
    gsap.fromTo(q('[data-hint]'), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out', delay: 0.55 })
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
    const cmdBox = one('[data-cmd]'), cmdCap = one('[data-cmd-cap]'), cmdWordsEl = q('[data-cmd-word]'), caret = one('[data-caret]')
    const backs = q('[data-fback]'), fronts = q('[data-ffront]'), wall = one('[data-wall]')
    const cards = q('[data-wcard]') as HTMLElement[], softs = q('[data-soft]')
    const chosenBtn = one(`[data-option="${locale}"]`)
    const otherBtns = q('[data-option]').filter((b) => b !== chosenBtn)

    // measure before any tween renders a from-state
    const lineW = line?.offsetWidth ?? vw * 0.9
    const skillsW = skillsWord?.offsetWidth ?? 0
    const unit = (one('[data-base] svg')?.getBoundingClientRect().height ?? 45.8) / 45.7984 // px per SVG unit
    const fitLine = Math.min(1, (vw * 0.8) / lineW) // the peak: ~80 % of the frame, confident, not crowded
    const riserA = (vw * 0.3) / (lineW - skillsW), riserB = riserA * 1.18 // HEAD.uz alone at ~30 % → 35 % of the width

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
      tl.to(q('[data-pmark], [data-hint]'), { opacity: 0, duration: 0.22, ease: 'power1.in' }, O)
      tl.to(chosenBtn ?? [], { opacity: 0, scale: 0.9, duration: 0.3, ease: 'power2.in' }, O + 0.02)
      tl.set(picker, { autoAlpha: 0 }, O + 0.4)
    } else if (picker) {
      tl.set(picker, { autoAlpha: 0 }, O)
    }

    /* 1 — the greeting lands on the riser's downbeat and holds two beats */
    const hi = one('[data-hi]'), words = q('[data-rest] > span')
    tl.fromTo(hi!, { opacity: 0, y: '0.14em', scale: 0.965 }, { opacity: 1, y: 0, scale: 1, ...spring(1, 0.55) }, DB1 - 0.06)
    tl.fromTo(words, { opacity: 0, y: 22 }, { opacity: 1, y: 0, ...spring(1, 0.5), stagger: EIGHTH / 2 }, DB1 + BEAT)
    tl.to(greet!, { opacity: 0, scale: 1.1, duration: 0.36, ease: 'power2.in' }, DB2 - 0.36)

    /* 2 — HEAD.uz snaps in on the next downbeat, spread wide, and the riser pulls it together */
    const spread = [-26, -13, 0, 0, 13] // H, E, slash, A, D; the slash is the A's left leg, so those two travel together
    tl.set(skillsWord!, { opacity: 0 }, O)
    tl.fromTo(line!, { scale: riserA, x: (-riserA * skillsW) / 2 }, { scale: riserB, x: (-riserB * skillsW) / 2, duration: T.drop - DB2, ease: 'sine.in' }, DB2 - 0.04)
    glyphs.forEach((g, i) => {
      if (!g) return
      const at = DB2 - 0.04 + i * 0.03
      if (i === 2) tl.fromTo(g, { opacity: 0, x: 9, y: -26 }, { opacity: 1, x: 0, y: 0, ...spring(0.85, 0.34) }, at)
      else tl.fromTo(g, { opacity: 0, x: spread[i] * 1.6, yPercent: 18 }, { opacity: 1, x: spread[i], yPercent: 0, ...spring(0.85, 0.34) }, at)
    })
    tl.fromTo(uz!, { opacity: 0, x: 26 * unit + 60 }, { opacity: 1, x: 26 * unit, ...spring(0.85, 0.34) }, DB2 + 0.11)
    const pull = T.drop - (DB2 + 0.45)
    glyphs.forEach((g, i) => { if (g && i !== 2) tl.to(g, { x: 0, duration: pull, ease: 'power3.in' }, DB2 + 0.45) })
    tl.to(uz!, { x: 0, duration: pull, ease: 'power3.in' }, DB2 + 0.45)
    tl.fromTo(light!, { opacity: 0, scale: 0.6 }, { opacity: 0.55, scale: 0.9, duration: T.drop - DB2, ease: 'sine.in' }, DB2)

    /* 3 — THE DROP: the line punches from ~35 % to ~80 % of the frame with a physical overshoot, "skills." lands, the
          room light flashes and a light sweep crosses the letters. One colour for the word; only the slash is blue. */
    tl.fromTo(skillsWord!, { opacity: 0, x: '-0.3em' }, { opacity: 1, x: 0, ...spring(0.7, 0.4) }, T.drop - 0.03)
    tl.to(line!, { scale: fitLine, x: 0, ...spring(0.68, 0.5) }, T.drop - 0.03)
    tl.set(light!, { opacity: 0.9, scale: 1.2 }, T.drop)
    tl.to(light!, { opacity: 0.3, scale: 1, duration: 1.8, ease: 'expo.out' }, T.drop + 0.02)
    const sw = lineW * 0.28
    gsap.set(sweep!, { skewX: -16 })
    gsap.set(sweepIn!, { skewX: 16 })
    tl.set(sweep!, { opacity: 1 }, T.drop)
    tl.fromTo(sweep!, { x: -sw * 1.4 }, { x: lineW + sw * 0.4, duration: 0.95, ease: 'power2.inOut' }, T.drop + 0.08)
    tl.fromTo(sweepIn!, { x: sw * 1.4 }, { x: -(lineW + sw * 0.4), duration: 0.95, ease: 'power2.inOut' }, T.drop + 0.08)
    tl.fromTo(tag!, { opacity: 0, y: 18 }, { opacity: 1, y: 0, ...spring(1, 0.55) }, KICKS[2])

    /* 4 — bar 2: the title lifts to the top; one HEAD folder per real item flies in from depth, one per kick */
    const n = lib.fan.length
    const fw = Math.min(190, Math.max(vw < 768 ? 84 : 140, vw * 0.12))
    rootRef.current?.style.setProperty('--fw', `${fw}px`)
    const sc = Math.min(1.16, (vw * 0.86) / (n * CW + (n - 1) * 48)) // the fan's card scale
    const step = CW * sc + 48
    const folderAt = (i: number) => ({ x: (i - (n - 1) / 2) * step, y: vh * 0.29 })
    tl.to(tag!, { opacity: 0, duration: 0.22, ease: 'power1.in' }, KICKS[2] + 0.84)
    tl.to(brand!, { y: -vh * 0.395, scale: 230 / (lineW * fitLine), ...spring(1, 0.62) }, T.bar2 - 0.34)
    tl.to(light!, { opacity: 0.2, y: vh * 0.18, duration: 1.2, ease: 'power2.inOut' }, T.bar2 - 0.3)
    for (let i = 0; i < n; i++) {
      const p = folderAt(i), at = T.bar2 + i * EIGHTH - 0.26 // on the 8ths: the shelf arrives as one gesture
      tl.fromTo([backs[i], fronts[i]], { opacity: 0, x: p.x * 0.3, y: p.y - vh * 0.12, scale: 0.12, rotation: (i - (n - 1) / 2) * -8 },
        { opacity: 1, x: p.x, y: p.y, scale: 1, rotation: 0, ...spring(0.78, 0.5) }, at)
    }
    tl.to(fronts, { rotationX: -36, transformPerspective: 700, transformOrigin: '50% 100%', ...spring(0.8, 0.42), stagger: 0.035 }, KICKS[7] - 0.04)

    /* 5 — bar 3: the deal. Each real card rises out of its own folder on a kick and springs straight up into a
          centred fan; a few soft card backs far behind give depth, nothing overlaps */
    const fanAt = (j: number) => {
      const c = j - (n - 1) / 2
      return { x: c * step, y: -vh * 0.07 + Math.abs(c) * 16, r: c * 3.5 }
    }
    lib.fan.forEach((_, j) => {
      const card = cards[j], f = folderAt(j), slot = fanAt(j), at = KICKS[8 + j]
      if (!card) return
      tl.set(card, { x: f.x, y: f.y + fw * 0.1, scale: 0.42, rotation: 0, opacity: 1 }, at - 0.3)
      tl.to(card, { y: f.y - fw * 0.34, duration: 0.26, ease: 'power2.out' }, at - 0.3)
      tl.to(card, { x: slot.x, y: slot.y, scale: sc, rotation: slot.r, ...spring(0.82, 0.5) }, at - 0.04)
    })
    const softAt = [[-1.55, -0.62], [1.5, -0.7], [-1.35, 0.55], [1.6, 0.5]]
    softs.forEach((el, i) => {
      const [kx, ky] = softAt[i]
      tl.fromTo(el, { opacity: 0, x: kx * step, y: ky * vh * 0.42, z: -900 }, { opacity: 0.45, duration: 1.4, ease: 'power1.out' }, KICKS[8] + i * EIGHTH)
    })
    tl.fromTo(wall!, { scale: 0.97 }, { scale: 1.02, duration: T.bar4 - KICKS[8], ease: 'sine.inOut' }, KICKS[8])
    const sinkAt = KICKS[8 + n - 1] + 0.42
    tl.to(fronts, { rotationX: 0, duration: 0.26, ease: 'power2.in' }, sinkAt - 0.2)
    tl.to([...backs, ...fronts], { opacity: 0, y: `+=${vh * 0.18}`, scale: 0.86, duration: 0.5, ease: 'power2.in', stagger: 0.03 }, sinkAt)

    /* 6 — bar 4: the command is the hero. The cards step back into the dark, the line types itself word by word on the 8ths */
    // (opacity on the preserve-3d wall would flatten its depth, so the cards dim one by one instead)
    tl.to(wall!, { scale: 0.74, y: vh * 0.04, ...spring(1, 0.7) }, T.bar4 - 0.06)
    tl.to(cards, { opacity: 0.1, duration: 0.45, ease: 'power2.out' }, T.bar4 - 0.06)
    tl.to(softs, { opacity: 0, duration: 0.45, ease: 'power2.out', overwrite: 'auto' }, T.bar4 - 0.06)
    tl.to(brand!, { opacity: 0.5, duration: 0.4 }, T.bar4)
    tl.fromTo(cmdCap!, { opacity: 0, y: 14 }, { opacity: 1, y: 0, ...spring(1, 0.5) }, T.bar4 - 0.12)
    tl.set(cmdBox!, { opacity: 1 }, T.bar4)
    cmdWordsEl.forEach((w, i) => tl.fromTo(w, { opacity: 0, y: '0.25em' }, { opacity: 1, y: 0, ...spring(0.85, 0.36) }, T.bar4 + (i + 1) * EIGHTH - 0.03))
    // the caret appears once the line is complete, then blinks on the 8ths
    for (let k = 0; k < 5; k++) tl.set(caret!, { opacity: k % 2 ? 0 : 1 }, KICKS[14] + 0.1 + k * EIGHTH)
    tl.fromTo(cmdBox!, { scale: 1 }, { scale: 1.04, duration: T.bar5 - T.bar4, ease: 'sine.inOut' }, T.bar4)

    /* 7 — bar 5, finale: a short HEAD-blue iris, then the page, already clean, while only the real cards are in flight;
          they settle straight into their live seats and hand over on the last kick */
    tl.to([cmdBox, cmdCap, brand], { opacity: 0, y: '-=16', duration: 0.34, ease: 'power2.in' }, T.bar5 - 0.1)
    tl.to(wall!, { scale: 1, y: 0, ...spring(1, 0.5) }, T.bar5)
    tl.to(cards, { opacity: 1, duration: 0.25, ease: 'power1.out' }, T.bar5)
    tl.fromTo(blue!, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.42, ease: 'power2.out' }, T.bar5)
    tl.to(light!, { opacity: 0, duration: 0.4 }, T.bar5)
    tl.to([ground, blue], { opacity: 0, duration: 0.42, ease: 'power1.inOut' }, T.bar5 + 0.4)
    tl.to(controls!, { opacity: 0, duration: 0.3 }, T.bar5 + 0.4)
    tl.add(() => {
      const sub = gsap.timeline()
      const land = T.lastKick - (T.bar5 + 0.2)
      // targets first; the card travelling furthest down leaves first, so each clears the row before the next moves
      const flights = lib.fan.map((it, j) => {
        const real = document.querySelector<HTMLElement>(`[data-grid] [data-card-id="${CSS.escape(it.id)}"]`)
        const r = real?.getBoundingClientRect()
        const ok = !!real && !!r && r.width > 0 && r.bottom > 0 && r.top < vh
        return { c: cards[j], real, r, ok, y: ok ? r!.top : -1 }
      })
      const order = flights.filter((f) => f.ok).sort((a, b) => b.y - a.y)
      flights.forEach((f) => {
        if (!f.ok || !f.real || !f.r) {
          sub.to(f.c, { opacity: 0, scale: sc * 0.94, duration: 0.5, ease: 'power2.inOut' }, 0.05)
          return
        }
        const { real, r } = f
        real.style.opacity = '0'
        hiddenCards.current.push(real)
        const x = r.left + r.width / 2 - vw / 2, y = r.top + r.height / 2 - vh / 2
        sub.set(f.c, { zIndex: 10 - order.indexOf(f) }, 0)
        // independent X and Y springs: Y answers faster, so a card drops out of the row before it slides across
        const at = 0.04 + order.indexOf(f) * 0.1
        sub.to(f.c, { y, scaleX: r.width / CW, scaleY: r.height / CH, rotation: 0, ...spring(1, 0.4) }, at)
        sub.to(f.c, { x, ...spring(1, 0.6) }, at + 0.1)
        sub.add(() => { real.style.transition = 'opacity .2s ease-out'; real.style.opacity = '1' }, land - 0.12)
        sub.to(f.c, { opacity: 0, duration: 0.16, ease: 'power1.in' }, land - 0.04)
      })
      tl.add(sub, T.bar5 + 0.2)
    }, T.bar5 + 0.2)
    tl.add(() => finishRef.current(false), T.stop + 0.1)

    /* clock: the music is the master. Start with the audio; correct drift if the tab stalls. */
    const a = audioRef.current
    const audioLive = () => !!a && !a.paused && !a.ended && a.currentTime > 0
    tl.play(audioLive() && !fromPicker.current ? a!.currentTime : O)
    let aligned = false
    const onTick = () => {
      if (!a || !audioLive() || doneRef.current) return
      const drift = a.currentTime - tl.time()
      if (!aligned) {
        aligned = true
        // first real audio frame: pull the audio to the picture (a ~100 ms seek in the quiet riser is inaudible)
        if (Math.abs(drift) > 0.04 && tl.time() < 6.5) { a.currentTime = tl.time(); return }
      }
      if (Math.abs(drift) > 0.12 && a.currentTime < T.stop) tl.time(a.currentTime)
    }
    gsap.ticker.add(onTick)
    if (import.meta.env.DEV) (window as unknown as { __hsIntro?: unknown }).__hsIntro = { time: () => tl.time() - O } // seconds since the click
    return () => { gsap.ticker.remove(onTick); restoreCards() }
  }, { scope: rootRef, dependencies: [phase] })

  const isRu = locale === 'ru'
  const by = (name?: string) => (name ? (chrome[locale]['card.by'] ?? chrome.en['card.by']).replace('{name}', `@${name}`) : null)
  // the same foot as ExtensionCard: a stack count for bundles, clock + short date for skills
  const meta = (it: Item) => it.kind === 'bundle'
    ? <><StackIcon size={13} /><span>{it.skillCount ?? 0}</span></>
    : it.updated ? <><ClockIcon size={13} /><span>{shortDate(it.updated, locale)}</span></> : null
  const badge = (it: Item) => it.badges.map((b) => BADGE_LABEL[b]).find(Boolean)
  const lineText = (
    <>
      <span className={s.word}>skills.</span>
      <HeadMark className={s.mark} slashClassName={s.slashBlue} />
      <span className={s.word}>.uz</span>
    </>
  )
  return (
    <div ref={rootRef} className={clsx(s.root, isRu && s.ru)} role="dialog" aria-modal="true" aria-label={copy.dialog}>
      <div className={s.ground} data-ground />
      <div className={s.blue} data-blue />
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

        {lib.fan.map((it) => (
          <div key={it.id} className={s.fBack} data-fback aria-hidden="true">
            <span className={s.fShadow} />
            <FolderBack />
            <span className={s.fCap}>{it.kind === 'bundle' ? chrome[locale]['tab.bundles'] : pick(categoryTitle(it.category ?? ''), locale) ?? it.category}</span>
          </div>
        ))}

        <div className={s.wall} data-wall aria-hidden="true">
          {Array.from({ length: SOFT_BACKS }, (_, i) => (
            <div key={`soft${i}`} className={clsx(s.wcard, s.blank, s.soft)} data-soft>
              <span className={s.blankHead}><span className={s.blankIcon} /><span className={s.bar} style={{ width: `${40 + i * 9}%` }} /></span>
              <span className={s.bar} style={{ width: '86%' }} />
            </div>
          ))}
          {lib.fan.map((it) => (
            <div key={it.id} className={clsx(cardCss.card, s.wcard)} data-wcard>
              <div className={cardCss.head}>
                <ItemIcon item={it} />
                <h3 className={cardCss.name}>{pick(it.title, locale) ?? it.id}</h3>
                {badge(it) ? <span className={cardCss.badge}>{badge(it)}</span> : null}
                <span className={cardCss.copy}><CopyIcon size={14} /></span>
              </div>
              <p className={cardCss.desc}>{pick(it.summary, locale)}</p>
              <div className={cardCss.foot}><span className={cardCss.by}>{by(it.author)}</span><span className={cardCss.meta}>{meta(it)}</span></div>
            </div>
          ))}
        </div>

        {lib.fan.map((it) => (
          <div key={it.id} className={s.fFront} data-ffront aria-hidden="true">
            <div className={s.flap}><Slash className={s.emboss} /></div>
          </div>
        ))}

        <div className={s.fill}>
          <div className={s.brand} data-brand aria-hidden="true">
            <div className={s.line} data-line>
              <div className={s.base} data-base>
                <span className={s.word} data-skills style={{ opacity: 0 }}>skills.</span>
                <HeadMark className={s.mark} slashClassName={s.slashBlue} />
                <span className={s.word} data-uz style={{ opacity: 0 }}>.uz</span>
              </div>
              <div className={s.sweep} data-sweep><div className={s.sweepIn} data-sweep-in>{lineText}</div></div>
            </div>
            <div className={s.tag} data-tag style={{ opacity: 0 }}>{copy.tag}</div>
          </div>
        </div>

        <div className={s.fill}>
          <div className={s.cmdWrap}>
            <div className={s.cmdCap} data-cmd-cap style={{ opacity: 0 }}>{copy.cmd}</div>
            <div className={s.cmd} data-cmd aria-hidden="true">
              <span className={s.cmdPrompt}>$</span>
              {cmdWords.map((w) => <span key={w} className={s.cmdWord} data-cmd-word>{w}</span>)}
              <span className={s.caret} data-caret />
            </div>
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

/* mirrors ExtensionCard's hand-made short dates (Chromium has no Uzbek month names) */
const MONTHS: Record<Locale, string[]> = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
function shortDate(iso: string, locale: Locale) {
  const d = new Date(iso)
  const m = MONTHS[locale][d.getMonth()]
  return locale === 'uz' ? `${d.getDate()}-${m}` : `${d.getDate()} ${m}`
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
