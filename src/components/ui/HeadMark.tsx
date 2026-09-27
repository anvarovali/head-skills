import { useId } from 'react'
import clsx from 'clsx'

/* The HEAD mark as vectors (copied from head-academy/components/layout/head-mark.tsx).
   viewBox 0 0 112.9145 45.7984. The A has no left leg: the slash is it, and it is the one coloured glyph. */
export const HEAD_MARK_VIEWBOX = '0 0 112.9145 45.7984'
export const SLASH_VIEWBOX = '56.7156 0 16.1744 45.7984'
export const SLASH_POINTS =
  '70.0607 11.2475 72.89 0 68.1721 0 56.7156 45.7984 61.3637 45.7984 64.1094 34.8854 65.4746 29.0037 65.4753 29.0037 70.0607 11.2475'
export const HEAD_LETTER_PATHS = [
  'M17.52,7.3263v14.24H4.65V7.3263H0v32.86h4.65v-14.35h12.87v14.35h4.66V7.3263h-4.66Z',
  'M51.75,11.5463v-4.22h-22.17v32.86h22.17v-4.27h-17.57l.05-10.02,12.87-.06v-4.21h-12.92l.05-10.08h17.52Z',
  'M101.6345,7.3263h-11.45v32.86h11.45c6.73,0,11.28-5.42,11.28-13.53v-5.8c0-8.05-4.55-13.53-11.28-13.53ZM108.0445,26.6563c0,5.37-2.58,8.99-6.36,8.99h-6.84V11.8163h6.84c3.78,0,6.36,3.67,6.36,9.04v5.8Z',
] as const
export const HEAD_A_POINTS =
  '75.8945 8.8764 73.4945 18.4063 76.0045 28.1363 71.0445 28.1363 69.9745 32.3563 76.9845 32.3563 79.0145 40.1864 83.7745 40.1864 75.8945 8.8764'

export const GLYPHS = [
  { id: 'H', d: HEAD_LETTER_PATHS[0] },
  { id: 'E', d: HEAD_LETTER_PATHS[1] },
  { id: 'slash', points: SLASH_POINTS },
  { id: 'A', points: HEAD_A_POINTS },
  { id: 'D', d: HEAD_LETTER_PATHS[2] },
] as const

export function Slash({ className }: { className?: string }) {
  return (
    <svg viewBox={SLASH_VIEWBOX} fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <polygon points={SLASH_POINTS} />
    </svg>
  )
}

/** The wordmark. Each glyph is its own <g data-glyph> so the preloader can animate them separately. */
export function HeadMark({ className, letterClassName, slashClassName, clip = false, title }: {
  className?: string; letterClassName?: string; slashClassName?: string; clip?: boolean; title?: string
}) {
  const uid = useId().replace(/:/g, '')
  const clipId = `hm-${uid}`
  return (
    <svg viewBox={HEAD_MARK_VIEWBOX} overflow="visible" className={className} role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'} focusable="false">
      {title ? <title>{title}</title> : null}
      {clip ? <clipPath id={clipId}><rect x="-20" y="-4" width="160" height="49.8" /></clipPath> : null}
      <g clipPath={clip ? `url(#${clipId})` : undefined}>
        {GLYPHS.map((g) => (
          <g key={g.id} data-glyph={g.id} fill="currentColor" className={clsx(g.id === 'slash' ? slashClassName : letterClassName)}>
            {'d' in g ? <path d={g.d} /> : <polygon points={g.points} />}
          </g>
        ))}
      </g>
    </svg>
  )
}
