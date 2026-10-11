import { BufferAttribute, BufferGeometry, Color, DoubleSide, FrontSide, Material, MeshBasicMaterial, MeshStandardMaterial, type Matrix3, type Matrix4, type Texture } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { weatherBaked } from './weatherLook'
import { withSkin } from './skins'

// Baking: many parts that differ only in plain material settings (colour,
// roughness, metalness, glow) become one mesh with those settings stored per
// vertex, drawn with one shared material (bakedMaterial). One draw instead of one
// per look. Used for town cars (carBatch.ts) and the static town (Batch.tsx).
// Textured parts bake too, one mesh per image: each part's texture repeat and
// offset are moved into its UVs, so tiled copies of one image share a draw.

// How one part looks, matching the material it would otherwise be drawn with.
// glow: lights up when its car is picked (the paint's highlight).
// uv: the part's texture transform (repeat, offset), baked into its UVs.
// skin: a car skin's number (scene/skins.ts); only town cars bake skins.
export type Finish = { color: Color | string; metal?: number; rough?: number; unlit?: boolean; emissive?: Color; glow?: boolean; double?: boolean; uv?: Matrix3; skin?: number }

const tmp = new Color()

// Merge parts (each optionally moved by a matrix) into one indexed geometry carrying
// `color` (linear RGB, as a material's colour is), `emissive` (colour times intensity)
// and `look` (metalness, roughness, unlit, glow). `uvs` keeps texture coordinates.
// When any part sets a skin (0 for none), every part gets a `skin` number.
export function bake(parts: [BufferGeometry, Finish, Matrix4?][], uvs = false) {
  const skinned = parts.some(([, f]) => f.skin !== undefined)
  const list = parts.map(([geo, f, m]) => {
    const pos = geo.getAttribute('position')
    const n = pos.count
    const g = new BufferGeometry()
    g.setAttribute('position', pos.clone())
    g.setAttribute('normal', geo.getAttribute('normal').clone())
    g.setIndex(geo.index ? geo.index.clone() : new BufferAttribute(Uint32Array.from({ length: n }, (_, i) => i), 1))
    if (uvs) {
      const uv = geo.getAttribute('uv').clone()
      if (f.uv) uv.applyMatrix3(f.uv)
      g.setAttribute('uv', uv)
    }
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
    if (skinned) g.setAttribute('skin', new BufferAttribute(new Float32Array(n * both).fill(f.skin ?? 0), 1))
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
// on a picked car's paint. `skins`: draws car skins on parts baked with one (town cars).
export function bakedMaterial(picked = false, map: Texture | null = null, skins = false) {
  const m = new MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: 1, map })
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
    // Rain sheen and settled snow on whatever faces the sky.
    weatherBaked(sh)
    if (skins) withSkin(sh, 'int(vSkin + 0.5)', true)
  }
  m.customProgramCacheKey = () => (picked ? 'baked-picked' : 'baked') + (skins ? '-skins' : '')
  return m
}

const emissiveOf = (m: MeshStandardMaterial) => (m.emissiveIntensity && (m.emissive.r || m.emissive.g || m.emissive.b) ? m.emissive.clone().multiplyScalar(m.emissiveIntensity) : undefined)

// The finish a shared material gives a part.
export function finishOf(m: MeshStandardMaterial | MeshBasicMaterial): Finish {
  const uv = m.map ? uvOf(m.map) : undefined
  if (m instanceof MeshBasicMaterial) return { color: m.color, unlit: true, double: m.side === DoubleSide, uv }
  return { color: m.color, metal: m.metalness, rough: m.roughness, emissive: emissiveOf(m), double: m.side === DoubleSide, uv }
}

function uvOf(t: Texture) {
  if (t.matrixAutoUpdate) t.updateMatrix()
  return t.matrix.clone()
}

// Everything about a texture except its repeat and offset: textures with the same
// key can share one draw once those are baked into the UVs.
export function textureKey(t: Texture) {
  return [t.source.uuid, t.wrapS, t.wrapT, t.magFilter, t.minFilter, t.anisotropy, t.colorSpace, t.flipY, t.generateMipmaps, t.premultiplyAlpha, t.format, t.type, t.channel].join('|')
}

// One material per texture image (and settings) for baked textured parts, the
// texture itself left untransformed since the UVs carry each part's repeat.
const mapMats = new Map<string, MeshStandardMaterial>()
export function bakedMapMaterial(t: Texture) {
  const k = textureKey(t)
  let m = mapMats.get(k)
  if (!m) {
    const plain = t.clone()
    plain.repeat.set(1, 1)
    plain.offset.set(0, 0)
    plain.rotation = 0
    plain.center.set(0, 0)
    plain.matrixAutoUpdate = true
    plain.updateMatrix()
    mapMats.set(k, (m = bakedMaterial(false, plain)))
  }
  return m
}

// Can a mesh with this material be baked without changing how it looks? Only when
// everything but the settings a Finish carries is left at its default: at most a
// colour map, not see-through, no custom shader, and so on. 'map' means it has a
// colour map (bake it with others of the same textureKey), 'plain' that it has none.
const plain = new WeakMap<Material, false | 'plain' | 'map'>()
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

export function bakeable(m: Material): false | 'plain' | 'map' {
  let ok = plain.get(m)
  if (ok !== undefined) return ok
  ok = false
  let same = false
  // Exactly these classes: subclasses (physical, toon...) draw differently.
  const kind: unknown = m.constructor
  // A custom shader hook isn't copied by clone(), so look for it on the original.
  const custom = Object.hasOwn(m, 'onBeforeCompile') || Object.hasOwn(m, 'customProgramCacheKey')
  if (!custom && (kind === MeshStandardMaterial || kind === MeshBasicMaterial)) {
    const c = m.clone() as MeshStandardMaterial | MeshBasicMaterial
    c.color.set(0xffffff)
    c.side = m.side === DoubleSide ? FrontSide : m.side
    const map = c.map
    c.map = null
    if (c instanceof MeshStandardMaterial) {
      c.emissive.set(0)
      c.emissiveIntensity = 1
      c.roughness = 1
      c.metalness = 0
      same = settings(c) === DEFAULTS.std
    } else same = settings(c) === DEFAULTS.basic
    // A colour map read through the plain UV channel.
    if (same) ok = !map ? 'plain' : map.channel === 0 && map.isTexture && map.source ? 'map' : false
  }
  plain.set(m, ok)
  return ok
}
