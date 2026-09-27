import { useMemo, useState } from 'react'
import type { Skill, SkillFile } from '@/data/types'
import { useDT } from './strings'
import { CopyIconButton } from './parts'
import { DownloadIcon, FileIcon, FolderIcon } from './icons'
import s from './Detail.module.css'

const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

type Entry = { kind: 'dir'; path: string; depth: number } | { kind: 'file'; file: SkillFile; depth: number }

/** Flat, sorted listing with folder rows: root files first, then each folder's contents indented under it. */
function toEntries(files: SkillFile[]): Entry[] {
  const out: Entry[] = []
  const seen = new Set<string>()
  const sorted = [...files].sort((a, b) => {
    const da = a.path.includes('/'), db = b.path.includes('/')
    if (da !== db) return da ? 1 : -1
    if (a.path === 'SKILL.md') return -1
    if (b.path === 'SKILL.md') return 1
    return a.path.localeCompare(b.path)
  })
  for (const f of sorted) {
    const parts = f.path.split('/')
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/')
      if (!seen.has(dir)) { seen.add(dir); out.push({ kind: 'dir', path: parts[i - 1], depth: i - 1 }) }
    }
    out.push({ kind: 'file', file: f, depth: parts.length - 1 })
  }
  return out
}

export function FileBrowser({ skill }: { skill: Skill }) {
  const t = useDT()
  const entries = useMemo(() => toEntries(skill.files), [skill.files])
  const [current, setCurrent] = useState(skill.files[0]?.path)
  const file = skill.files.find((f) => f.path === current) ?? skill.files[0]
  const lines = file?.text?.replace(/\n$/, '').split('\n')

  return (
    <div className={s.files}>
      <nav className={s.tree} aria-label={t('files.label')}>
        <div className={s.treeLabel}>{skill.id}/</div>
        {entries.map((e) => e.kind === 'dir' ? (
          <div key={`d:${e.path}:${e.depth}`} className={s.treeDir} style={{ paddingLeft: 10 + e.depth * 14 }}><FolderIcon />{e.path}</div>
        ) : (
          <button key={e.file.path} type="button" className={s.treeFile} style={{ paddingLeft: 10 + e.depth * 14 }}
            aria-current={e.file.path === file?.path ? 'true' : undefined} onClick={() => setCurrent(e.file.path)}>
            <FileIcon /><span>{e.file.path.split('/').pop()}</span>
          </button>
        ))}
      </nav>
      <div className={s.viewer}>
        {file && (
          <div className={s.viewerHead}>
            <span className={s.viewerPath}>{file.path}</span>
            <span className={s.viewerMeta}>{lines ? `${t('files.lines', { n: lines.length })} · ` : ''}{fmtSize(file.size)}</span>
            {file.text != null && <CopyIconButton text={file.text} label={t('copy.file')} />}
          </div>
        )}
        {lines ? (
          <pre className={s.code} tabIndex={0}>
            {lines.map((l, i) => (
              <span className={s.codeLine} key={i}><span className={s.codeNo}>{i + 1}</span><span className={s.codeText}>{l || ' '}</span></span>
            ))}
          </pre>
        ) : (
          <div className={s.noPreview}>
            <strong>{t('files.noPreview')}</strong>
            <p>{t('files.noPreviewSub')}</p>
            <a className={s.zip} href={skill.zip} download><DownloadIcon size={14} />{t('dl.zip')}</a>
          </div>
        )}
      </div>
    </div>
  )
}
