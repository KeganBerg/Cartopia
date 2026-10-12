import type { ReactNode } from 'react'
import { CylinderGeometry } from 'three'
import { Box, Cyl, Sign, Pool, Bulbs, GOLD, type Mat, type V3 } from './NewBuildings'
import { Glass, glassMat, Planter } from './OfficeBuildings'
import { glowMats } from './dayNight'
import { Facade, Upright, useBays } from './mergeScale'
import { PAL, SEASON } from './season'
import { awningTex, brickTex, concreteTex, gravelTex } from './textures'

// Building blocks for businesses that grow (see src/game/growth.ts): a ground
// floor shop to stand a building on, brick walk-up floors, stone and glass
// tower shafts, and the crowns that go on top. Everything is plain static
// meshes in shared colours, so Batch bakes a whole skyline into a few draws;
// glass reuses the offices' live curtain-wall material (one draw per tint).

export type Kit = { m: Mat; win: ReactNode; bulb: ReactNode; ghost?: boolean }

const SNOW = SEASON === 'winter'
export const ROOFTOP = SNOW ? '#f4f8fb' : '#cfd8dc'

// A ground-floor shop: display windows either side of the door, an awning, the
// name on a board over it, lamps, planters and the lights' glow on the pavement.
// Evenly spaced bay centres across a face `len` long: one every `pitch`, the
// outer ones `fill` of the way to the ends.
export function spread(len: number, pitch: number, fill: number) {
  const n = Math.max(2, Math.round(len / pitch))
  return Array.from({ length: n }, (_, i) => ((i + 0.5) / n - 0.5) * len * fill)
}

export function Storefront({ k, w, d, z0 = 0, h = 0.95, wall, tex, trim = '#fafafa', awning, sign, signBg = '#fffde7', signFg = '#c62828', board, cafe }: {
  k: Kit; w: number; d: number; z0?: number; h?: number; wall: string; tex?: 'brick' | 'stone' | 'plain'; trim?: string; awning: string
  sign?: string; signBg?: string; signFg?: string; board?: string; cafe?: string
}) {
  const { m, win, bulb, ghost } = k
  const zf = z0 + d / 2
  // A merged pair's shopfront is twice as long: wider display windows, more mullions.
  const [bx] = useBays()
  const gw = (w * bx - 0.7) / 2 - 0.06
  const t = tex === 'brick' ? brickTex(Math.max(1, Math.round(w * 0.6)), 1) : tex === 'stone' ? concreteTex(Math.max(1, Math.round(w)), 1) : undefined
  const sw = Math.min(w * 0.62, 1.7)
  return (
    <group>
      <Box m={m} at={[0, h / 2, z0]} s={[w, h, d]} c={wall} t={t} />
      {/* Display windows with mullions, on a kick plate. */}
      <Facade at={[0, 0, zf]} len={w}>
        {() => [-1, 1].map((sd) => {
          const x = sd * (0.35 + 0.06 + gw / 2)
          const n = Math.max(1, Math.round(gw / 0.42))
          return (
            <group key={sd}>
              <mesh position={[x, 0.42, 0.006]}>
                <planeGeometry args={[gw, 0.5]} />
                {win}
              </mesh>
              {Array.from({ length: n + 1 }, (_, i) => (
                <Box key={i} m={m} at={[x - gw / 2 + (gw * i) / n, 0.42, 0.018]} s={[0.03, 0.54, 0.025]} c={trim} shadow={false} />
              ))}
              <Box m={m} at={[x, 0.68, 0.018]} s={[gw + 0.03, 0.03, 0.025]} c={trim} shadow={false} />
            </group>
          )
        })}
      </Facade>
      <Box m={m} at={[0, 0.08, zf + 0.015]} s={[w + 0.01, 0.16, 0.03]} c={trim} shadow={false} />
      {/* Door, frame and step. */}
      <Box m={m} at={[0, 0.34, zf + 0.02]} s={[0.52, 0.7, 0.02]} c={trim} shadow={false} />
      <mesh position={[0, 0.32, zf + 0.032]}>
        <planeGeometry args={[0.42, 0.62]} />
        {m('#3e2723')}
      </mesh>
      <mesh position={[0.13, 0.36, zf + 0.034]}>
        <planeGeometry args={[0.12, 0.34]} />
        {win}
      </mesh>
      <Box m={m} at={[0, 0.03, zf + 0.12]} s={[0.66, 0.06, 0.22]} c="#cfd8dc" shadow={false} />
      {/* Awning, then the shop's name on a board above it. */}
      <Box m={m} at={[0, 0.8, zf + 0.21]} rot={[0.45, 0, 0]} s={[w * 0.94, 0.03, 0.46]} c="#ffffff" t={awningTex(awning)} />
      {[-0.38, 0.38].map((x) => (
        <mesh key={x} position={[x, 0.66, zf + 0.05]}>
          <boxGeometry args={[0.07, 0.09, 0.07]} />
          {bulb}
        </mesh>
      ))}
      <Box m={m} at={[0, h - 0.02, z0]} s={[w + 0.06, 0.06, d + 0.06]} c={trim} />
      {sign && (
        <group position={[0, h + 0.2, zf - 0.04]}>
          <Box m={m} at={[0, 0, -0.03]} s={[sw + 0.08, sw / 4 + 0.08, 0.05]} c={board ?? awning} shadow={false} />
          {!ghost && <Sign text={sign} w={sw} at={[0, 0, 0]} bg={signBg} fg={signFg} />}
        </group>
      )}
      {!ghost && (
        <group>
          {/* Café tables under the awning, kept on the lot (parasols would hang over the road). */}
          {!cafe && [-1, 1].map((sd) => <Planter key={sd} m={m} at={[sd * (w / 2 - 0.16), 0.02, zf + 0.2]} />)}
          {cafe && [-1, 1].map((sd) => <Bistro key={sd} m={m} at={[sd * Math.min(w / 2 - 0.25, 0.6), 0, zf + 0.22]} c={cafe} />)}
          <Pool r={0.7} z={zf + 0.4} />
        </group>
      )}
    </group>
  )
}

