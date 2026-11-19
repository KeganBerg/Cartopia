// Renders buildings at each level and dumps their meshes for the Roblox port
// (scripts/roblox/models.mjs drives it). window.build(id, level) returns every
// visible mesh as a shape, a box-relative transform and a material; meshes that
// aren't a box, ball or cylinder come back once each as unit-box geometry, so
// any size of the same shape is one Roblox mesh.
import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Box3, BufferGeometry, Color, Float32BufferAttribute, InstancedMesh, Matrix4, Mesh, Vector3, type Group, type Material, type MeshStandardMaterial, type Texture } from 'three'
import { BUILDINGS, maxLevel } from '../../src/game/data'
import { BuildingModel } from '../../src/scene/BuildingModel'
import { KeepShapes } from '../../src/scene/mergeScale'
import { limitFor } from '../../src/scene/keepShape'
import { SharedShapes } from '../../src/scene/sharedShapes'

type W = Window & Record<string, unknown>
const w = window as unknown as W
const TAU = Math.PI * 2
const near = (a: number, b: number) => Math.abs(a - b) < 1e-4

// The shape a geometry maps to in Roblox, and its size in its own space.
// B: block, S: ball, C: cylinder along Y, D: disc facing +Z, M: a mesh.
function primitive(g: BufferGeometry): { s: string; size: Vector3; center: Vector3 } | null {
  const p = (g as unknown as { parameters?: Record<string, number> }).parameters
  const z = new Vector3()
  if (!p) return null
  switch (g.type) {
    case 'BoxGeometry': return { s: 'B', size: new Vector3(p.width, p.height, p.depth), center: z }
    case 'PlaneGeometry': return { s: 'B', size: new Vector3(p.width, p.height, 0), center: z }
    case 'SphereGeometry':
      return near(p.phiLength, TAU) && near(p.thetaStart, 0) && near(p.thetaLength, Math.PI) && p.widthSegments >= 6 ? { s: 'S', size: new Vector3(2, 2, 2).multiplyScalar(p.radius), center: z } : null
    case 'CylinderGeometry':
      return near(p.radiusTop, p.radiusBottom) && near(p.thetaLength, TAU) && p.radialSegments >= 6 && !p.openEnded ? { s: 'C', size: new Vector3(2 * p.radiusTop, p.height, 2 * p.radiusTop), center: z } : null
    case 'CircleGeometry':
      return near(p.thetaLength, TAU) && p.segments >= 8 ? { s: 'D', size: new Vector3(2 * p.radius, 2 * p.radius, 0), center: z } : null
  }
  return null
}

