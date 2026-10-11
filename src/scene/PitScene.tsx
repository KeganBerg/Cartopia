import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CatmullRomCurve3, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { CarModel, carFrame } from './CarModel'
import { holdTown } from './renderGate'
import { Batch } from './Batch'
import { LAYER, decal } from './layers'
import { asphaltTex, concreteTex, grassTex, shutterTex, towerTex } from './textures'
import { signTexture } from './signTexture'
import { ArcadeSky, CarShadow, Crowd, Grandstand, Lamp, ToolChest, Tyre, TyreStack, useArcadeLook, useFitCamera, type Person } from './ArcadeScenery'
import { FUEL_BAND, FUEL_RATE, PIT_MISS, PIT_WHEELS, fuelOk, pitOrder } from '../game/arcadeMore'
import { CARS, isBike } from '../game/data'
import type { ChaseCar } from './ChaseScene'
import { buzzSound, fuelSound, revSound, wrenchSound } from '../lib/arcadeSound'

// The screen writes whether the fuel button is held.
export type PitInput = { fuel: boolean }
export type PitHud = { phase: 'wheels' | 'fuel' | 'go'; wheels: number; fuel: number; time: number }
export type PitEnd = { time: number; misses: number }

const LEN = 2.3 // the player's car, drawn this long
const TEAM = '#e53935'
const hosePath = new CatmullRomCurve3([new Vector3(-3.3, 1.9, -2.15), new Vector3(-2.7, 0.35, -1.9), new Vector3(-1.9, 0.25, -1.2), new Vector3(-1.2, 0.55, -0.5)])
const TEAMS: [string, string, string][] = [
  ['BOLT MOTORSPORT', '#1e88e5', '#ffffff'],
  ['APEX GP', '#2e7d32', '#ffffff'],
  ['CARTOPIA RACING', TEAM, '#ffffff'],
  ['NOVA RACING', '#fb8c00', '#1a1a1a'],
  ['ZEPHYR TEAM', '#6a1b9a', '#ffffff'],
]
const BAY = 5.2 // garage bay width

