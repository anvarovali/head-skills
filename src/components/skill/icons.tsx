import type { SVGProps } from 'react'

/* 16px stroke icons, 1.5 stroke, currentColor. Drawn to sit on the text baseline like Qoder's remix-style set. */
type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 16): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
})

export const CopyIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="5.5" y="5.5" width="8" height="8" rx="1.6" /><path d="M10.5 5.5V3.9c0-.9-.7-1.6-1.6-1.6H3.9c-.9 0-1.6.7-1.6 1.6v5c0 .9.7 1.6 1.6 1.6h1.6" /></svg>
)
export const CheckIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3.2 8.4 6.4 11.4 12.8 4.8" /></svg>
)
export const DownloadIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M8 2.5v7.5M4.8 7 8 10.2 11.2 7M2.8 12.6v.4c0 .5.4.9.9.9h8.6c.5 0 .9-.4.9-.9v-.4" /></svg>
)
export const ShareIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="11.8" cy="3.8" r="1.8" /><circle cx="4.2" cy="8" r="1.8" /><circle cx="11.8" cy="12.2" r="1.8" /><path d="m5.8 7.1 4.4-2.4M5.8 8.9l4.4 2.4" /></svg>
)
export const LinkIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6.8 9.2a2.8 2.8 0 0 0 4 0l2-2a2.8 2.8 0 0 0-4-4l-.7.7" /><path d="M9.2 6.8a2.8 2.8 0 0 0-4 0l-2 2a2.8 2.8 0 0 0 4 4l.7-.7" /></svg>
)
export const DocIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M9.5 1.9H4.3c-.7 0-1.3.6-1.3 1.3v9.6c0 .7.6 1.3 1.3 1.3h7.4c.7 0 1.3-.6 1.3-1.3V5.4z" /><path d="M9.5 1.9v3.5H13M5.6 8.3h4.8M5.6 10.9h4.8" /></svg>
)
export const FolderIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M1.9 4.2c0-.7.6-1.3 1.3-1.3h3l1.5 1.7h5.1c.7 0 1.3.6 1.3 1.3v6c0 .7-.6 1.3-1.3 1.3H3.2c-.7 0-1.3-.6-1.3-1.3z" /><path d="M1.9 7h12.2" /></svg>
)
export const FileIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M9.3 1.9H4.3c-.7 0-1.3.6-1.3 1.3v9.6c0 .7.6 1.3 1.3 1.3h7.4c.7 0 1.3-.6 1.3-1.3V5.6z" /><path d="M9.3 1.9v3.7H13" /></svg>
)
export const GridIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="2.2" y="2.2" width="4.8" height="4.8" rx="1" /><rect x="9" y="2.2" width="4.8" height="4.8" rx="1" /><rect x="2.2" y="9" width="4.8" height="4.8" rx="1" /><rect x="9" y="9" width="4.8" height="4.8" rx="1" /></svg>
)
export const ExternalIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6.5 3H3.8c-.5 0-.8.3-.8.8v8.4c0 .5.3.8.8.8h8.4c.5 0 .8-.3.8-.8V9.5M9.5 3H13v3.5M13 3 7.5 8.5" /></svg>
)
export const ArrowRightIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 8h10M9 4l4 4-4 4" /></svg>
)
export const PlayIcon = ({ size = 22, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...p}><path d="M8 5.6v12.8c0 .8.9 1.3 1.6.9l10-6.4c.6-.4.6-1.3 0-1.7l-10-6.4C8.9 4.3 8 4.8 8 5.6z" fill="currentColor" /></svg>
)
export const GithubIcon = ({ size = 16, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden {...p}><path fill="currentColor" d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.4 7.4 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.6 3.9.3.3.5.8.5 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2" /></svg>
)
export const ChevronDownIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m4 6 4 4 4-4" /></svg>
)
