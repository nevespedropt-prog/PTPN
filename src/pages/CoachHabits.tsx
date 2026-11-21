import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays, dayParts, localDate, niceDate, shortDay } from '../lib/dates'
import type { Checkin, Habit, HabitLog } from '../types'
import { Sheet } from '../components/ui'
import Icon from '../components/Icon'

export default function CoachHabits({ clientId }: { clientId: string }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'check' | 'number'>('check')
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')
  const [err, setErr] = useState('')
  // The grid shows seven days ending on `end`; the arrows move it a week at a time, so any past day can be corrected.
  const today = localDate()
  const [end, setEnd] = useState(today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(end, i - 6))
  const [cellEdit, setCellEdit] = useState<{ habit: Habit; date: string } | null>(null)
  const [cellValue, setCellValue] = useState('')
  const [habitEdit, setHabitEdit] = useState<Habit | null>(null)
  const [hf, setHf] = useState({ name: '', unit: '', target: '' })
  const [busy, setBusy] = useState(false)
  const [sheetErr, setSheetErr] = useState('')

  const load = useCallback(async () => {
    const [h, l, c] = await Promise.all([
      supabase.from('habits').select('*').eq('client_id', clientId).order('active', { ascending: false }).order('sort').order('created_at'),
      supabase.from('habit_logs').select('*').eq('client_id', clientId).gte('date', addDays(end, -6)).lte('date', end),
      supabase.from('checkins').select('*').eq('client_id', clientId).order('date', { ascending: false }).limit(7),
    ])
    setHabits((h.data ?? []) as Habit[]); setLogs((l.data ?? []) as HabitLog[]); setCheckins((c.data ?? []) as Checkin[])
  }, [clientId, end])
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

  async function clickCell(h: Habit, d: string) {
    if (h.kind === 'number') { setCellEdit({ habit: h, date: d }); setCellValue(String(Number(logOf(h, d)?.value ?? ''))); setSheetErr(''); return }
    // A tick habit flips straight away: ticked becomes unticked and the other way round.
    const l = logOf(h, d)
    const res = l
      ? await supabase.from('habit_logs').delete().eq('id', l.id).select('id')
      : await supabase.from('habit_logs').upsert({ habit_id: h.id, client_id: clientId, date: d, value: 1 }, { onConflict: 'habit_id,date' }).select('id')
    if (res.error) return setErr('Could not change that day. Please try again.')
    setErr(''); load()
  }
  async function saveCell(e: React.FormEvent) {
    e.preventDefault()
    if (!cellEdit) return
    const v = Number(cellValue)
    if (cellValue.trim() === '' || !Number.isFinite(v) || v < 0) return setSheetErr('Enter a number, zero or more.')
    setBusy(true); setSheetErr('')
    const { error } = await supabase.from('habit_logs').upsert({ habit_id: cellEdit.habit.id, client_id: clientId, date: cellEdit.date, value: v }, { onConflict: 'habit_id,date' })
    setBusy(false)
    if (error) return setSheetErr('Could not save this day. Please try again.')
    setCellEdit(null); load()
  }
  async function clearCell() {
    if (!cellEdit) return
    const l = logOf(cellEdit.habit, cellEdit.date)
    if (l) { setBusy(true); const { error } = await supabase.from('habit_logs').delete().eq('id', l.id); setBusy(false); if (error) return setSheetErr('Could not clear this day. Please try again.') }
    setCellEdit(null); load()
  }
  function openHabit(h: Habit) { setHabitEdit(h); setHf({ name: h.name, unit: h.unit, target: h.target == null ? '' : String(Number(h.target)) }); setSheetErr('') }
  async function saveHabit(e: React.FormEvent) {
    e.preventDefault()
    if (!habitEdit) return
    if (!hf.name.trim()) return setSheetErr('Give the habit a name.')
    setBusy(true); setSheetErr('')
    const { error } = await supabase.from('habits').update({ name: hf.name.trim(), unit: habitEdit.kind === 'number' ? hf.unit.trim() : '', target: habitEdit.kind === 'number' && hf.target.trim() !== '' ? Number(hf.target) : null }).eq('id', habitEdit.id)
    setBusy(false)
    if (error) return setSheetErr('Could not save the habit. Please try again.')
    setHabitEdit(null); load()
  }
  async function deleteHabit() {
    if (!habitEdit || !confirm(`Delete "${habitEdit.name}" and every day logged for it?`)) return
    setBusy(true)
    const { error } = await supabase.from('habits').delete().eq('id', habitEdit.id)
    setBusy(false)
    if (error) return setSheetErr('Could not delete the habit. Please try again.')
    setHabitEdit(null); load()
  }
  const cell = (h: Habit, d: string) => {
    const l = logOf(h, d)
    const label = `${h.name} on ${niceDate(d)}`
    let inner: React.ReactNode
    if (!l) inner = <span className="mute">–</span>
    else if (h.kind === 'check') inner = <span className="ok">✓</span>
    else { const hit = h.target ? Number(l.value) >= Number(h.target) : true; inner = <span className={hit ? 'ok' : ''}>{Number(l.value)}</span> }
    return <button type="button" className="cell-btn" style={{ minWidth: 40, minHeight: 36, background: 'none', border: 0, color: 'inherit' }} onClick={() => clickCell(h, d)} aria-label={h.kind === 'check' ? `${l ? 'Untick' : 'Tick'} ${label}` : `Edit ${label}`}>{inner}</button>
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
        <div className="row between" style={{ marginBottom: 6 }}>
          <button className="icon" onClick={() => setEnd(addDays(end, -7))} aria-label="Previous week"><Icon name="back" size={18} /></button>
          <h2 style={{ margin: 0 }}>{end === today ? 'Last 7 days' : `${niceDate(days[0])} to ${niceDate(end)}`}</h2>
          <button className="icon" onClick={() => setEnd(addDays(end, 7))} disabled={end >= today} aria-label="Next week"><Icon name="chev" size={18} /></button>
        </div>
        {end !== today && <div style={{ marginBottom: 8 }}><button className="soft sm" onClick={() => setEnd(today)}>Back to today</button></div>}
        <p className="mute small" style={{ margin: '0 0 8px' }}>Tap a day to tick it, untick it or change the number.</p>
        {habits.length === 0 ? <p className="mute">No habits yet. Add one above.</p> : (
          <div className="scroll-x">
            <table className="grid"><thead><tr><th>Habit</th>{days.map(d => { const p = dayParts(d); return <th key={d}>{p.w}<br />{p.n}</th> })}</tr></thead><tbody>
              {habits.map(h => (
                <tr key={h.id} className={h.active ? '' : 'off'}>
                  <td>{h.name}{h.kind === 'number' && h.target ? <span className="mute"> ({h.target} {h.unit})</span> : null}<br />
                    <button className="link" onClick={() => toggle(h)}>{h.active ? 'Archive' : 'Restore'}</button> <button className="link" onClick={() => openHabit(h)} aria-label={`Edit habit ${h.name}`}>Edit</button></td>
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
      <Sheet open={!!cellEdit} onClose={() => { if (!busy) setCellEdit(null) }} title={cellEdit ? `${cellEdit.habit.name} on ${niceDate(cellEdit.date)}` : ''}>
        {cellEdit && <form className="stack" onSubmit={saveCell}>
          <label className="field">{cellEdit.habit.unit ? `Amount (${cellEdit.habit.unit})` : 'Amount'}<input type="number" min="0" step="any" inputMode="decimal" value={cellValue} onChange={e => setCellValue(e.target.value)} autoFocus /></label>
          <button disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
          <button type="button" className="soft" disabled={busy} onClick={clearCell}>Clear this day</button>
          {sheetErr && <span className="err" role="alert">{sheetErr}</span>}
        </form>}
      </Sheet>
      <Sheet open={!!habitEdit} onClose={() => { if (!busy) setHabitEdit(null) }} title="Edit habit">
        {habitEdit && <form className="stack" onSubmit={saveHabit}>
          <label className="field">Name<input value={hf.name} onChange={e => setHf({ ...hf, name: e.target.value })} required maxLength={80} /></label>
          {habitEdit.kind === 'number' && <>
            <label className="field">Goal<input type="number" min="0" step="any" value={hf.target} onChange={e => setHf({ ...hf, target: e.target.value })} /></label>
            <label className="field">Unit<input value={hf.unit} onChange={e => setHf({ ...hf, unit: e.target.value })} maxLength={20} /></label>
          </>}
          <button disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
          <button type="button" className="danger" disabled={busy} onClick={deleteHabit}>Delete habit</button>
          {sheetErr && <span className="err" role="alert">{sheetErr}</span>}
        </form>}
      </Sheet>
    </>
  )
}
