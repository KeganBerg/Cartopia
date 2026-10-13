import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { calmFlashing } from '../game/flashing'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Group, InstancedMesh, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, RepeatWrapping, SRGBColorSpace, Vector3, type Texture } from 'three'
import { CarModel, carFrame, wheelRig, type WheelRig } from './CarModel'
import { BuildingModel } from './BuildingModel'
import { Batch } from './Batch'
import { holdTown } from './renderGate'
import { ArcadeSky, CarShadow, Grandstand, Lamp, TyreStack, useArcadeLook, useTownPool, type Person } from './ArcadeScenery'
import { Box, Cone, Cyl, Palm, Scatter, Water, rand } from './RaceVenues'
import { usePrefs } from '../lib/prefs'
import { FansFar, local, nearZone, useFansFar, useFanZones, useSpots, ZONE_R } from './kartSpots'
import { KartHorizon } from './KartHorizon'
import { CommonExtras, DesertExtras, DocksExtras, Fans, SpectatorBoats, TownExtras, boatPeople, type BoatSpot } from './KartExtras'
import { asphaltTex, checkerTex, concreteTex, containerTex, glowTex, grassTex, gravelTex, sandTex, towerTex } from './textures'
import { signTexture } from './signTexture'
import { glowMats } from './dayNight'
import { decal } from './layers'
import { TILE, buildingDef, type Body } from '../game/data'
import { BOMB_R, DRIFT_BLUE, DRIFT_ORANGE, KART_LEN, SMOKE_R, KartRace, racingLine, wrapAngle, type ItemId, type KartEvent, type KartInput, type Track } from '../game/kart'
import type { ChaseCar } from './ChaseScene'
import { HERO_TIME, heroCam, heroShot, heroWanted, resetHero } from './heroShot'
import { BoostTrail } from './boostTrail'
import { Celebration } from './celebration'
import { useGame } from '../game/store'
import { cheerDef, myCheer, myTrail, trailDef } from '../game/flair'
import { reducedMotion } from '../game/fx'

// A kart circuit: the tarmac ribbon with kerbs, verges and barriers, the theme's
// scenery round it (the player's town, a harbour, a red rock canyon), the karts,
// and a chase camera. The race itself is game/kart.ts; this draws it and steps it.

export type KartHud = {
  lap: number; place: number; item: string | null; speed: number; charge: number; boost: boolean; t: number; dots: { x: number; z: number; me: boolean }[]; wrong: boolean
  fx: { flat: number; smoke: number; emp: number; tow: number; shield: number; ghost: number; splat: number; rocket: number } // seconds left on each effect on the player
  uses: number // cans left in a Nitro Triple
}
export type KartCam = 'chase' | 'top' | 'sky' // sky: a dev overview of the whole circuit

// Dev only: ?autopilot drives the player's kart, ?warp=<s> skips ahead once the race starts (for screenshots).
const DEV = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search) : null
const AUTOPILOT = !!DEV?.has('autopilot')
let warp = Number(DEV?.get('warp') ?? 0)

// Dev only, for screenshots: ?fx=ghost,splat,rocket,bomb keeps those effects on kart ?fxk
// (the player's by default) and ?item=<id> fills the player's slot.
function devFx(race: KartRace, me: number) {
  const k = race.karts[Number(DEV!.get('fxk') ?? me)]
  for (const f of (DEV!.get('fx') ?? '').split(',')) {
    if (f === 'ghost' || f === 'splat' || f === 'rocket') k[f] = Math.max(k[f], 1)
    if (f === 'bomb' && !race.bombs.length) { k.item = 'bomb'; race.useItem(k, race.order()) }
  }
  const item = DEV!.get('item') as ItemId | null
  if (item && !race.karts[me].item) { race.karts[me].item = item; race.karts[me].uses = 3 }
}

const Y_ROAD = 0.02
const Y_KERB = 0.035
const Y_PAINT = 0.04

// ---------- textures ----------

const texCache = new Map<string, CanvasTexture>()
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 4
  texCache.set(key, t)
  return t
}
// Red and white kerb blocks, one pair per texture repeat.
const kerbTex = (a: string, b: string) => canvasTex(`kerb${a}${b}`, 16, 64, (g) => {
  g.fillStyle = a; g.fillRect(0, 0, 16, 32)
  g.fillStyle = b; g.fillRect(0, 32, 16, 32)
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(12, 0, 4, 64)
})
// Boost pad: glowing chevrons pointing along +v.
const boostTex = () => canvasTex('boostpad', 64, 128, (g) => {
  g.fillStyle = '#ff6d00'; g.fillRect(0, 0, 64, 128)
  for (let i = 0; i < 3; i++) {
    const y = 110 - i * 40
    g.fillStyle = i % 2 ? '#ffe082' : '#fff8e1'
    g.beginPath(); g.moveTo(6, y); g.lineTo(32, y - 26); g.lineTo(58, y); g.lineTo(58, y - 12); g.lineTo(32, y - 38); g.lineTo(6, y - 12); g.closePath(); g.fill()
  }
  g.strokeStyle = '#bf360c'; g.lineWidth = 4; g.strokeRect(2, 2, 60, 124)
})
const rampTex = () => canvasTex('ramp', 64, 64, (g) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#212121' : '#ffd600'; g.beginPath(); g.moveTo(i * 16 - 32, 64); g.lineTo(i * 16, 0); g.lineTo(i * 16 + 8, 0); g.lineTo(i * 16 - 24, 64); g.fill() }
})
// Barrier panel: a run of sponsor boards in invented names.
const ADS = ['CARTOPIA', 'RUSTY\'S', 'BIG BISON', 'TURBO TONIC', 'GEARBOX', 'NITRO NUTS', 'SKYHOPPER', 'LUGNUT CO']
const AD_COLORS: [string, string][] = [['#1565c0', '#ffffff'], ['#c62828', '#ffeb3b'], ['#2e7d32', '#ffffff'], ['#212121', '#ff9100'], ['#6a1b9a', '#ffffff'], ['#ffeb3b', '#c62828'], ['#00838f', '#ffffff'], ['#ef6c00', '#212121']]
const adTex = () => canvasTex('adwall', 2048, 128, (g) => {
  ADS.forEach((text, i) => {
    const [bg, fg] = AD_COLORS[i]
    g.fillStyle = bg; g.fillRect(i * 256, 0, 256, 128)
    g.fillStyle = fg
    let size = 54
    g.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`
    while (g.measureText(text).width > 228 && size > 20) { size -= 3; g.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif` }
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(text, i * 256 + 128, 68)
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(i * 256, 0, 256, 10)
  })
})
const crateTex = () => canvasTex('kartcrate', 128, 128, (g) => {
  const grd = g.createLinearGradient(0, 0, 128, 128)
  grd.addColorStop(0, '#ff4081'); grd.addColorStop(0.5, '#7c4dff'); grd.addColorStop(1, '#00e5ff')
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128)
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118)
  // A gem, the game's own prize mark.
  g.fillStyle = '#ffffff'
  g.beginPath(); g.moveTo(64, 98); g.lineTo(30, 56); g.lineTo(44, 36); g.lineTo(84, 36); g.lineTo(98, 56); g.closePath(); g.fill()
  g.fillStyle = 'rgba(124,77,255,0.45)'
  g.beginPath(); g.moveTo(64, 98); g.lineTo(52, 56); g.lineTo(76, 56); g.closePath(); g.fill()
  g.fillRect(30, 54, 68, 4)
})
// Tack strip: a black rubber mat with hazard-yellow ends.
const tackTex = () => canvasTex('karttacks', 256, 64, (g) => {
  g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, 256, 64)
  for (let x = 0; x < 256; x += 16) { g.fillStyle = x % 32 ? '#262626' : '#141414'; g.fillRect(x, 0, 16, 64) }
  for (const x0 of [0, 232]) for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#212121' : '#ffca28'
    g.beginPath(); g.moveTo(x0, i * 16); g.lineTo(x0 + 24, i * 16 + 8); g.lineTo(x0 + 24, i * 16 + 24); g.lineTo(x0, i * 16 + 16); g.fill()
  }
})

// ---------- track geometry ----------

