import { BufferGeometry, CircleGeometry, CylinderGeometry, Euler, LatheGeometry, Matrix4, Quaternion, TorusGeometry, Vector2, Vector3, BoxGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Close-up wheels for cars drawn whole (garage, showroom, races): a rounded tyre
// with tread grooves and a dark inner dish, and a 3D rim in one of several styles.
// Two meshes a wheel (rubber and rim). Town traffic keeps the pooled flat wheels.

export type RimStyle = 'five' | 'split' | 'mesh' | 'steel' | 'deep' | 'turbine' | 'wire' | 'beadlock' | 'classic'

type V3 = [number, number, number]

function put(list: BufferGeometry[], geo: BufferGeometry, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) {
  const m = new Matrix4().compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(...r)), new Vector3(...s))
  const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m)
  if (geo !== g) geo.dispose()
  for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n)
  list.push(g)
}

const merge = (list: BufferGeometry[]) => {
  const g = mergeGeometries(list)!
  list.forEach((x) => x.dispose())
  return g
}

// The rim's outer radius, as a share of the tyre's.
const RIM = 0.68

const cache = new Map<string, { tire: BufferGeometry; rims: [BufferGeometry, BufferGeometry] }>()

// Tyre and rim for a wheel of radius r and width w, axle along x. rims[0] faces -x, rims[1] faces +x.
export function wheelGeo(style: RimStyle, r: number, w: number, whitewall = false) {
  const key = `${style}|${r}|${w}|${whitewall ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) return hit
  const ri = r * RIM
  // Tyre: lathe round the y axis (turned onto x at the end). Profile from the inner bead
  // up the sidewall, over a rounded shoulder and across the tread with a groove down the middle.
  const h = w / 2
  const pts: [number, number][] = [
    [ri * 0.98, -h * 0.82], [ri * 1.04, -h * 0.92], [r * 0.86, -h], [r * 0.97, -h * 0.9], [r, -h * 0.6],
    [r, -h * 0.2], [r * 0.975, -h * 0.15], [r * 0.975, h * 0.15], [r, h * 0.2],
    [r, h * 0.6], [r * 0.97, h * 0.9], [r * 0.86, h], [ri * 1.04, h * 0.92], [ri * 0.98, h * 0.82],
  ]
  // Lathe profiles run bottom to top with the outside on the right for outward normals.
  const tireList: BufferGeometry[] = []
  put(tireList, new LatheGeometry(pts.map(([x, y]) => new Vector2(x, y)), 22))
  // Dark wheel well behind the spokes, set back on both sides so the brake shows in front of it.
  for (const sd of [-1, 1]) put(tireList, new CircleGeometry(ri, 20), [0, -sd * h * 0.2, 0], [(sd * -Math.PI) / 2, 0, 0])
  if (whitewall) for (const sd of [-1, 1]) put(tireList, new TorusGeometry(r * 0.8, r * 0.07, 3, 28), [0, sd * h * 1.0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.25])
  const tire = merge(tireList)
  tire.rotateZ(Math.PI / 2)

  // Rim face, built facing +y (the tyre's axis before turning), then turned onto ±x.
  const face = rimFace(style, ri, h)
  const right = face.clone().rotateZ(-Math.PI / 2)
  const left = face.rotateZ(Math.PI / 2)
  const out = { tire, rims: [left, right] as [BufferGeometry, BufferGeometry] }
  cache.set(key, out)
  return out
}

// Brake rotor and caliper behind a wheel's spokes, in the wheel's own place (they don't spin).
// sd: which side of the car the wheel is on. Returns geometry for the rotor (dark) and caliper.
export function brakeGeo(r: number, w: number, sd: number) {
  const ri = r * RIM
  const rotor: BufferGeometry[] = []
  const cal: BufferGeometry[] = []
  // The rotor sits well out from the body side so it never lies flush with the dark wheel well.
  const x = sd * w * 0.12
  put(rotor, new CylinderGeometry(ri * 0.82, ri * 0.82, 0.012, 20), [x + sd * 0.0085, 0, 0], [0, 0, Math.PI / 2])
  put(rotor, new CylinderGeometry(ri * 0.34, ri * 0.34, 0.03, 12), [x + sd * 0.01, 0, 0], [0, 0, Math.PI / 2])
  // Caliper clamped over the rotor at the back, top.
  const a = 2.2
  put(cal, new BoxGeometry(0.03, ri * 0.32, ri * 0.55), [x + sd * 0.012, Math.sin(a) * ri * 0.66, Math.cos(a) * ri * 0.66], [-(a - Math.PI / 2), 0, 0])
  return { rotor: merge(rotor), caliper: merge(cal) }
}

// One spoke from the hub out to the rim, dished back toward the middle of the wheel.
function spoke(list: BufferGeometry[], a: number, ri: number, h: number, t: number, depth: number, inner = 0.26, outer = 0.94) {
  const len = ri * (outer - inner)
  const mid = ri * (inner + outer) / 2
  // Built along +x in the wheel plane (y is the axle), then turned round the axle.
  const g = new BoxGeometry(len, depth, t)
  g.rotateZ(-0.12) // dish: outer end sits deeper
  g.translate(mid, h * 0.62, 0)
  g.rotateY(a)
  put(list, g)
}

function rimFace(style: RimStyle, ri: number, h: number) {
  const L: BufferGeometry[] = []
  const y = h * 0.62 // spoke face height off the centre plane
  const ring = (rad: number, tube: number, yy = y, seg = 28) => put(L, new TorusGeometry(rad, tube, 4, seg), [0, yy, 0], [Math.PI / 2, 0, 0])
  // Outer lip and barrel edge every rim has.
  ring(ri * 0.97, ri * 0.05, h * 0.72)
  put(L, new CylinderGeometry(ri * 0.95, ri * 0.95, h * 0.9, 24, 1, true), [0, h * 0.25, 0])
  const hub = (rad: number, lugs: number) => {
    put(L, new CylinderGeometry(rad, rad * 1.1, h * 0.3, 14), [0, y + h * 0.05, 0])
    put(L, new CylinderGeometry(rad * 0.5, rad * 0.55, h * 0.2, 10), [0, y + h * 0.22, 0])
    for (let i = 0; i < lugs; i++) {
      const a = (i / lugs) * Math.PI * 2
      put(L, new CylinderGeometry(rad * 0.13, rad * 0.13, h * 0.16, 6), [Math.cos(a) * rad * 0.72, y + h * 0.2, Math.sin(a) * rad * 0.72])
    }
  }
  switch (style) {
    case 'five':
      for (let i = 0; i < 5; i++) spoke(L, (i / 5) * Math.PI * 2, ri, h, ri * 0.2, h * 0.18)
      hub(ri * 0.3, 5)
      break
    case 'split':
      for (let i = 0; i < 5; i++) for (const d of [-0.13, 0.13]) spoke(L, (i / 5) * Math.PI * 2 + d, ri, h, ri * 0.1, h * 0.16, 0.3)
      hub(ri * 0.3, 5)
      break
    case 'mesh':
      for (let i = 0; i < 10; i++) spoke(L, (i / 10) * Math.PI * 2, ri, h, ri * 0.07, h * 0.14)
      for (let i = 0; i < 10; i++) {
        const a = ((i + 0.5) / 10) * Math.PI * 2
        for (const d of [-0.16, 0.16]) spoke(L, a + d, ri, h, ri * 0.045, h * 0.1, 0.5, 0.93)
      }
      ring(ri * 0.5, ri * 0.03)
      hub(ri * 0.26, 5)
      break
    case 'deep':
      // Wide polished lip and slim spokes set well back.
      ring(ri * 0.86, ri * 0.09, h * 0.7)
      for (let i = 0; i < 6; i++) spoke(L, (i / 6) * Math.PI * 2, ri * 0.82, h * 0.6, ri * 0.11, h * 0.16)
      hub(ri * 0.26, 6)
      break
    case 'steel': {
      // Pressed steel wheel: a solid dished face, a ring of vent holes (dark in the tyre's
      // dish behind) and a small domed cap.
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2
        put(L, new CylinderGeometry(ri * 0.9, ri * 0.9, h * 0.06, 6, 1, false, a0 + 0.12, Math.PI / 4 - 0.24), [0, y - h * 0.05, 0])
      }
      put(L, new CylinderGeometry(ri * 0.62, ri * 0.62, h * 0.08, 20), [0, y, 0])
      put(L, new CylinderGeometry(ri * 0.36, ri * 0.4, h * 0.18, 16), [0, y + h * 0.1, 0])
      hub(ri * 0.22, 5)
      break
    }
    case 'turbine':
      // Aero disc with curved slots, like an EV's.
      put(L, new CylinderGeometry(ri * 0.9, ri * 0.92, h * 0.08, 28), [0, y - h * 0.04, 0])
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        const g = new BoxGeometry(ri * 0.42, h * 0.1, ri * 0.06)
        g.rotateY(0.5)
        g.translate(ri * 0.6, y + h * 0.04, 0)
        g.rotateY(a)
        put(L, g)
      }
      hub(ri * 0.28, 5)
      break
    case 'wire':
      // Laced wire spokes and a two-eared knock-off spinner.
      for (let i = 0; i < 20; i++) spoke(L, (i / 20) * Math.PI * 2 + (i % 2 ? 0.12 : -0.12), ri, h, ri * 0.025, h * 0.04, 0.2)
      put(L, new CylinderGeometry(ri * 0.22, ri * 0.25, h * 0.4, 12), [0, y + h * 0.08, 0])
      put(L, new BoxGeometry(ri * 0.62, h * 0.1, ri * 0.08), [0, y + h * 0.3, 0])
      break
    case 'beadlock':
      // Off-road wheel: eight round windows in a dished face and a bolted outer ring.
      put(L, new CylinderGeometry(ri * 0.94, ri * 0.94, h * 0.06, 28), [0, y - h * 0.05, 0])
      ring(ri * 0.88, ri * 0.06, y + h * 0.04)
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        put(L, new CylinderGeometry(ri * 0.03, ri * 0.03, h * 0.14, 6), [Math.cos(a) * ri * 0.88, y + h * 0.1, Math.sin(a) * ri * 0.88])
      }
      for (let i = 0; i < 6; i++) spoke(L, (i / 6) * Math.PI * 2, ri * 0.82, h, ri * 0.18, h * 0.14, 0.3)
      hub(ri * 0.3, 6)
      break
    case 'classic':
      // Chrome hubcap with a beauty ring, fifties style.
      put(L, new CylinderGeometry(ri * 0.62, ri * 0.75, h * 0.2, 24), [0, y, 0])
      put(L, new CylinderGeometry(ri * 0.3, ri * 0.55, h * 0.24, 20), [0, y + h * 0.2, 0])
      ring(ri * 0.82, ri * 0.04, y)
      for (let i = 0; i < 3; i++) {
        const g = new BoxGeometry(ri * 0.5, h * 0.06, ri * 0.06)
        g.translate(ri * 0.35, y + h * 0.28, 0)
        g.rotateY((i / 3) * Math.PI * 2)
        put(L, g)
      }
      break
  }
  return merge(L)
}
