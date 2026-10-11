import { Vector3 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'

// DOM bubbles (job timers, coins, flat tires) live outside the canvas and are
// pinned to world positions here each frame. Cheaper and sturdier than one
// portal per bubble.
export const anchors = new Map<string, Vector3>()
export const anchorEls = new Map<string, HTMLElement>()

const v = new Vector3()

export function AnchorProjector() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useFrame(() => {
    for (const [id, el] of anchorEls) {
      const p = anchors.get(id)
      if (!p) {
        el.style.visibility = 'hidden'
        continue
      }
      v.copy(p).project(camera)
      let x = ((v.x + 1) / 2) * size.width
      let y = ((1 - v.y) / 2) * size.height
      el.style.visibility = v.z > 1 ? 'hidden' : 'visible'
      // data-clamp: keep it on screen, pinned to the nearest edge (for things worth chasing).
      if (el.dataset.clamp !== undefined) {
        const cx = Math.min(Math.max(x, 60), size.width - 60)
        const cy = Math.min(Math.max(y, 210), size.height - 110)
        el.classList.toggle('edge', cx !== x || cy !== y)
        x = cx
        y = cy
      }
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
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