// A little café table with a chair either side, in the shop's colour.
function Bistro({ m, at, c }: { m: Mat; at: V3; c: string }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.115, 0]} r={0.015} h={0.23} c="#455a64" seg={6} />
      <Cyl m={m} at={[0, 0.02, 0]} r={0.06} h={0.02} c="#455a64" seg={10} />
      <Cyl m={m} at={[0, 0.24, 0]} r={0.11} h={0.02} c="#fafafa" seg={14} />
      <mesh position={[0.03, 0.27, 0.02]}><cylinderGeometry args={[0.025, 0.02, 0.04, 8]} />{m(c)}</mesh>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.17, 0, 0]}>
          <Box m={m} at={[0, 0.065, 0]} s={[0.08, 0.13, 0.08]} c="#455a64" shadow={false} />
          <Box m={m} at={[0, 0.14, 0]} s={[0.1, 0.02, 0.1]} c={c} shadow={false} />
          <Box m={m} at={[sd * 0.045, 0.21, 0]} s={[0.015, 0.13, 0.1]} c={c} shadow={false} />
        </group>
      ))}
    </group>
  )
}

// Walk-up floors: brick with sash windows, sills and lintels, a cornice on
// brackets, a fire escape down the right-hand side and a gravel roof.
export function BrickFloors({ k, w, d, z0 = 0, y0, floors, fh = 0.44, wall, trim = '#f5f5f5', tex = 'brick', escape = true }: {
  k: Kit; w: number; d: number; z0?: number; y0: number; floors: number; fh?: number; wall: string; trim?: string; tex?: 'brick' | 'stone' | 'plain'; escape?: boolean
}) {
  const { m, win, ghost } = k
  const H = floors * fh
  const zf = z0 + d / 2
  const zb = z0 - d / 2
  const nf = Math.max(2, Math.round(w / 0.5))
  const fx = Array.from({ length: nf }, (_, i) => ((i + 0.5) / nf - 0.5) * w * 0.86)
  const ys = Array.from({ length: floors }, (_, i) => y0 + i * fh + fh * 0.52)
  const t = tex === 'brick' ? brickTex(Math.max(1, Math.round(w * 0.6)), Math.max(1, Math.round(H))) : tex === 'stone' ? concreteTex(Math.max(1, Math.round(w)), Math.max(1, Math.round(H))) : undefined
  const ex = w / 2 + 0.1
  return (
    <group>
      <Box m={m} at={[0, y0 + H / 2, z0]} s={[w, H, d]} c={wall} t={t} />
      {/* Sash windows on all four faces; a merged pair's longer faces get more (Facade). */}
      <Facade at={[0, 0, zf]} len={w}>
        {(L) => spread(L, 0.5, 0.86).map((x) => ys.map((y) => (
          <group key={`${x}${y}`}>
            <mesh position={[x, y, 0.006]}>
              <planeGeometry args={[0.26, 0.3]} />
              {win}
            </mesh>
            <Box m={m} at={[x, y - 0.17, 0.03]} s={[0.33, 0.03, 0.06]} c={trim} shadow={false} />
            <Box m={m} at={[x, y + 0.175, 0.012]} s={[0.31, 0.045, 0.025]} c={trim} shadow={false} />
          </group>
        )))}
      </Facade>
      <Facade at={[0, 0, zb - 0.006]} ry={Math.PI} len={w}>
        {(L) => spread(L, 0.5, 0.86).map((x) => ys.map((y) => (
          <mesh key={`${x}${y}`} position={[x, y, 0]}>
            <planeGeometry args={[0.26, 0.3]} />
            {win}
          </mesh>
        )))}
      </Facade>
      {[-1, 1].map((sd) => (
        <Facade key={sd} at={[sd * (w / 2 + 0.006), 0, z0]} ry={(sd * Math.PI) / 2} len={d}>
          {(L) => spread(L, 0.55, 0.8).map((x) => ys.map((y) => (
            <mesh key={`${x}${y}`} position={[x, y, 0]}>
              <planeGeometry args={[0.26, 0.3]} />
              {win}
            </mesh>
          )))}
        </Facade>
      ))}
      {/* A stone band over the shop and a cornice on brackets at the top. */}
      <Box m={m} at={[0, y0 + 0.02, z0]} s={[w + 0.04, 0.05, d + 0.04]} c={trim} shadow={false} />
      <Box m={m} at={[0, y0 + H + 0.05, z0]} s={[w + 0.12, 0.1, d + 0.12]} c={trim} />
      {!ghost && fx.concat(fx.map((x) => x + w / nf / 2)).filter((x) => Math.abs(x) < w / 2 - 0.05).map((x) => (
        <Box key={x} m={m} at={[x, y0 + H - 0.03, zf + 0.035]} s={[0.04, 0.07, 0.07]} c={trim} shadow={false} />
      ))}
      <mesh position={[0, y0 + H + 0.104, z0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w, d]} />
        {m(ROOFTOP, SNOW ? undefined : gravelTex(Math.max(1, Math.round(w)), Math.max(1, Math.round(d))))}
      </mesh>
      {escape && !ghost && <FireEscape m={m} x={ex} z={z0} y0={y0} floors={floors} fh={fh} len={Math.min(0.8, d * 0.6)} />}
    </group>
  )
}

