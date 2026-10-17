import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Object3D } from 'three'
import type { Group, InstancedMesh } from 'three'
import { dayPhase, isNight, nightAmount } from '../game/clock'
import { SHIRTS, PANTS, SKIN, HAIR } from './people'
import { CarModel, carFrame, carSize, wheelRig, type WheelRig } from './CarModel'
import { bodyScale } from './townCarSize'
import { signTexture } from './signTexture'
import { Upright, useMergeScale } from './mergeScale'
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
  // The spot each person stands on, so a merged block keeps them in one piece.
  const spot = useMemo(() => new Float32Array(n * 3), [n])
  const feet = useMemo(() => ({ noBatch: true, feet: (i: number) => spot.subarray(i * 3, i * 3 + 3) }), [spot])
  const legFeet = useMemo(() => ({ noBatch: true, feet: (i: number) => spot.subarray((i >> 1) * 3, (i >> 1) * 3 + 3) }), [spot])

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
      spot.set([sx, 0, sz], i * 3)
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
      <instancedMesh ref={torso} args={[undefined, undefined, n]} frustumCulled={false} castShadow userData={feet}>
        <capsuleGeometry args={[0.085, 0.16, 3, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, n]} frustumCulled={false} userData={feet}>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={hair} args={[undefined, undefined, n]} frustumCulled={false} userData={feet}>
        <sphereGeometry args={[0.078, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, n * 2]} frustumCulled={false} userData={legFeet}>
        <boxGeometry args={[0.055, 0.24, 0.055]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  )
}

// ---- Learner cars ----

// The academy's own learner cars: full car models at town traffic size, each in a
// school colour with a STUDENT DRIVER topper on the roof. Driving ones (with a
// wheel `rig`) light the road ahead after dark, like town traffic. The little
// one is the plain compact, not the Kipper Pocket: its roof rack and box would
// bury the topper. Every learner has a hard roof for the topper to stand on.
const CAR_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047']
const LEARNERS: { body: Body; model?: string }[] = [
  { body: 'compact' },
  { body: 'hatch', model: 'hotshot' },
  { body: 'sedan', model: 'civic' },
]

// One prop with its topper, even outside an Upright (see keepProps).
const WHOLE = { whole: true }

