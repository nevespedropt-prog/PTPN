import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useClients } from '../../hooks'
import { useAuth } from '../../auth'
import { addDays, DAY_NAMES, localDate, niceDate, relDay } from '../../lib/dates'
import { MEAL_LABEL, MEALS, forServings, generateWeek, suggestTargets, sum } from '../../lib/nutrition'
import { setsDone } from '../../lib/training'
import type { Checkin, ClientWorkout, FoodLog, MealPlanItem, Measurement, Program, ProgramDay, Recipe, Targets, Workout } from '../../types'
import { Avatar, Empty, MacroBar, MacroChips, Seg, Sheet, Skeleton, Tile } from '../../components/ui'
import Icon from '../../components/Icon'
import { RecipePicker, WorkoutPicker } from '../../components/Pickers'
import CoachHabits from '../CoachHabits'
import Progress from '../Progress'
import { AssignProgram, AssignWorkout } from './Assign'

type Tab = 'overview' | 'training' | 'nutrition' | 'habits' | 'progress'

function Overview({ id, go }: { id: string; go: (t: Tab) => void }) {
  const [cws, setCws] = useState<ClientWorkout[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [checkin, setCheckin] = useState<Checkin | null>(null)
  const [weight, setWeight] = useState<Measurement | null>(null)
  const [kcal, setKcal] = useState<number | null>(null)
  const today = localDate()

  useEffect(() => {
    ;(async () => {
      const [a, b, c, d] = await Promise.all([
        supabase.from('client_workouts').select('*').eq('client_id', id).order('date', { ascending: false }).limit(30),
        supabase.from('checkins').select('*').eq('client_id', id).order('date', { ascending: false }).limit(1),
        supabase.from('measurements').select('*').eq('client_id', id).not('weight_kg', 'is', null).order('date', { ascending: false }).limit(1),
        supabase.from('food_logs').select('*').eq('client_id', id).gte('date', addDays(today, -6)),
      ])
      const list = (a.data ?? []) as ClientWorkout[]
      setCws(list); setCheckin(((b.data ?? []) as Checkin[])[0] ?? null); setWeight(((c.data ?? []) as Measurement[])[0] ?? null)
      const logs = (d.data ?? []) as FoodLog[]
      const daysLogged = new Set(logs.map(l => l.date)).size
      setKcal(daysLogged ? Math.round(sum(logs).kcal / daysLogged) : null)
      const ids = [...new Set(list.map(x => x.workout_id))]
      if (ids.length) {
        const { data } = await supabase.from('workouts').select('id, name').in('id', ids)
        setNames(Object.fromEntries(((data ?? []) as Workout[]).map(w => [w.id, w.name])))
      }
    })()
  }, [id, today])

  const recent = cws.filter(c => c.date >= addDays(today, -14) && c.date <= today)
  const done = recent.filter(c => c.status === 'done').length
  return (
    <>
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <Tile label="Compliance" value={recent.length ? `${Math.round((done / recent.length) * 100)}%` : '–'} foot="last 14 days" />
        <Tile label="Weight" value={weight ? Number(weight.weight_kg) : '–'} unit={weight ? 'kg' : ''} foot={weight ? niceDate(weight.date) : 'Not logged'} />
        <Tile label="Avg calories" value={kcal ?? '–'} foot="logged days, last 7" />
        <Tile label="Latest mood" value={checkin?.mood ? `${checkin.mood}/5` : '–'} foot={checkin ? `Energy ${checkin.energy ?? '–'}/5 · ${niceDate(checkin.date)}` : 'No check-ins'} />
      </div>
      {checkin?.note && <div className="card tight"><span className="eyebrow">Latest check-in note</span><p style={{ margin: 0 }}>{checkin.note}</p></div>}
      <div className="section-title"><h2>Recent workouts</h2><button className="link red" onClick={() => go('training')}>Manage</button></div>
      <div className="card tight">
        {cws.length === 0 && <Empty icon="train" title="No workouts assigned">Open Training to schedule one.</Empty>}
        <div className="list">
          {cws.filter(c => c.date <= addDays(today, 3)).slice(0, 8).map(c => (
            <Link key={c.id} to={`/workout/${c.id}`} className="item">
              <span className="grow"><span className="title">{names[c.workout_id] ?? 'Workout'}</span><br /><span className="meta">{relDay(c.date)}{c.status === 'done' ? ` · ${setsDone(c)} sets` : ''}</span></span>
              <span className={'badge ' + (c.status === 'done' ? 'green' : c.status === 'skipped' || c.date < today ? 'amber' : 'blue')}>{c.status === 'scheduled' && c.date < today ? 'Missed' : c.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}

function Training({ id }: { id: string }) {
  const { clients } = useClients()
  const client = clients?.find(c => c.id === id)
  const [cws, setCws] = useState<ClientWorkout[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [programs, setPrograms] = useState<Program[]>([])
  const { profile } = useAuth()
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const [pick, setPick] = useState(false)
  const [wk, setWk] = useState<Workout | null>(null)
  const [prog, setProg] = useState<{ p: Program; days: ProgramDay[] } | null>(null)
  const [progList, setProgList] = useState(false)
  const today = localDate()

  const load = useCallback(async () => {
    const { data } = await supabase.from('client_workouts').select('*').eq('client_id', id).gte('date', addDays(today, -14)).order('date')
    const list = (data ?? []) as ClientWorkout[]
    setCws(list)
    const ids = [...new Set(list.map(x => x.workout_id))]
    if (ids.length) {
      const { data: w } = await supabase.from('workouts').select('id, name').in('id', ids)
      setNames(Object.fromEntries(((w ?? []) as Workout[]).map(x => [x.id, x.name])))
    }
  }, [id, today])
  useEffect(() => { load() }, [load])
  useEffect(() => { supabase.from('programs').select('*').order('name').then(({ data }) => setPrograms((data ?? []) as Program[])) }, [])

  async function custom() {
    setCreating(true)
    const first = (client?.full_name ?? '').split(' ')[0]
    const { data, error } = await supabase.from('workouts').insert({ name: first ? `${first}'s workout` : 'Custom workout', created_by: profile!.id }).select().single()
    setCreating(false)
    if (error || !data) return alert(error?.message ?? 'Could not create the workout')
    nav(`/library/workouts/${data.id}?assignTo=${id}`)
  }
  async function remove(c: ClientWorkout) { await supabase.from('client_workouts').delete().eq('id', c.id); load() }
  async function choose(p: Program) {
    const { data } = await supabase.from('program_days').select('*').eq('program_id', p.id)
    setProgList(false); setProg({ p, days: (data ?? []) as ProgramDay[] })
  }

  const upcoming = cws.filter(c => c.date >= today)
  const past = cws.filter(c => c.date < today).reverse()
  const row = (c: ClientWorkout) => (
    <div key={c.id} className="item">
      <Link to={`/workout/${c.id}`} className="grow" style={{ color: 'var(--ink)' }}><span className="title">{names[c.workout_id] ?? 'Workout'}</span><br /><span className="meta">{relDay(c.date)} · {niceDate(c.date)}</span></Link>
      <span className={'badge ' + (c.status === 'done' ? 'green' : c.status === 'skipped' ? 'amber' : c.date < today ? 'amber' : 'blue')}>{c.status === 'scheduled' && c.date < today ? 'Missed' : c.status}</span>
      {c.status === 'scheduled' && <button className="link" onClick={() => remove(c)} aria-label="Remove from schedule">Remove</button>}
    </div>
  )
  return (
    <>
      <div className="row">
        <button onClick={() => setPick(true)}><Icon name="plus" size={16} />Assign workout</button>
        <button className="soft" onClick={custom} disabled={creating}><Icon name="edit" size={16} />{creating ? 'Creating...' : 'Custom workout'}</button>
        <button className="soft" onClick={() => setProgList(true)}><Icon name="library" size={16} />Assign programme</button>
      </div>
      <div className="section-title"><h2>Upcoming</h2></div>
      <div className="card tight">{upcoming.length === 0 && <Empty icon="calendar" title="Nothing scheduled" />}<div className="list">{upcoming.map(row)}</div></div>
      {past.length > 0 && <><div className="section-title"><h2>Past two weeks</h2></div><div className="card tight"><div className="list">{past.map(row)}</div></div></>}

      <WorkoutPicker open={pick} onClose={() => setPick(false)} onPick={w => { setPick(false); setWk(w) }} />
      <Sheet open={!!wk} onClose={() => { setWk(null); load() }} title={`Assign ${wk?.name ?? ''}`}>{wk && client && <AssignWorkout workout={wk} clients={[client]} presetClient={id} onClose={() => { setWk(null); load() }} />}</Sheet>
      <Sheet open={progList} onClose={() => setProgList(false)} title="Choose a programme">
        <div className="list">{programs.map(p => (
          <button key={p.id} className="item" onClick={() => choose(p)}><span className="grow"><span className="title">{p.name}</span><br /><span className="meta">{p.goal} · {p.level} · {p.weeks} weeks</span></span><Icon name="chev" /></button>
        ))}</div>
      </Sheet>
      <Sheet open={!!prog} onClose={() => { setProg(null); load() }} title={prog ? `Assign ${prog.p.name}` : ''}>{prog && client && <AssignProgram program={prog.p} days={prog.days} clients={[client]} presetClient={id} onClose={() => { setProg(null); load() }} />}</Sheet>
    </>
  )
}

function Nutrition({ id }: { id: string }) {
  const [t, setT] = useState({ kcal: '', protein: '', carbs: '', fat: '', notes: '' })
  const [weight, setWeight] = useState<number | null>(null)
  const [plan, setPlan] = useState<(MealPlanItem & { recipe?: Recipe })[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [day, setDay] = useState(1)
  const [pickFor, setPickFor] = useState<(typeof MEALS)[number] | null>(null)
  const [msg, setMsg] = useState('')
  const [logs, setLogs] = useState<FoodLog[]>([])

  const load = useCallback(async () => {
    const [a, b, c, d, e] = await Promise.all([
      supabase.from('nutrition_targets').select('*').eq('client_id', id).maybeSingle(),
      supabase.from('meal_plan_items').select('*').eq('client_id', id).order('sort'),
      supabase.from('recipes').select('*'),
      supabase.from('measurements').select('weight_kg').eq('client_id', id).not('weight_kg', 'is', null).order('date', { ascending: false }).limit(1),
      supabase.from('food_logs').select('*').eq('client_id', id).gte('date', addDays(localDate(), -6)),
    ])
    const tg = a.data as Targets | null
    if (tg) setT({ kcal: String(tg.kcal ?? ''), protein: String(tg.protein ?? ''), carbs: String(tg.carbs ?? ''), fat: String(tg.fat ?? ''), notes: tg.notes })
    const r = (c.data ?? []) as Recipe[]
    setRecipes(r)
    setPlan(((b.data ?? []) as MealPlanItem[]).map(i => ({ ...i, recipe: r.find(x => x.id === i.recipe_id) })))
    setWeight(((d.data ?? []) as { weight_kg: number }[])[0] ? Number((d.data as { weight_kg: number }[])[0].weight_kg) : null)
    setLogs((e.data ?? []) as FoodLog[])
  }, [id])
  useEffect(() => { load() }, [load])

  async function saveTargets(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    const { error } = await supabase.from('nutrition_targets').upsert({
      client_id: id, kcal: Number(t.kcal) || null, protein: Number(t.protein) || null, carbs: Number(t.carbs) || null, fat: Number(t.fat) || null, notes: t.notes, updated_at: new Date().toISOString(),
    })
    setMsg(error ? error.message : 'Targets saved')
  }
  function suggest() {
    const kcal = Number(t.kcal)
    if (!kcal) return setMsg('Enter calories first.')
    const s = suggestTargets(kcal, weight ?? 75)
    setT({ ...t, protein: String(s.protein), carbs: String(s.carbs), fat: String(s.fat) })
    setMsg(weight ? `Split from their ${weight} kg bodyweight: 2 g/kg protein, 0.8 g/kg fat, carbs fill the rest.` : 'No weight logged, used 75 kg. Adjust as needed.')
  }
  async function addMeal(r: Recipe) {
    const meal = pickFor!; setPickFor(null)
    await supabase.from('meal_plan_items').insert({ client_id: id, day, meal_type: meal, recipe_id: r.id, servings: 1, sort: plan.filter(p => p.day === day && p.meal_type === meal).length })
    load()
  }
  async function setServings(i: MealPlanItem, servings: number) {
    if (!(servings > 0)) return
    await supabase.from('meal_plan_items').update({ servings }).eq('id', i.id); load()
  }
  async function removeMeal(i: MealPlanItem) { await supabase.from('meal_plan_items').delete().eq('id', i.id); load() }
  async function generate() {
    if (plan.length && !confirm('Replace the current weekly plan with a new generated one?')) return
    const tg: Targets = { client_id: id, kcal: Number(t.kcal) || null, protein: null, carbs: null, fat: null, notes: '' }
    const rows = generateWeek(recipes, tg, id)
    if (!rows.length) return setMsg('Add some recipes first.')
    await supabase.from('meal_plan_items').delete().eq('client_id', id)
    const { error } = await supabase.from('meal_plan_items').insert(rows)
    setMsg(error ? error.message : `Generated a 7-day plan around ${tg.kcal ?? 2000} kcal.`); load()
  }
  async function clearPlan() { if (confirm('Clear the whole weekly plan?')) { await supabase.from('meal_plan_items').delete().eq('client_id', id); load() } }

  const dayItems = plan.filter(p => p.day === day)
  const dayTotal = sum(dayItems.filter(p => p.recipe).map(p => forServings(p.recipe!, Number(p.servings))))
  const byDate = new Map<string, FoodLog[]>()
  for (const l of logs) byDate.set(l.date, [...(byDate.get(l.date) ?? []), l])

  return (
    <>
      <form className="card stack" onSubmit={saveTargets}>
        <h2 style={{ margin: 0 }}>Daily targets</h2>
        <div className="inline-inputs">
          <label className="field">Calories<input type="number" min="0" value={t.kcal} onChange={e => setT({ ...t, kcal: e.target.value })} /></label>
          <label className="field">Protein g<input type="number" min="0" value={t.protein} onChange={e => setT({ ...t, protein: e.target.value })} /></label>
          <label className="field">Carbs g<input type="number" min="0" value={t.carbs} onChange={e => setT({ ...t, carbs: e.target.value })} /></label>
          <label className="field">Fat g<input type="number" min="0" value={t.fat} onChange={e => setT({ ...t, fat: e.target.value })} /></label>
        </div>
        <textarea rows={2} placeholder="Note for the client (optional)" value={t.notes} onChange={e => setT({ ...t, notes: e.target.value })} />
        <div className="row" style={{ marginBottom: 0 }}><button>Save targets</button><button type="button" className="soft" onClick={suggest}><Icon name="sparkle" size={16} />Suggest split</button></div>
      </form>
      {msg && <p className={/saved|Generated|Split/.test(msg) ? 'ok small' : 'mute small'}>{msg}</p>}

      <div className="section-title"><h2>Weekly meal plan</h2>
        <div className="row" style={{ marginBottom: 0 }}><button className="soft sm" onClick={generate}><Icon name="sparkle" size={15} />Generate week</button><Link className="btn soft sm" to={`/meal-plans?client=${id}`}>Meal plan library</Link>{plan.length > 0 && <button className="link" onClick={clearPlan}>Clear</button>}</div>
      </div>
      <div className="week-strip">
        {DAY_NAMES.map((n, i) => <button key={n} className={day === i + 1 ? 'on' : ''} onClick={() => setDay(i + 1)}><small>{n}</small><b>{plan.filter(p => p.day === i + 1).length || '–'}</b><i className={plan.some(p => p.day === i + 1) ? 'has' : ''} /></button>)}
      </div>
      <div className="card">
        {dayItems.length > 0 && <><MacroChips m={dayTotal} /><hr className="sep" /></>}
        {MEALS.map(meal => (
          <div key={meal} style={{ marginBottom: 14 }}>
            <div className="meal-head"><h3>{MEAL_LABEL[meal]}</h3><button className="soft sm" onClick={() => setPickFor(meal)}><Icon name="plus" size={14} />Add</button></div>
            {dayItems.filter(p => p.meal_type === meal).map(p => (
              <div key={p.id} className="food-row">
                <span className="grow"><b style={{ fontWeight: 600 }}>{p.recipe?.name ?? 'Recipe'}</b>{p.recipe && <><br /><span className="mute small">{Math.round(p.recipe.kcal * Number(p.servings))} kcal</span></>}</span>
                <input type="number" min="0.25" step="0.25" value={Number(p.servings)} onChange={e => setServings(p, Number(e.target.value))} style={{ width: 76, minHeight: 38, padding: 6, textAlign: 'center' }} aria-label="Servings" />
                <button className="link" onClick={() => removeMeal(p)}>Remove</button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <RecipePicker open={!!pickFor} meal={pickFor ?? undefined} onClose={() => setPickFor(null)} onPick={addMeal} />

      <div className="section-title"><h2>What they actually ate</h2></div>
      <div className="card tight">
        {byDate.size === 0 && <Empty icon="nutrition" title="No food logged in the last 7 days" />}
        <div className="list">
          {[...byDate].sort((a, b) => b[0].localeCompare(a[0])).map(([date, ls]) => {
            const s = sum(ls)
            return <div key={date} className="item"><span className="grow"><span className="title">{relDay(date)}</span><br /><span className="meta">{ls.length} entries</span></span><MacroChips m={s} /></div>
          })}
        </div>
        {byDate.size > 0 && Number(t.kcal) > 0 && <><hr className="sep" /><MacroBar label="Average vs target" value={sum(logs).kcal / byDate.size} target={Number(t.kcal)} color="var(--red)" unit="kcal" /></>}
      </div>
    </>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const { clients } = useClients()
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<Tab>(sp.get('tab') === 'training' ? 'training' : 'overview')
  if (!id) return null
  if (!clients) return <Skeleton n={3} />
  const c = clients.find(x => x.id === id)
  if (!c) return <div className="card"><Empty icon="clients" title="Client not found"><Link to="/clients">Back to clients</Link></Empty></div>
  return (
    <>
      <div className="row nowrap" style={{ marginBottom: 14 }}>
        <Link to="/clients" className="btn icon" aria-label="Back to clients"><Icon name="back" size={18} /></Link>
        <Avatar name={c.full_name} size={46} />
        <div className="grow"><h1 style={{ fontSize: '1.35rem' }}>{c.full_name || 'Unnamed'}</h1><span className="mute small">Client{c.created_at ? ` since ${niceDate(c.created_at.slice(0, 10))}` : ''}</span></div>
        <Link to={`/inbox/${id}`} className="btn soft sm"><Icon name="chat" size={16} />Message</Link>
      </div>
      <Seg value={tab} onChange={setTab} options={[
        { value: 'overview', label: 'Overview' }, { value: 'training', label: 'Training' }, { value: 'nutrition', label: 'Nutrition' },
        { value: 'habits', label: 'Habits' }, { value: 'progress', label: 'Progress' },
      ]} />
      {tab === 'overview' && <Overview id={id} go={setTab} />}
      {tab === 'training' && <Training id={id} />}
      {tab === 'nutrition' && <Nutrition id={id} />}
      {tab === 'habits' && <CoachHabits clientId={id} />}
      {tab === 'progress' && <Progress clientId={id} readOnly />}
    </>
  )
}
