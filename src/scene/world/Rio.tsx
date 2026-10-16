import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, ExtrudeGeometry, MeshStandardMaterial, RepeatWrapping, Shape, SRGBColorSpace, type Mesh } from 'three'
import { glowMats } from '../dayNight'
import { Batch } from '../Batch'
import { EDGE, Horizon, coconutPalm, Many, PropMesh, Scatter, Sparkles, Water, frustum, glow, prop, rand, useProp, type Look, type PropKit, type Spot } from './kit'
import type { WorldProps } from './WorldVenue'

// Brazil, Carnival Coast: a night run down the beachfront avenue. Right: the black-and-white
// wave promenade, the beach with its kiosks, lifeguard posts and volleyball nets, the surf
// rolling in. Left: tall white beach hotels with lit balconies. Halfway, the old white
// aqueduct arches stride over the road with the little yellow tram on top; by the finish the
// tiled stairway climbs the hill in every colour. Ahead, the sugarloaf rocks with their cable
// car, and the open-armed statue lit on its peak above the hillside lights.

const WIN: Look = { c: '#ffffff', use: glowMats.window }
const WHITE: Look = { c: '#f1eee6', r: 0.85 }
const CREAM: Look = { c: '#e4dccb', r: 0.9 }
const DARK: Look = { c: '#26292c', r: 1 }
const GLASS: Look = { c: '#5d7a86', r: 0.15, m: 0.4 }
const BULBS = ['#ff4f7b', '#ffd23f', '#3ddc97', '#4fc3ff', '#ff8a3d', '#c77dff'].map((c) => glow(c, 0.15, 1.8))

// A beach hotel facing +z: a tall slab with a balcony band on every floor and lit rooms, a
// glass lobby under an awning, and a lit sign on the roof.
const HOTELS = [
  { w: 4.2, n: 9, wall: '#f1eee6', band: '#ffffff', sign: '#4fc3ff' },
  { w: 3.6, n: 7, wall: '#e9dcc6', band: '#f6efe2', sign: '#ff4f7b' },
  { w: 4.8, n: 11, wall: '#eef1f2', band: '#cfd8dc', sign: '#ffd23f' },
  { w: 3.4, n: 6, wall: '#f3d9c9', band: '#fbeee6', sign: '#3ddc97' },
  { w: 4.4, n: 8, wall: '#dfe8ea', band: '#ffffff', sign: '#ff8a3d' },
]
const HD = 4
function hotel(k: PropKit, h: (typeof HOTELS)[number]) {
  const wall: Look = { c: h.wall, r: 0.85 }
  const band: Look = { c: h.band, r: 0.7 }
  const f = HD / 2
  const fl = 1.15
  const H = 1.5 + h.n * fl
  k.box(wall, [h.w, H, HD], [0, H / 2, 0])
  // Lobby: a glass front under a deep awning, the hotel's name lit along its edge.
  k.box(GLASS, [h.w - 0.6, 1.0, 0.04], [0, 0.6, f + 0.01])
  k.box(DARK, [0.5, 0.9, 0.05], [0, 0.55, f + 0.02])
  k.box(band, [h.w + 0.1, 0.12, 1.2], [0, 1.3, f + 0.6])
  k.box(glow(h.sign, 0.2, 1.4), [h.w - 0.4, 0.08, 0.02], [0, 1.3, f + 1.21])
  for (const s of [-1, 1]) k.box(band, [0.08, 1.2, 0.08], [s * (h.w / 2 - 0.1), 0.65, f + 1.15])
  // Floors: a balcony slab with a glass rail running the full width, rooms behind it.
  const bays = Math.round(h.w / 0.85)
  for (let i = 0; i < h.n; i++) {
    const y = 1.5 + i * fl
    k.box(band, [h.w + 0.04, 0.1, 0.5], [0, y, f + 0.24])
    k.box(GLASS, [h.w, 0.32, 0.02], [0, y + 0.21, f + 0.48])
    k.box(band, [h.w + 0.04, 0.04, 0.04], [0, y + 0.39, f + 0.48])
    for (let b = 0; b < bays; b++) {
      const x = -h.w / 2 + (h.w / bays) * (b + 0.5)
      k.box(WIN, [h.w / bays - 0.2, 0.7, 0.02], [x, y + 0.48, f + 0.005])
    }
    // Dividers between the balconies.
    for (let b = 1; b < bays; b += 2) k.box(band, [0.05, 0.4, 0.48], [-h.w / 2 + (h.w / bays) * b, y + 0.25, f + 0.24])
  }
  // Roof: parapet, plant room, the sign on its frame.
  k.box(band, [h.w + 0.08, 0.3, HD + 0.08], [0, H + 0.15, 0])
  k.box(CREAM, [1.6, 0.8, 1.4], [h.w / 4, H + 0.4, -0.6])
  k.box(DARK, [0.05, 0.6, 0.05], [-h.w / 4 - 0.8, H + 0.6, f - 0.4])
  k.box(DARK, [0.05, 0.6, 0.05], [-h.w / 4 + 0.8, H + 0.6, f - 0.4])
  k.box(glow(h.sign, 0.25, 1.6), [1.8, 0.5, 0.06], [-h.w / 4, H + 1.05, f - 0.4])
  k.box(DARK, [1.9, 0.6, 0.04], [-h.w / 4, H + 1.05, f - 0.45])
}

