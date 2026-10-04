import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { localDate, niceDate } from '../lib/dates'
import { personalRecords, type PR } from '../lib/training'
import type { ClientWorkout, Measurement, WorkoutItem } from '../types'
import { Chart } from '../components/Chart'
import { Empty, PageHead, Seg, Tile } from '../components/ui'
import Photos from '../components/Photos'
import Metrics from './Metrics'
import MaxLifts from './MaxLifts'

function Body({ clientId, readOnly }: { clientId: string; readOnly: boolean }) {
  const [rows, setRows] = useState<Measurement[]>([])
  const [date, setDate] = useState(() => localDate())
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
  const delta = (pts: { y: number }[]) => (pts.length > 1 ? Math.round((pts[pts.length - 1].y - pts[0].y) * 10) / 10 : null)
  const dw = delta(w), df = delta(f)

  return (
    <>
      <div className="grid g2" style={{ marginBottom: 12 }}>
        <Tile label="Weight" value={w.length ? w[w.length - 1].y : '–'} unit={w.length ? 'kg' : ''} foot={dw != null ? `${dw > 0 ? '+' : ''}${dw} kg since start` : 'Log to see trends'} />
        <Tile label="Body fat" value={f.length ? f[f.length - 1].y : '–'} unit={f.length ? '%' : ''} foot={df != null ? `${df > 0 ? '+' : ''}${df}% since start` : 'Log to see trends'} />
      </div>
      {!readOnly && (
        <form className="card row" onSubmit={add}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ maxWidth: 170 }} />
          <input type="number" step="0.1" placeholder="Weight kg" value={kg} onChange={e => setKg(e.target.value)} style={{ maxWidth: 120 }} />
          <input type="number" step="0.1" placeholder="Body fat %" value={fat} onChange={e => setFat(e.target.value)} style={{ maxWidth: 120 }} />
          <button>Add</button>
          {err && <span className="err">{err}</span>}
        </form>
      )}
      <div className="card"><h2>Weight</h2><Chart points={w} unit="kg" /></div>
      <div className="card"><h2>Body fat</h2><Chart points={f} unit="%" /></div>
      <div className="card">
        <table><thead><tr><th>Date</th><th>kg</th><th>Fat %</th><th /></tr></thead><tbody>
          {[...rows].reverse().map(r => (
            <tr key={r.id}><td>{niceDate(r.date)}</td><td>{r.weight_kg ?? ''}</td><td>{r.body_fat_pct ?? ''}</td>
              <td style={{ textAlign: 'right' }}>{!readOnly && <button className="link" onClick={() => remove(r.id)}>Delete</button>}</td></tr>
          ))}
        </tbody></table>
        {rows.length === 0 && <p className="mute">No entries yet.</p>}
      </div>
    </>
  )
}

function Records({ clientId }: { clientId: string }) {
  const [prs, setPrs] = useState<PR[] | null>(null)
  const [count, setCount] = useState(0)
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('client_workouts').select('*').eq('client_id', clientId).eq('status', 'done')
      const done = (data ?? []) as ClientWorkout[]
      setCount(done.length)
      const ids = [...new Set(done.map(d => d.workout_id))]
      const items = ids.length ? ((await supabase.from('workout_items').select('*').in('workout_id', ids)).data ?? []) as WorkoutItem[] : []
      setPrs(personalRecords(done, new Map(items.map(i => [i.id, i]))))
    })()
  }, [clientId])
  return (
    <div className="card">
      <div className="row between"><h2 style={{ margin: 0 }}>Personal records</h2><span className="mute small">{count} workouts logged</span></div>
      <p className="mute small" style={{ marginTop: 4 }}>Best estimated 1RM from your logged sets.</p>
      {prs && prs.length === 0 && <Empty icon="trophy" title="No records yet">Log sets in the workout player and your best lifts appear here.</Empty>}
      {(prs ?? []).slice(0, 12).map((p, i) => (
        <div key={p.exercise} className="lift">
          <span className="badge" style={{ minWidth: 28, justifyContent: 'center' }}>{i + 1}</span>
          <span className="grow"><b>{p.exercise}</b><br /><span className="mute small">{p.kg} kg × {p.reps} · {niceDate(p.date)}</span></span>
          <span className="big">{p.e1rm}<small>kg</small></span>
        </div>
      ))}
    </div>
  )
}

export default function Progress({ clientId, readOnly = false }: { clientId: string; readOnly?: boolean }) {
  const [tab, setTab] = useState<'body' | 'strength' | 'photos'>('body')
  return (
    <>
      {!readOnly && <PageHead eyebrow="Progress" title="Your results" />}
      <Seg value={tab} onChange={setTab} options={[{ value: 'body', label: 'Body' }, { value: 'strength', label: 'Strength' }, { value: 'photos', label: 'Photos' }]} />
      {tab === 'body' && <Body clientId={clientId} readOnly={readOnly} />}
      {tab === 'strength' && <>
        <Records clientId={clientId} />
        <MaxLifts clientId={clientId} />
        <Metrics clientId={clientId} coach={readOnly} />
      </>}
      {tab === 'photos' && <Photos clientId={clientId} canUpload={!readOnly} />}
    </>
  )
}
