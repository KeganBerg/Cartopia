import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Color, Matrix4, Quaternion, Vector3, Euler } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Tank tracks for tracked bodies (the Tomahawk): a loop of steel links that runs round a
// toothed drive sprocket at the back and an idler at the front, over a row of double road
// wheels along the bottom and two return rollers on top. The links are one instanced mesh
// that slides along the loop as the car rolls, so the treads really move.
//
// Each link is built along its own frame: x across the track, y out from the loop, z along
// it. Its parts carry vertex colours by role so a track skin is just a palette.

export type LinkRole = 'plate' | 'grouser' | 'horn' | 'pin' | 'pad' | 'stud'
// Track pads by tires mod: steel grousers, rubber pads (rain), tall sand paddles, snow studs.
export type Pads = 'steel' | 'rubber' | 'paddle' | 'studs' | 'allweather'
export const padsFor = (tires?: string): Pads =>
  tires === 'raintires' ? 'rubber' : tires === 'sandtires' ? 'paddle' : tires === 'snowstuds' ? 'studs' : tires === 'allweather' ? 'allweather' : 'steel'

export const TRACK_W = 0.15 // track width
export const PITCH = 0.05 // about how far apart the links are
export const PLATE = 0.014 // plate thickness

// How far a link's tread reaches out past its centre line, for each kind of pad.
const reach = (p: Pads) => PLATE / 2 + (p === 'paddle' ? 0.02 : p === 'rubber' || p === 'allweather' ? 0.012 : 0.009)

type V3 = [number, number, number]
function put(list: [BufferGeometry, LinkRole][], role: LinkRole, geo: BufferGeometry, p: V3, r: V3 = [0, 0, 0]) {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.applyMatrix4(new Matrix4().compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(...r)), new Vector3(1, 1, 1)))
  for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n)
  list.push([g, role])
}

const linkCache = new Map<string, { geo: BufferGeometry; roles: LinkRole[]; ranges: Partial<Record<LinkRole, [number, number]>> }>()

// One link's geometry for these pads. `ranges` says which vertices belong to each role.
export function linkGeo(pads: Pads) {
  const hit = linkCache.get(pads)
  if (hit) return hit
  const L: [BufferGeometry, LinkRole][] = []
  const d = PITCH * 0.9
  const w = TRACK_W
  const top = PLATE / 2
  // The plate, with a slight bevel, and the hinge knuckles at each end with their pins.
  put(L, 'plate', new RoundedBoxGeometry(w, PLATE, d, 1, 0.003), [0, 0, 0])
  for (const sd of [-1, 1]) put(L, 'pin', new CylinderGeometry(0.0055, 0.0055, w + 0.012, 6), [0, -0.001, sd * d * 0.5], [0, 0, Math.PI / 2])
  // End connectors on the pins, both sides.
  for (const sx of [-1, 1]) put(L, 'pin', new BoxGeometry(0.008, 0.014, d * 0.55), [sx * (w / 2 + 0.006), -0.001, 0])
  // Guide horn on the inside, between the road wheel pairs.
  put(L, 'horn', new RoundedBoxGeometry(0.018, 0.024, d * 0.6, 1, 0.004), [0, -top - 0.011, 0])
  // The tread outside.
  if (pads === 'rubber' || pads === 'allweather') {
    for (const sx of [-1, 1]) put(L, 'pad', new RoundedBoxGeometry(w * 0.4, 0.012, d * 0.82, 1, 0.003), [sx * w * 0.24, top + 0.005, 0])
    if (pads === 'allweather') for (const sx of [-1, 1]) put(L, 'stud', new CylinderGeometry(0.004, 0.005, 0.006, 6), [sx * w * 0.24, top + 0.013, 0])
  } else {
    const gh = pads === 'paddle' ? 0.02 : 0.009
    put(L, 'grouser', new BoxGeometry(w * 0.96, gh, pads === 'paddle' ? 0.007 : 0.011), [0, top + gh / 2, -d * 0.12], [pads === 'paddle' ? 0.25 : 0, 0, 0])
    if (pads === 'studs') for (const sx of [-0.33, 0, 0.33]) put(L, 'stud', new CylinderGeometry(0.0035, 0.0045, 0.006, 6), [sx * w, top + gh + 0.002, -d * 0.12])
  }
  const roles: LinkRole[] = []
  const ranges: Partial<Record<LinkRole, [number, number]>> = {}
  // Keep each role's vertices together so the glow mesh can draw just one role.
  const order: LinkRole[] = ['plate', 'pin', 'horn', 'pad', 'grouser', 'stud']
  const sorted = order.flatMap((role) => L.filter(([, r]) => r === role))
  let at = 0
  for (const [g, role] of sorted) {
    const n = g.attributes.position.count
    const r = ranges[role]
    ranges[role] = r ? [r[0], r[1] + n] : [at, n]
    if (!roles.includes(role)) roles.push(role)
    at += n
  }
  const geo = mergeGeometries(sorted.map(([g]) => g))!
  sorted.forEach(([g]) => g.dispose())
  const out = { geo, roles, ranges }
  linkCache.set(pads, out)
  return out
}

