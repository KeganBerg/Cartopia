import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Spherical, Vector3, type OrthographicCamera } from 'three'
import type { RefObject } from 'react'
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
// How quickly the camera catches up with where the fingers have put it (higher is
// snappier), and how quickly a flick coasts to a stop. Both per second, so the feel
// is the same at 30 and 120 frames a second.
const FOLLOW = 16
const COAST = 3.2

const fwdV = new Vector3()
const rightV = new Vector3()
const move = new Vector3()
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const fovFor = (w: number, h: number) => (w < h ? FREE.fovTall : FREE.fovWide)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

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
  // Heading into someone's town, or back home, starts on the bird's-eye view.
  const town = useGame((s) => s.visiting?.ownerId ?? null)
  const was = useRef(town)
  useEffect(() => {
    if (was.current !== town) setFreeCam(false)
    was.current = town
  }, [town])
  return on && mode === 'play' ? (
    <>
      <Rig />
      <Horizon />
    </>
  ) : null
}

const UP = new Vector3(0, 1, 0)
const off = new Vector3()
const sph = new Spherical()

// Where the camera is (cur) and where the player's gestures have sent it (goal):
// the spot it looks at, how far round (yaw), how far tipped from straight down
// (pitch), and how far back. The camera eases from one to the other every frame,
// so finger input that arrives unevenly still moves it smoothly.
type Pose = { x: number; z: number; yaw: number; pitch: number; dist: number }
type Rig = {
  cur: Pose
  goal: Pose
  // Flick momentum, in units (or radians) a second.
  vel: { x: number; z: number; yaw: number }
  held: boolean
  swoop: { t: number; from: Pose; to: Pose } | null
}
const keepIn = (p: Pose) => {
  p.x = clamp(p.x, -ROAM, ROAM)
  p.z = clamp(p.z, -ROAM, ROAM)
  p.pitch = clamp(p.pitch, FREE.minPolar, FREE.maxPolar)
  p.dist = clamp(p.dist, FREE.minDist, FREE.maxDist)
}

function Rig() {
  const get = useThree((s) => s.get)
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)
  const cam = useRef<PerspectiveCamera | null>(null)
  const rig = useRef<Rig | null>(null)

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
    sph.setFromVector3(offset)
    const from = { x: VIEW.x, z: VIEW.z, yaw: sph.theta, pitch: sph.phi, dist }
    const to = { ...from, yaw: from.yaw + Math.PI, pitch: SWOOP_TILT, dist: dist * SWOOP_IN }
    keepIn(to)
    rig.current = { cur: { ...from }, goal: { ...from }, vel: { x: 0, z: 0, yaw: 0 }, held: false, swoop: { t: 0, from, to } }
    cam.current = c
    // Dev builds only: lets headless screenshot scripts set a pose.
    if (import.meta.env.DEV) (window as unknown as { __freeRig?: unknown }).__freeRig = rig
    place(c, from)
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
      rig.current = null
    }
  }, [get, set])

  useEffect(() => {
    const c = cam.current
    if (!c) return
    c.aspect = size.width / Math.max(1, size.height)
    c.fov = fovFor(size.width, size.height)
    c.updateProjectionMatrix()
  }, [size])

  useGestures(rig, cam)
  const keys = useKeys()

  useFrame((_, delta) => {
    const c = cam.current
    const r = rig.current
    if (!c || !r) return
    const dt = Math.min(delta, 0.1)
    const { goal, cur, vel } = r
    // Opening swoop: steer the goal along an eased path; anything the player does
    // ends it and takes over from wherever it got to.
    if (r.swoop) {
      const w = r.swoop
      w.t = Math.min(1, w.t + Math.min(delta, 0.25) / SWOOP)
      const e = ease(w.t)
      goal.yaw = w.from.yaw + (w.to.yaw - w.from.yaw) * e
      goal.pitch = w.from.pitch + (w.to.pitch - w.from.pitch) * e
      goal.dist = w.from.dist + (w.to.dist - w.from.dist) * e
      Object.assign(cur, goal)
      if (w.t >= 1) r.swoop = null
    }
    // A flick keeps gliding after the finger lifts, slowing to a stop.
    if (!r.held && (vel.x || vel.z || vel.yaw)) {
      goal.x += vel.x * dt
      goal.z += vel.z * dt
      goal.yaw += vel.yaw * dt
      const k = Math.exp(-COAST * dt)
      vel.x *= k
      vel.z *= k
      vel.yaw *= k
      if (Math.hypot(vel.x, vel.z) < 0.05 && Math.abs(vel.yaw) < 0.002) vel.x = vel.z = vel.yaw = 0
    }
    // Keyboard flying (PC): WASD or arrows glide over the ground the way the camera
    // faces, Space rises and Shift sinks, Ctrl goes three times as fast. Faster the
    // further out the camera is.
    const k = keys.current
    if (k.size) {
      r.swoop = null
      const boost = k.has('ControlLeft') || k.has('ControlRight') ? 3 : 1
      const speed = (12 + goal.dist * 0.9) * dt * boost
      fwdV.set(-Math.sin(goal.yaw), 0, -Math.cos(goal.yaw))
      rightV.crossVectors(fwdV, UP)
      move.set(0, 0, 0)
      if (k.has('KeyW') || k.has('ArrowUp')) move.add(fwdV)
      if (k.has('KeyS') || k.has('ArrowDown')) move.sub(fwdV)
      if (k.has('KeyD') || k.has('ArrowRight')) move.add(rightV)
      if (k.has('KeyA') || k.has('ArrowLeft')) move.sub(rightV)
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed)
        goal.x += move.x
        goal.z += move.z
      }
      const lift = (k.has('Space') ? 1 : 0) - (k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0)
      if (lift) {
        // Rise or sink straight up: same spot on the ground, so the camera tips to keep it in view.
        const flat = goal.dist * Math.sin(goal.pitch)
        const y = Math.max(1, goal.dist * Math.cos(goal.pitch) + lift * speed * 0.7)
        goal.dist = Math.hypot(flat, y)
        goal.pitch = Math.atan2(flat, y)
      }
    }
    keepIn(goal)
    // Ease towards the goal. Turning takes the short way round.
    const f = 1 - Math.exp(-FOLLOW * dt)
    cur.x += (goal.x - cur.x) * f
    cur.z += (goal.z - cur.z) * f
    cur.yaw += (goal.yaw - cur.yaw) * f
    cur.pitch += (goal.pitch - cur.pitch) * f
    cur.dist *= (goal.dist / cur.dist) ** f
    place(c, cur)
  })
  return null
}

