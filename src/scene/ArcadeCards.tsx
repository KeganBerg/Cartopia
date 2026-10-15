import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CubicBezierCurve3, Vector3, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from 'three'
import { CarModel, carFrame } from './CarModel'
import { BuildingModel } from './BuildingModel'
import { Grounded } from './ServiceVehicles'
import { SceneThumb, type SceneView } from './BuildingPreview'
import { CarShadow, Grandstand, Crowd, Lamp, ToolChest, Tyre, TyreStack, type Person } from './ArcadeScenery'
import { Cruiser, type ChaseCar } from './ChaseScene'
import { Brush } from './WashScene'
import { Beacon } from './DeliveryScene'
import { LAYER, decal } from './layers'
import { glowTex } from './textures'
import { signTexture } from './signTexture'
import { CHASE_LANES } from '../game/arcade'
import { buildingDef, CARS, isBike, type Body } from '../game/data'

// Each arcade card plays a short loop of its game behind the name and Play button: the
// player's own car, the game's props, moving the way they do in the game. They all draw
// through the shared thumbnail renderer, so six cards are one small WebGL canvas at 24 fps.
export type CardGame = 'chase' | 'park' | 'pit' | 'wash' | 'delivery' | 'stunt'

const smooth = (k: number) => {
  const c = Math.min(1, Math.max(0, k))
  return c * c * (3 - 2 * c)
}
const scaleFor = (body: Body, len: number) => len / carFrame(body).len
const carKey = (c: ChaseCar) => `${c.body}|${c.model ?? ''}|${c.color}|${c.finish ?? ''}|${c.skin ?? ''}|${(c.mods ?? []).join(',')}`

// Everyday cars for traffic and parked rows.
const EVERYDAY: Body[] = ['sedan', 'compact', 'van', 'suv', 'hatch', 'wagon', 'classic', 'ev']
const extras = (n: number, skip: string | undefined) => {
  const pool = CARS.filter((c) => !c.parked && !isBike(c.body) && EVERYDAY.includes(c.body) && c.id !== skip)
  return Array.from({ length: n }, (_, i) => {
    const c = pool[(i * 5 + 2) % pool.length]
    return { body: c.body, model: c.id, color: c.colors[(i + 1) % c.colors.length] }
  })
}

function Car({ car, len }: { car: ChaseCar; len: number }) {
  const s = scaleFor(car.body, len)
  return (
    <>
      <group scale={s}>
        <CarModel {...car} />
      </group>
      <CarShadow len={len} wid={carFrame(car.body).wid * s} />
    </>
  )
}

function Flat({ x = 0, z = 0, w, l, color, y = LAYER.land, ry = 0, n = 0 }: { x?: number; z?: number; w: number; l: number; color: string; y?: number; ry?: number; n?: number }) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, ry]}>
      <planeGeometry args={[w, l]} />
      {n ? <meshBasicMaterial color={color} {...decal(n)} /> : <meshStandardMaterial color={color} roughness={0.95} />}
    </mesh>
  )
}

