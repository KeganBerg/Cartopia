import { BoxGeometry, BufferAttribute, BufferGeometry, Vector3 } from 'three'

// three's RoundedBoxGeometry, the same vertices, normals and UVs, built from a template.
// The rounding of each corner vertex and its place along the arc (for the UVs) depend only
// on the segment count, so they're worked out once per count; a new box only scales them.
// Building them afresh for every rounded box was most of building a car on a slow phone
// (a car has hundreds of them).

type Template = {
  sign: Float32Array // which way each vertex sits from the middle, per axis
  normal: Float64Array // at full precision, as the original works the positions out from them
  // Per UV component: how far along its arc the vertex is (angle ratio), whether it's on the near
  // arc, which side length it runs along (0 width, 1 height, 2 depth), and whether it's flipped.
  arc: Float64Array
  near: Uint8Array
  dim: Uint8Array
  flip: Uint8Array
  groups: { start: number; count: number; materialIndex?: number }[]
}

const templates = new Map<number, Template>()
const tmp = new Vector3()
const AXES = { x: 0, y: 1, z: 2 } as const
type Axis = keyof typeof AXES
// Per box side (right, left, top, bottom, front, back), the face direction and each UV
// component's [uv axis, projection axis, flipped], as in RoundedBoxGeometry.
const SIDES: [[number, number, number], [Axis, Axis, boolean], [Axis, Axis, boolean]][] = [
  [[1, 0, 0], ['z', 'y', false], ['y', 'z', true]],
  [[-1, 0, 0], ['z', 'y', true], ['y', 'z', true]],
  [[0, 1, 0], ['x', 'z', true], ['z', 'x', false]],
  [[0, -1, 0], ['x', 'z', true], ['z', 'x', true]],
  [[0, 0, 1], ['x', 'y', true], ['y', 'x', true]],
  [[0, 0, -1], ['x', 'y', false], ['y', 'x', true]],
]

function template(segments: number): Template {
  const hit = templates.get(segments)
  if (hit) return hit
  const total = segments * 2 + 1
  const unit = new BoxGeometry(1, 1, 1, total, total, total)
  const flat = unit.toNonIndexed()
  unit.dispose()
  const pos = flat.getAttribute('position').array as Float32Array
  const n = pos.length / 3
  const t: Template = {
    sign: new Float32Array(n * 3),
    normal: new Float64Array(n * 3),
    arc: new Float64Array(n * 2),
    near: new Uint8Array(n * 2),
    dim: new Uint8Array(n * 2),
    flip: new Uint8Array(n * 2),
    groups: flat.groups.map((g) => ({ ...g })),
  }
  flat.dispose()
  const half = 0.5 / total
  const normal = new Vector3()
  const face = new Vector3()
  const faceTris = pos.length / 6
  const halfArc = Math.PI / 4
  for (let v = 0, i = 0; v < n; v++, i += 3) {
    normal.fromArray(pos, i)
    const sx = Math.sign(normal.x), sy = Math.sign(normal.y), sz = Math.sign(normal.z)
    t.sign[i] = sx
    t.sign[i + 1] = sy
    t.sign[i + 2] = sz
    normal.x -= sx * half
    normal.y -= sy * half
    normal.z -= sz * half
    normal.normalize()
    t.normal[i] = normal.x
    t.normal[i + 1] = normal.y
    t.normal[i + 2] = normal.z
    const [dir, ...uv] = SIDES[Math.floor(i / faceTris)]
    face.set(...dir)
    uv.forEach(([axis, proj, flip], c) => {
      tmp.copy(normal)
      tmp[proj] = 0
      tmp.normalize()
      const k = v * 2 + c
      t.arc[k] = 1 - tmp.angleTo(face) / halfArc
      t.near[k] = Math.sign(tmp[axis]) === 1 ? 1 : 0
      t.dim[k] = AXES[axis]
      t.flip[k] = flip ? 1 : 0
    })
  }
  templates.set(segments, t)
  return t
}

export function roundedBox(width = 1, height = 1, depth = 1, segments = 2, radius = 0.1): BufferGeometry {
  radius = Math.min(width / 2, height / 2, depth / 2, radius)
  const t = template(segments)
  const nrm = t.normal
  const n = t.sign.length / 3
  const bx = width / 2 - radius, by = height / 2 - radius, bz = depth / 2 - radius
  const position = new Float32Array(n * 3)
  for (let i = 0; i < n * 3; i += 3) {
    position[i] = bx * t.sign[i] + nrm[i] * radius
    position[i + 1] = by * t.sign[i + 1] + nrm[i + 1] * radius
    position[i + 2] = bz * t.sign[i + 2] + nrm[i + 2] * radius
  }
  // Each side length's share of UV space for the arcs and the flat between them.
  const arcLen = (2 * Math.PI * radius) / 4
  const arcUv = [0, 0, 0], lenUv = [0, 0, 0]
  ;[width, height, depth].forEach((side, d) => {
    const centre = Math.max(side - 2 * radius, 0)
    arcUv[d] = (0.5 * arcLen) / (arcLen + centre)
    lenUv[d] = centre / (arcLen + centre)
  })
  const uv = new Float32Array(n * 2)
  for (let k = 0; k < n * 2; k++) {
    const d = t.dim[k], a = t.arc[k]
    const u = t.near[k] ? a * arcUv[d] : lenUv[d] + arcUv[d] + arcUv[d] * (1 - a)
    uv[k] = t.flip[k] ? 1 - u : u
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(position, 3))
  g.setAttribute('normal', new BufferAttribute(Float32Array.from(nrm), 3))
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  for (const gr of t.groups) g.addGroup(gr.start, gr.count, gr.materialIndex)
  return g
}
