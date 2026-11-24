import { Vector3 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { VIEW, isFree } from './freeCam'

// DOM bubbles (job timers, coins, flat tires) live outside the canvas and are
// pinned to world positions here each frame. Cheaper and sturdier than one
// portal per bubble.
export const anchors = new Map<string, Vector3>()
export const anchorEls = new Map<string, HTMLElement>()

const v = new Vector3()

export type Placed = { el: HTMLElement; x: number; y: number; x0: number; y0: number; w: number; h: number; fixed: boolean }
// How far each bubble is currently nudged off its building. It slides to a new spot rather
// than hopping, so bubbles don't flicker between spots while the camera turns.
const nudges = new WeakMap<HTMLElement, { x: number; y: number }>()
const placed: Placed[] = []
// Furthest a bubble may be nudged from its building, in px.
const HOP = 64
// Zoomed out past this share of the screen's default zoom, quiet bubbles (job timers, idle
// "start" pills) fade away so the town reads at a glance. Ready coins and visitors stay.
const FAR = 0.8
const FREE_FAR = 70
const quiet = (el: HTMLElement) => {
  const c = el.firstElementChild?.classList
  return !!c && (c.contains('badge-working') || c.contains('badge-idle'))
}

// The top HUD's boxes. A bubble may not sit behind them.
const HUD = '.hud-left, .hud-center > *, .hud-right > *, .hud-strip, .hud-town, .hud-mobile > .goal-tracker'
let hud: DOMRect[] = []
let hudAge = 0
// The boxes are measured when one of them changes size (a counter gets a digit longer, a strip
// shows) or the window does, right after the browser's own layout. Measured in the frame, after
// the bubbles' writes, they made the browser lay the page out again every 20 frames.
let hudEls: Element[] = []
const measureHud = () => {
  hud = hudEls.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
}
const hudSizer = typeof ResizeObserver === 'function' ? new ResizeObserver(measureHud) : null
// A resized window moves the boxes without always resizing them: observe them afresh.
let hudStale = true
if (hudSizer) addEventListener('resize', () => (hudStale = true))
// HUD pieces come and go; every 20 frames the list is checked (no layout in that). Every couple of
// seconds they're observed afresh anyway, for a box that slid somewhere without changing size.
let hudWatches = 0
function watchHud() {
  if (++hudWatches % 6 === 0) hudStale = true
  const els = [...document.querySelectorAll(HUD)]
  if (!hudSizer) {
    hudEls = els
    return measureHud()
  }
  if (!hudStale && els.length === hudEls.length && els.every((e, i) => e === hudEls[i])) return
  hudStale = false
  hudSizer.disconnect()
  hudEls = els
  // Observing reports each one's size once, so this measures them all after the next layout.
  for (const e of els) hudSizer.observe(e)
  if (!els.length) hud = []
}

// How far a pill's count chip pokes out past its top-right corner, in px.
const CHIP = 8

// Off screen by more than this, in px, a bubble is hidden and skipped.
const OFF = 120
const sizes = new WeakMap<HTMLElement, { w: number; h: number }>()
// Each bubble's size, kept up to date as its text changes. Read in the observer's callback, the
// size costs nothing: the browser has just laid the page out.
const sizer =
  typeof ResizeObserver === 'function'
    ? new ResizeObserver((list) => {
        for (const e of list) {
          const el = e.target as HTMLElement
          sizes.set(el, { w: el.offsetWidth, h: el.offsetHeight })
        }
      })
    : null
// What each bubble was last given, so unchanged ones aren't written again every frame.
const last = new WeakMap<HTMLElement, { seen?: boolean; at?: string; x?: number; y?: number; cls: Record<string, boolean> }>()
const memo = (el: HTMLElement) => {
  let m = last.get(el)
  if (!m) last.set(el, (m = { cls: {} }))
  return m
}
// Bubbles hidden off screen right now, and what each wants done when it shows again. A job
// timer off screen needn't redraw every second: a big town had a hundred or more of them
// redrawing at once each second, a hitch while panning. It catches up as it comes back.
const offscreen = new Set<string>()
const onShow = new Map<string, () => void>()
export const anchorOffscreen = (id: string) => offscreen.has(id)
export function whenShown(id: string, fn: () => void) {
  onShow.set(id, fn)
  return () => {
    if (onShow.get(id) === fn) onShow.delete(id)
  }
}
export function setAnchorShown(id: string, on: boolean) {
  if (on) {
    if (offscreen.delete(id)) onShow.get(id)?.()
  } else offscreen.add(id)
}
const show = (id: string, el: HTMLElement, on: boolean) => {
  const m = memo(el)
  if (m.seen === on) return
  m.seen = on
  setAnchorShown(id, on)
  el.style.visibility = on ? 'visible' : 'hidden'
}
const toggle = (el: HTMLElement, c: string, on: boolean) => {
  const m = memo(el)
  if (m.cls[c] === on) return
  m.cls[c] = on
  el.classList.toggle(c, on)
}
const move = (el: HTMLElement, x: number, y: number) => {
  const m = memo(el)
  m.x = x
  m.y = y
  const at = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
  if (m.at === at) return
  m.at = at
  el.style.transform = at
}

// Ready coins and flat-tyre bubbles bob up and down here, not in CSS. The town redraws every
// frame, and a CSS animation then made the browser restyle every coin every frame: a town
// full of finished jobs got slower each minute as coins piled up. Moving the bubble's own
// box costs a fraction of that. A new coin pops in first (badge-in), then bobs.
const BOB_MS = 900
const BOBS: [string, number][] = [['badge-ready', 500], ['badge-flat', 0]]
const bobSince = new WeakMap<HTMLElement, number>()
const stillPref = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
// Up to 6px above its spot, eased in and out like the old CSS bob.
export const bobAt = (ms: number) => (ms <= 0 ? 0 : -3 + 3 * Math.cos((ms / BOB_MS) * 2 * Math.PI))
const bob = (el: HTMLElement, now: number) => {
  const c = el.firstElementChild?.classList
  const kind = c && !stillPref?.matches ? BOBS.find(([k]) => c.contains(k)) : undefined
  if (!kind) {
    bobSince.delete(el)
    return 0
  }
  let t0 = bobSince.get(el)
  if (t0 === undefined) bobSince.set(el, (t0 = now + kind[1]))
  return bobAt(now - t0)
}

// The last layout: what went in (each bubble's spot and size, the screen, the HUD) and where each
// bubble was headed. While nothing moves (the camera still and the bubbles settled) the same
// inputs give the same spots, so the search below is skipped: it weighs every bubble against
// every other, the biggest part of the town's per-frame work in a big town on a phone.
const before = { els: [] as HTMLElement[], at: [] as number[], to: [] as number[], under: [] as boolean[], w: 0, h: 0, hud, settled: false }
function sameAsBefore(w: number, h: number) {
  const b = before
  if (!b.settled || b.w !== w || b.h !== h || b.hud !== hud || b.els.length !== placed.length) return false
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i], k = i * 4
    if (b.els[i] !== a.el || b.at[k] !== a.x0 || b.at[k + 1] !== a.y0 || b.at[k + 2] !== a.w || b.at[k + 3] !== a.h) return false
  }
  return true
}

