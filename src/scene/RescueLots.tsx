import { useMemo } from 'react'
import { BuildingModel } from './BuildingModel'
import { Box, Cone, Cyl, rand } from './RaceVenues'
import { PAL } from './season'
import type { Texture } from 'three'
import { dirtTex, paverTex, roadTex } from './textures'
import { buildingDef, type BuildingDef } from '../game/data'

// The neighbourhoods around Rusty's search lots. Laid out like real places:
// a grid of streets around the lot, houses lined up facing the road with
// driveways and yard trees, shop fronts shoulder to shoulder downtown, fields
// in neat rows in the country. Everything is static and sits inside the
// scene's <Batch>, so colours are kept to a small set.

export type LotLayout = { rx: number; rz: number; pts: [number, number][]; cum: number[]; len: number; spots: { x: number; z: number }[] }

type Rect = { x0: number; x1: number; z0: number; z1: number }
type V3 = [number, number, number]

// Half the size of the fenced lot that holds the loop and its spots.
export function lotBounds(L: LotLayout) {
  let X = 0
  let Z = 0
  for (const [x, z] of L.pts) {
    X = Math.max(X, Math.abs(x) + 1)
    Z = Math.max(Z, Math.abs(z) + 1)
  }
  for (const s of L.spots) {
    X = Math.max(X, Math.abs(s.x) + 1.7)
    Z = Math.max(Z, Math.abs(s.z) + 1.7)
  }
  return { X, Z }
}

// A flat strip lying on the ground.
function Strip({ x, z, w, d, c, y = 0.012, t }: { x: number; z: number; w: number; d: number; c: string; y?: number; t?: Texture }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={c} roughness={0.95} map={t} />
    </mesh>
  )
}

function Model({ def, p, ry = 0, s = 1, level = 1 }: { def: BuildingDef | string; p: V3; ry?: number; s?: number; level?: number }) {
  return (
    <group position={p} rotation-y={ry} scale={s}>
      <BuildingModel def={typeof def === 'string' ? buildingDef(def) : def} level={level} />
    </group>
  )
}

// ---- A grid of streets with blocks around the lot ----

type Grid = { xs: number[]; zs: number[]; blocks: { r: Rect; ix: number; iz: number }[]; sw: number }

// Streets run just outside the lot and one block further out on every side.
function gridAround(X: number, Z: number, sw: number, block: number): Grid {
  const X1 = X + 0.7 + sw
  const Z1 = Z + 0.7 + sw
  const xs = [-(X1 + block), -X1, X1, X1 + block]
  const zs = [-(Z1 + block), -Z1, Z1, Z1 + block]
  const blocks: Grid['blocks'] = []
  for (let ix = 0; ix < 3; ix++)
    for (let iz = 0; iz < 3; iz++) {
      if (ix === 1 && iz === 1) continue
      const r = { x0: xs[ix] + sw, x1: xs[ix + 1] - sw, z0: zs[iz] + sw, z1: zs[iz + 1] - sw }
      // The road in from Rusty's runs straight through the block in front.
      if (ix === 1 && iz === 2) blocks.push({ ix, iz, r: { ...r, x1: -0.9 } }, { ix, iz, r: { ...r, x0: 0.9 } })
      else blocks.push({ ix, iz, r })
    }
  return { xs, zs, blocks, sw }
}

function Streets({ g, road, walk, reach = 30, paved = true }: { g: Grid; road: string; walk?: string; reach?: number; paved?: boolean }) {
  const zMin = g.zs[0] - reach
  const zMax = g.zs[3] + reach
  const xMin = g.xs[0] - reach
  const xMax = g.xs[3] + reach
  return (
    <group>
      {g.xs.map((x) => (
        <group key={`x${x}`}>
          <Strip x={x} z={(zMin + zMax) / 2} w={g.sw * 2} d={zMax - zMin} c={road} t={paved ? roadTex(g.sw, (zMax - zMin) / 2) : dirtTex(g.sw / 2, (zMax - zMin) / 4)} />
          {walk && [-1, 1].map((sd) => <Strip key={sd} x={x + sd * (g.sw + 0.2)} z={(zMin + zMax) / 2} w={0.4} d={zMax - zMin} c={walk} y={0.008} t={paverTex(0.4, zMax - zMin)} />)}
        </group>
      ))}
      {g.zs.map((z) => (
        <group key={`z${z}`}>
          <Strip x={(xMin + xMax) / 2} z={z} w={xMax - xMin} d={g.sw * 2} c={road} t={paved ? roadTex((xMax - xMin) / 2, g.sw) : dirtTex((xMax - xMin) / 4, g.sw / 2)} />
          {walk && [-1, 1].map((sd) => <Strip key={sd} x={(xMin + xMax) / 2} z={z + sd * (g.sw + 0.2)} w={xMax - xMin} d={0.4} c={walk} y={0.008} t={paverTex(xMax - xMin, 0.4)} />)}
        </group>
      ))}
    </group>
  )
}

