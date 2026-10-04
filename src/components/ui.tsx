import { useEffect, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import { cx, hue, initials } from '../lib/util'

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="seg" role="tablist">
      {options.map(o => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, ['--h' as string]: hue(name) }} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="icon-wrap"><Icon name={icon} size={24} /></div>
      <b>{title}</b>
      {children}
    </div>
  )
}

export function Ring({ value, max, size = 128, stroke = 11, color = 'var(--red)', label, sub }: { value: number; max: number; size?: number; stroke?: number; color?: string; label: ReactNode; sub?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const p = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.2,.9,.3,1)', filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <div className="ring-label"><b>{label}</b>{sub && <span>{sub}</span>}</div>
    </div>
  )
}

export function MacroBar({ label, value, target, color, unit = 'g' }: { label: string; value: number; target: number | null; color: string; unit?: string }) {
  const w = target ? Math.min(100, (value / target) * 100) : 0
  return (
    <div className="macro">
      <div className="top"><b>{label}</b><span>{Math.round(value)}{target ? ` / ${target}` : ''} {unit}</span></div>
      <div className="track"><i style={{ width: `${w}%`, background: color }} /></div>
    </div>
  )
}

export function Tile({ label, value, unit, foot, accent }: { label: string; value: ReactNode; unit?: string; foot?: ReactNode; accent?: string }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value" style={accent ? { color: accent } : undefined}>{value}{unit && <small>{unit}</small>}</div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  )
}

export function PageHead({ eyebrow, title, sub, children }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {children && <div className="row" style={{ marginBottom: 0 }}>{children}</div>}
    </div>
  )
}

export function Skeleton({ n = 3 }: { n?: number }) {
  return <>{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" />)}</>
}

export function SectionTitle({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="section-title"><h2>{title}</h2>{children}</div>
}

export function MacroChips({ m, className }: { m: { kcal: number; protein: number; carbs: number; fat: number }; className?: string }) {
  return (
    <div className={cx('macro-chips', className)}>
      <span className="k">{Math.round(m.kcal)} kcal</span>
      <span className="p">P {Math.round(m.protein)}</span>
      <span className="c">C {Math.round(m.carbs)}</span>
      <span className="f">F {Math.round(m.fat)}</span>
    </div>
  )
}

export function Stars({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="stars" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" className={value && n <= value ? 'on' : ''} aria-pressed={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)}>
          <Icon name="star" size={18} />
        </button>
      ))}
    </div>
  )
}