// A beach kiosk: a round counter under a white roof, its menu board lit, two tables with
// folded umbrellas and plastic chairs.
function kiosk(k: PropKit) {
  k.cyl({ c: '#2e7d5b', r: 0.7 }, 0.75, 0.8, 1.0, [0, 0.5, 0], undefined, 12)
  k.cyl(WHITE, 0.82, 0.82, 0.06, [0, 1.03, 0], undefined, 12)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    k.cyl(WHITE, 0.04, 0.04, 0.9, [Math.cos(a) * 0.68, 1.5, Math.sin(a) * 0.68], undefined, 5)
  }
  k.cone(WHITE, 1.25, 0.55, [0, 2.2, 0], undefined, 12)
  k.cyl(glow('#ffd23f', 0.2, 1.4), 1.0, 1.0, 0.14, [0, 1.88, 0], undefined, 12)
  for (const [x, z] of [[1.6, 0.6], [1.5, -1.0]]) {
    k.cyl(WHITE, 0.32, 0.32, 0.04, [x, 0.5, z], undefined, 10)
    k.cyl(WHITE, 0.04, 0.04, 0.5, [x, 0.25, z], undefined, 5)
    k.cyl({ c: '#c0392b', r: 0.7 }, 0.03, 0.03, 1.6, [x, 0.8, z], undefined, 5)
    k.cone({ c: '#ef5350', r: 0.8 }, 0.11, 0.7, [x, 1.4, z], undefined, 8)
    for (const s of [-1, 1]) {
      k.box(WHITE, [0.26, 0.04, 0.26], [x + s * 0.48, 0.28, z])
      k.box(WHITE, [0.04, 0.3, 0.26], [x + s * 0.6, 0.45, z])
    }
  }
}

// A lifeguard post on stilts, white with a blue band, its flag flying.
function lifeguard(k: PropKit) {
  for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) k.cyl(WHITE, 0.05, 0.05, 1.8, [x, 0.9, z], undefined, 6)
  k.box(WHITE, [1.4, 1.0, 1.4], [0, 2.3, 0])
  k.box({ c: '#1e5aa8', r: 0.6 }, [1.42, 0.22, 1.42], [0, 2.05, 0])
  k.box(GLASS, [1.0, 0.4, 0.02], [0, 2.45, 0.71])
  k.box(WHITE, [1.7, 0.1, 1.7], [0, 2.85, 0])
  for (let i = 0; i < 7; i++) k.box(WHITE, [0.5, 0.04, 0.16], [0, 0.18 + i * 0.25, 0.9 + i * 0.12], [0.45, 0, 0])
  k.cyl(DARK, 0.03, 0.03, 1.4, [0.6, 3.5, -0.6], undefined, 5)
  k.box({ c: '#e53935', r: 0.8 }, [0.02, 0.32, 0.5], [0.6, 4.0, -0.35])
  k.box(glow('#fff2c0', 0.1, 1.2), [0.2, 0.12, 0.2], [0, 2.95, 0])
}

