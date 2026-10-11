import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, type Group, type Points } from 'three'
import { BuildingModel } from './BuildingModel'
import { Batch } from './Batch'
import { PAL } from './season'
import { buildingDef } from '../game/data'
import type { VenueId } from './venues'

// Scenery for the out-of-town race venues. Everything here is static and sits
// inside <Batch>, so each colour costs one draw however many pieces use it.
// Keep the palette per venue small for that reason.

export const ROAD = 1.6 // half width of the street
export const WALK = 1.0 // shoulder / sidewalk width
const EDGE = ROAD + WALK

// Deterministic so a venue looks the same every race.
export function rand(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

type V3 = [number, number, number]

export function Box({ p, s, c, ry = 0 }: { p: V3; s: V3; c: string; ry?: number }) {
  return (
    <mesh position={p} scale={s} rotation-y={ry}>
      <boxGeometry />
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  )
}

export function Cyl({ p, r, h, c, seg = 8, rot }: { p: V3; r: number; h: number; c: string; seg?: number; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot}>
      <cylinderGeometry args={[r, r, h, seg]} />
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  )
}

export function Cone({ p, r, h, c, seg = 8, ry = 0 }: { p: V3; r: number; h: number; c: string; seg?: number; ry?: number }) {
  return (
    <mesh position={p} rotation-y={ry}>
      <coneGeometry args={[r, h, seg]} />
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  )
}

export function Flat({ x, z, w, d, c, y = 0.015 }: { x: number; z: number; w: number; d: number; c: string; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={c} roughness={0.35} />
    </mesh>
  )
}

