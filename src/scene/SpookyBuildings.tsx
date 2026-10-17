import type { ReactNode } from 'react'
import { AdditiveBlending, CanvasTexture, Color, Euler, MeshBasicMaterial, MeshStandardMaterial, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3, type Material, type Texture } from 'three'
import { levelLift } from '../game/data'
import { growthStage } from '../game/growth'
import { Box, Cyl, Sign, Flag, GOLD, type Mat, type NewModelProps, type V3 } from './NewBuildings'
import { Facade, Upright } from './mergeScale'
import { onNight } from './dayNight'
import { decal } from './layers'
import { doorTag } from './doors'
import { brickTex, dirtTex, glowTex, shingleTex, sidingTex, windowGlowTex, windowTex } from './textures'

// More Spooky Season buildings (haunted manor, corn maze, cauldron, jack-o'-lantern lamp).
// Lots face +z (the front door side), like the rest of the town.

export const SPOOKY_MODELS = new Set(['haunted', 'cornmaze', 'cauldron', 'jacklamp'])

// ---- Spooky glows: carved pumpkin faces, flames, witch's brew, windows lit
// orange or green after dark and coloured light on the ground. One material
// each, kept by identity so Batch merges every pumpkin face into one draw.
type Glow = 'ember' | 'flame' | 'brew' | 'winAmber' | 'winGreen' | 'poolAmber' | 'poolGreen'
let glows: Record<Glow, Material> | null = null
function spookyGlows() {
  if (glows) return glows
  const lit = (color: string, glow: string) => new MeshStandardMaterial({ color, emissive: new Color(glow), emissiveIntensity: 0.2, toneMapped: false })
  const pane = (glow: string) => new MeshStandardMaterial({ color: '#958cb4', map: windowTex(), emissiveMap: windowGlowTex(), emissive: new Color(glow), emissiveIntensity: 0 })
  const pool = (c: string) => new MeshBasicMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false, ...decal() })
  const g = { ember: lit('#3a1600', '#ff8a00'), flame: lit('#ff9800', '#ff6d00'), brew: lit('#64dd17', '#76ff03'), winAmber: pane('#ff9100'), winGreen: pane('#7cff3a'), poolAmber: pool('#ff9a3c'), poolGreen: pool('#8cff5a') }
  for (const x of Object.values(g)) x.userData.live = true
  onNight((n) => {
    g.ember.emissiveIntensity = 0.12 + n * 2.6
    g.flame.emissiveIntensity = 0.7 + n * 1.6
    g.brew.emissiveIntensity = 0.45 + n * 1.5
    g.winAmber.emissiveIntensity = n * 1.7
    g.winGreen.emissiveIntensity = n * 1.5
    g.poolAmber.opacity = n * 0.8
    g.poolGreen.opacity = n * 0.7
    g.poolAmber.visible = g.poolAmber.opacity > 0.01
    g.poolGreen.visible = g.poolGreen.opacity > 0.01
  })
  glows = g
  return g
}
type Gl = (k: Glow, c: string, t?: Texture) => ReactNode

// Rows of corn stalks with leaves, for the maze walls.
let cornBase: CanvasTexture | null = null
const cornTiles = new Map<string, Texture>()
function cornTex(rx: number, ry: number) {
  const k = `${rx}|${ry}`
  const hit = cornTiles.get(k)
  if (hit) return hit
  if (!cornBase) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    g.fillStyle = '#7d8a2a'
    g.fillRect(0, 0, 64, 64)
    for (let x = 0; x < 64; x += 8) {
      g.fillStyle = '#a7a83c'
      g.fillRect(x + 2, 0, 3, 64)
      g.fillStyle = '#5d6e1e'
      g.fillRect(x + 5, 0, 1, 64)
    }
    g.fillStyle = '#9bb53a'
    for (let i = 0; i < 24; i++) {
      const x = (i * 23) % 64, y = (i * 37) % 64
      g.save()
      g.translate(x, y)
      g.rotate(i % 2 ? 0.7 : -0.7)
      g.fillRect(0, 0, 12, 2)
      g.restore()
    }
    g.fillStyle = '#e0b84a'
    for (let i = 0; i < 6; i++) g.fillRect((i * 29) % 60, (i * 41) % 56, 3, 7)
    cornBase = new CanvasTexture(c)
    cornBase.colorSpace = SRGBColorSpace
    cornBase.wrapS = cornBase.wrapT = RepeatWrapping
  }
  const t = cornBase.clone()
  t.repeat.set(rx, ry)
  t.needsUpdate = true
  cornTiles.set(k, t)
  return t
}

const AIR = { air: true }

// A many-sided drum with a flat face towards +z (and every 2pi/seg round from it).
function Drum({ m, at, r, r2 = r, h, c, seg = 8, t }: { m: Mat; at: V3; r: number; r2?: number; h: number; c: string; seg?: number; t?: Texture }) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2, h, seg, 1, false, Math.PI / seg]} />
      {m(c, t)}
    </mesh>
  )
}

// A pitched roof with its ridge along x, from y=0 up: the gable ends in the
// wall's colour, shingled slabs reaching `over` past the eaves and a ridge cap.
function Gable({ m, len, hw, rise, over = 0.08, wall, wallTex, roof, ridge = '#1e1726' }: { m: Mat; len: number; hw: number; rise: number; over?: number; wall: string; wallTex?: Texture; roof: string; ridge?: string }) {
  const s = Math.hypot(hw, rise)
  const a = Math.atan2(rise, hw)
  const t = 0.06
  const cz = hw / 2 + (over / 2) * Math.cos(a) + (t / 2) * Math.sin(a)
  const cy = rise / 2 - (over / 2) * Math.sin(a) + (t / 2) * Math.cos(a)
  const tex = shingleTex(Math.max(1, Math.round(len * 1.5)), Math.max(1, Math.round(s * 2)))
  return (
    <group>
      <group scale={[1, rise / 1.5, hw / 0.866]}>
        <mesh position={[0, 0.5, 0]} rotation-z={-Math.PI / 2} castShadow receiveShadow>
          <cylinderGeometry args={[1, 1, len, 3, 1, false, -Math.PI / 2]} />
          {m(wall, wallTex)}
        </mesh>
      </group>
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[0, cy, sd * cz]} rot={[sd * a, 0, 0]} s={[len + 2 * over, t, s + over]} c={roof} t={tex} />)}
      <Box m={m} at={[0, rise + 0.035, 0]} s={[len + 2 * over, 0.05, 0.08]} c={ridge} />
    </group>
  )
}

// Where a point (x, y) on the front of a pumpkin of radius 1 (squashed to 0.75 tall) lies, lifted
// a little off it, and the turn that lays a flat piece on the skin there.
function onSkin(x: number, y: number): [V3, V3] {
  const z = Math.sqrt(1 - x * x - (y / 0.75) ** 2)
  const n = new Vector3(x, y / 0.5625, z).normalize()
  const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n))
  return [[x + n.x * 0.025, y + n.y * 0.025, z + n.z * 0.025], [e.x, e.y, e.z]]
}
const EYES = [-1, 1].map((sd) => onSkin(sd * 0.32, 0.16))

