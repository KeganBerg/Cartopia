import type { ReactNode } from 'react'
import { Color, ExtrudeGeometry, PlaneGeometry, Shape } from 'three'
import type { Body } from '../game/data'
import { growthStage } from '../game/growth'
import { Box, Cyl, Sign, Pool, Bulbs, GOLD, SNOW, type Mat, type NewModelProps, type V3 } from './NewBuildings'
import { Tree, Bench, Ball } from './edgeKit'
import { CarModel } from './CarModel'
import { MergeScale, Upright, useBays } from './mergeScale'
import { PEOPLE_SIZED } from './keepShape'
import { ROOFTOP } from './GrowthKit'
import { Glass } from './OfficeBuildings'
import { PAL } from './season'
import { awningTex, brickTex, concreteTex, grassTex, gravelTex, paverTex, shingleTex, sidingTex, asphaltTex, waterTex } from './textures'

// City homes: the Brick Townhouse, the Modern Duplex and the Lakeview Condos
// (see "More homes" in game/data.ts). Each grows in its own style at level 4
// and 7 (names in game/growth.ts): a rowhouse becomes a short terrace and then
// a grander brownstone terrace; the duplex a fourplex and then stacked loft
// cubes; the condo block a taller residence and then two slim glass towers
// round a rooftop pool. Walls take def.color and roofs def.roof, so the
// player's colour choice shows. Lots face +z.
//
// Merged pairs: a home is drawn once per lot along the pair, each copy in
// true shape (Lots below), so two townhouses make a little terrace instead of
// one stretched house. Square blocks grow the home evenly; free-standing
// people-sized pieces (cars, bins, benches) keep their size (keepShape.ts).

export const CITY_HOMES = new Set(['townhouse', 'duplex', 'condos'])

type K = { m: Mat; win: ReactNode; bulb: ReactNode; ghost?: boolean }

const IRON = '#263238'
const STONE = '#d7ccc8'
const TRIM = '#fafafa'
const WOOD = '#b07a4f'
const DECK = '#a1887f'
const RAIL = '#b3e5fc'
const STEEL = '#90a4ae'
const POT = '#8d6e63'
const DARK = '#37474f'
const FLOWERS = ['#ff4081', '#ffeb3b', '#ff7043', '#ce93d8']

// A lighter or darker take on a colour (k above 1 lightens towards white).
const shades = new Map<string, string>()
function shade(c: string, k: number) {
  const key = `${c}|${k}`
  let s = shades.get(key)
  if (s) return s
  const col = new Color(c)
  if (k > 1) col.lerp(new Color('#ffffff'), k - 1)
  else col.multiplyScalar(k)
  s = '#' + col.getHexString()
  shades.set(key, s)
  return s
}

// A column or row of windows as one plane: the shared window material tiled
// once per window (tw by th), so a tower's windows cost one mesh a column.
const strips = new Map<string, PlaneGeometry>()
function stripGeo(w: number, h: number, tw: number, th: number) {
  const key = [w, h, tw, th].map((v) => v.toFixed(3)).join('|')
  let g = strips.get(key)
  if (g) return g
  g = new PlaneGeometry(w, h)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tw, (uv.getY(i) * h) / th)
  strips.set(key, g)
  return g
}
function Strip({ win, at, w, h, tw = w, th = h, ry = 0 }: { win: ReactNode; at: V3; w: number; h: number; tw?: number; th?: number; ry?: number }) {
  return (
    <mesh position={at} rotation-y={ry} geometry={stripGeo(w, h, tw, th)}>
      {win}
    </mesh>
  )
}

const ONE: [number, number, number] = [1, 1, 1]
// One home per lot along a merged pair, each in true shape (sx, sz: a lot's
// size in the model's own units). Alone or in a square block it draws as is.
function Lots({ sx, sz, children }: { sx: number; sz: number; children: ReactNode }) {
  const [bx, bz] = useBays()
  const n = Math.round(Math.max(bx, bz))
  if (n <= 1) return <group>{children}</group>
  const alongX = bx >= bz
  const step = alongX ? sx : sz
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const t = ((i + 0.5) / n - 0.5) * step
        return (
          <group key={i} position={alongX ? [t, 0, 0] : [0, 0, t]}>
            <Upright>
              <MergeScale.Provider value={ONE}>{children}</MergeScale.Provider>
            </Upright>
          </group>
        )
      })}
    </group>
  )
}

// ---------- lot dressing ----------

function Lawn({ m, x, z, w, d, h = 0.05 }: { m: Mat; x: number; z: number; w: number; d: number; h?: number }) {
  return <Box m={m} at={[x, h / 2, z]} s={[w, h, d]} c="#ffffff" t={grassTex(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(d / 2)))} shadow={false} />
}

function Pave({ m, x, z, w, d, h = 0.03, c = '#ffffff', tex = 'paver' }: { m: Mat; x: number; z: number; w: number; d: number; h?: number; c?: string; tex?: 'paver' | 'asphalt' | 'concrete' }) {
  const t = tex === 'paver' ? paverTex(Math.max(1, Math.round(w * 1.5)), Math.max(1, Math.round(d * 1.5))) : tex === 'asphalt' ? asphaltTex() : concreteTex(1, 1)
  return <Box m={m} at={[x, h / 2, z]} s={[w, h, d]} c={c} t={t} shadow={false} />
}

function Shrub({ at, r = 0.12, c = PAL.bush[0] }: { at: V3; r?: number; c?: string }) {
  return (
    <mesh position={[at[0], at[1] + r * 0.8, at[2]]} castShadow>
      <icosahedronGeometry args={[r, 0]} />
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  )
}

function HomeTree({ m, at, s = 0.6 }: { m: Mat; at: V3; s?: number }) {
  return <Tree m={m} at={at} s={s} leaves={PAL.leaves} bare={PAL.bare} />
}

// A family car, parked: true size whatever block it stands in.
function Car({ at, rot = 0, body = 'hatch', color, s = 0.72 }: { at: V3; rot?: number; body?: Body; color: string; s?: number }) {
  return (
    <group position={at}>
      <Upright size={1}>
        <group rotation-y={rot} scale={s}>
          <CarModel body={body} color={color} />
        </group>
      </Upright>
    </group>
  )
}

function Mailbox({ m, at, c = '#1565c0', ry = 0 }: { m: Mat; at: V3; c?: string; ry?: number }) {
  return (
    <group position={at} rotation-y={ry}>
      <Box m={m} at={[0, 0.17, 0]} s={[0.03, 0.34, 0.03]} c="#5d4037" />
      <Box m={m} at={[0, 0.38, 0]} s={[0.1, 0.09, 0.16]} c={c} />
      <Box m={m} at={[0.056, 0.4, 0.03]} s={[0.012, 0.07, 0.02]} c="#e53935" shadow={false} />
    </group>
  )
}

// Two wheelie bins with their lids.
function Bins({ m, at, ry = 0 }: { m: Mat; at: V3; ry?: number }) {
  return (
    <group position={at} rotation-y={ry}>
      {([[-0.075, '#2e7d32'], [0.075, '#1565c0']] as const).map(([x, c]) => (
        <group key={x} position={[x, 0, 0]}>
          <Box m={m} at={[0, 0.11, 0]} s={[0.12, 0.22, 0.13]} c="#455a64" />
          <Box m={m} at={[0, 0.23, -0.005]} s={[0.13, 0.02, 0.14]} c={c} />
        </group>
      ))}
    </group>
  )
}

// Iron railings: pickets between a top and bottom rail, `a` to `b` along x or z.
function Railing({ m, a, b, h = 0.28, c = IRON, gap = 0.1, glass }: { m: Mat; a: [number, number]; b: [number, number]; h?: number; c?: string; gap?: number; glass?: boolean }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const alongX = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])
  const mx = (a[0] + b[0]) / 2
  const mz = (a[1] + b[1]) / 2
  const s = (t: number, y: number): V3 => (alongX ? [t, y, 0] : [0, y, t])
  const n = Math.max(1, Math.round(len / gap))
  return (
    <group position={[mx, 0, mz]}>
      {glass ? (
        <Box m={m} at={s(0, h / 2 - 0.005)} s={alongX ? [len, h - 0.01, 0.012] : [0.012, h - 0.01, len]} c={RAIL} shadow={false} />
      ) : (
        <>
          {Array.from({ length: n - 1 }, (_, i) => <Box key={i} m={m} at={s(-len / 2 + (len * (i + 1)) / n, h / 2)} s={[0.014, h, 0.014]} c={c} shadow={false} />)}
          <Box m={m} at={s(0, 0.075)} s={alongX ? [len, 0.02, 0.018] : [0.018, 0.02, len]} c={c} shadow={false} />
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={s((sd * len) / 2, h / 2)} s={[0.03, h, 0.03]} c={c} shadow={false} />)}
        </>
      )}
      <Box m={m} at={s(0, h)} s={alongX ? [len + 0.02, 0.022, 0.026] : [0.026, 0.022, len + 0.02]} c={glass ? STEEL : c} shadow={false} />
    </group>
  )
}

function Planter({ m, at, w = 0.24, d = 0.12, h = 0.12, c = POT, flowers }: { m: Mat; at: V3; w?: number; d?: number; h?: number; c?: string; flowers?: boolean }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, h / 2, 0]} s={[w, h, d]} c={c} />
      {[-1, 1].map((sd) => <Shrub key={sd} at={[(sd * w) / 4, h - 0.02, 0]} r={Math.min(0.07, d * 0.55)} c={flowers && sd > 0 ? FLOWERS[0] : PAL.bush[0]} />)}
    </group>
  )
}