type Box = { left: number; right: number; top: number; bottom: number }
const near: Placed[] = []

// Bubbles on neighbouring buildings would pile on top of each other. `placed` comes sorted from
// the bottom of the screen up: bubbles nearest the bottom keep their spot; each later one moves to
// the closest free spot beside, above or below the ones already placed, but only a short hop
// (HOP) so it still reads as its building's, and never up under the HUD. `done` gets each bubble
// with its spot in a.x / a.y, in order, and may move it (the slide) before the next is placed.
// Every spot tried is within HOP of the bubble, so only bubbles that close can be in its way:
// testing each spot against every bubble placed before it made this cubic, 10 ms or more a
// frame while panning a big town on a fast computer (several times that on a phone).
export function spread(placed: Placed[], width: number, height: number, hudBoxes: Box[], done: (a: Placed, under: boolean) => void) {
  const top = Math.min(200, height / 3)
  const overHud = (x: number, y: number, w: number, h: number) => hudBoxes.some((r) => x + w / 2 > r.left && x - w / 2 < r.right && y > r.top && y - h < r.bottom)
  const free = (a: Placed, x: number, y: number) => {
    // A bubble already up near the HUD may dodge sideways at its own height, just not higher.
    if (x - a.w / 2 < 2 || x + a.w / 2 + CHIP > width - 2 || y - a.h < Math.min(top, a.y0 - a.h) || overHud(x, y, a.w, a.h)) return false
    for (let j = 0; j < near.length; j++) {
      const b = near[j]
      if (Math.abs(x - b.x) < (a.w + b.w) / 2 + CHIP && y > b.y - b.h - CHIP && y - a.h - CHIP < b.y) return false
    }
    return true
  }
  const consider = (a: Placed, x: number, y: number, best: { x: number; y: number; d: number }) => {
    const d = (x - a.x) ** 2 + (y - a.y) ** 2
    if (d < best.d && free(a, x, y)) {
      best.x = x
      best.y = y
      best.d = d
    }
  }
  const best = { x: 0, y: 0, d: 0 }
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i]
    // Keep plain bubbles fully on screen sideways too, count chip included.
    if (!a.fixed) a.x = Math.min(Math.max(a.x, a.w / 2 + 4), width - a.w / 2 - CHIP - 4)
    if (!a.fixed) {
      // The ones placed already that could be in the way of a spot within HOP (one px spare).
      near.length = 0
      for (let j = 0; j < i; j++) {
        const b = placed[j]
        if (Math.abs(a.x - b.x) < HOP + (a.w + b.w) / 2 + CHIP + 1 && a.y + HOP + 1 > b.y - b.h - CHIP && a.y - HOP - 1 - a.h - CHIP < b.y) near.push(b)
      }
      if (!free(a, a.x, a.y)) {
        best.d = HOP * HOP
        let found = false
        for (let j = 0; j < i; j++) {
          const b = placed[j]
          // Neighbours leave room for each other's count chips.
          const d0 = best.d
          consider(a, a.x, b.y - b.h - CHIP - 1, best)
          consider(a, a.x, b.y + a.h + CHIP + 1, best)
          consider(a, b.x - (a.w + b.w) / 2 - CHIP - 1, a.y, best)
          consider(a, b.x + (a.w + b.w) / 2 + CHIP + 1, a.y, best)
          if (best.d < d0) found = true
        }
        if (found) {
          a.x = best.x
          a.y = best.y
        }
      }
      near.length = 0
    }
    // Still behind the HUD (a building near the top edge): fade it rather than show half a pill.
    done(a, !a.fixed && overHud(a.x, a.y, a.w, a.h))
  }
}

