import type { Exercise } from '../types'
import { similarExercises } from '../lib/exerciseSearch'

/** The main muscle an exercise works, in gold, so a curl always says what it trains. */
export const MuscleTag = ({ muscle }: { muscle: string }) => <span className="badge gold">{muscle}</span>

/** Shown when nothing matches what was typed: the closest exercises, tapping one fills the search box. */
export function DidYouMean({ rows, query, onPick }: { rows: Exercise[]; query: string; onPick: (name: string) => void }) {
  const close = similarExercises(rows, query)
  if (!query.trim()) return null
  return (
    <div className="card tight" role="status">
      <div className="pad"><span className="title">No exact match for "{query.trim()}"</span><br /><span className="meta">{close.length ? 'Did you mean one of these?' : 'Try a muscle (chest), an equipment (dumbbells) or part of a name.'}</span></div>
      {close.length > 0 && <div className="list">
        {close.map(e => (
          <button key={e.id} type="button" className="item" onClick={() => onPick(e.name)}>
            <span className="grow"><span className="title">{e.name}</span><br /><span className="meta"><MuscleTag muscle={e.muscle} /> {e.equipment}</span></span>
          </button>
        ))}
      </div>}
    </div>
  )
}
