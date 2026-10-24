import type { CSSProperties } from 'react'

const ARTWORK = import.meta.env.BASE_URL + 'brand/ptpn-gold-approved.webp'

/** Approved gold artwork, cropped by the SVG viewport without redrawing it. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="300 210 510 510" aria-hidden="true"><image href={ARTWORK} width="1652" height="952" /></svg>
}

export function Wordmark() {
  return <svg className="wordmark" viewBox="805 355 585 205" role="img" aria-label="PTPN"><image href={ARTWORK} width="1652" height="952" /></svg>
}

export function Logo({ size = 36, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="logo" style={{ '--logo-width': `${Math.round(size * 4.8)}px` } as CSSProperties}>
      <svg className="brand-lockup" viewBox="310 210 1080 490" role="img" aria-label={tagline ? 'PTPN. Be fit' : 'PTPN'}>
        <image href={ARTWORK} width="1652" height="952" />
      </svg>
    </span>
  )
}
