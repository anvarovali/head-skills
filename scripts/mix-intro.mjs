#!/usr/bin/env node
/* Rebuild public/audio/intro.mp3 = our own Magnific music (public/audio/intro-music.mp3) + the owner's licensed Envato
   Elements SFX, baked into ONE mixed track.

   LICENSING: the repo is public and the Envato licence forbids redistributing the source files. This script only READS
   them from $HOME/Downloads/head-skills-sfx/raw (or $SFX_DIR) and writes the mixed end product. Never copy a raw or
   trimmed SFX file into the repo or public/. Without the folder the script exits cleanly and leaves intro.mp3 alone.

   Every cue is in FILE time (the show's timeline runs in the track's own time; playback starts at INTRO_OFFSET). Each
   clip is aligned by its own detected onset (hits, taps) or loudness peak (whooshes) to the exact visual hit.

   node scripts/mix-intro.mjs            -> writes public/audio/intro.mp3 and workbench/intro-mix-cues.json */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const FFMPEG = process.env.FFMPEG || (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg')
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

/* ---------- the clips (found by folder; __MACOSX ignored) ---------- */
function findWav(folder) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    if (e.name === '__MACOSX' || e.name.startsWith('._')) return []
    const p = path.join(d, e.name)
    return e.isDirectory() ? walk(p) : e.name.toLowerCase().endsWith('.wav') ? [p] : []
  })
  const dir = path.join(RAW, folder)
  const hit = fs.existsSync(dir) ? walk(dir)[0] : undefined
  if (!hit) throw new Error(`mix-intro: no .wav in ${dir}`)
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

/* ---------- the cue sheet (file time = seconds after the click + OFFSET; see src/components/intro/timing.ts) ---------- */
const O = OFFSET
const SNAP = 5.863 - 0.4876 // HEAD.uz snaps one beat before the riser's second downbeat
const cues = [
  // 1 the language click: the tap is the very first thing in the track
  { name: 'click', clip: 'tap', at: O + 0.005, align: 'onset', dur: 0.16, peak: -16, fadeIn: 0.003, fadeOut: 0.08 },
  // 2 "Salom" lands on the 3.912 s downbeat: a gentle swell peaking just after it
  { name: 'salom', clip: 'slide', at: 4.05, align: 'peak', dur: 0.9, peak: -19, fadeIn: 0.14, fadeOut: 0.25 },
  // 3 the HEAD glyphs snap in (H, E, /A, D, then .uz): tiny ticks, very quiet
  ...[0, 1, 2, 3, 4].map((i) => ({ name: `glyph${i}`, clip: 'tap', at: SNAP - 0.04 + i * 0.03 + 0.02, align: 'onset', dur: 0.08, peak: -28, fadeIn: 0.002, fadeOut: 0.05 })),
  { name: 'glyph.uz', clip: 'tap', at: SNAP + 0.1 + 0.02, align: 'onset', dur: 0.08, peak: -29, fadeIn: 0.002, fadeOut: 0.05 },
  // 4 THE DROP (7.814 s): the cinematic hit + the sub, on the music's own kick, tails cut to ~2.5 s
  { name: 'drop-hit', clip: 'hit', at: 7.814, align: 'onset', dur: 2.5, peak: -11, fadeIn: 0.004, fadeOut: 1.7, tone: 'highshelf=f=6000:g=-5' },
  { name: 'drop-sub', clip: 'sub', at: 7.814, align: 'onset', dur: 2.5, peak: -9, fadeIn: 0.004, fadeOut: 1.6 },
  // 5 the folders open and the camera pushes into one (11.15 -> 11.72 s)
  { name: 'push', clip: 'whoosh', at: 11.46, align: 'peak', dur: 1.2, peak: -19, fadeIn: 0.1, fadeOut: 0.5 },
  // 6 the cards burst out on the bar-3 downbeat (11.691 s)
  { name: 'burst', clip: 'airy', at: 11.74, align: 'peak', dur: 1.3, peak: -17, fadeIn: 0.06, fadeOut: 0.65 },
  // 7 the command is revealed over two beats (13.71 -> 14.48 s): a slice of typing, low
  { name: 'typing', clip: 'keys', at: 13.71, align: 'start', from: 2.0, dur: 0.78, peak: -26, fadeIn: 0.04, fadeOut: 0.14 },
  // 8 the return hit: "✓ … installed" (14.582 s)
  { name: 'chime', clip: 'chime', at: 14.582, align: 'onset', dur: 0.2, peak: -15, fadeIn: 0.002, fadeOut: 0.06 },
  // 9 the cards fly to the grid, then a soft tap as each one lands (measured settle 16.55 / 16.70 / 16.86 s)
  { name: 'flight', clip: 'swoosh', at: 16.3, align: 'peak', dur: 1.6, peak: -19, fadeIn: 0.25, fadeOut: 0.55 },
  ...[16.5, 16.65, 16.81].map((t, i) => ({ name: `land${i}`, clip: 'tap', at: t, align: 'onset', dur: 0.1, peak: -25, fadeIn: 0.002, fadeOut: 0.06 })),
]

