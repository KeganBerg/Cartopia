import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, CanvasTexture, Color, MeshStandardMaterial, SRGBColorSpace, RepeatWrapping, type Group, type Texture } from 'three'
import { Box, Cyl, Pool, type Mat, type V3 } from './NewBuildings'
import { Bench, Glass, Lamp, LitSign, Planter, RoofPlant } from './OfficeBuildings'
import { CarModel } from './CarModel'
import { Upright } from './mergeScale'
import { glowMats, onNight } from './dayNight'
import { concreteTex, paverTex } from './textures'
import { PAL } from './season'

// Globe Tower: the landmark two Vanguard Towers become when their blocks merge
// side by side (eight level 10 houses in a 2x4). A newspaper skyscraper in art
// deco limestone: a stepped shaft of piers and dark glass over a lobby with a
// lit marquee, newsroom wings either side with a news ticker running across
// them, and a giant globe on the crown, held at a tilt in a gold meridian like
// a desk globe, ringed with a lit band and slowly turning.
// It fills a 2x4 lot (8x4 units round the origin), long side along x, facing +z.
// Static pieces are plain meshes the town's Batch merges; the globe turns, so it
// stays out of the merge. Tapped (World.tsx calls spinGlobe), the globe whirls.

const STONE = '#e8dcc2'
const PIER = '#f4ecda'
const GOLD = '#d9a83a'
const BRONZE = '#8a6a2a'
const GLASS = '#56718a'
const Z = -0.5 // the tower's middle: the plaza takes the front of the lot
// The shaft steps in three times on its way up: [width, depth, bottom, top].
const STEPS: [number, number, number, number][] = [[2.3, 1.8, 1.8, 9.8], [1.8, 1.4, 9.8, 12.6], [1.3, 1.0, 12.6, 14.2]]
const CROWN = 14.7
const STEM = 14.98 // top of the stem where the meridian's foot sits
const TILT = 0.36
const ARC = 1.38 // meridian radius
const R = 1.2 // globe radius
const BAND = 1.5 // lit ring radius
// The globe's middle, so the meridian's foot lands on the stem.
const C: V3 = [-ARC * Math.sin(TILT), STEM + ARC * Math.cos(TILT), 0]
const WING_X = 2.9
const WING_W = 2.0
const WING_D = 2.0
const WING_H = 2.7

const mat: Mat = (color: string, map?: Texture) => <meshStandardMaterial color={color} map={map ?? null} />
const bulb = <primitive object={glowMats.bulb} attach="material" dispose={null} />

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  return t
}

// The globe: deep blue seas and gold land, with a faint grid of latitudes and longitudes.
let globe: MeshStandardMaterial | null = null
function globeMat() {
  if (globe) return globe
  const t = canvasTex(512, 256, (g) => {
    g.fillStyle = '#1d4f8f'
    g.fillRect(0, 0, 512, 256)
    g.fillStyle = '#e8b84a'
    // Rough continents, drawn as clusters of blobs (x, y, rx, ry) on a 512x256 map.
    const land: [number, number, number, number][] = [
      [95, 70, 46, 30], [120, 95, 30, 26], [75, 55, 30, 16], [140, 135, 14, 12], // north America
      [165, 175, 22, 36], [155, 150, 18, 16], // south America
      [265, 70, 26, 18], [290, 60, 24, 14], // Europe
      [275, 140, 30, 44], [295, 115, 22, 20], // Africa
      [355, 65, 60, 28], [400, 90, 36, 24], [370, 110, 18, 16], // Asia
      [430, 175, 26, 18], // Australia
      [256, 245, 256, 12], // the ice in the south
    ]
    for (const [x, y, rx, ry] of land) {
      g.beginPath()
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = 'rgba(255,236,170,0.35)'
    g.lineWidth = 2
    for (let x = 0; x < 512; x += 43) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke() }
    for (let y = 32; y < 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke() }
  })
  globe = new MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new Color('#ffffff'), emissiveIntensity: 0.05, metalness: 0.45, roughness: 0.35 })
  globe.userData.live = true
  const m = globe
  onNight((n) => (m.emissiveIntensity = 0.05 + n * 0.55))
  return globe
}

