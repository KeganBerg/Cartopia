import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, BufferAttribute, ExtrudeGeometry, Shape, Color, type Material, CylinderGeometry, Matrix4, MeshStandardMaterial, Object3D, Quaternion, Euler, Vector3, type BufferGeometry, type InstancedMesh } from 'three'
import { glowMats, onNight } from '../dayNight'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PropKit, prop, type Built, type Look } from '../propKit'

// Shared pieces for the World Tour venues (scene/world/*). Each venue builds its landmarks and
// repeated houses once with PropKit (one merged mesh per colour), then places the repeated ones
// with <Many>, one instanced draw per colour however many copies line the road.

export { Box, Cyl, Cone, Flat, Scatter, Water, Palm, rand, ROAD, WALK, EDGE, Horizon, along, spread, Gulls, Sparkles } from '../RaceVenues'
export { prop, PropKit, PropMesh, type Built, type Look } from '../propKit'

export type V3 = [number, number, number]
export type Spot = { x: number; z: number; y?: number; ry?: number; s?: number }

// One built prop at many spots. Its plain parts are folded into one vertex-coloured mesh
// (shiny, glowing and see-through parts stay apart), and the copies are split into stretches
// down the road, each an instanced draw, so the camera skips the stretches it can't see and a
// mile of houses costs a handful of draws and one copy of each house in memory.
const STRETCH = 40
export function Many({ parts, at }: { parts: Built; at: Spot[] }) {
  const flat = useMemo(() => flatten(parts), [parts])
  const runs = useMemo(() => {
    const m = new Map<number, Spot[]>()
    for (const p of at) {
      const k = Math.floor(p.z / STRETCH)
      let l = m.get(k)
      if (!l) m.set(k, (l = []))
      l.push(p)
    }
    return [...m.values()]
  }, [at])
  return (
    <>
      {runs.map((run, j) => flat.map((p, i) => <Placed key={`${j}-${i}`} geo={p.geo} mat={p.mat} at={run} />))}
    </>
  )
}

const painted = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
const flats = new WeakMap<Built, Built>()
const plainMat = (m: Material) => {
  const s = m as MeshStandardMaterial
  return s.isMeshStandardMaterial && !s.userData.live && !s.map && !s.transparent && s.emissive.getHex() === 0 && s.metalness < 0.3 && !Object.values(glowMats).includes(s as never)
}
export function flatten(parts: Built): Built {
  let f = flats.get(parts)
  if (f) return f
  const plain = parts.filter((p) => plainMat(p.mat))
  const rest = parts.filter((p) => !plainMat(p.mat))
  if (plain.length < 2) f = parts
  else {
    const geos = plain.map((p) => {
      const g = p.geo.clone()
      const c = (p.mat as MeshStandardMaterial).color
      const n = g.getAttribute('position').count
      const col = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
      g.setAttribute('color', new BufferAttribute(col, 3))
      return g
    })
    const geo = mergeGeometries(geos)!
    geos.forEach((g) => g.dispose())
    geo.computeBoundingSphere()
    f = [{ geo, mat: painted, cast: plain.some((p) => p.cast) }, ...rest]
  }
  flats.set(parts, f)
  return f
}

