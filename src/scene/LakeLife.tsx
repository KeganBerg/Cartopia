import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry, BufferAttribute, BufferGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Line, LineBasicMaterial, Matrix4, MeshStandardMaterial,
  Object3D, SphereGeometry, Vector3, type Group, type InstancedMesh, type Mesh,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { dayPhase, glowMats, nightAmount } from './dayNight'
import { weatherNow } from '../game/weather'
import { PERSON } from './peopleGeo'
import { DuckFamily, type DuckKind } from './Ducks'
import { floatOn, floaters, heightAt, splash, wake } from './liveWater'

// Life on the outskirts lake: a fisherman rowing his boat out, casting, waiting
// on a bite and reeling one in; gulls wheeling overhead that come down to sit
// on the water or the dock and take off again; and a mallard family paddling
// along. Everything here moves, so none of it goes in a Batch; each kind of
// thing is one mesh (gulls one instanced set), so the whole lake adds about a
// dozen draws, and nothing runs while the lake is off screen.
//
// Sizes are true to the townspeople: the fisherman is built from their parts
// at their scale, the boat is a 3.4 m rowboat, a gull spans 1.3 m.

export type LakeShape = { x: number; z: number; rx: number; rz: number; y: number; dock: [number, number] }

// ---- Painting helpers ------------------------------------------------------------------------

const col = new Color()
function paint(g: BufferGeometry, hex: string) {
  const geo = g.index ? g.toNonIndexed() : g
  col.set(hex)
  const n = geo.getAttribute('position').count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3)
  geo.setAttribute('color', new BufferAttribute(a, 3))
  if (geo.getAttribute('uv')) geo.deleteAttribute('uv')
  return geo
}
const m4 = new Matrix4()
function put(g: BufferGeometry, x: number, y: number, z: number, o: { s?: [number, number, number]; r?: [number, number, number] } = {}) {
  if (o.s) g.applyMatrix4(m4.makeScale(...o.s))
  if (o.r) g.rotateX(o.r[0]).rotateY(o.r[1]).rotateZ(o.r[2])
  return g.translate(x, y, z)
}
// A rounded limb from a to b.
const up = new Vector3(0, 1, 0)
function limb(a: [number, number, number], b: [number, number, number], r: number, hex: string) {
  const va = new Vector3(...a), vb = new Vector3(...b)
  const len = va.distanceTo(vb)
  const g = new CapsuleGeometry(r, Math.max(0.001, len - r * 2), 3, 8)
  const q = new Object3D()
  q.quaternion.setFromUnitVectors(up, vb.clone().sub(va).normalize())
  q.position.copy(va).add(vb).multiplyScalar(0.5)
  q.updateMatrix()
  g.applyMatrix4(q.matrix)
  return paint(g, hex)
}
const merge = (parts: BufferGeometry[]) => {
  const g = mergeGeometries(parts)!
  g.computeBoundingSphere()
  return g
}
const shown = (o: Object3D | null) => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false
  return !!o
}

// ---- The rowboat -------------------------------------------------------------------------------

// Boat frame: bow towards +z, waterline at y 0.
const BOAT_LEN = 1.7
const BOAT_BEAM = 0.64
const OARLOCK: [number, number, number] = [0.31, 0.19, 0.1]

