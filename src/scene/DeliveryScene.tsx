import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Group, MeshBasicMaterial, Vector3 } from 'three'
import { CarModel, carFrame } from './CarModel'
import { BuildingModel } from './BuildingModel'
import { holdTown } from './renderGate'
import { Batch } from './Batch'
import { LAYER, decal } from './layers'
import { asphaltTex, grassTex, paverTex } from './textures'
import { ArcadeSky, Bin, CarShadow, Crowd, Hydrant, K, Lamp, useArcadeLook, useTownPool, type Person } from './ArcadeScenery'
import { BLOCK, DASH_BONUS, DASH_TIME, GRID, STREET, TOWN, blockCentre, insideBlock, kerbSpot } from '../game/arcadeMore'
import { buildingDef, TILE } from '../game/data'
import type { ChaseCar } from './ChaseScene'
import type { ParkInput } from './ParkScene'
import { bumpSound, dingSound } from '../lib/arcadeSound'

export type DashHud = { drops: number; time: number; carrying: boolean }
export type DashEnd = { drops: number }

const LEN = 1.5
const MAX_FWD = 7
const MAX_REV = 3
const WALK = 0.9 // sidewalk inside each block's edge
const REACH = 1.4 // how close counts as arriving

// Shop blocks and house blocks alternate like a checkerboard.
const isShops = (bx: number, bz: number) => (bx + bz) % 2 === 0
type Spot = { bx: number; bz: number; side: number; x: number; z: number }
const SPOTS: Spot[] = []
for (let bx = 0; bx < GRID; bx++) for (let bz = 0; bz < GRID; bz++) for (const side of [0, 2]) {
  const [x, z] = kerbSpot(bx, bz, side)
  SPOTS.push({ bx, bz, side, x, z })
}
const SHOP_SPOTS = SPOTS.filter((s) => isShops(s.bx, s.bz))
const HOUSE_SPOTS = SPOTS.filter((s) => !isShops(s.bx, s.bz))

function pickFar(list: Spot[], x: number, z: number) {
  const ok = list.filter((s) => { const d = Math.hypot(s.x - x, s.z - z); return d > 7 && d < 24 })
  const from = ok.length ? ok : list
  return from[Math.floor(Math.random() * from.length)]
}

function Paint({ x, z, w, l, color = '#fafafa', ry = 0 }: { x: number; z: number; w: number; l: number; color?: string; ry?: number }) {
  return (
    <mesh position={[x, LAYER.paint, z]} rotation={[-Math.PI / 2, 0, ry]}>
      <planeGeometry args={[w, l]} />
      <meshBasicMaterial color={color} {...decal()} />
    </mesh>
  )
}

// One block: kerbed sidewalk round a lawn, two buildings facing each of its north and
// south streets, and trees, lamps and clutter down the east and west sides.
function Block({ bx, bz, pool }: { bx: number; bz: number; pool: string[] }) {
  const cx = blockCentre(bx), cz = blockCentre(bz)
  const shops = isShops(bx, bz)
  const defs = useMemo(() => [0, 1, 2, 3].map((k) => (shops ? pool[(bx * 5 + bz * 3 + k) % pool.length] : 'house')), [shops, pool, bx, bz])
  const pave = useMemo(() => paverTex(BLOCK / 0.8, WALK / 0.8), [])
  return (
    <group position={[cx, 0, cz]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.121}>
        <planeGeometry args={[BLOCK - WALK * 2, BLOCK - WALK * 2]} />
        <meshStandardMaterial map={grassTex(3, 3)} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2
        return (
          <group key={i} rotation-y={a}>
            <mesh position={[0, 0.06, BLOCK / 2 - WALK / 2]}>
              <boxGeometry args={[BLOCK, 0.12, WALK]} />
              <meshStandardMaterial map={pave} />
            </mesh>
            <mesh position={[0, 0.065, BLOCK / 2 - 0.04]}>
              <boxGeometry args={[BLOCK, 0.13, 0.08]} />
              <meshStandardMaterial color="#cfd2d6" />
            </mesh>
          </group>
        )
      })}
      {defs.map((d, k) => {
        const def = buildingDef(d)
        const south = k >= 2
        const x = (k % 2 ? 1 : -1) * 1.4
        const depth = def.h * TILE * K * Math.min(1, 2.6 / (def.w * TILE * K))
        const z = (south ? 1 : -1) * (BLOCK / 2 - WALK - depth / 2 - 0.05)
        return (
          <group key={k} position={[x, 0.12, z]} rotation-y={south ? 0 : Math.PI} scale={K * Math.min(1, 2.6 / (def.w * TILE * K))}>
            <BuildingModel def={def} />
          </group>
        )
      })}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          {[-1.6, 1.6].map((z) => (
            <group key={z} position={[sd * (BLOCK / 2 - WALK / 2), 0.12, z]} scale={K * 0.7}>
              <BuildingModel def={buildingDef((bx + bz + (z > 0 ? 1 : 0)) % 3 === 0 ? 'pine' : 'tree')} />
            </group>
          ))}
          <Lamp x={sd * (BLOCK / 2 - 0.3)} z={sd * 2.6} ry={sd > 0 ? -Math.PI / 2 : Math.PI / 2} />
        </group>
      ))}
      <group position-y={0.12}>
        {(bx + bz) % 2 ? <Hydrant x={BLOCK / 2 - 0.45} z={-0.9} /> : <Bin x={-BLOCK / 2 + 0.45} z={0.9} />}
      </group>
    </group>
  )
}