// A link coloured with a palette: one copy per palette, shared by every car wearing it.
const paintCache = new Map<string, BufferGeometry>()
export function paintedLink(pads: Pads, colors: Record<LinkRole, string>) {
  const key = pads + JSON.stringify(colors)
  const hit = paintCache.get(key)
  if (hit) return hit
  const { geo, ranges } = linkGeo(pads)
  const g = geo.clone()
  const n = g.attributes.position.count
  const c = new Float32Array(n * 3)
  const col = new Color()
  for (const [role, [start, count]] of Object.entries(ranges) as [LinkRole, [number, number]][]) {
    col.set(colors[role])
    for (let i = start; i < start + count; i++) c.set([col.r, col.g, col.b], i * 3)
  }
  g.setAttribute('color', new Float32BufferAttribute(c, 3))
  paintCache.set(key, g)
  return g
}

// Just the glowing role of a link (a skin's lit grousers or pins), for the glow mesh.
const glowCache = new Map<string, BufferGeometry>()
export function glowLink(pads: Pads, role: LinkRole) {
  const key = `${pads}|${role}`
  const hit = glowCache.get(key)
  if (hit) return hit
  const { geo, ranges } = linkGeo(pads)
  const r = ranges[role]
  if (!r) return null
  const g = new BufferGeometry()
  for (const name of ['position', 'normal'] as const) {
    const a = geo.attributes[name]
    g.setAttribute(name, new Float32BufferAttribute((a.array as Float32Array).slice(r[0] * 3, (r[0] + r[1]) * 3), 3))
  }
  glowCache.set(key, g)
  return g
}

// The loop the links ride on, in the y-z plane: round two ends of radius rc centred at
// z = ±wz, height cy, joined by straight runs. Distance u starts at the front of the
// bottom run and runs back along it (the way the bottom moves as the car drives forward),
// up round the sprocket, forward along the top and down round the idler.
export type Loop = { wz: number; cy: number; rc: number; len: number }
export function trackLoop(wheel: number, wz: number, pads: Pads): Loop {
  // The tread's tips just touch the ground under the bottom run.
  const rc = wheel - reach(pads)
  return { wz, cy: wheel, rc, len: 4 * wz + 2 * Math.PI * rc }
}

// Where distance u lands on the loop: [y, z] and the angle the link turns about x.
export function onLoop(l: Loop, u: number): [number, number, number] {
  const run = 2 * l.wz
  const arc = Math.PI * l.rc
  u = ((u % l.len) + l.len) % l.len
  if (u < run) return [l.cy - l.rc, l.wz - u, Math.PI]
  u -= run
  if (u < arc) {
    const t = u / l.rc
    return [l.cy - l.rc * Math.cos(t), -l.wz - l.rc * Math.sin(t), Math.PI + t]
  }
  u -= arc
  if (u < run) return [l.cy + l.rc, -l.wz + u, 0]
  u -= run
  const t = u / l.rc
  return [l.cy + l.rc * Math.cos(t), l.wz + l.rc * Math.sin(t), t]
}

// How many links go round a loop: a whole number, spaced as near PITCH as fits.
export const linkCount = (l: Loop) => Math.round(l.len / PITCH)