// Black iron landings on every floor, zig-zag stairs between them and a drop
// ladder to the street.
export function FireEscape({ m, x, z, y0, floors, fh, len }: { m: Mat; x: number; z: number; y0: number; floors: number; fh: number; len: number }) {
  const c = '#546e7a'
  const run = Math.atan2(fh, len * 0.8)
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: floors }, (_, i) => {
        const y = y0 + i * fh + 0.02
        return (
          <group key={i}>
            <Box m={m} at={[0, y, 0]} s={[0.18, 0.015, len]} c={c} shadow={false} />
            <Box m={m} at={[0.095, y + 0.104, 0]} s={[0.01, 0.02, len]} c={c} shadow={false} />
            <Box m={m} at={[0.095, y + 0.05, 0]} s={[0.01, 0.1, 0.01]} c={c} shadow={false} />
            {[-1, 1].map((sd) => <Box key={sd} m={m} at={[0.095, y + 0.05, (sd * len) / 2]} s={[0.01, 0.1, 0.01]} c={c} shadow={false} />)}
            {i < floors - 1 && (
              <Box m={m} at={[0.03, y + fh / 2, 0]} rot={[i % 2 ? run : -run, 0, 0]} s={[0.06, 0.012, Math.hypot(fh, len * 0.8)]} c={c} shadow={false} />
            )}
          </group>
        )
      })}
      <Box m={m} at={[0.03, y0 / 2 + 0.12, len / 2 - 0.08]} s={[0.1, y0 - 0.2, 0.012]} c={c} shadow={false} />
    </group>
  )
}