function hullGeo(paintHex: string) {
  // Sections from stern to bow: [z, half-beam, keel depth, sheer height].
  const S: [number, number, number, number][] = [
    [-0.85, 0.22, -0.05, 0.17], [-0.6, 0.29, -0.08, 0.16], [-0.25, 0.32, -0.09, 0.155], [0.1, 0.32, -0.09, 0.16],
    [0.4, 0.28, -0.08, 0.175], [0.62, 0.2, -0.06, 0.2], [0.78, 0.1, -0.03, 0.23], [0.86, 0.015, 0.0, 0.25],
  ]
  // Round the bilge: points across a section, from port gunwale to starboard.
  const ring = ([z, w, keel, top]: [number, number, number, number], k: number) => {
    const pts: [number, number, number][] = []
    const n = 7
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI
      const x = -Math.cos(a) * w * k
      const s = Math.sin(a)
      pts.push([x, top - (top - keel) * Math.pow(s, 0.55) * (k < 1 ? 0.92 : 1) + (k < 1 ? 0.025 : 0), z])
    }
    return pts
  }
  const shell = (k: number, hex: string) => {
    const pos: number[] = []
    for (let j = 0; j < S.length - 1; j++) {
      const a = ring(S[j], k), b = ring(S[j + 1], k)
      for (let i = 0; i < a.length - 1; i++) pos.push(...a[i], ...b[i], ...b[i + 1], ...a[i], ...b[i + 1], ...a[i + 1])
    }
    // Transom across the stern.
    const t = ring(S[0], k)
    for (let i = 1; i < t.length - 1; i++) pos.push(...t[0], ...t[i + 1], ...t[i])
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    g.computeVertexNormals()
    return paint(g, hex)
  }
  const parts = [shell(1, paintHex), shell(0.92, '#b08a64')]
  // Gunwale rails along the sheer, a stripe below them, and the keel strip.
  for (let j = 0; j < S.length - 1; j++)
    for (const sd of [-1, 1]) {
      const [z0, w0, , t0] = S[j], [z1, w1, , t1] = S[j + 1]
      const ax = sd * w0, bx = sd * w1
      const len = Math.hypot(bx - ax, z1 - z0, t1 - t0)
      const yaw = Math.atan2(bx - ax, z1 - z0)
      const pitch = -Math.atan2(t1 - t0, Math.hypot(bx - ax, z1 - z0))
      parts.push(paint(put(new BoxGeometry(0.035, 0.03, len + 0.02), (ax + bx) / 2, (t0 + t1) / 2 + 0.005, (z0 + z1) / 2, { r: [pitch, yaw, 0] }), '#6d4c41'))
      parts.push(paint(put(new BoxGeometry(0.006, 0.025, len + 0.01), (ax + bx) / 2 + sd * 0.012, (t0 + t1) / 2 - 0.04, (z0 + z1) / 2, { r: [pitch, yaw, 0] }), '#f5f1e6'))
    }
  // Thwarts (stern seat, rower's seat, bow seat), floorboards, oarlocks.
  for (const [z, w] of [[-0.62, 0.52], [0.06, 0.6], [0.48, 0.5]] as const) parts.push(paint(put(new BoxGeometry(w, 0.025, 0.14), 0, 0.1, z), '#8d6e63'))
  for (const x of [-0.12, 0, 0.12]) parts.push(paint(put(new BoxGeometry(0.09, 0.012, 1.0), x, -0.015, -0.05), '#9c7a58'))
  for (const sd of [-1, 1]) {
    parts.push(paint(put(new CylinderGeometry(0.012, 0.012, 0.06, 6), sd * OARLOCK[0], OARLOCK[1] - 0.01, OARLOCK[2]), '#9e9e9e'))
    parts.push(paint(put(new BoxGeometry(0.004, 0.012, 0.16), sd * 0.315, 0.06, 0.62, { r: [0, sd * 0.35, 0] }), '#212121'))
  }
  // Tackle box and a bait bucket on the floor; a lantern on a post at the stern.
  parts.push(paint(put(new BoxGeometry(0.16, 0.08, 0.1), 0.12, 0.03, -0.32), '#2e7d32'))
  parts.push(paint(put(new BoxGeometry(0.165, 0.012, 0.105), 0.12, 0.075, -0.32), '#1b5e20'))
  parts.push(paint(put(new CylinderGeometry(0.06, 0.05, 0.1, 10), -0.14, 0.035, -0.38), '#eceff1'))
  parts.push(paint(put(new CylinderGeometry(0.008, 0.008, 0.38, 6), 0.17, 0.32, -0.72), '#5d4037'))
  parts.push(paint(put(new BoxGeometry(0.07, 0.012, 0.07), 0.17, 0.51, -0.72), '#37474f'))
  parts.push(paint(put(new ConeGeometry(0.05, 0.04, 4), 0.17, 0.605, -0.72, { r: [0, Math.PI / 4, 0] }), '#37474f'))
  return merge(parts)
}

// ---- The fisherman ----------------------------------------------------------------------------

// In model units (drawn PERSON.scale bigger), seated with the hip at HIP, facing +z.
const SEAT = 0.112 / PERSON.scale
const HIP = SEAT + 0.03
const LOOK = { shirt: '#b71c1c', check: '#7f1010', vest: '#ff7043', pants: '#6d5f45', skin: '#e0ac69', hat: '#556b2f', boot: '#3e2723' }

// Legs and hips: fixed to the seat, so they go in with the boat.
function legsGeo() {
  const parts: BufferGeometry[] = []
  for (const sd of [-1, 1]) {
    parts.push(limb([sd * 0.048, HIP, 0], [sd * 0.055, HIP + 0.01, 0.2], 0.034, LOOK.pants))
    parts.push(limb([sd * 0.055, HIP, 0.2], [sd * 0.058, -0.01 / PERSON.scale, 0.24], 0.031, LOOK.pants))
    parts.push(paint(put(new BoxGeometry(0.066, 0.045, 0.11), sd * 0.058, -0.012 / PERSON.scale, 0.26), LOOK.boot))
  }
  parts.push(paint(put(new SphereGeometry(0.088, 10, 6), 0, HIP + 0.01, 0, { s: [1, 0.55, 0.85] }), LOOK.pants))
  return merge(parts)
}