function Paint({ x, z, w, l, color = '#ffd54f', ry = 0 }: { x: number; z: number; w: number; l: number; color?: string; ry?: number }) {
  return (
    <mesh position={[x, LAYER.paint, z]} rotation={[-Math.PI / 2, 0, ry]}>
      <planeGeometry args={[w, l]} />
      <meshBasicMaterial color={color} {...decal()} />
    </mesh>
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
        <planeGeometry args={[BAY * 0.6, BAY * 0.15]} />
        <meshBasicMaterial map={signTexture(name, bg, fg)} />
      </mesh>
      {open && (
        <>
          <ToolChest x={-1.6} z={-4.5} color={bg} />
          <ToolChest x={-0.6} z={-4.5} color={bg} />
          <TyreStack x={1.2} z={-4.4} n={5} band={TEAM} />
          <TyreStack x={1.8} z={-4.4} n={4} band="#ffd54f" />
          <TyreStack x={1.5} z={-3.8} n={3} band="#fafafa" />
          {/* Spare nose cone on a stand. */}
          <mesh position={[-1.9, 0.5, -2.6]}><boxGeometry args={[0.2, 1, 0.2]} /><meshStandardMaterial color="#455a64" /></mesh>
          <mesh position={[-1.9, 1.05, -2.6]} rotation-x={Math.PI / 2}><coneGeometry args={[0.25, 1, 10]} /><meshStandardMaterial color={bg} /></mesh>
          {/* Screens over the chests. */}
          {[-1.6, -0.6].map((dx) => (
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
        <planeGeometry args={[BAY * 0.8, BAY * 0.2]} />
        <meshBasicMaterial map={signTexture(name, bg, fg)} />
      </mesh>
    </group>
  )
}

// Everything that never moves.
function PitScenery() {
  const tex = useMemo(() => {
    const pit = asphaltTex().clone()
    pit.repeat.set(80 / 2.5, 8.5 / 2.5)
    pit.needsUpdate = true
    const track = asphaltTex().clone()
    track.repeat.set(80 / 2.5, 8 / 2.5)
    track.needsUpdate = true
    return { pit, track }
  }, [])
  const bays = useMemo(() => Array.from({ length: 11 }, (_, i) => i - 5), [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.outer, 4]}>
        <planeGeometry args={[120, 70]} />
        <meshStandardMaterial map={grassTex(24, 14)} />
      </mesh>
      {/* Pit lane, fast lane line and the pit box round the car. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, 0.2]}>
        <planeGeometry args={[80, 8.5]} />
        <meshStandardMaterial map={tex.pit} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.lot, -4.7]}>
        <planeGeometry args={[80, 1.4]} />
        <meshStandardMaterial map={concreteTex(40, 1)} color="#cfd8dc" />
      </mesh>
      <Paint x={0} z={2.9} w={80} l={0.12} color="#fafafa" />
      {Array.from({ length: 26 }, (_, i) => <Paint key={i} x={-39 + i * 3} z={2.2} w={1.4} l={0.1} color="#fafafa" />)}
      <Paint x={0} z={-1.7} w={4.6} l={0.12} />
      <Paint x={0} z={1.7} w={4.6} l={0.12} />
      <Paint x={-2.3} z={0} w={0.12} l={3.4} />
      <Paint x={2.3} z={0} w={0.12} l={3.4} />
      {/* The neighbours' boxes along the lane. */}
      {[-1, 1].map((sd) => [1, 2].map((k) => (
        <group key={`${sd}${k}`}>
          <Paint x={sd * k * BAY - 2.3} z={0} w={0.1} l={3.4} />
          <Paint x={sd * k * BAY + 2.3} z={0} w={0.1} l={3.4} />
          <Paint x={sd * k * BAY} z={-1.7} w={4.6} l={0.1} />
        </group>
      )))}
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
      {Array.from({ length: 22 }, (_, i) => (
        <mesh key={i} position={[-27 + i * 2.6, 4.75, -5.5]}><cylinderGeometry args={[0.025, 0.025, 1, 5]} /><meshStandardMaterial color="#90a4ae" /></mesh>
      ))}
      <mesh position={[0, 5.2, -5.5]}><boxGeometry args={[11 * BAY, 0.05, 0.05]} /><meshStandardMaterial color="#90a4ae" /></mesh>
      <mesh position={[0, 6.8, -8]}>
        <boxGeometry args={[11 * BAY + 0.6, 0.25, 6]} />
        <meshStandardMaterial color="#eceff1" />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i} position={[-24 + i * 6, 6.9, -5.6]}>
          <mesh position-y={0.9}><cylinderGeometry args={[0.03, 0.03, 1.8, 5]} /><meshStandardMaterial color="#cfd8dc" /></mesh>
          <mesh position={[0.35, 1.55, 0]}><planeGeometry args={[0.7, 0.42]} /><meshStandardMaterial color={TEAMS[i % TEAMS.length][1]} side={2} /></mesh>
        </group>
      ))}
      {/* Pit wall with team panels and the catch fence. */}
      <mesh position={[0, 0.45, 4.7]}>
        <boxGeometry args={[80, 0.9, 0.4]} />
        <meshStandardMaterial map={concreteTex(40, 0.5)} color="#eceff1" />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={i} position={[-37.5 + i * 5, 0.45, 4.49]}>
          <planeGeometry args={[4.2, 0.55]} />
          <meshBasicMaterial map={signTexture(TEAMS[i % TEAMS.length][0], TEAMS[i % TEAMS.length][1], TEAMS[i % TEAMS.length][2])} />
        </mesh>
      ))}
      {Array.from({ length: 27 }, (_, i) => (
        <mesh key={i} position={[-39 + i * 3, 2, 4.8]}><cylinderGeometry args={[0.04, 0.05, 2.2, 6]} /><meshStandardMaterial color="#78909c" /></mesh>
      ))}
      {[1.3, 2, 2.7].map((y) => <mesh key={y} position={[0, y, 4.8]}><boxGeometry args={[80, 0.02, 0.02]} /><meshStandardMaterial color="#90a4ae" /></mesh>)}
      {/* The track beyond the wall, kerbs, a tyre wall, and the grandstand. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, 9.2]}>
        <planeGeometry args={[80, 8]} />
        <meshStandardMaterial map={tex.track} />
      </mesh>
      <Paint x={0} z={5.6} w={80} l={0.14} color="#fafafa" />
      <Paint x={0} z={12.8} w={80} l={0.14} color="#fafafa" />
      {Array.from({ length: 40 }, (_, i) => <Paint key={i} x={-39 + i * 2} z={13.4} w={1} l={0.7} color={i % 2 ? '#fafafa' : '#e53935'} />)}
      {Array.from({ length: 60 }, (_, i) => (
        <group key={i}>
          {[0, 1].map((r) => (
            <mesh key={r} position={[-39.5 + i * 1.33 + r * 0.66, 0.3 + r * 0.02, 14.2 + r * 0.55]}>
              <cylinderGeometry args={[0.32, 0.32, 0.6, 12]} />
              <meshStandardMaterial color={(i + r) % 3 === 0 ? '#e53935' : (i + r) % 3 === 1 ? '#fafafa' : '#1e88e5'} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Pit gantry with lights and a sign. */}
      <group position={[-7.5, 0, 0]}>
        {[-4.6, 4.4].map((z) => <mesh key={z} position={[0, 2.3, z]}><boxGeometry args={[0.3, 4.6, 0.3]} /><meshStandardMaterial color="#455a64" /></mesh>)}
        <mesh position={[0, 4.5, 0]}><boxGeometry args={[0.4, 0.6, 9.4]} /><meshStandardMaterial color="#263238" /></mesh>
        <mesh position={[0.21, 4.5, 0]} rotation-y={Math.PI / 2}><planeGeometry args={[5, 0.5]} /><meshBasicMaterial map={signTexture('PIT LANE', '#263238', '#ffd54f')} /></mesh>
        {[-3.4, 3.4].map((z) => [0, 1].map((k) => (
          <mesh key={`${z}${k}`} position={[0.22, 4.4 + k * 0.01, z + (k ? 0.3 : -0.3)]}><sphereGeometry args={[0.12, 8, 6]} /><meshBasicMaterial color={k ? '#00e676' : '#263238'} toneMapped={false} /></mesh>
        )))}
      </group>
      <TyreStack x={-3.3} z={-3.4} n={4} band="#ffd54f" />
      <TyreStack x={-3.9} z={-3.4} n={3} band="#ffd54f" />
      <TyreStack x={3.3} z={-3.4} n={4} band="#ffd54f" />
      <ToolChest x={-5.5} z={-3.6} color={TEAM} />
      {/* The fuel rig behind the car. */}
      <group position={[-3.4, 0, -2.4]}>
        <mesh position-y={1}><boxGeometry args={[0.7, 2, 0.6]} /><meshStandardMaterial color="#eceff1" /></mesh>
        <mesh position={[0, 1.4, 0.31]}><planeGeometry args={[0.5, 0.5]} /><meshBasicMaterial map={signTexture('FUEL', TEAM, '#ffffff')} /></mesh>
        <mesh position={[0, 2.1, 0]}><boxGeometry args={[0.8, 0.2, 0.7]} /><meshStandardMaterial color={TEAM} /></mesh>
      </group>
      {[-1, 1].map((sd) => [-14, -4, 6, 16].map((x) => <Lamp key={`${sd}${x}`} x={x} z={sd > 0 ? 4.35 : -4.3} ry={sd > 0 ? Math.PI : 0} pole="#455a64" />))}
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
    <group ref={g} position={[st.current.x, 0, i % 2 ? 8 : 10.4]} rotation-y={Math.PI / 2}>
      <CarShadow len={LEN} wid={LEN * 0.45} />
      <group scale={LEN / carFrame(car.body).len}>
        <CarModel body={car.body} model={car.id} color={car.colors[0]} />
      </group>
    </group>
  )
}

