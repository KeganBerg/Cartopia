import { Vector3 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'

// DOM bubbles (job timers, coins, flat tires) live outside the canvas and are
// pinned to world positions here each frame. Cheaper and sturdier than one
// portal per bubble.
export const anchors = new Map<string, Vector3>()
export const anchorEls = new Map<string, HTMLElement>()

const v = new Vector3()

type Placed = { el: HTMLElement; x: number; y: number; w: number; h: number; fixed: boolean }
const placed: Placed[] = []

export function AnchorProjector() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useFrame(() => {
    placed.length = 0
    for (const [id, el] of anchorEls) {
      const p = anchors.get(id)
      if (!p) {
        el.style.visibility = 'hidden'
        continue
      }
      v.copy(p).project(camera)
      let x = ((v.x + 1) / 2) * size.width
      let y = ((1 - v.y) / 2) * size.height
      if (v.z > 1) {
        el.style.visibility = 'hidden'
        continue
      }
      el.style.visibility = 'visible'
      // data-clamp: keep it on screen, pinned to the nearest edge (for things worth chasing).
      const clamp = el.dataset.clamp !== undefined
      if (clamp) {
        const cx = Math.min(Math.max(x, 60), size.width - 60)
        const cy = Math.min(Math.max(y, 210), size.height - 110)
        el.classList.toggle('edge', cx !== x || cy !== y)
        x = cx
        y = cy
      }
      placed.push({ el, x, y, w: el.offsetWidth, h: el.offsetHeight, fixed: clamp })
    }
    // Bubbles on neighbouring buildings would pile on top of each other: the one nearest the
    // bottom of the screen keeps its spot and the others stack upward above it.
    placed.sort((a, b) => b.y - a.y)
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i]
      // Keep plain bubbles fully on screen sideways too.
      if (!a.fixed) a.x = Math.min(Math.max(a.x, a.w / 2 + 4), size.width - a.w / 2 - 4)
      for (let moved = true, n = 0; moved && n < 8; n++) {
        moved = false
        for (let j = 0; j < i; j++) {
          const b = placed[j]
          if (a.fixed || Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || a.y <= b.y - b.h || a.y - a.h >= b.y) continue
          a.y = b.y - b.h - 2
          moved = true
        }
      }
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
