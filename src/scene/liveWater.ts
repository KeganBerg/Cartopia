import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial, Vector2, Vector3, Vector4, type ColorRepresentation, type Scene } from 'three'
import { weatherNow } from '../game/weather'
import { addFog } from './heightFog'
import { skyUniforms } from './weatherLook'

// Water that moves like water: a swell that rolls with the wind, ripples that
// spread out from anything touching the surface (a bird landing, a cast line,
// a fish, a raindrop), V-shaped wakes behind boats and ducks, foam lapping at
// the shore, and the sky's colour on the surface at a glancing angle. One
// material per kind of water; every one of them reads the same ripples and
// wakes, kept in world space, so a duck paddling in a pond leaves its wake in
// that pond and the fisherman's boat rocks on the ripples it makes.
//
// No simulation runs: ripples and wakes are closed-form waves summed in the
// shader, so they cost a few sums per pixel and no extra draws or render
// targets. heightAt() works out the same surface on the CPU so floating things
// ride the waves they see.
//
// Shore foam reads the mesh's uv: a disk (circleGeometry, a cylinder's cap)
// has uv 0.5,0.5 at its centre and the rim at 0.5 out, which survives Batch
// merging. Live materials are kept by identity, so every pond in town still
// shares one merged mesh.

export const MAX_RIPPLES = 16
export const MAX_WAKES = 10
// Ripples run this fast (world units a second), this far apart, and fade over LIFE seconds.
const SPEED = 0.85
const WAVELENGTH = 0.24
const LIFE = 3.6
const K = (Math.PI * 2) / WAVELENGTH

export const waterUniforms = {
  uWT: { value: 0 },
  uRip: { value: Array.from({ length: MAX_RIPPLES }, () => new Vector4()) },
  uRipN: { value: 0 },
  uWake: { value: Array.from({ length: MAX_WAKES }, () => new Vector4()) },
  uWakeN: { value: 0 },
  uRain: { value: 0 },
  uWind: { value: 0 },
  uWindDir: { value: new Vector2(0.8, 0.6) },
  uSky: { value: new Color('#9ecbe8') },
}

// ---- Things touching the water ------------------------------------------------------------

const clock = () => performance.now() / 1000
type Ripple = { x: number; z: number; t0: number; amp: number }
const ripples: Ripple[] = []
// A ring of waves spreading from x, z. amp 1 is a bird landing; 0.3 a raindrop-sized dab.
export function splash(x: number, z: number, amp = 1) {
  ripples.push({ x, z, t0: clock(), amp })
  if (ripples.length > MAX_RIPPLES * 2) ripples.splice(0, ripples.length - MAX_RIPPLES * 2)
}

type Waker = { x: number; z: number; heading: number; size: number; at: number }
const wakers = new Map<string, Waker>()
// Something moving through the water this frame (heading as rotation.y, so
// forward is +z turned by it). size scales the V: 1 is a rowboat, 0.25 a duck.
export function wake(id: string, x: number, z: number, heading: number, size: number) {
  const w = wakers.get(id)
  if (w) Object.assign(w, { x, z, heading, size, at: clock() })
  else wakers.set(id, { x, z, heading, size, at: clock() })
}

// Things afloat that ducks keep clear of, in world space.
export const floaters = new Map<string, { x: number; z: number; r: number }>()

// ---- The surface, on the CPU ---------------------------------------------------------------

// The swell: three long waves, steeper in the wind. Mirrored by SWELL in the shader.
const SWELL: [number, number, number, number][] = [
  // dir x, dir z, wavelength, speed
  [0.8, 0.6, 3.1, 0.9],
  [-0.35, 0.94, 2.3, 0.75],
  [0.97, -0.24, 1.6, 0.6],
]
export const swellAmp = (wind: number) => 0.012 + wind * 0.03
// The swell's height swings this many times its amplitude either way.
const SWELL_SUM = SWELL.reduce((t, [, , len]) => t + len / 3.1, 0)
// A lake's surface only ever rises from where it's laid (half the swell, lifted
// by its trough), so a trough never dips into the banks below it.
export const LIFT = 0.5

