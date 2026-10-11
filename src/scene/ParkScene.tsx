import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, Mesh, MeshStandardMaterial, PerspectiveCamera } from 'three'
import { CarModel, carFrame } from './CarModel'
import { BuildingModel } from './BuildingModel'
import { holdTown } from './renderGate'
import { Batch } from './Batch'
import { LAYER, decal } from './layers'
import { asphaltTex, brickTex, paverTex, grassTex } from './textures'
import { ArcadeSky, Bin, CarShadow, Hydrant, Lamp, useArcadeLook } from './ArcadeScenery'
import { PARK_LEN, PARK_LOTS, PARK_MAX_BUMPS, PARKED_W, carHits, drive, parkedIn, type Box, type ParkLot, type Pose } from '../game/arcade'
import { BUILDINGS, CARS, TILE, buildingDef, isBike, type Body } from '../game/data'
import type { ChaseCar } from './ChaseScene'
import { bumpSound } from '../lib/arcadeSound'

// The screen writes the held controls here: steer +1 is left, pedal +1 is gas, -1 reverse.
export type ParkInput = { steer: number; pedal: number }
export type ParkHud = { time: number; bumps: number; inSpot: boolean }
export type ParkEnd = { parked: boolean; time: number; bumps: number }

const MAX_FWD = 3.4
const MAX_REV = 2.2
const WALK = 1.4 // sidewalk round the lot
const S = 1.2 // town buildings drawn this much bigger, to suit the lot's cars

// The shops that line the top of each lot, so every lot is somewhere in town.
const BACKDROPS: string[][] = [
  ['coffee', 'donut', 'icecream', 'pizza'],
  ['pizza', 'tacos', 'coffee', 'burger'],
  ['diner', 'tires', 'lube'],
  ['market', 'bowling', 'arcade'],
  ['tuner', 'parts', 'bodyshop'],
  ['motel', 'club'],
  ['stadium'],
  ['cinema', 'club', 'bowling'],
]

const PARKED_BODIES: Body[] = ['sedan', 'compact', 'suv', 'hatch', 'wagon', 'van', 'classic', 'coupe', 'truck', 'ev', 'luxury', 'muscle']
const PARKED = CARS.filter((c) => !c.parked && !isBike(c.body) && PARKED_BODIES.includes(c.body))

function Line({ x, z, h, w, l, color = '#f5f5f5', y = LAYER.paint }: { x: number; z: number; h: number; w: number; l: number; color?: string; y?: number }) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, h]}>
      <planeGeometry args={[w, l]} />
      <meshBasicMaterial color={color} {...decal()} />
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
        return <Line key={i} x={x} z={z} h={b.h} w={w} l={l} color={color} y={LAYER.paint + 0.003} />
      })}
    </>
  )
}

// A painted aisle arrow pointing along +z before rotation.
function Arrow({ x, z, h }: { x: number; z: number; h: number }) {
  return (
    <group position={[x, LAYER.paint, z]} rotation-y={h}>
      <mesh rotation-x={-Math.PI / 2} position-z={-0.25}><planeGeometry args={[0.16, 0.7]} /><meshBasicMaterial color="#f5f5f5" {...decal()} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-z={0.22}><circleGeometry args={[0.28, 3, Math.PI / 2]} /><meshBasicMaterial color="#f5f5f5" {...decal()} /></mesh>
    </group>
  )
}

// Concrete wheel stop at the head of a stall.
function WheelStop({ x, z, h }: { x: number; z: number; h: number }) {
  return (
    <mesh position={[x, 0.05, z]} rotation-y={h}>
      <boxGeometry args={[0.62, 0.1, 0.14]} />
      <meshStandardMaterial color="#e0dcd5" />
    </mesh>
  )
}