function JackO({ m, gl, at, r, face = true, rot = 0, c = '#ef6c00' }: { m: Mat; gl: Gl; at: V3; r: number; face?: boolean; rot?: number; c?: string }) {
  const cy = r * 0.75
  return (
    <group position={at} rotation-y={rot}>
      <mesh position={[0, cy, 0]} scale={[1, 0.75, 1]} castShadow><sphereGeometry args={[r, 12, 8]} />{m(c)}</mesh>
      <Cyl m={m} at={[0, cy * 2 + r * 0.1, 0]} r={r * 0.1} r2={r * 0.14} h={r * 0.36} c="#33691e" seg={5} />
      {face && (
        <group position={[0, cy, 0]}>
          {/* Eyes laid on the skin, and the grin a strip of the skin itself, so nothing stands off the curve. */}
          {EYES.map(([p, e], i) => (
            <group key={i} position={[p[0] * r, p[1] * r, p[2] * r]} rotation={e}>
              <mesh rotation-z={Math.PI}><circleGeometry args={[r * 0.17, 3]} />{gl('ember', '#3a1600')}</mesh>
            </group>
          ))}
          <mesh scale={[1, 0.75, 1]}><sphereGeometry args={[r * 1.012, 10, 3, Math.PI / 2 - 0.5, 1.0, 1.72, 0.28]} />{gl('ember', '#3a1600')}</mesh>
        </group>
      )}
    </group>
  )
}

function Bat({ m, at, rot = 0, s = 1 }: { m: Mat; at: V3; rot?: number; s?: number }) {
  return (
    <group position={at} rotation-y={rot} scale={s} userData={AIR}>
      <mesh scale={[1, 0.85, 1.3]}><sphereGeometry args={[0.05, 6, 5]} />{m('#1b1420')}</mesh>
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Box m={m} at={[sd * 0.11, 0.025, 0]} rot={[0, 0, sd * 0.35]} s={[0.16, 0.012, 0.1]} c="#1b1420" shadow={false} />
          <mesh position={[sd * 0.025, 0.05, 0.03]}><coneGeometry args={[0.015, 0.04, 4]} />{m('#1b1420')}</mesh>
        </group>
      ))}
    </group>
  )
}

// Pool of coloured light lying on the ground at `y`.
function Glowpool({ gl, r, x = 0, z = 0, y, k }: { gl: Gl; r: number; x?: number; z?: number; y: number; k: 'poolAmber' | 'poolGreen' }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]} renderOrder={2}>
      <planeGeometry args={[r * 2, r * 2]} />
      {gl(k, '#000000')}
    </mesh>
  )
}

function Tombstone({ m, at, h = 0.26, tilt = 0 }: { m: Mat; at: V3; h?: number; tilt?: number }) {
  return (
    <group position={at} rotation-z={tilt}>
      <Box m={m} at={[0, h / 2, 0]} s={[0.18, h, 0.06]} c="#9e9e9e" />
      <mesh position={[0, h, 0]} rotation-x={Math.PI / 2} castShadow><cylinderGeometry args={[0.09, 0.09, 0.06, 10, 1, false, -Math.PI / 2, Math.PI]} />{m('#9e9e9e')}</mesh>
      <Box m={m} at={[0, h * 0.7, 0.032]} s={[0.09, 0.02, 0.006]} c="#616161" shadow={false} />
    </group>
  )
}

// ---- The Haunted Manor ----
// A crooked two-storey Victorian house with a witch-hat tower, behind an iron
// fence. Grows into the Haunted Mansion (level 4: a third floor, a turret, a
// widow's walk and a graveyard) and then the Haunted Castle (level 7: stone
// walls, battlements, a gatehouse and two round towers).
const G0 = 0.05
const FH = 0.72
const HX = -0.25, HW = 2.9, HZ = -0.42, HD = 1.0
const HF = HZ + HD / 2
const TX = 1.2, TZ = -0.12
const TRIM = '#2a2033'

function Window({ m, pane, x, y, shutters, broken, frame = TRIM, tall = 0 }: { m: Mat; pane: ReactNode; x: number; y: number; shutters?: string; broken?: boolean; frame?: string; tall?: number }) {
  return (
    <group position={[x, y, 0]}>
      <Box m={m} at={[0, tall / 2, 0.015]} s={[0.3, 0.46 + tall, 0.03]} c={frame} shadow={false} />
      <mesh position={[0, tall / 2 - 0.01, 0.034]}><planeGeometry args={[0.22, 0.38 + tall]} />{pane}</mesh>
      <Box m={m} at={[0, 0.27 + tall, 0.01]} rot={[0, 0, Math.PI / 4]} s={[0.17, 0.17, 0.02]} c={frame} shadow={false} />
      <Box m={m} at={[0, -0.25, 0.04]} s={[0.36, 0.035, 0.08]} c={frame} shadow={false} />
      {shutters && <Box m={m} at={[-0.21, tall / 2, 0.01]} s={[0.1, 0.42 + tall, 0.02]} c={shutters} shadow={false} />}
      {shutters && (broken
        ? <Box m={m} at={[0.24, -0.04, 0.012]} rot={[0, 0, 0.42]} s={[0.1, 0.42, 0.02]} c={shutters} shadow={false} />
        : <Box m={m} at={[0.21, tall / 2, 0.01]} s={[0.1, 0.42 + tall, 0.02]} c={shutters} shadow={false} />)}
    </group>
  )
}

// A narrow window on a tower face.
function SlitWindow({ m, pane, y, frame = TRIM }: { m: Mat; pane: ReactNode; y: number; frame?: string }) {
  return (
    <group position={[0, y, 0]}>
      <Box m={m} at={[0, 0, 0.015]} s={[0.2, 0.36, 0.03]} c={frame} shadow={false} />
      <mesh position={[0, -0.01, 0.034]}><planeGeometry args={[0.13, 0.28]} />{pane}</mesh>
      <Box m={m} at={[0, 0.2, 0.01]} rot={[0, 0, Math.PI / 4]} s={[0.12, 0.12, 0.02]} c={frame} shadow={false} />
    </group>
  )
}