// Far-off scenery that rides along with the camera, like the town's downtown:
// too distant to show parallax, so the horizon is never empty.
function Horizon({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  useFrame(({ camera }) => ref.current?.position.set(0, 0, camera.position.z))
  return (
    <group ref={ref}>
      <Batch version={1}>{children}</Batch>
    </group>
  )
}

// Steps along the strip on both sides, handing out positions to dress.
function along(len: number, step: (r: () => number) => number, seed: number, from = -14, to = len + 45) {
  const r = rand(seed)
  const out: { z: number; side: -1 | 1; r: () => number }[] = []
  for (const side of [-1, 1] as const) for (let z = from + (side > 0 ? 1.3 : 0); z < to; z += step(r)) out.push({ z, side, r })
  return out
}

function Palm({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <BuildingModel def={buildingDef('palm')} />
    </group>
  )
}

// Ocean on the left, a boardwalk with beach huts and palms on the right.
function Beach({ len }: { len: number }) {
  const shore = -(EDGE + 5.5)
  const items = useMemo(() => {
    const r = rand(5)
    const umbrellas = []
    for (let z = -10; z < len + 40; z += 2.6 + r() * 2.5) umbrellas.push({ z, x: -(EDGE + 0.9 + r() * 3.4), c: Math.floor(r() * 4) })
    const huts = []
    for (let z = -12; z < len + 40; z += 3.2 + r() * 1.4) huts.push({ z, c: Math.floor(r() * 4), w: 1.8 + r() * 0.6 })
    const boats = Array.from({ length: 7 }, (_, i) => ({ x: shore - 10 - r() * 26, z: i * 22 - 5 + r() * 8 }))
    return { umbrellas, huts, boats }
  }, [len])
  const canopy = ['#e53935', '#fdd835', '#1e88e5', '#ff7043']
  const hut = ['#80deea', '#f8bbd0', '#fff59d', '#a5d6a7']
  return (
    <group>
      <Flat x={shore - 45} z={len / 2} w={90} d={len + 220} c="#2f8fd6" />
      {Array.from({ length: Math.ceil((len + 60) / 6) }, (_, i) => (
        <Flat key={i} x={shore + 0.15 + Math.sin(i * 1.7) * 0.25} z={i * 6 - 12} w={0.35} d={6.2} c="#eaf7ff" y={0.02} />
      ))}
      {items.umbrellas.map((u, i) => (
        <group key={i}>
          <Cyl p={[u.x, 0.55, u.z]} r={0.03} h={1.1} c="#eeeeee" seg={5} />
          <Cone p={[u.x, 1.15, u.z]} r={0.62} h={0.32} c={canopy[u.c]} seg={8} />
          <Box p={[u.x + 0.5, 0.03, u.z + 0.2]} s={[0.5, 0.02, 0.9]} c={canopy[(u.c + 1) % 4]} />
        </group>
      ))}
      {[0.25, 0.6, 0.9].map((k) => {
        const z = len * k
        const x = -(EDGE + 3.2)
        return (
          <group key={k}>
            {[-0.35, 0.35].map((dx) => [-0.35, 0.35].map((dz) => <Box key={`${dx}${dz}`} p={[x + dx, 0.6, z + dz]} s={[0.07, 1.2, 0.07]} c="#eeeeee" />))}
            <Box p={[x, 1.45, z]} s={[1.0, 0.6, 1.0]} c="#e53935" />
            <Box p={[x, 1.8, z]} s={[1.2, 0.08, 1.2]} c="#eeeeee" />
          </group>
        )
      })}
      {items.huts.map((h, i) => (
        <group key={i}>
          <Box p={[EDGE + 2.2, 0.55, h.z]} s={[1.6, 1.1, h.w]} c={hut[h.c]} />
          <Box p={[EDGE + 1.4, 0.45, h.z]} s={[0.04, 0.6, h.w * 0.5]} c="#6d4c41" />
          <Cone p={[EDGE + 2.2, 1.35, h.z]} r={Math.max(1.2, h.w) * 0.75} h={0.5} c="#eeeeee" seg={4} ry={Math.PI / 4} />
        </group>
      ))}
      {Array.from({ length: Math.ceil((len + 50) / 5) }, (_, i) => <Palm key={i} x={EDGE + 0.6} z={i * 5 - 9} />)}
      {items.boats.map((b, i) => (
        <group key={i}>
          <Box p={[b.x, 0.15, b.z]} s={[0.9, 0.3, 2.4]} c="#eeeeee" />
          <Cone p={[b.x, 1.3, b.z + 0.2]} r={0.7} h={2} c="#eeeeee" seg={3} />
        </group>
      ))}
    </group>
  )
}

// Flat-topped red mesas, cacti and boulders, with a far ridge on the horizon.
function Desert({ len }: { len: number }) {
  const mesas = useMemo(() => along(len, (r) => 6 + r() * 8, 3, -20, len + 80).map(({ z, side, r }) => ({ z, x: side * (EDGE + 7 + r() * 16), w: 4 + r() * 6, d: 4 + r() * 6, h: 2.5 + r() * 7 })), [len])
  const cacti = useMemo(() => along(len, (r) => 2 + r() * 3, 9).map(({ z, side, r }) => ({ z, x: side * (EDGE + 0.9 + r() * 5), h: 0.9 + r() * 0.9, arm: r() })), [len])
  const rocks = useMemo(() => along(len, (r) => 3 + r() * 4, 13).map(({ z, side, r }) => ({ z, x: side * (EDGE + 0.6 + r() * 6), s: 0.15 + r() * 0.4 })), [len])
  return (
    <group>
      {mesas.map((m, i) => (
        <group key={i}>
          <Box p={[m.x, m.h / 2, m.z]} s={[m.w, m.h, m.d]} c="#b85a32" />
          <Box p={[m.x, m.h + 0.3, m.z]} s={[m.w * 0.82, 0.6, m.d * 0.82]} c="#d07a46" />
        </group>
      ))}
      {cacti.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          <Cyl p={[0, c.h / 2, 0]} r={0.09} h={c.h} c="#4f8a3a" seg={7} />
          {c.arm > 0.35 && (
            <>
              <Cyl p={[0.16, c.h * 0.5, 0]} r={0.05} h={0.2} c="#4f8a3a" seg={6} rot={[0, 0, Math.PI / 2]} />
              <Cyl p={[0.25, c.h * 0.62, 0]} r={0.055} h={0.32} c="#4f8a3a" seg={6} />
            </>
          )}
          {c.arm > 0.6 && (
            <>
              <Cyl p={[-0.15, c.h * 0.62, 0]} r={0.05} h={0.18} c="#4f8a3a" seg={6} rot={[0, 0, Math.PI / 2]} />
              <Cyl p={[-0.23, c.h * 0.72, 0]} r={0.05} h={0.26} c="#4f8a3a" seg={6} />
            </>
          )}
        </group>
      ))}
      {rocks.map((k, i) => (
        <mesh key={i} position={[k.x, k.s * 0.5, k.z]} scale={[k.s * 1.4, k.s, k.s * 1.2]}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#a65a35" flatShading />
        </mesh>
      ))}
    </group>
  )
}

