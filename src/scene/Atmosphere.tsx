import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending, BufferAttribute, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, Object3D, OrthographicCamera,
  ShaderMaterial, Vector2, Vector3,
} from 'three'
import { weatherNow } from '../game/weather'
import { dayPhase, nightAmount } from './dayNight'
import { lightDir, townLook } from './look'
import { hazeColor, skyUniforms } from './weatherLook'
import { frameFor, type Frame } from './Weather'
import { isFree } from './freeCam'
import { sky, skyFx } from './skyFx'
import { haloSpots, haloVersion } from './halos'

// The air over town: fog rolling along the ground, shafts of sun, a rainbow
// after a shower and lamps haloed in the damp. Each is one instanced draw, and
// draws nothing at all while it's not needed.


const NOISE = /* glsl */ `
float aHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float aNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(aHash(i), aHash(i + vec2(1, 0)), f.x), mix(aHash(i + vec2(0, 1)), aHash(i + vec2(1, 1)), f.x), f.y);
}
`

// ---------- Ground fog ----------
// A stack of thin see-through sheets from the ground up, each with the same
// drifting banks of noise. Seen from above they add up to fog with depth:
// streets and lawns sink into it while roofs and towers stand clear.
const FOG_VERT = /* glsl */ `
attribute float aLayer;
uniform vec3 uCenter;
uniform float uSpan;
uniform float uTop;
varying vec3 vWorld;
varying float vLayer;
void main() {
  vLayer = aLayer;
  vec3 p = vec3(uCenter.x + position.x * uSpan, 0.04 + aLayer * aLayer * uTop, uCenter.z + position.y * uSpan);
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`
const FOG_FRAG = /* glsl */ `
uniform vec3 uCenter;
uniform float uSpan;
uniform float uDensity;
uniform float uOpacity;
uniform vec2 uDrift;
uniform vec3 uShade;
uniform vec3 uLit;
varying vec3 vWorld;
varying float vLayer;
${NOISE}
void main() {
  vec2 p = vWorld.xz;
  // Big slow banks, and wisps curling through them a little faster.
  float big = aNoise(p * 0.09 + uDrift) * 0.62 + aNoise(p * 0.23 - uDrift * 1.3 + 7.0) * 0.38;
  float wisp = aNoise(p * 0.5 + uDrift * 2.6 + vLayer * 2.3);
  float n = big * 0.82 + wisp * 0.18;
  float bank = smoothstep(0.66 - uDensity * 0.3, 0.86 - uDensity * 0.22, n + (1.0 - vLayer) * 0.1);
  // Thick at the ground, thinning towards the top of the stack.
  float h = 1.0 - vLayer;
  float a = bank * (0.2 + 0.8 * h * h) * uOpacity;
  vec2 e = abs(p - uCenter.xz) / (0.5 * uSpan);
  a *= 1.0 - smoothstep(0.8, 1.0, max(e.x, e.y));
  vec3 c = mix(uShade, uLit, clamp(vLayer * 0.7 + wisp * 0.45, 0.0, 1.0));
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}
`

