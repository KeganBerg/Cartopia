import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Object3D, Vector3, type InstancedMesh, type PerspectiveCamera } from 'three'
import { SHIRTS, PANTS, SKIN, HAIR } from './people'
import { BuildingModel, LightPool } from './BuildingModel'
import { Manhole } from './BuildingDetail'
import { SkyDome } from './RaceScene'
import { SkyEnv } from './SkyEnv'
import { PostFx } from './PostFx'
import { RaceWeather } from './Weather'
import { gloomOf, weatherLook } from './weatherLook'
import { lookFor } from './look'
import { glowMats, dayPhase, duskAmount, nightAmount } from './dayNight'
import { holdPageTint } from './pageTint'
import { asphaltTex, concreteTex, drainTex, glowTex, paverTex, towerTex } from './textures'
import { LAYER, decal } from './layers'
import { useGame } from '../game/store'
import { BUILDINGS, TILE, buildingDef } from '../game/data'
import { weatherNow } from '../game/weather'

// Shared scenery for the arcade mini games, built from the same parts as the
// race venues: the player's own shops, paved sidewalks, lamps that light at
// night, street furniture, and the town's time of day and weather.

// Town pieces are drawn this much bigger than in the town, to suit arcade cars.
export const K = 1.15

const FALLBACK = ['pizza', 'donut', 'burger', 'diner', 'motel', 'carwash', 'tires', 'gas', 'bowling', 'icecream', 'coffee', 'tacos']
const SHOPS = new Set(['business', 'gas', 'parts'])

// The player's own shop types (or a standard high street until they have a few).
export function useTownPool() {
  const buildings = useGame((s) => s.buildings)
  return useMemo(() => {
    const own = [...new Set(buildings.map((b) => b.def))].filter((d) => BUILDINGS.some((b) => b.id === d) && SHOPS.has(buildingDef(d).kind) && buildingDef(d).w <= 2 && buildingDef(d).h <= 1)
    return own.length >= 4 ? own : FALLBACK.filter((d) => BUILDINGS.some((b) => b.id === d))
  }, [buildings])
}

// The light, sky and weather right now in town.
export function useArcadeLook() {
  return useMemo(() => {
    const night = nightAmount(dayPhase())
    const weather = weatherNow()
    const look = weatherLook(lookFor(night, duskAmount(dayPhase())), weather)
    const tint = (day: string, dark: string) => '#' + new Color(day).lerp(new Color(dark), night).getHexString()
    const grey = Math.min(1, weather.cloud * 0.95 + weather.haze * 0.55)
    const sky = '#' + new Color(tint('#3d9bff', '#0f1730')).lerp(new Color(night > 0.5 ? '#1c2438' : '#8a939e'), grey * 0.7).getHexString()
    return { night, weather, look, sky, fog: tint('#d9f2ff', '#1d2740'), dome: tint('#ffffff', '#2a3560'), beams: night > 0.3 || gloomOf(weather) > 0.5 }
  }, [])
}

export function ArcadeSky({ view, near = 28, far = 95, dome = true }: { view: ReturnType<typeof useArcadeLook>; near?: number; far?: number; dome?: boolean }) {
  const { look, weather, sky, fog } = view
  useEffect(() => holdPageTint(sky), [sky])
  return (
    <>
      <fog attach="fog" args={[fog, near, far]} />
      <color attach="background" args={[sky]} />
      {dome && <SkyDome tint={view.dome} />}
      <hemisphereLight args={[look.sky, look.ground, look.hemiIntensity * 1.15]} />
      <directionalLight position={[5, 10, 2]} intensity={look.sunIntensity * 0.85} color={look.sun} />
      <SkyEnv />
      <PostFx look={look} />
      <RaceWeather w={weather} look={look} />
    </>
  )
}

// A soft dark blob under a car.
export function CarShadow({ len = 1.7, wid = 0.9 }: { len?: number; wid?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={LAYER.paint + 0.004} renderOrder={1}>
      <planeGeometry args={[wid * 1.5, len * 1.25]} />
      <meshBasicMaterial map={glowTex()} color="#000000" transparent opacity={0.4} depthWrite={false} {...decal(3)} />
    </mesh>
  )
}

