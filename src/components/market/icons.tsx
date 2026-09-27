/* Small line icons for the marketplace chrome. 24-unit grid, currentColor, 1.6 stroke unless noted. */
import type { ReactElement, SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = ({ size = 16, ...rest }: P) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false, ...rest,
})

export const SearchIcon = (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
export const ChevronRight = (p: P) => <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
export const ChevronLeft = (p: P) => <svg {...base(p)}><path d="m15 6-6 6 6 6" /></svg>
export const ChevronDown = (p: P) => <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
export const ArrowUpRight = (p: P) => <svg {...base(p)}><path d="M7 17 17 7M8 7h9v9" /></svg>
export const ArrowRight = (p: P) => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
export const ArrowUp = (p: P) => <svg {...base(p)}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
export const CheckIcon = (p: P) => <svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
export const CloseIcon = (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
export const MenuIcon = (p: P) => <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
export const GlobeIcon = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></svg>
)

/* Category glyphs: the fallback face of a card icon. One clean mark per category, bolder stroke so they sit like logos. */
const GLYPHS: Record<string, (p: P) => ReactElement> = {
  workflow: (p) => <svg {...base({ strokeWidth: 1.9, ...p })}><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7" /><path d="M20 4v4.7h-4.7" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.3" /><path d="M4 20v-4.7h4.7" /></svg>,
  design: (p) => <svg {...base({ strokeWidth: 1.9, ...p })}><path d="M12 3 5 10l2.5 9h9L19 10l-7-7Z" /><circle cx="12" cy="12" r="1.8" /><path d="M12 3v7.2" /></svg>,
  frontend: (p) => <svg {...base({ strokeWidth: 1.9, ...p })}><path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" /></svg>,
  backend: (p) => <svg {...base({ strokeWidth: 1.9, ...p })}><ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" /><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" /></svg>,
  content: (p) => <svg {...base({ strokeWidth: 1.9, ...p })}><path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6" /></svg>,
  productivity: (p) => <svg {...base({ strokeWidth: 1.9, ...p })}><path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12l1-8Z" /></svg>,
  bundle: (p) => <svg {...base({ strokeWidth: 1.9, ...p })}><path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Z" /><path d="m3.5 12 8.5 4.5 8.5-4.5" /><path d="m3.5 16.5 8.5 4.5 8.5-4.5" /></svg>,
  sparkle: (p) => <svg {...base({ strokeWidth: 1.9, ...p })}><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" /><path d="M19 16.5c.2 1.5.8 2.1 2.3 2.3-1.5.2-2.1.8-2.3 2.3-.2-1.5-.8-2.1-2.3-2.3 1.5-.2 2.1-.8 2.3-2.3Z" /></svg>,
  terminal: (p) => <svg {...base({ strokeWidth: 1.9, ...p })}><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><path d="m7.5 9.5 3 2.5-3 2.5M12.5 15h4" /></svg>,
}

export function CategoryGlyph({ id, ...p }: P & { id: string }) {
  const G = GLYPHS[id] ?? GLYPHS.sparkle
  return <G {...p} />
}
