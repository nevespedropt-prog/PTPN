import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { Empty, PageHead, Skeleton } from '../../components/ui'
import { ACTIVITY_LABEL, ageOn } from '../../lib/assessment'
import { niceDate } from '../../lib/dates'
import { parqAlerts } from '../../lib/parq'
import { supabase } from '../../lib/supabase'
import type { FitnessAssessmentItem, TasterSession } from '../../types'

function ReadItem({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="taster-read-item"><span>{label}</span><b>{value || '-'}</b></div>
}

export default function TasterSessionView() {
  const { profile } = useAuth()
  const [taster, setTaster] = useState<TasterSession | null | undefined>(undefined)
  const [items, setItems] = useState<FitnessAssessmentItem[]>([])
  useEffect(() => {
    if (!profile) return
    ;(async () => {
      const { data } = await supabase.from('taster_sessions').select('*').eq('client_id', profile.id).order('assessed_on', { ascending: false }).order('created_at', { ascending: false }).limit(1)
      const current = ((data ?? []) as TasterSession[])[0] ?? null
      setTaster(current)
      if (current) {
        const result = await supabase.from('fitness_assessment_items').select('*').eq('taster_session_id', current.id).order('sort')
        setItems((result.data ?? []) as FitnessAssessmentItem[])
      }
    })()
  }, [profile])
  if (taster === undefined) return <><PageHead eyebrow="My coaching profile" title="Taster session" /><Skeleton n={4} /></>
  if (!taster) return <><PageHead eyebrow="My coaching profile" title="Taster session" /><div className="card"><Empty icon="progress" title="No taster session yet">Your coach will add this after your assessment.</Empty></div></>

  const alerts = parqAlerts(taster.parq_answers)
  const detailLines = [taster.parq_health_details, taster.parq_injury_details, taster.parq_medication_details, taster.parq_allergy_details].filter(Boolean)
  return <>
    <PageHead eyebrow="My coaching profile" title="Taster session" />
    <Link to="/home" className="link"> Back to dashboard</Link>
    <div className="card goal-card" style={{ marginTop: 12 }}>
      <span className="eyebrow">My fitness goal</span><h2>{taster.goal}</h2>
      <span className="badge red">Target {niceDate(taster.target_date)}</span>
      {taster.client_summary && <><hr className="sep" /><b>Message from my coach</b><p style={{ margin: '6px 0 0' }}>{taster.client_summary}</p></>}
    </div>

    <div className="card stack"><h3 style={{ margin: 0 }}>Goal plan</h3><div className="taster-read-grid">
      <ReadItem label="Assessment date" value={niceDate(taster.assessed_on)} /><ReadItem label="Important metric" value={`${taster.goal_metric_target} ${taster.goal_metric_unit}`.trim()} /><ReadItem label="Starting point" value={`${taster.goal_metric_current} ${taster.goal_metric_unit}`.trim()} /><ReadItem label="New habit" value={taster.new_habit} />
    </div></div>

    <div className="card stack"><h3 style={{ margin: 0 }}>Measurements</h3><div className="taster-read-grid">
      <ReadItem label="Height" value={`${taster.height_cm} cm`} /><ReadItem label="Starting weight" value={`${taster.weight_kg} kg`} /><ReadItem label="Starting body fat" value={taster.body_fat_pct == null ? '-' : `${taster.body_fat_pct}%`} /><ReadItem label="BMI" value={taster.bmi} /><ReadItem label="BMR" value={`${taster.bmr_kcal} kcal`} /><ReadItem label="Target weight" value={`${taster.target_weight_kg} kg`} /><ReadItem label="Target BMR" value={`${taster.target_bmr_kcal} kcal`} />
    </div></div>

    <div className="card stack"><h3 style={{ margin: 0 }}>Personal and nutrition plan</h3><div className="taster-read-grid">
      <ReadItem label="Age" value={ageOn(taster.date_of_birth)} /><ReadItem label="Activity level" value={ACTIVITY_LABEL[taster.activity_level]} /><ReadItem label="Fitness level" value={taster.fitness_level} /><ReadItem label="Job" value={taster.job_description} /><ReadItem label="Diet" value={taster.diet} /><ReadItem label="Daily calories" value={`${taster.target_kcal} kcal`} /><ReadItem label="Protein" value={`${taster.target_protein} g`} /><ReadItem label="Carbohydrates" value={`${taster.target_carbs} g`} /><ReadItem label="Fat" value={`${taster.target_fat} g`} />
    </div></div>

    <div className="card stack"><h3 style={{ margin: 0 }}>Fitness assessment</h3>{items.length ? <div className="list">{items.map(item => <div className="item" key={item.id}><span className="grow"><b>{item.exercise_name}</b><br /><span className="meta">{item.result} {item.unit}{item.notes ? ` � ${item.notes}` : ''}</span></span></div>)}</div> : <p className="mute" style={{ margin: 0 }}>No exercise results recorded.</p>}</div>

    <div className="card stack"><h3 style={{ margin: 0 }}>Health screening and consent</h3>
      {alerts.length || detailLines.length ? <><div className="health-alert-list">{alerts.map(alert => <div className="health-alert-item" key={alert}>{alert}</div>)}</div>{detailLines.map(line => <p key={line} style={{ margin: 0 }}>{line}</p>)}</> : <p style={{ margin: 0 }}>No exercise-safety concerns were recorded.</p>}
      <span className="mute small">Health-information storage consent {taster.parq_health_storage_consent ? `recorded${taster.parq_health_storage_consented_at ? ` on ${niceDate(taster.parq_health_storage_consented_at.slice(0, 10))}` : ''}` : 'not recorded'}.</span>
      <span className="mute small">Personal-training and exercise consent {taster.parq_exercise_consent ? `recorded${taster.parq_consented_at ? ` on ${niceDate(taster.parq_consented_at.slice(0, 10))}` : ''}` : 'not recorded'}.</span>
    </div>

    <div className="card stack"><h3 style={{ margin: 0 }}>Emergency contact</h3><p style={{ margin: 0 }}>{taster.emergency_contact_name} � {taster.emergency_contact_phone}<br />{taster.emergency_contact_email}</p></div>
  </>
}