function Haunted({ ghost, m, lvl, gl, bulb }: { ghost?: boolean; m: Mat; lvl: number; gl: Gl; bulb: ReactNode }) {
  const st = growthStage(lvl)
  const lift = levelLift(lvl)
  const castle = st === 3
  const floors = st === 1 ? 2 : 3
  const H = G0 + floors * FH + 0.16 + (castle ? 0.08 + (lvl - 7) * 0.16 : 0)
  const wall = castle ? '#7a7388' : '#7a6a90'
  const wallTex = castle ? brickTex(3, Math.max(2, Math.round(H * 1.5))) : sidingTex(3, Math.max(2, Math.round(H * 1.6)))
  const shutter = '#3b2a4f'
  const amber = gl('winAmber', '#b8b0d0', windowTex())
  const green = gl('winGreen', '#b8b0d0', windowTex())
  const paneAt = (i: number) => ((i * 7 + 3) % 3 === 0 ? green : amber)
  // Tower sizes. The castle's round tower sits back on the end wall, taking in its back corner.
  const tz = castle ? -0.4 : TZ
  const TR = castle ? 0.55 : st === 2 ? 0.48 : 0.45
  const tSeg = castle ? 12 : 8
  const th = castle ? H + 1.1 : H + 0.95 + (lift - (st === 2 ? 0.78 : 0)) * 0.5
  const coneH = castle ? 1.3 : 1.05
  const coneR = castle ? 0.5 : TR + 0.11
  const tWall = castle ? '#6e6880' : '#5d4f73'
  const tTex = castle ? brickTex(2, Math.max(2, Math.round(th * 1.5))) : sidingTex(2, Math.max(2, Math.round(th * 1.6)))
  const hat = castle ? '#4a2a6a' : '#33284a'
  // Left turret (mansion and castle).
  const LX = -1.63, LZ = castle ? -0.1 : -0.06
  const LR = castle ? 0.35 : 0.32
  const lth = H + (castle ? 0.6 : 0.45)
  const lSeg = castle ? 12 : 8
  const winYs = (top: number) => Array.from({ length: 8 }, (_, i) => G0 + 0.42 + i * FH).filter((y) => y + 0.3 < top)
  const tilt = castle ? 0 : 0.06

  // The front wall, laid out in bays: a pair gets more windows.
  const front = (L: number) => {
    // Clear of the towers at either end and of the gatehouse.
    const rp = 0.45
    const lp = st >= 2 ? 0.55 : 0.04
    const half = castle ? 0.19 : 0.27
    const ok = (x: number) => x - half > -L / 2 + lp && x + half < L / 2 - rp && (!castle || Math.abs(x) - half > 0.42)
    const ground = [-1, 1].flatMap((sd) => [0.7, 1.32, 1.94, 2.56].map((x) => sd * x)).filter(ok)
    const upper = Array.from({ length: 11 }, (_, i) => (i - 5) * 0.62).filter(ok)
    const fr = castle ? '#8f88a0' : TRIM
    return (
      <group>
        {ground.map((x, i) => <Window key={`g${x}`} m={m} pane={paneAt(i)} x={x} y={G0 + 0.42} frame={fr} shutters={castle ? undefined : shutter} broken={i % 3 === 1} />)}
        {Array.from({ length: floors - 1 }, (_, f) => upper.map((x, i) => (
          <Window key={`u${f}${x}`} m={m} pane={paneAt(i + f * 2 + 1)} x={x} y={G0 + (f + 1) * FH + 0.42} frame={fr} shutters={castle ? undefined : shutter} broken={(i + f) % 4 === 2} tall={castle ? 0.06 : 0} />
        )))}
        {lvl >= 3 && <Box m={m} at={[0, H - 0.04, 0.025]} s={[L + 0.03, 0.06, 0.05]} c={castle ? '#9a93aa' : '#d7ccc8'} shadow={false} />}
        {!castle && (
          <group>
            {/* The porch: a low deck up a step, two posts and a sagging roof over the double door. */}
            <Box m={m} at={[0, G0 + 0.0325, 0.21]} s={[0.84, 0.065, 0.42]} c="#3e2f2a" />
            <Box m={m} at={[0, G0 + 0.015, 0.49]} s={[0.5, 0.03, 0.14]} c="#4e3b30" />
            {[-0.38, 0.38].map((x) => <Cyl key={x} m={m} at={[x, (G0 + 0.065 + 0.86) / 2, 0.38]} r={0.028} h={0.86 - G0 - 0.065} c="#d7ccc8" seg={6} />)}
            <Box m={m} at={[0, 0.885, 0.22]} rot={[0.12, 0, 0]} s={[0.94, 0.05, 0.5]} c="#2f2540" />
            <Box m={m} at={[0, G0 + 0.395, 0.015]} s={[0.4, 0.66, 0.03]} c={TRIM} shadow={false} />
            <mesh position={[0, G0 + 0.315, 0.034]} userData={doorTag('double')}><planeGeometry args={[0.32, 0.5]} />{m('#4a1414')}</mesh>
            <mesh position={[0, G0 + 0.575, 0.034]}><circleGeometry args={[0.14, 10, 0, Math.PI]} />{amber}</mesh>
            <Box m={m} at={[0, G0 + 0.315, 0.0355]} s={[0.012, 0.5, 0.003]} c="#2a0a0a" shadow={false} />
            {[-0.27, 0.27].map((x) => <mesh key={x} position={[x, G0 + 0.545, 0.05]}><boxGeometry args={[0.06, 0.09, 0.06]} />{bulb}</mesh>)}
            {/* A cross gable over the porch with a round attic window. */}
            <group position={[0, H, -0.29]} rotation-y={Math.PI / 2}>
              <Gable m={m} len={0.62} hw={0.38} rise={0.5} over={0.05} wall={wall} wallTex={sidingTex(1, 1)} roof="#2f2540" />
            </group>
            <mesh position={[0, H + 0.17, 0.023]}><circleGeometry args={[0.13, 14]} />{m(TRIM)}</mesh>
            <mesh position={[0, H + 0.17, 0.027]}><circleGeometry args={[0.1, 14]} />{green}</mesh>
            {!ghost && [-0.34, 0.34].map((x, i) => <JackO key={x} m={m} gl={gl} at={[x, G0, 0.5]} r={i ? 0.09 : 0.11} />)}
            {!ghost && st === 2 && (
              // A sheet ghost hanging from the porch roof.
              <group position={[0.265, 0, 0.3]}>
                <Cyl m={m} at={[0, 0.81, 0]} r={0.004} h={0.08} c="#212121" seg={4} />
                <mesh position={[0, 0.7, 0]}><sphereGeometry args={[0.07, 10, 8]} />{m('#f5f5f5')}</mesh>
                <mesh position={[0, 0.6, 0]}><coneGeometry args={[0.1, 0.2, 10]} />{m('#f5f5f5')}</mesh>
                {[-0.025, 0.025].map((x) => <Box key={x} m={m} at={[x, 0.71, 0.064]} s={[0.016, 0.024, 0.01]} c="#212121" shadow={false} />)}
              </group>
            )}
          </group>
        )}
        {castle && (
          <group>
            {/* The gatehouse: a pointed gate under a portcullis, a rose window and banners. */}
            <Box m={m} at={[0, (H + 0.45) / 2, 0.135]} s={[0.84, H + 0.45, 0.37]} c={wall} t={brickTex(1, Math.max(2, Math.round(H * 1.5)))} />
            {[-0.31, 0, 0.31].map((x) => <Box key={x} m={m} at={[x, H + 0.53, 0.16]} s={[0.18, 0.16, 0.32]} c={wall} />)}
            <Box m={m} at={[0, 0.3, 0.325]} s={[0.56, 0.6, 0.01]} c="#8f88a0" shadow={false} />
            <mesh position={[0, 0.6, 0.326]}><circleGeometry args={[0.28, 12, 0, Math.PI]} />{m('#8f88a0')}</mesh>
            <mesh position={[0, 0.3, 0.332]} userData={doorTag('double')}><planeGeometry args={[0.44, 0.6]} />{m('#1a1220')}</mesh>
            <mesh position={[0, 0.6, 0.333]}><circleGeometry args={[0.22, 12, 0, Math.PI]} />{m('#1a1220')}</mesh>
            {[-0.15, -0.05, 0.05, 0.15].map((x) => <Box key={x} m={m} at={[x, 0.36, 0.337]} s={[0.022, 0.62, 0.006]} c="#3d3d3d" shadow={false} />)}
            {[0.3, 0.55].map((y) => <Box key={y} m={m} at={[0, y, 0.343]} s={[0.4, 0.022, 0.006]} c="#3d3d3d" shadow={false} />)}
            <mesh position={[0, 1.32, 0.322]}><circleGeometry args={[0.19, 16]} />{m('#8f88a0')}</mesh>
            <mesh position={[0, 1.32, 0.327]}><circleGeometry args={[0.15, 16]} />{green}</mesh>
            {[-0.33, 0.33].map((x) => (
              <group key={x}>
                <Box m={m} at={[x, 1.2, 0.326]} s={[0.16, 0.5, 0.012]} c="#5e2a84" shadow={false} />
                <Box m={m} at={[x, 1.2, 0.334]} s={[0.05, 0.46, 0.006]} c="#ff6d00" shadow={false} />
                <Cyl m={m} at={[x, 0.7, 0.36]} r={0.025} r2={0.015} h={0.1} c="#3d3d3d" seg={6} />
                <mesh position={[x, 0.79, 0.36]}><coneGeometry args={[0.04, 0.09, 6]} />{gl('flame', '#ff9800')}</mesh>
              </group>
            ))}
            <Box m={m} at={[0, G0 + 0.025, 0.42]} s={[0.62, 0.05, 0.2]} c="#8f88a0" />
            {/* Battlements along the front wall. */}
            <Box m={m} at={[0, H + 0.05, -0.05]} s={[L, 0.1, 0.1]} c={wall} />
            {Array.from({ length: Math.floor(L / 0.32) }, (_, i) => -L / 2 + 0.16 + i * 0.32).filter((x) => Math.abs(x) > 0.55 && x + 0.08 < L / 2 - 0.45 && x - 0.08 > -L / 2 + 0.55).map((x) => (
              <Box key={x} m={m} at={[x, H + 0.17, -0.05]} s={[0.16, 0.14, 0.1]} c={wall} />
            ))}
          </group>
        )}
      </group>
    )
  }

  // The iron fence along the front, with a gate under the HAUNTED arch.
  const fence = (L: number) => {
    const gx = (HX * L) / 4
    const xs: number[] = []
    for (let x = -L / 2 + 0.12; x < L / 2 - 0.08; x += 0.2) if (Math.abs(x - gx) > 0.68) xs.push(x)
    const runs: [number, number][] = [[-L / 2 + 0.06, gx - 0.55], [gx + 0.55, L / 2 - 0.06]]
    return (
      <group>
        {xs.map((x) => (
          <group key={x}>
            <Box m={m} at={[x, G0 + 0.25, 0]} s={[0.026, 0.5, 0.026]} c="#1d1a22" shadow={false} />
            <mesh position={[x, G0 + 0.53, 0]}><coneGeometry args={[0.03, 0.07, 4]} />{m('#1d1a22')}</mesh>
          </group>
        ))}
        {runs.map(([a, b]) => [0.15, 0.45].map((y) => <Box key={`${a}${y}`} m={m} at={[(a + b) / 2, G0 + y, 0]} s={[b - a, 0.025, 0.016]} c="#1d1a22" shadow={false} />))}
        {[-L / 2 + 0.06, L / 2 - 0.06].map((x) => <Box key={x} m={m} at={[x, G0 + 0.3, 0]} s={[0.06, 0.6, 0.06]} c="#1d1a22" shadow={false} />)}
        {lvl >= 5 && xs.filter((x, i) => i % 2 === 0 && x + 0.13 < L / 2 - 0.09 && Math.abs(x + 0.1 - gx) > 0.6).map((x) => (
          <mesh key={`b${x}`} position={[x + 0.1, G0 + 0.4625 + 0.03, 0]}><sphereGeometry args={[0.03, 6, 5]} />{gl('flame', '#ff9800')}</mesh>
        ))}
        {/* Stone gate pillars with a jack-o'-lantern each, the gates swung open. */}
        {[-1, 1].map((sd) => (
          <group key={sd} position={[gx + sd * 0.5, 0, 0]}>
            <Box m={m} at={[0, G0 + 0.3, 0]} s={[0.16, 0.6, 0.16]} c="#6e6878" />
            <Box m={m} at={[0, G0 + 0.62, 0]} s={[0.2, 0.04, 0.2]} c="#8f88a0" />
            {!ghost && <JackO m={m} gl={gl} at={[0, G0 + 0.64, 0]} r={0.085} />}
            <group position={[-sd * 0.08, 0, 0]} rotation-y={-sd * 1.15}>
              <Box m={m} at={[-sd * 0.15, G0 + 0.3, 0]} s={[0.3, 0.42, 0.016]} c="#1d1a22" shadow={false} />
            </group>
          </group>
        ))}
        <group position={[gx, 0, 0]}>
          {[-0.4, 0.4].map((x) => <Cyl key={x} m={m} at={[x, (G0 + 0.9) / 2, -0.05]} r={0.02} h={0.9 - G0} c="#1d1a22" seg={6} />)}
          <Box m={m} at={[0, 1.02, -0.06]} s={[0.98, 0.29, 0.04]} c="#1d1a22" shadow={false} />
          <Sign text="HAUNTED" w={0.92} at={[0, 1.02, -0.035]} bg="#1a1023" fg="#ff6d00" />
          <Bat m={m} at={[0.42, 1.21, -0.06]} s={0.8} />
        </group>
      </group>
    )
  }

  // A tower: octagonal clapboard with a crooked witch's hat, or round stone with battlements.
  const tower = (x: number, z: number, R: number, top: number, seg: number, cR: number, cH: number, flag: boolean) => {
    const a = R * Math.cos(Math.PI / seg)
    const faces = seg === 12 ? [0, Math.PI / 6, Math.PI / 2] : [0, Math.PI / 2]
    return (
      // Placed first and kept upright there, so a merged pair's tower stands at the end of the longer house.
      <group position={[x, 0, z]}>
        <Upright>
          <Drum m={m} at={[0, top / 2, 0]} r={R} h={top} c={tWall} t={tTex} seg={seg} />
          <Drum m={m} at={[0, 0.09, 0]} r={R + 0.025} h={0.18} c="#55505a" seg={seg} />
          {!castle && Array.from({ length: Math.floor((top - G0) / FH) }, (_, i) => G0 + (i + 1) * FH).filter((y) => y < top - 0.2).map((y) => (
            <Drum key={y} m={m} at={[0, y, 0]} r={R + 0.015} h={0.04} c={TRIM} seg={seg} />
          ))}
          {faces.map((f) => winYs(top).map((y, i) => (
            <group key={`${f}${y}`} position={[Math.sin(f) * a, 0, Math.cos(f) * a]} rotation-y={f}>
              <SlitWindow m={m} pane={paneAt(i + Math.round(f * 3))} y={y} frame={castle ? '#8f88a0' : TRIM} />
            </group>
          )))}
          <Drum m={m} at={[0, top + 0.04, 0]} r={R + 0.06} h={0.08} c={castle ? '#8f88a0' : TRIM} seg={seg} />
          {lvl >= 9 && <Drum m={m} at={[0, top + 0.095, 0]} r={R + 0.065} h={0.03} c={GOLD} seg={seg} />}
          {castle && Array.from({ length: seg / 2 }, (_, i) => (i * 4 * Math.PI) / seg).map((f) => (
            <Box key={f} m={m} at={[Math.sin(f) * (R - 0.01), top + 0.15, Math.cos(f) * (R - 0.01)]} rot={[0, f, 0]} s={[0.16, 0.14, 0.1]} c={tWall} />
          ))}
          <group position={[0, top + 0.08, 0]} rotation-z={tilt}>
            <mesh position={[0, cH / 2, 0]} castShadow><coneGeometry args={[cR, cH, seg, 1, false, Math.PI / seg]} />{m(hat, shingleTex(2, 2))}</mesh>
            {flag && !ghost && lvl >= 8
              ? <Flag at={[0, cH - 0.08, 0]} color="#ff6d00" star={lvl >= 10} tall={0.6} />
              : (
                <group position={[0, cH - 0.02, 0]}>
                  <Cyl m={m} at={[0, 0.12, 0]} r={0.012} h={0.24} c="#1d1a22" seg={5} />
                  <mesh position={[0, 0.26, 0]}><sphereGeometry args={[0.03, 6, 5]} />{m('#1d1a22')}</mesh>
                </group>
              )}
          </group>
        </Upright>
      </group>
    )
  }

  return (
    <group>
      {/* A dead-grass yard and the flagstone path from the gate. */}
      <Box m={m} at={[0, G0 / 2, 0]} s={[3.9, G0, 1.9]} c="#8f8a5e" t={dirtTex(2, 1)} shadow={false} />
      {[0.62, 0.8].map((z) => <Box key={z} m={m} at={[HX, G0 + 0.006, z]} s={[0.34, 0.012, 0.14]} c="#8f88a0" shadow={false} />)}
      {/* The house. */}
      <Box m={m} at={[HX, H / 2, HZ]} s={[HW, H, HD]} c={wall} t={wallTex} />
      <Box m={m} at={[HX, 0.08, HZ]} s={[HW + 0.04, 0.16, HD + 0.04]} c="#55505a" />
      {!castle && Array.from({ length: floors - 1 }, (_, i) => G0 + (i + 1) * FH).map((y) => (
        <Box key={y} m={m} at={[HX, y, HZ]} s={[HW + 0.03, 0.05, HD + 0.03]} c={TRIM} />
      ))}
      <Facade at={[HX, 0, HF]} len={HW}>{front}</Facade>
      {!castle && (
        // The crooked roof, sagging to one side, with a leaning chimney.
        <group position={[HX, H, HZ]} rotation-z={-0.02}>
          <Gable m={m} len={HW + 0.012} hw={HD / 2 + 0.006} rise={0.62} wall={wall} wallTex={sidingTex(3, 1)} roof="#2f2540" />
          <Box m={m} at={[-0.95, 0.42, -0.22]} rot={[0, 0, 0.07]} s={[0.2, 0.62, 0.2]} c="#5d4037" t={brickTex(1, 1)} />
          <Box m={m} at={[-0.93, 0.74, -0.22]} rot={[0, 0, 0.07]} s={[0.26, 0.06, 0.26]} c="#3e2723" />
          {st === 2 && (
            // A widow's walk on the ridge.
            <group position={[0.35, 0.66, 0]}>
              <Box m={m} at={[0, 0.015, 0]} s={[0.56, 0.03, 0.28]} c={TRIM} />
              {[[-0.25, -0.11], [0.25, -0.11], [-0.25, 0.11], [0.25, 0.11]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.11, z]} s={[0.03, 0.18, 0.03]} c="#1d1a22" shadow={false} />)}
              {[-0.11, 0.11].map((z) => <Box key={z} m={m} at={[0, 0.19, z]} s={[0.53, 0.02, 0.02]} c="#1d1a22" shadow={false} />)}
            </group>
          )}
        </group>
      )}
      {castle && (
        <group>
          {/* Flat stone roof inside the battlements. */}
          <mesh position={[HX, H + 0.004, HZ]} rotation-x={-Math.PI / 2}><planeGeometry args={[HW - 0.02, HD - 0.02]} />{m('#5a5566')}</mesh>
          <Box m={m} at={[HX, H + 0.05, HZ - HD / 2 + 0.05]} s={[HW, 0.1, 0.1]} c={wall} />
          {/* The right end is inside the round tower. */}
          <Box m={m} at={[HX - (HW / 2 - 0.05), H + 0.05, HZ]} s={[0.1, 0.1, HD - 0.2]} c={wall} />
        </group>
      )}
      {tower(TX, tz, TR, th, tSeg, coneR, coneH, true)}
      {st >= 2 && tower(LX, LZ, LR, lth, lSeg, castle ? 0.36 : LR + 0.08, castle ? 1.0 : 0.8, false)}
      {/* Ticket booth by the gate. */}
      <group position={[-1.5, G0, 0.5]}>
        <Box m={m} at={[0, 0.25, 0]} s={[0.44, 0.5, 0.34]} c="#3b2a4a" />
        <mesh position={[0, 0.33, 0.174]}><planeGeometry args={[0.3, 0.2]} />{amber}</mesh>
        <Box m={m} at={[0, 0.215, 0.2]} s={[0.38, 0.03, 0.07]} c="#ff6d00" />
        <Box m={m} at={[0, 0.52, 0]} s={[0.5, 0.04, 0.4]} c="#1d1a22" />
        <mesh position={[0, 0.69, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.34, 0.3, 4]} />{m('#ff6d00')}</mesh>
      </group>
      <Facade at={[0, 0, 0.93]} len={4}>{fence}</Facade>
      {!ghost && (
        <group>
          <JackO m={m} gl={gl} at={[-1.05, G0, 0.66]} r={0.12} rot={0.3} />
          <JackO m={m} gl={gl} at={[-1.2, G0, 0.78]} r={0.08} face={false} c="#fb8c00" />
          {st >= 2 && <Tombstone m={m} at={[0.45, G0, 0.62]} />}
          {st >= 2 && <Tombstone m={m} at={[0.85, G0, 0.6]} h={0.2} tilt={0.12} />}
          {st >= 2 && (
            // A bare tree in the corner of the yard.
            <group position={[1.7, G0, 0.6]}>
              <Cyl m={m} at={[0, 0.4, 0]} r={0.045} r2={0.08} h={0.8} c="#3e2723" seg={6} />
              {[[0.6, 0.5, 0.3], [0.7, -0.6, 2.4], [0.78, 0.3, -1.4]].map(([y, lean, yaw], i) => (
                <group key={i} position={[0, y, 0]} rotation-y={yaw}>
                  <group rotation-z={lean}>
                    <Cyl m={m} at={[0, 0.16, 0]} r={0.012} r2={0.03} h={0.32} c="#3e2723" seg={4} />
                  </group>
                </group>
              ))}
            </group>
          )}
          <Bat m={m} at={[TX - 0.7, th + 0.5, tz + 0.35]} rot={0.4} />
          <Bat m={m} at={[TX + 0.15, th + 1.05, tz + 0.45]} rot={-0.5} s={0.8} />
          <Bat m={m} at={[HX - 0.6, H + 1.0, HZ + 0.4]} rot={0.9} s={0.9} />
          <Glowpool gl={gl} k="poolAmber" r={0.6} x={HX} z={0.62} y={G0 + 0.014} />
          <Glowpool gl={gl} k="poolGreen" r={0.55} x={TX} z={0.55} y={G0 + 0.018} />
        </group>
      )}
    </group>
  )
}

