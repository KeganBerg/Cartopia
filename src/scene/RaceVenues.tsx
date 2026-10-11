import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, Object3D, type Group, type InstancedMesh, type Points } from 'three'
import { BuildingModel } from './BuildingModel'
import { glowMats } from './dayNight'
import { Batch } from './Batch'
import { PAL, SEASON } from './season'
import { gravelTex, soilTex } from './textures'
import { CarModel } from './CarModel'
import { TILE, buildingDef } from '../game/data'
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

// Beach palms stay tropical whatever the season back in town.
function Palm({ x, z, h, lean }: { x: number; z: number; h: number; lean: number }) {
  const top: V3 = [lean * h * 0.35, h, 0]
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2, 3].map((i) => {
        const k = (i + 0.5) / 4
        return <Cyl key={i} p={[lean * h * 0.35 * k * k, h * k, 0]} r={0.07 - i * 0.008} h={h / 4 + 0.05} c="#8d6e63" seg={6} rot={[0, 0, -lean * 0.5 * k]} />
      })}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i} position={top} rotation-y={(i / 6) * Math.PI * 2 + lean}>
          <mesh position={[0.42, -0.12, 0]} rotation-z={-0.45}>
            <boxGeometry args={[0.9, 0.03, 0.24]} />
            <meshStandardMaterial color={i % 2 ? '#43a047' : '#2e7d32'} flatShading />
          </mesh>
        </group>
      ))}
      <mesh position={[top[0], h - 0.08, 0.06]}>
        <sphereGeometry args={[0.09, 6, 4]} />
        <meshStandardMaterial color="#5d4037" flatShading />
      </mesh>
    </group>
  )
}

// Wooden utility poles with sagging wires along one side of a country road.
function Poles({ len, x, wood = '#6d4c41' }: { len: number; x: number; wood?: string }) {
  const zs: number[] = []
  for (let z = -10; z < len + 40; z += 8) zs.push(z)
  return (
    <group>
      {zs.map((z) => (
        <group key={z}>
          <Cyl p={[x, 1.6, z]} r={0.06} h={3.2} c={wood} seg={6} />
          <Box p={[x, 3.0, z]} s={[0.9, 0.07, 0.07]} c={wood} />
        </group>
      ))}
      {[-0.38, 0.38].map((dx) => (
        <mesh key={dx} position={[x + dx, 2.97, len / 2 + 15]}>
          <boxGeometry args={[0.015, 0.015, len + 50]} />
          <meshBasicMaterial color="#263238" />
        </mesh>
      ))}
    </group>
  )
}

// Ocean on the left, a boardwalk with beach huts and palms on the right.
const SHORE = -(EDGE + 5.5) // beach waterline
const QUAY = -(EDGE + 3) // dock edge

