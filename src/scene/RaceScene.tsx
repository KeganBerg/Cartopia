import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, Color, Object3D, type PerspectiveCamera, type Group, type InstancedMesh, type Mesh } from 'three'
import type { Body, Finish } from '../game/data'
import { CarModel } from './CarModel'
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

export type RacerView = { dist: number }
const SCALE = 0.25 // metres of race distance per world unit
const LANE = 0.75

type Props = {
  track: number
  me: RefObject<RacerView>
  them: RefObject<RacerView>
  mine: { body: Body; model?: string; color: string; finish?: Finish; mods?: string[] }
  theirs: { body: Body; model?: string; color: string; mods?: string[] }
  venue: Venue
  weatherSeed?: string // a live race's id, so both racers get the same weather
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
      const z = i < 60 ? -3 + (i / 60) * 18 : len - 8 + ((i - 60) / 30) * 12
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
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
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
      <mesh position={[0, 3.05, 0]} rotation-y={Math.PI}>
        <planeGeometry args={[ROAD * 2 + 0.5, 0.55]} />
        <meshBasicMaterial map={signTexture(text, bg, '#ffffff')} toneMapped={false} side={2} />
      </mesh>
    </group>
  )
}

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
function StreetDressing({ len, city }: { len: number; city: boolean }) {
  const barriers: number[] = []
  for (let z = -4; z < 14; z += 1) barriers.push(z)
  for (let z = len - 9; z < len + 5; z += 1) barriers.push(z)
  const bunting: number[] = []
  for (let z = 12; z < len - 4; z += 22) bunting.push(z)
  const flags = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fafafa']
  const furniture: number[] = []
  if (city) for (let z = 2; z < len + 20; z += 7) furniture.push(z)
  return (
    <group>
      {barriers.map((z) => [-1, 1].map((sd) => (
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
export function RaceScene({ track, me, them, mine, theirs, venue, weatherSeed }: Props) {
  const city = venue.id === 'main'
  const meRef = useRef<Group>(null)
  const themRef = useRef<Group>(null)
  const { camera, size } = useThree()
  const len = track * SCALE
  const slots = useStreet(len)
  const night = useMemo(() => nightAmount(dayPhase()), [])
  // The venue's weather for this race (see raceWeather).
  const weather = useMemo(() => raceWeather(venue.id, weatherSeed), [venue.id, weatherSeed])
  const beams = night > 0.3 || gloomOf(weather) > 0.5
  // Same lights and colour grade as the town at this time of day.
  const look = useMemo(() => weatherLook(lookFor(night, duskAmount(dayPhase())), weather), [night, weather])
  // The race fills the screen, so stop drawing the town underneath while racing.
  useEffect(() => holdTown(), [])
  const asphalt = useMemo(() => {
    const t = asphaltTex().clone()
    t.repeat.set(1.6, (len + 40) / 2)
    t.needsUpdate = true
    return t
  }, [len])
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
  useEffect(() => {
    const cam = camera as PerspectiveCamera
    const aspect = size.width / size.height
    cam.fov = aspect < 1 ? Math.min(72, 55 / Math.max(aspect, 0.45) ** 0.35) : 55
    cam.updateProjectionMatrix()
  }, [camera, size])

  useFrame(({ scene }) => {
    scene.environmentIntensity = look.env
    const mz = (me.current?.dist ?? 0) * SCALE
    const tz = (them.current?.dist ?? 0) * SCALE
    meRef.current?.position.set(LANE, 0, mz)
    themRef.current?.position.set(-LANE, 0, tz)
    const lead = Math.max(mz, tz)
    const target = Math.min(mz, len)
    // Tall phone screens get a higher, further-back chase view.
    const tall = size.height > size.width
    camera.position.lerp({ x: tall ? 0 : LANE * 0.5, y: tall ? 2.7 : 2.2, z: target - (tall ? 5.2 : 4.2) } as never, 0.15)
    camera.lookAt(tall ? 0 : LANE * 0.3, 0.3, Math.min(target + 3 + (lead - target) * 0.3, len + 4))
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
      <RaceWeather w={weather} look={look} />
      {/* Ground, sidewalks and the street itself. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.outer, len / 2]}>
        <planeGeometry args={[80, len + 100]} />
        {venue.id === 'desert' ? (
          <meshStandardMaterial map={sandTex(10, (len + 100) / 8)} />
        ) : venue.id === 'beach' ? (
          <meshStandardMaterial map={beachSandTex(10, (len + 100) / 8)} />
        ) : venue.id === 'snow' ? (
          <meshStandardMaterial map={snowTex(10, (len + 100) / 8)} />
        ) : venue.id === 'docks' ? (
          <meshStandardMaterial map={concreteTex(16, (len + 100) / 5)} />
        ) : venue.id === 'farm' ? (
          <meshStandardMaterial map={grassTex(10, (len + 100) / 8)} />
        ) : (
          <meshStandardMaterial color={venue.ground ?? PAL.ground} />
        )}
      </mesh>
      {/* The street is static, so it's merged into a few draws like the town. */}
      <Batch version={city ? slots : venue.id}>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * (ROAD + WALK / 2), 0.04, len / 2 + 5]}>
            <boxGeometry args={[WALK, 0.08, len + 50]} />
            {venue.shoulder ? <meshStandardMaterial color={venue.shoulder} /> : <meshStandardMaterial map={paverTex(0.5, (len + 50) / 2)} />}
          </mesh>
        ))}
        <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, len / 2 + 5]}>
          <planeGeometry args={[ROAD * 2, len + 50]} />
          <primitive object={road} attach="material" dispose={null} />
        </mesh>
        {/* Centre line dashes and edge lines. */}
        {Array.from({ length: Math.ceil((len + 30) / 2) }, (_, i) => (
          <mesh key={i} rotation-x={-Math.PI / 2} position={[0, LAYER.grid, i * 2 - 8]}>
            <planeGeometry args={[0.06, 1]} />
            <meshBasicMaterial color="#fafafa" {...decal()} />
          </mesh>
        ))}
        {[-1, 1].map((sd) => (
          <mesh key={sd} rotation-x={-Math.PI / 2} position={[sd * (ROAD - 0.08), LAYER.grid, len / 2 + 5]}>
            <planeGeometry args={[0.07, len + 50]} />
            <meshBasicMaterial color="#ffd54f" {...decal()} />
          </mesh>
        ))}
        {/* Start grid line and chequered finish. */}
        <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.lot, -0.6]}>
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
              {i % 2 === 0 && <Lamp z={d.w + 0.7} side={sl.side} />}
            </group>
          )
        }) : (
          <>
            <VenueScenery id={venue.id} len={len} />
            {Array.from({ length: Math.ceil((len + 40) / 9) }, (_, i) => <Lamp key={i} z={i * 9 - 6} side={i % 2 ? 1 : -1} pole={venue.pole} />)}
          </>
        )}
        <StreetDressing len={len} city={city} />
      </Batch>
      <Spectators len={len} cold={venue.id === 'snow' || SEASON === 'winter'} />
      {city ? <Skyline len={len} edge={ROAD + WALK + 4.2} night={night} /> : <VenueBackdrop id={venue.id} len={len} />}
      {/* Soft shadows under the racers. */}
      {[meRef, themRef].map((r, i) => (
        <group key={i} ref={r} scale={1.4}>
          <mesh rotation-x={-Math.PI / 2} position-y={LAYER.paint}>
            <planeGeometry args={[0.9, 1.5]} />
            <meshBasicMaterial map={glowTex()} color="#000000" transparent opacity={0.35} depthWrite={false} {...decal(3)} />
          </mesh>
          {i === 0 ? <CarModel body={mine.body} model={mine.model} color={mine.color} finish={mine.finish} mods={mine.mods} flames beams={beams} /> : <CarModel body={theirs.body} model={theirs.model} color={theirs.color} mods={theirs.mods} flames beams={beams} />}
        </group>
      ))}
    </>
  )
}
