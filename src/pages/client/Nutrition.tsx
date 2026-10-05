import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { addDays, localDate, longDay, relDay, weekday } from '../../lib/dates'
import { MEAL_LABEL, MEALS, forGrams, forServings, mealGoal, pickRandomMeal, sum } from '../../lib/nutrition'
import type { Food, FoodLog, MealPlanItem, MealType, Recipe, Targets } from '../../types'
import { Empty, MacroBar, MacroChips, PageHead, Ring, Seg, Sheet, Skeleton, Tile } from '../../components/ui'
import Icon from '../../components/Icon'
import { RecipePicker } from '../../components/Pickers'
import RecipeView from '../../components/RecipeView'

type AddTab = 'foods' | 'recipes' | 'quick'

function AddFood({ meal, date, onDone, onClose }: { meal: MealType; date: string; onDone: () => void; onClose: () => void }) {
  const { profile } = useAuth()
  const [tab, setTab] = useState<AddTab>('foods')
  const [foods, setFoods] = useState<Food[] | null>(null)
  const [q, setQ] = useState('')
  const [food, setFood] = useState<Food | null>(null)
  const [grams, setGrams] = useState('100')
  const [recipePick, setRecipePick] = useState(false)
  const [quick, setQuick] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
  const [err, setErr] = useState('')

  useEffect(() => { supabase.from('foods').select('*').order('name').then(({ data }) => setFoods((data ?? []) as Food[])) }, [])
  const list = useMemo(() => (foods ?? []).filter(f => f.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40), [foods, q])

  async function insert(row: Partial<FoodLog>) {
    setErr('')
    const { error } = await supabase.from('food_logs').insert({ client_id: profile!.id, date, meal_type: meal, ...row })
    if (error) return setErr(error.message)
    onDone(); onClose()
  }

  return (
    <>
      <Seg value={tab} onChange={setTab} options={[{ value: 'foods', label: 'Foods' }, { value: 'recipes', label: 'Recipes' }, { value: 'quick', label: 'Quick add' }]} />
      {tab === 'foods' && (food ? (
        <div className="stack">
          <button className="link" onClick={() => setFood(null)}>← Back to search</button>
          <h3 style={{ fontSize: '1.1rem' }}>{food.name}</h3>
          <label className="field">Amount (grams)
            <input type="number" inputMode="decimal" min="1" value={grams} onChange={e => setGrams(e.target.value)} />
          </label>
          <div className="chips">{[50, 100, 150, 200].map(g => <button key={g} className="chip" type="button" onClick={() => setGrams(String(g))}>{g} g</button>)}
            {food.serving_g !== 100 && <button className="chip" type="button" onClick={() => setGrams(String(food.serving_g))}>1 serving ({food.serving_label})</button>}</div>
          <MacroChips m={forGrams(food, Number(grams) || 0)} />
          <button className="block" onClick={() => insert({ name: food.name, amount_label: `${Number(grams)} g`, food_id: food.id, ...forGrams(food, Number(grams) || 0) })} disabled={!(Number(grams) > 0)}>Add to {MEAL_LABEL[meal].toLowerCase()}</button>
        </div>
      ) : (
        <>
          <input autoFocus placeholder="Search foods" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 8 }} />
          {!foods && <Skeleton n={4} />}
          <div className="list">
            {list.map(f => (
              <button key={f.id} className="item" type="button" onClick={() => { setFood(f); setGrams(String(f.serving_g)) }}>
                <span className="grow"><span className="title">{f.name}</span><br /><span className="meta">{Math.round(f.kcal)} kcal · P {f.protein} · C {f.carbs} · F {f.fat} per 100 g</span></span>
                <Icon name="plus" />
              </button>
            ))}
          </div>
        </>
      ))}
      {tab === 'recipes' && <>
        <p className="mute">Pick a recipe from the recipe book to log it with its macros.</p>
        <button className="block" onClick={() => setRecipePick(true)}><Icon name="search" size={18} />Browse recipes</button>
        <RecipePicker open={recipePick} meal={meal} onClose={() => setRecipePick(false)} onPick={(r: Recipe) => { setRecipePick(false); insert({ name: r.name, amount_label: '1 serving', recipe_id: r.id, kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat }) }} />
      </>}
      {tab === 'quick' && (
        <form className="stack" onSubmit={e => { e.preventDefault(); insert({ name: quick.name, amount_label: '', kcal: Number(quick.kcal) || 0, protein: Number(quick.protein) || 0, carbs: Number(quick.carbs) || 0, fat: Number(quick.fat) || 0 }) }}>
          <input placeholder="What did you eat?" value={quick.name} onChange={e => setQuick({ ...quick, name: e.target.value })} required />
          <div className="inline-inputs">
            {(['kcal', 'protein', 'carbs', 'fat'] as const).map(k => (
              <label key={k} className="field">{k === 'kcal' ? 'Calories' : k[0].toUpperCase() + k.slice(1) + ' (g)'}
                <input type="number" inputMode="decimal" min="0" step="any" value={quick[k]} onChange={e => setQuick({ ...quick, [k]: e.target.value })} required={k === 'kcal'} />
              </label>
            ))}
          </div>
          <button>Add entry</button>
        </form>
      )}
      {err && <p className="err">{err}</p>}
    </>
  )
}

