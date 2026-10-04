import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Measurement } from '../types'

function Chart({ points, unit }: { points: { x: string; y: number }[]; unit: string }) {
  if (points.length < 2) return <p className="mute">Log at least two entries to see a trend.</p>
  const W = 320, H = 100, ys = points.map(p => p.y)
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1
  const pts = points.map((p, i) => `${(i / (points.length - 1)) * W},${H - ((p.y - min) / span) * (H - 10) - 5}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Trend in ${unit}`}>
      <polyline points={pts} fill="none" stroke="#c80000" strokeWidth="2" />
      <text x="0" y="10" fontSize="9" fill="#6b6b6b">{max}{unit}</text>
      <text x="0" y={H} fontSize="9" fill="#6b6b6b">{min}{unit}</text>
    </svg>
  )
}

export default function Progress({ clientId, readOnly = false }: { clientId: string; readOnly?: boolean }) {
  const [rows, setRows] = useState<Measurement[]>([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [kg, setKg] = useState('')
  const [fat, setFat] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('measurements').select('*').eq('client_id', clientId).order('date')
    setRows((data ?? []) as Measurement[])
  }, [clientId])
  useEffect(() => { load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!kg && !fat) return setErr('Enter weight or body fat.')
    const { error } = await supabase.from('measurements').insert({
      client_id: clientId, date, weight_kg: kg ? Number(kg) : null, body_fat_pct: fat ? Number(fat) : null,
    })
    if (error) return setErr(error.message)
    setKg(''); setFat(''); load()
  }
  async function remove(id: string) { await supabase.from('measurements').delete().eq('id', id); load() }

  const w = rows.filter(r => r.weight_kg != null).map(r => ({ x: r.date, y: Number(r.weight_kg) }))
  const f = rows.filter(r => r.body_fat_pct != null).map(r => ({ x: r.date, y: Number(r.body_fat_pct) }))
  return (
    <>
      <h1>Progress</h1>
      {!readOnly && (
        <form className="card row" onSubmit={add}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <input type="number" step="0.1" placeholder="Weight kg" value={kg} onChange={e => setKg(e.target.value)} style={{ width: 110 }} />
          <input type="number" step="0.1" placeholder="Body fat %" value={fat} onChange={e => setFat(e.target.value)} style={{ width: 110 }} />
          <button>Add</button>
          {err && <span className="err">{err}</span>}
        </form>
      )}
      <div className="card"><h2>Weight</h2><Chart points={w} unit="kg" /></div>
      <div className="card"><h2>Body fat</h2><Chart points={f} unit="%" /></div>
      <div className="card">
        <table><thead><tr><th>Date</th><th>kg</th><th>Fat %</th><th /></tr></thead><tbody>
          {[...rows].reverse().map(r => (
            <tr key={r.id}><td>{r.date}</td><td>{r.weight_kg ?? ''}</td><td>{r.body_fat_pct ?? ''}</td>
              <td>{!readOnly && <button className="ghost" onClick={() => remove(r.id)}>Delete</button>}</td></tr>
          ))}
        </tbody></table>
        {rows.length === 0 && <p className="mute">No entries yet.</p>}
      </div>
    </>
  )
}