// How high the water stands at x, z over where it's laid: the swell, as the lake's
// vertices draw it, plus passing ripples.
export function heightAt(x: number, z: number, t = clock(), wind = waterUniforms.uWind.value) {
  let h = 0
  const a = swellAmp(wind)
  for (const [dx, dz, len, v] of SWELL) h += Math.sin(((dx * x + dz * z) / len) * Math.PI * 2 - t * v * 2.4) * a * (len / 3.1)
  return (h + a * SWELL_SUM) * LIFT + rippleHeight(x, z, t)
}

// Just the passing ripples' part of it.
export function rippleHeight(x: number, z: number, t = clock()) {
  let h = 0
  for (const r of ripples) h += rippleAt(r, x, z, t) * LIFT
  return h
}

function rippleAt(r: Ripple, x: number, z: number, t: number) {
  const age = t - r.t0
  if (age < 0 || age > LIFE) return 0
  const d = Math.hypot(x - r.x, z - r.z)
  const front = age * SPEED
  const u = d - front
  const width = 0.18 + age * 0.22
  if (u > 0.3 || u < -width * 3) return 0
  return r.amp * 0.045 * Math.exp(-age * 1.1) * Math.exp(-((u / width) ** 2)) * Math.sin(K * u) / (1 + d * 1.6)
}

// ---- Once a frame: pack what's live into the uniforms -------------------------------------

let stamp = -1
const sky = new Color()
export function tickWater(scene?: Scene) {
  const t = clock()
  if (t === stamp) return
  stamp = t
  const u = waterUniforms
  u.uWT.value = t
  const w = weatherNow()
  u.uRain.value = w.snow > 0.2 ? 0 : w.rain
  u.uWind.value += (Math.min(1, w.wind) - u.uWind.value) * 0.05
  while (ripples.length && t - ripples[0].t0 > LIFE) ripples.shift()
  const live = ripples.slice(-MAX_RIPPLES)
  live.forEach((r, i) => u.uRip.value[i].set(r.x, r.z, r.t0, r.amp))
  u.uRipN.value = live.length
  let n = 0
  for (const [id, k] of wakers) {
    if (t - k.at > 0.25) {
      wakers.delete(id)
      continue
    }
    if (n < MAX_WAKES) u.uWake.value[n++].set(k.x, k.z, k.heading, k.size)
  }
  u.uWakeN.value = n
  if (scene?.background instanceof Color) u.uSky.value.lerp(sky.copy(scene.background), 0.2)
}

// ---- The shader ------------------------------------------------------------------------------

const PARS = /* glsl */ `
uniform float uWT;
uniform vec4 uRip[${MAX_RIPPLES}];
uniform int uRipN;
uniform vec4 uWake[${MAX_WAKES}];
uniform int uWakeN;
uniform float uRain;
uniform float uWind;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform float uRing;
uniform float uEdge;
varying vec3 vWPos;
varying vec2 vDisk;
float lwHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lwNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lwHash(i), lwHash(i + vec2(1, 0)), f.x), mix(lwHash(i + vec2(0, 1)), lwHash(i + vec2(1, 1)), f.x), f.y);
}
// One travelling wave: adds its height to h.x and slope to h.yz.
void lwWave(inout vec3 h, vec2 p, vec2 dir, float len, float speed, float amp) {
  float k = 6.2831853 / len;
  float ph = dot(dir, p) * k - uWT * speed * 2.4;
  h.x += sin(ph) * amp;
  h.yz += dir * cos(ph) * amp * k;
}
`

const SWELL_GLSL = SWELL.map(([dx, dz, len, v]) => `lwWave(h, p, vec2(${dx.toFixed(3)}, ${dz.toFixed(3)}), ${len.toFixed(2)}, ${v.toFixed(2)}, a * ${(len / 3.1).toFixed(3)});`).join('\n')

