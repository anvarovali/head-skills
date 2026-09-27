#!/usr/bin/env node
// Validates every skill in skills/<id>/ (and every bundle in bundles/) before it can be merged.
//
//   npm run validate:skills                     check everything
//   node scripts/validate-skills.mjs skills/x   check one or more skill folders
//
// Exit code 1 when any ERROR is found. WARNINGS and NOTES never fail the run.
// head.json rules mirror schemas/head.schema.json (hand-written here to avoid a JSON Schema dependency).
//
// A line that legitimately needs a flagged pattern (for example a security skill quoting a prompt-injection
// phrase as an example) can carry the marker `head-skills-allow: <rule>` on the same line or the line above.
// That turns the error into a warning that a maintainer reviews by hand.
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs'
import { join, relative, extname, basename, resolve } from 'node:path'
import YAML from 'yaml'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const LOCALES = ['uz', 'ru', 'en']
const BADGES = ['official', 'praktikum-2026']
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_FOLDER = 2 * 1024 * 1024
const MAX_FILE = 1024 * 1024
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.svg'])
const HEAD_KEYS = ['$schema', 'title', 'summary', 'category', 'author', 'icon', 'featured', 'badges', 'youtube', 'version']
const BUNDLE_KEYS = ['$schema', 'title', 'summary', 'body', 'skills', 'badges', 'youtube']

// ---------------------------------------------------------------- report

const problems = [] // { level: 'error'|'warning'|'note', file, line?, rule, msg }
const add = (level, file, line, rule, msg) => problems.push({ level, file: relative(ROOT, file) || file, line, rule, msg })
const error = (file, line, rule, msg) => add('error', file, line, rule, msg)
const warn = (file, line, rule, msg) => add('warning', file, line, rule, msg)
const note = (file, line, rule, msg) => add('note', file, line, rule, msg)

// line number of the first `"key"` in a JSON text, for pointing at head.json problems
const jsonLine = (text, key) => {
  const i = text.indexOf(`"${key}"`)
  return i < 0 ? undefined : text.slice(0, i).split('\n').length
}

// ---------------------------------------------------------------- content scans

// Secrets. Each hit is an error: a real key in a public repo is leaked the moment the PR opens.
const SECRET_RULES = [
  ['aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, 'looks like an AWS access key id'],
  ['aws-secret-key', /aws_secret_access_key\s*[:=]\s*["']?[A-Za-z0-9/+]{40}\b/i, 'looks like an AWS secret access key'],
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/, 'contains a private key'],
  ['openai-style-key', /\bsk-(?:proj-|ant-(?:api\d\d-)?|live_|test_)?[A-Za-z0-9_-]{20,}/, 'looks like an API key starting with "sk-" (OpenAI, Anthropic, Stripe...)'],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/, 'looks like a GitHub token'],
  ['slack-token', /\bxox[abposre]-[A-Za-z0-9-]{10,}/, 'looks like a Slack token'],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/, 'looks like a Google API key'],
  ['telegram-bot-token', /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/, 'looks like a Telegram bot token'],
]

