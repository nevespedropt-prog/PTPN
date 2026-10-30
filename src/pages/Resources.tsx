import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import type { Resource } from '../types'
import { Empty, PageHead, Sheet, Skeleton } from '../components/ui'
import Icon from '../components/Icon'
import { shrink } from '../lib/image'

const THUMB_BUCKET = 'video-thumbnails'
const thumbUrl = (path: string) => supabase.storage.from(THUMB_BUCKET).getPublicUrl(path).data.publicUrl

// Instagram reel/post/tv links become an official embed; everything else stays a plain link.
export function instagramEmbed(url: string): string | null {
  try {
    const u = new URL(url)
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null
    const m = u.pathname.match(/^\/(?:[\w.]+\/)?(reel|reels|p|tv)\/([\w-]+)/i)
    if (!m) return null
    return `https://www.instagram.com/${m[1].toLowerCase() === 'reels' ? 'reel' : m[1].toLowerCase()}/${m[2]}/embed/`
  } catch { return null }
}

function VideoGrid({ videos, coach, onRemove, onRename, onThumb, onClearThumb, thumbBusy, thumbErr }: {
  videos: Resource[]; coach: boolean; onRemove: (id: string) => void; onRename: (r: Resource) => void
  onThumb: (r: Resource, file: File) => void; onClearThumb: (r: Resource) => void; thumbBusy: boolean; thumbErr: string
}) {
  const [at, setAt] = useState<number | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const cur = at !== null ? videos[at] : null
  return (
    <>
      <div className="video-grid">
        {videos.map((r, i) => (
          <div key={r.id} className="video-tile" role="button" tabIndex={0} onClick={() => setAt(i)} onKeyDown={e => { if (e.key === 'Enter') setAt(i) }}>
            {r.thumbnail_path && <img className="video-thumb" src={thumbUrl(r.thumbnail_path)} alt="" loading="lazy" />}
            <span className="video-num">{i + 1}</span>
            <Icon name="play" size={26} />
            <span className="video-title">{r.title}</span>
          </div>
        ))}
      </div>
      <Sheet open={!!cur} onClose={() => setAt(null)} title={cur?.title ?? ''}>
        {cur && <div className="stack">
          <iframe key={cur.id} className="video-frame" src={instagramEmbed(cur.url)!} title={cur.title} allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
          <div className="video-nav">
            <button className="ghost" disabled={at === 0} onClick={() => setAt(at! - 1)}>Previous</button>
            <span className="meta">{at! + 1} of {videos.length}</span>
            <button className="ghost" disabled={at === videos.length - 1} onClick={() => setAt(at! + 1)}>Next</button>
          </div>
          <a className="meta" href={cur.url} target="_blank" rel="noopener noreferrer">Open in Instagram</a>
          {coach && <div className="stack">
            <div className="row">
              <button className="soft sm" disabled={thumbBusy} onClick={() => picker.current?.click()}><Icon name="upload" size={16} />{thumbBusy ? 'Saving...' : cur.thumbnail_path ? 'Change thumbnail' : 'Set thumbnail'}</button>
              {cur.thumbnail_path && <button className="link" disabled={thumbBusy} onClick={() => onClearThumb(cur)}>Remove thumbnail</button>}
              <input ref={picker} type="file" accept="image/*" hidden aria-label="Thumbnail picture" onChange={e => { const f = e.target.files?.[0]; if (f) onThumb(cur, f); e.target.value = '' }} />
            </div>
            {thumbErr && <span className="err" role="alert">{thumbErr}</span>}
            <div className="row"><button className="link" onClick={() => onRename(cur)}>Rename</button><button className="link" onClick={() => { setAt(null); onRemove(cur.id) }}>Remove</button></div>
          </div>}
        </div>}
      </Sheet>
    </>
  )
}