// Everything that never moves: the lot, its markings, the sidewalk, shops, street and planting.
function LotScenery({ lot, index }: { lot: ParkLot; index: number }) {
  const W = lot.w, L = lot.l
  const tex = useMemo(() => {
    const a = asphaltTex().clone()
    a.repeat.set(W / 2.5, L / 2.5)
    a.needsUpdate = true
    const road = asphaltTex().clone()
    road.repeat.set(40 / 2.5, 4 / 2.5)
    road.needsUpdate = true
    return { a, road }
  }, [W, L])
  const shops = useMemo(() => {
    const list = (BACKDROPS[index] ?? BACKDROPS[0]).filter((d) => BUILDINGS.some((b) => b.id === d))
    const out: { x: number; def: string; w: number; d: number }[] = []
    let x = -W / 2 - 6
    for (let i = 0; x < W / 2 + 6; i++) {
      const def = buildingDef(list[i % list.length])
      const w = def.w * TILE * S, d = def.h * TILE * S
      out.push({ x: x + w / 2, def: def.id, w, d })
      x += w + 0.5
    }
    return out
  }, [index, W])
  const backZ = -L / 2 - WALK - 0.3
  const roadZ = L / 2 + WALK + 2
  const stalls = [...lot.cars.map((p) => ({ ...p, w: PARKED_W + 0.5, l: PARK_LEN + 0.6 })), { ...lot.spot }]
  return (
    <group>
      {/* Grass round everything. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.outer, 0]}>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial map={grassTex(14, 14)} />
      </mesh>
      {/* Lot surface and its sidewalk, with a kerb between. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, 0]}>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial map={tex.a} />
      </mesh>
      {[[0, -L / 2 - WALK / 2, W + WALK * 2, WALK], [0, L / 2 + WALK / 2, W + WALK * 2, WALK], [-W / 2 - WALK / 2, 0, WALK, L], [W / 2 + WALK / 2, 0, WALK, L]].map(([x, z, w, l], i) => (
        <mesh key={i} position={[x, 0.07, z]}>
          <boxGeometry args={[w, 0.14, l]} />
          <meshStandardMaterial map={paverTex(w / 0.8, l / 0.8)} />
        </mesh>
      ))}
      {[[0, -L / 2 - 0.05, W + 0.2, 0.1], [0, L / 2 + 0.05, W + 0.2, 0.1], [-W / 2 - 0.05, 0, 0.1, L], [W / 2 + 0.05, 0, 0.1, L]].map(([x, z, w, l], i) => (
        <mesh key={i} position={[x, 0.08, z]}>
          <boxGeometry args={[w, 0.16, l]} />
          <meshStandardMaterial color="#d7dade" />
        </mesh>
      ))}
      {/* The way in: a gap in the bottom kerb painted with an arrow. */}
      <Arrow x={lot.start.x} z={L / 2 - 0.5} h={Math.PI} />
      {/* Shops along the top. */}
      {shops.map((s, i) => (
        <group key={i} position={[s.x, 0, backZ - s.d / 2]}>
          <mesh rotation-x={-Math.PI / 2} position-y={LAYER.lot}>
            <planeGeometry args={[s.w + 0.5, s.d]} />
            <meshStandardMaterial map={paverTex(s.w / 2, s.d / 2)} />
          </mesh>
          <group scale={S}>
            <BuildingModel def={buildingDef(s.def)} />
          </group>
        </group>
      ))}
      {/* A street along the bottom, with a far sidewalk and a row of trees. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, roadZ]}>
        <planeGeometry args={[40, 4]} />
        <meshStandardMaterial map={tex.road} />
      </mesh>
      {Array.from({ length: 13 }, (_, i) => <Line key={i} x={-18 + i * 3} z={roadZ} h={Math.PI / 2} w={0.1} l={1.4} />)}
      <mesh position={[0, 0.07, roadZ + 2.7]}>
        <boxGeometry args={[40, 0.14, 1.4]} />
        <meshStandardMaterial map={paverTex(50, 2)} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} position={[-14 + i * 4, 0, roadZ + 4.3]} scale={S * 0.9}>
          <BuildingModel def={buildingDef(i % 3 === 1 ? 'pine' : 'tree')} />
        </group>
      ))}
      {/* Planting down both sides. */}
      {[-1, 1].map((sd) => Array.from({ length: 5 }, (_, i) => {
        const z = -L / 2 + 1.5 + i * ((L - 3) / 4)
        return (
          <group key={`${sd}${i}`} position={[sd * (W / 2 + WALK + 1.1), 0, z]} scale={S * 0.85}>
            <BuildingModel def={buildingDef(i % 2 ? 'pine' : 'tree')} />
          </group>
        )
      }))}
      {[-1, 1].map((sd) => [-L / 2 + 0.6, 0, L / 2 - 0.6].map((z, i) => (
        <Lamp key={`${sd}${i}`} x={sd * (W / 2 + 0.45)} z={z} ry={sd > 0 ? -Math.PI / 2 : Math.PI / 2} />
      )))}
      <Hydrant x={W / 2 + WALK * 0.6} z={L / 2 + WALK * 0.5} />
      <Bin x={-W / 2 - WALK * 0.6} z={-L / 2 - WALK * 0.5} />
      <Bin x={W / 2 + WALK * 0.6} z={-L / 2 - WALK * 0.5} />
      {/* Stall lines and wheel stops. */}
      {stalls.map((b, i) => {
        const c = Math.cos(b.h), s = Math.sin(b.h)
        // The wheel stop sits at the stall's far end: the one further from the middle of the lot.
        const ends = [1, -1].map((e) => ({ e, x: b.x + (b.l / 2 - 0.12) * e * s, z: b.z + (b.l / 2 - 0.12) * e * c }))
        const stop = ends[0].x ** 2 + ends[0].z ** 2 >= ends[1].x ** 2 + ends[1].z ** 2 ? ends[0] : ends[1]
        return (
          <group key={i}>
            {[-1, 1].map((sd) => <Line key={sd} x={b.x + (sd * b.w) / 2 * c} z={b.z - (sd * b.w) / 2 * s} h={b.h} w={0.07} l={b.l} />)}
            <WheelStop x={stop.x} z={stop.z} h={b.h} />
          </group>
        )
      })}
      {lot.walls.map((w, i) => (
        <group key={i} position={[w.x, 0, w.z]} rotation-y={w.h}>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[w.w, 0.7, w.l]} />
            <meshStandardMaterial map={brickTex(Math.max(w.w, w.l) / 1.2, 0.7)} color="#c9907a" />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <boxGeometry args={[w.w + 0.06, 0.06, w.l + 0.06]} />
            <meshStandardMaterial color="#cfc6bb" />
          </mesh>
        </group>
      ))}
      {lot.cones.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          <mesh position={[0, 0.25, 0]}><coneGeometry args={[0.18, 0.5, 12]} /><meshStandardMaterial color="#ff6d00" /></mesh>
          <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.4, 0.04, 0.4]} /><meshStandardMaterial color="#e65100" /></mesh>
          <mesh position={[0, 0.27, 0]}><cylinderGeometry args={[0.102, 0.122, 0.08, 12]} /><meshStandardMaterial color="#ffffff" /></mesh>
        </group>
      ))}
    </group>
  )
}

