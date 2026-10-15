import type { ReactNode } from 'react'
import { ExtrudeGeometry, Shape, type BufferGeometry } from 'three'
import type { NewModelProps } from './NewBuildings'
import { growthStage } from '../game/growth'
import { Ball, Box, Bulbs, Cyl, Pool, Tree, type Mat, type V3 } from './edgeKit'
import { Facade, Upright, useBays } from './mergeScale'
import { PEOPLE_SIZED } from './keepShape'
import { CarModel } from './CarModel'
import { PAL, SEASON } from './season'
import { shade } from './flora'
import { brickTex, grassTex, gravelTex, paverTex, shingleTex, sidingTex } from './textures'

// Cozy homes: the Rose Cottage, the Sunny Bungalow and the Log Cabin (see
// "More homes" in game/data.ts). Each grows in its own style on its 1x1 lot:
//  - cottage: a storybook cottage (1-3), a Garden Cottage with a side wing and
//    a greenhouse (4-6), then Cottage Lane, a row of little cottages on a
//    cobbled lane (7-10).
//  - bungalow: a low craftsman bungalow with a carport (1-3), a Craftsman
//    Bungalow with a shed dormer (4-6), then Bungalow Court, three bungalows
//    round a garden court (7-10).
//  - cabin: a log cabin with a stone chimney (1-3), a Timber Lodge with a glass
//    gable (4-6), then a Mountain Lodge on a fieldstone base (7-10).
// Walls take def.color and roofs def.roof, so the player's theme shows.
// Lots face +z. Plain static meshes; shapes are cached per size.

export const COZY_HOMES = new Set(['cottage', 'bungalow', 'cabin'])

type Kit = { m: Mat; win: ReactNode; bulb: ReactNode; ghost?: boolean }

const TRIM = '#fafafa'
const STONE = '#b0a89e'
const WOOD = '#8d6e63'
const DARK_WOOD = '#5d4037'
const SOIL = '#6d4c41'
const BARE = SEASON === 'winter'
const LEAF = PAL.bush[0]
const LAWN = 0.04
const STRETCH = { stretch: true }

// ---- Shared shapes ----

const prisms = new Map<string, BufferGeometry>()
// A triangular prism: a triangle `d` across (along z) and `h` high, `w` long
// along x, its base at y = 0 and centred. Fills a gable end under a roof.
function prismGeo(w: number, d: number, h: number) {
  const k = `${w.toFixed(3)}|${d.toFixed(3)}|${h.toFixed(3)}`
  let g = prisms.get(k)
  if (!g) {
    const s = new Shape()
    s.moveTo(-d / 2, 0)
    s.lineTo(d / 2, 0)
    s.lineTo(0, h)
    s.closePath()
    g = new ExtrudeGeometry(s, { depth: w, bevelEnabled: false })
    g.rotateY(-Math.PI / 2)
    g.translate(w / 2, 0, 0)
    prisms.set(k, g)
  }
  return g
}

// A picket: a flat board with a pointed top, `h` tall, standing on y = 0.
let picket: BufferGeometry | null = null
function picketGeo() {
  if (picket) return picket
  const s = new Shape()
  s.moveTo(-0.022, 0)
  s.lineTo(0.022, 0)
  s.lineTo(0.022, 0.22)
  s.lineTo(0, 0.26)
  s.lineTo(-0.022, 0.22)
  s.closePath()
  picket = new ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: false })
  picket.translate(0, 0, -0.009)
  return picket
}

// A pitched roof with its ridge along x: two shingled slabs meeting at a ridge
// cap, over a gable-end prism in the wall colour. Sits on y = 0 (the wall top),
// `w` long, `d` across, `h` from wall top to ridge; `over` is the eave overhang
// and `side` how far it reaches past each gable end.
function Gable({ m, w, d, h, over = 0.08, side = 0.06, wall, wallTex, roof, t = 0.035 }: {
  m: Mat; w: number; d: number; h: number; over?: number; side?: number; wall: string; wallTex?: boolean; roof: string; t?: number
}) {
  const a = Math.atan2(h, d / 2)
  const L = Math.hypot(d / 2, h) + over
  const z = Math.cos(a) * (L / 2) + Math.sin(a) * (t / 2)
  const y = h - Math.sin(a) * (L / 2) + Math.cos(a) * (t / 2)
  const W = w + side * 2
  const tex = shingleTex(Math.max(1, Math.round(W * 2.5)), Math.max(1, Math.round(L * 3)))
  return (
    <group>
      <mesh geometry={prismGeo(w, d, h)} castShadow receiveShadow>
        {m(wall, wallTex ? sidingTex(Math.max(1, Math.round(d * 2)), Math.max(1, Math.round(h * 3))) : undefined)}
      </mesh>
      <Box m={m} at={[0, y, z]} s={[W, t, L]} rot={[a, 0, 0]} c={roof} t={tex} />
      <Box m={m} at={[0, y, -z]} s={[W, t, L]} rot={[-a, 0, 0]} c={roof} t={tex} />
      <Box m={m} at={[0, h + t * Math.cos(a) * 0.8, 0]} s={[W + 0.006, t * 0.9, 2 * t * Math.sin(a) + 0.03]} c={shade(roof, 0.05)} shadow={false} />
    </group>
  )
}

// A window on a wall facing +z (the group sits on the wall face): trim frame,
// glass, a cross of glazing bars and a sill. Shutters and a flower box optional.
function Win({ k, at, w = 0.22, h = 0.24, ry = 0, trim = TRIM, shutter, flowers, bars = true, sill = true }: {
  k: Kit; at: V3; w?: number; h?: number; ry?: number; trim?: string; shutter?: string; flowers?: string; bars?: boolean; sill?: boolean
}) {
  const { m, win } = k
  return (
    <group position={at} rotation-y={ry}>
      <Box m={m} at={[0, 0, 0.008]} s={[w + 0.05, h + 0.05, 0.016]} c={trim} shadow={false} />
      <mesh position={[0, 0, 0.02]}><planeGeometry args={[w, h]} />{win}</mesh>
      {bars && <Box m={m} at={[0, 0, 0.023]} s={[w, 0.014, 0.006]} c={trim} shadow={false} />}
      {bars && <Box m={m} at={[0, 0, 0.025]} s={[0.014, h, 0.01]} c={trim} shadow={false} />}
      {sill && <Box m={m} at={[0, -h / 2 - 0.035, 0.03]} s={[w + 0.09, 0.025, 0.06]} c={trim} shadow={false} />}
      {shutter && [-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * (w / 2 + 0.062), 0, 0.012]} s={[0.07, h + 0.04, 0.012]} c={shutter} shadow={false} />)}
      {flowers && (
        <group position={[0, -h / 2 - 0.08, 0.05]}>
          <Box m={m} at={[0, 0, 0]} s={[w + 0.04, 0.06, 0.07]} c={WOOD} shadow={false} />
          {[-1, 0, 1].map((i) => <Ball key={i} m={m} at={[i * w * 0.32, 0.045, 0]} r={0.035} c={i === 0 ? LEAF : flowers} flat />)}
        </group>
      )}
    </group>
  )
}

// A door with an arched (round) top on a wall facing +z, standing on y = 0.
function RoundDoor({ k, at, w = 0.24, h = 0.38, c, trim = TRIM }: { k: Kit; at: V3; w?: number; h?: number; c: string; trim?: string }) {
  const { m, win } = k
  const R = w / 2 + 0.03
  return (
    <group position={at}>
      <Box m={m} at={[0, h / 2, 0.01]} s={[w + 0.06, h, 0.02]} c={trim} shadow={false} />
      <mesh position={[0, h, 0.01]} rotation-x={Math.PI / 2}><cylinderGeometry args={[R, R, 0.02, 14, 1, false, Math.PI / 2, Math.PI]} />{m(trim)}</mesh>
      <mesh position={[0, h / 2, 0.024]}><planeGeometry args={[w, h]} />{m(c)}</mesh>
      <mesh position={[0, h, 0.024]}><circleGeometry args={[w / 2, 12, 0, Math.PI]} />{m(c)}</mesh>
      <mesh position={[0, h + 0.03, 0.028]}><circleGeometry args={[0.045, 10]} />{win}</mesh>
      <Ball m={m} at={[w * 0.32, h * 0.52, 0.036]} r={0.014} c="#ffca28" />
    </group>
  )
}

// A plain panel door with a small light on a wall facing +z, standing on y = 0.
function Door({ k, at, w = 0.24, h = 0.52, c, trim = TRIM, lite = true }: { k: Kit; at: V3; w?: number; h?: number; c: string; trim?: string; lite?: boolean }) {
  const { m, win } = k
  return (
    <group position={at}>
      <Box m={m} at={[0, (h + 0.03) / 2, 0.01]} s={[w + 0.06, h + 0.03, 0.02]} c={trim} shadow={false} />
      <mesh position={[0, h / 2, 0.024]}><planeGeometry args={[w, h]} />{m(c)}</mesh>
      {lite && <mesh position={[0, h * 0.78, 0.028]}><planeGeometry args={[w * 0.62, h * 0.18]} />{win}</mesh>}
      <Ball m={m} at={[w * 0.32, h * 0.48, 0.036]} r={0.014} c="#ffca28" />
    </group>
  )
}

// A white picket fence along the front, one picket per step along a merged pair,
// with a gap for the gate.
function Pickets({ m, z, len = 1.9, gap = 0.38, gx = 0, c = TRIM }: { m: Mat; z: number; len?: number; gap?: number; gx?: number; c?: string }) {
  return (
    <Facade at={[0, LAWN, z]} len={len}>
      {(L) => {
        const g = (gx * L) / len
        const n = Math.round(L / 0.095)
        const xs = Array.from({ length: n }, (_, i) => -L / 2 + (i + 0.5) * (L / n)).filter((x) => Math.abs(x - g) > gap / 2 + 0.02)
        const runs: [number, number][] = [[-L / 2, g - gap / 2], [g + gap / 2, L / 2]]
        return (
          <group>
            {xs.map((x) => <mesh key={x} position={[x, 0, 0]} geometry={picketGeo()} castShadow>{m(c)}</mesh>)}
            {[0.07, 0.17].flatMap((y) => runs.map(([a, b]) => (
              <Box key={`${y}${a}`} m={m} at={[(a + b) / 2, y, -0.02]} s={[b - a, 0.03, 0.02]} c={c} shadow={false} />
            )))}
          </group>
        )
      }}
    </Facade>
  )
}

// A rose bush: a leafy mound dotted with blooms.
function Roses({ m, at, s = 1, c = '#e91e63' }: { m: Mat; at: V3; s?: number; c?: string }) {
  return (
    <group position={at} scale={s}>
      <Ball m={m} at={[0, 0.09, 0]} r={0.11} c={LEAF} flat />
      <Ball m={m} at={[0.07, 0.07, 0.05]} r={0.08} c={shade(LEAF, -0.05)} flat />
      {!BARE && [[0.05, 0.17, 0.05], [-0.07, 0.13, 0.07], [0.1, 0.1, 0.1], [-0.02, 0.19, -0.04]].map(([x, y, z], i) => (
        <Ball key={i} m={m} at={[x, y, z]} r={0.032} c={i % 2 ? '#f8bbd0' : c} flat />
      ))}
    </group>
  )
}

