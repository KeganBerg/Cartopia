import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { flashWarningSeen, markFlashWarningSeen, setCalmFlashing, useCalmFlashing } from '../game/flashing'
import { onTechnoChange, technoOn, technoToDrop } from '../game/techno'
import { today, useGame } from '../game/store'
import './flash.css'

// The photosensitivity warning: once on first launch (over the loading
// screen), again from the menu, and a short heads-up as Rave Mode builds up.

let open = !flashWarningSeen()
const listeners = new Set<() => void>()
const setOpen = (v: boolean) => {
  open = v
  listeners.forEach((l) => l())
}
const onOpen = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const showFlashWarning = () => setOpen(true)

// The daily bonus waits behind the first-launch warning, so the two never stack.
export function openDaily() {
  const s = useGame.getState()
  if (s.lastDaily !== today() && !s.panel) s.openPanel('daily')
}

// The on/off switch, shared by the warning, the Rave heads-up and the menu.
export function CalmSwitch() {
  const on = useCalmFlashing()
  return (
    <button role="switch" aria-checked={on} aria-label="Reduce flashing" className={`calm-switch${on ? ' on' : ''}`} onClick={() => setCalmFlashing(!on)}>
      <i />
    </button>
  )
}

export function FlashWarning() {
  const shown = useSyncExternalStore(onOpen, () => open)
  // A real modal: the game underneath can't be tapped or tabbed to while it's up.
  useEffect(() => {
    const root = document.getElementById('root')
    if (!shown || !root) return
    root.inert = true
    return () => {
      root.inert = false
    }
  }, [shown])
  if (!shown) return null
  const close = () => {
    const first = !flashWarningSeen()
    markFlashWarningSeen()
    setOpen(false)
    if (first) openDaily()
  }
  return createPortal(
    <div className="flash-warn" role="dialog" aria-modal="true" aria-labelledby="flash-warn-title">
      <div className="fw-card">
        <div className="fw-head"><span className="fw-bolt" aria-hidden>⚡</span><h2 id="flash-warn-title">Flashing lights</h2></div>
        <p>Cartopia has flashing lights, like Rave Mode and the nightclub. They may trigger seizures for people with photosensitive epilepsy.</p>
        <label className="fw-row">
          <span>Reduce flashing</span>
          <CalmSwitch />
        </label>
        <button className="buy fw-ok" onClick={close} autoFocus>Got it</button>
      </div>
    </div>,
    document.body,
  )
}

// The menu row: the switch, and a way to read the warning again.
export function FlashSetting() {
  const on = useCalmFlashing()
  return (
    <div className="menu-sound">
      <span>Reduce flashing<small> · {on ? 'on' : 'off'}</small></span>
      <button className="fw-info" aria-label="Photosensitivity warning" title="Photosensitivity warning" onClick={showFlashWarning}>⚡</button>
      <CalmSwitch />
    </div>
  )
}

// How long the heads-up stays as Rave Mode starts.
const HEADS_UP_MS = 9000

// A heads-up as Rave Mode starts building, with the switch right there.
export function RaveHeadsUp() {
  const on = useSyncExternalStore(onTechnoChange, () => technoOn())
  const [show, setShow] = useState(false)
  useEffect(() => {
    // Only for the build-up: someone loading in after the drop is already seeing it.
    if (!on || technoToDrop() <= 0) return setShow(false)
    setShow(true)
    const id = setTimeout(() => setShow(false), HEADS_UP_MS)
    return () => clearTimeout(id)
  }, [on])
  if (!show) return null
  return (
    <div className="rave-heads-up" role="status">
      <span className="rh-text"><b>⚡ Flashing lights ahead</b><small>Rave Mode is starting</small></span>
      <label className="rh-switch"><span>Reduce</span><CalmSwitch /></label>
      <button className="rh-close" aria-label="Dismiss" onClick={() => setShow(false)}>✕</button>
    </div>
  )
}