// Places every link of both tracks (x = ±tx) for a belt moved on by `dist`.
const q = new Quaternion()
const ax = new Vector3(1, 0, 0)
const pos = new Vector3()
const one = new Vector3(1, 1, 1)
export function placeLinks(l: Loop, tx: number, dist: number, set: (i: number, m: Matrix4) => void) {
  const n = linkCount(l)
  const gap = l.len / n
  const m = new Matrix4()
  for (let i = 0; i < n; i++) {
    const [y, z, a] = onLoop(l, i * gap + dist)
    q.setFromAxisAngle(ax, a)
    for (const [j, sd] of [[0, -1], [1, 1]] as const) {
      m.compose(pos.set(sd * tx, y, z), q, one)
      set(i * 2 + j, m)
    }
  }
}

// The drive sprocket: a toothed steel ring on a dished hub, axle along x, `teeth` round it.
const sprocketCache = new Map<string, BufferGeometry>()
export function sprocketGeo(r: number, teeth: number) {
  const key = `${r}|${teeth}`
  const hit = sprocketCache.get(key)
  if (hit) return hit
  const L: [BufferGeometry, LinkRole][] = []
  const w = 0.03
  for (const sx of [-1, 1]) {
    // Two toothed rings with the guide horns running between them.
    put(L, 'plate', new CylinderGeometry(r * 0.86, r * 0.86, w, 24), [sx * 0.04, 0, 0], [0, 0, Math.PI / 2])
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2
      put(L, 'plate', new BoxGeometry(w * 0.8, r * 0.16, r * 0.12), [sx * 0.04, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9], [a, 0, 0])
    }
    // Lightening holes on the outer face read as dark recesses.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      put(L, 'horn', new CylinderGeometry(r * 0.15, r * 0.15, 0.004, 10), [sx * (0.04 + w / 2 + 0.001), Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5], [0, 0, Math.PI / 2])
    }
  }
  put(L, 'pin', new CylinderGeometry(r * 0.28, r * 0.32, 0.11, 12), [0, 0, 0], [0, 0, Math.PI / 2])
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    for (const sx of [-1, 1]) put(L, 'stud', new CylinderGeometry(0.008, 0.008, 0.012, 6), [sx * 0.059, Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2], [0, 0, Math.PI / 2])
  }
  const g = mergeGeometries(L.map(([x]) => x))!
  L.forEach(([x]) => x.dispose())
  sprocketCache.set(key, g)
  return g
}

// Road wheels, idler and return rollers: [z, y, radius] of each, one side's worth (both sides match).
export function rollers(l: Loop) {
  const rw = 0.07
  const y = l.cy - l.rc + PLATE / 2 + rw
  const out: [number, number, number][] = []
  // Road wheels along the bottom, clear of the idler and sprocket.
  const reachZ = Math.min(l.wz - 0.22, l.wz * 0.6)
  for (let i = 0; i < 4; i++) out.push([-reachZ + (i * 2 * reachZ) / 3, y, rw])
  // Front idler (same style as the road wheels, but big enough to turn the track round).
  out.push([l.wz, l.cy, l.rc - PLATE / 2 - 0.002])
  // Return rollers under the top run.
  const ry = 0.028
  for (const z of [-l.wz * 0.35, l.wz * 0.35]) out.push([z, l.cy + l.rc - PLATE / 2 - ry, ry])
  return out
}

// Running gear: what a real tank has inside its tracks in place of car wheels. Every piece
// carries its colours on its vertices (rubber tyre band, armour steel, the hub caps in the
// track skin's accent), so the road wheels are one instanced mesh and the idlers another.
// Built at radius R across y and z (an instance scales on to its own wheel's size) with its
// true width along x, the axle.
export type GearLook = { rubber: string; steel: string; hub: string }
type Part = 'rubber' | 'steel' | 'hub'
function paint(list: [BufferGeometry, Part][], look: GearLook) {
  const out = list.map(([g, part]) => {
    const c = new Color(look[part])
    const n = g.getAttribute('position').count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
    g.setAttribute('color', new Float32BufferAttribute(col, 3))
    return g
  })
  const g = mergeGeometries(out)!
  out.forEach((x) => x.dispose())
  return g
}
function putPart(list: [BufferGeometry, Part][], part: Part, geo: BufferGeometry, p: V3, r: V3 = [0, 0, 0]) {
  const tmp: [BufferGeometry, LinkRole][] = []
  put(tmp, 'plate', geo, p, r)
  list.push([tmp[0][0], part])
}
// A disc whose axle is x: radius rad, thickness t, centred at x.
const disc = (rad: number, t: number, seg: number) => new CylinderGeometry(rad, rad, t, seg)
const AX: V3 = [0, 0, Math.PI / 2]

