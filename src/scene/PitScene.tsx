import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CatmullRomCurve3, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three'
import { CarModel, carFrame, wheelRig } from './CarModel'
import { holdTown } from './renderGate'
import { Batch } from './Batch'
import { LAYER, decal } from './layers'
import { asphaltTex, concreteTex, grassTex, shutterTex, towerTex } from './textures'
import { signTexture } from './signTexture'
import { ArcadeSky, CarShadow, Crowd, Grandstand, Lamp, ToolChest, Tyre, TyreStack, useArcadeLook, type Person } from './ArcadeScenery'
import {
  CALL_MISS, CALL_SHOW, GUN_SLIP, PIT_BRAKE, PIT_COAST, PIT_JUMP, PIT_SPEED, PIT_START, gunTimes, pitCall, stopGrade, stopPenalty, type StopGrade,
} from '../game/arcadeMore'
import { CARS, isBike } from '../game/data'
import type { ChaseCar } from './ChaseScene'
import { airSound, buzzSound, dingSound, fuelSound, gunSound, revSound, squealSound, wrenchSound } from '../lib/arcadeSound'

// One whole pit stop. The car comes down the pit lane at the limiter and the player
// brakes it onto the box. The crew jacks it up and every corner's wheel gun runs at
// once: each corner's ring fills, a tap on green undoes the nut, the crew swaps the
// wheel, and a second green tap does the new one up. Then the lollipop man holds the
// car (the clock stops) until the lane is clear, and the player goes on green.

export type PitPhase = 'in' | 'push' | 'wheels' | 'hold' | 'green' | 'go'
// The screen writes the pedal (held = brake, pressed = go), queues taps on the wheel
// rings, and hands over the ring elements so the scene can pin them to the wheels.
export type PitInput = { pedal: boolean; presses: number; taps: number[]; pads: (HTMLElement | null)[] }
export type PitPop = { id: number; text: string; kind: 'good' | 'bad' }
export type PitHud = { phase: PitPhase; left: number; time: number; pop: PitPop | null; calling: boolean }
export type PitEnd = { time: number; slips: number; grade: StopGrade; react: number }

const LEN = 3.4 // the player's car, drawn this long: true to the crew beside it
const TEAM = '#e53935'
const TEAMS: [string, string, string][] = [
  ['BOLT MOTORSPORT', '#1e88e5', '#ffffff'],
  ['APEX GP', '#2e7d32', '#ffffff'],
  ['CARTOPIA RACING', TEAM, '#ffffff'],
  ['NOVA RACING', '#fb8c00', '#1a1a1a'],
  ['ZEPHYR TEAM', '#6a1b9a', '#ffffff'],
]
const BAY = 7 // garage bay width
const BOX_W = 6 // the painted pit box
const BOX_D = 4.6
const WALL = 6 // the pit wall, past the fast lane
const FAST = 4.3 // middle of the fast lane, where other cars pass
const RIG: [number, number] = [-2.3, -3.55] // the fuel rig on the garage apron
const CREW_K = 1.45 // crew size: about 1.8 m beside a 4.5 m car

function Paint({ x, z, w, l, color = '#ffd54f', ry = 0 }: { x: number; z: number; w: number; l: number; color?: string; ry?: number }) {
  return (
    <mesh position={[x, LAYER.paint, z]} rotation={[-Math.PI / 2, 0, ry]}>
      <planeGeometry args={[w, l]} />
      <meshBasicMaterial color={color} {...decal()} />
    </mesh>
  )
}

// A pit box outline with the stop mark across it.
function Box({ x, mark }: { x: number; mark?: boolean }) {
  return (
    <group>
      <Paint x={x} z={-BOX_D / 2} w={BOX_W} l={0.12} />
      <Paint x={x} z={BOX_D / 2} w={BOX_W} l={0.12} />
      <Paint x={x - BOX_W / 2} z={0} w={0.12} l={BOX_D} />
      <Paint x={x + BOX_W / 2} z={0} w={0.12} l={BOX_D} />
      {mark && (
        <>
          {/* Where the front wheels stop, and a chevron pointing the way in. */}
          <Paint x={x + LEN * 0.33} z={0} w={0.24} l={BOX_D - 0.4} color="#fafafa" />
          {[-1, 1].map((sd) => <Paint key={sd} x={x - BOX_W / 2 - 0.9} z={sd * 0.38} w={0.9} l={0.16} color="#fafafa" ry={-sd * 0.7} />)}
        </>
      )}
    </group>
  )
}

