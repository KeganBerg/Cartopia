import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

// How thumb travel turns into steering. range: px from where the thumb landed to full lock;
// dead: px that still count as straight; curve > 1 is finer near the middle.
// drift (portrait only): 'slide' drifts on any hard slide, 'flick' only on a quick flick out.
export type SteerFeel = { range: number; dead: number; curve: number; drift: 'slide' | 'flick' }
export const ARCADE_FEEL: SteerFeel = { range: 56, dead: 0, curve: 1, drift: 'slide' }
export const KART_FEEL: SteerFeel = { range: 84, dead: 6, curve: 1.5, drift: 'flick' }

// steer: +1 full left, -1 full right (dx > 0 is the thumb to the right).
export function thumbSteer(dx: number, f: SteerFeel) {
  const a = Math.abs(dx)
  if (a <= f.dead) return 0
  return -Math.sign(dx) * Math.min(1, (a - f.dead) / (f.range - f.dead)) ** f.curve
}

// Portrait drifting from the steering thumb alone. 'flick': out past FLICK_OUT within FLICK_MS
// of being near the middle, so steering wide through a bend never drifts by accident.
// 'slide': any slide past 0.85. Either way the drift holds while the thumb stays out that way
// and ends as it comes back towards the middle or crosses over.
const FLICK_MS = 170, FLICK_OUT = 0.85, FLICK_FROM = 0.35
export class ThumbDrift {
  dir = 0
  private calm = -1e9
  private mode: SteerFeel['drift']
  constructor(mode: SteerFeel['drift']) { this.mode = mode }
  update(steer: number, now: number) {
    const a = Math.abs(steer)
    if (this.dir === 0) {
      if (a < FLICK_FROM) this.calm = now
      if (a > FLICK_OUT && (this.mode === 'slide' || now - this.calm <= FLICK_MS)) this.dir = Math.sign(steer)
    } else if (a < 0.2 || (Math.sign(steer) === -this.dir && a > 0.5)) {
      this.dir = 0
      this.calm = now
    }
    return this.dir
  }
  reset(now = -1e9) { this.dir = 0; this.calm = now }
}

const buzz = (ms: number) => { try { navigator.vibrate?.(ms) } catch { /* not on this phone */ } }

// A floating thumb stick that only steers: put a thumb down anywhere in the zone and
// slide it left or right. The knob moves by hand (no React render per finger move).
const SteerZone = memo(function SteerZone({ input, autoDrift, className, feel }: { input: DriveInput; autoDrift: boolean; className: string; feel: SteerFeel }) {
  const [at, setAt] = useState<{ x0: number; y: number } | null>(null)
  const knob = useRef<HTMLElement>(null)
  const drift = useMemo(() => new ThumbDrift(feel.drift), [feel.drift])
  const end = () => {
    input.steer = 0
    if (autoDrift) { input.drift = false; drift.reset() }
    setAt(null)
  }
  return (
    <div className={`dc-steer ${className}`}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        if (autoDrift) drift.reset(e.timeStamp)
        setAt({ x0: e.clientX - r.left, y: e.clientY - r.top })
      }}
      onPointerMove={(e) => {
        if (!at) return
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const dx = Math.max(-feel.range, Math.min(feel.range, e.clientX - r.left - at.x0))
        input.steer = thumbSteer(dx, feel)
        if (autoDrift) {
          const was = drift.dir
          input.drift = drift.update(input.steer, e.timeStamp) !== 0
          if (input.drift && !was) buzz(12)
        }
        const k = knob.current
        if (k) {
          k.style.transform = `translateX(${dx}px)`
          k.classList.toggle('drift', input.drift)
        }
      }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}>
      {at ? (
        <span className="dc-stick" style={{ left: at.x0, top: at.y }}>
          <i className="dc-track" style={{ left: -feel.range - 20, width: (feel.range + 20) * 2 }} />
          <b ref={knob} className="dc-knob" />
        </span>
      ) : (
        <span className="dc-hint">{autoDrift && feel.drift === 'flick' ? '◀ slide to steer · flick to drift ▶' : '◀ slide to steer ▶'}</span>
      )}
    </div>
  )
})

// The touch layout. Gas is automatic (hold brake to slow or reverse); with autoGas off
// there's a gas pedal too, for games that need to creep and stop (parking).
// item: what to show on the item button (null = empty; leave out for games without items).
// drift: show drift (landscape button; portrait drifts on a hard slide).
// feel: how the thumb steers (karts pass KART_FEEL).
export function TouchDrive({ input, tall, drift = true, item, autoGas = true, feel = ARCADE_FEEL }: { input: DriveInput; tall: boolean; drift?: boolean; item?: ReactNode | null; autoGas?: boolean; feel?: SteerFeel }) {
  const [brake, setBrake] = useState(false)
  const [gas, setGas] = useState(false)
  const [drifting, setDrifting] = useState(false)
  const [using, setUsing] = useState(false)
  useEffect(() => {
    input.gas = (autoGas || gas) && !brake ? 1 : 0
    input.brake = brake ? 1 : 0
  }, [input, brake, gas, autoGas])
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
  const gasBtn = !autoGas && (
    <button className={`dc-btn dc-gas${gas ? ' on' : ''}`} aria-label="Gas" {...hold(() => setGas(true), () => setGas(false))}>
      <small>GAS</small>
    </button>
  )
  if (tall) return (
    <div className="dc dc-tall">
      <div className="dc-row">{brakeBtn}{itemBtn}{gasBtn}</div>
      <SteerZone input={input} autoDrift={drift} className="tall" feel={feel} />
    </div>
  )
  return (
    <div className="dc dc-wide">
      <SteerZone input={input} autoDrift={false} className="wide" feel={feel} />
      <div className="dc-cluster">
        {itemBtn}
        {drift && (
          <button className={`dc-btn dc-drift${drifting ? ' on' : ''}`} aria-label="Drift"
            {...hold(() => { input.drift = true; setDrifting(true) }, () => { input.drift = false; setDrifting(false) })}>
            DRIFT
          </button>
        )}
        {brakeBtn}
        {gasBtn}
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