export default function Resources() {
  const { profile } = useAuth()
  const coach = profile?.role === 'coach'
  const [rows, setRows] = useState<Resource[] | null>(null)
  const [cat, setCat] = useState('')
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ title: '', url: '', category: '', description: '' })
  const [err, setErr] = useState('')
  const [thumbBusy, setThumbBusy] = useState(false)
  const [thumbErr, setThumbErr] = useState('')

  const load = () => supabase.from('resources').select('*').order('category').order('created_at').order('title').then(({ data }) => setRows((data ?? []) as Resource[]))
  useEffect(() => { load() }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const url = /^https?:\/\//i.test(f.url) ? f.url : 'https://' + f.url
    const { error } = await supabase.from('resources').insert({ ...f, url, created_by: profile!.id })
    if (error) return setErr(error.message)
    setF({ title: '', url: '', category: '', description: '' }); setAdding(false); load()
  }
  async function remove(id: string) { if (confirm('Remove this video or link?')) { await supabase.from('resources').delete().eq('id', id); load() } }

  async function rename(r: Resource) {
    const t = prompt('Video title', r.title)?.trim()
    if (t) { await supabase.from('resources').update({ title: t }).eq('id', r.id); load() }
  }

  async function setThumb(r: Resource, file: File) {
    setThumbBusy(true); setThumbErr('')
    const path = `${r.id}/${Date.now()}.jpg`
    try {
      const blob = await shrink(file, 640)
      const up = await supabase.storage.from(THUMB_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const saved = await supabase.from('resources').update({ thumbnail_path: path }).eq('id', r.id)
      if (saved.error) { await supabase.storage.from(THUMB_BUCKET).remove([path]); throw saved.error }
      if (r.thumbnail_path) await supabase.storage.from(THUMB_BUCKET).remove([r.thumbnail_path])
      await load()
    } catch (e) { setThumbErr((e as Error).message || 'Could not save the thumbnail. Please try again.') }
    finally { setThumbBusy(false) }
  }
  async function clearThumb(r: Resource) {
    if (!r.thumbnail_path) return
    setThumbBusy(true); setThumbErr('')
    const saved = await supabase.from('resources').update({ thumbnail_path: null }).eq('id', r.id)
    if (saved.error) setThumbErr(saved.error.message)
    else { await supabase.storage.from(THUMB_BUCKET).remove([r.thumbnail_path]); await load() }
    setThumbBusy(false)
  }

  const cats = [...new Set((rows ?? []).map(r => r.category).filter(Boolean))]
  const list = (rows ?? []).filter(r => !cat || r.category === cat)
  const videos = list.filter(r => instagramEmbed(r.url))
  const links = list.filter(r => !instagramEmbed(r.url))

  return (
    <>
      <PageHead eyebrow="Learn" title="Workout videos" sub="Videos and links from your coach to try">
        {coach && <button className="sm" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add</button>}
      </PageHead>
      {cats.length > 0 && <div className="chips">
        <button className={'chip' + (!cat ? ' on' : '')} onClick={() => setCat('')}>All</button>
        {cats.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}
      </div>}
      {!rows && <Skeleton n={3} />}
      {rows && list.length === 0 && <div className="card"><Empty icon="link" title="Nothing here yet">{coach ? 'Add Instagram videos or links for your clients.' : 'Your coach has not shared any videos yet.'}</Empty></div>}
      {videos.length > 0 && <VideoGrid videos={videos} coach={coach} onRemove={remove} onRename={rename} onThumb={setThumb} onClearThumb={clearThumb} thumbBusy={thumbBusy} thumbErr={thumbErr} />}
      {links.length > 0 && <div className="card tight"><div className="list">
        {links.map(r => (
          <div key={r.id} className="item">
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="grow" style={{ color: 'var(--ink)' }}>
              <span className="title">{r.title}</span> {r.category && <span className="badge">{r.category}</span>}<br />
              <span className="meta">{r.description || new URL(r.url).hostname}</span>
            </a>
            <Icon name="link" size={16} />
            {coach && <button className="link" onClick={() => remove(r.id)}>Remove</button>}
          </div>
        ))}
      </div></div>}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a video or link">
        <form className="stack" onSubmit={add}>
          <input placeholder="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} required />
          <input placeholder="Link, e.g. an Instagram reel or any web page" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} required />
          <input placeholder="Category (Nutrition, Technique...)" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} />
          <input placeholder="Short description" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <button>Save</button>
          {err && <span className="err">{err}</span>}
        </form>
      </Sheet>
    </>
  )
}
