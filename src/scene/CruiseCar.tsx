import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useGame } from '../game/store'
import { carDef, START_LAND } from '../game/data'
import { carBox, type Footprint, type Solid } from '../game/collide'
import { cruiseStep, landWalls, lotSolid, slabSolid } from '../game/cruise'
import { bumpSound, revSound } from '../lib/arcadeSound'
import { buzz } from '../lib/haptics'
import { CarModel, wheelRig } from './CarModel'
import { bodyScale, townSize } from './townCarSize'
import { rollWheels } from './TownCars'
import { lotsOf, roamBox, ROAM_MARGIN } from './freeCamBounds'
import { cruiseInput, cruisePose, endCruise, useCruise } from './cruise'
import { liveTraffic } from './traffic/live'

// Town cars within this of yours are checked for bumps each frame.
const NEAR = 4

// Your own car, driven by hand round town (see scene/cruise.ts). Drawn in full
// rather than lean, since there's only ever one and the camera is right behind it.
export function CruiseCar() {
  const uid = useCruise((c) => c.uid)
  const car = useGame((s) => (uid ? s.cars.find((c) => c.uid === uid) ?? null : null))
  useEffect(() => {
    if (uid && !car) endCruise()
  }, [uid, car])
  return car ? <Driven key={car.uid} uid={car.uid} /> : null
}

function Driven({ uid }: { uid: string }) {
  const car = useGame((s) => s.cars.find((c) => c.uid === uid)!)
  const buildings = useGame((s) => s.buildings)
  const land = useGame((s) => s.land ?? START_LAND)
  const def = carDef(car.model)
  const k = bodyScale(def.body)
  const rig = useMemo(() => wheelRig(def.body), [def.body])
  const foot = useMemo<Footprint>(() => {
    const s = townSize(def.body)
    return { w: s.wid, l: s.len, cz: 0 }
  }, [def.body])
  // Buildings and the edge of the land don't move while you drive; the town's cars do.
  const fixed = useMemo<Solid[]>(() => {
    const r = roamBox(land)
    const edge = { x0: r.x0 + ROAM_MARGIN, x1: r.x1 - ROAM_MARGIN, z0: r.z0 + ROAM_MARGIN, z1: r.z1 - ROAM_MARGIN }
    return [...lotsOf(buildings).map((l) => lotSolid(l)), ...landWalls(edge)]
  }, [buildings, land])
  const ref = useRef<Group>(null)
  const cool = useRef(0)
  const solids = useRef<Solid[]>([])
  useEffect(() => {
    revSound(0.6)
    return () => liveTraffic.setHand(null)
  }, [])

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1)
    const p = cruisePose
    const list = solids.current
    list.length = 0
    list.push(...fixed)
    for (const a of liveTraffic.agents.values()) {
      if (a.uid === uid || Math.hypot(a.x - p.x, a.z - p.z) > NEAR + a.len) continue
      for (const b of a.boxes) list.push(slabSolid(b))
    }
    const r = cruiseStep(p, cruiseInput, dt, foot, list)
    Object.assign(p, r.pose)
    cool.current = Math.max(0, cool.current - dt)
    if (r.impact > 0.4 && cool.current <= 0) {
      cool.current = 0.6
      bumpSound()
      buzz(20)
    }
    // The town's cars see yours on the road and wait behind it.
    const box = carBox(p, foot)
    liveTraffic.setHand({ x: box.x, z: box.z, yaw: p.h, len: foot.l, wid: foot.w })
    const g = ref.current
    if (!g) return
    g.position.set(p.x, 0.02, p.z)
    g.rotation.y = p.h
    for (const w of rig.steer) if (w) w.rotation.y = p.steer
    rollWheels(rig, p.v, dt, k)
  })

  return (
    <group ref={ref}>
      <group scale={k}>
        <CarModel body={def.body} model={def.id} color={car.color} finish={car.finish} skin={car.skin} modSkin={car.modSkin} panels={car.panels} trim={car.trim} hat={car.hat} stripe={car.stripe} mods={car.mods} beams rig={rig} />
      </group>
    </group>
  )
}
