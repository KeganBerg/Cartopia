import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, ConeGeometry, Float32BufferAttribute, OctahedronGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PLOT, TILE } from '../game/data'
import { lotSize, type PlacedBuilding } from '../game/store'
import { toWorld } from './grid'
import { LAYER } from './layers'
import { PAL, SEASON } from './season'

// Little grass tufts, and flowers in spring and summer, scattered over empty
// lawn tiles. All of them are one merged mesh with vertex colours, so the
// whole town's tufts cost a single draw. Snow covers them in winter.

const blade = new ConeGeometry(0.04, 0.24, 3).translate(0, 0.12, 0)
const bloom = new OctahedronGeometry(0.05)
const stem = new ConeGeometry(0.012, 0.2, 3).translate(0, 0.1, 0)

function paint(g: BufferGeometry, color: Color) {
  const g2 = g.index ? g.toNonIndexed() : g.clone()
  const n = g2.getAttribute('position').count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) color.toArray(c, i * 3)
  g2.setAttribute('color', new Float32BufferAttribute(c, 3))
  g2.deleteAttribute('uv')
  return g2
}

// Small deterministic hash so tufts stay put between loads.
const hash = (x: number, z: number, k: number) => {
  let h = (x * 374761393 + z * 668265263 + k * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function GrassTufts({ land, roads, buildings }: { land: string[]; roads: string[]; buildings: PlacedBuilding[] }) {
  // Only footprints matter, so job timers ticking on buildings don't rebuild this.
  const lots = buildings.map((b) => {
    const [w, h] = lotSize(b.def, b.rot)
    return `${b.x},${b.z},${w},${h}`
  }).join(';')
  const geo = useMemo(() => {
    if (SEASON === 'winter') return null
    const used = new Set(roads)
    for (const l of lots ? lots.split(';') : []) {
      const [bx, bz, w, h] = l.split(',').map(Number)
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) used.add(`${bx + i},${bz + j}`)
    }
    const dark = new Color(PAL.grassSpeckle[2]).multiplyScalar(0.8)
    const light = new Color(PAL.grassSpeckle[3])
    const flowers = PAL.dots >= 50 ? PAL.grassDots : []
    const parts: BufferGeometry[] = []
    for (const k of land) {
      const [px, pz] = k.split(',').map(Number)
      for (let x = px * PLOT; x < px * PLOT + PLOT; x++)
        for (let z = pz * PLOT; z < pz * PLOT + PLOT; z++) {
          if (used.has(`${x},${z}`)) continue
          const [wx, wz] = toWorld(x, z)
          const count = Math.floor(hash(x, z, 0) * 3)
          for (let t = 0; t < count; t++) {
            const cx = wx + (hash(x, z, t + 1) - 0.5) * TILE * 0.85
            const cz = wz + (hash(x, z, t + 9) - 0.5) * TILE * 0.85
            for (let b = 0; b < 5; b++) {
              const a = (b / 5) * Math.PI * 2 + hash(x, z, t * 7 + b)
              const g = paint(blade, b % 2 ? dark : light)
              g.scale(1, 0.7 + hash(x, z, t + b + 20) * 0.6, 1)
              g.rotateX(0.35 * Math.cos(a)).rotateZ(0.35 * Math.sin(a))
              g.translate(cx + Math.cos(a) * 0.05, 0, cz + Math.sin(a) * 0.05)
              parts.push(g)
            }
            if (flowers.length && hash(x, z, t + 40) < 0.35) {
              const fx = cx + 0.12, fz = cz - 0.08
              parts.push(paint(stem, dark).translate(fx, 0, fz))
              const col = new Color(flowers[Math.floor(hash(x, z, t + 50) * flowers.length)])
              parts.push(paint(bloom, col).translate(fx, 0.21, fz))
            }
          }
        }
    }
    return parts.length ? mergeGeometries(parts) : null
  }, [land, roads, lots])
  useEffect(() => () => geo?.dispose(), [geo])
  if (!geo) return null
  return (
    // Already one mesh, and Batch keeps no vertex colours, so it stays out of the merge.
    <mesh geometry={geo} position-y={LAYER.land} userData={{ noBatch: true }}>
      <meshStandardMaterial vertexColors />
    </mesh>
  )
}