// Ornamental grass in a concrete cube, for the modern homes.
function GrassPot({ m, at, s = 0.14 }: { m: Mat; at: V3; s?: number }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, s / 2, 0]} s={[s, s, s]} c="#bdbdbd" t={concreteTex(1, 1)} />
      {[-0.03, 0.03].map((x, i) => (
        <mesh key={x} position={[x, s + 0.07, i ? 0.02 : -0.02]} rotation-z={x * 4} castShadow>
          <coneGeometry args={[0.035, 0.18, 5]} />
          <meshStandardMaterial color={PAL.fronds[i]} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function Lounger({ m, at, ry = 0, c = TRIM }: { m: Mat; at: V3; ry?: number; c?: string }) {
  return (
    <group position={at} rotation-y={ry}>
      <Box m={m} at={[0, 0.05, 0.04]} s={[0.14, 0.03, 0.26]} c={c} />
      <Box m={m} at={[0, 0.1, -0.13]} s={[0.14, 0.03, 0.14]} c={c} rot={[0.6, 0, 0]} />
      {[-0.06, 0.06].map((x) => <Box key={x} m={m} at={[x, 0.02, 0.04]} s={[0.015, 0.04, 0.24]} c={STEEL} shadow={false} />)}
    </group>
  )
}

// A pool umbrella: a pole in a weighted base under a striped canopy.
function Umbrella({ m, at, c }: { m: Mat; at: V3; c: string }) {
  return (
    <group position={at} userData={PEOPLE_SIZED}>
      <Cyl m={m} at={[0, 0.02, 0]} r={0.06} h={0.04} c={STEEL} seg={10} />
      <Cyl m={m} at={[0, 0.25, 0]} r={0.012} h={0.46} c={TRIM} seg={6} />
      <mesh position={[0, 0.5, 0]} castShadow>
        <coneGeometry args={[0.26, 0.12, 8]} />
        {m('#ffffff', awningTex(c))}
      </mesh>
    </group>
  )
}

// Solar panels on a low frame, tilted to the sun.
function Solar({ m, at, w = 0.42, d = 0.28 }: { m: Mat; at: V3; w?: number; d?: number }) {
  const tilt = 0.32
  const rise = (d / 2) * Math.sin(tilt)
  return (
    <group position={at}>
      <Box m={m} at={[0, rise + 0.03, 0]} s={[w, 0.02, d]} c="#1a237e" rot={[-tilt, 0, 0]} />
      <Box m={m} at={[0, 0.02, -d / 2 + 0.03]} s={[w - 0.04, 0.04 + rise, 0.03]} c={STEEL} shadow={false} />
      <Box m={m} at={[0, 0.015, d / 2 - 0.05]} s={[w - 0.04, 0.03, 0.03]} c={STEEL} shadow={false} />
    </group>
  )
}

// A pergola: four posts, two beams and slats, with bulbs strung along it.
function Pergola({ m, at, w, d, h = 0.5, c = DARK, lights }: { m: Mat; at: V3; w: number; d: number; h?: number; c?: string; lights?: boolean }) {
  const slats = Math.max(3, Math.round(w / 0.14))
  return (
    <group position={at}>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} m={m} at={[(sx * (w - 0.04)) / 2, h / 2, (sz * (d - 0.04)) / 2]} s={[0.035, h, 0.035]} c={c} />))}
      {[-1, 1].map((sz) => <Box key={sz} m={m} at={[0, h + 0.02, (sz * (d - 0.04)) / 2]} s={[w + 0.06, 0.04, 0.035]} c={c} />)}
      {Array.from({ length: slats }, (_, i) => (
        <Box key={i} m={m} at={[-w / 2 + 0.03 + ((w - 0.06) * i) / (slats - 1), h + 0.055, 0]} s={[0.025, 0.03, d + 0.04]} c={c} shadow={false} />
      ))}
      {lights && <Bulbs from={[-w / 2, h - 0.01, d / 2 - 0.02]} to={[w / 2, h - 0.01, d / 2 - 0.02]} n={Math.max(4, Math.round(w * 7))} sag={0.05} />}
    </group>
  )
}

// A garden lantern on an iron post that lights the path at night.
function PostLamp({ m, bulb, at, ghost, h = 0.5 }: { m: Mat; bulb: ReactNode; at: V3; ghost?: boolean; h?: number }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, h / 2, 0]} r={0.018} r2={0.026} h={h} c={IRON} seg={6} />
      <mesh position={[0, h + 0.04, 0]}><boxGeometry args={[0.07, 0.08, 0.07]} />{bulb}</mesh>
      <mesh position={[0, h + 0.1, 0]} castShadow><coneGeometry args={[0.065, 0.05, 4]} />{m(IRON)}</mesh>
      {!ghost && <Pool r={0.4} />}
    </group>
  )
}

// ---------- the Brick Townhouse ----------

const B = 0.36 // the garden level's stone base, the stoop's height
const FH = 0.55 // a storey
const MH = 0.46 // a mansard's height

// A sash window: glass, a stone sill and lintel, and maybe a window box of flowers.
function Sash({ k, x, y, z, w = 0.22, h = 0.34, flowers, c = STONE, sill = true }: { k: K; x: number; y: number; z: number; w?: number; h?: number; flowers?: boolean; c?: string; sill?: boolean }) {
  const { m, win, ghost } = k
  return (
    <group>
      <mesh position={[x, y, z + 0.006]}><planeGeometry args={[w, h]} />{win}</mesh>
      {sill && <Box m={m} at={[x, y - h / 2 - 0.015, z + 0.03]} s={[w + 0.06, 0.03, 0.06]} c={c} shadow={false} />}
      <Box m={m} at={[x, y + h / 2 + 0.025, z + 0.015]} s={[w + 0.06, 0.05, 0.03]} c={c} shadow={false} />
      {flowers && !ghost && (
        <group position={[x, y - h / 2, z + 0.065]}>
          <Box m={m} at={[0, 0.035, 0]} s={[w + 0.02, 0.07, 0.07]} c="#5d4037" shadow={false} />
          {[-1, 1].map((i) => <Ball key={i} m={m} at={[(i * w) / 4, 0.085, 0]} r={0.045} c={FLOWERS[(i + 2) % 4]} flat />)}
        </group>
      )}
    </group>
  )
}

// A stoop in one piece: the landing at door height and three steps down,
// drawn from the wall (z = 0) out along +z, 0.36 wide about x = 0.
let stoopGeo: ExtrudeGeometry | undefined
function stoop() {
  if (stoopGeo) return stoopGeo
  const p = [[0, 0], [0.55, 0], [0.55, 0.25], [0.44, 0.25], [0.44, 0.5], [0.33, 0.5], [0.33, 0.75], [0.22, 0.75], [0.22, 1], [0, 1]]
  const sh = new Shape()
  p.forEach(([u, v], i) => (i ? sh.lineTo(u, v * B) : sh.moveTo(u, v * B)))
  stoopGeo = new ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: false })
  stoopGeo.rotateY(-Math.PI / 2)
  stoopGeo.translate(0.18, 0, 0)
  return stoopGeo
}

// The way in: a panelled door in a stone surround under a hood (on the grand
// houses a little iron balcony instead), a transom over it, and the stoop up
// to it with iron railings and a lamp, or a lantern, on each newel post.
function Entry({ k, dx, zf, door, lamps = true, panels, stone = STONE, balcony, lantern }: {
  k: K; dx: number; zf: number; door: string; lamps?: boolean; panels?: boolean; stone?: string; balcony?: boolean; lantern?: boolean
}) {
  const { m, win, bulb, ghost } = k
  return (
    <group>
      <Box m={m} at={[dx, B + 0.31, zf + 0.015]} s={[0.34, 0.62, 0.03]} c={stone} />
      <mesh position={[dx, B + 0.25, zf + 0.034]}><planeGeometry args={[0.24, 0.5]} />{m(door)}</mesh>
      <mesh position={[dx, B + 0.55, zf + 0.034]}><planeGeometry args={[0.24, 0.07]} />{win}</mesh>
      {panels && [0.13, 0.37].map((yy) => <Box key={yy} m={m} at={[dx, B + yy, zf + 0.04]} s={[0.16, 0.16, 0.012]} c={shade(door, 0.8)} shadow={false} />)}
      {balcony ? (
        <group>
          <Box m={m} at={[dx, B + 0.64, zf + 0.08]} s={[0.42, 0.04, 0.16]} c={stone} />
          <group position-y={B + 0.66}>
            <Railing m={m} a={[dx - 0.19, zf + 0.14]} b={[dx + 0.19, zf + 0.14]} h={0.2} gap={0.2} />
          </group>
        </group>
      ) : (
        <Box m={m} at={[dx, B + 0.64, zf + 0.06]} s={[0.42, 0.04, 0.12]} c={stone} />
      )}
      {!balcony && <Box m={m} at={[dx, B + 0.64, zf + 0.123]} s={[0.1, 0.025, 0.006]} c={GOLD} shadow={false} />}
      <mesh position={[dx, 0, zf]} geometry={stoop()} castShadow receiveShadow>{m(stone)}</mesh>
      {[-1, 1].map((sd) => {
        const rx = dx + sd * 0.15
        const z1 = zf + 0.2
        const z2 = zf + 0.525
        const y1 = B + 0.3
        const y2 = 0.36
        const L = Math.hypot(z2 - z1, y1 - y2)
        return (
          <group key={sd}>
            <Box m={m} at={[rx, y1, zf + 0.1]} s={[0.022, 0.022, 0.2]} c={IRON} shadow={false} />
            <Box m={m} at={[rx, (y1 + y2) / 2, (z1 + z2) / 2]} s={[0.022, 0.022, L]} rot={[Math.atan2(y1 - y2, z2 - z1), 0, 0]} c={IRON} shadow={false} />
            <Box m={m} at={[rx, 0.18, z2]} s={[0.04, 0.36, 0.04]} c={IRON} />
            {lamps && !lantern && <mesh position={[rx, 0.41, z2]}><sphereGeometry args={[0.045, 10, 8]} />{bulb}</mesh>}
            {lantern && (
              <group position={[rx, 0.36, z2]}>
                <mesh position={[0, 0.06, 0]}><boxGeometry args={[0.07, 0.12, 0.07]} />{bulb}</mesh>
                <mesh position={[0, 0.145, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.065, 0.05, 4]} />{m(IRON)}</mesh>
              </group>
            )}
          </group>
        )
      })}
      {!ghost && (lamps || lantern) && <Pool r={0.45} x={dx} z={zf + 0.5} />}
    </group>
  )
}

type Row = {
  k: K; x: number; w: number; zb: number; d: number; floors: number; wall: string; roof: string; door: string
  bay?: boolean; boxes?: boolean; mansard?: boolean; sides?: number[]; over?: number; chimney?: number; lamps?: boolean
}