// A rose arch over a garden gate, facing +z.
// `lite`: single posts and fewer roses, for the lane's little gates.
function RoseArch({ m, at, w = 0.42, h = 0.56, lite }: { m: Mat; at: V3; w?: number; h?: number; lite?: boolean }) {
  const roses = [[-w / 2, h * 0.55, 0.05], [w / 2, h * 0.75, 0.05], [-w * 0.42, h + 0.1, 0], [-w * 0.12, h + w * 0.48, 0.02], [w * 0.25, h + w * 0.4, 0.03], [w / 2, h * 0.3, -0.05], [-w / 2, h * 0.2, -0.04]]
  return (
    <group position={at}>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[(sd * w) / 2, 0, 0]}>
          {(lite ? [0] : [-0.04, 0.04]).map((z) => <Box key={z} m={m} at={[0, h / 2, z]} s={[0.03, h, 0.03]} c={TRIM} />)}
          {!lite && [0.15, 0.3, 0.45].map((y) => <Box key={y} m={m} at={[0, y, 0]} s={[0.02, 0.02, 0.1]} c={TRIM} shadow={false} />)}
        </group>
      ))}
      <mesh position={[0, h, 0]} castShadow><torusGeometry args={[w / 2, 0.022, 6, 14, Math.PI]} />{m(TRIM)}</mesh>
      {(lite ? roses.filter((_, i) => i % 2 === 0) : roses).map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <Ball m={m} at={[0, 0, 0]} r={0.06} c={i % 2 ? LEAF : shade(LEAF, -0.06)} flat />
          {!BARE && <Ball m={m} at={[0.03, 0.03, 0.04]} r={0.028} c={i % 3 ? '#e91e63' : '#f8bbd0'} flat />}
        </group>
      ))}
    </group>
  )
}

function Mailbox({ m, at, c = '#c62828' }: { m: Mat; at: V3; c?: string }) {
  return (
    <group position={at} userData={PEOPLE_SIZED}>
      <Box m={m} at={[0, 0.17, 0]} s={[0.03, 0.34, 0.03]} c={DARK_WOOD} />
      <Box m={m} at={[0, 0.37, 0]} s={[0.08, 0.07, 0.14]} c={c} />
      <Box m={m} at={[0.045, 0.39, -0.03]} s={[0.01, 0.06, 0.02]} c="#fdd835" shadow={false} />
    </group>
  )
}

function BirdBath({ m, at }: { m: Mat; at: V3 }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.02, 0]} r={0.07} h={0.04} c={STONE} seg={10} />
      <Cyl m={m} at={[0, 0.13, 0]} r={0.025} r2={0.035} h={0.18} c={STONE} seg={8} />
      <Cyl m={m} at={[0, 0.235, 0]} r={0.11} r2={0.07} h={0.04} c={STONE} seg={12} />
      <mesh position={[0, 0.2575, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.09, 12]} /><meshStandardMaterial color="#4fc3f7" roughness={0.15} /></mesh>
    </group>
  )
}

function GardenBench({ m, at, rot = 0, c = '#eceff1' }: { m: Mat; at: V3; rot?: number; c?: string }) {
  return (
    <group position={at} rotation-y={rot}>
      <Box m={m} at={[0, 0.13, 0]} s={[0.42, 0.025, 0.12]} c={c} />
      <Box m={m} at={[0, 0.23, -0.055]} s={[0.42, 0.12, 0.02]} c={c} />
      {[-0.19, 0.19].map((x) => <Box key={x} m={m} at={[x, 0.11, -0.005]} s={[0.025, 0.22, 0.13]} c="#37474f" />)}
    </group>
  )
}

// A raised vegetable bed: a plank box of soil with rows of greens.
function VegBed({ m, at, w = 0.4, d = 0.24 }: { m: Mat; at: V3; w?: number; d?: number }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.05, 0]} s={[w, 0.1, d]} c={WOOD} />
      <Box m={m} at={[0, 0.1, 0]} s={[w - 0.04, 0.012, d - 0.04]} c={SOIL} shadow={false} />
      {[-1, 0, 1].flatMap((i) => [-1, 1].map((j) => (
        <Ball key={`${i}${j}`} m={m} at={[i * w * 0.3, 0.13, j * d * 0.2]} r={0.035} c={(i + j) % 2 ? '#7cb342' : '#558b2f'} flat />
      )))}
    </group>
  )
}

// A garden lantern on a post, lit at night with its pool of light.
function Lantern({ k, at, h = 0.5 }: { k: Kit; at: V3; h?: number }) {
  const { m } = k
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.02, 0]} s={[0.07, 0.04, 0.07]} c="#263238" />
      <Cyl m={m} at={[0, h / 2, 0]} r={0.016} r2={0.022} h={h} c="#263238" seg={6} />
      <Box m={m} at={[0, h + 0.005, 0]} s={[0.07, 0.014, 0.07]} c="#263238" shadow={false} />
      <mesh position={[0, h + 0.046, 0]}><boxGeometry args={[0.055, 0.07, 0.055]} />{k.bulb}</mesh>
      <mesh position={[0, h + 0.1, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.06, 0.05, 4]} />{m('#263238')}</mesh>
      {!k.ghost && <Pool r={0.42} />}
    </group>
  )
}

// Flat stepping stones from one point to another on the lawn.
function Stones({ m, from, to, n }: { m: Mat; from: [number, number]; to: [number, number]; n: number }) {
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const t = n > 1 ? i / (n - 1) : 0.5
        return <Cyl key={i} m={m} at={[from[0] + (to[0] - from[0]) * t + (i % 2 ? 0.015 : -0.015), LAWN + 0.006, from[1] + (to[1] - from[1]) * t]} r={0.075} h={0.012} c="#cfc6b8" seg={7} />
      })}
    </group>
  )
}

function Lawn({ m }: { m: Mat }) {
  return <Box m={m} at={[0, LAWN / 2, 0]} s={[1.9, LAWN, 1.9]} c="#ffffff" t={grassTex(2, 2)} shadow={false} />
}

// ---- Rose Cottage ----

type CottageProps = {
  k: Kit; at?: V3; w: number; d: number; H: number; wall: string; roof: string; door: string; shutter: string
  pitch?: number; chimney?: -1 | 1 | 0; dormer?: boolean; side?: boolean; flowers?: string; back?: boolean; eaves?: number
}

// A storybook cottage on a stone plinth: a steep roof, a gabled entry bay with
// a round door, shuttered windows with flower boxes and a round gable window.
function Cottage({ k, at = [0, 0, 0], w, d, H, wall, roof, door, shutter, pitch = 0.6, chimney = -1, dormer, side = true, flowers = '#ec407a', back = true, eaves = 0.07 }: CottageProps) {
  const { m, bulb } = k
  const zf = d / 2
  const y0 = LAWN + 0.01
  const top = y0 + H
  const bay = Math.min(0.36, w * 0.32)
  const bayD = 0.12
  const crossH = Math.min(pitch * 0.62, 0.38)
  // The entry bay's ridge runs back until the main roof covers it.
  const crossLen = bayD + (d / 2) * (crossH / pitch) + 0.02
  const span = w / 2 - bay / 2 - 0.08
  const winX = bay / 2 + 0.04 + span / 2
  return (
    <group position={at}>
      <Box m={m} at={[0, LAWN + 0.05, 0]} s={[w + 0.04, 0.1, d + 0.04]} c={STONE} t={brickTex(Math.max(1, Math.round(w * 2)), 1)} />
      <Box m={m} at={[0, y0 + H / 2, 0]} s={[w, H, d]} c={wall} t={sidingTex(Math.max(1, Math.round(w * 1.5)), Math.max(1, Math.round(H * 3)))} />
      <group position={[0, top, 0]}>
        <Gable m={m} w={w} d={d} h={pitch} over={0.1} side={eaves} wall={wall} roof={roof} />
      </group>
      {/* Entry bay with its own little gable, the round door in it. */}
      <Box m={m} at={[0, y0 + H / 2, zf + bayD / 2]} s={[bay, H, bayD]} c={wall} />
      <group position={[0, top, zf + bayD - crossLen / 2]} rotation-y={Math.PI / 2}>
        <Gable m={m} w={crossLen} d={bay} h={crossH} over={0.06} side={0.04} wall={wall} roof={roof} />
      </group>
      <RoundDoor k={k} at={[0, y0, zf + bayD]} w={bay * 0.62} h={Math.min(0.42, H - bay * 0.31 - 0.08)} c={door} />
      <mesh position={[bay / 2 + 0.05, y0 + H * 0.8, zf + 0.02]}><boxGeometry args={[0.05, 0.06, 0.04]} />{bulb}</mesh>
      {/* Climbing roses either side of the bay. */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * (bay / 2 + 0.02), y0, zf + bayD * 0.6]}>
          <Ball m={m} at={[0, 0.1, 0]} r={0.07} c={LEAF} flat />
          <Ball m={m} at={[0, 0.26, -0.02]} r={0.055} c={shade(LEAF, -0.05)} flat />
          {!BARE && <Ball m={m} at={[sd * 0.02, 0.18, 0.05]} r={0.028} c={flowers} flat />}
          {!BARE && <Ball m={m} at={[0, 0.34, 0.02]} r={0.026} c="#f8bbd0" flat />}
        </group>
      ))}
      <Facade at={[0, y0, zf]} len={w}>
        {(L) => {
          // Windows either side of the bay, more of them along a merged pair.
          const s = L / 2 - bay / 2 - 0.08
          const c = Math.max(1, Math.floor(s / 0.42))
          const xs = [-1, 1].flatMap((sd) => Array.from({ length: c }, (_, j) => sd * (bay / 2 + 0.04 + ((j + 0.5) * s) / c)))
          return xs.map((x) => <Win key={x} k={k} at={[x, H * 0.58, 0]} w={0.2} h={0.22} shutter={shutter} flowers={flowers} />)
        }}
      </Facade>
      {side && [-1, 1].map((sd) => (
        <group key={sd}>
          <Win k={k} at={[sd * (w / 2), y0 + H * 0.58, chimney === sd ? -d * 0.22 : 0]} ry={(sd * Math.PI) / 2} w={0.2} h={0.22} />
          {/* A round window up in the gable. */}
          <group position={[sd * (w / 2 + 0.003), top + pitch * 0.36, 0]} rotation-y={(sd * Math.PI) / 2}>
            <mesh position={[0, 0, 0.004]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.075, 0.075, 0.012, 14]} />{m(TRIM)}</mesh>
            <mesh position={[0, 0, 0.012]}><circleGeometry args={[0.055, 14]} />{k.win}</mesh>
          </group>
        </group>
      ))}
      {back && [-winX, winX].map((x) => (
        <group key={x} position={[x, y0 + H * 0.58, -zf]} rotation-y={Math.PI}>
          <Box m={m} at={[0, 0, 0.008]} s={[0.25, 0.27, 0.016]} c={TRIM} shadow={false} />
          <mesh position={[0, 0, 0.02]}><planeGeometry args={[0.2, 0.22]} />{k.win}</mesh>
        </group>
      ))}
      {chimney !== 0 && (
        // Fieldstone chimney up the gable end, a pot on its cap.
        <group position={[chimney * (w / 2 + 0.09), 0, -d * 0.22]}>
          <Box m={m} at={[0, LAWN + (H * 0.6) / 2, 0]} s={[0.2, H * 0.6, 0.24]} c={STONE} t={brickTex(1, 2)} />
          <Box m={m} at={[-chimney * 0.01, LAWN + H * 0.6 + (H * 0.4 + pitch + 0.2) / 2, 0]} s={[0.16, H * 0.4 + pitch + 0.2, 0.18]} c={STONE} t={brickTex(1, 3)} />
          <Box m={m} at={[-chimney * 0.01, top + pitch + 0.21, 0]} s={[0.2, 0.04, 0.22]} c="#8d8178" />
          <Cyl m={m} at={[-chimney * 0.01, top + pitch + 0.27, 0]} r={0.035} h={0.08} c="#bf6b4a" seg={8} />
        </group>
      )}
      {dormer && (
        // A gabled dormer on the front slope.
        <group position={[-winX, top + pitch * 0.5 - 0.03, zf * 0.5]}>
          <Box m={m} at={[0, 0.085, -zf * 0.25]} s={[0.26, 0.17, zf * 0.5]} c={wall} />
          <group position={[0, 0.17, -zf * 0.25]} rotation-y={Math.PI / 2}>
            <Gable m={m} w={zf * 0.5} d={0.26} h={0.11} over={0.04} side={0.03} wall={wall} roof={roof} t={0.025} />
          </group>
          <Win k={k} at={[0, 0.095, 0]} w={0.13} h={0.11} sill={false} />
        </group>
      )}
    </group>
  )
}

