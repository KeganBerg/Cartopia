import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Box3, Color, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera } from 'three'
import { CarModel, carFrame } from './CarModel'
import { holdTown } from './renderGate'
import { Batch } from './Batch'
import { signTexture } from './signTexture'
import { glowTex } from './textures'
import { ArcadeSky, CarShadow, StreetStretch, useArcadeLook, useTownPool } from './ArcadeScenery'
import { CHASE_HEARTS, CHASE_LANES, chaseRow, chaseSpeed } from '../game/arcade'
import { boxPush, carBox, circlePush, type Footprint } from '../game/collide'
import { Footprinted, frameFootprint, scaled } from './footprint'
import { CARS, isBike, type Body, type Finish, type SkinnedSlot } from '../game/data'
import { sfx } from '../lib/sound'
import { crashSound, sirenSound } from '../lib/arcadeSound'

export type ChaseCar = { body: Body; model?: string; color: string; finish?: Finish | null; skin?: string | null; modSkin?: Partial<Record<SkinnedSlot, string>> | null; mods?: string[] | null }
// The screen pushes lane moves here (-1 left, +1 right); the scene takes them each frame.
export type ChaseInput = { moves: number[] }
export type ChaseHud = { dist: number; coins: number; hearts: number; speed: number }

const LEN = 1.6 // every car is drawn at this length
const SPAWN_Z = -80
const HALF = 3.2 // half the road's width
const STRETCH = 44 // one repeating stretch of street
const STRETCHES = 3
const COINS = 24
const COIN_R = 0.3 // a coin and its rim
const PUFFS = 14
const SMOKE = new Color('#eceff1')
const GOLD = new Color('#ffe082')

// Everyday cars from the showroom for the traffic, never the exotic ones.
const TRAFFIC_BODIES: Body[] = ['sedan', 'compact', 'van', 'suv', 'truck', 'hatch', 'wagon', 'classic', 'ev', 'luxury', 'bubble', 'dogvan']
function pickTraffic(n: number) {
  const pool = CARS.filter((c) => !c.parked && !isBike(c.body) && TRAFFIC_BODIES.includes(c.body))
  return Array.from({ length: n }, (_, i) => {
    const c = pool[(i * 7 + 3) % pool.length]
    return { body: c.body, model: c.id, color: c.colors[i % c.colors.length] }
  })
}
const fit = (body: Body) => LEN / carFrame(body).len

type Slot = { on: boolean; lane: number; z: number; hit: number }

// A cruiser: the town's sedan in black and white, with a light bar, push bar and door lettering.
function Cruiser({ beams, red, blue }: { beams: boolean; red: React.Ref<Mesh>; blue: React.Ref<Mesh> }) {
  const car = useRef<Group>(null)
  const kit = useRef<Group>(null)
  const f = carFrame('sedan')
  const s = fit('sedan')
  // Sit the light bar on the roof, wherever the roof ends up for this body.
  useLayoutEffect(() => {
    if (!car.current || !kit.current) return
    kit.current.position.y = new Box3().setFromObject(car.current).max.y
  }, [])
  const door = signTexture('POLICE', '#1b1f24', '#ffffff')
  const w = (f.wid * s) / 2
  return (
    <group>
      <group ref={car} scale={s}>
        <CarModel body="sedan" color="#f5f5f5" beams={beams} />
      </group>
      {/* Black doors with lettering on both sides. */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (w + 0.006), 0.36, -0.05]} rotation-y={(sd * Math.PI) / 2}>
          <planeGeometry args={[0.72, 0.2]} />
          <meshStandardMaterial map={door} />
        </mesh>
      ))}
      <mesh position={[0, 0.22, (f.len * s) / 2 + 0.06]}>
        <boxGeometry args={[0.6, 0.16, 0.06]} />
        <meshStandardMaterial color="#212121" metalness={0.4} roughness={0.5} />
      </mesh>
      <group ref={kit}>
        <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.62, 0.04, 0.16]} /><meshStandardMaterial color="#cfd8dc" metalness={0.7} roughness={0.3} /></mesh>
        <mesh ref={red} position={[-0.16, 0.07, 0]}>
          <boxGeometry args={[0.28, 0.07, 0.13]} />
          <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={2} />
        </mesh>
        <mesh ref={blue} position={[0.16, 0.07, 0]}>
          <boxGeometry args={[0.28, 0.07, 0.13]} />
          <meshStandardMaterial color="#2979ff" emissive="#2979ff" emissiveIntensity={2} />
        </mesh>
      </group>
    </group>
  )
}