// One garage bay in the pit building: concrete pillars, a team sign, and a shutter
// that is part raised. The player's bay is open, with chests and racks inside.
function GarageBay({ x, team, open }: { x: number; team: [string, string, string]; open: boolean }) {
  const [name, bg, fg] = team
  return (
    <group position={[x, 0, -5.4]}>
      {/* Inside: dark floor, back wall in team colour. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.lot, -2.6]}>
        <planeGeometry args={[BAY - 0.5, 5]} />
        <meshStandardMaterial color="#5f6368" />
      </mesh>
      <mesh position={[0, 1.7, -5]}>
        <boxGeometry args={[BAY - 0.5, 3.4, 0.1]} />
        <meshStandardMaterial color={bg} />
      </mesh>
      <mesh position={[0, 2.3, -4.94]}>
        <planeGeometry args={[BAY * 0.5, BAY * 0.1]} />
        <meshBasicMaterial map={signTexture(name, bg, fg)} />
      </mesh>
      {open && (
        <>
          <ToolChest x={-2.4} z={-4.5} color={bg} />
          <ToolChest x={-1.4} z={-4.5} color={bg} />
          <TyreStack x={1.6} z={-4.4} n={5} band={TEAM} />
          <TyreStack x={2.2} z={-4.4} n={4} band="#ffd54f" />
          <TyreStack x={1.9} z={-3.8} n={3} band="#fafafa" />
          {/* Spare nose cone on a stand. */}
          <mesh position={[-2.6, 0.5, -2.6]}><boxGeometry args={[0.2, 1, 0.2]} /><meshStandardMaterial color="#455a64" /></mesh>
          <mesh position={[-2.6, 1.05, -2.6]} rotation-x={Math.PI / 2}><coneGeometry args={[0.25, 1, 10]} /><meshStandardMaterial color={bg} /></mesh>
          {/* Timing screens over the chests. */}
          {[-2.4, -1.4].map((dx) => (
            <mesh key={dx} position={[dx, 1.9, -4.93]}>
              <planeGeometry args={[0.8, 0.5]} />
              <meshBasicMaterial color="#4fc3f7" toneMapped={false} />
            </mesh>
          ))}
        </>
      )}
      {/* The shutter: rolled up when open, else down to just above head height. */}
      <mesh position={[0, open ? 3.2 : 2.25, -0.05]}>
        <planeGeometry args={[BAY - 0.5, open ? 0.4 : 1.9]} />
        <meshStandardMaterial map={shutterTex()} color="#d0d4d8" />
      </mesh>
      {/* Pillar on the left of the bay and the sign band over it. */}
      <mesh position={[-BAY / 2, 1.7, -2.5]}>
        <boxGeometry args={[0.5, 3.4, 5.2]} />
        <meshStandardMaterial map={concreteTex(2, 1.5)} color="#eceff1" />
      </mesh>
      <mesh position={[0, 3.75, -0.1]}>
        <boxGeometry args={[BAY, 0.7, 0.3]} />
        <meshStandardMaterial color={bg} />
      </mesh>
      <mesh position={[0, 3.75, 0.06]}>
        <planeGeometry args={[BAY * 0.6, BAY * 0.12]} />
        <meshBasicMaterial map={signTexture(name, bg, fg)} />
      </mesh>
    </group>
  )
}

