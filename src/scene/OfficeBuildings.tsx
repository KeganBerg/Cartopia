import type { ReactNode } from 'react'
import { Color, MeshStandardMaterial, PlaneGeometry } from 'three'
import { levelLift, type BuildingDef } from '../game/data'
import { growthStage, midFloors, towerFloors } from '../game/growth'
import { Box, Cyl, Sign, Pool, Bulbs, Flag, Trims, type Mat, type V3 } from './NewBuildings'
import { CarModel } from './CarModel'
import { Upright } from './mergeScale'
import { glowMats, onNight } from './dayNight'
import { signTexture } from './signTexture'
import { PAL, SEASON } from './season'
import { closingGlow } from './closingTime'
import { brickTex, concreteTex, corrugatedTex, curtainGlowTex, curtainTex, gravelTex, helipadTex, paverTex } from './textures'
import { Helicopter, AmbulanceModel } from './ServiceVehicles'

// Offices, the hospital and the heliport: the big-town end of the shop.
// Static pieces are plain meshes that Batch merges into the town's draws; glass
// walls share one live material per tint so their offices light up after dark;
// the helicopters and the parked ambulance move or blink, so they stay out of
// the merge (see ServiceVehicles.tsx). Lots face +z, like the rest of the town.

export const OFFICE_MODELS = new Set(['offices', 'hq', 'glasstower', 'hospital', 'helipad'])

type Props = { def: BuildingDef; ghost?: boolean; m: Mat; bulb: ReactNode; level?: number }

const GOLD = '#ffc107'
const SNOW = SEASON === 'winter'
const ROOF = SNOW ? '#f4f8fb' : '#cfd8dc'

// ---- Curtain-wall glass ----

// One material per tint, kept by identity so Batch merges every pane of that
// tint into one draw. Lit offices fade in with the night.
const glassMats = new Map<string, MeshStandardMaterial>()
export function glassMat(tint: string) {
  let g = glassMats.get(tint)
  if (g) return g
  g = new MeshStandardMaterial({ color: tint, map: curtainTex(), emissiveMap: curtainGlowTex(), emissive: new Color('#ffffff'), emissiveIntensity: 0, metalness: 0.15, roughness: 0.22 })
  g.userData.live = true
  // Four panes across and four floors per texture, emptied out one by one at night.
  closingGlow(g, [4, 4], 'curtain')
  const mat = g
  onNight((n) => (mat.emissiveIntensity = n * 0.7))
  glassMats.set(tint, g)
  return g
}
// A pane is about 0.18 wide and a floor 0.3 tall wherever the wall is, so the
// UVs stretch with the plane and every wall of a tint can share the material.
const panes = new Map<string, PlaneGeometry>()
function paneGeo(w: number, h: number) {
  const k = `${w.toFixed(2)}x${h.toFixed(2)}`
  let g = panes.get(k)
  if (g) return g
  g = new PlaneGeometry(w, h)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 0.72, (uv.getY(i) * h) / 1.2)
  panes.set(k, g)
  return g
}

export function Glass({ m, ghost, at, w, h, ry = 0, tint }: { m: Mat; ghost?: boolean; at: V3; w: number; h: number; ry?: number; tint: string }) {
  return (
    <mesh position={at} rotation-y={ry} geometry={paneGeo(w, h)}>
      {ghost ? m(tint) : <primitive object={glassMat(tint)} attach="material" dispose={null} />}
    </mesh>
  )
}

// A glass box: four curtain walls round a core, a roof slab, and slim corner fins.
export function GlassBlock({ m, ghost, x, z, y0 = 0, w, d, h, tint, frame, roof = ROOF }: { m: Mat; ghost?: boolean; x: number; z: number; y0?: number; w: number; d: number; h: number; tint: string; frame: string; roof?: string }) {
  const y = y0 + h / 2
  return (
    <group>
      <Box m={m} at={[x, y, z]} s={[w - 0.04, h, d - 0.04]} c="#37474f" shadow />
      <Glass m={m} ghost={ghost} at={[x, y, z + d / 2]} w={w} h={h} tint={tint} />
      <Glass m={m} ghost={ghost} at={[x, y, z - d / 2]} w={w} h={h} ry={Math.PI} tint={tint} />
      <Glass m={m} ghost={ghost} at={[x + w / 2, y, z]} w={d} h={h} ry={Math.PI / 2} tint={tint} />
      <Glass m={m} ghost={ghost} at={[x - w / 2, y, z]} w={d} h={h} ry={-Math.PI / 2} tint={tint} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <Box key={`${sx}${sz}`} m={m} at={[x + sx * (w / 2), y, z + sz * (d / 2)]} s={[0.05, h, 0.05]} c={frame} shadow={false} />
      )))}
      <Box m={m} at={[x, y0 + h + 0.04, z]} s={[w + 0.06, 0.08, d + 0.06]} c={frame} />
      <mesh position={[x, y0 + h + 0.081, z]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w - 0.04, d - 0.04]} />
        {m(roof, SNOW ? undefined : gravelTex(Math.max(1, Math.round(w)), Math.max(1, Math.round(d))))}
      </mesh>
    </group>
  )
}

// Rooftop plant: air handlers with fans, a vent stack and a hatch.
export function RoofPlant({ m, at, big }: { m: Mat; at: V3; big?: boolean }) {
  const k = big ? 1.3 : 1
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.11 * k, 0]} s={[0.42 * k, 0.22 * k, 0.3 * k]} c="#b0bec5" />
      {[-0.1, 0.1].map((x) => <Cyl key={x} m={m} at={[x * k, 0.225 * k, 0]} r={0.075 * k} h={0.015} c="#455a64" seg={10} />)}
      <Cyl m={m} at={[0.32 * k, 0.12, -0.05]} r={0.04} h={0.24} c="#90a4ae" seg={8} />
      <Box m={m} at={[-0.34 * k, 0.04, 0.08]} s={[0.16, 0.08, 0.16]} c="#78909c" />
    </group>
  )
}

export function Planter({ m, at, big }: { m: Mat; at: V3; big?: boolean }) {
  const r = big ? 0.2 : 0.15
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.08, 0]} s={[r * 2, 0.16, r * 2]} c="#9e9e9e" t={concreteTex(1, 1)} />
      {PAL.bare ? (
        <Cyl m={m} at={[0, 0.4, 0]} r={0.02} r2={0.03} h={0.5} c="#5d4037" seg={6} />
      ) : (
        <group>
          <Cyl m={m} at={[0, 0.3, 0]} r={0.02} r2={0.03} h={0.3} c="#5d4037" seg={6} />
          <mesh position={[0, 0.5, 0]} castShadow><icosahedronGeometry args={[r * 1.25, 0]} /><meshStandardMaterial color={PAL.leaves[0]} flatShading /></mesh>
        </group>
      )}
    </group>
  )
}

export function Bench({ m, at, ry = 0 }: { m: Mat; at: V3; ry?: number }) {
  return (
    <group position={at} rotation-y={ry}>
      <Box m={m} at={[0, 0.12, 0]} s={[0.36, 0.035, 0.1]} c="#8d6e63" />
      <Box m={m} at={[0, 0.2, -0.045]} s={[0.36, 0.1, 0.02]} c="#8d6e63" />
      {[-0.15, 0.15].map((x) => <Box key={x} m={m} at={[x, 0.06, 0]} s={[0.025, 0.12, 0.09]} c="#37474f" shadow={false} />)}
    </group>
  )
}

