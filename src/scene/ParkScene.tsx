import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, Mesh, MeshStandardMaterial, PerspectiveCamera } from 'three'
import { CarModel, carFrame } from './CarModel'
import { SkyEnv } from './SkyEnv'
import { holdTown } from './renderGate'
import { PARK_LEN, PARK_MAX_BUMPS, PARKED_W, carHits, drive, parkedIn, type Box, type ParkLot, type Pose } from '../game/arcade'
import type { Body } from '../game/data'
import type { ChaseCar } from './ChaseScene'
import { bumpSound } from '../lib/arcadeSound'

// The screen writes the held controls here: steer +1 is left, pedal +1 is gas, -1 reverse.
export type ParkInput = { steer: number; pedal: number }
export type ParkHud = { time: number; bumps: number; inSpot: boolean }
export type ParkEnd = { parked: boolean; time: number; bumps: number }

const PARKED: { body: Body; color: string }[] = [
  { body: 'sedan', color: '#90a4ae' }, { body: 'compact', color: '#ffb74d' }, { body: 'suv', color: '#4e6e8e' },
  { body: 'hatch', color: '#ef5350' }, { body: 'wagon', color: '#81c784' }, { body: 'van', color: '#e0e0e0' },
  { body: 'classic', color: '#4dd0e1' }, { body: 'coupe', color: '#ba68c8' }, { body: 'truck', color: '#a1887f' },
  { body: 'ev', color: '#fff176' },
]
const MAX_FWD = 3.4
const MAX_REV = 2.2

