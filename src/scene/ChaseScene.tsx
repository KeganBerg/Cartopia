import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CanvasTexture, Color, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, RepeatWrapping, SRGBColorSpace } from 'three'
import { CarModel, carFrame } from './CarModel'
import { SkyDome } from './RaceScene'
import { SkyEnv } from './SkyEnv'
import { holdTown } from './renderGate'
import { CHASE_HEARTS, CHASE_LANES, chaseRow, chaseSpeed } from '../game/arcade'
import type { Body, Finish } from '../game/data'
import { sfx } from '../lib/sound'
import { crashSound, sirenSound } from '../lib/arcadeSound'

export type ChaseCar = { body: Body; model?: string; color: string; finish?: Finish | null; mods?: string[] | null }
// The screen pushes lane moves here (-1 left, +1 right); the scene takes them each frame.
export type ChaseInput = { moves: number[] }
export type ChaseHud = { dist: number; coins: number; hearts: number; speed: number }

const LEN = 1.6 // every car is drawn at this length
const SPAWN_Z = -80
const ROAD_W = 6.4
const TRAFFIC: { body: Body; color: string }[] = [
  { body: 'sedan', color: '#90a4ae' }, { body: 'compact', color: '#ffb74d' }, { body: 'van', color: '#e0e0e0' },
  { body: 'suv', color: '#4e6e8e' }, { body: 'truck', color: '#a1887f' }, { body: 'hatch', color: '#ef5350' },
  { body: 'wagon', color: '#81c784' }, { body: 'classic', color: '#4dd0e1' }, { body: 'sedan', color: '#fff176' },
  { body: 'compact', color: '#ba68c8' },
]
const COINS = 24

const fit = (body: Body) => LEN / carFrame(body).len

// Rows of windows for the roadside blocks, tinted by each block's colour.
let windows: CanvasTexture | null = null
function windowTex() {
  if (windows) return windows
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = '#5d7590'
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) g.fillRect(8 + x * 32, 10 + y * 32, 16, 14)
  windows = new CanvasTexture(c)
  windows.wrapS = windows.wrapT = RepeatWrapping
  windows.repeat.set(2, 2)
  windows.colorSpace = SRGBColorSpace
  return windows
}

type Slot = { on: boolean; lane: number; z: number; hit: number }