// Puts the camera at a pose, never under the ground or the hills past town.
function place(c: PerspectiveCamera, p: Pose) {
  VIEW.set(p.x, 0, p.z)
  sph.set(p.dist, p.pitch, p.yaw)
  c.position.copy(VIEW).add(off.setFromSpherical(sph))
  const floor = Math.max(0, heightAt(c.position.x, c.position.z)) + 1.2
  if (c.position.y < floor) c.position.y = floor
  c.lookAt(VIEW)
}

// Touch and mouse, all feeding the goal pose:
// - one finger (or the left mouse button) drags the ground, and a flick keeps it gliding;
// - two fingers pinch to zoom, twist to turn, and drag together to tilt and turn;
// - the right mouse button turns and tilts, the wheel zooms.
// A two-finger gesture picks pinch-and-twist or tilt once the fingers have moved a
// little and sticks with it, so a pinch doesn't wobble the tilt and a tilt doesn't zoom.
function useGestures(rig: RefObject<Rig | null>, cam: RefObject<PerspectiveCamera | null>) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const el = gl.domElement
    const pts = new Map<number, { x: number; y: number; button: number }>()
    // Two-finger gesture state: the last centre, spread and angle, and which kind it is.
    let two: { cx: number; cy: number; d: number; a: number; kind: 'pending' | 'pinch' | 'tilt' } | null = null
    let last = 0
    const pair = () => {
      const [p, q] = [...pts.values()]
      return { cx: (p.x + q.x) / 2, cy: (p.y + q.y) / 2, d: Math.hypot(q.x - p.x, q.y - p.y), a: Math.atan2(q.y - p.y, q.x - p.x) }
    }
    // World units per screen pixel at the spot the camera looks at.
    const unit = () => {
      const c = cam.current
      const r = rig.current
      if (!c || !r) return 0
      return (2 * r.cur.dist * Math.tan((c.fov * Math.PI) / 360)) / Math.max(1, el.clientHeight)
    }
    const grab = (r: Rig) => {
      r.swoop = null
      r.held = true
    }
    const pan = (r: Rig, dx: number, dy: number, dt: number) => {
      const u = unit()
      // Up and down the screen covers more ground the lower the camera is tipped.
      const v = u / Math.max(0.35, Math.cos(r.cur.pitch))
      const sin = Math.sin(r.goal.yaw)
      const cos = Math.cos(r.goal.yaw)
      // The ground follows the finger: drag right and the spot in view moves left.
      const mx = -dx * u * cos - dy * v * sin
      const mz = dx * u * sin - dy * v * cos
      r.goal.x += mx
      r.goal.z += mz
      // Keep a smoothed speed for the flick on release.
      if (dt > 0) {
        const k = Math.min(1, dt / 0.06)
        r.vel.x += (mx / dt - r.vel.x) * k
        r.vel.z += (mz / dt - r.vel.z) * k
      }
    }
    const turn = (r: Rig, dyaw: number, dpitch: number, dt: number) => {
      r.goal.yaw += dyaw
      r.goal.pitch += dpitch
      if (dt > 0) r.vel.yaw += (dyaw / dt - r.vel.yaw) * Math.min(1, dt / 0.06)
    }
    const reset = (now: number) => {
      const r = rig.current
      if (r) r.vel.x = r.vel.z = r.vel.yaw = 0
      two = pts.size === 2 ? { ...pair(), kind: 'pending' } : null
      last = now
    }

    const down = (e: PointerEvent) => {
      const r = rig.current
      if (!r || pts.size >= 2) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button })
      el.setPointerCapture?.(e.pointerId)
      grab(r)
      reset(e.timeStamp)
    }
    const moveP = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      const r = rig.current
      if (!p || !r) return
      const dt = Math.max(0.001, (e.timeStamp - last) / 1000)
      if (pts.size === 1) {
        const dx = e.clientX - p.x
        const dy = e.clientY - p.y
        p.x = e.clientX
        p.y = e.clientY
        last = e.timeStamp
        // Right button (or Ctrl/Shift with the left) turns and tilts; otherwise drag the ground.
        if (e.pointerType === 'mouse' && (p.button === 2 || e.ctrlKey || e.shiftKey)) turn(r, (-dx * 2 * Math.PI) / el.clientHeight, (-dy * Math.PI) / el.clientHeight, 0)
        else pan(r, dx, dy, dt)
        return
      }
      p.x = e.clientX
      p.y = e.clientY
      if (!two) return
      const now = pair()
      const dcx = now.cx - two.cx
      const dcy = now.cy - two.cy
      let da = now.a - two.a
      if (da > Math.PI) da -= Math.PI * 2
      if (da < -Math.PI) da += Math.PI * 2
      const ratio = two.d / Math.max(1, now.d)
      if (two.kind === 'pending') {
        // Until it's clear, measure from where the fingers started: moving together tilts;
        // moving apart, together or round each other pinches and twists.
        const shift = Math.hypot(dcx, dcy)
        const spread = Math.abs(now.d - two.d) + Math.abs(da) * now.d * 0.5
        if (shift > 14 && shift > spread * 1.5) two.kind = 'tilt'
        else if (spread > 14) two.kind = 'pinch'
        else return
      }
      if (two.kind === 'tilt') {
        turn(r, (-dcx * 2 * Math.PI) / el.clientHeight, (-dcy * Math.PI) / el.clientHeight, dt)
      } else {
        r.goal.dist *= ratio
        // Twisting the fingers clockwise turns the town clockwise on screen.
        turn(r, da, 0, dt)
        pan(r, dcx, dcy, dt)
      }
      two.cx = now.cx
      two.cy = now.cy
      two.d = now.d
      two.a = now.a
      last = e.timeStamp
    }
    const up = (e: PointerEvent) => {
      if (!pts.delete(e.pointerId)) return
      const r = rig.current
      if (!r) return
      // Lifting one of two fingers carries on as a one-finger drag from where it is, without a jump.
      if (pts.size === 1) return reset(e.timeStamp)
      if (pts.size === 0) {
        r.held = false
        two = null
        // A finger that stopped before lifting shouldn't fling.
        if (e.timeStamp - last > 80) r.vel.x = r.vel.z = r.vel.yaw = 0
      }
    }
    const wheel = (e: WheelEvent) => {
      const r = rig.current
      if (!r) return
      e.preventDefault()
      r.swoop = null
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      r.goal.dist *= Math.exp(clamp(px, -200, 200) * 0.0015)
    }
    const menu = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', moveP)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('contextmenu', menu)
    const touch = el.style.touchAction
    el.style.touchAction = 'none'
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', moveP)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('lostpointercapture', up)
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('contextmenu', menu)
      el.style.touchAction = touch
    }
  }, [gl, rig, cam])
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
