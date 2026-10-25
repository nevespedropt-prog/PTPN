import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { feedbackMedia, VOICE_BUCKET } from '../lib/feedbackMedia'

export interface VideoReview { video_id: string; feedback: string; audio_path: string | null }

export function PrivateFeedbackMedia({ bucket, path, audio = false }: { bucket: string; path: string; audio?: boolean }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function open() {
    setBusy(true); setError('')
    try {
      const { data, error: err } = await supabase.storage.from(bucket).createSignedUrl(path, 900)
      if (err || !data?.signedUrl) throw err
      setUrl(data.signedUrl)
    } catch { setError('Could not load this recording. Please try again when connected.') }
    finally { setBusy(false) }
  }
  return <div className="stack">
    {url ? audio
      ? <audio aria-label="Coach voice feedback" src={url} controls preload="metadata" style={{ width: '100%' }} onError={() => setError('Playback failed. Try reloading the recording or using another supported browser.')} />
      : <video aria-label="Technique recording" src={url} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 420, borderRadius: 12, background: '#000' }} onError={() => setError('Playback failed. Try reloading the recording or using another supported browser.')} />
      : <button className="soft" disabled={busy} onClick={open}>{busy ? 'Loading...' : audio ? 'Load voice feedback' : 'Load technique video'}</button>}
    {error && <><p className="err" role="alert">{error}</p><button className="soft" onClick={open} disabled={busy}>Reload recording</button></>}
  </div>
}

export default function VoiceFeedback({ videoId, clientId, initial, onSaved, onSavingChange }: {
  videoId: string; clientId: string; initial?: VideoReview; onSaved: (review: VideoReview) => void; onSavingChange: (saving: boolean) => void
}) {
  const [text, setText] = useState(initial?.feedback ?? '')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preview, setPreview] = useState('')
  const [recording, setRecording] = useState(false)
  const [starting, setStarting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [audioPath, setAudioPath] = useState(initial?.audio_path ?? null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const live = useRef(true)

  useEffect(() => { onSavingChange(busy); return () => onSavingChange(false) }, [busy, onSavingChange])
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      if (timer.current) clearTimeout(timer.current)
      if (recorder.current?.state === 'recording') recorder.current.stop()
      stream.current?.getTracks().forEach(t => t.stop())
    }
  }, [])
  useEffect(() => {
    if (!blob) { setPreview(''); return }
    const url = URL.createObjectURL(blob); setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])

  function choose(file: Blob) {
    setError(''); setSaved(false)
    try { feedbackMedia(file, 'audio'); setBlob(file) }
    catch (e) { setError((e as Error).message) }
  }
  function stop() {
    if (timer.current) clearTimeout(timer.current)
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }
  async function record() {
    setError(''); setSaved(false); setStarting(true)
    try {
      if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) throw new Error('Recording is unavailable in this browser. Upload an audio file instead.')
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!live.current) { media.getTracks().forEach(t => t.stop()); return }
      stream.current = media
      const mime = ['audio/mp4', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t))
      if (!mime) throw new Error('This browser cannot record a supported format. Upload an audio file instead.')
      const rec = new MediaRecorder(media, { mimeType: mime })
      recorder.current = rec
      const parts: Blob[] = []
      rec.ondataavailable = e => { if (e.data.size) parts.push(e.data) }
      rec.onstop = () => {
        media.getTracks().forEach(t => t.stop())
        if (!live.current) return
        setRecording(false)
        choose(new Blob(parts, { type: rec.mimeType }))
      }
      rec.onerror = () => {
        media.getTracks().forEach(t => t.stop())
        if (live.current) { setRecording(false); setError('Recording failed. Try again or upload an audio file.') }
      }
      rec.start(); setRecording(true); setBlob(null)
      timer.current = setTimeout(stop, 60000)
    } catch (e) {
      stream.current?.getTracks().forEach(t => t.stop())
      if (live.current) setError((e as Error).name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in your browser or upload an audio file.' : (e as Error).message)
    } finally { if (live.current) setStarting(false) }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setSaved(false)
    let uploaded: string | null = null
    try {
      let nextPath = audioPath
      if (blob) {
        const kind = feedbackMedia(blob, 'audio')
        const path = clientId + '/' + videoId + '/' + crypto.randomUUID() + '.' + kind.extension
        const upload = await supabase.storage.from(VOICE_BUCKET).upload(path, new Blob([blob], { type: kind.contentType }), { contentType: kind.contentType, upsert: false })
        if (upload.error) throw upload.error
        uploaded = path; nextPath = path
      }
      const value = { video_id: videoId, feedback: text.trim(), audio_path: nextPath }
      const result = await supabase.from('exercise_video_reviews').upsert(value, { onConflict: 'video_id' })
      if (result.error) {
        // A dropped response can still mean the write succeeded. Verify before cleanup.
        const check = await supabase.from('exercise_video_reviews').select('*').eq('video_id', videoId).maybeSingle()
        if (check.error) throw new Error('Could not confirm the save. Reopen this review before trying again.')
        if (check.data?.audio_path !== value.audio_path || check.data?.feedback !== value.feedback) {
          if (uploaded) await supabase.storage.from(VOICE_BUCKET).remove([uploaded])
          throw result.error
        }
      }
      if (audioPath && uploaded && audioPath !== uploaded) await supabase.storage.from(VOICE_BUCKET).remove([audioPath])
      setAudioPath(nextPath); setBlob(null); setSaved(true); onSaved(value)
    } catch (e) { setError((e as Error).message || 'Could not save feedback. Your draft is still here.') }
    finally { setBusy(false) }
  }
  return <form className="col" onSubmit={save}>
    <label className="field">Written feedback<textarea rows={4} maxLength={4000} value={text} disabled={busy} onChange={e => { setText(e.target.value); setSaved(false) }} /></label>
    <p className="mute small">Add written feedback, a voice note, or both. Voice recordings stop after one minute. Audio uploads can be up to 5 MB.</p>
    {audioPath && !blob && <PrivateFeedbackMedia key={audioPath} bucket={VOICE_BUCKET} path={audioPath} audio />}
    <div className="row" style={{ flexWrap: 'wrap' }}>
      {recording ? <button type="button" className="soft" onClick={stop}>Stop recording</button>
        : <button type="button" className="soft" disabled={busy || starting} onClick={record}>{starting ? 'Opening microphone...' : 'Record voice note'}</button>}
      {recording && <span role="status">Recording, up to 60 seconds...</span>}
    </div>
    <label className="field">Upload voice note instead<input type="file" accept="audio/*" disabled={busy || recording || starting} onChange={e => {
      const f = e.target.files?.[0]; if (f) choose(f); e.target.value = ''
    }} /></label>
    {preview && <div className="stack"><audio src={preview} controls style={{ width: '100%' }} aria-label="Voice note preview" />
      <button type="button" className="link" disabled={busy} onClick={() => setBlob(null)}>Discard new voice note</button>
      {audioPath && <p className="mute small">Saving will replace the previous voice note.</p>}
    </div>}
    {error && <p className="err" role="alert">{error}</p>}
    <button disabled={busy || starting || recording || (!text.trim() && !blob && !audioPath)}>{busy ? 'Saving feedback...' : 'Save technique feedback'}</button>
    {saved && <p className="ok" role="status">Feedback saved and visible to your client.</p>}
  </form>
}