// Torso, life vest, head and hat: one piece that leans as he rows.
function bodyGeo() {
  const parts = [
    paint(put(new CapsuleGeometry(0.085, 0.16, 3, 10), 0, HIP + 0.15, 0), LOOK.shirt),
    ...[0.11, 0.17, 0.23].map((y) => paint(put(new CylinderGeometry(0.0865, 0.0865, 0.012, 12, 1, true), 0, HIP + y, 0), LOOK.check)),
    paint(put(new CylinderGeometry(0.094, 0.09, 0.15, 12), 0, HIP + 0.16, 0), LOOK.vest),
    paint(put(new BoxGeometry(0.012, 0.13, 0.01), 0, HIP + 0.16, 0.093), '#e0e0e0'),
    paint(put(new CylinderGeometry(0.032, 0.036, 0.05, 8, 1, true), 0, HIP + 0.275, 0), LOOK.skin),
    paint(put(new SphereGeometry(0.08, 12, 9), 0, HIP + 0.36, 0), LOOK.skin),
    paint(put(new SphereGeometry(0.014, 6, 4), 0, HIP + 0.354, 0.079), '#d39a5c'),
    ...[-1, 1].map((s) => paint(put(new SphereGeometry(0.019, 6, 4), s * 0.078, HIP + 0.36, -0.004), '#d39a5c')),
    ...[-1, 1].map((s) => paint(put(new SphereGeometry(0.011, 6, 4), s * 0.028, HIP + 0.374, 0.07), '#1a1a1a')),
    // Grey stubble beard, and a bucket hat with a brim.
    paint(put(new SphereGeometry(0.0805, 10, 4, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.62, Math.PI * 0.2), 0, HIP + 0.36, 0), '#a8a29a'),
    paint(put(new CylinderGeometry(0.072, 0.082, 0.07, 12), 0, HIP + 0.425, -0.005), LOOK.hat),
    paint(put(new CylinderGeometry(0.125, 0.125, 0.008, 14), 0, HIP + 0.395, -0.005), LOOK.hat),
    paint(put(new CylinderGeometry(0.0825, 0.0825, 0.012, 12, 1, true), 0, HIP + 0.405, -0.005), '#3e4f22'),
  ]
  return merge(parts)
}

// Both arms reaching forward to grip at the middle (an oar handle each side, or the rod).
const GRIP: [number, number, number] = [0, HIP + 0.12, 0.23]
function armsGeo() {
  const parts: BufferGeometry[] = []
  for (const sd of [-1, 1]) {
    const sh: [number, number, number] = [sd * 0.105, HIP + 0.225, 0]
    const el: [number, number, number] = [sd * 0.13, HIP + 0.12, 0.1]
    const hd: [number, number, number] = [sd * 0.05, GRIP[1], GRIP[2]]
    parts.push(limb(sh, el, 0.03, LOOK.shirt), limb(el, hd, 0.027, LOOK.shirt))
    parts.push(paint(put(new SphereGeometry(0.026, 6, 5), ...hd), LOOK.skin))
  }
  return merge(parts)
}

// The rod from its butt to the tip along +z (world units, pivot at the grip).
const ROD = 1.25
function rodGeo() {
  return merge([
    paint(put(new CylinderGeometry(0.006, 0.013, 0.3, 6), 0, 0, 0.05, { r: [Math.PI / 2, 0, 0] }), '#3e2723'),
    paint(put(new CylinderGeometry(0.0025, 0.006, ROD - 0.2, 5), 0, 0, 0.2 + (ROD - 0.2) / 2, { r: [Math.PI / 2, 0, 0] }), '#263238'),
    paint(put(new CylinderGeometry(0.022, 0.022, 0.03, 10), 0, -0.03, 0.06, { r: [0, 0, Math.PI / 2] }), '#b0bec5'),
    paint(put(new BoxGeometry(0.004, 0.03, 0.004), 0, -0.016, 0.06), '#b0bec5'),
  ])
}

// One oar, from its handle through the oarlock (at the origin) to the blade along +x.
function oarGeo() {
  return merge([
    paint(put(new CylinderGeometry(0.014, 0.014, 0.12, 6), -0.28, 0, 0, { r: [0, 0, Math.PI / 2] }), '#5d4037'),
    paint(put(new CylinderGeometry(0.016, 0.018, 1.0, 6), 0.27, 0, 0, { r: [0, 0, Math.PI / 2] }), '#c8a87e'),
    paint(put(new BoxGeometry(0.28, 0.012, 0.1), 0.86, 0, 0), '#c8a87e'),
    paint(put(new BoxGeometry(0.06, 0.013, 0.101), 0.98, 0, 0), '#2e7d6b'),
  ])
}

