import type { Workout, WorkoutItem, WorkoutLog } from '../types'
import { fmtSeconds } from '../lib/util'
import { parseMinutes, setBlocks } from '../lib/training'

export default function WorkoutFormatTracker({ workout, items, log, elapsed }: { workout: Workout; items: WorkoutItem[]; log: WorkoutLog; elapsed: number }) {
  if (!items.length) return null
  let title = 'Current set block'
  let value = 'Block 1'
  let detail = 'Complete the prescribed exercise block.'

  if (workout.format === 'standard') {
    const firstIncomplete = items.findIndex(item => (log.items?.[item.id] ?? []).some(set => !set.done))
    const current = items[Math.max(0, firstIncomplete)]
    const blocks = setBlocks(items)
    const blockIndex = Math.max(0, blocks.findIndex(block => block.items.some(item => item.id === current?.id)))
    const block = blocks[blockIndex]
    value = `Block ${blockIndex + 1} of ${blocks.length}`
    detail = block?.style === 'superset' ? 'Complete both exercises back-to-back before resting.'
      : block?.style === 'triset' ? 'Complete all three exercises back-to-back before resting.'
      : block ? 'Complete this exercise, then take the prescribed rest.' : detail
  } else if (workout.format === 'circuit') {
    title = 'Current round'; value = `Round ${(log.rounds ?? 0) + 1}`; detail = 'Complete every exercise, then record the round.'
  } else if (workout.format === 'amrap') {
    const limit = (workout.duration_min ?? 0) * 60
    title = limit ? 'AMRAP time remaining' : 'AMRAP pace'
    value = limit ? fmtSeconds(Math.max(0, limit - elapsed)) : `Round ${(log.rounds ?? 0) + 1}`
    detail = limit && elapsed >= limit ? 'Time cap reached. Finish or record your last round.' : 'Keep moving through the full sequence.'
  } else if (workout.format === 'emom') {
    const minute = Math.floor(elapsed / 60)
    title = `Minute ${minute + 1}`; value = fmtSeconds(60 - (elapsed % 60)); detail = items[minute % items.length]?.exercise_name ?? 'Start the next exercise'
  } else {
    const item = items.find(candidate => candidate.cardio_time) ?? items[0]
    const work = Math.max(1, Math.round((parseMinutes(item.cardio_time || item.reps) ?? 1) * 60))
    const recovery = Math.max(0, item.rest_sec ?? 0)
    const cycle = work + recovery
    const within = elapsed % cycle
    const recovering = within >= work
    title = recovering ? 'Recovery' : 'Work interval'
    value = fmtSeconds((recovering ? cycle : work) - within)
    detail = `Interval ${Math.floor(elapsed / cycle) + 1}${workout.rounds ? ` of ${workout.rounds}` : ''}`
  }

  return <section className="card tight row between nowrap" aria-label="Live format guidance" aria-live="off">
    <div><span className="mute small">{title}</span><br /><b>{detail}</b></div>
    <span className="clock format-clock">{value}</span>
  </section>
}
