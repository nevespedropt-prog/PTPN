import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays, niceDate } from '../lib/dates'
import { MEAL_LABEL, sum } from '../lib/nutrition'
import { mealEntries, mealLogRows, type MealEntry, type SavedMeal } from '../lib/savedMeals'
import type { FoodLog, MealType } from '../types'
import { MacroChips, Sheet } from './ui'

function Preview({ items }: { items: MealEntry[] }) {
  return <div className="stack">
    <div className="list">{items.map((item, i) => <div key={i} className="item">
      <span className="grow"><b>{item.name}</b><br /><span className="mute small">{item.amount_label}</span></span>
      <span>{Math.round(item.kcal)} kcal</span>
    </div>)}</div>
    <MacroChips m={sum(items)} />
  </div>
}

export function MealShortcuts({ clientId, date, meal, rows, onDone }: {
  clientId: string; date: string; meal: MealType; rows: FoodLog[]; onDone: () => void
}) {
  const [mode, setMode] = useState<'save' | 'copy' | null>(null)
  const [name, setName] = useState('')
  const [items, setItems] = useState<MealEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const title = MEAL_LABEL[meal].toLowerCase()

  function saveOpen() {
    setError(''); setNotice('')
    try { setItems(mealEntries(rows)); setName('My ' + title); setMode('save') }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not prepare this meal.') }
  }
  async function copyOpen() {
    setMode('copy'); setItems([]); setError(''); setNotice(''); setLoading(true)
    try {
      const { data, error: err } = await supabase.from('food_logs').select('*').eq('client_id', clientId)
        .eq('date', addDays(date, -1)).eq('meal_type', meal).order('created_at')
      if (err) throw err
      if (data?.length) setItems(mealEntries(data))
    } catch { setError('Could not load the previous meal. Close and try again when connected.') }
    finally { setLoading(false) }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const { error: err } = await supabase.from('saved_meals').insert({ client_id: clientId, name: name.trim(), items })
      if (err) throw err
      setMode(null); setNotice('Meal saved. Find it under Add, then Saved meals.')
    } catch { setError('Could not save this meal. Check your connection and use a name you have not already saved.') }
    finally { setBusy(false) }
  }
  async function copy() {
    setBusy(true); setError('')
    try {
      const { error: err } = await supabase.from('food_logs').insert(mealLogRows(items, clientId, date, meal))
      if (err) throw err
      setMode(null); setNotice('Previous meal added.'); onDone()
    } catch { setError('Could not add this meal. Check your diary before trying again if your connection dropped.') }
    finally { setBusy(false) }
  }
  return <div>
    <div className="row" style={{ flexWrap: 'wrap', marginTop: 10, marginBottom: 0 }}>
      {rows.length > 0 && <button className="soft sm" disabled={loading || busy} onClick={saveOpen} aria-label={'Save ' + title + ' as a meal'}>Save this meal</button>}
      <button className="soft sm" disabled={loading || busy} onClick={copyOpen} aria-label={'Copy previous day ' + title}>Copy previous day</button>
    </div>
    {notice && <p className="small" role="status">{notice}</p>}
    <Sheet open={mode !== null} onClose={() => { if (!busy) setMode(null) }} title={mode === 'save' ? 'Save ' + title : 'Copy previous ' + title}>
      {mode === 'save' ? <form className="col" onSubmit={save}>
        <label className="field">Saved meal name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
        <Preview items={items} />
        <p className="mute small">Saves these portions and nutrition values. This does not add another diary entry.</p>
        {error && <p className="err" role="alert">{error}</p>}
        <button disabled={busy || !name.trim()}>{busy ? 'Saving...' : 'Save meal'}</button>
      </form> : <>
        <p className="mute small">From {niceDate(addDays(date, -1))}, added to {niceDate(date)}. Existing entries will stay.</p>
        {loading ? <p role="status">Loading previous meal...</p> : error ? <p className="err" role="alert">{error}</p> : items.length ? <>
          <Preview items={items} />
          <button className="block" style={{ marginTop: 12 }} onClick={copy} disabled={busy}>{busy ? 'Adding...' : 'Add copied meal'}</button>
        </> : <p>No {title} logged on the previous day.</p>}
      </>}
    </Sheet>
  </div>
}

export function SavedMealsPicker({ clientId, date, meal, onDone, onClose }: {
  clientId: string; date: string; meal: MealType; onDone: () => void; onClose: () => void
}) {
  const [saved, setSaved] = useState<SavedMeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<SavedMeal | null>(null)
  const [items, setItems] = useState<MealEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    supabase.from('saved_meals').select('*').eq('client_id', clientId).order('name').then(({ data, error: err }) => {
      if (!active) return
      if (err) setError('Could not load saved meals. Please try again when connected.')
      else setSaved((data ?? []) as SavedMeal[])
      setLoading(false)
    })
    return () => { active = false }
  }, [clientId, retry])
  function choose(value: SavedMeal) {
    setError(''); setRemoving(false)
    try { setItems(mealEntries(value.items)); setSelected(value) }
    catch { setError('This saved meal could not be opened. Please save it again from your diary.') }
  }
  async function add() {
    if (!selected) return
    setBusy(true); setError('')
    try {
      const { error: err } = await supabase.from('food_logs').insert(mealLogRows(items, clientId, date, meal))
      if (err) throw err
      onDone(); onClose()
    } catch { setError('Could not add this meal. Check your diary before trying again if your connection dropped.') }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!selected) return
    setBusy(true); setError('')
    try {
      const { error: err } = await supabase.from('saved_meals').delete().eq('id', selected.id).eq('client_id', clientId)
      if (err) throw err
      setSaved(all => all.filter(x => x.id !== selected.id)); setSelected(null); setRemoving(false)
    } catch { setError('Could not remove this saved meal. Please try again when connected.') }
    finally { setBusy(false) }
  }
  return <div className="stack">
    {loading ? <p role="status">Loading saved meals...</p> : selected ? <>
      <button className="link" disabled={busy} onClick={() => { setSelected(null); setRemoving(false); setError('') }}>Back to saved meals</button>
      <h3>{selected.name}</h3><Preview items={items} />
      <p className="mute small">Uses the portions and nutrition values you saved. Adds to {MEAL_LABEL[meal].toLowerCase()} on {niceDate(date)}.</p>
      <button disabled={busy} onClick={add}>{busy ? 'Working...' : 'Add saved meal'}</button>
      {removing ? <div className="stack">
        <p>Remove this saved meal? Your diary entries will stay.</p>
        <div className="row"><button className="soft" disabled={busy} onClick={() => setRemoving(false)}>Cancel removal</button>
          <button className="soft" disabled={busy} onClick={remove}>Confirm removal</button></div>
      </div> : <button className="link" disabled={busy} onClick={() => setRemoving(true)}>Remove saved meal</button>}
    </> : <>
      <p className="mute small">Save a meal from your diary to reuse it here. A meal can contain one food or several entries.</p>
      {saved.length ? <div className="list">{saved.map(value => <button key={value.id} className="item" onClick={() => choose(value)}>
        <span className="grow"><b>{value.name}</b></span><span className="mute small">View</span>
      </button>)}</div> : !error && <p>No saved meals yet.</p>}
    </>}
    {error && <><p className="err" role="alert">{error}</p>{!selected && <button className="soft" onClick={() => setRetry(n => n + 1)}>Retry saved meals</button>}</>}
  </div>
}