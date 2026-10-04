import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/dates'
import { Chart } from '../components/Chart'
import type { Metric, MetricLog } from '../types'

function MetricCard({ metric, logs, clientId, coach, reload }: { metric: Metric; logs: MetricLog[]; clientId: string; coach: boolean; reload: () => void }) {
  const [value, setValue] = useState('')
  const [date, setDate] = useState(() => localDate())
  const [err, setErr] = useState('')
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0], last = sorted[sorted.length - 1]
  const diff = first && last && first !== last ? Number(last.value) - Number(first.value) : 0
  const improved = metric.lower_is_better ? diff < 0 : diff > 0

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('metric_logs')
      .upsert({ metric_id: metric.id, client_id: clientId, date, value: Number(value) }, { onConflict: 'metric_id,date' })
    if (error) return setErr(error.message)
    setValue(''); reload()
  }
  async function remove(id: string) { await supabase.from('metric_logs').delete().eq('id', id); reload() }
  async function archive() { await supabase.from('metrics').update({ active: false }).eq('id', metric.id); reload() }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 0 }}>
        <h2 style={{ margin: 0 }}>{metric.name}</h2>
        {coach && <button className="link" onClick={archive}>Archive</button>}
      </div>
      {last ? (
        <p style={{ margin: '6px 0 0' }}>
          <span className="big">{Number(last.value)} <small>{metric.unit}</small></span>{' '}
          {diff !== 0 && <span className={improved ? 'ok' : 'err'}>{diff > 0 ? '+' : ''}{Math.round(diff * 100) / 100} {metric.unit} since {first.date}</span>}
        </p>
      ) : <p className="mute">No results yet.</p>}
      <Chart points={sorted.map(l => ({ x: l.date, y: Number(l.value) }))} unit={metric.unit} />
      <form className="row" onSubmit={add} style={{ marginTop: 8 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ maxWidth: 170 }} />
        <input type="number" inputMode="decimal" step="any" placeholder={metric.unit || 'Result'} value={value} onChange={e => setValue(e.target.value)} required style={{ maxWidth: 120 }} />
        <button>Log</button>
        {err && <span className="err">{err}</span>}
      </form>
      {[...sorted].reverse().slice(0, 5).map(l => (
        <div key={l.id} className="lift small">
          <span className="grow mute">{l.date}</span><span>{Number(l.value)} {metric.unit}</span>
          <button className="link" onClick={() => remove(l.id)} aria-label={`Delete ${l.date} result`}>Delete</button>
        </div>
      ))}
    </div>
  )
}

export default function Metrics({ clientId, coach }: { clientId: string; coach: boolean }) {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [logs, setLogs] = useState<MetricLog[]>([])
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [lower, setLower] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [m, l] = await Promise.all([
      supabase.from('metrics').select('*').eq('client_id', clientId).eq('active', true).order('created_at'),
      supabase.from('metric_logs').select('*').eq('client_id', clientId),
    ])
    setMetrics((m.data ?? []) as Metric[]); setLogs((l.data ?? []) as MetricLog[])
  }, [clientId])
  useEffect(() => { load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('metrics').insert({ client_id: clientId, name, unit, lower_is_better: lower })
    if (error) return setErr(error.message)
    setName(''); setUnit(''); setLower(false); load()
  }

  return (
    <>
      <h1 style={{ marginTop: 20 }}>Custom metrics</h1>
      {coach && (
        <form className="card row" onSubmit={add}>
          <input placeholder="New metric, e.g. Vertical jump" value={name} onChange={e => setName(e.target.value)} required style={{ flexBasis: '100%' }} />
          <input placeholder="Unit (cm, s, reps)" value={unit} onChange={e => setUnit(e.target.value)} style={{ maxWidth: 150 }} />
          <select value={lower ? 'lower' : 'higher'} onChange={e => setLower(e.target.value === 'lower')} aria-label="Better when">
            <option value="higher">Higher is better</option>
            <option value="lower">Lower is better</option>
          </select>
          <button>Add metric</button>
          {err && <span className="err">{err}</span>}
        </form>
      )}
      {metrics.length === 0 && <p className="mute">{coach ? 'No custom metrics for this client yet. Add one above.' : 'Your coach has not set up any custom metrics yet.'}</p>}
      {metrics.map(m => <MetricCard key={m.id} metric={m} logs={logs.filter(l => l.metric_id === m.id)} clientId={clientId} coach={coach} reload={load} />)}
    </>
  )
}
