// Builds src/data/catalog.json, public/dl/<id>.zip and .claude-plugin/marketplace.json from skills/ and bundles/.
// Run before dev/build. The skills/ folders are the source of truth (they are what `npx skills add` installs).
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'
import { zipSync, strToU8 } from 'fflate'
import YAML from 'yaml'

const ROOT = new URL('..', import.meta.url).pathname
const REPO = { owner: 'anvarovali', name: 'head-skills', branch: 'master', url: 'https://github.com/anvarovali/head-skills' }
const SITE = 'https://skills.head.uz'
const TEXT = /\.(md|txt|json|ya?ml|js|mjs|cjs|ts|tsx|jsx|py|sh|css|html|toml|svg)$/i
const INLINE_MAX = 200_000

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  if (f === '.DS_Store') return []
  const p = join(dir, f)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

function gitDate(path) {
  try { return execFileSync('git', ['log', '-1', '--format=%cI', '--', path], { cwd: ROOT }).toString().trim() || null } catch { return null }
}

function parseSkillMd(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) throw new Error('SKILL.md has no frontmatter')
  return { fm: YAML.parse(m[1]) ?? {}, body: m[2].replace(/^\s+/, '') }
}

const skillsDir = join(ROOT, 'skills')
const categories = JSON.parse(readFileSync(join(skillsDir, 'categories.json'), 'utf8'))
const skills = []
mkdirSync(join(ROOT, 'public/dl'), { recursive: true })

for (const id of readdirSync(skillsDir).sort()) {
  const dir = join(skillsDir, id)
  if (!statSync(dir).isDirectory()) continue
  const mdPath = join(dir, 'SKILL.md')
  if (!existsSync(mdPath)) { console.warn(`skip ${id}: no SKILL.md`); continue }
  const { fm, body } = parseSkillMd(readFileSync(mdPath, 'utf8'))
  if (fm.name !== id) throw new Error(`${id}: frontmatter name "${fm.name}" must equal the folder name`)
  const head = existsSync(join(dir, 'head.json')) ? JSON.parse(readFileSync(join(dir, 'head.json'), 'utf8')) : {}
  const paths = walk(dir)
  const files = paths.map((p) => {
    const rel = relative(dir, p); const size = statSync(p).size
    return { path: rel, size, ...(TEXT.test(rel) && size <= INLINE_MAX ? { text: readFileSync(p, 'utf8') } : {}) }
  }).sort((a, b) => (a.path === 'SKILL.md' ? -1 : b.path === 'SKILL.md' ? 1 : a.path.localeCompare(b.path)))
  // zip: the folder itself at the root of the archive (Claude.ai upload expects <name>/SKILL.md); head.json is site metadata, left out
  const entries = {}
  for (const p of paths) { const rel = relative(dir, p); if (rel !== 'head.json') entries[`${id}/${rel}`] = readFileSync(p) }
  writeFileSync(join(ROOT, 'public/dl', `${id}.zip`), zipSync(entries, { level: 9 }))
  skills.push({
    id, name: fm.name, description: String(fm.description ?? ''),
    title: head.title ?? { en: fm.name }, summary: head.summary ?? { en: String(fm.description ?? '') },
    category: head.category ?? 'productivity', author: head.author ?? { name: 'HEAD' },
    icon: head.icon, featured: !!head.featured, badges: head.badges ?? [], youtube: head.youtube ?? {},
    updated: gitDate(dir) ?? statSync(mdPath).mtime.toISOString(), version: fm.version ?? head.version,
    frontmatter: fm, readme: body, files: files.filter((f) => f.path !== 'head.json'),
    zip: `/dl/${id}.zip`, repoPath: `skills/${id}`,
  })
}

const bundlesDir = join(ROOT, 'bundles')
const bundles = existsSync(bundlesDir) ? readdirSync(bundlesDir).filter((f) => f.endsWith('.json')).sort().map((f) => {
  const b = JSON.parse(readFileSync(join(bundlesDir, f), 'utf8'))
  const id = f.replace(/\.json$/, '')
  for (const s of b.skills) if (!skills.find((k) => k.id === s)) throw new Error(`bundle ${id}: unknown skill ${s}`)
  return { id, ...b }
}) : []

const catalog = { repo: REPO, site: SITE, categories, skills, bundles, builtAt: new Date().toISOString() }
writeFileSync(join(ROOT, 'src/data/catalog.json'), JSON.stringify(catalog, null, 1))

// Claude Code plugin marketplace: one plugin per skill, plus one per bundle.
mkdirSync(join(ROOT, '.claude-plugin'), { recursive: true })
const marketplace = {
  name: 'head-skills',
  owner: { name: 'HEAD', url: SITE },
  metadata: { description: 'Agent skills by HEAD (head.uz) and the AI Praktikum community.' },
  plugins: [
    ...skills.map((s) => ({ name: s.id, description: s.description.slice(0, 300), source: './', strict: false, skills: [`./skills/${s.id}`] })),
    ...bundles.map((b) => ({ name: b.id, description: b.summary.en, source: './', strict: false, skills: b.skills.map((s) => `./skills/${s}`) })),
  ],
}
writeFileSync(join(ROOT, '.claude-plugin/marketplace.json'), JSON.stringify(marketplace, null, 2) + '\n')
console.log(`catalog: ${skills.length} skills, ${bundles.length} bundles`)