// ---- Corn maze: tall corn rows, a hay bale entrance and a scarecrow on a lookout ----
// Walls as [x0, x1, z0, z1] on a 4x4 lot.
const MAZE: [number, number, number, number][] = [
  [-1.8, -0.36, 1.55, 1.8], [0.36, 1.8, 1.55, 1.8],
  [-1.8, 0.95, -1.8, -1.55], [1.45, 1.8, -1.8, -1.55],
  [-1.8, -1.55, -1.55, 1.55], [1.55, 1.8, -1.55, 1.55],
  [-1.55, 0.965, 0.715, 0.965],
  [-0.965, 1.55, -0.965, -0.715],
  [0.715, 0.965, -0.715, 0.4],
  [-0.965, -0.715, -0.4, 0.715],
  [-1.55, -0.965, -0.125, 0.125],
  [-0.125, 0.125, -1.55, -0.965],
  [-0.85, -0.6, 0.965, 1.3],
  [0.965, 1.25, 0.05, 0.3],
]
const CORN_H = 0.78

function CornMaze({ ghost, m, gl, bulb }: { ghost?: boolean; m: Mat; gl: Gl; bulb: ReactNode }) {
  return (
    <group>
      <Box m={m} at={[0, 0.025, 0]} s={[3.9, 0.05, 3.9]} c="#c2a074" t={dirtTex(3, 3)} shadow={false} />
      {MAZE.map(([x0, x1, z0, z1], i) => {
        const w = x1 - x0, d = z1 - z0
        const len = Math.max(w, d)
        const n = Math.max(1, Math.round(len / 0.42))
        return (
          <group key={i}>
            <Box m={m} at={[(x0 + x1) / 2, 0.05 + (CORN_H - 0.12) / 2, (z0 + z1) / 2]} s={[w, CORN_H - 0.12, d]} c="#ffffff" t={cornTex(Math.max(1, Math.round(w * 2)), 1)} />
            <Box m={m} at={[(x0 + x1) / 2, 0.05 + CORN_H - 0.06, (z0 + z1) / 2]} s={[w - 0.04, 0.12, d - 0.04]} c="#c9b04a" />
            {Array.from({ length: n }, (_, k) => {
              const t = (k + 0.5) / n
              const x = w > d ? x0 + t * w : (x0 + x1) / 2 + (k % 2 ? 0.04 : -0.04)
              const z = w > d ? (z0 + z1) / 2 + (k % 2 ? 0.04 : -0.04) : z0 + t * d
              return <mesh key={k} position={[x, 0.05 + CORN_H + 0.06, z]}><coneGeometry args={[0.05, 0.14, 4]} />{m('#e8c25a')}</mesh>
            })}
          </group>
        )
      })}
      {/* The lookout in the middle, with a scarecrow keeping watch. */}
      <group position={[0, 0.05, 0]}>
        {[[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.55, z]} s={[0.06, 1.1, 0.06]} c="#6d4c41" />)}
        <Box m={m} at={[0, 0.9, 0]} s={[0.6, 0.05, 0.6]} c="#8d6e63" />
        {[-0.22, 0.22].map((z) => <Box key={`r${z}`} m={m} at={[0, 1.08, z]} s={[0.5, 0.03, 0.03]} c="#6d4c41" shadow={false} />)}
        <Box m={m} at={[-0.22, 1.08, 0]} s={[0.03, 0.03, 0.4]} c="#6d4c41" shadow={false} />
        {/* Ladder up the front. */}
        {[-0.1, 0.1].map((x) => <Box key={`l${x}`} m={m} at={[x, 0.45, 0.32]} rot={[-0.15, 0, 0]} s={[0.03, 0.92, 0.03]} c="#a1887f" shadow={false} />)}
        {[0.2, 0.4, 0.6, 0.8].map((y) => <Box key={`s${y}`} m={m} at={[0, y, 0.32 + (0.45 - y) * 0.151]} s={[0.2, 0.02, 0.025]} c="#a1887f" shadow={false} />)}
        {/* The scarecrow on the platform. */}
        <group position={[0.08, 0.925, -0.08]}>
          <Cyl m={m} at={[0, 0.35, 0]} r={0.025} h={0.7} c="#6d4c41" seg={6} />
          <Box m={m} at={[0, 0.52, 0]} s={[0.56, 0.04, 0.04]} c="#6d4c41" />
          <Box m={m} at={[0, 0.45, 0]} s={[0.22, 0.2, 0.12]} c="#c62828" />
          <Box m={m} at={[0, 0.3, 0]} s={[0.2, 0.12, 0.11]} c="#3f51b5" />
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.19, 0.52, 0]} s={[0.16, 0.07, 0.08]} c="#c62828" />)}
          <mesh position={[0, 0.63, 0]} castShadow><sphereGeometry args={[0.08, 10, 8]} />{m('#d7b98a')}</mesh>
          <Cyl m={m} at={[0, 0.7, 0]} r={0.15} h={0.02} c="#6d4c41" seg={10} />
          <mesh position={[0, 0.78, 0]}><coneGeometry args={[0.08, 0.16, 8]} />{m('#6d4c41')}</mesh>
          {[-0.03, 0.03].map((x) => <Box key={x} m={m} at={[x, 0.645, 0.075]} s={[0.02, 0.02, 0.012]} c="#212121" shadow={false} />)}
        </group>
        <Flag at={[0.22, 1.1, 0.22]} color="#ff6d00" tall={0.5} />
        {/* Lanterns on the lookout's corner posts. */}
        {[[-0.22, 0.22], [0.22, -0.22]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 1.14, z]}><boxGeometry args={[0.08, 0.08, 0.08]} />{bulb}</mesh>)}
      </group>
      {/* Hay bales and pumpkins either side of the way in, under the sign. */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Box m={m} at={[sd * 0.62, 0.05 + 0.12, 1.94]} s={[0.42, 0.24, 0.24]} c="#e0c068" />
          {sd < 0 && <Box m={m} at={[-0.66, 0.05 + 0.36, 1.94]} s={[0.36, 0.24, 0.22]} c="#d8b85c" />}
        </group>
      ))}
      {/* One piece, so a merged pair keeps the sign on its posts. */}
      <group>
        {[-0.4, 0.4].map((x) => <Cyl key={x} m={m} at={[x, 0.6, 1.6]} r={0.035} h={1.1} c="#6d4c41" seg={6} />)}
        <Box m={m} at={[0, 1.16, 1.66]} s={[0.92, 0.26, 0.04]} c="#6d4c41" shadow={false} />
        <Sign text="CORN MAZE" w={0.84} at={[0, 1.16, 1.686]} bg="#ffe082" fg="#6d4c41" />
      </group>
      {!ghost && <JackO m={m} gl={gl} at={[0.62, 0.29, 1.94]} r={0.1} />}
      {!ghost && <JackO m={m} gl={gl} at={[-0.25, 0.05, 1.96]} r={0.09} rot={0.4} />}
      {!ghost && <Glowpool gl={gl} k="poolAmber" r={0.8} y={0.064} />}
      {!ghost && <Glowpool gl={gl} k="poolAmber" r={0.6} z={1.75} y={0.062} />}
    </group>
  )
}

