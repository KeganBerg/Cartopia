import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { TRACKS, type KartRules } from '../game/kart'
import './flash.css'
import './confirm.css'

// Custom kart race: pick the circuit and its direction, then mix the rules (obstacles,
// Bumper Blast's hard bumps, max boost). Every mix pays the party prize.

export type CustomPick = { track: number; reverse: boolean; rules: KartRules }

const RULES: { id: keyof KartRules; icon: string; label: string }[] = [
  { id: 'obstacles', icon: '📦', label: 'Obstacles' },
  { id: 'blast', icon: '💥', label: 'Bumper' },
  { id: 'maxBoost', icon: '🔥', label: 'Max boost' },
]

export function CustomKart({ onGo, onClose }: { onGo: (p: CustomPick) => void; onClose: () => void }) {
  const [track, setTrack] = useState(0)
  const [reverse, setReverse] = useState(false)
  const [rules, setRules] = useState<KartRules>({ obstacles: true })
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [onClose])
  return createPortal(
    <div className="flash-warn ck-modal" role="dialog" aria-modal="true" aria-labelledby="ck-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fw-card">
        <div className="fw-head"><span className="fw-bolt" aria-hidden>🛠️</span><h2 id="ck-title">Custom race</h2></div>
        <div className="ck-tracks" role="radiogroup" aria-label="Circuit">
          {TRACKS.map((t, i) => (
            <button key={t.id} role="radio" aria-checked={track === i} className={track === i ? 'sel' : ''} onClick={() => setTrack(i)}>
              <span aria-hidden>{t.icon}</span><b>{t.short}</b>
            </button>
          ))}
        </div>
        <div className="seg ck-dir" role="radiogroup" aria-label="Direction">
          <button role="radio" aria-checked={!reverse} className={!reverse ? 'sel' : ''} onClick={() => setReverse(false)}>↻ Normal</button>
          <button role="radio" aria-checked={reverse} className={reverse ? 'sel' : ''} onClick={() => setReverse(true)}>↺ Reversed</button>
        </div>
        <div className="ck-rules">
          {RULES.map((r) => (
            <button key={r.id} aria-pressed={!!rules[r.id]} className={rules[r.id] ? 'on' : ''} onClick={() => setRules((o) => ({ ...o, [r.id]: !o[r.id] }))}>
              <span aria-hidden>{r.icon}</span><b>{r.label}</b><i aria-hidden>{rules[r.id] ? '✓' : ''}</i>
            </button>
          ))}
        </div>
        <div className="cf-actions">
          <button className="cf-no" onClick={onClose}>Back</button>
          <button className="cf-yes ck-go" onClick={() => onGo({ track, reverse, rules })}>🏁 Race</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
