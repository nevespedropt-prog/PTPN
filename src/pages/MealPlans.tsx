import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { useClients } from '../hooks'
import { MEAL_LABEL, MEALS, forServings, sum } from '../lib/nutrition'
import type { MealPlanTemplate, Recipe, TemplateItem } from '../types'
import { Empty, MacroChips, PageHead, Sheet, Skeleton } from '../components/ui'
import RecipeArt from '../components/RecipeArt'
import Icon from '../components/Icon'

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
type Row = TemplateItem & { recipe?: Recipe }

const FRACTIONS: Record<string, number> = { '1/4': 0.25, '1/2': 0.5, '3/4': 0.75 }
const num = (t: string) => FRACTIONS[t] ?? Number(t)
const fmtQty = (n: number) => {
  const whole = Math.floor(n), frac = Math.round((n - whole) * 4) / 4
  const f = frac === 0.25 ? '1/4' : frac === 0.5 ? '1/2' : frac === 0.75 ? '3/4' : ''
  if (frac === 1) return String(whole + 1)
  return whole ? (f ? `${whole} ${f}` : String(whole)) : f || '1/4'
}

/** Adds up the ingredient lines of every planned meal: gram and ml items by weight, seasonings by spoon, clove or piece. */
function groceries(rows: Row[]) {
  const totals = new Map<string, { g: number; unit: string }>()
  const spices = new Map<string, { n: number; unit: string }>()
  const taste = new Set<string>()
  const addSpice = (name: string, unit: string, n: number) => {
    const key = `${unit}|${name.toLowerCase()}`
    const cur = spices.get(key) ?? { n: 0, unit }
    cur.n += n; spices.set(key, cur)
  }
  for (const r of rows) {
    const sv = Number(r.servings)
    for (const ing of r.recipe?.ingredients ?? []) {
      let m = /^(\d+(?:\.\d+)?) (g|ml) (.+)$/.exec(ing)
      if (m) {
        const key = m[3].toLowerCase()
        const cur = totals.get(key) ?? { g: 0, unit: m[2] }
        cur.g += Number(m[1]) * sv; totals.set(key, cur)
        continue
      }
      if (/ to taste$/i.test(ing)) { taste.add(ing.replace(/ to taste$/i, '')); continue }
      m = /^zest and juice of (\S+) (.+)$/i.exec(ing)
      if (m) { addSpice(`${m[2]} (zest and juice)`, '', num(m[1]) * sv); continue }
      m = /^pinch of (.+)$/i.exec(ing)
      if (m) { addSpice(m[1], 'pinch', sv); continue }
      m = /^(\d+(?:\.\d+)?|\d\/\d) (tsp|tbsp|ml|cloves?|sprigs?) (?:of )?(.+)$/i.exec(ing)
      if (m) {
        const u = m[2].toLowerCase()
        if (u === 'tbsp') addSpice(m[3], 'tsp', num(m[1]) * 3 * sv)
        else addSpice(m[3], u.startsWith('clove') ? 'clove' : u.startsWith('sprig') ? 'sprig' : u, num(m[1]) * sv)
        continue
      }
      m = /^(\d+(?:\.\d+)?|\d\/\d) (.+)$/.exec(ing)
      if (m) { addSpice(m[2], '', num(m[1]) * sv); continue }
      taste.add(ing)
    }
  }
  const list = [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([n, v]) => `${Math.round(v.g / 5) * 5 || Math.round(v.g)} ${v.unit} ${n}`)
  const extras = [...spices.entries()].map(([key, v]) => {
    const name = key.slice(key.indexOf('|') + 1)
    if (v.unit === 'tsp') return v.n >= 3 ? `${fmtQty(Math.round((v.n / 3) * 2) / 2)} tbsp ${name}` : `${fmtQty(v.n)} tsp ${name}`
    if (v.unit === 'clove') return `${Math.ceil(v.n)} clove${Math.ceil(v.n) === 1 ? '' : 's'} ${name}`
    if (v.unit === 'sprig') return `${Math.ceil(v.n)} sprig${Math.ceil(v.n) === 1 ? '' : 's'} ${name}`
    if (v.unit === 'pinch') return `${Math.ceil(v.n)} pinch${Math.ceil(v.n) === 1 ? '' : 'es'} ${name}`
    if (v.unit === 'ml') return `${Math.round(v.n / 5) * 5} ml ${name}`
    return `${Math.ceil(v.n - 0.01)} ${name}`
  }).sort((a, b) => a.replace(/^[\d/ ]+(tsp|tbsp)? ?/, '').localeCompare(b.replace(/^[\d/ ]+(tsp|tbsp)? ?/, '')))
  return { list, extras, taste: [...taste].sort() }
}

