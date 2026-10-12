import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DoubleSide, IcosahedronGeometry, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, SphereGeometry, SRGBColorSpace, type InstancedMesh, type Mesh,
} from 'three'
import { weatherNow } from '../game/weather'
import { dayPhase, nightAmount } from './dayNight'
import { Kit, kitMat } from './kit'
import { PAL, SEASON, type Season } from './season'
import {
  A_CITY, A_LAKE, FIELD, FIELD_AXES, SNOW_COVER, HWY_DIR, LAKE, RAIL_LEN, TAU, angDist, fieldAt, fieldCentre, groundAt, hwy, lakeOf, rail, railHeight, railPoint,
} from './horizonLand'
import { rand } from './RaceVenues'

// The working countryside past the town, for the free view (mounted by Horizon.tsx):
// farms whose fields change with the season (sprouts and blossom in spring, corn
// and sunflowers in summer, hay bales and pumpkins in fall, snow in winter),
// farmsteads with barns and silos, a railway with a train crossing the farmland,
// a water tower at the edge of town, a pier and sailing boats on the lake, and
// flocks of birds. The still parts are one baked mesh; the moving parts are a
// handful of instanced meshes.

// Snow on the roofs once the ground is mostly white.
const W = SNOW_COVER > 0.5
const facet = (g: BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g
  n.computeVertexNormals()
  return n
}
const BOX = new BoxGeometry(1, 1, 1)
BOX.translate(0, 0.5, 0)
// A gable roof: a triangular prism, ridge along z, base 1 wide at y 0, apex at y 1.
const ROOF = (() => {
  const g = new CylinderGeometry(1, 1, 1, 3)
  g.rotateX(-Math.PI / 2)
  g.translate(0, 0.5, 0)
  g.scale(1 / 1.732, 1 / 1.5, 1)
  return facet(g)
})()
const CYL = facet(new CylinderGeometry(1, 1, 1, 10))
CYL.translate(0, 0.5, 0)
const DOME = facet(new SphereGeometry(1, 10, 4, 0, TAU, 0, Math.PI / 2))
const BALL = facet(new IcosahedronGeometry(1, 0))
const CONE = facet(new ConeGeometry(1, 1, 10))
CONE.translate(0, 0.5, 0)

// What grows in each kind of field (see fieldAt), by season.
type Crop = { rows?: { h: number; c: string }; heads?: string; trees?: string[]; bales?: number; pumpkins?: boolean }
const CROP_BY: Record<Season, Crop[]> = {
  spring: [
    { rows: { h: 0.5, c: '#7fc04f' } },
    { rows: { h: 0.4, c: '#9ccf58' } },
    { rows: { h: 0.6, c: '#f2dc38' } },
    { trees: ['#f8bbd0', '#fce4ec', '#f48fb1'] },
    { rows: { h: 0.35, c: '#6d5038' } },
  ],
  summer: [
    { rows: { h: 1.7, c: '#5f9e38' } },
    { bales: 3 },
    { rows: { h: 1.5, c: '#4f8a30' }, heads: '#ffc928' },
    { trees: ['#4caf50', '#43a047', '#5cb85c'] },
    { rows: { h: 0.35, c: '#7d5a3a' } },
  ],
  fall: [
    { bales: 6 },
    { rows: { h: 0.35, c: '#5e4430' } },
    { rows: { h: 0.25, c: '#6f7d2e' }, pumpkins: true },
    { trees: ['#e65100', '#c62828', '#f9a825'] },
    { rows: { h: 0.35, c: '#6a4c34' }, bales: 3 },
  ],
  winter: [
    { bales: 4 },
    {},
    {},
    { trees: ['#eef3f6'] },
    { bales: 2 },
  ],
}

type Smoke = { x: number; y: number; z: number }
type Built = { still: BufferGeometry; lights: BufferGeometry | null; smoke: Smoke[]; ribbon: BufferGeometry }

