import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Spherical, Vector3, type OrthographicCamera } from 'three'
import { useGame } from '../game/store'
import { FREE, VIEW, setFreeCam, useFreeCam } from './freeCam'
import { Horizon } from './Horizon'

// How far from the middle of town the free view may wander.
const ROAM = 150
// The opening move: the camera swoops down from the bird's-eye angle to a lower
// one that shows the skyline, over this many seconds.
const SWOOP = 1.1
const SWOOP_TILT = 1.26 // polar angle it ends at (0 straight down, π/2 level)
const SWOOP_IN = 0.72 // and how much closer it comes

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const fovFor = (w: number, h: number) => (w < h ? FREE.fovTall : FREE.fovWide)

// Mounted with the town. While the free camera is on it swaps in a perspective
// camera (the town's own is orthographic, which can't show a horizon), adds the
// world beyond the town, and hands the bird's-eye camera back when it's done.
export function FreeCam() {
  const on = useFreeCam((s) => s.on)
  const mode = useGame((s) => s.mode)
  // Building tools need the grid view.
  useEffect(() => {
    if (mode !== 'play') setFreeCam(false)
  }, [mode])
  return on && mode === 'play' ? (
    <>
      <Rig />
      <Horizon />
    </>
  ) : null
}

const sph = new Spherical()
const UP = new Vector3(0, 1, 0)
const off = new Vector3()
const before = new Vector3()

function Rig() {
  const get = useThree((s) => s.get)
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)
  const cam = useRef<PerspectiveCamera | null>(null)
  const swoop = useRef({ t: 0, tilt: 0, scale: 1 })

  useLayoutEffect(() => {
    const ortho = get().camera as OrthographicCamera
    if (!ortho.isOrthographicCamera) return
    const { width, height } = get().size
    const offset = ortho.position.clone().sub(VIEW)
    const fov = fovFor(width, height)
    const c = new PerspectiveCamera(fov, width / Math.max(1, height), FREE.near, FREE.far)
    // Start where the bird's-eye view was: same angle, far enough back to frame the same slice of town.
    const frameH = height / ortho.zoom
    const dist = Math.min(FREE.maxDist, frameH / 2 / Math.tan((fov * Math.PI) / 360))
    c.position.copy(VIEW).addScaledVector(offset.clone().normalize(), dist)
    c.lookAt(VIEW)
    cam.current = c
    sph.setFromVector3(off.copy(c.position).sub(VIEW))
    swoop.current = { t: 0, tilt: SWOOP_TILT - sph.phi, scale: SWOOP_IN }
    set({ camera: c })
    return () => {
      // Back to bird's-eye over the spot the free view ended up on.
      ortho.position.copy(VIEW).add(offset)
      ortho.lookAt(VIEW)
      ortho.updateProjectionMatrix()
      set({ camera: ortho })
      cam.current = null
    }
  }, [get, set])

  useEffect(() => {
    const c = cam.current
    if (!c) return
    c.aspect = size.width / Math.max(1, size.height)
    c.fov = fovFor(size.width, size.height)
    c.updateProjectionMatrix()
  }, [size])

  useTwist()

  // Runs after the controls have moved the camera this frame.
  useFrame((_, delta) => {
    const c = cam.current
    if (!c) return
    // Opening swoop, added on top of whatever the player is already doing.
    const s = swoop.current
    if (s.t < 1) {
      const e0 = ease(s.t)
      s.t = Math.min(1, s.t + Math.min(delta, 0.25) / SWOOP)
      const de = ease(s.t) - e0
      sph.setFromVector3(off.copy(c.position).sub(VIEW))
      sph.phi = Math.min(FREE.maxPolar, sph.phi + s.tilt * de)
      sph.radius *= 1 + (s.scale - 1) * de
      c.position.copy(VIEW).add(off.setFromSpherical(sph))
      c.lookAt(VIEW)
    }
    // Keep the view over the town and its fields.
    before.copy(VIEW)
    VIEW.x = Math.max(-ROAM, Math.min(ROAM, VIEW.x))
    VIEW.z = Math.max(-ROAM, Math.min(ROAM, VIEW.z))
    VIEW.y = 0
    if (!before.equals(VIEW)) c.position.add(off.subVectors(VIEW, before))
  })
  return null
}


// Twisting two fingers turns the view round, like a map app. (Dragging two
// fingers tilts and turns, and pinching zooms; the controls do those.)
function useTwist() {
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)
  useEffect(() => {
    const el = gl.domElement
    const pts = new Map<number, { x: number; y: number }>()
    let last: number | null = null
    const angle = () => {
      const [a, b] = [...pts.values()]
      return Math.atan2(b.y - a.y, b.x - a.x)
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      last = pts.size === 2 ? angle() : null
    }
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      p.x = e.clientX
      p.y = e.clientY
      if (pts.size !== 2 || last === null) return
      const a = angle()
      let d = a - last
      if (d > Math.PI) d -= Math.PI * 2
      if (d < -Math.PI) d += Math.PI * 2
      last = a
      // Turning the fingers clockwise turns the town clockwise on screen.
      const c = get().camera
      off.copy(c.position).sub(VIEW).applyAxisAngle(UP, d)
      c.position.copy(VIEW).add(off)
      c.lookAt(VIEW)
    }
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      last = pts.size === 2 ? angle() : null
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl, get])
}
