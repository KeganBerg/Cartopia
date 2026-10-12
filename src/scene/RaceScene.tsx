import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, Color, IcosahedronGeometry, Vector3, MeshBasicMaterial, MeshStandardMaterial, Object3D, type PerspectiveCamera, type Group, type InstancedMesh, type Mesh } from 'three'
import type { Body, Finish, Panels, SkinnedSlot } from '../game/data'
import { CarModel, carSize } from './CarModel'
import { signTexture } from './signTexture'
import { skyTex, asphaltTex, paverTex, glowTex, sandTex, grassTex, beachSandTex, snowTex, concreteTex } from './textures'
import { BuildingModel, LightPool } from './BuildingModel'
import { glowMats, dayPhase, duskAmount, nightAmount } from './dayNight'
import { lookFor } from './look'
import { PostFx } from './PostFx'
import { SkyEnv } from './SkyEnv'
import { holdTown } from './renderGate'
import { PAL, SEASON } from './season'
import { SHIRTS, PANTS, SKIN, HAIR, BEANIES } from './people'
import { LAYER, decal } from './layers'
import { holdPageTint } from './pageTint'
import { useGame } from '../game/store'
import { Skyline } from './Skyline'
import { Batch } from './Batch'
import { Manhole } from './BuildingDetail'
import { BUILDINGS, TILE, buildingDef } from '../game/data'
import { VenueScenery, VenueBackdrop, ROAD, WALK } from './RaceVenues'
import type { Venue } from './venues'
import { RaceWeather, raceWeather } from './Weather'
import { gloomOf, weatherLook, wetRoad } from './weatherLook'
import type { Weather as WeatherState } from '../game/weather'
import { HERO_TIME, heroCam, heroShot, heroWanted, resetHero } from './heroShot'
import { BoostTrail } from './boostTrail'
import { Celebration } from './celebration'
import { cheerDef, myCheer, myTrail, trailDef } from '../game/flair'
import { reducedMotion } from '../game/fx'
import type { Trim } from '../game/trim'

// burning: the boost is firing (the chase camera punches in).
export type RacerView = { dist: number; burning?: boolean }
const SCALE = 0.25 // metres of race distance per world unit
// How far past the finish line (race metres) a car has to coast and brake to a stop.
const RUN_OUT = 150
// The road carries on this far (world units) past the finish, so its end is always lost in the
// haze instead of dropping off into nothing. The scenery stops a bit sooner (each venue dresses
// ~45 units past the length it's given), where the fog has nearly swallowed it anyway.
const TAIL = 120
const DRESS = 70
const LANE = 0.75

// The finish plays back from a short history of where the race put each car, so it
// can run in slow motion (and from a trackside camera when it's close) while the race
// clock, the shifts and the reported times carry on untouched.
const PHOTO_GAP = 0.15 // seconds between the cars at the line that counts as a photo finish
// Gap at the line (seconds) under which the finish plays in slow motion at all.
const CLOSE_GAP = 0.4
const SLOW = 0.3 // playback speed as the winner crosses a close finish
const PHOTO_SLOW = 0.15 // ...and in a photo finish
// Visual race clock (slows with the replay), for the crowd and the flag.
const vclock = { t: 0 }
// True while the finish is still playing back, so the result card waits for it.
export const finishView = { busy: false }

type Props = {
  track: number
  me: RefObject<RacerView>
  them: RefObject<RacerView>
  mine: { body: Body; model?: string; color: string; finish?: Finish; skin?: string; modSkin?: Partial<Record<SkinnedSlot, string>>; panels?: Panels; mods?: string[]; trim?: Trim }
  theirs: { body: Body; model?: string; color: string; mods?: string[] }
  venue: Venue
  weatherSeed?: string // a live race's id, so both racers get the same weather
  weather?: WeatherState // the race's weather, already rolled (wins over weatherSeed)
  night?: boolean // race under the floodlights whatever the clock says (Pro Tour midnight legs)
  onPhoto?: () => void // a photo finish is about to play
}