export function AnchorProjector() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useFrame((_, delta) => {
    placed.length = 0
    const now = performance.now()
    const slide = Math.min(1, delta * 14)
    if (hudAge-- <= 0 || hudStale) {
      hudAge = 20
      watchHud()
    }
    // Same default zoom as ResponsiveZoom in World.tsx.
    // The free view's camera is a perspective one: there, far means pulled well back.
    const far = isFree(camera) ? camera.position.distanceTo(VIEW) > FREE_FAR : camera.zoom < Math.min(38, Math.max(18, Math.sqrt(size.width * size.height) / 24)) * FAR
    for (const [id, el] of anchorEls) {
      const p = anchors.get(id)
      if (!p) {
        show(id, el, false)
        continue
      }
      v.copy(p).project(camera)
      let x = ((v.x + 1) / 2) * size.width
      let y = ((1 - v.y) / 2) * size.height
      // data-clamp: keep it on screen, pinned to the nearest edge (for things worth chasing).
      const clamp = el.dataset.clamp !== undefined
      if (v.z > 1) {
        // Behind the free camera. A pinned bubble flips to the edge it's really past.
        if (!clamp) {
          show(id, el, false)
          continue
        }
        x = size.width - x
        y = size.height * 2
      }
      // Well off screen: nothing to show or to dodge (a big town has hundreds of these).
      if (!clamp && (x < -OFF || x > size.width + OFF || y < -OFF || y > size.height + OFF)) {
        show(id, el, false)
        continue
      }
      show(id, el, true)
      if (clamp) {
        const cx = Math.min(Math.max(x, 60), size.width - 60)
        const cy = Math.min(Math.max(y, 210), size.height - 110)
        toggle(el, 'edge', cx !== x || cy !== y)
        x = cx
        y = cy
      }
      const hide = far && !clamp && quiet(el)
      toggle(el, 'far', hide)
      if (hide) {
        toggle(el, 'under', false)
        move(el, x, y)
        continue
      }
      placed.push({ el, x, y, x0: x, y0: y, w: 0, h: 0, fixed: clamp })
    }
    // Sizes come from the ResizeObserver below, which hears of a change after the browser's own
    // layout. Reading them here made the browser lay the page out again in the middle of the
    // frame (the writes above dirty it): ~2 ms a frame in a big town on a fast computer.
    // A bubble too new to have been heard of yet is read once.
    for (const a of placed) {
      let s = sizes.get(a.el)
      if (!s || (!sizer && Math.random() < 1 / 45)) sizes.set(a.el, (s = { w: a.el.offsetWidth, h: a.el.offsetHeight }))
      a.w = s.w
      a.h = s.h
    }
    // Bottom of the screen first: see spread().
    placed.sort((a, b) => b.y - a.y)
    if (sameAsBefore(size.width, size.height)) {
      let settled = true
      for (let i = 0; i < placed.length; i++) {
        const a = placed[i]
        toggle(a.el, 'under', before.under[i])
        if (!a.fixed) {
          const n = nudges.get(a.el)!
          const tx = before.to[i * 2] - a.x0, ty = before.to[i * 2 + 1] - a.y0
          n.x += (tx - n.x) * slide
          n.y += (ty - n.y) * slide
          if (Math.abs(tx - n.x) > 0.05 || Math.abs(ty - n.y) > 0.05) settled = false
          a.x = a.x0 + n.x
          a.y = a.y0 + n.y
        }
        move(a.el, a.x, a.y + bob(a.el, now))
      }
      before.settled = settled
      return
    }
    before.els.length = before.at.length = before.to.length = before.under.length = 0
    let settled = true
    spread(placed, size.width, size.height, hud, (a, under) => {
      toggle(a.el, 'under', under)
      before.els.push(a.el)
      before.at.push(a.x0, a.y0, a.w, a.h)
      before.to.push(a.x, a.y)
      before.under.push(under)
      if (!a.fixed) {
        let n = nudges.get(a.el)
        if (!n) nudges.set(a.el, (n = { x: a.x - a.x0, y: a.y - a.y0 }))
        const tx = a.x - a.x0, ty = a.y - a.y0
        n.x += (tx - n.x) * slide
        n.y += (ty - n.y) * slide
        if (Math.abs(tx - n.x) > 0.05 || Math.abs(ty - n.y) > 0.05) settled = false
        a.x = a.x0 + n.x
        a.y = a.y0 + n.y
      }
      move(a.el, a.x, a.y + bob(a.el, now))
    })
    before.w = size.width
    before.h = size.height
    before.hud = hud
    before.settled = settled
  })
  return null
}

// Where a bubble on screen was last put (the middle of it), from the projector's own numbers:
// reading it back from the page made the browser lay the whole page out on every collect.
export function anchorCenter(id: string): [number, number] | null {
  const el = anchorEls.get(id)
  const m = el && last.get(el)
  if (!el || !m?.seen || m.x === undefined || m.y === undefined) return null
  const h = sizes.get(el)?.h ?? 0
  // The bubble sits on its point, above a 9px tail gap (.anchor's padding).
  return [m.x, m.y - 9 - Math.max(0, h - 9) / 2]
}

export function anchorRef(id: string) {
  return (el: HTMLElement | null) => {
    if (el) {
      anchorEls.set(id, el)
      sizer?.observe(el)
    } else {
      const old = anchorEls.get(id)
      if (old) sizer?.unobserve(old)
      anchorEls.delete(id)
      offscreen.delete(id)
    }
  }
}