// A strip following the centre line between two offsets across it (+ is left).
// u runs across (0..1), v along in world units / vScale.
function ribbon(t: Track, a: number, b: number, y: number, vScale: number, uScale = 1) {
  const n = t.n
  const pos = new Float32Array((n + 1) * 2 * 3)
  const uv = new Float32Array((n + 1) * 2 * 2)
  const nor = new Float32Array((n + 1) * 2 * 3)
  let s = 0
  for (let k = 0; k <= n; k++) {
    const i = k % n
    if (k > 0) s += Math.hypot(t.x[i] - t.x[(k - 1) % n], t.z[i] - t.z[(k - 1) % n])
    for (let e = 0; e < 2; e++) {
      const o = e ? b : a
      const j = (k * 2 + e)
      pos.set([t.x[i] + t.nx[i] * o, y, t.z[i] + t.nz[i] * o], j * 3)
      uv.set([e * uScale, s / vScale], j * 2)
      nor.set([0, 1, 0], j * 3)
    }
  }
  const idx: number[] = []
  for (let k = 0; k < n; k++) {
    const p = k * 2
    // Winding so the face points up whichever side a and b sit.
    if (b > a) idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3)
    else idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  g.setAttribute('normal', new BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

// An upright wall along an offset, `h` tall, facing the track.
function wallGeo(t: Track, o: number, y0: number, h: number, vScale: number) {
  const n = t.n
  const pos = new Float32Array((n + 1) * 2 * 3)
  const uv = new Float32Array((n + 1) * 2 * 2)
  const nor = new Float32Array((n + 1) * 2 * 3)
  const sg = -Math.sign(o)
  let s = 0
  for (let k = 0; k <= n; k++) {
    const i = k % n
    if (k > 0) s += Math.hypot(t.x[i] - t.x[(k - 1) % n], t.z[i] - t.z[(k - 1) % n])
    for (let e = 0; e < 2; e++) {
      const j = k * 2 + e
      pos.set([t.x[i] + t.nx[i] * o, y0 + e * h, t.z[i] + t.nz[i] * o], j * 3)
      // Seen from the track, lettering on the right-hand wall runs against the direction of travel.
      uv.set([(o > 0 ? s : -s) / vScale, e], j * 2)
      nor.set([t.nx[i] * sg, 0, t.nz[i] * sg], j * 3)
    }
  }
  const idx: number[] = []
  for (let k = 0; k < n; k++) {
    const p = k * 2
    if (o > 0) idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3)
    else idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  g.setAttribute('normal', new BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

type Theme = { ground: string; groundTex: (rx: number) => Texture; verge: string; vergeTex: (rx: number, ry: number) => Texture; kerb: [string, string]; barrier: string; cap: string }
const THEMES: Record<string, Theme> = {
  town: { ground: '#ffffff', groundTex: (r) => grassTex(r, r), verge: '#ffffff', vergeTex: (a, b) => grassTex(a, b), kerb: ['#e53935', '#fafafa'], barrier: '#eceff1', cap: '#c62828' },
  docks: { ground: '#9aa3a9', groundTex: (r) => concreteTex(r, r), verge: '#b0b6ba', vergeTex: (a, b) => concreteTex(a, b), kerb: ['#fbc02d', '#212121'], barrier: '#cfd8dc', cap: '#fbc02d' },
  desert: { ground: '#d9a066', groundTex: (r) => sandTex(r, r), verge: '#c9925a', vergeTex: (a, b) => gravelTex(a, b), kerb: ['#e53935', '#fafafa'], barrier: '#d7ccc8', cap: '#1565c0' },
}

// The ghost racing line (kart.ts racingLine): dashes along the best line, green where it's
// flat out, amber, then red before a bend that needs braking. Only this player sees it.
const LINE_COLS = [new Color('#39e07a'), new Color('#ffc23d'), new Color('#ff4d4d')]
function RacingLine({ t }: { t: Track }) {
  const geo = useMemo(() => {
    const { off, heat } = racingLine(t)
    const pos: number[] = [], col: number[] = []
    const c = new Color()
    const W = 0.16, DASH = 1.6
    let s = 0
    for (let i = 0; i < t.n; i++) {
      const j = (i + 1) % t.n
      const step = Math.hypot(t.x[j] - t.x[i], t.z[j] - t.z[i])
      s += step
      if (Math.floor(s / DASH) % 2) continue
      const h = heat[i]
      if (h < 0.5) c.copy(LINE_COLS[0]).lerp(LINE_COLS[1], h * 2)
      else c.copy(LINE_COLS[1]).lerp(LINE_COLS[2], (h - 0.5) * 2)
      const p = (k: number, o: number) => [t.x[k] + t.nx[k] * o, Y_PAINT + 0.006, t.z[k] + t.nz[k] * o]
      const a0 = p(i, off[i] - W), a1 = p(i, off[i] + W), b0 = p(j, off[j] - W), b1 = p(j, off[j] + W)
      // Both windings, so it faces up whichever way the normals point.
      for (const v of [a0, b0, a1, a1, b0, b1, a0, a1, b0, a1, b1, b0]) { pos.push(...v); col.push(c.r, c.g, c.b) }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
    return g
  }, [t])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo} renderOrder={1}>
      <meshBasicMaterial vertexColors transparent opacity={0.6} depthWrite={false} {...decal(3)} />
    </mesh>
  )
}

function TrackSurface({ t }: { t: Track }) {
  const th = THEMES[t.def.theme]
  const geo = useMemo(() => {
    const kw = 0.55
    return {
      road: ribbon(t, -t.half, t.half, Y_ROAD, 4, t.half / 2),
      kerbL: ribbon(t, t.half, t.half + kw, Y_KERB, 2),
      kerbR: ribbon(t, -t.half - kw, -t.half, Y_KERB, 2),
      vergeL: ribbon(t, t.half + kw, t.wall + 0.3, 0.012, 3, 1),
      vergeR: ribbon(t, -t.wall - 0.3, -t.half - kw, 0.012, 3, 1),
      lineL: ribbon(t, t.half - 0.32, t.half - 0.2, Y_PAINT, 4),
      lineR: ribbon(t, -t.half + 0.2, -t.half + 0.32, Y_PAINT, 4),
      wallL: wallGeo(t, t.wall, 0, 0.62, 16),
      wallR: wallGeo(t, -t.wall, 0, 0.62, 16),
      capL: ribbon(t, t.wall - 0.06, t.wall + 0.22, 0.64, 4),
      capR: ribbon(t, -t.wall - 0.22, -t.wall + 0.06, 0.64, 4),
      backL: wallGeo(t, t.wall + 0.22, 0, 0.64, 16),
      backR: wallGeo(t, -t.wall - 0.22, 0, 0.64, 16),
    }
  }, [t])
  const road = useMemo(() => { const a = asphaltTex().clone(); a.needsUpdate = true; return a }, [])
  const verge = th.vergeTex(1, 1)
  const ad = adTex()
  return (
    <group>
      <mesh geometry={geo.road} receiveShadow><meshStandardMaterial map={road} roughness={0.92} /></mesh>
      {[geo.kerbL, geo.kerbR].map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial map={kerbTex(...th.kerb)} roughness={0.6} {...decal(1)} /></mesh>)}
      {[geo.vergeL, geo.vergeR].map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial map={verge} color={th.verge} /></mesh>)}
      {[geo.lineL, geo.lineR].map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial color="#f5f5f5" {...decal(2)} /></mesh>)}
      {[geo.wallL, geo.wallR].map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial map={ad} roughness={0.5} /></mesh>)}
      {[geo.backL, geo.backR].map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial color={th.barrier} side={DoubleSide} /></mesh>)}
      {[geo.capL, geo.capR].map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial color={th.cap} side={DoubleSide} /></mesh>)}
      <StartLine t={t} />
      {t.boosts.map((p, i) => (
        <mesh key={i} position={[p.x, Y_PAINT + 0.004, p.z]} rotation={[-Math.PI / 2, 0, p.h + Math.PI]}>
          <planeGeometry args={[p.w, p.l]} />
          <meshStandardMaterial map={boostTex()} emissive="#ff6d00" emissiveIntensity={0.55} emissiveMap={boostTex()} {...decal(3)} />
        </mesh>
      ))}
      {t.ramps.map((p, i) => <Ramp key={i} p={p} />)}
    </group>
  )
}

// A jump: a striped kicker up, a flat top, and a kicker down the far side, so it works both ways round.
function Ramp({ p }: { p: Track['ramps'][number] }) {
  const h = 0.5
  return (
    <group position={[p.x, 0, p.z]} rotation-y={p.h}>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[0, h / 2, sd * p.l * 0.33]} rotation-x={sd * 0.42}>
          <boxGeometry args={[p.w, 0.06, p.l * 0.4]} />
          <meshStandardMaterial map={rampTex()} />
        </mesh>
      ))}
      <mesh position={[0, h / 2 - 0.02, 0]}><boxGeometry args={[p.w - 0.02, h - 0.04, p.l * 0.5]} /><meshStandardMaterial color="#455a64" /></mesh>
      {[-1, 1].map((sd) => <mesh key={sd} position={[sd * (p.w / 2 + 0.06), h / 2, 0]}><boxGeometry args={[0.12, h + 0.1, p.l * 0.9]} /><meshStandardMaterial color="#ffd600" /></mesh>)}
    </group>
  )
}

// Chequered line, painted grid boxes, and a gantry with the start lights.
function StartLine({ t }: { t: Track }) {
  const h = Math.atan2(t.tx[0], t.tz[0])
  const w = t.wall * 2 + 0.6
  const check = useMemo(() => { const c = checkerTex(1).clone(); c.repeat.set(t.half * 2 / 0.5, 2); c.needsUpdate = true; return c }, [t])
  const boxes = useMemo(() => Array.from({ length: 6 }, (_, k) => {
    const row = Math.floor(k / 2), col = k % 2 ? -1 : 1
    const i = (t.n - 6 - row * 4 + t.n) % t.n
    const off = col * t.half * 0.45 + (row % 2 ? 0.4 : -0.4)
    return { x: t.x[i] + t.nx[i] * off, z: t.z[i] + t.nz[i] * off, h: Math.atan2(t.tx[i], t.tz[i]) }
  }), [t])
  return (
    <group>
      <mesh position={[t.x[0], Y_PAINT + 0.003, t.z[0]]} rotation={[-Math.PI / 2, 0, h]}>
        <planeGeometry args={[t.half * 2, 1]} />
        <meshStandardMaterial map={check} {...decal(3)} />
      </mesh>
      {boxes.map((b, i) => (
        <group key={i} position={[b.x, Y_PAINT, b.z]} rotation-y={b.h}>
          {[[-0.55, 0, 0.08, 1.6], [0.55, 0, 0.08, 1.6], [0, 0.78, 1.18, 0.08]].map(([x, z, ww, l], j) => (
            <mesh key={j} position={[x, 0.002, z]} rotation-x={-Math.PI / 2}><planeGeometry args={[ww, l]} /><meshStandardMaterial color="#fafafa" {...decal(2)} /></mesh>
          ))}
        </group>
      ))}
      <group position={[t.x[0], 0, t.z[0]]} rotation-y={h}>
        {[-1, 1].map((sd) => <Box key={sd} p={[sd * w / 2, 2.3, 0]} s={[0.4, 4.6, 0.4]} c="#37474f" />)}
        <Box p={[0, 4.4, 0]} s={[w + 0.4, 0.9, 0.5]} c="#263238" />
        {[1, -1].map((f) => (
          <mesh key={f} position={[0, 4.4, f * 0.26]} rotation-y={f > 0 ? 0 : Math.PI}>
            <planeGeometry args={[w * 0.62, 0.7]} />
            <meshBasicMaterial map={signTexture('CARTOPIA GRAND PRIX', '#c62828', '#ffffff', (w * 0.62) / 0.7)} toneMapped={false} />
          </mesh>
        ))}
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * (w * 0.31 + 0.9), 4.4, -0.26]} rotation-y={Math.PI}>
            <planeGeometry args={[1.4, 0.7]} />
            <meshBasicMaterial map={checkerTex(2)} />
          </mesh>
        ))}
        <StartLights w={w} />
      </group>
    </group>
  )
}