export function Lamp({ m, bulb, at }: { m: Mat; bulb: ReactNode; at: V3 }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.4, 0]} r={0.018} h={0.8} c="#37474f" seg={6} />
      <Box m={m} at={[0, 0.81, 0.05]} s={[0.05, 0.03, 0.14]} c="#37474f" shadow={false} />
      <mesh position={[0, 0.79, 0.1]}><boxGeometry args={[0.05, 0.015, 0.06]} />{bulb}</mesh>
    </group>
  )
}

// A tall block in stone with recessed glass bays between piers (the grown
// hospital's tower).
function StoneShaftLite({ m, ghost, x, z, y0, w, d, h }: { m: Mat; ghost?: boolean; x: number; z: number; y0: number; w: number; d: number; h: number }) {
  const faces: [number, number, number, number][] = [[0, d / 2, 0, w], [0, -d / 2, Math.PI, w], [w / 2, 0, Math.PI / 2, d], [-w / 2, 0, -Math.PI / 2, d]]
  return (
    <group position={[x, 0, z]}>
      <Box m={m} at={[0, y0 + h / 2, 0]} s={[w - 0.02, h, d - 0.02]} c="#f7f7f7" />
      {faces.map(([fx, fz, ry, len]) => {
        const n = Math.max(2, Math.round(len / 0.5))
        const bw = (len - 0.1) / n
        return (
          <group key={ry} position={[fx, 0, fz]} rotation-y={ry}>
            {Array.from({ length: n }, (_, i) => <Glass key={i} m={m} ghost={ghost} at={[-len / 2 + 0.05 + bw * (i + 0.5), y0 + h / 2 - 0.1, 0.004]} w={bw - 0.1} h={h - 0.4} tint="#80cbc4" />)}
            {Array.from({ length: n + 1 }, (_, i) => <Box key={`p${i}`} m={m} at={[-len / 2 + 0.05 + bw * i, y0 + h / 2, 0.025]} s={[0.08, h, 0.05]} c="#ffffff" shadow={false} />)}
          </group>
        )
      })}
      <Box m={m} at={[0, y0 + h + 0.05, 0]} s={[w + 0.08, 0.1, d + 0.08]} c="#cfd8dc" />
    </group>
  )
}

// Signs that glow after dark (the HQ crown, HOSPITAL, EMERGENCY): kept by
// identity, brightened by the night.
const litSigns = new Map<string, MeshStandardMaterial>()
export function litSign(text: string, bg: string, fg: string, day = 0.15) {
  const k = `${text}|${bg}|${fg}`
  let s = litSigns.get(k)
  if (s) return s
  const tex = signTexture(text, bg, fg)
  s = new MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new Color('#ffffff'), emissiveIntensity: day, toneMapped: false })
  s.userData.live = true
  const mat = s
  onNight((n) => (mat.emissiveIntensity = day + n * 1.1))
  litSigns.set(k, s)
  return s
}
export function LitSign({ text, w, at, bg, fg, ghost, m }: { text: string; w: number; at: V3; bg: string; fg: string; ghost?: boolean; m: Mat }) {
  return (
    <mesh position={at}>
      <planeGeometry args={[w, w / 4]} />
      {ghost ? m(bg) : <primitive object={litSign(text, bg, fg)} attach="material" dispose={null} />}
    </mesh>
  )
}

// The hospital's red cross: glows softly by day and bright at night.
let crossMat: MeshStandardMaterial | null = null
export function redCross() {
  if (crossMat) return crossMat
  const c = new MeshStandardMaterial({ color: '#d32f2f', emissive: new Color('#ff1744'), emissiveIntensity: 0.15 })
  c.userData.live = true
  onNight((n) => (c.emissiveIntensity = 0.15 + n * 1.4))
  crossMat = c
  return c
}

// Runway-style edge lights: amber around pads, blue along taxiways. Unlit
// colours by day; the amber ones share the street-lamp bulb's night glow.
export function PadLights({ bulb, r, n, y = 0.06, x = 0, z = 0 }: { bulb: ReactNode; r: number; n: number; y?: number; x?: number; z?: number }) {
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        return (
          <mesh key={i} position={[x + Math.cos(a) * r, y, z + Math.sin(a) * r]}>
            <boxGeometry args={[0.05, 0.04, 0.05]} />
            {bulb}
          </mesh>
        )
      })}
    </group>
  )
}