const SWELL_FN = /* glsl */ `
vec3 lwSwell(vec2 p) {
  vec3 h = vec3(0.0);
  float a = ${swellAmp(0).toFixed(3)} + uWind * ${(swellAmp(1) - swellAmp(0)).toFixed(3)};
  ${SWELL_GLSL}
  return h;
}
`

// Height and slope (x, then d/dx, d/dz) of everything but the swell, plus foam in w.
const DETAIL_FN = /* glsl */ `
vec4 lwDetail(vec2 p) {
  vec4 h = vec4(0.0);
  // Wind chop: many short waves at odd angles and lengths, their crests bent by a slow warp
  // and their strength drifting in patches, so no two cross into a regular grid.
  vec2 q = p + vec2(sin(p.y * 0.37 + uWT * 0.21) + sin(p.y * 0.83 - p.x * 0.29), sin(p.x * 0.41 - uWT * 0.17) + sin(p.x * 0.71 + p.y * 0.33)) * 0.45;
  float gust = 0.7 + 0.3 * sin(p.x * 0.23 + uWT * 0.11) * sin(p.y * 0.19 - uWT * 0.07) + 0.25 * sin(dot(p, vec2(0.13, -0.17)) + uWT * 0.05);
  float c = (0.006 + uWind * 0.012) * gust;
  vec3 ch = vec3(0.0);
  lwWave(ch, q, vec2(0.6, 0.8), 0.61, 1.3, c * 0.8);
  lwWave(ch, q, vec2(-0.966, 0.259), 0.43, 1.55, c * 0.55);
  lwWave(ch, q, vec2(0.087, -0.996), 0.33, 1.8, c * 0.4);
  lwWave(ch, q, vec2(-0.669, -0.743), 0.79, 1.1, c * 0.75);
  lwWave(ch, q, vec2(0.914, -0.407), 0.53, 1.4, c * 0.5);
  lwWave(ch, q, vec2(-0.208, 0.978), 0.27, 2.0, c * 0.3);
  lwWave(ch, q, vec2(0.829, 0.559), 0.97, 0.95, c * 0.6);
  h.xyz += ch;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    if (i >= uRipN) break;
    vec4 r = uRip[i];
    float age = uWT - r.z;
    vec2 d = p - r.xy;
    float dist = length(d);
    float u = dist - age * ${SPEED.toFixed(2)};
    float width = 0.18 + age * 0.22;
    if (age < 0.0 || u > 0.3 || u < -width * 3.0) continue;
    float env = r.w * 0.045 * exp(-age * 1.1) * exp(-(u * u) / (width * width)) / (1.0 + dist * 1.6);
    float s = sin(${K.toFixed(3)} * u);
    h.x += env * s;
    h.yz += (d / max(dist, 0.001)) * env * cos(${K.toFixed(3)} * u) * ${K.toFixed(3)};
    // A fresh splash churns white where it landed.
    h.w += r.w * smoothstep(0.35, 0.0, age) * smoothstep(0.12 + age * 0.5, 0.0, dist) * 0.9;
    h.w += env * max(s, 0.0) * 9.0 * smoothstep(1.2, 0.2, age);
  }
  for (int i = 0; i < ${MAX_WAKES}; i++) {
    if (i >= uWakeN) break;
    vec4 w = uWake[i];
    vec2 fwd = vec2(sin(w.z), cos(w.z));
    vec2 d = p - w.xy;
    float along = -dot(d, fwd);
    if (along < -0.4 * w.w || along > 5.0 * w.w || dot(d, d) > 30.0 * w.w * w.w) continue;
    vec2 side = vec2(fwd.y, -fwd.x);
    float lat = dot(d, side);
    float back = max(along, 0.0);
    // Kelvin wake: two arms at about 19.5 degrees off the line of travel, fading behind.
    float off = abs(lat) - back * 0.354 - 0.12 * w.w;
    float width = 0.05 * w.w + back * 0.07;
    float arm = exp(-(off * off) / (width * width)) * exp(-back / (1.5 * w.w)) * smoothstep(-0.35 * w.w, 0.05, along);
    // Waves across the wake between the arms, and a bow wave at the front.
    float inside = smoothstep(0.0, -0.08, off) * exp(-back / (1.4 * w.w));
    float tk = 6.2831853 / (0.22 + 0.2 * w.w);
    float tr = sin(back * tk - uWT * 4.0) * inside * 0.35;
    float amp = 0.022 * w.w;
    h.x += (arm * cos(off * 18.0 / w.w) + tr) * amp;
    // Slope: across the arm, and along the line of travel inside it.
    vec2 g = side * sign(lat) * (-2.0 * off / (width * width)) * arm + (-fwd) * cos(back * tk - uWT * 4.0) * tk * inside * 0.35;
    h.yz += g * amp * 0.9;
    // Broken white water along the arms, churned up at the stern.
    float churn = lwNoise(vec2(lat * 9.0 / w.w, (back - uWT * 0.25) * 6.0 / w.w));
    h.w += arm * smoothstep(0.25, 0.85, churn) * 0.7 + inside * 0.12 * churn + smoothstep(0.3 * w.w, 0.0, length(d + fwd * 0.05 * w.w)) * 0.35;
  }
  // Rain: rings opening at random spots, a new one per cell every second or so.
  if (uRain > 0.02) {
    for (int j = 0; j < 2; j++) {
      vec2 q = p * 2.6 + float(j) * 17.3;
      vec2 cell = floor(q);
      vec2 f = fract(q) - 0.5;
      float rnd = lwHash(cell + float(j) * 3.1);
      if (rnd > uRain * 1.2) continue;
      vec2 o = vec2(lwHash(cell + 1.7), lwHash(cell + 9.2)) - 0.5;
      float ph = fract(uWT * (0.8 + rnd) + rnd * 7.0);
      vec2 d = f - o * 0.5;
      float dist = length(d);
      float u = dist - ph * 0.45;
      float env = (1.0 - ph) * exp(-u * u * 300.0) * 0.012;
      h.x += env * sin(u * 60.0);
      h.yz += d / max(dist, 0.001) * env * cos(u * 60.0) * 60.0 * 2.6;
    }
  }
  return h;
}
`