/* place: the clip's alignment point lands on `at`; a clip that would start before the offset has its head trimmed */
const placed = cues.map((c) => {
  const a = A[c.clip]
  const point = c.align === 'onset' ? a.onset : c.align === 'peak' ? a.peak : 0
  let from = c.from ?? Math.max(0, point - (c.align === 'onset' ? 0.004 : point)) // onset cues keep 4 ms of pre-roll
  if (c.align === 'peak') from = 0
  let start = c.align === 'start' ? c.at : c.at - (point - from)
  if (start < O) { from += O - start; start = O }
  const gain = c.peak - a.peakDb
  return { ...c, file: CLIP[c.clip], from: +from.toFixed(4), start: +start.toFixed(4), gain: +gain.toFixed(2) }
})

/* ---------- mix ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-mix-'))
const inputs = ['-i', MUSIC, ...placed.flatMap((c) => ['-i', c.file])]
const chains = placed.map((c, i) => {
  const st = Math.max(0, c.dur - c.fadeOut)
  const f = [
    `atrim=start=${c.from}:duration=${c.dur}`, 'asetpts=PTS-STARTPTS', 'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo',
    ...(c.tone ? [c.tone] : []), `volume=${c.gain}dB`, `afade=t=in:st=0:d=${c.fadeIn}`, `afade=t=out:st=${st.toFixed(3)}:d=${c.fadeOut}`,
    `adelay=delays=${Math.round(c.start * 1000)}:all=1`,
  ]
  return `[${i + 1}:a]${f.join(',')}[s${i}]`
})
const mixIn = ['[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[m]', ...chains].join(';')
const graph = `${mixIn};[m]${placed.map((_, i) => `[s${i}]`).join('')}amix=inputs=${placed.length + 1}:normalize=0:duration=first:dropout_transition=0[x]`
const pass1 = path.join(tmp, 'mix.wav')
execFileSync(FFMPEG, ['-v', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[x]', '-c:a', 'pcm_f32le', pass1])
// local verification only: MIX_SFX_STEM=/somewhere/outside/the/repo.wav writes the SFX layer alone (music muted). It is
// derived from the licensed files, so it must never be written into, or committed to, the repo.
if (process.env.MIX_SFX_STEM) {
  const stem = path.resolve(process.env.MIX_SFX_STEM)
  if (stem.startsWith(ROOT + path.sep)) { console.error('mix-intro: MIX_SFX_STEM must be outside the repo'); process.exit(1) }
  execFileSync(FFMPEG, ['-v', 'error', '-y', ...inputs, '-filter_complex', graph.replace('[0:a]aformat', '[0:a]volume=0,aformat'), '-map', '[x]', '-c:a', 'pcm_f32le', stem])
}

// loudness: match the music's own target (-14 LUFS integrated), then a soft limiter; same length as the music
const lufs = (file) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' })
  return Number(/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/.exec(r.stderr)?.[1])
}
const master = (g) => execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', pass1, '-af', `volume=${g.toFixed(2)}dB,alimiter=limit=0.891:attack=5:release=60:level=disabled`, '-ar', '44100', '-ac', '2', '-b:a', '160k', OUT])
let gain = TARGET_LUFS - lufs(pass1)
master(gain)
// the limiter shaves a little loudness off the peaks; one measured correction lands it on target
const miss = TARGET_LUFS - lufs(OUT)
if (Math.abs(miss) > 0.2) { gain += miss; master(gain) }
const dur = (f) => Number(execFileSync(FFMPEG.replace(/ffmpeg$/, 'ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())
const report = { offset: O, music: path.relative(ROOT, MUSIC), out: path.relative(ROOT, OUT), lufsMix: +lufs(OUT).toFixed(1), lufsMusic: +lufs(MUSIC).toFixed(1),
  durMusic: dur(MUSIC), durOut: dur(OUT), cues: placed.map(({ name, clip, at, start, from, dur: d, gain: g }) => ({ name, clip, at: +at.toFixed(3), start, from, dur: d, gainDb: g })) }
fs.mkdirSync(path.dirname(CUES_OUT), { recursive: true })
fs.writeFileSync(CUES_OUT, JSON.stringify(report, null, 1) + '\n')
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`mix-intro: ${report.out}  ${report.lufsMix} LUFS (music ${report.lufsMusic})  ${report.durOut.toFixed(3)} s (music ${report.durMusic.toFixed(3)} s)  ${placed.length} cues -> ${path.relative(ROOT, CUES_OUT)}`)