// Unsafe instructions. A skill is text an agent follows with the user's permissions, so these are errors.
const SH = String.raw`(?:sudo\s+)?(?:ba|z|da|k|fi)?sh\b`
const UNSAFE_RULES = [
  ['pipe-to-shell', new RegExp(String.raw`\b(?:curl|wget|iwr|fetch)\b[^\n|]*\|\s*` + SH), 'downloads a script and pipes it straight into a shell ("curl ... | sh"). Ask the user to download and read the script first, or link to the tool\'s official install page'],
  ['pipe-to-interpreter', /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:python3?|node|perl|ruby)\b/, 'downloads code and pipes it straight into an interpreter'],
  ['shell-from-download', new RegExp(SH + String.raw`[^\n]*(?:<\(|\$\()\s*(?:curl|wget)\b`), 'runs a downloaded script through a shell ("bash <(curl ...)" / "sh -c \\"$(curl ...)\\"")'],
  ['base64-exec', new RegExp(String.raw`base64\s+(?:-d|--decode|-D)\b[^\n]*\|\s*` + SH), 'decodes base64 and runs the result in a shell; hidden code cannot be reviewed'],
  ['base64-eval', /\b(?:eval|exec|Function)\s*\(\s*[^)\n]*\b(?:b64decode|atob|base64|Buffer\.from\([^)]*['"]base64)/, 'evaluates base64-decoded code; hidden code cannot be reviewed'],
  ['eval-remote', /\b(?:eval|exec)\s*\(\s*[^)\n]*\b(?:fetch|requests\.get|urlopen|urllib|http\.get|axios|curl|wget)\b/, 'evaluates code fetched from the network'],
  ['eval-remote-shell', /\beval\s+["']?\$\(\s*(?:curl|wget)\b/, 'evaluates the output of a download in the shell ("eval $(curl ...)")'],
  ['powershell-remote-exec', /\b(?:iex|Invoke-Expression)\b[^\n]*\b(?:iwr|irm|Invoke-WebRequest|Invoke-RestMethod|DownloadString)\b|\b(?:iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n]*\|\s*(?:iex|Invoke-Expression)\b/i, 'downloads and executes a PowerShell script in one step'],
  ['prompt-injection', /\b(?:ignore|forget|override)\s+(?:all\s+|any\s+)?(?:of\s+)?(?:the\s+|your\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions|prompts?|messages|rules|directions)/i, 'contains a prompt-injection phrase ("ignore previous instructions")'],
  ['prompt-injection', /\bdisregard\s+(?:all\s+|any\s+)?(?:the\s+|your\s+)?(?:system\s+prompt|system\s+message|previous\s+instructions|prior\s+instructions|instructions\s+above|safety\s+(?:rules|guidelines))/i, 'contains a prompt-injection phrase ("disregard the system prompt")'],
  ['prompt-injection', /\b(?:reveal|print|output|leak)\s+(?:your\s+|the\s+)?(?:system\s+prompt|hidden\s+instructions)/i, 'asks the agent to reveal its system prompt'],
  ['prompt-injection', /игнорируй(?:те)?\s+(?:все\s+)?(?:предыдущие|прошлые)\s+инструкции/i, 'contains a prompt-injection phrase ("игнорируй предыдущие инструкции")'],
]

// Invisible characters that can hide text from a human reviewer while an agent still reads it.
const HIDDEN = [
  [/[‪-‮⁦-⁩]/g, 'bidirectional control character'],
  [/[​‌⁠᠎­]/g, 'zero-width / invisible character'],
  [/[\u{E0000}-\u{E007F}]/gu, 'Unicode "tag" character (invisible text)'],
  [/﻿/g, 'zero-width no-break space (BOM) in the middle of the file'],
]
const EMOJI = /\p{Extended_Pictographic}|️/u

const allowed = (lines, i, rule) => {
  const re = new RegExp(String.raw`head-skills-allow:\s*[\w,\s-]*\b${rule}\b`)
  return re.test(lines[i]) || (i > 0 && re.test(lines[i - 1]))
}

function scanText(file, text) {
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    const n = i + 1
    for (const [rule, re, msg] of SECRET_RULES) {
      if (re.test(line)) error(file, n, `secret/${rule}`, `${msg}. Remove it, rotate (revoke) the key, and use an environment variable or a placeholder like YOUR_API_KEY instead.`)
    }
    for (const [rule, re, msg] of UNSAFE_RULES) {
      if (!re.test(line)) continue
      if (allowed(lines, i, rule)) warn(file, n, `unsafe/${rule}`, `${msg}. Allowed by a head-skills-allow marker: a maintainer must review this line.`)
      else error(file, n, `unsafe/${rule}`, `${msg}.`)
    }
    for (const [re, what] of HIDDEN) {
      for (const m of line.matchAll(re)) {
        if (m[0] === '﻿' && i === 0 && m.index === 0) continue // a leading BOM is harmless
        const cp = m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')
        error(file, n, 'unsafe/hidden-unicode', `contains an invisible ${what} (U+${cp}) at column ${m.index + 1}. Invisible characters can hide instructions from reviewers; delete it.`)
      }
    }
    // U+200D (zero-width joiner) is fine inside emoji sequences, suspicious anywhere else
    for (const m of line.matchAll(/‍/g)) {
      const before = line.slice(Math.max(0, m.index - 2), m.index), after = line.slice(m.index + 1, m.index + 3)
      if (!(EMOJI.test(before) && EMOJI.test(after))) error(file, n, 'unsafe/hidden-unicode', `contains an invisible zero-width joiner (U+200D) at column ${m.index + 1} outside an emoji. Delete it.`)
    }
  })
}

// ---------------------------------------------------------------- skill folder

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  const st = lstatSync(p)
  if (st.isSymbolicLink()) return [{ path: p, symlink: true, size: 0 }]
  return st.isDirectory() ? walk(p) : [{ path: p, size: st.size }]
})