export function ParkScene({ lot, me, input, running, onHud, onEnd }: {
  lot: ParkLot; me: ChaseCar; input: ParkInput; running: boolean
  onHud: (h: ParkHud) => void; onEnd: (e: ParkEnd) => void
}) {
  useEffect(() => holdTown(), [])
  const view = useArcadeLook()
  const index = PARK_LOTS.indexOf(lot)
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

  const parked = useMemo(() => lot.cars.map((p, i) => {
    const c = PARKED[(i * 5 + index * 3) % PARKED.length]
    return { ...p, body: c.body, model: c.id, color: c.colors[(i + index) % c.colors.length] }
  }), [lot, index])

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
      m.emissive.set(s.inSpot ? '#00e676' : '#ffd54f')
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
      <ArcadeSky view={view} near={40} far={140} dome={false} />
      <Batch version={index}>
        <LotScenery lot={lot} index={index} />
      </Batch>
      <mesh ref={spotFill} position={[spot.x, LAYER.paint + 0.002, spot.z]} rotation={[-Math.PI / 2, 0, spot.h]}>
        <planeGeometry args={[spot.w, spot.l]} />
        <meshStandardMaterial color="#ffd54f" transparent opacity={0.35} emissive="#ffd54f" emissiveIntensity={0.4} depthWrite={false} {...decal(2)} />
      </mesh>
      <Outline b={spot} t={0.09} color="#ffd54f" />
      {parked.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation-y={p.h}>
          <CarShadow len={PARK_LEN} wid={PARKED_W} />
          <group scale={PARK_LEN / carFrame(p.body).len}>
            <CarModel body={p.body} model={p.model} color={p.color} />
          </group>
        </group>
      ))}
      <group ref={player} position={[lot.start.x, 0, lot.start.z]} rotation-y={lot.start.h}>
        <CarShadow len={PARK_LEN} wid={carW} />
        <group scale={scale}>
          <CarModel body={me.body} model={me.model} color={me.color} finish={me.finish} skin={me.skin} mods={me.mods} beams={view.beams} />
        </group>
      </group>
    </>
  )
}