function CottageLot({ def, level, k }: { def: NewModelProps['def']; level: number; k: Kit }) {
  const { m, ghost } = k
  const stage = growthStage(level)
  const wall = def.color
  const roof = def.roof
  if (stage === 1) {
    const zf = 0.12
    return (
      <group>
        <Lawn m={m} />
        <Cottage k={k} at={[0, 0, zf - 0.39]} w={1.24} d={0.78} H={0.66} wall={wall} roof={roof} door="#558b2f" shutter="#81c784" dormer={level >= 3} />
        <Stones m={m} from={[0, zf + 0.22]} to={[0, 0.86]} n={5} />
        <Pickets m={m} z={0.9} />
        {!ghost && (
          <group>
            <RoseArch m={m} at={[0, LAWN, 0.9]} />
            <Roses m={m} at={[-0.75, LAWN, 0.7]} />
            <Roses m={m} at={[0.78, LAWN, 0.62]} s={0.9} c="#c2185b" />
            <Mailbox m={m} at={[0.36, LAWN, 0.98]} c="#e91e63" />
            <Lantern k={k} at={[-0.34, LAWN, 0.74]} h={0.46} />
            {/* A trellis of roses up the right wall. */}
            <group position={[0.62 + 0.012, LAWN + 0.06, -0.53]}>
              {[-0.08, 0, 0.08].map((z) => <Box key={z} m={m} at={[0, 0.27, z]} s={[0.012, 0.54, 0.02]} c={TRIM} shadow={false} />)}
              {[0.15, 0.33, 0.5].map((y) => <Box key={y} m={m} at={[0.004, y, 0]} s={[0.012, 0.02, 0.19]} c={TRIM} shadow={false} />)}
              {!BARE && [[0.05, -0.05, '#e91e63'], [0.22, 0.05, '#f8bbd0'], [0.38, -0.03, '#e91e63'], [0.5, 0.05, '#c2185b']].map(([y, z, c], i) => (
                <group key={i} position={[0.04, y as number, z as number]}>
                  <Ball m={m} at={[0, 0, 0]} r={0.055} c={LEAF} flat />
                  <Ball m={m} at={[0.03, 0.02, 0.02]} r={0.026} c={c as string} flat />
                </group>
              ))}
            </group>
            {level >= 2 && <BirdBath m={m} at={[0.6, LAWN, 0.45]} />}
            {level >= 2 && <Roses m={m} at={[-0.45, LAWN, 0.74]} s={0.7} />}
            {level >= 3 && <GardenBench m={m} at={[-0.62, LAWN, 0.4]} rot={0.4} />}
          </group>
        )}
      </group>
    )
  }
  if (stage === 2) {
    const H = 0.72 + 0.04 * (level - 4)
    const zf = -0.02
    const ww = 0.58
    return (
      <group>
        <Lawn m={m} />
        <Cottage k={k} at={[-0.3, 0, zf - 0.4]} w={1.14} d={0.8} H={H} wall={wall} roof={roof} door="#558b2f" shutter="#81c784" chimney={0} dormer side={false} eaves={0.05} />
        {/* Chimney up through the back slope. */}
        <group position={[-0.68, 0, zf - 0.62]}>
          <Box m={m} at={[0, LAWN + 0.01 + H + 0.475, 0]} s={[0.17, 0.65, 0.19]} c={STONE} t={brickTex(1, 2)} />
          <Box m={m} at={[0, LAWN + 0.01 + H + 0.82, 0]} s={[0.21, 0.04, 0.23]} c="#8d8178" />
          <Cyl m={m} at={[0, LAWN + 0.01 + H + 0.88, 0]} r={0.035} h={0.08} c="#bf6b4a" seg={8} />
        </group>
        {/* Side wing, gable to the street, with a bay window. */}
        <SideWing k={k} at={[0.27 + ww / 2, 0, zf - 0.38]} w={ww} d={1.0} H={H - 0.08} wall={wall} roof={roof} />
        <Stones m={m} from={[-0.3, zf + 0.24]} to={[-0.3, 0.86]} n={5} />
        <Pickets m={m} z={0.9} gx={-0.3} />
        {!ghost && (
          <group>
            <RoseArch m={m} at={[-0.3, LAWN, 0.9]} />
            <VegBed m={m} at={[-0.7, LAWN, 0.5]} w={0.36} />
            <Roses m={m} at={[0.2, LAWN, 0.76]} s={0.8} />
            <Roses m={m} at={[-0.78, LAWN, 0.78]} s={0.7} c="#c2185b" />
            <BirdBath m={m} at={[-0.02, LAWN, 0.62]} />
            <Mailbox m={m} at={[0.05, LAWN, 0.98]} c="#e91e63" />
            <Lantern k={k} at={[-0.55, LAWN, 0.76]} h={0.46} />
            {level < 5 && <VegBed m={m} at={[0.6, LAWN, 0.58]} w={0.36} />}
            {level >= 5 && <Greenhouse m={m} k={k} at={[0.62, LAWN, 0.58]} />}
            {level >= 6 && (
              // A rose arbour with a bench under it.
              <group position={[-0.66, LAWN, 0.22]} rotation-y={0.3}>
                <RoseArch m={m} at={[0, 0, 0]} w={0.5} h={0.5} lite />
                <GardenBench m={m} at={[0, 0, -0.02]} />
              </group>
            )}
          </group>
        )}
      </group>
    )
  }
  return <CottageLane def={def} level={level} k={k} />
}

// A one-room wing with its gable to the street and a bay window, facing +z.
function SideWing({ k, at, w, d, H, wall, roof }: { k: Kit; at: V3; w: number; d: number; H: number; wall: string; roof: string }) {
  const { m, win } = k
  const y0 = LAWN + 0.01
  const zf = d / 2
  return (
    <group position={at}>
      <Box m={m} at={[0, LAWN + 0.048, 0]} s={[w + 0.04, 0.096, d + 0.04]} c={STONE} t={brickTex(1, 1)} />
      <Box m={m} at={[0, y0 + H / 2, 0]} s={[w, H, d]} c={wall} t={sidingTex(1, Math.max(1, Math.round(H * 3)))} />
      <group position={[0, y0 + H, 0]} rotation-y={Math.PI / 2}>
        <Gable m={m} w={d} d={w} h={0.42} over={0.07} side={0.06} wall={wall} wallTex roof={roof} />
      </group>
      {/* Bay window: three panes under a little lead roof, a flower box below. */}
      <group position={[0, y0, zf]}>
        <Box m={m} at={[0, 0.2, 0.07]} s={[0.42, 0.18, 0.14]} c={wall} />
        <Box m={m} at={[0, 0.48, 0.07]} s={[0.42, 0.38, 0.14]} c={TRIM} />
        <mesh position={[0, 0.48, 0.144]}><planeGeometry args={[0.34, 0.3]} />{win}</mesh>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.214, 0.48, 0.07]} rotation-y={(sd * Math.PI) / 2}><planeGeometry args={[0.1, 0.3]} />{win}</mesh>)}
        <Box m={m} at={[0, 0.48, 0.15]} s={[0.014, 0.3, 0.01]} c={TRIM} shadow={false} />
        <Box m={m} at={[0, 0.69, 0.08]} s={[0.48, 0.04, 0.18]} c={shade(roof, -0.05)} rot={[0.25, 0, 0]} />
        <Box m={m} at={[0, 0.27, 0.17]} s={[0.44, 0.06, 0.07]} c={WOOD} shadow={false} />
        {[-0.14, 0, 0.14].map((x, i) => <Ball key={x} m={m} at={[x, 0.32, 0.17]} r={0.035} c={i === 1 ? LEAF : '#ec407a'} flat />)}
      </group>
      <Win k={k} at={[w / 2, y0 + H * 0.58, -0.15]} ry={Math.PI / 2} w={0.2} h={0.22} />
      <group position={[0, y0 + H + 0.16, zf + 0.004]}>
        <mesh position={[0, 0, 0.004]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.07, 0.07, 0.012, 14]} />{m(TRIM)}</mesh>
        <mesh position={[0, 0, 0.012]}><circleGeometry args={[0.05, 14]} />{win}</mesh>
      </group>
    </group>
  )
}

// A little glasshouse on a brick footing, its door to the street.
function Greenhouse({ m, k, at }: { m: Mat; k: Kit; at: V3 }) {
  const glass = '#b3e5fc'
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.05, 0]} s={[0.4, 0.1, 0.5]} c="#c98a6e" t={brickTex(1, 1)} />
      <mesh position={[0, 0.25, 0]} castShadow><boxGeometry args={[0.38, 0.3, 0.48]} /><meshStandardMaterial color={glass} transparent opacity={0.55} roughness={0.1} /></mesh>
      <group position={[0, 0.4, 0]} rotation-y={Math.PI / 2}>
        <mesh geometry={prismGeo(0.48, 0.38, 0.16)}><meshStandardMaterial color={glass} transparent opacity={0.55} roughness={0.1} /></mesh>
      </group>
      {/* White glazing bars. */}
      {[-0.19, 0.19].flatMap((x) => [-0.24, 0, 0.24].map((z) => <Box key={`${x}${z}`} m={m} at={[x, 0.25, z]} s={[0.02, 0.3, 0.02]} c={TRIM} shadow={false} />))}
      <Box m={m} at={[0, 0.556, 0]} s={[0.025, 0.02, 0.5]} c={TRIM} shadow={false} />
      {[-0.1, 0.1].map((z) => <Ball key={z} m={m} at={[0, 0.17, z]} r={0.07} c="#66bb6a" flat />)}
      <Ball m={m} at={[0.08, 0.2, 0.0]} r={0.04} c="#ef5350" flat />
      {!k.ghost && <mesh position={[0.14, 0.42, 0.245]}><boxGeometry args={[0.04, 0.04, 0.03]} />{k.bulb}</mesh>}
    </group>
  )
}