export function PitScene({ me, input, running, onHud, onEnd }: {
  me: ChaseCar; input: PitInput; running: boolean
  onHud: (h: PitHud) => void; onEnd: (e: PitEnd) => void
}) {
  useEffect(() => holdTown(), [])
  const view = useArcadeLook()
  const wide = useThree((st) => st.size.width > st.size.height)
  useFitCamera([1, 0.8, 0.35], [-1.4, 0, 0.3], wide ? 6.5 : 3.7, 4.4)
  const f = carFrame(me.body)
  const sc = LEN / f.len
  // Wheels in the world: the car faces +x, so its right side is +z (towards the camera).
  const wheels = useMemo(() => {
    const wx = f.wx * sc, wz = f.wz * sc
    return [[wz, -wx], [wz, wx], [-wz, -wx], [-wz, wx]] as [number, number][]
  }, [f, sc])
  const order = useMemo(() => pitOrder(Math.random), [])
  const [fitted, setFitted] = useState<number[]>([])
  const crew = useMemo<Person[]>(() => [
    ...wheels.map(([x, z]) => ({ x, z: z + Math.sign(z) * 1.05, h: z > 0 ? Math.PI : 0, shirt: TEAM })),
    { x: LEN / 2 + 0.75, z: 0, h: -Math.PI / 2, shirt: TEAM }, // front jack
    { x: -LEN / 2 - 0.75, z: 0, h: Math.PI / 2, shirt: TEAM }, // rear jack
    { x: LEN / 2 + 1.3, z: -1.75, h: -Math.PI / 2, shirt: '#263238' }, // lollipop
    { x: -LEN / 2 - 0.2, z: -1.75, h: 0, shirt: TEAM }, // fuel
  ], [wheels])
  const racers = useMemo(() => CARS.filter((c) => !c.parked && !isBike(c.body) && ['formula', 'super', 'sports', 'muscle', 'coupe'].includes(c.body)), [])
  const pool = racers.length ? racers : CARS.filter((c) => !c.parked && !isBike(c.body))

  const car = useRef<Group>(null)
  const lolly = useRef<MeshBasicMaterial>(null)
  const hose = useRef<Mesh>(null)
  const arrow = useRef<Group>(null)
  const rings = useRef<(Mesh | null)[]>([])
  const st = useRef({ t: 0, step: 0, misses: 0, pen: 0, phase: 'wheels' as PitHud['phase'], fuel: 0, held: false, glug: 0, v: 0, go: 0, final: 0, lift: 0, bad: [0, 0, 0, 0], done: false, hudAt: 0 })

  const tap = (i: number) => {
    const s = st.current
    if (!running || s.phase !== 'wheels' || fitted.includes(i)) return
    if (order[s.step] === i) {
      s.step++
      wrenchSound()
      crew[i].cheer = true
      setFitted((l) => [...l, i])
      if (s.step >= PIT_WHEELS) s.phase = 'fuel'
    } else {
      s.pen += PIT_MISS
      s.misses++
      s.bad[i] = 0.5
      buzzSound()
    }
  }

  useFrame((state, rawDt) => {
    const s = st.current
    const dt = Math.min(rawDt, 1 / 20)
    const t = state.clock.elapsedTime
    if (running && s.phase !== 'go') s.t += dt
    if (running && s.phase === 'fuel') {
      if (input.fuel) {
        s.held = true
        s.fuel += FUEL_RATE * dt
        s.glug -= dt
        if (s.glug <= 0) { fuelSound(); s.glug = 0.15 }
      }
      const spill = s.fuel > 1 || (!input.fuel && s.held && s.fuel > FUEL_BAND[1])
      if (spill) {
        s.pen += PIT_MISS * 2
        s.misses++
        s.fuel = 0.6
        s.held = false
        buzzSound()
      } else if (!input.fuel && s.held) {
        s.held = false
        if (fuelOk(s.fuel)) {
          s.phase = 'go'
          s.final = s.t + s.pen
          crew[crew.length - 1].cheer = true
          crew[crew.length - 2].cheer = true
          revSound(1)
        }
      }
    }
    if (s.phase === 'go') {
      s.go += dt
      s.v += 9 * dt
      if (car.current) car.current.position.x += s.v * dt
      if (s.go > 1.4 && !s.done) {
        s.done = true
        onEnd({ time: s.final, misses: s.misses })
      }
    }
    // On the jacks while the wheels are off.
    s.lift += ((running && s.phase === 'wheels' ? 0.12 : 0) - s.lift) * Math.min(1, dt * 10)
    if (car.current) car.current.position.y = s.lift
    if (lolly.current) lolly.current.color.set(s.phase === 'go' ? '#00e676' : '#e53935')
    if (hose.current) hose.current.visible = s.phase !== 'go'
    rings.current.forEach((r, i) => {
      if (!r) return
      s.bad[i] = Math.max(0, s.bad[i] - dt)
      const next = running && s.phase === 'wheels' && order[s.step] === i
      const m = r.material as MeshBasicMaterial
      m.color.set(s.bad[i] > 0 ? '#ff1744' : next ? '#00e676' : '#ffffff')
      m.opacity = s.bad[i] > 0 ? 0.9 : next ? 0.65 + Math.sin(t * 9) * 0.25 : 0.25
      r.scale.setScalar(next ? 1 + Math.sin(t * 9) * 0.08 : 0.85)
    })
    if (arrow.current) {
      const i = order[s.step]
      arrow.current.visible = running && s.phase === 'wheels'
      if (i !== undefined) arrow.current.position.set(wheels[i][0], 1.2 + Math.sin(t * 6) * 0.12, wheels[i][1] + Math.sign(wheels[i][1]) * 0.55)
    }
    if (t - s.hudAt > 0.05) {
      s.hudAt = t
      onHud({ phase: s.phase, wheels: s.step, fuel: s.fuel, time: s.phase === 'go' ? s.final : s.t + s.pen })
    }
  })

  return (
    <>
      <ArcadeSky view={view} near={30} far={110} />
      <Batch version={0}>
        <PitScenery />
      </Batch>
      <Grandstand x={0} z={17.5} h={Math.PI} width={34} rows={5} roof={TEAM} />
      <Crowd people={crew} scale={1.45} />
      {[0, 1, 2].map((i) => <TrackCar key={i} i={i} cars={pool} />)}
      <group ref={car} rotation-y={Math.PI / 2}>
        <CarShadow len={LEN} wid={f.wid * sc} />
        <group scale={sc}>
          <CarModel body={me.body} model={me.model} color={me.color} finish={me.finish} skin={me.skin} modSkin={me.modSkin} mods={me.mods} beams={view.beams} />
        </group>
      </group>
      {/* Tap targets beside each wheel, and the new tyre waiting by each wheel man. */}
      {wheels.map(([x, z], i) => (
        <group key={i}>
          <mesh ref={(m) => { rings.current[i] = m }} position={[x, LAYER.paint + 0.01, z + Math.sign(z) * 0.55]} rotation-x={-Math.PI / 2} visible={!fitted.includes(i)}>
            <ringGeometry args={[0.32, 0.48, 28]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} toneMapped={false} {...decal(4)} />
          </mesh>
          <mesh position={[x, 0.4, z + Math.sign(z) * 0.5]} onPointerDown={(e) => { e.stopPropagation(); tap(i) }}>
            <boxGeometry args={[1.1, 0.8, 1.3]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {fitted.includes(i)
            ? <Tyre x={x + 0.55} z={z + Math.sign(z) * 1.5} flat band="#616161" r={0.27} />
            : <Tyre x={x + 0.5} z={z + Math.sign(z) * 1.35} band={TEAM} r={0.27} ry={Math.PI / 2} />}
        </group>
      ))}
      <group ref={arrow}>
        <mesh rotation-x={Math.PI}><coneGeometry args={[0.2, 0.4, 4]} /><meshBasicMaterial color="#00e676" toneMapped={false} /></mesh>
      </group>
      {/* Lollipop board on its pole, and the fuel hose to the car. */}
      <group position={[LEN / 2 + 1.15, 0, -1.4]}>
        <mesh position-y={0.9}><cylinderGeometry args={[0.03, 0.03, 1.4, 6]} /><meshStandardMaterial color="#212121" /></mesh>
        <mesh position-y={1.75} rotation-y={-Math.PI / 2}><circleGeometry args={[0.36, 20]} /><meshBasicMaterial ref={lolly} color="#e53935" side={2} toneMapped={false} /></mesh>
      </group>
      <mesh ref={hose}>
        <tubeGeometry args={[hosePath, 24, 0.045, 6]} />
        <meshStandardMaterial color="#212121" roughness={0.6} />
      </mesh>
    </>
  )
}