let built: Built | null = null
function build(small: boolean): Built {
  const k = new Kit()
  const night = new Kit()
  const smoke: Smoke[] = []
  const r = rand(909)
  const [ux, uz] = FIELD_AXES.u
  const [vx, vz] = FIELD_AXES.v
  const along = Math.atan2(ux, uz) // yaw that points a box's z down the rows
  const at = (cx: number, cz: number, u: number, v: number): [number, number] => [cx + ux * u + vx * v, cz + uz * u + vz * v]
  const reach = small ? 470 : 590

  // ---- Fields --------------------------------------------------------------------
  const seen = new Set<string>()
  const fields: { fx: number; fz: number; kind: number; season: Season; cx: number; cz: number }[] = []
  for (let x = -720; x < 120; x += 15) {
    for (let z = -720; z < 120; z += 15) {
      const f = fieldAt(x, z)
      if (!f || seen.has(`${f.fx},${f.fz}`)) continue
      seen.add(`${f.fx},${f.fz}`)
      const [cx, cz] = fieldCentre(f.fx, f.fz)
      // Only whole fields get crops, so rows never run onto a road or off the farm.
      const whole = [[-0.42, -0.4], [0.42, -0.4], [-0.42, 0.4], [0.42, 0.4]].every(([a, b]) => {
        const [px, pz] = at(cx, cz, a * FIELD.w, b * FIELD.d)
        const g = fieldAt(px, pz)
        return g && g.fx === f.fx && g.fz === f.fz
      })
      if (whole && Math.hypot(cx, cz) < reach) fields.push({ ...f, cx, cz })
    }
  }
  const rowsPer = small ? 7 : 11
  const segs = 3
  const segLen = (FIELD.w - 5) / segs
  let heads = 0
  const maxHeads = small ? 500 : 1600
  for (const f of fields) {
    const crop = CROP_BY[f.season][f.kind]
    if (crop.rows) {
      const { h, c } = crop.rows
      for (let i = 0; i < rowsPer; i++) {
        const v = (-0.5 + (i + 0.5) / rowsPer) * (FIELD.d - 4)
        for (let j = 0; j < segs; j++) {
          const u0 = -FIELD.w / 2 + 2.5 + j * segLen
          const [ax, az] = at(f.cx, f.cz, u0, v)
          const [bx, bz] = at(f.cx, f.cz, u0 + segLen, v)
          const ya = groundAt(ax, az), yb = groundAt(bx, bz)
          const mx = (ax + bx) / 2, mz = (az + bz) / 2
          k.add(BOX, c, mx, (ya + yb) / 2 - 0.12, mz, along, 0.95, h, segLen - 0.4, -Math.asin((yb - ya) / segLen))
          // Sunflower heads along the row, facing the morning sun.
          if (crop.heads && heads < maxHeads) {
            for (let t = 0.5; t < segLen; t += 2.6) {
              const px = ax + (bx - ax) * (t / segLen), pz = az + (bz - az) * (t / segLen)
              k.add(CYL, crop.heads, px, groundAt(px, pz) + h + 0.1, pz, 0, 0.75, 0.22, 0.75, 1.1)
              k.add(CYL, '#5d4030', px + 0.08, groundAt(px, pz) + h + 0.12, pz, 0, 0.35, 0.24, 0.35, 1.1)
              heads++
            }
          }
        }
      }
    }
    if (crop.trees) {
      // An orchard: neat rows of little fruit trees.
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 6; j++) {
          const [px, pz] = at(f.cx, f.cz, (-0.5 + (j + 0.5) / 6) * (FIELD.w - 6), (-0.5 + (i + 0.5) / 4) * (FIELD.d - 6))
          const y = groundAt(px, pz)
          const s = 1.5 + r() * 0.5
          k.add(CYL, '#6d4c41', px, y - 0.2, pz, 0, 0.25, 1.6 * s, 0.25)
          k.add(BALL, crop.trees[Math.floor(r() * crop.trees.length)], px, y + 1.7 * s, pz, r() * TAU, 1.35 * s, (W ? 0.8 : 1.1) * s, 1.35 * s)
        }
      }
    }
    if (crop.bales) {
      for (let i = 0; i < crop.bales; i++) {
        const [px, pz] = at(f.cx, f.cz, (r() - 0.5) * (FIELD.w - 8), (r() - 0.5) * (FIELD.d - 8))
        const y = groundAt(px, pz)
        const ry = r() * TAU
        k.add(CYL, W ? '#cbbf9a' : '#d4b45c', px, y + 1.3, pz, ry, 1.3, 1.9, 1.3, Math.PI / 2)
      }
    }
    if (crop.pumpkins) {
      for (let i = 0; i < 26; i++) {
        const [px, pz] = at(f.cx, f.cz, (r() - 0.5) * (FIELD.w - 6), (r() - 0.5) * (FIELD.d - 6))
        const s = 0.55 + r() * 0.35
        k.add(BALL, r() < 0.85 ? '#f57c00' : '#ffb300', px, groundAt(px, pz) + s * 0.6, pz, r() * TAU, s, s * 0.75, s)
      }
    }
  }

  // ---- Farmsteads ------------------------------------------------------------------
  // On grass cells (not crops) on the farm side, each with a barn, a silo or two and a house.
  const roofSnow = '#eef3f7'
  let farms = 0
  for (let tries = 0; tries < 400 && farms < (small ? 7 : 11); tries++) {
    const rr = 260 + r() * 360
    const a = A_CITY + (r() - 0.5) * 1.5
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr
    if (fieldAt(x, z) || hwy(x, z).d < 40 || rail(x, z).d < 34 || lakeOf(x, z) < 1.3 || angDist(a, A_CITY) > 0.8) continue
    // Level enough to build on.
    const y0 = groundAt(x, z)
    if (Math.abs(groundAt(x + 14, z) - y0) > 2.5 || Math.abs(groundAt(x, z + 14) - y0) > 2.5) continue
    farms++
    const yaw = along + (r() < 0.5 ? 0 : Math.PI / 2)
    const fwd = (u: number, v: number): [number, number] => [x + Math.sin(yaw) * u + Math.cos(yaw) * v, z + Math.cos(yaw) * u - Math.sin(yaw) * v]
    const floor = (px: number, pz: number) => Math.min(groundAt(px, pz), y0) - 0.6
    // Barn: red walls, white trim, a big gambrel-ish roof.
    const barn = r() < 0.75 ? '#b5332e' : '#8d2b26'
    const [bx, bz] = fwd(0, 0)
    const by = floor(bx, bz)
    k.add(BOX, barn, bx, by, bz, yaw, 9, 7.6, 13)
    k.add(ROOF, W ? roofSnow : '#5f6b73', bx, by + 7.6, bz, yaw, 10.4, 4.6, 14)
    const [dx, dz] = fwd(6.52, 0)
    k.add(BOX, '#f5f0e6', dx, by + 0.6, dz, yaw, 4.2, 4.6, 0.12)
    // Silos.
    for (let i = 0; i < (r() < 0.5 ? 2 : 1); i++) {
      const [sx, sz] = fwd(-2 - i * 4.5, 8.5)
      const sy = floor(sx, sz)
      const h = 15 + r() * 6
      k.add(CYL, i ? '#b0bec5' : '#cfd8dc', sx, sy, sz, 0, 2.1, h, 2.1)
      k.add(DOME, W ? roofSnow : '#90a4ae', sx, sy + h, sz, 0, 2.1, 1.6, 2.1)
    }
    // Farmhouse with a chimney (and its smoke when it's cold), windows lit at night.
    const [hx, hz] = fwd(4, -16)
    const hy = floor(hx, hz)
    k.add(BOX, r() < 0.5 ? '#f5f0e6' : '#ffe0b2', hx, hy, hz, yaw + Math.PI / 2, 8, 5, 6)
    k.add(ROOF, W ? roofSnow : '#6d4c41', hx, hy + 5, hz, yaw + Math.PI / 2, 9, 3.4, 9)
    const [cx, cz] = fwd(6, -14.2)
    k.add(BOX, '#8d6e63', cx, hy + 5, cz, yaw, 1, 4.4, 1)
    if (SNOW_COVER > 0 || SEASON === 'fall' || SEASON === 'winter') smoke.push({ x: cx, y: hy + 9.6, z: cz })
    for (const w of [-2, 2]) {
      const [wx, wz] = fwd(4 + w, -12.95)
      night.add(BOX, '#ffcf6e', wx, hy + 1.6, wz, yaw, 1.3, 1.4, 0.1, 0, 0, 1)
    }
    // A shade tree.
    const [tx, tz] = fwd(-9, -14)
    const ty = groundAt(tx, tz)
    k.add(CYL, '#5d4030', tx, ty - 0.3, tz, 0, 0.5, 4.5, 0.5)
    k.add(BALL, W ? '#eef3f6' : PAL.leaves[farms % PAL.leaves.length], tx, ty + 6, tz, r() * TAU, 3.6, 3.2, 3.6)
  }

  // ---- Water tower -----------------------------------------------------------------
  {
    const a = A_LAKE + 0.45
    const x = Math.cos(a) * 240, z = Math.sin(a) * 240
    const y = groundAt(x, z) - 0.4
    const H = 24
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.add(BOX, '#90a4ae', x + dx * 3.2, y, z + dz * 3.2, 0, 0.6, H + 0.5, 0.6, -dz * 0.1, dx * 0.1)
    k.add(BOX, '#90a4ae', x, y + 10, z, 0, 7.6, 0.4, 7.6)
    k.add(CYL, '#e3eef6', x, y + H, z, 0, 6.2, 7, 6.2)
    k.add(CONE, W ? roofSnow : '#7d97ab', x, y + H + 7, z, 0, 6.6, 3.2, 6.6)
    k.add(BALL, '#ff3030', x, y + H + 10.4, z, 0, 0.5, 0.5, 0.5, 0, 0, 1)
    night.add(BALL, '#ff4040', x, y + H + 10.4, z, 0, 0.6, 0.6, 0.6, 0, 0, 1)
  }

  // ---- Lake: a pier, and fishing huts on the ice in winter ---------------------------
  {
    const dx = Math.SQRT1_2, dz = -Math.SQRT1_2
    const yaw = Math.atan2(dx, dz)
    for (let t = 185; t < 232; t += 4) {
      const px = LAKE[0] + dx * t, pz = LAKE[1] + dz * t
      k.add(BOX, '#a1887f', px, -0.55, pz, yaw, 4, 0.3, 3.6)
      for (const side of [-1.7, 1.7]) k.add(BOX, '#6d4c41', px - dz * side, -3, pz + dx * side, 0, 0.35, 2.6, 0.35)
    }
    if (SEASON === 'winter') {
      for (let i = 0; i < 6; i++) {
        const a = r() * TAU, rr = 40 + r() * 100
        const px = LAKE[0] + Math.cos(a) * rr * 1.35, pz = LAKE[1] + Math.sin(a) * rr
        k.add(BOX, ['#d84315', '#1565c0', '#2e7d32', '#6d4c41'][i % 4], px, -1.4, pz, r() * TAU, 3, 2.6, 3.4)
        k.add(ROOF, '#eef3f7', px, 1.2, pz, 0, 3.4, 1.2, 3.6)
      }
    }
  }

  // ---- Railway: ballast and two rails (a ribbon like the highway), sleepers --------------
  const pos: number[] = []
  const col: number[] = []
  const strip = (from: number, to: number, c: Color, lift: number) => {
    for (let s = -RAIL_LEN; s < RAIL_LEN; s += 10) {
      const quad = [[s, from], [s, to], [s + 10, to], [s + 10, from]].map(([ss, o]) => {
        const [px, pz] = railPoint(ss)
        return [px - HWY_DIR[1] * o, railHeight(ss) + lift, pz + HWY_DIR[0] * o]
      })
      for (const q of [0, 1, 2, 0, 2, 3]) {
        pos.push(...quad[q])
        col.push(c.r, c.g, c.b)
      }
    }
  }
  strip(-3.2, 3.2, new Color(W ? '#b9b4ab' : '#8a8073'), 0.05)
  for (const e of [-1.1, 1.1]) strip(e - 0.16, e + 0.16, new Color('#3e3a36'), 0.32)
  const ribbon = new BufferGeometry()
  ribbon.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  ribbon.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
  ribbon.computeVertexNormals()
  const n = ribbon.attributes.normal as BufferAttribute
  for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i))
  if (!small) {
    const yaw = Math.atan2(HWY_DIR[0], HWY_DIR[1])
    for (let s = -700; s < 700; s += 3) {
      const [px, pz] = railPoint(s)
      k.add(BOX, '#5d4a3c', px, railHeight(s) + 0.02, pz, yaw, 3.4, 0.22, 0.6)
    }
  }

  return { still: k.geometry()!, lights: night.geometry(), smoke, ribbon }
}

