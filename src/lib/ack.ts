import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../auth'

// Short, stable summary of what the coach looked at. It changes when items are added, removed or edited,
// which is what makes a tick reset itself when something new arrives.
export function fingerprint(parts: string[]) {
  const text = [...parts].sort().join('|')
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
  return `${h.toString(36)}-${parts.length}`
}

export function useAcks(reload: number) {
  const { profile } = useAuth()
  const coachId = profile?.id
  const [acks, setAcks] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState<string[]>([])
  const pending = useRef(new Set<string>())

  useEffect(() => {
    if (!coachId) return
    let active = true
    setFailed(false)
    supabase.from('coach_acknowledgements').select('item_key,fingerprint').eq('coach_id', coachId).limit(1000).then(({ data, error }) => {
      if (!active) return
      if (error) { setFailed(true); setReady(true); return }
      setAcks(Object.fromEntries((data ?? []).map(r => [r.item_key as string, r.fingerprint as string])))
      setReady(true)
    })
    return () => { active = false }
  }, [coachId, reload])

  const isChecked = useCallback((key: string, fp: string) => acks[key] === fp, [acks])

  const toggle = useCallback(async (key: string, fp: string, checked: boolean) => {
    if (!coachId || pending.current.has(key)) return
    pending.current.add(key); setBusy([...pending.current]); setSaveError('')
    const before = acks[key]
    setAcks(a => { const next = { ...a }; if (checked) next[key] = fp; else delete next[key]; return next })
    const result = checked
      ? await supabase.from('coach_acknowledgements').upsert({ coach_id: coachId, item_key: key, fingerprint: fp, acknowledged_at: new Date().toISOString() }, { onConflict: 'coach_id,item_key' })
      : await supabase.from('coach_acknowledgements').delete().eq('coach_id', coachId).eq('item_key', key)
    if (result.error) {
      setAcks(a => { const next = { ...a }; if (before === undefined) delete next[key]; else next[key] = before; return next })
      setSaveError('Could not save your tick. It has been put back. Please try again when connected.')
    }
    pending.current.delete(key); setBusy([...pending.current])
  }, [coachId, acks])

  return { ready, failed, saveError, busy, isChecked, toggle }
}
