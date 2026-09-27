/* The beat map of public/audio/intro.mp3 (Magnific / ElevenLabs Music v2, original, 123 BPM), measured with librosa
   onset + a 150 Hz low-pass kick detector. Every key motion hit below is placed on one of these times. */
export const BEAT = 0.4876
export const EIGHTH = BEAT / 2

/** 0–7.8 s: a quiet riser with 8th/16th ticks. The first 8th tick we lock to is 2.212 s. */
export const TICK0 = 2.212
export const tick = (n: number) => TICK0 + n * EIGHTH

/** Every kick from the drop to the last hit (measured, not computed — the render drifts a few ms from the grid). */
export const KICKS = [
  7.814, 8.29, 8.789, 9.265, 9.741, 10.24, 10.716, 11.192, 11.691, 12.167,
  12.643, 13.131, 13.63, 14.106, 14.582, 15.07, 15.557, 16.033, 16.509, 17.009,
] as const

export const T = {
  drop: 7.814,   // the beat drops in: "skills." lands
  bar2: 9.741,   // folders fly in
  bar3: 11.691,  // cards are dealt
  bar4: 13.63,   // folders sink, the install line
  bar5: 15.557,  // finale: cards travel to the real grid
  lastKick: 17.009,
  hit: 17.2,     // the final accent, then the track stops dead at 17.45 and rings out to 19.8
  stop: 17.45,
} as const

/** Apple's two-parameter spring (damping ratio + response, WWDC18 "Designing Fluid Interfaces") as a GSAP ease.
    Returns { ease, duration } — duration is the settle time to 0.1 %, so spread it straight into a tween. */
export function spring(damping = 1, response = 0.4): { ease: (p: number) => number; duration: number } {
  const w = (2 * Math.PI) / response
  let f: (t: number) => number
  let settle: number
  if (damping >= 1) {
    f = (t) => 1 - (1 + w * t) * Math.exp(-w * t)
    settle = 9.23 / w
  } else {
    const wd = w * Math.sqrt(1 - damping * damping)
    f = (t) => 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t))
    settle = Math.log(1000) / (damping * w)
  }
  return { ease: (p) => (p >= 1 ? 1 : f(p * settle)), duration: settle }
}