// Everything that never moves.
function PitScenery() {
  const tex = useMemo(() => {
    const pit = asphaltTex().clone()
    pit.repeat.set(80 / 2.5, (WALL + 4.7) / 2.5)
    pit.needsUpdate = true
    const track = asphaltTex().clone()
    track.repeat.set(80 / 2.5, 8 / 2.5)
    track.needsUpdate = true
    return { pit, track }
  }, [])
  const bays = useMemo(() => Array.from({ length: 11 }, (_, i) => i - 5), [])
  const T = WALL - 4.7 // how far the track side sits out from where it used to
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.outer, 4]}>
        <planeGeometry args={[120, 80]} />
        <meshStandardMaterial map={grassTex(24, 16)} />
      </mesh>
      {/* Pit lane from the garage apron to the wall, the fast lane, and the boxes. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, (WALL - 4.7) / 2]}>
        <planeGeometry args={[80, WALL + 4.7]} />
        <meshStandardMaterial map={tex.pit} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.lot, -4.7]}>
        <planeGeometry args={[80, 1.4]} />
        <meshStandardMaterial map={concreteTex(40, 1)} color="#cfd8dc" />
      </mesh>
      <Paint x={0} z={2.75} w={80} l={0.12} color="#fafafa" />
      {Array.from({ length: 26 }, (_, i) => <Paint key={i} x={-39 + i * 3} z={WALL - 0.35} w={1.4} l={0.1} color="#fafafa" />)}
      <Box x={0} mark />
      {[-2, -1, 1, 2].map((k) => <Box key={k} x={k * BAY} />)}
      {/* Garage block: bays, a hospitality floor above, roof and flags. */}
      {bays.map((i) => <GarageBay key={i} x={i * BAY} team={TEAMS[((i % TEAMS.length) + TEAMS.length + 2) % TEAMS.length]} open={i === 0} />)}
      <mesh position={[0, 5.4, -8]}>
        <boxGeometry args={[11 * BAY, 2.6, 5.4]} />
        <meshStandardMaterial map={towerTex()} color="#b0bec5" />
      </mesh>
      <mesh position={[0, 4.15, -5.2]}>
        <boxGeometry args={[11 * BAY, 0.2, 0.9]} />
        <meshStandardMaterial color="#eceff1" />
      </mesh>
      {Array.from({ length: 30 }, (_, i) => (
        <mesh key={i} position={[-37.7 + i * 2.6, 4.75, -5.5]}><cylinderGeometry args={[0.025, 0.025, 1, 5]} /><meshStandardMaterial color="#90a4ae" /></mesh>
      ))}
      <mesh position={[0, 5.2, -5.5]}><boxGeometry args={[11 * BAY, 0.05, 0.05]} /><meshStandardMaterial color="#90a4ae" /></mesh>
      <mesh position={[0, 6.8, -8]}>
        <boxGeometry args={[11 * BAY + 0.6, 0.25, 6]} />
        <meshStandardMaterial color="#eceff1" />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <group key={i} position={[-33 + i * 6, 6.9, -5.6]}>
          <mesh position-y={0.9}><cylinderGeometry args={[0.03, 0.03, 1.8, 5]} /><meshStandardMaterial color="#cfd8dc" /></mesh>
          <mesh position={[0.35, 1.55, 0]}><planeGeometry args={[0.7, 0.42]} /><meshStandardMaterial color={TEAMS[i % TEAMS.length][1]} side={2} /></mesh>
        </group>
      ))}
      {/* Pit wall with team panels and the catch fence. */}
      <mesh position={[0, 0.45, WALL]}>
        <boxGeometry args={[80, 0.9, 0.4]} />
        <meshStandardMaterial map={concreteTex(40, 0.5)} color="#eceff1" />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={i} position={[-37.5 + i * 5, 0.45, WALL - 0.21]}>
          <planeGeometry args={[4.2, 0.55]} />
          <meshBasicMaterial map={signTexture(TEAMS[i % TEAMS.length][0], TEAMS[i % TEAMS.length][1], TEAMS[i % TEAMS.length][2])} />
        </mesh>
      ))}
      {Array.from({ length: 27 }, (_, i) => (
        <mesh key={i} position={[-39 + i * 3, 2, WALL + 0.1]}><cylinderGeometry args={[0.04, 0.05, 2.2, 6]} /><meshStandardMaterial color="#78909c" /></mesh>
      ))}
      {[1.3, 2, 2.7].map((y) => <mesh key={y} position={[0, y, WALL + 0.1]}><boxGeometry args={[80, 0.02, 0.02]} /><meshStandardMaterial color="#90a4ae" /></mesh>)}
      {/* The track beyond the wall, kerbs, a tyre wall, and the grandstand. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, 9.2 + T]}>
        <planeGeometry args={[80, 8]} />
        <meshStandardMaterial map={tex.track} />
      </mesh>
      <Paint x={0} z={5.6 + T} w={80} l={0.14} color="#fafafa" />
      <Paint x={0} z={12.8 + T} w={80} l={0.14} color="#fafafa" />
      {Array.from({ length: 40 }, (_, i) => <Paint key={i} x={-39 + i * 2} z={13.4 + T} w={1} l={0.7} color={i % 2 ? '#fafafa' : '#e53935'} />)}
      {Array.from({ length: 60 }, (_, i) => (
        <group key={i}>
          {[0, 1].map((r) => (
            <mesh key={r} position={[-39.5 + i * 1.33 + r * 0.66, 0.3 + r * 0.02, 14.2 + T + r * 0.55]}>
              <cylinderGeometry args={[0.32, 0.32, 0.6, 12]} />
              <meshStandardMaterial color={(i + r) % 3 === 0 ? '#e53935' : (i + r) % 3 === 1 ? '#fafafa' : '#1e88e5'} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Pit entry gantry with the speed limit lights and a sign. */}
      <group position={[-12, 0, 0]}>
        {[-4.6, WALL - 0.4].map((z) => <mesh key={z} position={[0, 2.3, z]}><boxGeometry args={[0.3, 4.6, 0.3]} /><meshStandardMaterial color="#455a64" /></mesh>)}
        <mesh position={[0, 4.5, (WALL - 5) / 2]}><boxGeometry args={[0.4, 0.6, WALL + 4.6]} /><meshStandardMaterial color="#263238" /></mesh>
        <mesh position={[0.21, 4.5, (WALL - 5) / 2]} rotation-y={Math.PI / 2}><planeGeometry args={[5, 0.5]} /><meshBasicMaterial map={signTexture('PIT LANE 80', '#263238', '#ffd54f')} /></mesh>
        {[-3.4, 4.4].map((z) => [0, 1].map((k) => (
          <mesh key={`${z}${k}`} position={[0.22, 4.4 + k * 0.01, z + (k ? 0.3 : -0.3)]}><sphereGeometry args={[0.12, 8, 6]} /><meshBasicMaterial color={k ? '#00e676' : '#263238'} toneMapped={false} /></mesh>
        )))}
      </group>
      {/* Spare sets and kit on the apron round the box. */}
      <TyreStack x={-BOX_W / 2 - 0.5} z={-3.9} n={4} band="#ffd54f" />
      <TyreStack x={-BOX_W / 2 - 1.1} z={-3.9} n={3} band="#ffd54f" />
      <TyreStack x={BOX_W / 2 + 0.6} z={-3.9} n={4} band={TEAM} />
      <ToolChest x={BOX_W / 2 + 1.8} z={-3.9} color={TEAM} />
      {/* The fuel rig: a tall tank on the apron, about head height on the crew. */}
      <group position={[RIG[0], 0, RIG[1]]}>
        <mesh position-y={0.72}><boxGeometry args={[0.55, 1.44, 0.45]} /><meshStandardMaterial color="#eceff1" /></mesh>
        <mesh position={[0, 0.95, 0.23]}><planeGeometry args={[0.4, 0.4]} /><meshBasicMaterial map={signTexture('FUEL', TEAM, '#ffffff')} /></mesh>
        <mesh position={[0, 1.5, 0]}><boxGeometry args={[0.62, 0.12, 0.52]} /><meshStandardMaterial color={TEAM} /></mesh>
        <mesh position={[0.2, 0.55, 0.24]}><boxGeometry args={[0.1, 0.18, 0.04]} /><meshBasicMaterial color="#00e676" toneMapped={false} /></mesh>
      </group>
      {[-1, 1].map((sd) => [-14, -4, 6, 16].map((x) => <Lamp key={`${sd}${x}`} x={x} z={sd > 0 ? WALL - 0.35 : -4.3} ry={sd > 0 ? Math.PI : 0} pole="#455a64" />))}
    </group>
  )
}