function Snowfall() {
  const ref = useRef<Points>(null)
  const N = 500
  const geo = useMemo(() => {
    const g = new BufferGeometry()
    const r = rand(29)
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) pos.set([(r() - 0.5) * 24, r() * 9, r() * 26 - 4], i * 3)
    g.setAttribute('position', new BufferAttribute(pos, 3))
    return g
  }, [])
  useFrame(({ camera }, dt) => {
    const p = ref.current
    if (!p) return
    p.position.set(camera.position.x, 0, camera.position.z)
    const a = geo.getAttribute('position') as BufferAttribute
    for (let i = 0; i < N; i++) {
      let y = a.getY(i) - dt * (0.9 + (i % 5) * 0.12)
      if (y < 0) y += 9
      a.setY(i, y)
      a.setX(i, a.getX(i) + Math.sin(y * 2 + i) * dt * 0.15)
    }
    a.needsUpdate = true
  })
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#ffffff" size={0.07} transparent opacity={0.85} depthWrite={false} />
    </points>
  )
}

// Snowbanks, a pine forest, log cabins, mountains behind, and falling snow.
function Snow({ len }: { len: number }) {
  const pines = useMemo(() => along(len, (r) => 1.1 + r() * 1.6, 7).map(({ z, side, r }) => ({ z, x: side * (EDGE + 0.9 + r() ** 1.6 * 16), s: 0.8 + r() * 0.7 })), [len])
  const cabins = useMemo(() => [0.2, 0.55, 0.85].map((k, i) => ({ z: len * k, side: (i % 2 ? 1 : -1) as -1 | 1 })), [len])
  return (
    <group>
      {[-1, 1].map((sd) => (
        <Box key={sd} p={[sd * (ROAD + 0.35), 0.1, len / 2 + 5]} s={[0.5, 0.2, len + 60]} c="#ffffff" />
      ))}
      {pines.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <Cyl p={[0, 0.2, 0]} r={0.07} h={0.4} c="#5d4037" seg={5} />
          <Cone p={[0, 0.65, 0]} r={0.5} h={0.8} c="#1f5f3a" seg={7} />
          <Cone p={[0, 1.1, 0]} r={0.38} h={0.7} c="#1f5f3a" seg={7} />
          <Cone p={[0, 1.5, 0]} r={0.22} h={0.5} c="#ffffff" seg={7} />
        </group>
      ))}
      {cabins.map((c, i) => {
        const x = c.side * (EDGE + 3.2)
        return (
          <group key={i}>
            <Box p={[x, 0.6, c.z]} s={[2.2, 1.2, 3]} c="#8d5a3b" />
            <Cone p={[x, 1.6, c.z]} r={2.3} h={0.9} c="#ffffff" seg={4} ry={Math.PI / 4} />
            <Box p={[x - c.side * 1.11, 0.45, c.z]} s={[0.02, 0.5, 0.5]} c="#ffd54f" />
            <Box p={[x + 0.5, 1.7, c.z + 0.6]} s={[0.3, 0.8, 0.3]} c="#6d4c41" />
          </group>
        )
      })}
    </group>
  )
}

