import type { ReactNode } from 'react'
import type { Texture } from 'three'
import { levelLift, type BuildingDef } from '../game/data'
import { growthStage } from '../game/growth'
import { signTexture } from './signTexture'
import { signMat } from './closingTime'
import { CarModel } from './CarModel'
import { Facade, Upright } from './mergeScale'
import { glowMats, onNight } from './dayNight'
import { ClubLife } from './ClubLife'
import { CLUB } from './clubLayout'
import { LED_COUNT, ledFront, ledWindows } from './clubLeds'
import { MeshBasicMaterial, MeshStandardMaterial, Color } from 'three'
import { PAL, SEASON } from './season'
import { LAYER, decal } from './layers'
import { Bulbs as EdgeBulbs } from './edgeKit'
import { brickTex, sidingTex, gravelTex, awningTex, paverTex, shutterTex, shingleTex, checkerTex } from './textures'

// Models for the second wave of shop items: businesses and services (coffee,
// tacos, oil change, arcade, body shop, market, fire and police stations,
// parking garage) and decorations. Every piece is a plain static mesh with
// colours shared across the town, so Batch merges them into a few draws.
// Lots face +z (the front door side), like the rest of the town.

export type V3 = [number, number, number]
export type Mat = (color: string, map?: Texture) => ReactNode
export type NewModelProps = { def: BuildingDef; ghost?: boolean; valid?: boolean; m: Mat; win: ReactNode; bulb: ReactNode; level?: number }

export const NEW_MODELS = new Set([
  'coffee', 'tacos', 'lube', 'arcade', 'bodyshop', 'market', 'firehouse', 'police', 'parkade', 'club',
  'pine', 'hedge', 'fence', 'picnic', 'busstop', 'hotdog', 'flagpole', 'arch', 'playground', 'gazebo', 'clocktower',
  'pumpkins', 'scarecrow', 'graves', 'deadtree',
])

export const GOLD = '#ffc107'
export const SNOW = SEASON === 'winter'

export function Box({ m, at, s, c, t, rot, shadow = true }: { m: Mat; at: V3; s: V3; c: string; t?: Texture; rot?: V3; shadow?: boolean }) {
  return (
    <mesh position={at} rotation={rot} castShadow={shadow} receiveShadow>
      <boxGeometry args={s} />
      {m(c, t)}
    </mesh>
  )
}

export function Cyl({ m, at, r, r2 = r, h, c, seg = 12, rot }: { m: Mat; at: V3; r: number; r2?: number; h: number; c: string; seg?: number; rot?: V3 }) {
  return (
    <mesh position={at} rotation={rot} castShadow>
      <cylinderGeometry args={[r, r2, h, seg]} />
      {m(c)}
    </mesh>
  )
}

export function Sign({ text, w, at, bg, fg }: { text: string; w: number; at: V3; bg: string; fg: string }) {
  return (
    <mesh position={at}>
      <planeGeometry args={[w, w / 4]} />
      <primitive object={signMat(text, bg, fg)} attach="material" dispose={null} />
    </mesh>
  )
}

export function Pool({ r, x = 0, z = 0 }: { r: number; x?: number; z?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, 0.075, z]} renderOrder={2}>
      <planeGeometry args={[r * 2, r * 2]} />
      <primitive object={glowMats.pool} attach="material" dispose={null} />
    </mesh>
  )
}

// Neon tubes stay lit day and night; one material per colour keeps them mergeable.
export function Neon({ at, s, c }: { at: V3; s: V3; c: string }) {
  return (
    <mesh position={at}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.9} toneMapped={false} />
    </mesh>
  )
}

export function Bulbs(props: { from: V3; to: V3; n: number; sag?: number; posts?: number }) {
  return <EdgeBulbs r={0.035} {...props} />
}

export function Flag({ at, color, star, tall = 0.9 }: { at: V3; color: string; star?: boolean; tall?: number }) {
  return (
    <group position={at}>
      <mesh position={[0, tall / 2, 0]} castShadow><cylinderGeometry args={[0.02, 0.025, tall, 6]} /><meshStandardMaterial color="#eceff1" metalness={0.4} /></mesh>
      <mesh position={[0.17, tall - 0.15, 0]}><boxGeometry args={[0.32, 0.2, 0.015]} /><meshStandardMaterial color={color} /></mesh>
      {star ? (
        <mesh position={[0, tall + 0.08, 0]} rotation-z={Math.PI / 2}><octahedronGeometry args={[0.11, 0]} /><meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} emissive={GOLD} emissiveIntensity={0.25} /></mesh>
      ) : (
        <mesh position={[0, tall + 0.02, 0]}><sphereGeometry args={[0.04, 8, 6]} /><meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} /></mesh>
      )}
    </group>
  )
}

// Upgrade trimmings shared by every new business, in the same order as the
// original buildings: cornice (3), roof bulbs (5), flag (8), gold trim (9), star (10).
export function Trims({ m, lvl, w, d, h, z0, flag }: { m: Mat; lvl: number; w: number; d: number; h: number; z0: number; flag: string }) {
  const zf = z0 + d / 2
  return (
    <group>
      {lvl >= 3 && <Box m={m} at={[0, h - 0.06, z0]} s={[w + 0.04, 0.07, d + 0.04]} c="#fafafa" />}
      {lvl >= 5 && <Bulbs from={[-w / 2 + 0.02, h + 0.17, zf + 0.02]} to={[w / 2 - 0.02, h + 0.17, zf + 0.02]} n={w > 2 ? 13 : 7} posts={0.19} />}
      {lvl >= 8 && <Flag at={[-w * 0.38, h - 0.02, z0 - d * 0.3]} color={flag} star={lvl >= 10} tall={1.05} />}
      {lvl >= 9 && (
        <mesh position={[0, h + 0.1, zf + 0.045]}>
          <boxGeometry args={[w + 0.07, 0.05, 0.03]} />
          <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} />
        </mesh>
      )}
    </group>
  )
}

type Shell = {
  m: Mat
  // Height of the first row of upper-floor windows.
  rowFrom?: number
  // A window's material by its place on the grid (column + floor), in place of `win`.
  winAt?: (i: number) => ReactNode
  win: ReactNode
  bulb: ReactNode
  ghost?: boolean
  lvl: number
  w: number
  d: number
  h0: number
  z0?: number
  x0?: number
  wall: string
  tex?: 'brick' | 'siding'
  roof: string
  sign?: string
  signBg?: string
  signFg?: string
  // Ground floor: a shop window, door and awning, or nothing (the model draws its own).
  shopfront?: string | null
  // How much of the usual upgrade height it gains (low-rise lots like the schools grow slower).
  grow?: number
  children?: ReactNode
}

// A flat-roofed building that grows a floor of windows every other upgrade level.
export function ShellBuilding({ m, win, bulb, ghost, lvl, w, d, h0, z0 = -0.15, x0 = 0, wall, tex = 'brick', roof, sign, signBg = '#fffde7', signFg = '#c62828', shopfront, grow = 1, rowFrom = 1.25, winAt, children }: Shell) {
  const pane = (i: number) => (winAt ? winAt(i) : win)
  const h = h0 + levelLift(lvl) * grow
  const zf = z0 + d / 2
  const rx = Math.max(1, Math.round(w * 0.6))
  const wallTex = tex === 'brick' ? brickTex(rx, Math.max(1, Math.round(h))) : sidingTex(rx, Math.max(1, Math.round(h * 1.5)))
  const rows: number[] = []
  for (let y = rowFrom; y + 0.2 <= h - 0.12; y += 0.55) rows.push(y)
  // Window columns across a front `L` long (twice w along a merged pair).
  const colsFor = (L: number) => (L > 2 ? Array.from({ length: Math.ceil(L / 0.8) * 2 }, (_, i) => (i - Math.ceil(L / 0.8) + 0.5) * 0.8).filter((x) => Math.abs(x) < L / 2 - 0.2) : [-L * 0.27, L * 0.27])
  const sw = Math.min(w * 0.8, 2.4)
  return (
    <group position={[x0, 0, 0]}>
      <Box m={m} at={[0, h / 2, z0]} s={[w, h, d]} c={wall} t={wallTex} />
      <Box m={m} at={[0, h + 0.06, z0]} s={[w + 0.08, 0.14, d + 0.08]} c={roof} />
      <mesh position={[0, h + 0.135, z0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w - 0.08, d - 0.08]} />
        {m('#ffffff', gravelTex(rx, Math.max(1, Math.round(d))))}
      </mesh>
      {shopfront != null && (
        <group>
          <mesh position={[0, 0.45, zf + 0.005]}>
            <planeGeometry args={[w * 0.78, 0.58]} />
            {win}
          </mesh>
          <Box m={m} at={[0, 0.08, zf + 0.015]} s={[w, 0.16, 0.03]} c="#eceff1" shadow={false} />
          <Box m={m} at={[0, 0.33, zf + 0.02]} s={[0.48, 0.66, 0.02]} c="#eceff1" shadow={false} />
          <mesh position={[0, 0.32, zf + 0.032]}>
            <planeGeometry args={[0.38, 0.6]} />
            {m('#4e342e')}
          </mesh>
          <Box m={m} at={[0, 0.82, zf + 0.2]} rot={[0.45, 0, 0]} s={[w * 0.92, 0.03, 0.44]} c="#ffffff" t={awningTex(shopfront)} />
          <Box m={m} at={[0, 0.03, zf + 0.12]} s={[0.6, 0.06, 0.22]} c="#cfd8dc" shadow={false} />
          {[-0.34, 0.34].map((x) => (
            <mesh key={x} position={[x, 0.7, zf + 0.05]}>
              <boxGeometry args={[0.08, 0.1, 0.08]} />
              {bulb}
            </mesh>
          ))}
          {!ghost && <Pool r={0.7} z={zf + 0.35} />}
        </group>
      )}
      {/* Side windows, then a row of windows for each upper floor. */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (w / 2 + 0.006), h0 * 0.55, z0]} rotation-y={(sd * Math.PI) / 2}>
          <planeGeometry args={[0.42, 0.42]} />
          {pane(sd < 0 ? 0 : 3)}
        </mesh>
      ))}
      <Facade at={[0, 0, zf]} len={w}>
        {(L) => rows.map((y, r) => colsFor(L).map((x, c) => (
          <group key={`${y}${x}`}>
            <mesh position={[x, y, 0.006]}>
              <planeGeometry args={[0.36, 0.38]} />
              {pane(r + c + 1)}
            </mesh>
            {lvl >= 4 && <Box m={m} at={[x, y - 0.22, 0.04]} s={[0.42, 0.04, 0.08]} c="#fafafa" />}
          </group>
        )))}
      </Facade>
      {[-1, 1].map((sd) => (
        <Facade key={sd} at={[sd * (w / 2 + 0.006), 0, z0]} ry={(sd * Math.PI) / 2} len={d}>
          {(L) => rows.map((y, r) => (L > 2 ? colsFor(L) : [0]).map((x, c) => (
            <mesh key={`${y}${x}`} position={[x, y, 0]}>
              <planeGeometry args={[0.36, 0.38]} />
              {pane(sd < 0 ? r + c + 1 : r + c + 4)}
            </mesh>
          )))}
        </Facade>
      ))}
      {!ghost && <Trims m={m} lvl={lvl} w={w} d={d} h={h} z0={z0} flag={roof} />}
      {!ghost && sign && (
        <group position={[0, h + 0.38, zf - 0.08]}>
          {/* Steel legs bolt the sign board down to the roof. */}
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[(sd * sw) / 2.8, -0.12, -0.08]} s={[0.04, 0.26, 0.04]} c="#455a64" shadow={false} />)}
          <Box m={m} at={[0, 0, -0.03]} s={[sw + 0.08, sw / 4 + 0.08, 0.05]} c={roof} shadow={false} />
          <Sign text={sign} w={sw} at={[0, 0, 0]} bg={signBg} fg={signFg} />
        </group>
      )}
      {children}
    </group>
  )
}

function Wheel({ m, at }: { m: Mat; at: V3 }) {
  return <Cyl m={m} at={at} r={0.12} h={0.08} c="#212121" seg={10} rot={[Math.PI / 2, 0, 0]} />
}