// Cottage Lane: a row of little cottages behind their front gardens, a cobbled
// lane in front. A merged pair lines up twice as many along the lane.
function CottageLane({ def, level, k }: { def: NewModelProps['def']; level: number; k: Kit }) {
  const { m, ghost } = k
  const [bx] = useBays()
  const per = 3
  const n = Math.round(per * bx)
  const step = 1.9 / per
  const H = 0.62 + 0.03 * (level - 7)
  const walls = [def.color, shade(def.color, -0.09), shade(def.color, 0.04)]
  const roofs = [def.roof, shade(def.roof, 0.1), shade(def.roof, 0.05)]
  const doors = ['#558b2f', '#1565c0', '#c62828']
  const z0 = -0.42
  return (
    <group>
      <Lawn m={m} />
      {/* The cobbled lane. */}
      <Box m={m} at={[0, LAWN + 0.006, 0.62]} s={[1.9, 0.012, 0.5]} c="#c9bfb2" t={paverTex(6, 2)} shadow={false} />
      {Array.from({ length: n }, (_, i) => {
        const x = ((i + 0.5) / n - 0.5) * 1.9
        const v = i % 3
        return (
          <group key={i} position={[x, 0, 0]}>
            <Upright>
              <LaneCottage k={k} level={level} H={H + (v === 1 ? 0.06 : 0)} wall={walls[v]} roof={roofs[v]} door={doors[v]} z0={z0} w={step - 0.08} v={v} />
            </Upright>
          </group>
        )
      })}
      {!ghost && level >= 8 && [-0.62, 0.62].map((x) => <Lantern key={x} k={k} at={[x, LAWN, 0.9]} h={0.5} />)}
      {!ghost && level >= 10 && (
        <group>
          {/* Bunting strung along the lane between two posts. */}
          {[-0.9, 0.9].map((x) => <Cyl key={x} m={m} at={[x, LAWN + 0.4, 0.38]} r={0.014} h={0.8} c={DARK_WOOD} seg={5} />)}
          <Bulbs from={[-0.9, LAWN + 0.78, 0.38]} to={[0.9, LAWN + 0.78, 0.38]} n={11} sag={0.08} />
        </group>
      )}
      {!ghost && level >= 9 && <Well m={m} at={[0, LAWN, 0.62]} level={level} />}
    </group>
  )
}

// One cottage of the lane, its gable to the lane, its own garden and gate.
function LaneCottage({ k, level, H, wall, roof, door, z0, w, v }: { k: Kit; level: number; H: number; wall: string; roof: string; door: string; z0: number; w: number; v: number }) {
  const { m, ghost, bulb } = k
  const d = 0.72
  const y0 = LAWN + 0.01
  const zf = z0 + d / 2
  const pitch = 0.36
  return (
    <group>
      <Box m={m} at={[0, LAWN + 0.05, z0]} s={[w + 0.03, 0.1, d + 0.03]} c={STONE} t={brickTex(1, 1)} />
      <Box m={m} at={[0, y0 + H / 2, z0]} s={[w, H, d]} c={wall} t={sidingTex(1, Math.max(1, Math.round(H * 3)))} />
      <group position={[0, y0 + H, z0]} rotation-y={Math.PI / 2}>
        <Gable m={m} w={d} d={w} h={pitch} over={0.06} side={0.06} wall={wall} wallTex roof={roof} />
      </group>
      <RoundDoor k={k} at={[-0.13, y0, zf]} w={0.17} h={0.38} c={door} />
      <mesh position={[-0.13, y0 + 0.535, zf + 0.02]}><boxGeometry args={[0.04, 0.04, 0.04]} />{bulb}</mesh>
      <Win k={k} at={[0.13, y0 + H * 0.56, zf]} w={0.15} h={0.18} flowers={['#ec407a', '#ffca28', '#ab47bc'][v]} bars={false} />
      {/* Attic window up in the gable. */}
      <group position={[0, y0 + H + pitch * 0.38, zf + 0.003]}>
        <mesh position={[0, 0, 0.004]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.06, 0.06, 0.012, 12]} />{m(TRIM)}</mesh>
        <mesh position={[0, 0, 0.012]}><circleGeometry args={[0.044, 12]} />{k.win}</mesh>
      </group>
      {/* Chimney up through the back of the roof. */}
      <group position={[w * 0.22, 0, z0 - d * 0.25]}>
        <Box m={m} at={[0, y0 + H + 0.25, 0]} s={[0.1, 0.5, 0.12]} c={STONE} t={brickTex(1, 2)} />
        <Cyl m={m} at={[0, y0 + H + 0.53, 0]} r={0.025} h={0.06} c="#bf6b4a" seg={8} />
      </group>
      {/* Front garden behind a low picket run. */}
      <Box m={m} at={[-0.13, LAWN + 0.012, zf + 0.16]} s={[0.16, 0.024, 0.32]} c="#d7ccc8" t={paverTex(1, 1)} shadow={false} />
      <group position={[0.13, LAWN, zf + 0.3]}>
        {[-0.08, 0, 0.08].map((x) => <mesh key={x} position={[x, 0, 0]} geometry={picketGeo()} scale={[1, 0.8, 1]} castShadow>{m(TRIM)}</mesh>)}
        <Box m={m} at={[0, 0.1, -0.016]} s={[0.21, 0.025, 0.014]} c={TRIM} shadow={false} />
      </group>
      {!ghost && (
        <group>
          <Roses m={m} at={[0.13, LAWN, zf + 0.14]} s={0.55} c={['#e91e63', '#ffb300', '#8e24aa'][v]} />
          {level >= 9 && <RoseArch m={m} at={[-0.13, LAWN, zf + 0.3]} w={0.22} h={0.5} lite />}
        </group>
      )}
    </group>
  )
}

// The lane's old stone well with its little roof and bucket.
function Well({ m, at, level }: { m: Mat; at: V3; level: number }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.09, 0]} r={0.14} h={0.18} c={STONE} seg={12} />
      <mesh position={[0, 0.184, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.11, 12]} /><meshStandardMaterial color="#26404f" /></mesh>
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.12, 0.3, 0]} s={[0.025, 0.42, 0.025]} c={DARK_WOOD} />)}
      <Cyl m={m} at={[0, 0.36, 0]} r={0.018} h={0.22} c={WOOD} seg={6} rot={[0, 0, Math.PI / 2]} />
      <group position={[0, 0.51, 0]} rotation-y={Math.PI / 2}>
        <Gable m={m} w={0.26} d={0.34} h={0.12} over={0.03} side={0.02} wall={WOOD} roof={level >= 10 ? '#8d6e63' : '#6d4c41'} t={0.02} />
      </group>
      <Cyl m={m} at={[0.07, 0.25, 0]} r={0.03} r2={0.025} h={0.05} c="#78909c" seg={8} />
    </group>
  )
}

// ---- Sunny Bungalow ----

// A craftsman porch post: a tapered square column on a brick pier.
function Column({ m, at, h, pier = 0.2, c = TRIM }: { m: Mat; at: V3; h: number; pier?: number; c?: string }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, pier / 2, 0]} s={[0.12, pier, 0.12]} c="#a1665e" t={brickTex(1, 1)} />
      <Box m={m} at={[0, pier + 0.012, 0]} s={[0.13, 0.024, 0.13]} c={STONE} shadow={false} />
      <Cyl m={m} at={[0, pier + 0.024 + (h - pier - 0.024) / 2, 0]} r={0.04} r2={0.062} h={h - pier - 0.024} c={c} seg={4} rot={[0, Math.PI / 4, 0]} />
    </group>
  )
}

function RockingChair({ m, at, rot = 0, c = WOOD }: { m: Mat; at: V3; rot?: number; c?: string }) {
  return (
    <group position={at} rotation-y={rot}>
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, 0.16, 0]} rotation={[0, Math.PI / 2, -Math.PI / 2 - 0.42]} castShadow>
          <torusGeometry args={[0.155, 0.008, 4, 8, 0.84]} />
          {m(DARK_WOOD)}
        </mesh>
      ))}
      {[-0.06, 0.06].flatMap((x) => [-0.04, 0.04].map((z) => <Box key={`${x}${z}`} m={m} at={[x, 0.07, z]} s={[0.014, 0.12, 0.014]} c={c} shadow={false} />))}
      <Box m={m} at={[0, 0.135, 0]} s={[0.14, 0.02, 0.12]} c={c} />
      <Box m={m} at={[0, 0.24, -0.065]} s={[0.14, 0.2, 0.018]} c={c} rot={[-0.18, 0, 0]} />
      {[-0.075, 0.075].map((x) => <Box key={x} m={m} at={[x, 0.2, -0.005]} s={[0.014, 0.014, 0.12]} c={c} shadow={false} />)}
    </group>
  )
}

function Sunflower({ m, at, h = 0.3 }: { m: Mat; at: V3; h?: number }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, h / 2, 0]} r={0.008} h={h} c="#558b2f" seg={4} />
      <Ball m={m} at={[0.025, h * 0.5, 0]} r={0.025} c="#7cb342" flat />
      <group position={[0, h, 0.01]} rotation-x={0.5}>
        <Cyl m={m} at={[0, 0, 0]} r={0.045} h={0.014} c="#fdd835" seg={10} />
        <Cyl m={m} at={[0, 0.009, 0]} r={0.022} h={0.01} c="#6d4c41" seg={8} />
      </group>
    </group>
  )
}

type BungalowProps = {
  k: Kit; at?: V3; w: number; d: number; H: number; wall: string; roof: string; pitch: number; porchX: number; porchW: number
  pd?: number; eave?: number; side?: number; fixed?: boolean; dormer?: boolean; chimney?: boolean; door?: string
}

// Window spots across a front `L` long: one beside the door under the porch,
// then more either side of the porch, every 0.42.
function frontWins(L: number, px: number, pw: number) {
  const xs = [px + 0.15]
  for (const sd of [-1, 1]) for (let x = px + sd * Math.max(pw / 2 + 0.17, sd < 0 ? 0.47 : 0.4); Math.abs(x) <= L / 2 - 0.16; x += sd * 0.42) xs.push(x)
  return xs
}

