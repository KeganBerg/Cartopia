import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry, Color, CylinderGeometry, DoubleSide, Euler, IcosahedronGeometry, Matrix4, MeshStandardMaterial, Quaternion,
  RingGeometry, SphereGeometry, BoxGeometry, TorusGeometry, Vector3, type EulerOrder, type Group,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { cleanHat, hatPaint, type HatFit } from '../game/hats'

// Hats (game/hats.ts), built from a few chunky low-poly shapes. A hat stands on y = 0 and fits
// a head or roof about 0.22 across; CarModel places and scales it on each body (hatSpot).

type V3 = [number, number, number]
type Look = { color: string; metal?: number; rough?: number }

// Parts of one look are merged into one mesh: a hat costs two to five draws.
class Bin {
  still = new Map<string, { look: Look; geos: BufferGeometry[] }>()
  spin = new Map<string, { look: Look; geos: BufferGeometry[] }>()
  add(look: Look, geo: BufferGeometry, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s: V3 = [1, 1, 1], o: { order?: EulerOrder; spin?: boolean } = {}) {
    const m = new Matrix4().compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(r[0], r[1], r[2], o.order ?? 'XYZ')), new Vector3(...s))
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m)
    geo.dispose()
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n)
    g.clearGroups()
    const map = o.spin ? this.spin : this.still
    const key = `${look.color}|${look.metal ?? 0}|${look.rough ?? 0.7}`
    const e = map.get(key) ?? { look, geos: [] }
    e.geos.push(g)
    map.set(key, e)
  }
  // Turns everything about the up axis (a backwards cap).
  turn(a: number) {
    for (const map of [this.still, this.spin]) for (const e of map.values()) e.geos.forEach((g) => g.rotateY(a))
  }
  build() {
    const out = (map: Bin['still']) => [...map.values()].map((e) => ({ mat: matOf(e.look), geo: e.geos.length === 1 ? e.geos[0] : mergeGeometries(e.geos)! }))
    return { still: out(this.still), spin: out(this.spin) }
  }
}

const mats = new Map<string, MeshStandardMaterial>()
function matOf(l: Look) {
  const key = `${l.color}|${l.metal ?? 0}|${l.rough ?? 0.7}`
  let m = mats.get(key)
  if (!m) mats.set(key, (m = new MeshStandardMaterial({ color: l.color, metalness: l.metal ?? 0, roughness: l.rough ?? 0.7, side: DoubleSide })))
  return m
}

// A colour towards black (t < 0) or white (t > 0).
const shade = (c: string, t: number) => '#' + new Color(c).lerp(new Color(t < 0 ? '#000000' : '#ffffff'), Math.abs(t)).getHexString()
const dome = (r: number, w = 16, h = 8) => new SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2)
const cyl = (rt: number, rb: number, h: number, seg = 16) => new CylinderGeometry(rt, rb, h, seg)
const ball = (r: number, detail = 1) => new IcosahedronGeometry(r, detail)
const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)

// A tapered rod from a to b (tassels, horns).
function rod(bin: Bin, look: Look, a: V3, b: V3, r0: number, r1: number) {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize())
  const e = new Euler().setFromQuaternion(q)
  bin.add(look, cyl(r1, r0, d.length(), 8), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [e.x, e.y, e.z])
}

// A flat brim from radius r0 to r1, its height shaped by lift(x, z) (curled sides, a dip at the front).
function brim(r0: number, r1: number, lift: (x: number, z: number) => number, squash = 1, seg = 28) {
  const g = new RingGeometry(r0, r1, seg, 3)
  g.rotateX(-Math.PI / 2)
  g.scale(1, 1, squash)
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) p.setY(i, lift(p.getX(i), p.getZ(i)))
  g.computeVertexNormals()
  return g
}

// Where a brim with this lift sits at angle a round its edge (for fuzzy trim and pompoms).
const edge = (r: number, squash: number, lift: (x: number, z: number) => number, a: number): V3 => {
  const x = Math.cos(a) * r
  const z = Math.sin(a) * r * squash
  return [x, lift(x, z), z]
}