// Five red lights on the gantry, lit one by one in the countdown and out together at GO.
export const kartLights = { n: 0 }
function StartLights({ w }: { w: number }) {
  const mats = useMemo(() => Array.from({ length: 5 }, () => new MeshStandardMaterial({ color: '#3a1010', emissive: '#ff1744', emissiveIntensity: 0 })), [])
  useFrame(() => mats.forEach((m, i) => {
    const on = i < kartLights.n
    m.emissiveIntensity = on ? 2.2 : 0
    m.color.set(on ? '#ff1744' : '#3a1010')
  }))
  return (
    <group position={[0, 3.6, -0.3]}>
      <Box p={[0, 0, 0]} s={[3.4, 0.6, 0.3]} c="#111111" />
      {mats.map((m, i) => (
        <mesh key={i} position={[-1.3 + i * 0.65, 0, -0.17]} rotation-x={Math.PI / 2} material={m}>
          <cylinderGeometry args={[0.2, 0.2, 0.05, 14]} />
        </mesh>
      ))}
      <Box p={[w * 0.12, 0.55, 0]} s={[0.1, 0.5, 0.1]} c="#111111" />
    </group>
  )
}

// ---------- scenery ----------

// Spots beside the track: walking the centre line, `off` beyond the barrier on either side,
// skipping any spot that would land within `clear` of another stretch of track.
function Building({ def, x, z, ry, s = 1 }: { def: string; x: number; z: number; ry: number; s?: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={ry} scale={s}>
      <BuildingModel def={buildingDef(def)} />
    </group>
  )
}

// Grandstands and a crowd along the start straight, tyre walls on the outside of tight bends.
function Trackside({ t }: { t: Track }) {
  const { along, outside, clearOf } = useSpots(t)
  const zones = useFanZones(t)
  const far = useFansFar()
  const stands = useMemo(() => {
    const out: { x: number; z: number; h: number; w: number }[] = []
    for (const [i0, side] of [[(t.n - 22) % t.n, 1], [8, -1], [(t.n - 40) % t.n, -1]] as [number, -1 | 1][]) {
      const o = side * (t.wall + 2.6)
      const x = t.x[i0] + t.nx[i0] * o, z = t.z[i0] + t.nz[i0] * o
      if (clearOf(x, z, t.wall + 2)) out.push({ x, z, h: Math.atan2(-t.nx[i0] * side, -t.nz[i0] * side), w: 14 })
    }
    return out
  }, [t, clearOf])
  const tyres = useMemo(() => {
    const out: { x: number; z: number }[] = []
    for (let i = 0; i < t.n; i += 3) {
      if (Math.abs(t.curve[i]) < 0.07) continue
      const sd = outside(i)
      for (const extra of [0.55, 1.05]) {
        const o = sd * (t.wall + extra)
        out.push({ x: t.x[i] + t.nx[i] * o, z: t.z[i] + t.nz[i] * o })
      }
    }
    return out.filter((p) => clearOf(p.x, p.z, t.wall + 0.2))
  }, [t, outside, clearOf])
  const marshals = useMemo(() => along(38, 1.4, 1, 1, 91).concat(along(46, 1.4, -1, 1, 97)).filter((m) => !nearZone(zones, m.x, m.z)), [along, zones])
  const fans = useMemo(() => {
    const out: Person[] = []
    for (const p of along(9, 2.2, 1, 1.5, 41).concat(along(11, 2.2, -1, 1.5, 43))) {
      if (p.r() < 0.45 || nearZone(zones, p.x, p.z)) continue
      const n = 2 + Math.floor(p.r() * 4)
      for (let k = 0; k < n; k++) out.push({ x: p.x + (p.r() - 0.5) * 2.4, z: p.z + (p.r() - 0.5) * 2.4, h: p.ry + (p.r() - 0.5) * 0.6, cheer: p.r() < 0.5 })
    }
    return out
  }, [along, zones])
  return (
    <group>
      {stands.map((s, i) => <Grandstand key={i} x={s.x} z={s.z} h={s.h} width={s.w} rows={5} roof={i % 2 ? '#1565c0' : '#c62828'} far={far} />)}
      <Fans people={fans} />
      <Batch version={t.n} cell={24} freeze>
        {tyres.map((p, i) => <TyreStack key={i} x={p.x} z={p.z} n={3} band={i % 2 ? '#e53935' : '#fafafa'} />)}
        {marshals.map((m, i) => (
          <group key={i} position={[m.x, 0, m.z]} rotation-y={m.ry}>
            <Box p={[0, 0.9, 0]} s={[1.4, 1.8, 1.0]} c="#eceff1" />
            <Box p={[0, 1.85, 0]} s={[1.6, 0.1, 1.2]} c="#ff6f00" />
            <Box p={[0, 1.0, 0.51]} s={[1.0, 0.5, 0.02]} c="#90caf9" />
            <Cyl p={[0.6, 2.4, 0]} r={0.025} h={1.1} c="#9e9e9e" />
            <Box p={[0.85, 2.75, 0]} s={[0.5, 0.32, 0.02]} c={i % 2 ? '#fdd835' : '#43a047'} />
          </group>
        ))}
      </Batch>
    </group>
  )
}

// The player's own town shops round the outside, a park in the middle, office towers beyond.
function TownScenery({ t }: { t: Track }) {
  const pool = useTownPool()
  const { along, clearOf } = useSpots(t)
  const zones = useFanZones(t)
  const r = useMemo(() => rand(17), [])
  const shops = useMemo(() => {
    const out: { def: string; x: number; z: number; ry: number }[] = []
    let k = 0
    for (const side of [1, -1] as const) for (const p of along(6.5, 4.6, side, 4.2, 5 + side)) {
      const def = pool[k++ % pool.length]
      const d = buildingDef(def)
      if (d.w * TILE > 6 || d.h * TILE > 6 || nearZone(zones, p.x, p.z, ZONE_R + 2)) continue
      out.push({ def, x: p.x, z: p.z, ry: p.ry })
    }
    return out
  }, [along, pool, zones])
  const trees = useMemo(() => {
    const out: { x: number; z: number; def: string; s: number }[] = []
    for (let k = 0; k < 900 && out.length < 150; k++) {
      const x = (r() - 0.5) * 160, z = (r() - 0.5) * 150
      if (!clearOf(x, z, t.wall + 2.5) || nearZone(zones, x, z)) continue
      if (shops.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 20)) continue
      out.push({ x, z, def: r() < 0.3 ? 'pine' : r() < 0.15 ? 'bush' : 'tree', s: 0.9 + r() * 0.5 })
    }
    return out
  }, [r, clearOf, shops, t, zones])
  const props = useMemo(() => along(14, 0.9, 1, 0.6, 61).concat(along(14, 0.9, -1, 0.6, 67)), [along])
  const towers = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2 + r() * 0.1, d = 105 + r() * 25
    return { x: Math.cos(a) * d * 1.1, z: Math.sin(a) * d, w: 6 + r() * 6, h: 10 + r() * 26 }
  }), [r])
  const tex = useMemo(() => { const c = towerTex().clone(); c.repeat.set(2, 4); c.needsUpdate = true; return c }, [])
  return (
    <group>
      <Batch version={t.n + 1} cell={24} freeze>
        {shops.map((s, i) => <Building key={i} def={s.def} x={s.x} z={s.z} ry={s.ry} />)}
        {trees.map((p, i) => <Building key={i} def={p.def} x={p.x} z={p.z} ry={i} s={p.s} />)}
        {towers.map((b, i) => (
          <mesh key={i} position={[b.x, b.h / 2, b.z]}>
            <boxGeometry args={[b.w, b.h, b.w]} />
            <meshStandardMaterial map={tex} color={i % 3 ? '#cfd8dc' : '#b0bec5'} />
          </mesh>
        ))}
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}><planeGeometry args={[420, 420]} /><meshStandardMaterial map={grassTex(70, 70)} /></mesh>
      </Batch>
      {props.map((p, i) => <Lamp key={i} x={p.x} z={p.z} ry={p.ry} />)}
    </group>
  )
}