function Beach({ len }: { len: number }) {

  const items = useMemo(() => {
    const r = rand(5)
    const umbrellas = []
    for (let z = -10; z < len + 40; z += 2.6 + r() * 2.5) umbrellas.push({ z, x: -(EDGE + 0.9 + r() * 3.4), c: Math.floor(r() * 4) })
    const huts = []
    for (let z = -12; z < len + 40; z += 3.2 + r() * 1.4) huts.push({ z, c: Math.floor(r() * 4), w: 1.8 + r() * 0.6 })
    const boats = Array.from({ length: 7 }, (_, i) => ({ x: SHORE - 10 - r() * 26, z: i * 22 - 5 + r() * 8 }))
    const palms = Array.from({ length: Math.ceil((len + 50) / 4.2) }, (_, i) => ({ z: i * 4.2 - 9 + r() * 1.2, h: 1.9 + r() * 0.8, lean: (r() - 0.3) * 0.5 }))
    const boards = []
    for (let z = -6; z < len + 30; z += 7 + r() * 6) boards.push({ z, x: -(EDGE + 0.7 + r() * 2), c: Math.floor(r() * 4), ry: r() * 0.6 - 0.3 })
    return { umbrellas, huts, boats, palms, boards }
  }, [len])
  const canopy = ['#e53935', '#fdd835', '#1e88e5', '#ff7043']
  const hut = ['#80deea', '#f8bbd0', '#fff59d', '#a5d6a7']
  return (
    <group>
      <Flat x={SHORE - 45} z={len / 2} w={90} d={len + 220} c="#2f8fd6" />
      {Array.from({ length: Math.ceil((len + 60) / 6) }, (_, i) => (
        <Flat key={i} x={SHORE + 0.15 + Math.sin(i * 1.7) * 0.25} z={i * 6 - 12} w={0.35} d={6.2} c="#eaf7ff" y={0.02} />
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
      {/* Boardwalk rail between the road and the huts. */}
      <Box p={[EDGE + 0.95, 0.55, len / 2 + 14]} s={[0.06, 0.06, len + 52]} c="#eeeeee" />
      {Array.from({ length: Math.ceil((len + 52) / 1.5) }, (_, i) => <Box key={i} p={[EDGE + 0.95, 0.28, i * 1.5 - 12]} s={[0.05, 0.56, 0.05]} c="#eeeeee" />)}
      {items.huts.map((h, i) => (
        <group key={i}>
          <Box p={[EDGE + 2.6, 0.5, h.z]} s={[1.4, 1.0, h.w]} c={hut[h.c]} />
          <Box p={[EDGE + 1.89, 0.4, h.z]} s={[0.03, 0.6, h.w * 0.4]} c="#6d4c41" />
          <Box p={[EDGE + 1.75, 1.0, h.z]} s={[0.4, 0.05, h.w * 0.9]} c={i % 2 ? '#ffffff' : canopy[h.c]} />
          <Cone p={[EDGE + 2.6, 1.25, h.z]} r={h.w * 0.78} h={0.5} c="#ffffff" seg={4} ry={Math.PI / 4} />
        </group>
      ))}
      {items.palms.map((t, i) => <Palm key={i} x={EDGE + 1.4} z={t.z} h={t.h} lean={t.lean} />)}
      {items.boards.map((b, i) => (
        <mesh key={i} position={[b.x, 0.45, b.z]} rotation={[0, b.ry, 0.12]} scale={[0.2, 0.5, 0.05]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={canopy[b.c]} flatShading />
        </mesh>
      ))}
      {/* A pier out into the sea. */}
      <Box p={[SHORE - 6, 0.35, len * 0.45]} s={[12, 0.12, 1.4]} c="#a1795a" />
      {Array.from({ length: 7 }, (_, i) => <Cyl key={i} p={[SHORE - i * 2, 0.15, len * 0.45 + (i % 2 ? 0.6 : -0.6)]} r={0.08} h={0.5} c="#6d4c41" seg={5} />)}
      <Box p={[SHORE - 11.5, 0.9, len * 0.45]} s={[1.2, 1, 1.2]} c="#e53935" />
      {items.boats.map((b, i) => (
        <group key={i}>
          <Box p={[b.x, 0.15, b.z]} s={[0.9, 0.3, 2.4]} c="#eeeeee" />
          <Cone p={[b.x, 1.3, b.z + 0.2]} r={0.7} h={2} c="#eeeeee" seg={3} />
        </group>
      ))}
    </group>
  )
}

// Red Rock Canyon: layered mesas and spires, saguaros, scrub and grit along
// the shoulders, a Route-style roadside stop, a rusting pickup and a water tower.
function Desert({ len }: { len: number }) {
  const geo = useMemo(() => {
    const mesas = along(len, (r) => 6 + r() * 8, 3, -20, len + 80).map(({ z, side, r }) => ({ z, x: side * (EDGE + 8 + r() * 16), w: 4 + r() * 6, d: 4 + r() * 6, h: 2.5 + r() * 7, ry: (r() - 0.5) * 0.5, spire: r() < 0.25 }))
    const saguaros = along(len, (r) => 3 + r() * 4, 9).map(({ z, side, r }) => ({ z, x: side * (EDGE + 2.4 + r() * 6), h: 1.3 + r() * 1.1, arm: r(), ry: r() * 6 }))
    const small = along(len, (r) => 5 + r() * 6, 19).map(({ z, side, r }) => ({ z, x: side * (EDGE + 0.7 + r() * 1.4), def: r() < 0.65 ? 'cactus' : 'rock' }))
    const r = rand(23)
    const near = (n: number, from: number, to: number) =>
      Array.from({ length: n }, () => {
        const side = r() < 0.5 ? -1 : 1
        return { x: side * (EDGE + from + r() ** 1.4 * (to - from)), z: r() * (len + 60) - 14, s: 0.6 + r() * 0.8, ry: r() * 6 }
      })
    return { mesas, saguaros, small, grass: near(520, 0.15, 7), sage: near(130, 0.4, 9), grit: near(260, 0.1, 5) }
  }, [len])
  const strata = ['#b5532f', '#c8693a', '#a84a2a', '#d4844e']
  const stop = len * 0.3
  return (
    <group>
      {geo.mesas.map((m, i) =>
        m.spire ? (
          <group key={i} position={[m.x, 0, m.z]} rotation-y={m.ry}>
            <Box p={[0, m.h * 0.35, 0]} s={[m.w * 0.35, m.h * 0.7, m.d * 0.35]} c={strata[0]} />
            <Box p={[0, m.h * 0.85, 0]} s={[m.w * 0.24, m.h * 0.3, m.d * 0.24]} c={strata[1]} />
            <Box p={[0, m.h + 0.12, 0]} s={[m.w * 0.3, 0.25, m.d * 0.3]} c={strata[3]} />
          </group>
        ) : (
          <group key={i} position={[m.x, 0, m.z]} rotation-y={m.ry}>
            {/* Bands of rock, each a touch narrower, like the real thing. */}
            <Box p={[0, m.h * 0.2, 0]} s={[m.w * 1.08, m.h * 0.4, m.d * 1.08]} c={strata[0]} />
            <Box p={[0, m.h * 0.52, 0]} s={[m.w, m.h * 0.26, m.d]} c={strata[1]} />
            <Box p={[0, m.h * 0.78, 0]} s={[m.w * 0.94, m.h * 0.28, m.d * 0.94]} c={strata[2]} />
            <Box p={[0, m.h + 0.15, 0]} s={[m.w * 0.98, 0.3, m.d * 0.98]} c={strata[3]} />
            {[0, 1, 2, 3].map((k) => {
              const a = k * 1.7 + i
              return (
                <mesh key={k} position={[Math.cos(a) * m.w * 0.6, 0.3, Math.sin(a) * m.d * 0.6]} scale={[0.7, 0.45, 0.6]}>
                  <dodecahedronGeometry args={[0.8, 0]} />
                  <meshStandardMaterial color={strata[2]} flatShading />
                </mesh>
              )
            })}
          </group>
        ),
      )}
      {geo.saguaros.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation-y={c.ry}>
          <Cyl p={[0, c.h / 2, 0]} r={0.12} h={c.h} c="#4f8a3a" seg={8} />
          <mesh position={[0, c.h, 0]}><sphereGeometry args={[0.12, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#4f8a3a" flatShading /></mesh>
          {[1, -1].map((sd) =>
            (sd > 0 ? c.arm > 0.25 : c.arm > 0.6) ? (
              <group key={sd}>
                <Cyl p={[sd * 0.2, c.h * 0.45, 0]} r={0.07} h={0.24} c="#4f8a3a" seg={7} rot={[0, 0, Math.PI / 2]} />
                <Cyl p={[sd * 0.3, c.h * (sd > 0 ? 0.6 : 0.55), 0]} r={0.075} h={c.h * 0.32} c="#4f8a3a" seg={7} />
                <mesh position={[sd * 0.3, c.h * (sd > 0 ? 0.76 : 0.71), 0]}><sphereGeometry args={[0.075, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#4f8a3a" flatShading /></mesh>
              </group>
            ) : null,
          )}
        </group>
      ))}
      {/* The town's own cactus, boulder and scrub models dot the shoulders. */}
      {geo.small.map((o, i) => (
        <group key={i} position={[o.x, 0, o.z]} scale={0.8}>
          <BuildingModel def={buildingDef(o.def)} />
        </group>
      ))}
      <Scatter spots={geo.grass} colors={['#c9a85c', '#b39550', '#d8bd72', '#9c8a4a']}>
        <coneGeometry args={[0.07, 0.3, 3]} />
      </Scatter>
      <Scatter spots={geo.sage} colors={['#a8b28a', '#9aa57c', '#b5bd96']} y={0.12}>
        <icosahedronGeometry args={[0.2, 0]} />
      </Scatter>
      <Scatter spots={geo.grit} colors={['#a0603a', '#8d5a3b', '#b97a4e']} y={0.03}>
        <dodecahedronGeometry args={[0.06, 0]} />
      </Scatter>
      <Poles len={len} x={-(EDGE + 0.6)} />
      {/* A roadside stop: gas, a diner and a motel on a gravel lot. */}
      <mesh rotation-x={-Math.PI / 2} position={[EDGE + 1.6, 0.012, stop + 4.6]}>
        <planeGeometry args={[3.4, 15]} />
        <meshStandardMaterial map={gravelTex(2, 8)} color="#d9b98e" />
      </mesh>
      <Lot def="gas" side={1} z={stop} />
      <Lot def="diner" side={1} z={stop + 4.6} />
      <Lot def="motel" side={1} z={stop + 9.2} />
      <group position={[EDGE + 0.5, 0, stop + 12]}>
        <Cyl p={[0, 1.8, 0]} r={0.06} h={3.6} c="#37474f" seg={6} />
        <Box p={[0, 3.5, 0]} s={[0.12, 0.9, 1.6]} c="#00838f" />
        <Box p={[-0.07, 3.5, 0]} s={[0.02, 0.6, 1.3]} c="#ffd54f" />
      </group>
      {/* An old water tower, a shack and a pickup left to rust. */}
      <group position={[-(EDGE + 6), 0, len * 0.55]}>
        {[-0.7, 0.7].map((dx) => [-0.7, 0.7].map((dz) => <Box key={`${dx}${dz}`} p={[dx, 1.6, dz]} s={[0.1, 3.2, 0.1]} c="#6d4c41" />))}
        <Cyl p={[0, 3.8, 0]} r={1.1} h={1.4} c="#8d6e63" seg={10} />
        <Cone p={[0, 4.8, 0]} r={1.2} h={0.6} c="#6d4c41" seg={10} />
      </group>
      <group position={[-(EDGE + 3.4), 0, len * 0.72]}>
        <Box p={[0, 0.6, 0]} s={[2, 1.2, 1.6]} c="#8d6e63" />
        <Box p={[0, 1.25, 0]} s={[2.3, 0.1, 1.9]} c="#6d4c41" ry={0.05} />
        <Box p={[1.01, 0.5, 0]} s={[0.02, 0.8, 0.5]} c="#3e2723" />
        <group position={[0.4, 0, 1.9]} rotation-y={2.3} scale={0.9}>
          <CarModel body="truck" color="#9a5a35" />
        </group>
      </group>
      <group position={[EDGE + 3.5, 0, len * 0.75]}>
        {[-0.8, 0.8].map((dz) => <Box key={dz} p={[0, 1.2, dz]} s={[0.1, 2.4, 0.1]} c="#6d4c41" />)}
        <Box p={[0, 2.3, 0]} s={[0.08, 1.0, 2.2]} c="#c62828" />
        <Box p={[-0.05, 2.3, 0]} s={[0.02, 0.6, 1.8]} c="#fdd835" />
      </group>
    </group>
  )
}

// A town building fronting the road, like the shops on Main Street.
function Lot({ def, side, z, back = 0.3 }: { def: string; side: -1 | 1; z: number; back?: number }) {
  const d = buildingDef(def)
  const depth = d.h * TILE
  return (
    <group position={[side * (EDGE + back + depth / 2), 0, z]} rotation-y={side < 0 ? Math.PI / 2 : -Math.PI / 2}>
      <BuildingModel def={d} />
    </group>
  )
}

type Spot = { x: number; z: number; s?: number; ry?: number; y?: number; sy?: number }

// Lots of one small thing (grass, pebbles, corn) as a single instanced draw,
// each copy tinted from a short list so the patch doesn't look stamped.
function Scatter({ spots, colors, y = 0, children }: { spots: Spot[]; colors: string[]; y?: number; children: ReactNode }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    const c = new Color()
    spots.forEach((p, i) => {
      const k = p.s ?? 1
      o.position.set(p.x, (p.y ?? y) * k, p.z)
      o.rotation.set(0, p.ry ?? 0, 0)
      o.scale.set(k, k * (p.sy ?? 1), k)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(colors[i % colors.length]))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [spots, colors, y])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} raycast={() => null}>
      {children}
      <meshStandardMaterial flatShading />
    </instancedMesh>
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
  // A frozen lake opens up on the left part way down the pass.
  const lake = useMemo(() => ({ x: -(EDGE + 9), z: len * 0.45, w: 12, d: len * 0.3 }), [len])
  const pines = useMemo(
    () =>
      along(len, (r) => 1.1 + r() * 1.6, 7)
        .map(({ z, side, r }) => ({ z, x: side * (EDGE + 0.9 + r() ** 1.6 * 16), s: 0.8 + r() * 0.7 }))
        .filter((t) => ((t.x - lake.x) / (lake.w / 2 + 0.6)) ** 2 + ((t.z - lake.z) / (lake.d / 2 + 0.6)) ** 2 > 1),
    [len, lake],
  )
  const snowmen = [0.12, 0.38, 0.7, 0.95].map((k, i) => ({ z: len * k, x: (i % 2 ? 1 : -1) * (EDGE + 1.1) }))
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
      <mesh rotation-x={-Math.PI / 2} position={[lake.x, 0.02, lake.z]} scale={[lake.w / 2, lake.d / 2, 1]}>
        <circleGeometry args={[1, 24]} />
        <meshStandardMaterial color="#bfe0f2" roughness={0.15} metalness={0.1} />
      </mesh>
      {snowmen.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]}>
          <mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.22, 10, 7]} /><meshStandardMaterial color="#ffffff" flatShading /></mesh>
          <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.16, 10, 7]} /><meshStandardMaterial color="#ffffff" flatShading /></mesh>
          <mesh position={[0, 0.72, 0]}><sphereGeometry args={[0.11, 10, 7]} /><meshStandardMaterial color="#ffffff" flatShading /></mesh>
          <mesh position={[-Math.sign(m.x) * 0.1, 0.72, -0.07]} rotation={[-Math.PI / 2 + 0.3, 0, Math.sign(m.x) * 0.9]}><coneGeometry args={[0.025, 0.14, 5]} /><meshStandardMaterial color="#ff7043" flatShading /></mesh>
          <Box p={[0, 0.6, 0]} s={[0.36, 0.05, 0.05]} c="#c62828" />
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

// Harvest Backroad: a cornfield on the left, a farmstead on the right (house,
// barn with a gable roof, silo, tractor, duck pond), cows, hay, grass along the
// fences, and a pumpkin stand in the fall. Follows the season's colours.
function Farm({ len }: { len: number }) {
  const wood = '#8d6e63'
  const posts: number[] = []
  for (let z = -12; z < len + 40; z += 1.6) posts.push(z)
  // Corn: tall and green in summer, golden in the fall, short sprouts in spring, stubble in winter.
  const corn = { spring: ['#8bc34a', '#7cb342', 0.45], summer: ['#5f9e35', '#4f8a2b', 1.15], fall: ['#c9a84a', '#b8953e', 1.05], winter: ['#bfa77a', '#a8936a', 0.3] }[SEASON] as [string, string, number]
  const geo = useMemo(() => {
    const r = rand(41)
    const stalks: Spot[] = []
    for (let row = 0; row < 13; row++) {
      for (let z = -12; z < len + 40; z += 0.42) stalks.push({ x: -(EDGE + 1.1 + row * 0.62 + (r() - 0.5) * 0.08), z: z + (r() - 0.5) * 0.15, s: 0.85 + r() * 0.3, ry: r() * 6 })
    }
    const bales: { x: number; z: number; ry: number }[] = []
    for (let z = -8; z < len + 40; z += 3 + r() * 5) if (z < len * 0.25 || z > len * 0.48) bales.push({ z, x: EDGE + 1.8 + r() * 3, ry: r() * 3 })
    const cows = Array.from({ length: 10 }, (_, i) => ({ z: len * 0.5 + (i / 9) * (len * 0.5 + 20) + r() * 3, x: EDGE + 2.2 + r() * 6, ry: r() * 6 }))
    const grass: Spot[] = Array.from({ length: 700 }, () => {
      const side = r() < 0.5 ? -1 : 1
      return { x: side * (EDGE + 0.05 + r() * (side < 0 ? 0.8 : 9)), z: r() * (len + 60) - 14, s: 0.6 + r() * 0.7, ry: r() * 6 }
    })
    const flowers: Spot[] = Array.from({ length: 160 }, () => ({ x: EDGE + 0.4 + r() * 8, z: r() * (len + 60) - 14, s: 0.7 + r() * 0.5, y: 0.16 }))
    const pumpkins: Spot[] = Array.from({ length: 60 }, () => ({ x: EDGE + 0.6 + r() * 2.2, z: len * 0.08 + r() * 6, s: 0.7 + r() * 0.8, sy: 0.75, y: 0.1, ry: r() * 6 }))
    const trees = along(len, (r2) => 7 + r2() * 9, 47).map(({ z, side, r: r2 }) => ({ z, x: side * (EDGE + (side < 0 ? 10.5 : 11) + r2() * 5) }))
    return { stalks, bales, cows, grass, flowers, pumpkins, trees }
  }, [len])
  const yard = len * 0.32
  const barn = len * 0.62
  return (
    <group>
      {[-1, 1].map((sd) => (
        <group key={sd}>
          {posts.map((z) => <Box key={z} p={[sd * (EDGE + 0.35), 0.3, z]} s={[0.07, 0.6, 0.07]} c={wood} />)}
          {[0.22, 0.48].map((y) => <Box key={y} p={[sd * (EDGE + 0.35), y, len / 2 + 14]} s={[0.04, 0.06, len + 52]} c={wood} />)}
        </group>
      ))}
      {/* Cornfield: ploughed rows and hundreds of stalks in one draw. */}
      <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + 4.9), 0.012, len / 2 + 14]}>
        <planeGeometry args={[8.6, len + 52]} />
        <meshStandardMaterial map={soilTex(1, (len + 52) / 4)} />
      </mesh>
      <Scatter spots={geo.stalks} colors={[corn[0], corn[1], corn[0]]} y={corn[2] / 2}>
        <boxGeometry args={[0.07, corn[2], 0.07]} />
      </Scatter>
      <Scatter spots={geo.stalks} colors={[corn[1], corn[0]]} y={corn[2] * 0.62}>
        <coneGeometry args={[0.2, corn[2] * 0.7, 4]} />
      </Scatter>
      {SEASON !== 'winter' && SEASON !== 'spring' && (
        <Scatter spots={geo.stalks} colors={['#f2d26b', '#e6c35a']} y={corn[2] + 0.08}>
          <coneGeometry args={[0.03, 0.16, 3]} />
        </Scatter>
      )}
      {/* Grass along the fences and across the pasture, flowers in spring and summer. */}
      <Scatter spots={geo.grass} colors={PAL.bare ? ['#e8eef2', '#d7dee3'] : [...PAL.leaves.slice(0, 1), '#5a9a3a', '#6fae46', '#4e8a33']}>
        <coneGeometry args={[0.06, 0.28, 3]} />
      </Scatter>
      {SEASON !== 'winter' && SEASON !== 'fall' && (
        <Scatter spots={geo.flowers} colors={['#fdd835', '#ffffff', '#ec407a', '#ab47bc']}>
          <octahedronGeometry args={[0.05, 0]} />
        </Scatter>
      )}
      {SEASON === 'fall' && (
        <>
          <Scatter spots={geo.pumpkins} colors={['#ef6c00', '#f57c00', '#e65100']}>
            <sphereGeometry args={[0.14, 8, 6]} />
          </Scatter>
          <group position={[EDGE + 1.2, 0, len * 0.08 - 1.2]}>
            <Box p={[0, 0.4, 0]} s={[0.9, 0.8, 1.4]} c={wood} />
            <Box p={[0, 0.85, 0]} s={[1.1, 0.06, 1.7]} c="#c62828" />
          </group>
        </>
      )}
      {/* Farmhouse in its yard, with a mailbox at the road. */}
      <Lot def="house" side={1} z={yard} back={2.2} />
      <Lot def="house" side={1} z={yard + 2.6} back={4.6} />
      <group position={[EDGE + 0.75, 0, yard - 1.2]}>
        <Box p={[0, 0.4, 0]} s={[0.05, 0.8, 0.05]} c={wood} />
        <Box p={[0, 0.85, 0]} s={[0.2, 0.15, 0.3]} c="#455a64" />
        <Box p={[0.02, 0.95, -0.12]} s={[0.02, 0.12, 0.04]} c="#e53935" />
      </group>
      {[-1.6, 1.8, 4.2].map((dz) => (
        <group key={dz} position={[EDGE + 6.6, 0, yard + dz]}>
          <BuildingModel def={buildingDef('tree')} />
        </group>
      ))}
      {/* Red barn with a proper gable roof, white trim and a hayloft door. */}
      <group position={[EDGE + 5.6, 0, barn]}>
        <Box p={[0, 1.1, 0]} s={[3.4, 2.2, 4.8]} c="#b71c1c" />
        {/* Gable ends: a square turned on its corner, squashed to the roof pitch. */}
        <group position-y={2.2} scale={[1, 0.6, 1]}>
          <mesh rotation-z={Math.PI / 4}>
            <boxGeometry args={[2.4, 2.4, 4.78]} />
            <meshStandardMaterial color="#b71c1c" flatShading />
          </mesh>
        </group>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * 0.85, 2.77, 0]} rotation-z={-sd * 0.54}>
            <boxGeometry args={[2.15, 0.1, 5.1]} />
            <meshStandardMaterial color="#5d4037" flatShading />
          </mesh>
        ))}
        <Box p={[0, 3.26, 0]} s={[0.14, 0.1, 5.1]} c="#3e2723" />
        <Box p={[-1.71, 0.75, 0]} s={[0.03, 1.5, 1.6]} c="#8e1414" />
        <mesh position={[-1.73, 0.75, 0]} rotation-x={0.75}><boxGeometry args={[0.02, 0.08, 2.1]} /><meshStandardMaterial color="#fafafa" /></mesh>
        <mesh position={[-1.73, 0.75, 0]} rotation-x={-0.75}><boxGeometry args={[0.02, 0.08, 2.1]} /><meshStandardMaterial color="#fafafa" /></mesh>
        <Box p={[-1.73, 1.52, 0]} s={[0.02, 0.08, 1.7]} c="#fafafa" />
        <Box p={[-1.73, 0.75, -0.82]} s={[0.02, 1.55, 0.08]} c="#fafafa" />
        <Box p={[-1.73, 0.75, 0.82]} s={[0.02, 1.55, 0.08]} c="#fafafa" />
        <Box p={[-1.73, 1.9, 0]} s={[0.02, 0.5, 0.6]} c="#3e2723" />
        <Cyl p={[0.6, 1.9, 3.6]} r={0.75} h={3.8} c="#cfd8dc" seg={12} />
        {[0.8, 1.8, 2.8].map((y) => <Cyl key={y} p={[0.6, y, 3.6]} r={0.77} h={0.06} c="#90a4ae" seg={12} />)}
        <mesh position={[0.6, 3.8, 3.6]}>
          <sphereGeometry args={[0.75, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#90a4ae" flatShading />
        </mesh>
        {/* Tractor parked by the barn door. */}
        <group position={[-2.6, 0, -2.6]} rotation-y={0.6}>
          <Box p={[0, 0.42, 0.15]} s={[0.5, 0.35, 0.9]} c="#2e7d32" />
          <Box p={[0, 0.78, -0.2]} s={[0.46, 0.4, 0.4]} c="#2e7d32" />
          <Box p={[0, 0.98, -0.2]} s={[0.5, 0.04, 0.44]} c="#fdd835" />
          <Cyl p={[0, 0.8, 0.45]} r={0.03} h={0.4} c="#212121" seg={6} />
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <Cyl p={[sd * 0.32, 0.32, -0.25]} r={0.32} h={0.16} c="#212121" seg={12} rot={[0, 0, Math.PI / 2]} />
              <Cyl p={[sd * 0.33, 0.32, -0.25]} r={0.14} h={0.17} c="#fdd835" seg={10} rot={[0, 0, Math.PI / 2]} />
              <Cyl p={[sd * 0.27, 0.17, 0.45]} r={0.17} h={0.1} c="#212121" seg={10} rot={[0, 0, Math.PI / 2]} />
            </group>
          ))}
        </group>
      </group>
      <group position={[EDGE + 7.5, 0, len * 0.86]}>
        <BuildingModel def={buildingDef('pond')} />
      </group>
      {geo.cows.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation-y={c.ry}>
          <Box p={[0, 0.42, 0]} s={[0.36, 0.32, 0.7]} c="#fafafa" />
          <Box p={[0.12, 0.47, 0.08]} s={[0.14, 0.2, 0.26]} c="#263238" />
          <Box p={[-0.1, 0.5, -0.15]} s={[0.18, 0.15, 0.2]} c="#263238" />
          <Box p={[0, 0.52, 0.42]} s={[0.22, 0.22, 0.22]} c="#fafafa" />
          <Box p={[0, 0.46, 0.54]} s={[0.16, 0.1, 0.04]} c="#f8bbd0" />
          {[-1, 1].map((sd) => <Box key={sd} p={[sd * 0.1, 0.66, 0.4]} s={[0.03, 0.08, 0.03]} c="#eeeeee" />)}
          {[-0.12, 0.12].map((dx) => [-0.25, 0.25].map((dz) => <Box key={`${dx}${dz}`} p={[dx, 0.13, dz]} s={[0.07, 0.26, 0.07]} c="#263238" />))}
        </group>
      ))}
      {/* A scarecrow minding the corn. */}
      <group position={[-(EDGE + 4.1), 0, len * 0.4]}>
        <Box p={[0, 0.9, 0]} s={[0.06, 1.8, 0.06]} c={wood} />
        <Box p={[0, 1.4, 0]} s={[0.9, 0.05, 0.05]} c={wood} />
        <Box p={[0, 1.35, 0]} s={[0.4, 0.42, 0.18]} c="#1565c0" />
        <mesh position={[0, 1.7, 0]}><sphereGeometry args={[0.13, 8, 6]} /><meshStandardMaterial color="#e0c068" flatShading /></mesh>
        <Cone p={[0, 1.86, 0]} r={0.22} h={0.2} c="#6d4c41" seg={8} />
      </group>
      <Poles len={len} x={-(EDGE + 0.75)} />
      {geo.bales.map((b, i) => (
        <group key={i}>
          <Cyl p={[b.x, 0.28, b.z]} r={0.28} h={0.5} c="#e0c068" seg={10} rot={[Math.PI / 2, b.ry, 0]} />
          {i % 3 === 0 && <Cyl p={[b.x + 0.25, 0.8, b.z + 0.1]} r={0.28} h={0.5} c="#d4b45a" seg={10} rot={[Math.PI / 2, b.ry + 0.4, 0]} />}
        </group>
      ))}
      {geo.trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <BuildingModel def={buildingDef('tree')} />
        </group>
      ))}
    </group>
  )
}

