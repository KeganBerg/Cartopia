import { BufferAttribute, BufferGeometry, Color, DoubleSide, FrontSide, Material, MeshBasicMaterial, MeshStandardMaterial, type Matrix4 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Baking: many parts that differ only in plain material settings (colour,
// roughness, metalness, glow) become one mesh with those settings stored per
// vertex, drawn with one shared material (bakedMaterial). One draw instead of one
// per look. Used for town cars (carBatch.ts) and the static town (Batch.tsx).

// How one part looks, matching the material it would otherwise be drawn with.
// glow: lights up when its car is picked (the paint's highlight).
export type Finish = { color: Color | string; metal?: number; rough?: number; unlit?: boolean; emissive?: Color; glow?: boolean; double?: boolean }

const tmp = new Color()

// Merge parts (each optionally moved by a matrix) into one indexed geometry carrying
// `color` (linear RGB, as a material's colour is), `emissive` (colour times intensity)
// and `look` (metalness, roughness, unlit, glow).
export function bake(parts: [BufferGeometry, Finish, Matrix4?][]) {
  const list = parts.map(([geo, f, m]) => {
    const pos = geo.getAttribute('position')
    const n = pos.count
    const g = new BufferGeometry()
    g.setAttribute('position', pos.clone())
    g.setAttribute('normal', geo.getAttribute('normal').clone())
    g.setIndex(geo.index ? geo.index.clone() : new BufferAttribute(Uint32Array.from({ length: n }, (_, i) => i), 1))
    if (m) g.applyMatrix4(m)
    // Double-sided parts get a reversed copy of every triangle with the normals flipped,
    // so one front-sided material draws (and shadows) both faces.
    const both = f.double ? 2 : 1
    const color = new Float32Array(n * 3 * both)
    const emissive = new Float32Array(n * 3 * both)
    const look = new Float32Array(n * 4 * both)
    if (typeof f.color === 'string') tmp.set(f.color)
    else tmp.copy(f.color)
    for (let i = 0; i < n * both; i++) {
      color[i * 3] = tmp.r
      color[i * 3 + 1] = tmp.g
      color[i * 3 + 2] = tmp.b
      if (f.emissive) {
        emissive[i * 3] = f.emissive.r
        emissive[i * 3 + 1] = f.emissive.g
        emissive[i * 3 + 2] = f.emissive.b
      }
      look[i * 4] = f.metal ?? 0
      look[i * 4 + 1] = f.rough ?? 1
      look[i * 4 + 2] = f.unlit ? 1 : 0
      look[i * 4 + 3] = f.glow ? 1 : 0
    }
    if (f.double) withBackFaces(g)
    g.setAttribute('color', new BufferAttribute(color, 3))
    g.setAttribute('emissive', new BufferAttribute(emissive, 3))
    g.setAttribute('look', new BufferAttribute(look, 4))
    return g
  })
  const out = mergeGeometries(list)!
  list.forEach((g) => g.dispose())
  return out
}

function withBackFaces(g: BufferGeometry) {
  const p = g.getAttribute('position').array
  const nr = g.getAttribute('normal').array
  const n = p.length / 3
  const pos = new Float32Array(n * 6)
  const nor = new Float32Array(n * 6)
  pos.set(p)
  pos.set(p, n * 3)
  nor.set(nr)
  for (let i = 0; i < n * 3; i++) nor[n * 3 + i] = -nr[i]
  const idx = g.index!.array
  const out = new Uint32Array(idx.length * 2)
  out.set(idx)
  for (let t = 0; t < idx.length; t += 3) {
    out[idx.length + t] = idx[t] + n
    out[idx.length + t + 1] = idx[t + 2] + n
    out[idx.length + t + 2] = idx[t + 1] + n
  }
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('normal', new BufferAttribute(nor, 3))
  g.setIndex(new BufferAttribute(out, 1))
}

// A standard material whose colour, glow, metalness and roughness come from the
// vertices. Unlit parts come out as their flat colour, exactly like
// MeshBasicMaterial. `picked` lights up the glow parts like the emissive highlight
// on a picked car's paint.
export function bakedMaterial(picked = false) {
  const m = new MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: 1 })
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 look;\nattribute vec3 emissive;\nflat varying vec4 vLook;\nflat varying vec3 vEmissive;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLook = look;\nvEmissive = emissive;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nflat varying vec4 vLook;\nflat varying vec3 vEmissive;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vLook.y;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vLook.x;')
      .replace('#include <emissivemap_fragment>', `totalEmissiveRadiance += vEmissive${picked ? ' + vec3(0.25 * vLook.w)' : ''};`)
      .replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, diffuseColor.rgb, vLook.z);\n#include <opaque_fragment>')
  }
  m.customProgramCacheKey = () => (picked ? 'baked-picked' : 'baked')
  return m
}

const emissiveOf = (m: MeshStandardMaterial) => (m.emissiveIntensity && (m.emissive.r || m.emissive.g || m.emissive.b) ? m.emissive.clone().multiplyScalar(m.emissiveIntensity) : undefined)

// The finish a shared material gives a part.
export function finishOf(m: MeshStandardMaterial | MeshBasicMaterial): Finish {
  if (m instanceof MeshBasicMaterial) return { color: m.color, unlit: true, double: m.side === DoubleSide }
  return { color: m.color, metal: m.metalness, rough: m.roughness, emissive: emissiveOf(m), double: m.side === DoubleSide }
}

// Can a mesh with this material be baked without changing how it looks? Only when
// everything but the settings a Finish carries is left at its default: no textures,
// not see-through, no custom shader, and so on.
const plain = new WeakMap<Material, boolean>()
const SKIP = new Set(['uuid', 'id', 'name', 'version', 'userData', 'type'])
function settings(m: Material) {
  const parts: string[] = []
  for (const [k, v] of Object.entries(m)) {
    if (SKIP.has(k) || k.startsWith('_')) continue
    if (v instanceof Color) parts.push(`${k}:${v.getHexString()}`)
    else if (v === null || typeof v !== 'object') parts.push(`${k}:${String(v)}`)
    else parts.push(`${k}:object`)
  }
  return parts.join('|')
}
const DEFAULTS = { std: settings(new MeshStandardMaterial()), basic: settings(new MeshBasicMaterial()) }

export function bakeable(m: Material) {
  let ok = plain.get(m)
  if (ok !== undefined) return ok
  ok = false
  // Exactly these classes: subclasses (physical, toon...) draw differently.
  const kind: unknown = m.constructor
  // A custom shader hook isn't copied by clone(), so look for it on the original.
  const custom = Object.hasOwn(m, 'onBeforeCompile') || Object.hasOwn(m, 'customProgramCacheKey')
  if (!custom && (kind === MeshStandardMaterial || kind === MeshBasicMaterial)) {
    const c = m.clone() as MeshStandardMaterial | MeshBasicMaterial
    c.color.set(0xffffff)
    c.side = m.side === DoubleSide ? FrontSide : m.side
    if (c instanceof MeshStandardMaterial) {
      c.emissive.set(0)
      c.emissiveIntensity = 1
      c.roughness = 1
      c.metalness = 0
      ok = settings(c) === DEFAULTS.std
    } else ok = settings(c) === DEFAULTS.basic
  }
  plain.set(m, ok)
  return ok
}