export function SkyDome({ tint = '#ffffff' }: { tint?: string }) {
  const ref = useRef<Mesh>(null)
  useFrame(({ camera }) => ref.current?.position.set(camera.position.x, 0, camera.position.z))
  return (
    <mesh ref={ref} raycast={() => null}>
      <sphereGeometry args={[90, 24, 8, 0, Math.PI * 2, 0.9, Math.PI / 2 - 0.75]} />
      <meshBasicMaterial map={skyTex(4)} color={tint} side={BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}

const FALLBACK = ['pizza', 'donut', 'burger', 'diner', 'house', 'motel', 'carwash', 'tires', 'gas', 'bowling', 'icecream', 'house']
const SHOPS = new Set(['business', 'gas', 'parts', 'tires', 'house'])

type Slot = { z: number; side: -1 | 1; def: string }

// Buildings from the player's own town, repeated down both sides of the street.
function useStreet(len: number) {
  const buildings = useGame((s) => s.buildings)
  return useMemo(() => {
    const own = [...new Set(buildings.map((b) => b.def))].filter((d) => SHOPS.has(buildingDef(d).kind))
    const pool = own.length >= 3 ? own : FALLBACK.filter((d) => BUILDINGS.some((b) => b.id === d))
    const slots: Slot[] = []
    for (const side of [-1, 1] as const) {
      let z = -10 + (side > 0 ? 1.5 : 0)
      let i = side > 0 ? 3 : 0
      while (z < len + 30) {
        const def = pool[i++ % pool.length]
        const w = buildingDef(def).w * TILE
        slots.push({ z: z + w / 2, side, def })
        z += w + 1.4 // gap for a tree
      }
    }
    return slots
  }, [buildings, len])
}

// The crowd, built like the townspeople (body, head, hair, legs) plus arms,
// all instanced so 90 fans cost a handful of draws. About half cheer, hopping
// with their arms in the air; the rest watch and wave now and then.
const FAN = 1.3 // same scale as the townspeople
const FAN_LEG = 0.24
function Spectators({ len, cold }: { len: number; cold: boolean }) {
  const torso = useRef<InstancedMesh>(null)
  const head = useRef<InstancedMesh>(null)
  const hair = useRef<InstancedMesh>(null)
  const legs = useRef<InstancedMesh>(null)
  const arms = useRef<InstancedMesh>(null)
  const fans = useMemo(() => {
    const out: { x: number; z: number; h: number; phase: number; cheer: boolean; c: number }[] = []
    for (let i = 0; i < 90; i++) {
      const side = i % 2 ? 1 : -1
      // Crowds bunch up at the start and the finish.
      let z = i < 60 ? -3 + (i / 60) * 18 : len - 8 + ((i - 60) / 30) * 12
      // Keep clear of the photo-finish camera on the line.
      if (side > 0 && z > len - 1.5 && z < len + 3.5) z -= 5
      // Face the street, give or take a little.
      const h = (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (((i * 29) % 7) - 3) * 0.08
      out.push({ x: side * (ROAD + 0.3 + ((i * 37) % 7) / 10), z: z + ((i * 13) % 5) / 5, h, phase: i * 1.7, cheer: (i * 7) % 3 !== 0, c: i * 2654435761 })
    }
    return out
  }, [len])
  useEffect(() => {
    const c = new Color()
    fans.forEach((f, i) => {
      const k = f.c >>> 0
      const shirt = SHIRTS[k % SHIRTS.length]
      torso.current?.setColorAt(i, c.set(shirt))
      head.current?.setColorAt(i, c.set(SKIN[(k >> 6) % SKIN.length]))
      hair.current?.setColorAt(i, c.set((cold ? BEANIES : HAIR)[(k >> 9) % 5]))
      legs.current?.setColorAt(i * 2, c.set(PANTS[(k >> 3) % PANTS.length]))
      legs.current?.setColorAt(i * 2 + 1, c)
      arms.current?.setColorAt(i * 2, c.set(shirt))
      arms.current?.setColorAt(i * 2 + 1, c)
    })
    for (const m of [torso, head, hair, legs, arms]) if (m.current?.instanceColor) m.current.instanceColor.needsUpdate = true
  }, [fans, cold])
  const tmp = useMemo(() => new Object3D(), [])
  useFrame(() => {
    const t = vclock.t
    fans.forEach((f, i) => {
      const hop = f.cheer ? Math.max(0, Math.sin(t * 6 + f.phase)) * 0.09 : 0
      const hip = FAN_LEG + hop
      const sin = Math.sin(f.h)
      const cos = Math.cos(f.h)
      const x = f.x / FAN
      const z = f.z / FAN
      const put = (m: InstancedMesh | null, at: number, px: number, py: number, pz: number, rz = 0, rx = 0, sy = 1, sxz = 1) => {
        if (!m) return
        tmp.position.set(px, py, pz)
        tmp.rotation.set(rx, f.h, rz)
        tmp.scale.set(sxz, sy, sxz)
        tmp.updateMatrix()
        m.setMatrixAt(at, tmp.matrix)
      }
      put(torso.current, i, x, hip + 0.15, z)
      put(head.current, i, x, hip + 0.36, z)
      if (cold) put(hair.current, i, x - sin * 0.005, hip + 0.4, z - cos * 0.005, 0, 0, 0.75, 1.05)
      else put(hair.current, i, x - sin * 0.02, hip + 0.385, z - cos * 0.02, 0, 0, 0.8)
      // Legs straight down, a little kick on each hop.
      for (const side of [-1, 1]) {
        const lx = side * 0.045
        const a = hop * side * 2
        put(legs.current, i * 2 + (side > 0 ? 1 : 0), x + cos * lx, hip - FAN_LEG * 0.5, z - sin * lx, 0, a)
      }
      // Arms swing out from the shoulders: up high when cheering, a lazy wave otherwise.
      const wave = Math.sin(t * (f.cheer ? 6 : 2) + f.phase)
      for (const side of [-1, 1]) {
        const a = f.cheer ? 2.5 + wave * 0.35 * side : 0.15 + (side > 0 ? Math.max(0, wave) * 2.2 : 0)
        const lx = side * (0.11 + Math.sin(a) * 0.085)
        const ly = hip + 0.25 - Math.cos(a) * 0.085
        put(arms.current, i * 2 + (side > 0 ? 1 : 0), x + cos * lx, ly, z - sin * lx, side * a)
      }
    })
    for (const m of [torso, head, hair, legs, arms]) if (m.current) m.current.instanceMatrix.needsUpdate = true
  })
  const n = fans.length
  return (
    <group scale={FAN}>
      <instancedMesh ref={torso} args={[undefined, undefined, n]} frustumCulled={false}>
        <capsuleGeometry args={[0.085, 0.16, 3, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, n]} frustumCulled={false}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={hair} args={[undefined, undefined, n]} frustumCulled={false}>
        <sphereGeometry args={[0.085, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, n * 2]} frustumCulled={false}>
        <boxGeometry args={[0.06, FAN_LEG, 0.07]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, n * 2]} frustumCulled={false}>
        <boxGeometry args={[0.045, 0.17, 0.05]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  )
}

function Banner({ z, text, bg }: { z: number; text: string; bg: string }) {
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (ROAD + 0.25), 1.6, 0]}>
          <boxGeometry args={[0.14, 3.2, 0.14]} />
          <meshStandardMaterial color="#eceff1" />
        </mesh>
      ))}
      {/* Printed on both faces, so it reads the right way round from the photo-finish camera too. */}
      {[Math.PI, 0].map((ry) => (
        <mesh key={ry} position={[0, 3.05, ry ? -0.005 : 0.005]} rotation-y={ry}>
          <planeGeometry args={[ROAD * 2 + 0.5, 0.55]} />
          <meshBasicMaterial map={signTexture(text, bg, '#ffffff')} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// The countdown, shared with the race overlay: 3, 2, 1, then 0 for GO (99 before it starts).
export const startLights = { n: 99 }
const LIT = ['#ff1744', '#ff1744', '#ffab00']
const OFF = new Color('#3a1010')

// A light bar hanging under the START banner: reds come on with the countdown, all green on GO.
function StartLights() {
  const lamps = useMemo(() => Array.from({ length: 3 }, () => new MeshBasicMaterial({ color: OFF, toneMapped: false })), [])
  const lit = useMemo(() => LIT.map((c) => new Color(c)), [])
  const go = useMemo(() => new Color('#00e676'), [])
  useEffect(() => () => lamps.forEach((m) => m.dispose()), [lamps])
  const group = useRef<Group>(null)
  useFrame(({ camera }) => {
    // The chase camera rides at the bar's height: drop the bar just before the camera reaches
    // it, so it never sweeps through the frame as big blurred lamps.
    if (group.current) group.current.visible = camera.position.z < -0.85 - 1.6 || camera.position.y < 2 || camera.position.y > 3.6
    const n = startLights.n
    lamps.forEach((m, i) => {
      if (n === 0) m.color.copy(go)
      else if (n <= 3 && i < 4 - n) m.color.copy(lit[i])
      else m.color.copy(OFF)
    })
  })
  return (
    <group ref={group} position={[0, 2.5, -0.85]}>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.05, 0.3, 0.05]} />
        <meshStandardMaterial color="#263238" />
      </mesh>
      <mesh>
        <boxGeometry args={[1.25, 0.36, 0.14]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      {lamps.map((m, i) => (
        <mesh key={i} position={[(1 - i) * 0.38, 0, -0.08]} rotation-y={Math.PI} material={m}>
          <circleGeometry args={[0.13, 18]} />
        </mesh>
      ))}
    </group>
  )
}

// Tyre smoke off the line, and a flag waving at the finish.
const smokeGeo = new IcosahedronGeometry(0.5, 1)
const smokeMat = new MeshStandardMaterial({ color: '#eceff1', roughness: 1, flatShading: true, emissive: '#555555' })
type Puff = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number }
const SMOKE_MAX = 90
const pt = new Object3D()

function LaunchSmoke({ me, them, len }: { me: RefObject<RacerView>; them: RefObject<RacerView>; len: number }) {
  const mesh = useRef<InstancedMesh>(null)
  const puffs = useRef<Puff[]>([])
  const acc = useRef(0)
  useFrame((_, raw) => {
    const dt = Math.min(0.05, raw)
    const list = puffs.current
    acc.current += dt
    if (startLights.n === 0 && acc.current > 0.06) {
      acc.current = 0
      for (const [r, x] of [[me, LANE], [them, -LANE]] as const) {
        const z = (r.current?.dist ?? 0) * SCALE - 0.9
        // Burnout for the first few car lengths, then it clears.
        if (z > -0.85 && z < Math.min(2.6, len) && list.length < SMOKE_MAX - 1) {
          for (const w of [-0.32, 0.32]) {
            list.push({ x: x + w + (Math.random() - 0.5) * 0.1, y: 0.15, z: z - 0.75, vx: w * 1.2 + (Math.random() - 0.5) * 0.6, vy: 0.4 + Math.random() * 0.5, vz: -0.6 - Math.random() * 0.8, age: 0, life: 0.6 + Math.random() * 0.4 })
          }
        }
      }
    }
    const m = mesh.current
    if (!m) return
    let n = 0
    for (const p of list) {
      p.age += dt
      if (p.age >= p.life) continue
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
      p.vx *= 0.97; p.vz *= 0.95
      const t = p.age / p.life
      pt.position.set(p.x, p.y, p.z)
      pt.scale.setScalar(Math.max(0.001, (0.15 + t * 0.45) * (1 - t * t)))
      pt.updateMatrix()
      m.setMatrixAt(n, pt.matrix)
      list[n++] = p
    }
    list.length = n
    m.count = n
    m.visible = n > 0
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[smokeGeo, smokeMat, SMOKE_MAX]} frustumCulled={false} visible={false} />
}

function FinishFlag({ len, me, them }: { len: number; me: RefObject<RacerView>; them: RefObject<RacerView> }) {
  const flag = useRef<Group>(null)
  const tex = useMemo(() => signTexture('▚▚▚', '#ffffff', '#111111'), [])
  useFrame(() => {
    const g = flag.current
    if (!g) return
    // A lazy wave while they race, wild once someone crosses the line.
    const done = Math.max(me.current?.dist ?? 0, them.current?.dist ?? 0) * SCALE >= len
    const t = vclock.t
    g.rotation.z = done ? Math.sin(t * 9) * 0.9 : Math.sin(t * 2.2) * 0.25 + 0.2
  })
  return (
    <group position={[-(ROAD + WALK * 0.55), 1.1, len - 0.4]}>
      <group ref={flag}>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.1, 6]} />
          <meshStandardMaterial color="#cfd8dc" />
        </mesh>
        <mesh position={[0.3, 0.9, 0]} rotation-y={Math.PI}>
          <planeGeometry args={[0.6, 0.4]} />
          <meshBasicMaterial map={tex} side={2} />
        </mesh>
      </group>
    </group>
  )
}

