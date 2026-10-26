import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { localDate, niceDate } from '../lib/dates'
import type { ProgressPhoto } from '../types'
import { Empty, Sheet } from './ui'
import Icon from './Icon'

type Pose = ProgressPhoto['pose']
const POSES: Pose[] = ['front', 'side', 'back', 'other']

/** Downscale so uploads stay small on mobile connections. */
async function shrink(file: File, max = 1400): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not process image'))), 'image/jpeg', 0.85))
}

export default function Photos({ clientId, canUpload }: { clientId: string; canUpload: boolean }) {
  const [rows, setRows] = useState<ProgressPhoto[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [pose, setPose] = useState<Pose>('front')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const request = useRef(0)
  const writing = useRef(false)
  const [err, setErr] = useState('')
  const [compare, setCompare] = useState(false)
  const [open, setOpen] = useState<ProgressPhoto | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const version = ++request.current
    setLoading(true); setErr('')
    try {
      const result = await supabase.from('progress_photos').select('*').eq('client_id', clientId).order('date', { ascending: false }).order('created_at', { ascending: false })
      if (result.error) throw result.error
      const list = (result.data ?? []) as ProgressPhoto[]
      const signed = list.length ? await supabase.storage.from('progress-photos').createSignedUrls(list.map(p => p.path), 3600) : { data: [], error: null }
      if (signed.error) throw signed.error
      if (version !== request.current) return
      setRows(list)
      setUrls(Object.fromEntries((signed.data ?? []).filter(s => !s.error && s.path && s.signedUrl).map(s => [s.path as string, s.signedUrl as string])))
      if (signed.data?.some(s => s.error)) setErr('Some photos could not be loaded. Please retry.')
    } catch { if (version === request.current) setErr('Could not load photos. Please try again when connected.') }
    finally { if (version === request.current) setLoading(false) }
  }, [clientId])
  useEffect(() => { setRows([]); setUrls({}); load(); return () => { request.current++ } }, [load])

  async function upload(f: File) {
    if (writing.current) return
    writing.current = true; setBusy(true); setErr('')
    try {
      const blob = await shrink(f)
      const id = crypto.randomUUID(), path = `${clientId}/${id}.jpg`
      const up = await supabase.storage.from('progress-photos').upload(path, blob, { contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const saved = await supabase.from('progress_photos').insert({ id, client_id: clientId, path, pose, date: localDate() })
      if (saved.error) {
        const check = await supabase.from('progress_photos').select('id').eq('id', id).maybeSingle()
        if (check.error) throw new Error('Could not confirm the upload. Reload photos before trying again.')
        if (!check.data) {
          await supabase.storage.from('progress-photos').remove([path])
          throw new Error('Could not save your photo. Please try again when connected.')
        }
      }
      await load()
    } catch { setErr('Could not save your photo. Reload photos before trying again if your connection dropped.') }
    finally { writing.current = false; setBusy(false) }
  }
  async function remove(p: ProgressPhoto) {
    if (writing.current || !confirm('Delete this photo?')) return
    writing.current = true; setBusy(true); setErr('')
    try {
      const removed = await supabase.storage.from('progress-photos').remove([p.path])
      if (removed.error) {
        setErr('Could not delete the photo file. Your photo entry is still here. Please try again.')
        return
      }
      const result = await supabase.from('progress_photos').delete().eq('id', p.id).eq('client_id', clientId).select('id')
      if (result.error || !result.data?.length) {
        setErr('The photo file was removed, but its entry could not be deleted. Please retry Delete photo.')
        return
      }
      setRows(list => list.filter(row => row.id !== p.id)); setOpen(null)
    } catch { setErr('Could not finish deleting this photo. Please try again when connected.') }
    finally { writing.current = false; setBusy(false) }
  }

  const ofPose = rows.filter(r => r.pose === pose)
  const oldest = ofPose[ofPose.length - 1], newest = ofPose[0]

  return (
    <>
      {canUpload && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}><h2 style={{ margin: 0 }}>Add a photo</h2></div>
          <div className="chips">{POSES.map(p => <button key={p} className={'chip' + (pose === p ? ' on' : '')} onClick={() => setPose(p)} style={{ textTransform: 'capitalize' }}>{p}</button>)}</div>
          <input ref={file} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          <button className="block" onClick={() => file.current?.click()} disabled={busy}><Icon name="upload" size={18} />{busy ? 'Uploading...' : `Upload a ${pose} photo`}</button>
          <p className="mute small" style={{ marginBottom: 0 }}>Only you and your coach can see these.</p>
        </div>
      )}

      {err && !open && <div className="card tight"><p className="err" role="alert">{err}</p><button className="soft" disabled={busy || loading} onClick={load}>Reload photos</button></div>}
      {loading && <p role="status">Loading photos...</p>}
      {ofPose.length >= 2 && <button className="soft block" style={{ marginBottom: 12 }} onClick={() => setCompare(true)}>Compare first and latest {pose} photo</button>}
      {rows.length === 0 ? (!loading && !err && <div className="card"><Empty icon="camera" title="No photos yet">{canUpload ? 'Add your first photo to start your before and after.' : 'This client has not added photos.'}</Empty></div>) : (
        <div className="photo-grid">
          {rows.map(p => (
            <button key={p.id} className="photo" style={{ padding: 0, border: 0, minHeight: 0 }} onClick={() => setOpen(p)} aria-label={`${p.pose} photo from ${niceDate(p.date)}`}>
              {urls[p.path] && <img src={urls[p.path]} alt="" loading="lazy" />}
              <span className="badge tag" style={{ background: 'rgba(0,0,0,.65)' }}>{niceDate(p.date)}</span>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!open} onClose={() => { if (!busy) setOpen(null) }} title={open ? `${open.pose[0].toUpperCase() + open.pose.slice(1)} · ${niceDate(open.date)}` : ''}>
        {open && <div className="stack">
          {urls[open.path] && <img src={urls[open.path]} alt="" style={{ borderRadius: 14, width: '100%' }} />}
          {err && <p className="err" role="alert">{err}</p>}
          {(canUpload) && <button className="danger" disabled={busy} onClick={() => remove(open)}>{busy ? 'Deleting...' : 'Delete photo'}</button>}
        </div>}
      </Sheet>
      <Sheet open={compare} onClose={() => setCompare(false)} title="Before and after">
        {oldest && newest && <div className="compare">
          {[oldest, newest].map((p, i) => (
            <div key={p.id}><div className="photo">{urls[p.path] && <img src={urls[p.path]} alt="" />}</div><p className="center small" style={{ margin: '6px 0 0' }}><b>{i === 0 ? 'Before' : 'Latest'}</b><br /><span className="mute">{niceDate(p.date)}</span></p></div>
          ))}
        </div>}
      </Sheet>
    </>
  )
}
