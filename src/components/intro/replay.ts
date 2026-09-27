/* The tiny, always-loaded half of the intro: constants + the replay trigger. No GSAP here. */
export const INTRO_EVENT = 'hs:intro'
export const SEEN_KEY = 'hs.intro.seen'
export const INTRO_AUDIO = '/audio/intro.mp3'

/** Replay the intro (e.g. the footer's "Replay the intro" link). Call it inside the click handler: the click is the
    user gesture that lets the music start. */
export function replayIntro() {
  window.dispatchEvent(new Event(INTRO_EVENT))
}