// A harbour: open water inside the circuit, container stacks, cranes, sheds and a lighthouse outside.
function DocksScenery({ t }: { t: Track }) {
  const { along, clearOf } = useSpots(t)
  const r = useMemo(() => rand(29), [])
  const colors = ['#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#00838f', '#6d4c41']
  const stacks = useMemo(() => {
    const out: { x: number; z: number; y: number; ry: number; c: number }[] = []
    for (const side of [1, -1] as const) for (const p of along(4.2, 2.6, side, 2.2, 31 + side, 0.8)) {
      if (p.r() < 0.25) continue
      const n = 1 + Math.floor(p.r() * 3)
      for (let k = 0; k < n; k++) out.push({ x: p.x, z: p.z, y: 0.6 + k * 1.2, ry: p.ry + Math.PI / 2, c: Math.floor(p.r() * colors.length) })
    }
    return out
  }, [along, colors.length])
  const cranes = useMemo(() => along(70, 7, 1, 6, 37).concat(along(80, 7, -1, 6, 39)), [along])
  // The start straight sits on a wide quay, so its grandstands and pit garages stand on land.
  const startIdx = useMemo(() => Array.from({ length: t.n }, (_, i) => i).filter((i) => i < 14 || i > t.n - 46), [t])
  const onStart = useCallback((x: number, z: number, d: number) => startIdx.some((i) => (t.x[i] - x) ** 2 + (t.z[i] - z) ** 2 < d * d), [startIdx, t])
  // Spectator boats moored off the quay (never by the start straight or under a crane).
  const boats = useMemo(() => {
    const out: BoatSpot[] = []
    for (const side of [1, -1] as const) for (const p of along(38, 8.6, side, 7, 43 + side)) {
      const ends = [-6, 6].map((lx) => local(p, lx, 0))
      if (!ends.every((e) => clearOf(e.x, e.z, t.wall + 6.4)) || onStart(p.x, p.z, t.wall + 16)) continue
      if (cranes.some((c) => (c.x - p.x) ** 2 + (c.z - p.z) ** 2 < 13 * 13) || out.some((b) => (b.x - p.x) ** 2 + (b.z - p.z) ** 2 < 16 * 16)) continue
      out.push({ x: p.x, z: p.z, ry: p.ry, k: out.length })
    }
    return out
  }, [along, clearOf, onStart, cranes, t])
  const boatFans = useMemo(() => boatPeople(boats), [boats])
  // Water fills the infield: wherever the grid says there's no track or quay.
  const quay = useMemo(() => {
    const out: { x: number; z: number }[] = []
    for (let x = -90; x <= 90; x += 4) for (let z = -80; z <= 80; z += 4) if (!clearOf(x, z, t.wall + 3.5) || onStart(x, z, t.wall + 9)) out.push({ x, z })
    return out
  }, [clearOf, onStart, t])
  const yard = useMemo(() => {
    const out = { barrels: [] as { x: number; z: number; ry: number }[], crates: [] as { x: number; z: number; ry: number }[] }
    for (let k = 0; k < 600; k++) {
      const x = (r() - 0.5) * 170, z = (r() - 0.5) * 150
      if (!clearOf(x, z, t.wall + 0.8) || clearOf(x, z, t.wall + 3)) continue
      ;(r() < 0.5 ? out.barrels : out.crates).push({ x, z, ry: r() * 6 })
    }
    return out
  }, [r, clearOf, t])
  return (
    <group>
      <group position-y={-0.33}><Water x={0} z={0} w={500} d={500} id="kartdocks" color="#8fd0f5" rough={0.6} /></group>
      <Batch version={t.n + 2} cell={24} freeze>
        {/* Concrete quay under the whole circuit, so the track sits on land with water round it. */}
        {quay.map((q, i) => <mesh key={i} position={[q.x, -0.22, q.z]}><boxGeometry args={[4.02, 0.44, 4.02]} /><meshStandardMaterial map={concreteTex(1, 1)} color="#b0b6ba" /></mesh>)}
        {stacks.map((s, i) => (
          <mesh key={i} position={[s.x, s.y, s.z]} rotation-y={s.ry} scale={[1.15, 1.2, 2.8]}>
            <boxGeometry />
            <meshStandardMaterial map={containerTex()} color={colors[s.c]} />
          </mesh>
        ))}
        {cranes.map((c, i) => (
          <group key={i} position={[c.x, 0, c.z]} rotation-y={c.ry}>
            {/* A concrete pier out to the crane's back legs. */}
            <mesh position={[0, -0.22, 0.6]}><boxGeometry args={[4.6, 0.44, 6.4]} /><meshStandardMaterial map={concreteTex(1, 1.4)} color="#b0b6ba" /></mesh>
            {[-1.6, 1.6].map((dx) => [-1.6, 1.6].map((dz) => <Box key={`${dx}${dz}`} p={[dx, 4.5, dz]} s={[0.35, 9, 0.35]} c="#fbc02d" />))}
            <Box p={[0, 9, 0]} s={[3.6, 0.5, 3.6]} c="#fbc02d" />
            <Box p={[0, 9.8, 4]} s={[0.7, 0.6, 16]} c="#fbc02d" />
            <Box p={[0, 10.4, -1]} s={[2, 1.4, 2.4]} c="#c62828" />
            <Box p={[0, 7.4, 8]} s={[0.05, 4.2, 0.05]} c="#263238" />
            <Box p={[0, 5.3, 8]} s={[1.3, 0.3, 2.8]} c="#455a64" />
          </group>
        ))}
      </Batch>
      <Scatter spots={yard.barrels} colors={['#c62828', '#1565c0', '#2e7d32', '#fbc02d']} y={0.22}><cylinderGeometry args={[0.2, 0.2, 0.5, 10]} /></Scatter>
      <Scatter spots={yard.crates} colors={['#a1795a', '#8d6e63', '#b08968']} y={0.25}><boxGeometry args={[0.5, 0.5, 0.5]} /></Scatter>
      <Lighthouse x={-20} z={10} />
      <Boats />
      <SpectatorBoats boats={boats} />
      <Fans people={boatFans} />
    </group>
  )
}

function Lighthouse({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Cyl p={[0, 0.5, 0]} r={2.6} h={1} c="#9aa3a9" seg={12} />
      {[0, 1, 2, 3, 4].map((i) => <Cyl key={i} p={[0, 1.9 + i * 1.8, 0]} r={1.15 - i * 0.12} h={1.8} c={i % 2 ? '#ffffff' : '#c62828'} seg={12} />)}
      <Cyl p={[0, 10.1, 0]} r={0.9} h={0.2} c="#263238" seg={12} />
      <mesh position={[0, 10.6, 0]}><cylinderGeometry args={[0.55, 0.55, 0.8, 12]} /><primitive object={glowMats.bulb} attach="material" dispose={null} /></mesh>
      <Cone p={[0, 11.35, 0]} r={0.75} h={0.7} c="#263238" seg={12} />
    </group>
  )
}

// Small boats bobbing in the basin.
function Boats() {
  const refs = useRef<(Group | null)[]>([])
  const boats = useMemo(() => [{ x: -8, z: 22, c: '#c62828' }, { x: 14, z: 30, c: '#1565c0' }, { x: -30, z: 18, c: '#fafafa' }, { x: 2, z: 12, c: '#fbc02d' }], [])
  useFrame(({ clock }) => boats.forEach((_, i) => {
    const g = refs.current[i]
    if (!g) return
    const t = clock.elapsedTime + i * 1.3
    g.position.y = Math.sin(t * 1.4) * 0.06
    g.rotation.z = Math.sin(t * 1.1) * 0.05
  }))
  return (
    <>
      {boats.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation-y={i * 1.7}>
          <group ref={(g) => { refs.current[i] = g }}>
            <Box p={[0, 0.2, 0]} s={[1.3, 0.5, 3.4]} c={b.c} />
            <Box p={[0, 0.48, 0.2]} s={[1.1, 0.06, 2.6]} c="#d7ccc8" />
            <Box p={[0, 0.85, -0.3]} s={[0.9, 0.7, 1.1]} c="#eceff1" />
            <Box p={[0, 1.4, -0.3]} s={[0.05, 0.6, 0.05]} c="#455a64" />
          </group>
        </group>
      ))}
    </>
  )
}

