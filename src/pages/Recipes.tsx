import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { localDate } from '../lib/dates'
import { MEAL_LABEL, MEALS, forServings } from '../lib/nutrition'
import type { MealType, Recipe } from '../types'
import { Empty, MacroChips, PageHead, Sheet, Skeleton } from '../components/ui'
import Icon from '../components/Icon'
import RecipeArt from '../components/RecipeArt'

function RecipeForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const { profile } = useAuth()
  const [f, setF] = useState({ name: '', meal_type: 'lunch' as MealType, description: '', prep_min: '', kcal: '', protein: '', carbs: '', fat: '', ingredients: '', steps: '', tags: '' })
  const [err, setErr] = useState('')
  const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('recipes').insert({
      name: f.name.trim(), meal_type: f.meal_type, description: f.description, prep_min: f.prep_min ? Number(f.prep_min) : null,
      kcal: Number(f.kcal) || 0, protein: Number(f.protein) || 0, carbs: Number(f.carbs) || 0, fat: Number(f.fat) || 0,
      ingredients: lines(f.ingredients), steps: lines(f.steps), tags: f.tags.split(',').map(t => t.trim()).filter(Boolean), created_by: profile!.id,
    })
    if (error) return setErr(error.message)
    onSaved(); onClose()
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <form className="stack" onSubmit={submit}>
      <input placeholder="Recipe name" value={f.name} onChange={set('name')} required />
      <div className="inline-inputs">
        <label className="field">Meal<select value={f.meal_type} onChange={set('meal_type')}>{MEALS.map(m => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}</select></label>
        <label className="field">Prep (min)<input type="number" min="1" value={f.prep_min} onChange={set('prep_min')} /></label>
      </div>
      <input placeholder="Short description" value={f.description} onChange={set('description')} />
      <div className="inline-inputs">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map(k => <label key={k} className="field">{k === 'kcal' ? 'kcal' : k + ' g'}<input type="number" min="0" step="any" value={f[k]} onChange={set(k)} required={k === 'kcal'} /></label>)}
      </div>
      <textarea rows={4} placeholder="Ingredients, one per line" value={f.ingredients} onChange={set('ingredients')} />
      <textarea rows={4} placeholder="Method, one step per line" value={f.steps} onChange={set('steps')} />
      <input placeholder="Tags, comma separated (high protein, quick)" value={f.tags} onChange={set('tags')} />
      <button>Save recipe</button>
      {err && <span className="err">{err}</span>}
    </form>
  )
}

export default function Recipes() {
  const { profile } = useAuth()
  const coach = profile?.role === 'coach'
  const [rows, setRows] = useState<Recipe[] | null>(null)
  const [meal, setMeal] = useState<MealType | 'all'>('all')
  const [tag, setTag] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Recipe | null>(null)
  const [servings, setServings] = useState('1')
  const [logMeal, setLogMeal] = useState<MealType>('lunch')
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState('')

  const load = () => supabase.from('recipes').select('*').order('name').then(({ data }) => setRows((data ?? []) as Recipe[]))
  useEffect(() => { load() }, [])

  const tags = useMemo(() => [...new Set((rows ?? []).flatMap(r => r.tags))].sort(), [rows])
  const list = (rows ?? []).filter(r => (meal === 'all' || r.meal_type === meal) && (!tag || r.tags.includes(tag)) && r.name.toLowerCase().includes(q.toLowerCase()))

  function show(r: Recipe) { setOpen(r); setServings('1'); setLogMeal(r.meal_type); setDone('') }
  async function log() {
    if (!open) return
    const m = forServings(open, Number(servings) || 1)
    const { error } = await supabase.from('food_logs').insert({
      client_id: profile!.id, date: localDate(), meal_type: logMeal, name: open.name,
      amount_label: `${Number(servings) || 1} serving${(Number(servings) || 1) === 1 ? '' : 's'}`, recipe_id: open.id, ...m,
    })
    setDone(error ? error.message : 'Logged to today')
  }
  async function remove(r: Recipe) {
    if (!confirm(`Delete "${r.name}"?`)) return
    await supabase.from('recipes').delete().eq('id', r.id); setOpen(null); load()
  }

  return (
    <>
      <PageHead eyebrow="Nutrition" title="Recipe book" sub={rows ? `${rows.length} meal ideas with macros` : undefined}>
        {coach && <button className="sm" onClick={() => setAdding(true)}><Icon name="plus" size={16} />New recipe</button>}
      </PageHead>
      <input placeholder="Search recipes" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="chips">
        <button className={'chip' + (meal === 'all' ? ' on' : '')} onClick={() => setMeal('all')}>All meals</button>
        {MEALS.map(m => <button key={m} className={'chip' + (meal === m ? ' on' : '')} onClick={() => setMeal(m)}>{MEAL_LABEL[m]}</button>)}
      </div>
      <div className="chips">
        {tags.map(t => <button key={t} className={'chip' + (tag === t ? ' on' : '')} onClick={() => setTag(tag === t ? '' : t)}>{t}</button>)}
      </div>
      {!rows && <Skeleton n={4} />}
      {rows && list.length === 0 && <div className="card"><Empty icon="nutrition" title="No recipes match" /></div>}
      <div className="g-auto">
        {list.map(r => (
          <div key={r.id} className="card recipe-card click" onClick={() => show(r)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') show(r) }}>
            <RecipeArt name={r.name} url={r.image_url}>
              <span className="badge">{MEAL_LABEL[r.meal_type]}</span>
              {r.prep_min && <span className="badge">{r.prep_min} min</span>}
            </RecipeArt>
            <div className="recipe-body">
              <b>{r.name}</b>
              <p className="mute small" style={{ margin: '2px 0 10px' }}>{r.description}</p>
              <MacroChips m={r} />
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && (
          <div className="stack">
            {open.image_url && <RecipeArt name={open.name} url={open.image_url} tall />}
            <p className="mute" style={{ margin: 0 }}>{open.description}</p>
            <MacroChips m={forServings(open, Number(servings) || 1)} />
            <div>{open.tags.map(t => <span key={t} className="badge" style={{ marginRight: 6 }}>{t}</span>)}</div>
            <h3>Ingredients</h3>
            <ul className="ingredients">{open.ingredients.map((x, i) => <li key={i}>{x}</li>)}</ul>
            <h3>Method</h3>
            <ol className="steps">{open.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
            {!coach && <>
              <hr className="sep" />
              <div className="inline-inputs">
                <label className="field">Servings<input type="number" min="0.25" step="0.25" inputMode="decimal" value={servings} onChange={e => setServings(e.target.value)} /></label>
                <label className="field">Meal<select value={logMeal} onChange={e => setLogMeal(e.target.value as MealType)}>{MEALS.map(m => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}</select></label>
              </div>
              <button className="block" onClick={log}>Log to today's diary</button>
              {done && <span className={done.startsWith('Logged') ? 'ok' : 'err'}>{done}</span>}
            </>}
            {coach && open.created_by === profile?.id && <button className="danger" onClick={() => remove(open)}>Delete recipe</button>}
          </div>
        )}
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="New recipe"><RecipeForm onSaved={load} onClose={() => setAdding(false)} /></Sheet>
    </>
  )
}
