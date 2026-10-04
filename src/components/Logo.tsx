export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="ptpn-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4455" />
          <stop offset="1" stopColor="#c80000" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="#111114" />
      <rect x="17" y="13" width="11" height="38" rx="3" fill="url(#ptpn-g)" />
      <path d="M28 15h8a11 11 0 010 22h-8" fill="none" stroke="url(#ptpn-g)" strokeWidth="10" strokeLinejoin="round" />
      <rect x="9" y="44" width="46" height="5" rx="2.5" fill="#f4f4f5" />
      <rect x="7" y="40" width="6" height="13" rx="2" fill="#f4f4f5" />
      <rect x="51" y="40" width="6" height="13" rx="2" fill="#f4f4f5" />
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
