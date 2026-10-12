import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ComponentRef } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MOUSE, TOUCH, Vector3, type Group, type Mesh, type PerspectiveCamera } from 'three'
import type { Body, Finish, SkinnedSlot, Panels } from '../game/data'
import { CarModel, carFrame } from './CarModel'
import type { HatFit } from '../game/hats'
import { frame, seat, type Bounds } from './fit'
import { SkyEnv } from './SkyEnv'
import { useCanvasDpr } from '../lib/prefs'

type Look = { body: Body; model?: string; color: string; finish?: Finish | null; skin?: string | null; modSkin?: Partial<Record<SkinnedSlot, string>> | null; panels?: Panels | null; stripe?: string | null; mods?: string[] | null; hat?: HatFit | null }

// How big the car's bounding sphere is made, so long trucks and tiny bubble cars both fill the view.
const FIT = 1.05
const VIEW = new Vector3(2.7, 1.9, 2.7)
const SPIN = 0.6
// How far the player can zoom, as a share of the distance that fits the whole car.
const NEAR = 0.3
const FAR = 1.6

const TOUCHY = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const HINT = TOUCHY ? 'Drag to spin · pinch to zoom · two fingers to move' : 'Drag to spin · scroll to zoom · right-drag to move'

// Live readings from a dyno run, written each frame by whoever drives it.
export type DynoFeed = { rpm: number; speed: number }
// On the dyno the car turns side-on to the camera and the floor drops by a roller's height.
const SIDE_ON = -Math.PI / 4

type Orbit = ComponentRef<typeof OrbitControls>
type Handle = { reset: () => void }