// Getaway Chase: the street scrolls, you swerve round traffic, the cruiser stays on your tail.
const CHASE_T = 4
const CHASE_GAP = 8 // dash and lamp spacing
function heroLane(t: number) {
  const k = t % CHASE_T
  return k < 2 ? CHASE_LANES[1] + smooth((k - 1.15) / 0.45) * (CHASE_LANES[2] - CHASE_LANES[1]) : CHASE_LANES[2] - smooth((k - 3.15) / 0.45) * (CHASE_LANES[2] - CHASE_LANES[1])
}
function ChaseCard({ me }: { me: ChaseCar }) {
  const road = useRef<Group>(null)
  const hero = useRef<Group>(null)
  const cop = useRef<Group>(null)
  const a = useRef<Group>(null)
  const b = useRef<Group>(null)
  const red = useRef<Mesh>(null)
  const blue = useRef<Mesh>(null)
  const traffic = useMemo(() => extras(2, me.model), [me.model])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (road.current) road.current.position.z = ((t * 26) % CHASE_GAP)
    const k = t % CHASE_T
    if (hero.current) {
      const x = heroLane(t)
      hero.current.position.x = x
      hero.current.rotation.y = Math.PI - (heroLane(t + 0.08) - x) * 4
    }
    if (cop.current) cop.current.position.x = heroLane(t - 0.25) * 0.85
    // Slower traffic coming back at you, one in each lane you dodge out of.
    if (a.current) a.current.position.z = k < 2 ? -40 + 26 * k : 30
    if (b.current) b.current.position.z = k >= 2 ? -40 + 26 * (k - 2) : 30
    const on = Math.floor(t * 6) % 2 === 0
    ;(red.current?.material as MeshStandardMaterial | undefined)?.emissive.set(on ? '#ff1744' : '#300008')
    ;(blue.current?.material as MeshStandardMaterial | undefined)?.emissive.set(on ? '#001030' : '#2979ff')
  })
  return (
    <group>
      <Flat w={7} l={90} z={-25} color="#4a4f57" />
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Flat x={sd * 4.3} z={-25} w={2.2} l={90} color="#cfd2d6" y={LAYER.lot} />
          <Flat x={sd * 3.25} z={-25} w={0.12} l={90} color="#fafafa" n={1} y={LAYER.paint} />
          <Flat x={sd * 14} z={-25} w={17} l={90} color="#7cb342" y={LAYER.outer} />
        </group>
      ))}
      <group ref={road}>
        {Array.from({ length: 10 }, (_, i) => {
          const z = 8 - i * CHASE_GAP
          return (
            <group key={i}>
              {[-0.85, 0.85].map((x) => <Flat key={x} x={x} z={z} w={0.12} l={2.4} color="#fff59d" n={1} y={LAYER.paint} />)}
              <Lamp x={-4.6} z={z} ry={Math.PI / 2} />
              <Lamp x={4.6} z={z - CHASE_GAP / 2} ry={-Math.PI / 2} />
            </group>
          )
        })}
      </group>
      <group ref={hero}><Car car={me} len={1.6} /></group>
      <group ref={a} position-x={CHASE_LANES[1]} rotation-y={Math.PI}><Car car={traffic[0]} len={1.6} /></group>
      <group ref={b} position-x={CHASE_LANES[2]} rotation-y={Math.PI}><Car car={traffic[1]} len={1.6} /></group>
      <group ref={cop} position-z={2.3} rotation-y={Math.PI}>
        <Cruiser beams={false} red={red} blue={blue} />
        <CarShadow len={1.6} wid={0.8} />
      </group>
    </group>
  )
}

