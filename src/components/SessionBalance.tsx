import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Sheet } from './ui'

interface BalanceRow {
  client_id: string
  sessions_purchased: number
  completed_baseline: number
}

export default function SessionBalance({ clientId, coach = false }: { clientId: string; coach?: boolean }) {
  const [row, setRow] = useState<BalanceRow | null>(null)
  const [completed, setCompleted] = useState(0)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [balance, workouts] = await Promise.all([
      supabase.from('client_session_credits').select('client_id,sessions_purchased,completed_baseline').eq('client_id', clientId).maybeSingle(),
      supabase.from('client_workouts').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'done'),
    ])
    setRow((balance.data as BalanceRow | null) ?? null)
    setCompleted(workouts.count ?? 0)
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  const purchased = row?.sessions_purchased ?? 0
  const used = row ? Math.max(0, completed - row.completed_baseline) : 0
  const remaining = Math.max(0, purchased - used)

  async function addSessions(e: React.FormEvent) {
    e.preventDefault()
    const add = Number(quantity)
    if (!Number.isInteger(add) || add < 1 || add > 100) return setMessage('Enter between 1 and 100 sessions.')
    setSaving(true); setMessage('')
    const { error } = row
      ? await supabase.from('client_session_credits').update({ sessions_purchased: purchased + add, updated_at: new Date().toISOString() }).eq('client_id', clientId)
      : await supabase.from('client_session_credits').insert({ client_id: clientId, sessions_purchased: add, completed_baseline: completed })
    setSaving(false)
    if (error) return setMessage('Could not add sessions. Please try again.')
    setQuantity(''); setMessage(`${add} session${add === 1 ? '' : 's'} added.`)
    await load()
  }

  return <>
    <div className="tile">
      <div className="label">Sessions left</div>
      <div className="value">{loading ? '-' : remaining}</div>
      <div className="foot">{loading ? 'Loading balance' : `${used} completed · ${purchased} purchased`}</div>
      {coach && <button type="button" className="link red sm" onClick={() => { setMessage(''); setOpen(true) }}>Add sessions</button>}
    </div>
    {coach && <Sheet open={open} onClose={() => setOpen(false)} title="Add paid sessions">
      <form className="stack" onSubmit={addSessions}>
        <p className="mute" style={{ margin: 0 }}>Add sessions the client has paid for. A session is used only when its workout is marked complete.</p>
        <div className="grid g3">
          <div className="tile"><div className="label">Purchased</div><div className="value">{purchased}</div></div>
          <div className="tile"><div className="label">Completed</div><div className="value">{used}</div></div>
          <div className="tile"><div className="label">Left</div><div className="value">{remaining}</div></div>
        </div>
        <label className="field">Sessions to add<input aria-label="Sessions to add" type="number" min="1" max="100" step="1" required value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
        {message && <p className={message.includes('added') ? 'ok small' : 'health-alert small'} style={{ margin: 0 }}>{message}</p>}
        <button disabled={saving}>{saving ? 'Adding.' : 'Add sessions'}</button>
      </form>
    </Sheet>}
  </>
}