// One brick rowhouse on a stone garden level: stoop and railings up to a
// panelled door, a two-storey bay window, a cornice on brackets, and from
// level 3 a slate mansard with dormers.
function Rowhouse({ k, x, w, zb, d, floors, wall, roof, door, bay, boxes, mansard, sides = [], over = 0, chimney = 1, lamps = true }: Row) {
  const { m, win } = k
  const zf = zb + d
  const zc = zb + d / 2
  const H = B + floors * FH
  const dx = -w / 2 + 0.21
  const right = dx + 0.17
  const bw = Math.min(0.6, w / 2 - right - 0.08)
  const hasBay = !!bay && bw > 0.3
  const bx = (right + w / 2) / 2
  const cx = (right + w / 2) / 2
  const sw = Math.min(0.22, w / 2 - right - 0.09)
  const y = (f: number) => B + f * FH + 0.26
  const roofTop = mansard ? H + 0.05 + MH : H + 0.05
  const cols = hasBay ? [dx, bx - bw / 4, bx + bw / 4] : [dx, cx]
  return (
    <group position={[x, 0, 0]}>
      {/* Stone garden level, brick storeys, and a band between them. */}
      <Box m={m} at={[0, B / 2, zc]} s={[w, B, d]} c={STONE} t={concreteTex(1, 1)} />
      <Box m={m} at={[0, B + (H - B) / 2, zc]} s={[w, H - B, d]} c={wall} t={brickTex(Math.max(1, Math.round(w * 0.9)), Math.max(1, Math.round((H - B) * 0.9)))} />
      {over > 0 ? <Box m={m} at={[0, B, zc]} s={[w + over * 2, 0.05, d + 0.02]} c={STONE} shadow={false} /> : <Box m={m} at={[0, B, zf + 0.012]} s={[w, 0.05, 0.024]} c={STONE} shadow={false} />}
      {/* Cornice on brackets, a frieze under it, and the gravel roof behind. */}
      <Box m={m} at={[0, H + 0.05, zf - 0.06]} s={[w + over * 2, 0.1, 0.22]} c={roof} />
      <Box m={m} at={[0, H - 0.03, zf + 0.01]} s={[w, 0.06, 0.02]} c={roof} shadow={false} />
      {(over > 0 ? [-0.4, 0, 0.4] : [0]).map((t) => <Box key={t} m={m} at={[t * (w - 0.1), H - 0.03, zf + 0.04]} s={[0.04, 0.06, 0.08]} c={roof} shadow={false} />)}
      <Box m={m} at={[0, H + 0.025, zc - 0.03]} s={[w - 0.01, 0.05, d - 0.07]} c={ROOFTOP} t={SNOW ? undefined : gravelTex(1, 1)} />
      <Entry k={k} dx={dx} zf={zf} door={door} lamps={lamps} panels={over > 0} />
      {/* The bay window: stone below, brick up two storeys, glass on three sides. */}
      {hasBay && (
        <group>
          <Box m={m} at={[bx, B / 2, zf + 0.1]} s={[bw, B, 0.2]} c={STONE} t={concreteTex(1, 1)} />
          <Box m={m} at={[bx, B + FH - 0.01, zf + 0.1]} s={[bw, FH * 2 - 0.02, 0.2]} c={wall} t={brickTex(1, 1)} />
          <mesh position={[bx, B * 0.5, zf + 0.206]}><planeGeometry args={[bw - 0.24, 0.16]} />{win}</mesh>
          {[0, 1].map((f) => (
            <group key={f}>
              <mesh position={[bx, y(f), zf + 0.206]}><planeGeometry args={[bw - 0.12, 0.34]} />{win}</mesh>
              {[-1, 1].map((sd) => (
                <mesh key={sd} position={[bx + sd * (bw / 2 + 0.006), y(f), zf + 0.1]} rotation-y={(sd * Math.PI) / 2}>
                  <planeGeometry args={[0.12, 0.34]} />
                  {win}
                </mesh>
              ))}
              {[-1, 1].map((sd) => <Box key={sd} m={m} at={[bx + (sd * (bw - 0.12)) / 6, y(f), zf + 0.214]} s={[0.025, 0.34, 0.012]} c={TRIM} shadow={false} />)}
              <Box m={m} at={[bx, y(f) - 0.19, zf + 0.1]} s={[bw + 0.03, 0.035, 0.23]} c={STONE} shadow={false} />
            </group>
          ))}
          <Box m={m} at={[bx, B + FH * 2 + 0.01, zf + 0.115]} s={[bw + 0.06, 0.06, 0.25]} c={roof} />
        </group>
      )}
      {!hasBay && <mesh position={[cx, B * 0.5, zf + 0.006]}><planeGeometry args={[sw, 0.16]} />{win}</mesh>}
      {/* Sash windows up the front, window boxes from level 2. */}
      {Array.from({ length: floors }, (_, f) => cols.map((c, i) => {
        if (i === 0 && f === 0) return null
        if (hasBay && i > 0 && f < 2) return null
        const ww = i === 0 ? 0.22 : hasBay ? 0.2 : sw
        // The window over the door sits clear of its hood.
        const lift = i === 0 && f === 1 ? 0.04 : 0
        return <Sash key={`${f}${c}`} k={k} x={c} y={y(f) + lift} z={zf} w={ww} flowers={boxes && f === 1} />
      }))}
      {/* Windows down the open sides and across the back. */}
      {sides.map((sd) => (
        <group key={sd} position={[(sd * w) / 2, 0, zc]} rotation-y={(sd * Math.PI) / 2}>
          {Array.from({ length: floors }, (_, f) => [-0.24, 0.24].map((t) => (
            <mesh key={`${f}${t}`} position={[t * d, y(f), 0.006]}><planeGeometry args={[0.22, 0.34]} />{win}</mesh>
          )))}
        </group>
      ))}
      <group position={[0, 0, zb]} rotation-y={Math.PI}>
        {[-0.25, 0.25].map((t) => <Strip key={t} win={win} at={[t * w, B + (floors * FH) / 2, 0.006]} w={Math.min(0.22, w * 0.35)} h={floors * FH - 0.2} th={(floors * FH - 0.2) / floors} />)}
      </group>
      {/* Slate mansard with white dormers. */}
      {mansard && (
        <group>
          <Box m={m} at={[0, H + 0.05 + MH / 2, zb + (d - 0.3) / 2]} s={[w, MH, d - 0.3]} c={roof} t={shingleTex(Math.max(1, Math.round(w * 2)), 1)} />
          <Box m={m} at={[0, H + 0.075 + MH / 2, zf - 0.18]} s={[w, Math.hypot(0.24, MH - 0.05), 0.04]} rot={[-Math.atan2(0.24, MH - 0.05), 0, 0]} c={roof} t={shingleTex(Math.max(1, Math.round(w * 2)), 1)} />
          <Box m={m} at={[0, roofTop + 0.02, zb + (d - 0.3) / 2]} s={[w + over * 2, 0.04, d - 0.28]} c={roof} />
          {(hasBay ? cols.filter((_, i) => i !== 1) : over > 0 ? cols : [0]).map((c) => (
            <group key={c} position={[c + (hasBay && c !== dx ? -bw / 4 : 0), H + 0.1, zf - 0.17]}>
              <Box m={m} at={[0, 0.16, 0]} s={[0.26, 0.3, 0.24]} c={TRIM} />
              <mesh position={[0, 0.16, 0.126]}><planeGeometry args={[0.17, 0.2]} />{win}</mesh>
              <Box m={m} at={[0, 0.33, -0.005]} s={[0.32, 0.04, 0.28]} c={roof} />
            </group>
          ))}
        </group>
      )}
      {/* A roof hatch on the flat roof. */}
      {!mansard && <Box m={m} at={[0, H + 0.09, zc - 0.05]} s={[0.2, 0.08, 0.22]} c={STEEL} />}
      {/* Brick chimney with two pots on the party wall. */}
      {chimney !== 0 && (
        <group position={[chimney * (w / 2 - 0.1), roofTop + (mansard ? 0.04 : 0), zb + 0.2]}>
          <Box m={m} at={[0, 0.15, 0]} s={[0.15, 0.3, 0.24]} c={shade(wall, 0.85)} t={brickTex(1, 1)} />
          <Box m={m} at={[0, 0.315, 0]} s={[0.19, 0.03, 0.28]} c={STONE} />
          {[-0.05, 0.05].map((z) => <Cyl key={z} m={m} at={[0, 0.37, z]} r={0.03} r2={0.035} h={0.08} c="#bf6b4a" seg={8} />)}
        </group>
      )}
    </group>
  )
}

// A run of front-garden railings with a gate gap: from `a` to `b` along z = `z`.
function GardenFence({ m, a, b, z }: { m: Mat; a: number; b: number; z: number }) {
  if (b - a < 0.08) return null
  return <Railing m={m} a={[a, z]} b={[b, z]} h={0.26} gap={0.09} />
}

// Level 1-3: one tall brick rowhouse beside its driveway.
function Townhouse({ k, def, lvl }: { k: K; def: NewModelProps['def']; lvl: number }) {
  const { m, ghost } = k
  const x = -0.33
  const w = 1.2
  const zb = -0.93
  const d = 1.18
  const zf = zb + d
  const door = x - w / 2 + 0.21
  return (
    <group>
      <Rowhouse k={k} x={x} w={w} zb={zb} d={d} floors={3} wall={def.color} roof={def.roof} door="#1b5e20" bay boxes={lvl >= 2} mansard={lvl >= 3} sides={[1]} over={0.03} chimney={-1} />
      {/* Front garden behind iron railings, stone gate piers by the stoop. */}
      <Lawn m={m} x={-0.08} z={(zf + 0.91) / 2} w={0.76} d={0.91 - zf} />
      <Pave m={m} x={door} z={0.875} w={0.36} d={0.15} h={0.035} c={STONE} tex="concrete" />
      <GardenFence m={m} a={door + 0.24} b={0.28} z={0.94} />
      <Railing m={m} a={[0.3, zf + 0.22]} b={[0.3, 0.92]} h={0.26} gap={0.09} />
      {[door - 0.2, door + 0.2].map((px) => (
        <group key={px} position={[px, 0, 0.94]}>
          <Box m={m} at={[0, 0.17, 0]} s={[0.08, 0.34, 0.08]} c={STONE} />
          <Box m={m} at={[0, 0.355, 0]} s={[0.1, 0.03, 0.1]} c={STONE} />
          {lvl >= 2 && !ghost && <Shrub at={[0, 0.37, 0]} r={0.06} c={PAL.bush[0]} />}
        </group>
      ))}
      <Shrub at={[0.15, 0.05, zf + 0.33]} r={0.11} />
      <Shrub at={[-0.38, 0.05, 0.82]} r={0.09} />
      {lvl >= 2 && !ghost && [-0.25, -0.1, 0.05].map((fx, i) => <Ball key={fx} m={m} at={[fx, 0.08, 0.86]} r={0.045} c={FLOWERS[i]} flat />)}
      {/* Paved driveway down the side: the family car, the bins, a tree out back. */}
      <Pave m={m} x={0.655} z={0.02} w={0.58} d={1.9} />
      {!ghost && <Car at={[0.655, 0.03, 0.42]} rot={Math.PI} body="hatch" color="#e53935" />}
      {!ghost && lvl >= 3 && <Bins m={m} at={[0.47, 0.03, -0.3]} ry={Math.PI / 2} />}
      {!ghost && lvl < 3 && <Bins m={m} at={[0.47, 0.03, -0.3]} ry={Math.PI / 2} />}
      <HomeTree m={m} at={[0.68, 0.03, -0.68]} s={0.6} />
    </group>
  )
}