// Custom shapes: positions and normals squeezed into a unit box, rounded so the
// same shape at any size (or rebuilt each render) hashes the same.
const sent = new Set<string>()
const shapes = new Map<BufferGeometry, Map<string, { key: string; size: Vector3; center: Vector3; data: unknown }>>()
function meshShape(g: BufferGeometry, mirror: boolean, uvRep?: number[]) {
  const memoKey = uvRep ? `${uvRep}` : ''
  const memo = shapes.get(g)?.get(memoKey)
  if (memo && !mirror) return memo
  g.computeBoundingBox()
  const box = g.boundingBox as Box3
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const s = [size.x || 1, size.y || 1, size.z || 1]
  const c = [center.x, center.y, center.z]
  const pos = g.getAttribute('position')
  const nrm = g.getAttribute('normal')
  const uv = uvRep ? g.getAttribute('uv') : undefined
  const idx = g.getIndex()
  const P: number[] = []
  const N: number[] = []
  const U: number[] = []
  const f = mirror ? -1 : 1
  for (let i = 0; i < pos.count; i++) {
    P.push(Math.round(((pos.getX(i) - c[0]) / s[0]) * f * 1000) / 1000, Math.round(((pos.getY(i) - c[1]) / s[1]) * 1000) / 1000, Math.round(((pos.getZ(i) - c[2]) / s[2]) * 1000) / 1000)
    if (nrm) {
      const v = new Vector3(nrm.getX(i) * s[0] * f, nrm.getY(i) * s[1], nrm.getZ(i) * s[2]).normalize()
      N.push(Math.round(v.x * 1000) / 1000, Math.round(v.y * 1000) / 1000, Math.round(v.z * 1000) / 1000)
    }
    if (uv && uvRep) U.push(Math.round(uv.getX(i) * uvRep[0] * 1000) / 1000, Math.round(uv.getY(i) * uvRep[1] * 1000) / 1000)
  }
  const I: number[] = idx ? Array.from(idx.array) : [...Array(pos.count).keys()]
  // Mirroring flips the winding.
  if (mirror) for (let i = 0; i < I.length; i += 3) [I[i + 1], I[i + 2]] = [I[i + 2], I[i + 1]]
  const body = `${P.join()}|${I.join()}|${U.join()}`
  let h = 2166136261
  for (let i = 0; i < body.length; i++) h = Math.imul(h ^ body.charCodeAt(i), 16777619)
  const key = `${g.type.replace('Geometry', '').toLowerCase()}-${(h >>> 0).toString(36)}`
  const out = { key, size, center, data: sent.has(key) ? null : { p: P, n: N, i: I, u: U } }
  sent.add(key)
  if (!mirror) {
    if (!shapes.has(g)) shapes.set(g, new Map())
    shapes.get(g)!.set(memoKey, { ...out, data: null })
  }
  return out
}

// Images: each canvas texture once, by the name textures.ts gives it.
const images = new Map<string, string>()
function texture(t: Texture | null | undefined) {
  if (!t) return null
  const u = t.userData as { key?: string; label?: string; colors?: string[]; aspect?: number }
  if (u.label) return { sign: u.label, colors: u.colors ?? ['#ffffff', '#c62828'] }
  const img = t.image as HTMLCanvasElement | undefined
  let key = u.key
  if (!key && img?.toDataURL) {
    const d = img.toDataURL()
    let h = 2166136261
    for (let i = 0; i < d.length; i += 7) h = Math.imul(h ^ d.charCodeAt(i), 16777619)
    key = `img-${(h >>> 0).toString(36)}`
  }
  if (!key) return null
  key = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!images.has(key) && img?.toDataURL) images.set(key, img.toDataURL('image/png'))
  return { tex: key, rep: [Math.round(t.repeat.x * 100) / 100, Math.round(t.repeat.y * 100) / 100] }
}

