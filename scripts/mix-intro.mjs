#!/usr/bin/env node
/* Rebuild public/audio/intro.mp3 = our own Magnific music (public/audio/intro-music.mp3) + the owner's licensed Envato
   Elements SFX, baked into ONE mixed track. Every visible motion in the intro has its own sound, placed on the motion
   and panned to where it happens on screen, so the motion "speaks".

   LICENSING: the repo is public and the Envato licence forbids redistributing the source files. This script only READS
   them from $HOME/Downloads/head-skills-sfx/raw (or $SFX_DIR) and writes the mixed end product. Never copy a raw or
   trimmed SFX file into the repo or public/. Without the folder the script exits cleanly and leaves intro.mp3 alone.

   Times are FILE time (the show's timeline runs in the track's own time; playback starts at INTRO_OFFSET = click).
   Each clip is aligned by its own detected onset (hits, taps, pops, latches), loudness peak (whooshes, swells) or end
   (reverse swells that must land ON a hit). Pan: -1 = hard left … +1 = hard right, from the element's on-screen x
   (fraction of half the width, measured on the 1440 layout; the ratios hold at any size); `pan: [from, to]` moves it
   over the clip's first `panOver` seconds.

   node scripts/mix-intro.mjs          -> public/audio/intro.mp3 + workbench/intro-mix-cues.json (the cue sheet)
   MIX_SFX_STEM=/outside/repo.wav …    -> also writes the SFX bus alone, for local checks only (never commit it) */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const FFMPEG = process.env.FFMPEG || (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg')
const FFPROBE = FFMPEG.replace(/ffmpeg$/, 'ffprobe')
const RAW = process.env.SFX_DIR || path.join(os.homedir(), 'Downloads/head-skills-sfx/raw')
const MUSIC = path.join(ROOT, 'public/audio/intro-music.mp3')
const OUT = path.join(ROOT, 'public/audio/intro.mp3')
const CUES_OUT = path.join(ROOT, 'workbench/intro-mix-cues.json')
const TARGET_LUFS = -14

if (!fs.existsSync(RAW)) {
  console.log(`mix-intro: ${RAW} not found. The licensed SFX are not part of this repo (Envato licence); nothing to do, public/audio/intro.mp3 is unchanged.`)
  process.exit(0)
}
if (!fs.existsSync(MUSIC)) { console.error(`mix-intro: missing ${MUSIC}`); process.exit(1) }
if (spawnSync(FFMPEG, ['-version']).status !== 0) { console.error('mix-intro: ffmpeg not found (set FFMPEG=...)'); process.exit(1) }

// INTRO_OFFSET lives in the intro code; read it so the two never drift apart
const OFFSET = Number(/INTRO_OFFSET\s*=\s*([\d.]+)/.exec(fs.readFileSync(path.join(ROOT, 'src/components/intro/replay.ts'), 'utf8'))?.[1] ?? 3.8)

/* ---------- the clips (found by folder + optional name match; __MACOSX / dotfiles ignored; WAV preferred) ---------- */
function findWav(folder, match) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    if (e.name === '__MACOSX' || e.name.startsWith('.')) return []
    const p = path.join(d, e.name)
    return e.isDirectory() ? walk(p) : e.name.toLowerCase().endsWith('.wav') ? [p] : []
  })
  const dir = path.join(RAW, folder)
  const all = fs.existsSync(dir) ? walk(dir).sort() : []
  const hit = match ? all.find((f) => path.basename(f).includes(match)) : all[0]
  if (!hit) throw new Error(`mix-intro: no .wav${match ? ` matching "${match}"` : ''} in ${dir}`)
  return hit
}
const CLIP = {
  tap: findWav('click-tap-soft'),
  slide: findWav('soft-sliding-transition-whoosh'),
  hit: findWav('cinematic-hit-noise-impact-shimmer-01'),
  sub: findWav('deep-cinematic-sub-impact'),
  whoosh: findWav('whoosh-soft-and-subtle'),
  airy: findWav('airy-transition-whoosh'),
  swoosh: findWav('slide-across-swoosh'),
  keys: findWav('keyboard-vividkey-for-mac-rapid-typing-fast'),
  chime: findWav('digital-ui-confirm-chime'),
  folderA: findWav('object-office-folder-open-01'),
  folderB: findWav('object-office-folder-open-light-01'),
  pop1: findWav('bubble-pop', '01 Appear'), pop3: findWav('bubble-pop', '03 Appear'), pop5: findWav('bubble-pop', '05 Appear'),
  out2: findWav('bubble-pop', '02 Disappear'), out4: findWav('bubble-pop', '04 Disappear'), out6: findWav('bubble-pop', '06 Disappear'),
  shimmer: findWav('short-magic-shimmer'),
  reverse: findWav('short-and-low-reversed-whoosh'),
  zoom: findWav('zoom-airy-swoosh'),
  enter: findWav('computer-keyboard-enter-key-press'),
}