const TW = 0.63 // a terrace house's width
const TZB = -0.93 // its back wall
const TD = 1.13 // its depth
const TXS = [-TW, 0, TW]

// Level 4-6: Row Houses, a terrace of three in shades of the brick.
function RowHouses({ k, def, lvl }: { k: K; def: NewModelProps['def']; lvl: number }) {
  const tints = [1, 0.84, 1.12]
  const doors = ['#1b5e20', '#b71c1c', '#0d47a1']
  return (
    <group>
      {TXS.map((x, i) => (
        <Rowhouse key={x} k={k} x={x} w={TW} zb={TZB} d={TD} floors={3} wall={shade(def.color, tints[i])} roof={def.roof} door={doors[i]}
          boxes={lvl >= 5} mansard={lvl >= 6} sides={i === 2 ? [1] : []} chimney={i === 1 ? 0 : i === 0 ? -1 : 1} lamps={i !== 1 || lvl >= 5} />
      ))}
      <Gardens k={k} lvl={lvl} />
    </group>
  )
}

// The terrace's front gardens: a lawn behind iron railings beside each stoop,
// trees from level 5 (clipped bays in stone urns from 7), and at level 6-8 a
// lamp by the first gate (then lanterns on the stoops take over).
function Gardens({ k, lvl }: { k: K; lvl: number }) {
  const { m, bulb, ghost } = k
  const zf = TZB + TD
  return (
    <group>
      {TXS.map((x) => {
        const door = x - TW / 2 + 0.21
        return (
          <group key={x}>
            <Lawn m={m} x={(door + 0.2 + x + TW / 2) / 2} z={(zf + 0.91) / 2} w={x + TW / 2 - door - 0.2} d={0.91 - zf} />
            <GardenFence m={m} a={door + 0.22} b={x + TW / 2 - 0.03} z={0.94} />
            <Shrub at={[x + TW / 2 - 0.12, 0.05, zf + 0.2]} r={0.09} />
          </group>
        )
      })}
      {lvl >= 5 && lvl < 7 && [-TW, TW].map((x) => <HomeTree key={x} m={m} at={[x + 0.21, 0.05, 0.72]} s={0.42} />)}
      {lvl >= 7 && TXS.map((x) => (
        <group key={x} position={[x + 0.21, 0.05, 0.72]}>
          <Cyl m={m} at={[0, 0.06, 0]} r={0.07} r2={0.05} h={0.12} c={STONE} seg={8} />
          <mesh position={[0, 0.27, 0]} castShadow><coneGeometry args={[0.09, 0.32, 7]} />{m(PAL.bush[0])}</mesh>
        </group>
      ))}
      {lvl >= 6 && lvl < 9 && <PostLamp m={m} bulb={bulb} ghost={ghost} at={[-0.95 + 0.04, 0, 0.94]} h={0.5} />}
    </group>
  )
}

const COPPER = '#c0784a'
// A blend of two colours (t of the way from a to b).
function mix(a: string, b: string, t: number) {
  const key = `${a}>${b}|${t}`
  let s = shades.get(key)
  if (s) return s
  s = '#' + new Color(a).lerp(new Color(b), t).getHexString()
  shades.set(key, s)
  return s
}

// One house of the Brownstone Terrace: four storeys, the garden and parlour
// floors in brownstone and brick above, with brownstone lintels and sills.
// A dormer in the mansard above. g counts the steps past level 6: an oriel
// and a balcony over the door (2), a roof garden and stoop lanterns (3),
// copper caps (4).
function Brownstone({ k, x, wall, stone, dressed, roof, door, g, chimney, side }: {
  k: K; x: number; wall: string; stone: string; dressed: string; roof: string; door: string; g: number; chimney: number; side?: boolean
}) {
  const { m, win, ghost } = k
  const w = TW
  const zb = TZB
  const d = TD
  const zf = zb + d
  const zc = zb + d / 2
  const floors = 4
  const H = B + floors * FH
  const SB = B + FH
  const dx = -w / 2 + 0.21
  const cx = (dx + 0.17 + w / 2) / 2
  const sw = 0.16
  const y = (f: number) => B + f * FH + 0.26
  const trim = dressed
  const oriel = g >= 2
  const OB = y(1) - 0.23
  const OT = y(2) + 0.23
  const ow = 0.22
  const od = 0.13
  const roofTop = H + 0.05 + MH
  return (
    <group position={[x, 0, 0]}>
      {/* Brownstone garden and parlour floors, brick above. */}
      <Box m={m} at={[0, SB / 2, zc]} s={[w, SB, d]} c={stone} t={concreteTex(1, 2)} />
      <Box m={m} at={[0, SB + (H - SB) / 2, zc]} s={[w, H - SB, d]} c={wall} t={brickTex(1, Math.max(1, Math.round((H - SB) * 0.9)))} />
      <Entry k={k} dx={dx} zf={zf} door={door} stone={dressed} balcony={g >= 2} lantern={g >= 3} />
      <mesh position={[cx, B * 0.5, zf + 0.006]}><planeGeometry args={[sw, 0.16]} />{win}</mesh>
      {/* Tall sash windows; over the balcony a pair of glass doors. */}
      {Array.from({ length: floors }, (_, f) => [dx, cx].map((c, i) => {
        if (i === 0 && f === 0) return null
        if (i === 1 && oriel && (f === 1 || f === 2)) return null
        if (i === 0 && f === 1 && g >= 2) return <Sash key={`${f}${c}`} k={k} x={c} y={B + 0.67 + 0.22} z={zf} w={0.22} h={0.42} c={trim} sill={false} />
        // Above the parlour floor the sills are one stone course along the row.
        return <Sash key={`${f}${c}`} k={k} x={c} y={y(f)} z={zf} w={i ? sw : 0.22} c={trim} sill={f === 0} flowers={g === 1 && f === 1} />
      }))}
      {/* The oriel: a brick bay on a stone corbel, glazed both floors. */}
      {oriel && (
        <group position={[cx, 0, zf]}>
          <Box m={m} at={[0, OB - 0.05, (od - 0.03) / 2]} s={[ow - 0.06, 0.1, od - 0.03]} c={trim} />
          <Box m={m} at={[0, (OB + OT) / 2, od / 2]} s={[ow, OT - OB, od]} c={wall} t={brickTex(1, 2)} />
          {[1, 2].map((f) => <mesh key={f} position={[0, y(f), od + 0.005]}><planeGeometry args={[ow - 0.07, 0.36]} />{win}</mesh>)}
          <Box m={m} at={[0, OT + 0.025, (od + 0.04) / 2]} s={[ow + 0.04, 0.05, od + 0.04]} c={g >= 4 ? COPPER : roof} />
        </group>
      )}
      {/* Windows down the open side and across the back. */}
      {side && (
        <group position={[w / 2, 0, zc]} rotation-y={Math.PI / 2}>
          {Array.from({ length: floors }, (_, f) => [-0.24, 0.24].map((t) => (
            <mesh key={`${f}${t}`} position={[t * d, y(f), 0.006]}><planeGeometry args={[0.2, 0.34]} />{win}</mesh>
          )))}
        </group>
      )}
      <group position={[0, 0, zb]} rotation-y={Math.PI}>
        <Strip win={win} at={[0, B + (floors * FH) / 2, 0.006]} w={0.44} h={floors * FH - 0.2} tw={0.22} th={(floors * FH - 0.2) / floors} />
      </group>
      {/* Roof garden: a planter of shrubs and flowers on the mansard's flat top. */}
      {g >= 3 && !ghost && <Planter m={m} at={[0, roofTop + 0.04, -0.3]} w={0.4} d={0.14} flowers />}
      {/* A dormer in the mansard, white under a slate cap (copper at level 10). */}
      <group position={[0.02, H + 0.1, zf - 0.17]}>
        <Box m={m} at={[0, 0.16, 0]} s={[0.28, 0.3, 0.24]} c={TRIM} />
        <mesh position={[0, 0.15, 0.126]}><planeGeometry args={[0.19, 0.2]} />{win}</mesh>
        <Box m={m} at={[0, 0.33, -0.005]} s={[0.34, 0.04, 0.28]} c={g >= 4 ? COPPER : roof} />
      </group>
      {/* Brick chimney with two pots on the party wall. */}
      {chimney !== 0 && (
        <group position={[chimney * (w / 2 - 0.1), roofTop + 0.04, zb + 0.2]}>
          <Box m={m} at={[0, 0.15, 0]} s={[0.15, 0.3, 0.24]} c={shade(wall, 0.85)} t={brickTex(1, 1)} />
          <Box m={m} at={[0, 0.315, 0]} s={[0.19, 0.03, 0.28]} c={trim} />
          {[-0.05, 0.05].map((z) => <Cyl key={z} m={m} at={[0, 0.37, z]} r={0.03} r2={0.035} h={0.08} c="#bf6b4a" seg={8} />)}
        </group>
      )}
    </group>
  )
}

