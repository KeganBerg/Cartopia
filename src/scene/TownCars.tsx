import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { anchors } from './anchors'
import { MeshStandardMaterial, Vector3 } from 'three'
import type { Group } from 'three'
import { useGame, footprint, type OwnedCar, type PlacedBuilding } from '../game/store'
import { TILE, buildingDef, carDef, performance } from '../game/data'
import { tripRequests, type TripKind } from '../game/trips'
import { toWorld, DIRS } from './grid'
import { CarModel } from './CarModel'

const MAX_VISIBLE = 30
const LANE = 0.42

type Tile = [number, number]
// A building cars can pull into: the road tile out front and the parking spot.
// dir points from the lot to the road; cars pull over at the kerb in front, parallel to the road.
type Stop = { uid: string; def: string; road: Tile; park: [number, number]; dir: [number, number] }
type Mode = 'roam' | 'route' | 'enter' | 'park' | 'leave'
type Agent = {
  from: Tile; to: Tile; t: number
  mode: Mode; path: Tile[]; stop: Stop | null; tow: boolean
  timer: number; nextVisit: number
  lane: [number, number, number] // where the car left the road, for pulling in and out
  face: number // heading while pulled over
  pending: { stop: Stop; tow: boolean } | null // a trip asked for while parked, started once the car is back on the road
  v: number // 0..1 share of cruising speed, eased so cars brake and pull away smoothly
  wait: number // seconds spent stopped behind another car
}

// Where every car on the road is and which way it faces, so each can keep its distance.
type Traffic = { x: number; z: number; road: boolean; waitingOn: string | null; atLight?: boolean }
const traffic = new Map<string, Traffic>()
// Queued behind a car that is waiting at a red light: also just waiting.
const blockedAtLight = (id: string | null) => !!id && !!traffic.get(id)?.atLight
// Centre-to-centre gap a following car keeps, and where it starts to brake.
const GAP = 1.9
const BRAKE = 3

// Traffic lights at four-way crossings. One clock drives every signal: north-south
// traffic gets green, then amber, then east-west does the same.
const CYCLE = 10
const GREEN = 4.2
type Light = 'green' | 'amber' | 'red'
function lightFor(axis: 'x' | 'z', now: number): Light {
  const t = (now / 1000) % CYCLE
  const mine = axis === 'z' ? t : (t + CYCLE / 2) % CYCLE
  return mine < GREEN ? 'green' : mine < CYCLE / 2 ? 'amber' : 'red'
}
// Where a car waits on red, as a share of the way to the crossing's centre.
const STOP_AT = 0.4

const key = (t: Tile) => `${t[0]},${t[1]}`
const same = (a: Tile, b: Tile) => a[0] === b[0] && a[1] === b[1]
const isCrossing = (roads: Set<string>, t: Tile) => DIRS.every(([dx, dz]) => roads.has(key([t[0] + dx, t[1] + dz])))

function pickNext(roads: Set<string>, from: Tile, at: Tile): Tile {
  const options = DIRS.map(([dx, dz]) => [at[0] + dx, at[1] + dz] as Tile).filter((t) => roads.has(key(t)))
  const forward = options.filter((t) => !same(t, from))
  const pool = forward.length ? forward : options
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : at
}

// Shortest road route between two tiles (breadth-first), excluding the start.
// Shortest road path, optionally around one tile (e.g. a jam the car just turned away from).
function route(roads: Set<string>, start: Tile, goal: Tile, avoid?: Tile): Tile[] | null {
  if (same(start, goal)) return []
  const prev = new Map<string, string>([[key(start), '']])
  if (avoid && !same(avoid, goal)) prev.set(key(avoid), '')
  const queue: Tile[] = [start]
  while (queue.length) {
    const cur = queue.shift()!
    for (const [dx, dz] of DIRS) {
      const n: Tile = [cur[0] + dx, cur[1] + dz]
      const k = key(n)
      if (!roads.has(k) || prev.has(k)) continue
      prev.set(k, key(cur))
      if (same(n, goal)) {
        const path: Tile[] = []
        for (let at = k; at && at !== key(start); at = prev.get(at)!) path.unshift(at.split(',').map(Number) as Tile)
        return path
      }
      queue.push(n)
    }
  }
  return null
}

function stopFor(b: PlacedBuilding, roads: Set<string>): Stop | null {
  const d = buildingDef(b.def)
  if (d.kind === 'decor' || d.kind === 'obstacle' || d.kind === 'house') return null
  // Only buildings that touch a road get visits, so no car ever crosses another lot.
  for (const [fx, fz] of footprint(b.def, b.x, b.z, b.rot)) {
    for (const [dx, dz] of DIRS) {
      const road: Tile = [fx + dx, fz + dz]
      if (!roads.has(key(road))) continue
      const [tx, tz] = toWorld(fx, fz)
      // The kerb strip just outside the lot: clear of the building, half on the pavement.
      const park: [number, number] = [tx + dx * 1.05, tz + dz * 1.05]
      return { uid: b.uid, def: b.def, road, park, dir: [dx, dz] }
    }
  }
  return null
}