// A volleyball net strung between two posts, a ball resting in the sand.
function volley(k: PropKit) {
  for (const z of [-2.2, 2.2]) k.cyl(WHITE, 0.05, 0.05, 1.6, [0, 0.8, z], undefined, 6)
  k.box({ c: '#1b1b1b', r: 1 }, [0.02, 0.5, 4.4], [0, 1.3, 0])
  k.box(WHITE, [0.03, 0.05, 4.4], [0, 1.56, 0])
  k.sphere({ c: '#ffd23f', r: 0.7 }, 0.1, [0.8, 0.1, 0.6], [1, 1, 1], 10, 6)
}

// A string of coloured festoon bulbs across the avenue, sagging between the lamp posts.
function festoon(k: PropKit) {
  const span = EDGE * 2 + 1.6
  for (const s of [-1, 1]) {
    k.cyl(DARK, 0.05, 0.06, 5.2, [s * span / 2, 2.6, 0], undefined, 6)
    k.sphere(glow('#fff2c0', 0.15, 1.4), 0.14, [s * span / 2, 5.3, 0])
  }
  const N = 16
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const x = -span / 2 + span * t
    const y = 5 - Math.sin(t * Math.PI) * 0.7
    if (i < N) {
      const x2 = -span / 2 + span * ((i + 1) / N)
      const y2 = 5 - Math.sin(((i + 1) / N) * Math.PI) * 0.7
      k.rod(DARK, [x, y, 0], [x2, y2, 0], 0.012, 4)
    }
    if (i > 0 && i < N) k.sphere(BULBS[i % BULBS.length], 0.085, [x, y - 0.1, 0], [1, 1.2, 1], 8, 6)
  }
}

// The old aqueduct: two tiers of white arches striding across the avenue, a wide arch over
// the road itself, and the yellow tram on top.
function aqueduct(k: PropKit) {
  const D = 1.6
  const W = 34
  const lower = arcade(W, 5.6, [[-15, -11.6], [-11.6, -8.2], [-8.2, -4.8], [-3.6, 3.6], [4.8, 8.2], [8.2, 11.6], [11.6, 15]], 0.9)
  const upper = arcade(W, 3.2, Array.from({ length: 15 }, (_, i) => [-15 + i * 2, -15 + i * 2 + 1.4] as [number, number]).filter(([a]) => a < 15), 1.2)
  k.add(WHITE, lower, [0, 0, -D / 2], [0, 0, 0])
  k.add(WHITE, upper, [0, 5.9, -D / 2 + 0.2], [0, 0, 0], [1, 1, (D - 0.4) / D])
  // Cornices under each tier, the deck and its railings.
  k.box(CREAM, [W + 0.2, 0.3, D + 0.2], [0, 5.75, 0])
  k.box(CREAM, [W + 0.2, 0.3, D + 0.1], [0, 9.2, 0])
  for (const s of [-1, 1]) k.box(DARK, [W, 0.05, 0.04], [0, 9.75, s * (D / 2 - 0.05)])
  for (let x = -W / 2; x <= W / 2; x += 1) for (const s of [-1, 1]) k.box(DARK, [0.04, 0.4, 0.04], [x, 9.55, s * (D / 2 - 0.05)])
  // The tram: yellow body, open sides, a roof, the trolley pole.
  const yel: Look = { c: '#f2c230', r: 0.6 }
  k.box(yel, [3.2, 0.5, 1.0], [4, 9.65, 0])
  for (let i = 0; i < 6; i++) k.box(yel, [0.06, 0.6, 0.9], [2.5 + i * 0.6, 10.2, 0])
  k.box(yel, [3.4, 0.08, 1.1], [4, 10.55, 0])
  k.box({ c: '#2e7d32', r: 0.7 }, [3.2, 0.06, 1.02], [4, 9.95, 0])
  k.rod(DARK, [4.5, 10.6, 0], [3.3, 11.3, 0], 0.02, 4)
  k.box(glow('#fff2c0', 0.1, 1.2), [0.04, 0.16, 0.2], [2.38, 9.8, 0])
}
// A flat wall `w` wide and `h` tall with round-topped openings between the given x ranges,
// thick `d` along z (1 here: scaled at placement); each opening's straight sides rise to
// `spring` of its width before the round top.
function arcade(w: number, h: number, holes: [number, number][], spring: number) {
  const s = new Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h)
  s.lineTo(-w / 2, h)
  s.closePath()
  for (const [a, b] of holes) {
    const r = (b - a) / 2
    const cx = (a + b) / 2
    const top = Math.min(h - 0.5 - r, r * spring * 2)
    const p = new Shape()
    p.moveTo(a, 0)
    p.lineTo(b, 0)
    p.lineTo(b, top)
    p.absarc(cx, top, r, 0, Math.PI, false)
    p.lineTo(a, 0)
    s.holes.push(p)
  }
  return new ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false, curveSegments: 10 })
}