const decoder = new TextDecoder('utf-8', { fatal: true })
const asText = (buf) => {
  if (buf.subarray(0, 8000).includes(0)) return null
  try { return decoder.decode(buf) } catch { return null }
}
const kb = (n) => `${(n / 1024).toFixed(0)} KB`

function checkL10n(file, text, key, value, { required, max }) {
  const line = jsonLine(text, key)
  if (value === undefined) { if (required) error(file, line, `head/${key}`, `"${key}" is missing. It needs at least an English ("en") value.`); return }
  if (!value || typeof value !== 'object' || Array.isArray(value)) { error(file, line, `head/${key}`, `"${key}" must be an object like { "en": "...", "uz": "...", "ru": "..." }.`); return }
  for (const k of Object.keys(value)) if (!LOCALES.includes(k)) error(file, line, `head/${key}`, `"${key}" has an unknown language "${k}". Allowed: uz, ru, en.`)
  if (typeof value.en !== 'string' || !value.en.trim()) error(file, line, `head/${key}`, `"${key}.en" is required: the English text is the fallback for every visitor.`)
  for (const k of LOCALES) {
    const v = value[k]
    if (v === undefined) continue
    if (typeof v !== 'string' || !v.trim()) error(file, line, `head/${key}`, `"${key}.${k}" must be a non-empty string.`)
    else if (max && v.length > max) error(file, line, `head/${key}`, `"${key}.${k}" is ${v.length} characters; keep it under ${max}.`)
  }
  const missing = LOCALES.filter((k) => k !== 'en' && value[k] === undefined)
  if (missing.length) warn(file, line, `head/${key}`, `"${key}" has no ${missing.join(' / ')} translation. Uzbek and Russian readers will see English.`)
}

function checkBadgesYoutube(file, text, obj) {
  if (obj.badges !== undefined) {
    const line = jsonLine(text, 'badges')
    if (!Array.isArray(obj.badges)) error(file, line, 'head/badges', '"badges" must be an array.')
    else {
      for (const b of obj.badges) if (!BADGES.includes(b)) error(file, line, 'head/badges', `unknown badge "${b}". The only badges are ${BADGES.map((x) => `"${x}"`).join(' and ')}, and maintainers add them.`)
      if (new Set(obj.badges).size !== obj.badges.length) error(file, line, 'head/badges', '"badges" lists the same badge twice.')
      if (obj.badges.length) note(file, line, 'head/badges', `badges ${JSON.stringify(obj.badges)}: maintainers add badges; in your own pull request leave "badges" empty.`)
    }
  }
  if (obj.youtube !== undefined) {
    const line = jsonLine(text, 'youtube')
    if (!obj.youtube || typeof obj.youtube !== 'object' || Array.isArray(obj.youtube)) error(file, line, 'head/youtube', '"youtube" must be an object like { "uz": "dQw4w9WgXcQ" }.')
    else for (const [k, v] of Object.entries(obj.youtube)) {
      if (!LOCALES.includes(k)) error(file, line, 'head/youtube', `"youtube" has an unknown language "${k}". Allowed: uz, ru, en.`)
      if (typeof v !== 'string' || !YOUTUBE_ID.test(v)) error(file, line, 'head/youtube', `"youtube.${k}" = ${JSON.stringify(v)} is not a YouTube video id. Use only the 11 characters after "watch?v=" (e.g. "dQw4w9WgXcQ"), not the full link.`)
    }
  }
}