// Spots along the four edges of a block, each facing its street. `size` is
// how much frontage each one takes; corners belong to the north and south rows.
function frontage(r: Rect, inset: number, size: number, depth: number) {
  const out: { x: number; z: number; ry: number; side: 'n' | 's' | 'w' | 'e' }[] = []
  const w = r.x1 - r.x0 - inset * 2
  const n = Math.max(0, Math.floor(w / size))
  const pad = (w - n * size) / 2
  for (let i = 0; i < n; i++) {
    const x = r.x0 + inset + pad + size * (i + 0.5)
    out.push({ x, z: r.z0 + inset + depth / 2, ry: Math.PI, side: 'n' })
    if (r.z1 - r.z0 > depth * 2 + inset * 2 + 0.6) out.push({ x, z: r.z1 - inset - depth / 2, ry: 0, side: 's' })
  }
  const z0 = r.z0 + inset + depth + 0.6
  const z1 = r.z1 - inset - depth - 0.6
  const m = Math.max(0, Math.floor((z1 - z0) / size))
  const zpad = (z1 - z0 - m * size) / 2
  if (r.x1 - r.x0 > depth * 2 + inset * 2)
    for (let i = 0; i < m; i++) {
      const z = z0 + zpad + size * (i + 0.5)
      out.push({ x: r.x0 + inset + depth / 2, z, ry: -Math.PI / 2, side: 'w' })
      out.push({ x: r.x1 - inset - depth / 2, z, ry: Math.PI / 2, side: 'e' })
    }
  return out
}

// Facing direction as a unit vector toward the street.
const facing = (ry: number): [number, number] => [Math.sin(ry), Math.cos(ry)]

// ---- Suburbs ----

const SIDING = ['#fff3e0', '#e3f2fd', '#fce4ec', '#e8f5e9', '#fff9c4', '#efebe9']
const ROOFS = ['#6d4c41', '#455a64', '#8d6e63', '#37474f']

function Suburbs({ L }: { L: LotLayout }) {
  const { X, Z } = lotBounds(L)
  const g = useMemo(() => gridAround(X, Z, 0.75, 7.4), [X, Z])
  const houses = useMemo(() => {
    const r = rand(17)
    const defs = SIDING.flatMap((c) => ROOFS.map((roof) => ({ ...buildingDef('house'), color: c, roof })))
    return g.blocks.flatMap(({ r: b }) =>
      frontage(b, 0.55, 2.7, 2).map((h) => ({ ...h, def: defs[Math.floor(r() * defs.length)], level: 1 + Math.floor(r() * 3), tree: r() }))
    )
  }, [g])
  return (
    <group>
      <Streets g={g} road="#e3e6e8" walk="#ffffff" />
      {houses.map((h, i) => {
        const [fx, fz] = facing(h.ry)
        // A driveway beside the house, and maybe a tree in the front yard.
        const [sx, sz] = [-fz, fx]
        const deep = Math.abs(fx) > 0.5
        return (
          <group key={i}>
            <Model def={h.def} p={[h.x, 0, h.z]} ry={h.ry} level={h.level} />
            <Strip x={h.x + sx * 1.35 + fx * 0.75} z={h.z + sz * 1.35 + fz * 0.75} w={deep ? 1.7 : 0.55} d={deep ? 0.55 : 1.7} c="#bdbdbd" y={0.015} />
            {h.tree < 0.6 && <Model def={h.tree < 0.45 ? 'tree' : 'pine'} p={[h.x - sx * 0.6 + fx * 1.3, 0, h.z - sz * 0.6 + fz * 1.3]} s={0.5} />}
          </group>
        )
      })}
    </group>
  )
}