// A quay: water, cranes and ships on the left, stacked containers on the right.
function Docks({ len }: { len: number }) {
  const quay = QUAY
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
      {Array.from({ length: Math.ceil((len + 50) / 4) }, (_, i) => <Cyl key={i} p={[quay - 0.02, 0.05, i * 4 - 8]} r={0.12} h={0.14} c="#212121" seg={8} rot={[0, 0, Math.PI / 2]} />)}
      {/* Lighthouse at the end of the harbour wall. */}
      <group position={[quay - 9, 0, len + 22]}>
        <Cyl p={[0, 0.4, 0]} r={2} h={0.8} c="#9aa3a9" seg={10} />
        {[0, 1, 2, 3].map((i) => <Cyl key={i} p={[0, 1.6 + i * 1.6, 0]} r={0.9 - i * 0.1} h={1.6} c={i % 2 ? '#ffffff' : '#c62828'} seg={10} />)}
        <Cyl p={[0, 7.8, 0]} r={0.75} h={0.15} c="#263238" seg={10} />
        <mesh position={[0, 8.2, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.7, 10]} />
          <primitive object={glowMats.bulb} attach="material" dispose={null} />
        </mesh>
        <Cone p={[0, 8.85, 0]} r={0.6} h={0.6} c="#263238" seg={10} />
      </group>
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

// Glints on the water ahead of the camera.
function Sparkles({ edge }: { edge: number }) {
  const ref = useRef<InstancedMesh>(null)
  const N = 70
  const spots = useMemo(() => {
    const r = rand(71)
    return Array.from({ length: N }, () => ({ x: edge - 0.6 - r() ** 1.5 * 30, z: r() * 50 - 6, ph: r() * 6.3, w: 0.25 + r() * 0.5 }))
  }, [edge])
  const tmp = useMemo(() => new Object3D(), [])
  useFrame(({ camera, clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    const cz = camera.position.z
    spots.forEach((p, i) => {
      // Each glint fades in and out on its own beat, and keeps pace with the camera.
      const k = Math.max(0, Math.sin(t * 1.6 + p.ph))
      const z = cz + ((p.z - cz * 0.15) % 50 + 50) % 50 - 4
      tmp.position.set(p.x, 0.03, z)
      tmp.scale.set(p.w * k, 1, 0.06 + 0.04 * k)
      tmp.rotation.set(-Math.PI / 2, 0, 0)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false} raycast={() => null}>
      <planeGeometry />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} />
    </instancedMesh>
  )
}

// Gulls wheeling over the water.
function Gulls({ x }: { x: number }) {
  const refs = useRef<(Group | null)[]>([])
  const birds = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ r: 3 + (i % 3) * 1.5, y: 3.5 + (i % 2) * 1.2, ph: i * 1.1, z: 8 + i * 4 })), [])
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime
    birds.forEach((b, i) => {
      const g = refs.current[i]
      if (!g) return
      const a = t * 0.5 + b.ph
      g.position.set(x + Math.cos(a) * b.r, b.y + Math.sin(t * 2 + b.ph) * 0.15, camera.position.z + b.z + Math.sin(a) * b.r)
      g.rotation.y = -a
      const flap = Math.sin(t * 9 + b.ph) * 0.5
      g.children[0].rotation.z = 0.3 + flap
      g.children[1].rotation.z = -0.3 - flap
    })
  })
  return (
    <>
      {birds.map((_, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }}>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * 0.15, 0, 0]}>
              <boxGeometry args={[0.3, 0.015, 0.08]} />
              <meshStandardMaterial color="#fafafa" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

