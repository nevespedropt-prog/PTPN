export default function AckBox({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <input type="checkbox" className="ack-box" aria-label={label} title={checked ? 'Checked. Tap to untick.' : 'Tick when you have checked this'} checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
}
