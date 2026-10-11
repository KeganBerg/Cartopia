import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferGeometry, CylinderGeometry, Euler, Matrix4, MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, PlaneGeometry, Quaternion, SphereGeometry, Vector3 } from 'three'
import type { Group, InstancedMesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { anchors } from './anchors'
import { useGame, type OwnedCar } from '../game/store'
import { TILE, carDef, performance } from '../game/data'
import { tripRequests, visitRequests } from '../game/trips'
import { pedestrianCrossings } from '../game/walkGraph'
import { showcaseOf } from '../game/meet'
import { turnOf } from '../game/placement'
import { toWorld, DIRS } from './grid'
import { CarModel, carSize, wheelRig, type WheelRig } from './CarModel'
import { wheelPool } from './carBatch'
import { liveTraffic as sim } from './traffic/live'
import { layoutRoads, type Light } from './traffic/layout'
import { useVisitors, tapVisitor, type Visitor } from '../lib/visitors'

const visitKeyIsAway = (key: string) => key !== 'home'
// A visitor's car as a town car (its uid starts "visitor:", which the traffic sim fades out on leaving).
const visitorCar = (v: Visitor): OwnedCar => ({
  uid: `visitor:${v.id}`, model: v.model, color: v.color, upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 },
  stripe: v.kind === 'racer' ? '#fafafa' : null,
})

// Town cars are drawn a little smaller than in the garage so two fit side by side.
const SCALE = 1.1
const MAX_VISIBLE = 30