function Line({ x, z, h, w, l, color = '#f5f5f5', y = 0.011 }: { x: number; z: number; h: number; w: number; l: number; color?: string; y?: number }) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, h]}>
      <planeGeometry args={[w, l]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

// A box's outline as four painted lines.
function Outline({ b, t, color }: { b: Box; t: number; color: string }) {
  const c = Math.cos(b.h), s = Math.sin(b.h)
  const at = (lx: number, lz: number): [number, number] => [b.x + lx * c + lz * s, b.z - lx * s + lz * c]
  const sides: [number, number, number, number][] = [[-b.w / 2, 0, t, b.l], [b.w / 2, 0, t, b.l], [0, -b.l / 2, b.w + t, t], [0, b.l / 2, b.w + t, t]]
  return (
    <>
      {sides.map(([lx, lz, w, l], i) => {
        const [x, z] = at(lx, lz)
        return <Line key={i} x={x} z={z} h={b.h} w={w} l={l} color={color} y={0.014} />
      })}
    </>
  )
}

export function ParkScene({ lot, me, input, running, onHud, onEnd }: {
  lot: ParkLot; me: ChaseCar; input: ParkInput; running: boolean
  onHud: (h: ParkHud) => void; onEnd: (e: ParkEnd) => void
}) {
  useEffect(() => holdTown(), [])
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  useLayoutEffect(() => {
    // Fit the whole lot; on a wide screen turn the view so the lot's long side runs across it.
    const wide = size.width > size.height
    const ratio = size.width / size.height
    const long = lot.l / 2 + 1.2, short = lot.w / 2 + 1.2
    const half = Math.tan(((camera.fov / 2) * Math.PI) / 180)
    // Extra height leaves room for the controls over the edges of the lot.
    const height = 1.18 * (wide ? Math.max(short / half, long / (half * ratio)) : Math.max(long / half, short / (half * ratio)))
    if (wide) {
      camera.up.set(1, 0, 0)
      camera.position.set(-height * 0.28, height, 0)
    } else {
      camera.up.set(0, 0, -1)
      camera.position.set(0, height, height * 0.28)
    }
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, size, lot])

  const carW = Math.min(PARKED_W, Math.max(0.55, (PARK_LEN * carFrame(me.body).wid) / carFrame(me.body).len))
  const scale = PARK_LEN / carFrame(me.body).len
  const player = useRef<Group>(null)
  const spotFill = useRef<Mesh>(null)
  const st = useRef({ pose: { ...lot.start } as Pose, v: 0, steer: 0, t: 0, bumps: 0, cool: 0, hold: 0, done: false, hudAt: 0, inSpot: false })
  useEffect(() => {
    st.current = { pose: { ...lot.start }, v: 0, steer: 0, t: 0, bumps: 0, cool: 0, hold: 0, done: false, hudAt: 0, inSpot: false }
  }, [lot])

  const parked = useMemo(() => lot.cars.map((p, i) => ({ ...p, look: PARKED[(i * 3 + lot.name.length) % PARKED.length] })), [lot])

  useFrame((state, rawDt) => {
    const s = st.current
    const dt = Math.min(rawDt, 1 / 20)
    const live = running && !s.done
    if (live) s.t += dt
    const pedal = live ? input.pedal : 0
    if (pedal > 0) s.v = Math.min(MAX_FWD, s.v + (s.v < 0 ? 9 : 4) * dt)
    else if (pedal < 0) s.v = Math.max(-MAX_REV, s.v - (s.v > 0 ? 9 : 4) * dt)
    else s.v = Math.sign(s.v) * Math.max(0, Math.abs(s.v) - 6 * dt)
    s.steer += ((live ? input.steer : 0) * 0.62 - s.steer) * Math.min(1, dt * 8)
    s.cool = Math.max(0, s.cool - dt)

    if (s.v !== 0) {
      const next = drive(s.pose, s.v, s.steer, dt)
      if (carHits({ ...next, w: carW, l: PARK_LEN }, lot)) {
        if (s.cool <= 0 && live) {
          s.bumps++
          s.cool = 1
          bumpSound()
        }
        s.v = -s.v * 0.25
      } else s.pose = next
    }

    s.inSpot = parkedIn({ ...s.pose, w: carW, l: PARK_LEN }, lot.spot)
    s.hold = s.inSpot && Math.abs(s.v) < 0.3 && live ? s.hold + dt : 0
    if (live && s.hold > 0.6) {
      s.done = true
      onEnd({ parked: true, time: s.t, bumps: s.bumps })
    } else if (live && s.bumps >= PARK_MAX_BUMPS) {
      s.done = true
      onEnd({ parked: false, time: s.t, bumps: s.bumps })
    }

    if (player.current) {
      player.current.position.set(s.pose.x, 0, s.pose.z)
      player.current.rotation.y = s.pose.h
    }
    if (spotFill.current) {
      const m = spotFill.current.material as MeshStandardMaterial
      m.color.set(s.inSpot ? '#00e676' : '#ffd54f')
      m.opacity = 0.28 + Math.sin(state.clock.elapsedTime * 5) * 0.1 + (s.inSpot ? 0.2 : 0)
    }
    if (state.clock.elapsedTime - s.hudAt > 0.1) {
      s.hudAt = state.clock.elapsedTime
      onHud({ time: s.t, bumps: s.bumps, inSpot: s.inSpot })
    }
  })

  const spot = lot.spot
  return (
    <>
      <color attach="background" args={['#7cb85a']} />
      <hemisphereLight args={['#ffffff', '#6a8f4e', 1.25]} />
      <directionalLight position={[3, 10, 4]} intensity={1.5} />
      <SkyEnv />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#7cb85a" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[lot.w, lot.l]} />
        <meshStandardMaterial color="#555b63" roughness={0.95} />
      </mesh>
      {/* Curbs round the lot. */}
      {[[0, -lot.l / 2 - 0.15, lot.w + 0.6, 0.3], [0, lot.l / 2 + 0.15, lot.w + 0.6, 0.3], [-lot.w / 2 - 0.15, 0, 0.3, lot.l], [lot.w / 2 + 0.15, 0, 0.3, lot.l]].map(([x, z, w, l], i) => (
        <mesh key={i} position={[x, 0.08, z]}>
          <boxGeometry args={[w, 0.16, l]} />
          <meshStandardMaterial color="#d7dade" />
        </mesh>
      ))}
      {/* Trees outside the lot. */}
      {Array.from({ length: 14 }, (_, i) => {
        const sd = i % 2 ? 1 : -1
        const z = -lot.l / 2 + (i / 13) * lot.l
        return (
          <group key={i} position={[sd * (lot.w / 2 + 1.3 + (i % 3) * 0.4), 0, z]}>
            <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.08, 0.1, 0.6, 6]} /><meshStandardMaterial color="#6d4c41" /></mesh>
            <mesh position={[0, 1, 0]}><coneGeometry args={[0.55, 1.3, 7]} /><meshStandardMaterial color="#3f8f3a" flatShading /></mesh>
          </group>
        )
      })}
      {/* Stall lines beside every parked car and the target spot. */}
      {[...lot.cars.map((p) => ({ ...p, w: PARKED_W + 0.5, l: PARK_LEN + 0.6 })), spot].map((b, i) => {
        const c = Math.cos(b.h), s = Math.sin(b.h)
        return [-1, 1].map((sd) => <Line key={`${i}${sd}`} x={b.x + (sd * b.w) / 2 * c} z={b.z - (sd * b.w) / 2 * s} h={b.h} w={0.07} l={b.l} />)
      })}
      <mesh ref={spotFill} position={[spot.x, 0.012, spot.z]} rotation={[-Math.PI / 2, 0, spot.h]}>
        <planeGeometry args={[spot.w, spot.l]} />
        <meshStandardMaterial color="#ffd54f" transparent opacity={0.35} emissive="#ffd54f" emissiveIntensity={0.3} depthWrite={false} />
      </mesh>
      <Outline b={spot} t={0.09} color="#ffd54f" />
      {lot.walls.map((w, i) => (
        <mesh key={i} position={[w.x, 0.3, w.z]} rotation-y={w.h}>
          <boxGeometry args={[w.w, 0.6, w.l]} />
          <meshStandardMaterial color="#b0a596" />
        </mesh>
      ))}
      {lot.cones.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          <mesh position={[0, 0.25, 0]}><coneGeometry args={[0.18, 0.5, 10]} /><meshStandardMaterial color="#ff6d00" /></mesh>
          <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.4, 0.04, 0.4]} /><meshStandardMaterial color="#ff6d00" /></mesh>
          <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.105, 0.125, 0.08, 10]} /><meshStandardMaterial color="#ffffff" /></mesh>
        </group>
      ))}
      {parked.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation-y={p.h}>
          <group scale={PARK_LEN / carFrame(p.look.body).len}>
            <CarModel body={p.look.body} color={p.look.color} />
          </group>
        </group>
      ))}
      <group ref={player} position={[lot.start.x, 0, lot.start.z]} rotation-y={lot.start.h}>
        <group scale={scale}>
          <CarModel body={me.body} model={me.model} color={me.color} finish={me.finish} mods={me.mods} />
        </group>
      </group>
    </>
  )
}