function look(m: Material & Partial<MeshStandardMaterial>) {
  const e = m.emissive && (m.emissiveIntensity ?? 0) > 0 && m.emissive.getHex() ? `#${m.emissive.getHexString()}` : undefined
  return {
    color: m.color ? `#${m.color.getHexString()}` : '#ffffff',
    ...texture(m.map),
    alpha: m.transparent || m.opacity < 1 ? Math.round(m.opacity * 100) / 100 : undefined,
    glow: e ?? (m.type === 'MeshBasicMaterial' && m.toneMapped === false ? `#${m.color?.getHexString()}` : undefined),
    metal: m.metalness && m.metalness > 0.45 ? Math.round(m.metalness * 100) / 100 : undefined,
  }
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4

// A vertex-coloured mesh (people, props built from painted pieces: peopleGeo.ts paint())
// splits into one single-colour piece per colour, since a Roblox part has one colour.
const split = new WeakMap<BufferGeometry, { g: BufferGeometry; tint: Color }[]>()
function pieces(g: BufferGeometry, vertexColors: boolean) {
  const col = g.getAttribute('color')
  if (!vertexColors || !col) return [{ g, tint: new Color(1, 1, 1) }]
  const hit = split.get(g)
  if (hit) return hit
  const pos = g.getAttribute('position')
  const nrm = g.getAttribute('normal')
  const idx = g.getIndex()
  const n = idx ? idx.count : pos.count
  const uv = g.getAttribute('uv')
  const groups = new Map<string, { tint: Color; p: number[]; n: number[]; u: number[] }>()
  for (let t = 0; t < n; t += 3) {
    const a = idx ? idx.getX(t) : t
    const tint = new Color(col.getX(a), col.getY(a), col.getZ(a))
    const k = tint.getHexString()
    if (!groups.has(k)) groups.set(k, { tint, p: [], n: [], u: [] })
    const gr = groups.get(k)!
    for (let j = 0; j < 3; j++) {
      const v = idx ? idx.getX(t + j) : t + j
      gr.p.push(pos.getX(v), pos.getY(v), pos.getZ(v))
      if (nrm) gr.n.push(nrm.getX(v), nrm.getY(v), nrm.getZ(v))
      if (uv) gr.u.push(uv.getX(v), uv.getY(v))
    }
  }
  const out = [...groups.values()].map(({ tint, p, n: nn, u }) => {
    const sub = new BufferGeometry()
    sub.setAttribute('position', new Float32BufferAttribute(p, 3))
    if (nn.length) sub.setAttribute('normal', new Float32BufferAttribute(nn, 3))
    if (u.length) sub.setAttribute('uv', new Float32BufferAttribute(u, 2))
    return { g: sub, tint }
  })
  // One colour: keep the original, so a painted ball is still a ball.
  const res = out.length === 1 ? [{ g, tint: out[0].tint }] : out
  split.set(g, res)
  return res
}

// Crowds (speedway stands, funfair, club) and race cars: instanced things that move. They
// stay out of the building models; the Roblox game spawns its own crowd (see HANDOFF.md).
const moved = (o: InstancedMesh, before: Float32Array | undefined) => !!before && o.count >= 2 && o.instanceMatrix.array.some((x, i) => Math.abs(x - before[i]) > 1e-5)
// Speedway fans stand still between cheers, so they go by name (SpeedwayLife.tsx).
const life = (o: InstancedMesh, before: Float32Array | undefined) => o.name.startsWith('fan-') || moved(o, before)

function dump(root: Group, before: Map<InstancedMesh, Float32Array>) {
  root.updateWorldMatrix(true, true)
  const inv = new Matrix4().copy(root.matrixWorld).invert()
  const parts: unknown[] = []
  const meshes: Record<string, unknown> = {}
  const tmp = new Matrix4()
  const ic = new Color()
  const left: number[] = []
  root.traverseVisible((o) => {
    if (!(o instanceof Mesh)) return
    if (o instanceof InstancedMesh && life(o, before.get(o))) return void left.push(o.count)
    const g = o.geometry as BufferGeometry
    const base = new Matrix4().multiplyMatrices(inv, o.matrixWorld)
    const list: { m: Matrix4; tint?: Color }[] = []
    if (o instanceof InstancedMesh) for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, tmp)
      if (o.instanceColor) o.getColorAt(i, ic)
      list.push({ m: new Matrix4().multiplyMatrices(base, tmp), tint: o.instanceColor ? ic.clone() : undefined })
    }
    else list.push({ m: base })
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    // Per-face materials on a box: three's groups go +x, -x, +y, -y, +z, -z.
    const faces = Array.isArray(o.material) && g.type === 'BoxGeometry' ? g.groups.map((gr) => look(mats[gr.materialIndex ?? 0] as Material)) : undefined
    const m0 = mats[0] as Material & Partial<MeshStandardMaterial>
    for (const piece of pieces(g, !!m0.vertexColors)) for (const { m, tint } of list) {
      const mat = look(m0)
      const c = new Color(mat.color).multiply(piece.tint)
      if (tint) c.multiply(tint)
      mat.color = `#${c.getHexString()}`
      const mirror = m.determinant() < 0
      // A textured shape other than a block (a striped canopy, a balloon) goes as a mesh
      // with UVs, so the image wraps it the way it does on the web.
      const wrap = mat.tex && piece.g.type !== 'BoxGeometry' && piece.g.type !== 'PlaneGeometry' && piece.g.getAttribute('uv') ? mat.rep : undefined
      const prim = wrap ? null : primitive(piece.g)
      const sh = prim ?? meshShape(piece.g, mirror, wrap)
      const shape = prim ? prim.s : (sh as { key: string }).key
      if (!prim && (sh as { data: unknown }).data) meshes[shape] = (sh as { data: unknown }).data
      const fix = new Matrix4().makeTranslation(sh.center.x, sh.center.y, sh.center.z)
      const sz = sh.size
      const full = new Matrix4().multiplyMatrices(m, fix).multiply(new Matrix4().makeScale(sz.x || 1, sz.y || 1, sz.z || 1))
      // Mirrored primitives are symmetric: flip x back so the frame is a rotation.
      if (mirror) full.multiply(new Matrix4().makeScale(-1, 1, 1))
      parts.push({ s: shape, m: full.elements.map(r4), flat: [!sz.x, !sz.y, !sz.z], mat, faces })
    }
  })
  // People in the crowd: the most common count among the left-out meshes (one torso, head, hair each).
  const tally = new Map<number, number>()
  for (const n of left) tally.set(n, (tally.get(n) ?? 0) + 1)
  const crowd = [...tally].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0
  return { parts, meshes, crowd }
}

