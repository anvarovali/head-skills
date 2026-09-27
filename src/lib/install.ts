import { catalog } from '@/data/catalog'
import type { Locale } from '@/i18n/locales'

/** The one-line CLI install for one or more skills from this repo. Works for Claude Code, Codex, Cursor, Gemini CLI … */
export function installCommand(ids: string[], { global = true } = {}): string {
  const { owner, name } = catalog.repo
  return `npx skills add ${owner}/${name} ${ids.map((id) => `-s ${id}`).join(' ')}${global ? ' -g' : ''} -y`
}

export function repoFolderUrl(id: string): string {
  const { url, branch } = catalog.repo
  return `${url}/tree/${branch}/skills/${id}`
}

/** A prompt the user pastes into ANY coding agent. Written in English on purpose: every agent reads it reliably.
    `locale` is kept in the signature for callers (and a future localized preamble); the text itself is English. */
export function agentPrompt(ids: string[], _locale: Locale): string {
  const { url, branch, owner, name } = catalog.repo
  const list = ids.map((id) => `- ${id}: ${url}/tree/${branch}/skills/${id}`).join('\n')
  return `Install ${ids.length > 1 ? 'these agent skills' : 'this agent skill'} from HEAD skills (${catalog.site}):
${list}

1. Run: npx skills add ${owner}/${name} ${ids.map((id) => `-s ${id}`).join(' ')} -g -y
   (the skills CLI detects which agents are installed — Claude Code, Codex, Cursor, Gemini CLI, etc. — and installs into each one).
2. If npx is not available or the command fails, install manually instead: download each folder above (it contains a SKILL.md and any supporting files) and copy it into your skills directory — ~/.claude/skills/<name>/ for Claude Code, ~/.agents/skills/<name>/ for Cursor and other agents, ~/.codex/skills/<name>/ for Codex, ~/.gemini/skills/<name>/ for Gemini CLI. Keep the folder name equal to the skill name.
3. Verify: confirm each installed folder contains SKILL.md with a "name:" matching the folder, then tell me the skill is ready and in one sentence what it does and when it triggers. If a restart of the agent is needed to load new skills, tell me.`
}

/** Claude Code plugin route: add the repo's marketplace once, then install the skill (or bundle) as a plugin.
    Plugin names equal the skill / bundle id (see scripts/build-catalog.mjs -> .claude-plugin/marketplace.json). */
export function pluginCommands(pluginId: string): string {
  const { owner, name } = catalog.repo
  return `/plugin marketplace add ${owner}/${name}\n/plugin install ${pluginId}@${name}`
}

/** Absolute URL of a skill's zip on the site (for copied text; the page itself links the relative path). */
export function zipUrl(id: string): string {
  return `${catalog.site}/dl/${id}.zip`
}