function bobberGeo() {
  return merge([
    paint(put(new SphereGeometry(0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0), '#e53935'),
    paint(put(new SphereGeometry(0.03, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0, 0, 0), '#fafafa'),
    paint(put(new CylinderGeometry(0.004, 0.004, 0.04, 4), 0, 0.045, 0), '#fafafa'),
  ])
}

// A rainbow trout, nose along +z.
function fishGeo() {
  return merge([
    paint(put(new SphereGeometry(0.05, 10, 7), 0, 0, 0, { s: [0.38, 0.62, 2.1] }), '#9aa77e'),
    paint(put(new SphereGeometry(0.05, 10, 4, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.12), 0, 0, 0, { s: [0.39, 0.63, 2.05] }), '#e57373'),
    paint(put(new ConeGeometry(0.035, 0.06, 4), 0, 0, -0.12, { s: [0.2, 1, 1], r: [-Math.PI / 2, 0, 0] }), '#7d8a63'),
    ...[-1, 1].map((s) => paint(put(new SphereGeometry(0.006, 5, 4), s * 0.016, 0.01, 0.07), '#111111')),
  ])
}

// ---- Gulls -------------------------------------------------------------------------------------

function gullBodyGeo() {
  return merge([
    paint(put(new SphereGeometry(0.05, 12, 8), 0, 0.05, 0, { s: [1.05, 0.95, 2.4] }), '#fafafa'),
    paint(put(new SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.4), 0, 0.055, -0.015, { s: [1.0, 0.9, 2.2] }), '#9aa6b0'),
    paint(put(new SphereGeometry(0.034, 10, 8), 0, 0.095, 0.105), '#ffffff'),
    paint(put(new BoxGeometry(0.012, 0.012, 0.05), 0, 0.09, 0.15, { r: [0.15, 0, 0] }), '#f2c230'),
    paint(put(new BoxGeometry(0.0125, 0.006, 0.008), 0, 0.083, 0.165), '#e53935'),
    ...[-1, 1].map((s) => paint(put(new SphereGeometry(0.0055, 5, 4), s * 0.026, 0.103, 0.124), '#111111')),
    paint(put(new BoxGeometry(0.07, 0.01, 0.07), 0, 0.06, -0.13, { r: [0.15, 0, 0] }), '#fafafa'),
    ...[-1, 1].map((s) => paint(put(new CylinderGeometry(0.005, 0.005, 0.05, 4), s * 0.02, -0.005, 0.0), '#f48fb1')),
  ])
}
// One wing from the shoulder out along +x, swept back and tapering, black at the tip.
function gullWingGeo() {
  const g = new BoxGeometry(0.34, 0.008, 0.1, 6, 1, 1)
  g.translate(0.17, 0, 0)
  const p = g.getAttribute('position')
  const cols = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), k = x / 0.34
    p.setZ(i, p.getZ(i) * (1 - 0.65 * k) - 0.07 * k * k)
    p.setY(i, p.getY(i) + Math.sin(k * Math.PI) * 0.012)
    col.set(k > 0.78 ? '#1f1f1f' : k > 0.7 ? '#e0e0e0' : '#a9b4bd')
    cols.set([col.r, col.g, col.b], i * 3)
  }
  g.setAttribute('color', new BufferAttribute(cols, 3))
  g.deleteAttribute('uv')
  g.computeVertexNormals()
  return g
}

type Gull = {
  mode: 'fly' | 'land' | 'sit' | 'takeoff'
  r: number; alt: number; w: number; th: number
  from: Vector3; ctrl: Vector3; to: Vector3; t0: number; dur: number
  until: number; perch: number; heading: number; pos: Vector3; prev: Vector3; flapPh: number
}
const GULLS = 7
// The mallard family out on the lake.
const LAKE_DUCKS: DuckKind[] = ['drake', 'hen', 'chick', 'chick', 'chick', 'chick']

// ---- The lake ----------------------------------------------------------------------------------

type Fisher = {
  mode: 'row' | 'cast' | 'wait' | 'bite' | 'reel' | 'catch'
  x: number; z: number; h: number; v: number; turn: number
  tx: number; tz: number
  t0: number; casts: number; until: number
  stroke: number; lean: number
  bob: Vector3; aimed: boolean; landed: boolean; hooked: boolean
  y: number; vy: number; pitch: number; vp: number; roll: number; vr: number
}