function TowTruck() {
  return (
    <group position={[0, 0, 2.2]}>
      <group scale={1.3}>
        <CarModel body="truck" color="#ff8f00" beams />
      </group>
      {/* Boom and hook reaching back to the towed car. */}
      <mesh position={[0, 0.85, -0.7]} rotation-x={0.5}>
        <boxGeometry args={[0.08, 0.08, 0.9]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      <mesh position={[0, 1.1, -0.35]}>
        <boxGeometry args={[0.5, 0.08, 0.2]} />
        <meshStandardMaterial color="#ffca28" emissive="#ffb300" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

function DrivingCar({ car, roads, start, stops }: { car: OwnedCar; roads: Set<string>; start: Tile; stops: Stop[] }) {
  const ref = useRef<Group>(null)
  const truck = useRef<Group>(null)
  const body = useRef<Group>(null)
  const def = carDef(car.model)
  const speed = 1.2 + performance(def, car.upgrades) / 40
  const agent = useRef<Agent>({
    from: start, to: pickNext(roads, start, start), t: Math.random(),
    mode: 'roam', path: [], stop: null, tow: false, timer: 0,
    nextVisit: 15 + Math.random() * 45, lane: [0, 0, 0], face: 0, pending: null, v: 1, wait: 0,
  })
  useEffect(() => () => void traffic.delete(car.uid), [car.uid])
  const selected = useGame((s) => s.selectedCar === car.uid)

  const goTo = (a: Agent, stop: Stop, tow = false) => {
    const path = route(roads, a.to, stop.road)
    if (!path) return false
    a.mode = 'route'
    a.stop = stop
    a.path = path
    a.tow = tow
    return true
  }

  useFrame((_, rawDt) => {
    const g = ref.current
    if (!g) return
    const dt = Math.min(rawDt, 0.1)
    const a = agent.current
    const anchor = () => {
      const p = anchors.get(`car:${car.uid}`) ?? new Vector3()
      anchors.set(`car:${car.uid}`, p.set(g.position.x, 1.1, g.position.z))
    }
    if (truck.current) truck.current.visible = a.tow

    // A service trip was just paid for: head to the right building.
    const trip: TripKind | undefined = tripRequests.get(car.uid)
    if (trip) {
      tripRequests.delete(car.uid)
      const want = trip === 'gas' ? 'gas' : trip === 'tires' ? 'tires' : 'rescue'
      const stop = stops.find((s) => s.def === want) ?? (trip === 'tow' ? stops.find((s) => s.def === 'tires') : undefined)
      if (stop) {
        // Parked or pulling in: drive back out to the road first, then set off.
        if (a.mode === 'park' || a.mode === 'enter' || a.mode === 'leave') {
          a.pending = { stop, tow: trip === 'tow' }
          if (a.mode !== 'leave') { a.timer = a.mode === 'enter' ? 1 - a.timer : 0; a.mode = 'leave' }
        } else goTo(a, stop, trip === 'tow')
      }
    }

    const stuck = (car.flat || car.lowFuel) && !a.tow
    if (stuck && (a.mode === 'roam' || a.mode === 'route')) {
      g.rotation.z = 0.06
      traffic.set(car.uid, { x: g.position.x, z: g.position.z, road: true, waitingOn: null })
      anchor()
      return
    }
    g.rotation.z = 0
    // Towed cars ride with their front wheels lifted.
    if (body.current) body.current.rotation.x = a.tow ? -0.12 : 0

    if (a.mode === 'enter' || a.mode === 'leave' || a.mode === 'park') {
      traffic.set(car.uid, { x: g.position.x, z: g.position.z, road: false, waitingOn: null })
      const s = a.stop!
      if (a.mode === 'park') {
        a.timer -= dt
        if (a.timer <= 0) { a.mode = 'leave'; a.timer = 0 }
      } else {
        a.timer = Math.min(1, a.timer + dt * 0.9)
        const k = a.mode === 'enter' ? a.timer : 1 - a.timer
        const e = k * k * (3 - 2 * k)
        g.position.set(a.lane[0] + (s.park[0] - a.lane[0]) * e, 0.02, a.lane[2] + (s.park[1] - a.lane[2]) * e)
        const target = a.face
        let diff = target - g.rotation.y
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        g.rotation.y += diff * Math.min(1, dt * 6)
        if (a.timer >= 1) {
          if (a.mode === 'enter') {
            a.mode = 'park'
            a.tow = false
            a.timer = 6 + Math.random() * 10
          } else {
            a.mode = 'roam'
            a.stop = null
            // Carry on the way the car is facing, so it pulls away instead of spinning round.
            const ahead: Tile = [s.road[0] + Math.round(Math.sin(a.face)), s.road[1] + Math.round(Math.cos(a.face))]
            a.from = s.road
            a.to = roads.has(key(ahead)) ? ahead : pickNext(roads, s.road, s.road)
            a.t = 0
            a.nextVisit = 25 + Math.random() * 50
            if (a.pending) {
              goTo(a, a.pending.stop, a.pending.tow)
              a.pending = null
            }
          }
        }
      }
      anchor()
      return
    }

    // Road under the car was removed: hop to the starting tile again.
    if (!roads.has(key(a.to)) || !roads.has(key(a.from))) {
      a.from = start
      a.to = pickNext(roads, start, start)
      a.t = 0
      a.mode = 'roam'
      a.tow = false
    }

    // Now and then, pull into a business for a while.
    if (a.mode === 'roam' && stops.length && !car.flat && !car.lowFuel) {
      a.nextVisit -= dt
      if (a.nextVisit <= 0) {
        a.nextVisit = 20 + Math.random() * 40
        goTo(a, stops[Math.floor(Math.random() * stops.length)])
      }
    }

    // Brake for the nearest car ahead in this lane.
    {
      const [fx0, fz0] = toWorld(...a.from)
      const [tx0, tz0] = toWorld(...a.to)
      const fl = Math.hypot(tx0 - fx0, tz0 - fz0) || 1
      const fx = (tx0 - fx0) / fl
      const fz = (tz0 - fz0) / fl
      let gap = Infinity
      let blocker: string | null = null
      for (const [id, o] of traffic) {
        if (id === car.uid || !o.road) continue
        const rx = o.x - g.position.x
        const rz = o.z - g.position.z
        const ahead = rx * fx + rz * fz
        if (ahead <= 0.05 || ahead > BRAKE) continue
        if (Math.abs(rx * fz - rz * fx) > 0.5) continue
        // Two cars waiting on each other at a junction: the lower id goes first.
        if (o.waitingOn === car.uid && car.uid < id) continue
        if (ahead < gap) { gap = ahead; blocker = id }
      }
      let go = Math.max(0, Math.min(1, (gap - GAP) / (BRAKE - GAP)))
      // Stop at the line on red or amber; a car already past it carries on.
      if (a.t < STOP_AT && isCrossing(roads, a.to) && lightFor(a.to[0] !== a.from[0] ? 'x' : 'z', Date.now()) !== 'green') {
        go = Math.min(go, Math.max(0, (STOP_AT - a.t) * fl - 0.02) / 0.9)
      }
      a.v += (go - a.v) * Math.min(1, dt * (go < a.v ? 8 : 3))
      const atLight = a.t < STOP_AT && isCrossing(roads, a.to) && STOP_AT - a.t < 0.1
      // Waiting at a red light is not being stuck.
      a.wait = go < 0.05 && !atLight && !blockedAtLight(blocker) ? a.wait + dt : 0
      traffic.set(car.uid, { x: g.position.x, z: g.position.z, road: true, waitingOn: go < 0.5 ? blocker : null, atLight: atLight || blockedAtLight(blocker) })
      // Stuck for a while (a stalled car, a jam): turn around and find another way.
      if (a.wait > 4) {
        a.wait = 0
        const back = a.from
        a.from = a.to
        a.to = back
        a.t = 1 - a.t
        a.v = 0.3
        if (a.mode === 'route' && a.stop) {
          const path = route(roads, a.to, a.stop.road, a.from) ?? route(roads, a.to, a.stop.road)
          if (path) a.path = path
          else { a.mode = 'roam'; a.stop = null; a.tow = false }
        }
      }
    }

    a.t += dt * speed * (a.tow ? 0.6 : 0.5) * a.v
    while (a.t >= 1) {
      a.t -= 1
      if (a.mode === 'route' && a.stop && same(a.to, a.stop.road)) {
        // Arrived out front: pull in from the lane.
        a.t = 0
        a.lane = [g.position.x, 0, g.position.z]
        // Pull over parallel to the road, keeping the direction the car was already going.
        const [sx, sz] = a.stop.dir
        const f = Math.atan2(-sz, sx)
        const heading = g.rotation.y
        a.face = Math.cos(f - heading) >= 0 ? f : f + Math.PI
        a.mode = 'enter'
        a.timer = 0
        anchor()
        return
      }
      const next = a.mode === 'route' && a.path.length ? a.path.shift()! : pickNext(roads, a.from, a.to)
      a.from = a.to
      a.to = next
    }
    const [ax, az] = toWorld(...a.from)
    const [bx, bz] = toWorld(...a.to)
    const dx = bx - ax
    const dz = bz - az
    const len = Math.hypot(dx, dz) || 1
    // Keep to the right-hand lane.
    const ox = (-dz / len) * LANE
    const oz = (dx / len) * LANE
    // Ease toward the lane position so corners, lane changes and U-turns flow instead of snapping.
    const px = ax + dx * a.t + ox
    const pz = az + dz * a.t + oz
    if (Math.hypot(px - g.position.x, pz - g.position.z) > 3) g.position.set(px, 0.02, pz)
    else {
      const k = Math.min(1, dt * 8)
      g.position.set(g.position.x + (px - g.position.x) * k, 0.02, g.position.z + (pz - g.position.z) * k)
    }
    if (len > 0.01) {
      const target = Math.atan2(dx, dz)
      let diff = target - g.rotation.y
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      g.rotation.y += diff * Math.min(1, dt * 10)
    }
    anchor()
  })

  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation()
        const s = useGame.getState()
        if (s.mode !== 'play' || s.visiting) return
        s.selectCar(car.uid)
        s.openPanel(car.flat || car.lowFuel ? 'flat' : 'garage')
      }}
    >
      <group ref={body} scale={1.3}>
        <CarModel body={def.body} color={car.color} highlight={selected} stripe={car.stripe} beams />
      </group>
      <group ref={truck} visible={false}>
        <TowTruck />
      </group>
    </group>
  )
}

