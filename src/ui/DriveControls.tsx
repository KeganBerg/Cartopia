import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buzz } from '../lib/haptics'
import './drive.css'

// Shared driving controls for every game where the player steers a car: keyboard
// (WASD or arrows, Space to drift, Shift or E for an item) and touch, with one layout
// for a phone held upright and one for a phone on its side.
//
// The screen owns a DriveInput object and hands it to its scene; these controls only
// write into it, so the scene reads it every frame without React re-rendering.
// steer: +1 full left, -1 full right. gas/brake: 0..1. drift/item: held.

// thumb: drifts come from the steering thumb alone (portrait touch), see game/kart.ts thumbSlide.
export type DriveInput = { steer: number; gas: number; brake: number; drift: boolean; item: boolean; thumb?: boolean }
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

// While a race is on screen, the page itself never zooms or scrolls under the player's thumbs:
// iOS ignores user-scalable=no, so two thumbs (steer + brake, shift + boost) would pinch-zoom
// the page and cancel both touches. CSS touch-action covers Android; this covers Safari.
export function useTouchLock(on = true) {
  useEffect(() => {
    if (!on) return
    const stop = (e: Event) => { if (e.cancelable) e.preventDefault() }
    const multi = (e: TouchEvent) => { if (e.touches.length > 1 && e.cancelable) e.preventDefault() }
    const opts = { passive: false } as AddEventListenerOptions
    document.addEventListener('gesturestart', stop, opts)
    document.addEventListener('gesturechange', stop, opts)
    document.addEventListener('touchmove', multi, opts)
    document.addEventListener('dblclick', stop, opts)
    return () => {
      document.removeEventListener('gesturestart', stop, opts)
      document.removeEventListener('gesturechange', stop, opts)
      document.removeEventListener('touchmove', multi, opts)
      document.removeEventListener('dblclick', stop, opts)
    }
  }, [on])
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
// The Sharp setting (Settings > Controls): shorter travel, more direct.
export const KART_SHARP: SteerFeel = { range: 66, dead: 5, curve: 1.3, drift: 'flick' }

// steer: +1 full left, -1 full right (dx > 0 is the thumb to the right).
export function thumbSteer(dx: number, f: SteerFeel) {
  const a = Math.abs(dx)
  if (a <= f.dead) return 0
  return -Math.sign(dx) * Math.min(1, (a - f.dead) / (f.range - f.dead)) ** f.curve
}

// Portrait drifting from the steering thumb alone. 'flick': a quick jerk outwards (at least
// FLICK_JUMP further out within FLICK_MS) that ends past FLICK_OUT, from the middle or from a
// steer already held through a bend; easing wide never drifts by accident. 'slide': any slide
// past 0.85. The drift ends as the thumb comes back near the middle or crosses over.
const FLICK_MS = 150, FLICK_OUT = 0.85, FLICK_JUMP = 0.5, LET_GO = 0.2 // keep LET_GO in step with THUMB_LET_GO (game/kart.ts)
export class ThumbDrift {
  dir = 0
  private recent: { t: number; s: number }[] = []
  private mode: SteerFeel['drift']
  constructor(mode: SteerFeel['drift']) { this.mode = mode }
  update(steer: number, now: number) {
    const a = Math.abs(steer), side = Math.sign(steer)
    this.recent = this.recent.filter((r) => now - r.t <= FLICK_MS)
    if (this.dir === 0) {
      const jerk = this.recent.some((r) => r.s * side <= a - FLICK_JUMP)
      if (a > FLICK_OUT && (this.mode === 'slide' || jerk)) this.dir = side
    } else if (a < LET_GO || (side === -this.dir && a > 0.5)) this.dir = 0
    this.recent.push({ t: now, s: steer })
    return this.dir
  }
  // A thumb landing counts as a sample at the middle, so a flick straight from touch-down drifts.
  reset(now = -1e9) { this.dir = 0; this.recent = [{ t: now, s: 0 }] }
}


// How far the thumb can travel each way before full lock. A thumb that lands near the edge of
// the screen can't slide a full range past it, so that side reaches full lock at the edge
// (keeping EDGE px spare) instead of never reaching it. Never shorter than MIN_SIDE px.
const EDGE = 14, MIN_SIDE = 20
export function sideRanges(x: number, screenW: number, range: number) {
  const side = (room: number) => Math.max(MIN_SIDE, Math.min(range, room - EDGE))
  return { left: side(x), right: side(screenW - x) }
}

// A floating thumb stick that only steers: put a thumb down anywhere in the zone and
// slide it left or right. The knob moves by hand (no React render per finger move).
const SteerZone = memo(function SteerZone({ input, autoDrift, className, feel }: { input: DriveInput; autoDrift: boolean; className: string; feel: SteerFeel }) {
  const [at, setAt] = useState<{ x0: number; y: number; left: number; right: number } | null>(null)
  const knob = useRef<HTMLElement>(null)
  const drift = useMemo(() => new ThumbDrift(feel.drift), [feel.drift])
  // The finger that owns the stick; a second finger landing in the zone is ignored, so resting
  // the other thumb (or reaching for brake) never yanks or drops the steering.
  const owner = useRef<number | null>(null)
  const end = (e: React.PointerEvent) => {
    if (e.pointerId !== owner.current) return
    owner.current = null
    input.steer = 0
    if (autoDrift) { input.drift = false; drift.reset() }
    setAt(null)
  }
  return (
    <div className={`dc-steer ${className}`}
      onPointerDown={(e) => {
        e.preventDefault()
        if (owner.current !== null) return
        owner.current = e.pointerId
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        if (autoDrift) drift.reset(e.timeStamp)
        setAt({ x0: e.clientX - r.left, y: e.clientY - r.top, ...sideRanges(e.clientX, window.innerWidth, feel.range) })
      }}
      onPointerMove={(e) => {
        if (!at || e.pointerId !== owner.current) return
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const dx = Math.max(-at.left, Math.min(at.right, e.clientX - r.left - at.x0))
        // Scale the travel to this side's range so the edge side still reaches full lock.
        const side = dx < 0 ? at.left : at.right
        input.steer = thumbSteer((dx * feel.range) / side, feel)
        if (autoDrift) {
          const was = drift.dir
          input.drift = drift.update(input.steer, e.timeStamp) !== 0
          input.thumb = true // the race reads a slide's steer from the thumb's side (game/kart.ts thumbSlide)
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

// Steering buttons (Settings > Karts > ◀ ▶): hold ◀ or ▶ to turn. A press starts at PAD_START
// of full lock and winds on at PAD_RAMP per second, so a tap nudges and a hold turns hard.
export const PAD_START = 0.35, PAD_RAMP = 1.5
export function padSteer(prev: number, dir: number, dt: number) {
  if (dir === 0) return 0
  if (Math.sign(prev) !== dir) return dir * PAD_START
  return dir * Math.min(1, Math.abs(prev) + PAD_RAMP * dt)
}

// Two big pads, ◀ and ▶. Every finger counts: a thumb rocking from one pad to the other
// switches side without lifting; both held is straight ahead.
const SteerPads = memo(function SteerPads({ input, className }: { input: DriveInput; className: string }) {
  const fingers = useRef(new Map<number, number>())
  const box = useRef<HTMLDivElement>(null)
  const dir = useRef(0)
  useEffect(() => {
    let raf = 0, last = performance.now()
    const tick = (now: number) => {
      input.steer = padSteer(input.steer, dir.current, Math.min(0.1, (now - last) / 1000))
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); input.steer = 0 }
  }, [input])
  const update = () => {
    const sides = [...fingers.current.values()]
    // steer: +1 is left.
    const d = (sides.includes(1) ? 1 : 0) - (sides.includes(-1) ? 1 : 0)
    if (d !== dir.current && d !== 0) buzz(6)
    dir.current = d
    input.steer = padSteer(input.steer, d, 0)
    box.current?.classList.toggle('l', sides.includes(1))
    box.current?.classList.toggle('r', sides.includes(-1))
  }
  const side = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return e.clientX < r.left + r.width / 2 ? 1 : -1
  }
  const up = (e: React.PointerEvent) => { if (fingers.current.delete(e.pointerId)) update() }
  return (
    <div ref={box} className={`dc-pads ${className}`}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        fingers.current.set(e.pointerId, side(e))
        update()
      }}
      onPointerMove={(e) => {
        if (!fingers.current.has(e.pointerId)) return
        const s = side(e)
        if (fingers.current.get(e.pointerId) !== s) { fingers.current.set(e.pointerId, s); update() }
      }}
      onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
      onContextMenu={(e) => e.preventDefault()}>
      <span className="dc-pad left" aria-label="Steer left">◀</span>
      <span className="dc-pad right" aria-label="Steer right">▶</span>
    </div>
  )
})

// The touch layout. Gas is automatic (hold brake to slow or reverse); with autoGas off
// there's a gas pedal too, for games that need to creep and stop (parking).
// item: what to show on the item button (null = empty; leave out for games without items).
// drift: show drift (landscape button; portrait drifts on a hard slide).
// feel: how the thumb steers (karts pass KART_FEEL). pads: ◀ ▶ buttons instead of the slider.
export function TouchDrive({ input, tall, drift = true, item, autoGas = true, feel = ARCADE_FEEL, pads = false }: { input: DriveInput; tall: boolean; drift?: boolean; item?: ReactNode | null; autoGas?: boolean; feel?: SteerFeel; pads?: boolean }) {
  const [brake, setBrake] = useState(false)
  const [gas, setGas] = useState(false)
  const [drifting, setDrifting] = useState(false)
  const [using, setUsing] = useState(false)
  useEffect(() => {
    input.gas = (autoGas || gas) && !brake ? 1 : 0
    input.brake = brake ? 1 : 0
  }, [input, brake, gas, autoGas])
  useEffect(() => () => { Object.assign(input, newDriveInput()) }, [input])
  useTouchLock()
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
  const driftBtn = drift && (
    <button className={`dc-btn dc-drift${drifting ? ' on' : ''}`} aria-label="Drift"
      {...hold(() => { input.drift = true; setDrifting(true) }, () => { input.drift = false; setDrifting(false) })}>
      DRIFT
    </button>
  )
  if (tall) return (
    <div className={`dc dc-tall${pads ? ' with-pads' : ''}`}>
      {/* With pads the slider can't flick into a drift, so drift gets its own button. */}
      <div className="dc-row">{brakeBtn}{pads && driftBtn}{itemBtn}{gasBtn}</div>
      {pads ? <SteerPads input={input} className="tall" /> : <SteerZone input={input} autoDrift={drift} className="tall" feel={feel} />}
    </div>
  )
  return (
    <div className="dc dc-wide">
      {pads ? <SteerPads input={input} className="wide" /> : <SteerZone input={input} autoDrift={false} className="wide" feel={feel} />}
      <div className="dc-cluster">
        {itemBtn}
        {driftBtn}
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
