import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dayParts, lastDays, shortDay } from '../lib/dates'
import type { Checkin, Habit, HabitLog } from '../types'

export default function CoachHabits({ clientId }: { clientId: string }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'check' | 'number'>('check')
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')
  const [err, setErr] = useState('')
  const [days] = useState(() => lastDays(7))

  const load = useCallback(async () => {
    const [h, l, c] = await Promise.all([
      supabase.from('habits').select('*').eq('client_id', clientId).order('active', { ascending: false }).order('sort').order('created_at'),
      supabase.from('habit_logs').select('*').eq('client_id', clientId).gte('date', days[0]),
      supabase.from('checkins').select('*').eq('client_id', clientId).order('date', { ascending: false }).limit(7),
    ])
    setHabits((h.data ?? []) as Habit[]); setLogs((l.data ?? []) as HabitLog[]); setCheckins((c.data ?? []) as Checkin[])
  }, [clientId, days])
  useEffect(() => { load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('habits').insert({
      client_id: clientId, name, kind, unit: kind === 'number' ? unit : '', target: kind === 'number' && target ? Number(target) : null, sort: habits.length,
    })
    if (error) return setErr(error.message)
    setName(''); setTarget(''); setUnit(''); load()
  }
  async function toggle(h: Habit) { await supabase.from('habits').update({ active: !h.active }).eq('id', h.id); load() }

  const logOf = (h: Habit, d: string) => logs.find(l => l.habit_id === h.id && l.date === d)
  const cell = (h: Habit, d: string) => {
    const l = logOf(h, d)
    if (!l) return <span className="mute">–</span>
    if (h.kind === 'check') return <span className="ok">✓</span>
    const hit = h.target ? Number(l.value) >= Number(h.target) : true
    return <span className={hit ? 'ok' : ''}>{Number(l.value)}</span>
  }

  return (
    <>
      <form className="card row" onSubmit={add}>
        <input placeholder="New habit, e.g. Drink water" value={name} onChange={e => setName(e.target.value)} required style={{ flexBasis: '100%' }} />
        <select value={kind} onChange={e => setKind(e.target.value as 'check' | 'number')} aria-label="Habit type">
          <option value="check">Tick off</option>
          <option value="number">Number</option>
        </select>
        {kind === 'number' && <>
          <input type="number" step="any" min="0" placeholder="Goal" value={target} onChange={e => setTarget(e.target.value)} style={{ maxWidth: 90 }} />
          <input placeholder="Unit (L, steps)" value={unit} onChange={e => setUnit(e.target.value)} style={{ maxWidth: 130 }} />
        </>}
        <button>Add habit</button>
        {err && <span className="err">{err}</span>}
      </form>

      <div className="card">
        <h2>Last 7 days</h2>
        {habits.length === 0 ? <p className="mute">No habits yet. Add one above.</p> : (
          <div className="scroll-x">
            <table className="grid"><thead><tr><th>Habit</th>{days.map(d => { const p = dayParts(d); return <th key={d}>{p.w}<br />{p.n}</th> })}</tr></thead><tbody>
              {habits.map(h => (
                <tr key={h.id} className={h.active ? '' : 'off'}>
                  <td>{h.name}{h.kind === 'number' && h.target ? <span className="mute"> ({h.target} {h.unit})</span> : null}<br />
                    <button className="link" onClick={() => toggle(h)}>{h.active ? 'Archive' : 'Restore'}</button></td>
                  {days.map(d => <td key={d}>{cell(h, d)}</td>)}
                </tr>
              ))}
            </tbody></table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Recent check-ins</h2>
        {checkins.length === 0 && <p className="mute">No check-ins yet.</p>}
        {checkins.map(c => (
          <div key={c.id} className="checkin">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
              <b>{shortDay(c.date)}</b>
              <span className="mute">Mood {c.mood ?? '–'}/5 · Energy {c.energy ?? '–'}/5{c.sleep_hours != null ? ` · Sleep ${Number(c.sleep_hours)}h` : ''}</span>
            </div>
            {c.note && <p className="mute" style={{ margin: 0 }}>{c.note}</p>}
          </div>
        ))}
      </div>
    </>
  )
}
