import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, Color, Object3D, type PerspectiveCamera, type Group, type InstancedMesh, type Mesh } from 'three'
import type { Body } from '../game/data'
import { CarModel } from './CarModel'
import { signTexture } from './signTexture'
import { skyTex, asphaltTex, paverTex, glowTex } from './textures'
import { BuildingModel, LightPool } from './BuildingModel'
import { glowMats, dayPhase, duskAmount, nightAmount } from './dayNight'
import { lookFor } from './look'
import { PostFx } from './PostFx'
import { SkyEnv } from './SkyEnv'
import { holdTown } from './renderGate'
import { PAL } from './season'
import { LAYER, decal } from './layers'
import { holdPageTint } from './pageTint'
import { useGame } from '../game/store'
import { Skyline } from './Skyline'
import { Batch } from './Batch'
import { Manhole } from './BuildingDetail'
import { BUILDINGS, TILE, buildingDef } from '../game/data'

export type RacerView = { dist: number }
const SCALE = 0.25 // metres of race distance per world unit
const LANE = 0.75

type Props = {
  track: number
  me: RefObject<RacerView>
  them: RefObject<RacerView>
  mine: { body: Body; color: string }
  theirs: { body: Body; color: string }
}

function SkyDome({ tint = '#ffffff' }: { tint?: string }) {
  const ref = useRef<Mesh>(null)
  useFrame(({ camera }) => ref.current?.position.set(camera.position.x, 0, camera.position.z))
  return (
    <mesh ref={ref} raycast={() => null}>
      <sphereGeometry args={[90, 24, 8, 0, Math.PI * 2, 0.9, Math.PI / 2 - 0.75]} />
      <meshBasicMaterial map={skyTex(4)} color={tint} side={BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}

const ROAD = 1.6 // half width of the street
const WALK = 1.0 // sidewalk width
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

function Spectators({ len }: { len: number }) {
  const ref = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const spots = useMemo(() => {
    const out: { x: number; z: number; phase: number }[] = []
    for (let i = 0; i < 90; i++) {
      const side = i % 2 ? 1 : -1
      // Crowds bunch up at the start and the finish.
      const z = i < 60 ? -3 + (i / 60) * 18 : len - 8 + ((i - 60) / 30) * 12
      out.push({ x: side * (ROAD + 0.3 + ((i * 37) % 7) / 10), z: z + ((i * 13) % 5) / 5, phase: i * 1.7 })
    }
    return out
  }, [len])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const c = new Color()
    const colors = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#ff7043', '#fafafa', '#26c6da']
    spots.forEach((_, i) => m.setColorAt(i, c.set(colors[i % colors.length])))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [spots])
  const tmp = useMemo(() => new Object3D(), [])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    spots.forEach((p, i) => {
      // Cheering: little hops.
      tmp.position.set(p.x, 0.32 + Math.max(0, Math.sin(t * 6 + p.phase)) * 0.12, p.z)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
      tmp.position.y += 0.3
      tmp.updateMatrix()
      heads.current?.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <capsuleGeometry args={[0.11, 0.3, 3, 6]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color="#f1c27d" />
      </instancedMesh>
    </>
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

function Lamp({ z, side }: { z: number; side: 1 | -1 }) {
  return (
    <group position={[side * (ROAD + 0.15), 0, z]} rotation-y={side > 0 ? -Math.PI / 2 : Math.PI / 2}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 1.8, 6]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      <mesh position={[0, 1.78, 0.25]}>
        <boxGeometry args={[0.05, 0.04, 0.5]} />
        <meshStandardMaterial color="#37474f" />
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
function StreetDressing({ len }: { len: number }) {
  const barriers: number[] = []
  for (let z = -4; z < 14; z += 1) barriers.push(z)
  for (let z = len - 9; z < len + 5; z += 1) barriers.push(z)
  const bunting: number[] = []
  for (let z = 12; z < len - 4; z += 22) bunting.push(z)
  const flags = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fafafa']
  const furniture: number[] = []
  for (let z = 2; z < len + 20; z += 7) furniture.push(z)
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

// Main street drag race, lined with the player's own town, seen from a chase camera.
export function RaceScene({ track, me, them, mine, theirs }: Props) {
  const meRef = useRef<Group>(null)
  const themRef = useRef<Group>(null)
  const { camera, size } = useThree()
  const len = track * SCALE
  const slots = useStreet(len)
  const night = useMemo(() => nightAmount(dayPhase()), [])
  // Same lights and colour grade as the town at this time of day.
  const look = useMemo(() => lookFor(night, duskAmount(dayPhase())), [night])
  // The race fills the screen, so stop drawing the town underneath while racing.
  useEffect(() => holdTown(), [])
  const asphalt = useMemo(() => {
    const t = asphaltTex().clone()
    t.repeat.set(1.6, (len + 40) / 2)
    t.needsUpdate = true
    return t
  }, [len])
  const tint = (day: string, dark: string) => '#' + new Color(day).lerp(new Color(dark), night).getHexString()
  // Phone status bar and toolbar take the sky colour while racing.
  const sky = tint('#3d9bff', '#0f1730')
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
      <fog attach="fog" args={[tint('#d9f2ff', '#1d2740'), 28, 105]} />
      <color attach="background" args={[tint('#3d9bff', '#0f1730')]} />
      <SkyDome tint={tint('#ffffff', '#2a3560')} />
      <hemisphereLight args={[look.sky, look.ground, look.hemiIntensity * 1.15]} />
      <directionalLight position={[5, 10, 2]} intensity={look.sunIntensity * 0.85} color={look.sun} />
      <SkyEnv />
      <PostFx look={look} />
      {/* Ground, sidewalks and the street itself. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.outer, len / 2]}>
        <planeGeometry args={[80, len + 100]} />
        <meshStandardMaterial color={PAL.ground} />
      </mesh>
      {/* The street is static, so it's merged into a few draws like the town. */}
      <Batch version={slots}>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * (ROAD + WALK / 2), 0.04, len / 2 + 5]}>
            <boxGeometry args={[WALK, 0.08, len + 50]} />
            <meshStandardMaterial map={paverTex(0.5, (len + 50) / 2)} />
          </mesh>
        ))}
        <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, len / 2 + 5]}>
          <planeGeometry args={[ROAD * 2, len + 50]} />
          <meshStandardMaterial map={asphalt} />
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
        {slots.map((sl, i) => {
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
        })}
        <StreetDressing len={len} />
      </Batch>
      <Spectators len={len} />
      <Skyline len={len} edge={ROAD + WALK + 4.2} night={night} />
      {/* Soft shadows under the racers. */}
      {[meRef, themRef].map((r, i) => (
        <group key={i} ref={r} scale={1.4}>
          <mesh rotation-x={-Math.PI / 2} position-y={LAYER.paint}>
            <planeGeometry args={[0.9, 1.5]} />
            <meshBasicMaterial map={glowTex()} color="#000000" transparent opacity={0.35} depthWrite={false} {...decal(3)} />
          </mesh>
          {i === 0 ? <CarModel body={mine.body} color={mine.color} beams={night > 0.3} /> : <CarModel body={theirs.body} color={theirs.color} beams={night > 0.3} />}
        </group>
      ))}
    </>
  )
}
