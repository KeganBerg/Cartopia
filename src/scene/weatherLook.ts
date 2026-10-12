import { Color, MeshStandardMaterial, Vector2, Vector3, type ColorRepresentation, type Texture, type WebGLProgramParametersWithUniforms } from 'three'
import type { Weather } from '../game/weather'
import type { Look } from './look'
import { asphaltTex } from './textures'
import { addFog } from './heightFog'

// How weather changes the light and the ground. Kept apart from the weather
// schedule (game/weather.ts) so that stays plain data the sound code can read.

// Wet ground and lying snow, shared by every material that shows them. Each
// canvas sets these before it draws (see Weather.tsx).
export const groundUniforms = { uWet: { value: 0 }, uCover: { value: 0 } }
// Sun glinting off drying roads and a heat mirage on summer scorchers (set by
// Atmosphere.tsx from skyFx.ts).
// Cloud shadows: how dark, how far they've drifted, and the sun they're cast from.
export const skyUniforms = {
  uTime: { value: 0 }, uGlint: { value: 0 }, uHeat: { value: 0 },
  uCloudShade: { value: 0 }, uCloudDrift: { value: new Vector2() }, uSunDir: { value: new Vector3(0, 1, 0) },
}

const grey = new Color()
const tmp = new Color()
const flashSky = new Color('#dfe6ff')
const cool = new Color(-0.007, 0, 0.012)
const dustSun = new Color('#ffb070')
const heatSun = new Color('#fff1d0')

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
  // A scorcher: hot white light, warm highlights and a touch of shimmer haze.
  if (w.mix.heat > 0) {
    const h = w.mix.heat
    look.sun.lerp(heatSun, 0.35 * h)
    look.sunIntensity *= 1 + 0.08 * h
    look.grade.exposure *= 1 + 0.05 * h
    look.grade.saturation *= 1 - 0.06 * h
    look.grade.highlights.add(tmp.setRGB(0.035, 0.018, -0.02).multiplyScalar(h))
    look.grade.shadows.add(tmp.setRGB(0.012, 0.004, -0.008).multiplyScalar(h))
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
const HAZE_DAY = new Color('#cacbd2')
const HAZE_SNOW = new Color('#eef2f7')
const HAZE_NIGHT = new Color('#201f3a')
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
uniform float uTime;
uniform float uGlint;
uniform float uHeat;
uniform float uCloudShade;
uniform vec2 uCloudDrift;
uniform vec3 uSunDir;
varying vec3 vWPos;
varying float vUp;
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y);
}
// The shadow of a sheet of broken cloud 16 units up, cast along the sun.
float cloudShadow() {
  if (uCloudShade < 0.005) return 0.0;
  vec2 p = vWPos.xz + uSunDir.xz / max(uSunDir.y, 0.3) * (16.0 - vWPos.y);
  p = p * 0.075 + uCloudDrift;
  float n = wNoise(p) * 0.6 + wNoise(p * 2.1 + 4.7) * 0.28 + wNoise(p * 4.7 - 2.3) * 0.12;
  return smoothstep(0.48, 0.66, n) * uCloudShade;
}
`

function hook(sh: WebGLProgramParametersWithUniforms) {
  addFog(sh)
  sh.uniforms.uWet = groundUniforms.uWet
  sh.uniforms.uCover = groundUniforms.uCover
  sh.uniforms.uTime = skyUniforms.uTime
  sh.uniforms.uGlint = skyUniforms.uGlint
  sh.uniforms.uHeat = skyUniforms.uHeat
  sh.uniforms.uCloudShade = skyUniforms.uCloudShade
  sh.uniforms.uCloudDrift = skyUniforms.uCloudDrift
  sh.uniforms.uSunDir = skyUniforms.uSunDir
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
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.82, 0.86), slush * 0.85);
      // Heat mirage: shimmering pools of sky that slide along the hot asphalt.
      float mirage = 0.0;
      if (uHeat > 0.01) {
        float wob = sin(vWPos.x * 5.0 + vWPos.z * 3.0 + uTime * 3.2 + wNoise(vWPos.xz * 2.2) * 6.0) * 0.5 + 0.5;
        mirage = smoothstep(0.52, 0.74, wNoise(vWPos.xz * 0.32 + vec2(uTime * 0.12, uTime * 0.05))) * uHeat * (0.5 + 0.5 * wob);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.8, 0.9), mirage * 0.6);
      }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.32, uWet * (1.0 - slush));
      roughnessFactor = mix(roughnessFactor, 0.04, puddle * (1.0 - slush));
      roughnessFactor = mix(roughnessFactor, 0.2, mirage);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      // The sun glinting off a drying road: tiny sparkles that wink on and off.
      if (uGlint > 0.01) {
        vec2 cell = floor(vWPos.xz * 11.0);
        float g = wHash(cell);
        float wink = pow(sin(uTime * (1.5 + g * 4.0) + g * 60.0) * 0.5 + 0.5, 8.0);
        float spark = step(0.965, g) * wink * uGlint * (0.35 + puddle) * (1.0 - slush);
        totalEmissiveRadiance += vec3(1.0, 0.95, 0.82) * spark * 3.0;
      }`)
      .replace('#include <opaque_fragment>', 'outgoingLight *= 1.0 - cloudShadow();\n#include <opaque_fragment>')
  }
  m.customProgramCacheKey = () => 'wet-road-2'
  return m
}

// Plain ground (the meadows round the lot) that drifting cloud shadows pass over.
export function cloudyGround(map: Texture) {
  const m = new MeshStandardMaterial({ map })
  m.userData.live = true
  m.onBeforeCompile = (sh) => {
    hook(sh)
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight *= 1.0 - cloudShadow();\n#include <opaque_fragment>')
  }
  m.customProgramCacheKey = () => 'cloudy-ground'
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
    // Drifting cloud shadows dim the sunlit parts (unlit ones keep their flat colour).
    .replace('#include <opaque_fragment>', 'outgoingLight *= 1.0 - cloudShadow() * (1.0 - vLook.z);\n#include <opaque_fragment>')
}