export function Lamp({ x, z, ry = 0, pole = '#37474f' }: { x: number; z: number; ry?: number; pole?: string }) {
  return (
    <group position={[x, 0, z]} rotation-y={ry} scale={K}>
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.1, 0.12, 0.06, 8]} /><meshStandardMaterial color={pole} /></mesh>
      <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.04, 0.06, 1.8, 6]} /><meshStandardMaterial color={pole} /></mesh>
      <mesh position={[0, 1.78, 0.25]}><boxGeometry args={[0.05, 0.04, 0.5]} /><meshStandardMaterial color={pole} /></mesh>
      <mesh position={[0, 1.72, 0.48]}>
        <boxGeometry args={[0.16, 0.07, 0.22]} />
        <primitive object={glowMats.bulb} attach="material" dispose={null} />
      </mesh>
      <LightPool r={1.1} z={0.6} y={0.09} />
    </group>
  )
}

export function Hydrant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]} scale={K}>
      <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.06, 0.07, 0.24, 8]} /><meshStandardMaterial color="#e53935" /></mesh>
      <mesh position={[0, 0.26, 0]}><sphereGeometry args={[0.065, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e53935" /></mesh>
      <mesh position={[0, 0.16, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.025, 0.025, 0.2, 6]} /><meshStandardMaterial color="#c62828" /></mesh>
    </group>
  )
}

export function Bin({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]} scale={K}>
      <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.1, 0.09, 0.32, 10]} /><meshStandardMaterial color="#2e7d32" /></mesh>
      <mesh position={[0, 0.33, 0]}><cylinderGeometry args={[0.11, 0.11, 0.03, 10]} /><meshStandardMaterial color="#1b5e20" /></mesh>
    </group>
  )
}

function Mailbox({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]} scale={K}>
      <mesh position={[0, 0.18, 0]}><boxGeometry args={[0.2, 0.3, 0.16]} /><meshStandardMaterial color="#1e5fbf" /></mesh>
      <mesh position={[0, 0.33, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.08, 0.08, 0.2, 10, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#1e5fbf" /></mesh>
      {[-0.07, 0.07].map((dx) => <mesh key={dx} position={[dx, 0.02, 0]}><boxGeometry args={[0.03, 0.04, 0.12]} /><meshStandardMaterial color="#263238" /></mesh>)}
    </group>
  )
}

function Tree({ x, z, palm }: { x: number; z: number; palm?: boolean }) {
  return (
    <group position={[x, 0, z]} scale={K * 0.9}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012}><circleGeometry args={[0.32, 14]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <BuildingModel def={buildingDef(palm ? 'palm' : 'tree')} />
    </group>
  )
}