// Red rock canyon: banded mesas and spires round the outside, saguaros, scrub and a roadside stop.
function DesertScenery({ t }: { t: Track }) {
  const { along, clearOf } = useSpots(t)
  const zones = useFanZones(t)
  const r = useMemo(() => rand(53), [])
  const strata = ['#b5532f', '#c8693a', '#a84a2a', '#d4844e']
  const mesas = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; h: number; ry: number; spire: boolean }[] = []
    for (let k = 0; k < 700 && out.length < 60; k++) {
      const x = (r() - 0.5) * 220, z = (r() - 0.5) * 200
      const w = 5 + r() * 9
      if (!clearOf(x, z, t.wall + w * 0.8 + 3) || nearZone(zones, x, z, ZONE_R + w * 0.6)) continue
      if (out.some((m) => (m.x - x) ** 2 + (m.z - z) ** 2 < (w + m.w) ** 2 * 0.35)) continue
      out.push({ x, z, w, d: 4 + r() * 8, h: 3 + r() * 10, ry: r() * 3, spire: r() < 0.25 })
    }
    return out
  }, [r, clearOf, t, zones])
  const saguaros = useMemo(() => along(5, 1.2, 1, 1, 71, 5).concat(along(5, 1.2, -1, 1, 73, 5)).map((p) => ({ ...p, h: 1.4 + p.r() * 1.2, arm: p.r() })).filter((p) => !nearZone(zones, p.x, p.z)), [along, zones])
  const small = useMemo(() => along(6, 0.5, 1, 0.3, 79, 2).concat(along(6, 0.5, -1, 0.3, 83, 2)).map((p) => ({ ...p, def: p.r() < 0.6 ? 'cactus' : 'rock' })).filter((p) => !nearZone(zones, p.x, p.z, 7.5)), [along, zones])
  const scrub = useMemo(() => {
    const out: { x: number; z: number; s: number; ry: number }[] = []
    for (let k = 0; k < 3000 && out.length < 700; k++) {
      const x = (r() - 0.5) * 200, z = (r() - 0.5) * 180
      if (clearOf(x, z, t.wall + 0.4) && !nearZone(zones, x, z, 7)) out.push({ x, z, s: 0.6 + r() * 0.8, ry: r() * 6 })
    }
    return out
  }, [r, clearOf, t, zones])
  const stop = useMemo(() => along(200, 5, 1, 5, 89)[0], [along])
  return (
    <group>
      <Batch version={t.n + 3} cell={24} freeze>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}><planeGeometry args={[460, 460]} /><meshStandardMaterial map={sandTex(60, 60)} color="#e7b98a" /></mesh>
        {mesas.map((m, i) => (
          <group key={i} position={[m.x, 0, m.z]} rotation-y={m.ry}>
            {m.spire ? (
              <>
                <Box p={[0, m.h * 0.35, 0]} s={[m.w * 0.35, m.h * 0.7, m.d * 0.35]} c={strata[0]} />
                <Box p={[0, m.h * 0.85, 0]} s={[m.w * 0.24, m.h * 0.3, m.d * 0.24]} c={strata[1]} />
                <Box p={[0, m.h + 0.12, 0]} s={[m.w * 0.3, 0.25, m.d * 0.3]} c={strata[3]} />
              </>
            ) : (
              <>
                <Box p={[0, m.h * 0.2, 0]} s={[m.w * 1.08, m.h * 0.4, m.d * 1.08]} c={strata[0]} />
                <Box p={[0, m.h * 0.52, 0]} s={[m.w, m.h * 0.26, m.d]} c={strata[1]} />
                <Box p={[0, m.h * 0.78, 0]} s={[m.w * 0.94, m.h * 0.28, m.d * 0.94]} c={strata[2]} />
                <Box p={[0, m.h + 0.15, 0]} s={[m.w * 0.98, 0.3, m.d * 0.98]} c={strata[3]} />
              </>
            )}
          </group>
        ))}
        {saguaros.map((c, i) => (
          <group key={i} position={[c.x, 0, c.z]} rotation-y={c.ry + i}>
            <Cyl p={[0, c.h / 2, 0]} r={0.14} h={c.h} c="#4f8a3a" />
            {[1, -1].map((sd) => ((sd > 0 ? c.arm > 0.25 : c.arm > 0.6) ? (
              <group key={sd}>
                <Cyl p={[sd * 0.22, c.h * 0.45, 0]} r={0.08} h={0.26} c="#4f8a3a" rot={[0, 0, Math.PI / 2]} />
                <Cyl p={[sd * 0.34, c.h * 0.6, 0]} r={0.085} h={c.h * 0.32} c="#4f8a3a" />
              </group>
            ) : null))}
          </group>
        ))}
        {small.map((o, i) => <Building key={i} def={o.def} x={o.x} z={o.z} ry={i} s={0.9} />)}
        {stop && (
          <group position={[stop.x, 0, stop.z]} rotation-y={stop.ry}>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, -2]}><planeGeometry args={[16, 7]} /><meshStandardMaterial map={gravelTex(6, 3)} color="#d9b98e" /></mesh>
            <Building def="gas" x={-5} z={-3} ry={0} />
            <Building def="diner" x={0} z={-3} ry={0} />
            <Building def="motel" x={5.5} z={-3} ry={0} />
          </group>
        )}
        {/* An old water tower on the infield. */}
        <group position={[2, 0, 2]}>
          {[-0.9, 0.9].map((dx) => [-0.9, 0.9].map((dz) => <Box key={`${dx}${dz}`} p={[dx, 2.2, dz]} s={[0.14, 4.4, 0.14]} c="#6d4c41" />))}
          <Cyl p={[0, 5.2, 0]} r={1.5} h={1.8} c="#8d6e63" seg={12} />
          <Cone p={[0, 6.5, 0]} r={1.6} h={0.8} c="#6d4c41" seg={12} />
        </group>
      </Batch>
      <Scatter spots={scrub} colors={['#c9a85c', '#b39550', '#d8bd72', '#9c8a4a', '#a8b28a']} y={0.12}><icosahedronGeometry args={[0.2, 0]} /></Scatter>
      <Palm x={stop?.x ?? 0} z={(stop?.z ?? 0) + 1} h={3.4} lean={0.2} />
    </group>
  )
}

// ---------- karts ----------

// Phantom mode turns the car see-through: each material swaps for a faded copy, and back.
const faded = new WeakMap<Material, Material>()
function ghostly(g: Object3D, on: boolean) {
  g.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh || Array.isArray(m.material)) return
    if (on && !m.userData.solid) {
      let f = faded.get(m.material)
      if (!f) {
        f = m.material.clone()
        f.transparent = true
        f.opacity = 0.35
        f.depthWrite = false
        faded.set(m.material, f)
      }
      m.userData.solid = m.material
      m.material = f
    } else if (!on && m.userData.solid) {
      m.material = m.userData.solid
      delete m.userData.solid
    }
  })
}

// Paint blobs: x (share of half width), on the deck (1) or bonnet (0), z nudge, size, colour.
const SPLATS: [number, number, number, number, string][] = [
  [-0.35, 0, 0.1, 0.32, '#ff4081'], [0.4, 0, -0.12, 0.26, '#ff4081'], [0.05, 0, 0.3, 0.2, '#00e5ff'],
  [-0.3, 1, 0, 0.24, '#ffea00'], [0.35, 1, 0.1, 0.2, '#00e5ff'],
]
type KartLook = ChaseCar
function KartView({ look, rig, set }: { look: KartLook; rig: WheelRig; set: (g: { root: Group | null; body: Group | null; fx: KartFx }) => void }) {
  const f = carFrame(look.body)
  const s = KART_LEN / f.len
  const fx = useMemo<KartFx>(() => ({ sparks: [], flame: null, shield: null, zap: null, magnet: null, ghost: null, rocket: null, rocketFlame: null, splat: null, car: null, ghosted: false }), [])
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  useLayoutEffect(() => set({ root: root.current, body: body.current, fx }), [set, fx])
  const back = -KART_LEN / 2 - 0.05
  const half = (f.wid * s) / 2
  return (
    <group ref={root}>
      <CarShadow len={KART_LEN} wid={f.wid * s} />
      <group ref={body}>
        <group scale={s} ref={(g) => { fx.car = g }}>
          <CarModel body={look.body as Body} model={look.model} color={look.color} finish={look.finish} skin={look.skin} modSkin={look.modSkin} panels={look.panels} trim={look.trim} mods={look.mods} rig={rig} beams />
          {/* Paint splat: wet blobs over the bonnet and the back deck (in the car's own units). */}
          <group ref={(g) => { fx.splat = g }} visible={false}>
            {SPLATS.map((b, n) => (
              <mesh key={n} position={[b[0] * f.wid * 0.5, (b[1] ? f.deck : f.hoodTop) + 0.012, (b[1] ? f.deckZ + 0.25 : f.hoodZ) + b[2]]} scale={[b[3], 0.03, b[3] * 1.25]}>
                <sphereGeometry args={[1, 12, 8]} />
                <meshStandardMaterial color={b[4]} roughness={0.15} />
              </mesh>
            ))}
          </group>
        </group>
        {[-1, 1].map((sd, k) => (
          <mesh key={sd} ref={(m) => { fx.sparks[k] = m }} position={[sd * half, 0.12, back + 0.25]} visible={false}>
            <sphereGeometry args={[0.16, 8, 6]} />
            <meshBasicMaterial color="#40c4ff" transparent opacity={0.9} toneMapped={false} depthWrite={false} />
          </mesh>
        ))}
        <mesh ref={(m) => { fx.flame = m }} position={[0, 0.3, back - 0.25]} rotation-x={-Math.PI / 2} visible={false}>
          <coneGeometry args={[0.18, 0.8, 10]} />
          <meshBasicMaterial color="#ffab40" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh ref={(m) => { fx.shield = m }} position={[0, 0.45, 0]} visible={false}>
          <sphereGeometry args={[1.25, 18, 12]} />
          <meshStandardMaterial color="#80d8ff" transparent opacity={0.28} emissive="#40c4ff" emissiveIntensity={0.6} depthWrite={false} />
        </mesh>
        {/* Static storm: a crackling cage of light round the kart. */}
        <mesh ref={(m) => { fx.zap = m }} position={[0, 0.5, 0]} visible={false}>
          <icosahedronGeometry args={[1.15, 1]} />
          <meshBasicMaterial color="#b388ff" wireframe transparent opacity={0.85} toneMapped={false} depthWrite={false} />
        </mesh>
        {/* Tow magnet: a red horseshoe magnet up on the roof, pointing ahead. */}
        <group ref={(g) => { fx.magnet = g }} position={[0, 1.25, 0.2]} visible={false}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.26, 0.09, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#e53935" roughness={0.4} />
          </mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * 0.26, 0, 0.12]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.09, 0.09, 0.24, 8]} />
              <meshStandardMaterial color="#cfd8dc" metalness={0.8} roughness={0.25} />
            </mesh>
          ))}
        </group>
        {/* Phantom mode: a pale shimmering shroud and a wispy tail. */}
        <group ref={(g) => { fx.ghost = g }} visible={false}>
          <mesh position={[0, 0.55, 0]} scale={[1, 0.75, 1.35]}>
            <sphereGeometry args={[1.25, 20, 14]} />
            <meshBasicMaterial color="#b388ff" transparent opacity={0.22} toneMapped={false} depthWrite={false} blending={AdditiveBlending} />
          </mesh>
          <mesh position={[0, 0.55, back - 0.7]} rotation-x={-Math.PI / 2}>
            <coneGeometry args={[0.5, 1.5, 12, 1, true]} />
            <meshBasicMaterial color="#b388ff" transparent opacity={0.25} toneMapped={false} depthWrite={false} side={DoubleSide} blending={AdditiveBlending} />
          </mesh>
        </group>
        {/* Rocket ride: a red rocket strapped over the back, fins and all, roaring. */}
        <group ref={(g) => { fx.rocket = g }} position={[0, 1.05, -0.15]} scale={0.8} visible={false}>
          <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.32, 0.32, 1.9, 16]} />
            <meshStandardMaterial color="#e53935" metalness={0.3} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.32]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.33, 0.33, 0.22, 16]} />
            <meshStandardMaterial color="#fafafa" metalness={0.3} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 1.25]} rotation-x={Math.PI / 2}>
            <coneGeometry args={[0.32, 0.6, 16]} />
            <meshStandardMaterial color="#fafafa" metalness={0.3} roughness={0.35} />
          </mesh>
          {[0, 1, 2, 3].map((n) => (
            <mesh key={n} rotation-z={(n * Math.PI) / 2 + Math.PI / 4} position={[0, 0, -0.75]}>
              <boxGeometry args={[0.05, 0.95, 0.5]} />
              <meshStandardMaterial color="#ffd600" roughness={0.5} />
            </mesh>
          ))}
          <mesh position={[0, 0, -0.98]} rotation-x={-Math.PI / 2}>
            <cylinderGeometry args={[0.22, 0.28, 0.14, 14]} />
            <meshStandardMaterial color="#37474f" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh ref={(m) => { fx.rocketFlame = m }} position={[0, 0, -1.75]} rotation-x={-Math.PI / 2}>
            <coneGeometry args={[0.26, 1.4, 12]} />
            <meshBasicMaterial color="#ffca28" transparent opacity={0.9} toneMapped={false} depthWrite={false} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