export function Countryside({ small }: { small: boolean }) {
  const b = useMemo(() => (built ??= build(small)), [small])
  const lights = useRef<Mesh>(null)
  const ribbonMat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }), [])
  useEffect(() => () => ribbonMat.dispose(), [ribbonMat])
  useFrame(() => {
    if (lights.current) lights.current.visible = nightAmount(dayPhase()) > 0.35
  })
  return (
    <group>
      <mesh geometry={b.still} material={kitMat} raycast={() => null} userData={{ noBatch: true }} />
      {b.lights && <mesh ref={lights} geometry={b.lights} material={kitMat} raycast={() => null} userData={{ noBatch: true }} />}
      <mesh geometry={b.ribbon} material={ribbonMat} raycast={() => null} />
      <WaterTowerSign />
      <Train />
      {SEASON !== 'winter' && <Boats />}
      {b.smoke.length > 0 && <Smoke spots={b.smoke} />}
      <Birds />
    </group>
  )
}

// The town's name round the water tower's tank.
function WaterTowerSign() {
  const { geo, mat } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#e3eef6'
    g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = '#1d5fa8'
    g.font = 'bold 84px Fredoka, Arial Rounded MT Bold, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (const x of [256, 768]) g.fillText('CARTOPIA', x, 68)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    const geo = new CylinderGeometry(6.25, 6.25, 4, 24, 1, true)
    return { geo, mat: new MeshStandardMaterial({ map: t, roughness: 0.6 }) }
  }, [])
  useEffect(() => () => { geo.dispose(); mat.map?.dispose(); mat.dispose() }, [geo, mat])
  const a = A_LAKE + 0.45
  const x = Math.cos(a) * 240, z = Math.sin(a) * 240
  return <mesh geometry={geo} material={mat} position={[x, groundAt(x, z) - 0.4 + 24 + 3.6, z]} rotation-y={Math.PI / 4} raycast={() => null} />
}

