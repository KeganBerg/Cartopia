import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3, type OrthographicCamera } from 'three'

// Fingers on the bird's-eye town: one drags the map, two pinch to zoom.
// The spot of ground under the fingers stays under them, the way a phone map
// feels. This replaces MapControls' own touch handling, which let the town
// slide slower than the finger, ignored fingers that landed on a bubble, and
// mixed up a finger resting on the HUD with the one panning.

// Fingers currently on the town (the 3D view or a bubble over it).
const fingers = new Map<number, { x: number; y: number }>()
// How many fingers are on the town, so holding a building doesn't pick it up mid-pinch.
export const townFingers = () => fingers.size

// A press on a bubble only starts moving the map once it has moved this far, so taps still collect.
const SLOP = 8

const GROUND = new Plane(new Vector3(0, 1, 0), 0)
const ray = new Raycaster()
const ndc = new Vector2()
const a = new Vector3()
const b = new Vector3()

type Controls = { target: Vector3; minZoom: number; maxZoom: number; update: () => void }

export function TownTouch({ enabled }: { enabled: boolean }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const controls = useThree((s) => s.controls) as unknown as Controls | null
  const canvas = useThree((s) => s.gl.domElement)

  useEffect(() => {
    if (!enabled || !controls || !camera.isOrthographicCamera) return
    // Bubble presses still waiting to pass the slop.
    const waiting = new Map<number, { x: number; y: number }>()
    // Bubble presses that moved the map: their click mustn't collect.
    let swallow = false

    const groundAt = (x: number, y: number, out: Vector3) => {
      const r = canvas.getBoundingClientRect()
      ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return ray.ray.intersectPlane(GROUND, out)
    }
    const mid = (pts: { x: number; y: number }[]) => {
      let x = 0
      let y = 0
      for (const p of pts) {
        x += p.x
        y += p.y
      }
      return { x: x / pts.length, y: y / pts.length }
    }
    const spread = (pts: { x: number; y: number }[]) => (pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y))

    // Fingers moved from `before` to `after`: zoom by how far apart they spread, then
    // slide the town so the ground under their old midpoint sits under the new one.
    const apply = (before: { x: number; y: number }[], after: { x: number; y: number }[]) => {
      const m0 = mid(before)
      const m1 = mid(after)
      if (!groundAt(m0.x, m0.y, a)) return
      const s0 = spread(before)
      const s1 = spread(after)
      if (s0 > 0 && s1 > 0) {
        const zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, (camera.zoom * s1) / s0))
        if (zoom !== camera.zoom) {
          camera.zoom = zoom
          camera.updateProjectionMatrix()
        }
      }
      camera.updateMatrixWorld()
      if (!groundAt(m1.x, m1.y, b)) return
      a.sub(b)
      a.y = 0
      controls.target.add(a)
      camera.position.add(a)
      controls.update()
    }

    const onTown = (t: EventTarget | null) => t === canvas || (t instanceof Element && !!t.closest('.badges .anchor'))

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !onTown(e.target)) return
      if (fingers.size === 0 && waiting.size === 0) swallow = false
      if (e.target === canvas) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      else waiting.set(e.pointerId, { x: e.clientX, y: e.clientY })
      // A second finger joins a pinch at once, even when it lands on a bubble.
      if (fingers.size + waiting.size < 2) return
      for (const [id, p] of waiting) fingers.set(id, p)
      if (waiting.size) swallow = true
      waiting.clear()
    }
    const move = (e: PointerEvent) => {
      const w = waiting.get(e.pointerId)
      if (w) {
        if (Math.hypot(e.clientX - w.x, e.clientY - w.y) < SLOP) return
        waiting.delete(e.pointerId)
        fingers.set(e.pointerId, w)
        swallow = true
      }
      const f = fingers.get(e.pointerId)
      if (!f || (f.x === e.clientX && f.y === e.clientY)) return
      // Only the first two fingers steer, so a third resting finger can't fight them.
      const ids = [...fingers.keys()].slice(0, 2)
      if (!ids.includes(e.pointerId)) return void fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const before = ids.map((id) => fingers.get(id)!)
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      apply(before, ids.map((id) => fingers.get(id)!))
    }
    const up = (e: PointerEvent) => {
      waiting.delete(e.pointerId)
      fingers.delete(e.pointerId)
    }
    // A bubble that was dragged to move the map doesn't also collect.
    const click = (e: MouseEvent) => {
      if (!swallow || !onTown(e.target) || e.target === canvas) return
      swallow = false
      e.stopPropagation()
      e.preventDefault()
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    window.addEventListener('click', click, true)
    return () => {
      fingers.clear()
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
      window.removeEventListener('click', click, true)
    }
  }, [enabled, controls, camera, canvas])
  return null
}