function checkHeadJson(file, categories) {
  const text = readFileSync(file, 'utf8')
  let h
  try { h = JSON.parse(text) } catch (e) { error(file, undefined, 'head/json', `is not valid JSON: ${e.message}`); return }
  if (!h || typeof h !== 'object' || Array.isArray(h)) { error(file, 1, 'head/json', 'must be a JSON object.'); return }
  for (const k of Object.keys(h)) if (!HEAD_KEYS.includes(k)) error(file, jsonLine(text, k), 'head/unknown-key', `unknown field "${k}". Allowed: ${HEAD_KEYS.filter((x) => x !== '$schema').join(', ')}.`)
  checkL10n(file, text, 'title', h.title, { required: true, max: 60 })
  checkL10n(file, text, 'summary', h.summary, { required: true, max: 200 })
  if (h.category === undefined) error(file, undefined, 'head/category', `"category" is missing. Pick one of: ${categories.join(', ')}.`)
  else if (!categories.includes(h.category)) error(file, jsonLine(text, 'category'), 'head/category', `category "${h.category}" does not exist. Pick one of: ${categories.join(', ')} (see skills/categories.json).`)
  if (h.author === undefined) error(file, undefined, 'head/author', '"author" is missing. Add { "name": "Your Name", "github": "your-github-username" }.')
  else {
    const line = jsonLine(text, 'author'), a = h.author
    if (!a || typeof a !== 'object' || Array.isArray(a)) error(file, line, 'head/author', '"author" must be an object like { "name": "...", "github": "..." }.')
    else {
      for (const k of Object.keys(a)) if (!['name', 'github'].includes(k)) error(file, line, 'head/author', `"author" has an unknown field "${k}". Allowed: name, github.`)
      if (typeof a.name !== 'string' || !a.name.trim() || a.name.length > 80) error(file, line, 'head/author', '"author.name" must be a non-empty string (at most 80 characters).')
      if (a.github !== undefined && (typeof a.github !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(a.github))) error(file, line, 'head/author', `"author.github" = ${JSON.stringify(a.github)} is not a GitHub username (just the name, not a link).`)
    }
  }
  if (h.icon !== undefined && (typeof h.icon !== 'string' || !/^\/(?!.*\.\.)[A-Za-z0-9/_.-]+\.(svg|png|webp|jpg|jpeg|avif)$/.test(h.icon))) error(file, jsonLine(text, 'icon'), 'head/icon', '"icon" must be a site path like "/icons/my-skill.svg", or left out.')
  if (h.featured !== undefined) {
    if (typeof h.featured !== 'boolean') error(file, jsonLine(text, 'featured'), 'head/featured', '"featured" must be true or false.')
    else if (h.featured) note(file, jsonLine(text, 'featured'), 'head/featured', '"featured": true is set by maintainers; leave it out of your own pull request.')
  }
  if (h.version !== undefined && (typeof h.version !== 'string' || h.version.length > 32)) error(file, jsonLine(text, 'version'), 'head/version', '"version" must be a short string such as "1.0.0".')
  checkBadgesYoutube(file, text, h)
}