// A low craftsman bungalow: deep eaves on knee braces, a front-gabled porch on
// tapered columns, wide windows. Faces +z, standing on the lawn. `fixed` lays
// the front windows out once (for a bungalow turned sideways in a court).
function Bungalow({ k, at = [0, 0, 0], w, d, H, wall, roof, pitch, porchX, porchW, pd = 0.42, eave = 0.15, side = 0.09, fixed, dormer, chimney, door = '#6d4c41' }: BungalowProps) {
  const { m, bulb } = k
  const y0 = LAWN + 0.01
  const top = y0 + H
  const zf = d / 2
  const ph = pitch * 0.75
  const ridgeBack = (d / 2) * (ph / pitch) + 0.04
  const pLen = pd - 0.04 + ridgeBack
  const deck = 0.1
  const trim = TRIM
  const doorX = -0.14
  const wins = (xs: number[]) => xs.map((x) => <Win key={x} k={k} at={[x, H * 0.56, 0]} w={0.24} h={0.26} bars={false} />)
  return (
    <group position={at}>
      <Box m={m} at={[0, LAWN + 0.045, 0]} s={[w + 0.03, 0.09, d + 0.03]} c="#a1665e" t={brickTex(Math.max(1, Math.round(w * 2)), 1)} />
      <Box m={m} at={[0, y0 + H / 2, 0]} s={[w, H, d]} c={wall} t={sidingTex(Math.max(1, Math.round(w * 1.5)), Math.max(1, Math.round(H * 3)))} />
      <Box m={m} at={[0, top - 0.024, 0]} s={[w + 0.012, 0.04, d + 0.012]} c={trim} shadow={false} />
      <group position={[0, top, 0]}>
        <Gable m={m} w={w} d={d} h={pitch} over={eave} side={side} wall={wall} wallTex roof={roof} />
      </group>
      {/* Knee braces under the gable eaves, and a vent up in each gable. */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * (w / 2 + 0.004), top, 0]}>
          {[-0.3, 0.3].map((z) => <Box key={z} m={m} at={[sd * 0.035, -0.03, z * d]} s={[0.09, 0.022, 0.03]} c={trim} rot={[0, 0, sd * 0.6]} shadow={false} />)}
          <Box m={m} at={[0, pitch * 0.4, 0]} s={[0.012, 0.08, 0.14]} c={trim} shadow={false} />
        </group>
      ))}
      {/* The porch: deck on a brick skirt, a gable on two columns, steps. */}
      <group position={[porchX, 0, 0]}>
        <Box m={m} at={[0, LAWN + deck / 2, zf + pd / 2]} s={[porchW, deck, pd]} c="#a1665e" t={brickTex(2, 1)} />
        <Box m={m} at={[0, LAWN + deck + 0.006, zf + pd / 2]} s={[porchW + 0.02, 0.012, pd + 0.02]} c="#a1887f" t={paverTex(3, 1)} shadow={false} />
        <Box m={m} at={[doorX, LAWN + 0.03, zf + pd + 0.06]} s={[0.3, 0.06, 0.1]} c={STONE} />
        {[-1, 1].map((sd) => <Column key={sd} m={m} at={[(sd * (porchW - 0.12)) / 2, LAWN + deck + 0.012, zf + pd - 0.07]} h={top - LAWN - deck - 0.012 - 0.03} />)}
        <Box m={m} at={[0, top - 0.03, zf + pd - 0.07]} s={[porchW, 0.06, 0.08]} c={trim} />
        {[-1, 1].map((sd) => <Box key={sd} m={m} at={[(sd * (porchW - 0.12)) / 2, top - 0.03, zf + (pd - 0.07) / 2]} s={[0.06, 0.05, pd - 0.07]} c={trim} shadow={false} />)}
        <group position={[0, top, zf + pd - 0.03 - pLen / 2]} rotation-y={Math.PI / 2}>
          <Gable m={m} w={pLen} d={porchW} h={ph} over={0.08} side={0.06} wall={wall} wallTex roof={roof} />
        </group>
        {/* Craftsman stickwork in the porch gable. */}
        <Box m={m} at={[0, top + ph * 0.3, zf + pd - 0.026]} s={[porchW * 0.5, 0.02, 0.012]} c={trim} shadow={false} />
        <Box m={m} at={[0, top + ph * 0.45, zf + pd - 0.026]} s={[0.02, ph * 0.5, 0.01]} c={trim} shadow={false} />
        <Door k={k} at={[doorX, LAWN + deck + 0.012, zf]} w={0.24} h={0.56} c={door} />
        <mesh position={[doorX - 0.19, LAWN + deck + 0.5, zf + 0.02]}><boxGeometry args={[0.05, 0.07, 0.04]} />{bulb}</mesh>
        {!k.ghost && <Pool r={0.42} x={doorX} z={zf + pd + 0.3} />}
      </group>
      {fixed ? (
        <group position={[0, y0, zf]}>{wins(frontWins(w, porchX, porchW))}</group>
      ) : (
        <Facade at={[0, y0, zf]} len={w}>{(L) => wins(frontWins(L, (porchX * L) / w, porchW))}</Facade>
      )}
      {[-1, 1].map((sd) => <Win key={sd} k={k} at={[sd * (w / 2), y0 + H * 0.56, -d * 0.08]} ry={(sd * Math.PI) / 2} w={0.22} h={0.24} bars={false} />)}
      {[-0.25, 0.25].map((x) => (
        <group key={x} position={[x * w, y0 + H * 0.56, -zf]} rotation-y={Math.PI}>
          <Box m={m} at={[0, 0, 0.008]} s={[0.29, 0.3, 0.016]} c={trim} shadow={false} />
          <mesh position={[0, 0, 0.02]}><planeGeometry args={[0.24, 0.25]} />{k.win}</mesh>
        </group>
      ))}
      {dormer && (
        // A shed dormer on the front slope, right of the porch: two windows under a low roof.
        <group position={[w / 2 - 0.29, top, 0]}>
          <Box m={m} at={[0, 0.27, d * 0.15]} s={[0.46, 0.24, d * 0.3]} c={wall} t={sidingTex(1, 1)} />
          <Box m={m} at={[0, 0.405, d * 0.16]} s={[0.54, 0.03, d * 0.38]} c={roof} rot={[0.11, 0, 0]} t={shingleTex(2, 1)} />
          {[-0.11, 0.11].map((x) => (
            <group key={x} position={[x, 0.28, d * 0.3]}>
              <Box m={m} at={[0, 0, 0.008]} s={[0.17, 0.15, 0.016]} c={trim} shadow={false} />
              <mesh position={[0, 0, 0.02]}><planeGeometry args={[0.13, 0.11]} />{k.win}</mesh>
            </group>
          ))}
        </group>
      )}
      {chimney && (
        // Brick chimney up through the back slope.
        <group position={[-w / 2 + 0.22, top, -d * 0.24]}>
          <Box m={m} at={[0, (pitch + 0.2) / 2, 0]} s={[0.16, pitch + 0.2, 0.2]} c="#a1665e" t={brickTex(1, 2)} />
          <Box m={m} at={[0, pitch + 0.22, 0]} s={[0.2, 0.04, 0.24]} c="#8d8178" />
        </group>
      )}
    </group>
  )
}

// An open carport: a low roof on two tapered posts against the house wall.
function Carport({ m, at, w, d, h, roof, solar }: { m: Mat; at: V3; w: number; d: number; h: number; roof: string; solar?: boolean }) {
  return (
    <group position={at}>
      {[-1, 1].map((sd) => <Column key={sd} m={m} at={[w / 2 - 0.06, LAWN, (sd * (d - 0.12)) / 2]} h={h - 0.05} pier={0.16} />)}
      <Box m={m} at={[w / 2 - 0.06, h - 0.03, 0]} s={[0.07, 0.06, d]} c={TRIM} />
      <Box m={m} at={[0, h + 0.015, 0]} s={[w + 0.06, 0.04, d + 0.08]} c={roof} rot={[0, 0, -0.05]} />
      <Box m={m} at={[0, h - 0.002, 0]} s={[w + 0.06, 0.012, d + 0.08]} c={TRIM} rot={[0, 0, -0.05]} shadow={false} />
      {solar && [-0.24, 0.0, 0.24].map((z) => (
        <group key={z} position={[0, h + 0.04, z * (d / 1.1)]} rotation-z={-0.05}>
          <Box m={m} at={[0, 0.012, 0]} s={[w * 0.8, 0.024, d * 0.2]} c="#90a4ae" shadow={false} />
          <mesh position={[0, 0.0245, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[w * 0.76, d * 0.18]} /><meshStandardMaterial color="#1a3a6b" metalness={0.5} roughness={0.25} /></mesh>
        </group>
      ))}
    </group>
  )
}

function ParkedCar({ at, body, color, rot = 0, s = 0.55 }: { at: V3; body: 'wagon' | 'compact' | 'hatch' | 'suv' | 'truck' | 'sedan' | 'van' | 'classic'; color: string; rot?: number; s?: number }) {
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

function Shrub({ m, at, r = 0.1, c = LEAF }: { m: Mat; at: V3; r?: number; c?: string }) {
  return <Ball m={m} at={[at[0], at[1] + r * 0.75, at[2]]} r={r} c={c} flat />
}

function BungalowLot({ def, level, k }: { def: NewModelProps['def']; level: number; k: Kit }) {
  const { m, ghost } = k
  const stage = growthStage(level)
  if (stage === 3) return <BungalowCourt def={def} level={level} k={k} />
  const big = stage === 2
  const w = big ? 1.26 : 1.2
  const d = big ? 1.0 : 0.92
  const H = big ? 0.74 + 0.03 * (level - 4) : 0.72
  const x0 = 0.39 - w / 2
  const z0 = big ? -0.32 : -0.26
  const zf = z0 + d / 2
  const pw = 0.8
  const px = -w / 2 + pw / 2 + 0.02
  const walkX = x0 + px - 0.14
  const portX = 0.66
  return (
    <group>
      <Lawn m={m} />
      {/* Driveway up to the carport. */}
      <Box m={m} at={[portX, LAWN + 0.008, -0.03]} s={[0.56, 0.016, 1.86]} c="#d8d4cc" t={paverTex(1, 4)} shadow={false} />
      <Bungalow k={k} at={[x0, 0, z0]} w={w} d={d} H={H} wall={def.color} roof={def.roof} pitch={big ? 0.44 : 0.32} porchX={px} porchW={pw} side={0.07} dormer={big} chimney={big} />
      <Carport m={m} at={[portX, 0, z0 + 0.02]} w={0.54} d={d + 0.12} h={LAWN + 0.01 + H} roof={def.roof} solar={level >= 6} />
      {/* Front walk from the porch steps. */}
      <Box m={m} at={[walkX, LAWN + 0.008, (zf + 0.53 + 0.95) / 2]} s={[0.26, 0.016, 0.95 - zf - 0.53]} c="#d8d4cc" t={paverTex(1, 2)} shadow={false} />
      {!ghost && (
        <group>
          {/* Both parked nose-in along the drive: the wagon under the carport, a second car behind it. */}
          <ParkedCar at={[portX, LAWN + 0.016, z0 - 0.02]} body="wagon" color="#4fc3f7" />
          {level >= 5 && <ParkedCar at={[portX + 0.02, LAWN + 0.016, 0.56]} body="compact" color="#ef5350" rot={Math.PI} s={0.5} />}
          <Mailbox m={m} at={[0.3, LAWN, 0.95]} c="#1565c0" />
          <Shrub m={m} at={[x0 + px - pw / 2 - 0.0, LAWN, zf + 0.5]} r={0.08} />
          <Shrub m={m} at={[x0 + px + pw / 2 + 0.1, LAWN, zf + 0.12]} r={0.1} />
          <Tree m={m} at={[-0.68, LAWN, 0.68]} s={0.6} leaves={PAL.leaves} bare={BARE} />
          {/* Path lights either side of the walk. */}
          {[-1, 1].map((sd) => (
            <group key={sd} position={[walkX + sd * 0.19, LAWN, 0.84]}>
              <Cyl m={m} at={[0, 0.08, 0]} r={0.014} h={0.16} c="#37474f" seg={6} />
              <mesh position={[0, 0.18, 0]}><boxGeometry args={[0.045, 0.045, 0.045]} />{k.bulb}</mesh>
              <Box m={m} at={[0, 0.215, 0]} s={[0.06, 0.02, 0.06]} c="#37474f" shadow={false} />
            </group>
          ))}
          {level >= 2 && [0.04, 0.22].map((x, i) => <RockingChair key={x} m={m} at={[x0 + px + x, LAWN + 0.112, zf + 0.2]} rot={i ? -0.35 : 0.1} c="#fafafa" />)}
          {level >= 3 && [0, 0.08, 0.16, 0.24].map((x, i) => <Sunflower key={x} m={m} at={[x0 + px + pw / 2 + 0.06 + x, LAWN, zf + 0.12 + (i % 2) * 0.06]} h={0.26 + (i % 3) * 0.05} />)}
          {big && <BirdBath m={m} at={[0.12, LAWN, 0.62]} />}
          {level >= 6 && <Bulbs from={[x0 + px - pw / 2 + 0.02, LAWN + H - 0.04, zf + 0.4]} to={[x0 + px + pw / 2 - 0.02, LAWN + H - 0.04, zf + 0.4]} n={7} sag={0.04} />}
        </group>
      )}
    </group>
  )
}

// Bungalow Court: three little bungalows round a shared garden court, the
// side ones facing in across it.
function BungalowCourt({ def, level, k }: { def: NewModelProps['def']; level: number; k: Kit }) {
  const { m, ghost } = k
  const H = 0.66 + 0.03 * (level - 7)
  const walls = [def.color, shade(def.color, -0.08), shade(def.color, 0.05)]
  const sz = 0.36
  return (
    <group>
      <Lawn m={m} />
      {/* Paved court walk up the middle, out to each side door. */}
      <Box m={m} at={[0, LAWN + 0.008, 0.25]} s={[0.26, 0.016, 1.4]} c="#d8d4cc" t={paverTex(1, 4)} shadow={false} />
      <Box m={m} at={[0, LAWN + 0.01, sz - 0.14]} s={[0.84, 0.02, 0.18]} c="#d8d4cc" t={paverTex(3, 1)} shadow={false} />
      <Bungalow k={k} at={[0, 0, -0.68]} w={1.06} d={0.46} H={H} wall={walls[0]} roof={def.roof} pitch={0.24} porchX={0.14} porchW={0.46} pd={0.22} eave={0.07} side={0.05} fixed />
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.74, 0, sz]}>
          <Upright>
          <group rotation-y={(-sd * Math.PI) / 2}>
          <Bungalow k={k} w={0.74} d={0.4} H={H - 0.04} wall={walls[sd < 0 ? 1 : 2]} roof={shade(def.roof, sd * 0.06)} pitch={0.22} porchX={0.14} porchW={0.42} pd={0.2} eave={0.06} side={0.05} fixed door={sd < 0 ? '#2e7d32' : '#c62828'} />
          </group>
          </Upright>
        </group>
      ))}
      {!ghost && (
        <group>
          <Shrub m={m} at={[-0.3, LAWN, 0.86]} r={0.09} />
          <Shrub m={m} at={[0.3, LAWN, 0.86]} r={0.09} />
          {[-0.62, 0.62].map((x) => [0.82].map((z) => <Sunflower key={`${x}${z}`} m={m} at={[x, LAWN, z]} h={0.3} />))}
          {level >= 8 && [-0.24, 0.24].map((x) => <Lantern key={x} k={k} at={[x, LAWN, 0.66]} h={0.5} />)}
          {level >= 9 && <BirdBath m={m} at={[0, LAWN, 0.62]} />}
          {level >= 10 && <Bulbs from={[-0.3, LAWN + 0.94, 0.92]} to={[0.3, LAWN + 0.94, 0.92]} n={6} sag={0.05} posts={0.94} />}
        </group>
      )}
    </group>
  )
}

