import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Group, InstancedMesh, MeshBasicMaterial, Object3D, Vector3 } from 'three'
import { CarModel, carFrame } from './CarModel'
import { BuildingModel } from './BuildingModel'
import { holdTown } from './renderGate'
import { Batch } from './Batch'
import { LAYER, decal } from './layers'
import { asphaltTex, grassTex, paverTex } from './textures'
import { ArcadeSky, Bin, CarShadow, Crowd, Hydrant, K, Lamp, useArcadeLook, useTownPool, type Person } from './ArcadeScenery'
import { BLOCK, DASH_TIME, DROP_LINE, DROP_R, GRID, STREET, TOWN, TOWN_SOLIDS, TRAFFIC_HIT, atDrop, blockCentre, dropBonus, hotTime, kerbSpot, roadLine } from '../game/arcadeMore'
import { carBox, circlePush, step, type Footprint } from '../game/collide'
import { Footprinted, frameFootprint, scaled } from './footprint'
import { buildingDef, CARS, isBike, TILE } from '../game/data'
import type { ChaseCar } from './ChaseScene'
import type { ParkInput } from './ParkScene'
import { bumpSound, dingSound, scrubSound } from '../lib/arcadeSound'

export type DashPop = { id: number; text: string; kind: 'hot' | 'drop' | 'hit' }
// hot: how much of the hot-pizza time is left (0..1) while carrying; streak: hot drops in a row.
export type DashHud = { drops: number; time: number; carrying: boolean; hot: number; streak: number; pop: DashPop | null }
export type DashEnd = { drops: number }

const LEN = 1.5
const MAX_FWD = 8.5
const MAX_REV = 3
const WALK = 0.9 // sidewalk inside each block's edge
const SPARKS = 14
const TRAFFIC = 7
const TRAFFIC_R = 0.62 // a traffic car as a circle, for the bump test

