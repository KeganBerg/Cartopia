import { BufferAttribute, BufferGeometry, Color, DoubleSide, FrontSide, Material, Matrix3, MeshBasicMaterial, MeshStandardMaterial, type Matrix4, type Texture } from 'three'
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
const normalMat = new Matrix3()

// Merge parts (each optionally moved by a matrix) into one indexed geometry carrying
// `color` (linear RGB, as a material's colour is), `emissive` (colour times intensity)
// and `look` (metalness, roughness, unlit, glow). `uvs` keeps texture coordinates.
// When any part sets a skin (0 for none), every part gets a `skin` number.
// Written straight into one set of arrays: a big town bakes tens of thousands of
// parts, and copying each into its own geometry first cost phones seconds.
export function bake(parts: [BufferGeometry, Finish, Matrix4?][], uvs = false) {
  const skinned = parts.some(([, f]) => f.skin !== undefined)
  let verts = 0
  let tris = 0
  for (const [geo, f] of parts) {
    const both = f.double ? 2 : 1
    const n = geo.getAttribute('position').count
    verts += n * both
    tris += (geo.index ? geo.index.count : n) * both
  }
  const position = new Float32Array(verts * 3)
  const normal = new Float32Array(verts * 3)
  const uv = uvs ? new Float32Array(verts * 2) : null
  const color = new Float32Array(verts * 3)
  const emissive = new Float32Array(verts * 3)
  const look = new Float32Array(verts * 4)
  const skin = skinned ? new Float32Array(verts) : null
  const index = verts > 65535 ? new Uint32Array(tris) : new Uint16Array(tris)
  let v = 0
  let t = 0
  for (const [geo, f, m] of parts) {
    const pos = geo.getAttribute('position')
    const nor = geo.getAttribute('normal')
    const n = pos.count
    const start = v
    const e = m?.elements
    if (m) normalMat.getNormalMatrix(m)
    const ne = normalMat.elements
    for (let i = 0; i < n; i++, v++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      if (e) {
        const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15])
        position[v * 3] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w
        position[v * 3 + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w
        position[v * 3 + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w
      } else {
        position[v * 3] = x
        position[v * 3 + 1] = y
        position[v * 3 + 2] = z
      }
      let a = nor.getX(i), b = nor.getY(i), c = nor.getZ(i)
      if (e) {
        const na = ne[0] * a + ne[3] * b + ne[6] * c
        const nb = ne[1] * a + ne[4] * b + ne[7] * c
        const nc = ne[2] * a + ne[5] * b + ne[8] * c
        const l = Math.sqrt(na * na + nb * nb + nc * nc) || 1
        a = na / l
        b = nb / l
        c = nc / l
      }
      normal[v * 3] = a
      normal[v * 3 + 1] = b
      normal[v * 3 + 2] = c
    }
    if (uv) {
      const src = geo.getAttribute('uv')
      const u = f.uv?.elements
      for (let i = 0; i < n; i++) {
        const x = src.getX(i), y = src.getY(i)
        uv[(start + i) * 2] = u ? u[0] * x + u[3] * y + u[6] : x
        uv[(start + i) * 2 + 1] = u ? u[1] * x + u[4] * y + u[7] : y
      }
    }
    const idx = geo.index
    const count = idx ? idx.count : n
    for (let i = 0; i < count; i++) index[t + i] = (idx ? idx.getX(i) : i) + start
    t += count
    // Double-sided parts get a reversed copy of every triangle with the normals flipped,
    // so one front-sided material draws (and shadows) both faces.
    if (f.double) {
      position.copyWithin(v * 3, start * 3, (start + n) * 3)
      for (let i = 0; i < n * 3; i++) normal[v * 3 + i] = -normal[start * 3 + i]
      if (uv) uv.copyWithin(v * 2, start * 2, (start + n) * 2)
      for (let i = 0; i < count; i += 3) {
        index[t + i] = index[t - count + i] + n
        index[t + i + 1] = index[t - count + i + 2] + n
        index[t + i + 2] = index[t - count + i + 1] + n
      }
      v += n
      t += count
    }
    if (typeof f.color === 'string') tmp.set(f.color)
    else tmp.copy(f.color)
    const metal = f.metal ?? 0
    const rough = f.rough ?? 1
    const unlit = f.unlit ? 1 : 0
    const glow = f.glow ? 1 : 0
    for (let i = start; i < v; i++) {
      color[i * 3] = tmp.r
      color[i * 3 + 1] = tmp.g
      color[i * 3 + 2] = tmp.b
      if (f.emissive) {
        emissive[i * 3] = f.emissive.r
        emissive[i * 3 + 1] = f.emissive.g
        emissive[i * 3 + 2] = f.emissive.b
      }
      look[i * 4] = metal
      look[i * 4 + 1] = rough
      look[i * 4 + 2] = unlit
      look[i * 4 + 3] = glow
    }
    if (skin) skin.fill(f.skin ?? 0, start, v)
  }
  const out = new BufferGeometry()
  out.setAttribute('position', new BufferAttribute(position, 3))
  // Stored small, as the shader reads them the same: the town's merged meshes were
  // ~180 MB, and a phone holds them twice (the page and the GPU).
  out.setAttribute('normal', packed(normal, Int8Array, 127, 3))
  if (uv) out.setAttribute('uv', new BufferAttribute(uv, 2))
  // Colours brighter than white (made to glow under bloom) stay as they are.
  // (A plain loop: every() with a callback per value was most of a big bake on a slow phone.)
  const rgb = (a: Float32Array) => {
    for (let i = 0; i < a.length; i++) if (!(a[i] >= 0 && a[i] <= 1)) return new BufferAttribute(a, 3)
    return packed(a, Uint16Array, 65535, 3)
  }
  out.setAttribute('color', rgb(color))
  out.setAttribute('emissive', rgb(emissive))
  out.setAttribute('look', packed(look, Uint8Array, 255, 4))
  if (skin) out.setAttribute('skin', new BufferAttribute(Uint8Array.from(skin), 1))
  out.setIndex(new BufferAttribute(index, 1))
  return out
}

// Values in 0..1 (or -1..1 for normals) as normalized integers: the GPU hands the
// shader the same floats, to within 1/127 for a normal and 1/65535 for a colour.
// Colours keep 16 bits because they're linear: 8 would band the darks.
function packed(src: Float32Array, Kind: Int8ArrayConstructor | Uint8ArrayConstructor | Uint16ArrayConstructor, max: number, size: number) {
  const a = new Kind(src.length)
  const low = Kind === Int8Array ? -1 : 0
  for (let i = 0; i < src.length; i++) a[i] = Math.round(Math.min(1, Math.max(low, src[i])) * max)
  return new BufferAttribute(a, size, true)
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