function Placed({ geo, mat, at }: { geo: BufferGeometry; mat: Material; at: Spot[] }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    at.forEach((p, i) => {
      o.position.set(p.x, p.y ?? 0, p.z)
      o.rotation.set(0, p.ry ?? 0, 0)
      o.scale.setScalar(p.s ?? 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [at])
  return <instancedMesh ref={ref} args={[geo, mat, at.length]} raycast={() => null} dispose={null} />
}

// Glowing signs, lanterns and strip lights in colours the town's own neon doesn't have.
// Dim by day, lit after dark, like the club's neon (dayNight.ts applyNight).
const glows = new Map<string, MeshStandardMaterial>()
export function glowMat(c: string, day = 0.08, lit = 1.6) {
  const k = `${c}|${day}|${lit}`
  let m = glows.get(k)
  if (!m) {
    const mat = new MeshStandardMaterial({ color: new Color(c).multiplyScalar(0.55), emissive: new Color(c), emissiveIntensity: day, toneMapped: false })
    mat.userData.live = true
    onNight((n) => { mat.emissiveIntensity = day + n * lit })
    glows.set(k, (m = mat))
  }
  return m
}
export const glow = (c: string, day?: number, lit?: number): Look => ({ c, use: glowMat(c, day, lit) })

// Shapes PropKit doesn't have.
const q = new Quaternion()
const eu = new Euler()
const mx = new Matrix4()
const v = new Vector3()
const sv = new Vector3()
const shapes = new Map<string, BufferGeometry>()
const shape = (k: string, make: () => BufferGeometry) => {
  let g = shapes.get(k)
  if (!g) shapes.set(k, (g = make()))
  return g
}

// A box w wide, d deep and h tall whose top is `top` times the size of its base (pylons,
// obelisks, pyramids with top = 0), standing on p.
export function frustum(k: PropKit, look: Look, w: number, d: number, h: number, top: number, p: V3, ry = 0) {
  const g = shape(`frus${top}`, () => new CylinderGeometry(top, 1, 1, 4, 1).rotateY(Math.PI / 4).scale(Math.SQRT2, 1, Math.SQRT2))
  return k.add(look, g, [p[0], p[1] + h / 2, p[2]], [0, ry, 0], [w / 2, h, d / 2])
}

// A half-round arch top (doorways, windows), facing +z, of width w, standing on p. sy squashes
// it into a flatter arch.
export function archTop(k: PropKit, look: Look, w: number, d: number, p: V3, ry = 0, sy = 1) {
  const g = shape('arch', () => new CylinderGeometry(1, 1, 1, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2))
  return k.add(look, g, p, [0, ry, 0], [w / 2, (w / 2) * sy, d])
}

// A wedge (a ramp or a lean-to roof): full height at -z, nothing at +z.
export function wedge(k: PropKit, look: Look, s: V3, p: V3, ry = 0) {
  const g = shape('wedge', () => {
    const b = new BoxGeometry(1, 1, 1)
    const pos = b.getAttribute('position')
    for (let i = 0; i < pos.count; i++) if (pos.getZ(i) > 0 && pos.getY(i) > 0) pos.setY(i, -0.5)
    b.computeVertexNormals()
    return b
  })
  return k.add(look, g, p, [0, ry, 0], s)
}

// A gable roof (ridge along x) of width w, depth d and rise h, sitting on p.
export function gable(k: PropKit, look: Look, w: number, d: number, h: number, p: V3, ry = 0) {
  const g = shape('gable', () => {
    const b = new BoxGeometry(1, 1, 1)
    const pos = b.getAttribute('position')
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setZ(i, 0)
    b.translate(0, 0.5, 0)
    b.computeVertexNormals()
    return b
  })
  return k.add(look, g, p, [0, ry, 0], [w, h, d])
}

export function placeGeo(geo: BufferGeometry, p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) {
  q.setFromEuler(eu.set(r[0], r[1], r[2], 'YXZ'))
  return geo.clone().applyMatrix4(mx.compose(v.set(...p), q, sv.set(...s)))
}

// Builds a prop the first time it's asked for and keeps it (so remounts cost nothing).
export const useProp = (key: string, make: (k: PropKit) => void) => useMemo(() => prop(key, make), [key]) // eslint-disable-line react-hooks/exhaustive-deps

// One half of a frond: a flat, tapering blade lying along +x.
const LEAF = (() => {
  const s = new Shape()
  s.moveTo(-0.5, 0)
  s.lineTo(-0.2, 0.3)
  s.lineTo(0.5, 0.1)
  s.lineTo(0.5, -0.1)
  s.lineTo(-0.2, -0.3)
  s.closePath()
  return new ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }).rotateX(-Math.PI / 2)
})()

// A coconut palm, its trunk curving towards the sea, fronds drooping, a cluster of coconuts.
export function coconutPalm(k: PropKit) {
  const bark: Look = { c: '#8a6a4c', r: 1 }
  const ring: Look = { c: '#6f5340', r: 1 }
  const pts: [number, number, number][] = []
  for (let i = 0; i <= 5; i++) {
    const t = i / 5
    pts.push([t * t * 0.9, t * 4.2, 0])
  }
  for (let i = 0; i < 5; i++) {
    k.rod(bark, pts[i], pts[i + 1], 0.13 - i * 0.012, 7)
    k.cyl(ring, 0.14 - i * 0.012, 0.14 - i * 0.012, 0.06, pts[i + 1], undefined, 7)
  }
  const top = pts[5]
  const leaf = ['#2f7d3b', '#3a8f45', '#2a6d34']
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + (i % 2) * 0.12
    const c = Math.cos(a)
    const s = Math.sin(a)
    const look: Look = { c: leaf[i % 3], r: 0.9 }
    // Inner half of the frond rises a little; the outer half droops.
    const mid: [number, number, number] = [top[0] + c * 0.9, top[1] + 0.25, top[2] + s * 0.9]
    const tip: [number, number, number] = [top[0] + c * 1.8, top[1] - 0.45, top[2] + s * 1.8]
    k.add(look, LEAF, [(top[0] + mid[0]) / 2, (top[1] + mid[1]) / 2, (top[2] + mid[2]) / 2], [0, -a, 0.27], [0.95, 1, 1])
    k.add(look, LEAF, [(mid[0] + tip[0]) / 2, (mid[1] + tip[1]) / 2, (mid[2] + tip[2]) / 2], [0, -a, -0.66], [1.0, 1, 0.8])
  }
  for (const [x, z] of [[0.12, 0.08], [-0.08, 0.12], [0.02, -0.13]]) k.sphere({ c: '#6b4f2e', r: 0.8 }, 0.11, [top[0] + x, top[1] - 0.18, top[2] + z], [1, 1, 1], 8, 6)
}