// ---- Witch's cauldron over a fire, with a broom and a spell book on a stump ----
function Cauldron({ ghost, m, gl }: { ghost?: boolean; m: Mat; gl: Gl }) {
  const R = 0.36, cy = 0.44, ys = 0.85
  const rimY = cy + R * Math.cos(0.72) * ys
  const rimR = R * Math.sin(0.72)
  return (
    <group scale={1.2}>
      <Cyl m={m} at={[0, 0.02, 0]} r={0.78} h={0.04} c="#5d5560" seg={20} />
      {/* Ring of fire stones, logs and flames. */}
      {Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2).map((a) => (
        <Box key={a} m={m} at={[Math.sin(a) * 0.5, 0.075, Math.cos(a) * 0.5]} rot={[0, a + 0.3, 0]} s={[0.13, 0.07, 0.1]} c="#78717f" />
      ))}
      {[0, 2.1, 4.2].map((a) => <Cyl key={a} m={m} at={[0, 0.075, 0]} r={0.035} h={0.62} c="#5d4037" seg={6} rot={[Math.PI / 2, 0, a]} />)}
      {[[0, 0.1], [0.09, -0.05], [-0.09, -0.05]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.17, z]}><coneGeometry args={[0.07, 0.2, 6]} />{gl('flame', '#ff9800')}</mesh>
      ))}
      {/* The pot on three legs, brimming with glowing brew. */}
      {[0, 2.1, 4.2].map((a) => <Cyl key={`l${a}`} m={m} at={[Math.sin(a) * 0.22, 0.13, Math.cos(a) * 0.22]} r={0.03} r2={0.02} h={0.18} c="#212121" seg={5} />)}
      <mesh position={[0, cy, 0]} scale={[1, ys, 1]} castShadow>
        <sphereGeometry args={[R, 16, 10, 0, Math.PI * 2, 0.72, Math.PI - 0.72]} />
        {m('#212121')}
      </mesh>
      <mesh position={[0, rimY, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[rimR, 0.035, 6, 18]} />{m('#2b2b2b')}</mesh>
      <Cyl m={m} at={[0, rimY - 0.02, 0]} r={rimR - 0.005} h={0.02} c="#64dd17" seg={16} />
      <mesh position={[0, rimY - 0.006, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[rimR - 0.01, 16]} />{gl('brew', '#64dd17')}</mesh>
      {[[0.08, 0.05, 0.045], [-0.1, -0.04, 0.035], [0.02, -0.1, 0.03]].map(([x, z, r]) => (
        <mesh key={`${x}${z}`} position={[x, rimY - 0.006, z]}><sphereGeometry args={[r, 8, 6]} />{gl('brew', '#64dd17')}</mesh>
      ))}
      {!ghost && (
        <group userData={AIR}>
          <mesh position={[0.06, rimY + 0.2, 0.02]}><sphereGeometry args={[0.04, 8, 6]} />{gl('brew', '#64dd17')}</mesh>
          <mesh position={[-0.04, rimY + 0.36, -0.03]}><sphereGeometry args={[0.028, 8, 6]} />{gl('brew', '#64dd17')}</mesh>
        </group>
      )}
      {/* The stirring paddle, leaning on the rim. */}
      <group position={[-0.12, rimY - 0.02, 0.05]} rotation={[0.25, 0, 0.45]}>
        <Cyl m={m} at={[0, 0.25, 0]} r={0.016} h={0.5} c="#8d6e63" seg={5} />
      </group>
      {/* A stump with an open spell book and a candle. */}
      <group position={[0.55, 0.04, -0.5]}>
        <Cyl m={m} at={[0, 0.15, 0]} r={0.17} r2={0.21} h={0.3} c="#5d4037" seg={10} />
        <Cyl m={m} at={[0, 0.305, 0]} r={0.165} h={0.01} c="#c8a27a" seg={10} />
        <group position={[-0.02, 0.31, 0.02]} rotation-y={0.3}>
          {[-1, 1].map((sd) => (
            <group key={sd} position={[sd * 0.07, 0, 0]} rotation-z={-sd * 0.12}>
              <Box m={m} at={[0, 0.012, 0]} s={[0.14, 0.016, 0.19]} c="#4a148c" />
              <Box m={m} at={[0, 0.026, 0]} s={[0.125, 0.012, 0.17]} c="#fff3d6" />
            </group>
          ))}
        </group>
        <Cyl m={m} at={[0.1, 0.35, -0.08]} r={0.022} h={0.08} c="#f5f0e1" seg={8} />
        <mesh position={[0.1, 0.41, -0.08]}><coneGeometry args={[0.014, 0.04, 6]} />{gl('flame', '#ff9800')}</mesh>
      </group>
      {/* A broomstick leaning on the stump. */}
      <group position={[0.62, 0.04, -0.08]} rotation-y={1.73}>
        <group rotation-z={-0.68}>
        <Cyl m={m} at={[0, 0.48, 0]} r={0.016} h={0.82} c="#795548" seg={5} />
        <mesh position={[0, 0.1, 0]} rotation-x={Math.PI}><coneGeometry args={[0.085, 0.22, 8]} />{m('#d4a24b')}</mesh>
        <Cyl m={m} at={[0, 0.2, 0]} r={0.035} h={0.035} c="#6d4c41" seg={6} />
        </group>
      </group>
      {!ghost && (
        <group>
          {/* Potion bottles and a black cat. */}
          {[[-0.62, -0.2, '#7b1fa2'], [-0.7, -0.03, '#ff6d00'], [-0.5, -0.36, '#00897b']].map(([x, z, c]) => (
            <group key={c as string} position={[x as number, 0.04, z as number]}>
              <mesh position={[0, 0.06, 0]}><sphereGeometry args={[0.06, 8, 6]} />{m(c as string)}</mesh>
              <Cyl m={m} at={[0, 0.14, 0]} r={0.018} h={0.06} c={c as string} seg={6} />
              <Cyl m={m} at={[0, 0.18, 0]} r={0.022} h={0.025} c="#8d6e63" seg={6} />
            </group>
          ))}
          <group position={[-0.42, 0.04, 0.55]} rotation-y={0.5}>
            <mesh position={[0, 0.1, 0]} scale={[0.8, 1, 1.1]}><sphereGeometry args={[0.1, 10, 8]} />{m('#1b1b1f')}</mesh>
            <mesh position={[0, 0.24, 0.05]}><sphereGeometry args={[0.065, 10, 8]} />{m('#1b1b1f')}</mesh>
            {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.035, 0.31, 0.05]}><coneGeometry args={[0.022, 0.05, 4]} />{m('#1b1b1f')}</mesh>)}
            {[-1, 1].map((sd) => <mesh key={`e${sd}`} position={[sd * 0.022, 0.25, 0.112]}><sphereGeometry args={[0.011, 6, 5]} />{gl('brew', '#c6ff00')}</mesh>)}
            <group position={[0, 0.03, -0.1]} rotation-x={-0.6}>
              <Cyl m={m} at={[0, 0.1, 0]} r={0.014} h={0.2} c="#1b1b1f" seg={5} />
            </group>
          </group>
          <Glowpool gl={gl} k="poolGreen" r={0.95} y={0.052} />
        </group>
      )}
    </group>
  )
}