function cap(bin: Bin, [crown, face]: string[]) {
  const sy = 0.78
  bin.add({ color: crown }, dome(0.11), [0, 0, 0], [0, 0, 0], [1, sy, 1])
  // Front panel over the crown, the bill and the button on top.
  bin.add({ color: face }, new SphereGeometry(0.1125, 10, 8, Math.PI / 2 - 0.8, 1.6, 0.1, Math.PI / 2 - 0.1), [0, 0, 0], [0, 0, 0], [1, sy, 1])
  bin.add({ color: face }, cyl(0.1, 0.1, 0.012, 20), [0, 0.012, 0.1], [0.14, 0, 0], [1, 1, 0.85])
  bin.add({ color: crown }, ball(0.014), [0, 0.11 * sy, 0])
}

function cowboy(bin: Bin, color: string, band: string, fuzz?: string) {
  const sq = 0.85
  const lift = (x: number, z: number) => 0.07 * Math.pow(Math.abs(x) / 0.2, 2.4) - 0.012 * Math.pow(z / 0.17, 2) + 0.006
  bin.add({ color }, cyl(0.068, 0.086, 0.12), [0, 0.07, 0], [0, 0, 0], [1, 1, 1.15])
  bin.add({ color }, dome(0.068), [0, 0.13, 0], [0, 0, 0], [1, 0.38, 1.15])
  // A pinch down the middle of the crown.
  bin.add({ color: shade(color, -0.25) }, box(0.012, 0.012, 0.11), [0, 0.152, 0])
  bin.add({ color: band }, cyl(0.088, 0.089, 0.024), [0, 0.024, 0], [0, 0, 0], [1, 1, 1.15])
  bin.add({ color }, brim(0.07, 0.2, lift, sq))
  if (!fuzz) return
  // Fuzzy trim: puffs all round the brim edge and the band.
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2
    bin.add({ color: fuzz, rough: 1 }, ball(0.024 + (i % 3) * 0.004, 0), edge(0.2, sq, lift, a), [i, i * 2, 0])
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    bin.add({ color: fuzz, rough: 1 }, ball(0.02, 0), [Math.cos(a) * 0.09, 0.026, Math.sin(a) * 0.1], [i, i, 0])
  }
}