// Level 7-10: the Brownstone Terrace, the row grown grander. One deep
// bracketed cornice and one slate mansard run along all three; at level 10
// copper cresting, a gold line on the cornice and lights strung above.
function BrownstoneTerrace({ k, def, lvl }: { k: K; def: NewModelProps['def']; lvl: number }) {
  const { m } = k
  const g = Math.min(10, lvl) - 6
  const W = TW * 3
  const zb = TZB
  const d = TD
  const zf = zb + d
  const H = B + 4 * FH
  const brown = mix(def.color, '#bcaaa4', 0.5)
  const roof = def.roof
  const tints = [1, 0.84, 1.12]
  const stones = [1, 0.9, 1.1]
  const doors = ['#1b5e20', '#b71c1c', '#0d47a1']
  const roofTop = H + 0.05 + MH
  const slate = shingleTex(4, 1)
  return (
    <group>
      {TXS.map((x, i) => (
        <Brownstone key={x} k={k} x={x} wall={shade(def.color, tints[i])} stone={shade(brown, stones[i])} dressed={shade(brown, 1.3)} roof={roof} door={doors[i]} g={g}
          chimney={i === 1 ? 0 : i === 0 ? -1 : 1} side={i === 2} />
      ))}
      {/* A brownstone band over the parlour floor; the frieze, brackets and deep cornice. */}
      <Box m={m} at={[0, B + FH, zf + 0.015]} s={[W, 0.05, 0.03]} c={shade(brown, 1.3)} shadow={false} />
      <Box m={m} at={[0, H - 0.04, zf + 0.01]} s={[W, 0.08, 0.02]} c={roof} shadow={false} />
      {[2, 3, ...(g < 2 ? [1] : [])].map((f) => <Box key={f} m={m} at={[0, B + f * FH + 0.075, zf + 0.03]} s={[W, 0.03, 0.06]} c={shade(brown, 1.3)} shadow={false} />)}
      {[-0.9, -0.45, 0, 0.45, 0.9].map((x) => <Box key={x} m={m} at={[x, H - 0.065, zf + 0.0275]} s={[0.05, 0.13, 0.055]} c={roof} shadow={false} />)}
      <Box m={m} at={[0, H + 0.07, zf - 0.11]} s={[W, 0.14, 0.34]} c={roof} />
      {g >= 4 && <Box m={m} at={[0, H + 0.1, zf + 0.063]} s={[W, 0.03, 0.006]} c={GOLD} shadow={false} />}
      {/* The slate mansard over the fourth storey; at level 10 copper cresting
          on finials and lights strung between them. */}
      <Box m={m} at={[0, H + (0.05 + MH) / 2, zb + (d - 0.3) / 2]} s={[W, 0.05 + MH, d - 0.3]} c={roof} t={slate} />
      <Box m={m} at={[0, H + 0.075 + MH / 2, zf - 0.18]} s={[W, Math.hypot(0.24, MH - 0.05), 0.04]} rot={[-Math.atan2(0.24, MH - 0.05), 0, 0]} c={roof} t={slate} />
      <Box m={m} at={[0, roofTop + 0.02, zb + (d - 0.3) / 2]} s={[W, 0.04, d - 0.28]} c={roof} />
      {g >= 4 && (
        <group>
          {[-0.92, 0.92].map((x) => <Cyl key={x} m={m} at={[x, roofTop + 0.19, -0.11]} r={0.012} r2={0.022} h={0.3} c={COPPER} seg={6} />)}
          <Box m={m} at={[0, roofTop + 0.13, -0.11]} s={[1.84, 0.025, 0.02]} c={COPPER} shadow={false} />
          <Bulbs from={[-0.92, roofTop + 0.36, -0.11]} to={[0.92, roofTop + 0.36, -0.11]} n={4} sag={0.1} />
        </group>
      )}
      <Gardens k={k} lvl={lvl} />
    </group>
  )
}

// ---------- the Modern Duplex ----------

const G = 0.66 // ground floor (garages)
const U = 0.6 // an upper floor

// Mirrored ground floor: a timber garage door and a glass-lit entry each side
// of a dark party fin, the lots' driveways, paths and lawns.
function DuplexGround({ k, def, cars, zf = 0.27 }: { k: K; def: NewModelProps['def']; cars: number; zf?: number }) {
  const { m, win, bulb, ghost } = k
  const tints = ['#e53935', '#1e88e5']
  const bodies: Body[] = ['compact', 'compact']
  return (
    <group>
      {[-1, 1].map((s, i) => (
        <group key={s}>
          <Box m={m} at={[s * 0.66, 0.25, zf + 0.01]} s={[0.5, 0.5, 0.02]} c={def.roof} shadow={false} />
          <mesh position={[s * 0.66, 0.225, zf + 0.024]}><planeGeometry args={[0.44, 0.45]} />{m(WOOD, sidingTex(1, 3))}</mesh>
          <Box m={m} at={[s * 0.255, 0.31, zf + 0.01]} s={[0.3, 0.62, 0.02]} c={def.roof} shadow={false} />
          <mesh position={[s * 0.2, 0.28, zf + 0.024]}><planeGeometry args={[0.17, 0.56]} />{m(shade(WOOD, 0.7))}</mesh>
          <mesh position={[s * 0.355, 0.28, zf + 0.024]}><planeGeometry args={[0.07, 0.56]} />{win}</mesh>
          <Box m={m} at={[s * 0.255, 0.02, zf + 0.08]} s={[0.32, 0.04, 0.16]} c="#bdbdbd" />
          <Box m={m} at={[s * 0.16, 0.37, zf + 0.025]} s={[0.012, 0.12, 0.01]} c={STEEL} shadow={false} />
          {/* Driveway, path to the door across the lawn, a bollard light. */}
          <Pave m={m} x={s * 0.66} z={(zf + 0.98) / 2} w={0.52} d={0.98 - zf} />
          <Lawn m={m} x={s * 0.22} z={(zf + 0.16 + 0.98) / 2} w={0.34} d={0.98 - zf - 0.16} />
          {[0.25, 0.42, 0.59].map((t) => <Box key={t} m={m} at={[s * 0.24, 0.055, zf + t]} s={[0.2, 0.012, 0.12]} c="#cfd8dc" shadow={false} />)}
          <group position={[s * 0.38, 0.05, zf + 0.5]}>
            <Cyl m={m} at={[0, 0.08, 0]} r={0.025} h={0.16} c={def.roof} seg={8} />
            <mesh position={[0, 0.175, 0]}><cylinderGeometry args={[0.028, 0.028, 0.03, 8]} />{bulb}</mesh>
          </group>
          {!ghost && <Mailbox m={m} at={[s * 0.09, 0.05, 0.9]} c={def.roof} />}
          {!ghost && i < cars && <Car at={[s * 0.66, 0.03, zf + 0.34]} rot={Math.PI} body={bodies[i]} color={tints[i]} s={0.64} />}
          {!ghost && <Pool r={0.35} x={s * 0.2} z={zf + 0.25} />}
        </group>
      ))}
    </group>
  )
}

// One upper floor of the duplex family: glass, timber and a dark frame each side.
function DuplexFloor({ k, def, y, zf, timberIn, balcony }: { k: K; def: NewModelProps['def']; y: number; zf: number; timberIn?: boolean; balcony?: boolean }) {
  const { m, win, ghost } = k
  return (
    <group>
      {[-1, 1].map((s) => {
        const gx = timberIn ? s * 0.56 : s * 0.36
        const tx = timberIn ? s * 0.17 : s * 0.78
        return (
          <group key={s}>
            <Box m={m} at={[gx, y + 0.3, zf + 0.01]} s={[0.6, 0.46, 0.02]} c={def.roof} shadow={false} />
            <mesh position={[gx, y + 0.3, zf + 0.024]}><planeGeometry args={[0.54, 0.4]} />{win}</mesh>
            <Box m={m} at={[gx, y + 0.3, zf + 0.03]} s={[0.02, 0.4, 0.012]} c={def.roof} shadow={false} />
            <Box m={m} at={[tx, y + U / 2, zf + 0.015]} s={[0.26, U - 0.06, 0.03]} c={WOOD} t={sidingTex(1, 4)} />
            {balcony && (
              <group position={[gx, y, zf]}>
                <Box m={m} at={[0, -0.008, 0.12]} s={[0.66, 0.04, 0.24]} c={TRIM} />
                <Railing m={m} a={[-0.315, 0.222]} b={[0.315, 0.222]} h={0.2} glass />
                {!ghost && <GrassPot m={m} at={[0.22 * (s > 0 ? 1 : -1), 0.02, 0.1]} s={0.1} />}
              </group>
            )}
          </group>
        )
      })}
    </group>
  )
}

// Level 1-3 (two storeys) and 4-6 (three, a flat each side on every floor).
function Duplex({ k, def, lvl }: { k: K; def: NewModelProps['def']; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const four = lvl >= 4
  const ups = four ? 2 : 1
  const top = G + U * ups
  const zb = -0.93
  const zf = 0.45
  const cars = four || lvl >= 2 ? 2 : 1
  return (
    <group>
      <Box m={m} at={[0, G / 2, (zb + 0.27) / 2]} s={[1.84, G, 0.27 - zb]} c={def.color} />
      <Box m={m} at={[0, G + (U * ups) / 2, (zb + zf) / 2]} s={[1.84, U * ups, zf - zb]} c={def.color} />
      {four && <Box m={m} at={[0, G + U, (zb + zf) / 2]} s={[1.86, 0.04, zf - zb + 0.02]} c={def.roof} shadow={false} />}
      <Box m={m} at={[0, top + 0.04, (zb + zf) / 2]} s={[1.9, 0.08, zf - zb + 0.06]} c={def.roof} />
      <mesh position={[0, top + 0.084, (zb + zf) / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.8, zf - zb - 0.06]} />
        {m(ROOFTOP, SNOW ? undefined : gravelTex(2, 1))}
      </mesh>
      {/* The party fin between the two homes, with their house numbers. */}
      <Box m={m} at={[0, (top + 0.12) / 2, (zb + 0.01 + 0.69) / 2]} s={[0.08, top + 0.12, 0.68 - zb]} c={def.roof} />
      {[-1, 1].map((s) => <Box key={s} m={m} at={[s * 0.043, 0.5, 0.55]} s={[0.006, 0.07, 0.12]} c={GOLD} shadow={false} />)}
      {/* Downlights in the soffit over each door. */}
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.22, G - 0.008, 0.37]}><boxGeometry args={[0.06, 0.016, 0.06]} />{bulb}</mesh>)}
      <DuplexGround k={k} def={def} cars={cars} />
      <DuplexFloor k={k} def={def} y={G} zf={zf} />
      {four && <DuplexFloor k={k} def={def} y={G + U} zf={zf} timberIn balcony />}
      {/* Ribbon windows down the sides, glass to the back garden. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.92, 0, (zb + zf) / 2]} rotation-y={(s * Math.PI) / 2}>
          <Box m={m} at={[0, G + U / 2, 0.012]} s={[zf - zb - 0.06, U - 0.06, 0.024]} c={WOOD} t={sidingTex(3, 4)} />
          {Array.from({ length: ups }, (_, f) => <Strip key={f} win={win} at={[0, G + f * U + 0.36, f ? 0.006 : 0.03]} w={1.0} h={0.18} tw={0.34} th={0.18} />)}
          <mesh position={[s * 0.2, 0.36, 0.006]}><planeGeometry args={[0.3, 0.22]} />{win}</mesh>
        </group>
      ))}
      <group position={[0, 0, zb]} rotation-y={Math.PI}>
        {Array.from({ length: ups }, (_, f) => <Strip key={f} win={win} at={[0, G + f * U + 0.3, 0.006]} w={1.6} h={0.4} tw={0.4} th={0.4} />)}
        <Strip win={win} at={[0, 0.3, 0.006]} w={1.4} h={0.5} tw={0.35} th={0.5} />
      </group>
      {/* Roof: skylights; solar panels from level 3; a roof terrace from level 5. */}
      <group position={[0, top + 0.08, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.5, 0, -0.65]}>
            <Box m={m} at={[0, 0.03, 0]} s={[0.24, 0.06, 0.18]} c={STEEL} />
            <mesh position={[0, 0.062, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.18, 0.12]} />{win}</mesh>
          </group>
        ))}
        {(lvl === 3 || lvl >= 6) && [-1, 1].map((s) => <Solar key={s} m={m} at={[s * 0.55, 0, -0.25]} w={0.5} />)}
        {lvl >= 5 && (
          <group>
            <Box m={m} at={[0, 0.015, 0.22]} s={[1.3, 0.03, 0.38]} c={DECK} t={sidingTex(4, 1)} />
            <Railing m={m} a={[-0.65, zf - 0.02]} b={[0.65, zf - 0.02]} h={0.2} glass />
            {!ghost && [-0.45, 0.45].map((x) => <GrassPot key={x} m={m} at={[x, 0.03, 0.2]} s={0.12} />)}
            {lvl >= 6 && <Pergola m={m} at={[0, 0.03, 0.2]} w={0.6} d={0.34} h={0.42} lights c={def.roof} />}
          </group>
        )}
      </group>
      {!four && lvl >= 2 && !ghost && [-1, 1].map((s) => <GrassPot key={s} m={m} at={[s * 0.095, 0.05, 0.6]} s={0.09} />)}
      {!four && lvl >= 3 && [-1, 1].map((s) => <Shrub key={s} at={[s * 0.095, 0.05, 0.74]} r={0.06} c={PAL.bush[1]} />)}
      {four && [-1, 1].map((s) => <HomeTree key={s} m={m} at={[s * 0.095, 0.05, 0.62]} s={0.28} />)}
    </group>
  )
}