// Fenced fields: crop rows on the left, a pasture with barns, silos and hay
// bales on the right, rolling hills behind. Follows the season's colours.
function Farm({ len }: { len: number }) {
  const crop = PAL.bare ? '#c8b48a' : '#7cb342'
  const wood = '#8d6e63'
  const posts: number[] = []
  for (let z = -12; z < len + 40; z += 1.6) posts.push(z)
  const bales = useMemo(() => {
    const r = rand(41)
    const out = []
    for (let z = -8; z < len + 40; z += 2.5 + r() * 4) out.push({ z, x: EDGE + 1.6 + r() * 6, ry: r() * 3 })
    return out
  }, [len])
  const trees = useMemo(() => along(len, (r) => 7 + r() * 9, 47).map(({ z, side, r }) => ({ z, x: side * (EDGE + (side < 0 ? 13 : 10) + r() * 5) })), [len])
  return (
    <group>
      {[-1, 1].map((sd) => (
        <group key={sd}>
          {posts.map((z) => <Box key={z} p={[sd * (EDGE + 0.35), 0.3, z]} s={[0.07, 0.6, 0.07]} c={wood} />)}
          {[0.22, 0.48].map((y) => <Box key={y} p={[sd * (EDGE + 0.35), y, len / 2 + 14]} s={[0.04, 0.06, len + 52]} c={wood} />)}
        </group>
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <Box key={i} p={[-(EDGE + 1.2 + i * 0.7), 0.22, len / 2 + 14]} s={[0.36, 0.44, len + 52]} c={crop} />
      ))}
      <Flat x={-(EDGE + 6.6)} z={len / 2 + 14} w={11.4} d={len + 52} c="#6d4c41" y={0.01} />
      {[0.15, 0.6].map((k) => {
        const z = len * k
        const x = EDGE + 6
        return (
          <group key={k}>
            <Box p={[x, 1.1, z]} s={[3.4, 2.2, 4.6]} c="#b71c1c" />
            <Cone p={[x, 2.75, z]} r={3.3} h={1.1} c="#5d4037" seg={4} ry={Math.PI / 4} />
            <Box p={[x - 1.71, 0.7, z]} s={[0.02, 1.4, 1.4]} c="#eeeeee" />
            <Cyl p={[x + 0.6, 1.8, z + 3.6]} r={0.75} h={3.6} c="#cfd8dc" seg={10} />
            <mesh position={[x + 0.6, 3.6, z + 3.6]}>
              <sphereGeometry args={[0.75, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#90a4ae" flatShading />
            </mesh>
          </group>
        )
      })}
      {bales.map((b, i) => <Cyl key={i} p={[b.x, 0.28, b.z]} r={0.28} h={0.5} c="#e0c068" seg={9} rot={[Math.PI / 2, b.ry, 0]} />)}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <BuildingModel def={buildingDef('tree')} />
        </group>
      ))}
    </group>
  )
}

// A quay: water, cranes and ships on the left, stacked containers on the right.
function Docks({ len }: { len: number }) {
  const quay = -(EDGE + 3)
  const box = ['#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#00838f', '#6d4c41']
  const stacks = useMemo(() => {
    const r = rand(61)
    const out: { x: number; z: number; y: number; c: number }[] = []
    for (let z = -12; z < len + 40; z += 2.6) {
      for (let col = 0; col < 3; col++) {
        const n = Math.floor(r() * 3.4)
        for (let k = 0; k < n; k++) out.push({ x: EDGE + 1.2 + col * 1.15, z, y: 0.55 + k * 1.1, c: Math.floor(r() * box.length) })
      }
    }
    return out
  }, [len, box.length])
  const sheds = useMemo(() => {
    const r = rand(67)
    const out = []
    for (let z = -12; z < len + 50; z += 9 + r() * 5) out.push({ z, w: 7 + r() * 3, h: 3 + r() * 2.5 })
    return out
  }, [len])
  return (
    <group>
      <Flat x={quay - 45} z={len / 2} w={90} d={len + 220} c="#1d5f8a" />
      <Box p={[quay + 0.15, 0.1, len / 2 + 10]} s={[0.3, 0.2, len + 80]} c="#eceff1" />
      {Array.from({ length: Math.ceil((len + 50) / 4) }, (_, i) => <Cyl key={i} p={[quay + 0.45, 0.15, i * 4 - 10]} r={0.1} h={0.3} c="#263238" />)}
      {[0.12, 0.5, 0.88].map((k) => {
        const z = len * k
        const x = quay + 0.9
        return (
          <group key={k}>
            {[-1.3, 1.3].map((dz) => <Box key={dz} p={[x, 3.6, z + dz]} s={[0.25, 7.2, 0.25]} c="#fbc02d" />)}
            <Box p={[x, 7.2, z]} s={[0.4, 0.4, 3]} c="#fbc02d" />
            <Box p={[x - 4.5, 7.4, z]} s={[11, 0.3, 0.5]} c="#fbc02d" />
            <Box p={[x + 0.4, 7.6, z]} s={[1, 0.8, 1.2]} c="#c62828" />
          </group>
        )
      })}
      {[0.3, 0.75].map((k) => {
        const z = len * k
        const x = quay - 6.5
        return (
          <group key={k}>
            <Box p={[x, 0.5, z]} s={[3.6, 1.4, 22]} c="#c62828" />
            <Box p={[x, 1.3, z]} s={[3.7, 0.2, 22.1]} c="#263238" />
            <Box p={[x, 2.3, z - 8]} s={[3, 2, 3]} c="#eceff1" />
            {[-3, 0, 3].map((dz) => <Box key={dz} p={[x, 1.85, z + dz + 2]} s={[2.8, 1, 2.4]} c={box[(dz + 3) % box.length]} />)}
          </group>
        )
      })}
      {stacks.map((s, i) => <Box key={i} p={[s.x, s.y, s.z]} s={[1.0, 1.05, 2.4]} c={box[s.c]} />)}
      {sheds.map((s, i) => (
        <group key={i}>
          <Box p={[EDGE + 9, s.h / 2, s.z + s.w / 2]} s={[6, s.h, s.w - 0.6]} c="#90a4ae" />
          <Box p={[EDGE + 5.99, s.h * 0.4, s.z + s.w / 2]} s={[0.02, s.h * 0.7, s.w * 0.5]} c="#607d8b" />
        </group>
      ))}
    </group>
  )
}