function TownScenery({ pool }: { pool: string[] }) {
  const road = useMemo(() => {
    const t = asphaltTex().clone()
    t.repeat.set(TOWN / 2.5, TOWN / 2.5)
    t.needsUpdate = true
    return t
  }, [])
  const lines = useMemo(() => Array.from({ length: GRID + 1 }, (_, i) => -TOWN / 2 + STREET / 2 + i * (BLOCK + STREET)), [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.outer, 0]}>
        <planeGeometry args={[TOWN + 60, TOWN + 60]} />
        <meshStandardMaterial map={grassTex(30, 30)} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, 0]}>
        <planeGeometry args={[TOWN, TOWN]} />
        <meshStandardMaterial map={road} />
      </mesh>
      {/* Centre dashes on every street and zebras at every crossing. */}
      {lines.map((c) => Array.from({ length: GRID }, (_, b) => {
        const mid = blockCentre(b)
        return (
          <group key={`${c}:${b}`}>
            {[-2, -1, 0, 1, 2].map((k) => <Paint key={`h${k}`} x={mid + k * 1.3} z={c} w={0.7} l={0.09} color="#ffd54f" />)}
            {[-2, -1, 0, 1, 2].map((k) => <Paint key={`v${k}`} x={c} z={mid + k * 1.3} w={0.09} l={0.7} color="#ffd54f" />)}
          </group>
        )
      }))}
      {lines.map((cx) => lines.map((cz) => (
        <group key={`${cx}:${cz}`}>
          {[-1, 1].map((sd) => Array.from({ length: 5 }, (_, i) => (
            <Paint key={`${sd}${i}`} x={cx - 1.1 + i * 0.55} z={cz + sd * (STREET / 2 + 0.45)} w={0.28} l={0.7} />
          )))}
        </group>
      )))}
      {Array.from({ length: GRID }, (_, bx) => Array.from({ length: GRID }, (_, bz) => <Block key={`${bx}:${bz}`} bx={bx} bz={bz} pool={pool} />))}
      {/* A ring of trees and taller blocks round the edge of town. */}
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2
        const r = TOWN / 2 + 3 + (i % 3)
        return (
          <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} scale={K}>
            <BuildingModel def={buildingDef(i % 2 ? 'pine' : 'tree')} />
          </group>
        )
      })}
    </group>
  )
}