export default function Nutrition() {
  const { profile } = useAuth()
  const [today] = useState(() => localDate())
  const [date, setDate] = useState(today)
  const [targets, setTargets] = useState<Targets | null | undefined>(undefined)
  const [logs, setLogs] = useState<FoodLog[] | null>(null)
  const [plan, setPlan] = useState<(MealPlanItem & { recipe?: Recipe })[]>([])
  const [adding, setAdding] = useState<MealType | null>(null)
  const [library, setLibrary] = useState<Recipe[] | null>(null)
  const [rnd, setRnd] = useState<{ meal: MealType; pick: { recipe: Recipe; servings: number } | null; seen: string[] } | null>(null)
  const [view, setView] = useState<{ recipe: Recipe; servings: number } | null>(null)
  const isFuture = date > today
  const lastDay = addDays(today, 28)

  const load = useCallback(async () => {
    if (!profile) return
    const [t, l, p] = await Promise.all([
      supabase.from('nutrition_targets').select('*').eq('client_id', profile.id).maybeSingle(),
      supabase.from('food_logs').select('*').eq('client_id', profile.id).eq('date', date).order('created_at'),
      supabase.from('meal_plan_items').select('*').eq('client_id', profile.id).eq('day', weekday(date)).order('sort'),
    ])
    setTargets((t.data as Targets | null) ?? null); setLogs((l.data ?? []) as FoodLog[])
    const items = (p.data ?? []) as MealPlanItem[]
    const ids = [...new Set(items.map(i => i.recipe_id))]
    const recipes = ids.length ? ((await supabase.from('recipes').select('*').in('id', ids)).data ?? []) as Recipe[] : []
    setPlan(items.map(i => ({ ...i, recipe: recipes.find(r => r.id === i.recipe_id) })))
  }, [profile, date])
  useEffect(() => { load() }, [load])

  async function remove(id: string) { await supabase.from('food_logs').delete().eq('id', id); load() }
  async function logPlanned(i: MealPlanItem & { recipe?: Recipe }) {
    if (!i.recipe) return
    const m = forServings(i.recipe, Number(i.servings))
    await supabase.from('food_logs').insert({ client_id: profile!.id, date, meal_type: i.meal_type, name: i.recipe.name, amount_label: `${Number(i.servings)} serving${Number(i.servings) === 1 ? '' : 's'}`, recipe_id: i.recipe_id, ...m })
    load()
  }

  const logged = sum(logs ?? [])
  const planned = sum(plan.filter(p => p.recipe).map(p => forServings(p.recipe!, Number(p.servings))))
  const total = isFuture ? planned : logged
  const left = !isFuture && targets?.kcal ? targets.kcal - logged.kcal : null

  async function randomFor(meal: MealType, seen: string[] = []) {
    let all = library
    if (!all) { all = ((await supabase.from('recipes').select('*')).data ?? []) as Recipe[]; setLibrary(all) }
    const mealLeft = left !== null ? left : null
    const pick = pickRandomMeal(all, meal, mealGoal(meal, targets?.kcal ?? null, mealLeft), seen)
    setRnd({ meal, pick, seen: pick ? [...seen, pick.recipe.id] : seen })
  }
  async function addRandom() {
    if (!rnd?.pick) return
    const { recipe, servings } = rnd.pick
    await supabase.from('food_logs').insert({ client_id: profile!.id, date, meal_type: rnd.meal, name: recipe.name, amount_label: `${servings} serving${servings === 1 ? '' : 's'}`, recipe_id: recipe.id, ...forServings(recipe, servings) })
    setRnd(null); load()
  }

  return (
    <>
      <PageHead eyebrow="Nutrition" title="Food diary">
        <Link className="btn soft sm" to="/meal-plans">Meal plans</Link>
      </PageHead>
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="icon" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><Icon name="back" size={18} /></button>
        <div className="center"><b>{relDay(date)}</b><div className="mute small">{longDay(date)}</div></div>
        <button className="icon" onClick={() => setDate(addDays(date, 1))} aria-label="Next day" disabled={date >= lastDay}><Icon name="chev" size={18} /></button>
      </div>

      <div className="card hero" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <Ring value={total.kcal} max={targets?.kcal ?? 0} size={124} label={Math.round(total.kcal)} sub={isFuture ? 'planned' : targets?.kcal ? `of ${targets.kcal}` : 'kcal'} />
        <div className="grow stack" style={{ gap: 12 }}>
          <MacroBar label="Protein" value={total.protein} target={targets?.protein ?? null} color="var(--protein)" />
          <MacroBar label="Carbs" value={total.carbs} target={targets?.carbs ?? null} color="var(--carbs)" />
          <MacroBar label="Fat" value={total.fat} target={targets?.fat ?? null} color="var(--fat)" />
        </div>
      </div>
      {isFuture && <p className="mute small center" style={{ marginTop: 0 }}>Upcoming day: your coach's planned meals. Tap one to see the recipe. You can log it on the day.</p>}
      {targets === null && <p className="mute small center">Your coach hasn't set targets yet. Log meals anyway and they'll show up in your totals.</p>}
      {left !== null && <div className="grid g2" style={{ marginBottom: 12 }}>
        <Tile label={left >= 0 ? 'Remaining' : 'Over target'} value={Math.abs(Math.round(left))} unit=" kcal" accent={left >= 0 ? 'var(--green)' : '#ff7a87'} />
        <Tile label="Protein left" value={Math.max(0, Math.round((targets?.protein ?? 0) - total.protein))} unit=" g" />
      </div>}
      {targets?.notes && <div className="card tight"><span className="eyebrow">From your coach</span><p style={{ margin: 0 }}>{targets.notes}</p></div>}

      {!logs && <Skeleton n={3} />}
      {logs && MEALS.map(meal => {
        const rows = logs.filter(l => l.meal_type === meal)
        const upcoming = plan.filter(p => p.meal_type === meal && p.recipe && (isFuture || !rows.some(r => r.recipe_id === p.recipe_id)))
        const mt = sum(rows)
        return (
          <div key={meal} className="card">
            <div className="meal-head">
              <h3>{MEAL_LABEL[meal]}{rows.length > 0 && <span className="mute small" style={{ fontWeight: 500 }}> · {Math.round(mt.kcal)} kcal</span>}</h3>
              {!isFuture && <div className="row nowrap" style={{ marginBottom: 0, gap: 6 }}>
                <button className="soft sm" onClick={() => randomFor(meal)} aria-label={`Random ${MEAL_LABEL[meal].toLowerCase()} idea`}><Icon name="dice" size={15} />Random</button>
                <button className="soft sm" onClick={() => setAdding(meal)}><Icon name="plus" size={15} />Add</button>
              </div>}
            </div>
            {rows.map(r => (
              <div key={r.id} className="food-row">
                <span className="grow"><b style={{ fontWeight: 600 }}>{r.name}</b><br /><span className="mute small">{r.amount_label ? r.amount_label + ' · ' : ''}P {Math.round(r.protein)} · C {Math.round(r.carbs)} · F {Math.round(r.fat)}</span></span>
                <span className="kc">{Math.round(r.kcal)}</span>
                <button className="link" onClick={() => remove(r.id)} aria-label={`Remove ${r.name}`}>Remove</button>
              </div>
            ))}
            {rows.length === 0 && upcoming.length === 0 && <p className="mute small" style={{ margin: 0 }}>{isFuture ? 'Nothing planned.' : 'Nothing logged yet.'}</p>}
            {upcoming.map(p => (
              <div key={p.id} className="food-row" style={{ opacity: .95 }}>
                <div className="grow" style={{ cursor: 'pointer' }} role="button" tabIndex={0} onClick={() => setView({ recipe: p.recipe!, servings: Number(p.servings) })} onKeyDown={e => { if (e.key === 'Enter') setView({ recipe: p.recipe!, servings: Number(p.servings) }) }}>
                  <span className="badge blue">{isFuture ? 'Upcoming' : 'Planned'}</span> <b style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.recipe!.name}</b><br /><span className="mute small">{Number(p.servings)} serving · {Math.round(p.recipe!.kcal * Number(p.servings))} kcal · tap for recipe</span>
                </div>
                {!isFuture && <button className="sm soft" onClick={() => logPlanned(p)}>Log</button>}
              </div>
            ))}
          </div>
        )
      })}
      {logs && !isFuture && logs.length === 0 && <div className="card"><Empty icon="nutrition" title="Start your day">Tap Add on any meal to log foods, recipes or a quick entry.</Empty></div>}

      <Sheet open={!!view} onClose={() => setView(null)} title={view?.recipe.name ?? ''}>{view && <RecipeView recipe={view.recipe} servings={view.servings} />}</Sheet>
      <Sheet open={!!rnd} onClose={() => setRnd(null)} title={rnd ? `Random ${MEAL_LABEL[rnd.meal].toLowerCase()} idea` : ''}>
        {rnd && (rnd.pick ? (
          <div className="stack">
            <b style={{ fontSize: '1.1rem' }}>{rnd.pick.recipe.name}</b>
            <RecipeView recipe={rnd.pick.recipe} servings={rnd.pick.servings} />
            <div className="row" style={{ marginBottom: 0 }}>
              <button onClick={addRandom}>Add to {MEAL_LABEL[rnd.meal].toLowerCase()}</button>
              <button className="soft" onClick={() => randomFor(rnd.meal, rnd.seen)}><Icon name="dice" size={16} />Try another</button>
            </div>
          </div>
        ) : <p className="mute">No recipes found for this meal.</p>)}
      </Sheet>
      <Sheet open={!!adding} onClose={() => setAdding(null)} title={adding ? `Add to ${MEAL_LABEL[adding].toLowerCase()}` : ''}>
        {adding && <AddFood meal={adding} date={date} onDone={load} onClose={() => setAdding(null)} />}
      </Sheet>
    </>
  )
}