export type WaterLook = {
  deep: ColorRepresentation
  shallow: ColorRepresentation
  foam?: ColorRepresentation
  // Move the vertices too (a mesh with enough of them: the lake).
  verts?: boolean
  // A fountain's spill: rings run out from this distance (in disk radii) all the time.
  ring?: number
  // Shore foam and the shallow edge (off for a bowl with a lip all round).
  shore?: boolean
  // Where the shore foam starts, in disk radii (a big lake's band is thinner).
  edge?: number
}

export function liveWater(look: WaterLook) {
  const m = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.14, metalness: 0.02 })
  m.userData.live = true
  const own = {
    uDeep: { value: new Color(look.deep) },
    uShallow: { value: new Color(look.shallow) },
    uFoam: { value: new Color(look.foam ?? '#f4fbff') },
    uRing: { value: look.ring ?? 0 },
    uEdge: { value: look.edge ?? 0.9 },
  }
  const defines = `${look.verts ? '#define LW_VERTS\n' : ''}${look.ring ? '#define LW_RING\n' : ''}${look.shore === false ? '' : '#define LW_SHORE\n'}`
  m.onBeforeCompile = (sh) => {
    addFog(sh)
    Object.assign(sh.uniforms, waterUniforms, own, { uSunDir: skyUniforms.uSunDir })
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${defines}${PARS}${SWELL_FN}`)
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
      vDisk = uv - 0.5;
      #ifdef LW_VERTS
        vec3 lwW = (modelMatrix * vec4(position, 1.0)).xyz;
        // Calm at the very edge, so the water never climbs the bank.
        float lwA = ${swellAmp(0).toFixed(3)} + uWind * ${(swellAmp(1) - swellAmp(0)).toFixed(3)};
        transformed.y += (lwSwell(lwW.xz).x + lwA * ${SWELL_SUM.toFixed(3)}) * ${LIFT.toFixed(2)} * smoothstep(1.0, 0.85, length(uv - 0.5) * 2.0);
      #endif`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${defines}${PARS}${SWELL_FN}${DETAIL_FN}`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
      vec2 lwP = vWPos.xz;
      vec3 lwS = lwSwell(lwP);
      vec4 lwD = lwDetail(lwP);
      vec2 lwSlope = lwS.yz + lwD.yz;
      float lwFoam = clamp(lwD.w, 0.0, 1.0);
      // How far out from the middle, 0 at the centre and 1 at the rim.
      float lwE = length(vDisk) * 2.0;
      #ifdef LW_RING
        // Water falling from the bowl lands on a ring and pushes rings out across the pool.
        float lwR = abs(lwE - uRing);
        float lwPh = lwR * 26.0 - uWT * 7.0;
        float lwFall = exp(-lwR * 5.0);
        vec2 lwGe = vec2(dFdx(lwE), dFdy(lwE));
        mat2 lwJ = mat2(dFdx(lwP), dFdy(lwP));
        vec2 lwGw = inverse(transpose(lwJ)) * lwGe;
        lwSlope += lwGw * sign(lwE - uRing) * cos(lwPh) * 26.0 * lwFall * 0.008;
        lwFoam = max(lwFoam, smoothstep(0.1, 0.0, lwR) * (0.55 + 0.45 * lwNoise(lwP * 30.0 + uWT * 6.0)));
      #endif
      float lwDepth = 1.0;
      #ifdef LW_SHORE
        lwDepth = smoothstep(1.0, 0.45, lwE);
        // Foam lapping the shore: a band that runs up and slides back.
        float lwLap = sin(uWT * 1.4 + lwNoise(lwP * 0.7) * 6.0) * 0.025;
        float lwEdge = smoothstep(uEdge, uEdge + (1.0 - uEdge) * 0.85, lwE + lwLap + (lwNoise(lwP * 3.0 + uWT * 0.3) - 0.5) * 0.05);
        lwFoam = max(lwFoam, lwEdge * (0.65 + 0.35 * lwNoise(lwP * 9.0 - uWT * 0.5)));
      #endif
      vec3 lwBody = mix(uShallow, uDeep, lwDepth);
      // Light catching the faces of the waves.
      lwBody *= 1.0 + dot(lwSlope, vec2(0.6, 0.45)) * 0.45;
      diffuseColor.rgb = mix(lwBody, uFoam, lwFoam * 0.9);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.07 + uWind * 0.08, 0.7, lwFoam);')
      .replace('#include <normal_fragment_begin>', /* glsl */ `#include <normal_fragment_begin>
      vec3 lwN = normalize(vec3(-lwSlope.x, 1.0, -lwSlope.y));
      normal = normalize((viewMatrix * vec4(lwN, 0.0)).xyz);`)
      .replace('#include <opaque_fragment>', /* glsl */ `
      // The sky on the water at a glancing angle, and the sun glittering off the wave tops.
      // The bird's-eye view is orthographic: every ray runs along the camera's own axis.
      vec3 lwV = isOrthographic ? normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2])) : normalize(cameraPosition - vWPos);
      float lwF = 0.06 + 0.6 * pow(1.0 - max(dot(lwN, lwV), 0.0), 4.0);
      outgoingLight = mix(outgoingLight, uSky * 0.95, lwF * (1.0 - lwFoam));
      vec3 lwR2 = reflect(-lwV, lwN);
      // Only by day: the sky's own brightness says how much sun there is to glitter.
      float lwSun = pow(max(dot(lwR2, normalize(uSunDir)), 0.0), 380.0) * smoothstep(0.0, 0.2, uSunDir.y) * smoothstep(0.12, 0.45, dot(uSky, vec3(0.3, 0.59, 0.11)));
      outgoingLight += vec3(1.0, 0.96, 0.85) * lwSun * 2.2 * (1.0 - lwFoam);
      #include <opaque_fragment>`)
  }
  // Whichever canvas draws water first in a frame brings the ripples up to date.
  m.onBeforeRender = (_r, scene) => tickWater(scene)
  m.customProgramCacheKey = () => `live-water-${defines.replace(/\W+/g, '')}`
  return m
}