// Spread across the far end of the view.
function spread(n: number, seed: number) {
  const r = rand(seed)
  return Array.from({ length: n }, (_, i) => ({ x: (i / (n - 1) - 0.5) * 130 + (r() - 0.5) * 8, z: 62 + r() * 14, a: r(), b: r() }))
}

// What sits on the horizon, riding along with the camera. Lives outside the
// street's <Batch> because it moves.
export function VenueBackdrop({ id }: { id: VenueId }) {
  const spots = useMemo(() => spread(id === 'desert' ? 16 : 13, id.length * 7), [id])
  const hill = '#' + new Color(PAL.ground).multiplyScalar(0.82).getHexString()
  if (id === 'desert')
    return (
      <Horizon>
        {spots.map((m, i) => {
          const w = 8 + m.a * 12
          const h = 6 + m.b * 9
          return (
            <group key={i}>
              <Box p={[m.x, h / 2, m.z]} s={[w, h, w * 0.7]} c="#c56a3e" />
              <Box p={[m.x, h + 0.4, m.z]} s={[w * 0.8, 0.8, w * 0.55]} c="#d98a58" />
            </group>
          )
        })}
      </Horizon>
    )
  if (id === 'snow')
    return (
      <>
        <Horizon>
          {spots.map((m, i) => {
            const r = 9 + m.a * 8
            const h = 10 + m.b * 11
            return (
              <group key={i}>
                <Cone p={[m.x, h / 2, m.z]} r={r} h={h} c="#7f8ea3" seg={6} />
                <Cone p={[m.x, h * 0.815, m.z]} r={r * 0.37} h={h * 0.37} c="#ffffff" seg={6} />
              </group>
            )
          })}
        </Horizon>
        <Snowfall />
      </>
    )
  if (id === 'farm')
    return (
      <Horizon>
        {spots.map((m, i) => {
          const r = 12 + m.a * 10
          return (
            <mesh key={i} position={[m.x, -r * 0.55, m.z]} scale={[1.4, 1, 1]}>
              <sphereGeometry args={[r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={hill} flatShading />
            </mesh>
          )
        })}
      </Horizon>
    )
  return null
}

export function VenueScenery({ id, len }: { id: VenueId; len: number }) {
  if (id === 'beach') return <Beach len={len} />
  if (id === 'desert') return <Desert len={len} />
  if (id === 'snow') return <Snow len={len} />
  if (id === 'farm') return <Farm len={len} />
  if (id === 'docks') return <Docks len={len} />
  return null
}