// Town traffic: everyday cars driving up and down the streets, each on its own road and lane.
type Mover = { axis: 'x' | 'z'; line: number; dir: 1 | -1; pos: number; speed: number }
const MOVERS: Mover[] = Array.from({ length: TRAFFIC }, (_, i) => ({
  axis: i % 2 ? 'x' : 'z', line: roadLine((i * 3 + 1) % (GRID + 1)), dir: i % 3 ? 1 : -1, pos: -TOWN / 2 + ((i * 17) % TOWN), speed: 3.2 + (i % 4) * 0.5,
}))
const TRAFFIC_LOOKS = (() => {
  const pool = CARS.filter((c) => !c.parked && !isBike(c.body) && ['sedan', 'compact', 'van', 'suv', 'hatch', 'wagon', 'ev'].includes(c.body))
  return Array.from({ length: TRAFFIC }, (_, i) => { const c = pool[(i * 5 + 2) % pool.length]; return { body: c.body, model: c.id, color: c.colors[i % c.colors.length] } })
})()
// Where a mover is: on its road, kept to the right-hand lane for its direction.
function moverAt(m: Mover) {
  const lane = 0.72 * m.dir
  return m.axis === 'x' ? { x: m.pos, z: m.line + lane, h: m.dir > 0 ? Math.PI / 2 : -Math.PI / 2 } : { x: m.line - lane, z: m.pos, h: m.dir > 0 ? 0 : Math.PI }
}

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
        <ringGeometry args={[DROP_R - DROP_LINE, DROP_R, 40]} />
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
  const st = useRef({
    pose: { ...start }, v: 0, t: 0, left: DASH_TIME, drops: 0, carrying: false, target: first, cool: 0, done: false, hudAt: 0,
    hotUntil: 0, hotFor: 1, streak: 0, hitCool: 0, popId: 0, pop: null as DashPop | null,
    movers: MOVERS.map((m) => ({ ...m })),
    // A knock: how hard, which way it rocks the car (pitch, roll), and how long ago.
    jolt: 0, pitch: 0, roll: 0, joltT: 0, shake: 0,
    sparks: Array.from({ length: SPARKS }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 1 })),
  })
  const foot = useRef<Footprint>(scaled(frameFootprint(me.body), sc))
  const car = useRef<Group>(null)
  const body = useRef<Group>(null)
  const sparkMesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const box = useRef<Group>(null)
  const beam = useRef<Group>(null)
  const ring = useRef<MeshBasicMaterial>(null)
  const arrow = useRef<Group>(null)
  const traffic = useRef<(Group | null)[]>([])
  useEffect(() => { if (import.meta.env.DEV) Object.assign(window, { __dash: st.current }) }, [])
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
    const pedal = live ? input.gas - input.brake : 0
    if (pedal > 0) s.v = Math.min(MAX_FWD, s.v + (s.v < 0 ? 14 : 6) * dt)
    else if (pedal < 0) s.v = Math.max(-MAX_REV, s.v - (s.v > 0 ? 14 : 6) * dt)
    else s.v = Math.sign(s.v) * Math.max(0, Math.abs(s.v) - 5 * dt)
    s.cool = Math.max(0, s.cool - dt)
    if (s.v !== 0) {
      const steer = live ? input.steer : 0
      const h = s.pose.h + steer * 2.4 * Math.sign(s.v) * Math.min(1, Math.abs(s.v) / 2.5) * dt
      const next = { x: s.pose.x + Math.sin(h) * s.v * dt, z: s.pose.z + Math.cos(h) * s.v * dt, h }
      // The car's own measured box against the kerbs: scrape along them, rock and spark on a knock.
      const r = step(s.pose, s.v, next, foot.current, TOWN_SOLIDS)
      s.pose = r.pose
      s.v = r.v
      if (r.impact > 0.4) {
        const hard = r.impact > 2.2
        if (s.cool <= 0) {
          if (hard) bumpSound()
          else scrubSound()
          s.cool = hard ? 0.4 : 0.3
        }
        // Which side took it, in the car's own frame (+z ahead, +x across).
        const c = Math.cos(s.pose.h), sn = Math.sin(s.pose.h)
        const along = r.nx * sn + r.nz * c, across = r.nx * c - r.nz * sn
        const jolt = Math.min(1, r.impact / 6)
        if (jolt > s.jolt * Math.exp(-s.joltT * 4)) {
          s.jolt = jolt
          s.pitch = along
          s.roll = across
          s.joltT = 0
          if (hard) s.shake = Math.max(s.shake, 0.25 * s.jolt + 0.1)
        }
        // Sparks where the car meets the kerb.
        const b = carBox(s.pose, foot.current)
        const ext = (Math.abs(across) * b.w + Math.abs(along) * b.l) / 2
        const px = b.x - r.nx * ext, pz = b.z - r.nz * ext
        const n = Math.min(4, Math.ceil(r.impact))
        for (let k = 0, made = 0; k < SPARKS && made < n; k++) {
          const p = s.sparks[k]
          if (p.age < 1) continue
          const sp = 1.5 + Math.random() * 2.5
          Object.assign(p, { x: px, y: 0.15, z: pz, vx: r.nx * sp + (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, vz: r.nz * sp + (Math.random() - 0.5) * 2, age: 0 })
          made++
        }
      }
    }
    s.joltT += dt
    s.shake = Math.max(0, s.shake - dt)
    // Traffic rolls along its roads and wraps round town; bumping one costs time.
    s.hitCool = Math.max(0, s.hitCool - dt)
    const mine = carBox(s.pose, foot.current)
    s.movers.forEach((m, i) => {
      if (live) {
        m.pos += m.dir * m.speed * dt
        if (m.pos > TOWN / 2 + 2) m.pos -= TOWN + 4
        if (m.pos < -TOWN / 2 - 2) m.pos += TOWN + 4
      }
      const at = moverAt(m)
      const g = traffic.current[i]
      if (g) {
        g.position.set(at.x, 0, at.z)
        g.rotation.y = at.h
      }
      const push = live ? circlePush(mine, { x: at.x, z: at.z, r: TRAFFIC_R }) : null
      if (push) {
        // Shoved back out of the other car, and a few seconds lost on the clock.
        s.pose = { ...s.pose, x: s.pose.x + push.x, z: s.pose.z + push.z }
        s.v *= -0.3
        if (s.hitCool <= 0) {
          s.hitCool = 1
          s.left -= TRAFFIC_HIT
          s.shake = 0.3
          bumpSound()
          s.pop = { id: ++s.popId, text: `💥 -${TRAFFIC_HIT}s`, kind: 'hit' }
        }
      }
    })
    if (live) {
      const g = s.target
      if (atDrop(s.pose.x, s.pose.z, g)) {
        if (s.carrying) {
          const hot = s.t <= s.hotUntil
          s.streak = hot ? s.streak + 1 : 0
          const bonus = dropBonus(hot, s.streak - 1)
          s.drops++
          s.left += bonus
          dingSound(hot ? 1.2 + Math.min(3, s.streak) * 0.12 : 1)
          s.pop = { id: ++s.popId, text: hot ? `🔥 Hot! +${bonus}s${s.streak > 1 ? `  ×${s.streak}` : ''}` : `+${bonus}s`, kind: hot ? 'hot' : 'drop' }
          s.carrying = false
          s.target = pickFar(SHOP_SPOTS, s.pose.x, s.pose.z)
        } else {
          dingSound()
          s.carrying = true
          s.target = pickFar(HOUSE_SPOTS, s.pose.x, s.pose.z)
          s.hotFor = hotTime(Math.hypot(s.target.x - s.pose.x, s.target.z - s.pose.z))
          s.hotUntil = s.t + s.hotFor
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
    if (body.current) {
      // Rock away from the knock and settle in a few wobbles.
      const wob = s.jolt * Math.exp(-s.joltT * 7) * Math.cos(s.joltT * 26)
      body.current.rotation.set(-s.pitch * wob * 0.16, 0, s.roll * wob * 0.12)
    }
    if (sparkMesh.current) {
      s.sparks.forEach((p, i) => {
        if (p.age < 1) {
          p.age += dt * 2.6
          p.vy -= 14 * dt
          p.x += p.vx * dt
          p.y = Math.max(0.03, p.y + p.vy * dt)
          p.z += p.vz * dt
        }
        dummy.position.set(p.x, p.age < 1 ? p.y : -5, p.z)
        dummy.scale.setScalar(p.age < 1 ? 1 - p.age : 0)
        dummy.updateMatrix()
        sparkMesh.current!.setMatrixAt(i, dummy.matrix)
      })
      sparkMesh.current.instanceMatrix.needsUpdate = true
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
    if (s.shake > 0) camera.position.add(eye.set((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake))
    if (t - s.hudAt > 0.1 || s.pop) {
      s.hudAt = t
      onHud({ drops: s.drops, time: Math.max(0, s.left), carrying: s.carrying, hot: s.carrying ? Math.max(0, (s.hotUntil - s.t) / s.hotFor) : 0, streak: s.streak, pop: s.pop })
      s.pop = null
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
      <instancedMesh ref={sparkMesh} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
        <boxGeometry args={[0.07, 0.07, 0.07]} />
        <meshBasicMaterial color="#ffcc66" toneMapped={false} />
      </instancedMesh>
      <group ref={arrow}>
        <mesh rotation-x={Math.PI / 2}><coneGeometry args={[0.28, 0.6, 3]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
      </group>
      {TRAFFIC_LOOKS.map((c, i) => (
        <group key={i} ref={(g) => void (traffic.current[i] = g)}>
          <CarShadow len={LEN} />
          <group scale={LEN / carFrame(c.body).len}>
            <CarModel body={c.body} model={c.model} color={c.color} beams={view.beams} />
          </group>
        </group>
      ))}
      <group ref={car} name="player" position={[start.x, 0, start.z]} rotation-y={start.h}>
        <CarShadow len={LEN} wid={f.wid * sc} />
        <group ref={body}>
          <Footprinted id={`${me.body}:${me.model}:${me.mods?.join()}`} scale={sc} onFoot={(ft) => void (foot.current = ft)}>
            <CarModel body={me.body} model={me.model} color={me.color} finish={me.finish} skin={me.skin} modSkin={me.modSkin} panels={me.panels} trim={me.trim} hat={me.hat} mods={me.mods} beams={view.beams} />
          </Footprinted>
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