// ---- Downtown ----

const SHOPS = ['diner', 'bowling', 'motel', 'market', 'bodyshop', 'parts', 'pizza', 'donut', 'coffee', 'arcade', 'burger', 'carwash', 'police', 'firehouse', 'tires', 'icecream']

function Downtown({ L }: { L: LotLayout }) {
  const { X, Z } = lotBounds(L)
  const g = useMemo(() => gridAround(X, Z, 0.85, 8.6), [X, Z])
  const shops = useMemo(() => {
    const r = rand(29)
    const out: { def: BuildingDef; x: number; z: number; ry: number }[] = []
    for (const { r: b } of g.blocks) {
      // Shop fronts flush along the north and south edges of each block,
      // facing out; the side streets get a row each where there's room.
      const run = (len: number, place: (at: number, w: number, def: BuildingDef) => void) => {
        let at = 0
        while (at < len - 1.9) {
          let def = buildingDef(SHOPS[Math.floor(r() * SHOPS.length)])
          if (def.w * 2 > len - at) def = buildingDef('pizza')
          if (def.w * 2 > len - at) break
          place(at, def.w * 2, def)
          at += def.w * 2 + 0.1
        }
      }
      const w = b.x1 - b.x0 - 0.8
      run(w, (at, bw, def) => out.push({ def, x: b.x0 + 0.4 + at + bw / 2, z: b.z0 + 0.4 + def.h, ry: Math.PI }))
      if (b.z1 - b.z0 > 6) run(w, (at, bw, def) => out.push({ def, x: b.x1 - 0.4 - at - bw / 2, z: b.z1 - 0.4 - def.h, ry: 0 }))
      const zl = b.z1 - b.z0 - 9.6
      if (zl > 2 && b.x1 - b.x0 > 6) {
        run(zl, (at, bw, def) => out.push({ def, x: b.x0 + 0.4 + def.h, z: b.z0 + 4.8 + at + bw / 2, ry: -Math.PI / 2 }))
        run(zl, (at, bw, def) => out.push({ def, x: b.x1 - 0.4 - def.h, z: b.z0 + 4.8 + at + bw / 2, ry: Math.PI / 2 }))
      }
    }
    return out
  }, [g])
  // Street lamps along the streets that ring the lot.
  const lamps = useMemo(() => {
    const out: [number, number][] = []
    const [, xa, xb] = g.xs
    const [, za, zb] = g.zs
    for (let x = xa + 1.5; x < xb - 1; x += 4.5) out.push([x, za + g.sw + 0.25], [x, zb - g.sw - 0.25])
    for (let z = za + 3; z < zb - 1; z += 4.5) out.push([xa + g.sw + 0.25, z], [xb - g.sw - 0.25, z])
    return out.filter(([x]) => Math.abs(x) > 1.2)
  }, [g])
  return (
    <group>
      <Streets g={g} road="#c4c9cd" walk="#eceff1" />
      {shops.map((s, i) => <Model key={i} def={s.def} p={[s.x, 0, s.z]} ry={s.ry} />)}
      {lamps.map(([x, z], i) => <Model key={i} def="lamp" p={[x, 0, z]} s={0.6} />)}
      {/* An old parking lot: bays painted round the edge. */}
      {Array.from({ length: Math.floor((X * 2) / 1.1) }, (_, i) => -X + 0.55 + i * 1.1).flatMap((x) =>
        [-1, 1].map((sd) => <Strip key={`${x}${sd}`} x={x} z={sd * (Z - 0.55)} w={0.05} d={1.1} c="#cfd8dc" y={0.02} />)
      )}
    </group>
  )
}

// ---- Countryside ----

const CROPS = ['#e6c157', '#8bc34a', '#d4a84a', '#7cb342', '#c5a35a']