// Wooden water tank on a steel stand, the walk-up's roof landmark.
export function WaterTank({ m, at, s = 1 }: { m: Mat; at: V3; s?: number }) {
  return (
    <group position={at} scale={s}>
      {[-0.11, 0.11].flatMap((x) => [-0.11, 0.11].map((z) => <Box key={`${x}${z}`} m={m} at={[x, 0.12, z]} s={[0.025, 0.24, 0.025]} c="#455a64" shadow={false} />))}
      <Cyl m={m} at={[0, 0.25, 0]} r={0.19} h={0.03} c="#455a64" seg={12} />
      <Cyl m={m} at={[0, 0.43, 0]} r={0.18} r2={0.19} h={0.34} c="#8d6e63" seg={14} />
      {[0.33, 0.52].map((y) => <Cyl key={y} m={m} at={[0, y, 0]} r={0.192} h={0.015} c="#37474f" seg={14} />)}
      <mesh position={[0, 0.66, 0]} castShadow><coneGeometry args={[0.2, 0.14, 14]} />{m(SNOW ? '#f4f8fb' : '#5d4037')}</mesh>
    </group>
  )
}

// A stone tower with recessed glass bays between piers, art deco style.
export function StoneShaft({ k, x = 0, z = 0, y0, w, d, h, stone, tint, pier, bays = 3 }: {
  k: Kit; x?: number; z?: number; y0: number; w: number; d: number; h: number; stone: string; tint: string; pier: string; bays?: number
}) {
  const { m, ghost } = k
  const faces: [number, number, number, number][] = [
    [0, d / 2, 0, w], [0, -d / 2, Math.PI, w], [w / 2, 0, Math.PI / 2, d], [-w / 2, 0, -Math.PI / 2, d],
  ]
  return (
    <group position={[x, 0, z]}>
      <Box m={m} at={[0, y0 + h / 2, 0]} s={[w - 0.02, h, d - 0.02]} c={stone} t={concreteTex(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))} />
      {faces.map(([fx, fz, ry, len]) => (
        <Facade key={ry} at={[fx, 0, fz]} ry={ry} len={len}>
          {(L) => {
            const n = Math.max(2, Math.round((bays * L) / w))
            const bw = (L - 0.12) / n
            return (
              <group>
                {Array.from({ length: n }, (_, i) => (
                  <Glass key={i} m={m} ghost={ghost} at={[-L / 2 + 0.06 + bw * (i + 0.5), y0 + h / 2, 0.004]} w={bw - 0.08} h={h - 0.1} tint={tint} />
                ))}
                {Array.from({ length: n + 1 }, (_, i) => (
                  <Box key={`p${i}`} m={m} at={[-L / 2 + 0.06 + bw * i, y0 + h / 2, 0.025]} s={[0.07, h, 0.05]} c={pier} shadow={false} />
                ))}
              </group>
            )
          }}
        </Facade>
      ))}
      <Box m={m} at={[0, y0 + h + 0.04, 0]} s={[w + 0.08, 0.08, d + 0.08]} c={pier} />
    </group>
  )
}