const WHITE = new Color('#ffffff')
const MOONLIT = new Color('#5a6690')
function GroundFog({ layers }: { layers: number }) {
  const camera = useThree((s) => s.camera)
  const mesh = useMemo(() => {
    const g = new InstancedBufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3))
    g.setIndex([0, 2, 1, 0, 3, 2])
    g.setAttribute('aLayer', new InstancedBufferAttribute(Float32Array.from({ length: layers }, (_, i) => i / (layers - 1)), 1))
    g.instanceCount = layers
    const m = new ShaderMaterial({
      vertexShader: FOG_VERT, fragmentShader: FOG_FRAG, transparent: true, depthWrite: false, side: DoubleSide,
      uniforms: {
        uCenter: { value: new Vector3() }, uSpan: { value: 60 }, uTop: { value: 2 }, uDensity: { value: 0 }, uOpacity: { value: 0 },
        uDrift: { value: new Vector2() }, uShade: { value: new Color() }, uLit: { value: new Color() },
      },
    })
    const mesh = new Mesh(g, m)
    mesh.frustumCulled = false
    mesh.raycast = () => {}
    mesh.renderOrder = 3
    mesh.visible = false
    return mesh
  }, [layers])
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as ShaderMaterial).dispose() }, [mesh])
  const frame = useMemo<Frame>(() => ({ center: new Vector3(), span: 60, top: 22, px: 0.03 }), [])
  useFrame((_, dt) => {
    const b = sky.banks
    mesh.visible = b > 0.01
    if (!mesh.visible) return
    const w = weatherNow()
    frameFor(camera, frame, false)
    const u = (mesh.material as ShaderMaterial).uniforms
    u.uCenter.value.copy(frame.center)
    u.uSpan.value = Math.min(frame.span * 1.4, 160)
    // Mist lies knee-high; real fog reaches the eaves.
    u.uTop.value = 0.7 + 1.9 * (1 - sky.low) * b
    u.uDensity.value = b
    u.uOpacity.value = Math.min(1, b * 1.6) * (10 / layers) * 0.3
    // The fog drifts slowly with the breeze.
    const step = Math.min(dt, 0.1) * (0.012 + w.wind * 0.04)
    u.uDrift.value.x += step
    u.uDrift.value.y += step * 0.45
    const night = nightAmount(dayPhase())
    hazeColor(u.uShade.value, w, night)
    // The tops of the banks catch the light: warm in low sun, silver by moonlight.
    u.uLit.value.copy(u.uShade.value).lerp(WHITE, 0.55 * (1 - night)).lerp(townLook.sun, 0.15 * (1 - night))
    if (night > 0) u.uLit.value.lerp(MOONLIT, 0.5 * night)
    u.uShade.value.multiplyScalar(0.92)
  })
  return <primitive object={mesh} />
}

// ---------- Sun shafts ----------
// Shafts of light fanning across the view from the side the sun is on, slowly
// shifting, like sun streaming through gaps in cloud or a thinning fog. Drawn
// over the whole view in one pass: they hang in the air between the camera and
// the town.
const RAY_VERT = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`
const RAY_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uAspect;
uniform vec2 uSrc;
varying vec2 vNdc;
${NOISE}
void main() {
  vec2 p = vec2(vNdc.x * uAspect, vNdc.y);
  vec2 d = p - uSrc;
  float r = length(d);
  // Angle measured from the line through the middle of the view, so the seam
  // where the angle wraps round stays off screen.
  vec2 axis = normalize(-uSrc);
  float a = atan(axis.x * d.y - axis.y * d.x, dot(axis, d));
  float n = aNoise(vec2(a * 14.0 + uTime * 0.02, uTime * 0.04)) * 0.6 + aNoise(vec2(a * 41.0 - uTime * 0.03, 5.0 + uTime * 0.05)) * 0.4;
  float ray = smoothstep(0.36, 0.8, n);
  // A tall narrow (phone) view is close to the source all across, so fade faster there.
  float rr = r / min(1.0, uAspect);
  float reach = 1.0 / (1.0 + rr * rr * 0.12);
  float glow = exp(-rr * 0.9);
  gl_FragColor = vec4(uColor, (ray * reach + glow * 0.22) * uOpacity);
  #include <colorspace_fragment>
}
`

const SUN_WARM = new Color('#ffd49a')
const MOON_BEAM = new Color('#9fb6e0')
function SunShafts() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const mesh = useMemo(() => {
    const g = new InstancedBufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.instanceCount = 1
    const m = new ShaderMaterial({
      vertexShader: RAY_VERT, fragmentShader: RAY_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uSrc: { value: new Vector2() }, uColor: { value: new Color() }, uOpacity: { value: 0 } },
    })
    const mesh = new Mesh(g, m)
    mesh.frustumCulled = false
    mesh.raycast = () => {}
    mesh.renderOrder = 8
    mesh.visible = false
    return mesh
  }, [])
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as ShaderMaterial).dispose() }, [mesh])
  const dir = useMemo(() => new Vector3(), [])
  useFrame(({ clock }) => {
    const sun = sky.rays
    const moon = sky.moon
    let o = Math.max(sun, moon)
    mesh.visible = o > 0.01
    if (!mesh.visible) return
    const u = (mesh.material as ShaderMaterial).uniforms
    const phase = dayPhase()
    lightDir(phase, nightAmount(phase), dir)
    // Where the sun sits relative to the view: the shafts fan out from just off that edge.
    dir.transformDirection(camera.matrixWorldInverse)
    const aspect = size.width / Math.max(1, size.height)
    const flat = Math.hypot(dir.x, dir.y)
    // In the free view the sun has to be somewhere ahead to stream into the view.
    if (isFree(camera)) o *= Math.min(1, Math.max(0, (-dir.z + 0.2) / 0.5))
    else o *= Math.min(1, flat / 0.25)
    const k = 1 / Math.max(0.001, flat)
    // Pushed out past the edge of the view in the sun's direction.
    const edge = Math.min(aspect / Math.max(0.001, Math.abs(dir.x * k)), 1 / Math.max(0.001, Math.abs(dir.y * k)))
    u.uSrc.value.set(dir.x * k, dir.y * k).multiplyScalar(edge * 1.08)
    u.uAspect.value = aspect
    u.uTime.value = clock.elapsedTime
    if (sun >= moon) u.uColor.value.copy(townLook.sun).lerp(SUN_WARM, 0.6)
    else u.uColor.value.copy(MOON_BEAM)
    // Shafts show best through fog and mist.
    u.uOpacity.value = o * (0.36 + 0.1 * sky.banks)
  })
  return <primitive object={mesh} />
}