// Tumbleweeds bowling across the desert ahead of the racers.
function Tumbleweeds() {
  const refs = useRef<(Group | null)[]>([])
  const weeds = useMemo(() => [{ ph: 0, z: 14, s: 0.35 }, { ph: 5, z: 24, s: 0.28 }, { ph: 9, z: 34, s: 0.4 }], [])
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime
    weeds.forEach((w, i) => {
      const g = refs.current[i]
      if (!g) return
      const k = ((t + w.ph) % 12) / 12
      const x = 14 - k * 28
      g.position.set(x, w.s + Math.abs(Math.sin(t * 4 + w.ph)) * 0.25, camera.position.z + w.z)
      g.rotation.z = (x / w.s) * 0.9
    })
  })
  return (
    <>
      {weeds.map((w, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }} scale={w.s}>
          <mesh>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#b08b5a" wireframe />
          </mesh>
          <mesh scale={0.7}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#8d6e47" wireframe />
          </mesh>
        </group>
      ))}
    </>
  )
}

// An old farm windmill, sails turning in the breeze.
function Windmill({ x, z }: { x: number; z: number }) {
  const sails = useRef<Group>(null)
  useFrame((_, dt) => {
    if (sails.current) sails.current.rotation.x += dt * 0.8
  })
  return (
    <group position={[x, 0, z]}>
      <Batch version={1}>
        <Cyl p={[0, 2.2, 0]} r={0.9} h={4.4} c="#eceff1" seg={8} />
        <Cone p={[0, 5, 0]} r={1.05} h={1.2} c="#5d4037" seg={8} />
        <Box p={[-0.91, 0.5, 0]} s={[0.02, 1, 0.6]} c="#6d4c41" />
      </Batch>
      <group ref={sails} position={[-1.05, 4.3, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation-x={(i * Math.PI) / 2}>
            <mesh position={[0, 1.4, 0]}>
              <boxGeometry args={[0.05, 2.6, 0.55]} />
              <meshStandardMaterial color={i % 2 ? '#fafafa' : '#d7ccc8'} flatShading />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

// What sits on the horizon, riding along with the camera. Lives outside the
// street's <Batch> because it moves.
export function VenueBackdrop({ id, len }: { id: VenueId; len: number }) {
  return (
    <>
      <Far id={id} />
      {id === 'beach' && <><Sparkles edge={SHORE} /><Gulls x={-(EDGE + 12)} /></>}
      {id === 'docks' && <><Sparkles edge={QUAY} /><Gulls x={-(EDGE + 9)} /></>}
      {id === 'desert' && <Tumbleweeds />}
      {id === 'farm' && <Windmill x={EDGE + 13} z={len * 0.8} />}
    </>
  )
}

function Far({ id }: { id: VenueId }) {
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
