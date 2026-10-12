import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, DoubleSide } from 'three'
import { towerTex } from './textures'
import { rand } from './RaceVenues'
import type { KartTheme } from '../game/kart'

// The far edge of every kart circuit, so the driver never looks out at bare fog: ridge lines
// all the way round (green hills and blue mountains in town, a far shore with its own town
// across the harbour, buttes and a mountain range in the canyon). Fog would wash them out
// to a grey band, so they skip it and take a share of the fog colour themselves instead,
// which keeps them hazy by day and dark at night.

type Ridge = { r: number; depth: number; lo: number; hi: number; seed: number; base: string; top: string; snow?: number; steps?: number; haze: number }

const RIDGES: Record<KartTheme, Ridge[]> = {
  town: [
    { r: 150, depth: 26, lo: 5, hi: 16, seed: 3, base: '#6fa548', top: '#4c8a3a', haze: 0.25 },
    { r: 182, depth: 30, lo: 22, hi: 50, seed: 7, base: '#5b7f6e', top: '#7e93a8', snow: 40, haze: 0.45 },
  ],
  docks: [
    { r: 166, depth: 22, lo: 6, hi: 20, seed: 11, base: '#6f9c4f', top: '#4f7f3d', haze: 0.3 },
    { r: 196, depth: 30, lo: 24, hi: 52, seed: 13, base: '#62806f', top: '#8b9bb0', snow: 44, haze: 0.5 },
  ],
  desert: [
    { r: 150, depth: 24, lo: 6, hi: 22, seed: 17, base: '#c8693a', top: '#a84a2a', steps: 4, haze: 0.22 },
    { r: 185, depth: 30, lo: 20, hi: 46, seed: 19, base: '#b06a4d', top: '#8a6a7c', haze: 0.45 },
  ],
}

const N = 180
function ridgeGeo(g: Ridge, haze: Color) {
  const r = rand(g.seed)
  // A few sine waves at random phases make a hill line that wraps round seamlessly.
  const waves = [1, 2, 3, 5, 8, 13].map((f) => ({ f, p: r() * Math.PI * 2, a: 1 / Math.sqrt(f) }))
  const sum = waves.reduce((s, w) => s + w.a, 0)
  const height = (a: number) => {
    let v = 0
    for (const w of waves) v += Math.sin(a * w.f + w.p) * w.a
    let h = g.lo + (g.hi - g.lo) * (0.5 + (v / sum) * 0.9)
    if (g.steps) h = Math.round(h / g.steps) * g.steps // flat-topped buttes
    return h
  }
  const pos: number[] = [], col: number[] = []
  const cBase = new Color(g.base).lerp(haze, g.haze), cTop = new Color(g.top).lerp(haze, g.haze)
  const cSnow = new Color('#f4f7fb').lerp(haze, g.haze * 0.8)
  const tmp = new Color()
  const put = (a: number, d: number, y: number, c: Color) => {
    pos.push(Math.cos(a) * d, y, Math.sin(a) * d)
    col.push(c.r, c.g, c.b)
  }
  // Three rows per column: the foot, a shoulder, and the crest set back behind it.
  for (let i = 0; i < N; i++) {
    for (const k of [i, i + 1]) {
      const a = (k / N) * Math.PI * 2
      const h = height(a)
      const sh = h * (0.55 + 0.15 * Math.sin(a * 21 + g.seed))
      put(a, g.r, -1, cBase)
      put(a, g.r + g.depth * 0.45, sh, tmp.copy(cBase).lerp(cTop, 0.5))
      put(a, g.r + g.depth, h, g.snow && h > g.snow ? cSnow : cTop)
    }
  }
  const idx: number[] = []
  for (let i = 0; i < N; i++) {
    const o = i * 6
    // foot-shoulder band, then shoulder-crest band, both facing the middle.
    idx.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// A far shore across the harbour: a beach, green land out to the edge of the world and a
// little town of towers on it.
function FarShore({ haze }: { haze: Color }) {
  const towers = useMemo(() => {
    const r = rand(23)
    const out: { x: number; z: number; w: number; h: number; c: string }[] = []
    for (const centre of [0.6, 2.3, 4.1, 5.4]) for (let k = 0; k < 9; k++) {
      const a = centre + (r() - 0.5) * 0.5, d = 172 + r() * 10
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, w: 5 + r() * 5, h: 8 + r() * (k % 3 ? 18 : 34), c: ['#90caf9', '#ffcc80', '#ef9a9a', '#a5d6a7', '#fff59d'][k % 5] })
    }
    return out
  }, [])
  const tex = useMemo(() => { const t = towerTex().clone(); t.repeat.set(2, 4); t.needsUpdate = true; return t }, [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.05}><ringGeometry args={[160, 168, 128, 1]} /><meshStandardMaterial color={new Color('#e8d2a0').lerp(haze, 0.2)} fog={false} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.06}><ringGeometry args={[167.5, 240, 128, 1]} /><meshStandardMaterial color={new Color('#7cab55').lerp(haze, 0.3)} fog={false} /></mesh>
      {towers.map((t, i) => (
        <mesh key={i} position={[t.x, t.h / 2, t.z]}>
          <boxGeometry args={[t.w, t.h, t.w]} />
          <meshStandardMaterial map={tex} color={new Color(t.c).lerp(haze, 0.2)} fog={false} />
        </mesh>
      ))}
    </group>
  )
}

export function KartHorizon({ theme, fog }: { theme: KartTheme; fog: string }) {
  const haze = useMemo(() => new Color(fog), [fog])
  const geos = useMemo(() => RIDGES[theme].map((g) => ridgeGeo(g, haze)), [theme, haze])
  return (
    <group>
      {geos.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial vertexColors flatShading fog={false} side={DoubleSide} />
        </mesh>
      ))}
      {theme === 'docks' && <FarShore haze={haze} />}
    </group>
  )
}