// A passing race car out on the track.
function TrackCar({ i, cars }: { i: number; cars: (typeof CARS)[number][] }) {
  const g = useRef<Group>(null)
  const st = useRef({ x: -45 - i * 30, pick: i })
  const [pick, setPick] = useState(i)
  const car = cars[pick % cars.length]
  useFrame((_, rawDt) => {
    const s = st.current
    s.x += Math.min(rawDt, 1 / 20) * (26 + i * 3)
    if (s.x > 45) {
      s.x = -45 - Math.random() * 30
      s.pick += cars.length > 3 ? 3 : 1
      setPick(s.pick)
    }
    if (g.current) g.current.position.x = s.x
  })
  return (
    <group ref={g} position={[st.current.x, 0, (i % 2 ? 8 : 10.4) + WALL - 4.7]} rotation-y={Math.PI / 2}>
      <CarShadow len={LEN} wid={LEN * 0.45} />
      <group scale={LEN / carFrame(car.body).len}>
        <CarModel body={car.body} model={car.id} color={car.colors[0]} />
      </group>
    </group>
  )
}

// Another team's car coming down the fast lane at the limiter: the reason the
// lollipop man holds you. `go` is the clock time it set off, or -1 while parked.
function LaneCar({ car, at }: { car: (typeof CARS)[number]; at: { x: number } }) {
  const g = useRef<Group>(null)
  useFrame(() => { if (g.current) g.current.position.x = at.x })
  return (
    <group ref={g} position={[at.x, 0, FAST]} rotation-y={Math.PI / 2}>
      <CarShadow len={LEN} wid={LEN * 0.45} />
      <group scale={LEN / carFrame(car.body).len}>
        <CarModel body={car.body} model={car.id} color={car.colors[0]} />
      </group>
    </group>
  )
}

// A trolley jack: a low saddle under the car's end and a long handle out to the
// crewman, who pushes it down to lift the car.
function Jack({ dir, up }: { dir: 1 | -1; up: { v: number } }) {
  const arm = useRef<Group>(null)
  const saddle = useRef<Mesh>(null)
  useFrame(() => {
    if (arm.current) arm.current.rotation.z = dir * (0.5 - up.v * 0.32)
    if (saddle.current) saddle.current.position.y = 0.1 + up.v * 0.14
  })
  return (
    <group>
      <mesh ref={saddle} position={[-dir * 0.25, 0.1, 0]}><boxGeometry args={[0.36, 0.08, 0.36]} /><meshStandardMaterial color="#37474f" metalness={0.4} roughness={0.5} /></mesh>
      <mesh position={[-dir * 0.1, 0.06, 0]}><boxGeometry args={[0.5, 0.06, 0.26]} /><meshStandardMaterial color="#455a64" /></mesh>
      {[-0.12, 0.12].map((z) => <mesh key={z} position={[dir * 0.1, 0.05, z]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.05, 0.05, 0.04, 8]} /><meshStandardMaterial color="#212121" /></mesh>)}
      <group ref={arm} position={[0, 0.1, 0]}>
        <mesh position={[dir * 0.55, 0, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.03, 0.03, 1.1, 6]} /><meshStandardMaterial color="#ffd54f" /></mesh>
        <mesh position={[dir * 1.1, 0, 0]}><boxGeometry args={[0.06, 0.06, 0.42]} /><meshStandardMaterial color="#212121" /></mesh>
      </group>
    </group>
  )
}

type Corner = { stage: 0 | 1 | 2 | 3; fill: number; swap: number; green: number; slip: number; gun: number; cls: string }
const ease = (k: number) => k * k * (3 - 2 * k)

