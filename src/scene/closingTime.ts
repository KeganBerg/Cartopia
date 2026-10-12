import { Float32BufferAttribute, Matrix4, MeshBasicMaterial, Vector3, type BufferGeometry, type Material, type MeshStandardMaterial, type Object3D } from 'three'
import { seedOf } from '../game/hours'
import { signTexture } from './signTexture'

// Closing time: windows and signs that go dark at night as people head home
// (see game/hours.ts for who closes when). It is all one shader trick on the
// shared window, glass and sign materials, so it costs no extra draws:
// - each building group in town carries userData.hours = { seed, kind };
// - Batch copies that onto every merged vertex of an `hours` material as the
//   aHours attribute (building seed, a seed for the mesh itself, kind);
// - the shader compares the town clock with a closing time made from those
//   seeds, per pane of glass, and switches the light off.
// Meshes drawn without the attribute (race venues, previews) read kind 0: always lit.

export const hoursUniforms = { uHour: { value: 12 }, uNight: { value: 0 } }

// One closing rule per kind (HOURS order in game/hours.ts). Times are hours
// from noon (24 is midnight): office windows each pick their own time, the rest
// close as a whole building, a few stragglers a little after the others.
const RULES = /* glsl */ `
uniform float uHour;
uniform float uNight;
// Flat, never smoothed across the triangle: the seeds go through a hash that
// turns the tiniest change into a different answer, and a smoothed value
// wobbles in its last digits from pixel to pixel under the free camera's
// perspective, which lit random pixels of a dark pane (white speckle).
flat varying vec3 vHours;
varying float vHoursY;
float hoursHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
// 1 while lit, 0 once closed. cell picks one pane within the mesh, y is the
// height of that pane's middle (so a pane never straddles two floors).
float hoursLit(vec2 cell, float y) {
  float kind = floor(vHours.z + 0.5);
  if (kind < 0.5) return 1.0;
  float b = vHours.x;
  float w = vHours.y;
  float r = hoursHash(vec3(b * 917.0 + cell.x, w * 571.0 + cell.y, 11.0));
  float off;
  float on;
  float rest = 0.0;
  if (kind < 1.5) {
    // Offices: each floor heads home around its own time, then window by
    // window; a few work late, and a handful never switch off.
    float fl = hoursHash(vec3(b * 131.0, floor(y / 0.3), 7.0));
    float late = hoursHash(vec3(r * 313.0, b * 37.0, 3.0));
    off = 17.8 + fl * 2.4 + r * 1.6;
    if (late < 0.12) off = 23.5 + late * 35.0;
    if (late < 0.035) off = 99.0;
    on = 27.6 + r * 2.0;
  } else {
    vec4 k = kind < 2.5 ? vec4(19.6, 1.4, 28.6, 0.9)   // early: cafe, donuts
           : kind < 3.5 ? vec4(20.2, 1.8, 29.6, 0.0)   // shops and garages
           : kind < 4.5 ? vec4(18.6, 1.6, 29.0, 0.6)   // schools
           : kind < 5.5 ? vec4(21.2, 1.8, 29.6, 0.0)   // restaurants, arcade, bowling
           : kind < 6.5 ? vec4(24.5, 2.5, 28.8, 0.6)   // late: diner
           :              vec4(21.8, 3.0, 28.4, 1.2);  // homes: bedtime
    off = k.x + b * k.y + w * (kind > 6.5 ? 1.0 : 0.35) + r * 0.15;
    on = k.z + b * k.w + r * 0.3;
    // Night owls keep the lights on; closed shops leave a dim light or two.
    if (kind > 6.5 && fract(b * 7.31) < 0.2) off = 99.0;
    if (kind < 6.5 && w < 0.16) rest = 0.28;
#ifdef HOURS_SIGN
    off = k.x + b * k.y + 0.2;
    rest = 0.0;
#endif
  }
  float lit = max(1.0 - smoothstep(off, off + 0.05, uHour), smoothstep(on, on + 0.05, uHour));
  return max(lit, rest);
}
`

type Shader = { vertexShader: string; fragmentShader: string; uniforms: Record<string, { value: unknown }> }

function vert(sh: Shader) {
  Object.assign(sh.uniforms, hoursUniforms)
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 aHours;\nflat varying vec3 vHours;\nvarying float vHoursY;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvHours = aHours;\nvHoursY = (modelMatrix * vec4(transformed, 1.0)).y;')
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + RULES)
}

// Lit windows: the emissive glow goes out pane by pane. `cells` is how many
// panes the glow texture has across and up; `row` is how tall one row of panes
// is in the world, when the texture is laid on at a fixed size (0: unknown).
export function closingGlow<M extends MeshStandardMaterial>(m: M, cells: [number, number], key: string, row = 0) {
  m.userData.hours = true
  m.onBeforeCompile = (sh) => {
    vert(sh)
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
vec2 hoursCell = vEmissiveMapUv * vec2(${cells[0].toFixed(1)}, ${cells[1].toFixed(1)});
totalEmissiveRadiance *= hoursLit(floor(hoursCell), vHoursY - (fract(hoursCell.y) - 0.5) * ${row.toFixed(3)});`,
    )
  }
  m.customProgramCacheKey = () => `hours-${key}`
  return m
}

// Shop signs dim once the shop has closed for the night. Kept by text so Batch
// merges every sign that reads the same.
const signs = new Map<string, MeshBasicMaterial>()
export function signMat(text: string, bg?: string, fg?: string) {
  const k = `${text}|${bg}|${fg}`
  let s = signs.get(k)
  if (s) return s
  s = new MeshBasicMaterial({ map: signTexture(text, bg, fg), toneMapped: false })
  s.userData.hours = s.userData.live = true
  s.onBeforeCompile = (sh) => {
    vert(sh)
    sh.fragmentShader = '#define HOURS_SIGN\n' + sh.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\ndiffuseColor.rgb *= 1.0 - (1.0 - hoursLit(vec2(0.0), vHoursY)) * 0.62 * uNight;',
    )
  }
  s.customProgramCacheKey = () => 'hours-sign'
  signs.set(k, s)
  return s
}

// For Batch: the aHours attribute for one mesh about to be merged, read from
// the nearest building group above it (none: kind 0, always lit). The mesh's
// own seed comes from where it sits in its building, so it stays put when the
// town is rebuilt.
const rel = new Matrix4()
const at = new Vector3()
export function addHours(geo: BufferGeometry, mesh: Object3D, root: Object3D, mat: Material) {
  if (!mat.userData.hours) return
  let seed = 0
  let kind = 0
  let w = 0
  for (let p = mesh.parent; p && p !== root; p = p.parent) {
    const h = p.userData.hours as { seed: number; kind: number } | undefined
    if (!h) continue
    seed = h.seed
    kind = h.kind
    at.setFromMatrixPosition(rel.copy(p.matrixWorld).invert().multiply(mesh.matrixWorld))
    w = seedOf(`${at.x.toFixed(2)},${at.y.toFixed(2)},${at.z.toFixed(2)}`)
    break
  }
  const n = geo.getAttribute('position').count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    a[i * 3] = seed
    a[i * 3 + 1] = w
    a[i * 3 + 2] = kind
  }
  geo.setAttribute('aHours', new Float32BufferAttribute(a, 3))
}