function rng(seed: number) {
  let s = seed % 2147483647 || 1
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

// One stretch of high street running along -z from z = 0 to z = -len: a road `half`
// wide each side of x = 0, sidewalks, shops facing the road, trees, lamps, and
// street clutter. It starts with a side street crossing, so stretches can repeat.
// `lanes` are the x positions of the dashed lane dividers.
export function StreetStretch({ len, half, walk = 1.6, lanes, seed, pool }: { len: number; half: number; walk?: number; lanes: number[]; seed: number; pool: string[] }) {
  const items = useMemo(() => {
    const r = rng(seed * 7919 + 13)
    const shops: { x: number; z: number; ry: number; def: string; w: number; d: number }[] = []
    const trees: { x: number; z: number; palm: boolean }[] = []
    const lamps: { x: number; z: number; ry: number }[] = []
    const clutter: { x: number; z: number; kind: number }[] = []
    const cross = 4.2 // side street width
    for (const sd of [-1, 1] as const) {
      let z = -cross - 0.6 - (sd > 0 ? 1.2 : 0)
      let i = Math.floor(r() * pool.length)
      let n = 0
      while (z > -len + 2) {
        const def = buildingDef(pool[i++ % pool.length])
        const w = def.w * TILE * K, d = def.h * TILE * K
        if (z - w < -len + 0.4) break
        shops.push({ x: sd * (half + walk + d / 2 + 0.15), z: z - w / 2, ry: sd < 0 ? Math.PI / 2 : -Math.PI / 2, def: def.id, w, d })
        z -= w
        // A tree and sometimes a lamp in the gap.
        trees.push({ x: sd * (half + walk - 0.45), z: z - 0.8, palm: r() < 0.25 })
        if (n++ % 2 === 0) lamps.push({ x: sd * (half + 0.25), z: z - 0.8, ry: sd > 0 ? -Math.PI / 2 : Math.PI / 2 })
        if (r() < 0.8) clutter.push({ x: sd * (half + walk * 0.55), z: z + w * (0.3 + r() * 0.4), kind: Math.floor(r() * 3) })
        z -= 1.6
      }
    }
    // Taller blocks behind the shops so the skyline is never empty.
    const towers: { x: number; z: number; w: number; d: number; h: number; c: string }[] = []
    const tints = ['#b0bec5', '#cfd8dc', '#90a4ae', '#d7ccc8', '#bcaaa4', '#9fa8da', '#a5d6a7']
    for (const sd of [-1, 1] as const) {
      for (let z = -cross - 1; z > -len + 3; ) {
        const w = 3 + r() * 3
        towers.push({ x: sd * (half + walk + 6.5 + r() * 3), z: z - w / 2, w, d: 3 + r() * 2, h: 4 + r() * 7, c: tints[Math.floor(r() * tints.length)] })
        z -= w + 0.6 + r() * 1.5
      }
    }
    return { shops, trees, lamps, clutter, cross, towers }
  }, [len, half, walk, seed, pool])
  const asphalt = useMemo(() => {
    const t = asphaltTex().clone()
    t.repeat.set((half * 2) / 2.5, len / 2.5)
    t.needsUpdate = true
    return t
  }, [half, len])
  const pave = useMemo(() => paverTex(walk / 0.8, len / 0.8), [walk, len])
  const { cross } = items
  return (
    <group>
      {/* Road and sidewalks. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, -len / 2]}>
        <planeGeometry args={[half * 2, len]} />
        <meshStandardMaterial map={asphalt} />
      </mesh>
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh position={[sd * (half + walk / 2), 0.06, -len / 2 - cross / 2]}>
            <boxGeometry args={[walk, 0.12, len - cross]} />
            <meshStandardMaterial map={pave} />
          </mesh>
          <mesh position={[sd * (half + 0.04), 0.065, -len / 2 - cross / 2]}>
            <boxGeometry args={[0.08, 0.13, len - cross]} />
            <meshStandardMaterial color="#cfd2d6" />
          </mesh>
          {/* The side street running off at the crossing. */}
          <mesh rotation-x={-Math.PI / 2} position={[sd * (half + 6), LAYER.land, -cross / 2]}>
            <planeGeometry args={[12, cross]} />
            <meshStandardMaterial map={asphalt} />
          </mesh>
          {/* Grass behind the shops. */}
          <mesh rotation-x={-Math.PI / 2} position={[sd * (half + walk + 16), LAYER.outer + 0.02, -len / 2 - cross / 2]}>
            <planeGeometry args={[32, len - cross]} />
            <meshStandardMaterial color="#6fae4f" />
          </mesh>
          {/* Edge lines, broken at the crossing. */}
          <mesh rotation-x={-Math.PI / 2} position={[sd * (half - 0.18), LAYER.paint, -len / 2 - cross / 2]}>
            <planeGeometry args={[0.1, len - cross]} />
            <meshBasicMaterial color="#ffd54f" {...decal()} />
          </mesh>
        </group>
      ))}
      {/* Zebra crossing and stop lines. */}
      {Array.from({ length: Math.floor((half * 2 - 0.4) / 0.6) }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-half + 0.5 + i * 0.6, LAYER.paint, -cross / 2]}>
          <planeGeometry args={[0.32, cross - 1.4]} />
          <meshBasicMaterial color="#f5f5f5" {...decal()} />
        </mesh>
      ))}
      {/* Lane dashes. */}
      {lanes.map((x) => Array.from({ length: Math.floor((len - cross) / 3) }, (_, i) => (
        <mesh key={`${x}:${i}`} rotation-x={-Math.PI / 2} position={[x, LAYER.paint, -cross - 1 - i * 3]}>
          <planeGeometry args={[0.12, 1.5]} />
          <meshBasicMaterial color="#fafafa" {...decal()} />
        </mesh>
      )))}
      {/* Manholes and drains on the road. */}
      {[0.3, 0.7].map((t, i) => <group key={i} scale={K}><Manhole x={(lanes[i % lanes.length] + (i ? 0.85 : -0.85)) / K} z={(-len * t) / K} /></group>)}
      {[-1, 1].map((sd) => (
        <mesh key={sd} rotation-x={-Math.PI / 2} position={[sd * (half - 0.35), LAYER.paint + 0.002, -len * 0.55]}>
          <planeGeometry args={[0.36, 0.6]} />
          <meshStandardMaterial map={drainTex()} {...decal(2)} />
        </mesh>
      ))}
      {items.shops.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation-y={s.ry}>
          <mesh rotation-x={-Math.PI / 2} position-y={LAYER.lot}>
            <planeGeometry args={[s.w, s.d]} />
            <meshStandardMaterial map={paverTex(s.w / 2, s.d / 2)} />
          </mesh>
          <group scale={K}>
            <BuildingModel def={buildingDef(s.def)} />
          </group>
        </group>
      ))}
      {items.towers.map((t, i) => (
        <mesh key={i} position={[t.x, t.h / 2, t.z]}>
          <boxGeometry args={[t.d, t.h, t.w]} />
          <meshStandardMaterial map={towerTex()} color={t.c} />
        </mesh>
      ))}
      {items.trees.map((t, i) => <Tree key={i} x={t.x} z={t.z} palm={t.palm} />)}
      {items.lamps.map((l, i) => <Lamp key={i} x={l.x} z={l.z} ry={l.ry} />)}
      {items.clutter.map((c, i) => (c.kind === 0 ? <Hydrant key={i} x={c.x} z={c.z} /> : c.kind === 1 ? <Bin key={i} x={c.x} z={c.z} /> : <Mailbox key={i} x={c.x} z={c.z} />))}
      {/* A bus stop and a bench on every stretch. */}
      <group position={[-(half + walk * 0.5), 0.12, -len * 0.45]} rotation-y={Math.PI / 2} scale={K * 0.8}>
        <BuildingModel def={buildingDef('busstop')} />
      </group>
      <group position={[half + walk * 0.5, 0.12, -len * 0.62]} rotation-y={-Math.PI / 2} scale={K * 0.8}>
        <BuildingModel def={buildingDef('bench')} />
      </group>
    </group>
  )
}