function checkSkill(dir, categories) {
  const id = basename(dir)
  const mdPath = join(dir, 'SKILL.md')
  if (!NAME_RE.test(id) || id.length > 64) error(dir, undefined, 'folder/name', `folder name "${id}" must be kebab-case (lowercase letters, digits and single hyphens, like "my-skill") and at most 64 characters.`)

  // files: size, type, secrets, unsafe patterns
  const files = walk(dir)
  let total = 0
  for (const f of files) {
    const name = basename(f.path), ext = extname(name).toLowerCase()
    if (name === '.DS_Store') { warn(f.path, undefined, 'files/junk', '.DS_Store is macOS junk; delete it (it is not committed if you use the repo .gitignore).'); continue }
    if (f.symlink) { error(f.path, undefined, 'files/symlink', 'is a symbolic link. Copy the real file into the skill folder instead.'); continue }
    total += f.size
    if (f.size > MAX_FILE) error(f.path, undefined, 'files/too-large', `is ${kb(f.size)}; a single file may be at most 1 MB.`)
    if (/^\.env(\..+)?$/i.test(name) && !/^\.env\.(example|sample|template)$/i.test(name)) error(f.path, undefined, 'secret/env-file', `"${name}" files hold secrets and must never be committed. Use ".env.example" with placeholder values instead.`)
    if (/\.(pem|key|p12|pfx|keystore|jks)$/i.test(name) || /^id_(rsa|dsa|ecdsa|ed25519)$/.test(name)) error(f.path, undefined, 'secret/key-file', 'looks like a private key or certificate store. Remove it.')
    if (IMAGE_EXT.has(ext) && ext !== '.svg') continue // raster images: allowed, not scanned
    const buf = readFileSync(f.path)
    const text = asText(buf)
    if (text === null) { error(f.path, undefined, 'files/binary', `is a binary file. Skills may only contain text files and images (${[...IMAGE_EXT].join(' ')}).`); continue }
    scanText(f.path, text)
  }
  if (total > MAX_FOLDER) error(dir, undefined, 'files/folder-too-large', `the skill folder is ${kb(total)} in total; the limit is 2 MB. Move large assets out, or link to them.`)

  // SKILL.md
  if (!existsSync(mdPath)) { error(dir, undefined, 'skill/missing', 'has no SKILL.md. Every skill folder needs one (see templates/skill/SKILL.md).'); return }
  const src = readFileSync(mdPath, 'utf8').replace(/^﻿/, '')
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!m) { error(mdPath, 1, 'frontmatter/missing', 'must start with a YAML frontmatter block: a "---" line, then "name:" and "description:", then another "---" line.'); return }
  let fm
  try { fm = YAML.parse(m[1]) } catch (e) {
    const line = e.linePos?.[0]?.line ? e.linePos[0].line + 1 : 2
    error(mdPath, line, 'frontmatter/yaml', `frontmatter is not valid YAML: ${e.message.split('\n')[0]}. Tip: if the description contains ": " wrap it in double quotes.`)
    return
  }
  if (!fm || typeof fm !== 'object' || Array.isArray(fm)) { error(mdPath, 2, 'frontmatter/yaml', 'frontmatter must be key: value pairs.'); return }
  const fmLine = (key) => { const i = m[1].split(/\r?\n/).findIndex((l) => l.startsWith(`${key}:`)); return i < 0 ? 1 : i + 2 }

  const name = fm.name
  if (name === undefined) error(mdPath, 1, 'frontmatter/name', '"name" is missing from the frontmatter.')
  else if (typeof name !== 'string') error(mdPath, fmLine('name'), 'frontmatter/name', '"name" must be a string.')
  else {
    if (name !== id) error(mdPath, fmLine('name'), 'frontmatter/name', `name "${name}" must be exactly the folder name "${id}".`)
    if (!NAME_RE.test(name)) error(mdPath, fmLine('name'), 'frontmatter/name', `name "${name}" must be kebab-case: lowercase letters, digits and single hyphens, not starting or ending with a hyphen.`)
    if (name.length > 64) error(mdPath, fmLine('name'), 'frontmatter/name', `name is ${name.length} characters; the limit is 64.`)
    if (/anthropic|claude/.test(name)) error(mdPath, fmLine('name'), 'frontmatter/name', 'name may not contain the reserved words "anthropic" or "claude" (Claude.ai rejects the upload).')
  }

  const d = fm.description
  if (d === undefined) error(mdPath, 1, 'frontmatter/description', '"description" is missing. It is the text agents read to decide when to use the skill.')
  else if (typeof d !== 'string') error(mdPath, fmLine('description'), 'frontmatter/description', '"description" must be a single string.')
  else {
    const len = d.trim().length
    if (len < 20) error(mdPath, fmLine('description'), 'frontmatter/description', `description is ${len} characters; write at least 20. Say what the skill does AND when to use it.`)
    if (len > 1024) error(mdPath, fmLine('description'), 'frontmatter/description', `description is ${len} characters; the limit is 1024.`)
    if (/<[^>]+>/.test(d)) error(mdPath, fmLine('description'), 'frontmatter/description', 'description may not contain XML/HTML tags like <tag> (Claude.ai rejects the upload).')
    if (len >= 20 && !/\b(use (?:when|this|it|for|whenever)|when (?:the )?user|trigger)/i.test(d)) warn(mdPath, fmLine('description'), 'frontmatter/description', 'description does not say WHEN to use the skill. Add a sentence like "Use when the user asks to ..." so agents know when to load it.')
  }

  const bodyLines = src.slice(m[0].length).split(/\r?\n/).length
  if (bodyLines > 500) warn(mdPath, undefined, 'skill/long', `SKILL.md body is ${bodyLines} lines. Keep it under ~500 and move details into separate files the skill links to.`)

  // head.json
  const headPath = join(dir, 'head.json')
  if (existsSync(headPath)) checkHeadJson(headPath, categories)
  else warn(dir, undefined, 'head/missing', 'has no head.json, so the website shows only the English name and description. Copy templates/skill/head.json.')
}

// ---------------------------------------------------------------- bundles