// Nothing tall on the kerb right in front of the photo-finish camera.
const shotClear = (z: number, side: number, len: number) => side > 0 && z > len - 2 && z < len + 4.5

function Lamp({ z, side, pole = '#37474f' }: { z: number; side: 1 | -1; pole?: string }) {
  return (
    <group position={[side * (ROAD + 0.15), 0, z]} rotation-y={side > 0 ? -Math.PI / 2 : Math.PI / 2}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 1.8, 6]} />
        <meshStandardMaterial color={pole} />
      </mesh>
      <mesh position={[0, 1.78, 0.25]}>
        <boxGeometry args={[0.05, 0.04, 0.5]} />
        <meshStandardMaterial color={pole} />
      </mesh>
      <mesh position={[0, 1.72, 0.48]}>
        <boxGeometry args={[0.16, 0.07, 0.22]} />
        <primitive object={glowMats.bulb} attach="material" dispose={null} />
      </mesh>
      <LightPool r={1} z={0.6} y={0.09} />
    </group>
  )
}

// Street furniture: crowd barriers at the start and finish, bunting across the
// street, hydrants and bins on the sidewalks, manholes, and a start light tree.
function StreetDressing({ len, far, city }: { len: number; far: number; city: boolean }) {
  const barriers: number[] = []
  for (let z = -4; z < 14; z += 1) barriers.push(z)
  for (let z = len - 9; z < len + 5; z += 1) barriers.push(z)
  // A gap on the right at the line for the photo-finish camera.
  const gap = (z: number, sd: number) => sd > 0 && z > len - 1.6
  const bunting: number[] = []
  for (let z = 12; z < len - 4; z += 22) bunting.push(z)
  const flags = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fafafa']
  const furniture: number[] = []
  if (city) for (let z = 2; z < far + 20; z += 7) furniture.push(z)
  return (
    <group>
      {barriers.map((z) => [-1, 1].map((sd) => gap(z, sd) ? null : (
        <group key={`${z}${sd}`} position={[sd * (ROAD + 0.1), 0.08, z + 0.5]}>
          {[0.18, 0.42].map((y) => (
            <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.04, 0.07, 0.94]} /><meshStandardMaterial color={(Math.round(z) + (y > 0.3 ? 1 : 0)) % 2 ? '#e53935' : '#fafafa'} /></mesh>
          ))}
          {[-0.42, 0.42].map((dz) => <mesh key={dz} position={[0, 0.24, dz]}><boxGeometry args={[0.04, 0.48, 0.04]} /><meshStandardMaterial color="#90a4ae" /></mesh>)}
        </group>
      )))}
      {bunting.map((z) => (
        <group key={z} position={[0, 0, z]}>
          {Array.from({ length: 13 }, (_, i) => {
            const t = i / 12
            const x = -ROAD - 0.6 + t * (ROAD + 0.6) * 2
            const y = 3.1 - Math.sin(t * Math.PI) * 0.45
            return (
              <mesh key={i} position={[x, y - 0.12, 0]} rotation-z={Math.PI}>
                <coneGeometry args={[0.12, 0.24, 3]} />
                <meshStandardMaterial color={flags[i % flags.length]} flatShading />
              </mesh>
            )
          })}
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * (ROAD + 0.6), 1.6, 0]}><cylinderGeometry args={[0.04, 0.05, 3.2, 6]} /><meshStandardMaterial color="#37474f" /></mesh>
          ))}
        </group>
      ))}
      {furniture.map((z, i) => {
        const sd = i % 2 ? 1 : -1
        const x = sd * (ROAD + WALK - 0.2)
        return i % 3 === 0 ? (
          <group key={z} position={[x, 0.08, z]}>
            <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.06, 0.07, 0.24, 8]} /><meshStandardMaterial color="#e53935" /></mesh>
            <mesh position={[0, 0.26, 0]}><sphereGeometry args={[0.065, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e53935" /></mesh>
          </group>
        ) : i % 3 === 1 ? (
          <group key={z} position={[x, 0.08, z]}>
            <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.1, 0.09, 0.32, 10]} /><meshStandardMaterial color="#37474f" /></mesh>
            <mesh position={[0, 0.33, 0]}><cylinderGeometry args={[0.11, 0.11, 0.03, 10]} /><meshStandardMaterial color="#546e7a" /></mesh>
          </group>
        ) : (
          <Manhole key={z} x={-sd * LANE} z={z} />
        )
      })}
      {/* The photo-finish camera on its tripod, across from the line camera. */}
      <group position={[-(ROAD + 0.6), 0, len + 1.3]} rotation-y={2.3}>
        {[0, 2.1, 4.2].map((a) => <mesh key={a} position={[Math.sin(a) * 0.12, 0.3, Math.cos(a) * 0.12]} rotation={[Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]}><cylinderGeometry args={[0.012, 0.015, 0.62, 5]} /><meshStandardMaterial color="#263238" /></mesh>)}
        <mesh position={[0, 0.66, 0]}><boxGeometry args={[0.16, 0.13, 0.22]} /><meshStandardMaterial color="#212121" /></mesh>
        <mesh position={[0, 0.66, 0.14]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.045, 0.05, 0.08, 10]} /><meshStandardMaterial color="#37474f" metalness={0.6} roughness={0.3} /></mesh>
      </group>
      {/* Start light tree beside the line. */}
      <group position={[-(ROAD + 0.45), 0, -0.4]}>
        <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.05, 0.06, 1.6, 6]} /><meshStandardMaterial color="#37474f" /></mesh>
        <mesh position={[0, 1.75, 0]}><boxGeometry args={[0.22, 0.62, 0.16]} /><meshStandardMaterial color="#212121" /></mesh>
        {['#f44336', '#ffb300', '#4caf50'].map((col, i) => (
          <mesh key={col} position={[0, 1.95 - i * 0.2, 0.081]}><circleGeometry args={[0.07, 12]} /><meshBasicMaterial color={col} toneMapped={false} /></mesh>
        ))}
      </group>
    </group>
  )
}