// ---- Jack-o'-lantern lamp: carved pumpkins stacked on an iron lamp post ----
function JackLamp({ ghost, m, gl, bulb }: { ghost?: boolean; m: Mat; gl: Gl; bulb: ReactNode }) {
  const iron = '#37474f'
  const stack: [number, number][] = [[0.24, 0.18], [0.19, 0.54], [0.15, 0.825]]
  const top = 1.86
  return (
    <group scale={1.15}>
      <Cyl m={m} at={[0, 0.02, 0]} r={0.55} h={0.04} c="#6d6875" seg={16} />
      <Box m={m} at={[0, 0.11, 0]} s={[0.38, 0.14, 0.38]} c="#4e4a56" />
      <Box m={m} at={[0, 0.19, 0]} s={[0.42, 0.03, 0.42]} c="#5f5a68" />
      <Cyl m={m} at={[0, (0.2 + top) / 2, 0]} r={0.032} h={top - 0.2} c={iron} seg={8} />
      {stack.map(([r, y], i) => (
        <JackO key={i} m={m} gl={gl} at={[0, y + (i === 0 ? 0.025 : 0), 0]} r={r} rot={i === 1 ? 0.35 : i === 2 ? -0.3 : 0} c={i === 1 ? '#fb8c00' : '#ef6c00'} />
      ))}
      {/* An iron collar, the cross arm with two hanging lanterns, and the lit pumpkin head. */}
      <Cyl m={m} at={[0, 1.1, 0]} r={0.06} h={0.05} c={iron} seg={8} />
      <Box m={m} at={[0, 1.62, 0]} s={[0.7, 0.035, 0.035]} c={iron} shadow={false} />
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.32, 1.62, 0]}>
          <mesh position={[-sd * 0.08, 0.06, 0]} rotation-z={sd * Math.PI / 2}><torusGeometry args={[0.06, 0.01, 4, 10, Math.PI]} />{m(iron)}</mesh>
          <Cyl m={m} at={[0, -0.06, 0]} r={0.006} h={0.1} c={iron} seg={4} />
          <Box m={m} at={[0, -0.12, 0]} s={[0.1, 0.02, 0.1]} c={iron} shadow={false} />
          <mesh position={[0, -0.2, 0]}><boxGeometry args={[0.08, 0.14, 0.08]} />{bulb}</mesh>
          <Box m={m} at={[0, -0.28, 0]} s={[0.1, 0.02, 0.1]} c={iron} shadow={false} />
          <mesh position={[0, -0.1, 0]} rotation-y={Math.PI / 4}><coneGeometry args={[0.08, 0.06, 4]} />{m(iron)}</mesh>
        </group>
      ))}
      <group position={[0, top, 0]}>
        <Cyl m={m} at={[0, 0.01, 0]} r={0.09} h={0.02} c={iron} seg={8} />
        <mesh position={[0, 0.02 + 0.15, 0]} scale={[1, 0.8, 1]}><sphereGeometry args={[0.18, 12, 8]} />{m('#ff8f00')}</mesh>
        {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
          <group key={a} rotation-y={a}>
            {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.055, 0.2, 0.17]} rotation-z={Math.PI}><circleGeometry args={[0.035, 3]} />{gl('ember', '#3a1600')}</mesh>)}
            <mesh position={[0, 0.14, 0.178]} scale={[1, 0.5, 1]}><circleGeometry args={[0.075, 7, Math.PI, Math.PI]} />{gl('ember', '#3a1600')}</mesh>
          </group>
        ))}
        <mesh position={[0, 0.34, 0]} rotation-y={Math.PI / 4}><coneGeometry args={[0.14, 0.12, 4]} />{m(iron)}</mesh>
        <Cyl m={m} at={[0, 0.45, 0]} r={0.01} h={0.12} c={iron} seg={4} />
        <mesh position={[0, 0.52, 0]}><sphereGeometry args={[0.022, 6, 5]} />{m(iron)}</mesh>
      </group>
      {!ghost && (
        <group>
          <JackO m={m} gl={gl} at={[0.4, 0.04, 0.3]} r={0.11} rot={0.5} />
          <JackO m={m} gl={gl} at={[-0.38, 0.04, 0.34]} r={0.08} face={false} c="#fb8c00" />
          {/* A crow on the cross arm. */}
          <group position={[-0.2, 1.6375, 0]}>
            <mesh position={[0, 0.045, 0]} scale={[1.4, 1, 1]}><sphereGeometry args={[0.045, 8, 6]} />{m('#212121')}</mesh>
            <mesh position={[0.07, 0.07, 0]} rotation-z={-Math.PI / 2}><coneGeometry args={[0.018, 0.045, 4]} />{m('#ffb300')}</mesh>
          </group>
          <Glowpool gl={gl} k="poolAmber" r={1.0} y={0.052} />
        </group>
      )}
    </group>
  )
}

export function SpookyModel({ def, ghost, m, bulb, level = 1 }: NewModelProps) {
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  const gl: Gl = (k, c, t) => (ghost ? m(c, t) : <primitive object={spookyGlows()[k]} attach="material" dispose={null} />)
  switch (def.id) {
    case 'haunted': return <Haunted ghost={ghost} m={m} lvl={lvl} gl={gl} bulb={bulb} />
    case 'cornmaze': return <CornMaze ghost={ghost} m={m} gl={gl} bulb={bulb} />
    case 'cauldron': return <Cauldron ghost={ghost} m={m} gl={gl} />
    default: return <JackLamp ghost={ghost} m={m} gl={gl} bulb={bulb} />
  }
}
