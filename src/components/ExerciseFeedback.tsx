import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { VIDEO_BUCKET, VOICE_BUCKET, feedbackMedia } from '../lib/feedbackMedia'
import { niceDate } from '../lib/dates'
import { Sheet } from './ui'
import VoiceFeedback, { PrivateFeedbackMedia, type VideoReview } from './VoiceFeedback'

export interface FeedbackExercise { id: string; exercise_name: string }
interface Submission {
  id: string; client_id: string; client_workout_id: string; workout_item_id: string
  exercise_name: string; question: string; video_path: string; created_at: string
}

export default function ExerciseFeedback({ clientId, workoutId, exercise, coach, onClose, initialVideoId }: {
  clientId: string; workoutId: string; exercise: FeedbackExercise; coach: boolean; onClose: () => void; initialVideoId?: string
}) {
  const [clips, setClips] = useState<Submission[]>([])
  const [reviews, setReviews] = useState<Record<string, VideoReview>>({})
  const [selected, setSelected] = useState<Submission | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [retry, setRetry] = useState(0)
  const load = useCallback(async () => {
    const v = await supabase.from('exercise_videos').select('*').eq('client_workout_id', workoutId).eq('workout_item_id', exercise.id).order('created_at', { ascending: false })
    if (v.error) throw v.error
    const rows = (v.data ?? []) as Submission[]
    const r = rows.length ? await supabase.from('exercise_video_reviews').select('*').in('video_id', rows.map(x => x.id)) : { data: [], error: null }
    if (r.error) throw r.error
    return { rows, reviews: Object.fromEntries(((r.data ?? []) as VideoReview[]).map(x => [x.video_id, x])) }
  }, [workoutId, exercise.id])
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    load().then(data => { if (active) { setClips(data.rows); setReviews(data.reviews); if (coach && initialVideoId) setSelected(data.rows.find(x => x.id === initialVideoId) ?? null) } })
      .catch(() => { if (active) setError('Could not load technique feedback. Please try again when connected.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load, retry, coach, initialVideoId])

  function choose(value: File | undefined) {
    setError('')
    if (!value) return
    try { feedbackMedia(value, 'video'); setFile(value) }
    catch (e) { setFile(null); setError((e as Error).message) }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!file) return
    setBusy(true); setError('')
    try {
      const kind = feedbackMedia(file, 'video')
      const id = crypto.randomUUID()
      const path = clientId + '/' + id + '/clip.' + kind.extension
      const upload = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, { contentType: kind.contentType, upsert: false })
      if (upload.error) throw upload.error
      const value = { id, client_id: clientId, client_workout_id: workoutId, workout_item_id: exercise.id,
        exercise_name: exercise.exercise_name, question: question.trim(), video_path: path }
      const result = await supabase.from('exercise_videos').insert(value)
      if (result.error) {
        const check = await supabase.from('exercise_videos').select('id').eq('id', id).maybeSingle()
        if (check.error) throw new Error('Could not confirm the upload. Reopen this exercise before trying again.')
        if (!check.data) {
          await supabase.storage.from(VIDEO_BUCKET).remove([path])
          throw result.error
        }
      }
      setFile(null); setQuestion('')
      const data = await load(); setClips(data.rows); setReviews(data.reviews)
    } catch (e) { setError((e as Error).message || 'Could not upload this clip. Please check your connection.') }
    finally { setBusy(false) }
  }

  return <Sheet open onClose={() => { if (!busy && !saving) onClose() }} title={'Technique feedback: ' + exercise.exercise_name}>
    <div className="stack">
      <p className="mute small">Only this client and their coach can view these recordings. Clips stay attached to this workout and exercise.</p>
      {loading ? <p role="status">Loading technique feedback...</p> : selected ? <>
        <button className="link" disabled={saving} onClick={() => setSelected(null)}>Back to exercise clips</button>
        <h3>{selected.exercise_name}</h3>
        {selected.question && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{selected.question}</p>}
        <PrivateFeedbackMedia bucket={VIDEO_BUCKET} path={selected.video_path} />
        <VoiceFeedback key={selected.id} videoId={selected.id} clientId={clientId} initial={reviews[selected.id]}
          onSavingChange={setSaving} onSaved={review => setReviews(all => ({ ...all, [review.video_id]: review }))} />
      </> : <>
        {!coach && <form className="col" onSubmit={submit}>
          <label className="field">Technique video<input type="file" accept="video/mp4,video/webm,video/quicktime,.mov" disabled={busy} onChange={e => { choose(e.target.files?.[0]); e.target.value = '' }} /></label>
          <p className="mute small">{file ? file.name : 'Choose a short MP4, MOV or WebM clip, up to 20 MB.'}</p>
          <label className="field">What would you like feedback on? (optional)<textarea rows={2} maxLength={1000} value={question} disabled={busy} onChange={e => setQuestion(e.target.value)} /></label>
          <button disabled={busy || !file}>{busy ? 'Uploading clip...' : 'Send technique video'}</button>
        </form>}
        {!clips.length && !error && <p>No clips shared for this exercise yet.</p>}
        {clips.map(clip => <article key={clip.id} className="card tight" aria-label="Technique clip">
          <span className={'badge ' + (reviews[clip.id] ? 'green' : 'amber')}>{reviews[clip.id] ? 'Coach feedback available' : 'Awaiting technique review'}</span>
          <p className="mute small">{clip.exercise_name}. Shared {niceDate(clip.created_at.slice(0, 10))}</p>
          {clip.question && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{clip.question}</p>}
          <PrivateFeedbackMedia bucket={VIDEO_BUCKET} path={clip.video_path} />
          {reviews[clip.id] && <div>
            {reviews[clip.id].feedback && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{reviews[clip.id].feedback}</p>}
            {reviews[clip.id].audio_path && <PrivateFeedbackMedia bucket={VOICE_BUCKET} path={reviews[clip.id].audio_path!} audio />}
          </div>}
          {coach && <button className="soft" onClick={() => setSelected(clip)}>{reviews[clip.id] ? 'Edit technique feedback' : 'Review technique clip'}</button>}
        </article>)}
      </>}
      {error && <><p className="err" role="alert">{error}</p>{!busy && <button className="soft" onClick={() => setRetry(n => n + 1)}>Reload exercise feedback</button>}</>}
    </div>
  </Sheet>
}

export function TechniqueReviewQueue({ clients, onCount }: { clients: { id: string; full_name: string }[]; onCount?: (count: number, ids?: string[]) => void }) {
  const [pending, setPending] = useState<Pick<Submission, 'id' | 'client_id' | 'client_workout_id' | 'exercise_name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true); setError(false)
      try {
        const c = await supabase.from('exercise_videos').select('id,client_id,client_workout_id,exercise_name').order('created_at', { ascending: false }).limit(100)
        if (c.error) throw c.error
        const rows = c.data ?? []
        const [r, a] = await Promise.all([
          rows.length ? supabase.from('exercise_video_reviews').select('video_id').in('video_id', rows.map(x => x.id)) : Promise.resolve({ data: [], error: null }),
          supabase.from('client_archives').select('client_id'),
        ])
        if (r.error || a.error) throw r.error || a.error
        const reviewed = new Set((r.data ?? []).map(x => x.video_id))
        const archived = new Set((a.data ?? []).map(x => x.client_id))
        if (active) { const next = rows.filter(x => !reviewed.has(x.id) && !archived.has(x.client_id)); setPending(next); onCount?.(next.length, next.map(x => x.id)) }
      } catch { if (active) { setError(true); onCount?.(-1) } }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [retry])
  return <section className="card tight" aria-label="Technique reviews">
    <h2>Technique reviews</h2>
    {loading ? <p role="status">Loading technique reviews...</p> : error ? <>
      <p className="err" role="alert">Could not load technique reviews.</p><button className="soft" onClick={() => setRetry(n => n + 1)}>Retry technique reviews</button>
    </> : <>
      <p className="mute small">{pending.length ? pending.length + ' awaiting your feedback' : 'No pending reviews among the latest 100 clips.'}</p>
      <div className="list">{pending.map(clip => <Link className="item" key={clip.id} to={'/workout/' + clip.client_workout_id + '?feedback=' + clip.id}>
        <span className="grow"><b>{clients.find(c => c.id === clip.client_id)?.full_name ?? 'Client'}</b><br /><span className="meta">{clip.exercise_name}</span></span>
        <span className="badge amber">Review</span>
      </Link>)}</div>
    </>}
  </section>
}