// The drag strip, seen from a chase camera. On Main Street it's lined with the
// player's own town; the other venues bring their own scenery.
export function RaceScene({ track, me, them, mine, theirs, venue, weatherSeed, weather: given, night: midnight, onPhoto }: Props) {
  const city = venue.id === 'main'
  const meRef = useRef<Group>(null)
  const themRef = useRef<Group>(null)
  const { camera, size } = useThree()
  const len = track * SCALE
  // Where the road and the scenery run out: far past where the cars stop, deep in the haze.
  const far = len + TAIL
  const dress = len + DRESS
  const slots = useStreet(dress)
  const night = useMemo(() => (midnight ? 1 : nightAmount(dayPhase())), [midnight])
  // The venue's weather for this race (see raceWeather).
  // The race screen passes the one it races on, so the grip matches the sky.
  const weather = useMemo(() => given ?? raceWeather(venue.id, weatherSeed), [given, venue.id, weatherSeed])
  const beams = night > 0.3 || gloomOf(weather) > 0.5
  // Same lights and colour grade as the town at this time of day.
  const look = useMemo(() => weatherLook(lookFor(night, midnight ? 0 : duskAmount(dayPhase()), undefined, undefined, 'race'), weather), [night, midnight, weather])
  // The race fills the screen, so stop drawing the town underneath while racing.
  useEffect(() => holdTown(), [])
  const asphalt = useMemo(() => {
    const t = asphaltTex().clone()
    t.repeat.set(1.6, (far + 50) / 2)
    t.needsUpdate = true
    return t
  }, [far])
  // Goes glossy in the rain and slushy in snow, like the town's roads.
  const road = useMemo(() => wetRoad(asphalt, venue.road ?? '#ffffff'), [asphalt, venue.road])
  useEffect(() => () => road.dispose(), [road])
  const tint = (day: string, dark: string) => '#' + new Color(day).lerp(new Color(dark), night).getHexString()
  // Grey skies when it's overcast.
  const overcast = (c: string) => '#' + new Color(c).lerp(new Color(weather.dust > 0 ? '#c9a57a' : weather.haze > weather.cloud ? '#b9c2cc' : '#7d8692'), Math.min(1, weather.cloud * 0.95 + weather.haze * 0.55 + weather.dust * 0.3)).getHexString()
  // Phone status bar and toolbar take the sky colour while racing.
  const sky = tint(overcast(venue.sky), '#0f1730')
  useEffect(() => holdPageTint(sky), [sky])
  // Full screen on a phone is tall and narrow: widen the view so the street still fills it.
  const fov = useMemo(() => {
    const aspect = size.width / size.height
    return aspect < 1 ? Math.min(72, 55 / Math.max(aspect, 0.45) ** 0.35) : 55
  }, [size])
  useEffect(() => {
    const cam = camera as PerspectiveCamera
    cam.fov = fov
    cam.updateProjectionMatrix()
  }, [camera, fov])
  useEffect(() => {
    resetHero()
    return () => {
      finishView.busy = false
      resetHero()
    }
  }, [])
  // Each car is drawn with its nose on its race position, so whoever is ahead at the line looks it.
  const noses = [carSize(mine.body).len * 0.7, carSize(theirs.body).len * 0.7]

  // Past the line each car lifts, coasts a moment, then brakes to a stop well before the
  // road runs out, nose dipping as the brakes bite. Distances are race metres.
  const runs = useRef([0, 1].map(() => ({ z: 0, v: 0, last: 0, past: 0, dip: 0, cross: -1 })))
  // The finish replay (see PHOTO_GAP): the race's own positions, stamped on the race's frame clock,
  // played back on a visual clock that can run slower than it.
  // hero: seconds into the finish hero shot (heroShot.ts), -1 before it, -2 once it's over.
  const fx = useRef({ st: 0, vt: 0, hist: [] as { t: number; d: [number, number] }[], phase: 'race' as 'race' | 'slow' | 'after', photo: false, rate: 1, target: 1, side: false, since: 0, cut: false, shake: 0, hero: -1 })
  const heroPos = useMemo(() => new Vector3(), [])
  const heroAt = useMemo(() => new Vector3(), [])
  // A glowing ribbon on the road behind each car while its boost burns.
  const trails = useMemo(() => [new BoostTrail(), new BoostTrail()], [])
  useEffect(() => () => trails.forEach((t) => t.dispose()), [trails])
  // The player's own flair (game/flair.ts): their trail colour, and a celebration on a win.
  const trailId = useGame((s) => myTrail(s).id)
  useEffect(() => trails[0].setLook(trailDef(trailId).look), [trails, trailId])
  const cheerId = useGame((s) => myCheer(s).id)
  const cheer = useMemo(() => new Celebration(), [])
  useEffect(() => () => cheer.dispose(), [cheer])
  useFrame(({ scene }, delta) => {
    scene.environmentIntensity = look.env
    const dt = Math.min(delta, 0.1)
    const f = fx.current
    f.st += dt
    f.hist.push({ t: f.st, d: [me.current?.dist ?? 0, them.current?.dist ?? 0] })
    f.rate += (f.target - f.rate) * Math.min(1, dt * 12)
    const vdt = dt * f.rate
    f.vt = Math.min(f.st, f.vt + vdt)
    vclock.t += vdt
    // Where the race had each car at the visual clock's time.
    const h = f.hist
    while (h.length > 2 && h[1].t <= f.vt) h.shift()
    const a = h[0]
    const b = h[1] ?? a
    const k = b.t > a.t ? Math.max(0, Math.min(1, (f.vt - a.t) / (b.t - a.t))) : 1
    const shown = [0, 1].map((i) => a.d[i] + (b.d[i] - a.d[i]) * k)
    const [mz, tz] = shown.map((d, i) => {
      const r = runs.current[i]
      if (d < track) {
        // Speed as the race draws it, so live rivals (who only send positions) roll on too.
        if (vdt > 0) r.v += ((d - r.last) / vdt - r.v) * Math.min(1, vdt * 8)
        r.z = d
      } else {
        if (r.cross < 0) {
          r.cross = f.vt
          r.z = Math.max(r.z, track)
        }
        r.past += vdt
        // Lift and coast, then brake just hard enough to stop short of the end of the run-out.
        const left = Math.max(1, track + RUN_OUT * 0.92 - r.z)
        const brake = r.past < 0.35 ? 2.5 : Math.min(r.v * r.v / (2 * left), 14) * Math.min(1, (r.past - 0.35) / 0.4) + 1.5
        r.v = Math.max(0, r.v - brake * vdt)
        r.z = Math.min(track + RUN_OUT, r.z + r.v * vdt)
        // The nose dips under braking and settles back as the car stops.
        r.dip += ((r.v > 0.5 ? Math.min(1, brake / 12) : 0) - r.dip) * Math.min(1, vdt * 6)
      }
      r.last = d
      return r.z * SCALE - noses[i]
    })
    const cars = [meRef.current, themRef.current]
    cars.forEach((g, i) => g?.rotation.set(runs.current[i].dip * 0.035, 0, 0))
    meRef.current?.position.set(LANE, 0, mz)
    themRef.current?.position.set(-LANE, 0, tz)
    trails[0].update(vdt, LANE, 0.16, mz - noses[0], 0, !!me.current?.burning && runs.current[0].cross < 0)
    trails[1].update(vdt, -LANE, 0.16, tz - noses[1], 0, !!them.current?.burning && runs.current[1].cross < 0)
    cheer.update(dt)

    // The finish: slow motion as the leader reaches the line when it's close, from the trackside camera when it's very close.
    const [ra, rb] = runs.current
    if (f.phase === 'race') {
      const eta = (r: typeof ra, d: number) => (d >= track ? 0 : r.v > 1 ? (track - d) / r.v : Infinity)
      const ta = eta(ra, shown[0])
      const tb = eta(rb, shown[1])
      // A clear win just rolls through at full speed; only a close one gets the slow-motion replay.
      if (Math.min(ta, tb) < 0.16 && !(Math.abs(ta - tb) < CLOSE_GAP)) {
        f.phase = 'after'
        f.since = f.vt
      } else if (Math.min(ta, tb) < 0.16) {
        f.phase = 'slow'
        f.photo = Math.abs(ta - tb) < PHOTO_GAP
        f.target = f.photo ? PHOTO_SLOW : SLOW
        f.side = f.photo
        f.since = f.vt
        finishView.busy = true
        if (f.photo) onPhoto?.()
      }
    } else if (f.phase === 'slow') {
      const first = Math.min(...[ra.cross, rb.cross].filter((c) => c >= 0))
      const both = ra.cross >= 0 && rb.cross >= 0
      // A normal finish slows just as the winner crosses; a photo finish holds until both are over.
      const done = f.photo ? (both && f.vt - Math.max(ra.cross, rb.cross) > 0.12) || f.vt - f.since > 1 : Number.isFinite(first) && f.vt - first > 0.2
      if (done) {
        f.phase = 'after'
        f.target = 1
        f.since = f.vt
      }
    } else {
      // Both cars are over the line, so nothing left in the history needs showing: drop the lag.
      const settled = ra.cross >= 0 && rb.cross >= 0
      if (settled) f.vt = f.st
      // Otherwise the trailing car catches up at a little over real time.
      else f.target = f.st - f.vt > 0.03 ? 1.35 : 1
      // The trackside shot holds while the cars run out of frame, then cuts back to the chase.
      if (f.side && f.vt - f.since > 0.7) f.side = false
      const caught = !f.side && f.rate > 0.97 && f.st - f.vt < 0.03
      // Once any replay is done and the player's car is a moment past the line, its hero shot.
      if (caught && f.hero === -1 && ra.cross >= 0 && f.vt - ra.cross > 0.35) {
        f.hero = heroWanted() ? 0 : -2
        heroShot.on = f.hero === 0
        const car = meRef.current?.position
        if (car && (rb.cross < 0 || ra.cross <= rb.cross) && !reducedMotion()) cheer.start(cheerDef(cheerId), car.x, 0, car.z, noses[0] / 0.7)
      }
      if (caught) finishView.busy = false
    }

    const cam = camera as PerspectiveCamera
    const tall = size.height > size.width
    if (f.hero >= 0) {
      f.hero += dt
      if (heroShot.skip || f.hero >= HERO_TIME) {
        // Over (or tapped past): the chase view glides back in from wherever the shot left off.
        f.hero = -2
        heroShot.on = false
      } else {
        const car = meRef.current!.position
        // Round the inner flank, kept on the tarmac clear of the kerbside barriers.
        heroCam(f.hero, car.x, 0, car.z, 0, noses[0] * 2 * (tall ? 1.25 : 1), -1, tall ? 2.5 : 2.3, heroPos, heroAt)
        cam.fov = tall ? fov : 40
        cam.updateProjectionMatrix()
        cam.position.copy(heroPos)
        cam.lookAt(heroAt)
        return
      }
    }
    if (f.side) {
      f.cut = true
      // Low on the kerb just past the line, looking back across it as the noses arrive.
      if (cam.fov !== (tall ? fov : 34)) {
        cam.fov = tall ? fov : 34
        cam.updateProjectionMatrix()
      }
      // A tall phone screen stands back a little and looks down more, so the cars fill it rather than the sky.
      if (tall) cam.position.set(ROAD + 0.5, 1.15, len + 3.9)
      else cam.position.set(ROAD + 0.55, 0.7, len + 2.6)
      cam.lookAt(-0.3, tall ? 0.05 : 0.3, len - 0.5)
      return
    }
    // Speed widens the view a little, and the boost punches it wider still, so going fast feels fast.
    const pace = Math.min(1, ra.v / 160)
    const boosting = !!me.current?.burning && ra.cross < 0
    const want = fov + 7 * pace + (boosting ? 6 : 0)
    if (f.cut) {
      f.cut = false
      cam.fov = want
      // Cut straight back behind the cars rather than swooping through the barriers.
      cam.position.set(tall ? 0 : LANE * 0.5, tall ? 2.7 : 2.2, mz - (tall ? 5.2 : 4.2))
    } else cam.fov += (want - cam.fov) * Math.min(1, dt * (boosting ? 8 : 3))
    cam.updateProjectionMatrix()
    const lead = Math.max(mz, tz)
    const target = Math.min(mz, len + RUN_OUT * SCALE)
    // Tall phone screens get a higher, further-back chase view.
    camera.position.lerp({ x: tall ? 0 : LANE * 0.5, y: tall ? 2.7 : 2.2, z: target - (tall ? 5.2 : 4.2) } as never, 0.15)
    camera.lookAt(tall ? 0 : LANE * 0.3, 0.3, Math.min(target + 3 + (lead - target) * 0.3, len + RUN_OUT * SCALE + 4))
    // A faint road buzz at speed, stronger under boost; gone once the cars are over the line.
    f.shake += ((ra.cross < 0 ? pace * 0.012 + (boosting ? 0.02 : 0) : 0) - f.shake) * Math.min(1, dt * 6)
    if (f.shake > 0.0005) camera.position.y += Math.sin(f.st * 53) * f.shake + Math.sin(f.st * 31) * f.shake * 0.6
  })

  return (
    <>
      <fog attach="fog" args={[tint(venue.fog, '#1d2740'), venue.fogNear, venue.fogFar]} />
      <color attach="background" args={[sky]} />
      <SkyDome tint={tint(overcast('#ffffff'), '#2a3560')} />
      <hemisphereLight args={[look.sky, look.ground, look.hemiIntensity * 1.15]} />
      <directionalLight position={[5, 10, 2]} intensity={look.sunIntensity * 0.85} color={look.sun} />
      <SkyEnv />
      <PostFx look={look} />
      <RaceWeather w={weather} look={look} night={night} />
      {/* Ground, sidewalks and the street itself. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.outer, far / 2]}>
        <planeGeometry args={[300, far + 140]} />
        {venue.id === 'desert' ? (
          <meshStandardMaterial map={sandTex(38, (far + 140) / 8)} />
        ) : venue.id === 'beach' ? (
          <meshStandardMaterial map={beachSandTex(38, (far + 140) / 8)} />
        ) : venue.id === 'snow' ? (
          <meshStandardMaterial map={snowTex(38, (far + 140) / 8)} />
        ) : venue.id === 'docks' ? (
          <meshStandardMaterial map={concreteTex(60, (far + 140) / 5)} />
        ) : venue.id === 'farm' ? (
          <meshStandardMaterial map={grassTex(38, (far + 140) / 8)} />
        ) : (
          <meshStandardMaterial color={venue.ground ?? PAL.ground} />
        )}
      </mesh>
      {/* The street is static, so it's merged into a few draws like the town, in stretches so the camera skips what it has passed.
          Re-merged when the race length changes, or the road and finish line stay where the last race's were. */}
      <Batch version={city ? slots : `${venue.id}:${len}`} cell={24}>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * (ROAD + WALK / 2), 0.04, far / 2 + 5]}>
            <boxGeometry args={[WALK, 0.08, far + 50]} />
            {venue.shoulder ? <meshStandardMaterial color={venue.shoulder} /> : <meshStandardMaterial map={paverTex(0.5, (far + 50) / 2)} />}
          </mesh>
        ))}
        <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, far / 2 + 5]}>
          <planeGeometry args={[ROAD * 2, far + 50]} />
          <primitive object={road} attach="material" dispose={null} />
        </mesh>
        {/* Centre line dashes and edge lines. */}
        {Array.from({ length: Math.ceil((far + 30) / 2) }, (_, i) => (
          <mesh key={i} rotation-x={-Math.PI / 2} position={[0, LAYER.grid, i * 2 - 8]}>
            <planeGeometry args={[0.06, 1]} />
            <meshBasicMaterial color="#fafafa" {...decal()} />
          </mesh>
        ))}
        {[-1, 1].map((sd) => (
          <mesh key={sd} rotation-x={-Math.PI / 2} position={[sd * (ROAD - 0.08), LAYER.grid, far / 2 + 5]}>
            <planeGeometry args={[0.07, far + 50]} />
            <meshBasicMaterial color="#ffd54f" {...decal()} />
          </mesh>
        ))}
        {/* Start grid line and chequered finish. */}
        <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.lot, 0.1]}>
          <planeGeometry args={[ROAD * 2, 0.15]} />
          <meshBasicMaterial color="#fafafa" {...decal(2)} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.lot, len]}>
          <planeGeometry args={[ROAD * 2, 0.5]} />
          <meshBasicMaterial map={signTexture('▚▚▚▚▚▚▚▚', '#ffffff', '#111111')} {...decal(2)} />
        </mesh>
        <Banner z={-0.8} text="START" bg="#2e7d32" />
        <Banner z={len} text="FINISH" bg="#c62828" />
        {/* Shops facing the street, with trees in the gaps and lamps on the kerb. */}
        {city ? slots.map((sl, i) => {
          const d = buildingDef(sl.def)
          const depth = d.h * TILE
          return (
            <group key={i} position={[0, 0, sl.z]}>
              <group position={[sl.side * (ROAD + WALK + depth / 2 + 0.1), 0, 0]} rotation-y={sl.side < 0 ? Math.PI / 2 : -Math.PI / 2}>
                <mesh rotation-x={-Math.PI / 2} position-y={LAYER.lot}>
                  <planeGeometry args={[d.w * TILE - 0.1, depth - 0.1]} />
                  <meshStandardMaterial map={paverTex(d.w, d.h)} />
                </mesh>
                <BuildingModel def={d} />
              </group>
              <group position={[sl.side * (ROAD + WALK + 0.9), 0, d.w + 0.7]}>
                <BuildingModel def={buildingDef(i % 3 ? 'tree' : 'palm')} />
              </group>
              {i % 2 === 0 && !shotClear(sl.z + d.w + 0.7, sl.side, len) && <Lamp z={d.w + 0.7} side={sl.side} />}
            </group>
          )
        }) : (
          <>
            <VenueScenery id={venue.id} len={dress} />
            {Array.from({ length: Math.ceil((far + 40) / 9) }, (_, i) => shotClear(i * 9 - 6, i % 2 ? 1 : -1, len) ? null : <Lamp key={i} z={i * 9 - 6} side={i % 2 ? 1 : -1} pole={venue.pole} />)}
          </>
        )}
        <StreetDressing len={len} far={far} city={city} />
      </Batch>
      <Spectators len={len} cold={venue.id === 'snow' || SEASON === 'winter'} />
      <StartLights />
      <LaunchSmoke me={me} them={them} len={len} />
      <FinishFlag len={len} me={me} them={them} />
      {city ? <Skyline len={dress} edge={ROAD + WALK + 4.2} night={night} /> : <VenueBackdrop id={venue.id} len={dress} />}
      {trails.map((t, i) => <primitive key={i} object={t.mesh} dispose={null} />)}
      <primitive object={cheer.mesh} dispose={null} />
      {/* Soft shadows under the racers. */}
      {[meRef, themRef].map((r, i) => (
        <group key={i} ref={r} scale={1.4}>
          <mesh rotation-x={-Math.PI / 2} position-y={LAYER.paint}>
            <planeGeometry args={[0.9, 1.5]} />
            <meshBasicMaterial map={glowTex()} color="#000000" transparent opacity={0.35} depthWrite={false} {...decal(3)} />
          </mesh>
          {i === 0 ? <CarModel body={mine.body} model={mine.model} color={mine.color} finish={mine.finish} skin={mine.skin} modSkin={mine.modSkin} panels={mine.panels} trim={mine.trim} mods={mine.mods} flames beams={beams} /> : <CarModel body={theirs.body} model={theirs.model} color={theirs.color} mods={theirs.mods} flames beams={beams} />}
        </group>
      ))}
    </>
  )
}
