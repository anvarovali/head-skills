/* The tiny, always-loaded half of the intro: constants + the replay trigger. No GSAP here. */
export const INTRO_EVENT = 'hs:intro'
export const SEEN_KEY = 'hs.intro.seen'
export const INTRO_AUDIO = '/audio/intro.mp3'

/** Which finale plays. 'a' lands the skill cards in the marketplace grid; 'b' lands the six hero tiles around the
    headline (independent of which skills the catalog holds). ?intro=a / ?intro=b overrides it (and forces the intro). */
export type IntroVariant = 'a' | 'b'
export const INTRO_VARIANT: IntroVariant = 'a'
export const introAudio = (v: IntroVariant) => (v === 'b' ? '/audio/intro-b.mp3' : INTRO_AUDIO)

let chosen: IntroVariant | null = null
/** The variant for this session: a ?intro=a|b seen on load wins (and sticks for replays), else INTRO_VARIANT. */
export function introVariant(): IntroVariant {
  if (chosen) return chosen
  const q = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('intro')
  chosen = q === 'a' || q === 'b' ? q : INTRO_VARIANT
  return chosen
}
/** Playback starts this far into the track: the riser's downbeat at 3.912 s is the greeting, so the drop (7.814 s in
    the file) lands ~4 s after the click. The show's timeline runs in file time. */
export const INTRO_OFFSET = 3.8

/** Replay the intro (e.g. the footer's "Replay the intro" link). Call it inside the click handler: the click is the
    user gesture that lets the music start. */
export function replayIntro() {
  window.dispatchEvent(new Event(INTRO_EVENT))
}