// Lit lettering: the globe's ring and the wings' news ticker.
const lit = new Map<string, MeshStandardMaterial>()
function litBand(text: string, w: number, bg: string, fg: string, repeat = 1) {
  const k = `${text}|${repeat}`
  let m = lit.get(k)
  if (m) return m
  const t = canvasTex(w, 64, (g) => {
    g.fillStyle = bg
    g.fillRect(0, 0, w, 64)
    g.fillStyle = fg
    g.font = 'bold 40px sans-serif'
    g.textBaseline = 'middle'
    const step = w / repeat
    for (let i = 0; i < repeat; i++) g.fillText(text, i * step + 16, 34)
  })
  m = new MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new Color('#ffffff'), emissiveIntensity: 0.25, toneMapped: false })
  m.userData.live = true
  const mm = m
  onNight((n) => (mm.emissiveIntensity = 0.25 + n * 1.1))
  lit.set(k, m)
  return m
}
const ringMat = () => litBand('DAILY GLOBE  ★', 2048, '#14243b', '#ffd66b', 4)
// Each wing shows about a third of the headlines at a time.
function tickerMat() {
  const m = litBand('BREAKING: LOCAL RACER TAKES THE GRAND PRIX  ★  NEW SPEEDWAY OPENS  ★  GAS DOWN 3¢  ★', 2048, '#0d0d0d', '#ff9f1c')
  m.map!.repeat.set(0.36, 1)
  return m
}

// ---- Taps: the globe whirls ----

const spins = new Map<string, number>()
export function spinGlobe(uid: string) {
  spins.set(uid, (spins.get(uid) ?? 0) + 1)
}
const spinsOf = (uid?: string) => (uid ? spins.get(uid) ?? 0 : 0)
const WHIRL_S = 3

function Globe({ uid }: { uid?: string }) {
  const turn = useRef<Group>(null)
  const run = useRef({ seen: spinsOf(uid), at: -99 })
  useFrame(({ clock }, dt) => {
    const g = turn.current
    if (!g) return
    const t = clock.elapsedTime
    const r = run.current
    if (r.seen !== spinsOf(uid)) {
      r.seen = spinsOf(uid)
      r.at = t
    }
    const u = (t - r.at) / WHIRL_S
    const boost = u >= 0 && u < 1 ? 9 * Math.sin(Math.PI * u) : 0
    g.rotation.y += Math.min(dt, 0.1) * (0.3 + boost)
  })
  return (
    <group position={C} rotation-z={TILT}>
      {/* Gold meridian holding the poles, with pins into the globe and a beacon on top. */}
      <mesh rotation-z={-Math.PI / 2} castShadow>
        <torusGeometry args={[ARC, 0.05, 6, 40, Math.PI]} />
        {mat(GOLD)}
      </mesh>
      {[-1, 1].map((s) => <Cyl key={s} m={mat} at={[0, s * (R + ARC) / 2, 0]} r={0.035} h={ARC - R + 0.04} c={BRONZE} seg={8} />)}
      <mesh position={[0, ARC + 0.08, 0]}><sphereGeometry args={[0.06, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>
      {/* The globe and its ring turn together about the tilted axis. */}
      <group ref={turn} userData={{ noBatch: true }}>
        <mesh castShadow>
          <sphereGeometry args={[R, 32, 20]} />
          <primitive object={globeMat()} attach="material" dispose={null} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[BAND, BAND, 0.26, 48, 1, true]} />
          <primitive object={ringMat()} attach="material" dispose={null} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[BAND - 0.004, BAND - 0.004, 0.26, 48, 1, true]} />
          <meshStandardMaterial color="#14243b" side={BackSide} />
        </mesh>
        {[-0.13, 0.13].map((y) => (
          <mesh key={y} position-y={y} rotation-x={Math.PI / 2}>
            <torusGeometry args={[BAND, 0.025, 5, 48]} />
            {mat(GOLD)}
          </mesh>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} m={mat} at={[Math.cos((i * Math.PI) / 2) * (R + BAND) / 2, 0, Math.sin((i * Math.PI) / 2) * (R + BAND) / 2]} s={[0.05, 0.05, BAND - R + 0.08]} rot={[0, Math.PI / 2 - (i * Math.PI) / 2, 0]} c={GOLD} />
        ))}
      </group>
    </group>
  )
}

