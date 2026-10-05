import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import type { Resource } from '../types'
import { Empty, PageHead, Sheet, Skeleton } from '../components/ui'
import Icon from '../components/Icon'

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

function VideoCard({ r, coach, onRemove }: { r: Resource; coach: boolean; onRemove: () => void }) {
  const src = instagramEmbed(r.url)!
  const [open, setOpen] = useState(false)
  return (
    <div className="video-card">
      <div className="video-head">
        <div className="grow">
          <span className="title">{r.title}</span> {r.category && <span className="badge">{r.category}</span>}<br />
          {r.description && <span className="meta">{r.description}</span>}
        </div>
        {coach && <button className="link" onClick={onRemove}>Remove</button>}
      </div>
      {open
        ? <iframe className="video-frame" src={src} title={r.title} loading="lazy" allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
        : <div className="video-play" role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={e => { if (e.key === 'Enter') setOpen(true) }}>
            <Icon name="play" size={28} /><span>Watch on Instagram</span>
          </div>}
      <a className="meta" href={r.url} target="_blank" rel="noopener noreferrer">Open in Instagram</a>
    </div>
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

  const load = () => supabase.from('resources').select('*').order('category').order('title').then(({ data }) => setRows((data ?? []) as Resource[]))
  useEffect(() => { load() }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const url = /^https?:\/\//i.test(f.url) ? f.url : 'https://' + f.url
    const { error } = await supabase.from('resources').insert({ ...f, url, created_by: profile!.id })
    if (error) return setErr(error.message)
    setF({ title: '', url: '', category: '', description: '' }); setAdding(false); load()
  }
  async function remove(id: string) { if (confirm('Remove this resource?')) { await supabase.from('resources').delete().eq('id', id); load() } }

  const cats = [...new Set((rows ?? []).map(r => r.category).filter(Boolean))]
  const list = (rows ?? []).filter(r => !cat || r.category === cat)
  const videos = list.filter(r => instagramEmbed(r.url))
  const links = list.filter(r => !instagramEmbed(r.url))

  return (
    <>
      <PageHead eyebrow="Learn" title="Resources" sub="Guides, videos and links from your coach">
        {coach && <button className="sm" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add</button>}
      </PageHead>
      {cats.length > 0 && <div className="chips">
        <button className={'chip' + (!cat ? ' on' : '')} onClick={() => setCat('')}>All</button>
        {cats.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}
      </div>}
      {!rows && <Skeleton n={3} />}
      {rows && list.length === 0 && <div className="card"><Empty icon="link" title="Nothing here yet">{coach ? 'Add guides, videos or articles for your clients.' : 'Your coach has not shared any resources yet.'}</Empty></div>}
      {videos.length > 0 && <div className="video-grid">
        {videos.map(r => <VideoCard key={r.id} r={r} coach={coach} onRemove={() => remove(r.id)} />)}
      </div>}
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
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a resource">
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
