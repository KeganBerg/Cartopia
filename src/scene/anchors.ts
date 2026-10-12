import { Vector3 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { VIEW, isFree } from './freeCam'

// DOM bubbles (job timers, coins, flat tires) live outside the canvas and are
// pinned to world positions here each frame. Cheaper and sturdier than one
// portal per bubble.
export const anchors = new Map<string, Vector3>()
export const anchorEls = new Map<string, HTMLElement>()

const v = new Vector3()

type Placed = { el: HTMLElement; x: number; y: number; w: number; h: number; fixed: boolean }
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

export function AnchorProjector() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useFrame(() => {
    placed.length = 0
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
        el.style.visibility = 'hidden'
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
          el.style.visibility = 'hidden'
          continue
        }
        x = size.width - x
        y = size.height * 2
      }
      el.style.visibility = 'visible'
      if (clamp) {
        const cx = Math.min(Math.max(x, 60), size.width - 60)
        const cy = Math.min(Math.max(y, 210), size.height - 110)
        el.classList.toggle('edge', cx !== x || cy !== y)
        x = cx
        y = cy
      }
      const hide = far && !clamp && quiet(el)
      el.classList.toggle('far', hide)
      if (hide) {
        el.classList.remove('under')
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
        continue
      }
      placed.push({ el, x, y, w: el.offsetWidth, h: el.offsetHeight, fixed: clamp })
    }
    // Bubbles on neighbouring buildings would pile on top of each other. Bubbles nearest the
    // bottom of the screen keep their spot; each later one moves to the closest free spot beside,
    // above or below the ones already placed, but only a short hop so it still reads as its
    // building's, and never up under the HUD.
    placed.sort((a, b) => b.y - a.y)
    const top = Math.min(200, size.height / 3)
    const free = (a: Placed, x: number, y: number, upto: number) => {
      if (x - a.w / 2 < 2 || x + a.w / 2 > size.width - 2 || y - a.h < top || underHud(x, y, a.w, a.h)) return false
      for (let j = 0; j < upto; j++) {
        const b = placed[j]
        if (Math.abs(x - b.x) < (a.w + b.w) / 2 && y > b.y - b.h && y - a.h < b.y) return false
      }
      return true
    }
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i]
      // Keep plain bubbles fully on screen sideways too.
      if (!a.fixed) a.x = Math.min(Math.max(a.x, a.w / 2 + 4), size.width - a.w / 2 - 4)
      if (!a.fixed && !free(a, a.x, a.y, i)) {
        let best: [number, number] | null = null
        let bestD = HOP * HOP
        for (let j = 0; j < i; j++) {
          const b = placed[j]
          const spots: [number, number][] = [
            [a.x, b.y - b.h - 2], [a.x, b.y + a.h + 2],
            [b.x - (a.w + b.w) / 2 - 2, a.y], [b.x + (a.w + b.w) / 2 + 2, a.y],
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
      a.el.classList.toggle('under', !a.fixed && underHud(a.x, a.y, a.w, a.h))
      a.el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px) translate(-50%, -100%)`
    }
  })
  return null
}

export function anchorRef(id: string) {
  return (el: HTMLElement | null) => {
    if (el) anchorEls.set(id, el)
    else anchorEls.delete(id)
  }
}