// Level 7-10: Modern Lofts, cubes stacked off-centre, each roof a planted terrace.
type Cube = { x: number; z: number; w: number; d: number; t: number; f: 'white' | 'wood' | 'dark'; from: number }
const CUBES: Cube[] = [
  { x: -0.46, z: -0.2, w: 0.9, d: 1.3, t: 0, f: 'white', from: 7 },
  { x: 0.47, z: -0.35, w: 0.88, d: 1.1, t: 0, f: 'wood', from: 7 },
  { x: -0.4, z: -0.42, w: 0.92, d: 0.86, t: 1, f: 'dark', from: 7 },
  { x: 0.5, z: -0.58, w: 0.78, d: 0.64, t: 1, f: 'white', from: 8 },
  { x: 0.06, z: -0.5, w: 0.96, d: 0.7, t: 2, f: 'wood', from: 9 },
  { x: -0.22, z: -0.56, w: 0.66, d: 0.56, t: 3, f: 'white', from: 10 },
]
const TH = 0.6

function Lofts({ k, def, lvl }: { k: K; def: NewModelProps['def']; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const cubes = CUBES.filter((c) => c.from <= lvl)
  const finish = (f: Cube['f']): [string, ReturnType<typeof sidingTex> | undefined] =>
    f === 'wood' ? [WOOD, sidingTex(2, 3)] : f === 'dark' ? [def.roof, undefined] : [def.color, undefined]
  // Whatever stands on a cube's roof, so its terrace only shows where it's open.
  const above = (c: Cube) => cubes.filter((o) => o.t === c.t + 1 && Math.abs(o.x - c.x) < (o.w + c.w) / 2 && Math.abs(o.z - c.z) < (o.d + c.d) / 2)
  return (
    <group>
      {cubes.map((c, i) => {
        const [col, tex] = finish(c.f)
        const y0 = c.t * TH
        const zf = c.z + c.d / 2
        const frame = c.f === 'dark' ? DARK : def.roof
        const covered = above(c)
        // The front strip of the roof left open by the cube above.
        const open = covered.length ? zf - Math.max(...covered.map((o) => o.z + o.d / 2)) : c.d
        return (
          <group key={i}>
            <Box m={m} at={[c.x, y0 + TH / 2, c.z]} s={[c.w, TH, c.d]} c={col} t={tex} />
            <Box m={m} at={[c.x, y0 + TH + 0.025, c.z]} s={[c.w + 0.04, 0.05, c.d + 0.04]} c={frame} />
            {/* Picture window to the front, a narrower one to the side. */}
            <Box m={m} at={[c.x, y0 + TH / 2, zf + 0.012]} s={[c.w - 0.12, TH - 0.14, 0.024]} c={frame} shadow={false} />
            <mesh position={[c.x, y0 + TH / 2, zf + 0.028]}><planeGeometry args={[c.w - 0.18, TH - 0.2]} />{win}</mesh>
            <Box m={m} at={[c.x + (c.w - 0.18) / 6, y0 + TH / 2, zf + 0.034]} s={[0.02, TH - 0.2, 0.012]} c={frame} shadow={false} />
            <group position={[c.x + c.w / 2, 0, c.z]} rotation-y={Math.PI / 2}>
              <mesh position={[0, y0 + TH / 2, 0.006]}><planeGeometry args={[Math.min(0.5, c.d - 0.2), TH - 0.24]} />{win}</mesh>
            </group>
            <group position={[c.x, 0, c.z - c.d / 2]} rotation-y={Math.PI}>
              <mesh position={[0, y0 + TH / 2, 0.006]}><planeGeometry args={[c.w - 0.3, TH - 0.24]} />{win}</mesh>
            </group>
            {/* Its roof terrace: decking, a glass rail along the open edge, planters. */}
            {open > 0.18 && (
              <group position={[c.x, y0 + TH + 0.05, zf - open / 2]}>
                <Box m={m} at={[0, 0.01, 0]} s={[c.w - 0.04, 0.02, open - 0.04]} c={DECK} t={sidingTex(2, 1)} shadow={false} />
                <Railing m={m} a={[-c.w / 2 + 0.03, open / 2 - 0.03]} b={[c.w / 2 - 0.03, open / 2 - 0.03]} h={0.2} glass />
                {!ghost && <Planter m={m} at={[-c.w / 2 + 0.17, 0.02, 0]} w={0.22} d={Math.min(0.12, open - 0.12)} flowers={i % 2 === 0} />}
                {!ghost && open > 0.3 && <Lounger m={m} at={[c.w / 2 - 0.16, 0.02, -0.02]} ry={Math.PI} c={i % 2 ? '#ffb74d' : TRIM} />}
              </group>
            )}
          </group>
        )
      })}
      {lvl >= 10 && <Pergola m={m} at={[-0.22, 4 * TH + 0.05, -0.56]} w={0.5} d={0.4} h={0.4} lights c={def.roof} />}
      {/* The lot: a lobby path, lawn and grasses, a car out front, bollard lights. */}
      <Lawn m={m} x={-0.46} z={0.73} w={0.9} d={0.5} />
      <Pave m={m} x={-0.46} z={0.74} w={0.24} d={0.5} h={0.06} c="#cfd8dc" tex="concrete" />
      <Pave m={m} x={0.47} z={0.6} w={0.88} d={0.8} />
      {!ghost && <Car at={[0.47, 0.03, 0.58]} rot={Math.PI} body="ev" color="#26a69a" s={0.7} />}
      {!ghost && [-0.8, -0.12].map((x) => <GrassPot key={x} m={m} at={[x, 0.05, 0.6]} />)}
      {[-0.66, -0.26].map((x) => (
        <group key={x} position={[x, 0.05, 0.92]}>
          <Cyl m={m} at={[0, 0.08, 0]} r={0.025} h={0.16} c={def.roof} seg={8} />
          <mesh position={[0, 0.175, 0]}><cylinderGeometry args={[0.028, 0.028, 0.03, 8]} />{bulb}</mesh>
        </group>
      ))}
      {!ghost && <Pool r={0.45} x={-0.46} z={0.7} />}
      {lvl >= 8 && <HomeTree m={m} at={[-0.82, 0.05, 0.85]} s={0.35} />}
    </group>
  )
}

// ---------- the Lakeview Condos ----------

// A run of balconies along a face: slab, glass rail and steel top rail.
function Balconies({ m, xs, w, y, z }: { m: Mat; xs: number[]; w: number; y: number; z: number }) {
  return (
    <group>
      {xs.map((x) => (
        <group key={x} position={[x, y, z]}>
          <Box m={m} at={[0, -0.0075, 0.11]} s={[w, 0.035, 0.22]} c={TRIM} />
          <Railing m={m} a={[-w / 2 + 0.03, 0.195]} b={[w / 2 - 0.03, 0.195]} h={0.18} glass />
        </group>
      ))}
    </group>
  )
}

// The lakeside front garden: a pond with a fountain, lawn, trees, benches and
// lamps, the name on a low stone wall, and the ramp down to the car park.
function CondoGarden({ k, def, zf, lvl, px = 0, ramp = true }: { k: K; def: NewModelProps['def']; zf: number; lvl: number; px?: number; ramp?: boolean }) {
  const { m, bulb, ghost } = k
  const z1 = 0.97
  const mid = (zf + z1) / 2
  const dep = z1 - zf
  return (
    <group>
      <Lawn m={m} x={-1.05} z={mid} w={1.8} d={dep - 0.01} />
      <Lawn m={m} x={0.62} z={mid} w={0.84} d={dep - 0.01} />
      <Pave m={m} x={px} z={mid} w={0.46} d={dep} h={0.06} c="#e0e0e0" />
      {/* The pond: stone rim, water, lily pads and a fountain. */}
      <group position={[-1.05, 0.05, mid + 0.04]}>
        <Box m={m} at={[0, 0.04, 0]} s={[0.9, 0.08, 0.42]} c={STONE} />
        <Box m={m} at={[0, 0.085, 0]} s={[0.8, 0.012, 0.32]} c="#ffffff" t={waterTex('condo', 1, 1)} shadow={false} />
        <Cyl m={m} at={[0, 0.13, 0]} r={0.06} r2={0.08} h={0.08} c={STONE} seg={10} />
        <Cyl m={m} at={[0, 0.24, 0]} r={0.012} r2={0.03} h={0.16} c="#b3e5fc" seg={8} />
        {!ghost && [[-0.25, 0.06], [0.28, -0.05], [0.2, 0.08]].map(([x, z]) => <Cyl key={x} m={m} at={[x, 0.096, z]} r={0.04} h={0.01} c="#66bb6a" seg={8} />)}
      </group>
      <HomeTree m={m} at={[-1.7, 0.05, mid + 0.02]} s={0.5} />
      <HomeTree m={m} at={[0.75, 0.05, mid + 0.02]} s={0.48} />
      {[-0.4, 0.26].map((x) => <PostLamp key={x} m={m} bulb={bulb} ghost={ghost} at={[x, 0.05, z1 - 0.12]} h={0.5} />)}
      {!ghost && <Bench m={m} at={[-1.05, 0.05, zf + 0.12]} rot={0} />}
      {[-1.6, -0.55, 0.35].map((x) => <Shrub key={x} at={[x, 0.05, zf + 0.1]} r={0.1} />)}
      {lvl >= 2 && !ghost && [-1.45, -0.7, 0.5].map((x, i) => <Ball key={x} m={m} at={[x, 0.1, zf + 0.12]} r={0.05} c={FLOWERS[i]} flat />)}
      {/* The name on a low stone wall by the path. */}
      <group position={[0.42, 0.05, z1 - 0.12]}>
        <Box m={m} at={[0, 0.09, 0]} s={[0.56, 0.18, 0.08]} c={STONE} />
        <Box m={m} at={[0, 0.19, 0]} s={[0.6, 0.02, 0.1]} c={def.roof} />
        <Sign text="LAKEVIEW" w={0.48} at={[0, 0.09, 0.042]} bg={def.roof} fg="#ffffff" />
      </group>
      {/* Ramp down to the car park under the building, walls stepping down to the street. */}
      {ramp && (
        <group position={[1.42, 0, 0]}>
          <Box m={m} at={[0, 0.015, (zf + z1) / 2]} s={[0.5, 0.03, dep]} c="#546e7a" t={asphaltTex()} shadow={false} />
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <Box m={m} at={[sd * 0.28, 0.12, zf + dep * 0.3]} s={[0.06, 0.24, dep * 0.6]} c="#bdbdbd" t={concreteTex(1, 1)} />
              <Box m={m} at={[sd * 0.28, 0.06, zf + dep * 0.8]} s={[0.06, 0.12, dep * 0.4]} c="#bdbdbd" t={concreteTex(1, 1)} />
            </group>
          ))}
          {[0.2, 0.4, 0.6].map((t) => <Box key={t} m={m} at={[0, 0.033, zf + dep * t]} s={[0.06, 0.004, 0.12]} c="#fdd835" shadow={false} />)}
          {!ghost && <Car at={[0, 0.03, zf + 0.45]} rot={Math.PI} body="hatch" color="#5c6bc0" s={0.62} />}
        </group>
      )}
    </group>
  )
}