// A round glass tower: curtain wall wrapped on a cylinder, UVs stretched so a
// pane stays pane-sized whatever the radius.
const cyls = new Map<string, CylinderGeometry>()
function glassCylGeo(r: number, h: number) {
  const key = `${r.toFixed(2)}x${h.toFixed(2)}`
  let g = cyls.get(key)
  if (g) return g
  g = new CylinderGeometry(r, r, h, 28, 1, true)
  g.computeBoundingSphere()
  const uv = g.getAttribute('uv')
  const around = (Math.PI * 2 * r) / 0.72
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * around, (uv.getY(i) * h) / 1.2)
  cyls.set(key, g)
  return g
}
export function GlassDrum({ k, x = 0, z = 0, y0, r, h, tint, frame, bands = true }: { k: Kit; x?: number; z?: number; y0: number; r: number; h: number; tint: string; frame: string; bands?: boolean }) {
  const { m, ghost } = k
  const n = Math.floor(h / 0.9)
  return (
    <group position={[x, 0, z]}>
      <Cyl m={m} at={[0, y0 + h / 2, 0]} r={r - 0.04} h={h} c="#37474f" seg={20} />
      <mesh position={[0, y0 + h / 2, 0]} geometry={glassCylGeo(r, h)}>
        {ghost ? m(tint) : <primitive object={glassMat(tint)} attach="material" dispose={null} />}
      </mesh>
      {bands && Array.from({ length: n }, (_, i) => <Cyl key={i} m={m} at={[0, y0 + (i + 1) * 0.9, 0]} r={r + 0.02} h={0.03} c={frame} seg={28} />)}
      {bands && !ghost && Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return <Box key={`f${i}`} m={m} at={[Math.sin(a) * (r + 0.015), y0 + h / 2, Math.cos(a) * (r + 0.015)]} rot={[0, a, 0]} s={[0.035, h, 0.03]} c={frame} shadow={false} />
      })}
      <Cyl m={m} at={[0, y0 + h + 0.04, 0]} r={r + 0.05} h={0.08} c={frame} seg={28} />
    </group>
  )
}

// A round stucco tower with a ribbon of glass round every floor.
export function RibbonDrum({ k, x = 0, z = 0, y0, r, floors, fh, wall, band, tint }: { k: Kit; x?: number; z?: number; y0: number; r: number; floors: number; fh: number; wall: string; band: string; tint: string }) {
  const { m, ghost } = k
  const H = floors * fh
  return (
    <group position={[x, 0, z]}>
      <Cyl m={m} at={[0, y0 + H / 2, 0]} r={r} h={H} c={wall} seg={28} />
      {Array.from({ length: floors }, (_, i) => (
        <group key={i}>
          <mesh position={[0, y0 + i * fh + fh * 0.55, 0]} geometry={glassCylGeo(r + 0.006, fh * 0.48)}>
            {ghost ? m(tint) : <primitive object={glassMat(tint)} attach="material" dispose={null} />}
          </mesh>
          {!ghost && i % 3 === 2 && <Cyl m={m} at={[0, y0 + (i + 1) * fh, 0]} r={r + 0.025} h={0.035} c={band} seg={28} />}
        </group>
      ))}
      <Cyl m={m} at={[0, y0 + H + 0.04, 0]} r={r + 0.05} h={0.08} c={band} seg={28} />
    </group>
  )
}

// A ring of lit bulbs round a tower's top edge.
export function EdgeBulbs({ w, d, y, z = 0, x = 0 }: { w: number; d: number; y: number; z?: number; x?: number }) {
  return (
    <group>
      <Bulbs from={[x - w / 2, y, z + d / 2]} to={[x + w / 2, y, z + d / 2]} n={Math.max(5, Math.round(w * 6))} />
      <Bulbs from={[x - w / 2, y, z - d / 2]} to={[x + w / 2, y, z - d / 2]} n={Math.max(5, Math.round(w * 6))} />
    </group>
  )
}

export { Beacon } from './OfficeBuildings'