function Scene({ id, level, onReady }: { id: string; level: number; onReady: (g: Group, before: Map<InstancedMesh, Float32Array>) => void }) {
  const root = useRef<Group>(null)
  const { invalidate } = useThree()
  const def = BUILDINGS.find((d) => d.id === id)!
  useEffect(() => {
    // A few frames first (things place themselves on the first one), then snapshot every
    // instanced mesh, a few more frames, and anything that moved in between is a crowd.
    let n = 0
    const before = new Map<InstancedMesh, Float32Array>()
    const tick = () => {
      if (++n === 6) root.current!.traverse((o) => { if (o instanceof InstancedMesh) before.set(o, o.instanceMatrix.array.slice() as Float32Array) })
      if (n === 14) return onReady(root.current!, before)
      invalidate()
      setTimeout(tick, 40)
    }
    tick()
  }, [id, level, invalidate, onReady])
  return (
    <group ref={root} key={`${id}-${level}`}>
      <KeepShapes limit={limitFor(def)}>
        <BuildingModel def={def} level={level} />
      </KeepShapes>
    </group>
  )
}

let waiting: ((g: Group, before: Map<InstancedMesh, Float32Array>) => void) | null = null
const ready = (g: Group, before: Map<InstancedMesh, Float32Array>) => { waiting?.(g, before); waiting = null }
let setShow: (s: { id: string; level: number }) => void = () => {}

function App() {
  const [show, set] = useState<{ id: string; level: number } | null>(null)
  useEffect(() => { setShow = set; w.ready = true }, [])
  return (
    <Canvas frameloop="demand" dpr={1}>
      <SharedShapes />
      {show && <Scene id={show.id} level={show.level} onReady={ready} />}
    </Canvas>
  )
}

w.ids = BUILDINGS.map((d) => ({ id: d.id, name: d.name, kind: d.kind, w: d.w, h: d.h, maxLevel: maxLevel(d) }))
w.build = (id: string, level: number) => new Promise((done) => {
  waiting = (g, before) => done(dump(g, before))
  setShow({ id, level })
})
w.images = () => Object.fromEntries(images)
// Each image's average colour (0-1 per channel), for the plain-colour fallback.
w.averages = () => Object.fromEntries([...images.keys()].map((k) => {
  const img = new Image()
  img.src = images.get(k)!
  const c = document.createElement('canvas')
  c.width = c.height = 16
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0, 16, 16)
  const d = g.getImageData(0, 0, 16, 16).data
  const sum = [0, 0, 0]
  for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) sum[j] += d[i + j]
  return [k, sum.map((x) => Math.round((x / 256 / 255) * 1000) / 1000)]
}))
createRoot(document.getElementById('root')!).render(<App />)