const lightMats = {
  z: new MeshStandardMaterial({ color: '#43a047', emissive: '#43a047', emissiveIntensity: 1.2 }),
  x: new MeshStandardMaterial({ color: '#e53935', emissive: '#e53935', emissiveIntensity: 1.2 }),
}
const LIGHT_COLORS: Record<Light, string> = { green: '#4caf50', amber: '#ffb300', red: '#f44336' }

// A signal pole on each corner of a crossing, with a lamp facing each road.
function TrafficLights({ roads }: { roads: Set<string> }) {
  const crossings = useMemo(() => [...roads].map((k) => k.split(',').map(Number) as Tile).filter((t) => isCrossing(roads, t)), [roads])
  useFrame(() => {
    const now = Date.now()
    for (const axis of ['x', 'z'] as const) {
      const c = LIGHT_COLORS[lightFor(axis, now)]
      lightMats[axis].color.set(c)
      lightMats[axis].emissive.set(c)
    }
  })
  const c = TILE / 2 - 0.12
  return (
    <>
      {crossings.map((t) => {
        const [wx, wz] = toWorld(...t)
        return (
          <group key={key(t)} position={[wx, 0, wz]}>
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
              <group key={`${sx}${sz}`} position={[sx * c, 0, sz * c]}>
                <mesh position-y={0.6}>
                  <cylinderGeometry args={[0.03, 0.04, 1.2, 6]} />
                  <meshStandardMaterial color="#37474f" />
                </mesh>
                <mesh position-y={1.18}>
                  <boxGeometry args={[0.22, 0.22, 0.22]} />
                  <meshStandardMaterial color="#263238" />
                </mesh>
                {/* Lamps face the traffic coming along each road. */}
                <mesh position={[0, 1.18, sz * 0.115]}>
                  <sphereGeometry args={[0.075, 10, 8]} />
                  <primitive object={lightMats.z} attach="material" dispose={null} />
                </mesh>
                <mesh position={[sx * 0.115, 1.18, 0]}>
                  <sphereGeometry args={[0.075, 10, 8]} />
                  <primitive object={lightMats.x} attach="material" dispose={null} />
                </mesh>
              </group>
            ))}
          </group>
        )
      })}
    </>
  )
}

export function TownCars() {
  const roadsList = useGame((s) => (s.visiting ?? s).roads)
  const cars = useGame((s) => (s.visiting ?? s).cars)
  const buildings = useGame((s) => (s.visiting ?? s).buildings)
  const visitKey = useGame((s) => s.visiting?.ownerId ?? 'home')
  const roads = useMemo(() => new Set(roadsList), [roadsList])
  const starts = useMemo(() => [...roads].map((k) => k.split(',').map(Number) as Tile), [roads])
  const stops = useMemo(() => buildings.map((b) => stopFor(b, roads)).filter((s): s is Stop => !!s), [buildings, roads])
  if (!starts.length) return null
  return (
    <>
      <TrafficLights roads={roads} />
      {cars.slice(0, MAX_VISIBLE).map((car, i) => (
        <DrivingCar key={`${visitKey}-${car.uid}`} car={car} roads={roads} start={starts[(i * 7919) % starts.length]} stops={stops} />
      ))}
    </>
  )
}