export function OfficeModel({ def, ghost, m, bulb, level = 1 }: Props) {
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  const lift = levelLift(lvl)
  const trim = !ghost
  // Level 4 and 7 rebuild these into bigger forms (names in game/growth.ts).
  const st = growthStage(lvl)

  switch (def.id) {
    // ---- Business Park: a two-storey office with ribbon windows and a glass atrium ----
    case 'offices': {
      // Grown, the two-storey block is the podium for glass floors or a tower.
      const h = st > 1 ? 1.2 : 1.2 + lift
      const w = 2.75
      const d = 1.3
      const x0 = -0.5
      const z0 = -0.3
      const zf = z0 + d / 2
      const floors: number[] = []
      for (let y = 0.22; y + 0.3 <= h - 0.08; y += 0.45) floors.push(y)
      const ah = Math.min(h, 1.05 + lift * 0.6)
      return (
        <group>
          {/* Stone block with a band of glass along every floor, front and sides. */}
          <Box m={m} at={[x0, h / 2, z0]} s={[w, h, d]} c="#d7ccc8" t={brickTex(2, Math.max(1, Math.round(h)))} />
          {floors.map((y) => (
            <group key={y}>
              <Glass m={m} ghost={ghost} at={[x0, y + 0.15, zf + 0.004]} w={w - 0.16} h={0.28} tint="#90caf9" />
              <Glass m={m} ghost={ghost} at={[x0 - w / 2 - 0.004, y + 0.15, z0]} w={d - 0.16} h={0.28} ry={-Math.PI / 2} tint="#90caf9" />
              <Glass m={m} ghost={ghost} at={[x0, y + 0.15, z0 - d / 2 - 0.004]} w={w - 0.16} h={0.28} ry={Math.PI} tint="#90caf9" />
              <Box m={m} at={[x0, y - 0.01, zf + 0.03]} s={[w + 0.02, 0.05, 0.07]} c="#fafafa" shadow={false} />
            </group>
          ))}
          <Box m={m} at={[x0, h + 0.05, z0]} s={[w + 0.06, 0.1, d + 0.06]} c="#455a64" />
          <mesh position={[x0, h + 0.101, z0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[w - 0.04, d - 0.04]} />
            {m(ROOF, SNOW ? undefined : gravelTex(3, 1))}
          </mesh>
          {/* Glass atrium with the entrance, a canopy and sliding doors. */}
          <GlassBlock m={m} ghost={ghost} x={1.38} z={-0.2} w={0.9} d={1.1} h={ah} tint="#b3e5fc" frame="#455a64" />
          <Box m={m} at={[1.38, 0.62, 0.58]} s={[1.0, 0.05, 0.4]} c="#455a64" />
          {[1.0, 1.76].map((x) => <Cyl key={x} m={m} at={[x, 0.3, 0.74]} r={0.022} h={0.6} c="#90a4ae" seg={6} />)}
          <mesh position={[1.38, 0.27, 0.36]}><planeGeometry args={[0.44, 0.52]} />{m('#263238')}</mesh>
          <Box m={m} at={[1.38, 0.28, 0.362]} s={[0.012, 0.52, 0.01]} c="#b0bec5" shadow={false} />
          <mesh position={[1.38, 0.66, 0.79]}><boxGeometry args={[0.7, 0.02, 0.02]} />{bulb}</mesh>
          {/* Walk to the street, lawn strips, planters, a bike rack and the monument sign. */}
          <Box m={m} at={[0, 0.02, 0.68]} s={[3.9, 0.04, 0.62]} c="#ffffff" t={paverTex(4, 1)} shadow={false} />
          <Box m={m} at={[-0.55, 0.045, 0.6]} s={[2.4, 0.03, 0.3]} c={PAL.grass} shadow={false} />
          {!ghost && (
            <group>
              {[-1.45, -0.55, 0.35].map((x) => <Planter key={x} m={m} at={[x, 0.04, 0.6]} />)}
              <group position={[0.85, 0, 0.7]}>
                {[-0.12, 0, 0.12].map((x) => <mesh key={x} position={[x, 0.11, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.09, 0.012, 5, 12, Math.PI]} />{m('#90a4ae')}</mesh>)}
              </group>
              <group position={[-1.55, 0, 0.88]}>
                <Box m={m} at={[0, 0.17, 0]} s={[0.78, 0.3, 0.12]} c="#8d8d8d" t={concreteTex(1, 1)} />
                <Sign text="BUSINESS PARK" w={0.7} at={[0, 0.2, 0.062]} bg="#37474f" fg="#ffffff" />
              </group>
              <Lamp m={m} bulb={bulb} at={[0.05, 0, 0.92]} />
              <Pool r={0.7} x={1.38} z={0.8} />
              <Pool r={0.5} x={0.05} z={0.95} />
            </group>
          )}
          {st === 1 && (
            <group>
              {/* Rooftop plant and solar panels. */}
              <RoofPlant m={m} at={[x0 + 0.85, h + 0.1, z0 - 0.15]} />
              {!ghost && <Trims m={m} lvl={lvl} w={w} d={d} h={h} z0={z0} flag="#455a64" />}
              {!ghost && (
                <group position={[x0 - 0.3, h + 0.36, zf - 0.06]}>
                  <Box m={m} at={[0, 0, -0.03]} s={[1.36, 0.4, 0.05]} c="#455a64" shadow={false} />
                  <Sign text="BUSINESS PARK" w={1.28} at={[0, 0, 0]} bg="#fafafa" fg="#37474f" />
                </group>
              )}
            </group>
          )}
          {st === 2 && (() => {
            // Office Block: glass floors on the stone podium, the top floor set
            // back behind a roof terrace.
            const uh = (midFloors(lvl) + 1) * 0.3
            const y = h + 0.1
            return (
              <group>
                <GlassBlock m={m} ghost={ghost} x={x0} z={z0} y0={y} w={w} d={d} h={uh} tint="#90caf9" frame="#455a64" />
                {!ghost && [-1.1, -0.55, 0, 0.55, 1.1].map((x) => <Box key={x} m={m} at={[x0 + x, y + uh / 2, zf + 0.03]} s={[0.04, uh, 0.05]} c="#eceff1" shadow={false} />)}
                <GlassBlock m={m} ghost={ghost} x={x0 - 0.3} z={z0 - 0.2} y0={y + uh + 0.08} w={1.9} d={0.85} h={0.6} tint="#90caf9" frame="#455a64" />
                <Box m={m} at={[x0 + 1.0, y + uh + 0.13, z0 + 0.2]} s={[0.7, 0.06, 0.8]} c={PAL.grass} />
                {!ghost && [0.75, 1.2].map((x) => <Planter key={x} m={m} at={[x0 + x, y + uh + 0.12, z0 + 0.3]} />)}
                {!ghost && <LitSign text="BUSINESS PARK" w={1.3} at={[x0 - 0.3, y + uh + 0.38, z0 - 0.2 + 0.43]} bg="#37474f" fg="#ffffff" m={m} />}
                <RoofPlant m={m} at={[x0 - 0.6, y + uh + 0.76, z0 - 0.3]} />
                {!ghost && lvl >= 5 && <Bulbs from={[x0 - w / 2, y + uh + 0.17, zf + 0.06]} to={[x0 + w / 2, y + uh + 0.17, zf + 0.06]} n={13} />}
              </group>
            )
          })()}
          {st === 3 && (() => {
            // Business Tower: a glass tower with aluminium fins and a stepped crown.
            const th = towerFloors(lvl) * 0.3
            const y = h + 0.1
            const tx = x0 + 0.05
            const tz = z0 - 0.1
            return (
              <group>
                <GlassBlock m={m} ghost={ghost} x={tx} z={tz} y0={y} w={2.1} d={1.05} h={th} tint="#90caf9" frame="#455a64" />
                {!ghost && [-0.8, -0.4, 0, 0.4, 0.8].map((x) => <Box key={x} m={m} at={[tx + x, y + th / 2, tz + 0.555]} s={[0.03, th, 0.06]} c="#cfd8dc" shadow={false} />)}
                <GlassBlock m={m} ghost={ghost} x={tx} z={tz} y0={y + th + 0.08} w={1.5} d={0.75} h={0.5} tint="#90caf9" frame="#455a64" />
                {!ghost && <LitSign text="BUSINESS PARK" w={1.2} at={[tx, y + th + 0.33, tz + 0.38]} bg="#37474f" fg="#ffffff" m={m} />}
                <Box m={m} at={[tx, y + th + 0.66, tz]} s={[0.9, 0.08, 0.45]} c={lvl >= 10 ? GOLD : '#455a64'} />
                <Cyl m={m} at={[tx + 0.3, y + th + 1.0, tz]} r={0.015} r2={0.03} h={0.62} c="#cfd8dc" seg={6} />
                <mesh position={[tx + 0.3, y + th + 1.33, tz]}><sphereGeometry args={[0.04, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>
                {!ghost && lvl >= 8 && <Flag at={[tx - 0.5, y + th + 0.7, tz]} color="#455a64" star={lvl >= 10} />}
                {!ghost && [-1.5, -0.9].map((x) => <Planter key={x} m={m} at={[x, h + 0.12, z0 + 0.35]} />)}
              </group>
            )
          })()}
        </group>
      )
    }

    // ---- Corporate HQ: a stone podium and a dark glass tower with fins and a lit crown ----
    case 'hq': {
      const ph = 0.8
      const th = 2.3 + lift * 1.4
      const top = ph + th
      const tw = 2.0
      const td = 1.1
      const tz = -0.35
      const tx = 0.25
      return (
        <group>
          <Box m={m} at={[0, 0.02, 0.2]} s={[3.9, 0.04, 1.55]} c="#ffffff" t={paverTex(4, 2)} shadow={false} />
          {/* Podium: granite with a full-height glass lobby. */}
          <Box m={m} at={[0, ph / 2, -0.25]} s={[3.6, ph, 1.4]} c="#e0e4e6" t={concreteTex(2, 1)} />
          <Glass m={m} ghost={ghost} at={[0.2, 0.4, 0.452]} w={2.6} h={0.62} tint="#cfd8dc" />
          {[-1.05, -0.4, 0.25, 0.9, 1.5].map((x) => <Box key={x} m={m} at={[x, 0.4, 0.47]} s={[0.04, 0.66, 0.04]} c="#263238" shadow={false} />)}
          <Box m={m} at={[0, ph + 0.03, -0.25]} s={[3.66, 0.06, 1.46]} c="#263238" />
          {/* Cantilevered entrance canopy with a revolving door under it. */}
          <Box m={m} at={[0.2, 0.7, 0.75]} s={[1.3, 0.05, 0.6]} c="#263238" />
          <mesh position={[0.2, 0.672, 1.04]}><boxGeometry args={[1.24, 0.015, 0.02]} />{bulb}</mesh>
          <mesh position={[0.2, 0.3, 0.55]}><cylinderGeometry args={[0.22, 0.22, 0.58, 16, 1, true]} />{ghost ? m('#90a4ae') : <primitive object={glassMat('#cfd8dc')} attach="material" dispose={null} />}</mesh>
          <Cyl m={m} at={[0.2, 0.6, 0.55]} r={0.24} h={0.04} c="#263238" seg={16} />
          {st < 3 ? (
            <group>
              {/* The tower: dark glass between slim aluminium fins. */}
              <GlassBlock m={m} ghost={ghost} x={tx} z={tz} y0={ph} w={tw} d={td} h={th} tint="#a9c4de" frame="#263238" />
              {!ghost && Array.from({ length: 7 }, (_, i) => tx - tw / 2 + 0.25 + i * 0.25).map((x) => (
                <Box key={x} m={m} at={[x, ph + th / 2, tz + td / 2 + 0.03]} s={[0.025, th, 0.06]} c="#b0bec5" shadow={false} />
              ))}
              {!ghost && [-1, 1].flatMap((sd) => [-0.25, 0.1].map((z) => (
                <Box key={`${sd}${z}`} m={m} at={[tx + sd * (tw / 2 + 0.03), ph + th / 2, tz + z]} s={[0.06, th, 0.025]} c="#b0bec5" shadow={false} />
              )))}
              {/* Crown: a stepped glass top with the company name lit after dark. */}
              <GlassBlock m={m} ghost={ghost} x={tx} z={tz - 0.05} y0={top + 0.08} w={1.5} d={0.8} h={0.42} tint="#a9c4de" frame="#263238" />
              <LitSign text="APEXCORP" w={1.3} at={[tx, top + 0.29, tz + 0.354]} bg="#0d1b2a" fg="#4fc3f7" ghost={ghost} m={m} />
              {st === 1 ? (
                <group>
                  <Cyl m={m} at={[tx + 0.5, top + 0.88, tz - 0.2]} r={0.015} h={0.75} c="#90a4ae" seg={6} />
                  <mesh position={[tx + 0.5, top + 1.27, tz - 0.2]}><sphereGeometry args={[0.035, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>
                  <RoofPlant m={m} at={[tx - 0.4, top + 0.5, tz - 0.1]} />
                </group>
              ) : (
                <group position={[tx, top + 0.5, tz - 0.05]}>
                  {/* HQ Campus: an executive helipad over the crown, and a mast. */}
                  <Box m={m} at={[0, 0.05, 0]} s={[1.2, 0.1, 0.9]} c="#78909c" />
                  <mesh position={[0, 0.101, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.84, 0.84]} />{m('#ffffff', helipadTex('#4fc3f7', '#fafafa'))}</mesh>
                  {!ghost && <PadLights bulb={bulb} r={0.45} n={8} y={0.12} />}
                  {[-0.45, 0.45].map((x) => <Box key={x} m={m} at={[x, -0.2, 0.3]} rot={[0, 0, x > 0 ? -0.6 : 0.6]} s={[0.04, 0.5, 0.04]} c="#263238" shadow={false} />)}
                  <Cyl m={m} at={[0.55, 0.55, -0.35]} r={0.015} r2={0.03} h={1.0} c="#90a4ae" seg={6} />
                  <mesh position={[0.55, 1.07, -0.35]}><sphereGeometry args={[0.035, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>
                </group>
              )}
              {trim && lvl >= 5 && <Bulbs from={[tx - tw / 2, top + 0.02, tz + td / 2 + 0.05]} to={[tx + tw / 2, top + 0.02, tz + td / 2 + 0.05]} n={11} />}
              {trim && lvl >= 8 && <Flag at={[tx - 0.55, top + 0.5, tz - 0.3]} color="#1e3a5f" star={lvl >= 10} />}
            </group>
          ) : (() => {
            // Twin Towers: two glass towers on the podium joined by a sky bridge.
            const t2 = towerFloors(lvl) * 0.34
            const bridge = ph + t2 * 0.62
            return (
              <group>
                {/* Set on a diagonal so both read from the town camera. */}
                {([[-1.0, -0.2], [1.05, -0.55]] as const).map(([x, z], i) => {
                  const th2 = t2 - i * 0.34
                  return (
                    <group key={x}>
                      <GlassBlock m={m} ghost={ghost} x={x} z={z} y0={ph} w={1.1} d={0.85} h={th2} tint="#a9c4de" frame="#263238" />
                      {!ghost && [-0.33, -0.11, 0.11, 0.33].map((fx) => <Box key={fx} m={m} at={[x + fx, ph + th2 / 2, z + 0.455]} s={[0.025, th2, 0.06]} c="#b0bec5" shadow={false} />)}
                      <GlassBlock m={m} ghost={ghost} x={x} z={z - 0.02} y0={ph + th2 + 0.08} w={0.78} d={0.6} h={0.36} tint="#a9c4de" frame="#263238" />
                      <Cyl m={m} at={[x, ph + th2 + 0.95, z - 0.02]} r={0.02} r2={0.06} h={1.0} c={lvl >= 10 ? GOLD : '#cfd8dc'} seg={8} />
                      <mesh position={[x, ph + th2 + 1.48, z - 0.02]}><sphereGeometry args={[0.04, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>
                      {trim && <Bulbs from={[x - 0.55, ph + th2 + 0.02, z + 0.47]} to={[x + 0.55, ph + th2 + 0.02, z + 0.47]} n={7} />}
                    </group>
                  )
                })}
                <group position={[0.02, bridge, -0.38]} rotation-y={Math.atan2(0.35, 2.05)}>
                  <GlassBlock m={m} ghost={ghost} x={0} z={0} y0={0} w={1.0} d={0.36} h={0.24} tint="#cfd8dc" frame="#263238" />
                  {[-0.3, 0.3].map((x) => <Box key={x} m={m} at={[x, -0.2, 0]} rot={[0, 0, x < 0 ? 0.7 : -0.7]} s={[0.04, 0.45, 0.04]} c="#263238" shadow={false} />)}
                </group>
                <LitSign text="APEXCORP" w={0.7} at={[-1.0, ph + t2 + 0.26, -0.2 + 0.285]} bg="#0d1b2a" fg="#4fc3f7" ghost={ghost} m={m} />
                {trim && lvl >= 8 && <Flag at={[0.4, ph + 0.05, -0.75]} color="#1e3a5f" star={lvl >= 10} />}
              </group>
            )
          })()}
          {/* Plaza: three flags, a fountain and the boss's car at the kerb. */}
          {!ghost && (
            <group>
              {[-1.75, -1.5, -1.25].map((x, i) => <Flag key={x} at={[x, 0, 0.62]} color={['#1e3a5f', '#4fc3f7', '#eceff1'][i]} tall={1.1} />)}
              <group position={[-0.95, 0, 0.72]}>
                <Cyl m={m} at={[0, 0.06, 0]} r={0.3} h={0.12} c="#b0bec5" seg={16} />
                <Cyl m={m} at={[0, 0.115, 0]} r={0.26} h={0.01} c="#4fc3f7" seg={16} />
                <Cyl m={m} at={[0, 0.2, 0]} r={0.04} h={0.2} c="#b0bec5" seg={8} />
                <mesh position={[0, 0.33, 0]}><sphereGeometry args={[0.06, 8, 6]} />{m('#e1f5fe')}</mesh>
              </group>
              <group position={[1.45, 0.04, 0.68]}>
                <Upright>
                  <group rotation-y={Math.PI / 2} scale={0.85}>
                    <CarModel body="luxury" color="#1a1a2e" />
                  </group>
                </Upright>
              </group>
              <Planter m={m} at={[-0.5, 0.04, 0.82]} />
              <Planter m={m} at={[0.9, 0.04, 0.82]} />
              <Pool r={0.8} x={0.2} z={0.85} />
            </group>
          )}
        </group>
      )
    }

    // ---- Glass Tower: a teal skyscraper with setbacks, a spire and a plaza ----
    case 'glasstower': {
      const tz = -0.55
      const lob = 0.75
      // Level 7-10: two-floor slabs, each turned a little more, 6 to 13 of them.
      const segs = Math.round(towerFloors(lvl) / 1.45)
      const twist = (4 * Math.PI) / 180
      const H = st === 3 ? lob + 0.08 + segs * 0.6 : 3.4 + lift * 1.3
      const turn = st === 3 ? (segs - 1) * twist : 0
      // Level 4-6: an open sky garden splits the shaft.
      const g1 = lob + 0.08 + (H - lob) * 0.52
      const crown = (kids: ReactNode) => (turn ? <group position={[0, 0, tz]} rotation-y={turn}><group position={[0, 0, -tz]}>{kids}</group></group> : kids)
      return (
        <group>
          <Box m={m} at={[0, 0.025, 0]} s={[3.9, 0.05, 3.9]} c="#ffffff" t={paverTex(4, 4)} shadow={false} />
          {/* Lobby: tall glass on a dark plinth, canopy and doors facing the plaza. */}
          <GlassBlock m={m} ghost={ghost} x={0} z={tz} w={2.5} d={2.3} h={lob} tint="#e0f2f1" frame="#263238" />
          <Box m={m} at={[0, lob + 0.04, tz + 1.3]} s={[1.4, 0.06, 0.5]} c="#263238" />
          <mesh position={[0, lob + 0.01, tz + 1.54]}><boxGeometry args={[1.36, 0.015, 0.02]} />{bulb}</mesh>
          <mesh position={[0, 0.3, tz + 1.156]}><planeGeometry args={[0.6, 0.56]} />{m('#1c2a33')}</mesh>
          {/* Shaft (whole, split by a sky garden, or twisting), upper setback and crown band. */}
          {st === 1 && <GlassBlock m={m} ghost={ghost} x={0} z={tz} y0={lob + 0.08} w={2.1} d={1.9} h={H - lob} tint="#7fd1c7" frame="#eceff1" />}
          {st === 2 && (
            <group>
              <GlassBlock m={m} ghost={ghost} x={0} z={tz} y0={lob + 0.08} w={2.1} d={1.9} h={g1 - lob - 0.08} tint="#7fd1c7" frame="#eceff1" />
              <Box m={m} at={[0, g1 + 0.25, tz]} s={[1.3, 0.5, 1.1]} c="#37474f" />
              <Box m={m} at={[0, g1 + 0.12, tz]} s={[2.0, 0.06, 1.8]} c={PAL.grass} />
              {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} m={m} at={[sx * 1.0, g1 + 0.3, tz + sz * 0.9]} s={[0.08, 0.5, 0.08]} c="#eceff1" />))}
              {!ghost && [[-0.75, 0.6], [0.75, 0.6], [-0.75, -0.6], [0.75, -0.6], [0, 0.72]].map(([x, z]) => <Planter key={`${x}${z}`} m={m} at={[x, g1 + 0.12, tz + z]} />)}
              <GlassBlock m={m} ghost={ghost} x={0} z={tz} y0={g1 + 0.5} w={2.1} d={1.9} h={H - g1 - 0.5} tint="#7fd1c7" frame="#eceff1" />
            </group>
          )}
          {st === 3 && Array.from({ length: segs }, (_, i) => (
            <group key={i} position={[0, 0, tz]} rotation-y={i * twist}>
              <GlassBlock m={m} ghost={ghost} x={0} z={0} y0={lob + 0.08 + i * 0.6} w={2.1} d={1.9} h={0.56} tint="#7fd1c7" frame="#eceff1" roof="#eceff1" />
            </group>
          ))}
          {!ghost && <LitSign text="HORIZON" w={1.0} at={[0, lob + 0.17, tz + 1.552]} bg="#004d40" fg="#e0f2f1" m={m} />}
          {crown(
            <group>
          <GlassBlock m={m} ghost={ghost} x={0} z={tz} y0={H + 0.16} w={1.5} d={1.3} h={0.7} tint="#7fd1c7" frame="#eceff1" />
          <mesh position={[0, H + 0.2, tz + 0.96]}><boxGeometry args={[2.1, 0.03, 0.02]} />{bulb}</mesh>
          <mesh position={[0, H + 0.2, tz - 0.96]}><boxGeometry args={[2.1, 0.03, 0.02]} />{bulb}</mesh>
          {/* Spire with an aircraft warning light. */}
          <Box m={m} at={[0, H + 0.98, tz]} s={[0.7, 0.16, 0.6]} c="#eceff1" />
          <Cyl m={m} at={[0, H + 1.5, tz]} r={0.02} r2={0.07} h={0.9} c="#eceff1" seg={8} />
          <mesh position={[0, H + 1.97, tz]}><sphereGeometry args={[0.045, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>
          {!ghost && <LitSign text="HORIZON" w={1.2} at={[0, H + 0.55, tz + 0.656]} bg="#004d40" fg="#a7ffeb" m={m} />}
          {/* Window-cleaning cradle from level 6, roof garden from 4. */}
          {trim && lvl >= 6 && st < 3 && (
            <group position={[0.55, H * 0.62, tz + 0.99]}>
              <Box m={m} at={[0, 0, 0.05]} s={[0.5, 0.1, 0.12]} c="#fdd835" />
              {[-0.22, 0.22].map((x) => <Cyl key={x} m={m} at={[x, (H * 0.38 + 0.2) / 2, 0.04]} r={0.004} h={H * 0.38 + 0.2} c="#424242" seg={4} />)}
            </group>
          )}
          {trim && lvl >= 4 && [-0.45, 0.45].map((x) => <Planter key={x} m={m} at={[x, H + 0.86, tz + 0.4]} />)}
          {!ghost && <Trims m={m} lvl={lvl} w={1.5} d={1.3} h={H + 0.86} z0={tz} flag="#004d40" />}
            </group>,
          )}
          {/* Plaza: reflecting pool, a sculpture, planters, benches and a taxi waiting. */}
          {!ghost && (
            <group>
              <group position={[-1.0, 0, 1.25]}>
                <Box m={m} at={[0, 0.06, 0]} s={[1.4, 0.12, 0.9]} c="#b0bec5" t={concreteTex(1, 1)} />
                <mesh position={[0, 0.115, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.28, 0.78]} /><meshStandardMaterial color="#4fb3d9" metalness={0.6} roughness={0.08} /></mesh>
                <mesh position={[0, 0.5, 0]} rotation-y={0.6} castShadow><torusGeometry args={[0.25, 0.05, 8, 24]} /><meshStandardMaterial color="#b0bec5" metalness={0.9} roughness={0.2} /></mesh>
                <Cyl m={m} at={[0, 0.2, 0]} r={0.05} h={0.18} c="#78909c" seg={8} />
              </group>
              {[[-1.7, 0.6], [1.7, 0.6], [-1.7, -1.7], [1.7, -1.7]].map(([x, z]) => <Planter key={`${x}${z}`} m={m} at={[x, 0.05, z]} big />)}
              <Bench m={m} at={[-0.15, 0.05, 1.25]} ry={Math.PI / 2} />
              <Bench m={m} at={[-1.0, 0.05, 1.8]} />
              {[-1.75, 1.75].map((x) => <Lamp key={x} m={m} bulb={bulb} at={[x, 0.05, 1.55]} />)}
              {/* Drop-off lane down the right side with a taxi at the kerb. */}
              <Box m={m} at={[1.15, 0.055, 1.05]} s={[1.0, 0.012, 1.7]} c="#78909c" shadow={false} />
              <group position={[1.15, 0.06, 1.15]}>
                <Upright>
                  <group scale={0.85}>
                    <CarModel body="sedan" color="#fdd835" stripe="#212121" />
                  </group>
                </Upright>
              </group>
              <Pool r={0.9} x={0} z={1.2} />
              <Pool r={0.6} x={-1.75} z={1.6} />
              <Pool r={0.6} x={1.75} z={1.6} />
            </group>
          )}
        </group>
      )
    }

    // ---- Hospital: wards, an emergency wing with an ambulance bay, and a rooftop pad ----
    case 'hospital': {
      // Grown, the ward block stops at three floors and a ward tower rises
      // behind it (level 4-6), then a medical tower with the pad on top (7-10).
      const h = 1.65 + (st > 1 ? levelLift(3) : lift)
      const wardFl = midFloors(lvl) + 1
      const tth = st === 2 ? wardFl * 0.42 : st === 3 ? towerFloors(lvl) * 0.32 : 0
      const tx = st === 3 ? 0.55 : 0.9
      const tw = st === 3 ? 2.1 : 1.5
      const padAt: V3 = st === 3 ? [tx, h + tth + 0.12, -1.05] : [-0.75, h + 0.1, -1.0]
      const w = 3.5
      const d = 1.7
      const z0 = -1.0
      const zf = z0 + d / 2
      const floors: number[] = []
      for (let y = 0.25; y + 0.3 <= h - 0.1; y += 0.42) floors.push(y)
      return (
        <group>
          <Box m={m} at={[0, 0.025, 0]} s={[3.9, 0.05, 3.9]} c="#ffffff" t={paverTex(4, 4)} shadow={false} />
          {/* Ward block: white with blue-green glass bands and a red stripe under the roof. */}
          <Box m={m} at={[0, h / 2, z0]} s={[w, h, d]} c="#f7f7f7" />
          {floors.map((y) => (
            <group key={y}>
              <Glass m={m} ghost={ghost} at={[0, y + 0.14, zf + 0.004]} w={w - 0.2} h={0.24} tint="#80cbc4" />
              <Glass m={m} ghost={ghost} at={[w / 2 + 0.004, y + 0.14, z0]} w={d - 0.2} h={0.24} ry={Math.PI / 2} tint="#80cbc4" />
              <Glass m={m} ghost={ghost} at={[-w / 2 - 0.004, y + 0.14, z0]} w={d - 0.2} h={0.24} ry={-Math.PI / 2} tint="#80cbc4" />
            </group>
          ))}
          <Box m={m} at={[0, h - 0.06, zf + 0.012]} s={[w + 0.01, 0.08, 0.02]} c="#d32f2f" shadow={false} />
          <Box m={m} at={[0, h + 0.05, z0]} s={[w + 0.06, 0.1, d + 0.06]} c="#cfd8dc" />
          {/* Big red cross and the name over the main doors. */}
          <group position={[1.15, h - 0.42, zf + 0.03]}>
            <Box m={m} at={[0, 0, -0.01]} s={[0.46, 0.46, 0.02]} c="#fafafa" shadow={false} />
            {[[0.34, 0.11], [0.11, 0.34]].map(([sx, sy]) => (
              <mesh key={sx}><boxGeometry args={[sx, sy, 0.03]} />{ghost ? m('#d32f2f') : <primitive object={redCross()} attach="material" dispose={null} />}</mesh>
            ))}
          </group>
          <LitSign text="HOSPITAL" w={1.5} at={[-0.6, h - 0.42, zf + 0.03]} bg="#fafafa" fg="#c62828" ghost={ghost} m={m} />
          {/* Main entrance: glass vestibule, canopy on posts, a drop-off kerb. */}
          <GlassBlock m={m} ghost={ghost} x={-0.95} z={zf + 0.25} w={1.0} d={0.5} h={0.6} tint="#b2dfdb" frame="#90a4ae" />
          <Box m={m} at={[-0.95, 0.72, zf + 0.65]} s={[1.3, 0.05, 0.85]} c="#90a4ae" />
          {[-1.5, -0.4].map((x) => <Cyl key={x} m={m} at={[x, 0.36, zf + 1.0]} r={0.025} h={0.72} c="#eceff1" seg={6} />)}
          <mesh position={[-0.95, 0.69, zf + 1.07]}><boxGeometry args={[1.2, 0.015, 0.02]} />{bulb}</mesh>
          {/* Emergency wing: a low block with a drive-through bay and the ambulance. */}
          <Box m={m} at={[1.2, 0.42, zf + 0.45]} s={[1.5, 0.84, 0.9]} c="#f2f2f2" />
          <Box m={m} at={[1.2, 0.88, zf + 0.45]} s={[1.56, 0.08, 0.96]} c="#d32f2f" />
          <LitSign text="EMERGENCY" w={1.1} at={[1.2, 0.66, zf + 0.906]} bg="#c62828" fg="#ffffff" ghost={ghost} m={m} />
          <mesh position={[1.2, 0.3, zf + 0.904]}><planeGeometry args={[0.8, 0.5]} />{m('#37474f')}</mesh>
          <Box m={m} at={[1.2, 0.74, zf + 1.4]} s={[1.5, 0.05, 1.0]} c="#d32f2f" />
          {[0.52, 1.88].flatMap((x) => [zf + 1.05, zf + 1.85].map((z) => <Cyl key={`${x}${z}`} m={m} at={[x, 0.37, z]} r={0.025} h={0.74} c="#eceff1" seg={6} />))}
          <mesh position={[1.2, 0.715, zf + 1.4]}><boxGeometry args={[0.04, 0.012, 0.9]} />{bulb}</mesh>
          {!ghost && (
            <group position={[1.2, 0.05, zf + 1.38]}>
              <Upright>
                <group rotation-y={Math.PI}>
                  <AmbulanceModel lit={false} />
                </group>
              </Upright>
            </group>
          )}
          <Box m={m} at={[1.2, 0.055, zf + 1.4]} s={[1.3, 0.012, 1.0]} c="#78909c" shadow={false} />
          {/* Rooftop helipad with edge lights, and the air ambulance on it. */}
          <group position={padAt}>
            <Box m={m} at={[0, 0.06, 0]} s={[1.6, 0.12, 1.5]} c="#9e9e9e" />
            <mesh position={[0, 0.121, 0]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[1.5, 1.5]} />
              {m('#ffffff', helipadTex('#fafafa', '#fafafa', true))}
            </mesh>
            {!ghost && <PadLights bulb={bulb} r={0.76} n={10} y={0.14} />}
            {!ghost && (
              <group position={[0, 0.12, 0]} scale={0.7}>
                <Helicopter look={{ body: '#fafafa', stripe: '#d32f2f' }} fly={lvl >= 3} seed={3} radius={9} height={6} />
              </group>
            )}
          </group>
          {st === 1 && <RoofPlant m={m} at={[0.85, h + 0.1, z0 - 0.2]} big />}
          {st === 1 && <Box m={m} at={[1.4, h + 0.3, z0 + 0.35]} s={[0.4, 0.4, 0.35]} c="#eceff1" />}
          {st === 2 && (
            <group>
              {/* Ward tower: white, a glass band on every floor, the cross on top. */}
              <Box m={m} at={[tx, h + tth / 2, -1.05]} s={[tw, tth, 1.3]} c="#f7f7f7" />
              {Array.from({ length: wardFl }, (_, i) => h + i * 0.42 + 0.22).map((y) => (
                <group key={y}>
                  <Glass m={m} ghost={ghost} at={[tx, y, -1.05 + 0.654]} w={tw - 0.16} h={0.22} tint="#80cbc4" />
                  <Glass m={m} ghost={ghost} at={[tx + tw / 2 + 0.004, y, -1.05]} w={1.14} h={0.22} ry={Math.PI / 2} tint="#80cbc4" />
                  <Glass m={m} ghost={ghost} at={[tx - tw / 2 - 0.004, y, -1.05]} w={1.14} h={0.22} ry={-Math.PI / 2} tint="#80cbc4" />
                </group>
              ))}
              <Box m={m} at={[tx, h + tth + 0.05, -1.05]} s={[tw + 0.06, 0.1, 1.36]} c="#cfd8dc" />
              <Box m={m} at={[tx, h + tth - 0.06, -1.05 + 0.66]} s={[tw + 0.01, 0.08, 0.02]} c="#d32f2f" shadow={false} />
              <RoofPlant m={m} at={[tx + 0.2, h + tth + 0.1, -1.25]} />
              <group position={[tx - 0.35, h + tth + 0.42, -1.05 + 0.4]}>
                {[[0.34, 0.11], [0.11, 0.34]].map(([sx, sy]) => (
                  <mesh key={sx}><boxGeometry args={[sx, sy, 0.05]} />{ghost ? m('#d32f2f') : <primitive object={redCross()} attach="material" dispose={null} />}</mesh>
                ))}
                <Box m={m} at={[0, -0.25, -0.02]} s={[0.04, 0.3, 0.04]} c="#90a4ae" shadow={false} />
              </group>
            </group>
          )}
          {st === 3 && (
            <group>
              {/* Medical tower: white stone and sea-green glass, a red band and cross at the top. */}
              <StoneShaftLite m={m} ghost={ghost} x={tx} z={-1.05} y0={h} w={tw} d={1.35} h={tth} />
              <Box m={m} at={[tx, h + tth - 0.12, -1.05 + 0.7]} s={[tw + 0.02, 0.1, 0.02]} c="#d32f2f" shadow={false} />
              <group position={[tx + 0.65, h + tth - 0.55, -1.05 + 0.72]}>
                <Box m={m} at={[0, 0, -0.01]} s={[0.5, 0.5, 0.02]} c="#fafafa" shadow={false} />
                {[[0.36, 0.12], [0.12, 0.36]].map(([sx, sy]) => (
                  <mesh key={sx}><boxGeometry args={[sx, sy, 0.03]} />{ghost ? m('#d32f2f') : <primitive object={redCross()} attach="material" dispose={null} />}</mesh>
                ))}
              </group>
              {!ghost && <LitSign text="MERCY" w={0.8} at={[tx - 0.45, h + tth - 0.55, -1.05 + 0.72]} bg="#fafafa" fg="#c62828" m={m} />}
              {/* The old pad's roof becomes a garden for the patients. */}
              <Box m={m} at={[-1.05, h + 0.13, -1.0]} s={[1.2, 0.06, 1.3]} c={PAL.grass} />
              {!ghost && [[-1.4, -0.6], [-0.7, -1.4], [-1.4, -1.4]].map(([x, z]) => <Planter key={`${x}${z}`} m={m} at={[x, h + 0.14, z]} />)}
              {!ghost && <Bench m={m} at={[-1.0, h + 0.14, -0.6]} ry={Math.PI} />}
            </group>
          )}
          {!ghost && <Trims m={m} lvl={lvl} w={w} d={d} h={h + 0.05} z0={z0} flag="#d32f2f" />}
          {/* Grounds: benches, planters, lamps and a wheelchair ramp to the doors. */}
          {!ghost && (
            <group>
              <Box m={m} at={[-0.95, 0.06, zf + 1.45]} rot={[0.12, 0, 0]} s={[0.4, 0.03, 0.5]} c="#bdbdbd" />
              {[-1.75, -0.15].map((x) => <Planter key={x} m={m} at={[x, 0.05, zf + 1.55]} big />)}
              <Bench m={m} at={[-1.45, 0.05, zf + 2.0]} ry={Math.PI} />
              <Bench m={m} at={[-0.45, 0.05, zf + 2.0]} ry={Math.PI} />
              {[-1.8, 0.2].map((x) => <Lamp key={x} m={m} bulb={bulb} at={[x, 0.05, 1.75]} />)}
              <Flag at={[-1.8, 0.05, zf + 0.6]} color="#c62828" tall={1.3} star={lvl >= 10} />
              <Pool r={0.9} x={-0.95} z={zf + 1.2} />
              <Pool r={0.9} x={1.2} z={zf + 1.6} />
            </group>
          )}
        </group>
      )
    }

    // ---- Heliport: a landing pad, terminal with a control cab, a hangar and a working helicopter ----
    case 'helipad': {
      const th = 0.75 + lift * 0.5
      const ct = 1.55 + lift * 0.6
      const pad: V3 = [0.6, 0, 0.5]
      return (
        <group>
          <Box m={m} at={[0, 0.025, 0]} s={[3.9, 0.05, 3.9]} c="#ffffff" t={concreteTex(4, 4)} shadow={false} />
          {/* The pad: a raised deck with the H, ringed by edge lights. */}
          <Cyl m={m} at={[pad[0], 0.07, pad[2]]} r={1.25} h={0.06} c="#78909c" seg={28} />
          <mesh position={[pad[0], 0.101, pad[2]]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[1.2, 28]} />
            {m('#ffffff', helipadTex('#ffca28', '#fafafa'))}
          </mesh>
          {!ghost && <PadLights bulb={bulb} x={pad[0]} z={pad[2]} r={1.28} n={14} y={0.11} />}
          {/* Taxiway to the hangar with blue edge lights. */}
          <Box m={m} at={[1.25, 0.052, -0.85]} s={[0.7, 0.01, 0.9]} c="#607d8b" shadow={false} />
          {!ghost && [-1.25, -0.95, -0.65].flatMap((z) => [0.88, 1.62].map((x) => (
            <mesh key={`${x}${z}`} position={[x, 0.08, z]}><boxGeometry args={[0.04, 0.05, 0.04]} /><meshStandardMaterial color="#1565c0" emissive="#2979ff" emissiveIntensity={0.8} /></mesh>
          )))}
          {/* Terminal with a control tower. */}
          <Box m={m} at={[-1.05, th / 2, -1.2]} s={[1.6, th, 1.2]} c="#eceff1" t={concreteTex(2, 1)} />
          <Glass m={m} ghost={ghost} at={[-1.05, th / 2 + 0.02, -0.596]} w={1.4} h={th - 0.25} tint="#90caf9" />
          <Box m={m} at={[-1.05, th + 0.04, -1.2]} s={[1.66, 0.08, 1.26]} c="#ff6f00" />
          <mesh position={[-1.05, th + 0.081, -1.2]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.6, 1.2]} />{m(ROOF, SNOW ? undefined : gravelTex(2, 1))}</mesh>
          <Box m={m} at={[-0.65, 0.66, -0.4]} s={[0.8, 0.04, 0.4]} c="#ff6f00" />
          <mesh position={[-0.65, 0.28, -0.594]}><planeGeometry args={[0.36, 0.5]} />{m('#263238')}</mesh>
          {!ghost && (
            <group position={[-1.05, th + 0.3, -0.62]}>
              <Box m={m} at={[0, 0, -0.03]} s={[1.24, 0.35, 0.05]} c="#ff6f00" shadow={false} />
              <Sign text="HELIPORT" w={1.16} at={[0, 0, 0]} bg="#fafafa" fg="#e65100" />
            </group>
          )}
          <group position={[-1.6, 0, -1.55]}>
            <Cyl m={m} at={[0, ct / 2, 0]} r={0.2} h={ct} c="#eceff1" seg={10} />
            <Cyl m={m} at={[0, ct + 0.05, 0]} r={0.36} r2={0.24} h={0.1} c="#455a64" seg={8} />
            <mesh position={[0, ct + 0.25, 0]}>
              <cylinderGeometry args={[0.35, 0.33, 0.3, 8, 1, true]} />
              {ghost ? m('#90caf9') : <primitive object={glassMat('#90caf9')} attach="material" dispose={null} />}
            </mesh>
            <Cyl m={m} at={[0, ct + 0.43, 0]} r={0.4} r2={0.36} h={0.06} c="#ff6f00" seg={8} />
            <Cyl m={m} at={[0.15, ct + 0.7, 0]} r={0.01} h={0.5} c="#90a4ae" seg={4} />
            <mesh position={[0.15, ct + 0.96, 0]}><sphereGeometry args={[0.03, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>
            {/* Rotating radar dish. */}
            <Box m={m} at={[-0.15, ct + 0.52, 0]} s={[0.24, 0.05, 0.03]} c="#cfd8dc" />
          </group>
          {/* Hangar: corrugated walls, a curved roof and an open door with a spare helicopter. */}
          <group position={[1.25, 0, -1.5]}>
            <Box m={m} at={[0, 0.4, -0.1]} s={[1.5, 0.8, 0.85]} c="#b0bec5" t={corrugatedTex(2, 1)} />
            <mesh position={[0, 0.8, -0.1]} rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.75, 0.75, 0.88, 16, 1, false, 0, Math.PI]} />
              {m('#90a4ae', corrugatedTex(2, 1, true))}
            </mesh>
            <mesh position={[0, 0.38, 0.33]}><planeGeometry args={[1.2, 0.74]} />{m('#263238')}</mesh>
            <Box m={m} at={[0, 0.78, 0.34]} s={[1.3, 0.06, 0.04]} c="#ff6f00" />
            {[-0.66, 0.66].map((x) => <Box key={x} m={m} at={[x, 0.4, 0.36]} s={[0.1, 0.8, 0.05]} c="#78909c" />)}
            {!ghost && (
              <group position={[0, 0.02, 0.15]} scale={0.55}>
                <Helicopter look={{ body: '#1565c0', stripe: '#fafafa' }} ghost />
              </group>
            )}
          </group>
          {/* Windsock, fuel bowser and a perimeter fence along the back. */}
          {!ghost && (
            <group>
              <group position={[-1.85, 0, -0.3]}>
                <Cyl m={m} at={[0, 0.55, 0]} r={0.02} h={1.1} c="#eceff1" seg={6} />
                {[0, 1, 2, 3].map((i) => (
                  <Cyl key={i} m={m} at={[0.08 + i * 0.1, 1.04 - i * 0.025, 0]} r={0.075 - i * 0.012} r2={0.065 - i * 0.012} h={0.1} c={i % 2 ? '#fafafa' : '#ff6f00'} seg={10} rot={[0, 0, Math.PI / 2 + 0.25]} />
                ))}
              </group>
              <group position={[-0.25, 0.05, 1.68]} rotation-y={1.3}>
                <Box m={m} at={[0, 0.2, -0.15]} s={[0.36, 0.26, 0.5]} c="#eceff1" />
                <Cyl m={m} at={[0, 0.25, -0.17]} r={0.13} h={0.46} c="#c62828" seg={12} rot={[Math.PI / 2, 0, 0]} />
                <Box m={m} at={[0, 0.22, 0.2]} s={[0.36, 0.3, 0.22]} c="#c62828" />
                <Box m={m} at={[0, 0.28, 0.31]} s={[0.3, 0.12, 0.01]} c="#263238" />
                {[[-0.18, 0.18], [0.18, 0.18], [-0.18, -0.28], [0.18, -0.28]].map(([x, z]) => <Cyl key={`${x}${z}`} m={m} at={[x, 0.07, z]} r={0.07} h={0.05} c="#212121" seg={10} rot={[0, 0, Math.PI / 2]} />)}
              </group>
              {[-1.9, -0.95, 0, 0.95, 1.9].map((x) => <Box key={x} m={m} at={[x, 0.25, -1.92]} s={[0.04, 0.5, 0.04]} c="#78909c" shadow={false} />)}
              {[0.15, 0.42].map((y) => <Box key={y} m={m} at={[0, y, -1.92]} s={[3.8, 0.02, 0.02]} c="#90a4ae" shadow={false} />)}
              <Lamp m={m} bulb={bulb} at={[-1.85, 0.05, 1.85]} />
              <Pool r={1.3} x={pad[0]} z={pad[2]} />
            </group>
          )}
          {/* A second pad from level 5 with another helicopter, flying too from level 8. */}
          {trim && lvl >= 5 && (
            <group position={[-1.25, 0, 0.95]}>
              <Cyl m={m} at={[0, 0.06, 0]} r={0.65} h={0.04} c="#78909c" seg={20} />
              <mesh position={[0, 0.081, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.62, 20]} />{m('#ffffff', helipadTex('#fafafa', '#ffca28'))}</mesh>
              <group position={[0, 0.08, 0]} scale={0.55}>
                <Helicopter look={{ body: '#1565c0', stripe: '#fafafa' }} fly={lvl >= 8} seed={11} radius={11} height={8} />
              </group>
            </group>
          )}
          {!ghost && <Trims m={m} lvl={lvl} w={1.6} d={1.2} h={th + 0.04} z0={-1.2} flag="#ff6f00" />}
          {/* The working helicopter: parks on the pad, then flies laps of town. */}
          <group position={[pad[0], 0.1, pad[2]]} scale={0.8}>
            <Helicopter look={{ body: '#ff6f00', stripe: '#fafafa' }} fly={!ghost} seed={0} radius={8} height={7} ghost={ghost} />
          </group>
        </group>
      )
    }
    default:
      return null
  }
}