function Field({ r, c, along }: { r: Rect; c: string; along: boolean }) {
  const w = r.x1 - r.x0
  const d = r.z1 - r.z0
  const rows = Math.floor((along ? w : d) / 0.7)
  return (
    <group>
      <Strip x={(r.x0 + r.x1) / 2} z={(r.z0 + r.z1) / 2} w={w} d={d} c={c} y={0.006} />
      {Array.from({ length: rows }, (_, i) => {
        const t = (i + 0.5) * 0.7
        return along ? (
          <Strip key={i} x={r.x0 + t} z={(r.z0 + r.z1) / 2} w={0.16} d={d - 0.3} c="#8d6e4a" y={0.014} />
        ) : (
          <Strip key={i} x={(r.x0 + r.x1) / 2} z={r.z0 + t} w={w - 0.3} d={0.16} c="#8d6e4a" y={0.014} />
        )
      })}
    </group>
  )
}

function Farmstead({ r }: { r: Rect }) {
  const cx = (r.x0 + r.x1) / 2
  const cz = (r.z0 + r.z1) / 2
  return (
    <group>
      <Strip x={cx} z={cz} w={r.x1 - r.x0} d={r.z1 - r.z0} c={PAL.ground} y={0.004} />
      <group position={[cx - 1.4, 0, cz - 0.6]}>
        <Box p={[0, 0.9, 0]} s={[2.2, 1.8, 2.8]} c="#b33a2e" />
        <Cone p={[0, 2.25, 0]} r={2.05} h={0.9} c="#5d4037" seg={4} ry={Math.PI / 4} />
        <Box p={[0, 0.6, 1.41]} s={[1, 1.2, 0.04]} c="#fafafa" />
      </group>
      <Cyl p={[cx + 0.4, 1.4, cz - 1.2]} r={0.6} h={2.8} c="#b0bec5" seg={12} />
      <Cone p={[cx + 0.4, 3.05, cz - 1.2]} r={0.66} h={0.5} c="#78909c" seg={12} />
      <Model def="house" p={[cx + 1.9, 0, cz + 1]} ry={Math.PI} />
      {[0, 1, 2].map((k) => <Cyl key={k} p={[cx - 1.8 + k * 0.6, 0.25, cz + 2.2]} r={0.25} h={0.45} c="#d9b44a" seg={10} rot={[0, 0, Math.PI / 2]} />)}
      <Model def="tree" p={[cx + 2.6, 0, cz - 1.6]} s={0.9} />
    </group>
  )
}

function Farm({ L }: { L: LotLayout }) {
  const { X, Z } = lotBounds(L)
  const g = useMemo(() => gridAround(X, Z, 0.5, 9), [X, Z])
  return (
    <group>
      <Streets g={g} road="#e8c79c" reach={20} paved={false} />
      {g.blocks.map(({ r, ix, iz }, i) =>
        ix === 0 && iz === 0 ? <Farmstead key={i} r={r} /> : <Field key={i} r={{ x0: r.x0 + 0.3, x1: r.x1 - 0.3, z0: r.z0 + 0.3, z1: r.z1 - 0.3 }} c={CROPS[i % CROPS.length]} along={(ix + iz) % 2 === 0} />
      )}
      {/* Tree lines along the outermost lanes. */}
      {[g.xs[0] - 1.4, g.xs[3] + 1.4].map((x) => Array.from({ length: 14 }, (_, k) => <Model key={`${x}${k}`} def="pine" p={[x, 0, g.zs[0] + k * 3]} s={0.85} />))}
      {Array.from({ length: Math.ceil((g.xs[3] - g.xs[0]) / 3) }, (_, k) => <Model key={k} def="pine" p={[g.xs[0] + k * 3, 0, g.zs[0] - 1.4]} s={0.85} />)}
    </group>
  )
}

// ---- Desert ----