type KartFx = { sparks: (Mesh | null)[]; flame: Mesh | null; shield: Mesh | null; zap: Mesh | null; magnet: Group | null; ghost: Group | null; rocket: Group | null; rocketFlame: Mesh | null; splat: Group | null; car: Group | null; ghosted: boolean }

function Crates({ race }: { race: KartRace }) {
  const ref = useRef<InstancedMesh>(null)
  const tmp = useMemo(() => new Object3D(), [])
  const t = race.track
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const time = clock.elapsedTime
    t.crates.forEach((c, i) => {
      const since = race.t - race.crateTaken[i]
      const grow = since < 3 ? 0 : Math.min(1, (since - 3) * 3)
      tmp.position.set(c.x, 0.75 + Math.sin(time * 2.5 + i) * 0.12, c.z)
      tmp.rotation.set(0.5, time * 1.6 + i, 0.4)
      tmp.scale.setScalar(0.62 * grow + 0.0001)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, t.crates.length]} frustumCulled={false}>
      <boxGeometry />
      <meshStandardMaterial map={crateTex()} emissiveMap={crateTex()} emissive="#ffffff" emissiveIntensity={0.35} transparent opacity={0.92} />
    </instancedMesh>
  )
}

const STRIPS = 8, SPIKES = 9, CLOUDS = 6, PUFFS = 16, BOMBS = 4
function Hazards({ race }: { race: KartRace }) {
  const oil = useRef<InstancedMesh>(null)
  const bees = useRef<InstancedMesh>(null)
  const mats = useRef<InstancedMesh>(null)
  const spikes = useRef<InstancedMesh>(null)
  const puffs = useRef<InstancedMesh>(null)
  const bombs = useRef<InstancedMesh>(null)
  const blasts = useRef<InstancedMesh>(null)
  const fuses = useRef<InstancedMesh>(null)
  const cores = useRef<InstancedMesh>(null)
  const tmp = useMemo(() => new Object3D(), [])
  useFrame(({ clock }) => {
    const o = oil.current, b = bees.current, m = mats.current, sp = spikes.current, pf = puffs.current
    if (!o || !b || !m || !sp || !pf) return
    // Tack strips: the mat flat on the road and a row of steel spikes on it.
    for (let i = 0; i < STRIPS; i++) {
      const h = race.tacks[i]
      tmp.position.set(h?.x ?? 0, Y_PAINT + 0.012, h?.z ?? 0)
      // Flat on the road (x), then turned to lie across it (y): the mat's length runs side to side.
      tmp.rotation.set(-Math.PI / 2, h?.h ?? 0, 0, 'YXZ')
      tmp.scale.setScalar(h ? 1 : 0.0001)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
      for (let j = 0; j < SPIKES; j++) {
        const a = (j / (SPIKES - 1) - 0.5) * 2.3
        const side = h ? Math.cos(h.h) : 0, sideZ = h ? -Math.sin(h.h) : 0
        tmp.rotation.set(0, 0, 0, 'XYZ')
        tmp.position.set((h?.x ?? 0) + side * a + (j % 2 ? 0.18 : -0.18) * Math.sin(h?.h ?? 0), 0.16, (h?.z ?? 0) + sideZ * a + (j % 2 ? 0.18 : -0.18) * Math.cos(h?.h ?? 0))
        tmp.scale.setScalar(h ? 1 : 0.0001)
        tmp.updateMatrix()
        sp.setMatrixAt(i * SPIKES + j, tmp.matrix)
      }
    }
    m.instanceMatrix.needsUpdate = true
    sp.instanceMatrix.needsUpdate = true
    // Smoke: a churning cloud of grey puffs that swells, then thins away.
    const now = clock.elapsedTime
    for (let i = 0; i < CLOUDS; i++) {
      const c = race.smoke[i]
      const age = c ? race.t - c.t : 0
      const grow = Math.min(1, 0.4 + age * 1.5) * (c ? Math.min(1, (7 - age) / 1.5) : 0)
      for (let j = 0; j < PUFFS; j++) {
        const a = j * 2.4 + now * (0.3 + (j % 3) * 0.1)
        const r = SMOKE_R * (0.15 + ((j * 37) % 10) / 12)
        tmp.position.set((c?.x ?? 0) + Math.cos(a) * r * grow, 0.4 + (j % 5) * 0.32 + Math.sin(now * 0.8 + j) * 0.15 + age * 0.1, (c?.z ?? 0) + Math.sin(a) * r * grow)
        tmp.rotation.set(0, 0, 0)
        tmp.scale.setScalar(c ? Math.max(0.0001, (0.75 + (j % 4) * 0.22) * grow) : 0.0001)
        tmp.updateMatrix()
        pf.setMatrixAt(i * PUFFS + j, tmp.matrix)
      }
    }
    pf.instanceMatrix.needsUpdate = true
    for (let i = 0; i < 12; i++) {
      const h = race.oil[i]
      tmp.position.set(h?.x ?? 0, Y_PAINT + 0.01, h?.z ?? 0)
      tmp.rotation.set(-Math.PI / 2, 0, i)
      tmp.scale.setScalar(h ? 1 : 0.0001)
      tmp.updateMatrix()
      o.setMatrixAt(i, tmp.matrix)
    }
    o.instanceMatrix.needsUpdate = true
    for (let i = 0; i < 6; i++) {
      const h = race.hornets[i]
      tmp.position.set(h?.x ?? 0, 0.9 + Math.sin(clock.elapsedTime * 20 + i) * 0.08, h?.z ?? 0)
      tmp.rotation.set(0, clock.elapsedTime * 6, 0)
      tmp.scale.set(h ? 0.32 : 0.0001, h ? 0.24 : 0.0001, h ? 0.5 : 0.0001)
      tmp.updateMatrix()
      b.setMatrixAt(i, tmp.matrix)
    }
    b.instanceMatrix.needsUpdate = true
    // Bumper bombs: a black ball lobbed in an arc, then an orange blast that swells and fades.
    const bm = bombs.current, bl = blasts.current, fu = fuses.current
    if (bm && bl) {
      for (let i = 0; i < BOMBS; i++) {
        const h = race.bombs[i]
        const u = h ? Math.min(1, (race.t - h.t) / 0.8) : 0
        tmp.position.set(h ? h.sx + (h.x - h.sx) * u : 0, h ? 0.9 + Math.sin(u * Math.PI) * 5 : 0, h ? h.sz + (h.z - h.sz) * u : 0)
        tmp.rotation.set(u * 9, 0, u * 5)
        tmp.scale.setScalar(h && !h.boom ? 0.55 : 0.0001)
        tmp.updateMatrix()
        bm.setMatrixAt(i, tmp.matrix)
        // The lit fuse: a spark fizzing on top.
        tmp.position.y += 0.6
        tmp.rotation.set(0, 0, 0)
        tmp.scale.setScalar(h && !h.boom ? 0.12 + Math.random() * 0.1 : 0.0001)
        tmp.updateMatrix()
        fu?.setMatrixAt(i, tmp.matrix)
        const age = h?.boom ? race.t - h.t - 0.8 : -1
        tmp.position.set(h?.x ?? 0, 0.6, h?.z ?? 0)
        tmp.rotation.set(0, 0, 0)
        tmp.scale.setScalar(age >= 0 ? BOMB_R * Math.min(1, 0.35 + age * 4) : 0.0001)
        tmp.updateMatrix()
        bl.setMatrixAt(i, tmp.matrix)
        // A white-hot core that flashes up and shrinks away inside it.
        tmp.scale.setScalar(age >= 0 && age < 0.35 ? BOMB_R * 0.55 * (1 - age / 0.35) + 0.0001 : 0.0001)
        tmp.updateMatrix()
        cores.current?.setMatrixAt(i, tmp.matrix)
      }
      bm.instanceMatrix.needsUpdate = true
      bl.instanceMatrix.needsUpdate = true
      if (fu) fu.instanceMatrix.needsUpdate = true
      if (cores.current) cores.current.instanceMatrix.needsUpdate = true
      const fade = race.bombs.find((h) => h.boom)
      ;(bl.material as MeshBasicMaterial).opacity = fade ? Math.max(0, 0.75 - (race.t - fade.t - 0.8) * 1.2) : 0
    }
  })
  return (
    <>
      <instancedMesh ref={oil} args={[undefined, undefined, 12]} frustumCulled={false}>
        <circleGeometry args={[1, 16]} />
        <meshStandardMaterial color="#1a1a24" roughness={0.1} metalness={0.6} transparent opacity={0.9} {...decal(4)} />
      </instancedMesh>
      <instancedMesh ref={bees} args={[undefined, undefined, 6]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#ffd600" emissive="#ffab00" emissiveIntensity={0.6} />
      </instancedMesh>
      <instancedMesh ref={mats} args={[undefined, undefined, STRIPS]} frustumCulled={false}>
        <planeGeometry args={[2.8, 0.85]} />
        <meshStandardMaterial map={tackTex()} roughness={0.9} {...decal(4)} />
      </instancedMesh>
      <instancedMesh ref={spikes} args={[undefined, undefined, STRIPS * SPIKES]} frustumCulled={false}>
        <coneGeometry args={[0.1, 0.28, 5]} />
        <meshStandardMaterial color="#eceff1" metalness={0.9} roughness={0.2} />
      </instancedMesh>
      <instancedMesh ref={bombs} args={[undefined, undefined, BOMBS]} frustumCulled={false}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#1c1c22" metalness={0.6} roughness={0.25} />
      </instancedMesh>
      <instancedMesh ref={fuses} args={[undefined, undefined, BOMBS]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#ffea00" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={cores} args={[undefined, undefined, BOMBS]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color="#fff59d" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={blasts} args={[undefined, undefined, BOMBS]} frustumCulled={false}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshBasicMaterial color="#ff9100" transparent opacity={0.7} toneMapped={false} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={puffs} args={[undefined, undefined, CLOUDS * PUFFS]} frustumCulled={false}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color="#e3e6e8" emissive="#9aa3a8" emissiveIntensity={0.35} roughness={1} transparent opacity={0.6} depthWrite={false} />
      </instancedMesh>
    </>
  )
}

// ---------- the scene ----------

export type KartSceneProps = {
  race: KartRace
  looks: KartLook[] // one per kart, same order as race.karts
  me: number // the player's kart index
  input: KartInput
  running: boolean
  cam?: KartCam
  onHud: (h: KartHud) => void
  onEvents?: (e: KartEvent[]) => void
  onFinish: () => void
  afterStep?: () => void // live races: swap snapshots with the other browser
  lite?: boolean // a phone: fewer pixels, and fans drawn less far out
}

// Where each kart is drawn: between its last two race steps (see the frame loop).
type Pose = { x: number; z: number; h: number; y: number }
type Poses = { prev: Pose[]; cur: Pose[]; drawn: Pose[] }
const drawn = new WeakMap<KartRace, Pose[]>()
function drawnPoses(race: KartRace): Poses {
  const make = () => race.karts.map((k) => ({ x: k.x, z: k.z, h: k.h, y: k.y }))
  const p = { prev: make(), cur: make(), drawn: make() }
  drawn.set(race, p.drawn)
  return p
}
// The kart as drawn this frame (the ring under the player, tow beams); the race's own state if not drawn yet.
const drawnKart = (race: KartRace, i: number): Pose => drawn.get(race)?.[i] ?? race.karts[i]
const keep = (p: Pose, k: Pose) => { p.x = k.x; p.z = k.z; p.h = k.h; p.y = k.y }
function blend(out: Pose, a: Pose, b: Pose, t: number) {
  out.x = a.x + (b.x - a.x) * t
  out.z = a.z + (b.z - a.z) * t
  out.y = a.y + (b.y - a.y) * t
  out.h = a.h + wrapAngle(b.h - a.h) * t
}

// Memoised: the screen re-renders for its HUD ten times a second, and the scenery under here
// must not re-render with it (that alone ate most of a phone's frame). Callers pass stable callbacks.
export const KartScene = memo(KartSceneImpl)
function KartSceneImpl({ race, looks, me, input, running, cam = (DEV?.get('cam') as KartCam) ?? 'chase', onHud, onEvents, onFinish, afterStep, lite }: KartSceneProps) {
  useEffect(() => holdTown(), [])
  useEffect(() => {
    resetHero()
    return resetHero
  }, [])
  // Pixels follow Settings > Graphics: Saver draws at 1x, and Auto on a phone at up to 1.25x
  // (sharp enough on a small screen). The shared canvas goes back to normal after the race.
  const graphics = usePrefs((p) => p.graphics)
  const showLine = usePrefs((p) => p.kartLine)
  const light = graphics === 'saver' ? 2 : lite && graphics === 'auto' ? 1 : 0
  const setDpr = useThree((s) => s.setDpr)
  useEffect(() => {
    if (!light) return
    setDpr(light === 2 ? 1 : [1, 1.25])
    return () => setDpr([1, 1.5])
  }, [light, setDpr])
  const view = useArcadeLook()
  const t = race.track
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const tall = size.height > size.width
  const rigs = useMemo(() => looks.map((l) => wheelRig(l.body as Body)), [looks])
  const views = useRef<{ root: Group | null; body: Group | null; fx: KartFx }[]>([])
  const setters = useMemo(() => looks.map((_, i) => (g: { root: Group | null; body: Group | null; fx: KartFx }) => { views.current[i] = g }), [looks])
  // hero: seconds into the finish hero shot (heroShot.ts), -1 before it, -2 once it's over.
  const st = useRef({ acc: 0, hudAt: 0, finished: false, camPos: new Vector3(), camAt: new Vector3(), fov: 0, init: false, shake: 0, kick: 0, hero: -1 })
  const inputs = useMemo(() => race.karts.map(() => input), [race, input])
  const tmpV = useMemo(() => new Vector3(), [])
  const poses = useMemo(() => drawnPoses(race), [race])
  // Every kart lays a glowing ribbon behind it on a boost: nitro, a drift turbo, a boost pad.
  const trails = useMemo(() => looks.map(() => new BoostTrail()), [looks])
  useEffect(() => () => trails.forEach((t) => t.dispose()), [trails])
  // The player's own flair (game/flair.ts): their trail colour, and a celebration on a win.
  const trailId = useGame((g) => myTrail(g).id)
  useEffect(() => trails[me]?.setLook(trailDef(trailId).look), [trails, me, trailId])
  const cheerId = useGame((g) => myCheer(g).id)
  const cheer = useMemo(() => new Celebration(), [])
  useEffect(() => () => cheer.dispose(), [cheer])

  useFrame((state, raw) => {
    const s = st.current
    const dt = Math.min(raw, 1 / 20)
    s.acc += dt
    const step = 1 / 120
    const events: KartEvent[] = []
    if (AUTOPILOT && running) Object.assign(input, race.autoInput(race.karts[me], race.order(), false))
    if (warp > 0 && running) {
      for (let f = 0; f < warp * 120; f++) { Object.assign(input, race.autoInput(race.karts[me], race.order(), false)); race.step(step, inputs, true) }
      race.karts.forEach((k, i) => keep(poses.prev[i], k))
      warp = 0
      s.init = false
    }
    const ks = race.karts
    while (s.acc >= step) {
      s.acc -= step
      for (let i = 0; i < ks.length; i++) keep(poses.prev[i], ks[i])
      race.step(step, inputs, running)
      events.push(...race.events)
    }
    for (let i = 0; i < ks.length; i++) keep(poses.cur[i], ks[i])
    if (afterStep) {
      // Whatever the link copied in from the other browser (their items, finishes) counts too.
      race.events = []
      afterStep()
      events.push(...race.events)
      // A kart the link just moved (the other player's) is drawn where the link put it.
      for (let i = 0; i < ks.length; i++) if (ks[i].x !== poses.cur[i].x || ks[i].z !== poses.cur[i].z) { keep(poses.prev[i], ks[i]); keep(poses.cur[i], ks[i]) }
    }
    // The race steps 120 times a second whatever the screen's rate, so a frame can land between two
    // steps: everything is drawn that far between them. Without this, on a 90 or 120 Hz phone (or any
    // uneven frame) a frame got one step, two or none, and the camera and the world jolted along.
    const alpha = Math.min(1, s.acc / step)
    for (let i = 0; i < ks.length; i++) blend(poses.drawn[i], poses.prev[i], ks[i], alpha)
    // Feel: knocks shake the camera, a drift turbo kicks the view wider for a moment.
    // (Not with calm motion on: it follows the device's reduce-motion setting.)
    if (!calmFlashing()) for (const e of events) if (e.kart === me) {
      if (e.kind === 'wall' || e.kind === 'bump') s.shake = Math.max(s.shake, 0.18)
      else if (e.kind === 'hit' || e.kind === 'boom') s.shake = Math.max(s.shake, 0.45)
      else if (e.kind === 'land') s.shake = Math.max(s.shake, 0.12)
      else if (e.kind === 'turbo') s.kick = e.value === 2 ? 9 : 6
    }
    s.shake = Math.max(0, s.shake - dt * 1.6)
    s.kick = Math.max(0, s.kick - dt * 14)
    if (events.length) onEvents?.(events)
    const mine = race.karts[me]
    if (DEV) (window as unknown as { kart: unknown }).kart = { race, camera, scene: state.scene, gl: state.gl }
    if (DEV && running) devFx(race, me)
    if (mine.done !== null && !s.finished) {
      s.finished = true
      // Across the line: the hero shot round the player's own kart while it coasts on.
      s.hero = cam === 'chase' && heroWanted() ? 0 : -2
      heroShot.on = s.hero === 0
      // First over the line: the player's celebration round their kart.
      if (race.karts.every((k) => k === mine || k.done === null || k.done > mine.done!) && !reducedMotion()) cheer.start(cheerDef(cheerId), mine.x, mine.y, mine.z, KART_LEN)
      onFinish()
    }

    race.karts.forEach((k, i) => {
      const v = views.current[i]
      if (!v?.root || !v.body) return
      const p = poses.drawn[i]
      v.root.position.set(p.x, 0, p.z)
      v.root.rotation.y = p.h
      v.body.position.y = p.y
      const sp = Math.hypot(k.vx, k.vz)
      // Lean out of turns and a touch of pitch on jumps; spin when hit.
      v.body.rotation.set(k.air ? Math.max(-0.25, Math.min(0.25, -k.vy * 0.03)) : 0, k.spinYaw + k.drift * 0.32, -k.steer * Math.min(1, sp / 15) * 0.06 - k.drift * 0.05)
      const rig = rigs[i]
      for (const w of rig.steer) if (w) w.rotation.y = k.steer * 0.42
      const roll = (sp * dt) / (rig.radius * (KART_LEN / carFrame(looks[i].body as Body).len))
      for (const w of rig.spin) if (w) w.rotation.x = (w.rotation.x + roll) % (Math.PI * 2)
      const fx = v.fx
      const sparking = k.drift !== 0 && k.charge > DRIFT_BLUE * 0.6
      const color = k.charge >= DRIFT_ORANGE ? '#ff9100' : k.charge >= DRIFT_BLUE ? '#40c4ff' : '#fff59d'
      for (const m of fx.sparks) if (m) {
        m.visible = sparking && !k.air
        if (m.visible) {
          ;(m.material as MeshStandardMaterial).color.set(color)
          m.scale.setScalar(0.6 + Math.random() * 0.7)
        }
      }
      trails[i].update(dt, k.x - Math.sin(k.h) * KART_LEN * 0.5, 0.14 + k.y, k.z - Math.cos(k.h) * KART_LEN * 0.5, k.h, k.boost > 0)
      if (i === me) cheer.update(dt)
      if (fx.flame) {
        fx.flame.visible = k.boost > 0
        if (fx.flame.visible) fx.flame.scale.set(1, 0.8 + Math.random() * 0.8, 1)
      }
      if (fx.shield) fx.shield.visible = k.shield > 0
      if (fx.zap) {
        fx.zap.visible = k.emp > 0 && Math.random() > 0.25
        fx.zap.rotation.set(Math.random() * 6, Math.random() * 6, 0)
      }
      if (fx.magnet) fx.magnet.visible = k.tow > 0
      if (fx.car && fx.ghosted !== k.ghost > 0) {
        fx.ghosted = k.ghost > 0
        ghostly(fx.car, fx.ghosted)
      }
      if (fx.ghost) {
        fx.ghost.visible = k.ghost > 0
        if (fx.ghost.visible) fx.ghost.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 7) * 0.04)
      }
      if (fx.rocket) fx.rocket.visible = k.rocket > 0
      if (fx.rocketFlame && k.rocket > 0) fx.rocketFlame.scale.set(1, 0.8 + Math.random() * 0.7, 1)
      if (fx.splat) fx.splat.visible = k.splat > 0
      if (k.flat > 0) {
        // Down on one corner, thumping round on the flat.
        v.body.rotation.z += k.id % 2 ? -0.07 : 0.07
        v.body.position.y += Math.abs(Math.sin(state.clock.elapsedTime * 26)) * 0.05
      }
    })

    // Camera: on the drawn kart.
    const pm = poses.drawn[me]
    const fwd = tmpV.set(Math.sin(pm.h), 0, Math.cos(pm.h))
    const mv = Math.hypot(mine.vx, mine.vz)
    if (cam === 'sky') {
      // Dev overview: ?ang turns round the middle, ?at=x,z&d=dist looks at one spot.
      const a = Number(DEV?.get('ang') ?? 0), d = Number(DEV?.get('d') ?? 120)
      const [ax, az] = (DEV?.get('at') ?? '0,0').split(',').map(Number)
      camera.position.set(ax + Math.sin(a) * d, d * 0.79, az - Math.cos(a) * d)
      camera.lookAt(ax, 0, az)
      camera.fov = 55
      camera.far = 600
      state.scene.fog = null
    } else if (cam === 'top') {
      const want = new Vector3(pm.x, tall ? 30 : 24, pm.z - (tall ? 9 : 11))
      if (!s.init) s.camPos.copy(want)
      s.camPos.lerp(want, Math.min(1, dt * 4))
      camera.position.copy(s.camPos)
      camera.up.set(0, 1, 0)
      camera.lookAt(pm.x, 0, pm.z + 1.5)
      camera.fov = tall ? 62 : 46
    } else if (s.hero >= 0 && !heroShot.skip && s.hero + dt < HERO_TIME) {
      s.hero += dt
      heroCam(s.hero, pm.x, pm.y, pm.z, pm.h, KART_LEN, 1, KART_LEN * 2.2, s.camPos, s.camAt)
      camera.position.copy(s.camPos)
      camera.up.set(0, 1, 0)
      camera.lookAt(s.camAt)
      camera.fov = tall ? 60 : 42
      // The chase view eases back from here once it's over.
      s.fov = camera.fov
    } else {
      if (s.hero >= 0) {
        s.hero = -2
        heroShot.on = false
      }
      // Behind and above the kart; swings a little wide in a drift, pulls back on a boost.
      const back = (tall ? 7.4 : 6.0) + (mine.boost > 0 ? 0.6 : 0)
      const up = tall ? 3.7 : 3.0
      const swing = mine.drift * 0.35
      const hx = Math.sin(pm.h - swing), hz = Math.cos(pm.h - swing)
      const want = new Vector3(pm.x - hx * back, up + pm.y * 0.6, pm.z - hz * back)
      if (!s.init) s.camPos.copy(want)
      s.camPos.lerp(want, Math.min(1, dt * 7))
      // Never let the camera sink into a barrier: keep it a little above the wall top.
      camera.position.copy(s.camPos)
      if (s.shake > 0) {
        camera.position.x += (Math.random() - 0.5) * s.shake
        camera.position.y += (Math.random() - 0.5) * s.shake * 0.6
        camera.position.z += (Math.random() - 0.5) * s.shake
      }
      camera.up.set(0, 1, 0)
      const at = new Vector3(pm.x + fwd.x * 4, 0.55 + pm.y * 0.8, pm.z + fwd.z * 4)
      if (!s.init) s.camAt.copy(at)
      s.camAt.lerp(at, Math.min(1, dt * 10))
      camera.lookAt(s.camAt)
      const fov = (tall ? 70 : 58) + (mine.boost > 0 ? 7 : 0) + Math.min(5, mv * 0.2)
      s.fov += (fov - s.fov) * Math.min(1, dt * 4)
      camera.fov = (s.fov || fov) + s.kick
    }
    s.init = true
    camera.updateProjectionMatrix()

    if (state.clock.elapsedTime - s.hudAt > 0.1) {
      s.hudAt = state.clock.elapsedTime
      // Wrong way: the nose points back along the track while moving.
      const dir = t.tx[mine.idx] * Math.sin(mine.h) + t.tz[mine.idx] * Math.cos(mine.h)
      onHud({
        lap: Math.max(1, Math.min(3, mine.lap)), place: race.place(mine), item: mine.item, speed: mv, charge: mine.drift ? mine.charge : 0, boost: mine.boost > 0, t: race.t,
        dots: race.karts.map((k, i) => ({ x: k.x, z: k.z, me: i === me })), wrong: running && dir < -0.5 && mv > 2,
        fx: { flat: mine.flat, smoke: mine.smoke, emp: mine.emp, tow: mine.tow, shield: mine.shield, ghost: mine.ghost, splat: mine.splat, rocket: mine.rocket },
        uses: mine.uses,
      })
    }
  }, -1) // first, so everything else this frame (fans, the ring, tow beams) sees where the karts are drawn

  return (
    <FansFar.Provider value={[150, 110, 90][light]}>
      <ArcadeSky view={view} near={100} far={340} />
      <hemisphereLight args={['#ffffff', '#666666', 0.15]} />
      <Batch version={t.n * 10 + (t.reverse ? 1 : 0)} freeze>
        <TrackSurface t={t} />
      </Batch>
      {showLine && <RacingLine t={t} />}
      <Trackside t={t} />
      {t.def.theme === 'town' && <TownScenery t={t} />}
      {t.def.theme === 'docks' && <DocksScenery t={t} />}
      {t.def.theme === 'desert' && <DesertScenery t={t} />}
      <CommonExtras t={t} />
      <KartHorizon theme={t.def.theme} fog={view.fog} />
      {t.def.theme === 'town' && <TownExtras t={t} />}
      {t.def.theme === 'docks' && <DocksExtras t={t} />}
      {t.def.theme === 'desert' && <DesertExtras t={t} />}
      <Crates race={race} />
      <Hazards race={race} />
      <TowBeams race={race} />
      {looks.map((l, i) => <KartView key={i} look={l} rig={rigs[i]} set={setters[i]} />)}
      {trails.map((t, i) => <primitive key={i} object={t.mesh} dispose={null} />)}
      <primitive object={cheer.mesh} dispose={null} />
      {/* A warm glow pool under the player, so their kart reads at a glance. */}
      <PlayerRing race={race} me={me} />
    </FansFar.Provider>
  )
}