// Patio table under a parasol.
export function Parasol({ m, at, c }: { m: Mat; at: V3; c: string }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.2, 0]} r={0.16} h={0.03} c="#fafafa" seg={10} />
      <Cyl m={m} at={[0, 0.1, 0]} r={0.02} h={0.2} c="#78909c" seg={6} />
      <Cyl m={m} at={[0, 0.4, 0]} r={0.015} h={0.45} c="#eceff1" seg={6} />
      <mesh position={[0, 0.64, 0]} castShadow>
        <coneGeometry args={[0.32, 0.16, 8]} />
        {m('#ffffff', awningTex(c))}
      </mesh>
    </group>
  )
}

// A simple car shape for the parking garage decks: far fewer meshes than CarModel.
export function BlockCar({ m, at, c, rot = 0 }: { m: Mat; at: V3; c: string; rot?: number }) {
  return (
    <group position={at}>
      <Upright>
        <group rotation-y={rot}>
          {/* Body on four wheels, so it sits on the deck or lot it's parked on. */}
          <Box m={m} at={[0, 0.115, 0]} s={[0.36, 0.13, 0.66]} c={c} />
          <Box m={m} at={[0, 0.225, -0.04]} s={[0.3, 0.1, 0.34]} c="#b3e5fc" />
          {[[-0.17, 0.2], [0.17, 0.2], [-0.17, -0.2], [0.17, -0.2]].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.05, z]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.05, 0.05, 0.05, 10]} />
              {m('#212121')}
            </mesh>
          ))}
        </group>
      </Upright>
    </group>
  )
}


// Nightclub signs: dim by day and lit after dusk; the CLOSED plaque only shows by day.
// Built on first use (the textures need a canvas) and kept by identity so Batch
// merges them without baking in the glow.
let clubSigns: { name: MeshStandardMaterial; closed: MeshBasicMaterial; mat: MeshStandardMaterial; vip: MeshBasicMaterial } | null = null
function clubSignMats() {
  if (clubSigns) return clubSigns
  const tex = signTexture('NEON OWL', '#12061f', '#ff4fd8')
  const name = new MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new Color('#ffffff'), emissiveIntensity: 0.15, toneMapped: false })
  const closed = new MeshBasicMaterial({ map: signTexture('CLOSED', '#fafafa', '#c62828'), toneMapped: false })
  name.userData.live = closed.userData.live = true
  // The welcome mat's lettering lies on the mat, so it's drawn as a decal.
  const mat = new MeshStandardMaterial({ map: signTexture('NEON OWL', '#141018', '#ffc107'), roughness: 0.9, ...decal() })
  const vip = new MeshBasicMaterial({ map: signTexture('VIP', '#7f0000', '#ffd54f'), toneMapped: false })
  const signs = { name, closed, mat, vip }
  onNight((n) => {
    signs.name.emissiveIntensity = 0.15 + n * 1.1
    signs.closed.visible = n < 0.5
  })
  clubSigns = signs
  return signs
}

type GlowKey = 'neonPink' | 'neonCyan' | 'neonViolet' | 'danceFloor'