export function ChaseScene({ me, input, running, onHud, onBusted }: {
  me: ChaseCar; input: ChaseInput; running: boolean
  onHud: (h: ChaseHud) => void; onBusted: (dist: number, coins: number) => void
}) {
  useEffect(() => holdTown(), [])
  const view = useArcadeLook()
  const pool = useTownPool()
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  useLayoutEffect(() => {
    // Portrait phones need a wider lens to see all three lanes.
    camera.fov = size.width < size.height ? 70 : 50
    camera.updateProjectionMatrix()
  }, [camera, size])

  const traffic = useMemo(() => pickTraffic(10), [])
  // Each car's measured footprint, for the crash test.
  const foot = useRef<Footprint>(scaled(frameFootprint(me.body), fit(me.body)))
  const feet = useRef<Footprint[]>(traffic.map((t) => scaled(frameFootprint(t.body), fit(t.body))))
  const player = useRef<Group>(null)
  const cop = useRef<Group>(null)
  const red = useRef<Mesh>(null)
  const blue = useRef<Mesh>(null)
  const glow = useRef<Mesh>(null)
  const cars = useRef<(Group | null)[]>([])
  const coinMesh = useRef<InstancedMesh>(null)
  const rimMesh = useRef<InstancedMesh>(null)
  const puffMesh = useRef<InstancedMesh>(null)
  const stretches = useRef<(Group | null)[]>([])

  const st = useRef({
    t: 0, dist: 0, got: 0, hearts: CHASE_HEARTS, lane: 1, x: 0, safe: 0, rowIn: 0.8, shake: 0, over: false, overAt: 0,
    hudAt: 0, copZ: 6, road: 0, seed: Math.floor(Math.random() * 1e9),
    cars: traffic.map((): Slot => ({ on: false, lane: 0, z: 0, hit: 0 })),
    bags: Array.from({ length: COINS }, () => ({ on: false, lane: 0, z: 0 })),
    // Smoke from crashes and sparkles from grabbed coins.
    puffs: Array.from({ length: PUFFS }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, age: 1, life: 1, gold: false })),
  })
  const rand = useMemo(() => {
    let s = st.current.seed
    return () => ((s = (s * 16807) % 2147483647) / 2147483647)
  }, [])
  const dummy = useMemo(() => new Object3D(), [])

  useEffect(() => {
    if (running) sirenSound(2)
  }, [running])

  const puff = (x: number, z: number, n: number, gold: boolean) => {
    const s = st.current
    for (let k = 0; k < n; k++) {
      const p = s.puffs.find((o) => o.age >= o.life)
      if (!p) return
      Object.assign(p, { x: x + (rand() - 0.5) * 0.6, y: 0.3 + rand() * 0.3, z: z + (rand() - 0.5) * 0.6, vx: (rand() - 0.5) * 2.5, vy: 1 + rand() * 1.5, age: 0, life: 0.5 + rand() * 0.4, gold })
    }
  }

  useFrame((state, rawDt) => {
    const s = st.current
    const dt = Math.min(rawDt, 1 / 20)
    const go = running && !s.over
    const v = go ? chaseSpeed(s.t) : s.over ? Math.max(0, chaseSpeed(s.t) * (1 - (state.clock.elapsedTime - s.overAt) * 1.5)) : 0
    if (go) s.t += dt
    const move = v * dt
    s.dist += go ? move : 0

    // Lane moves.
    while (input.moves.length) {
      const m = input.moves.shift()!
      if (!go) continue
      s.lane = Math.max(0, Math.min(2, s.lane + m))
    }
    const tx = CHASE_LANES[s.lane]
    const prevX = s.x
    s.x += (tx - s.x) * Math.min(1, dt * 12)
    const lean = (s.x - prevX) / Math.max(dt, 1e-3)

    // A new row of traffic every so often, more often as the run goes on.
    if (go) {
      s.rowIn -= dt
      if (s.rowIn <= 0) {
        s.rowIn = Math.max(0.6, 1.4 - s.t * 0.008)
        const row = chaseRow(rand, s.t)
        for (const lane of row.cars) {
          const free = s.cars.filter((c) => !c.on)
          const slot = free[Math.floor(rand() * free.length)]
          if (slot) Object.assign(slot, { on: true, lane, z: SPAWN_Z + (rand() - 0.5) * 2, hit: 0 })
        }
        if (row.coins !== null) {
          for (let k = 0; k < 4; k++) {
            const c = s.bags.find((o) => !o.on)
            if (c) Object.assign(c, { on: true, lane: row.coins, z: SPAWN_Z + 5 + k * 1.4 })
          }
        }
      }
    }

    // Traffic drives the same way, slower than you, so it closes in at 70% of your speed.
    const close = move * 0.7
    // You and the traffic as the boxes you see: your car turned with its lean, theirs facing you.
    const mine = carBox({ x: s.x, z: 0, h: Math.PI - lean * 0.03 }, foot.current)
    const hitCar = (i: number, c: Slot) => boxPush(mine, carBox({ x: CHASE_LANES[c.lane], z: c.z, h: Math.PI }, feet.current[i])) !== null
    s.cars.forEach((c, i) => {
      const g = cars.current[i]
      if (!c.on) {
        if (g) g.visible = false
        return
      }
      c.z += close
      if (c.hit) {
        // Knocked aside after a crash: spin off the road.
        c.hit += dt
        if (g) {
          g.position.x += (CHASE_LANES[c.lane] >= 0 ? 1 : -1) * dt * 6
          g.rotation.y += dt * 7
        }
      }
      if (c.z > 12) c.on = false
      if (go && !c.hit && hitCar(i, c)) {
        c.hit = 0.001
        if (s.safe <= 0) {
          s.hearts--
          s.safe = 1.4
          s.shake = 0.5
          crashSound()
          puff(s.x, -0.6, 8, false)
          if (s.hearts <= 0) {
            s.over = true
            s.overAt = state.clock.elapsedTime
            sirenSound(3)
          } else sirenSound(1)
        }
      }
      if (g) {
        g.visible = true
        if (!c.hit) {
          g.position.set(CHASE_LANES[c.lane], 0, c.z)
          g.rotation.y = Math.PI
        } else g.position.z = c.z
      }
    })

    // Coins bob and spin above the road.
    let collected = false
    s.bags.forEach((c, i) => {
      if (c.on) {
        c.z += close
        if (c.z > 8) c.on = false
        if (go && c.on && circlePush(mine, { x: CHASE_LANES[c.lane], z: c.z, r: COIN_R }) !== null) {
          c.on = false
          s.got++
          collected = true
          puff(CHASE_LANES[c.lane], c.z, 3, true)
        }
      }
      dummy.position.set(CHASE_LANES[c.lane], c.on ? 0.5 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.06 : -10, c.z)
      dummy.rotation.set(Math.PI / 2, 0, state.clock.elapsedTime * 4 + i)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      coinMesh.current?.setMatrixAt(i, dummy.matrix)
      rimMesh.current?.setMatrixAt(i, dummy.matrix)
    })
    if (coinMesh.current) coinMesh.current.instanceMatrix.needsUpdate = true
    if (rimMesh.current) rimMesh.current.instanceMatrix.needsUpdate = true
    if (collected) sfx.coin()

    // Puffs drift up: smoke swells, sparkles shrink away.
    s.puffs.forEach((p, i) => {
      p.age += dt
      const live = p.age < p.life
      if (live) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += close
      }
      const k = live ? p.age / p.life : 1
      dummy.position.set(p.x, live ? p.y : -10, p.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(live ? (p.gold ? 0.18 * (1 - k) : 0.25 + k * 0.5) : 0.001)
      dummy.updateMatrix()
      puffMesh.current?.setMatrixAt(i, dummy.matrix)
      puffMesh.current?.setColorAt(i, p.gold ? GOLD : SMOKE)
    })
    if (puffMesh.current) {
      puffMesh.current.instanceMatrix.needsUpdate = true
      if (puffMesh.current.instanceColor) puffMesh.current.instanceColor.needsUpdate = true
    }

    // The street stretches leapfrog past at your full speed.
    s.road += move
    stretches.current.forEach((g, i) => {
      if (!g) return
      const span = STRETCH * STRETCHES
      g.position.z = ((((i * STRETCH + s.road) % span) + span) % span) - span + STRETCH + 14
    })

    // You: lean into lane changes, blink while you're safe after a crash.
    s.safe = Math.max(0, s.safe - dt)
    if (player.current) {
      player.current.position.x = s.x
      player.current.rotation.y = Math.PI - lean * 0.03
      player.current.rotation.z = -lean * 0.012
      player.current.visible = s.safe <= 0 || Math.floor(s.safe * 10) % 2 === 0
    }

    // The cop sits further back with every heart you have left, and pulls alongside when you're caught.
    const copTarget = s.over ? 0 : 2 + s.hearts * 0.8
    s.copZ += (copTarget - s.copZ) * Math.min(1, dt * 2)
    if (cop.current) {
      cop.current.position.set(s.over ? s.x + (s.lane === 2 ? -1.5 : 1.5) : cop.current.position.x + (s.x - cop.current.position.x) * Math.min(1, dt * 3), 0, s.copZ)
    }
    const flash = Math.floor(state.clock.elapsedTime * 6) % 2 === 0
    if (red.current) (red.current.material as MeshStandardMaterial).emissiveIntensity = flash ? 3 : 0.2
    if (blue.current) (blue.current.material as MeshStandardMaterial).emissiveIntensity = flash ? 0.2 : 3
    if (glow.current) (glow.current.material as MeshBasicMaterial).color.set(flash ? '#ff1744' : '#2979ff')

    // Chase camera with a little shake on a crash.
    s.shake = Math.max(0, s.shake - dt)
    const j = s.shake * 0.4
    camera.position.set(s.x * 0.5 + (Math.random() - 0.5) * j, 5.2 + (Math.random() - 0.5) * j, 10)
    camera.lookAt(s.x * 0.3, 0, -7)

    if (state.clock.elapsedTime - s.hudAt > 0.1 || s.over) {
      s.hudAt = state.clock.elapsedTime
      onHud({ dist: s.dist, coins: s.got, hearts: s.hearts, speed: v })
    }
    if (s.over && state.clock.elapsedTime - s.overAt > 1.6 && s.overAt >= 0) {
      s.overAt = -1
      onBusted(s.dist, s.got)
    }
  })

  return (
    <>
      <ArcadeSky view={view} near={30} far={95} />
      {/* Grass far out under everything. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.06, -40]}>
        <planeGeometry args={[160, 200]} />
        <meshStandardMaterial color="#6fae4f" />
      </mesh>
      {Array.from({ length: STRETCHES }, (_, i) => (
        <group key={i} ref={(g) => void (stretches.current[i] = g)}>
          <Batch version={pool.join()}>
            <StreetStretch len={STRETCH} half={HALF} lanes={[(CHASE_LANES[0] + CHASE_LANES[1]) / 2, (CHASE_LANES[1] + CHASE_LANES[2]) / 2]} seed={i + 1} pool={pool} />
          </Batch>
        </group>
      ))}

      <instancedMesh ref={coinMesh} args={[undefined, undefined, COINS]} frustumCulled={false}>
        <cylinderGeometry args={[0.26, 0.26, 0.09, 20]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.75} roughness={0.25} emissive="#ffb300" emissiveIntensity={0.55} />
      </instancedMesh>
      <instancedMesh ref={rimMesh} args={[undefined, undefined, COINS]} frustumCulled={false}>
        <torusGeometry args={[0.27, 0.035, 6, 20]} />
        <meshStandardMaterial color="#f9a825" metalness={0.8} roughness={0.3} emissive="#e65100" emissiveIntensity={0.25} />
      </instancedMesh>
      <instancedMesh ref={puffMesh} args={[undefined, undefined, PUFFS]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.8} flatShading depthWrite={false} />
      </instancedMesh>

      <group ref={player} rotation-y={Math.PI}>
        <CarShadow len={LEN} />
        <Footprinted id={`${me.body}:${me.model}:${me.mods?.join()}`} scale={fit(me.body)} onFoot={(f) => void (foot.current = f)}>
          <CarModel body={me.body} model={me.model} color={me.color} finish={me.finish} skin={me.skin} modSkin={me.modSkin} mods={me.mods} beams={view.beams} flames />
        </Footprinted>
      </group>

      {traffic.map((t, i) => (
        <group key={i} ref={(g) => void (cars.current[i] = g)} visible={false}>
          <CarShadow len={LEN} />
          <Footprinted id={`${i}:${t.model}`} scale={fit(t.body)} onFoot={(f) => void (feet.current[i] = f)}>
            <CarModel body={t.body} model={t.model} color={t.color} beams={view.beams} />
          </Footprinted>
        </group>
      ))}

      <group ref={cop} position={[0, 0, 6]} rotation-y={Math.PI}>
        <CarShadow len={LEN} />
        <Cruiser beams={view.beams} red={red} blue={blue} />
        {/* The light bar's glow on the road. */}
        <mesh ref={glow} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <planeGeometry args={[2.2, 2.8]} />
          <meshBasicMaterial map={glowTex()} color="#ff1744" transparent opacity={0.35 + view.night * 0.4} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}