// ---------- Rainbow ----------
// A bow over the town once a shower passes and the sun comes out. Seen from
// above it arches across the top of the screen; in the free view it stands far
// off, opposite the sun.
const BOW_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const BOW_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec2 vP;
vec3 hue(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}
void main() {
  float r = length(vP);
  // Red on the outside to violet inside, and a faint second bow outside it, the other way round.
  float b1 = (0.96 - r) / 0.1;
  float b2 = (r - 1.1) / 0.09;
  float a = 0.0;
  vec3 c = vec3(0.0);
  if (b1 > 0.0 && b1 < 1.0) { c = hue(b1 * 0.78); a = sin(b1 * 3.14159); }
  else if (b2 > 0.0 && b2 < 1.0) { c = hue(b2 * 0.78); a = 0.35 * sin(b2 * 3.14159); }
  // Lighter inside the bow, as real ones are.
  float inside = smoothstep(0.96, 0.6, r) * 0.08;
  // Fades out towards the ground at both ends.
  float ends = smoothstep(0.0, 0.45, vP.y / max(r, 0.001));
  gl_FragColor = vec4(c * a + vec3(inside), 1.0) * uOpacity * ends;
  #include <colorspace_fragment>
}
`

function Rainbow() {
  const camera = useThree((s) => s.camera)
  const mesh = useMemo(() => {
    const g = new InstancedBufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array([-1.25, 0, 0, 1.25, 0, 0, 1.25, 1.25, 0, -1.25, 1.25, 0]), 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.instanceCount = 1
    const m = new ShaderMaterial({
      vertexShader: BOW_VERT, fragmentShader: BOW_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
      uniforms: { uOpacity: { value: 0 } },
    })
    const mesh = new Mesh(g, m)
    mesh.frustumCulled = false
    mesh.raycast = () => {}
    mesh.renderOrder = 7
    mesh.visible = false
    return mesh
  }, [])
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as ShaderMaterial).dispose() }, [mesh])
  const frame = useMemo<Frame>(() => ({ center: new Vector3(), span: 60, top: 22, px: 0.03 }), [])
  const up = useMemo(() => new Vector3(), [])
  const away = useMemo(() => new Vector3(), [])
  useFrame(() => {
    const o = sky.rainbow
    mesh.visible = o > 0.01
    if (!mesh.visible) return
    const mat = mesh.material as ShaderMaterial
    if (isFree(camera)) {
      // Stands far off on the side away from the sun.
      const phase = dayPhase()
      lightDir(phase, nightAmount(phase), away).setY(0).normalize().negate()
      mesh.position.copy(camera.position).addScaledVector(away, 160).setY(-12)
      mesh.scale.setScalar(110)
      mesh.lookAt(camera.position.x, -12, camera.position.z)
      mat.depthTest = true
      mat.uniforms.uOpacity.value = o * 0.32
      return
    }
    // From above: in the air between the camera and the town, arching over the top of the screen.
    frameFor(camera, frame, false)
    const cam = camera as OrthographicCamera
    const h = (cam.top - cam.bottom) / cam.zoom
    const w = (cam.right - cam.left) / cam.zoom
    up.set(0, 1, 0).applyQuaternion(cam.quaternion)
    // Its top sits in the upper part of the view, both feet in sight.
    const r = Math.min(w * 0.4, h * 0.75)
    mesh.quaternion.copy(cam.quaternion)
    mesh.position.copy(frame.center).addScaledVector(up, h * 0.3 - r * 0.96)
    // Pulled towards the camera so it hangs in the air over the roofs.
    mesh.position.addScaledVector(cam.getWorldDirection(away), -40)
    mesh.scale.setScalar(r)
    mat.depthTest = false
    mat.uniforms.uOpacity.value = o * 0.55
  })
  return <primitive object={mesh} />
}

// ---------- Lamp halos ----------
const HALO_VERT = /* glsl */ `
attribute vec4 aSpot;
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = position.xy * 2.0;
  vec4 mv = viewMatrix * vec4(aSpot.xyz, 1.0);
  mv.xy += position.xy * uSize * aSpot.w;
  // Nudged towards the camera so the lamp's own head doesn't cut it in half.
  mv.z += 0.6;
  gl_Position = projectionMatrix * mv;
}
`
const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv);
  float a = exp(-d * d * 5.0) * 0.8 + exp(-d * d * 28.0) * 0.6;
  a *= 1.0 - smoothstep(0.85, 1.0, d);
  gl_FragColor = vec4(uColor, a * uOpacity);
  #include <colorspace_fragment>
}
`
const MAX_HALOS = 512
const LAMP = new Color('#ffc978')
function LampHalos() {
  const scene = useThree((s) => s.scene)
  const mesh = useMemo(() => {
    const g = new InstancedBufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.setAttribute('aSpot', new InstancedBufferAttribute(new Float32Array(MAX_HALOS * 4), 4))
    g.instanceCount = 0
    const m = new ShaderMaterial({
      vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { uSize: { value: 1 }, uColor: { value: LAMP.clone() }, uOpacity: { value: 0 } },
    })
    const mesh = new Mesh(g, m)
    mesh.frustumCulled = false
    mesh.raycast = () => {}
    mesh.renderOrder = 6
    mesh.visible = false
    return mesh
  }, [])
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as ShaderMaterial).dispose() }, [mesh])
  const seen = useRef({ version: -1, at: 0 })
  const tmp = useMemo(() => new Vector3(), [])
  useFrame(({ clock }) => {
    const o = sky.halo
    mesh.visible = o > 0.01 && mesh.geometry.instanceCount > 0
    const s = seen.current
    // Lamps come and go with the town; buildings can move, so look again now and then.
    if (s.version !== haloVersion.n || clock.elapsedTime - s.at > 2) {
      s.version = haloVersion.n
      s.at = clock.elapsedTime
      const attr = mesh.geometry.getAttribute('aSpot') as InstancedBufferAttribute
      let n = 0
      for (const spot of haloSpots) {
        if (n >= MAX_HALOS) break
        let root: Object3D = spot
        while (root.parent) root = root.parent
        if (root !== scene) continue
        spot.getWorldPosition(tmp)
        attr.setXYZW(n++, tmp.x, tmp.y, tmp.z, spot.userData.halo ?? 1)
      }
      attr.needsUpdate = true
      mesh.geometry.instanceCount = n
    }
    if (!mesh.visible) return
    const u = (mesh.material as ShaderMaterial).uniforms
    // Damp air spreads the glow wider.
    u.uSize.value = 0.9 + 1.4 * sky.banks
    u.uOpacity.value = o * 0.55
  })
  return <primitive object={mesh} />
}

// Works out the sky for this frame. Mounted first so everything after reads it fresh.
function SkyClock() {
  useFrame(({ clock }, dt) => {
    const w = weatherNow()
    const phase = dayPhase()
    skyFx(w, phase, undefined, sky)
    skyUniforms.uTime.value = clock.elapsedTime
    skyUniforms.uGlint.value = sky.glint
    skyUniforms.uHeat.value = sky.heat
    skyUniforms.uCloudShade.value = sky.shade
    lightDir(phase, nightAmount(phase), skyUniforms.uSunDir.value)
    // Cloud shadows drift with the wind (in noise units: about 13 world units each).
    const step = Math.min(dt, 0.1) * (0.6 + w.wind * 3) * 0.075
    skyUniforms.uCloudDrift.value.x -= step
    skyUniforms.uCloudDrift.value.y -= step * 0.4
  })
  return null
}

export function Atmosphere({ small }: { small: boolean }) {
  return (
    <>
      <SkyClock />
      <GroundFog layers={small ? 6 : 9} />
      <SunShafts />
      <Rainbow />
      <LampHalos />
    </>
  )
}