// The tiled stairway, facing +z: steps climbing away between tiled walls, every riser a row
// of coloured tiles, pot plants and a lamp at the top.
const TILES = ['#d32f2f', '#f9a825', '#2e7d32', '#1565c0', '#ffffff', '#00838f']
function stairway(k: PropKit) {
  const N = 26
  const W = 2.2
  const run = 0.42
  const rise = 0.2
  for (let i = 0; i < N; i++) {
    const z = -i * run
    const y = i * rise
    k.box({ c: '#c94a3a', r: 0.8 }, [W, 0.06, run], [0, y + rise, z])
    k.box({ c: '#9e9e9e', r: 1 }, [W, y + rise - 0.03, run], [0, (y + rise - 0.03) / 2, z])
    for (let t = 0; t < 8; t++) k.box({ c: TILES[(i * 3 + t * 5) % TILES.length], r: 0.4 }, [W / 8 - 0.02, rise - 0.03, 0.02], [-W / 2 + (W / 8) * (t + 0.5), y + rise / 2, z + run / 2 + 0.005])
  }
  // Side walls tiled in a patchwork, stepping up with the stairs.
  for (const s of [-1, 1]) {
    for (let i = 0; i < N; i += 2) {
      const z = -i * run - run / 2
      const y = i * rise
      k.box(CREAM, [0.3, y + 1.6, run * 2], [s * (W / 2 + 0.15), (y + 1.6) / 2, z])
      for (let j = 0; j < 3; j++) for (let q = 0; q < 2; q++) k.box({ c: TILES[(i + j * 2 + q + (s > 0 ? 1 : 3)) % TILES.length], r: 0.4 }, [0.02, 0.36, run - 0.04], [s * (W / 2 + 0.005) * 1, y + 0.4 + j * 0.42, z - run / 2 + q * run])
    }
  }
  for (const s of [-1, 1]) {
    k.cyl({ c: '#b85c38', r: 0.9 }, 0.2, 0.15, 0.35, [s * 1.6, 0.18, 0.8], undefined, 8)
    k.ico({ c: '#3a8f45', r: 1 }, 0.35, [s * 1.6, 0.55, 0.8], [1, 0.8, 1])
  }
  const topY = N * rise
  k.box({ c: '#c94a3a', r: 0.8 }, [W + 0.6, 0.1, 1.6], [0, topY + 0.05, -N * run - 0.6])
  k.cyl(DARK, 0.04, 0.05, 2, [0.9, topY + 1, -N * run - 0.6], undefined, 6)
  k.sphere({ c: '#fff', use: glowMats.lamp }, 0.15, [0.9, topY + 2.05, -N * run - 0.6])
  // Little houses either side at the top, in bright colours.
  for (const [s, c] of [[-1, '#f9a825'], [1, '#1e88e5']] as const) {
    k.box({ c, r: 0.9 }, [2.4, 2.4, 2.4], [s * 2.5, topY + 1.2, -N * run - 1.0])
    k.box(WIN, [0.5, 0.6, 0.02], [s * 2.5, topY + 1.4, -N * run + 0.21])
    k.box({ c: '#b5533b', r: 0.9 }, [2.6, 0.2, 2.6], [s * 2.5, topY + 2.5, -N * run - 1.0])
  }
}

