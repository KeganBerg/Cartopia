import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { setPrefs, usePrefs } from '../lib/prefs'
import './flash.css'
import './confirm.css'

// "Are you sure?" before a step that can't be undone (leaving Rusty's with a
// haul, selling a car). "Don't ask again" turns it off; Settings turns it back on.
export type AskPref = 'askLeave' | 'askSell'

// ask(run) runs at once when the player turned the question off, else opens it.
export function useAsk(pref: AskPref) {
  const on = usePrefs((p) => p[pref])
  const [pending, setPending] = useState<(() => void) | null>(null)
  const ask = (run: () => void) => (on ? setPending(() => run) : run())
  const close = () => setPending(null)
  const yes = () => {
    setPending(null)
    pending?.()
  }
  return { ask, open: pending !== null, yes, close }
}

type Props = {
  pref: AskPref
  icon: string
  title: string
  ok: string
  onOk: () => void
  onCancel: () => void
  children?: React.ReactNode
}

export function Confirm({ pref, icon, title, ok, onOk, onCancel, children }: Props) {
  const [stop, setStop] = useState(false)
  const cancel = useRef(onCancel)
  useEffect(() => {
    cancel.current = onCancel
  }, [onCancel])
  // A real modal, like the flashing warning: the game underneath can't be tapped.
  useEffect(() => {
    const root = document.getElementById('root')
    if (root) root.inert = true
    const key = (e: KeyboardEvent) => e.key === 'Escape' && cancel.current()
    addEventListener('keydown', key)
    return () => {
      if (root) root.inert = false
      removeEventListener('keydown', key)
    }
  }, [])
  const yes = () => {
    if (stop) setPrefs({ [pref]: false })
    onOk()
  }
  return createPortal(
    <div className="flash-warn cf-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="fw-card cf-card">
        <div className="fw-head"><span className="fw-bolt" aria-hidden>{icon}</span><h2 id="confirm-title">{title}</h2></div>
        {children && <div className="cf-body">{children}</div>}
        <label className="fw-hide">
          <input type="checkbox" checked={stop} onChange={(e) => setStop(e.target.checked)} />
          <span>Don't ask again</span>
        </label>
        <div className="cf-actions">
          <button className="cf-no" onClick={onCancel} autoFocus>Cancel</button>
          <button className="cf-yes" onClick={yes}>{ok}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