// People, built like the race crowd (body, head, hair, legs, arms) and instanced.
// Each stands at x/z facing h; cheering ones hop with their arms up, the rest wave now and then.
// `shirt` forces one colour (a pit crew in team kit).
export type Person = { x: number; z: number; h: number; y?: number; cheer?: boolean; shirt?: string }
const FAN = 1.3
const FAN_LEG = 0.24
export function Crowd({ people, scale = 1 }: { people: Person[]; scale?: number }) {
  const torso = useRef<InstancedMesh>(null)
  const head = useRef<InstancedMesh>(null)
  const hair = useRef<InstancedMesh>(null)
  const legs = useRef<InstancedMesh>(null)
  const arms = useRef<InstancedMesh>(null)
  useEffect(() => {
    const c = new Color()
    people.forEach((p, i) => {
      const k = (i * 2654435761) >>> 0
      const shirt = p.shirt ?? SHIRTS[k % SHIRTS.length]
      torso.current?.setColorAt(i, c.set(shirt))
      head.current?.setColorAt(i, c.set(SKIN[(k >> 6) % SKIN.length]))
      hair.current?.setColorAt(i, c.set(HAIR[(k >> 9) % HAIR.length]))
      legs.current?.setColorAt(i * 2, c.set(p.shirt ? '#263238' : PANTS[(k >> 3) % PANTS.length]))
      legs.current?.setColorAt(i * 2 + 1, c)
      arms.current?.setColorAt(i * 2, c.set(shirt))
      arms.current?.setColorAt(i * 2 + 1, c)
    })
    for (const m of [torso, head, hair, legs, arms]) if (m.current?.instanceColor) m.current.instanceColor.needsUpdate = true
  }, [people])
  const tmp = useMemo(() => new Object3D(), [])
  const S = FAN * scale
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    people.forEach((f, i) => {
      const phase = i * 1.7
      const hop = f.cheer ? Math.max(0, Math.sin(t * 6 + phase)) * 0.09 : 0
      const hip = FAN_LEG + hop + (f.y ?? 0) / S
      const sin = Math.sin(f.h), cos = Math.cos(f.h)
      const x = f.x / S, z = f.z / S
      const put = (m: InstancedMesh | null, at: number, px: number, py: number, pz: number, rz = 0, rx = 0, sy = 1) => {
        if (!m) return
        tmp.position.set(px, py, pz)
        tmp.rotation.set(rx, f.h, rz)
        tmp.scale.set(1, sy, 1)
        tmp.updateMatrix()
        m.setMatrixAt(at, tmp.matrix)
      }
      put(torso.current, i, x, hip + 0.15, z)
      put(head.current, i, x, hip + 0.36, z)
      put(hair.current, i, x - sin * 0.02, hip + 0.385, z - cos * 0.02, 0, 0, 0.8)
      for (const side of [-1, 1]) {
        const lx = side * 0.045
        put(legs.current, i * 2 + (side > 0 ? 1 : 0), x + cos * lx, hip - FAN_LEG * 0.5, z - sin * lx, 0, hop * side * 2)
      }
      const wave = Math.sin(t * (f.cheer ? 6 : 2) + phase)
      for (const side of [-1, 1]) {
        const a = f.cheer ? 2.5 + wave * 0.35 * side : 0.15 + (side > 0 ? Math.max(0, wave) * 2.2 : 0)
        const lx = side * (0.11 + Math.sin(a) * 0.085)
        put(arms.current, i * 2 + (side > 0 ? 1 : 0), x + cos * lx, hip + 0.25 - Math.cos(a) * 0.085, z - sin * lx, side * a)
      }
    })
    for (const m of [torso, head, hair, legs, arms]) if (m.current) m.current.instanceMatrix.needsUpdate = true
  })
  const n = people.length
  return (
    <group scale={S}>
      <instancedMesh ref={torso} args={[undefined, undefined, n]} frustumCulled={false}><capsuleGeometry args={[0.085, 0.16, 3, 8]} /><meshStandardMaterial /></instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, n]} frustumCulled={false}><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial /></instancedMesh>
      <instancedMesh ref={hair} args={[undefined, undefined, n]} frustumCulled={false}><sphereGeometry args={[0.085, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial /></instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, n * 2]} frustumCulled={false}><boxGeometry args={[0.06, FAN_LEG, 0.07]} /><meshStandardMaterial /></instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, n * 2]} frustumCulled={false}><boxGeometry args={[0.045, 0.17, 0.05]} /><meshStandardMaterial /></instancedMesh>
    </group>
  )
}