// The promenade's wave mosaic: black and white bands flowing along the beach.
let waves: MeshStandardMaterial | null = null
function waveMat() {
  if (waves) return waves
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const g = c.getContext('2d')!
  const img = g.createImageData(128, 256)
  for (let y = 0; y < 256; y++) {
    const off = Math.sin((y / 256) * Math.PI * 2) * 22
    for (let x = 0; x < 128; x++) {
      const band = Math.floor((x + off + 64) / 32) % 2
      const v = band ? 34 : 236
      const i = (y * 128 + x) * 4
      img.data[i] = v
      img.data[i + 1] = v
      img.data[i + 2] = v - (band ? 0 : 8)
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  waves = new MeshStandardMaterial({ map: t, roughness: 0.75 })
  return waves
}

export default function Rio({ len, race }: WorldProps) {
  const hotels = useMemo(() => HOTELS.map((h, i) => prop(`rio-hotel-${i}`, (k) => hotel(k, h))), [])
  const palmP = useProp('rio-palm', coconutPalm)
  const kioskP = useProp('rio-kiosk', kiosk)
  const guardP = useProp('rio-lifeguard', lifeguard)
  const volleyP = useProp('rio-volley', volley)
  const festoonP = useProp('rio-festoon', festoon)
  const aqueductP = useProp('rio-aqueduct', aqueduct)
  const stairP = useProp('rio-stairway', stairway)
  const gz = race * 0.5
  const sz = race + 8
  const PROM = 3.2
  const SAND0 = -(EDGE + PROM)
  const SHORE = SAND0 - 14

  const geo = useMemo(() => {
    const r = rand(1207)
    const rows: Spot[][] = HOTELS.map(() => [])
    for (let z = -14; z < len + 40;) {
      const i = Math.floor(r() * HOTELS.length)
      const h = HOTELS[i]
      const zc = z + h.w / 2
      if (Math.abs(zc - gz) > 3 + h.w / 2 && Math.abs(zc - sz) > 2.4 + h.w / 2) rows[i].push({ x: EDGE + 1.8 + HD / 2, z: zc, ry: -Math.PI / 2 })
      z += h.w + 0.5 + r() * 1.2
    }
    const palms: Spot[] = []
    for (let z = -12; z < len + 40; z += 5 + r() * 3) {
      if (Math.abs(z - gz) < 2) continue
      palms.push({ x: SAND0 - 0.5, z, ry: Math.PI + (r() - 0.5) * 0.8, s: 0.9 + r() * 0.3 })
    }
    for (let z = -6; z < len + 40; z += 9 + r() * 8) if (Math.abs(z - gz) > 2 && Math.abs(z - sz) > 4) palms.push({ x: EDGE + 1.0, z, ry: (r() - 0.5) * 6, s: 0.85 + r() * 0.2 })
    const kiosks: Spot[] = []
    const guards: Spot[] = []
    const nets: Spot[] = []
    for (let z = 6; z < len + 40; z += 18 + r() * 8) kiosks.push({ x: SAND0 - 2.2, z, ry: r() * 6 })
    for (let z = 30; z < len + 40; z += 70) guards.push({ x: SHORE + 4, z, ry: -Math.PI / 2 })
    for (let z = 14; z < len + 40; z += 26 + r() * 12) nets.push({ x: SAND0 - 7 - r() * 2, z, ry: 0 })
    const strings: Spot[] = []
    for (let z = 12; z < len + 30; z += 12) if (Math.abs(z - gz) > 4) strings.push({ x: 0, z })
    // Footprints, shells and towels scattered on the sand.
    const rr = rand(91)
    const sand = Array.from({ length: 260 }, () => ({ x: SAND0 - 1 - rr() * 12, z: rr() * (len + 60) - 14, s: 0.6 + rr() * 0.8, ry: rr() * 6, y: 0.01 }))
    const towels = Array.from({ length: 50 }, () => ({ x: SAND0 - 3 - rr() * 8, z: rr() * (len + 50) - 10, ry: rr() * 0.6, y: 0.02 }))
    return { rows, palms, kiosks, guards, nets, strings, sand, towels }
  }, [len, gz, sz, SAND0, SHORE])

  const wave = useMemo(() => {
    const m = waveMat()
    m.map!.repeat.set(1, (len + 60) / 6)
    return m
  }, [len])

  return (
    <>
      <Batch version={`rio:${len}`} cell={24}>
        {/* The hotel-side pavement, and the sand down to the surf. */}
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 0.9, 0.012, len / 2 + 5]}>
          <planeGeometry args={[1.8, len + 60]} />
          <meshStandardMaterial color="#d6d0c4" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[(SAND0 + SHORE) / 2 - 1, 0.008, len / 2 + 5]}>
          <planeGeometry args={[SAND0 - SHORE + 2, len + 60]} />
          <meshStandardMaterial color="#e8d3a2" />
        </mesh>
        <group position={[0, 0, gz]}><PropMesh parts={aqueductP} /></group>
        <group position={[EDGE + 2.2, 0, sz]} rotation-y={-Math.PI / 2}><PropMesh parts={stairP} /></group>
        <Scatter spots={geo.sand} colors={['#d9c08c', '#f1e2bb', '#cbb07a']}>
          <boxGeometry args={[0.14, 0.02, 0.22]} />
        </Scatter>
        <Scatter spots={geo.towels} colors={['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00']}>
          <boxGeometry args={[0.5, 0.02, 1.0]} />
        </Scatter>
      </Batch>
      <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + PROM / 2), 0.013, len / 2 + 5]} material={wave}>
        <planeGeometry args={[PROM, len + 60]} />
      </mesh>
      {hotels.map((h, i) => <Many key={i} parts={h} at={geo.rows[i]} />)}
      <Many parts={palmP} at={geo.palms} />
      <Many parts={kioskP} at={geo.kiosks} />
      <Many parts={guardP} at={geo.guards} />
      <Many parts={volleyP} at={geo.nets} />
      <Many parts={festoonP} at={geo.strings} />
      <Surf x={SHORE} len={len} />
      <Water x={SHORE - 40} z={len / 2} w={80} d={len + 240} id="rio" color="#3f6f86" rough={0.15} />
      <Sparkles edge={SHORE} />
      <FarRio />
    </>
  )
}