// Tow truck facing +z, drawn at its own spot on the road just ahead of the towed car.
// `crane` leaves off the fixed boom for scenes that animate their own.
export function TowTruck({ rig, crane }: { rig?: WheelRig; crane?: boolean }) {
  return (
    <group>
      <group scale={SCALE}>
        <CarModel body="truck" color="#ff8f00" beams rig={rig} />
      </group>
      {/* Boom and hook reaching back to the towed car. */}
      {!crane && (
        <mesh position={[0, 0.7, -0.75]} rotation-x={0.5}>
          <boxGeometry args={[0.07, 0.07, 0.7]} />
          <meshStandardMaterial color="#37474f" />
        </mesh>
      )}
      <mesh position={[0, 0.95, -0.15]}>
        <boxGeometry args={[0.44, 0.07, 0.18]} />
        <meshStandardMaterial color="#ffca28" emissive="#ffb300" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

// onTap: what tapping it does instead of opening the garage (a visitor's car).
function TownCar({ car, onTap }: { car: OwnedCar; onTap?: () => void }) {
  const ref = useRef<Group>(null)
  const body = useRef<Group>(null)
  const truck = useRef<Group>(null)
  const def = carDef(car.model)
  const rig = useMemo(() => wheelRig(def.body), [def.body])
  const selected = useGame((s) => s.selectedCar === car.uid)
  useEffect(() => () => void anchors.delete(`car:${car.uid}`), [car.uid])

  useFrame((_, dt) => {
    const g = ref.current
    const a = sim.agents.get(car.uid)
    if (!g) return
    g.visible = !!a
    if (truck.current) truck.current.visible = false
    if (!a) {
      anchors.delete(`car:${car.uid}`)
      rig.slots?.forEach((w) => w && wheelPool.place(w, null))
      return
    }
    g.position.set(a.x, 0.02, a.z)
    g.rotation.y = a.yaw
    g.scale.setScalar(Math.max(0.001, a.show))
    // Broken down: slumped on a flat. Being towed: front wheels lifted.
    g.rotation.z = a.stalled && !a.tow ? 0.06 : 0
    if (body.current) body.current.rotation.x = a.tow >= 2 ? -0.1 * a.truck : 0
    // Front wheels steer into the bend; all four roll with the road.
    const steer = a.v > 0.01 || a.parked ? sim.steerOf(a, rig.base * SCALE) : null
    for (const w of rig.steer) if (w && steer !== null) w.rotation.y += (steer - w.rotation.y) * Math.min(1, Math.min(dt, 0.1) * 10)
    const roll = (a.v * Math.min(dt, 0.1)) / (rig.radius * SCALE)
    for (const w of rig.spin) if (w) w.rotation.x = (w.rotation.x + roll) % (Math.PI * 2)
    rig.slots?.forEach((w, i) => w && wheelPool.place(w, rig.spin[i]))
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
          if (onTap) return onTap()
          s.selectCar(car.uid)
          s.openPanel(car.flat || car.lowFuel ? 'flat' : 'garage')
        }}
      >
        <group ref={body} scale={SCALE}>
          <CarModel body={def.body} model={def.id} color={car.color} finish={car.finish} skin={car.skin} highlight={selected} stripe={car.stripe} mods={car.mods} beams rig={rig} lean />
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
const LAMPS = [dark, lit.red, lit.yellow, lit.green]
const lampGeo = new SphereGeometry(0.058, 10, 8)
const hidden = new Matrix4().makeScale(0, 0, 0)
const mats = {
  pole: new MeshStandardMaterial({ color: '#37474f' }),
  arm: new MeshStandardMaterial({ color: '#37474f' }),
  housing: new MeshStandardMaterial({ color: '#263238' }),
  signPole: new MeshStandardMaterial({ color: '#9e9e9e' }),
  signRim: new MeshStandardMaterial({ color: '#fafafa' }),
  signFace: new MeshStandardMaterial({ color: '#c62828' }),
  signBar: new MeshBasicMaterial({ color: '#fafafa' }),
}

type Signal = { key: string; x: number; z: number; yaw: number; cluster: number; heading: number; stop: boolean }

// Every signal and stop sign in town is static apart from which lamps are lit, so
// each look is merged into one mesh for the whole town and the lamps are instanced:
// a few draws in all instead of nine per signal.
function TrafficSignals({ roads }: { roads: string[] }) {
  const signals = useMemo(() => {
    const out: Signal[] = []
    const { tiles, clusters } = layoutRoads(roads)
    for (const c of clusters) {
      for (const e of c.entries) {
        if (!c.signal && !e.stop) continue
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
          cluster: c.id, heading: e.heading, stop: !c.signal,
        })
      }
    }
    return out
  }, [roads])

  const lights = useMemo(() => signals.filter((s) => !s.stop), [signals])
  const geos = useMemo(() => {
    const parts: Record<keyof typeof mats, BufferGeometry[]> = { pole: [], arm: [], housing: [], signPole: [], signRim: [], signFace: [], signBar: [] }
    const at = new Matrix4()
    const local = new Matrix4()
    const add = (list: BufferGeometry[], g: BufferGeometry, s: Signal, x: number, y: number, z: number, rx = 0, ry = 0) => {
      local.makeRotationFromEuler(new Euler(rx, ry, 0)).setPosition(x, y, z)
      at.makeRotationY(s.yaw).setPosition(s.x, 0, s.z).multiply(local)
      list.push(g.applyMatrix4(at))
    }
    for (const s of signals) {
      if (s.stop) {
        // A stop sign on a side road with no lights.
        add(parts.signPole, new CylinderGeometry(0.03, 0.03, 1.2, 6), s, 0, 0.6, 0)
        add(parts.signRim, new CylinderGeometry(0.24, 0.24, 0.02, 8), s, 0, 1.15, 0.03, Math.PI / 2, Math.PI / 8)
        add(parts.signFace, new CylinderGeometry(0.215, 0.215, 0.01, 8), s, 0, 1.15, 0.042, Math.PI / 2, Math.PI / 8)
        add(parts.signBar, new PlaneGeometry(0.24, 0.06), s, 0, 1.15, 0.05)
      } else {
        add(parts.pole, new CylinderGeometry(0.03, 0.04, 1.5, 6), s, 0, 0.75, 0)
        // Arm out over the lane, towards the middle of the road.
        add(parts.arm, new BoxGeometry(0.5, 0.04, 0.04), s, -0.25, 1.46, 0)
        add(parts.housing, new BoxGeometry(0.17, 0.46, 0.12), s, -0.44, 1.2, 0)
      }
    }
    const out: Partial<Record<keyof typeof mats, BufferGeometry>> = {}
    for (const k of Object.keys(parts) as (keyof typeof mats)[]) {
      if (parts[k].length) out[k] = mergeGeometries(parts[k])
      parts[k].forEach((g) => g.dispose())
    }
    return out
  }, [signals])
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos])

  // Where each lamp sits: round lamps bulging out front and back, so the light reads from any angle.
  const spots = useMemo(() => {
    const m = new Matrix4()
    const out: Matrix4[] = []
    for (const s of lights) {
      for (let k = 0; k < 3; k++) for (const f of [1, -1]) {
        m.makeRotationY(s.yaw).setPosition(s.x, 0, s.z)
        out.push(m.clone().multiply(new Matrix4().makeTranslation(-0.44, 1.2 + 0.145 - k * 0.145, f * 0.05)))
      }
    }
    return out
  }, [lights])
  // One instanced mesh per lamp look (unlit, red, yellow, green); each lamp shows in exactly one.
  const lamps = useRef<(InstancedMesh | null)[]>([])
  // Which look each lamp is showing now (-1 before the first frame).
  const shown = useMemo(() => new Int8Array(spots.length).fill(-1), [spots])
  useFrame(() => {
    const meshes = lamps.current
    let changed = false
    lights.forEach((s, i) => {
      const now = sim.lightOf(s.cluster, s.heading)
      for (let k = 0; k < 3; k++) {
        const look = now === ORDER[k] ? k + 1 : 0
        for (let f = 0; f < 2; f++) {
          const j = i * 6 + k * 2 + f
          if (shown[j] === look) continue
          shown[j] = look
          changed = true
          meshes.forEach((m, n) => m?.setMatrixAt(j, n === look ? spots[j] : hidden))
        }
      }
    })
    if (changed) for (const m of meshes) if (m) m.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      {geos.pole && <mesh geometry={geos.pole} material={mats.pole} castShadow />}
      {geos.arm && <mesh geometry={geos.arm} material={mats.arm} />}
      {geos.housing && <mesh geometry={geos.housing} material={mats.housing} />}
      {geos.signPole && <mesh geometry={geos.signPole} material={mats.signPole} castShadow />}
      {geos.signRim && <mesh geometry={geos.signRim} material={mats.signRim} castShadow />}
      {geos.signFace && <mesh geometry={geos.signFace} material={mats.signFace} />}
      {geos.signBar && <mesh geometry={geos.signBar} material={mats.signBar} />}
      {spots.length > 0 && LAMPS.map((m, n) => (
        <instancedMesh key={`${n}-${spots.length}`} ref={(o) => void (lamps.current[n] = o)} args={[lampGeo, m, spots.length]} frustumCulled={false} />
      ))}
    </>
  )
}

