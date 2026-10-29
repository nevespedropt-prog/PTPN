import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth'
import { ACTIVITY_LABEL, ageOn, bmi, maintenanceCalories, restingCalories, type ActivityLevel, type AssessmentSex } from '../lib/assessment'
import { localDate } from '../lib/dates'
import { suggestTargets } from '../lib/nutrition'
import { supabase } from '../lib/supabase'
import type { FitnessAssessmentItem, TasterSession } from '../types'
import { ExercisePicker } from './Pickers'
import Icon from './Icon'
import { Empty, Skeleton, Tile } from './ui'

type Draft = Omit<TasterSession, 'id' | 'client_id' | 'bmi' | 'target_bmi' | 'bmr_kcal' | 'target_bmr_kcal' | 'estimated_maintenance_kcal' | 'created_by' | 'created_at' | 'updated_at'> & { id?: string }
type ItemDraft = Omit<FitnessAssessmentItem, 'id' | 'taster_session_id' | 'sort'> & { id?: string }

const blank = (): Draft => ({
  assessed_on: localDate(), goal: '', target_date: '', date_of_birth: '', sex: 'female', activity_level: 'moderate',
  height_cm: 0, weight_kg: 0, target_weight_kg: 0, body_fat_pct: null, target_body_fat_pct: null,
  job_description: '', fitness_level: 'beginner', diet: '',
  goal_metric_label: '', goal_metric_current: '', goal_metric_target: '', goal_metric_unit: '', new_habit: '',
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_email: '',
  target_kcal: 0, target_protein: 0, target_carbs: 0, target_fat: 0,
  client_summary: '', coach_notes: '',
})