// A tall glowing column over the spot to drive to.
function Beacon({ beam, ring }: { beam: React.Ref<Group>; ring: React.Ref<MeshBasicMaterial> }) {
  return (
    <group ref={beam}>
      <mesh position-y={3}>
        <cylinderGeometry args={[0.75, 0.75, 6, 20, 1, true]} />
        <meshBasicMaterial ref={ring} color="#ffd54f" transparent opacity={0.28} blending={AdditiveBlending} depthWrite={false} side={2} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={LAYER.paint + 0.01}>
        <ringGeometry args={[0.85, 1.05, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} toneMapped={false} {...decal(3)} />
      </mesh>
    </group>
  )
}

export function DeliveryScene({ me, input, running, onHud, onEnd }: {
  me: ChaseCar; input: ParkInput; running: boolean
  onHud: (h: DashHud) => void; onEnd: (e: DashEnd) => void
}) {
  useEffect(() => holdTown(), [])
  const view = useArcadeLook()
  const pool = useTownPool()
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const f = carFrame(me.body)
  const sc = LEN / f.len
  const start = useMemo(() => ({ x: blockCentre(1) + BLOCK / 2 + STREET / 2, z: blockCentre(2), h: Math.PI }), [])
  const first = useMemo(() => pickFar(SHOP_SPOTS, start.x, start.z), [start])
  const st = useRef({ pose: { ...start }, v: 0, t: 0, left: DASH_TIME, drops: 0, carrying: false, target: first, cool: 0, done: false, hudAt: 0 })
  const car = useRef<Group>(null)
  const box = useRef<Group>(null)
  const beam = useRef<Group>(null)
  const ring = useRef<MeshBasicMaterial>(null)
  const arrow = useRef<Group>(null)
  const look = useMemo(() => new Vector3(), [])
  const eye = useMemo(() => new Vector3(), [])

  // People on the sidewalks.
  const people = useMemo<Person[]>(() => {
    const out: Person[] = []
    for (let i = 0; i < 40; i++) {
      const bx = i % GRID, bz = Math.floor(i / GRID) % GRID
      const side = i % 4
      const along = ((i * 37) % 10) / 10 - 0.5
      const off = BLOCK / 2 - WALK / 2
      const [dx, dz] = [[along * 5, -off], [off, along * 5], [along * 5, off], [-off, along * 5]][side]
      out.push({ x: blockCentre(bx) + dx, z: blockCentre(bz) + dz, h: (side * Math.PI) / 2 + Math.PI, y: 0.12, cheer: i % 9 === 0 })
    }
    return out
  }, [])

  useFrame((state, rawDt) => {
    const s = st.current
    const dt = Math.min(rawDt, 1 / 20)
    const t = state.clock.elapsedTime
    const live = running && !s.done
    if (live) {
      s.t += dt
      s.left -= dt
    }
    const pedal = live ? input.pedal : 0
    if (pedal > 0) s.v = Math.min(MAX_FWD, s.v + (s.v < 0 ? 14 : 6) * dt)
    else if (pedal < 0) s.v = Math.max(-MAX_REV, s.v - (s.v > 0 ? 14 : 6) * dt)
    else s.v = Math.sign(s.v) * Math.max(0, Math.abs(s.v) - 5 * dt)
    s.cool = Math.max(0, s.cool - dt)
    if (s.v !== 0) {
      const steer = live ? input.steer : 0
      const h = s.pose.h + steer * 2.4 * Math.sign(s.v) * Math.min(1, Math.abs(s.v) / 2.5) * dt
      const x = s.pose.x + Math.sin(h) * s.v * dt, z = s.pose.z + Math.cos(h) * s.v * dt
      const nose = Math.sign(s.v) * LEN * 0.45
      if (insideBlock(x, z, 0.35) || insideBlock(x + Math.sin(h) * nose, z + Math.cos(h) * nose, 0.1)) {
        if (s.cool <= 0 && Math.abs(s.v) > 2) { bumpSound(); s.cool = 0.5 }
        s.v = -s.v * 0.3
        s.pose.h = h
      } else s.pose = { x, z, h }
    }
    if (live) {
      const g = s.target
      if (Math.hypot(s.pose.x - g.x, s.pose.z - g.z) < REACH) {
        if (s.carrying) {
          s.drops++
          s.left += DASH_BONUS
          dingSound(1.2)
          s.carrying = false
          s.target = pickFar(SHOP_SPOTS, s.pose.x, s.pose.z)
        } else {
          dingSound()
          s.carrying = true
          s.target = pickFar(HOUSE_SPOTS, s.pose.x, s.pose.z)
        }
      }
      if (s.left <= 0) {
        s.left = 0
        s.done = true
        onEnd({ drops: s.drops })
      }
    }
    if (car.current) {
      car.current.position.set(s.pose.x, 0, s.pose.z)
      car.current.rotation.y = s.pose.h
    }
    if (box.current) box.current.visible = s.carrying
    if (beam.current) beam.current.position.set(s.target.x, 0, s.target.z)
    if (ring.current) {
      ring.current.color.set(s.carrying ? '#00e676' : '#ffb300')
      ring.current.opacity = 0.22 + Math.sin(t * 5) * 0.08
    }
    if (arrow.current) {
      const a = Math.atan2(s.target.x - s.pose.x, s.target.z - s.pose.z)
      arrow.current.position.set(s.pose.x + Math.sin(a) * 1.4, 0.9 + Math.sin(t * 6) * 0.08, s.pose.z + Math.cos(a) * 1.4)
      arrow.current.rotation.y = a
      arrow.current.visible = Math.hypot(s.target.x - s.pose.x, s.target.z - s.pose.z) > 3
    }
    // Follow from above and a little behind (north stays up), further out on a narrow screen.
    const back = size.width < size.height ? 1.35 : 1
    look.set(s.pose.x, 0, s.pose.z - 1)
    camera.position.lerp(eye.set(s.pose.x, 12 * back, s.pose.z + 6.5 * back), Math.min(1, dt * 4))
    camera.lookAt(look)
    if (t - s.hudAt > 0.1) {
      s.hudAt = t
      onHud({ drops: s.drops, time: Math.max(0, s.left), carrying: s.carrying })
    }
  })

  return (
    <>
      <ArcadeSky view={view} near={18} far={60} dome={false} />
      <Batch version={pool.join()}>
        <TownScenery pool={pool} />
      </Batch>
      <Crowd people={people} scale={0.9} />
      <Beacon beam={beam} ring={ring} />
      <group ref={arrow}>
        <mesh rotation-x={Math.PI / 2}><coneGeometry args={[0.28, 0.6, 3]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
      </group>
      <group ref={car} position={[start.x, 0, start.z]} rotation-y={start.h}>
        <CarShadow len={LEN} wid={f.wid * sc} />
        <group scale={sc}>
          <CarModel body={me.body} model={me.model} color={me.color} finish={me.finish} skin={me.skin} modSkin={me.modSkin} mods={me.mods} beams={view.beams} />
        </group>
        {/* The pizza box on the roof while there's an order on board. */}
        <group ref={box} position={[0, f.deck * sc + 0.06, -0.1]} visible={false}>
          <mesh position-y={0.05}><boxGeometry args={[0.46, 0.1, 0.46]} /><meshStandardMaterial color="#d7a86e" /></mesh>
          <mesh position-y={0.101} rotation-x={-Math.PI / 2}><circleGeometry args={[0.14, 16]} /><meshBasicMaterial color="#e53935" /></mesh>
        </group>
      </group>
    </>
  )
}
