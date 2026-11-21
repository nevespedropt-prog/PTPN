import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays, DAY_NAMES, localDate, niceDate, relDay, startOfWeek } from '../lib/dates'
import { MEAL_LABEL, MEALS, sum } from '../lib/nutrition'
import type { FoodLog, MealType } from '../types'
import { Empty, MacroChips, Sheet } from './ui'
import Icon from './Icon'

const blank = { meal_type: 'breakfast' as MealType, name: '', amount_label: '', kcal: '', protein: '', carbs: '', fat: '', date: '' }
const num = (v: string) => (v.trim() === '' ? 0 : Number(v))

/** Coach: the client's food diary by week. Any entry, past or present, can be added, changed or deleted. */
export default function CoachFoodDiary({ clientId }: { clientId: string }) {
  const [week, setWeek] = useState(startOfWeek(localDate()))
  const [logs, setLogs] = useState<FoodLog[] | null>(null)
  const [form, setForm] = useState<{ id: string | null } | null>(null)
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('food_logs').select('*').eq('client_id', clientId).gte('date', week).lte('date', addDays(week, 6)).order('created_at')
    setLogs((data ?? []) as FoodLog[])
  }, [clientId, week])
  useEffect(() => { setLogs(null); load() }, [load])

  function openAdd(date: string) { setForm({ id: null }); setF({ ...blank, date }); setErr('') }
  function openEdit(l: FoodLog) {
    setForm({ id: l.id })
    setF({ meal_type: l.meal_type, name: l.name, amount_label: l.amount_label, kcal: String(Number(l.kcal)), protein: String(Number(l.protein)), carbs: String(Number(l.carbs)), fat: String(Number(l.fat)), date: l.date }); setErr('')
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!f.name.trim()) return setErr('Give the food a name.')
    const values = [f.kcal, f.protein, f.carbs, f.fat].map(num)
    if (values.some(v => !Number.isFinite(v) || v < 0)) return setErr('Calories and macros must be zero or more.')
    setBusy(true); setErr('')
    const row = { meal_type: f.meal_type, name: f.name.trim(), amount_label: f.amount_label.trim(), kcal: values[0], protein: values[1], carbs: values[2], fat: values[3], date: f.date }
    const res = form.id
      ? await supabase.from('food_logs').update(row).eq('id', form.id).eq('client_id', clientId).select('id')
      : await supabase.from('food_logs').insert({ ...row, client_id: clientId }).select('id')
    setBusy(false)
    if (res.error || !res.data?.length) return setErr('Could not save this entry. Please try again.')
    setForm(null); load()
  }
  async function remove() {
    if (!form?.id || !confirm('Delete this food entry?')) return
    setBusy(true)
    const { error } = await supabase.from('food_logs').delete().eq('id', form.id).eq('client_id', clientId)
    setBusy(false)
    if (error) return setErr('Could not delete this entry. Please try again.')
    setForm(null); load()
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  return (
    <section aria-label="Food diary">
      <div className="section-title"><h2>Food diary</h2><span className="mute small">Tap an entry to edit it</span></div>
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <button className="icon" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week"><Icon name="back" size={18} /></button>
          <b>{niceDate(week)} to {niceDate(addDays(week, 6))}</b>
          <button className="icon" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week"><Icon name="chev" size={18} /></button>
        </div>
        {week !== startOfWeek(localDate()) && <div style={{ marginBottom: 10 }}><button className="soft sm" onClick={() => setWeek(startOfWeek(localDate()))}>Back to this week</button></div>}
        {logs && logs.length === 0 && <Empty icon="nutrition" title="Nothing logged this week">Use Add food on any day to enter it for them.</Empty>}
        {days.map((d, i) => {
          const ls = (logs ?? []).filter(l => l.date === d)
          return (
            <div key={d} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
              <div className="row between nowrap" style={{ marginBottom: 6 }}>
                <span><b>{DAY_NAMES[i]}</b> <span className="mute small">{relDay(d)} · {niceDate(d)}</span></span>
                <button className="soft sm" onClick={() => openAdd(d)} aria-label={`Add food on ${niceDate(d)}`}><Icon name="plus" size={14} />Add food</button>
              </div>
              {ls.length > 0 && <MacroChips m={sum(ls)} />}
              {ls.map(l => (
                <button key={l.id} type="button" className="item" style={{ width: '100%', textAlign: 'left' }} onClick={() => openEdit(l)} aria-label={`Edit ${l.name} on ${niceDate(l.date)}`}>
                  <span className="grow"><span className="title">{l.name}</span><br /><span className="meta">{MEAL_LABEL[l.meal_type]}{l.amount_label ? ` · ${l.amount_label}` : ''} · {Math.round(Number(l.kcal))} kcal · P {Math.round(Number(l.protein))} C {Math.round(Number(l.carbs))} F {Math.round(Number(l.fat))}</span></span>
                  <Icon name="edit" size={16} />
                </button>
              ))}
            </div>
          )
        })}
      </div>
      <Sheet open={!!form} onClose={() => { if (!busy) setForm(null) }} title={form?.id ? 'Edit food entry' : 'Add food entry'}>
        {form && <form className="stack" onSubmit={save}>
          <label className="field">Meal<select value={f.meal_type} onChange={e => setF({ ...f, meal_type: e.target.value as MealType })}>{MEALS.map(m => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}</select></label>
          <label className="field">Food<input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required maxLength={120} /></label>
          <label className="field">Amount<input value={f.amount_label} onChange={e => setF({ ...f, amount_label: e.target.value })} placeholder="1 bowl, 150 g" maxLength={80} /></label>
          <div className="inline-inputs">
            <label className="field">Calories<input type="number" min="0" step="any" inputMode="decimal" value={f.kcal} onChange={e => setF({ ...f, kcal: e.target.value })} /></label>
            <label className="field">Protein g<input type="number" min="0" step="any" inputMode="decimal" value={f.protein} onChange={e => setF({ ...f, protein: e.target.value })} /></label>
            <label className="field">Carbs g<input type="number" min="0" step="any" inputMode="decimal" value={f.carbs} onChange={e => setF({ ...f, carbs: e.target.value })} /></label>
            <label className="field">Fat g<input type="number" min="0" step="any" inputMode="decimal" value={f.fat} onChange={e => setF({ ...f, fat: e.target.value })} /></label>
          </div>
          <label className="field">Date<input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} required /></label>
          <button disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
          {form.id && <button type="button" className="danger" disabled={busy} onClick={remove}>Delete entry</button>}
          {err && <span className="err" role="alert">{err}</span>}
        </form>}
      </Sheet>
    </section>
  )
}
