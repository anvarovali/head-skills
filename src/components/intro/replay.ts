/* The tiny, always-loaded half of the intro: constants + the replay trigger. No GSAP here. */
export const INTRO_EVENT = 'hs:intro'
export const SEEN_KEY = 'hs.intro.seen'
export const INTRO_AUDIO = '/audio/intro.mp3'
/** Playback starts this far into the track: the riser's downbeat at 3.912 s is the greeting, so the drop (7.814 s in
    the file) lands ~4 s after the click. The show's timeline runs in file time. */
export const INTRO_OFFSET = 3.8

/** Replay the intro (e.g. the footer's "Replay the intro" link). Call it inside the click handler: the click is the
    user gesture that lets the music start. */
export function replayIntro() {
  window.dispatchEvent(new Event(INTRO_EVENT))
}