export function PitScene({ me, input, running, onHud, onEnd }: {
  me: ChaseCar; input: PitInput; running: boolean
  onHud: (h: PitHud) => void; onEnd: (e: PitEnd) => void
}) {
  useEffect(() => holdTown(), [])
  const view = useArcadeLook()
  const camera = useThree((st) => st.camera) as PerspectiveCamera
  const size = useThree((st) => st.size)
  const f = carFrame(me.body)
  const sc = LEN / f.len
  const bike = isBike(me.body)
  const rig = useMemo(() => wheelRig(me.body), [me.body])
  // Each wheel in the world (the car faces +x, its right side is +z, towards the camera)
  // and which way is outward from it. Matches the order CarModel builds its wheels in.
  const wheels = useMemo(() => {
    const wx = f.wx * sc, wz = f.wz * sc
    const at: [number, number][] = bike ? [[wz, 0], [-wz, 0]] : [[wz, wx], [wz, -wx], [-wz, wx], [-wz, -wx]]
    return at.map(([x, z]) => ({ x, z, out: bike ? 1 : Math.sign(z), lx: bike ? 0 : -z / sc }))
  }, [f, sc, bike])
  const wr = rig.radius * sc
  const times = useMemo(() => gunTimes(Math.random, wheels.length), [wheels.length])
  const lane = useMemo(() => {
    const pool = CARS.filter((c) => !c.parked && !isBike(c.body) && ['formula', 'super', 'sports', 'muscle', 'coupe'].includes(c.body))
    const list = pool.length ? pool : CARS.filter((c) => !c.parked && !isBike(c.body))
    return list[Math.floor(Math.random() * list.length)]
  }, [])
  const racers = useMemo(() => CARS.filter((c) => !c.parked && !isBike(c.body) && ['formula', 'super', 'sports', 'muscle', 'coupe'].includes(c.body)), [])
  const pool = racers.length ? racers : CARS.filter((c) => !c.parked && !isBike(c.body))

  // The crew: a gunner and a tyre man per corner, the two jack men, the lollipop man
  // and the fuel man. Each has a waiting spot outside the box and a working spot.
  const crew = useMemo(() => {
    const out: { p: Person; wait: [number, number]; work: [number, number] }[] = []
    const side = BOX_D / 2 + 0.45
    wheels.forEach((w) => {
      const z = w.out * (Math.abs(w.z) + 0.62 * CREW_K / 1.45)
      out.push({ p: { x: w.x, z: w.out * side, h: w.out > 0 ? Math.PI : 0, shirt: TEAM }, wait: [w.x, w.out * side], work: [w.x, z] })
      out.push({ p: { x: w.x + 0.75 * Math.sign(w.x), z: w.out * side, h: w.out > 0 ? Math.PI : 0, shirt: TEAM }, wait: [w.x + 0.75 * Math.sign(w.x), w.out * (side + 0.2)], work: [w.x + 0.7 * Math.sign(w.x), z + w.out * 0.35] })
    })
    out.push({ p: { x: LEN / 2 + 1.5, z: -side, h: -Math.PI / 2, shirt: TEAM }, wait: [LEN / 2 + 1.5, -side], work: [LEN / 2 + 1.35, 0] }) // front jack
    out.push({ p: { x: -LEN / 2 - 1.5, z: -side, h: Math.PI / 2, shirt: TEAM }, wait: [-LEN / 2 - 1.5, -side], work: [-LEN / 2 - 1.35, 0] }) // rear jack
    out.push({ p: { x: LEN / 2 + 1.2, z: -1.6, h: -Math.PI / 2, shirt: '#263238' }, wait: [LEN / 2 + 1.2, -1.6], work: [LEN / 2 + 1.2, -1.6] }) // lollipop
    out.push({ p: { x: RIG[0] + 0.7, z: RIG[1] + 0.5, h: 0, shirt: TEAM }, wait: [RIG[0] + 0.7, RIG[1] + 0.5], work: [RIG[0] + 1.2, -1.6] }) // fuel
    return out
  }, [wheels])
  const people = useMemo(() => crew.map((c) => c.p), [crew])

  const car = useRef<Group>(null)
  const lolly = useRef<MeshBasicMaterial>(null)
  const hose = useRef<Mesh>(null)
  const fresh = useRef<(Group | null)[]>([])
  const used = useRef<(Group | null)[]>([])
  const guns = useRef<(Group | null)[]>([])
  const jackUp = useMemo(() => ({ v: 0 }), [])
  const jacks = useRef<(Group | null)[]>([])
  const laneAt = useMemo(() => ({ x: -40 }), [])
  // Tyre smoke when the car launches out of the box.
  const puffs = useRef<(Mesh | null)[]>([])
  const puffSt = useMemo(() => Array.from({ length: 10 }, () => ({ age: 9, x: 0, z: 0 })), [])
  const hosePath = useMemo(() => new CatmullRomCurve3([
    new Vector3(RIG[0], 1.42, RIG[1] + 0.2), new Vector3(RIG[0] + 0.4, 0.3, RIG[1] + 0.9),
    new Vector3(-0.6, 0.25, -f.wid * sc / 2 - 0.5), new Vector3(-0.3, f.lift * sc + 0.35, -f.wid * sc / 2 + 0.05),
  ]), [f, sc])
  const st = useRef({
    t: 0, x: PIT_START, v: PIT_SPEED, phase: 'in' as PitPhase, pushFrom: 0, pushT: 0, pushK: 0, grade: 'good' as StopGrade,
    lift: 0, pen: 0, slips: 0, wait: 0, laneGo: false, greenAt: 0, react: 0, go: 0, done: false,
    squeal: 0, glug: 0, shake: 0, camX: 1.6, hudAt: 0, popN: 0, pop: null as PitPop | null, crewK: 0,
    // The crew chief's call: the order the nuts come off, flashed once as the car goes up.
    call: pitCall(Math.random, wheels.length), callIdx: 0, callT: 0,
    corners: wheels.map((): Corner => ({ stage: 0, fill: 0, swap: 0, green: -1, slip: 0, gun: 0, cls: '' })),
  })
  const v3 = useMemo(() => new Vector3(), [])
  // Dev builds: lets the screenshot bot see where the car is.
  useEffect(() => { if (import.meta.env.DEV) Object.assign(window, { __pit: st.current }) }, [])

  useFrame((state, rawDt) => {
    const s = st.current
    const dt = Math.min(rawDt, 1 / 20)
    const t = state.clock.elapsedTime
    const pop = (text: string, kind: PitPop['kind']) => { s.pop = { id: ++s.popN, text, kind } }
    // Presses are counted, so a tap shorter than a frame still counts.
    const press = input.presses > 0
    input.presses = 0
    const taps = input.taps.splice(0)
    if (running && s.phase !== 'hold' && s.phase !== 'go') s.t += dt

    if (s.phase === 'in' && running) {
      // At the limiter until the brake goes on; the crew grab the car if it sails past.
      const brake = input.pedal || s.x > 2.6
      s.v = Math.max(0, s.v - (brake ? PIT_BRAKE * (s.x > 2.6 ? 2 : 1) : PIT_COAST) * dt)
      s.x += s.v * dt
      if (brake && s.v > 0.5) {
        s.squeal -= dt
        if (s.squeal <= 0) { squealSound(); s.squeal = 0.09 }
      }
      if (s.v <= 0) {
        s.grade = stopGrade(s.x)
        s.pushT = stopPenalty(s.x)
        pop(s.grade === 'perfect' ? '🎯 Perfect stop' : s.grade === 'good' ? '👍 Good stop' : s.grade === 'short' ? '😬 Short! Push' : '😬 Long! Push', s.pushT ? 'bad' : 'good')
        if (s.grade === 'perfect') dingSound(1.2)
        if (s.pushT) { s.phase = 'push'; s.pushFrom = s.x; s.pushK = 0 } else s.phase = 'wheels'
        if (!s.pushT) airSound()
      }
    } else if (s.phase === 'push') {
      // The crew shove the car onto the marks, which costs real time.
      s.pushK = Math.min(1, s.pushK + dt / s.pushT)
      s.x = s.pushFrom * (1 - ease(s.pushK))
      if (s.pushK >= 1) { s.phase = 'wheels'; airSound() }
    } else if (s.phase === 'wheels') {
      s.lift = Math.min(1, s.lift + dt * 6)
      if (s.callT < CALL_SHOW * s.call.length) s.callT += dt
      const calling = s.callT < CALL_SHOW * s.call.length
      for (const i of taps) {
        const c = s.corners[i]
        if (!c || c.stage === 1 || c.stage === 3 || s.lift < 1 || calling) continue
        if (c.stage === 0 && c.fill >= 1 && s.call[s.callIdx] !== i) {
          // Off in the called order only: the wrong wheel costs time and doesn't count.
          s.pen += CALL_MISS
          c.slip = 0.4
          s.slips++
          s.shake = 0.12
          buzzSound()
          pop(`Wrong wheel! +${CALL_MISS}s`, 'bad')
          continue
        }
        if (c.fill >= 1) {
          if (c.stage === 0) s.callIdx++
          const quick = t - c.green < 0.25
          if (c.stage === 0) { wrenchSound(); c.stage = 1; c.swap = 0 } else { gunSound(); c.stage = 3 }
          c.gun = 0.3
          s.shake = Math.max(s.shake, 0.05)
          if (quick) pop('⚡ Quick', 'good')
        } else {
          c.fill = Math.max(0, c.fill - GUN_SLIP)
          c.slip = 0.4
          s.slips++
          s.shake = 0.12
          buzzSound()
          pop('Slipped!', 'bad')
        }
      }
      s.corners.forEach((c, i) => {
        if (s.lift < 1 || calling) return
        if (c.stage === 0 || c.stage === 2) {
          const was = c.fill
          c.fill = Math.min(1, c.fill + dt / times[i][c.stage === 0 ? 0 : 1])
          if (was < 1 && c.fill >= 1) c.green = t
        } else if (c.stage === 1) {
          // The old wheel comes off, the new one goes on.
          c.swap += dt / 0.4
          if (c.swap >= 1) { c.stage = 2; c.fill = 0 }
        }
      })
      if (s.corners.every((c) => c.stage === 3)) {
        s.phase = 'hold'
        // Hold for a moment; sometimes a car is coming down the lane and you wait for it.
        s.wait = 0.35 + Math.random() * 0.6
        s.laneGo = Math.random() < 0.4
        if (s.laneGo) laneAt.x = -26
        airSound()
      }
    } else if (s.phase === 'hold') {
      s.lift = Math.max(0, s.lift - dt * 7)
      s.wait -= dt
      if (press) {
        s.pen += PIT_JUMP
        s.shake = 0.12
        buzzSound()
        pop(`Wait for green! +${PIT_JUMP}s`, 'bad')
      }
      const clear = !s.laneGo || laneAt.x > 3.5
      if (s.wait <= 0 && clear) { s.phase = 'green'; s.greenAt = s.t }
    } else if (s.phase === 'green') {
      if (press) {
        s.react = s.t - s.greenAt
        s.phase = 'go'
        s.v = 0
        revSound(1.1)
        pop(`⚡ ${s.react.toFixed(2)}s`, s.react < 0.4 ? 'good' : 'bad')
      }
    } else if (s.phase === 'go') {
      s.go += dt
      s.v += 14 * dt
      s.x += s.v * dt
      if (s.go > 1.3 && !s.done) {
        s.done = true
        onEnd({ time: s.t + s.pen, slips: s.slips, grade: s.grade, react: s.react })
      }
    }
    if (s.laneGo && s.phase !== 'in') laneAt.x += PIT_SPEED * dt
    if (s.phase === 'go' && s.go < 0.7) {
      s.glug -= dt
      if (s.glug <= 0) {
        s.glug = 0.07
        const p = puffSt.reduce((a, b) => (b.age > a.age ? b : a))
        const rw = wheels[wheels.length - 1]
        p.age = 0
        p.x = s.x + rw.x - 0.2
        p.z = (puffSt.indexOf(p) % 2 ? 1 : -1) * Math.abs(rw.z)
      }
    }
    puffSt.forEach((p, i) => {
      p.age += dt
      const m = puffs.current[i]
      if (!m) return
      m.visible = p.age < 1.1
      const k = p.age / 1.1
      m.position.set(p.x - k * 0.8, 0.2 + k * 0.6, p.z * (1 + k * 0.4))
      m.scale.setScalar(0.25 + k * 0.9)
      ;(m.material as MeshBasicMaterial).opacity = 0.55 * (1 - k)
    })

    // The car: rolling wheels, the jacks, the wheels coming off and going back on.
    const roll = (s.v * dt) / (rig.radius * sc)
    if (car.current) {
      car.current.position.x = s.x
      car.current.position.y = ease(s.lift) * 0.16
    }
    jackUp.v = ease(s.lift)
    s.corners.forEach((c, i) => {
      const w = rig.spin[i]
      c.gun = Math.max(0, c.gun - dt)
      c.slip = Math.max(0, c.slip - dt)
      if (w) {
        // Off: slide out and away; on: slide back in. The gun spins the wheel on its nut.
        const out = c.stage === 1 ? (c.swap < 0.5 ? ease(c.swap * 2) : ease((1 - c.swap) * 2)) : 0
        w.position.x = Math.sign(wheels[i].lx || 1) * out * 0.55 / sc * (bike ? 0 : 1)
        w.position.y = bike ? out * 0.3 / sc : 0
        w.rotation.x += roll + (c.gun > 0 ? dt * 40 : 0)
      }
      const fr = fresh.current[i]
      if (fr) fr.visible = c.stage < 1 || (c.stage === 1 && c.swap < 0.5)
      const ud = used.current[i]
      if (ud) ud.visible = c.stage >= 2 || (c.stage === 1 && c.swap >= 0.5)
      const g = guns.current[i]
      if (g) {
        g.visible = s.phase === 'wheels' && s.lift > 0.3
        g.position.y = wheels[i] ? rig.radius * sc + s.lift * 0.16 + (c.gun > 0 ? (Math.random() - 0.5) * 0.02 : 0) : 0
      }
    })
    jacks.current.forEach((j, k) => {
      if (j) j.visible = s.phase === 'wheels' || s.phase === 'hold'
      if (j) j.position.x = (k ? -1 : 1) * (LEN / 2 + 0.15) + s.x
    })

    // Crew rush in once the car stops and step back as it leaves.
    const atBox = s.phase === 'push' || s.phase === 'wheels' || s.phase === 'hold' || s.phase === 'green'
    s.crewK += ((atBox ? 1 : 0) - s.crewK) * Math.min(1, dt * 9)
    crew.forEach((c, i) => {
      const k = s.crewK
      c.p.x = c.wait[0] + (c.work[0] - c.wait[0]) * k + (i < wheels.length * 2 && s.phase === 'push' ? s.x : 0)
      c.p.z = c.wait[1] + (c.work[1] - c.wait[1]) * k
      c.p.cheer = s.phase === 'go'
    })
    if (lolly.current) lolly.current.color.set(s.phase === 'green' || s.phase === 'go' ? '#00e676' : '#e53935')
    if (hose.current) hose.current.visible = s.phase === 'wheels' || s.phase === 'hold'
    if (s.phase === 'wheels' && running) {
      s.glug -= dt
      if (s.glug <= 0) { fuelSound(); s.glug = 0.5 }
    }

    // Wheel rings: pinned on screen beside each wheel, filling as the gun works.
    input.pads.forEach((el, i) => {
      if (!el) return
      const c = s.corners[i]
      const w = wheels[i]
      if (!c || !w) { el.style.display = 'none'; return }
      const show = s.phase === 'wheels' && c.stage !== 3 && s.lift >= 1
      const callAt = Math.floor(s.callT / CALL_SHOW)
      const lit = callAt < s.call.length && s.call[callAt] === i
      if (lit) el.dataset.n = String(callAt + 1)
      const cls = !show ? 'pit-pad off' : callAt < s.call.length ? (lit ? 'pit-pad call lit' : 'pit-pad call') : c.slip > 0 ? 'pit-pad slip' : c.stage === 1 ? 'pit-pad swap' : c.fill >= 1 ? 'pit-pad ready' : 'pit-pad'
      if (cls !== c.cls) { el.className = cls; c.cls = cls }
      el.style.setProperty('--p', `${Math.round(c.fill * 100)}%`)
      el.dataset.step = c.stage === 0 ? 'off' : 'on'
      v3.set(w.x + s.x, wr + ease(s.lift) * 0.16, w.z + w.out * 0.15).project(camera)
      const sx = Math.min(size.width - 40, Math.max(40, ((v3.x + 1) / 2) * size.width))
      const sy = Math.min(size.height - 40, Math.max(90, ((1 - v3.y) / 2) * size.height))
      el.style.transform = `translate(${sx}px, ${sy}px)`
    })

    // Camera: rides down the lane with the car, closes in for the stop, follows it out.
    const tan = Math.tan(((camera.fov / 2) * Math.PI) / 180)
    const aspect = size.width / size.height
    const tight = s.phase === 'wheels' || s.phase === 'push'
    const halfW = aspect > 1 ? (tight ? 5.4 : 6.5) : (tight ? 3.5 : 3.9)
    const halfH = tight ? 4.2 : 4.8
    const dist = Math.max(halfH / tan, halfW / (tan * aspect))
    // Down the lane is down the screen; keep the box above the brake button on the way in.
    const wantX = s.phase === 'in' ? 1.6 : s.phase === 'go' ? Math.min(14, s.x * 0.5) : 0
    s.camX += (wantX - s.camX) * Math.min(1, dt * 3)
    s.shake = Math.max(0, s.shake - dt * 0.6)
    const k = Math.min(1, dt * 4)
    const dir = v3.set(1, 0.85, 0.35).normalize()
    const px = s.camX - 0.6 + dir.x * dist, py = dir.y * dist, pz = 0.4 + dir.z * dist
    camera.position.set(
      camera.position.x + (px - camera.position.x) * k + (Math.random() - 0.5) * s.shake,
      camera.position.y + (py - camera.position.y) * k + (Math.random() - 0.5) * s.shake,
      camera.position.z + (pz - camera.position.z) * k,
    )
    camera.lookAt(s.camX - 0.6, 0, 0.4)

    if (t - s.hudAt > 0.05 || s.pop) {
      s.hudAt = t
      onHud({ phase: s.phase, left: s.corners.filter((c) => c.stage !== 3).length, time: s.t + s.pen, pop: s.pop, calling: s.phase === 'wheels' && s.callT < CALL_SHOW * s.call.length })
      s.pop = null
    }
  })

  // Start the camera where the car comes in, rather than swooping there from the default.
  useEffect(() => {
    const tan = Math.tan(((camera.fov / 2) * Math.PI) / 180)
    const aspect = size.width / size.height
    const dist = Math.max(4.8 / tan, (aspect > 1 ? 6.5 : 3.9) / (tan * aspect))
    const dir = new Vector3(1, 0.85, 0.35).normalize()
    const x = st.current.camX - 0.6
    camera.position.set(x + dir.x * dist, dir.y * dist, 0.4 + dir.z * dist)
    camera.lookAt(x, 0, 0.4)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <ArcadeSky view={view} near={30} far={110} />
      <Batch version={0}>
        <PitScenery />
      </Batch>
      <Grandstand x={0} z={17.5 + WALL - 4.7} h={Math.PI} width={34} rows={5} roof={TEAM} />
      <Crowd people={people} scale={CREW_K} />
      {[0, 1, 2].map((i) => <TrackCar key={i} i={i} cars={pool} />)}
      <LaneCar car={lane} at={laneAt} />
      <group ref={car} rotation-y={Math.PI / 2} position-x={PIT_START}>
        <CarShadow len={LEN} wid={f.wid * sc} />
        <group scale={sc}>
          <CarModel body={me.body} model={me.model} color={me.color} finish={me.finish} skin={me.skin} modSkin={me.modSkin} panels={me.panels} hat={me.hat} mods={me.mods} beams={view.beams} rig={rig} />
        </group>
      </group>
      {[0, 1].map((k) => (
        <group key={k} ref={(g) => { jacks.current[k] = g }}>
          <Jack dir={k ? -1 : 1} up={jackUp} />
        </group>
      ))}
      {/* At each corner: the new tyre waiting, the old one once it's off, and the wheel gun. */}
      {wheels.map((w, i) => (
        <group key={i}>
          <group ref={(g) => { fresh.current[i] = g }}>
            <Tyre x={w.x + 0.42 * Math.sign(w.x || 1)} z={w.z + w.out * 0.85} band={TEAM} r={wr} w={wr * 0.75} ry={Math.PI / 2} />
          </group>
          <group ref={(g) => { used.current[i] = g }} visible={false}>
            <Tyre x={w.x - 0.6 * Math.sign(w.x || 1)} z={w.z + w.out * 1.2} flat band="#757575" r={wr} w={wr * 0.75} ry={i} />
          </group>
          <group ref={(g) => { guns.current[i] = g }} position={[w.x, wr, w.z + w.out * 0.42]} visible={false}>
            <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.05, 0.06, 0.32, 8]} /><meshStandardMaterial color="#fdd835" metalness={0.3} roughness={0.4} /></mesh>
            <mesh position={[0, -0.12, w.out * 0.08]}><boxGeometry args={[0.06, 0.18, 0.08]} /><meshStandardMaterial color="#212121" /></mesh>
          </group>
        </group>
      ))}
      {/* Lollipop board on its pole, held out over the nose, and the fuel hose to the car. */}
      <group position={[LEN / 2 + 0.95, 0, -1.25]}>
        <mesh position-y={0.85}><cylinderGeometry args={[0.025, 0.025, 1.3, 6]} /><meshStandardMaterial color="#212121" /></mesh>
        <mesh position-y={1.6} rotation-y={-Math.PI / 2}><circleGeometry args={[0.3, 20]} /><meshBasicMaterial ref={lolly} color="#e53935" side={2} toneMapped={false} /></mesh>
      </group>
      {puffSt.map((_, i) => (
        <mesh key={i} ref={(m) => { puffs.current[i] = m }} visible={false}>
          <sphereGeometry args={[0.5, 10, 8]} />
          <meshBasicMaterial color="#e0e0e0" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={hose} visible={false}>
        <tubeGeometry args={[hosePath, 24, 0.045, 6]} />
        <meshStandardMaterial color="#212121" roughness={0.6} />
      </mesh>
    </>
  )
}