// The surf line: a band of foam that runs up the sand and slides back.
function Surf({ x, len }: { x: number; len: number }) {
  const a = useRef<Mesh>(null)
  const b = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (a.current) a.current.position.x = x + 0.6 + Math.sin(t * 0.7) * 0.5
    if (b.current) b.current.position.x = x - 1.4 + Math.sin(t * 0.7 + 2) * 0.6
  })
  return (
    <>
      <mesh ref={a} rotation-x={-Math.PI / 2} position={[x, 0.02, len / 2 + 5]}>
        <planeGeometry args={[1.0, len + 60]} />
        <meshStandardMaterial color="#f4f8f8" roughness={0.6} />
      </mesh>
      <mesh ref={b} rotation-x={-Math.PI / 2} position={[x - 1.4, 0.03, len / 2 + 5]}>
        <planeGeometry args={[0.35, len + 60]} />
        <meshStandardMaterial color="#e6f0f2" roughness={0.6} />
      </mesh>
    </>
  )
}

// Ahead: the two sugarloaf rocks out in the bay with the cable car between them, the long
// green ridge behind the town, its tallest peak carrying the lit open-armed statue, and the
// hillside houses' lights.
function FarRio() {
  const parts = useProp('rio-far', (k) => {
    const rock: Look = { c: '#6d6a5e', r: 1 }
    const rockD: Look = { c: '#57544a', r: 1 }
    const green: Look = { c: '#2f5a33', r: 1 }
    const greenD: Look = { c: '#264a2a', r: 1 }
    // The sugarloaf and its little sister, smooth domes of bare rock with forest at the foot.
    k.sphere(rock, 1, [-46, 0, 96], [9, 30, 10], 16, 12, Math.PI / 2)
    k.sphere(green, 1, [-46, 0, 96], [12, 7, 13], 14, 8, Math.PI / 2)
    k.sphere(rockD, 1, [-28, 0, 92], [8, 14, 8], 14, 10, Math.PI / 2)
    k.sphere(green, 1, [-28, 0, 92], [10, 5, 10], 14, 8, Math.PI / 2)
    k.sphere(green, 1, [-12, 0, 94], [10, 6, 8], 12, 8, Math.PI / 2)
    // Cable car wires and cabins between the peaks and down to the shore.
    const wire: Look = { c: '#8a8f94', r: 0.6, m: 0.3 }
    for (const dz of [-0.4, 0.4]) {
      k.rod(wire, [-28, 14, 92 + dz], [-46, 29.6, 96 + dz], 0.12, 3)
      k.rod(wire, [-12, 6, 94 + dz], [-28, 14, 92 + dz], 0.12, 3)
    }
    const cab = glow('#ffe9a8', 0.25, 1.4)
    k.box(cab, [1.1, 0.8, 1.1], [-37, 20.6, 94])
    k.box(cab, [1.1, 0.8, 1.1], [-20, 9.2, 93])
    k.sphere(glow('#ff3d3d', 0.3, 1.6), 0.35, [-46, 30.2, 96])
    // The ridge behind the town and the tall peak.
    for (const [x, z, w, h] of [[2, 112, 24, 18], [22, 118, 20, 26], [44, 112, 26, 20], [66, 110, 20, 14], [-6, 120, 18, 12]] as const) {
      k.sphere(green, 1, [x, 0, z], [w, h, 12], 14, 8, Math.PI / 2)
    }
    frustum(k, greenD, 12, 12, 34, 0.12, [22, 0, 114])
    k.sphere(greenD, 1, [22, 0, 114], [10, 30, 10], 12, 8, Math.PI / 2)
    // The statue on the peak: pedestal, long robe, arms spread wide, head. Lit after dark so
    // the town sees it all night.
    const stat = glow('#f4f1e8', 0.35, 1.1)
    const py = 34
    k.box(stat, [1.2, 1.2, 1.2], [22, py + 0.6, 114])
    frustum(k, stat, 1.4, 1.0, 4.2, 0.55, [22, py + 1.2, 114])
    k.box(stat, [6.2, 0.55, 0.5], [22, py + 4.7, 114])
    k.box(stat, [0.9, 0.9, 0.7], [22, py + 4.8, 114])
    k.sphere(stat, 0.42, [22, py + 5.75, 114], [1, 1.15, 1], 10, 8)
    // Hillside houses, lit windows stacked up the slopes left of the peak.
    const rr = rand(64)
    const tones = ['#ffc46a', '#ffe08a', '#ffb36b', '#fff2c0']
    for (let i = 0; i < 120; i++) {
      const x = 30 + rr() * 34
      const z = 100 + rr() * 10
      const y = Math.max(0.5, (1 - Math.abs(x - 46) / 20) * 12 * rr())
      k.box(glow(tones[i % tones.length], 0.05, 1.3), [0.5, 0.35, 0.05], [x, y, z - 4])
      k.box({ c: ['#c9a27a', '#d98c5f', '#8fb3c9', '#e0c27a'][i % 4], r: 1 }, [1.1, 0.8, 0.9], [x, y - 0.1, z - 3.5])
    }
    // The city's towers along the shore beyond the hotels.
    for (let i = 0; i < 10; i++) {
      const x = 10 + i * 5 + rr() * 2
      const h = 8 + rr() * 10
      k.box({ c: '#d8d4ca', r: 0.8 }, [3.4, h, 3.4], [x, h / 2, 88 + rr() * 6])
      for (let f = 1; f < h - 1; f += 1.6) k.box(glow('#ffd28a', 0.03, 1.0), [2.6, 0.3, 0.05], [x, f, 86.2])
    }
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