const gearCache = new Map<string, BufferGeometry>()
const gearKey = (kind: string, w: number, R: number, l: GearLook) => `${kind}|${w}|${R}|${l.rubber}|${l.steel}|${l.hub}`

// A road wheel: a solid rubber tyre band round a stepped steel disc, a domed hub cap and a
// ring of six bolts on each face. w: its width.
export function roadWheelGeo(w: number, R: number, look: GearLook) {
  const key = gearKey('road', w, R, look)
  const hit = gearCache.get(key)
  if (hit) return hit
  const L: [BufferGeometry, Part][] = []
  // Tyre band, a little rounded at its edges.
  putPart(L, 'rubber', new CylinderGeometry(1, 1, w * 0.86, 24, 1, true), [0, 0, 0], AX)
  for (const sx of [-1, 1]) putPart(L, 'rubber', new CylinderGeometry(0.97, 1, w * 0.07, 24, 1, true), [sx * w * 0.465, 0, 0], [0, 0, (-sx * Math.PI) / 2])
  // The band's inner lip, then the steel disc stepping in to a raised boss.
  putPart(L, 'rubber', disc(0.97, w * 0.94, 24), [0, 0, 0], AX)
  putPart(L, 'steel', disc(0.8, w * 1.02, 22), [0, 0, 0], AX)
  putPart(L, 'steel', disc(0.52, w * 1.12, 18), [0, 0, 0], AX)
  putPart(L, 'hub', disc(0.23, w * 1.24, 14), [0, 0, 0], AX)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    for (const sx of [-1, 1]) putPart(L, 'hub', disc(0.06, 0.008, 6), [sx * w * 0.56, Math.cos(a) * 0.38, Math.sin(a) * 0.38], AX)
  }
  const g = paint(L, look).scale(1, R, R)
  gearCache.set(key, g)
  return g
}

// The idler at the front: an all-steel wheel with a raised rim, six lightening holes (dark
// recesses) and a big hub, as wide as a pair of road wheels.
export function idlerGeo(w: number, R: number, look: GearLook) {
  const key = gearKey('idler', w, R, look)
  const hit = gearCache.get(key)
  if (hit) return hit
  const L: [BufferGeometry, Part][] = []
  const half = 0.035
  for (const sx of [-1, 1]) {
    putPart(L, 'steel', disc(1, w, 28), [sx * half, 0, 0], AX)
    putPart(L, 'steel', new CylinderGeometry(0.82, 0.82, w * 1.2, 28, 1, true), [sx * half, 0, 0], AX)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      putPart(L, 'rubber', disc(0.17, 0.004, 12), [sx * (half + w / 2 + 0.001), Math.cos(a) * 0.55, Math.sin(a) * 0.55], AX)
    }
  }
  putPart(L, 'steel', disc(0.3, half * 2, 16), [0, 0, 0], AX)
  putPart(L, 'hub', disc(0.19, half * 2 + w + 0.016, 14), [0, 0, 0], AX)
  const g = paint(L, look).scale(1, R, R)
  gearCache.set(key, g)
  return g
}

// Suspension: a trailing arm from each road wheel's hub up and forward into the hull, and a
// bump stop above it, on the inside of the inner wheel. Static (the wheels turn on its end).
// at: [z, y] of each road wheel; x: the side's inner face (signed).
export function armsGeo(at: [number, number][], xs: number[], look: GearLook) {
  const key = `arms|${at.map((a) => a.join()).join(';')}|${xs.join()}|${look.steel}`
  const hit = gearCache.get(key)
  if (hit) return hit
  const L: [BufferGeometry, Part][] = []
  for (const x of xs) for (const [z, y] of at) {
    putPart(L, 'steel', new BoxGeometry(0.022, 0.024, 0.11), [x, y + 0.03, z + 0.045], [-0.55, 0, 0])
    putPart(L, 'hub', disc(0.016, 0.03, 8), [x, y, z], AX)
    putPart(L, 'steel', new BoxGeometry(0.03, 0.02, 0.03), [x, y + 0.075, z + 0.09])
  }
  const g = paint(L, look)
  gearCache.set(key, g)
  return g
}