// Tow magnet: a pulsing violet beam from the kart to the one it is reeling in.
function TowBeams({ race }: { race: KartRace }) {
  const refs = useRef<(Mesh | null)[]>([])
  const a = useMemo(() => new Vector3(), [])
  const b = useMemo(() => new Vector3(), [])
  useFrame(({ clock }) => {
    race.karts.forEach((k, i) => {
      const m = refs.current[i]
      if (!m) return
      const o = k.tow > 0 && k.towTarget >= 0 ? drawnKart(race, k.towTarget) : null
      m.visible = !!o
      if (!o) return
      const p = drawnKart(race, i)
      a.set(p.x + Math.sin(p.h) * 0.4, 1.3 + p.y, p.z + Math.cos(p.h) * 0.4)
      b.set(o.x, 0.7 + o.y, o.z)
      m.position.copy(a).lerp(b, 0.5)
      m.lookAt(b)
      m.rotateX(Math.PI / 2)
      m.scale.set(1 + Math.sin(clock.elapsedTime * 30) * 0.35, a.distanceTo(b), 1 + Math.sin(clock.elapsedTime * 30) * 0.35)
    })
  })
  return (
    <>
      {race.karts.map((_, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m }} visible={false} frustumCulled={false}>
          <cylinderGeometry args={[0.07, 0.07, 1, 6, 1, true]} />
          <meshBasicMaterial color="#e040fb" transparent opacity={0.7} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

function PlayerRing({ race, me }: { race: KartRace; me: number }) {
  const ref = useRef<Mesh>(null)
  useFrame(() => {
    const k = drawnKart(race, me)
    ref.current?.position.set(k.x, Y_PAINT + 0.02, k.z)
  })
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[3.2, 3.2]} />
      <meshBasicMaterial map={glowTex()} color={new Color('#ffd54f')} transparent opacity={0.35} depthWrite={false} {...decal(5)} />
    </mesh>
  )
}