function checkBundle(file, skillIds) {
  const text = readFileSync(file, 'utf8')
  let b
  try { b = JSON.parse(text) } catch (e) { error(file, undefined, 'bundle/json', `is not valid JSON: ${e.message}`); return }
  const id = basename(file, '.json')
  if (!NAME_RE.test(id) || id.length > 64) error(file, undefined, 'bundle/name', `bundle file name "${id}" must be kebab-case.`)
  if (skillIds.includes(id)) error(file, undefined, 'bundle/name', `bundle "${id}" has the same name as a skill; both become plugins in .claude-plugin/marketplace.json, so the names must differ.`)
  for (const k of Object.keys(b)) if (!BUNDLE_KEYS.includes(k)) error(file, jsonLine(text, k), 'bundle/unknown-key', `unknown field "${k}". Allowed: ${BUNDLE_KEYS.filter((x) => x !== '$schema').join(', ')}.`)
  checkL10n(file, text, 'title', b.title, { required: true, max: 60 })
  checkL10n(file, text, 'summary', b.summary, { required: true, max: 200 })
  if (b.body !== undefined) checkL10n(file, text, 'body', b.body, { required: false })
  if (!Array.isArray(b.skills) || !b.skills.length) error(file, jsonLine(text, 'skills'), 'bundle/skills', '"skills" must be a non-empty array of skill ids.')
  else for (const s of b.skills) if (!skillIds.includes(s)) error(file, jsonLine(text, 'skills'), 'bundle/skills', `lists "${s}", but there is no skills/${s}/ folder.`)
  checkBadgesYoutube(file, text, b)
  scanText(file, text)
}

// ---------------------------------------------------------------- run

const skillsDir = join(ROOT, 'skills')
let categories = []
try {
  categories = JSON.parse(readFileSync(join(skillsDir, 'categories.json'), 'utf8')).map((c) => c.id)
} catch (e) { error(join(skillsDir, 'categories.json'), undefined, 'repo/categories', `cannot be read: ${e.message}`) }
try {
  const schemaCats = JSON.parse(readFileSync(join(ROOT, 'schemas/head.schema.json'), 'utf8')).properties.category.enum
  if (JSON.stringify([...schemaCats].sort()) !== JSON.stringify([...categories].sort())) error(join(ROOT, 'schemas/head.schema.json'), undefined, 'repo/schema', `category list ${JSON.stringify(schemaCats)} is out of sync with skills/categories.json ${JSON.stringify(categories)}.`)
} catch (e) { error(join(ROOT, 'schemas/head.schema.json'), undefined, 'repo/schema', `cannot be read: ${e.message}`) }

const args = process.argv.slice(2)
const allIds = readdirSync(skillsDir).filter((f) => !f.startsWith('.') && lstatSync(join(skillsDir, f)).isDirectory()).sort()
for (const f of readdirSync(skillsDir)) {
  if (f.startsWith('.') || f === 'categories.json') continue
  if (!lstatSync(join(skillsDir, f)).isDirectory()) error(join(skillsDir, f), undefined, 'repo/stray-file', 'only skill folders (and categories.json) belong directly in skills/. Put your files inside skills/<your-skill>/.')
}
const targets = args.length ? args.map((a) => resolve(a)) : allIds.map((id) => join(skillsDir, id))
for (const dir of targets) {
  if (!existsSync(dir) || !lstatSync(dir).isDirectory()) { error(dir, undefined, 'repo/not-found', 'is not a folder.'); continue }
  checkSkill(dir, categories)
}
if (!args.length) {
  const bundlesDir = join(ROOT, 'bundles')
  if (existsSync(bundlesDir)) for (const f of readdirSync(bundlesDir).filter((x) => x.endsWith('.json')).sort()) checkBundle(join(bundlesDir, f), allIds)
}

// ---------------------------------------------------------------- print

const color = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s)
const LABEL = { error: paint('31;1', 'ERROR  '), warning: paint('33', 'warning'), note: paint('36', 'note   ') }
const order = { error: 0, warning: 1, note: 2 }
const byLoc = (a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || order[a.level] - order[b.level]

console.log(`Checked ${targets.length} skill folder(s)${args.length ? '' : ' and the bundles'}.\n`)
for (const p of [...problems].sort(byLoc)) {
  const loc = p.line ? `${p.file}:${p.line}` : p.file
  console.log(`${LABEL[p.level]}  ${loc}\n         ${p.msg}  ${paint('2', `[${p.rule}]`)}`)
}
const count = (l) => problems.filter((p) => p.level === l).length
const [e, w, n] = [count('error'), count('warning'), count('note')]
if (problems.length) console.log('')
if (e) {
  console.log(paint('31;1', `✗ ${e} error(s), ${w} warning(s), ${n} note(s). Fix the errors above, then run "npm run validate:skills" again.`))
  process.exit(1)
}
console.log(paint('32;1', `✓ No errors`) + ` (${w} warning(s), ${n} note(s)).`)