// Parking Pro: down into the lot, round and nose first into the glowing spot.
const PARK_T = 4.2
const STALL = 1.25
const PARK_PATH = new CubicBezierCurve3(new Vector3(-5.5, 0, 1.3), new Vector3(-1.2, 0, 1.3), new Vector3(0, 0, 1.0), new Vector3(0, 0, -1.25))
const tmp = new Vector3()
function ParkCard({ me }: { me: ChaseCar }) {
  const hero = useRef<Group>(null)
  const glow = useRef<MeshBasicMaterial>(null)
  const parked = useMemo(() => extras(4, me.model), [me.model])
  useFrame(({ clock }) => {
    const k = clock.elapsedTime % PARK_T
    const u = Math.min(1, k / 2.4)
    const p = 1 - (1 - u) ** 2
    if (hero.current) {
      PARK_PATH.getPoint(p, tmp)
      hero.current.position.set(tmp.x, 0, tmp.z)
      PARK_PATH.getTangent(Math.min(0.999, p), tmp)
      hero.current.rotation.y = Math.atan2(tmp.x, tmp.z)
      hero.current.visible = k < PARK_T - 0.25
    }
    if (glow.current) {
      const done = k > 2.4
      glow.current.color.set(done ? '#69f0ae' : '#ffd54f')
      glow.current.opacity = done ? 0.55 + 0.3 * Math.sin(k * 14) : 0.35 + 0.15 * Math.sin(k * 5)
    }
  })
  return (
    <group>
      <Flat z={2} w={30} l={14} color="#555b63" />
      <Flat z={-6} w={30} l={2} color="#cfd2d6" y={LAYER.lot} />
      <Flat z={-12} w={30} l={10} color="#7cb342" y={LAYER.outer} />
      {Array.from({ length: 6 }, (_, i) => {
        const x = (i - 2.5) * STALL
        return <Flat key={i} x={x} z={-1.3} w={0.07} l={2.2} color="#f5f5f5" n={1} y={LAYER.paint} />
      })}
      <mesh position={[0, LAYER.paint, -1.3]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[STALL - 0.12, 2.1]} />
        <meshBasicMaterial ref={glow} color="#ffd54f" transparent opacity={0.4} depthWrite={false} toneMapped={false} {...decal(2)} />
      </mesh>
      <Flat z={-1.3} w={0.36} l={0.36} color="#1e5fbf" n={3} y={LAYER.paint} />
      {[-2, -1, 1, 2].map((s, i) => (
        <group key={s} position={[s * STALL, 0, -1.3]} rotation-y={i % 2 ? Math.PI : 0}>
          <Car car={parked[i]} len={1.55} />
        </group>
      ))}
      {[-3, 3].map((x) => (
        <mesh key={x} position={[x * STALL + (x > 0 ? -0.6 : 0.6), 0.2, 0.2]}>
          <coneGeometry args={[0.13, 0.4, 10]} />
          <meshStandardMaterial color="#ff6d00" />
        </mesh>
      ))}
      <Lamp x={-4.2} z={-5.4} />
      <Lamp x={4.2} z={-5.4} />
      <group ref={hero}><Car car={me} len={1.55} /></group>
    </group>
  )
}

// Pit Stop: slide into the box, up on the jack, tyres swapped, and gone.
const PIT_T = 5
const TEAM = '#e53935'
function PitCard({ me }: { me: ChaseCar }) {
  const hero = useRef<Group>(null)
  const oldTyre = useRef<Group>(null)
  const crew: Person[] = useMemo(() => [
    { x: -1.25, z: 1.7, h: Math.PI, shirt: TEAM },
    { x: 1.25, z: 1.7, h: Math.PI, shirt: TEAM },
    { x: 2.6, z: 0.2, h: -Math.PI / 2, shirt: TEAM, cheer: true },
  ], [])
  const sign = signTexture('PIT', TEAM, '#ffffff', 2)
  useFrame(({ clock }) => {
    const k = clock.elapsedTime % PIT_T
    const x = k < 1.1 ? -14 * (1 - smooth(k / 1.1)) ** 1.5 : k < 3.3 ? 0 : 16 * ((k - 3.3) / 1.2) ** 2
    const up = smooth((k - 1.2) / 0.25) - smooth((k - 3.0) / 0.25)
    if (hero.current) {
      hero.current.position.set(x, up * 0.16, 0)
      hero.current.rotation.z = k > 3.3 && k < 3.7 ? 0.03 : 0
    }
    if (oldTyre.current) {
      const r = smooth((k - 1.6) / 0.6)
      oldTyre.current.position.set(-1.1 - r * 0.2, 0, 0.9 + r * 0.9)
      oldTyre.current.visible = k > 1.5 && k < 4.6
    }
  })
  return (
    <group>
      <Flat w={30} l={14} color="#4a4f57" />
      <Flat z={-3.4} w={30} l={1.4} color="#cfd2d6" y={LAYER.lot} />
      {[-1, 1].map((sd) => <Flat key={sd} z={sd * 2} w={5.6} l={0.12} color="#ffd54f" n={1} y={LAYER.paint} />)}
      {[-1, 1].map((sd) => <Flat key={sd} x={sd * 2.8} w={0.12} l={4} color="#ffd54f" n={1} y={LAYER.paint} />)}
      <Flat x={1.1} w={0.2} l={3.6} color="#fafafa" n={2} y={LAYER.paint} />
      {/* The garage behind: wall, open bay and the team sign. */}
      <mesh position={[0, 1.6, -4.3]}><boxGeometry args={[30, 3.2, 0.4]} /><meshStandardMaterial color="#eceff1" /></mesh>
      <mesh position={[0, 1.15, -4.08]}><planeGeometry args={[5, 2.3]} /><meshStandardMaterial color="#263238" /></mesh>
      <mesh position={[0, 2.75, -4.08]}><planeGeometry args={[1.6, 0.8]} /><meshStandardMaterial map={sign} /></mesh>
      {[-6, 6].map((x) => <mesh key={x} position={[x, 1.15, -4.08]}><planeGeometry args={[5, 2.3]} /><meshStandardMaterial color="#90a4ae" /></mesh>)}
      <ToolChest x={-2} z={-3.3} />
      <TyreStack x={2} z={-3.3} n={4} />
      <TyreStack x={2.7} z={-3.3} n={3} band="#fdd835" />
      <Crowd people={crew} scale={1.45} />
      <group ref={oldTyre}><Tyre x={0} z={0} r={0.34} w={0.26} ry={Math.PI / 2} /></group>
      <group ref={hero}>
        <group rotation-y={Math.PI / 2}><Car car={me} len={3.4} /></group>
      </group>
    </group>
  )
}