/* ---------- analysis: onset (first sample above 10 % of max), loudness peak (max 20 ms RMS), peak dBFS ---------- */
function analyse(file, seconds = 6) {
  const buf = execFileSync(FFMPEG, ['-v', 'error', '-t', String(seconds), '-i', file, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
  let max = 0
  for (const v of x) max = Math.max(max, Math.abs(v))
  let onset = 0
  while (onset < x.length && Math.abs(x[onset]) < 0.1 * max) onset++
  const W = 882
  let best = 0, bestAt = 0
  for (let i = 0; i + W < x.length; i += W) {
    let s = 0
    for (let k = i; k < i + W; k++) s += x[k] * x[k]
    if (s > best) { best = s; bestAt = i }
  }
  return { onset: onset / 44100, peak: (bestAt + W / 2) / 44100, peakDb: 20 * Math.log10(max || 1e-9) }
}
const A = Object.fromEntries(Object.entries(CLIP).map(([k, f]) => [k, analyse(f)]))

/* ---------- the motion -> sound map (file time; the motion times come from src/components/intro/show.tsx + timing.ts) ---------- */
const O = OFFSET
const BEAT = 0.4876
const DB2 = 5.863, SNAP = DB2 - BEAT, DROP = 7.814
const KICKS = [7.814, 8.29, 8.789, 9.265, 9.741, 10.24, 10.716, 11.192, 11.691, 12.167, 12.643, 13.131, 13.63, 14.106, 14.582, 15.07, 15.557, 16.033, 16.509, 17.009]
const BAR3 = KICKS[8], BAR4 = KICKS[12], BAR5 = KICKS[16]
const LIFT = KICKS[5] - 0.08
// on-screen x (fraction of half the width) at 1440 — folders sit at ±0.435, the fan at ±0.5, the burst sides at ±0.62
const FOLDER_X = [-0.435, 0, 0.435]
const GLYPH_X = [-0.3, -0.2, -0.08, -0.08, 0.05] // H, E, slash, A, D on the riser; .uz +0.25

const cues = [
  // the picker click
  { name: 'click', clip: 'tap', at: O + 0.005, align: 'onset', dur: 0.16, peak: -16, fo: 0.08 },
  // "Salom" in (a swell into the downbeat) and out (it pushes past the camera)
  { name: 'salom-in', clip: 'slide', at: 4.05, align: 'peak', dur: 0.9, peak: -19, fi: 0.12, fo: 0.25 },
  { name: 'salom-out', clip: 'whoosh', at: SNAP - 0.06, align: 'peak', dur: 0.7, peak: -26, fi: 0.08, fo: 0.3 },
  // each HEAD glyph snaps in, from where it lands
  ...GLYPH_X.map((x, i) => ({ name: `glyph-${'HE/AD'[i]}`, clip: 'tap', at: SNAP - 0.04 + i * 0.03 + 0.02, align: 'onset', dur: 0.08, peak: -28, fo: 0.05, pan: x })),
  { name: 'glyph-.uz', clip: 'tap', at: SNAP + 0.12, align: 'onset', dur: 0.08, peak: -29, fo: 0.05, pan: 0.25 },
  // the tracking tightens: a very soft continuous air bed (the slide whoosh at half speed)
  { name: 'tighten-air', clip: 'slide', at: SNAP + 0.3, align: 'start', from: 0.1, dur: 1.9, rate: 0.5, peak: -33, fi: 0.5, fo: 0.6 },
  // a reverse swell that ends exactly ON the drop
  { name: 'drop-swell', clip: 'reverse', at: DROP, align: 'end', dur: 1.2, peak: -17, fi: 0.3, fo: 0.012 },
  // THE DROP: impact + sub on the music's own kick, and the shimmer riding the light-sweep slit left -> right
  { name: 'drop-hit', clip: 'hit', at: DROP, align: 'onset', dur: 2.5, peak: -11, fo: 1.7, tone: 'highshelf=f=6000:g=-5' },
  { name: 'drop-sub', clip: 'sub', at: DROP, align: 'onset', dur: 2.5, peak: -9, fo: 1.6 },
  { name: 'drop-sweep', clip: 'shimmer', at: DROP + 0.08, align: 'onset', dur: 1.6, peak: -20, fo: 0.8, pan: [-0.8, 0.8], panOver: 0.95 },
  // the tagline arrives on the first kick after the drop
  { name: 'tagline', clip: 'tap', at: KICKS[1] + 0.01, align: 'onset', dur: 0.1, peak: -31, fo: 0.06 },
  // the title lifts to the top
  { name: 'title-lift', clip: 'whoosh', at: LIFT + 0.18, align: 'peak', dur: 0.8, peak: -25, fi: 0.06, fo: 0.35 },
  // the three folders arrive (centre first), each from its own place
  ...FOLDER_X.map((x, i) => ({ name: `folder-arrive-${i}`, clip: 'airy', at: LIFT + 0.06 + Math.abs(i - 1) * 0.06 + 0.16, align: 'peak', dur: 0.7, peak: -29, fi: 0.05, fo: 0.35, pan: x })),
  // their labels fade out as the camera pushes in … and back after the pull-back (very quiet pops)
  ...FOLDER_X.map((x, i) => ({ name: `label-out-${i}`, clip: ['out2', 'out4', 'out6'][i], at: KICKS[7] + i * 0.02, align: 'onset', dur: 0.2, peak: -37, fo: 0.08, pan: x })),
  ...FOLDER_X.map((x, i) => ({ name: `label-in-${i}`, clip: ['out6', 'out2', 'out4'][i], at: KICKS[10] + 0.3 + i * 0.02, align: 'onset', dur: 0.2, peak: -37, fo: 0.08, pan: x })),
  // each flap swings open (two folder recordings, alternated, ±1.5 semitones so no two sound alike)
  ...FOLDER_X.map((x, i) => ({ name: `flap-${i}`, clip: i === 1 ? 'folderB' : 'folderA', at: KICKS[7] - 0.04 + i * 0.035, align: 'onset', dur: 0.45, peak: -21, fo: 0.15, pan: x, semitones: [0, 1.5, -1.5][i] })),
  // the camera pushes into the centre folder
  { name: 'push', clip: 'zoom', at: BAR3 - 0.08, align: 'peak', dur: 1.4, peak: -20, fi: 0.2, fo: 0.4 },
  // a reverse swell into the burst, then the burst: an airy whoosh + a pop as each card leaves the folder
  { name: 'burst-swell', clip: 'reverse', at: BAR3, align: 'end', dur: 0.9, peak: -23, fi: 0.25, fo: 0.012 },
  { name: 'burst', clip: 'airy', at: BAR3 + 0.05, align: 'peak', dur: 1.3, peak: -17, fi: 0.06, fo: 0.65 },
  ...[[0, 'pop1', 0], [-1, 'pop3', -0.62], [1, 'pop5', 0.62]].map(([c, clip, x]) => ({ name: `pop-${c}`, clip, at: BAR3 - 0.03 + Math.abs(c) * 0.05, align: 'onset', dur: 0.25, peak: -22, fo: 0.1, pan: x })),
  // the camera pulls back, the fan settles (a soft tap per card, centre first)
  { name: 'pull-back', clip: 'slide', at: KICKS[10] + 0.2, align: 'peak', dur: 0.8, peak: -27, fi: 0.1, fo: 0.3 },
  ...[[0, 0], [-1, -0.5], [1, 0.5]].map(([c, x]) => ({ name: `fan-${c}`, clip: 'tap', at: KICKS[10] + Math.abs(c) * 0.03 + 0.34, align: 'onset', dur: 0.1, peak: -29, fo: 0.06, pan: x })),
  // the cards clear into depth (a low reverse whoosh that closes as they vanish)
  { name: 'clear-depth', clip: 'reverse', at: KICKS[11] + 0.36, align: 'end', dur: 0.8, peak: -25, fi: 0.2, fo: 0.02, tone: 'lowpass=f=5000' },
  // the command reveal: two beats of typing following the reveal left -> right
  { name: 'typing', clip: 'keys', at: BAR4 + 0.08, align: 'start', from: 2.0, dur: 0.78, peak: -26, fi: 0.04, fo: 0.14, pan: [-0.6, 0.6], panOver: 0.78 },
  // the return hit: Enter (first transient only) a hair before the confirm chime; then the success pulse
  { name: 'enter', clip: 'enter', at: KICKS[14] - 0.016, align: 'onset', dur: 0.12, peak: -20, fo: 0.06 },
  { name: 'chime', clip: 'chime', at: KICKS[14], align: 'onset', dur: 0.2, peak: -15, fo: 0.06 },
  { name: 'pulse', clip: 'tap', at: KICKS[15] + 0.01, align: 'onset', dur: 0.1, peak: -30, fo: 0.06 },
  // the blue iris opens; the cards come forward and a band of light crosses them left -> right
  { name: 'iris', clip: 'zoom', at: BAR5 + 0.2, align: 'peak', dur: 1.2, peak: -21, fi: 0.3, fo: 0.4 },
  { name: 'peak-sweep', clip: 'shimmer', at: BAR5 + 0.12, align: 'onset', dur: 1.2, peak: -26, fo: 0.6, pan: [-0.9, 0.9], panOver: 0.7 },
  // each card's flight to its seat, panned along its own path, then a tap as it lands (measured settle times)
  ...[['flight-bundle', 0, -0.69, 0], ['flight-apple', -0.63, -0.69, 1], ['flight-gauntlet', 0.63, -0.23, 2]].map(([name, from, to, k]) => (
    { name, clip: 'swoosh', at: KICKS[17] - 0.04 + k * 0.08 + 0.35, align: 'peak', dur: 1.1, peak: -24, fi: 0.2, fo: 0.4, pan: [from, to], panOver: 0.9 })),
  { name: 'land-apple', clip: 'tap', at: 16.5, align: 'onset', dur: 0.1, peak: -25, fo: 0.06, pan: -0.69 },
  { name: 'land-bundle', clip: 'tap', at: 16.65, align: 'onset', dur: 0.1, peak: -25, fo: 0.06, pan: -0.69 },
  { name: 'land-gauntlet', clip: 'tap', at: 16.81, align: 'onset', dur: 0.1, peak: -25, fo: 0.06, pan: -0.23 },
]
// the music ducks ~2.5 dB under the drop and ~2 dB under the burst, with smooth edges
const DUCK = [[DROP - 0.03, 0.04, 9.0, 0.7, 0.25], [BAR3 - 0.05, 0.05, 12.2, 0.5, 0.2]] // [start, attack, end, release, depth]

/* place a cue: the clip's alignment point lands on `at` (a clip that would start before the click is head-trimmed) */
const FADE_MIN = 0.006
// local checks: MIX_ONLY=name,name renders only those cues (with MIX_SFX_STEM, to measure a cue in isolation)
const only = process.env.MIX_ONLY?.split(',').map((x) => x.trim())
const placed = cues.filter((c) => !only || only.includes(c.name)).map((c) => {
  const a = A[c.clip]
  const ratio = c.semitones ? 2 ** (c.semitones / 12) : 1 // pitch shift speeds the clip up by `ratio`
  const rate = c.rate ?? 1
  const k = 1 / (ratio * rate) // clip-time -> output-time scale
  const onset = a.onset * k, peak = a.peak * k
  let from, start
  if (c.align === 'onset') { from = Math.max(0, onset - 0.004); start = c.at - (onset - from) }
  else if (c.align === 'peak') { from = 0; start = c.at - peak }
  else if (c.align === 'end') { from = Math.max(0, peak + 0.012 - c.dur); start = c.at - (peak + 0.012 - from) } // the clip is cut just after its peak
  else { from = (c.from ?? 0) * k; start = c.at }
  if (start < O) { from += O - start; start = O }
  const dur = c.align === 'end' ? peak + 0.012 - from : c.dur
  return { ...c, file: CLIP[c.clip], k, from: +from.toFixed(4), start: +start.toFixed(4), dur: +dur.toFixed(4),
    gain: +(c.peak - a.peakDb).toFixed(2), fi: Math.max(FADE_MIN, c.fi ?? 0.006), fo: Math.max(FADE_MIN, c.fo ?? 0.015) }
})

/* equal-power pan gains as ffmpeg expressions of the clip's own time t */
const panExpr = (c, side) => {
  if (c.pan == null) return null
  const [p0, p1] = Array.isArray(c.pan) ? c.pan : [c.pan, c.pan]
  const over = c.panOver ?? c.dur
  const p = p0 === p1 ? `${p0}` : `(${p0}+(${p1 - p0})*clip(t/${over},0,1))`
  const ang = `((${p})+1)*PI/4`
  return side === 'L' ? `1.4142*cos(${ang})` : `1.4142*sin(${ang})`
}

/* ---------- the graph ---------- */
const inputs = ['-i', MUSIC, ...placed.flatMap((c) => ['-i', c.file])]
const chains = placed.map((c, i) => {
  const st = Math.max(0, c.dur - c.fo)
  const pre = [
    ...(c.semitones ? [`asetrate=${Math.round(44100 * 2 ** (c.semitones / 12))}`, 'aresample=44100'] : []),
    ...(c.rate ? [`atempo=${c.rate}`] : []),
    `atrim=start=${c.from}:duration=${c.dur}`, 'asetpts=PTS-STARTPTS', 'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo',
    ...(c.tone ? [c.tone] : []), `volume=${c.gain}dB`, `afade=t=in:st=0:d=${c.fi}`, `afade=t=out:st=${st.toFixed(4)}:d=${c.fo}`,
  ].join(',')
  const delay = `adelay=delays=${Math.round(c.start * 1000)}:all=1`
  if (c.pan == null) return `[${i + 1}:a]${pre},${delay}[s${i}]`
  // mono -> two gains -> stereo, the pan following the element across the screen
  return `[${i + 1}:a]${pre},pan=mono|c0=0.5*c0+0.5*c1,asplit=2[l${i}][r${i}];` +
    `[l${i}]volume=eval=frame:volume='${panExpr(c, 'L')}'[lv${i}];[r${i}]volume=eval=frame:volume='${panExpr(c, 'R')}'[rv${i}];` +
    `[lv${i}][rv${i}]join=inputs=2:channel_layout=stereo,${delay}[s${i}]`
})
const duckExpr = DUCK.map(([s, a, e, r, d]) => `${d}*clip((t-${s})/${a},0,1)*clip((${e}-t)/${r},0,1)`).join('+')
const music = `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=eval=frame:volume='1-(${duckExpr})'[m]`
const bus = `${placed.map((_, i) => `[s${i}]`).join('')}amix=inputs=${placed.length}:normalize=0:duration=longest:dropout_transition=0,highshelf=f=8000:g=-2[bus]`
const graph = (musicOn) => [musicOn ? music : '[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=0[m]', ...chains, bus,
  '[m][bus]amix=inputs=2:normalize=0:duration=first:dropout_transition=0[x]'].join(';')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-mix-'))
const pass1 = path.join(tmp, 'mix.wav')
execFileSync(FFMPEG, ['-v', 'error', '-y', ...inputs, '-filter_complex', graph(true), '-map', '[x]', '-c:a', 'pcm_f32le', pass1])
// local verification only: the SFX bus alone. It is derived from the licensed files: never inside the repo.
if (process.env.MIX_SFX_STEM) {
  const stem = path.resolve(process.env.MIX_SFX_STEM)
  if (stem.startsWith(ROOT + path.sep)) { console.error('mix-intro: MIX_SFX_STEM must be outside the repo'); process.exit(1) }
  execFileSync(FFMPEG, ['-v', 'error', '-y', ...inputs, '-filter_complex', graph(false), '-map', '[x]', '-c:a', 'pcm_f32le', stem])
}

// loudness: the music's own target (-14 LUFS integrated), a soft limiter, one measured correction; same length as the music
const lufs = (file) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' })
  return Number(/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/.exec(r.stderr)?.[1])
}
const master = (g) => execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', pass1, '-af', `volume=${g.toFixed(2)}dB,alimiter=limit=0.891:attack=5:release=60:level=disabled`, '-ar', '44100', '-ac', '2', '-b:a', '160k', OUT])
let gain = TARGET_LUFS - lufs(pass1)
master(gain)
const miss = TARGET_LUFS - lufs(OUT)
if (Math.abs(miss) > 0.2) { gain += miss; master(gain) }

const dur = (f) => Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())
const report = {
  offset: O, music: path.relative(ROOT, MUSIC), out: path.relative(ROOT, OUT), lufsMix: +lufs(OUT).toFixed(1), lufsMusic: +lufs(MUSIC).toFixed(1),
  durMusic: dur(MUSIC), durOut: dur(OUT), duck: DUCK.map(([s, , e, , d]) => ({ from: s, to: e, db: +(20 * Math.log10(1 - d)).toFixed(1) })),
  cues: placed.map((c) => ({ name: c.name, file: path.relative(RAW, c.file), time: +c.at.toFixed(3), start: c.start, from: c.from, dur: c.dur,
    gainDb: c.gain, peakDbfs: c.peak, pan: c.pan ?? 0, ...(c.semitones ? { semitones: c.semitones } : {}) })),
}
fs.mkdirSync(path.dirname(CUES_OUT), { recursive: true })
fs.writeFileSync(CUES_OUT, JSON.stringify(report, null, 1) + '\n')
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`mix-intro: ${report.out}  ${report.lufsMix} LUFS (music ${report.lufsMusic})  ${report.durOut.toFixed(3)} s (music ${report.durMusic.toFixed(3)} s)  ${placed.length} cues -> ${path.relative(ROOT, CUES_OUT)}`)