// Rows of stepped seating with fans, facing h (0 = facing +z), centred at x/z.
export function Grandstand({ x, z, h, width, rows = 4, roof = '#c62828' }: { x: number; z: number; h: number; width: number; rows?: number; roof?: string }) {
  const people = useMemo(() => {
    const out: Person[] = []
    for (let r = 0; r < rows; r++) for (let i = 0; i < Math.floor(width / 0.55); i++) {
      if ((i * 7 + r * 3) % 5 === 0) continue
      const lx = -width / 2 + 0.3 + i * 0.55 + (r % 2) * 0.2
      const lz = -r * 0.7
      out.push({ x: x + lx * Math.cos(h) + lz * Math.sin(h), z: z - lx * Math.sin(h) + lz * Math.cos(h), h, y: 0.35 + r * 0.4, cheer: (i + r) % 3 !== 0 })
    }
    return out
  }, [x, z, h, width, rows])
  return (
    <>
      <group position={[x, 0, z]} rotation-y={h}>
        {Array.from({ length: rows }, (_, r) => (
          <mesh key={r} position={[0, 0.17 + r * 0.2, -r * 0.7]}>
            <boxGeometry args={[width, 0.35 + r * 0.4, 0.7]} />
            <meshStandardMaterial map={concreteTex(width / 2, 0.5)} color={r % 2 ? '#cfd8dc' : '#b0bec5'} />
          </mesh>
        ))}
        {/* A cantilever roof over the back rows. */}
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * (width / 2 - 0.1), 1.6 + rows * 0.2, -rows * 0.7 + 0.3]}>
            <boxGeometry args={[0.12, 3.2 + rows * 0.4, 0.12]} />
            <meshStandardMaterial color="#455a64" />
          </mesh>
        ))}
        <mesh position={[0, 3.2 + rows * 0.4, -rows * 0.35]} rotation-x={0.12}>
          <boxGeometry args={[width + 0.4, 0.1, rows * 0.7 + 0.6]} />
          <meshStandardMaterial color={roof} />
        </mesh>
      </group>
      <Crowd people={people} />
    </>
  )
}

