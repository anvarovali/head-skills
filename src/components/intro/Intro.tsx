import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLocale } from '@/i18n/useLocale'
import type { Locale } from '@/i18n/locales'
import { INTRO_AUDIO, INTRO_EVENT, SEEN_KEY } from './replay'

/* First-visit intro. This file is the light half: it decides whether to play, covers the page for the few ms the
   show chunk takes to arrive, and listens for replays. The show itself (GSAP, the stage) is a lazy chunk that mounts
   its own React root on <body>, so it survives the locale navigation it triggers (/ -> /ru remounts LocaleLayout). */

let open = false

type Launch = { mode: 'picker' | 'show'; locale: Locale; navigate: (to: string) => void; audio?: HTMLAudioElement; onReady?: () => void }

function launch(opts: Launch) {
  if (open) return
  open = true
  import('./show')
    .then((m) => m.mountIntro({ ...opts, onClosed: () => { open = false } }))
    .catch(() => { open = false; opts.onReady?.() })
}

function wantsIntro(): boolean {
  if (typeof window === 'undefined') return false
  const q = new URLSearchParams(window.location.search).get('intro')
  if (q === '0') return false
  if (q === '1') return true
  try { return window.localStorage.getItem(SEEN_KEY) !== '1' } catch { return false }
}

export function Intro() {
  const locale = useLocale()
  const navigate = useNavigate()
  // decided once per mount, before first paint, so the marketplace never flashes under the picker
  const [cover, setCover] = useState(() => wantsIntro() && !open)
  const live = useRef({ locale, navigate })
  useEffect(() => { live.current = { locale, navigate } }, [locale, navigate])

  useEffect(() => {
    if (cover) launch({ mode: 'picker', locale, navigate: (to) => live.current.navigate(to), onReady: () => setCover(false) })
    const onReplay = () => {
      // still inside the footer's click: start the music now, while the gesture counts; the show syncs to it
      let audio: HTMLAudioElement | undefined
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        audio = new Audio(INTRO_AUDIO)
        audio.play().catch(() => {})
      }
      launch({ mode: 'show', locale: live.current.locale, navigate: (to) => live.current.navigate(to), audio })
    }
    window.addEventListener(INTRO_EVENT, onReplay)
    return () => window.removeEventListener(INTRO_EVENT, onReplay)
    // mount-only on purpose: the show outlives this component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!cover) return null
  return <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 999, background: '#050506' }} />
}