const CP = 0.3 // the car park level, half under ground

// Level 1-3 (three storeys) and 4-6 (five and six): a long block of flats with
// balconies on every floor, the glass lobby in the middle.
function CondoBlock({ k, def, lvl }: { k: K; def: NewModelProps['def']; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const res = lvl >= 4
  const floors = res ? (lvl >= 5 ? 6 : 5) : 3
  const FC = res ? 0.46 : 0.5
  const W = 3.4
  const zb = -0.95
  const zf = res ? 0.1 : 0.15
  const D = zf - zb
  const zc = (zb + zf) / 2
  const H = CP + floors * FC
  const bays = [-1.375, -0.825, -0.275, 0.275, 0.825, 1.375]
  const corner = res
  // The residence's left end is a glass corner one floor taller.
  const cw = 0.7
  const cx = -W / 2 + cw / 2
  const mainW = corner ? W - cw : W
  const mainX = corner ? cw / 2 : 0
  return (
    <group>
      <Box m={m} at={[0, CP / 2, zc]} s={[W, CP, D]} c={STONE} t={concreteTex(2, 1)} />
      {[-1.3, -0.9, -0.5, 0.5, 0.9].map((x) => <mesh key={x} position={[x, 0.15, zf + 0.006]}><planeGeometry args={[0.26, 0.08]} />{m(DARK)}</mesh>)}
      <Box m={m} at={[mainX, CP + (floors * FC) / 2, zc]} s={[mainW, floors * FC, D]} c={def.color} />
      {Array.from({ length: floors }, (_, f) => (
        <Box key={f} m={m} at={[mainX, CP + f * FC, zc]} s={[mainW + 0.02, 0.04, D + 0.02]} c={TRIM} shadow={false} />
      ))}
      <Box m={m} at={[mainX, H + 0.05, zc]} s={[mainW + 0.06, 0.1, D + 0.06]} c={def.roof} />
      <mesh position={[mainX, H + 0.104, zc]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[mainW, D]} />
        {m(ROOFTOP, SNOW ? undefined : gravelTex(3, 1))}
      </mesh>
      {/* Window bands on every floor; the ground floor's stop either side of the lobby. */}
      {Array.from({ length: floors }, (_, f) => {
        const y = CP + f * FC + FC * 0.52
        if (f === 0)
          return [-1, 1].map((s) => {
            const a = s < 0 ? (corner ? -W / 2 + cw : -W / 2) + 0.1 : 0.45
            const b = s < 0 ? -0.45 : W / 2 - 0.1
            return <Strip key={`${f}${s}`} win={win} at={[(a + b) / 2, y, zf + 0.004]} w={b - a} h={FC * 0.6} tw={(b - a) / Math.max(1, Math.round((b - a) / 0.5))} th={FC * 0.6} />
          })
        const a = (corner ? -W / 2 + cw : -W / 2) + 0.1
        const b = W / 2 - 0.1
        return <Strip key={f} win={win} at={[(a + b) / 2, y, zf + 0.004]} w={b - a} h={FC * 0.6} tw={(b - a) / Math.round((b - a) / 0.5)} th={FC * 0.6} />
      })}
      {[1, -1].map((s) => (corner && s < 0 ? null : (
        <group key={s} position={[(s * W) / 2, 0, zc]} rotation-y={(s * Math.PI) / 2}>
          {Array.from({ length: floors }, (_, f) => <Strip key={f} win={win} at={[0, CP + f * FC + FC * 0.52, 0.004]} w={D - 0.3} h={FC * 0.6} tw={(D - 0.3) / 2} th={FC * 0.6} />)}
        </group>
      )))}
      <group position={[mainX, 0, zb]} rotation-y={Math.PI}>
        {Array.from({ length: floors }, (_, f) => <Strip key={f} win={win} at={[0, CP + f * FC + FC * 0.52, 0.004]} w={mainW - 0.2} h={FC * 0.6} tw={(mainW - 0.2) / Math.round((mainW - 0.2) / 0.5)} th={FC * 0.6} />)}
      </group>
      {/* Balconies: one per flat on the low block, a long shared run on the residence. */}
      {Array.from({ length: floors - 1 }, (_, f) => {
        const y = CP + (f + 1) * FC
        return res
          ? <Balconies key={f} m={m} xs={[mainX]} w={mainW - 0.2} y={y} z={zf} />
          : <Balconies key={f} m={m} xs={bays} w={0.46} y={y} z={zf} />
      })}
      {!res && <Balconies m={m} xs={bays.filter((x) => Math.abs(x) > 0.5)} w={0.46} y={CP} z={zf} />}
      {/* Glass corner tower on the residence, curtain wall all round. */}
      {corner && (
        <group>
          <Box m={m} at={[cx, CP + ((floors + 1) * FC) / 2, zc]} s={[cw - 0.06, (floors + 1) * FC, D - 0.06]} c={DARK} />
          <Glass m={m} ghost={ghost} at={[cx, CP + ((floors + 1) * FC) / 2, zf - 0.01]} w={cw - 0.04} h={(floors + 1) * FC} tint="#80cbc4" />
          <Glass m={m} ghost={ghost} at={[-W / 2 + 0.01, CP + ((floors + 1) * FC) / 2, zc]} w={D - 0.04} h={(floors + 1) * FC} ry={-Math.PI / 2} tint="#80cbc4" />
          <Glass m={m} ghost={ghost} at={[cx, CP + ((floors + 1) * FC) / 2, zb + 0.01]} w={cw - 0.04} h={(floors + 1) * FC} ry={Math.PI} tint="#80cbc4" />
          <Box m={m} at={[cx, CP + (floors + 1) * FC + 0.05, zc]} s={[cw + 0.04, 0.1, D + 0.06]} c={def.roof} />
          {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
            <Box key={`${sx}${sz}`} m={m} at={[cx + sx * (cw / 2 - 0.02), CP + ((floors + 1) * FC) / 2, zc + sz * (D / 2 - 0.02)]} s={[0.05, (floors + 1) * FC, 0.05]} c={TRIM} shadow={false} />
          )))}
        </group>
      )}
      {/* The lobby: a glass box under a flat canopy. */}
      <Box m={m} at={[0, (CP + 0.01) / 2, zf + 0.12]} s={[0.8, CP + 0.01, 0.24]} c={STONE} />
      <Box m={m} at={[0, CP + 0.29, zf + 0.12]} s={[0.76, 0.56, 0.24]} c={DARK} />
      <mesh position={[0, CP + 0.27, zf + 0.246]}><planeGeometry args={[0.7, 0.5]} />{win}</mesh>
      {[-0.12, 0.12].map((x) => <Box key={x} m={m} at={[x, CP + 0.27, zf + 0.252]} s={[0.02, 0.5, 0.012]} c={TRIM} shadow={false} />)}
      <Box m={m} at={[0, CP + 0.6, zf + 0.25]} s={[1.0, 0.05, 0.5]} c={def.roof} />
      {[-0.2, 0.2].map((x) => <mesh key={x} position={[x, CP + 0.567, zf + 0.42]}><boxGeometry args={[0.06, 0.016, 0.06]} />{bulb}</mesh>)}
      {[0.1, 0.2].map((t, i) => <Box key={t} m={m} at={[0, 0.03 + i * 0.1 + 0.05 + 0.0, zf + 0.26 + (1 - i) * 0.1 + 0.05]} s={[0.6, CP - 0.1 - i * 0.1 + 0.06, 0.1]} c={STONE} />)}
      {!ghost && <Pool r={0.6} x={0} z={zf + 0.6} />}
      {/* Car park door under the right-hand flats. */}
      <mesh position={[1.42, 0.15, zf + 0.006]}><planeGeometry args={[0.48, 0.28]} />{m('#212121')}</mesh>
      <Box m={m} at={[1.42, CP - 0.015, zf + 0.02]} s={[0.56, 0.03, 0.04]} c="#fdd835" shadow={false} />
      <mesh position={[1.42, 0.27, zf + 0.025]}><boxGeometry args={[0.08, 0.02, 0.012]} />{bulb}</mesh>
      {/* Rooftop: a stair and lift house; a garden from level 2; a pergola from 3. */}
      <group position={[0, H + 0.1, 0]}>
        <Box m={m} at={[1.0, 0.18, zb + 0.35]} s={[0.4, 0.36, 0.4]} c={shade(def.color, 0.9)} t={concreteTex(1, 1)} />
        <Box m={m} at={[1.0, 0.38, zb + 0.35]} s={[0.46, 0.04, 0.46]} c={def.roof} />
        {(lvl >= 2 && lvl !== 4) && [-0.9, -0.2, 0.5].map((x) => <Planter key={x} m={m} at={[x, 0, zf - 0.14]} w={0.5} d={0.14} flowers={x > 0} />)}
        {(lvl === 3 || lvl >= 6) && <Pergola m={m} at={[-0.4, 0, zc - 0.05]} w={0.9} d={0.46} h={0.45} lights c={def.roof} />}
        {(lvl === 3 || lvl >= 6) && !ghost && [-0.7, -0.4, -0.1].map((x) => <Lounger key={x} m={m} at={[x, 0, zc - 0.05]} ry={Math.PI} c="#ffb74d" />)}
        {lvl >= 2 && lvl !== 4 && [0.2, 0.55].map((x) => <Solar key={x} m={m} at={[x, 0, zb + 0.3]} w={0.3} d={0.26} />)}
      </group>
      <CondoGarden k={k} def={def} zf={zf} lvl={lvl} />
    </group>
  )
}