function Detail({ tpl }: { tpl: MealPlanTemplate }) {
  const { profile } = useAuth()
  const coach = profile?.role === 'coach'
  const { clients } = useClients()
  const [search] = useSearchParams()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [day, setDay] = useState(1)
  const [view, setView] = useState<'plan' | 'shop'>('plan')
  const [clientId, setClientId] = useState(search.get('client') ?? '')
  const [fit, setFit] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('meal_plan_template_items').select('*').eq('template_id', tpl.id).order('day').order('sort')
      const items = (data ?? []) as TemplateItem[]
      const ids = [...new Set(items.map(i => i.recipe_id))]
      const rec = ids.length ? ((await supabase.from('recipes').select('*').in('id', ids)).data ?? []) as Recipe[] : []
      setRows(items.map(i => ({ ...i, recipe: rec.find(r => r.id === i.recipe_id) })))
    })()
  }, [tpl.id])

  const dayRows = (rows ?? []).filter(r => r.day === day)
  const dayTotal = sum(dayRows.filter(r => r.recipe).map(r => forServings(r.recipe!, Number(r.servings))))
  const shop = useMemo(() => groceries(rows ?? []), [rows])

  async function apply() {
    if (!clientId || !rows) return
    if (!confirm('Replace this client\'s weekly meal plan with this template?')) return
    let k = 1
    if (fit) {
      const { data } = await supabase.from('nutrition_targets').select('kcal').eq('client_id', clientId).maybeSingle()
      if (data?.kcal) k = data.kcal / tpl.kcal
    }
    await supabase.from('meal_plan_items').delete().eq('client_id', clientId)
    const { error } = await supabase.from('meal_plan_items').insert(rows.map(r => ({
      client_id: clientId, day: r.day, meal_type: r.meal_type, recipe_id: r.recipe_id,
      servings: Math.max(0.25, Math.round(Number(r.servings) * k * 10) / 10), sort: r.sort,
    })))
    setMsg(error ? error.message : `Applied to ${clients?.find(c => c.id === clientId)?.full_name ?? 'client'}${k !== 1 ? ` (portions scaled x${k.toFixed(2)})` : ''}.`)
  }

  return (
    <div className="stack">
      <RecipeArt name={tpl.name} url={tpl.image_url} tall><span className="badge">{tpl.goal}</span><span className="badge">~{tpl.kcal} kcal</span></RecipeArt>
      <p className="mute" style={{ margin: 0 }}>{tpl.description}</p>
      <div className="row" style={{ marginBottom: 0 }}>
        <button className={'chip' + (view === 'plan' ? ' on' : '')} onClick={() => setView('plan')}>Week</button>
        <button className={'chip' + (view === 'shop' ? ' on' : '')} onClick={() => setView('shop')}><Icon name="check" size={14} />Shopping list</button>
      </div>
      {!rows && <Skeleton n={3} />}
      {rows && view === 'plan' && <>
        <div className="day-tabs">{DAY.map((d, i) => <button key={d} className={'chip' + (day === i + 1 ? ' on' : '')} onClick={() => setDay(i + 1)}>{d}</button>)}</div>
        <MacroChips m={dayTotal} />
        {MEALS.map(m => {
          const items = dayRows.filter(r => r.meal_type === m)
          if (!items.length) return null
          return (
            <div key={m}>
              <h3 style={{ margin: '6px 0' }}>{MEAL_LABEL[m]}</h3>
              {items.map(r => r.recipe && (
                <div key={r.id} className="food-row">
                  <span className="grow"><b>{r.recipe.name}</b><br /><span className="mute small">{Number(r.servings)} serving{Number(r.servings) === 1 ? '' : 's'} · {Math.round(r.recipe.protein * Number(r.servings))} g protein</span></span>
                  <span className="kc">{Math.round(r.recipe.kcal * Number(r.servings))}</span>
                </div>
              ))}
            </div>
          )
        })}
      </>}
      {rows && view === 'shop' && <>
        <p className="mute small" style={{ margin: 0 }}>Whole week, all servings added up, including seasonings. Spoons are rounded to the nearest half tablespoon.</p>
        <ul className="ingredients">{shop.list.map(x => <li key={x}>{x}</li>)}</ul>
        {shop.extras.length > 0 && <><h3>Seasonings and extras</h3><ul className="ingredients">{shop.extras.map(x => <li key={x}>{x}</li>)}</ul></>}
        {shop.taste.length > 0 && <><h3>To taste</h3><p className="mute small" style={{ margin: 0 }}>{shop.taste.join(', ')}</p></>}
      </>}
      {coach && <>
        <hr className="sep" />
        <h3 style={{ margin: 0 }}>Use for a client</h3>
        <select value={clientId} onChange={e => setClientId(e.target.value)} aria-label="Client">
          <option value="">Choose a client</option>
          {clients?.map(c => <option key={c.id} value={c.id}>{c.full_name || c.id}</option>)}
        </select>
        <label className="row nowrap" style={{ marginBottom: 0 }}><input type="checkbox" style={{ flex: 'none', width: 'auto' }} checked={fit} onChange={e => setFit(e.target.checked)} />Fit portions to the client's calorie target</label>
        <button disabled={!clientId || !rows} onClick={apply}>Apply to weekly plan</button>
        {msg && <span className={msg.startsWith('Applied') ? 'ok' : 'err'}>{msg}</span>}
      </>}
    </div>
  )
}