// The kinds of water in town, made once each and shared by every building, so a
// Batch keeps all of one kind in one merged mesh.
let kinds: ReturnType<typeof makeKinds> | null = null
function makeKinds() {
  return {
    pond: liveWater({ deep: '#2b8fc4', shallow: '#62c6e8', edge: 0.95 }),
    koi: liveWater({ deep: '#1f6f7c', shallow: '#3fa5a8', edge: 0.95 }),
    basin: liveWater({ deep: '#3aa6d8', shallow: '#7fd3f2', ring: 0.82, shore: false }),
    bowl: liveWater({ deep: '#5bbbe6', shallow: '#9ee0f7', ring: 0.05, shore: false }),
  }
}
export const waterKinds = () => (kinds ??= makeKinds())

// Water pouring down (a fountain's spill): streaks running down the stream.
// A cylinder's uv.y runs bottom to top, so the pattern slides towards 0.
let falling: MeshStandardMaterial | null = null
export function fallingWater() {
  if (falling) return falling
  const m = (falling = new MeshStandardMaterial({ color: '#b3e5fc', roughness: 0.1, metalness: 0.05 }))
  m.userData.live = true
  m.onBeforeCompile = (sh) => {
    addFog(sh)
    sh.uniforms.uWT = waterUniforms.uWT
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFall;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFall = uv;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWT;\nvarying vec2 vFall;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      float fs = sin((vFall.y * 3.0 + uWT * 2.6 + sin(vFall.x * 18.85) * 0.15) * 6.2831853);
      diffuseColor.rgb *= 0.85 + 0.3 * smoothstep(0.2, 1.0, fs);`)
  }
  m.onBeforeRender = (_r, scene) => tickWater(scene)
  m.customProgramCacheKey = () => 'falling-water'
  return m
}

// A flat elliptical disk in the xz plane with rings of vertices inside (for
// waves that move the surface) and uv like circleGeometry's.
export function diskGeometry(rx: number, rz: number, rings = 18, segs = 72) {
  const pos: number[] = [0, 0, 0]
  const uv: number[] = [0.5, 0.5]
  const idx: number[] = []
  for (let r = 1; r <= rings; r++) {
    const f = r / rings
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2
      pos.push(Math.cos(a) * rx * f, 0, Math.sin(a) * rz * f)
      uv.push(0.5 + Math.cos(a) * f * 0.5, 0.5 + Math.sin(a) * f * 0.5)
    }
  }
  const at = (r: number, s: number) => (r === 0 ? 0 : 1 + (r - 1) * segs + (s % segs))
  for (let s = 0; s < segs; s++) idx.push(0, at(1, s + 1), at(1, s))
  for (let r = 1; r < rings; r++)
    for (let s = 0; s < segs; s++) {
      const a = at(r, s), b = at(r, s + 1), c = at(r + 1, s), d = at(r + 1, s + 1)
      idx.push(a, b, d, a, d, c)
    }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('normal', new BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  g.setIndex(idx)
  return g
}

// Buoyancy: where a floating thing of this length and beam sits on the surface
// right now, its pitch (nose up) and roll. Used for the boat and the ducks.
const tilt = new Vector3()
export function floatOn(x: number, z: number, heading: number, len: number, beam: number, t = clock()) {
  const fx = Math.sin(heading), fz = Math.cos(heading)
  const bow = heightAt(x + fx * len / 2, z + fz * len / 2, t)
  const stern = heightAt(x - fx * len / 2, z - fz * len / 2, t)
  const port = heightAt(x - fz * beam / 2, z + fx * beam / 2, t)
  const star = heightAt(x + fz * beam / 2, z - fx * beam / 2, t)
  return tilt.set((bow + stern + port + star) / 4, Math.atan2(stern - bow, len), Math.atan2(port - star, beam))
}