export function NewBuildingModel({ def, ghost, valid, m, win, bulb, level = 1 }: NewModelProps) {
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  const lift = levelLift(lvl)
  const trim = !ghost
  const shell = { m, win, bulb, ghost, lvl }

  switch (def.id) {
    // ---- Businesses and services ----
    case 'coffee': {
      const h = 1.25 + lift
      return (
        <ShellBuilding {...shell} w={1.5} d={1.25} h0={1.25} wall="#8d6e63" roof="#2e7d32" sign="COFFEE" signFg="#2e7d32" shopfront="#2e7d32">
          {/* A giant steaming mug on the roof. */}
          <group position={[0.32, h + 0.13, -0.42]}>
            <Cyl m={m} at={[0, 0.03, 0]} r={0.3} h={0.05} c="#fafafa" seg={16} />
            <Cyl m={m} at={[0, 0.25, 0]} r={0.24} r2={0.19} h={0.42} c="#fafafa" seg={16} />
            <Cyl m={m} at={[0, 0.46, 0]} r={0.22} h={0.01} c="#5d4037" seg={16} />
            <mesh position={[0.24, 0.27, 0]} castShadow><torusGeometry args={[0.1, 0.03, 6, 12]} />{m('#fafafa')}</mesh>
            {!ghost && [0, 1, 2].map((i) => (
              <mesh key={i} position={[Math.sin(i * 2) * 0.04, 0.5 + i * 0.105, 0]}><sphereGeometry args={[0.06 + i * 0.015, 8, 6]} />{m('#eceff1')}</mesh>
            ))}
          </group>
          {!ghost && [-0.62, 0.62].map((x) => <Parasol key={x} m={m} at={[x, 0, 0.75]} c="#2e7d32" />)}
        </ShellBuilding>
      )
    }
    case 'tacos': {
      const sh = 1.5 + lift
      const st = growthStage(lvl)
      if (st > 1) {
        // The truck settles down: an adobe taqueria (level 4), then a two-storey
        // cantina with a roof terrace under the giant taco (level 7).
        const H = st === 3 ? 1.75 : 1.05
        const taco = (
          <group>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.28, 0.28, 0.22, 16, 1, false, 0, Math.PI]} />
              {m('#ffca28')}
            </mesh>
            <Box m={m} at={[0, 0.03, 0]} s={[0.16, 0.06, 0.5]} c="#66bb6a" shadow={false} />
            {[-0.12, 0.05, 0.18].map((z) => <mesh key={z} position={[0, 0.07, z]}><sphereGeometry args={[0.05, 6, 5]} />{m('#e53935')}</mesh>)}
          </group>
        )
        return (
          <group>
            <Box m={m} at={[0, 0.025, 0]} s={[1.92, 0.05, 1.92]} c="#ffffff" t={paverTex(2, 2)} shadow={false} />
            <Box m={m} at={[0, H / 2, -0.4]} s={[1.6, H, 1.0]} c="#ffcc80" />
            {/* Stepped terracotta parapet and a tiled ledge over the door. */}
            <Box m={m} at={[0, H + 0.05, -0.4]} s={[1.66, 0.1, 1.06]} c="#d84315" />
            <Box m={m} at={[0, H + 0.17, 0.1]} s={[0.6, 0.18, 0.06]} c="#d84315" />
            <Box m={m} at={[0, H + 0.3, 0.1]} s={[0.26, 0.1, 0.06]} c="#d84315" />
            {/* Arched windows and a door, an awning in the truck's colours. */}
            {[-0.5, 0.5].map((x) => (
              <group key={x}>
                <mesh position={[x, 0.42, 0.105]}><planeGeometry args={[0.32, 0.36]} />{win}</mesh>
                <mesh position={[x, 0.6, 0.106]}><circleGeometry args={[0.16, 12, 0, Math.PI]} />{win}</mesh>
                <Box m={m} at={[x, 0.22, 0.12]} s={[0.38, 0.04, 0.05]} c="#5d4037" shadow={false} />
              </group>
            ))}
            <mesh position={[0, 0.33, 0.106]}><planeGeometry args={[0.32, 0.62]} />{m('#5d4037')}</mesh>
            <Box m={m} at={[0, 0.8, 0.3]} rot={[0.5, 0, 0]} s={[1.5, 0.03, 0.42]} c="#ffffff" t={awningTex('#ff7043', '#ffd54f')} />
            {st === 3 && (
              <group>
                {/* Upstairs: a band of arched windows and a balcony. */}
                {[-0.5, 0, 0.5].map((x) => (
                  <group key={x}>
                    <mesh position={[x, 1.32, 0.105]}><planeGeometry args={[0.26, 0.3]} />{win}</mesh>
                    <mesh position={[x, 1.47, 0.106]}><circleGeometry args={[0.13, 12, 0, Math.PI]} />{win}</mesh>
                  </group>
                ))}
                <Box m={m} at={[0, 1.08, 0.22]} s={[1.5, 0.04, 0.24]} c="#5d4037" />
                <Box m={m} at={[0, 1.16, 0.335]} s={[1.5, 0.12, 0.015]} c="#3e2723" shadow={false} />
              </group>
            )}
            {!ghost && (
              <group>
                {/* Mounted on the face of the stepped parapet, clear of its steps. */}
                <group position={[0, H + 0.12, 0.19]}>
                  <Box m={m} at={[0, 0, -0.03]} s={[0.98, 0.29, 0.05]} c="#ff7043" shadow={false} />
                  <Sign text={st === 3 ? 'CANTINA' : 'TAQUERIA'} w={0.9} at={[0, 0, 0]} bg="#ffd54f" fg="#bf360c" />
                </group>
                {/* Roof: chairs and parasols round the giant taco on a plinth. */}
                <group position={[0.35, H + 0.1, -0.6]}>
                  <Cyl m={m} at={[0, 0.06, 0]} r={0.3} h={0.12} c="#d84315" seg={12} />
                  <group position-y={0.09} scale={st === 3 ? 1.5 : 1.15}>{taco}</group>
                </group>
                {st === 3 && <Parasol m={m} at={[-0.45, H + 0.1, -0.5]} c="#43a047" />}
                {/* Patio with tables, papel picado and string lights. */}
                {[-0.55, 0.55].map((x, i) => <Parasol key={x} m={m} at={[x, 0, 0.62]} c={i ? '#43a047' : '#ff7043'} />)}
                {/* One piece, so merged the poles, lights and flags stay strung together. */}
                <Upright>
                  {[-0.88, 0.88].map((x) => <Cyl key={x} m={m} at={[x, 0.6, 0.88]} r={0.02} h={1.2} c="#6d4c41" seg={6} />)}
                  <Bulbs from={[-0.88, 1.15, 0.88]} to={[0.88, 1.15, 0.88]} n={9} />
                  {[-0.6, -0.3, 0, 0.3, 0.6].map((x, i) => (
                    <Box key={x} m={m} at={[x, 1.095 - Math.sin(((x + 0.88) / 1.76) * Math.PI) * 0.04, 0.88]} s={[0.12, 0.1, 0.01]} c={['#e91e63', '#ffeb3b', '#00bcd4', '#8bc34a', '#ff9800'][i]} shadow={false} />
                  ))}
                </Upright>
                {lvl >= 8 && <Flag at={[-0.7, H + 0.1, -0.8]} color="#43a047" star={lvl >= 10} />}
                <Pool r={0.8} z={0.55} />
              </group>
            )}
          </group>
        )
      }
      return (
        <group>
          <Box m={m} at={[0, 0.025, 0]} s={[1.92, 0.05, 1.92]} c="#ffffff" t={paverTex(2, 2)} shadow={false} />
          {/* The truck: box body, cab, serving hatch facing the street. */}
          <group position={[0.05, 0, -0.25]}>
          {/* A vehicle: merged, it stays truck-shaped on its wheels. */}
          <Upright>
            <Box m={m} at={[-0.15, 0.6, 0]} s={[1.15, 0.78, 0.78]} c="#fafafa" />
            <Box m={m} at={[0.62, 0.44, 0]} s={[0.42, 0.46, 0.76]} c="#ff7043" />
            <Box m={m} at={[0.62, 0.78, 0]} s={[0.38, 0.24, 0.72]} c="#b3e5fc" />
            <Box m={m} at={[-0.15, 0.23, 0]} s={[1.2, 0.06, 0.8]} c="#ff7043" />
            <mesh position={[-0.15, 0.66, 0.395]}>
              <planeGeometry args={[0.8, 0.32]} />
              {m('#3e2723')}
            </mesh>
            <Box m={m} at={[-0.15, 0.8, 0.5]} rot={[0.6, 0, 0]} s={[0.86, 0.03, 0.3]} c="#ffffff" t={awningTex('#ff7043', '#ffd54f')} />
            <Box m={m} at={[-0.15, 0.48, 0.44]} s={[0.84, 0.04, 0.1]} c="#bdbdbd" />
            {[[-0.55, 0.38], [0.6, 0.38], [-0.55, -0.38], [0.6, -0.38]].map(([x, z]) => <Wheel key={`${x}${z}`} m={m} at={[x, 0.12, z]} />)}
            {/* Giant taco on the roof. */}
            <group position={[-0.2, 0.995, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.28, 0.28, 0.22, 16, 1, false, 0, Math.PI]} />
                {m('#ffca28')}
              </mesh>
              <Box m={m} at={[0, 0.03, 0]} s={[0.16, 0.06, 0.5]} c="#66bb6a" shadow={false} />
              {[-0.12, 0.05, 0.18].map((z) => <mesh key={z} position={[0, 0.07, z]}><sphereGeometry args={[0.05, 6, 5]} />{m('#e53935')}</mesh>)}
            </group>
            {!ghost && <Sign text="TACOS" w={0.7} at={[-0.15, 0.95 + 0.04, 0.395]} bg="#ffd54f" fg="#bf360c" />}
          </Upright>
          </group>
          {/* Patio: one table to start, a second and string lights as it levels up. */}
          {!ghost && <Parasol m={m} at={[-0.55, 0, 0.62]} c="#ff7043" />}
          {trim && lvl >= 3 && <Parasol m={m} at={[0.55, 0, 0.62]} c="#43a047" />}
          {trim && lvl >= 5 && (
            <Upright>
              {[-0.88, 0.88].map((x) => <Cyl key={x} m={m} at={[x, 0.6, 0.85]} r={0.02} h={1.2} c="#6d4c41" seg={6} />)}
              <Bulbs from={[-0.88, 1.15, 0.85]} to={[0.88, 1.15, 0.85]} n={9} />
            </Upright>
          )}
          {/* Pole sign that grows taller with each level. */}
          {!ghost && (
            <group position={[-0.6, 0, -0.78]}>
              <Cyl m={m} at={[0, sh / 2, 0]} r={0.035} h={sh} c="#90a4ae" seg={6} />
              <Box m={m} at={[0, sh + 0.12, 0]} s={[0.66, 0.24, 0.05]} c={lvl >= 9 ? GOLD : '#ff7043'} />
              <Sign text="TACOS" w={0.6} at={[0, sh + 0.12, 0.03]} bg="#ffd54f" fg="#bf360c" />
              {lvl >= 8 && <Flag at={[0, sh + 0.24, 0]} color="#43a047" star={lvl >= 10} tall={0.5} />}
            </group>
          )}
          {!ghost && <Pool r={0.8} z={0.55} />}
        </group>
      )
    }
    case 'lube': {
      const h = 1.2 + lift
      return (
        <ShellBuilding {...shell} w={1.7} d={1.3} h0={1.2} wall="#eceff1" tex="siding" roof="#ffb300" sign="LUBE & GO" signFg="#e65100" shopfront={null}>
          {/* One big service bay on the left, a little office window on the right. */}
          <mesh position={[-0.3, 0.5, 0.506]}>
            <planeGeometry args={[0.9, 0.96]} />
            {m('#ffffff', shutterTex())}
          </mesh>
          <Box m={m} at={[-0.3, 1.02, 0.52]} s={[1, 0.08, 0.05]} c="#ffb300" />
          <mesh position={[-0.3, 1.12, 0.53]}><boxGeometry args={[0.16, 0.06, 0.08]} />{bulb}</mesh>
          <mesh position={[0.55, 0.55, 0.505]}>
            <planeGeometry args={[0.45, 0.42]} />
            {win}
          </mesh>
          <mesh position={[0.55, 0.22, 0.508]}>
            <planeGeometry args={[0.3, 0.42]} />
            {m('#455a64')}
          </mesh>
          <Box m={m} at={[0, 0.03, 0.78]} s={[1.6, 0.05, 0.5]} c="#ffffff" t={paverTex(2, 1)} shadow={false} />
          {/* Oil drums by the door and a giant oil drop on the roof. */}
          {!ghost && [[0.72, 0.68, '#c62828'], [0.48, 0.78, '#1565c0'], [0.66, 0.9, '#ffb300']].map(([x, z, c]) => (
            <Cyl key={c as string} m={m} at={[x as number, 0.17, z as number]} r={0.1} h={0.34} c={c as string} seg={10} />
          ))}
          <group position={[0.4, h + 0.14, -0.45]}>
            <mesh position={[0, 0.22, 0]} castShadow><sphereGeometry args={[0.22, 14, 10]} />{m('#ffb300')}</mesh>
            <mesh position={[0, 0.5, 0]} castShadow><coneGeometry args={[0.2, 0.36, 14]} />{m('#ffb300')}</mesh>
          </group>
          {!ghost && <Pool r={0.7} x={-0.3} z={0.85} />}
        </ShellBuilding>
      )
    }
    case 'arcade': {
      const h = 1.3 + lift
      return (
        <ShellBuilding {...shell} w={1.6} d={1.25} h0={1.3} wall="#4527a0" roof="#ec407a" sign="ARCADE" signBg="#1a1035" signFg="#ff4fd8" shopfront="#ec407a">
          {/* Neon outlines that glow day and night. */}
          {!ghost && (
            <group>
              <Neon at={[0, h - 0.04, 0.485]} s={[1.6, 0.04, 0.03]} c="#00e5ff" />
              {[-0.79, 0.79].map((x) => <Neon key={x} at={[x, h / 2, 0.485]} s={[0.035, h - 0.1, 0.03]} c="#ff4fd8" />)}
              <Neon at={[0, 1.02, 0.49]} s={[1.3, 0.03, 0.03]} c="#76ff03" />
            </group>
          )}
          {/* Giant joystick on the roof. */}
          <group position={[0.38, h + 0.13, -0.4]}>
            <Box m={m} at={[0, 0.08, 0]} s={[0.5, 0.16, 0.4]} c="#212121" />
            <Cyl m={m} at={[0, 0.34, 0]} r={0.035} h={0.36} c="#90a4ae" seg={8} />
            <mesh position={[0, 0.56, 0]} castShadow><sphereGeometry args={[0.12, 12, 10]} />{m('#e53935')}</mesh>
            {[-0.13, 0.13].map((x) => <Cyl key={x} m={m} at={[x, 0.17, 0.1]} r={0.05} h={0.03} c={x < 0 ? '#ffeb3b' : '#00e5ff'} seg={10} />)}
          </group>
        </ShellBuilding>
      )
    }
    case 'bodyshop': {
      const h = 1.5 + lift
      return (
        <ShellBuilding {...shell} w={3.5} d={1.3} h0={1.5} z0={-0.3} wall="#90a4ae" roof="#263238" sign="PAINT & BODY" signBg="#263238" signFg="#ffca28" shopfront={null}>
          {/* Two paint bays and a small office. */}
          {[-1.15, -0.05].map((x) => (
            <group key={x}>
              <mesh position={[x, 0.55, 0.356]}>
                <planeGeometry args={[0.92, 1.05]} />
                {m('#ffffff', shutterTex())}
              </mesh>
              <Box m={m} at={[x, 1.12, 0.37]} s={[1.02, 0.08, 0.05]} c="#ffca28" />
            </group>
          ))}
          <mesh position={[1.1, 0.55, 0.355]}>
            <planeGeometry args={[0.7, 0.5]} />
            {win}
          </mesh>
          <mesh position={[1.1, 0.25, 0.358]}><planeGeometry args={[0.3, 0.46]} />{m('#37474f')}</mesh>
          {/* Paint splats down the side wall. */}
          {!ghost && [[-1.5, 1.05, '#e53935', 0.16], [-1.3, 0.85, '#1e88e5', 0.12], [-1.62, 0.72, '#fdd835', 0.1], [1.45, 1.1, '#43a047', 0.13]].map(([x, y, c, r], i) => (
            <mesh key={c as string} position={[x as number, y as number, 0.358 + i * 0.002]}>
              <circleGeometry args={[r as number, 10]} />
              {m(c as string)}
            </mesh>
          ))}
          <Box m={m} at={[0, 0.03, 0.68]} s={[3.6, 0.05, 0.62]} c="#ffffff" t={paverTex(4, 1)} shadow={false} />
          {/* A freshly painted car rolling out of the bay. */}
          {!ghost && (
            <group position={[-0.05, 0.05, 0.62]}>
              <Upright>
                <group rotation-y={Math.PI / 2}>
                  <CarModel body="coupe" color="#ff6d00" />
                </group>
              </Upright>
            </group>
          )}
          {/* Giant spray can on the roof. */}
          <group position={[1.05, h + 0.14, -0.55]} rotation-z={-0.25}>
            <Cyl m={m} at={[0, 0.3, 0]} r={0.17} h={0.6} c="#e53935" seg={14} />
            <Cyl m={m} at={[0, 0.65, 0]} r={0.13} r2={0.17} h={0.1} c="#bdbdbd" seg={14} />
            <Box m={m} at={[0, 0.74, 0.04]} s={[0.08, 0.08, 0.12]} c="#fafafa" />
            <Cyl m={m} at={[0, 0.3, 0]} r={0.175} h={0.12} c="#fafafa" seg={14} />
          </group>
          {!ghost && <Pool r={0.9} x={-0.6} z={0.8} />}
        </ShellBuilding>
      )
    }
    case 'market': {
      const h = 1.45 + lift
      return (
        <ShellBuilding {...shell} w={3.5} d={1.3} h0={1.45} z0={-0.3} wall="#fff8e1" roof="#2e7d32" sign="FRESH MART" signFg="#2e7d32" shopfront="#43a047">
          {/* Produce stands out front. */}
          {!ghost && [-1.25, 1.25].map((x) => (
            <group key={x} position={[x, 0, 0.66]}>
              <Box m={m} at={[0, 0.2, 0]} rot={[-0.25, 0, 0]} s={[0.7, 0.08, 0.36]} c="#a1887f" />
              <Box m={m} at={[0, 0.09, 0]} s={[0.66, 0.18, 0.3]} c="#8d6e63" />
              {[-0.22, 0, 0.22].map((fx, i) => (
                <mesh key={fx} position={[fx, 0.27, 0.02]}><icosahedronGeometry args={[0.08, 0]} /><meshStandardMaterial color={x < 0 ? ['#e53935', '#fb8c00', '#fdd835'][i] : ['#7cb342', '#8e24aa', '#e53935'][i]} flatShading /></mesh>
              ))}
            </group>
          ))}
          {/* Cart corral. */}
          {!ghost && [0, 1, 2].map((i) => (
            <group key={i} position={[0.75 + i * 0.12, 0, 0.82]}>
              <Box m={m} at={[0, 0.17, 0]} s={[0.1, 0.14, 0.24]} c="#b0bec5" />
              <Box m={m} at={[0, 0.065, 0.02]} s={[0.08, 0.07, 0.2]} c="#e53935" shadow={false} />
            </group>
          ))}
          {/* Giant apple on the roof. */}
          <group position={[-1.2, h + 0.14, -0.6]}>
            <mesh position={[0, 0.25, 0]} castShadow scale={[1, 0.9, 1]}><sphereGeometry args={[0.27, 14, 10]} />{m('#e53935')}</mesh>
            <Cyl m={m} at={[0, 0.52, 0]} r={0.02} h={0.12} c="#5d4037" seg={6} />
            <mesh position={[0.08, 0.53, 0]} rotation-z={-0.6}><boxGeometry args={[0.14, 0.02, 0.07]} />{m('#43a047')}</mesh>
          </group>
        </ShellBuilding>
      )
    }
    case 'firehouse': {
      const h = 1.5 + lift
      // Grown: the hose tower becomes a drill tower (level 4), then Fire HQ
      // adds a dispatch floor and the ladder truck raised to the tower (7).
      const st = growthStage(lvl)
      const th = h + (st === 3 ? 2.6 : st === 2 ? 1.7 : 0.9)
      return (
        <ShellBuilding {...shell} w={3.5} d={1.4} h0={1.5} z0={-0.25} wall="#c62828" roof="#37474f" sign={st === 3 ? undefined : 'FIRE STATION'} signBg="#fafafa" signFg="#c62828" shopfront={null}>
          {/* Two tall engine bays with white trim. */}
          {[-0.9, 0.3].map((x) => (
            <group key={x}>
              <Box m={m} at={[x, 0.62, 0.445]} s={[1.02, 1.24, 0.03]} c="#fafafa" shadow={false} />
              <mesh position={[x, 0.58, 0.462]}>
                <planeGeometry args={[0.9, 1.12]} />
                {m(x < 0 ? '#263238' : '#ffffff', x < 0 ? undefined : shutterTex())}
              </mesh>
              <mesh position={[x, 1.32, 0.47]}><boxGeometry args={[0.14, 0.06, 0.08]} />{bulb}</mesh>
            </group>
          ))}
          <mesh position={[1.3, 0.55, 0.455]}><planeGeometry args={[0.5, 0.5]} />{win}</mesh>
          {/* Hose tower at the back corner. */}
          <Box m={m} at={[1.35, th / 2, -0.55]} s={[0.6, th, 0.6]} c="#c62828" t={brickTex(1, Math.max(1, Math.round(th)))} />
          <mesh position={[1.35, th + 0.22, -0.55]} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[0.5, 0.44, 4]} />
            {m(SNOW ? '#f4f8fb' : '#37474f')}
          </mesh>
          <mesh position={[1.35, th - 0.35, -0.244]}><planeGeometry args={[0.28, 0.32]} />{win}</mesh>
          {/* A fire engine nosing out of the open bay. */}
          <Box m={m} at={[-0.9, 0.03, 0.7]} s={[1.1, 0.05, 0.6]} c="#ffffff" t={paverTex(1, 1)} shadow={false} />
          {!ghost && (
            <group position={[-0.9, 0, 0.32]}>
              <Box m={m} at={[0, 0.42, 0]} s={[0.72, 0.5, 1.2]} c="#d32f2f" />
              <Box m={m} at={[0, 0.5, 0.52]} s={[0.66, 0.24, 0.18]} c="#b3e5fc" />
              <Box m={m} at={[0, 0.72, -0.1]} s={[0.5, 0.05, 1.05]} c="#cfd8dc" />
              {[-0.2, 0.2].map((x) => <Box key={x} m={m} at={[x, 0.78, -0.1]} s={[0.04, 0.06, 1.05]} c="#eceff1" />)}
              <Box m={m} at={[0, 0.25, 0.61]} s={[0.74, 0.08, 0.04]} c="#bdbdbd" />
              <Box m={m} at={[-0.18, 0.7, 0.45]} s={[0.12, 0.06, 0.1]} c="#e53935" />
              <Box m={m} at={[0.18, 0.7, 0.45]} s={[0.12, 0.06, 0.1]} c="#1e88e5" />
              {[[-0.37, 0.35], [0.37, 0.35], [-0.37, -0.35], [0.37, -0.35]].map(([x, z]) => (
                <Cyl key={`${x}${z}`} m={m} at={[x, 0.15, z]} r={0.14} h={0.08} c="#212121" seg={10} rot={[0, 0, Math.PI / 2]} />
              ))}
            </group>
          )}
          {/* Fire hydrant by the door. */}
          {!ghost && (
            <group position={[1.5, 0, 0.75]}>
              <Cyl m={m} at={[0, 0.14, 0]} r={0.07} h={0.28} c="#fdd835" seg={10} />
              <mesh position={[0, 0.3, 0]}><sphereGeometry args={[0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />{m('#fdd835')}</mesh>
            </group>
          )}
          {!ghost && <Pool r={0.9} x={-0.3} z={0.8} />}
          {trim && lvl >= 5 && <Bulbs from={[1.05, th + 0.02, -0.24]} to={[1.65, th + 0.02, -0.24]} n={5} />}
          {st > 1 && (
            <group>
              {/* Drill tower: a balcony with railings and a lit window on every floor above the roof. */}
              {Array.from({ length: Math.floor((th - h) / 0.45) }, (_, i) => h + 0.3 + i * 0.45).map((y) => (
                <group key={y}>
                  <Box m={m} at={[1.35, y, -0.17]} s={[0.56, 0.03, 0.16]} c="#37474f" shadow={false} />
                  <Box m={m} at={[1.35, y + 0.08, -0.095]} s={[0.56, 0.14, 0.012]} c="#eceff1" shadow={false} />
                  <mesh position={[1.35, y + 0.17, -0.244]}><planeGeometry args={[0.22, 0.24]} />{win}</mesh>
                </group>
              ))}
              {!ghost && <Box m={m} at={[1.66, (th - 0.6) / 2 + 0.3, -0.55]} s={[0.02, th - 0.6, 0.12]} c="#cfd8dc" shadow={false} />}
              {!ghost && (
                <group position={[1.35, th + 0.37, -0.55]}>
                  <Box m={m} at={[0, 0.12, 0]} s={[0.14, 0.1, 0.14]} c="#eceff1" />
                  <mesh position={[0, 0.22, 0]}><sphereGeometry args={[0.06, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>
                </group>
              )}
            </group>
          )}
          {st === 3 && (
            <group>
              {/* Dispatch floor: a glass band on the roof with the HQ name. */}
              <Box m={m} at={[-0.4, h + 0.32, -0.3]} s={[2.4, 0.5, 1.0]} c="#37474f" />
              <mesh position={[-0.4, h + 0.32, 0.205]}><planeGeometry args={[2.3, 0.34]} />{win}</mesh>
              <Box m={m} at={[-0.4, h + 0.6, -0.3]} s={[2.46, 0.06, 1.06]} c="#c62828" />
              {!ghost && (
                <group position={[-0.4, h + 0.88, 0.1]}>
                  <Box m={m} at={[0, 0, -0.03]} s={[1.38, 0.39, 0.05]} c="#c62828" shadow={false} />
                  <Sign text="FIRE HQ" w={1.3} at={[0, 0, 0]} bg="#fafafa" fg="#c62828" />
                </group>
              )}
              {/* Siren mast and the ladder truck by the tower, its ladder up to the top balcony. */}
              {!ghost && (
                <group position={[-1.4, h + 0.6, -0.55]}>
                  <Cyl m={m} at={[0, 0.35, 0]} r={0.02} h={0.7} c="#b0bec5" seg={6} />
                  <Cyl m={m} at={[0, 0.75, 0]} r={0.07} r2={0.05} h={0.1} c="#fdd835" seg={8} />
                </group>
              )}
              {!ghost && (
                <group position={[0.3, 0, 0.5]}>
                  <Box m={m} at={[0, 0.34, 0]} s={[0.6, 0.42, 0.95]} c="#d32f2f" />
                  <Box m={m} at={[0, 0.42, 0.42]} s={[0.56, 0.2, 0.14]} c="#b3e5fc" />
                  {[[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.3], [0.3, -0.3]].map(([x, z]) => (
                    <Cyl key={`${x}${z}`} m={m} at={[x, 0.13, z]} r={0.12} h={0.07} c="#212121" seg={10} rot={[0, 0, Math.PI / 2]} />
                  ))}
                  {(() => {
                    // From the turntable on the truck to the tower's top balcony.
                    const from: V3 = [0, 0.6, -0.2]
                    const to: V3 = [1.05, th - 0.15, -0.75]
                    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]
                    const len = Math.hypot(dx, dy, dz)
                    return (
                      <group position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]} rotation={[0, Math.atan2(dx, dz), 0]}>
                        <group rotation-x={-Math.atan2(dy, Math.hypot(dx, dz)) + Math.PI / 2}>
                          {[-0.06, 0.06].map((x) => <Box key={x} m={m} at={[x, 0, 0]} s={[0.025, len, 0.025]} c="#eceff1" shadow={false} />)}
                          {Array.from({ length: Math.floor(len / 0.18) }, (_, i) => <Box key={i} m={m} at={[0, -len / 2 + 0.09 + i * 0.18, 0]} s={[0.12, 0.015, 0.015]} c="#eceff1" shadow={false} />)}
                        </group>
                      </group>
                    )
                  })()}
                </group>
              )}
            </group>
          )}
        </ShellBuilding>
      )
    }
    case 'police':
      return (
        <ShellBuilding {...shell} w={3.5} d={1.35} h0={1.55} z0={-0.3} wall="#cfd8dc" roof="#1a237e" sign="POLICE" signBg="#1a237e" signFg="#ffffff" shopfront={null}>
          {/* Blue band, windows, and a columned entrance up a few steps. */}
          <Box m={m} at={[0, 1.1, 0.385]} s={[3.52, 0.12, 0.02]} c="#1565c0" shadow={false} />
          {[-1.25, -0.65, 0.65, 1.25].map((x) => (
            <mesh key={x} position={[x, 0.6, 0.377]}><planeGeometry args={[0.42, 0.5]} />{win}</mesh>
          ))}
          <mesh position={[0, 0.42, 0.378]}><planeGeometry args={[0.44, 0.74]} />{m('#37474f')}</mesh>
          <Box m={m} at={[0, 1.0, 0.6]} s={[1.1, 0.1, 0.5]} c="#eceff1" />
          {[-0.45, 0.45].map((x) => <Cyl key={x} m={m} at={[x, 0.5, 0.78]} r={0.06} h={0.95} c="#fafafa" seg={10} />)}
          {[0, 1, 2].map((i) => <Box key={i} m={m} at={[0, 0.03 + i * 0.05, 0.92 - i * 0.1]} s={[1.0, 0.06 + i * 0.05, 0.12]} c="#e0e0e0" shadow={false} />)}
          {/* Blue lamps either side of the door. */}
          {!ghost && [-0.32, 0.32].map((x) => (
            <mesh key={x} position={[x, 0.78, 0.45]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color="#42a5f5" emissive="#1e88e5" emissiveIntensity={0.6} /></mesh>
          ))}
          {/* A patrol car parked out front, light bar on the roof. */}
          {!ghost && (
            <group position={[-1.25, 0.05, 0.72]}>
              <Upright>
                <group rotation-y={Math.PI / 2}>
                  <CarModel body="sedan" color="#fafafa" stripe="#1a237e" />
                  <Box m={m} at={[-0.08, 0.6, -0.02]} s={[0.1, 0.05, 0.34]} c="#e0e0e0" />
                  <Box m={m} at={[-0.08, 0.64, 0.088]} s={[0.096, 0.05, 0.116]} c="#e53935" />
                  <Box m={m} at={[-0.08, 0.64, -0.128]} s={[0.096, 0.05, 0.116]} c="#1e88e5" />
                </group>
              </Upright>
            </group>
          )}
          {!ghost && <Flag at={[1.4, 0, 0.75]} color="#1565c0" tall={1.6} star={lvl >= 10} />}
          {!ghost && <Pool r={0.8} z={0.95} />}
          {trim && lvl >= 9 && <Box m={m} at={[0, 1.06, 0.86]} s={[1.12, 0.03, 0.03]} c={GOLD} />}
        </ShellBuilding>
      )
    case 'club': {
      const h = 1.3 + lift
      const w = 3.4
      const d = 1.3
      const z0 = -0.29
      const zf = z0 + d / 2
      const glow = (k: GlowKey, c: string) => (ghost ? m(c) : <primitive object={glowMats[k]} attach="material" dispose={null} />)
      const tube = (k: GlowKey, at: V3, sz: V3) => (
        <mesh key={at.join()} position={at}>
          <boxGeometry args={sz} />
          {glow(k, '#ff2bd6')}
        </mesh>
      )
      const signs = ghost ? null : clubSignMats()
      const floor = { y: h + 0.15, z: z0 + 0.06, w: w - 0.5, d: d - 0.36 }
      const posts = Array.from({ length: 6 }, (_, i) => CLUB.ropeFrom + ((CLUB.ropeTo - CLUB.ropeFrom) * i) / 5)
      const dx = CLUB.doorX
      // Every flat layer at the door sits a clear step above the one under it,
      // so nothing lies flush with the lot paving and flickers (see coplanar.test.tsx).
      const step = LAYER.lot + 0.04
      const rug = LAYER.lot + 0.016
      const rugEnd = 0.92
      // Ropes hang as arcs of a circle between the posts.
      const gap = posts[1] - posts[0]
      const sag = 0.05
      const ropeY = LAYER.lot + 0.27
      const ropeR = (gap * gap / 4 + sag * sag) / (2 * sag)
      const ropeArc = 2 * Math.asin(gap / 2 / ropeR)
      return (
        <ShellBuilding {...shell} w={w} d={d} h0={1.3} z0={z0} wall="#3a2160" roof="#d500f9" shopfront={null} rowFrom={1.6} winAt={ghost ? undefined : (i) => <primitive object={ledWindows[i % LED_COUNT]} attach="material" dispose={null} />}>
          {/* Entrance: gold-framed double doors with porthole windows, up one step. */}
          <Box m={m} at={[dx, 0.4, zf + 0.012]} s={[0.54, 0.8, 0.024]} c={GOLD} shadow={false} />
          {[-1, 1].map((sd) => (
            <group key={sd} position={[dx + sd * 0.105, 0, zf + 0.032]}>
              <Box m={m} at={[0, step + 0.34, 0]} s={[0.2, 0.68, 0.016]} c="#1a0b24" shadow={false} />
              <mesh position={[0, 0.6, 0.0095]}>
                <circleGeometry args={[0.045, 14]} />
                {glow('neonViolet', '#b04dff')}
              </mesh>
              <mesh position={[0, 0.6, 0.01]}>
                <torusGeometry args={[0.05, 0.009, 5, 16]} />
                {m(GOLD)}
              </mesh>
              <Cyl m={m} at={[-sd * 0.05, 0.28, 0.022]} r={0.008} h={0.1} c={GOLD} seg={6} />
              {[0.24, 0.32].map((y) => <Box key={y} m={m} at={[-sd * 0.05, y, 0.014]} s={[0.014, 0.014, 0.016]} c={GOLD} shadow={false} />)}
            </group>
          ))}
          {signs && (
            <mesh position={[dx, 0.43, zf + 0.045]}>
              <planeGeometry args={[0.32, 0.08]} />
              <primitive object={signs.closed} attach="material" dispose={null} />
            </mesh>
          )}
          {/* A dark granite doorstep with a gold nosing. */}
          <Box m={m} at={[dx, (LAYER.lot + step) / 2, zf + 0.07]} s={[0.62, step - LAYER.lot, 0.14]} c="#2e2933" shadow={false} />
          <Box m={m} at={[dx, step - 0.001, zf + 0.135]} s={[0.62, 0.014, 0.02]} c={GOLD} shadow={false} />
          {/* Wall sconces either side of the door. */}
          {[-1, 1].map((sd) => (
            <group key={sd} position={[dx + sd * 0.36, 0.56, zf]}>
              <Box m={m} at={[0, 0, 0.008]} s={[0.07, 0.14, 0.016]} c={GOLD} shadow={false} />
              <mesh position={[0, 0.01, 0.03]}>
                <boxGeometry args={[0.04, 0.09, 0.03]} />
                {glow('neonPink', '#ff2bd6')}
              </mesh>
            </group>
          ))}
          {/* The canopy: neon-edged, a row of marquee bulbs under its lip, gold poles. */}
          <Box m={m} at={[dx, 0.84, zf + 0.24]} s={[0.66, 0.05, 0.48]} c="#120818" />
          {tube('neonViolet', [dx, 0.84, zf + 0.485], [0.66, 0.03, 0.03])}
          {[-1, 1].map((sd) => tube('neonViolet', [dx + sd * 0.33, 0.84, zf + 0.23], [0.03, 0.03, 0.46]))}
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} position={[dx - 0.27 + i * 0.09, 0.8, zf + 0.44]}>
              <sphereGeometry args={[0.017, 6, 5]} />
              {ghost ? m('#fff8e1') : bulb}
            </mesh>
          ))}
          {[-1, 1].map((sd) => (
            <group key={sd} position={[dx + sd * 0.3, 0, zf + 0.44]}>
              <Cyl m={m} at={[0, 0.42, 0]} r={0.018} h={0.84} c={GOLD} seg={6} />
              <Cyl m={m} at={[0, LAYER.lot + 0.012, 0]} r={0.034} r2={0.04} h={0.024} c={GOLD} seg={8} />
            </group>
          ))}
          {/* Red carpet from the step to the street, edged in gold, a welcome mat at the door. */}
          <Box m={m} at={[dx, (LAYER.lot + 0.002 + rug) / 2, (zf + 0.14 + rugEnd) / 2]} s={[0.42, rug - LAYER.lot - 0.002, rugEnd - zf - 0.14]} c="#b71c1c" shadow={false} />
          {[-1, 1].map((sd) => (
            <Box key={sd} m={m} at={[dx + sd * 0.2, LAYER.lot + 0.011, (zf + 0.14 + rugEnd) / 2]} s={[0.025, 0.022, rugEnd - zf - 0.14]} c={GOLD} shadow={false} />
          ))}
          <Box m={m} at={[dx, LAYER.lot + 0.011, rugEnd]} s={[0.45, 0.022, 0.025]} c={GOLD} shadow={false} />
          <Box m={m} at={[dx, rug + 0.005, zf + 0.25]} s={[0.34, 0.01, 0.17]} c="#141018" shadow={false} />
          {signs && (
            <mesh position={[dx, rug + 0.012, zf + 0.25]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.3, 0.075]} />
              <primitive object={signs.mat} attach="material" dispose={null} />
            </mesh>
          )}
          {/* The bouncer's podium, with a reading lamp and the guest list. */}
          <group position={[-1.6, 0, 0.55]}>
            <Box m={m} at={[0, (LAYER.lot + 0.3) / 2, 0]} s={[0.15, 0.3 - LAYER.lot, 0.11]} c="#1c1022" />
            <Box m={m} at={[0, 0.26, 0]} s={[0.158, 0.014, 0.118]} c={GOLD} shadow={false} />
            <Box m={m} at={[0, 0.315, 0.01]} rot={[0.35, 0, 0]} s={[0.19, 0.02, 0.15]} c="#2a1a33" />
            <Box m={m} at={[0.02, 0.33, 0.016]} rot={[0.35, 0, 0]} s={[0.08, 0.008, 0.1]} c="#fafafa" shadow={false} />
            <Cyl m={m} at={[-0.06, 0.37, -0.04]} r={0.006} h={0.1} c={GOLD} seg={5} />
            <mesh position={[-0.06, 0.42, -0.02]} rotation-x={0.6}>
              <coneGeometry args={[0.025, 0.035, 8, 1, true]} />
              {ghost ? m('#fff8e1') : bulb}
            </mesh>
          </group>
          {/* Velvet rope for the line: gold stanchions, red ropes hanging between them. */}
          {posts.map((x, i) => (
            <group key={x} position={[x, 0, CLUB.ropeZ]}>
              <Cyl m={m} at={[0, LAYER.lot + 0.007, 0]} r={0.045} r2={0.055} h={0.014} c={GOLD} seg={10} />
              <Cyl m={m} at={[0, LAYER.lot + 0.025, 0]} r={0.016} r2={0.032} h={0.022} c={GOLD} seg={8} />
              <Cyl m={m} at={[0, LAYER.lot + 0.16, 0]} r={0.014} h={0.27} c={GOLD} seg={6} />
              <mesh position={[0, LAYER.lot + 0.3, 0]}><sphereGeometry args={[0.026, 8, 6]} />{m(GOLD)}</mesh>
              {i > 0 && (
                <mesh position={[-gap / 2, ropeY - sag + ropeR, 0]} rotation-z={-Math.PI / 2 - ropeArc / 2}>
                  <torusGeometry args={[ropeR, 0.011, 5, 10, ropeArc]} />
                  {m('#9e0f1e')}
                </mesh>
              )}
              {i === 0 && signs && (
                <group position={[0, LAYER.lot + 0.19, 0.022]}>
                  <Box m={m} at={[0, 0, 0]} s={[0.15, 0.065, 0.012]} c={GOLD} shadow={false} />
                  <mesh position-z={0.0075}>
                    <planeGeometry args={[0.13, 0.0325]} />
                    <primitive object={signs.vip} attach="material" dispose={null} />
                  </mesh>
                </group>
              )}
            </group>
          ))}
          {/* Club lights through the front window. */}
          <Box m={m} at={[0.5, 0.55, zf + 0.006]} s={[1.96, 0.46, 0.012]} c="#120818" shadow={false} />
          <mesh position={[0.5, 0.55, zf + 0.014]}>
            <planeGeometry args={[1.9, 0.4]} />
            {ghost ? m('#7c4dff') : <primitive object={ledFront} attach="material" dispose={null} />}
          </mesh>
          {/* The name in lights over the door, with a neon owl beside it. */}
          {signs && (
            <group position={[0.35, 1.03, zf + 0.03]}>
              <Box m={m} at={[0, 0, -0.012]} s={[1.68, 0.42, 0.03]} c="#12061f" shadow={false} />
              <mesh position-z={0.006}>
                <planeGeometry args={[1.52, 0.38]} />
                <primitive object={signs.name} attach="material" dispose={null} />
              </mesh>
            </group>
          )}
          {/* A neon owl on its own dark panel beside the sign: ears, big eyes, beak and a wing curve. */}
          <group position={[-1.36, 1.03, zf]}>
            <Box m={m} at={[0, 0, 0.012]} s={[0.44, 0.38, 0.024]} c="#12061f" shadow={false} />
            {[-1, 1].map((sd) => (
              <group key={sd}>
                <mesh position={[sd * 0.085, 0.03, 0.038]}>
                  <torusGeometry args={[0.07, 0.014, 6, 16]} />
                  {glow('neonCyan', '#00e5ff')}
                </mesh>
                <mesh position={[sd * 0.085, 0.03, 0.03]}>
                  <circleGeometry args={[0.022, 10]} />
                  {glow('neonPink', '#ff2bd6')}
                </mesh>
                <mesh position={[sd * 0.13, 0.155, 0.038]} rotation-z={-sd * 0.5}>
                  <boxGeometry args={[0.014, 0.08, 0.014]} />
                  {glow('neonViolet', '#b04dff')}
                </mesh>
              </group>
            ))}
            <mesh position={[0, -0.06, 0.04]} rotation-x={Math.PI / 2}>
              <coneGeometry args={[0.03, 0.07, 4]} />
              {glow('neonPink', '#ff2bd6')}
            </mesh>
            <mesh position={[0, -0.04, 0.038]} rotation-z={Math.PI * 1.15}>
              <torusGeometry args={[0.16, 0.012, 5, 18, Math.PI * 0.7]} />
              {glow('neonViolet', '#b04dff')}
            </mesh>
          </group>
          {/* Neon edges: corners and a band under the roof. */}
          {[-1, 1].map((sd) => tube('neonPink', [sd * (w / 2 + 0.005), h / 2, zf + 0.01], [0.035, h - 0.08, 0.035]))}
          {tube('neonCyan', [0, h - 0.04, zf + 0.02], [w, 0.035, 0.03])}
          {tube('neonViolet', [0.5, 0.33, zf + 0.02], [1.96, 0.03, 0.03])}
          {/* Rooftop dance floor with a DJ booth, speakers, a mirror ball and a glowing rail. */}
          <mesh position={[0, floor.y, floor.z]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[floor.w, floor.d]} />
            {glow('danceFloor', '#7c4dff')}
          </mesh>
          {[-1, 1].map((sd) => tube('neonCyan', [0, h + 0.36, z0 + sd * (d / 2 - 0.05)], [w - 0.1, 0.03, 0.03]))}
          {[-1, 1].map((sd) => tube('neonCyan', [sd * (w / 2 - 0.05), h + 0.36, z0], [0.03, 0.03, d - 0.1]))}
          {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
            <Box key={`${sx}${sz}`} m={m} at={[sx * (w / 2 - 0.05), h + 0.25, z0 + sz * (d / 2 - 0.05)]} s={[0.04, 0.24, 0.04]} c="#120818" shadow={false} />
          )))}
          <group position={[0, h + 0.14, z0 - d / 2 + 0.2]}>
            <Box m={m} at={[0, 0.14, 0]} s={[0.7, 0.28, 0.22]} c="#212121" />
            {tube('neonPink', [0, 0.2, 0.115], [0.66, 0.03, 0.01])}
            {[-0.62, 0.62].map((x) => (
              <group key={x}>
                <Box m={m} at={[x, 0.22, 0]} s={[0.26, 0.44, 0.22]} c="#151515" />
                <Cyl m={m} at={[x, 0.27, 0.115]} r={0.07} h={0.01} c="#424242" seg={10} rot={[Math.PI / 2, 0, 0]} />
                <Cyl m={m} at={[x, 0.11, 0.115]} r={0.045} h={0.01} c="#424242" seg={10} rot={[Math.PI / 2, 0, 0]} />
              </group>
            ))}
          </group>
          <group position={[1.05, h + 0.14, z0 - d / 2 + 0.15]}>
            <Cyl m={m} at={[0, 0.45, 0]} r={0.02} h={0.9} c="#9e9e9e" seg={6} />
            <Box m={m} at={[-0.2, 0.89, 0.12]} rot={[0, 0.5, 0]} s={[0.5, 0.02, 0.02]} c="#9e9e9e" shadow={false} />
            <mesh position={[-0.42, 0.74, 0.25]} castShadow>
              <icosahedronGeometry args={[0.12, 1]} />
              <meshStandardMaterial color="#eceff1" metalness={0.9} roughness={0.15} flatShading />
            </mesh>
          </group>
          {/* Searchlight lamps on the roof's back corners, so the beams start above the building. */}
          {[-1, 1].map((sd) => (
            <group key={sd} position={[sd * CLUB.lampX, h + 0.135, z0 + CLUB.lampZ]}>
              <Cyl m={m} at={[0, 0.08, 0]} r={0.12} r2={0.14} h={0.16} c="#37474f" seg={10} />
              <Cyl m={m} at={[0, 0.2, 0]} r={0.09} h={0.08} c="#eceff1" seg={10} />
            </group>
          ))}
          {!ghost && <Pool r={0.8} x={CLUB.doorX} z={0.8} />}
          {!ghost && <Pool r={0.9} x={0.75} z={0.85} />}
          {!ghost && <ClubLife lvl={lvl} roofY={h + 0.135} roofZ={z0} floorY={floor.y} floorZ={floor.z} floorW={floor.w} floorD={floor.d} />}
        </ShellBuilding>
      )
    }
    case 'parkade': {
      // A concrete deck for every two levels, cars parked on each.
      const decks = 2 + Math.floor((lvl - 1) / 2)
      const DH = 0.55
      const top = decks * DH
      const cars = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fafafa', '#212121', '#8e24aa', '#ff7043']
      return (
        <group>
          <Box m={m} at={[0, 0.03, 0]} s={[3.8, 0.06, 3.8]} c="#ffffff" t={paverTex(4, 4)} shadow={false} />
          {Array.from({ length: decks }, (_, i) => {
            const y = (i + 1) * DH
            return (
              <group key={i}>
                <Box m={m} at={[0, y, -0.1]} s={[3.5, 0.1, 3.3]} c="#bdbdbd" />
                {/* Parapets with a stripe of the garage's colour. */}
                <Box m={m} at={[0, y + 0.13, 1.53]} s={[3.5, 0.16, 0.06]} c="#e0e0e0" />
                <Box m={m} at={[0, y + 0.13, -1.73]} s={[3.5, 0.16, 0.06]} c="#e0e0e0" />
                {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 1.72, y + 0.13, -0.1]} s={[0.06, 0.16, 3.3]} c="#e0e0e0" />)}
                <Box m={m} at={[0, y + 0.2, 1.565]} s={[3.5, 0.03, 0.01]} c="#1565c0" shadow={false} />
                {!ghost && [-1.1, -0.35, 0.4].map((x, j) => (
                  <BlockCar key={x} m={m} at={[x, y + 0.05, (i + j) % 2 ? -1.1 : 0.85]} c={cars[(i * 3 + j) % cars.length]} rot={(i + j) % 2 ? 0 : Math.PI} />
                ))}
              </group>
            )
          })}
          {/* Columns, and a stair tower at the back. */}
          {[[-1.65, 1.45], [1.65, 1.45], [-1.65, -1.65], [1.65, -1.65], [0, 1.45], [0, -1.65]].map(([x, z]) => (
            <Box key={`${x}${z}`} m={m} at={[x, top / 2, z]} s={[0.14, top, 0.14]} c="#9e9e9e" />
          ))}
          <Box m={m} at={[1.45, (top + 0.6) / 2, -1.495]} s={[0.55, top + 0.6, 0.49]} c="#9e9e9e" />
          <mesh position={[1.45, top + 0.1, -1.245]}><planeGeometry args={[0.3, 0.4]} />{win}</mesh>
          {/* Ramp up the right side. */}
          <mesh position={[1.2, DH / 2 + 0.05, 0.3]} rotation-x={-0.32} castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.06, 1.7]} />
            {m('#9e9e9e')}
          </mesh>
          {/* Entrance: ticket booth and a striped barrier arm. */}
          {!ghost && (
            <group position={[-0.6, 0, 1.6]}>
              <Box m={m} at={[0, 0.25, 0]} s={[0.3, 0.5, 0.3]} c="#1565c0" />
              <mesh position={[0, 0.32, 0.152]}><planeGeometry args={[0.2, 0.16]} />{win}</mesh>
              <Box m={m} at={[0.55, 0.42, 0.05]} s={[0.8, 0.04, 0.04]} c="#ffffff" t={awningTex('#e53935')} />
            </group>
          )}
          {/* Tall blue P sign. */}
          {!ghost && (
            <group position={[-1.55, 0, 1.55]}>
              <Box m={m} at={[0, (top + 0.9) / 2, 0]} s={[0.08, top + 0.9, 0.08]} c="#90a4ae" />
              <Box m={m} at={[0, top + 0.6, 0.06]} s={[0.5, 0.5, 0.06]} c={lvl >= 9 ? GOLD : '#1565c0'} />
              <mesh position={[0, top + 0.6, 0.095]}>
                <planeGeometry args={[0.44, 0.44]} />
                <meshBasicMaterial map={signTexture('P', '#1565c0', '#ffffff', 1)} toneMapped={false} />
              </mesh>
            </group>
          )}
          {!ghost && (
            <group position={[0.5, top + 0.3, 1.58]}>
              <Box m={m} at={[0, 0, -0.03]} s={[1.88, 0.53, 0.05]} c="#1565c0" shadow={false} />
              <Sign text="PARKING" w={1.8} at={[0, 0, 0]} bg="#fafafa" fg="#1565c0" />
            </group>
          )}
          {trim && lvl >= 5 && <Bulbs from={[-1.72, top + 0.24, 1.6]} to={[1.72, top + 0.24, 1.6]} n={13} />}
          {trim && lvl >= 8 && <Flag at={[-1.4, top + 0.05, -1.5]} color="#1565c0" star={lvl >= 10} />}
          {!ghost && <Pool r={1.4} z={0.6} />}
        </group>
      )
    }

    // ---- Spooky Season decorations ----
    case 'pumpkins': {
      const pumpkins: [number, number, number][] = [[-0.45, -0.35, 0.34], [0.4, -0.45, 0.26], [0.5, 0.35, 0.3], [-0.5, 0.45, 0.22], [0.02, 0.05, 0.42]]
      return (
        <group>
          <Box m={m} at={[0, 0.03, 0]} s={[1.75, 0.06, 1.75]} c="#5d4037" shadow={false} />
          {/* Vines across the patch. */}
          {[[-0.2, -0.4, 0.5], [0.3, 0.1, -0.7], [-0.3, 0.3, 1.1]].map(([x, z, r], i) => (
            <Box key={i} m={m} at={[x, 0.08, z]} rot={[0, r, 0]} s={[1.0, 0.03, 0.05]} c="#558b2f" shadow={false} />
          ))}
          {pumpkins.map(([x, z, r], i) => (
            <group key={i} position={[x, r * 0.72, z]}>
              <mesh scale={[1, 0.72, 1]} castShadow><sphereGeometry args={[r, 12, 8]} />{m(i % 2 ? '#fb8c00' : '#ef6c00')}</mesh>
              <Cyl m={m} at={[0, r * 0.78, 0]} r={r * 0.12} r2={r * 0.16} h={r * 0.4} c="#33691e" seg={5} />
            </group>
          ))}
          {/* The big one is carved: its face glows after dark. */}
          <group position={[0.02, 0.42 * 0.72, 0.05 + 0.4]}>
            {[-0.13, 0.13].map((x) => (
              <mesh key={x} position={[x, 0.07, 0.004]} rotation-z={Math.PI}><circleGeometry args={[0.07, 3]} />{bulb}</mesh>
            ))}
            <mesh position={[0, -0.09, 0.004]} scale={[1, 0.45, 1]}><circleGeometry args={[0.17, 7, Math.PI, Math.PI]} />{bulb}</mesh>
          </group>
          {trim && <Box m={m} at={[0.75, 0.2, -0.75]} s={[0.36, 0.26, 0.26]} c="#e0c068" />}
        </group>
      )
    }
    case 'scarecrow':
      return (
        <group>
          <Cyl m={m} at={[0, 0.85, 0]} r={0.05} h={1.7} c="#6d4c41" seg={6} />
          <Box m={m} at={[0, 1.2, 0]} s={[1.2, 0.07, 0.07]} c="#6d4c41" />
          {/* Plaid shirt, overalls and straw. */}
          <Box m={m} at={[0, 1.08, 0]} s={[0.46, 0.42, 0.24]} c="#c62828" />
          <Box m={m} at={[0, 0.8, 0]} s={[0.4, 0.26, 0.22]} c="#3f51b5" />
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <Box m={m} at={[sd * 0.4, 1.2, 0]} s={[0.36, 0.14, 0.16]} c="#c62828" />
              <mesh position={[sd * 0.62, 1.2, 0]} rotation-z={sd * -Math.PI / 2}><coneGeometry args={[0.07, 0.16, 6]} />{m('#fdd835')}</mesh>
              <mesh position={[sd * 0.1, 0.6, 0]} rotation-z={Math.PI}><coneGeometry args={[0.07, 0.2, 6]} />{m('#fdd835')}</mesh>
            </group>
          ))}
          <mesh position={[0, 1.45, 0]} castShadow><sphereGeometry args={[0.17, 10, 8]} />{m('#d7b98a')}</mesh>
          {[-0.06, 0.06].map((x) => <Box key={x} m={m} at={[x, 1.48, 0.16]} s={[0.04, 0.04, 0.02]} c="#212121" shadow={false} />)}
          <Box m={m} at={[0, 1.4, 0.165]} s={[0.12, 0.02, 0.02]} c="#212121" shadow={false} />
          <Cyl m={m} at={[0, 1.58, 0]} r={0.3} h={0.03} c="#6d4c41" seg={12} />
          <mesh position={[0, 1.74, 0]} castShadow><coneGeometry args={[0.16, 0.32, 10]} />{m('#6d4c41')}</mesh>
          {/* A crow on the arm, and a hay bale at his feet. */}
          <group position={[0.5, 1.3, 0]}>
            <mesh scale={[1.4, 1, 1]}><sphereGeometry args={[0.06, 8, 6]} />{m('#212121')}</mesh>
            <mesh position={[0.1, 0.04, 0]} rotation-z={-Math.PI / 2}><coneGeometry args={[0.025, 0.06, 4]} />{m('#ffb300')}</mesh>
          </group>
          {trim && <Box m={m} at={[-0.5, 0.17, 0.45]} s={[0.55, 0.34, 0.34]} c="#e0c068" />}
          {trim && (
            <group position={[0.45, 0.16, 0.5]}>
              <mesh scale={[1, 0.72, 1]} castShadow><sphereGeometry args={[0.2, 10, 8]} />{m('#ef6c00')}</mesh>
            </group>
          )}
        </group>
      )
    case 'graves': {
      const stones: [number, number, number, number][] = [[-0.5, -0.3, 0.55, 0.1], [0.05, -0.45, 0.7, -0.08], [0.55, -0.2, 0.5, 0.15]]
      return (
        <group>
          <Box m={m} at={[0, 0.03, 0]} s={[1.8, 0.06, 1.8]} c="#4e5b31" shadow={false} />
          {stones.map(([x, z, h, tilt], i) => (
            <group key={i} position={[x, 0, z]} rotation={[0, 0, tilt]}>
              <Box m={m} at={[0, h / 2, 0]} s={[0.36, h, 0.1]} c="#9e9e9e" />
              <mesh position={[0, h, 0]} rotation-x={Math.PI / 2} castShadow><cylinderGeometry args={[0.18, 0.18, 0.1, 12, 1, false, -Math.PI / 2, Math.PI]} />{m('#9e9e9e')}</mesh>
              <Box m={m} at={[0, h * 0.65, 0.052]} s={[0.18, 0.03, 0.01]} c="#616161" shadow={false} />
              <Box m={m} at={[0, 0.07, 0.3]} s={[0.34, 0.06, 0.4]} c="#5d4037" shadow={false} />
            </group>
          ))}
          {/* A stone cross, an iron fence along the front and a lantern that lights at night. */}
          <group position={[-0.55, 0, 0.4]}>
            <Box m={m} at={[0, 0.4, 0]} s={[0.08, 0.8, 0.08]} c="#bdbdbd" />
            <Box m={m} at={[0, 0.58, 0]} s={[0.36, 0.08, 0.08]} c="#bdbdbd" />
          </group>
          {trim && Array.from({ length: 9 }, (_, i) => (
            <Box key={i} m={m} at={[-0.8 + i * 0.2, 0.22, 0.85]} s={[0.03, 0.44, 0.03]} c="#263238" shadow={false} />
          ))}
          {trim && <Box m={m} at={[0, 0.38, 0.85]} s={[1.65, 0.03, 0.03]} c="#263238" shadow={false} />}
          <group position={[0.55, 0, 0.45]}>
            <Cyl m={m} at={[0, 0.35, 0]} r={0.025} h={0.7} c="#263238" seg={6} />
            <mesh position={[0, 0.76, 0]}><boxGeometry args={[0.13, 0.16, 0.13]} />{bulb}</mesh>
            <mesh position={[0, 0.88, 0]}><coneGeometry args={[0.11, 0.1, 4]} />{m('#263238')}</mesh>
          </group>
        </group>
      )
    }
    case 'deadtree': {
      // Bare, twisted branches with lanterns hanging off them.
      const branches: [number, number, number, number, number][] = [
        [0.28, 1.55, 0, 0.9, 0.55], [-0.3, 1.45, 0.1, -0.85, 0.5], [0.05, 1.8, -0.06, 0.25, 0.45], [-0.12, 1.25, -0.25, -0.5, 0.4],
      ]
      return (
        <group>
          <Cyl m={m} at={[0, 0.55, 0]} r={0.1} r2={0.2} h={1.1} c="#3e2723" seg={7} />
          <Cyl m={m} at={[0.06, 1.3, 0]} r={0.07} r2={0.1} h={0.6} c="#3e2723" seg={7} rot={[0, 0, -0.15]} />
          {branches.map(([x, y, z, rz, len], i) => (
            <group key={i}>
              <Cyl m={m} at={[x, y, z]} r={0.025} r2={0.05} h={len} c="#3e2723" seg={5} rot={[0, 0, rz]} />
              <Cyl m={m} at={[x * 1.6, y + 0.18, z]} r={0.012} r2={0.025} h={0.25} c="#3e2723" seg={4} rot={[0, 0, -rz * 0.6]} />
            </group>
          ))}
          {[[0.55, 1.45, 0.05], [-0.55, 1.36, 0.12], [0.1, 1.72, -0.06]].map(([x, y, z], i) => (
            <group key={i} position={[x, y, z]}>
              <Cyl m={m} at={[0, 0.1, 0]} r={0.006} h={0.2} c="#212121" seg={4} />
              <mesh position={[0, -0.04, 0]}><sphereGeometry args={[0.07, 8, 6]} />{bulb}</mesh>
            </group>
          ))}
          {/* Roots, and a bat resting on the top branch. */}
          {[0, 1, 2, 3].map((i) => (
            <Cyl key={i} m={m} at={[Math.sin(i * 1.7) * 0.22, 0.06, Math.cos(i * 1.7) * 0.22]} r={0.03} r2={0.06} h={0.35} c="#3e2723" seg={5} rot={[Math.cos(i * 1.7) * 1.2, 0, -Math.sin(i * 1.7) * 1.2]} />
          ))}
          <group position={[0.0, 2.07, -0.06]}>
            <mesh><sphereGeometry args={[0.05, 6, 5]} />{m('#212121')}</mesh>
            {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.09, 0.01, 0]} rot={[0, 0, sd * 0.4]} s={[0.12, 0.015, 0.07]} c="#212121" shadow={false} />)}
          </group>
          {trim && (
            <group position={[-0.45, 0.13, 0.45]}>
              <mesh scale={[1, 0.72, 1]} castShadow><sphereGeometry args={[0.18, 10, 8]} />{m('#ef6c00')}</mesh>
            </group>
          )}
        </group>
      )
    }

    // ---- Decorations ----
    case 'pine':
      // Evergreen: stays green all year and catches snow in winter.
      return (
        <group>
          <Cyl m={m} at={[0, 0.25, 0]} r={0.08} r2={0.12} h={0.5} c="#6d4c41" seg={7} />
          {[[0.62, 0.7, 0.55], [0.48, 0.6, 1.0], [0.32, 0.5, 1.4]].map(([r, h, y], i) => (
            <group key={i}>
              <mesh position={[0, y, 0]} castShadow>
                <coneGeometry args={[r, h, 8]} />
                <meshStandardMaterial color={ghost ? (valid ? '#66bb6a' : '#ef5350') : ['#1b5e20', '#2e7d32', '#388e3c'][i]} transparent={ghost} opacity={ghost ? 0.55 : 1} flatShading />
              </mesh>
              {SNOW && !ghost && (
                <mesh position={[0, y + h * 0.22, 0]}>
                  <coneGeometry args={[r * 0.55, h * 0.56, 8]} />
                  <meshStandardMaterial color="#ffffff" flatShading />
                </mesh>
              )}
            </group>
          ))}
        </group>
      )
    case 'hedge':
      return (
        <group>
          {/* Boxwood stays green through the fall: a stone kerb, a clipped body
              and leafy clumps along the top. */}
          <Box m={m} at={[0, 0.04, 0]} s={[1.98, 0.08, 0.7]} c="#9e9e9e" />
          <Box m={m} at={[0, 0.36, 0]} s={[1.86, 0.56, 0.58]} c="#2e7d32" />
          {[-0.72, -0.24, 0.24, 0.72].map((x, i) => (
            <mesh key={x} position={[x, 0.62, (i % 2) * 0.04 - 0.02]} scale={[1.25, 0.6, 1]} castShadow>
              <icosahedronGeometry args={[0.25, 0]} />
              {m(SNOW ? '#ffffff' : i % 2 ? '#388e3c' : '#43a047')}
            </mesh>
          ))}
          {(SEASON === 'spring' || SEASON === 'summer') && [-0.8, -0.45, -0.1, 0.3, 0.65].map((x, i) => (
            <mesh key={x} position={[x, 0.13, 0.32]}>
              <sphereGeometry args={[0.04, 6, 4]} />
              {m(['#f06292', '#fff176', '#ffffff'][i % 3])}
            </mesh>
          ))}
        </group>
      )
    case 'fence':
      // Runs along the lot's front edge; turn it to fence another side.
      return (
        <group position={[0, 0, 0.85]}>
          {/* Pickets either side of a little gate, square posts with caps at the ends. */}
          {[-0.85, -0.66, -0.47, -0.28, 0.28, 0.47, 0.66, 0.85].map((x) => (
            <group key={x}>
              <Box m={m} at={[x, 0.2, 0]} s={[0.07, 0.4, 0.03]} c="#fafafa" />
              <mesh position={[x, 0.42, 0]} rotation-y={Math.PI / 4}><coneGeometry args={[0.05, 0.06, 4]} />{m('#fafafa')}</mesh>
            </group>
          ))}
          {[-1, 1].map((sd) => (
            <group key={sd}>
              {[-0.97, -0.18].map((x) => (
                <group key={x}>
                  <Box m={m} at={[sd * -x, 0.24, -0.01]} s={[0.09, 0.48, 0.09]} c="#f5f5f5" />
                  <Box m={m} at={[sd * -x, 0.5, -0.01]} s={[0.12, 0.04, 0.12]} c="#e0e0e0" />
                </group>
              ))}
              {[0.12, 0.3].map((y) => <Box key={y} m={m} at={[sd * 0.575, y, -0.025]} s={[0.76, 0.04, 0.02]} c="#fafafa" />)}
            </group>
          ))}
          {/* The gate: three pickets on a Z brace, with black hinges and latch. */}
          {[-0.09, 0, 0.09].map((x) => <Box key={x} m={m} at={[x, 0.19, 0.01]} s={[0.07, 0.34, 0.025]} c="#fafafa" />)}
          {[0.1, 0.28].map((y) => <Box key={y} m={m} at={[0, y, -0.012]} s={[0.26, 0.04, 0.02]} c="#eeeeee" />)}
          <Box m={m} at={[0, 0.19, -0.012]} s={[0.035, 0.24, 0.02]} c="#eeeeee" rot={[0, 0, -0.85]} />
          {[0.1, 0.28].map((y) => <Box key={y} m={m} at={[-0.13, y, 0.036]} s={[0.06, 0.02, 0.012]} c="#37474f" shadow={false} />)}
          <Box m={m} at={[0.13, 0.2, 0.036]} s={[0.025, 0.04, 0.02]} c="#37474f" shadow={false} />
          {/* A flower bed along the inside. */}
          {!SNOW && (
            <group>
              <Box m={m} at={[0, 0.02, -0.2]} s={[1.9, 0.04, 0.22]} c="#5d4037" shadow={false} />
              {[-0.8, -0.6, -0.4, 0.4, 0.6, 0.8].map((x, i) => (
                <mesh key={x} position={[x, 0.09, -0.2]}>
                  <icosahedronGeometry args={[0.07, 0]} />
                  {m(SEASON === 'fall' ? ['#ff8f00', '#c62828', '#fbc02d'][i % 3] : ['#ec407a', '#ffee58', '#ab47bc'][i % 3])}
                </mesh>
              ))}
            </group>
          )}
        </group>
      )
    case 'picnic':
      return (
        <group>
          <Box m={m} at={[0, 0.38, 0]} s={[1.1, 0.05, 0.5]} c="#a1887f" />
          <Box m={m} at={[0, 0.405, 0]} s={[0.9, 0.005, 0.42]} c="#ffffff" t={awningTex('#e53935')} shadow={false} />
          {[-0.4, 0.4].map((x) => <Box key={x} m={m} at={[x, 0.19, 0]} s={[0.05, 0.38, 0.9]} c="#6d4c41" rot={[0, 0, 0]} />)}
          {[-0.45, 0.45].map((z) => <Box key={z} m={m} at={[0, 0.22, z]} s={[1.1, 0.04, 0.14]} c="#a1887f" />)}
          {!ghost && (
            <group position={[0.25, 0.41, 0]}>
              <Box m={m} at={[0, 0.06, 0]} s={[0.18, 0.12, 0.12]} c="#d7a86e" />
              <mesh position={[0, 0.14, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.06, 0.012, 4, 10, Math.PI]} />{m('#8d6e63')}</mesh>
            </group>
          )}
          {!ghost && <Box m={m} at={[-0.15, 0.43, 0.05]} s={[0.14, 0.03, 0.14]} c="#fafafa" shadow={false} />}
        </group>
      )
    case 'busstop':
      return (
        <group>
          <Box m={m} at={[0, 0.025, 0]} s={[1.6, 0.05, 1.0]} c="#ffffff" t={paverTex(2, 1)} shadow={false} />
          <Box m={m} at={[0, 0.6, -0.42]} s={[1.3, 1.0, 0.04]} c="#90caf9" />
          {[-0.65, 0.65].map((x) => <Box key={x} m={m} at={[x, 0.6, -0.2]} s={[0.04, 1.2, 0.5]} c="#90caf9" />)}
          {[[-0.65, -0.42], [0.65, -0.42], [-0.65, 0.05], [0.65, 0.05]].map(([x, z]) => (
            <Box key={`${x}${z}`} m={m} at={[x, 0.62, z]} s={[0.05, 1.24, 0.05]} c="#37474f" />
          ))}
          <Box m={m} at={[0, 1.25, -0.18]} s={[1.45, 0.06, 0.6]} c="#37474f" />
          <Box m={m} at={[0, 0.28, -0.26]} s={[1.1, 0.05, 0.22]} c="#8d6e63" />
          {[-0.45, 0.45].map((x) => <Box key={x} m={m} at={[x, 0.14, -0.26]} s={[0.05, 0.28, 0.18]} c="#37474f" />)}
          <mesh position={[0, 1.22, -0.18]} rotation-x={Math.PI / 2}><planeGeometry args={[1.2, 0.4]} />{bulb}</mesh>
          {!ghost && (
            <group position={[0.6, 0, 0.55]}>
              <Cyl m={m} at={[0, 0.75, 0]} r={0.03} h={1.5} c="#90a4ae" seg={6} />
              <mesh position={[0, 1.45, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.18, 0.18, 0.03, 16]} />{m('#1e88e5')}</mesh>
              {/* Lettering on the disc's face, clear of the pole. */}
              <mesh position={[0, 1.45, 0.032]}>
                <planeGeometry args={[0.3, 0.075]} />
                <meshBasicMaterial map={signTexture('BUS', '#1e88e5', '#ffffff')} toneMapped={false} />
              </mesh>
            </group>
          )}
          {!ghost && <Pool r={0.7} z={0} />}
        </group>
      )
    case 'hotdog':
      return (
        <group>
          <Box m={m} at={[0, 0.42, 0]} s={[0.9, 0.42, 0.5]} c="#eceff1" />
          <Box m={m} at={[0, 0.42, 0.252]} s={[0.86, 0.12, 0.005]} c="#e53935" shadow={false} />
          <Box m={m} at={[0, 0.65, 0]} s={[0.94, 0.04, 0.54]} c="#b0bec5" />
          {[-1, 1].map((sd) => <Cyl key={sd} m={m} at={[-0.2, 0.17, sd * 0.27]} r={0.16} h={0.05} c="#37474f" seg={12} rot={[Math.PI / 2, 0, 0]} />)}
          <Box m={m} at={[0.55, 0.38, 0]} s={[0.3, 0.03, 0.03]} c="#78909c" />
          <Cyl m={m} at={[0, 1.0, 0]} r={0.02} h={0.7} c="#eceff1" seg={6} />
          <mesh position={[0, 1.35, 0]} castShadow>
            <coneGeometry args={[0.6, 0.22, 10]} />
            {m('#ffffff', awningTex('#fdd835', '#e53935'))}
          </mesh>
          {/* A giant hot dog riding on top. */}
          <group position={[0, 0.72, 0]}>
            <mesh rotation-z={Math.PI / 2} castShadow><capsuleGeometry args={[0.07, 0.42, 4, 8]} />{m('#e0a052')}</mesh>
            <mesh position={[0, 0.06, 0]} rotation-z={Math.PI / 2}><capsuleGeometry args={[0.045, 0.5, 4, 8]} />{m('#c0392b')}</mesh>
            <Box m={m} at={[0, 0.105, 0]} s={[0.4, 0.012, 0.02]} c="#fdd835" shadow={false} />
          </group>
        </group>
      )
    case 'flagpole':
      return (
        <group>
          <Cyl m={m} at={[0, 0.1, 0]} r={0.36} r2={0.42} h={0.2} c="#cfd8dc" seg={12} />
          <Cyl m={m} at={[0, 1.4, 0]} r={0.025} r2={0.04} h={2.6} c="#eceff1" seg={8} />
          <mesh position={[0, 2.72, 0]}><sphereGeometry args={[0.06, 8, 6]} />{ghost ? m(GOLD) : <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} />}</mesh>
          {/* Town flag: green and white with a gold car. */}
          <group position={[0.36, 2.35, 0]}>
            <Box m={m} at={[0, 0.12, 0]} s={[0.66, 0.22, 0.015]} c="#2e7d32" />
            <Box m={m} at={[0, -0.1, 0]} s={[0.66, 0.22, 0.015]} c="#fafafa" />
            <mesh position={[0, 0.01, 0.009]}><circleGeometry args={[0.08, 12]} />{m(GOLD)}</mesh>
          </group>
          {!ghost && [0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2
            return <mesh key={i} position={[Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5]}><sphereGeometry args={[0.08, 6, 5]} />{m(['#e91e63', '#ffeb3b', '#ab47bc'][i % 3])}</mesh>
          })}
        </group>
      )
    case 'arch':
      // Chequered finish-line arch with race lights.
      return (
        <group>
          {[-0.85, 0.85].map((x) => (
            <group key={x}>
              <Box m={m} at={[x, 0.08, 0]} s={[0.3, 0.16, 0.3]} c="#424242" />
              <Box m={m} at={[x, 0.95, 0]} s={[0.16, 1.7, 0.15]} c="#e53935" />
            </group>
          ))}
          <Box m={m} at={[0, 1.85, 0]} s={[2.0, 0.34, 0.16]} c="#212121" />
          {!ghost && [-1, 1].map((sd) => (
            <mesh key={sd} position={[0, 1.85, sd * 0.081]} rotation-y={sd < 0 ? Math.PI : 0}>
              <planeGeometry args={[1.9, 0.3]} />
              <meshBasicMaterial map={checkerTex(3)} toneMapped={false} />
            </mesh>
          ))}
          {[-0.5, -0.25, 0, 0.25, 0.5].map((x) => (
            <mesh key={x} position={[x, 1.62, 0.09]}><sphereGeometry args={[0.05, 8, 6]} />{bulb}</mesh>
          ))}
          <mesh position={[0, LAYER.lot + 0.01, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[1.5, 0.22]} />
            <meshStandardMaterial color="#fafafa" transparent={ghost} opacity={ghost ? 0.55 : 1} {...decal()} />
          </mesh>
          {!ghost && <Pool r={0.9} z={0.3} />}
        </group>
      )
    case 'playground':
      return (
        <group>
          <mesh position={[0, 0.03, 0]} receiveShadow><cylinderGeometry args={[1.85, 1.85, 0.06, 28]} />{m('#d7b77b')}</mesh>
          <mesh position={[0, 0.065, 0]}><cylinderGeometry args={[1.6, 1.6, 0.02, 28]} />{m('#ef9a9a')}</mesh>
          {/* Slide tower: one piece, kept in shape on a merged pair. */}
          <group position={[-0.8, 0, -0.6]}>
            <Upright>
              {[[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.55, z]} s={[0.06, 1.1, 0.06]} c="#1e88e5" />)}
              <Box m={m} at={[0, 0.7, 0]} s={[0.6, 0.06, 0.6]} c="#fdd835" />
              <mesh position={[0, 1.25, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.48, 0.35, 4]} />{m('#e53935')}</mesh>
              <Box m={m} at={[0.62, 0.38, 0]} rot={[0, 0, -0.62]} s={[0.85, 0.04, 0.32]} c="#43a047" />
              {[-0.16, 0.16].map((z) => <Box key={z} m={m} at={[0.62, 0.44, z]} rot={[0, 0, -0.62]} s={[0.85, 0.08, 0.02]} c="#43a047" />)}
              {[0.15, 0.32, 0.49].map((y) => <Box key={y} m={m} at={[0, y, -0.3]} s={[0.4, 0.03, 0.03]} c="#fafafa" />)}
            </Upright>
          </group>
          {/* Swing set. */}
          <group position={[0.65, 0, -0.55]}>
            {[-0.55, 0.55].map((x) => [-1, 1].map((sd) => (
              <Box key={`${x}${sd}`} m={m} at={[x, 0.55, sd * 0.2]} rot={[sd * 0.35, 0, 0]} s={[0.05, 1.15, 0.05]} c="#ff7043" />
            )))}
            <Box m={m} at={[0, 1.08, 0]} s={[1.2, 0.05, 0.05]} c="#ff7043" />
            {[-0.22, 0.22].map((x) => (
              <group key={x}>
                {[-0.08, 0.08].map((dx) => <Box key={dx} m={m} at={[x + dx, 0.72, 0]} s={[0.012, 0.72, 0.012]} c="#9e9e9e" shadow={false} />)}
                <Box m={m} at={[x, 0.35, 0]} s={[0.22, 0.03, 0.1]} c="#212121" />
              </group>
            ))}
          </group>
          {/* Seesaw and a merry-go-round. */}
          <group position={[0.6, 0, 0.75]} rotation-y={0.3}>
            <Box m={m} at={[0, 0.1, 0]} s={[0.12, 0.2, 0.12]} c="#757575" />
            <Box m={m} at={[0, 0.24, 0]} rot={[0, 0, 0.18]} s={[1.1, 0.04, 0.12]} c="#8e24aa" />
          </group>
          <group position={[-0.65, 0, 0.7]}>
            <Cyl m={m} at={[0, 0.06, 0]} r={0.09} h={0.12} c="#757575" seg={10} />
            <mesh position={[0, 0.14, 0]} castShadow><cylinderGeometry args={[0.42, 0.42, 0.06, 16]} />{m('#fdd835')}</mesh>
            <Cyl m={m} at={[0, 0.3, 0]} r={0.025} h={0.3} c="#e53935" seg={6} />
            {[0, 1, 2, 3].map((i) => (
              <Box key={i} m={m} at={[0, 0.42, 0]} rot={[0, (i * Math.PI) / 4, 0]} s={[0.74, 0.025, 0.025]} c="#e53935" shadow={false} />
            ))}
          </group>
          {!ghost && [[1.55, 1.1], [-1.5, -1.2], [1.4, -1.35]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.28, z]} castShadow><icosahedronGeometry args={[0.28, 0]} /><meshStandardMaterial color={PAL.bush[i % 2]} flatShading /></mesh>
          ))}
        </group>
      )
    case 'gazebo': {
      const posts = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + Math.PI / 6)
      return (
        <group>
          <mesh position={[0, 0.08, 0]} castShadow receiveShadow><cylinderGeometry args={[0.85, 0.88, 0.16, 6]} />{m('#d7ccc8')}</mesh>
          {posts.map((a) => (
            <Box key={a} m={m} at={[Math.sin(a) * 0.72, 0.75, Math.cos(a) * 0.72]} s={[0.07, 1.2, 0.07]} c="#fafafa" />
          ))}
          {/* Railings on every side but the front. */}
          {posts.map((a, i) => {
            const b = a + Math.PI / 3
            const mid = (a + b) / 2
            if (i === 5) return null
            return <Box key={a} m={m} at={[Math.sin(mid) * 0.62, 0.42, Math.cos(mid) * 0.62]} rot={[0, mid, 0]} s={[0.7, 0.05, 0.04]} c="#fafafa" />
          })}
          <mesh position={[0, 1.42, 0]} rotation-y={Math.PI / 6}><cylinderGeometry args={[0.92, 0.92, 0.1, 6]} />{m('#fafafa')}</mesh>
          <mesh position={[0, 1.76, 0]} rotation-y={Math.PI / 6} castShadow><coneGeometry args={[0.98, 0.6, 6]} />{m(SNOW ? '#f4f8fb' : '#2e7d32', shingleTex(2, 1))}</mesh>
          <mesh position={[0, 2.12, 0]}><sphereGeometry args={[0.07, 8, 6]} />{m(GOLD)}</mesh>
          <mesh position={[0, 1.36, 0]} rotation-x={Math.PI / 2}><circleGeometry args={[0.2, 10]} />{bulb}</mesh>
          {!ghost && <Pool r={0.9} />}
        </group>
      )
    }
    case 'clocktower': {
      const th = 2.6
      return (
        <group>
          <Box m={m} at={[0, 0.06, 0]} s={[1.3, 0.12, 1.3]} c="#cfd8dc" shadow={false} />
          <Box m={m} at={[0, 0.17, 0]} s={[1.1, 0.1, 1.1]} c="#cfd8dc" />
          <Box m={m} at={[0, th / 2, 0]} s={[0.8, th, 0.8]} c="#b0796b" t={brickTex(1, 3)} />
          <Box m={m} at={[0, th + 0.05, 0]} s={[0.92, 0.1, 0.92]} c="#eceff1" />
          {/* A clock on all four faces, stopped at ten past ten like the ads. */}
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation-y={(i * Math.PI) / 2}>
              <group position={[0, th - 0.42, 0.405]}>
                <mesh><circleGeometry args={[0.3, 20]} />{m('#5d4037')}</mesh>
                <mesh position={[0, 0, 0.004]}><circleGeometry args={[0.26, 20]} />{bulb}</mesh>
                <Box m={m} at={[-0.06, 0.04, 0.012]} rot={[0, 0, 0.95]} s={[0.025, 0.16, 0.01]} c="#212121" shadow={false} />
                <Box m={m} at={[0.08, 0.05, 0.014]} rot={[0, 0, -1.0]} s={[0.02, 0.22, 0.01]} c="#212121" shadow={false} />
              </group>
              <mesh position={[0, 0.9, 0.405]}><planeGeometry args={[0.24, 0.42]} />{win}</mesh>
            </group>
          ))}
          <mesh position={[0, th + 0.42, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.66, 0.64, 4]} />{m(SNOW ? '#f4f8fb' : '#37474f')}</mesh>
          <Cyl m={m} at={[0, th + 0.86, 0]} r={0.012} h={0.26} c={GOLD} seg={6} />
          {!ghost && <Pool r={1} z={0.3} />}
        </group>
      )
    }
  }
  return null
}
