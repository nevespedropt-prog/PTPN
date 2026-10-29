import { niceDate } from '../lib/dates'
import { PARQ_QUESTIONS } from '../lib/parq'
import type { TasterSession } from '../types'

// Read-only copy of the health screening (PAR-Q and consents) the coach recorded in the taster session.
export default function HealthScreeningView({ taster }: { taster: TasterSession }) {
  const details = [
    ['Health conditions or other concerns', taster.parq_health_details], ['Injuries, pain or movement limitations', taster.parq_injury_details],
    ['Medication', taster.parq_medication_details], ['Allergies', taster.parq_allergy_details],
  ].filter(([, text]) => text)
  const consent = (given: boolean, at: string | null) => given ? `recorded${at ? ` on ${niceDate(at.slice(0, 10))}` : ''}` : 'not recorded'
  return <details className="card stack parq-card collapsible-card" open role="region" aria-label="Health screening and consent">
    <summary><span><span className="eyebrow">Health screening</span><b>PAR-Q and your consent</b></span></summary>
    <p className="mute small" style={{ margin: 0 }}>Recorded by your coach in your taster session on {niceDate(taster.assessed_on)}. For viewing only. Tell your coach if anything has changed.</p>
    <div className="list">{PARQ_QUESTIONS.map(question => {
      const answer = taster.parq_answers?.[question.key]
      return <div className="item" key={question.key}>
        <span className="grow small">{question.text}</span>
        <span className={'badge ' + (answer === true ? 'amber' : '')} aria-label={'Answer: ' + (answer === true ? 'Yes' : answer === false ? 'No' : 'not answered')}>{answer === true ? 'Yes' : answer === false ? 'No' : '-'}</span>
      </div>
    })}</div>
    {details.map(([label, text]) => <div key={label}><b className="small">{label}</b><p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</p></div>)}
    <span className="mute small">Health-information storage consent {consent(taster.parq_health_storage_consent, taster.parq_health_storage_consented_at)}.</span>
    <span className="mute small">Personal-training and exercise consent {consent(taster.parq_exercise_consent, taster.parq_consented_at)}.</span>
  </details>
}