export default function MealPlans() {
  const [rows, setRows] = useState<MealPlanTemplate[] | null>(null)
  const [goal, setGoal] = useState('all')
  const [open, setOpen] = useState<MealPlanTemplate | null>(null)
  useEffect(() => { supabase.from('meal_plan_templates').select('*').order('plan_no', { ascending: false }).then(({ data }) => setRows((data ?? []) as MealPlanTemplate[])) }, [])
  const goals = [...new Set((rows ?? []).map(r => r.goal))]
  const list = (rows ?? []).filter(r => goal === 'all' || r.goal === goal)
  return (
    <>
      <PageHead eyebrow="Nutrition" title="Meal plans" sub="Seven-day plans with a shopping list" />
      <div className="chips">
        <button className={'chip' + (goal === 'all' ? ' on' : '')} onClick={() => setGoal('all')}>All goals</button>
        {goals.map(g => <button key={g} className={'chip' + (goal === g ? ' on' : '')} onClick={() => setGoal(g)}>{g}</button>)}
      </div>
      {!rows && <Skeleton n={4} />}
      {rows && list.length === 0 && <div className="card"><Empty icon="nutrition" title="No meal plans yet" /></div>}
      <div className="g-auto">
        {list.map(t => (
          <div key={t.id} className="card recipe-card click" onClick={() => setOpen(t)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setOpen(t) }}>
            <RecipeArt name={t.name} url={t.image_url}><span className="badge">{t.goal}</span><span className="badge">~{t.kcal} kcal</span></RecipeArt>
            <div className="recipe-body"><b>{t.name}</b><p className="mute small" style={{ margin: '2px 0 0' }}>{t.description}</p></div>
          </div>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>{open && <Detail tpl={open} />}</Sheet>
    </>
  )
}