// ---- Log Cabin ----

// Stacked-log walls round a w x d box: front and back logs run along x, the
// side logs along z half a log higher, so they cross at the notched corners and
// stick out past them. The door gap is left open in the front logs; chinking
// (a pale core box) shows between the logs.
const LOG_R = 0.04
const LOG_STEP = 0.09
function LogWalls({ m, at = [0, 0, 0], w, d, rows, color, door, ext = 0.07, gable, gableZ }: {
  m: Mat; at?: V3; w: number; d: number; rows: number; color: string; door?: { x: number; w: number; h: number }; ext?: number; gable?: number; gableZ?: number
}) {
  const logs: ReactNode[] = []
  const alt = shade(color, 0.05)
  const H = rows * LOG_STEP
  // Every log stretches with a merged pair, so the courses stay unbroken.
  const log = (key: string, at: V3, len: number, c: string, alongX: boolean) =>
    logs.push(
      <mesh key={key} userData={STRETCH} position={at} rotation={alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[LOG_R, LOG_R, len, 7]} />
        {m(c)}
      </mesh>,
    )
  const along = (key: string, x0: number, x1: number, y: number, z: number, c: string) => log(key, [(x0 + x1) / 2, y, z], x1 - x0, c, true)
  for (let i = 0; i < rows; i++) {
    const y = LOG_R + i * LOG_STEP
    const c = i % 2 ? alt : color
    for (const sd of [-1, 1]) {
      const z = (sd * d) / 2
      if (sd > 0 && door && y < door.h + LOG_R) {
        along(`f${i}a`, -w / 2 - ext, door.x - door.w / 2, y, z, c)
        along(`f${i}b`, door.x + door.w / 2, w / 2 + ext, y, z, c)
      } else along(`${sd}${i}`, -w / 2 - ext, w / 2 + ext, y, z, c)
      log(`s${sd}${i}`, [(sd * w) / 2, y + LOG_STEP / 2, 0], d + ext * 2, i % 2 ? color : alt, false)
    }
  }
  // Gable ends in logs too, each shorter than the one under it.
  if (gable)
    for (let j = 0; ; j++) {
      const y = H + LOG_STEP / 2 + LOG_R + j * LOG_STEP
      const len = d * (1 - (y - H + LOG_R) / gable)
      if (len < 0.12) break
      for (const sd of [-1, 1]) log(`g${sd}${j}`, [(sd * w) / 2, y, 0], len, j % 2 ? alt : color, false)
    }
  // Or at the front and back, for a roof with its ridge along z.
  if (gableZ)
    for (let j = 0; ; j++) {
      const y = H + LOG_R + j * LOG_STEP
      const len = w * (1 - Math.max(0, y + LOG_R - H - LOG_STEP / 2) / gableZ)
      if (len < 0.12) break
      for (const sd of [-1, 1]) along(`gz${sd}${j}`, -len / 2, len / 2, y, (sd * d) / 2, j % 2 ? color : alt)
    }
  return (
    <group position={at}>
      <Box m={m} at={[0, H / 2 + 0.02, 0]} s={[w - 0.012, H + 0.04, d - 0.012]} c="#d7ccc8" />
      {logs}
    </group>
  )
}

// A window set into log walls: a plank surround standing proud of the logs.
function LogWin({ k, at, w = 0.24, h = 0.24, ry = 0 }: { k: Kit; at: V3; w?: number; h?: number; ry?: number }) {
  const { m, win } = k
  return (
    <group position={at} rotation-y={ry}>
      <Box m={m} at={[0, 0, 0.012]} s={[w + 0.08, h + 0.08, 0.06]} c={DARK_WOOD} shadow={false} />
      <mesh position={[0, 0, 0.046]}><planeGeometry args={[w, h]} />{win}</mesh>
      <Box m={m} at={[0, -h / 2 - 0.045, 0.05]} s={[w + 0.12, 0.024, 0.07]} c={WOOD} shadow={false} />
    </group>
  )
}

function Pine({ m, at, s = 1 }: { m: Mat; at: V3; s?: number }) {
  const g = BARE ? ['#2e5d3a', '#356b43', '#3c7a4c'] : ['#2e7d32', '#388e3c', '#43a047']
  return (
    <group position={at} scale={s}>
      <Cyl m={m} at={[0, 0.12, 0]} r={0.035} r2={0.05} h={0.24} c="#5d4037" seg={6} />
      {[[0.2, 0.24, 0.4], [0.46, 0.19, 0.34], [0.72, 0.13, 0.3]].map(([y, r, h], i) => (
        <mesh key={i} position={[0, y + h / 2, 0]} castShadow><coneGeometry args={[r, h, 7]} />{m(g[i])}</mesh>
      ))}
    </group>
  )
}

// Split firewood stacked against two posts, a chopping stump and its axe.
function WoodPile({ m, at, rot = 0 }: { m: Mat; at: V3; rot?: number }) {
  const rows = [4, 3, 3]
  return (
    <group position={at} rotation-y={rot}>
      {rows.flatMap((n, j) => Array.from({ length: n }, (_, i) => (
        <Cyl key={`${j}${i}`} m={m} at={[(i - (n - 1) / 2) * 0.075 + (j % 2) * 0.0375 * (n === rows[0] ? 0 : 0), 0.035 + j * 0.065, 0]} r={0.034} h={0.24} c={(i + j) % 2 ? '#a1887f' : '#8d6e63'} seg={6} rot={[Math.PI / 2, 0, 0]} />
      )))}
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.17, 0.12, 0]} s={[0.03, 0.24, 0.03]} c={DARK_WOOD} />)}
      <group position={[0.32, 0, 0.12]}>
        <Cyl m={m} at={[0, 0.06, 0]} r={0.07} h={0.12} c="#8d6e63" seg={10} />
        <group position={[0, 0.12, 0]} rotation-z={0.5}>
          <Box m={m} at={[0, 0.1, 0]} s={[0.016, 0.2, 0.016]} c="#a1887f" />
          <Box m={m} at={[0.02, 0.012, 0]} s={[0.05, 0.03, 0.012]} c="#78909c" />
        </group>
      </group>
    </group>
  )
}

function Canoe({ m, at, rot = 0 }: { m: Mat; at: V3; rot?: number }) {
  return (
    <group position={at} rotation-y={rot}>
      {[-0.22, 0.22].map((z) => (
        <group key={z} position={[0, 0, z]}>
          {[-0.1, 0.1].map((x) => <Box key={x} m={m} at={[x, 0.13, 0]} s={[0.025, 0.26, 0.025]} c={DARK_WOOD} />)}
          <Box m={m} at={[0, 0.25, 0]} s={[0.25, 0.025, 0.04]} c={DARK_WOOD} />
        </group>
      ))}
      <mesh position={[0, 0.32, 0]} rotation-x={Math.PI / 2} scale={[1, 1, 0.55]} castShadow><capsuleGeometry args={[0.07, 0.6, 4, 10]} />{m('#e65100')}</mesh>
    </group>
  )
}

// A front-gable roof (ridge along z) with its gable end glazed: a tall glass
// triangle split by timber mullions. Sits on y = 0.
const triCache = new Map<string, BufferGeometry>()
function triGeo(d: number, h: number) {
  const key = `${d.toFixed(3)}|${h.toFixed(3)}`
  const cached = triCache.get(key)
  if (cached) return cached
  const s = new Shape()
  s.moveTo(-d / 2, 0)
  s.lineTo(d / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false })
  triCache.set(key, g)
  return g
}

function GlassGable({ k, at, span, len, h, wall, roof, over = 0.14 }: { k: Kit; at: V3; span: number; len: number; h: number; wall: string; roof: string; over?: number }) {
  const { m, win } = k
  const ins = 0.07
  const gh = h * (1 - (2 * ins) / span) - 0.04
  return (
    <group position={at}>
      <group rotation-y={Math.PI / 2}>
        <Gable m={m} w={len} d={span} h={h} over={over} side={0.1} wall={wall} roof={roof} t={0.045} />
      </group>
      <group position={[0, 0.02, len / 2]}>
        <mesh geometry={triGeo(span - ins * 2, gh)} position={[0, 0, 0.002]}>{win}</mesh>
        {[-0.25, 0, 0.25].map((f) => {
          const x = f * (span - ins * 2)
          const hh = gh * (1 - Math.abs(f) * 2) - 0.01
          return <Box key={f} m={m} at={[x, hh / 2, 0.016]} s={[0.03, hh, 0.02]} c={DARK_WOOD} shadow={false} />
        })}
        <Box m={m} at={[0, gh * 0.42, 0.017]} s={[(span - ins * 2) * 0.58, 0.026, 0.018]} c={DARK_WOOD} shadow={false} />
        <Box m={m} at={[0, 0.0, 0.021]} s={[span - ins * 2 + 0.04, 0.04, 0.03]} c={DARK_WOOD} shadow={false} />
      </group>
    </group>
  )
}

function CabinLot({ def, level, k }: { def: NewModelProps['def']; level: number; k: Kit }) {
  const stage = growthStage(level)
  if (stage === 1) return <LogCabin def={def} level={level} k={k} />
  if (stage === 2) return <TimberLodge def={def} level={level} k={k} />
  return <MountainLodge def={def} level={level} k={k} />
}