// The dyno: a deck with a roller under each axle, in the car's own units.
function Rollers({ body, roll }: { body: Body; roll: React.RefObject<Group | null> }) {
  const f = carFrame(body)
  const r = f.wheel * 0.5
  const len = f.wx ? f.wx * 2 + f.wheel * 1.6 : f.wheel * 1.8
  const deck = f.wz * 2 + r * 6
  return (
    <group ref={roll} userData={{ noFit: true }} visible={false}>
      {/* The deck the rollers sit in, half sunk, with a hazard stripe down each side. */}
      <mesh position={[0, -r * 1.5, 0]}>
        <boxGeometry args={[len + 0.12, r, deck]} />
        <meshStandardMaterial color="#455a64" />
      </mesh>
      {[1, -1].map((x) => (
        <mesh key={x} position={[x * (len / 2 + 0.061), -r * 1.5, 0]}>
          <boxGeometry args={[0.004, r * 0.4, deck]} />
          <meshStandardMaterial color="#ffca28" />
        </mesh>
      ))}
      {[f.wz, -f.wz].map((z) => (
        <group key={z} position={[0, -r, z]}>
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[r, r, len, 20]} />
            <meshStandardMaterial color="#b0bec5" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* Painted stripes so the spin shows. */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation-x={(i * Math.PI * 2) / 3}>
              <boxGeometry args={[len * 0.96, r * 0.32, r * 2.02]} />
              <meshStandardMaterial color="#ffca28" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function Viewer({ look, handle, onTouch, dyno, floorSize }: { look: Look; handle: React.RefObject<Handle | null>; onTouch: (on: boolean) => void; dyno?: DynoFeed | null; floorSize: number }) {
  const turn = useRef<Group>(null)
  const floor = useRef<Mesh>(null)
  const roll = useRef<Group>(null)
  const onDyno = useRef(false)
  const inner = useRef<Group>(null)
  const orbit = useRef<Orbit>(null)
  const bounds = useRef<Bounds>({ r: 1, h: 1 })
  const spinning = useRef(true)
  const camera = useThree((s) => s.camera as PerspectiveCamera)
  const size = useThree((s) => s.size)
  const modKey = (look.mods ?? []).join(',') + (look.hat ? `|${look.hat.id}` : '')

  // Seat the car on the turntable and fit the camera to it. A new body or a
  // resized view starts the view over; trying a part on keeps the player's angle.
  const fitView = () => {
    const g = inner.current
    const t = turn.current
    const c = orbit.current
    if (!g || !t || !c) return
    t.rotation.y = 0
    bounds.current = seat(g, t, (b) => FIT / Math.max(0.05, Math.hypot(b.r, b.h / 2)))
    camera.aspect = size.width / Math.max(1, size.height)
    const at = frame(camera, bounds.current, VIEW, { pad: 0.1 })
    const d = camera.position.distanceTo(at)
    c.target.copy(at)
    c.minDistance = d * NEAR
    c.maxDistance = d * FAR
    // Zoomed right in, the near plane must not slice the car.
    camera.near = Math.min(camera.near, d * NEAR * 0.25)
    camera.far = Math.max(camera.far, d * FAR + 4)
    camera.updateProjectionMatrix()
    c.update()
    c.saveState()
    spinning.current = true
  }
  useLayoutEffect(fitView, [look.body, size.width, size.height])
  // Re-centre for a fitted or tried part without moving the camera.
  useLayoutEffect(() => {
    const g = inner.current
    const t = turn.current
    if (!g || !t) return
    const k = g.scale.x
    seat(g, t, () => k)
  }, [modKey])

  useImperativeHandle(handle, () => ({
    reset: () => {
      orbit.current?.reset()
      if (turn.current) turn.current.rotation.y = 0
      spinning.current = true
      onTouch(false)
    },
  }), [onTouch])

  useFrame((state, dt) => {
    const t = turn.current
    if (!t) return
    if (dyno && !onDyno.current) {
      // Run starts: square the camera up and swing the car side-on by the shortest way.
      onDyno.current = true
      orbit.current?.reset()
      spinning.current = false
      const full = Math.PI * 2
      t.rotation.y = ((((t.rotation.y - SIDE_ON) % full) + full * 1.5) % full) - full / 2 + SIDE_ON
    } else if (!dyno && onDyno.current) {
      onDyno.current = false
      spinning.current = true
      t.position.y = 0
    }
    const g = inner.current
    const drop = dyno && g ? g.scale.x * carFrame(look.body).wheel : 0
    if (floor.current) floor.current.position.y += (-drop - floor.current.position.y) * Math.min(1, dt * 10)
    if (roll.current) roll.current.visible = !!dyno || (floor.current?.position.y ?? 0) < -0.01
    if (dyno) {
      t.rotation.y += (SIDE_ON - t.rotation.y) * Math.min(1, dt * 6)
      // A little shudder that grows with the revs.
      t.position.y = Math.sin(state.clock.elapsedTime * 70) * 0.004 * dyno.rpm
      roll.current?.children.forEach((c) => { if (c.type === 'Group') c.rotation.x += dyno.speed * dt * 0.6 })
    } else if (spinning.current) t.rotation.y += dt * SPIN
  })

  // Keep the aim on the car, so panning can never lose it off screen.
  const clamp = () => {
    const c = orbit.current
    if (!c) return
    const { r, h } = bounds.current
    const t = c.target
    const want = new Vector3()
    const flat = Math.hypot(t.x, t.z)
    const k = flat > r * 0.7 ? (r * 0.7) / flat : 1
    want.set(t.x * k, Math.min(Math.max(t.y, 0), h * 1.1), t.z * k)
    if (want.distanceToSquared(t) < 1e-10) return
    const shift = want.sub(t)
    t.add(shift)
    c.object.position.add(shift)
  }

  return (
    <>
      <OrbitControls
        ref={orbit}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.8}
        zoomSpeed={0.9}
        panSpeed={0.8}
        screenSpacePanning
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2 - 0.06}
        mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
        onStart={() => { spinning.current = false; onTouch(true) }}
        onChange={clamp}
      />
      <mesh ref={floor} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[floorSize, 48]} />
        <meshStandardMaterial color="#cfd8dc" />
      </mesh>
      <group ref={turn}>
        <group ref={inner}>
          <CarModel {...look} />
          <Rollers body={look.body} roll={roll} />
        </group>
      </group>
    </>
  )
}

function Stage({ look, big, onExpand, dyno }: { look: Look; big?: boolean; onExpand?: () => void; dyno?: DynoFeed | null }) {
  const dpr = useCanvasDpr(big ? 2 : 1.5)
  const handle = useRef<Handle>(null)
  const [touched, setTouched] = useState(false)
  return (
    <>
      <Canvas camera={{ position: VIEW.toArray(), fov: 35 }} dpr={dpr}>
        <SkyEnv />
        <hemisphereLight args={['#ffffff', '#90a4ae', 1]} />
        <directionalLight position={[3, 5, 2]} intensity={1.4} />
        <Viewer look={look} handle={handle} onTouch={setTouched} dyno={dyno} floorSize={big ? 3 : 1.5} />
      </Canvas>
      {!dyno && <div className="cp-tools">
        {touched && <button className="cp-btn" title="Reset view" aria-label="Reset view" onClick={() => handle.current?.reset()}>↺</button>}
        {onExpand && <button className="cp-btn" title="Full screen" aria-label="Full screen" onClick={onExpand}>⛶</button>}
      </div>}
      {!touched && !dyno && <div className="cp-hint">{big ? HINT : TOUCHY ? 'Drag · pinch to zoom' : 'Drag · scroll to zoom'}</div>}
    </>
  )
}

// Full-screen look at a car: spin, zoom and pan to see what paint and parts do.
export function CarInspect({ title, onClose, ...look }: Look & { title: string; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  return createPortal(
    <div className="car-inspect" onClick={(e) => e.stopPropagation()}>
      <div className="ci-head">
        <h2>{title}</h2>
        <button className="close" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <div className="ci-view car-preview">
        <Stage look={look} big />
      </div>
    </div>,
    document.body,
  )
}

// Turntable view of a car, used in the garage and when a restored car rolls out.
// Drag to orbit, pinch or scroll to zoom; `onExpand` adds a full-screen button.
// With `dyno` the car sits side-on on spinning rollers, and `children` draw over it.
export function CarPreview({ onExpand, dyno, children, ...look }: Look & { onExpand?: () => void; dyno?: DynoFeed | null; children?: React.ReactNode }) {
  return (
    <div className="car-preview">
      <Stage look={look} onExpand={onExpand} dyno={dyno} />
      {children}
    </div>
  )
}
