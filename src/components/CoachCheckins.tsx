import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays, localDate, niceDate } from '../lib/dates'
import type { Checkin } from '../types'
import { Sheet } from './ui'
import Icon from './Icon'

const blank = { date: '', mood: '3', energy: '3', sleep_hours: '', note: '' }

/** Coach: the client's daily check-ins. Any day can be added, corrected or deleted. */
export default function CoachCheckins({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<Checkin[] | null>(null)
  const [all, setAll] = useState(false)
  const [form, setForm] = useState<{ id: string | null } | null>(null)
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    let q = supabase.from('checkins').select('*').eq('client_id', clientId).order('date', { ascending: false })
    q = all ? q.limit(400) : q.gte('date', addDays(localDate(), -29))
    const { data } = await q
    setRows((data ?? []) as Checkin[])
  }, [clientId, all])
  useEffect(() => { load() }, [load])

  function openAdd() { setForm({ id: null }); setF({ ...blank, date: localDate() }); setErr('') }
  function openEdit(c: Checkin) { setForm({ id: c.id }); setF({ date: c.date, mood: String(c.mood ?? 3), energy: String(c.energy ?? 3), sleep_hours: c.sleep_hours == null ? '' : String(Number(c.sleep_hours)), note: c.note }); setErr('') }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    const sleep = f.sleep_hours.trim() === '' ? null : Number(f.sleep_hours)
    if (sleep !== null && (!Number.isFinite(sleep) || sleep < 0 || sleep > 24)) return setErr('Sleep must be between 0 and 24 hours.')
    setBusy(true); setErr('')
    const row = { date: f.date, mood: Number(f.mood), energy: Number(f.energy), sleep_hours: sleep, note: f.note.trim() }
    // One check-in per day: adding for a day that already has one updates it.
    const res = form.id
      ? await supabase.from('checkins').update(row).eq('id', form.id).eq('client_id', clientId).select('id')
      : await supabase.from('checkins').upsert({ ...row, client_id: clientId }, { onConflict: 'client_id,date' }).select('id')
    setBusy(false)
    if (res.error || !res.data?.length) return setErr(/duplicate|unique/i.test(res.error?.message ?? '') ? 'That day already has a check-in. Edit that one instead.' : 'Could not save this check-in. Please try again.')
    setForm(null); load()
  }
  async function remove() {
    if (!form?.id || !confirm('Delete this check-in?')) return
    setBusy(true)
    const { error } = await supabase.from('checkins').delete().eq('id', form.id).eq('client_id', clientId)
    setBusy(false)
    if (error) return setErr('Could not delete this check-in. Please try again.')
    setForm(null); load()
  }

  return (
    <section aria-label="Daily check-ins">
      <div className="section-title"><h2>Daily check-ins</h2><span className="row" style={{ gap: 8, margin: 0 }}>
        <button className="link red" onClick={() => setAll(v => !v)}>{all ? 'Last 30 days' : 'Show all'}</button>
        <button className="soft sm" onClick={openAdd}><Icon name="plus" size={14} />Add check-in</button>
      </span></div>
      <div className="card tight"><div className="list">
        {rows && rows.length === 0 && <p className="mute" style={{ padding: 12, margin: 0 }}>No check-ins in this period.</p>}
        {(rows ?? []).map(c => (
          <button key={c.id} type="button" className="item" style={{ width: '100%', textAlign: 'left' }} onClick={() => openEdit(c)} aria-label={`Edit check-in on ${niceDate(c.date)}`}>
            <span className="grow"><span className="title">{niceDate(c.date)}</span><br />
              <span className="meta">Mood {c.mood ?? '-'}/5 · Energy {c.energy ?? '-'}/5 · Sleep {c.sleep_hours == null ? '-' : Number(c.sleep_hours) + ' h'}{c.note ? ` · ${c.note.slice(0, 80)}` : ''}</span></span>
            <Icon name="edit" size={16} />
          </button>
        ))}
      </div></div>
      <Sheet open={!!form} onClose={() => { if (!busy) setForm(null) }} title={form?.id ? 'Edit check-in' : 'Add check-in'}>
        {form && <form className="stack" onSubmit={save}>
          <label className="field">Date<input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} required /></label>
          <label className="field">Mood<select value={f.mood} onChange={e => setF({ ...f, mood: e.target.value })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>
          <label className="field">Energy<select value={f.energy} onChange={e => setF({ ...f, energy: e.target.value })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>
          <label className="field">Sleep (hours)<input type="number" min="0" max="24" step="0.25" inputMode="decimal" value={f.sleep_hours} onChange={e => setF({ ...f, sleep_hours: e.target.value })} /></label>
          <label className="field">Note<textarea rows={3} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} maxLength={1000} /></label>
          <button disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
          {form.id && <button type="button" className="danger" disabled={busy} onClick={remove}>Delete check-in</button>}
          {err && <span className="err" role="alert">{err}</span>}
        </form>}
      </Sheet>
    </section>
  )
}