export function ChaseScene({ me, input, running, onHud, onBusted }: {
  me: ChaseCar; input: ChaseInput; running: boolean
  onHud: (h: ChaseHud) => void; onBusted: (dist: number, coins: number) => void
}) {
  useEffect(() => holdTown(), [])
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  useLayoutEffect(() => {
    // Portrait phones need a wider lens to see all three lanes.
    camera.fov = size.width < size.height ? 70 : 50
    camera.updateProjectionMatrix()
  }, [camera, size])

  const player = useRef<Group>(null)
  const cop = useRef<Group>(null)
  const red = useRef<Mesh>(null)
  const blue = useRef<Mesh>(null)
  const cars = useRef<(Group | null)[]>([])
  const coinMesh = useRef<InstancedMesh>(null)
  const dashes = useRef<InstancedMesh>(null)
  const props = useRef<InstancedMesh>(null)
  const blocks = useRef<InstancedMesh>(null)

  const st = useRef({
    t: 0, dist: 0, got: 0, hearts: CHASE_HEARTS, lane: 1, x: 0, safe: 0, rowIn: 0.8, shake: 0, over: false, overAt: 0,
    hudAt: 0, copZ: 6, road: 0, seed: Math.floor(Math.random() * 1e9),
    cars: TRAFFIC.map((): Slot => ({ on: false, lane: 0, z: 0, hit: 0 })),
    bags: Array.from({ length: COINS }, () => ({ on: false, lane: 0, z: 0 })),
  })
  const rand = useMemo(() => {
    let s = st.current.seed
    return () => ((s = (s * 16807) % 2147483647) / 2147483647)
  }, [])

  // Roadside: trees, lamp posts and building blocks, recycled as they pass.
  const side = useMemo(() => {
    const trees = Array.from({ length: 28 }, (_, i) => ({ z: -i * 3.2, x: (i % 2 ? 1 : -1) * (ROAD_W / 2 + 1.6 + (i % 3) * 0.5), s: 0.8 + (i % 4) * 0.15 }))
    const houses = Array.from({ length: 20 }, (_, i) => ({ z: -i * 4.6, x: (i % 2 ? 1 : -1) * (ROAD_W / 2 + 5.2), w: 3 + (i % 3), h: 2 + ((i * 7) % 5) * 0.7 }))
    return { trees, houses }
  }, [])
  const dummy = useMemo(() => new Object3D(), [])
  const houseColors = ['#ffcc80', '#90caf9', '#ef9a9a', '#c5e1a5', '#fff59d', '#b39ddb', '#80cbc4', '#ffab91']
  useLayoutEffect(() => {
    const c = new Color()
    side.houses.forEach((_, i) => blocks.current?.setColorAt(i, c.set(houseColors[i % houseColors.length])))
    if (blocks.current?.instanceColor) blocks.current.instanceColor.needsUpdate = true
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (running) sirenSound(2)
  }, [running])

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
    const near = (lane: number, z: number, w: number) => Math.abs(s.x - CHASE_LANES[lane]) < 0.95 && Math.abs(z) < w
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
      if (go && !c.hit && near(c.lane, c.z, LEN * 0.92)) {
        c.hit = 0.001
        if (s.safe <= 0) {
          s.hearts--
          s.safe = 1.4
          s.shake = 0.5
          crashSound()
          if (s.hearts <= 0) {
            s.over = true
            s.overAt = state.clock.elapsedTime
            sirenSound(3)
          } else sirenSound(1)
        }
      }
      if (g) {
        g.visible = true
        if (!c.hit) g.position.set(CHASE_LANES[c.lane], 0, c.z)
        else g.position.z = c.z
        if (!c.hit) g.rotation.y = Math.PI
      }
    })

    // Coins spin in place on the road.
    let collected = false
    s.bags.forEach((c, i) => {
      if (c.on) {
        c.z += close
        if (c.z > 8) c.on = false
        if (go && c.on && near(c.lane, c.z, 0.8)) {
          c.on = false
          s.got++
          collected = true
        }
      }
      dummy.position.set(CHASE_LANES[c.lane], c.on ? 0.45 : -10, c.z)
      dummy.rotation.set(Math.PI / 2, 0, state.clock.elapsedTime * 4 + i)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      coinMesh.current?.setMatrixAt(i, dummy.matrix)
    })
    if (coinMesh.current) coinMesh.current.instanceMatrix.needsUpdate = true
    if (collected) sfx.coin()

    // The road and roadside scroll at your full speed.
    s.road += move
    const scroll = (z: number, span: number) => ((((z + s.road) % span) + span) % span) - span + 12
    if (dashes.current) {
      for (let i = 0; i < 40; i++) {
        const z = scroll(-i * 4, 160)
        dummy.position.set(i % 2 ? CHASE_LANES[0] / 2 + CHASE_LANES[1] / 2 : CHASE_LANES[1] / 2 + CHASE_LANES[2] / 2, 0.012, z)
        dummy.rotation.set(-Math.PI / 2, 0, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        dashes.current.setMatrixAt(i, dummy.matrix)
      }
      dashes.current.instanceMatrix.needsUpdate = true
    }
    if (props.current) {
      side.trees.forEach((t, i) => {
        dummy.position.set(t.x, 0, scroll(t.z, 28 * 3.2))
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(t.s)
        dummy.updateMatrix()
        props.current!.setMatrixAt(i, dummy.matrix)
      })
      props.current.instanceMatrix.needsUpdate = true
    }
    if (blocks.current) {
      side.houses.forEach((h, i) => {
        dummy.position.set(h.x, h.h / 2, scroll(h.z, 20 * 4.6))
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(h.w, h.h, 3.6)
        dummy.updateMatrix()
        blocks.current!.setMatrixAt(i, dummy.matrix)
      })
      blocks.current.instanceMatrix.needsUpdate = true
    }

    // You: lean into lane changes, blink while you're safe after a crash.
    s.safe = Math.max(0, s.safe - dt)
    if (player.current) {
      const lean = (s.x - prevX) / Math.max(dt, 1e-3)
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
      <color attach="background" args={['#8fd3ff']} />
      <fog attach="fog" args={['#bfe6ff', 30, 80]} />
      <SkyDome />
      <hemisphereLight args={['#ffffff', '#6a8f4e', 1.2]} />
      <directionalLight position={[4, 10, 3]} intensity={1.6} />
      <SkyEnv />
      {/* Ground, road and sidewalks. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, -40]}>
        <planeGeometry args={[80, 140]} />
        <meshStandardMaterial color="#7cb85a" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -40]}>
        <planeGeometry args={[ROAD_W, 140]} />
        <meshStandardMaterial color="#4a4f57" roughness={0.9} />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (ROAD_W / 2 + 0.5), 0.06, -40]}>
          <boxGeometry args={[1, 0.12, 140]} />
          <meshStandardMaterial color="#cfd2d6" />
        </mesh>
      ))}
      <instancedMesh ref={dashes} args={[undefined, undefined, 40]} frustumCulled={false}>
        <planeGeometry args={[0.14, 1.6]} />
        <meshStandardMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh ref={props} args={[undefined, undefined, side.trees.length]} frustumCulled={false}>
        <coneGeometry args={[0.7, 2.2, 7]} />
        <meshStandardMaterial color="#3f8f3a" flatShading />
      </instancedMesh>
      <instancedMesh ref={blocks} args={[undefined, undefined, side.houses.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" map={windowTex()} />
      </instancedMesh>
      <instancedMesh ref={coinMesh} args={[undefined, undefined, COINS]} frustumCulled={false}>
        <cylinderGeometry args={[0.3, 0.3, 0.08, 16]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.7} roughness={0.3} emissive="#ffb300" emissiveIntensity={0.6} />
      </instancedMesh>

      <group ref={player} rotation-y={Math.PI}>
        <group scale={fit(me.body)}>
          <CarModel body={me.body} model={me.model} color={me.color} finish={me.finish} mods={me.mods} />
        </group>
      </group>

      {TRAFFIC.map((t, i) => (
        <group key={i} ref={(g) => void (cars.current[i] = g)} visible={false}>
          <group scale={fit(t.body)}>
            <CarModel body={t.body} color={t.color} />
          </group>
        </group>
      ))}

      <group ref={cop} position={[0, 0, 6]} rotation-y={Math.PI}>
        <group scale={fit('sedan')}>
          <CarModel body="sedan" color="#f5f5f5" />
        </group>
        {/* Black doors and a light bar make it read as a cruiser. */}
        <mesh position={[0, 0.34, 0]}>
          <boxGeometry args={[0.86, 0.2, 0.7]} />
          <meshStandardMaterial color="#1b1f24" />
        </mesh>
        <mesh ref={red} position={[-0.17, 0.84, 0]}>
          <boxGeometry args={[0.3, 0.1, 0.16]} />
          <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={2} />
        </mesh>
        <mesh ref={blue} position={[0.17, 0.84, 0]}>
          <boxGeometry args={[0.3, 0.1, 0.16]} />
          <meshStandardMaterial color="#2979ff" emissive="#2979ff" emissiveIntensity={2} />
        </mesh>
      </group>
    </>
  )
}