function build(h: HatFit): Bin {
  const bin = new Bin()
  const [c, c2] = hatPaint(h)
  switch (h.id) {
    case 'cap':
      cap(bin, [c, c2])
      break
    case 'backcap':
      cap(bin, [c, c2])
      bin.turn(Math.PI)
      break
    case 'beanie':
      bin.add({ color: c, rough: 0.95 }, dome(0.112), [0, 0, 0], [0, 0, 0], [1, 0.95, 1])
      bin.add({ color: shade(c, -0.18), rough: 0.95 }, cyl(0.116, 0.118, 0.045, 18), [0, 0.022, 0])
      bin.add({ color: shade(c, 0.45), rough: 1 }, ball(0.036, 1), [0, 0.125, 0])
      break
    case 'party': {
      bin.add({ color: c }, cyl(0.004, 0.095, 0.26), [0, 0.13, 0])
      bin.add({ color: '#fafafa' }, cyl(0.097, 0.097, 0.016), [0, 0.008, 0])
      for (let i = 0; i < 7; i++) {
        const y = 0.04 + i * 0.026
        const a = i * 2.3
        const r = 0.095 * (1 - y / 0.26) + 0.002
        bin.add({ color: i % 2 ? '#fff176' : '#4fc3f7' }, ball(0.012, 0), [Math.cos(a) * r, y, Math.sin(a) * r])
      }
      bin.add({ color: '#fafafa', rough: 1 }, ball(0.03, 1), [0, 0.265, 0])
      break
    }
    case 'hardhat':
      bin.add({ color: c, rough: 0.4 }, dome(0.115), [0, 0, 0], [0, 0, 0], [1, 0.85, 1])
      bin.add({ color: shade(c, -0.12), rough: 0.4 }, dome(0.118), [0, 0, 0], [0, 0, 0], [0.22, 0.88, 1.02])
      bin.add({ color: c, rough: 0.4 }, cyl(0.15, 0.15, 0.014, 22), [0, 0.007, 0.012], [0, 0, 0], [1, 1, 1.05])
      break
    case 'cone': {
      const at = (y: number) => 0.085 - 0.073 * (y - 0.025) / 0.27 + 0.003
      bin.add({ color: '#bf360c' }, box(0.22, 0.025, 0.22), [0, 0.0125, 0])
      bin.add({ color: c, rough: 0.5 }, cyl(0.012, 0.085, 0.27), [0, 0.16, 0])
      for (const [y0, y1] of [[0.1, 0.135], [0.18, 0.205]]) bin.add({ color: '#fafafa', rough: 0.5 }, cyl(at(y1), at(y0), y1 - y0), [0, (y0 + y1) / 2, 0])
      break
    }
    case 'cowboy': {
      const dark = new Color(c).getHSL({ h: 0, s: 0, l: 0 }).l < 0.1
      cowboy(bin, c, dark ? '#9e9e9e' : shade(c, -0.55))
      break
    }
    case 'pinkcowboy':
      cowboy(bin, c, '#ad1457', '#fce4ec')
      break
    case 'fez':
      bin.add({ color: c, rough: 0.9 }, cyl(0.072, 0.092, 0.13, 18), [0, 0.065, 0])
      bin.add({ color: '#212121' }, cyl(0.012, 0.012, 0.01, 8), [0, 0.134, 0])
      rod(bin, { color: '#212121' }, [0, 0.136, 0], [0, 0.134, -0.074], 0.005, 0.005)
      rod(bin, { color: '#212121' }, [0, 0.134, -0.074], [0, 0.08, -0.094], 0.005, 0.005)
      bin.add({ color: '#212121' }, cyl(0.005, 0.02, 0.045, 8), [0, 0.058, -0.096])
      break
    case 'chef':
      bin.add({ color: c, rough: 0.9 }, cyl(0.095, 0.095, 0.07, 18), [0, 0.035, 0])
      bin.add({ color: '#f5f5f5', rough: 1 }, ball(0.085, 1), [0, 0.15, 0], [0, 0, 0], [1, 0.85, 1])
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        bin.add({ color: '#f5f5f5', rough: 1 }, ball(0.058, 1), [Math.cos(a) * 0.06, 0.12, Math.sin(a) * 0.06])
      }
      break
    case 'propeller': {
      const quarters = [c, '#fdd835', '#1e88e5', '#43a047']
      quarters.forEach((q, i) => bin.add({ color: q }, new SphereGeometry(0.112, 5, 8, (i * Math.PI) / 2, Math.PI / 2, 0, Math.PI / 2), [0, 0, 0], [0, 0, 0], [1, 0.8, 1]))
      bin.add({ color: c }, cyl(0.085, 0.085, 0.012, 18), [0, 0.012, 0.09], [0.14, 0, 0], [1, 1, 0.8])
      bin.add({ color: '#9e9e9e', metal: 0.6, rough: 0.4 }, cyl(0.008, 0.008, 0.05, 6), [0, 0.105, 0])
      bin.add({ color: '#fdd835' }, ball(0.016, 1), [0, 0.132, 0], [0, 0, 0], [1, 1, 1], { spin: true })
      for (const sd of [-1, 1]) bin.add({ color: sd > 0 ? '#e53935' : '#1e88e5' }, box(0.1, 0.006, 0.035), [sd * 0.058, 0.132, 0], [sd * 0.3, 0, 0], [1, 1, 1], { spin: true })
      break
    }
    case 'sombrero': {
      const lift = (x: number, z: number) => 0.075 * Math.pow(Math.max(0, Math.hypot(x, z) - 0.08) / 0.22, 2.2) + 0.004
      bin.add({ color: c, rough: 0.95 }, cyl(0.055, 0.085, 0.15), [0, 0.085, 0])
      bin.add({ color: c, rough: 0.95 }, dome(0.055), [0, 0.16, 0], [0, 0, 0], [1, 0.45, 1])
      bin.add({ color: '#c62828' }, cyl(0.082, 0.087, 0.03), [0, 0.025, 0])
      bin.add({ color: c, rough: 0.95 }, brim(0.07, 0.3, lift, 1, 32))
      bin.add({ color: '#c62828' }, new TorusGeometry(0.3, 0.01, 4, 40), [0, lift(0.3, 0), 0], [Math.PI / 2, 0, 0])
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        const [x, y, z] = edge(0.3, 1, lift, a)
        bin.add({ color: i % 2 ? '#2e7d32' : '#c62828', rough: 1 }, ball(0.02, 0), [x, y - 0.03, z])
      }
      break
    }
    case 'pirate':
      bin.add({ color: c }, dome(0.1), [0, 0, 0], [0, 0, 0], [1, 0.75, 1])
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2
        const at: V3 = [Math.sin(a) * 0.085, 0.05, Math.cos(a) * 0.085]
        const rot: V3 = [0.3, a, 0]
        bin.add({ color: c }, box(0.2, 0.09, 0.014), at, rot, [1, 1, 1], { order: 'YXZ' })
        bin.add({ color: '#ffca28', metal: 0.7, rough: 0.35 }, box(0.2, 0.012, 0.018).translate(0, 0.045, 0), at, rot, [1, 1, 1], { order: 'YXZ' })
      }
      // Skull and crossbones on the front flap.
      bin.add({ color: '#fafafa' }, ball(0.02, 1).translate(0, 0.008, 0.012), [0, 0.05, 0.085], [0.3, 0, 0], [1, 1, 1], { order: 'YXZ' })
      for (const sd of [-1, 1]) bin.add({ color: '#fafafa' }, box(0.06, 0.008, 0.006).translate(0, -0.016, 0.01), [0, 0.05, 0.085], [0.3, 0, sd * 0.6], [1, 1, 1], { order: 'YXZ' })
      break
    case 'viking':
      bin.add({ color: c, metal: 0.6, rough: 0.35 }, dome(0.112), [0, 0, 0], [0, 0, 0], [1, 0.9, 1])
      bin.add({ color: '#c9a227', metal: 0.7, rough: 0.35 }, dome(0.115), [0, 0, 0], [0, 0, 0], [0.15, 0.92, 1.02])
      bin.add({ color: '#8d6e63' }, cyl(0.116, 0.116, 0.03, 18), [0, 0.015, 0])
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        bin.add({ color: '#c9a227', metal: 0.7, rough: 0.35 }, ball(0.008, 0), [Math.cos(a) * 0.118, 0.015, Math.sin(a) * 0.118])
      }
      for (const sd of [-1, 1]) {
        rod(bin, { color: '#f5ecd7' }, [sd * 0.09, 0.055, 0], [sd * 0.165, 0.1, 0], 0.026, 0.017)
        rod(bin, { color: '#f5ecd7' }, [sd * 0.165, 0.1, 0], [sd * 0.19, 0.19, 0], 0.017, 0.002)
      }
      break
    case 'crown':
      bin.add({ color: '#b71c1c', rough: 1 }, dome(0.086), [0, 0, 0], [0, 0, 0], [1, 0.8, 1])
      bin.add({ color: c, metal: 0.85, rough: 0.25 }, new CylinderGeometry(0.095, 0.088, 0.065, 18, 1, true), [0, 0.0325, 0])
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const x = Math.sin(a)
        const z = Math.cos(a)
        bin.add({ color: c, metal: 0.85, rough: 0.25 }, cyl(0.001, 0.024, 0.055, 4), [x * 0.092, 0.092, z * 0.092], [0, a, 0])
        bin.add({ color: c, metal: 0.85, rough: 0.25 }, ball(0.011, 1), [x * 0.092, 0.122, z * 0.092])
        bin.add({ color: i % 2 ? '#1e88e5' : '#e53935', metal: 0.3, rough: 0.2 }, ball(0.013, 0), [x * 0.096, 0.033, z * 0.096])
      }
      break
    case 'tophat': {
      const lift = (x: number) => 0.022 * Math.pow(Math.abs(x) / 0.135, 2) + 0.004
      bin.add({ color: c, rough: 0.5 }, brim(0.06, 0.135, lift, 0.88, 24))
      bin.add({ color: c, rough: 0.5 }, cyl(0.088, 0.08, 0.2, 20), [0, 0.11, 0])
      bin.add({ color: '#7f0000' }, cyl(0.083, 0.082, 0.03, 20), [0, 0.03, 0])
      break
    }
  }
  return bin
}

const cache = new Map<string, ReturnType<Bin['build']>>()
// Meshes for a hat, built once per hat and colours.
function hatMeshes(h: HatFit) {
  const key = `${h.id}|${hatPaint(h).join(',')}`
  let m = cache.get(key)
  if (!m) cache.set(key, (m = build(h).build()))
  return m
}

// A hat on its own, standing on y = 0. The propeller cap's propeller spins.
export function HatModel({ hat }: { hat: HatFit | null | undefined }) {
  const spin = useRef<Group>(null)
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += Math.min(dt, 0.1) * 9
  })
  const fit = cleanHat(hat)
  if (!fit) return null
  const m = hatMeshes(fit)
  return (
    <group>
      {m.still.map((p, i) => <mesh key={i} geometry={p.geo} material={p.mat} castShadow />)}
      {m.spin.length > 0 && <group ref={spin}>{m.spin.map((p, i) => <mesh key={i} geometry={p.geo} material={p.mat} castShadow />)}</group>}
    </group>
  )
}
