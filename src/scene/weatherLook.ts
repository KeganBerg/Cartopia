import { Color, MeshStandardMaterial, type ColorRepresentation, type Texture, type WebGLProgramParametersWithUniforms } from 'three'
import type { Weather } from '../game/weather'
import type { Look } from './look'
import { asphaltTex } from './textures'

// How weather changes the light and the ground. Kept apart from the weather
// schedule (game/weather.ts) so that stays plain data the sound code can read.

// Wet ground and lying snow, shared by every material that shows them. Each
// canvas sets these before it draws (see Weather.tsx).
export const groundUniforms = { uWet: { value: 0 }, uCover: { value: 0 } }

const grey = new Color()
const tmp = new Color()
const flashSky = new Color('#dfe6ff')
const cool = new Color(-0.01, 0, 0.018)
const dustSun = new Color('#ffb070')

function desaturate(c: Color, amount: number) {
  const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722
  c.lerp(grey.setScalar(l), amount)
}

// Overcast, storm-dark, misty or snow-bright: nudge the time-of-day look in place.
export function weatherLook(look: Look, w: Weather) {
  const c = w.cloud
  if (c > 0) {
    look.sunIntensity *= 1 - 0.72 * c
    desaturate(look.sun, 0.7 * c)
    desaturate(look.sky, 0.6 * c)
    // Light comes from the whole sky under cloud, so the fill rises as the sun fades.
    look.hemiIntensity *= 1 - 0.1 * c
    const g = look.grade
    g.saturation *= 1 - 0.35 * c
    g.contrast -= 0.05 * c
    g.exposure *= 1 - 0.22 * c
    g.vignette += 0.1 * c
    g.highlights.add(tmp.copy(cool).multiplyScalar(c))
    g.shadows.add(tmp.copy(cool).multiplyScalar(c * 0.6))
    g.bloom *= 1 + 0.3 * c // lamps and headlights glow in the gloom
  }
  if (w.haze > 0) look.grade.contrast -= 0.1 * w.haze
  // A dust storm turns the light a hazy orange.
  if (w.dust > 0) {
    look.sun.lerp(dustSun, 0.5 * w.dust)
    look.grade.highlights.add(tmp.setRGB(0.04, 0.015, -0.035).multiplyScalar(w.dust))
    look.grade.shadows.add(tmp.setRGB(0.02, 0.008, -0.02).multiplyScalar(w.dust))
  }
  // Snow on the ground lights everything from below, so snowy days stay bright.
  if (w.snow > 0) {
    look.hemiIntensity *= 1 + 0.3 * w.snow
    look.grade.exposure *= 1 + 0.16 * w.snow
  }
  if (w.flash > 0) {
    look.hemiIntensity += 2.6 * w.flash
    look.sky.lerp(flashSky, Math.min(1, w.flash))
    look.grade.exposure += 0.3 * w.flash
  }
  return look
}

// How much lamps and headlights come on in daytime gloom (0..1).
export const gloomOf = (w: Weather) => Math.min(1, Math.max(0, (w.cloud - 0.45) / 0.45) + w.haze * 0.5)

// The haze colour that fog fades into: pale grey by day, whiter in snow, deep blue at night.
const HAZE_DAY = new Color('#c4ccd6')
const HAZE_SNOW = new Color('#eef2f7')
const HAZE_NIGHT = new Color('#1c2438')
const HAZE_DUST = new Color('#d6b48c')
export function hazeColor(out: Color, w: Weather, night: number) {
  return out.copy(HAZE_DAY).lerp(HAZE_SNOW, w.snow > 0 ? Math.min(1, w.snow * 1.5) : 0).lerp(HAZE_DUST, Math.min(1, w.dust * 1.2)).lerp(HAZE_NIGHT, night)
}

// Shader bits shared by the ground materials.
const WORLD_POS_VERT = (s: string) => s
  .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying float vUp;')
  .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvUp = normalize(mat3(modelMatrix) * objectNormal).y;')

const NOISE = /* glsl */ `
uniform float uWet;
uniform float uCover;
varying vec3 vWPos;
varying float vUp;
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y);
}
`

function hook(sh: WebGLProgramParametersWithUniforms) {
  sh.uniforms.uWet = groundUniforms.uWet
  sh.uniforms.uCover = groundUniforms.uCover
  sh.vertexShader = WORLD_POS_VERT(sh.vertexShader)
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + NOISE)
}

// Road asphalt that goes dark and glossy in the rain, with puddles in the dips,
// and gathers grey slush when it snows. Marked live so Batch keeps it by identity.
export function wetRoad(map: Texture, color: ColorRepresentation = '#ffffff') {
  const m = new MeshStandardMaterial({ map, color })
  m.userData.live = true
  m.onBeforeCompile = (sh) => {
    hook(sh)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
      float puddle = smoothstep(0.62, 0.72, wNoise(vWPos.xz * 0.55) * 0.75 + wNoise(vWPos.xz * 2.1) * 0.25) * smoothstep(0.35, 0.9, uWet);
      diffuseColor.rgb *= 1.0 - 0.32 * uWet;
      // Puddles mirror the grey sky.
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.42, 0.5), puddle * 0.55);
      float slush = uCover * smoothstep(0.25, 0.7, wNoise(vWPos.xz * 1.3) * 0.6 + uCover * 0.5);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.82, 0.86), slush * 0.85);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.32, uWet * (1.0 - slush));
      roughnessFactor = mix(roughnessFactor, 0.04, puddle * (1.0 - slush));`)
  }
  m.customProgramCacheKey = () => 'wet-road'
  return m
}

// The town's roads all share one, so they change together.
let road: MeshStandardMaterial | null = null
export const roadMat = () => (road ??= wetRoad(asphaltTex()))

// Wet sheen and settled snow for the baked town material (bake.ts): anything
// facing up gets a glossy film in rain and a white coat in snow. Runs after
// bakedMaterial's own edits, which it builds on.
export function weatherBaked(sh: WebGLProgramParametersWithUniforms) {
  hook(sh)
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
    float up = smoothstep(0.55, 0.9, vUp);
    float snowy = uCover * up * (1.0 - vLook.z) * smoothstep(0.2, 0.55, wNoise(vWPos.xz * 2.3) * 0.5 + uCover * 0.6);
    diffuseColor.rgb *= 1.0 - 0.12 * uWet * up;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), snowy);`)
    .replace('float roughnessFactor = vLook.y;', 'float roughnessFactor = mix(vLook.y, vLook.y * 0.45, uWet * up * (1.0 - snowy));\nroughnessFactor = mix(roughnessFactor, 0.9, snowy);')
}