// Points the camera at `target` from direction `dir`, backed off just far enough that a
// box halfW wide and halfH tall around the target fits, on a phone or a wide screen.
export function useFitCamera(dir: [number, number, number], target: [number, number, number], halfW: number, halfH: number) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  useLayoutEffect(() => {
    const t = Math.tan(((camera.fov / 2) * Math.PI) / 180)
    const dist = Math.max(halfH / t, halfW / (t * (size.width / size.height)))
    const at = new Vector3(...target)
    camera.up.set(0, 1, 0)
    camera.position.copy(at).add(new Vector3(...dir).normalize().multiplyScalar(dist))
    camera.lookAt(at)
    camera.updateProjectionMatrix()
  }, [camera, size, dir[0], dir[1], dir[2], target[0], target[1], target[2], halfW, halfH]) // eslint-disable-line react-hooks/exhaustive-deps
}

// A racing tyre: black rubber with a coloured compound band, standing up (or lying flat).
export function Tyre({ x, z, y = 0, r = 0.3, w = 0.24, flat, band = '#e53935', ry = 0 }: { x: number; z: number; y?: number; r?: number; w?: number; flat?: boolean; band?: string; ry?: number }) {
  return (
    <group position={[x, y + (flat ? w / 2 : r), z]} rotation={flat ? [0, ry, 0] : [0, ry, Math.PI / 2]}>
      <mesh><cylinderGeometry args={[r, r, w, 18]} /><meshStandardMaterial color="#1c1c1c" roughness={0.9} /></mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position-y={(sd * w) / 2 + sd * 0.002} rotation-x={(sd * Math.PI) / 2}><ringGeometry args={[r * 0.72, r * 0.8, 18]} /><meshBasicMaterial color={band} side={2} /></mesh>
      ))}
      <mesh><cylinderGeometry args={[r * 0.55, r * 0.55, w + 0.01, 12]} /><meshStandardMaterial color="#9e9e9e" metalness={0.6} roughness={0.35} /></mesh>
    </group>
  )
}

// A stack of spare tyres.
export function TyreStack({ x, z, n = 4, band }: { x: number; z: number; n?: number; band?: string }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => <Tyre key={i} x={x} z={z} y={i * 0.235} w={0.22} flat band={band} ry={i * 0.7} />)}
    </>
  )
}

// A rolling red tool chest.
export function ToolChest({ x, z, ry = 0, color = '#c62828' }: { x: number; z: number; ry?: number; color?: string }) {
  return (
    <group position={[x, 0, z]} rotation-y={ry}>
      <mesh position-y={0.5}><boxGeometry args={[0.9, 0.85, 0.45]} /><meshStandardMaterial color={color} metalness={0.3} roughness={0.4} /></mesh>
      {[0.25, 0.42, 0.59, 0.76].map((y) => <mesh key={y} position={[0, y, 0.228]}><boxGeometry args={[0.8, 0.02, 0.01]} /><meshStandardMaterial color="#cfd8dc" metalness={0.8} roughness={0.3} /></mesh>)}
      {[-0.38, 0.38].map((dx) => [-0.17, 0.17].map((dz) => <mesh key={`${dx}${dz}`} position={[dx, 0.04, dz]}><sphereGeometry args={[0.04, 6, 4]} /><meshStandardMaterial color="#212121" /></mesh>))}
    </group>
  )
}
