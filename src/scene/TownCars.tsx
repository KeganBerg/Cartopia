import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshStandardMaterial, Vector3 } from 'three'
import type { Group, Mesh } from 'three'
import { anchors } from './anchors'
import { useGame, type OwnedCar } from '../game/store'
import { TILE, carDef, performance } from '../game/data'
import { tripRequests } from '../game/trips'
import { turnOf } from '../game/placement'
import { toWorld, DIRS } from './grid'
import { CarModel, carSize } from './CarModel'
import { liveTraffic as sim } from './traffic/live'
import { layoutRoads, lightAt, type Light } from './traffic/layout'

// Town cars are drawn a little smaller than in the garage so two fit side by side.
const SCALE = 1.1
const MAX_VISIBLE = 30

// Tow truck facing +z, drawn at its own spot on the road just ahead of the towed car.
function TowTruck() {
  return (
    <group>
      <group scale={SCALE}>
        <CarModel body="truck" color="#ff8f00" beams />
      </group>
      {/* Boom and hook reaching back to the towed car. */}
      <mesh position={[0, 0.7, -0.75]} rotation-x={0.5}>
        <boxGeometry args={[0.07, 0.07, 0.7]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      <mesh position={[0, 0.95, -0.15]}>
        <boxGeometry args={[0.44, 0.07, 0.18]} />
        <meshStandardMaterial color="#ffca28" emissive="#ffb300" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

function TownCar({ car }: { car: OwnedCar }) {
  const ref = useRef<Group>(null)
  const body = useRef<Group>(null)
  const truck = useRef<Group>(null)
  const def = carDef(car.model)
  const selected = useGame((s) => s.selectedCar === car.uid)
  useEffect(() => () => void anchors.delete(`car:${car.uid}`), [car.uid])

  useFrame(() => {
    const g = ref.current
    const a = sim.agents.get(car.uid)
    if (!g) return
    g.visible = !!a
    if (truck.current) truck.current.visible = false
    if (!a) return
    g.position.set(a.x, 0.02, a.z)
    g.rotation.y = a.yaw
    g.scale.setScalar(Math.max(0.001, a.show))
    // Broken down: slumped on a flat. Being towed: front wheels lifted.
    g.rotation.z = a.stalled && !a.tow ? 0.06 : 0
    if (body.current) body.current.rotation.x = a.tow >= 2 ? -0.1 * a.truck : 0
    const tp = sim.truckPose(a)
    const t = truck.current
    if (t && tp) {
      t.visible = tp.scale > 0.02
      t.position.set(tp.x, 0.02, tp.z)
      t.rotation.y = tp.yaw
      t.scale.setScalar(Math.max(0.001, tp.scale))
    }
    const p = anchors.get(`car:${car.uid}`) ?? new Vector3()
    anchors.set(`car:${car.uid}`, p.set(a.x, 1.1, a.z))
  })

  return (
    <>
      <group
        ref={ref}
        visible={false}
        onClick={(e) => {
          e.stopPropagation()
          const s = useGame.getState()
          if (s.mode !== 'play' || s.visiting) return
          s.selectCar(car.uid)
          s.openPanel(car.flat || car.lowFuel ? 'flat' : 'garage')
        }}
      >
        <group ref={body} scale={SCALE}>
          <CarModel body={def.body} color={car.color} highlight={selected} stripe={car.stripe} beams />
        </group>
      </group>
      <group ref={truck} visible={false}>
        <TowTruck />
      </group>
    </>
  )
}

const dark = new MeshStandardMaterial({ color: '#3a3a3a' })
const lit: Record<Light, MeshStandardMaterial> = {
  red: new MeshStandardMaterial({ color: '#f44336', emissive: '#f44336', emissiveIntensity: 1.4 }),
  yellow: new MeshStandardMaterial({ color: '#ffb300', emissive: '#ffb300', emissiveIntensity: 1.4 }),
  green: new MeshStandardMaterial({ color: '#4caf50', emissive: '#4caf50', emissiveIntensity: 1.4 }),
}
const ORDER: Light[] = ['red', 'yellow', 'green']

// A signal on the kerb at every lane coming into an intersection with lights,
// its arm reaching over the lane and its lamps facing the waiting cars.
function TrafficSignals({ roads }: { roads: string[] }) {
  const signals = useMemo(() => {
    const out: { key: string; x: number; z: number; yaw: number; offset: number; heading: number; clear: number }[] = []
    const { tiles, clusters } = layoutRoads(roads)
    for (const c of clusters) {
      if (!c.signal) continue
      for (const e of c.entries) {
        const from = tiles.get(e.from)!
        const [cx, cz] = toWorld(from.x, from.z)
        const [dx, dz] = DIRS[e.heading]
        const [rx, rz] = [-dz, dx]
        const along = TILE / 2 - 0.3
        const side = TILE / 2 - 0.16
        out.push({
          key: `${e.from}>${e.tile}`,
          x: cx + dx * along + rx * side,
          z: cz + dz * along + rz * side,
          // Local +z faces back down the road at the cars.
          yaw: Math.atan2(-dx, -dz),
          offset: c.offset, heading: e.heading, clear: c.clear,
        })
      }
    }
    return out
  }, [roads])
  const lamps = useRef<(Mesh | null)[]>([])
  useFrame(() => {
    signals.forEach((s, i) => {
      const now = lightAt(s.offset, s.heading, sim.t, s.clear)
      ORDER.forEach((l, k) => {
        for (const m of [lamps.current[i * 6 + k * 2], lamps.current[i * 6 + k * 2 + 1]]) if (m) m.material = now === l ? lit[l] : dark
      })
    })
  })
  return (
    <>
      {signals.map((s, i) => (
        <group key={s.key} position={[s.x, 0, s.z]} rotation-y={s.yaw}>
          <mesh position-y={0.75} castShadow>
            <cylinderGeometry args={[0.03, 0.04, 1.5, 6]} />
            <meshStandardMaterial color="#37474f" />
          </mesh>
          {/* Arm out over the lane, towards the middle of the road. */}
          <mesh position={[-0.25, 1.46, 0]}>
            <boxGeometry args={[0.5, 0.04, 0.04]} />
            <meshStandardMaterial color="#37474f" />
          </mesh>
          <group position={[-0.44, 1.2, 0]}>
            <mesh>
              <boxGeometry args={[0.17, 0.46, 0.12]} />
              <meshStandardMaterial color="#263238" />
            </mesh>
            {/* Round lamps bulging out front and back, so the light reads from any angle. */}
            {ORDER.map((l, k) => [1, -1].map((f) => (
              <mesh key={`${l}${f}`} ref={(m) => void (lamps.current[i * 6 + k * 2 + (f < 0 ? 1 : 0)] = m)} position={[0, 0.145 - k * 0.145, f * 0.05]}>
                <sphereGeometry args={[0.058, 10, 8]} />
                <primitive object={dark} attach="material" dispose={null} />
              </mesh>
            )))}
          </group>
        </group>
      ))}
    </>
  )
}

export function TownCars() {
  const roads = useGame((s) => (s.visiting ?? s).roads)
  const cars = useGame((s) => (s.visiting ?? s).cars)
  const buildings = useGame((s) => (s.visiting ?? s).buildings)
  const visitKey = useGame((s) => s.visiting?.ownerId ?? 'home')

  // Rebuild the road network only when roads or buildings move, not on every save.
  const townKey = JSON.stringify([visitKey, roads, buildings.map((b) => [b.uid, b.def, b.x, b.z, b.rot ?? null])])
  const town = useMemo(() => ({ roads, buildings }), [townKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    sim.setTown(town.roads, town.buildings, turnOf)
  }, [town])

  // Which cars are out and how they drive.
  const max = Math.min(MAX_VISIBLE, Math.max(3, Math.floor(roads.length * 0.5)))
  const specs = useMemo(
    () => cars.map((c) => {
      const def = carDef(c.model)
      const size = carSize(def.body)
      return {
        uid: c.uid,
        len: size.len * SCALE,
        wid: size.wid * SCALE,
        cruise: 1.1 + performance(def, c.upgrades) / 45,
        stalled: !!(c.flat || c.lowFuel),
      }
    }),
    [cars],
  )
  useEffect(() => {
    sim.setCars(specs, max)
  }, [specs, max, town])

  // One step of the whole town per frame, before the cars are drawn.
  useFrame((_, dt) => {
    for (const [uid, kind] of tripRequests) {
      sim.requestTrip(uid, kind)
      tripRequests.delete(uid)
    }
    sim.step(dt)
  }, -1)

  const shown = useMemo(() => {
    const out = [...cars].sort((a, b) => Number(!!(b.flat || b.lowFuel)) - Number(!!(a.flat || a.lowFuel)))
    return out.slice(0, max)
  }, [cars, max])

  if (!roads.length) return null
  return (
    <>
      <TrafficSignals roads={roads} />
      {shown.map((car) => (
        <TownCar key={`${visitKey}-${car.uid}`} car={car} />
      ))}
    </>
  )
}
