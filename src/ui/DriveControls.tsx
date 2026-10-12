import { useEffect, useRef, useState, type ReactNode } from 'react'
import './drive.css'

// Shared driving controls for every game where the player steers a car: keyboard
// (WASD or arrows, Space to drift, Shift or E for an item) and touch, with one layout
// for a phone held upright and one for a phone on its side.
//
// The screen owns a DriveInput object and hands it to its scene; these controls only
// write into it, so the scene reads it every frame without React re-rendering.
// steer: +1 full left, -1 full right. gas/brake: 0..1. drift/item: held.

export type DriveInput = { steer: number; gas: number; brake: number; drift: boolean; item: boolean }
export const newDriveInput = (): DriveInput => ({ steer: 0, gas: 0, brake: 0, drift: false, item: false })

// Phones and tablets get the touch layout; a PC gets key hints. ?touch=1 forces touch.
export function useTouchDevice() {
  const [touch] = useState(() => {
    if (typeof window === 'undefined') return false
    if (new URLSearchParams(location.search).get('touch') === '1') return true
    return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window
  })
  return touch
}

// Upright (portrait) or on its side (landscape), following the screen as it turns.
export function useTall() {
  const get = () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  const [tall, setTall] = useState(get)
  useEffect(() => {
    const on = () => setTall(get())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return tall
}

const KEYS: Record<string, 'left' | 'right' | 'gas' | 'brake' | 'drift' | 'item'> = {
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'gas', w: 'gas', W: 'gas', ArrowDown: 'brake', s: 'brake', S: 'brake',
  ' ': 'drift', Shift: 'drift', e: 'item', E: 'item', Enter: 'item', q: 'item', Q: 'item',
}

// Keyboard: held keys write the input. `autoGas` keeps the throttle down unless braking.
export function useDriveKeys(input: DriveInput, { enabled = true, autoGas = false }: { enabled?: boolean; autoGas?: boolean } = {}) {
  useEffect(() => {
    if (!enabled) return
    const held = new Set<string>()
    const apply = () => {
      const has = (k: string) => [...held].some((h) => KEYS[h] === k)
      input.steer = (has('left') ? 1 : 0) - (has('right') ? 1 : 0)
      input.brake = has('brake') ? 1 : 0
      input.gas = has('gas') || (autoGas && !has('brake')) ? 1 : 0
      input.drift = has('drift')
      input.item = has('item')
    }
    const down = (e: KeyboardEvent) => {
      if (!KEYS[e.key] || (e.target as HTMLElement)?.tagName === 'INPUT') return
      held.add(e.key)
      apply()
      e.preventDefault()
    }
    const up = (e: KeyboardEvent) => {
      // Shift changes the case of letters, so drop both cases on release.
      held.delete(e.key)
      held.delete(e.key.toLowerCase())
      held.delete(e.key.toUpperCase())
      apply()
    }
    const blur = () => { held.clear(); apply() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [input, enabled, autoGas])
}

// Hold-to-press handlers for a touch button, with the pointer captured so a thumb
// sliding off the edge doesn't drop it.
function hold(on: () => void, off: () => void) {
  return {
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); on() },
    onPointerUp: off,
    onPointerCancel: off,
    onLostPointerCapture: off,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}

const RANGE = 56 // px of thumb travel for full lock

// A floating thumb stick that only steers: put a thumb down anywhere in the zone and
// slide it left or right. In portrait (`autoDrift`) a hard slide starts a drift, which
// holds until the thumb comes back near the middle.
function SteerZone({ input, autoDrift, className }: { input: DriveInput; autoDrift: boolean; className: string }) {
  const [knob, setKnob] = useState<{ x0: number; y: number; dx: number } | null>(null)
  const drift = useRef(0)
  const end = () => {
    input.steer = 0
    if (autoDrift) { input.drift = false; drift.current = 0 }
    setKnob(null)
  }
  return (
    <div className={`dc-steer ${className}`}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setKnob({ x0: e.clientX - r.left, y: e.clientY - r.top, dx: 0 })
      }}
      onPointerMove={(e) => {
        if (!knob) return
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const dx = Math.max(-RANGE, Math.min(RANGE, e.clientX - r.left - knob.x0))
        input.steer = -dx / RANGE
        if (autoDrift) {
          const s = input.steer
          if (drift.current === 0 && Math.abs(s) > 0.85) drift.current = Math.sign(s)
          else if (drift.current !== 0 && (Math.abs(s) < 0.2 || Math.sign(s) === -drift.current && Math.abs(s) > 0.6)) drift.current = 0
          input.drift = drift.current !== 0
        }
        setKnob({ ...knob, dx })
      }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}>
      {knob ? (
        <span className="dc-stick" style={{ left: knob.x0, top: knob.y }}>
          <i className="dc-track" />
          <b className={`dc-knob${input.drift ? ' drift' : ''}`} style={{ transform: `translateX(${knob.dx}px)` }} />
        </span>
      ) : (
        <span className="dc-hint">◀ slide to steer ▶</span>
      )}
    </div>
  )
}

// The touch layout. Gas is automatic (hold brake to slow or reverse).
// item: what to show on the item button (null = empty; leave out for games without items).
// drift: show drift (landscape button; portrait drifts on a hard slide).
export function TouchDrive({ input, tall, drift = true, item, autoGas = true }: { input: DriveInput; tall: boolean; drift?: boolean; item?: ReactNode | null; autoGas?: boolean }) {
  const [brake, setBrake] = useState(false)
  const [drifting, setDrifting] = useState(false)
  const [using, setUsing] = useState(false)
  useEffect(() => {
    input.gas = autoGas && !brake ? 1 : 0
    input.brake = brake ? 1 : 0
  }, [input, brake, autoGas])
  useEffect(() => () => { Object.assign(input, newDriveInput()) }, [input])
  const itemBtn = item !== undefined && (
    <button className={`dc-btn dc-item${item ? ' full' : ''}${using ? ' on' : ''}`} aria-label="Use item"
      {...hold(() => { input.item = true; setUsing(true) }, () => { input.item = false; setUsing(false) })}>
      {item ?? <small>ITEM</small>}
    </button>
  )
  const brakeBtn = (
    <button className={`dc-btn dc-brake${brake ? ' on' : ''}`} aria-label="Brake" {...hold(() => setBrake(true), () => setBrake(false))}>
      <small>BRAKE</small>
    </button>
  )
  if (tall) return (
    <div className="dc dc-tall">
      <div className="dc-row">{brakeBtn}{itemBtn}</div>
      <SteerZone input={input} autoDrift={drift} className="tall" />
    </div>
  )
  return (
    <div className="dc dc-wide">
      <SteerZone input={input} autoDrift={false} className="wide" />
      <div className="dc-cluster">
        {itemBtn}
        {drift && (
          <button className={`dc-btn dc-drift${drifting ? ' on' : ''}`} aria-label="Drift"
            {...hold(() => { input.drift = true; setDrifting(true) }, () => { input.drift = false; setDrifting(false) })}>
            DRIFT
          </button>
        )}
        {brakeBtn}
      </div>
    </div>
  )
}

// A short line of key hints for a PC.
export function KeyHints({ drift = true, item = true }: { drift?: boolean; item?: boolean }) {
  return (
    <div className="dc-keys" aria-hidden>
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows</span>
      {drift && <span><kbd>Space</kbd> drift</span>}
      {item && <span><kbd>E</kbd> item</span>}
    </div>
  )
}
