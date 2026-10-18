import { Vector3 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { VIEW, isFree } from './freeCam'

// DOM bubbles (job timers, coins, flat tires) live outside the canvas and are
// pinned to world positions here each frame. Cheaper and sturdier than one
// portal per bubble.
export const anchors = new Map<string, Vector3>()
export const anchorEls = new Map<string, HTMLElement>()

const v = new Vector3()

type Placed = { el: HTMLElement; x: number; y: number; x0: number; y0: number; w: number; h: number; fixed: boolean }
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

// The top HUD's boxes, re-measured every few frames. A bubble may not sit behind them.
const HUD = '.hud-left, .hud-center > *, .hud-right > *, .hud-strip, .hud-town, .hud-mobile > .goal-tracker'
let hud: DOMRect[] = []
let hudAge = 0
const underHud = (x: number, y: number, w: number, h: number) =>
  hud.some((r) => x + w / 2 > r.left && x - w / 2 < r.right && y > r.top && y - h < r.bottom)

// How far a pill's count chip pokes out past its top-right corner, in px.
const CHIP = 8

// Off screen by more than this, in px, a bubble is hidden and skipped.
const OFF = 120
const sizes = new WeakMap<HTMLElement, { w: number; h: number; age: number }>()
// What each bubble was last given, so unchanged ones aren't written again every frame.
const last = new WeakMap<HTMLElement, { seen?: boolean; at?: string; cls: Record<string, boolean> }>()
const memo = (el: HTMLElement) => {
  let m = last.get(el)
  if (!m) last.set(el, (m = { cls: {} }))
  return m
}
const show = (el: HTMLElement, on: boolean) => {
  const m = memo(el)
  if (m.seen === on) return
  m.seen = on
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

export function AnchorProjector() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useFrame((_, delta) => {
    placed.length = 0
    const now = performance.now()
    const slide = Math.min(1, delta * 14)
    if (hudAge-- <= 0) {
      hudAge = 20
      hud = [...document.querySelectorAll(HUD)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
    }
    // Same default zoom as ResponsiveZoom in World.tsx.
    // The free view's camera is a perspective one: there, far means pulled well back.
    const far = isFree(camera) ? camera.position.distanceTo(VIEW) > FREE_FAR : camera.zoom < Math.min(38, Math.max(18, Math.sqrt(size.width * size.height) / 24)) * FAR
    for (const [id, el] of anchorEls) {
      const p = anchors.get(id)
      if (!p) {
        show(el, false)
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
          show(el, false)
          continue
        }
        x = size.width - x
        y = size.height * 2
      }
      // Well off screen: nothing to show or to dodge (a big town has hundreds of these).
      if (!clamp && (x < -OFF || x > size.width + OFF || y < -OFF || y > size.height + OFF)) {
        show(el, false)
        continue
      }
      show(el, true)
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
    // Sizes, read together after the writes above (reading between writes re-ran layout once
    // per bubble) and only every second or so: they change only when a bubble's text does.
    for (const a of placed) {
      let s = sizes.get(a.el)
      if (!s || s.age-- <= 0) {
        s = { w: a.el.offsetWidth, h: a.el.offsetHeight, age: 30 + (Math.random() * 30) | 0 }
        sizes.set(a.el, s)
      }
      a.w = s.w
      a.h = s.h
    }
    // Bubbles on neighbouring buildings would pile on top of each other. Bubbles nearest the
    // bottom of the screen keep their spot; each later one moves to the closest free spot beside,
    // above or below the ones already placed, but only a short hop so it still reads as its
    // building's, and never up under the HUD.
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
    const top = Math.min(200, size.height / 3)
    const free = (a: Placed, x: number, y: number, upto: number) => {
      // A bubble already up near the HUD may dodge sideways at its own height, just not higher.
      if (x - a.w / 2 < 2 || x + a.w / 2 + CHIP > size.width - 2 || y - a.h < Math.min(top, a.y0 - a.h) || underHud(x, y, a.w, a.h)) return false
      for (let j = 0; j < upto; j++) {
        const b = placed[j]
        if (Math.abs(x - b.x) < (a.w + b.w) / 2 + CHIP && y > b.y - b.h - CHIP && y - a.h - CHIP < b.y) return false
      }
      return true
    }
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i]
      // Keep plain bubbles fully on screen sideways too, count chip included.
      if (!a.fixed) a.x = Math.min(Math.max(a.x, a.w / 2 + 4), size.width - a.w / 2 - CHIP - 4)
      if (!a.fixed && !free(a, a.x, a.y, i)) {
        let best: [number, number] | null = null
        let bestD = HOP * HOP
        for (let j = 0; j < i; j++) {
          const b = placed[j]
          // Neighbours leave room for each other's count chips.
          const spots: [number, number][] = [
            [a.x, b.y - b.h - CHIP - 1], [a.x, b.y + a.h + CHIP + 1],
            [b.x - (a.w + b.w) / 2 - CHIP - 1, a.y], [b.x + (a.w + b.w) / 2 + CHIP + 1, a.y],
          ]
          for (const [x, y] of spots) {
            const d = (x - a.x) ** 2 + (y - a.y) ** 2
            if (d < bestD && free(a, x, y, i)) {
              best = [x, y]
              bestD = d
            }
          }
        }
        if (best) [a.x, a.y] = best
      }
      // Still behind the HUD (a building near the top edge): fade it rather than show half a pill.
      const under = !a.fixed && underHud(a.x, a.y, a.w, a.h)
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
    }
    before.w = size.width
    before.h = size.height
    before.hud = hud
    before.settled = settled
  })
  return null
}

export function anchorRef(id: string) {
  return (el: HTMLElement | null) => {
    if (el) anchorEls.set(id, el)
    else anchorEls.delete(id)
  }
}