// Car Wash: the brushes sweep the car end to end under a cloud of bubbles.
const WASH_T = 3.2
const BUBBLES = 14
function WashCard({ me }: { me: ChaseCar }) {
  const rig = useRef<Group>(null)
  const bubbles = useRef<Group>(null)
  const seeds = useMemo(() => Array.from({ length: BUBBLES }, (_, i) => ({ x: ((i * 37) % 13) / 13 - 0.5, z: ((i * 53) % 11) / 11 - 0.5, d: (i * 0.23) % 1, s: 0.08 + ((i * 7) % 5) * 0.025 })), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const sweep = Math.sin((t / WASH_T) * Math.PI * 2) * 1.5
    if (rig.current) rig.current.position.x = sweep
    bubbles.current?.children.forEach((m, i) => {
      const s = seeds[i]
      const k = (t * 0.45 + s.d) % 1
      m.position.set(sweep + s.x * 1.6, 0.4 + k * 1.8, s.z * 1.8)
      m.scale.setScalar(s.s * (1 - k * 0.4) * (k < 0.9 ? 1 : (1 - k) * 10))
    })
  })
  return (
    <group>
      <Flat w={14} l={10} color="#b0bec5" />
      {[-1, 1].map((sd) => <Flat key={sd} z={sd * 1.6} w={14} l={0.08} color="#78909c" n={1} y={LAYER.paint} />)}
      <mesh position={[0, 1.6, -2.6]}><boxGeometry args={[14, 3.2, 0.2]} /><meshStandardMaterial color="#81d4fa" /></mesh>
      {[-1, 1].map((sd) => <mesh key={sd} position={[0, 0.5 + sd * 0.6, -2.48]}><boxGeometry args={[14, 0.06, 0.02]} /><meshStandardMaterial color="#e1f5fe" /></mesh>)}
      <group rotation-y={Math.PI / 2}><Car car={me} len={2.6} /></group>
      <group ref={rig}>
        <Brush x={0} z={1.15} spin={9} />
        <Brush x={0} z={-1.15} spin={-9} />
        <Brush x={0} z={0} spin={7} flat />
        {/* The gantry the brushes hang from. */}
        {[-1, 1].map((sd) => <mesh key={sd} position={[0, 1.3, sd * 1.75]}><boxGeometry args={[0.18, 2.6, 0.18]} /><meshStandardMaterial color="#1565c0" /></mesh>)}
        <mesh position={[0, 2.62, 0]}><boxGeometry args={[0.24, 0.2, 3.7]} /><meshStandardMaterial color="#1565c0" /></mesh>
      </group>
      <group ref={bubbles}>
        {seeds.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.75} roughness={0.2} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// Delivery Dash: out of the pizza shop, round the corner to the glowing drop, traffic crossing.
const DASH_T = 4
const DASH_PATH = new CubicBezierCurve3(new Vector3(-6, 0, 0.7), new Vector3(0.6, 0, 0.7), new Vector3(0.7, 0, 0.7), new Vector3(0.7, 0, -4.4))
function DeliveryCard({ me }: { me: ChaseCar }) {
  const hero = useRef<Group>(null)
  const cross = useRef<Group>(null)
  const beam = useRef<Group>(null)
  const ring = useRef<MeshBasicMaterial>(null)
  const traffic = useMemo(() => extras(1, me.model)[0], [me.model])
  useFrame(({ clock }) => {
    const k = clock.elapsedTime % DASH_T
    const p = Math.min(1, k / 3)
    if (hero.current) {
      DASH_PATH.getPoint(p, tmp)
      hero.current.position.set(tmp.x, 0, tmp.z)
      DASH_PATH.getTangent(Math.min(0.999, p), tmp)
      hero.current.rotation.y = Math.atan2(tmp.x, tmp.z)
      hero.current.visible = k < 3.4
    }
    if (cross.current) cross.current.position.x = 8 - ((k + 2.2) % DASH_T) * 4.5
    if (beam.current) beam.current.scale.setScalar(1 + 0.08 * Math.sin(k * 8))
    if (ring.current) ring.current.opacity = 0.22 + 0.1 * Math.sin(k * 8)
  })
  return (
    <Grounded.Provider value>
      <group>
        <Flat w={30} l={30} color="#7cb342" y={LAYER.outer} />
        <Flat w={30} l={3} color="#4a4f57" />
        <Flat w={3} l={30} color="#4a4f57" />
        {[-1, 1].map((sd) => (
          <group key={sd}>
            <Flat x={sd * 3.5} z={0} w={4} l={0.1} color="#fff59d" n={1} y={LAYER.paint} />
            <Flat x={0} z={sd * 3.5} w={0.1} l={4} color="#fff59d" n={1} y={LAYER.paint} />
          </group>
        ))}
        <group position={[-4, 0.02, -3.6]} scale={0.8}><BuildingModel def={buildingDef('pizza')} /></group>
        <group position={[4, 0.02, -4.2]} scale={0.8}><BuildingModel def={buildingDef('house')} /></group>
        <group position={[-4, 0.02, 4]} rotation-y={Math.PI} scale={0.8}><BuildingModel def={buildingDef('tree')} /></group>
        <group position={[0.7, 0, -4]}><Beacon beam={beam} ring={ring} /></group>
        <group ref={cross} position-z={-0.75} rotation-y={-Math.PI / 2}><Car car={traffic} len={1.5} /></group>
        <group ref={hero}><Car car={me} len={1.5} /></group>
      </group>
    </Grounded.Provider>
  )
}

// Stunt Ramp: up the ramp, a full flip in the air, down on the bullseye.
const STUNT_T = 3.4
const ANGLE = 0.5
const RAMP = 2.6
const RAMP_H = RAMP * Math.sin(ANGLE)
const RAMP_RUN = RAMP * Math.cos(ANGLE)
const LAND = 7
function StuntCard({ me }: { me: ChaseCar }) {
  const hero = useRef<Group>(null)
  useFrame(({ clock }) => {
    const k = clock.elapsedTime % STUNT_T
    const g = hero.current
    if (!g) return
    if (k < 0.7) {
      // Run up and onto the ramp.
      const x = -8 + (k / 0.7) * (8 - RAMP_RUN / 2) * 1.0
      const onRamp = Math.max(0, Math.min(RAMP_RUN, x + RAMP_RUN))
      g.position.set(x, x > -RAMP_RUN ? (onRamp / RAMP_RUN) * RAMP_H : 0, 0)
      g.rotation.z = x > -RAMP_RUN ? ANGLE : 0
    } else if (k < 2.2) {
      // In the air: a parabola from the lip to the deck, one full flip.
      const u = (k - 0.7) / 1.5
      const x0 = 0
      g.position.set(x0 + u * LAND, RAMP_H + u * 4.2 - u * u * (4.2 + RAMP_H), 0)
      g.rotation.z = ANGLE + smooth(u * 1.05) * (Math.PI * 2 - ANGLE)
    } else {
      const u = (k - 2.2) / 1.2
      g.position.set(LAND + u * 5 * (1 - u * 0.4), 0, 0)
      g.rotation.z = 0
    }
  })
  return (
    <group>
      <Flat w={40} l={14} color="#d7b98e" />
      <Flat x={-5} w={10} l={1.6} color="#a1887f" y={LAYER.lot} />
      {/* The ramp: a sloped deck on a frame. */}
      <group position={[-RAMP_RUN / 2, RAMP_H / 2, 0]} rotation-z={ANGLE}>
        <mesh><boxGeometry args={[RAMP, 0.1, 1.5]} /><meshStandardMaterial color="#ef6c00" /></mesh>
        {[0.25, 0.5, 0.75].map((f) => <mesh key={f} position={[(f - 0.5) * RAMP, 0.052, 0]}><boxGeometry args={[0.1, 0.01, 1.5]} /><meshStandardMaterial color="#fafafa" /></mesh>)}
      </group>
      <mesh position={[-0.05, RAMP_H / 2, 0]}><boxGeometry args={[0.1, RAMP_H, 1.4]} /><meshStandardMaterial color="#5d4037" /></mesh>
      {/* The landing target. */}
      {[1.3, 0.9, 0.5].map((r, i) => (
        <mesh key={r} position={[LAND + 0.4, LAYER.paint, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[r, 32]} />
          <meshBasicMaterial color={i % 2 ? '#fafafa' : '#e53935'} {...decal(i + 1)} />
        </mesh>
      ))}
      <mesh position={[LAND + 0.4, 0.05, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[3.4, 3.4]} />
        <meshBasicMaterial map={glowTex()} color="#ffd54f" transparent opacity={0.35} depthWrite={false} toneMapped={false} {...decal(4)} />
      </mesh>
      <Grandstand x={2} z={-4.5} h={0} width={16} rows={3} roof="#6a1b9a" />
      <group ref={hero}>
        <group position-y={0.0}>
          <group rotation-y={Math.PI / 2}><Car car={me} len={1.8} /></group>
        </group>
      </group>
    </group>
  )
}

const VIEWS: Record<CardGame, SceneView> = {
  chase: { dir: [0.12, 1.1, 1], at: [0.6, 0, 0.6], halfW: 3, halfH: 2.6, rise: 0.66 },
  park: { dir: [0.25, 1.5, 1], at: [-0.6, 0, -0.5], halfW: 3.6, halfH: 2.4, rise: 0.52 },
  pit: { dir: [0.12, 0.45, 1], at: [0, 0.7, 0], halfW: 3.4, halfH: 2.2, rise: 0.56 },
  wash: { dir: [0.75, 0.6, 1], at: [0, 0.9, 0], halfW: 2.6, halfH: 2, rise: 0.56 },
  delivery: { dir: [0.3, 1.4, 1], at: [-0.4, 0, -1.2], halfW: 5, halfH: 3, rise: 0.62 },
  stunt: { dir: [0.1, 0.3, 1], at: [3, 1.4, 0], halfW: 5.2, halfH: 2.4, rise: 0.56 },
}

const SCENES: Record<CardGame, (p: { me: ChaseCar }) => React.ReactNode> = {
  chase: ChaseCard, park: ParkCard, pit: PitCard, wash: WashCard, delivery: DeliveryCard, stunt: StuntCard,
}

// The card's moving picture. Without a car to show it draws nothing and the emoji art stays.
export function ArcadeCardScene({ game, me }: { game: CardGame; me: ChaseCar }) {
  const Scene = SCENES[game]
  return (
    <SceneThumb id={`arc|${game}|${carKey(me)}`} view={VIEWS[game]} className="arc-scene">
      {() => <Scene me={me} />}
    </SceneThumb>
  )
}
