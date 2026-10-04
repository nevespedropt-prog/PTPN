import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Measurement } from '../types'
import { Chart } from '../components/Chart'
import Metrics from './Metrics'
import MaxLifts from './MaxLifts'

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
      <Metrics clientId={clientId} coach={readOnly} />
      <MaxLifts clientId={clientId} />
    </>
  )
}