// A stepped art deco top: three shrinking tiers, lit edges and a spire.
export function DecoCrown({ m, at, w, d, c, trim, gold }: { m: Mat; at: V3; w: number; d: number; c: string; trim: string; gold?: boolean }) {
  const tiers = [0.78, 0.56, 0.34]
  let y = 0
  return (
    <group position={at}>
      {tiers.map((s, i) => {
        const h = 0.26 - i * 0.04
        const el = (
          <group key={s}>
            <Box m={m} at={[0, y + h / 2, 0]} s={[w * s, h, d * s]} c={c} t={concreteTex(1, 1)} />
            <Box m={m} at={[0, y + h + 0.02, 0]} s={[w * s + 0.05, 0.04, d * s + 0.05]} c={gold && i === 2 ? GOLD : trim} shadow={false} />
          </group>
        )
        y += h + 0.04
        return el
      })}
      <group position-y={y}>
        <mesh position={[0, 0.45, 0]} castShadow><coneGeometry args={[0.07, 0.9, 8]} /><meshStandardMaterial color={gold ? GOLD : trim} metalness={0.6} roughness={0.3} /></mesh>
        <mesh position={[0, 0.93, 0]}><sphereGeometry args={[0.04, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>
      </group>
    </group>
  )
}

// The giant food and fun props that crown a grown business, on a lit plinth.
export type Giant = 'donut' | 'burger' | 'cone' | 'pizza' | 'mug' | 'pin' | 'apple' | 'joystick'
export function GiantProp({ m, kind, at, s = 1, plinth = '#eceff1' }: { m: Mat; kind: Giant; at: V3; s?: number; plinth?: string }) {
  return (
    <group position={at}>
      {/* One piece in a merged pair: it keeps its shape, standing on the roof. */}
      <Upright>
        <Cyl m={m} at={[0, 0.06, 0]} r={0.36 * s} r2={0.4 * s} h={0.12} c={plinth} seg={16} />
        {/* Marquee bulbs set round the plinth's rim. */}
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.sin(a) * 0.385 * s, 0.06, Math.cos(a) * 0.385 * s]}>
              <sphereGeometry args={[0.03, 6, 5]} />
              <primitive object={glowMats.bulb} attach="material" dispose={null} />
            </mesh>
          )
        })}
        <group position={[0, 0.12, 0]} scale={s}>
          <GiantShape m={m} kind={kind} />
        </group>
      </Upright>
    </group>
  )
}