export function LakeLife({ lake, frozen }: { lake: LakeShape; frozen: boolean }) {
  const root = useRef<Group>(null)
  const boat = useRef<Group>(null)
  const lean = useRef<Group>(null)
  const rod = useRef<Group>(null)
  const oars = useRef<InstancedMesh>(null)
  const bobber = useRef<Mesh>(null)
  const fish = useRef<Mesh>(null)
  const body = useRef<InstancedMesh>(null)
  const wingL = useRef<InstancedMesh>(null)
  const wingR = useRef<InstancedMesh>(null)

  const g = useMemo(() => ({
    // His legs never move on the seat, so they're part of the boat; his arms lean with him.
    hull: merge([hullGeo('#2e7d6b'), legsGeo().scale(PERSON.scale, PERSON.scale, PERSON.scale).rotateY(Math.PI).translate(0, 0, 0.06)]),
    body: merge([bodyGeo(), armsGeo()]), rod: rodGeo(), oar: oarGeo(), bobber: bobberGeo(), fish: fishGeo(),
    gull: gullBodyGeo(), wing: gullWingGeo(),
    mat: new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
    hullMat: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: DoubleSide }),
    wingMat: new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: DoubleSide }),
  }), [])
  const line = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(12 * 3), 3))
    const l = new Line(geo, new LineBasicMaterial({ color: '#eceff1', transparent: true, opacity: 0.85 }))
    l.frustumCulled = false
    l.raycast = () => null
    return l
  }, [])
  useLayoutEffect(() => () => {
    for (const v of Object.values(g)) v.dispose()
    line.geometry.dispose()
    ;(line.material as LineBasicMaterial).dispose()
  }, [g, line])

  // Points inside the lake (e < k of the way to the shore), clear of the dock.
  const pick = useMemo(() => (k: number, away?: { x: number; z: number; d: number }) => {
    for (let n = 0; n < 40; n++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * k
      const x = lake.x + Math.cos(a) * lake.rx * r, z = lake.z + Math.sin(a) * lake.rz * r
      if (Math.hypot(x - lake.dock[0], z - lake.dock[1]) < 4.5) continue
      if (away && Math.hypot(x - away.x, z - away.z) < away.d) continue
      return [x, z] as const
    }
    return [lake.x, lake.z] as const
  }, [lake])

  const fisher = useMemo<Fisher>(() => {
    const [tx, tz] = pick(0.55)
    return {
      mode: 'row', x: lake.x + lake.rx * 0.35, z: lake.z + 2, h: -1.4, v: 0, turn: 0, tx, tz, t0: 0, casts: 0, until: 0, stroke: 0, lean: 0,
      bob: new Vector3(), aimed: false, landed: false, hooked: false, y: 0, vy: 0, pitch: 0, vp: 0, roll: 0, vr: 0,
    }
  }, [lake, pick])

  // Screenshot scripts find the boat here (dev builds only).
  if (import.meta.env.DEV) (window as unknown as { __fisher?: Fisher }).__fisher = fisher

  // Dock posts and the end of the deck, where gulls like to stand.
  const perches = useMemo(() => {
    const [dx, dz] = lake.dock
    return [[dx - 2, 0.335, dz - 0.5], [dx - 2, 0.335, dz + 0.5], [dx - 0.6, 0.335, dz + 0.5], [dx - 1.5, 0.24, dz + 0.1]].map(([x, y, z]) => new Vector3(x, y, z))
  }, [lake])
  const gulls = useMemo<Gull[]>(() => Array.from({ length: GULLS }, (_, i) => {
    const r = 6 + (i % 4) * 2.2
    return {
      mode: 'fly', r, alt: 4.5 + (i % 3) * 1.4, w: (2.6 / r) * (i % 2 ? 1 : 1.1), th: i * 0.9, from: new Vector3(), ctrl: new Vector3(), to: new Vector3(), t0: 0, dur: 1,
      until: 3 + i * 3.1, perch: -1, heading: 0, pos: new Vector3(lake.x, 5, lake.z), prev: new Vector3(lake.x, 5, lake.z), flapPh: i,
    }
  }), [lake])

  const o = useMemo(() => new Object3D(), [])
  const w = useMemo(() => new Object3D(), [])
  const v = useMemo(() => new Vector3(), [])
  const tip = useMemo(() => new Vector3(), [])
  const wm = useMemo(() => new Matrix4(), [])

  const circleAt = (gl: Gull, th: number, out: Vector3) => out.set(lake.x + Math.cos(th) * gl.r * 1.3, gl.alt, lake.z + Math.sin(th) * gl.r)
  const bez = (a: Vector3, b: Vector3, c: Vector3, u: number, out: Vector3) => out.set(
    (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * b.x + u * u * c.x,
    (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * b.y + u * u * c.y,
    (1 - u) * (1 - u) * a.z + 2 * (1 - u) * u * b.z + u * u * c.z,
  )

  useFrame(({ clock }, delta) => {
    if (!shown(root.current)) return
    const t = clock.elapsedTime
    const dt = Math.min(delta, 0.1)
    const now = performance.now() / 1000
    const night = nightAmount(dayPhase())
    const weather = weatherNow()
    const water = (x: number, z: number) => lake.y + (frozen ? 0 : heightAt(x, z, now))

    // ---- Fisherman ----
    const f = fisher
    const B = boat.current
    if (B && !frozen) {
      let drive = 0
      // Cast again, or after a few here row off to another spot.
      const recast = () => {
        f.casts++
        f.t0 = t
        f.aimed = false
        f.landed = false
        if (f.casts < 3) f.mode = 'cast'
        else {
          const [tx, tz] = pick(0.6, { x: f.x, z: f.z, d: 6 })
          f.tx = tx
          f.tz = tz
          f.mode = 'row'
        }
      }
      if (f.mode === 'row') {
        const dx = f.tx - f.x, dz = f.tz - f.z, dist = Math.hypot(dx, dz)
        const want = Math.atan2(dx, dz)
        const err = ((want - f.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI
        f.turn = Math.max(-0.5, Math.min(0.5, err * 0.8))
        // Strokes: a drive that pulls the boat on, then the recovery.
        const prev = f.stroke
        f.stroke = (f.stroke + dt / 1.7) % 1
        const ph = f.stroke
        drive = ph < 0.45 ? Math.sin((ph / 0.45) * Math.PI) : 0
        if (prev < 0.03 && ph >= 0.03) {
          // Blades bite the water.
          for (const sd of [-1, 1]) {
            v.set(sd * 1.25, 0, OARLOCK[2] + 0.2)
            B.localToWorld(v)
            splash(v.x, v.z, 0.35)
          }
        }
        if (dist < 0.6 || (dist < 2 && Math.abs(err) > 1.2)) {
          f.mode = 'cast'
          f.t0 = t
          f.casts = 0
          f.aimed = false
          f.landed = false
        }
        f.v += (drive * 0.55 * Math.min(1, dist / 1.5) - f.v * 0.6) * dt
      } else {
        f.v -= f.v * 0.9 * dt
        f.turn *= 1 - dt
        // Wind drifts him slowly round.
        f.turn += (Math.sin(t * 0.13) * 0.04 * (0.3 + weather.wind) - f.turn) * dt * 0.5
      }
      f.h += f.turn * dt * (0.4 + f.v * 2)
      f.x += Math.sin(f.h) * f.v * dt
      f.z += Math.cos(f.h) * f.v * dt
      // Keep off the shore.
      const e = Math.hypot((f.x - lake.x) / lake.rx, (f.z - lake.z) / lake.rz)
      if (e > 0.8) {
        f.x = lake.x + (f.x - lake.x) * (0.8 / e)
        f.z = lake.z + (f.z - lake.z) * (0.8 / e)
      }
      // Float: spring the hull towards where the water holds it, so it rocks on passing ripples.
      const fl = floatOn(f.x, f.z, f.h, BOAT_LEN, BOAT_BEAM, now)
      const k = 40, damp = 7
      f.vy += ((fl.x - 0.02) - f.y) * k * dt - f.vy * damp * dt
      f.vp += (fl.y - drive * 0.035 - f.pitch) * k * 0.6 * dt - f.vp * damp * dt
      f.vr += (fl.z + f.turn * 0.04 - f.roll) * k * 0.6 * dt - f.vr * damp * dt
      f.y += f.vy * dt
      f.pitch += f.vp * dt
      f.roll += f.vr * dt
      B.position.set(f.x, lake.y + f.y, f.z)
      B.rotation.set(f.pitch, f.h, f.roll, 'YXZ')
      B.updateMatrixWorld()
      if (f.v > 0.03) wake('boat', f.x, f.z, f.h, Math.min(1, f.v / 0.35))
      floaters.set('boat', { x: f.x, z: f.z, r: 1.4 })

      // Oars: sweeping through the stroke, or shipped along the gunwales while he fishes.
      const O = oars.current
      if (O) {
        const rowing = f.mode === 'row'
        const ph = f.stroke
        const sweep = rowing ? (ph < 0.45 ? -0.55 + (ph / 0.45) * 1.1 : 0.55 - ((ph - 0.45) / 0.55) * 1.1) : 1.35
        const dip = rowing ? (ph < 0.45 ? -0.2 : 0.08) : 0.04
        for (const [i, sd] of [[0, 1], [1, -1]] as const) {
          w.position.set(sd * OARLOCK[0], OARLOCK[1], OARLOCK[2])
          w.rotation.set(0, sd * -sweep, sd * dip, 'YXZ')
          w.scale.set(sd, 1, 1)
          w.updateMatrix()
          O.setMatrixAt(i, w.matrix)
        }
        O.instanceMatrix.needsUpdate = true
      }
      // He leans back on the drive and forward to reach for the next stroke.
      const L = lean.current, R = rod.current, bob = bobber.current, F = fish.current
      if (L && R && bob && F) {
        const ph = f.stroke
        const want = f.mode === 'row' ? (ph < 0.45 ? -0.3 + (ph / 0.45) * 0.6 : 0.3 - ((ph - 0.45) / 0.55) * 0.6) : f.mode === 'reel' ? 0.12 : 0
        f.lean += (want - f.lean) * Math.min(1, dt * 8)
        L.rotation.x = -f.lean
        R.visible = f.mode !== 'row'
        // Rod angle: up off the water (positive tips it skywards).
        let rodUp = 0.55
        const since = t - f.t0
        if (f.mode === 'cast') {
          // Back over the shoulder, then whip forward; the bobber flies out and lands.
          if (since < 0.7) rodUp = 0.55 + (since / 0.7) * 0.9
          else if (since < 1.0) rodUp = 1.45 - ((since - 0.7) / 0.3) * 1.25
          else rodUp = 0.2 + Math.min(1, (since - 1) / 1.5) * 0.4
          if (!f.aimed) {
            // A few metres out in front of him (he faces the stern), kept on the water.
            f.aimed = true
            const reach = 2.6 + Math.random() * 1.6
            const side = (Math.random() - 0.5) * 1.4
            f.bob.set(f.x - Math.sin(f.h) * reach + Math.cos(f.h) * side, 0, f.z - Math.cos(f.h) * reach - Math.sin(f.h) * side)
            const e = Math.hypot((f.bob.x - lake.x) / lake.rx, (f.bob.z - lake.z) / lake.rz)
            if (e > 0.9) f.bob.set(lake.x + (f.bob.x - lake.x) * (0.9 / e), 0, lake.z + (f.bob.z - lake.z) * (0.9 / e))
          }
          if (since > 1.8) {
            f.landed = true
            splash(f.bob.x, f.bob.z, 0.6)
            f.mode = 'wait'
            f.until = t + 6 + Math.random() * 10
          }
        } else if (f.mode === 'wait') {
          rodUp = 0.6 + Math.sin(t * 0.7) * 0.03
          if (Math.random() < dt * 0.25) splash(f.bob.x, f.bob.z, 0.12) // a nibble
          if (t > f.until) {
            f.mode = 'bite'
            f.t0 = t
            f.hooked = Math.random() < 0.6
            splash(f.bob.x, f.bob.z, 0.8)
          }
        } else if (f.mode === 'bite') {
          rodUp = 0.95 + Math.sin(since * 30) * 0.04
          if (since > 0.6) {
            f.mode = 'reel'
            f.t0 = t
          }
        } else if (f.mode === 'reel') {
          rodUp = 0.85 + (f.hooked ? Math.sin(t * 9) * 0.06 : 0)
          // The line comes in, the bobber skating towards the boat.
          v.set(f.x - Math.sin(f.h) * 0.9, 0, f.z - Math.cos(f.h) * 0.9)
          f.bob.lerp(v, Math.min(1, dt * 0.9))
          if (f.hooked && Math.random() < dt * 3) splash(f.bob.x + (Math.random() - 0.5) * 0.2, f.bob.z + (Math.random() - 0.5) * 0.2, 0.5)
          if (f.bob.distanceTo(v) < 0.3 || since > 4) {
            if (f.hooked) {
              f.mode = 'catch'
              f.t0 = t
              splash(f.bob.x, f.bob.z, 0.9)
            } else recast()
          }
        } else if (f.mode === 'catch') {
          rodUp = 1.2
          if (since > 2.4) recast()
        }
        R.rotation.x = -rodUp
        R.updateMatrixWorld()
        tip.set(0, 0, ROD)
        R.localToWorld(tip)
        // Bobber: flying out on the cast, riding the water, under on the bite, then out on the line.
        let showBob = f.mode !== 'row'
        if (f.mode === 'cast') {
          const u = Math.min(1, Math.max(0, (since - 1.0) / 0.8))
          showBob = since >= 1.0
          bob.position.set(tip.x + (f.bob.x - tip.x) * u, tip.y + (water(f.bob.x, f.bob.z) - tip.y) * u + Math.sin(u * Math.PI) * 1.1, tip.z + (f.bob.z - tip.z) * u)
        } else if (f.mode === 'catch') {
          // The trout swings up out of the water on the line and into the boat.
          bob.position.set(tip.x, tip.y - 0.35, tip.z)
          showBob = since < 1.4
        } else {
          const under = f.mode === 'bite' ? 0.04 : 0
          bob.position.set(f.bob.x, water(f.bob.x, f.bob.z) + 0.01 - under + Math.sin(t * 2.2) * 0.004, f.bob.z)
        }
        bob.visible = showBob
        F.visible = f.mode === 'catch' && since < 1.6
        if (F.visible) {
          F.position.copy(bob.position).add(v.set(0, -0.08, 0))
          F.rotation.set(Math.PI / 2 + Math.sin(t * 18) * 0.5, t * 2, 0)
        }
        // The line: from the rod tip, sagging to the bobber.
        const pos = line.geometry.getAttribute('position') as BufferAttribute
        const tight = f.mode === 'bite' || f.mode === 'reel' || f.mode === 'catch'
        for (let i = 0; i < 12; i++) {
          const u = i / 11
          pos.setXYZ(i, tip.x + (bob.position.x - tip.x) * u, tip.y + (bob.position.y - tip.y) * u - Math.sin(u * Math.PI) * (tight ? 0.02 : 0.18) * (f.mode === 'cast' ? 0.2 : 1), tip.z + (bob.position.z - tip.z) * u)
        }
        pos.needsUpdate = true
        line.visible = showBob || F.visible
      }
    }

    // ---- Gulls ----
    const Bd = body.current, WL = wingL.current, WR = wingR.current
    if (Bd && WL && WR) {
      const grounded = night > 0.5 || weather.rain > 0.6
      const taken = new Set(gulls.map((gl) => gl.perch))
      gulls.forEach((gl, i) => {
        gl.th += gl.w * dt
        gl.prev.copy(gl.pos)
        let flap = 0
        let fold = 1
        if (gl.mode === 'fly') {
          circleAt(gl, gl.th, gl.pos)
          gl.pos.y += Math.sin(t * 0.6 + i) * 0.6
          if (t > gl.until || grounded) {
            // Come down: onto the water, or a free spot on the dock.
            gl.mode = 'land'
            gl.t0 = t
            gl.dur = 3.2 + Math.random()
            gl.from.copy(gl.pos)
            const free = perches.findIndex((_, k) => !taken.has(k))
            if (free >= 0 && Math.random() < 0.45) {
              gl.perch = free
              taken.add(free)
              gl.to.copy(perches[free])
            } else {
              gl.perch = -1
              const [x, z] = pick(0.75)
              gl.to.set(x, lake.y, z)
            }
            gl.ctrl.copy(gl.from).lerp(gl.to, 0.6)
            gl.ctrl.y = gl.from.y * 0.55 + 0.6
          }
          flap = Math.sin(t * 9 + gl.flapPh) * 0.65 * (Math.sin(t * 0.5 + i * 1.3) > 0.1 ? 1 : 0.12)
        } else if (gl.mode === 'land') {
          const u = Math.min(1, (t - gl.t0) / gl.dur)
          const eu = 1 - (1 - u) * (1 - u)
          if (gl.perch < 0) gl.to.y = water(gl.to.x, gl.to.z)
          bez(gl.from, gl.ctrl, gl.to, eu, gl.pos)
          // Glide in, then back-pedal hard just before touching down.
          flap = u > 0.8 ? Math.sin(t * 16) * 0.8 : 0.1
          if (u >= 1) {
            gl.mode = 'sit'
            gl.until = t + 8 + Math.random() * 14
            if (gl.perch < 0 && !frozen) splash(gl.pos.x, gl.pos.z, 1)
          }
        } else if (gl.mode === 'sit') {
          fold = 0.6
          if (gl.perch < 0) {
            gl.pos.y = water(gl.pos.x, gl.pos.z) - 0.015
            // Paddling about a little.
            gl.heading += Math.sin(t * 0.3 + i) * dt * 0.3
            if (!frozen) {
              gl.pos.x += Math.sin(gl.heading) * 0.04 * dt
              gl.pos.z += Math.cos(gl.heading) * 0.04 * dt
            }
          }
          if (t > gl.until && !grounded) {
            gl.mode = 'takeoff'
            gl.t0 = t
            gl.dur = 3.5
            gl.from.copy(gl.pos)
            gl.ctrl.set(gl.pos.x + Math.sin(gl.heading) * 2.5, gl.pos.y + 0.4, gl.pos.z + Math.cos(gl.heading) * 2.5)
            circleAt(gl, gl.th + gl.w * gl.dur, gl.to)
            gl.perch = -1
          }
        } else {
          const u = Math.min(1, (t - gl.t0) / gl.dur)
          bez(gl.from, gl.ctrl, gl.to, u * u, gl.pos)
          flap = Math.sin(t * 14 + gl.flapPh) * 0.85
          // Running across the water on the way up.
          if (u < 0.25 && !frozen && Math.random() < dt * 6) splash(gl.pos.x, gl.pos.z, 0.4)
          if (u >= 1) {
            gl.mode = 'fly'
            gl.until = t + 12 + Math.random() * 18
          }
        }
        const dx = gl.pos.x - gl.prev.x, dz = gl.pos.z - gl.prev.z
        if (gl.mode !== 'sit' && dx * dx + dz * dz > 1e-8) gl.heading = Math.atan2(dx, dz)
        const climb = gl.mode === 'sit' ? 0 : Math.atan2(-(gl.pos.y - gl.prev.y), Math.max(1e-4, Math.hypot(dx, dz)))
        const bank = gl.mode === 'fly' ? -0.35 * Math.sign(gl.w) : 0
        o.position.copy(gl.pos)
        o.rotation.set(Math.max(-0.6, Math.min(0.6, climb)), gl.heading, bank, 'YXZ')
        o.scale.setScalar(1)
        o.updateMatrix()
        Bd.setMatrixAt(i, o.matrix)
        for (const [M, sd] of [[WR, 1], [WL, -1]] as const) {
          w.position.set(sd * 0.04, 0.075, 0.01)
          w.rotation.set(0, sd * (fold < 1 ? 1.35 : 0), sd * (fold < 1 ? 0.12 : flap), 'YZX')
          w.scale.set(sd * fold, 1, 1)
          w.updateMatrix()
          M.setMatrixAt(i, wm.multiplyMatrices(o.matrix, w.matrix))
        }
      })
      for (const M of [Bd, WL, WR]) M.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={root} userData={{ noBatch: true }}>
      {!frozen && (
        <>
          <group ref={boat}>
            <mesh geometry={g.hull} material={g.hullMat} castShadow raycast={() => null} />
            <mesh position={[0.17, 0.555, -0.72]} material={glowMats.bulb} raycast={() => null}>
              <sphereGeometry args={[0.028, 8, 6]} />
            </mesh>
            {/* Seated on the middle thwart facing the stern, as a rower sits. */}
            <group position={[0, 0, 0.06]} rotation-y={Math.PI}>
              <group scale={PERSON.scale}>
                <group ref={lean} position-y={HIP}>
                  <group position-y={-HIP}>
                    <mesh geometry={g.body} material={g.mat} castShadow raycast={() => null} />
                    <group position={GRIP}>
                      <group scale={1 / PERSON.scale}>
                        <group ref={rod}>
                          <mesh geometry={g.rod} material={g.mat} raycast={() => null} />
                        </group>
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            </group>
            <instancedMesh ref={oars} args={[g.oar, g.mat, 2]} frustumCulled={false} castShadow raycast={() => null} />
          </group>
          <mesh ref={bobber} geometry={g.bobber} material={g.mat} raycast={() => null} />
          <mesh ref={fish} geometry={g.fish} material={g.mat} visible={false} raycast={() => null} />
          <primitive object={line} />
          <group position={[lake.x, lake.y, lake.z]}>
            <DuckFamily kinds={LAKE_DUCKS} rx={lake.rx} rz={lake.rz} y={0} seed={4} cx={-lake.rx * 0.35} cz={lake.rz * 0.2} spread={0.45} />
          </group>
        </>
      )}
      <instancedMesh ref={body} args={[g.gull, g.mat, GULLS]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={wingL} args={[g.wing, g.wingMat, GULLS]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={wingR} args={[g.wing, g.wingMat, GULLS]} frustumCulled={false} raycast={() => null} />
    </group>
  )
}