function LogCabin({ def, level, k }: { def: NewModelProps['def']; level: number; k: Kit }) {
  const { m, ghost, bulb } = k
  const w = 1.0
  const d = 0.86
  const rows = 8
  const x0 = -0.05
  const z0 = -0.4
  const y0 = LAWN + 0.06
  const H = rows * LOG_STEP
  const top = y0 + H
  const zf = z0 + d / 2
  const pitch = 0.52
  const pd = 0.38
  return (
    <group>
      <Lawn m={m} />
      {/* Fieldstone footing under the logs. */}
      <Box m={m} at={[x0, LAWN + 0.03, z0]} s={[w + 0.06, 0.06, d + 0.06]} c={STONE} t={brickTex(2, 1)} />
      <LogWalls m={m} at={[x0, y0, z0]} w={w} d={d} rows={rows} color={def.color} door={{ x: 0, w: 0.26, h: 0.56 }} gableZ={pitch} />
      <group position={[x0, top + LOG_STEP / 2, z0]} rotation-y={Math.PI / 2}>
        <Gable m={m} w={d} d={w} h={pitch} over={0.12} side={0.14} wall={shade(def.color, -0.05)} roof={def.roof} t={0.04} />
      </group>
      {/* Plank door with strap hinges, a lantern beside it. */}
      <group position={[x0, y0, zf]}>
        <mesh position={[0, 0.28, 0.0]}><planeGeometry args={[0.26, 0.56]} />{m(DARK_WOOD)}</mesh>
        {[0.12, 0.42].map((y) => <Box key={y} m={m} at={[-0.04, y, 0.006]} s={[0.16, 0.02, 0.008]} c="#37474f" shadow={false} />)}
        <Box m={m} at={[0, 0.575, 0.034]} s={[0.36, 0.05, 0.06]} c={WOOD} />
        {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.152, 0.28, 0.034]} s={[0.05, 0.56, 0.06]} c={WOOD} shadow={false} />)}
        <Ball m={m} at={[0.09, 0.28, 0.012]} r={0.014} c="#37474f" />
        <mesh position={[-0.21, 0.5, 0.07]}><boxGeometry args={[0.05, 0.07, 0.05]} />{bulb}</mesh>
        <Box m={m} at={[-0.21, 0.55, 0.07]} s={[0.07, 0.025, 0.07]} c="#263238" shadow={false} />
      </group>
      {[-0.33, 0.33].map((x) => <LogWin key={x} k={k} at={[x0 + x, y0 + 0.38, zf + 0.03]} w={0.2} h={0.24} />)}
      <LogWin k={k} at={[x0, top + 0.2, zf + 0.03]} w={0.18} h={0.16} />
      <LogWin k={k} at={[x0 + w / 2 + 0.03, y0 + 0.38, z0 + 0.18]} ry={Math.PI / 2} w={0.22} h={0.24} />
      <LogWin k={k} at={[x0 - w / 2 - 0.03, y0 + 0.38, z0]} ry={-Math.PI / 2} w={0.22} h={0.24} />
      <LogWin k={k} at={[x0, y0 + 0.38, z0 - d / 2 - 0.03]} ry={Math.PI} w={0.26} h={0.22} />
      {/* Porch: plank deck on log posts under a lean-to roof, log rails, steps. */}
      <group position={[x0, 0, zf]}>
        <Box m={m} at={[0, LAWN + 0.05, pd / 2]} s={[w + 0.12, 0.1, pd]} c={WOOD} t={paverTex(4, 1)} />
        {[-1, 1].map((sd) => (
          <Cyl key={sd} m={m} at={[sd * (w / 2), LAWN + 0.1 + (top - 0.17 - LAWN - 0.1) / 2, pd - 0.05]} r={0.035} h={top - 0.17 - LAWN - 0.1} c={def.color} seg={7} />
        ))}
        <Box m={m} at={[0, top - 0.08, pd / 2 + 0.02]} s={[w + 0.2, 0.035, pd + 0.12]} c={def.roof} rot={[0.26, 0, 0]} t={shingleTex(3, 1)} />
        <Cyl m={m} at={[0, top - 0.17, pd - 0.05]} r={0.03} h={w + 0.06} c={def.color} seg={7} rot={[0, 0, Math.PI / 2]} />
        {/* Log rails either side of the steps, stretching with a merged porch. */}
        {[-1, 1].map((sd) => (
          <mesh key={sd} userData={STRETCH} position={[sd * (w / 4 + 0.09), LAWN + 0.3, pd - 0.05]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.022, 0.022, w / 2 - 0.18, 6]} />
            {m(shade(def.color, 0.05))}
          </mesh>
        ))}
        <Box m={m} at={[0, LAWN + 0.03, pd + 0.06]} s={[0.3, 0.06, 0.12]} c={WOOD} />
        {!ghost && <RockingChair m={m} at={[-0.3, LAWN + 0.1, 0.18]} rot={0.3} />}
        {!ghost && <RockingChair m={m} at={[0.3, LAWN + 0.1, 0.18]} rot={-0.3} />}
        {!ghost && <Pool r={0.45} z={pd + 0.3} />}
      </group>
      {/* Stone chimney up the right side, past the eaves. */}
      <group position={[x0 + w / 2 + 0.1, 0, z0 - 0.08]}>
        <Box m={m} at={[0, LAWN + 0.24, 0]} s={[0.2, 0.48, 0.28]} c={STONE} t={brickTex(1, 2)} />
        <Box m={m} at={[-0.01, LAWN + 0.48 + (top + 0.42 - LAWN - 0.48) / 2, 0]} s={[0.15, top + 0.42 - LAWN - 0.48, 0.2]} c={STONE} t={brickTex(1, 3)} />
        <Box m={m} at={[-0.01, top + 0.44, 0]} s={[0.19, 0.04, 0.24]} c="#8d8178" />
      </group>
      {/* Gravel walk to the steps. */}
      <Box m={m} at={[x0, LAWN + 0.008, (zf + pd + 0.12 + 0.97) / 2]} s={[0.26, 0.016, 0.97 - zf - pd - 0.12]} c="#ffffff" t={gravelTex(1, 2)} shadow={false} />
      {!ghost && (
        <group>
          <WoodPile m={m} at={[0.68, LAWN, 0.36]} rot={-Math.PI / 2} />
          <Pine m={m} at={[-0.8, LAWN, -0.66]} s={0.62} />
          <Pine m={m} at={[-0.8, LAWN, 0.12]} s={0.55} />
          <Mailbox m={m} at={[0.36, LAWN, 0.94]} c="#2e7d32" />
          {level >= 2 && <Pine m={m} at={[0.78, LAWN, -0.8]} s={0.62} />}
          {level >= 2 && <Lantern k={k} at={[x0 + 0.24, LAWN, 0.84]} h={0.46} />}
          {level >= 3 && <ParkedCar at={[-0.5, LAWN, 0.8]} body="truck" color="#c62828" rot={Math.PI / 2} s={0.46} />}
        </group>
      )}
    </group>
  )
}

function TimberLodge({ def, level, k }: { def: NewModelProps['def']; level: number; k: Kit }) {
  const { m, ghost, bulb } = k
  const w = 1.16
  const d = 0.92
  const rows = 8 + (level - 4)
  const x0 = -0.12
  const z0 = -0.38
  const y0 = LAWN + 0.08
  const H = rows * LOG_STEP
  const top = y0 + H
  const zf = z0 + d / 2
  const pitch = 0.78
  const doorX = -0.1
  const bal = 0.34
  return (
    <group>
      <Lawn m={m} />
      <Box m={m} at={[x0, LAWN + 0.04, z0]} s={[w + 0.08, 0.08, d + 0.08]} c={STONE} t={brickTex(2, 1)} />
      <group rotation-y={Math.PI / 2} position={[x0, y0, z0]}>
        <LogWalls m={m} w={d} d={w} rows={rows} color={def.color} />
      </group>
      <GlassGable k={k} at={[x0, top + LOG_STEP / 2, z0]} span={w} len={d} h={pitch} wall={shade(def.color, -0.05)} roof={def.roof} />
      {/* Front: double doors and windows, a balcony across on log brackets. */}
      <group position={[x0, y0, zf + LOG_R]}>
        <Box m={m} at={[doorX, 0.29, 0]} s={[0.36, 0.58, 0.03]} c={WOOD} />
        {[-0.08, 0.08].map((x) => <mesh key={x} position={[doorX + x, 0.27, 0.017]}><planeGeometry args={[0.14, 0.52]} />{m(DARK_WOOD)}</mesh>)}
        {[-0.08, 0.08].map((x) => <mesh key={`g${x}`} position={[doorX + x, 0.4, 0.019]}><planeGeometry args={[0.09, 0.18]} />{k.win}</mesh>)}
        <mesh position={[doorX + 0.26, 0.48, 0.03]}><boxGeometry args={[0.05, 0.07, 0.05]} />{bulb}</mesh>
      </group>
      <LogWin k={k} at={[x0 + 0.32, y0 + 0.36, zf + 0.03]} w={0.26} h={0.26} />
      {[-1, 1].map((sd) => [-0.2, 0.22].map((z) => (
        <LogWin key={`${sd}${z}`} k={k} at={[x0 + sd * (w / 2 + 0.03), y0 + (z > 0 ? 0.36 : H - 0.22), z0 + z]} ry={(sd * Math.PI) / 2} w={0.22} h={0.22} />
      )))}
      {/* Balcony over the porch, on log posts. */}
      <group position={[x0, 0, zf]}>
        <Box m={m} at={[0, LAWN + 0.05, bal / 2 + 0.02]} s={[w + 0.12, 0.1, bal + 0.04]} c={WOOD} t={paverTex(4, 1)} />
        <Box m={m} at={[0, y0 + 0.62, bal / 2 + 0.02]} s={[w + 0.12, 0.05, bal + 0.04]} c={WOOD} t={paverTex(4, 1)} />
        {[-1, 1].map((sd) => <Cyl key={sd} m={m} at={[sd * (w / 2 + 0.02), LAWN + 0.1 + (y0 + 0.595 - LAWN - 0.1) / 2, bal - 0.02]} r={0.035} h={y0 + 0.595 - LAWN - 0.1} c={def.color} seg={7} />)}
        <Box m={m} at={[0, y0 + 0.645 + 0.15, bal + 0.02]} s={[w + 0.12, 0.03, 0.03]} c={DARK_WOOD} />
        {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * (w / 2 + 0.045), y0 + 0.645 + 0.15, bal / 2 + 0.02]} s={[0.03, 0.03, bal]} c={DARK_WOOD} shadow={false} />)}
        <Facade at={[0, y0 + 0.645, bal + 0.02]} len={w + 0.1}>
          {(L) => Array.from({ length: Math.round(L / 0.13) }, (_, i) => (
            <Box key={i} m={m} at={[-L / 2 + (i + 0.5) * (L / Math.round(L / 0.13)), 0.075, 0]} s={[0.02, 0.15, 0.02]} c={DARK_WOOD} shadow={false} />
          ))}
        </Facade>
        <Box m={m} at={[doorX, LAWN + 0.03, bal + 0.1]} s={[0.36, 0.06, 0.12]} c={WOOD} />
        {!ghost && <RockingChair m={m} at={[0.28, LAWN + 0.1, 0.16]} rot={-0.3} />}
        {!ghost && <RockingChair m={m} at={[-0.42, LAWN + 0.1, 0.16]} rot={0.3} />}
        {!ghost && <Pool r={0.45} x={doorX} z={bal + 0.32} />}
      </group>
      {/* Stone chimney up the left side. */}
      <group position={[x0 - w / 2 - 0.12, 0, z0 - 0.05]}>
        <Box m={m} at={[0, LAWN + 0.35, 0]} s={[0.24, 0.7, 0.32]} c={STONE} t={brickTex(1, 2)} />
        <Box m={m} at={[0.01, LAWN + 0.7 + (top + 0.55 - LAWN - 0.7) / 2, 0]} s={[0.18, top + 0.55 - LAWN - 0.7, 0.22]} c={STONE} t={brickTex(1, 3)} />
        <Box m={m} at={[0.01, top + 0.57, 0]} s={[0.22, 0.04, 0.26]} c="#8d8178" />
      </group>
      <Box m={m} at={[x0 + doorX, LAWN + 0.008, (zf + bal + 0.16 + 0.97) / 2]} s={[0.3, 0.016, 0.97 - zf - bal - 0.16]} c="#ffffff" t={gravelTex(1, 2)} shadow={false} />
      <Box m={m} at={[0.68, LAWN + 0.008, 0.2]} s={[0.44, 0.016, 1.5]} c="#ffffff" t={gravelTex(1, 3)} shadow={false} />
      {!ghost && (
        <group>
          <ParkedCar at={[0.68, LAWN + 0.016, 0.3]} body="suv" color="#33691e" s={0.5} />
          <WoodPile m={m} at={[0.64, LAWN, -0.62]} rot={Math.PI} />
          <Pine m={m} at={[-0.8, LAWN, 0.45]} s={0.62} />
          <Pine m={m} at={[-0.62, LAWN, 0.8]} s={0.5} />
          <Mailbox m={m} at={[0.36, LAWN, 0.94]} c="#2e7d32" />
          <Lantern k={k} at={[x0 + doorX + 0.26, LAWN, 0.8]} h={0.5} />
          {level >= 5 && <HotTub m={m} at={[0.25, LAWN, 0.72]} />}
          {level >= 6 && <Canoe m={m} at={[-0.35, LAWN, 0.75]} rot={Math.PI / 2} />}
          {level >= 6 && <Bulbs from={[x0 - w / 2 - 0.045, y0 + 0.8125 + 0.12, zf + bal + 0.02]} to={[x0 + w / 2 + 0.045, y0 + 0.8125 + 0.12, zf + bal + 0.02]} n={8} sag={0.05} posts={0.12} />}
        </group>
      )}
    </group>
  )
}