// One stage of the shaft: dark glass between limestone piers, the piers rising
// past the ledge into the stepped deco crown of each stage.
function Stage({ w, d, y0, y1 }: { w: number; d: number; y0: number; y1: number }) {
  const h = y1 - y0
  const y = y0 + h / 2
  const bays = (len: number) => Math.max(3, Math.round(len / 0.3))
  const piers = (len: number) => Array.from({ length: bays(len) - 1 }, (_, i) => -len / 2 + ((i + 1) * len) / bays(len))
  return (
    <group position-z={Z}>
      <Box m={mat} at={[0, y, 0]} s={[w - 0.04, h, d - 0.04]} c="#2b3440" />
      <Glass m={mat} at={[0, y, d / 2]} w={w} h={h} tint={GLASS} />
      <Glass m={mat} at={[0, y, -d / 2]} w={w} h={h} ry={Math.PI} tint={GLASS} />
      <Glass m={mat} at={[w / 2, y, 0]} w={d} h={h} ry={Math.PI / 2} tint={GLASS} />
      <Glass m={mat} at={[-w / 2, y, 0]} w={d} h={h} ry={-Math.PI / 2} tint={GLASS} />
      {[-1, 1].flatMap((s) => piers(w).map((x) => <Box key={`x${s}${x}`} m={mat} at={[x, y + 0.12, s * (d / 2 + 0.03)]} s={[0.08, h + 0.24, 0.06]} c={PIER} />))}
      {[-1, 1].flatMap((s) => piers(d).map((z) => <Box key={`z${s}${z}`} m={mat} at={[s * (w / 2 + 0.03), y + 0.12, z]} s={[0.06, h + 0.24, 0.08]} c={PIER} />))}
      {/* Wide corner piers, a little taller again. */}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`c${sx}${sz}`} m={mat} at={[sx * (w / 2 - 0.02), y + 0.2, sz * (d / 2 - 0.02)]} s={[0.18, h + 0.4, 0.18]} c={PIER} />))}
      {/* Spandrel bands in bronze every few floors. */}
      {[0.25, 0.5, 0.75].filter(() => h > 4).map((f) => (
        <group key={f}>
          {[-1, 1].map((s) => <Box key={s} m={mat} at={[0, y0 + h * f, s * (d / 2 + 0.008)]} s={[w - 0.2, 0.05, 0.012]} c={BRONZE} shadow={false} />)}
          {[-1, 1].map((s) => <Box key={`s${s}`} m={mat} at={[s * (w / 2 + 0.008), y0 + h * f, 0]} s={[0.012, 0.05, d - 0.2]} c={BRONZE} shadow={false} />)}
        </group>
      ))}
      {/* Roof slab, with a gold lip. */}
      <Box m={mat} at={[0, y1 + 0.04, 0]} s={[w + 0.06, 0.08, d + 0.06]} c={STONE} />
      <Box m={mat} at={[0, y1 - 0.04, 0]} s={[w + 0.03, 0.04, d + 0.03]} c={GOLD} shadow={false} />
    </group>
  )
}

