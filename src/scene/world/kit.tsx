import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferAttribute, ExtrudeGeometry, Shape, Color, type Material, CylinderGeometry, Matrix4, MeshStandardMaterial, Object3D, Quaternion, Euler, Vector3, type BufferGeometry, type Group, type InstancedMesh } from 'three'
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
// near: hide stretches that start further ahead than this (people, cows and other small things
// that are specks in the haze by then), the cheapest level of detail there is.
export function Many({ parts, at, near }: { parts: Built; at: Spot[]; near?: number }) {
  const flat = useMemo(() => flatten(parts), [parts])
  const runs = useMemo(() => {
    const m = new Map<number, Spot[]>()
    for (const p of at) {
      const k = Math.floor(p.z / STRETCH)
      let l = m.get(k)
      if (!l) m.set(k, (l = []))
      l.push(p)
    }
    return [...m.entries()].map(([k, spots]) => ({ z0: k * STRETCH, spots }))
  }, [at])
  const groups = useRef<(Group | null)[]>([])
  useFrame(({ camera }) => {
    if (near === undefined) return
    runs.forEach((run, j) => {
      const g = groups.current[j]
      if (g) g.visible = run.z0 - camera.position.z < near
    })
  })
  return (
    <>
      {runs.map((run, j) => (
        <group key={j} ref={(g) => { groups.current[j] = g }}>
          {flat.map((p, i) => <Placed key={i} geo={p.geo} mat={p.mat} at={run.spots} />)}
        </group>
      ))}
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

// People at the townspeople's true size (peopleGeo.ts, scale 1.3, about 0.9 tall), with faces:
// eyes, nose, mouth, ears and hands. Built into a venue's props so a whole cluster of them is
// one merged mesh: dress them for the country (a long robe or sari instead of trousers, a
// turban, headscarf, cap or fur hat) and place clusters with <Many>.
export type Dress = { top: string; low: string; skin: string; hair: string; robe?: boolean; sash?: string; hat?: 'turban' | 'scarf' | 'cap' | 'fur' | 'kufi'; hatC?: string; wave?: boolean }
const P = 1.3
const ROBE = new CylinderGeometry(0.85, 1.25, 1, 7, 1, true)
export function person(k: PropKit, d: Dress, x = 0, z = 0, ry = 0) {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  // Local (u across, y up, w forward) to the prop's space, all at townspeople scale.
  const at = (u: number, y: number, w: number): V3 => [x + (u * c + w * s) * P, y * P, z + (-u * s + w * c) * P]
  const top: Look = { c: d.top, r: 0.9 }
  const low: Look = { c: d.low, r: 0.9 }
  const skin: Look = { c: d.skin, r: 0.8 }
  const hair: Look = { c: d.hair, r: 0.9 }
  const dark: Look = { c: '#1a1a1a', r: 0.9 }
  if (d.robe) {
    // A long robe or skirt to the ground, the feet just showing.
    k.add(low, ROBE, at(0, 0.27, 0), [0, ry, 0], [0.1 * P, 0.5 * P, 0.1 * P])
    for (const f of [-1, 1]) k.box(dark, [0.06 * P, 0.03 * P, 0.09 * P], at(f * 0.04, 0.015, 0.05), [0, ry, 0])
  } else {
    for (const f of [-1, 1]) {
      k.box(low, [0.06 * P, 0.24 * P, 0.07 * P], at(f * 0.045, 0.12, 0), [0, ry, 0])
      k.box(dark, [0.066 * P, 0.04 * P, 0.105 * P], at(f * 0.045, 0.02, 0.017), [0, ry, 0])
    }
  }
  // Torso, shoulders and sleeved arms, hands at the ends.
  k.cyl(top, 0.075 * P, 0.088 * P, 0.24 * P, at(0, 0.39, 0), [0, ry, 0], 6)
  k.sphere(top, 0.085 * P, at(0, 0.5, 0), [1, 0.55, 0.85], 6, 3, Math.PI / 2)
  for (const f of [-1, 1]) {
    const up = d.wave && f > 0
    const hand = up ? at(f * 0.16, 0.74, 0.02) : at(f * 0.12, 0.29, 0.01)
    k.rod(top, at(f * 0.1, 0.49, 0), hand, 0.028 * P, 4)
    k.sphere(skin, 0.026 * P, hand, [1, 1, 1], 5, 3)
  }
  if (d.sash) k.box({ c: d.sash, r: 0.9 }, [0.05 * P, 0.36 * P, 0.19 * P], at(0, 0.4, 0.005), [0, ry, -0.5])
  // Neck, head and face.
  k.cyl(skin, 0.032 * P, 0.036 * P, 0.05 * P, at(0, 0.535, 0), [0, ry, 0], 5)
  k.sphere(skin, 0.08 * P, at(0, 0.6, 0), [1, 1, 1], 8, 5)
  k.box(skin, [0.022 * P, 0.03 * P, 0.03 * P], at(0, 0.594, 0.077), [0, ry, 0])
  for (const f of [-1, 1]) {
    k.box(dark, [0.02 * P, 0.022 * P, 0.012 * P], at(f * 0.028, 0.614, 0.071), [0, ry, 0])
    k.box(skin, [0.024 * P, 0.036 * P, 0.03 * P], at(f * 0.078, 0.6, -0.004), [0, ry, 0])
  }
  k.box({ c: '#8a4a4a', r: 0.9 }, [0.03 * P, 0.006 * P, 0.01 * P], at(0, 0.57, 0.073), [0, ry, 0])
  // Hair, then whatever covers it.
  const hc: Look = { c: d.hatC ?? d.hair, r: 0.9 }
  if (d.hat === 'turban') {
    k.sphere(hc, 0.092 * P, at(0, 0.64, -0.005), [1.08, 0.78, 1.08], 8, 5)
    k.cyl(hc, 0.088 * P, 0.088 * P, 0.035 * P, at(0, 0.64, 0), [0.2, ry, 0], 9)
  } else if (d.hat === 'scarf') {
    // A headscarf over the hair, falling to the shoulders behind.
    k.sphere(hc, 0.09 * P, at(0, 0.61, -0.008), [1, 1.04, 1], 9, 6, Math.PI * 0.62)
    k.box(hc, [0.15 * P, 0.14 * P, 0.03 * P], at(0, 0.53, -0.065), [0, ry, 0])
  } else if (d.hat === 'fur') {
    k.sphere(hair, 0.083 * P, at(0, 0.615, -0.01), [1, 1, 1], 6, 3, Math.PI / 2)
    k.cyl(hc, 0.092 * P, 0.098 * P, 0.09 * P, at(0, 0.67, 0), [0, ry, 0], 9)
  } else if (d.hat === 'cap' || d.hat === 'kufi') {
    k.sphere(hair, 0.083 * P, at(0, 0.615, -0.01), [1, 1, 1], 6, 3, Math.PI / 2)
    k.cyl(hc, 0.074 * P, 0.082 * P, 0.045 * P, at(0, 0.67, 0), [0, ry, 0], 9)
    if (d.hat === 'cap') k.box(hc, [0.1 * P, 0.01 * P, 0.07 * P], at(0, 0.655, 0.09), [0, ry, 0])
  } else {
    k.sphere(hair, 0.084 * P, at(0, 0.618, -0.012), [1, 1, 1], 6, 3, Math.PI / 2)
  }
}
