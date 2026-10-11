import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Spherical, Vector3, type OrthographicCamera } from 'three'
import { useGame } from '../game/store'
import { FREE, VIEW, setFreeCam, useFreeCam } from './freeCam'
import { Horizon } from './Horizon'
import { heightAt } from './horizonLand'

// How far from the middle of town the free view may wander.
const ROAM = 150
// The opening move: the camera swoops down from the bird's-eye angle to a lower
// one that shows the skyline, swinging half way round so the building fronts the
// bird's-eye view hides come into sight, over this many seconds.
const SWOOP = 1.9
const SWOOP_TILT = 1.26 // polar angle it ends at (0 straight down, π/2 level)
const SWOOP_IN = 0.72 // and how much closer it comes

const fwdV = new Vector3()
const rightV = new Vector3()
const move = new Vector3()
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
      // The screen may have turned or resized meanwhile, and only the live camera follows that.
      const now = get().size
      ortho.left = -now.width / 2
      ortho.right = now.width / 2
      ortho.top = now.height / 2
      ortho.bottom = -now.height / 2
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
  const keys = useKeys()

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
      sph.theta += Math.PI * de
      sph.radius *= 1 + (s.scale - 1) * de
      c.position.copy(VIEW).add(off.setFromSpherical(sph))
      c.lookAt(VIEW)
    }
    // Keyboard flying (PC): WASD or arrows glide over the ground the way the camera
    // faces, Space rises and Shift sinks, Ctrl goes three times as fast. Faster the
    // further out the camera is.
    const k = keys.current
    if (k.size) {
      const dt = Math.min(delta, 0.1)
      const boost = k.has('ControlLeft') || k.has('ControlRight') ? 3 : 1
      const speed = (12 + c.position.distanceTo(VIEW) * 0.9) * dt * boost
      c.getWorldDirection(fwdV).setY(0).normalize()
      rightV.crossVectors(fwdV, UP)
      move.set(0, 0, 0)
      if (k.has('KeyW') || k.has('ArrowUp')) move.add(fwdV)
      if (k.has('KeyS') || k.has('ArrowDown')) move.sub(fwdV)
      if (k.has('KeyD') || k.has('ArrowRight')) move.add(rightV)
      if (k.has('KeyA') || k.has('ArrowLeft')) move.sub(rightV)
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed)
        VIEW.add(move)
        c.position.add(move)
      }
      const lift = (k.has('Space') ? 1 : 0) - (k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0)
      if (lift) {
        c.position.y = Math.max(1, c.position.y + lift * speed * 0.7)
        c.lookAt(VIEW)
      }
    }
    // Keep the view over the town and its fields.
    before.copy(VIEW)
    VIEW.x = Math.max(-ROAM, Math.min(ROAM, VIEW.x))
    VIEW.z = Math.max(-ROAM, Math.min(ROAM, VIEW.z))
    VIEW.y = 0
    if (!before.equals(VIEW)) c.position.add(off.subVectors(VIEW, before))
    // Never sink into the ground or the hills past town.
    const floor = Math.max(0, heightAt(c.position.x, c.position.z)) + 1.2
    if (c.position.y < floor) {
      c.position.y = floor
      c.lookAt(VIEW)
    }
  })
  return null
}


// Keys held down for flying, ignored while typing (chat, names) or with a panel open.
const FLY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight'])
function useKeys() {
  const keys = useRef(new Set<string>())
  useEffect(() => {
    const held = keys.current
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      return !!t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')
    }
    const down = (e: KeyboardEvent) => {
      // Escape goes back to the bird's-eye view.
      if (e.code === 'Escape' && !typing(e) && !useGame.getState().panel) return setFreeCam(false)
      if (!FLY_KEYS.has(e.code) || typing(e) || e.metaKey || e.altKey || useGame.getState().panel) return
      held.add(e.code)
      // Space would otherwise press whichever button has focus, or scroll; Ctrl+S, Ctrl+D
      // and Ctrl+A would save, bookmark or select the page.
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.ctrlKey) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => held.delete(e.code)
    const clear = () => held.clear()
    // Ctrl+W closes the tab before the page ever sees it, so while Ctrl is held for
    // a speed boost the browser asks before leaving instead.
    const leaving = (e: BeforeUnloadEvent) => {
      if (!held.has('ControlLeft') && !held.has('ControlRight')) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', leaving)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    // Opening a panel or chat mid-flight stops the camera.
    const unsub = useGame.subscribe((g) => g.panel && clear())
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      window.removeEventListener('beforeunload', leaving)
      unsub()
    }
  }, [])
  return keys
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