// A newsroom wing: three floors of ribbon windows between piers, a cornice, the
// ticker under it, and a busy roof.
function Wing({ side }: { side: -1 | 1 }) {
  const x0 = side * WING_X
  const floors = [0.55, 1.3, 2.0]
  const piers = Array.from({ length: 6 }, (_, i) => -WING_W / 2 + ((i + 0.5) * WING_W) / 6)
  return (
    <group position={[x0, 0, Z]}>
      <Box m={mat} at={[0, WING_H / 2, 0]} s={[WING_W, WING_H, WING_D]} c={STONE} t={concreteTex(2, 2)} />
      {floors.map((y, i) => (
        <group key={y}>
          <Glass m={mat} at={[0, y, WING_D / 2 + 0.005]} w={WING_W - 0.16} h={i === 0 ? 0.62 : 0.42} tint={GLASS} />
          <Glass m={mat} at={[0, y, -WING_D / 2 - 0.005]} w={WING_W - 0.16} h={0.42} ry={Math.PI} tint={GLASS} />
          <Glass m={mat} at={[side * (WING_W / 2 + 0.005), y, 0]} w={WING_D - 0.16} h={0.42} ry={(side * Math.PI) / 2} tint={GLASS} />
        </group>
      ))}
      {[-1, 1].flatMap((s) => piers.map((x) => <Box key={`${s}${x}`} m={mat} at={[x, WING_H / 2, s * (WING_D / 2 + 0.03)]} s={[0.07, WING_H, 0.05]} c={PIER} />))}
      {piers.map((z) => <Box key={`o${z}`} m={mat} at={[side * (WING_W / 2 + 0.03), WING_H / 2, z]} s={[0.05, WING_H, 0.07]} c={PIER} />)}
      {/* Cornice, and the ticker on a dark band beneath it. */}
      <Box m={mat} at={[0, WING_H + 0.05, 0]} s={[WING_W + 0.1, 0.1, WING_D + 0.1]} c={PIER} />
      <Box m={mat} at={[0, WING_H - 0.22, WING_D / 2 + 0.06]} s={[WING_W, 0.22, 0.04]} c="#111111" shadow={false} />
      <Ticker at={[0, WING_H - 0.22, WING_D / 2 + 0.082]} w={WING_W - 0.06} h={0.17} />
      {/* Roof: parapet, plant, and a water tank or the newsroom's dishes and mast. */}
      <mesh position={[0, WING_H + 0.104, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[WING_W - 0.1, WING_D - 0.1]} />{mat('#8d8d86')}</mesh>
      <RoofPlant m={mat} at={[side * 0.35, WING_H + 0.1, -0.45]} />
      {side < 0 ? (
        <group position={[-0.35, WING_H + 0.1, 0.25]}>
          {[-1, 1].flatMap((a) => [-1, 1].map((b) => <Box key={`${a}${b}`} m={mat} at={[a * 0.2, 0.2, b * 0.2]} s={[0.04, 0.4, 0.04]} c="#4e342e" />))}
          <Box m={mat} at={[0, 0.41, 0]} s={[0.5, 0.03, 0.5]} c="#5d4037" />
          <Cyl m={mat} at={[0, 0.66, 0]} r={0.26} h={0.46} c="#8d6e63" seg={14} />
          {[0.5, 0.66, 0.82].map((y) => <Cyl key={y} m={mat} at={[0, y, 0]} r={0.268} h={0.02} c="#3e2723" seg={14} />)}
          <Cyl m={mat} at={[0, 0.97, 0]} r={0.02} r2={0.29} h={0.16} c="#6d4c41" seg={14} />
        </group>
      ) : (
        <group position={[0.2, WING_H + 0.1, 0.2]}>
          {[[-0.45, 0.1], [0.05, 0.25]].map(([x, z]) => (
            <group key={x} position={[x, 0, z]}>
              <Cyl m={mat} at={[0, 0.1, 0]} r={0.025} h={0.2} c="#78909c" seg={6} />
              <Cyl m={mat} at={[0, 0.25, 0.03]} r={0.2} r2={0.05} h={0.08} c="#eceff1" seg={18} rot={[-0.9, 0, 0]} />
              <Cyl m={mat} at={[0, 0.3, 0.12]} r={0.012} h={0.14} c="#90a4ae" seg={5} rot={[-0.9, 0, 0]} />
            </group>
          ))}
          {/* Lattice mast with a warning light. */}
          <group position={[0.5, 0, -0.3]}>
            {[-1, 1].flatMap((a) => [-1, 1].map((b) => <Box key={`${a}${b}`} m={mat} at={[a * 0.05, 0.6, b * 0.05]} s={[0.018, 1.2, 0.018]} c="#c62828" />))}
            {[0.3, 0.6, 0.9].map((y) => <Box key={y} m={mat} at={[0, y, 0]} s={[0.12, 0.015, 0.12]} c="#eeeeee" shadow={false} />)}
            <mesh position={[0, 1.24, 0]}><sphereGeometry args={[0.035, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>
          </group>
        </group>
      )}
    </group>
  )
}

// The headlines crawl along the ticker (both wings share the one texture).
function Ticker({ at, w, h }: { at: V3; w: number; h: number }) {
  const m = tickerMat()
  useFrame((_, dt) => {
    const t = m.map!
    t.offset.x = (t.offset.x + Math.min(dt, 0.1) * 0.04) % 1
  })
  return (
    <mesh position={at}>
      <planeGeometry args={[w, h]} />
      <primitive object={m} attach="material" dispose={null} />
    </mesh>
  )
}
export function GlobeTower({ uid }: { uid?: string } = {}) {
  const front = Z + 1.05
  return (
    <group>
      {/* Plaza paving and steps up to the lobby. */}
      <Box m={mat} at={[0, 0.025, 0]} s={[7.9, 0.05, 3.9]} c="#ffffff" t={paverTex(8, 4)} shadow={false} />
      {[0, 1, 2].map((k) => <Box key={k} m={mat} at={[0, 0.06 + k * 0.03, front + 0.3 - k * 0.1]} s={[1.8 - k * 0.12, 0.03, 0.3]} c="#d7ccb8" t={concreteTex(1, 1)} shadow={false} />)}

      {/* Lobby: a limestone base with tall windows, a gold-framed entrance and a lit marquee. */}
      <Box m={mat} at={[0, 0.9, Z]} s={[2.7, 1.8, 2.1]} c={STONE} t={concreteTex(2, 2)} />
      {[-0.95, -0.62, 0.62, 0.95].map((x) => <Glass key={x} m={mat} at={[x, 0.85, front + 0.005]} w={0.24} h={1.2} tint={GLASS} />)}
      <mesh position={[0, 0.62, front + 0.004]}><planeGeometry args={[0.8, 1.0]} />{mat('#1b2430')}</mesh>
      {[-0.43, 0.43].map((x) => <Box key={x} m={mat} at={[x, 0.66, front + 0.03]} s={[0.06, 1.12, 0.06]} c={GOLD} />)}
      <Box m={mat} at={[0, 1.2, front + 0.03]} s={[0.92, 0.06, 0.06]} c={GOLD} />
      <Box m={mat} at={[0, 1.38, front + 0.25]} s={[1.5, 0.08, 0.5]} c="#1d2633" />
      <mesh position={[0, 1.335, front + 0.495]}><boxGeometry args={[1.46, 0.02, 0.02]} />{bulb}</mesh>
      <LitSign m={mat} text="DAILY GLOBE" w={1.3} h={0.22} at={[0, 1.55, front + 0.502]} bg="#14243b" fg="#ffd66b" />
      <Box m={mat} at={[0, 1.55, front + 0.48]} s={[1.36, 0.28, 0.03]} c={BRONZE} shadow={false} />
      <Box m={mat} at={[0, 1.84, Z]} s={[2.8, 0.08, 2.2]} c={PIER} />
      {/* Round the back: the press hall's loading dock, a roll-up door under a lamp, and tall windows. */}
      <group position-z={Z - 1.05}>
        <Box m={mat} at={[0, 0.5, -0.02]} s={[0.9, 0.9, 0.04]} c="#9e9e9e" />
        {[0.15, 0.3, 0.45, 0.6, 0.75].map((y) => <Box key={y} m={mat} at={[0, y + 0.05, -0.045]} s={[0.86, 0.012, 0.01]} c="#757575" shadow={false} />)}
        <Box m={mat} at={[0, 0.1, -0.17]} s={[1.2, 0.2, 0.3]} c="#cfc6b4" t={concreteTex(1, 1)} />
        {[-0.3, 0.3].map((x) => <Box key={x} m={mat} at={[x, 0.15, -0.34]} s={[0.1, 0.08, 0.04]} c="#212121" />)}
        <mesh position={[0, 1.04, -0.06]}><boxGeometry args={[0.16, 0.04, 0.08]} />{bulb}</mesh>
        {[-0.95, 0.95].map((x) => <Glass key={x} m={mat} at={[x, 0.85, -0.005]} w={0.4} h={1.2} ry={Math.PI} tint={GLASS} />)}
      </group>
      {[-1, 1].map((s) => <Glass key={s} m={mat} at={[s * 1.355, 0.85, Z]} w={1.2} h={1.2} ry={(s * Math.PI) / 2} tint={GLASS} />)}

      {STEPS.map(([w, d, y0, y1]) => <Stage key={y0} w={w} d={d} y0={y0} y1={y1} />)}

      {/* Crown: stone and gold drums, floodlights, and the stem up to the globe's meridian. */}
      <group position-z={Z}>
        <Cyl m={mat} at={[0, 14.36, 0]} r={0.52} r2={0.6} h={0.24} c={STONE} seg={20} />
        <Cyl m={mat} at={[0, 14.58, 0]} r={0.4} r2={0.48} h={0.2} c={GOLD} seg={20} />
        <Cyl m={mat} at={[0, (CROWN + STEM) / 2, 0]} r={0.09} r2={0.16} h={STEM - CROWN + 0.04} c={BRONZE} seg={10} />
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.52, 14.27, sz * 0.38]}><boxGeometry args={[0.08, 0.06, 0.08]} />{bulb}</mesh>
        )))}
        <Globe uid={uid} />
      </group>

      <Wing side={-1} />
      <Wing side={1} />

      {/* Plaza: flags, lamps, planters, benches, news boxes, a press van and a car at the kerb. */}
      {[-1.25, 1.25].map((x) => (
        <group key={x} position={[x, 0.05, 1.15]}>
          <Cyl m={mat} at={[0, 0.75, 0]} r={0.015} h={1.5} c="#cfd8dc" seg={6} />
          <Box m={mat} at={[0.17, 1.35, 0]} s={[0.32, 0.2, 0.01]} c={x < 0 ? '#1565c0' : '#c62828'} />
          <mesh position={[0, 1.51, 0]}><sphereGeometry args={[0.025, 6, 4]} />{mat(GOLD)}</mesh>
        </group>
      ))}
      {[-0.75, 0.75].map((x, i) => (
        <group key={x} position={[x, 0.05, front + 0.75]}>
          <Box m={mat} at={[0, 0.14, 0]} s={[0.14, 0.24, 0.12]} c={i ? '#f9a825' : '#1e88e5'} />
          <mesh position={[0, 0.2, 0.064]}><planeGeometry args={[0.1, 0.07]} />{mat('#f5f5f5')}</mesh>
        </group>
      ))}
      {([[-3.7, 1.75], [-1.95, 1.75], [1.95, 1.75], [3.7, 1.75]] as [number, number][]).map(([x, z]) => <Lamp key={x} m={mat} bulb={bulb} at={[x, 0.05, z]} />)}
      {([[-1.75, 0.8], [1.75, 0.8]] as [number, number][]).map(([x, z]) => <Planter key={x} m={mat} at={[x, 0.05, z]} big />)}
      {!PAL.bare && ([[-0.4, 1.85], [0.4, 1.85]] as [number, number][]).map(([x, z]) => <Planter key={`f${x}`} m={mat} at={[x, 0.05, z]} />)}
      <Bench m={mat} at={[-2.4, 0.05, 0.85]} />
      <Bench m={mat} at={[2.4, 0.05, 0.85]} />
      {/* A fountain in front of each wing. */}
      {[-3.25, 3.25].map((x) => (
        <group key={x}>
          <group position={[x, 0, 1.2]}>
            <Cyl m={mat} at={[0, 0.1, 0]} r={0.4} h={0.12} c="#bcae94" seg={20} />
            <mesh position={[0, 0.165, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.35, 20]} /><meshStandardMaterial color="#4fb3d9" metalness={0.6} roughness={0.08} /></mesh>
            <Cyl m={mat} at={[0, 0.3, 0]} r={0.04} r2={0.07} h={0.28} c={GOLD} seg={10} />
            <mesh position={[0, 0.5, 0]} castShadow><sphereGeometry args={[0.1, 14, 10]} />{mat(GOLD)}</mesh>
          </group>
          <Pool r={0.7} x={x} z={1.2} />
        </group>
      ))}
      <Box m={mat} at={[-2.2, 0.055, 1.55]} s={[1.1, 0.012, 0.6]} c="#78909c" shadow={false} />
      <group position={[-2.2, 0.06, 1.55]} rotation-y={Math.PI / 2}>
        <Upright><group scale={0.8}><CarModel body="wagon" color="#eceff1" stripe="#1565c0" /></group></Upright>
      </group>
      <Box m={mat} at={[2.2, 0.055, 1.55]} s={[1.1, 0.012, 0.6]} c="#78909c" shadow={false} />
      <group position={[2.2, 0.06, 1.55]} rotation-y={-Math.PI / 2}>
        <Upright><group scale={0.8}><CarModel body="classic" color="#263238" stripe="#d9a83a" /></group></Upright>
      </group>
    </group>
  )
}
