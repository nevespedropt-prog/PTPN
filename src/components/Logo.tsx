/** PTPN mark: three rising bars, the tallest becomes a P (source: branding/ptpn-logo.svg). */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <rect width="120" height="120" rx="26" fill="#0b0b0d" />
      <rect x="22" y="72" width="12" height="20" rx="2" fill="#f4f4f5" fillOpacity=".28" />
      <rect x="40" y="54" width="12" height="38" rx="2" fill="#f4f4f5" fillOpacity=".55" />
      <path d="M60 28h10v64h-10a2 2 0 0 1-2-2V30a2 2 0 0 1 2-2z" fill="#f4f4f5" />
      <path d="M70 28h8a18 18 0 0 1 0 36h-8V52h8a6 6 0 0 0 0-12h-8z" fill="#e11d2e" />
    </svg>
  )
}

/** Custom PTPN wordmark drawn from the same parts as the mark. */
export function Wordmark() {
  return (
    <svg className="wordmark" viewBox="0 0 146 40" role="img" aria-label="PTPN" fill="currentColor">
      <path d="M0 0h8v40h-8zM8 0h8a12 12 0 0 1 0 24h-8v-8h8a4 4 0 0 0 0-8h-8z" />
      <path d="M38 0h28v8h-10v32h-8V8h-10z" />
      <path d="M76 0h8v40h-8zM84 0h8a12 12 0 0 1 0 24h-8v-8h8a4 4 0 0 0 0-8h-8z" />
      <path d="M114 0h8L138 25.5V0h8v40h-8L122 14.5V40h-8z" />
    </svg>
  )
}

export function Logo({ size = 36, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-text">
        <Wordmark />
        {tagline && <small>Personal training</small>}
      </span>
    </span>
  )
}
