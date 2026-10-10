import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { anchors } from './anchors'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { useGame, type OwnedCar } from '../game/store'
import { carDef, performance } from '../game/data'
import { toWorld, DIRS } from './grid'
import { CarModel } from './CarModel'

const MAX_VISIBLE = 30
const LANE = 0.42

type Agent = { from: [number, number]; to: [number, number]; t: number }

function pickNext(roads: Set<string>, from: [number, number], at: [number, number]): [number, number] {
  const options = DIRS.map(([dx, dz]) => [at[0] + dx, at[1] + dz] as [number, number]).filter(
    ([x, z]) => roads.has(`${x},${z}`),
  )
  const forward = options.filter(([x, z]) => x !== from[0] || z !== from[1])
  const pool = forward.length ? forward : options
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : at
}

function DrivingCar({ car, roads, start }: { car: OwnedCar; roads: Set<string>; start: [number, number] }) {
  const ref = useRef<Group>(null)
  const def = carDef(car.model)
  const speed = 1.2 + performance(def, car.upgrades) / 40
  const agent = useRef<Agent>({ from: start, to: pickNext(roads, start, start), t: Math.random() })
  const selected = useGame((s) => s.selectedCar === car.uid)

  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const a = agent.current
    if (car.flat) {
      g.rotation.z = 0.06
      const p = anchors.get(`car:${car.uid}`) ?? new Vector3()
      anchors.set(`car:${car.uid}`, p.set(g.position.x, 1.1, g.position.z))
      return
    }
    g.rotation.z = 0
    // Road under the car was removed: hop to the starting tile again.
    if (!roads.has(`${a.to[0]},${a.to[1]}`) || !roads.has(`${a.from[0]},${a.from[1]}`)) {
      a.from = start
      a.to = pickNext(roads, start, start)
      a.t = 0
    }
    a.t += Math.min(dt, 0.1) * speed * 0.5
    while (a.t >= 1) {
      a.t -= 1
      const next = pickNext(roads, a.from, a.to)
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
    g.position.set(ax + dx * a.t + ox, 0.02, az + dz * a.t + oz)
    if (len > 0.01) {
      const target = Math.atan2(dx, dz)
      let diff = target - g.rotation.y
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      g.rotation.y += diff * Math.min(1, dt * 10)
    }
  })

  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation()
        const s = useGame.getState()
        if (s.mode !== 'play' || s.visiting) return
        s.selectCar(car.uid)
        s.openPanel(car.flat ? 'flat' : 'garage')
      }}
    >
      <CarModel body={def.body} color={car.color} highlight={selected} stripe={car.stripe} />
    </group>
  )
}


export function TownCars() {
  const roadsList = useGame((s) => (s.visiting ?? s).roads)
  const cars = useGame((s) => (s.visiting ?? s).cars)
  const visitKey = useGame((s) => s.visiting?.ownerId ?? 'home')
  const roads = useMemo(() => new Set(roadsList), [roadsList])
  const starts = useMemo(() => {
    const arr = [...roads].map((k) => k.split(',').map(Number) as [number, number])
    return arr
  }, [roads])
  if (!starts.length) return null
  return (
    <>
      {cars.slice(0, MAX_VISIBLE).map((car, i) => (
        <DrivingCar key={`${visitKey}-${car.uid}`} car={car} roads={roads} start={starts[(i * 7919) % starts.length]} />
      ))}
    </>
  )
}
