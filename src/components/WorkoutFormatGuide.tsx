import type { WorkoutFormat } from '../types'
import { FORMAT_DESCRIPTION, FORMAT_LABEL } from '../lib/training'

export default function WorkoutFormatGuide({ format, minutes, rounds }: { format: WorkoutFormat; minutes?: number | null; rounds?: number | null }) {
  return <section className="card tight" aria-label="Workout format" aria-live="polite">
    <h2 style={{ margin: '0 0 6px', fontSize: '1rem' }}>{FORMAT_LABEL[format]}</h2>
    <p className="mute small" style={{ margin: 0 }}>{FORMAT_DESCRIPTION[format]}</p>
    {(!!minutes || (format !== 'standard' && !!rounds)) && <div className="row" style={{ flexWrap: 'wrap', gap: 8, margin: '8px 0 0' }}>
      {!!minutes && <span className="badge">{format === 'amrap' ? 'Time cap' : 'Duration'}: {minutes} min</span>}
      {format !== 'standard' && !!rounds && <span className="badge">{format === 'amrap' ? 'Round goal' : format === 'intervals' ? 'Intervals' : 'Rounds'}: {rounds}</span>}
    </div>}
  </section>
}
