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
    A short line in the user's language on top tells a human what it is. */
export function agentPrompt(ids: string[], locale: Locale): string {
  const { url, branch, owner, name } = catalog.repo
  const list = ids.map((id) => `- ${id}: ${url}/tree/${branch}/skills/${id}`).join('\n')
  const lead: Record<Locale, string> = {
    uz: '(HEAD skills: quyidagi ko‘rsatmani agentingiz bajaradi.)',
    ru: '(HEAD skills: эту инструкцию выполнит ваш агент.)',
    en: '(HEAD skills: your agent will carry out the instructions below.)',
  }
  return `${lead[locale]}

Install ${ids.length > 1 ? 'these agent skills' : 'this agent skill'} from HEAD skills (${catalog.site}):
${list}

1. Run: npx skills add ${owner}/${name} ${ids.map((id) => `-s ${id}`).join(' ')} -g -y
   (the skills CLI detects which agents are installed — Claude Code, Codex, Cursor, Gemini CLI, etc. — and installs into each one).
2. If npx is not available or the command fails, install manually instead: download each folder above (it contains a SKILL.md and any supporting files) and copy it into your skills directory — ~/.claude/skills/<name>/ for Claude Code, ~/.agents/skills/<name>/ for Cursor and other agents, ~/.codex/skills/<name>/ for Codex, ~/.gemini/skills/<name>/ for Gemini CLI. Keep the folder name equal to the skill name.
3. Verify: confirm each installed folder contains SKILL.md with a "name:" matching the folder, then tell me the skill is ready and in one sentence what it does and when it triggers. If a restart of the agent is needed to load new skills, tell me.`
}
