export type ParqKey = 'heart' | 'chest_pain' | 'dizziness' | 'breathing' | 'chronic_condition' | 'medication' | 'bone_joint_injury' | 'recent_surgery' | 'medical_supervision' | 'pregnancy' | 'allergies' | 'other_concern'
export type ParqAnswers = Record<ParqKey, boolean | null>

export const PARQ_QUESTIONS: { key: ParqKey; text: string; alert: string }[] = [
  { key: 'heart', text: 'Has the client been diagnosed with a heart, circulation or blood-pressure condition?', alert: 'Heart, circulation or blood-pressure condition' },
  { key: 'chest_pain', text: 'Do they experience chest pain at rest or during physical activity?', alert: 'Chest pain' },
  { key: 'dizziness', text: 'Have they had unexplained dizziness, fainting or loss of balance in the last 12 months?', alert: 'Dizziness, fainting or loss of balance' },
  { key: 'breathing', text: 'Do they have a breathing condition that may affect exercise?', alert: 'Breathing condition' },
  { key: 'chronic_condition', text: 'Do they have another diagnosed health condition that may affect exercise?', alert: 'Health condition affecting exercise' },
  { key: 'medication', text: 'Do they currently take prescribed medication relevant to training or nutrition?', alert: 'Medication relevant to coaching' },
  { key: 'bone_joint_injury', text: 'Do they have an injury, pain, or bone, joint or muscle problem that activity may worsen?', alert: 'Injury or musculoskeletal concern' },
  { key: 'recent_surgery', text: 'Have they had surgery or hospital treatment in the last 12 months that may affect exercise?', alert: 'Recent surgery or hospital treatment' },
  { key: 'medical_supervision', text: 'Has a healthcare professional advised them to limit activity or exercise only with supervision?', alert: 'Exercise restriction or supervision advised' },
  { key: 'pregnancy', text: 'Is pregnancy, recent childbirth or postnatal recovery relevant to exercise planning?', alert: 'Pregnancy or postnatal consideration' },
  { key: 'allergies', text: 'Do they have food, medication or other allergies the coach should know about?', alert: 'Allergy' },
  { key: 'other_concern', text: 'Is there anything else that could affect their ability to exercise safely?', alert: 'Other exercise-safety concern' },
]

export const blankParqAnswers = (): ParqAnswers => Object.fromEntries(PARQ_QUESTIONS.map(q => [q.key, null])) as ParqAnswers

export function parqAlerts(answers?: Partial<ParqAnswers> | null) {
  return PARQ_QUESTIONS.filter(q => answers?.[q.key] === true).map(q => q.alert)
}