export default function TasterSessionForm({ clientId }: { clientId: string }) {
  const { profile } = useAuth()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [items, setItems] = useState<ItemDraft[]>([])
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('taster_sessions').select('*').eq('client_id', clientId).order('assessed_on', { ascending: false }).order('created_at', { ascending: false }).limit(1)
    if (error) { setMessage('Could not load the taster session.'); setDraft(blank()); return }
    const row = ((data ?? []) as TasterSession[])[0]
    if (!row) { setDraft(blank()); setItems([]); return }
    setDraft({
      ...row, id: row.id, target_weight_kg: row.target_weight_kg ?? row.weight_kg, target_body_fat_pct: row.target_body_fat_pct ?? null,
      job_description: row.job_description ?? '', fitness_level: row.fitness_level ?? 'beginner', diet: row.diet ?? '',
      goal_metric_label: row.goal_metric_label ?? '', goal_metric_current: row.goal_metric_current ?? '',
      goal_metric_target: row.goal_metric_target ?? '', goal_metric_unit: row.goal_metric_unit ?? '', new_habit: row.new_habit ?? '',
      emergency_contact_name: row.emergency_contact_name ?? '', emergency_contact_phone: row.emergency_contact_phone ?? '', emergency_contact_email: row.emergency_contact_email ?? '',
    })
    const result = await supabase.from('fitness_assessment_items').select('*').eq('taster_session_id', row.id).order('sort')
    setItems((result.data ?? []) as FitnessAssessmentItem[])
  }, [clientId])
  useEffect(() => { load() }, [load])

  const calculated = useMemo(() => {
    if (!draft?.date_of_birth || !draft.height_cm || !draft.weight_kg) return null
    const age = ageOn(draft.date_of_birth)
    if (age < 14 || age > 100) return null
    const currentBmi = bmi(Number(draft.weight_kg), Number(draft.height_cm))
    const currentBmr = restingCalories(Number(draft.weight_kg), Number(draft.height_cm), age, draft.sex)
    const targetBmi = draft.target_weight_kg ? bmi(Number(draft.target_weight_kg), Number(draft.height_cm)) : null
    const targetBmr = draft.target_weight_kg ? restingCalories(Number(draft.target_weight_kg), Number(draft.height_cm), age, draft.sex) : null
    return { age, bmi: currentBmi, targetBmi, bmr: currentBmr, targetBmr, maintenance: maintenanceCalories(Number(draft.weight_kg), Number(draft.height_cm), age, draft.sex, draft.activity_level) }
  }, [draft])

  function suggestMacros() {
    if (!draft?.target_kcal || !draft.weight_kg) return setMessage('Add weight and target calories first.')
    const next = suggestTargets(Number(draft.target_kcal), Number(draft.weight_kg))
    setDraft({ ...draft, target_protein: next.protein, target_carbs: next.carbs, target_fat: next.fat })
    setMessage('Suggested macros added. You can adjust them before saving.')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMessage('')
    if (!draft || !calculated || !profile) return setMessage('Complete the personal details before saving.')
    if (draft.target_date < draft.assessed_on) return setMessage('The target date must be after the assessment date.')
    setBusy(true)
    const suggested = suggestTargets(Number(draft.target_kcal), Number(draft.weight_kg))
    const macros = draft.target_protein || draft.target_carbs || draft.target_fat ? draft : {
      ...draft, target_protein: suggested.protein, target_carbs: suggested.carbs, target_fat: suggested.fat,
    }
    const payload = {
      client_id: clientId, assessed_on: macros.assessed_on, goal: macros.goal.trim(), target_date: macros.target_date,
      date_of_birth: macros.date_of_birth, sex: macros.sex, activity_level: macros.activity_level,
      height_cm: Number(macros.height_cm), weight_kg: Number(macros.weight_kg), target_weight_kg: Number(macros.target_weight_kg), body_fat_pct: macros.body_fat_pct ? Number(macros.body_fat_pct) : null, target_body_fat_pct: macros.target_body_fat_pct ? Number(macros.target_body_fat_pct) : null,
      bmi: calculated.bmi, target_bmi: calculated.targetBmi, bmr_kcal: calculated.bmr, target_bmr_kcal: calculated.targetBmr,
      estimated_maintenance_kcal: calculated.maintenance, target_kcal: Number(macros.target_kcal),
      target_protein: Number(macros.target_protein), target_carbs: Number(macros.target_carbs), target_fat: Number(macros.target_fat),
      job_description: macros.job_description.trim(), fitness_level: macros.fitness_level, diet: macros.diet.trim(),
      goal_metric_label: macros.goal_metric_label.trim(), goal_metric_current: macros.goal_metric_current.trim(), goal_metric_target: macros.goal_metric_target.trim(), goal_metric_unit: macros.goal_metric_unit.trim(), new_habit: macros.new_habit.trim(),
      emergency_contact_name: macros.emergency_contact_name.trim(), emergency_contact_phone: macros.emergency_contact_phone.trim(), emergency_contact_email: macros.emergency_contact_email.trim(),
      client_summary: macros.client_summary.trim(), coach_notes: macros.coach_notes.trim(), created_by: profile.id, updated_at: new Date().toISOString(),
    }
    const saved = draft.id
      ? await supabase.from('taster_sessions').update(payload).eq('id', draft.id).select().single()
      : await supabase.from('taster_sessions').insert(payload).select().single()
    if (saved.error || !saved.data) { setBusy(false); return setMessage(saved.error?.message ?? 'Could not save the taster session.') }
    const session = saved.data as TasterSession
    const [measurement, targets, removed] = await Promise.all([
      supabase.from('measurements').upsert({ client_id: clientId, date: macros.assessed_on, weight_kg: Number(macros.weight_kg), body_fat_pct: macros.body_fat_pct ? Number(macros.body_fat_pct) : null, notes: 'Taster session', taster_session_id: session.id }, { onConflict: 'taster_session_id' }),
      supabase.from('nutrition_targets').upsert({ client_id: clientId, kcal: Number(macros.target_kcal), protein: Number(macros.target_protein), carbs: Number(macros.target_carbs), fat: Number(macros.target_fat), notes: `Set from taster session on ${macros.assessed_on}`, updated_at: new Date().toISOString() }),
      supabase.from('fitness_assessment_items').delete().eq('taster_session_id', session.id),
    ])
    let itemError = removed.error
    if (!itemError && items.length) {
      const added = await supabase.from('fitness_assessment_items').insert(items.map((item, sort) => ({
        taster_session_id: session.id, exercise_id: item.exercise_id, exercise_name: item.exercise_name, category: item.category,
        result: item.result.trim(), unit: item.unit.trim(), notes: item.notes.trim(), sort,
      })))
      itemError = added.error
    }
    setBusy(false)
    if (measurement.error || targets.error || itemError) return setMessage(measurement.error?.message || targets.error?.message || itemError?.message || 'Some linked details could not be saved.')
    setDraft({ ...macros, id: session.id }); setMessage('Taster session saved. Goal, progress and nutrition targets are now connected.')
  }

  function startNew() {
    if (!draft || !confirm('Start a new assessment? The saved assessment will stay in the client history.')) return
    setDraft({ ...draft, id: undefined, assessed_on: localDate(), client_summary: '', coach_notes: '' }); setItems([]); setMessage('New assessment started.')
  }
  function addExercise(e: { id: string | null; name: string; category?: string }) {
    setItems(list => [...list, { exercise_id: e.id, exercise_name: e.name, category: e.category ?? '', result: '', unit: '', notes: '' }]); setPicker(false)
  }
  function updateItem(index: number, patch: Partial<ItemDraft>) { setItems(list => list.map((item, i) => i === index ? { ...item, ...patch } : item)) }

  if (!draft) return <Skeleton n={4} />
  return (
    <form onSubmit={save} className="stack taster-form">
      <div className="row between"><div><span className="eyebrow">Coach assessment</span><h2 style={{ margin: '4px 0' }}>Taster session</h2></div>{draft.id && <button type="button" className="soft sm" onClick={startNew}>New assessment</button>}</div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Goal and timeframe</h3>
        <label className="field">Fitness goal<textarea required maxLength={1200} rows={3} value={draft.goal} onChange={e => setDraft({ ...draft, goal: e.target.value })} placeholder="What the client wants to achieve and how success will be measured" /></label>
        <div className="taster-personal-grid">
          <label className="field">Assessment date<input required type="date" value={draft.assessed_on} onChange={e => setDraft({ ...draft, assessed_on: e.target.value })} /></label>
          <label className="field">Target date<input required type="date" value={draft.target_date} onChange={e => setDraft({ ...draft, target_date: e.target.value })} /></label>
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Personal details</h3>
        <div className="taster-personal-grid">
          <label className="field">Date of birth<input required type="date" max={localDate()} value={draft.date_of_birth} onChange={e => setDraft({ ...draft, date_of_birth: e.target.value })} /></label>
          <label className="field">Sex used for calculation<select value={draft.sex} onChange={e => setDraft({ ...draft, sex: e.target.value as AssessmentSex })}><option value="female">Female</option><option value="male">Male</option></select></label>
          <label className="field">Activity level<select value={draft.activity_level} onChange={e => setDraft({ ...draft, activity_level: e.target.value as ActivityLevel })}>{Object.entries(ACTIVITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field">Fitness level<select value={draft.fitness_level} onChange={e => setDraft({ ...draft, fitness_level: e.target.value as Draft['fitness_level'] })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="athlete">Athlete</option></select></label>
        </div>
        <label className="field">Job description<input maxLength={500} value={draft.job_description} onChange={e => setDraft({ ...draft, job_description: e.target.value })} placeholder="Role, working pattern and usual activity" /></label>
        <label className="field">Diet<textarea maxLength={1200} rows={2} value={draft.diet} onChange={e => setDraft({ ...draft, diet: e.target.value })} placeholder="Current diet, preferences and restrictions" /></label>
        <h3 style={{ margin: '6px 0 0' }}>Measurements</h3>
        <div className="measurement-entry-grid">
          <label className="field">Height cm<input required type="number" min="100" max="250" step="0.1" value={draft.height_cm || ''} onChange={e => setDraft({ ...draft, height_cm: Number(e.target.value) })} /></label>
          <label className="field">Starting weight kg<input required type="number" min="20" max="400" step="0.1" value={draft.weight_kg || ''} onChange={e => setDraft({ ...draft, weight_kg: Number(e.target.value) })} /></label>
          <label className="field">Starting body fat %<input type="number" min="0" max="100" step="0.1" value={draft.body_fat_pct ?? ''} onChange={e => setDraft({ ...draft, body_fat_pct: e.target.value ? Number(e.target.value) : null })} /></label>
          <div className="measurement-stat"><span>BMI</span><strong>{calculated?.bmi ?? '-'}</strong></div>
          <div className="measurement-stat"><span>BMR</span><strong>{calculated?.bmr ?? '-'}{calculated && <small> kcal</small>}</strong></div>
          <label className="field">Target weight kg<input required type="number" min="20" max="400" step="0.1" value={draft.target_weight_kg || ''} onChange={e => setDraft({ ...draft, target_weight_kg: Number(e.target.value) })} /></label>
          <div className="measurement-stat"><span>Target BMR</span><strong>{calculated?.targetBmr ?? '-'}{calculated?.targetBmr && <small> kcal</small>}</strong></div>
        </div>
        <h3 style={{ margin: '6px 0 0' }}>Goal highlights</h3>
        <div className="inline-inputs">
          <label className="field">Important metric<input required maxLength={80} value={draft.goal_metric_label} onChange={e => setDraft({ ...draft, goal_metric_label: e.target.value })} placeholder="Weight, body fat, 5 km time, deadlift" /></label>
          <label className="field">Current metric<input required maxLength={80} value={draft.goal_metric_current} onChange={e => setDraft({ ...draft, goal_metric_current: e.target.value })} placeholder="Current result" /></label>
          <label className="field">Target metric<input required maxLength={80} value={draft.goal_metric_target} onChange={e => setDraft({ ...draft, goal_metric_target: e.target.value })} placeholder="Target result" /></label>
          <label className="field">Metric unit<input maxLength={40} value={draft.goal_metric_unit} onChange={e => setDraft({ ...draft, goal_metric_unit: e.target.value })} placeholder="kg, %, km, minutes" /></label>
        </div>
        <label className="field">New habit<input required maxLength={200} value={draft.new_habit} onChange={e => setDraft({ ...draft, new_habit: e.target.value })} placeholder="The first behaviour that supports this goal" /></label>
        <div className="grid g3">
          <Tile label="Age" value={calculated?.age ?? '-'} foot="from date of birth" />
          <Tile label={draft.goal_metric_label || 'Goal metric'} value={draft.goal_metric_target || '-'} unit={draft.goal_metric_unit ? ` ${draft.goal_metric_unit}` : ''} foot={draft.goal_metric_current ? `Current ${draft.goal_metric_current}` : 'Set the key outcome'} />
          <Tile label="New habit" value={draft.new_habit || '-'} foot="first behaviour target" />
        </div>
      </div>

      <div className="card stack">
        <div className="row between"><h3 style={{ margin: 0 }}>Nutrition targets</h3><button type="button" className="soft sm" onClick={suggestMacros}><Icon name="sparkle" size={15} />Suggest macros</button></div>
        <div className="inline-inputs">
          <label className="field">Target calories<input required type="number" min="500" max="10000" value={draft.target_kcal || ''} onChange={e => setDraft({ ...draft, target_kcal: Number(e.target.value) })} /></label>
          <label className="field">Protein g<input required type="number" min="0" value={draft.target_protein || ''} onChange={e => setDraft({ ...draft, target_protein: Number(e.target.value) })} /></label>
          <label className="field">Carbs g<input required type="number" min="0" value={draft.target_carbs || ''} onChange={e => setDraft({ ...draft, target_carbs: Number(e.target.value) })} /></label>
          <label className="field">Fat g<input required type="number" min="0" value={draft.target_fat || ''} onChange={e => setDraft({ ...draft, target_fat: Number(e.target.value) })} /></label>
        </div>
      </div>

      <div className="card stack">
        <div className="row between"><h3 style={{ margin: 0 }}>Fitness assessment</h3><button type="button" className="soft sm" onClick={() => setPicker(true)}><Icon name="plus" size={15} />Add exercise</button></div>
        {!items.length && <Empty icon="train" title="No assessment exercises yet">Add any strength, cardio, mobility or custom exercise.</Empty>}
        {items.map((item, index) => <div className="assessment-row" key={item.id ?? `${item.exercise_name}-${index}`}>
          <div className="row between"><b>{item.exercise_name}</b><button type="button" className="link" onClick={() => setItems(list => list.filter((_, i) => i !== index))}>Remove</button></div>
          <div className="inline-inputs"><label className="field">Result<input value={item.result} onChange={e => updateItem(index, { result: e.target.value })} placeholder="e.g. 12, 60, 5:30" /></label><label className="field">Unit<input value={item.unit} onChange={e => updateItem(index, { unit: e.target.value })} placeholder="reps, kg, seconds, km" /></label></div>
          <label className="field">Notes<input value={item.notes} onChange={e => updateItem(index, { notes: e.target.value })} placeholder="Technique, limitations or observations" /></label>
        </div>)}
      </div>

      <div className="card stack">
        <label className="field">Client summary<textarea maxLength={2400} rows={3} value={draft.client_summary} onChange={e => setDraft({ ...draft, client_summary: e.target.value })} placeholder="Short assessment summary visible to the client" /></label>
        <label className="field">Coach notes<textarea maxLength={4000} rows={3} value={draft.coach_notes} onChange={e => setDraft({ ...draft, coach_notes: e.target.value })} placeholder="Private coaching notes" /></label>
      </div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Emergency contact</h3>
        <div className="inline-inputs">
          <label className="field">Emergency contact name<input required maxLength={160} value={draft.emergency_contact_name} onChange={e => setDraft({ ...draft, emergency_contact_name: e.target.value })} /></label>
          <label className="field">Emergency contact number<input required type="tel" maxLength={80} value={draft.emergency_contact_phone} onChange={e => setDraft({ ...draft, emergency_contact_phone: e.target.value })} /></label>
          <label className="field">Emergency contact email<input required type="email" maxLength={320} value={draft.emergency_contact_email} onChange={e => setDraft({ ...draft, emergency_contact_email: e.target.value })} /></label>
        </div>
      </div>
      {message && <p className={message.includes('saved') || message.includes('added') ? 'ok' : 'err'} role="status">{message}</p>}
      <button disabled={busy} style={{ minHeight: 50 }}>{busy ? 'Saving...' : 'Save taster session'}</button>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addExercise} />
    </form>
  )
}