function HotTub({ m, at }: { m: Mat; at: V3 }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.03, 0]} s={[0.42, 0.06, 0.42]} c={WOOD} t={paverTex(2, 2)} />
      <Cyl m={m} at={[0, 0.15, 0]} r={0.16} h={0.18} c="#8d6e63" seg={14} />
      <mesh position={[0, 0.244, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.14, 14]} /><meshStandardMaterial color="#4dd0e1" roughness={0.15} /></mesh>
    </group>
  )
}

function FirePit({ m, k, at }: { m: Mat; k: Kit; at: V3 }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.04, 0]} r={0.13} h={0.08} c={STONE} seg={10} />
      <mesh position={[0, 0.084, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.1, 10]} /><meshStandardMaterial color="#3e2723" /></mesh>
      <mesh position={[0, 0.12, 0]}><coneGeometry args={[0.05, 0.1, 6]} /><meshStandardMaterial color="#ff8f00" emissive="#ff6f00" emissiveIntensity={0.8} toneMapped={false} /></mesh>
      {!k.ghost && <Pool r={0.4} />}
    </group>
  )
}

function Adirondack({ m, at, rot = 0, c }: { m: Mat; at: V3; rot?: number; c: string }) {
  return (
    <group position={at} rotation-y={rot}>
      <Box m={m} at={[0, 0.1, 0]} s={[0.15, 0.02, 0.15]} c={c} rot={[-0.12, 0, 0]} />
      <Box m={m} at={[0, 0.2, -0.08]} s={[0.15, 0.22, 0.02]} c={c} rot={[-0.35, 0, 0]} />
      {[-0.085, 0.085].map((x) => <Box key={x} m={m} at={[x, 0.08, 0.0]} s={[0.02, 0.16, 0.16]} c={c} />)}
    </group>
  )
}

function MountainLodge({ def, level, k }: { def: NewModelProps['def']; level: number; k: Kit }) {
  const { m, ghost, bulb } = k
  const w = 1.24
  const d = 0.96
  const x0 = -0.27
  const z0 = -0.4
  const zf = z0 + d / 2
  const base = 0.5 + 0.03 * (level - 7)
  const rows = 6
  const y1 = LAWN + base
  const H = rows * LOG_STEP
  const top = y1 + H
  const pitch = 0.86
  const ww = 0.5
  const wx = x0 + w / 2 + ww / 2 - 0.02
  const wrows = 6
  const wy = LAWN + 0.3
  return (
    <group>
      <Lawn m={m} />
      {/* Fieldstone ground floor, logs above. */}
      <Box m={m} at={[x0, LAWN + base / 2, z0]} s={[w + 0.04, base, d + 0.04]} c={STONE} t={brickTex(3, 2)} />
      <group rotation-y={Math.PI / 2} position={[x0, y1, z0]}>
        <LogWalls m={m} w={d} d={w} rows={rows} color={def.color} />
      </group>
      <GlassGable k={k} at={[x0, top + LOG_STEP / 2, z0]} span={w} len={d} h={pitch} wall={shade(def.color, -0.05)} roof={def.roof} over={0.1} />
      {/* Ground floor: big doors and windows in the stone. */}
      <group position={[x0, LAWN, zf + 0.02]}>
        <Box m={m} at={[0, 0.31, 0.004]} s={[0.4, 0.62, 0.02]} c={WOOD} />
        {[-0.09, 0.09].map((x) => <mesh key={x} position={[x, 0.29, 0.016]}><planeGeometry args={[0.16, 0.56]} />{m(DARK_WOOD)}</mesh>)}
        {[-0.09, 0.09].map((x) => <mesh key={`g${x}`} position={[x, 0.42, 0.018]}><planeGeometry args={[0.1, 0.2]} />{k.win}</mesh>)}
        {[-0.4, 0.4].map((x) => (
          <group key={x} position={[x, 0.3, 0]}>
            <Box m={m} at={[0, 0, 0.004]} s={[0.28, 0.28, 0.02]} c={DARK_WOOD} shadow={false} />
            <mesh position={[0, 0, 0.016]}><planeGeometry args={[0.22, 0.22]} />{k.win}</mesh>
          </group>
        ))}
        <mesh position={[0.24, 0.5, 0.04]}><boxGeometry args={[0.05, 0.07, 0.05]} />{bulb}</mesh>
      </group>
      {[-1].map((sd) => (
        <group key={sd} position={[x0 + sd * (w / 2 + 0.02), LAWN + 0.3, z0 + 0.1]} rotation-y={(sd * Math.PI) / 2}>
          <Box m={m} at={[0, 0, 0.004]} s={[0.26, 0.26, 0.02]} c={DARK_WOOD} shadow={false} />
          <mesh position={[0, 0, 0.016]}><planeGeometry args={[0.2, 0.2]} />{k.win}</mesh>
        </group>
      ))}
      {[-0.34, 0.34].map((x) => <LogWin key={x} k={k} at={[x0 + x, y1 + 0.28, zf + 0.03]} w={0.24} h={0.24} />)}
      {/* Entrance portico: stone piers, log posts and a little glass gable. */}
      <group position={[x0, 0, zf]}>
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * 0.25, 0, 0.36]}>
            <Box m={m} at={[0, LAWN + 0.11, 0]} s={[0.13, 0.22, 0.13]} c={STONE} t={brickTex(1, 1)} />
            <Cyl m={m} at={[0, LAWN + 0.22 + (base - 0.18) / 2, 0]} r={0.04} h={base - 0.18} c={def.color} seg={7} />
          </group>
        ))}
        <Cyl m={m} at={[0, LAWN + base + 0.01, 0.36]} r={0.035} h={0.62} c={shade(def.color, 0.05)} seg={7} rot={[0, 0, Math.PI / 2]} />
        <GlassGable k={k} at={[0, LAWN + base + 0.045, 0.18]} span={0.62} len={0.4} h={0.32} wall={shade(def.color, -0.05)} roof={def.roof} />
        <Box m={m} at={[0, LAWN + 0.03, 0.3]} s={[0.56, 0.06, 0.46]} c={STONE} t={paverTex(2, 1)} />
        {!ghost && <Pool r={0.5} z={0.62} />}
        {!ghost && level >= 8 && <Bulbs from={[-w / 2, y1 + 0.02, 0.08]} to={[w / 2, y1 + 0.02, 0.08]} n={10} sag={0.05} />}
      </group>
      {/* Log wing on the right with its own roof. */}
      <LogWalls m={m} at={[wx, wy, z0 - 0.06]} w={ww} d={0.8} rows={wrows} color={def.color} ext={0.05} gable={0.36} />
      <Box m={m} at={[wx, LAWN + 0.15, z0 - 0.06]} s={[ww + 0.04, 0.3, 0.84]} c={STONE} t={brickTex(1, 1)} />
      <group position={[wx, wy + wrows * LOG_STEP + LOG_STEP / 2, z0 - 0.06]}>
        <Gable m={m} w={ww} d={0.8} h={0.36} over={0.1} side={0.06} wall={shade(def.color, -0.05)} roof={shade(def.roof, 0.06)} t={0.04} />
      </group>
      <LogWin k={k} at={[wx + 0.02, wy + 0.27, z0 - 0.06 + 0.4 + 0.03]} w={0.22} h={0.24} />
      <LogWin k={k} at={[wx + ww / 2 + 0.03, wy + 0.27, z0 - 0.06]} ry={Math.PI / 2} w={0.22} h={0.24} />
      {/* Big fieldstone chimney up through the left slope. */}
      <group position={[x0 - w / 2 + 0.22, top, z0 - 0.22]}>
        <Box m={m} at={[0, 0.36, 0]} s={[0.2, 0.72, 0.26]} c={STONE} t={brickTex(1, 3)} />
        <Box m={m} at={[0, 0.74, 0]} s={[0.24, 0.04, 0.3]} c="#8d8178" />
      </group>
      <Box m={m} at={[x0, LAWN + 0.008, (zf + 0.53 + 0.97) / 2]} s={[0.34, 0.016, 0.97 - zf - 0.53]} c="#ffffff" t={gravelTex(1, 2)} shadow={false} />
      <Box m={m} at={[0.64, LAWN + 0.008, 0.46]} s={[0.42, 0.016, 0.98]} c="#ffffff" t={gravelTex(1, 2)} shadow={false} />
      {!ghost && (
        <group>
          <ParkedCar at={[0.64, LAWN + 0.016, 0.42]} body="suv" color="#5d4037" s={0.5} />
          <Pine m={m} at={[-0.8, LAWN, 0.84]} s={0.6} />
          <Pine m={m} at={[0.8, LAWN, -0.8]} s={0.6} />
          <Lantern k={k} at={[0.0, LAWN, 0.86]} h={0.46} />
          {level >= 9 && <FirePit m={m} k={k} at={[-0.66, LAWN, 0.6]} />}
          {level >= 9 && [[-0.44, 0.72, -Math.PI / 2 - 0.5, '#c62828'], [-0.68, 0.84, Math.PI, '#1565c0']].map(([x, z, r, c]) => <Adirondack key={c as string} m={m} at={[x as number, LAWN, z as number]} rot={r as number} c={c as string} />)}
          {level >= 10 && <HotTub m={m} at={[0.25, LAWN, 0.78]} />}
          {level >= 10 && <Bulbs from={[wx - ww / 2 - 0.02, wy + wrows * LOG_STEP - 0.02, z0 + 0.38]} to={[wx + ww / 2 + 0.02, wy + wrows * LOG_STEP - 0.02, z0 + 0.38]} n={6} sag={0.05} />}
        </group>
      )}
    </group>
  )
}

export function CozyHomeModel({ def, ghost, m, win, bulb, level = 1 }: NewModelProps) {
  const k: Kit = { m, win, bulb, ghost }
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  if (def.id === 'bungalow') return <BungalowLot def={def} level={lvl} k={k} />
  if (def.id === 'cabin') return <CabinLot def={def} level={lvl} k={k} />
  return <CottageLot def={def} level={lvl} k={k} />
}