// ---- Train ---------------------------------------------------------------------------

// A locomotive pulling a mixed freight, end to end along the line and round again.
const CARS = [
  { c: '#c62828', len: 14, h: 4.4, loco: true },
  { c: '#1565c0', len: 12, h: 3.8 },
  { c: '#f9a825', len: 12, h: 3.8 },
  { c: '#2e7d32', len: 12, h: 3.8 },
  { c: '#b0bec5', len: 11, h: 3.2, tank: true },
  { c: '#6d4c41', len: 12, h: 3.6 },
  { c: '#e65100', len: 12, h: 3.8 },
  { c: '#b0bec5', len: 11, h: 3.2, tank: true },
  { c: '#455a64', len: 12, h: 3.8 },
]
function Train() {
  const body = useRef<InstancedMesh>(null)
  const lamp = useRef<Mesh>(null)
  const geo = useMemo(() => new BoxGeometry(1, 1, 1), [])
  const mat = useMemo(() => new MeshStandardMaterial({ roughness: 0.6, metalness: 0.2 }), [])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  useLayoutEffect(() => {
    const c = new Color()
    CARS.forEach((car, i) => body.current?.setColorAt(i, c.set(car.c)))
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true
  }, [])
  const head = useRef(-RAIL_LEN * 0.35)
  const o = useMemo(() => new Object3D(), [])
  const yaw = Math.atan2(HWY_DIR[0], HWY_DIR[1])
  useFrame((_, delta) => {
    const m = body.current
    if (!m) return
    head.current += Math.min(delta, 0.1) * 17
    if (head.current > RAIL_LEN + 40) head.current = -RAIL_LEN - 40
    let s = head.current
    CARS.forEach((car, i) => {
      const mid = s - car.len / 2
      const [x, z] = railPoint(mid)
      const y0 = railHeight(mid - car.len / 2), y1 = railHeight(mid + car.len / 2)
      o.position.set(x, (y0 + y1) / 2 + 0.45 + car.h / 2, z)
      o.rotation.set(-Math.atan2(y1 - y0, car.len), yaw, 0, 'YXZ')
      o.scale.set(car.tank ? 2.8 : 3.1, car.h, car.len)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      if (car.loco && lamp.current) {
        const [lx, lz] = railPoint(s + 0.2)
        lamp.current.position.set(lx, y1 + 2.4, lz)
        lamp.current.visible = Math.max(nightAmount(dayPhase()), weatherNow().cloud > 0.7 ? 0.6 : 0) > 0.3
      }
      s -= car.len + 1
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={body} args={[geo, mat, CARS.length]} frustumCulled={false} raycast={() => null} />
      <mesh ref={lamp} raycast={() => null}>
        <sphereGeometry args={[0.8, 8, 6]} />
        <meshBasicMaterial color="#fff3c4" toneMapped={false} />
      </mesh>
    </>
  )
}

// ---- Boats ---------------------------------------------------------------------------

// Little sailing boats tacking round the lake on fair days.
const BOATS = [
  { r: 70, v: 0.03, p: 0, c: '#ffffff' },
  { r: 115, v: -0.022, p: 2, c: '#1e88e5' },
  { r: 140, v: 0.018, p: 4, c: '#e53935' },
  { r: 95, v: -0.026, p: 5.2, c: '#fdd835' },
]
function Boats() {
  const hull = useRef<InstancedMesh>(null)
  const sail = useRef<InstancedMesh>(null)
  const geos = useMemo(() => {
    const h = new BoxGeometry(2.2, 1, 6)
    const s = new BufferGeometry()
    s.setAttribute('position', new BufferAttribute(new Float32Array([0, 1, -1.8, 0, 9, 0.2, 0, 1, 2.2]), 3))
    s.computeVertexNormals()
    return { h, s }
  }, [])
  const mats = useMemo(() => ({ h: new MeshStandardMaterial({ roughness: 0.6 }), s: new MeshStandardMaterial({ color: '#fbfbf7', roughness: 0.8, side: DoubleSide }) }), [])
  useEffect(() => () => { geos.h.dispose(); geos.s.dispose(); mats.h.dispose(); mats.s.dispose() }, [geos, mats])
  useLayoutEffect(() => {
    const c = new Color()
    BOATS.forEach((b, i) => hull.current?.setColorAt(i, c.set(b.c)))
    if (hull.current?.instanceColor) hull.current.instanceColor.needsUpdate = true
  }, [])
  const o = useMemo(() => new Object3D(), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const w = weatherNow()
    BOATS.forEach((b, i) => {
      const a = b.p + t * b.v
      const x = LAKE[0] + Math.cos(a) * b.r * 1.35, z = LAKE[1] + Math.sin(a) * b.r
      // Heading along the circle, heeling a little in the wind.
      const dx = -Math.sin(a) * 1.35 * Math.sign(b.v), dz = Math.cos(a) * Math.sign(b.v)
      o.position.set(x, -1.35 + Math.sin(t * 1.3 + i) * 0.08, z)
      o.rotation.set(0, Math.atan2(dx, dz), (0.08 + w.wind * 0.15) * Math.sign(b.v), 'YXZ')
      o.updateMatrix()
      hull.current?.setMatrixAt(i, o.matrix)
      sail.current?.setMatrixAt(i, o.matrix)
    })
    for (const m of [hull.current, sail.current]) if (m) m.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={hull} args={[geos.h, mats.h, BOATS.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={sail} args={[geos.s, mats.s, BOATS.length]} frustumCulled={false} raycast={() => null} />
    </>
  )
}

// ---- Chimney smoke ---------------------------------------------------------------------

const PUFFS = 6
function Smoke({ spots }: { spots: Smoke[] }) {
  const ref = useRef<InstancedMesh>(null)
  const geo = useMemo(() => new IcosahedronGeometry(1, 0), [])
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#e8ecef', roughness: 1, transparent: true, opacity: 0.75, flatShading: true }), [])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  const o = useMemo(() => new Object3D(), [])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    const wind = 0.6 + weatherNow().wind * 3
    spots.forEach((p, i) => {
      for (let j = 0; j < PUFFS; j++) {
        const k = (t * 0.22 + j / PUFFS + i * 0.37) % 1
        o.position.set(p.x + k * wind * 6, p.y + k * 11, p.z + k * wind * 3)
        o.scale.setScalar(Math.sin(k * Math.PI) * (0.8 + k * 1.8))
        o.rotation.set(k * 3, j, 0)
        o.updateMatrix()
        m.setMatrixAt(i * PUFFS + j, o.matrix)
      }
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, spots.length * PUFFS]} frustumCulled={false} raycast={() => null} />
}

// ---- Birds -----------------------------------------------------------------------------

// Geese in V formation pass over in spring and fall, gulls wheel over the lake in
// summer, and a few crows wander the winter sky. Daytime only.
type Flock = { n: number; c: string; size: number; v: number; y: number; path: 'line' | 'circle'; a: number; off: number; cx?: number; cz?: number; r?: number }
const FLOCKS: Flock[] = ({
  spring: [
    { n: 11, c: '#3e3a36', size: 2.4, v: 15, y: 85, path: 'line', a: A_CITY + 0.9, off: 120 },
    { n: 7, c: '#3e3a36', size: 2.4, v: 14, y: 70, path: 'line', a: A_CITY + 1.1, off: -220 },
  ],
  summer: [
    { n: 6, c: '#fafafa', size: 1.6, v: 0.16, y: 32, path: 'circle', a: 0, off: 0, cx: LAKE[0], cz: LAKE[1], r: 70 },
    { n: 5, c: '#fafafa', size: 1.6, v: -0.13, y: 44, path: 'circle', a: 2, off: 0, cx: LAKE[0] + 60, cz: LAKE[1] - 40, r: 50 },
  ],
  fall: [
    { n: 13, c: '#3e3a36', size: 2.4, v: 15, y: 90, path: 'line', a: A_CITY - 0.4, off: 60 },
    { n: 9, c: '#3e3a36', size: 2.4, v: 16, y: 75, path: 'line', a: A_CITY - 0.2, off: -260 },
  ],
  winter: [{ n: 6, c: '#263238', size: 1.4, v: 0.1, y: 40, path: 'circle', a: 1, off: 0, cx: -150, cz: 330, r: 90 }],
} as Record<string, Flock[]>)[SEASON]
const BIRDS = FLOCKS.reduce((t, f) => t + f.n, 0)
function Birds() {
  const left = useRef<InstancedMesh>(null)
  const right = useRef<InstancedMesh>(null)
  const geo = useMemo(() => {
    const g = new BufferGeometry()
    // One wing, root at the body, tip out along +x, swept back.
    g.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0.45, 0, 0, -0.45, 1, 0, -0.55]), 3))
    g.computeVertexNormals()
    return g
  }, [])
  const mat = useMemo(() => new MeshBasicMaterial({ side: DoubleSide }), [])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  useLayoutEffect(() => {
    const c = new Color()
    let i = 0
    for (const f of FLOCKS) for (let j = 0; j < f.n; j++, i++) for (const m of [left.current, right.current]) m?.setColorAt(i, c.set(f.c))
    for (const m of [left.current, right.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [])
  const o = useMemo(() => new Object3D(), [])
  useFrame(({ clock }) => {
    const L = left.current, R = right.current
    if (!L || !R) return
    const n = nightAmount(dayPhase())
    const show = n < 0.5 && weatherNow().rain < 0.5
    L.visible = R.visible = show
    if (!show) return
    const t = clock.elapsedTime
    let i = 0
    for (const f of FLOCKS) {
      let cx: number, cz: number, head: number
      if (f.path === 'line') {
        // Across the whole sky and round again.
        const dx = Math.cos(f.a), dz = Math.sin(f.a)
        const s = ((t * f.v + 700) % 1400) - 700
        cx = dx * s - dz * f.off
        cz = dz * s + dx * f.off
        head = Math.atan2(dx, dz)
      } else {
        const a = f.a + t * f.v
        cx = f.cx! + Math.cos(a) * f.r!
        cz = f.cz! + Math.sin(a) * f.r!
        head = Math.atan2(-Math.sin(a) * Math.sign(f.v), Math.cos(a) * Math.sign(f.v))
      }
      for (let j = 0; j < f.n; j++, i++) {
        // V formation: alternate sides, each further back.
        const side = j === 0 ? 0 : j % 2 ? 1 : -1
        const rank = Math.ceil(j / 2)
        const spread = f.path === 'line' ? 4.5 : 9
        const bx = side * rank * spread, bz = -rank * spread * (f.path === 'line' ? 1 : 0.4)
        const x = cx + Math.cos(head) * bx + Math.sin(head) * bz
        const z = cz - Math.sin(head) * bx + Math.cos(head) * bz
        const flap = Math.sin(t * (f.path === 'line' ? 5 : 7) + j * 1.7) * 0.55
        const y = f.y + Math.sin(t * 0.7 + j) * 1.5
        for (const [m, sgn] of [[L, 1], [R, -1]] as const) {
          o.position.set(x, y, z)
          o.rotation.set(0, head, flap * sgn, 'YXZ')
          o.scale.set(f.size * sgn * 2.2, f.size, f.size * 1.4)
          o.updateMatrix()
          m.setMatrixAt(i, o.matrix)
        }
      }
    }
    L.instanceMatrix.needsUpdate = true
    R.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={left} args={[geo, mat, BIRDS]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={right} args={[geo, mat, BIRDS]} frustumCulled={false} raycast={() => null} />
    </>
  )
}