function Desert({ L }: { L: LotLayout }) {
  const { X, Z } = lotBounds(L)
  const hwy = -(Z + 2.2) // highway along the back of the lot
  const items = useMemo(() => {
    const r = rand(41)
    const out: { x: number; z: number; kind: 'cactus' | 'rock' | 'mesa'; a: number; b: number }[] = []
    // Clumps rather than a grid: a few seeds, scatter round each.
    for (let c = 0; c < 70; c++) {
      const cx = (r() - 0.5) * 70
      const cz = -40 + r() * 58
      const n = 2 + Math.floor(r() * 4)
      for (let k = 0; k < n; k++) {
        const x = cx + (r() - 0.5) * 4
        const z = cz + (r() - 0.5) * 4
        const a = r()
        const b = r()
        const inLot = Math.abs(x) < X + 1 && Math.abs(z) < Z + 1
        const onRoad = Math.abs(z - hwy) < 1.6 || (Math.abs(x) < 1.6 && z > Z - 1)
        const nearStop = Math.abs(z - (hwy - 4)) < 3.5 && Math.abs(x - X * 0.6) < 6
        if (inLot || onRoad || nearStop) continue
        out.push({ x, z, a, b, kind: a < 0.55 ? 'cactus' : 'rock' })
      }
    }
    for (let k = 0; k < 9; k++) out.push({ x: (k - 4) * 9 + (r() - 0.5) * 4, z: hwy - 16 - r() * 10, a: r(), b: r(), kind: 'mesa' })
    return out
  }, [X, Z, hwy])
  return (
    <group>
      <Strip x={0} z={hwy} w={140} d={1.6} c="#d6dadd" t={roadTex(70, 1)} />
      <Strip x={0} z={hwy} w={140} d={0.06} c="#ffd54f" y={0.016} />
      {/* Telephone poles along the highway. */}
      {Array.from({ length: 16 }, (_, k) => (k - 7.5) * 6).map((x) => (
        <group key={x} position={[x, 0, hwy - 1.4]}>
          <Cyl p={[0, 1.3, 0]} r={0.05} h={2.6} c="#6d4c41" seg={5} />
          <Box p={[0, 2.45, 0]} s={[0.04, 0.05, 0.6]} c="#6d4c41" />
        </group>
      ))}
      {/* A lonely roadside stop across the highway. */}
      <Model def="gas" p={[X * 0.6 - 2.4, 0, hwy - 2.9]} ry={0} />
      <Model def="diner" p={[X * 0.6 + 2.4, 0, hwy - 2.9]} ry={0} />
      <Strip x={X * 0.6} z={hwy - 1.4} w={9.6} d={1.4} c="#8a8f94" y={0.01} />
      {items.map((p, i) => {
        if (p.kind === 'mesa') {
          const w = 4 + p.b * 5
          const h = 2 + p.a * 7
          return (
            <group key={i}>
              <Box p={[p.x, h / 2, p.z]} s={[w, h, w * 0.8]} c="#b85a32" />
              <Box p={[p.x, h + 0.25, p.z]} s={[w * 0.82, 0.5, w * 0.65]} c="#d07a46" />
            </group>
          )
        }
        if (p.kind === 'cactus') {
          const h = 0.8 + p.b
          return (
            <group key={i} position={[p.x, 0, p.z]}>
              <Cyl p={[0, h / 2, 0]} r={0.11} h={h} c="#4f8a3a" seg={7} />
              {p.b > 0.4 && (
                <>
                  <Cyl p={[0.18, h * 0.5, 0]} r={0.06} h={0.24} c="#4f8a3a" seg={6} rot={[0, 0, Math.PI / 2]} />
                  <Cyl p={[0.3, h * 0.64, 0]} r={0.065} h={0.34} c="#4f8a3a" seg={6} />
                </>
              )}
            </group>
          )
        }
        return (
          <mesh key={i} position={[p.x, 0.12, p.z]} scale={[0.4 + p.b * 0.4, 0.3 + p.b * 0.25, 0.35 + p.a * 0.3]}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#a65a35" flatShading />
          </mesh>
        )
      })}
    </group>
  )
}

// ---- Old race track ----

function along(L: LotLayout, step: number, off: number) {
  const out: { x: number; z: number; k: number }[] = []
  let i = 0
  for (let s = 0; s < L.len - step / 2; s += step) {
    while (i < L.cum.length - 2 && L.cum[i + 1] < s) i++
    const a = L.pts[i]
    const b = L.pts[i + 1]
    const seg = L.cum[i + 1] - L.cum[i] || 1
    const f = (s - L.cum[i]) / seg
    const tx = (b[0] - a[0]) / seg
    const tz = (b[1] - a[1]) / seg
    out.push({ x: a[0] + (b[0] - a[0]) * f - tz * off, z: a[1] + (b[1] - a[1]) * f + tx * off, k: out.length })
  }
  return out
}