const starGeo = new OctahedronGeometry(0.26, 0)
const starMat = new MeshStandardMaterial({ color: '#ffca28', emissive: '#ffb300', emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.35 })
const starAt = new Matrix4()
const starTurn = new Euler()
const starQuat = new Quaternion()
const starPos = new Vector3()
const starScale = new Vector3()

// A spinning gold gem over each car on show, all in one draw.
function ShowcaseStars({ uids }: { uids: string[] }) {
  const ref = useRef<InstancedMesh>(null)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    uids.forEach((uid, i) => {
      const a = sim.agents.get(uid)
      if (!a || a.show < 0.5) return m.setMatrixAt(i, hidden)
      starTurn.set(0, t * 2 + i, 0)
      starPos.set(a.x, 1.6 + Math.sin(t * 3 + i) * 0.08, a.z)
      starScale.set(1, 1.5, 1).multiplyScalar(a.show)
      m.setMatrixAt(i, starAt.compose(starPos, starQuat.setFromEuler(starTurn), starScale))
    })
    m.instanceMatrix.needsUpdate = true
  })
  if (!uids.length) return null
  return <instancedMesh key={uids.length} ref={ref} args={[starGeo, starMat, uids.length]} frustumCulled={false} />
}

export function TownCars() {
  const roads = useGame((s) => (s.visiting ?? s).roads)
  const cars = useGame((s) => (s.visiting ?? s).cars)
  const buildings = useGame((s) => (s.visiting ?? s).buildings)
  const visitKey = useGame((s) => s.visiting?.ownerId ?? 'home')
  const picks = useGame((s) => (s.visiting ?? s).showcase)
  // The cars on show always get a spot on the road.
  const stars = useMemo(() => showcaseOf(cars, picks).map((c) => c.uid), [cars, picks])

  // Rebuild the road network only when roads or buildings move, not on every save.
  const townKey = JSON.stringify([visitKey, roads, buildings.map((b) => [b.uid, b.def, b.x, b.z, b.rot ?? null])])
  const town = useMemo(() => ({ roads, buildings }), [townKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    sim.setTown(town.roads, town.buildings, turnOf)
    // Stop for people on the zebra crossings.
    sim.walkers = pedestrianCrossings
  }, [town])

  // Which cars are out and how they drive.
  const max = Math.min(MAX_VISIBLE, Math.max(3, Math.floor(roads.length * 0.5)))
  const specs = useMemo(
    () => [...cars].sort((a, b) => Number(stars.includes(b.uid)) - Number(stars.includes(a.uid))).map((c) => {
      const def = carDef(c.model)
      const size = carSize(def.body)
      return {
        uid: c.uid,
        len: size.len * SCALE,
        wid: size.wid * SCALE,
        cruise: 1.1 + performance(def, c.upgrades, c.mods) / 45,
        stalled: !!(c.flat || c.lowFuel),
      }
    }),
    [cars, stars],
  )
  // A visitor's car drives round town too (src/lib/visitors.ts), on top of the usual cap.
  const visitor = useVisitors((v) => (v.visitor && v.visitor.kind !== 'barn' && !visitKeyIsAway(visitKey) ? v.visitor : null))
  const guest = useMemo(() => (visitor ? visitorCar(visitor) : null), [visitor?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const guestGone = !!visitor?.gone
  useEffect(() => {
    if (!guest || guestGone) return sim.setCars(specs, max)
    const size = carSize(carDef(guest.model).body)
    const kind = visitor!.kind
    const spec = { uid: guest.uid, len: size.len * SCALE, wid: size.wid * SCALE, cruise: kind === 'racer' ? 2.6 : kind === 'mystery' ? 2.2 : 1.4, stalled: false }
    sim.setCars([spec, ...specs], max + 1)
  }, [specs, max, town, guest, guestGone]) // eslint-disable-line react-hooks/exhaustive-deps
  const homesKey = buildings.map((b) => (b.car ? `${b.car}>${b.uid}` : '')).join()
  useEffect(() => {
    sim.homes = new Map(buildings.filter((b) => b.car).map((b) => [b.car!, b.uid]))
  }, [homesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // The shared wheel meshes for every town car (see carBatch.ts).
  const pool = useRef<Group>(null)
  const [, redraw] = useState(0)
  // A layout effect, so it is set before the cars' effects take their wheel slots.
  useLayoutEffect(() => {
    wheelPool.changed = () => redraw((n) => n + 1)
    return () => void (wheelPool.changed = undefined)
  }, [])

  // One step of the whole town per frame, before the cars are drawn.
  useFrame((_, dt) => {
    if (pool.current) {
      pool.current.updateWorldMatrix(true, false)
      wheelPool.parentInv.copy(pool.current.matrixWorld).invert()
    }
    for (const [uid, kind] of tripRequests) {
      sim.requestTrip(uid, kind)
      tripRequests.delete(uid)
    }
    for (const [uid, building] of visitRequests) {
      sim.requestVisit(uid, building)
      visitRequests.delete(uid)
    }
    sim.step(dt)
  }, -1)

  const shown = useMemo(() => {
    const rank = (c: OwnedCar) => (c.flat || c.lowFuel ? 2 : stars.includes(c.uid) ? 1 : 0)
    const out = [...cars].sort((a, b) => rank(b) - rank(a))
    return out.slice(0, max)
  }, [cars, max, stars])

  if (!roads.length) return null
  return (
    <>
      <TrafficSignals roads={roads} />
      <group ref={pool}>
        {[...wheelPool.meshes.values()].map(({ mesh }) => <primitive key={mesh.uuid} object={mesh} dispose={null} />)}
      </group>
      {shown.map((car) => (
        <TownCar key={`${visitKey}-${car.uid}`} car={car} />
      ))}
      {guest && <TownCar key={guest.uid} car={guest} onTap={tapVisitor} />}
      <ShowcaseStars uids={stars} />
    </>
  )
}
