import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Object3D } from 'three'
import type { Group, InstancedMesh } from 'three'
import { dayPhase, isNight, nightAmount } from '../game/clock'
import { SHIRTS, PANTS, SKIN, HAIR } from './people'
import { CarModel, wheelRig, type WheelRig } from './CarModel'
import { bodyScale } from './townCarSize'
import { signTexture } from './signTexture'
import type { Body } from '../game/data'

// The moving parts of the schools and the driving academy: kids at recess,
// runners on the high school track, students crossing the quad and learner
// cars weaving through the cones. Instanced meshes and noBatch groups, so
// Batch leaves them alone and they can move; a handful of draws per building.

import { type Drive, type DrivePose, type Mover } from './campusPaths'

// When people are about: `school` only in daylight (kids go home at dusk),
// `campus` all day with a few night owls, `always` round the clock.
type Hours = 'school' | 'campus' | 'always'

type CrowdProps = { n: number; move: Mover; hours?: Hours; kids?: boolean; uniform?: string }

const SCALE = 1.3

export function Crowd({ n, move, hours = 'always', kids, uniform }: CrowdProps) {
  const torso = useRef<InstancedMesh>(null)
  const head = useRef<InstancedMesh>(null)
  const hair = useRef<InstancedMesh>(null)
  const legs = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const size = kids ? 0.72 : 1

  useLayoutEffect(() => {
    const c = new Color()
    for (let i = 0; i < n; i++) {
      torso.current?.setColorAt(i, c.set(uniform ?? SHIRTS[(i * 3 + 1) % SHIRTS.length]))
      head.current?.setColorAt(i, c.set(SKIN[(i * 5 + 2) % SKIN.length]))
      hair.current?.setColorAt(i, c.set(HAIR[(i * 7) % HAIR.length]))
      legs.current?.setColorAt(i * 2, c.set(PANTS[i % PANTS.length]))
      legs.current?.setColorAt(i * 2 + 1, c)
    }
    for (const m of [torso.current, head.current, hair.current, legs.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [n, uniform])

  useFrame(({ clock }) => {
    const t = torso.current, hd = head.current, hr = hair.current, lg = legs.current
    if (!t || !hd || !hr || !lg) return
    const night = nightAmount(dayPhase())
    const shown = hours === 'always' ? n : hours === 'school' ? (isNight() ? 0 : n) : Math.max(Math.min(2, n), Math.round(n * (1 - night * 0.8)))
    t.count = hd.count = hr.count = shown
    lg.count = shown * 2
    const time = clock.elapsedTime
    for (let i = 0; i < shown; i++) {
      const [x, z] = move(i, time)
      const [x2, z2] = move(i, time + 0.08)
      const dx = x2 - x, dz = z2 - z
      const speed = Math.hypot(dx, dz) / 0.08
      const heading = speed > 0.01 ? Math.atan2(dx, dz) : (i * 1.7) % (Math.PI * 2)
      const stride = Math.min(1, speed * 1.5)
      const phase = time * (6 + speed * 6) + i
      const sx = x / SCALE, sz = z / SCALE
      const hip = 0.24 * size
      const bob = Math.abs(Math.sin(phase)) * 0.025 * stride
      dummy.rotation.set(0, heading, 0)
      dummy.scale.setScalar(size)
      dummy.position.set(sx, hip + 0.08 * size + bob, sz)
      dummy.updateMatrix()
      t.setMatrixAt(i, dummy.matrix)
      dummy.position.set(sx, hip + 0.29 * size + bob, sz)
      dummy.updateMatrix()
      hd.setMatrixAt(i, dummy.matrix)
      dummy.position.set(sx, hip + 0.33 * size + bob, sz)
      dummy.updateMatrix()
      hr.setMatrixAt(i, dummy.matrix)
      const sin = Math.sin(heading), cos = Math.cos(heading)
      for (const side of [-1, 1]) {
        const swing = Math.sin(phase) * 0.6 * stride * side
        const ox = side * 0.045 * size
        dummy.position.set(sx + cos * ox + sin * Math.sin(swing) * 0.06, hip * 0.5 + bob, sz - sin * ox + cos * Math.sin(swing) * 0.06)
        dummy.rotation.set(swing, heading, 0, 'YXZ')
        dummy.updateMatrix()
        lg.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix)
      }
    }
    for (const m of [t, hd, hr, lg]) m.instanceMatrix.needsUpdate = true
  })

  return (
    <group scale={SCALE}>
      <instancedMesh ref={torso} args={[undefined, undefined, n]} frustumCulled={false} castShadow userData={{ noBatch: true }}>
        <capsuleGeometry args={[0.085, 0.16, 3, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, n]} frustumCulled={false} userData={{ noBatch: true }}>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={hair} args={[undefined, undefined, n]} frustumCulled={false} userData={{ noBatch: true }}>
        <sphereGeometry args={[0.078, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, n * 2]} frustumCulled={false} userData={{ noBatch: true }}>
        <boxGeometry args={[0.055, 0.24, 0.055]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  )
}

// ---- Learner cars ----

// The academy's own learner cars: full car models at town traffic size, each in a
// school colour with a STUDENT DRIVER topper on the roof. Driving ones (with a
// wheel `rig`) light the road ahead after dark, like town traffic.
const CAR_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047']
const LEARNERS: { body: Body; model: string }[] = [
  { body: 'compact', model: 'pip' },
  { body: 'hatch', model: 'hotshot' },
  { body: 'sedan', model: 'civic' },
]

// Roof height of each learner body (CarModel's lift + body + cabin).
const SHAPE_TOP: Record<string, number> = { compact: 0.65, hatch: 0.59, sedan: 0.59 }

export function LearnerCar({ i, at, rot = 0, rig, body: tilt }: { i: number; at?: [number, number, number]; rot?: number; rig?: WheelRig; body?: (g: Group | null) => void }) {
  const { body, model } = LEARNERS[i % LEARNERS.length]
  const k = bodyScale(body)
  const roof = SHAPE_TOP[body] ?? 0.6
  return (
    <group position={at} rotation-y={rot}>
      <group scale={k} ref={tilt}>
        <CarModel body={body} model={model} color={CAR_COLORS[i % CAR_COLORS.length]} rig={rig} beams={!!rig} />
        {/* STUDENT DRIVER topper on two little feet. */}
        <mesh position={[0, roof + 0.05, -0.04]}>
          <boxGeometry args={[0.26, 0.08, 0.07]} />
          <meshStandardMaterial color="#ffeb3b" emissive="#ffc400" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, roof + 0.05, -0.004]}>
          <planeGeometry args={[0.24, 0.06]} />
          <meshBasicMaterial map={signTexture('STUDENT', '#ffeb3b', '#212121')} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

// How the class drives: top speed on the straights, and how much a bend ahead slows them.
const CRUISE = 0.4
const BRAKE_FOR = 0.25
const LOOK = 0.55 // how far ahead a learner looks for the next bend

// Learner cars driving the course on a smooth line: they ease off before each
// bend, steer the front wheels into it, lean a little and roll out again. Every
// car follows the same speed for each spot on the course (times the class's
// shared hesitation), so they keep their spacing and never run into each other.
export function StudentCars({ n, drive }: { n: number; drive: Drive }) {
  const cars = useRef<(Group | null)[]>([])
  const bodies = useRef<(Group | null)[]>([])
  const rigs = useMemo(() => Array.from({ length: n }, (_, i) => wheelRig(LEARNERS[i % LEARNERS.length].body)), [n])
  const state = useRef(Array.from({ length: n }, (_, i) => ({ d: (drive.len * i) / n, v: 0, steer: 0, lean: 0 })))
  const pose = useMemo<DrivePose>(() => ({ x: 0, z: 0, yaw: 0, curv: 0 }), [])
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1)
    const time = clock.elapsedTime
    // The whole class hesitates now and then, as if the instructor called a stop.
    const hesitate = 0.55 + 0.45 * Math.min(1, Math.max(0, 0.5 + Math.sin(time * 0.23) * 1.4))
    for (let i = 0; i < n; i++) {
      const g = cars.current[i]
      const st = (state.current[i] ??= { d: (drive.len * i) / n, v: 0, steer: 0, lean: 0 })
      if (!g) continue
      const k = bodyScale(LEARNERS[i % LEARNERS.length].body)
      const target = (CRUISE / (1 + BRAKE_FOR * drive.bend(st.d, st.d + LOOK))) * hesitate
      // Gentle on the pedals: speed eases toward the target.
      st.v += (target - st.v) * Math.min(1, dt * 1.8)
      st.d += st.v * dt
      drive.at(st.d, pose)
      g.position.set(pose.x, 0.06, pose.z)
      g.rotation.y = pose.yaw
      // Front wheels turn to the bend's angle for this wheelbase, smoothed like hands on a wheel.
      const rig = rigs[i]
      const want = Math.max(-0.55, Math.min(0.55, Math.atan(pose.curv * rig.base * k)))
      st.steer += (want - st.steer) * Math.min(1, dt * 6)
      for (const w of rig.steer) if (w) w.rotation.y = st.steer
      const roll = (st.v * dt) / (rig.radius * k)
      for (const w of rig.spin) if (w) w.rotation.x = (w.rotation.x + roll) % (Math.PI * 2)
      // Body leans out of the turn a touch.
      st.lean += (-pose.curv * st.v * st.v * 0.35 - st.lean) * Math.min(1, dt * 4)
      const b = bodies.current[i]
      if (b) b.rotation.z = Math.max(-0.06, Math.min(0.06, st.lean))
    }
  })
  return (
    <group userData={{ noBatch: true }}>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} ref={(el) => { cars.current[i] = el }}>
          <LearnerCar i={i} rig={rigs[i]} body={(el) => { bodies.current[i] = el }} />
        </group>
      ))}
    </group>
  )
}