function Track({ L }: { L: LotLayout }) {
  const { X, Z } = lotBounds(L)
  // Red and white kerbs inside the bend, tyre walls outside, both following the oval.
  const kerbs = useMemo(() => along(L, 0.5, -0.74), [L])
  const tyres = useMemo(() => along(L, 0.7, 0.98).filter((p) => !(Math.abs(p.x) < 1.2 && p.z > 0) && L.spots.every((s) => Math.hypot(s.x - p.x, s.z - p.z) > 1.8)), [L])
  const stand = -(Z + 2.6)
  const lights: [number, number][] = [[-X, -Z], [X, -Z], [-X, Z], [X, Z]]
  return (
    <group>
      {kerbs.map((p) => <Box key={p.k} p={[p.x, 0.03, p.z]} s={[0.26, 0.04, 0.26]} c={p.k % 2 ? '#fafafa' : '#e53935'} />)}
      {tyres.map((p) => (
        <group key={p.k}>
          <Cyl p={[p.x, 0.1, p.z]} r={0.22} h={0.18} c={p.k % 2 ? '#fafafa' : '#263238'} seg={10} />
          <Cyl p={[p.x, 0.28, p.z]} r={0.22} h={0.18} c={p.k % 2 ? '#263238' : '#fafafa'} seg={10} />
        </group>
      ))}
      {/* Grandstand along the back straight, under a red roof. */}
      {[0, 1, 2, 3].map((k) => <Box key={k} p={[0, 0.3 + k * 0.45, stand - k * 0.7]} s={[X * 2, 0.6 + k * 0.9, 0.8]} c={k % 2 ? '#90a4ae' : '#b0bec5'} />)}
      <Box p={[0, 3.6, stand - 2.4]} s={[X * 2 + 0.6, 0.12, 3]} c="#c62828" />
      {[-X, -X / 2, 0, X / 2, X].map((x) => <Box key={x} p={[x, 1.8, stand - 3.6]} s={[0.12, 3.6, 0.12]} c="#78909c" />)}
      {/* Pit garages down one side, facing the track. */}
      {Array.from({ length: Math.max(1, Math.floor((Z * 2 - 4) / 4.2)) }, (_, k) => <Model key={k} def={k % 2 ? 'tuner' : 'parts'} p={[-(X + 2.4), 0, -Z + 3 + k * 4.2]} ry={Math.PI / 2} />)}
      {/* Floodlight towers on the corners. */}
      {lights.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x * 1.08, 0, z * 1.04]}>
          <Cyl p={[0, 2.2, 0]} r={0.07} h={4.4} c="#78909c" seg={6} />
          <Box p={[0, 4.45, 0]} s={[0.7, 0.3, 0.12]} c="#eceff1" />
        </group>
      ))}
      {/* Car park on the far side, and a line of trees round the outside. */}
      <Strip x={X + 4.5} z={0} w={5} d={Z * 2} c="#6b7075" y={0.01} />
      {Array.from({ length: Math.floor((Z * 2) / 1.3) }, (_, k) => <Strip key={k} x={X + 4.5} z={-Z + 0.65 + k * 1.3} w={4.4} d={0.05} c="#eceff1" y={0.016} />)}
      {Array.from({ length: Math.floor((X * 2 + 16) / 3) }, (_, k) => <Model key={`t${k}`} def="tree" p={[-X - 8 + k * 3, 0, stand - 6]} s={0.9} />)}
      {Array.from({ length: Math.floor((Z * 2 + 6) / 3) }, (_, k) => [-1, 1].map((sd) => <Model key={`s${k}${sd}`} def="tree" p={[sd * (X + 8.5), 0, -Z - 3 + k * 3]} s={0.9} />))}
    </group>
  )
}

export function LotScenery({ theme, L }: { theme: string; L: LotLayout }) {
  if (theme === 'farm') return <Farm L={L} />
  if (theme === 'downtown') return <Downtown L={L} />
  if (theme === 'desert') return <Desert L={L} />
  if (theme === 'track') return <Track L={L} />
  return <Suburbs L={L} />
}