export function LearnerCar({ i, at, rot = 0, rig, body: tilt }: { i: number; at?: [number, number, number]; rot?: number; rig?: WheelRig; body?: (g: Group | null) => void }) {
  const { body, model } = LEARNERS[i % LEARNERS.length]
  const k = bodyScale(body)
  // The topper stands on the hard roof, over the middle of it.
  const { roof, roofZ } = useMemo(() => carFrame(body, model), [body, model])
  return (
    <group position={at} rotation-y={rot} userData={WHOLE}>
      <group scale={k} ref={tilt}>
        <CarModel body={body} model={model} color={CAR_COLORS[i % CAR_COLORS.length]} rig={rig} beams={!!rig} />
        <group position={[0, roof, roofZ]}>
          {/* Two little magnetic feet, the sign board and STUDENT on both faces. */}
          {[-0.09, 0.09].map((x) => (
            <mesh key={x} position={[x, 0.012, 0]}>
              <boxGeometry args={[0.05, 0.024, 0.05]} />
              <meshStandardMaterial color="#263238" />
            </mesh>
          ))}
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[0.28, 0.09, 0.06]} />
            <meshStandardMaterial color="#ffeb3b" emissive="#ffc400" emissiveIntensity={0.35} />
          </mesh>
          {[1, -1].map((f) => (
            <mesh key={f} position={[0, 0.07, f * 0.036]} rotation-y={f > 0 ? 0 : Math.PI}>
              <planeGeometry args={[0.26, 0.07]} />
              <meshBasicMaterial map={signTexture('STUDENT', '#ffeb3b', '#212121')} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

// How the class drives. Speeds in lot units a second; the pedals are gentle.
const CRUISE = 0.42
const BRAKE_FOR = 0.3 // how much a bend ahead slows them
const LOOK = 0.6 // how far ahead a learner looks for the next bend
const ACCEL = 0.22 // pulling away
const DECEL = 0.45 // braking
const GAP = 0.22 // space kept to the car in front, bumper to bumper
const WAIT = 1.6 // seconds stopped at the stop line, give or take
const MAX_LOCK = 0.26 // front wheel steering limit, radians

// Half each learner's length at town size, bumper to middle.
const halfLen = (i: number) => {
  const b = LEARNERS[i % LEARNERS.length].body
  return (carSize(b).len * bodyScale(b)) / 2
}

const CLASS = { noBatch: true, stretch: true }
const STRETCH = { stretch: true }

type Learner = { d: number; v: number; steer: number; lean: number; pitch: number; wait: number; stopped: boolean; go: boolean }

// Learner cars driving the course on a smooth line. Each one eases off for
// bends, comes to a full stop with its nose at the stop line (`stop`, a
// distance along the drive), waits, looks, and pulls away again; behind it the
// others queue a safe gap back instead of running into it. The front wheels
// steer into each bend, the body leans a touch out of it, and the nose dips
// under braking and lifts as it pulls away.
export function StudentCars({ n, drive, stop }: { n: number; drive: Drive; stop?: number }) {
  const cars = useRef<(Group | null)[]>([])
  const bodies = useRef<(Group | null)[]>([])
  const rigs = useMemo(() => Array.from({ length: n }, (_, i) => wheelRig(LEARNERS[i % LEARNERS.length].body)), [n])
  const fresh = (i: number): Learner => ({ d: (drive.len * i) / n, v: 0, steer: 0, lean: 0, pitch: 0, wait: 0, stopped: false, go: false })
  const state = useRef(Array.from({ length: n }, (_, i) => fresh(i)))
  const pose = useMemo<DrivePose>(() => ({ x: 0, z: 0, yaw: 0, curv: 0 }), [])
  // In a merged block the course stretches but the cars stay true size
  // (Upright size 1), so speeds, gaps and the stop are worked out in true
  // lengths: `f` is how long one unit of the course is drawn, the way a car faces.
  const [sx, , sz] = useMergeScale()
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const all = state.current
    for (let i = 0; i < n; i++) all[i] ??= fresh(i)
    const len = drive.len
    for (let i = 0; i < n; i++) {
      const g = cars.current[i]
      const st = all[i]
      if (!g) continue
      const k = bodyScale(LEARNERS[i % LEARNERS.length].body)
      const half = halfLen(i)
      drive.at(st.d, pose)
      const f = Math.hypot(Math.sin(pose.yaw) * sx, Math.cos(pose.yaw) * sz)
      // The speed this stretch allows: slower into bends.
      let want = CRUISE / (1 + BRAKE_FOR * drive.bend(st.d, st.d + LOOK))
      // Keep a gap to whoever is next ahead: room to stop from this speed.
      let room = Infinity
      for (let j = 0; j < n; j++) {
        if (j === i) continue
        const ahead = (((all[j].d - st.d) % len) + len) % len
        room = Math.min(room, ahead * f - half - halfLen(j) - GAP)
      }
      want = Math.min(want, Math.sqrt(2 * DECEL * Math.max(0, room)))
      // Stop with the nose on the line, wait, then pull away (`go` until it's over the line).
      // Signed, so a car that's just reached the line reads 0, not a whole lap to go.
      const toLine = stop == null ? Infinity : (((((stop - half / f - st.d) % len) + len * 1.5) % len) - len / 2) * f
      if (st.go && toLine > 0.3) st.go = false
      if (st.stopped) {
        want = 0
        st.wait -= dt
        if (st.wait <= 0) [st.stopped, st.go] = [false, true]
      } else if (!st.go && toLine > -0.05 && toLine < (len * f) / 2) {
        if (toLine < 0.004 && st.v < 0.03) {
          st.stopped = true
          st.wait = WAIT + ((i * 0.37) % 0.6)
          want = 0
        } else want = Math.min(want, Math.sqrt(2 * DECEL * 0.8 * Math.max(0, toLine)))
      }
      const was = st.v
      st.v = want > st.v ? Math.min(want, st.v + ACCEL * dt) : Math.max(want, st.v - DECEL * 1.6 * dt)
      // Never roll over the line on the way in.
      if (!st.go && toLine > -0.05 && toLine < (len * f) / 2) st.v = Math.min(st.v, Math.max(0, toLine) / Math.max(dt, 1e-3))
      st.d = (st.d + (st.v * dt) / f) % len
      drive.at(st.d, pose)
      g.position.set(pose.x, 0.06, pose.z)
      g.rotation.y = pose.yaw
      // Front wheels turn to the bend's angle for this wheelbase, smoothed like hands on a wheel.
      // Kept to a modest lock: the close-up model's brake discs are part of the body and
      // don't turn, so a full lock would push them out through the tyres.
      const rig = rigs[i]
      const lock = Math.max(-MAX_LOCK, Math.min(MAX_LOCK, Math.atan((pose.curv / f) * rig.base * k)))
      st.steer += (lock - st.steer) * Math.min(1, dt * 6)
      for (const w of rig.steer) if (w) w.rotation.y = st.steer
      const roll = (st.v * dt) / (rig.radius * k)
      for (const w of rig.spin) if (w) w.rotation.x = (w.rotation.x + roll) % (Math.PI * 2)
      // Body leans out of the turn a touch, and pitches with the pedals.
      st.lean += ((-pose.curv / f) * st.v * st.v * 0.35 - st.lean) * Math.min(1, dt * 4)
      const accel = (st.v - was) / Math.max(dt, 1e-3)
      st.pitch += (Math.max(-0.02, Math.min(0.025, -accel * 0.06)) - st.pitch) * Math.min(1, dt * 5)
      const b = bodies.current[i]
      if (b) b.rotation.set(st.pitch, 0, Math.max(-0.05, Math.min(0.05, st.lean)))
    }
  })
  // Merged, the class drives the stretched course: the layer and each car's
  // moving group are marked to stretch, so keepProps never mistakes them for one
  // prop (they all sit on the same spot before the first frame) and pins the
  // whole class to the middle of the lot. Only each car itself keeps its shape.
  return (
    <group userData={CLASS}>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} ref={(el) => { cars.current[i] = el }} userData={STRETCH}>
          {/* Merged, each car keeps its shape and its topper wherever it drives. */}
          <Upright size={1}><LearnerCar i={i} rig={rigs[i]} body={(el) => { bodies.current[i] = el }} /></Upright>
        </group>
      ))}
    </group>
  )
}