function GiantShape({ m, kind }: { m: Mat; kind: Giant }) {
  switch (kind) {
    case 'donut':
      return (
        <group position={[0, 0.42, 0]} rotation-x={-0.35}>
          <mesh castShadow><torusGeometry args={[0.3, 0.14, 12, 24]} />{m('#d7a86e')}</mesh>
          <mesh position={[0, 0.045, 0.02]}><torusGeometry args={[0.3, 0.115, 12, 24]} />{m('#f06292')}</mesh>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const a = (i / 8) * Math.PI * 2
            return <Box key={i} m={m} at={[Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.16]} rot={[0, 0, a * 2]} s={[0.07, 0.018, 0.018]} c={['#fff176', '#4fc3f7', '#ffffff', '#aed581'][i % 4]} shadow={false} />
          })}
        </group>
      )
    case 'burger':
      return (
        <group>
          <Cyl m={m} at={[0, 0.05, 0]} r={0.36} h={0.1} c="#e0a052" seg={20} />
          <Cyl m={m} at={[0, 0.14, 0]} r={0.38} h={0.09} c="#5d4037" seg={20} />
          <Cyl m={m} at={[0, 0.2, 0]} r={0.4} h={0.03} c="#fdd835" seg={4} />
          <Cyl m={m} at={[0, 0.23, 0]} r={0.41} h={0.03} c="#66bb6a" seg={20} />
          <Cyl m={m} at={[0, 0.26, 0]} r={0.37} h={0.03} c="#e53935" seg={20} />
          <mesh position={[0, 0.28, 0]} castShadow><sphereGeometry args={[0.37, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />{m('#e0a052')}</mesh>
          {[[0.1, 0.12], [-0.12, 0.05], [0.02, -0.14], [-0.05, 0.2]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.28 + Math.sqrt(0.37 ** 2 - x * x - z * z) - 0.004, z]} s={[0.04, 0.015, 0.02]} c="#fff8e1" shadow={false} />)}
        </group>
      )
    case 'cone':
      return (
        <group>
          <mesh position={[0, 0.32, 0]} rotation-x={Math.PI} castShadow><coneGeometry args={[0.22, 0.64, 14]} />{m('#d7a86e')}</mesh>
          <mesh position={[0, 0.7, 0]} castShadow><sphereGeometry args={[0.26, 14, 10]} />{m('#f8bbd0')}</mesh>
          <mesh position={[0, 0.92, 0]}><sphereGeometry args={[0.18, 12, 8]} />{m('#fff8e1')}</mesh>
          <mesh position={[0, 1.08, 0]}><sphereGeometry args={[0.06, 8, 6]} />{m('#d32f2f')}</mesh>
        </group>
      )
    case 'pizza':
      return (
        // A whole pie tipped up to face the street, one slice pulled out.
        <group position={[0, 0.5, 0]} rotation-x={1.05}>
          <Cyl m={m} at={[0, 0, 0]} r={0.5} h={0.06} c="#ffca28" seg={20} />
          <mesh rotation-x={Math.PI / 2} castShadow><torusGeometry args={[0.5, 0.06, 6, 24]} />{m('#d7a86e')}</mesh>
          {[[0.22, 0.1], [-0.2, 0.18], [0.05, -0.25], [-0.26, -0.12], [0.28, -0.2], [0, 0.32], [-0.05, 0.02]].map(([x, z]) => (
            <Cyl key={`${x}${z}`} m={m} at={[x, 0.04, z]} r={0.065} h={0.02} c="#c62828" seg={10} />
          ))}
          {[[0.15, 0.3], [-0.32, 0.05], [0.12, -0.08]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.04, z]} s={[0.07, 0.02, 0.03]} c="#43a047" shadow={false} />)}
        </group>
      )
    case 'mug':
      return (
        <group>
          <Cyl m={m} at={[0, 0.03, 0]} r={0.32} h={0.05} c="#fafafa" seg={16} />
          <Cyl m={m} at={[0, 0.27, 0]} r={0.26} r2={0.2} h={0.46} c="#fafafa" seg={16} />
          <Cyl m={m} at={[0, 0.25, 0]} r={0.235} r2={0.215} h={0.12} c="#2e7d32" seg={16} />
          <Cyl m={m} at={[0, 0.5, 0]} r={0.235} h={0.01} c="#5d4037" seg={16} />
          <mesh position={[0.26, 0.29, 0]} castShadow><torusGeometry args={[0.1, 0.03, 6, 12]} />{m('#fafafa')}</mesh>
          {[0, 1, 2].map((i) => <mesh key={i} position={[Math.sin(i * 2) * 0.05, 0.55 + i * 0.13, 0]}><sphereGeometry args={[0.07 + i * 0.02, 8, 6]} />{m('#eceff1')}</mesh>)}
        </group>
      )
    case 'pin':
      return (
        <group>
          <mesh position={[0, 0.22, 0]} castShadow><sphereGeometry args={[0.22, 14, 10]} />{m('#fafafa')}</mesh>
          <Cyl m={m} at={[0, 0.52, 0]} r={0.09} r2={0.14} h={0.36} c="#fafafa" seg={12} />
          <Cyl m={m} at={[0, 0.47, 0]} r={0.125} h={0.06} c="#e53935" seg={12} />
          <Cyl m={m} at={[0, 0.58, 0]} r={0.105} h={0.05} c="#e53935" seg={12} />
          <mesh position={[0, 0.76, 0]}><sphereGeometry args={[0.11, 12, 8]} />{m('#fafafa')}</mesh>
          <mesh position={[0.32, 0.18, 0.1]} castShadow><sphereGeometry args={[0.17, 14, 10]} />{m('#7e57c2')}</mesh>
        </group>
      )
    case 'apple':
      return (
        <group>
          <mesh position={[0, 0.3, 0]} scale={[1, 0.9, 1]} castShadow><sphereGeometry args={[0.32, 14, 10]} />{m('#e53935')}</mesh>
          <Cyl m={m} at={[0, 0.62, 0]} r={0.025} h={0.14} c="#5d4037" seg={6} />
          <Box m={m} at={[0.09, 0.64, 0]} rot={[0, 0, -0.6]} s={[0.17, 0.025, 0.08]} c={PAL.leaves[1]} shadow={false} />
        </group>
      )
    case 'joystick':
      return (
        <group>
          <Box m={m} at={[0, 0.1, 0]} s={[0.56, 0.2, 0.44]} c="#212121" />
          <Cyl m={m} at={[0, 0.4, 0]} r={0.04} h={0.42} c="#90a4ae" seg={8} />
          <mesh position={[0, 0.66, 0]} castShadow><sphereGeometry args={[0.14, 12, 10]} />{m('#e53935')}</mesh>
          {[-0.15, 0.15].map((x) => <Cyl key={x} m={m} at={[x, 0.21, 0.12]} r={0.055} h={0.03} c={x < 0 ? '#ffeb3b' : '#00e5ff'} seg={10} />)}
        </group>
      )
  }
}
