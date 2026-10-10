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
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.visibility = v.z > 1 ? 'hidden' : 'visible'
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
