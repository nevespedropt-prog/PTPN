/** PTPN mark: monoline letters inside a progress ring that is nearly closed (source: branding/ptpn-logo.svg). */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <rect width="120" height="120" rx="26" fill="#0b0b0d" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="#24242a" strokeWidth="4.5" />
      <path d="M60 20a40 40 0 1 1 -40 40" fill="none" stroke="#f4f4f5" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M20 60a40 40 0 0 1 31-39" fill="none" stroke="#e11d2e" strokeWidth="4.5" strokeLinecap="round" />
      <g fill="none" stroke="#f4f4f5" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M34 70V52H38A5 5 0 0 1 38 62H34" />
        <path d="M49 52H60M54.5 52V70" />
        <path d="M65 70V52H69A5 5 0 0 1 69 62H65" />
        <path d="M80 70V52L89 70V52" />
      </g>
    </svg>
  )
}

export function Logo({ size = 36, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-text">
        <b>PTPN</b>
        {tagline && <small>Personal training</small>}
      </span>
    </span>
  )
}
