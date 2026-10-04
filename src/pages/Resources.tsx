import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import type { Resource } from '../types'
import { Empty, PageHead, Sheet, Skeleton } from '../components/ui'
import Icon from '../components/Icon'

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
      {list.length > 0 && <div className="card tight"><div className="list">
        {list.map(r => (
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
          <input placeholder="Link, e.g. https://youtube.com/..." value={f.url} onChange={e => setF({ ...f, url: e.target.value })} required />
          <input placeholder="Category (Nutrition, Technique...)" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} />
          <input placeholder="Short description" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <button>Save</button>
          {err && <span className="err">{err}</span>}
        </form>
      </Sheet>
    </>
  )
}