// Level 7-10: Lakeview Towers, two slim glass towers on a podium, a pool on the
// podium roof between them, a sky bridge from level 9, lit crowns at 10.
function LakeviewTowers({ k, def, lvl }: { k: K; def: NewModelProps['def']; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const n = [9, 11, 13, 15][Math.min(10, lvl) - 7]
  const FT = 0.3
  const PH = CP + 0.6
  const W = 3.7
  const zb = -0.95
  const zf = 0.3
  const zc = (zb + zf) / 2
  const TW = 0.96
  const TD = 0.92
  const tz = zb + 0.08 + TD / 2
  const tint = '#80cbc4'
  return (
    <group>
      {/* Podium: the car park level and a lobby floor with glass all along. */}
      <Box m={m} at={[0, CP / 2, zc]} s={[W, CP, zf - zb]} c={STONE} t={concreteTex(2, 1)} />
      {[-1.3, -0.9, 0.6, 0.95].map((x) => <mesh key={x} position={[x, 0.15, zf + 0.006]}><planeGeometry args={[0.26, 0.08]} />{m(DARK)}</mesh>)}
      <Box m={m} at={[0, CP + 0.3, zc]} s={[W, 0.6, zf - zb]} c={def.color} t={concreteTex(2, 1)} />
      <Strip win={win} at={[-0.95, CP + 0.3, zf + 0.004]} w={1.4} h={0.44} tw={0.35} th={0.44} />
      <Strip win={win} at={[0.85, CP + 0.3, zf + 0.004]} w={1.1} h={0.44} tw={0.367} th={0.44} />
      <Box m={m} at={[0, PH + 0.03, zc]} s={[W + 0.06, 0.06, zf - zb + 0.06]} c={def.roof} />
      <mesh position={[0, PH + 0.064, zc]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[W - 0.02, zf - zb - 0.02]} />
        {m('#ffffff', paverTex(6, 2))}
      </mesh>
      {/* Lobby entrance with a canopy. */}
      <Box m={m} at={[-0.1, CP + 0.29, zf + 0.12]} s={[0.6, 0.56, 0.24]} c={DARK} />
      <mesh position={[-0.1, CP + 0.27, zf + 0.246]}><planeGeometry args={[0.54, 0.5]} />{win}</mesh>
      <Box m={m} at={[-0.1, CP + 0.6, zf + 0.25]} s={[0.84, 0.05, 0.5]} c={def.roof} />
      <Box m={m} at={[-0.1, (CP + 0.01) / 2, zf + 0.12]} s={[0.64, CP + 0.01, 0.24]} c={STONE} />
      {[0, 1].map((i) => <Box key={i} m={m} at={[-0.1, 0.08 + i * 0.1, zf + 0.29 + (1 - i) * 0.1]} s={[0.56, 0.16 + i * 0.1 - 0.0, 0.1]} c={STONE} />)}
      {[-0.32, 0.12].map((x) => <mesh key={x} position={[x, CP + 0.567, zf + 0.42]}><boxGeometry args={[0.06, 0.016, 0.06]} />{bulb}</mesh>)}
      {!ghost && <Pool r={0.6} x={-0.1} z={zf + 0.6} />}
      <mesh position={[1.42, 0.15, zf + 0.006]}><planeGeometry args={[0.48, 0.28]} />{m('#212121')}</mesh>
      <Box m={m} at={[1.42, CP - 0.015, zf + 0.02]} s={[0.56, 0.03, 0.04]} c="#fdd835" shadow={false} />
      {/* The two towers: glass all round, a white slab edge at every floor. */}
      {[-1, 1].map((s) => {
        const x = s * 1.25
        const tall = s < 0 ? n : n - 2
        const h = tall * FT
        const t = PH + h
        return (
          <group key={s}>
            <Box m={m} at={[x, PH + h / 2, tz]} s={[TW - 0.04, h, TD - 0.04]} c={DARK} />
            <Glass m={m} ghost={ghost} at={[x, PH + h / 2, tz + TD / 2]} w={TW} h={h} tint={tint} />
            <Glass m={m} ghost={ghost} at={[x + TW / 2, PH + h / 2, tz]} w={TD} h={h} ry={Math.PI / 2} tint={tint} />
            <Glass m={m} ghost={ghost} at={[x - TW / 2, PH + h / 2, tz]} w={TD} h={h} ry={-Math.PI / 2} tint={tint} />
            <Glass m={m} ghost={ghost} at={[x, PH + h / 2, tz - TD / 2]} w={TW} h={h} ry={Math.PI} tint={tint} />
            {Array.from({ length: tall - 1 }, (_, f) => (
              <Box key={f} m={m} at={[x, PH + (f + 1) * FT, tz + 0.03]} s={[TW + 0.04, 0.03, TD + 0.1]} c={TRIM} shadow={false} />
            ))}
            {[-1, 1].map((sx) => <Box key={sx} m={m} at={[x + sx * (TW / 2 + 0.006), PH + h / 2, tz + TD / 2 + 0.006]} s={[0.045, h, 0.045]} c={def.roof} shadow={false} />)}
            {/* Crown: a dark cap; fins from level 8; lit at 10. */}
            <Box m={m} at={[x, t + 0.06, tz]} s={[TW + 0.06, 0.12, TD + 0.06]} c={def.roof} />
            <Box m={m} at={[x, t + 0.25, tz - 0.1]} s={[0.4, 0.26, 0.36]} c="#78909c" />
            {lvl >= 8 && [-1, 1].map((sx) => <Box key={sx} m={m} at={[x + sx * 0.36, t + 0.32, tz + 0.1]} s={[0.06, 0.4, TD - 0.3]} c={def.roof} />)}
            {lvl >= 10 && <Bulbs from={[x - TW / 2, t + 0.17, tz + TD / 2 + 0.02]} to={[x + TW / 2, t + 0.17, tz + TD / 2 + 0.02]} n={5} />}
            {lvl >= 10 && (
              <group position={[x, t + 0.12, tz + 0.1]}>
                <Cyl m={m} at={[0, 0.45, 0]} r={0.015} r2={0.03} h={0.9} c={GOLD} seg={6} />
                <mesh position={[0, 0.93, 0]}><sphereGeometry args={[0.045, 8, 6]} />{bulb}</mesh>
              </group>
            )}
          </group>
        )
      })}
      {/* Sky bridge between the towers from level 9. */}
      {lvl >= 9 && (
        <group position={[0, PH + Math.floor(n / 2) * FT + 0.08, tz + 0.1]}>
          <Box m={m} at={[0, 0, 0]} s={[2.5 - TW + 0.04, 0.03, 0.22]} c={TRIM} />
          <Box m={m} at={[0, 0.155, 0]} s={[2.5 - TW + 0.04, 0.03, 0.22]} c={TRIM} />
          <Glass m={m} ghost={ghost} at={[0, 0.0775, 0.1]} w={2.5 - TW} h={0.125} tint={tint} />
          <Glass m={m} ghost={ghost} at={[0, 0.0775, -0.1]} w={2.5 - TW} h={0.125} ry={Math.PI} tint={tint} />
        </group>
      )}
      {/* Podium roof between the towers: a pool, its deck, loungers and parasols. */}
      <group position={[0, PH + 0.07, 0]}>
        <Box m={m} at={[0, 0.02, -0.33]} s={[1.3, 0.04, 0.9]} c={DECK} t={sidingTex(4, 2)} shadow={false} />
        <Box m={m} at={[0, 0.05, -0.38]} s={[1.0, 0.03, 0.56]} c={TRIM} />
        <Box m={m} at={[0, 0.067, -0.38]} s={[0.9, 0.006, 0.46]} c="#ffffff" t={waterTex('rooftop', 2, 1)} shadow={false} />
        <Railing m={m} a={[-1.8, zf - 0.04]} b={[1.8, zf - 0.04]} h={0.18} glass />
        {!ghost && [-0.12, 0.12].map((x) => <Lounger key={x} m={m} at={[x, 0.04, 0.03]} ry={Math.PI} c={x > 0 ? '#ffb74d' : TRIM} />)}
        {!ghost && lvl >= 8 && [-0.5, 0.5].map((x) => <Umbrella key={x} m={m} at={[x, 0.04, 0.06]} c={def.roof} />)}
        {[-0.62, 0.62].map((x) => <Planter key={x} m={m} at={[x, 0.04, -0.7]} w={0.12} d={0.3} />)}
      </group>
      <CondoGarden k={k} def={def} zf={zf} lvl={lvl} px={-0.1} />
    </group>
  )
}

export function CityHomeModel({ def, ghost, m, win, bulb, level = 1 }: NewModelProps) {
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  const k: K = { m, win, bulb, ghost }
  const s = growthStage(lvl)
  if (def.id === 'condos')
    return <Lots sx={4} sz={2}>{s === 3 ? <LakeviewTowers k={k} def={def} lvl={lvl} /> : <CondoBlock k={k} def={def} lvl={lvl} />}</Lots>
  if (def.id === 'duplex')
    return <Lots sx={2} sz={2}>{s === 3 ? <Lofts k={k} def={def} lvl={lvl} /> : <Duplex k={k} def={def} lvl={lvl} />}</Lots>
  return (
    <Lots sx={2} sz={2}>
      {s === 3 ? <BrownstoneTerrace k={k} def={def} lvl={lvl} /> : s === 2 ? <RowHouses k={k} def={def} lvl={lvl} /> : <Townhouse k={k} def={def} lvl={lvl} />}
    </Lots>
  )
}
