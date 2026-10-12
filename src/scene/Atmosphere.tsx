import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending, BufferAttribute, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, Object3D, OrthographicCamera,
  ShaderMaterial, Vector3,
} from 'three'
import { weatherNow } from '../game/weather'
import { dayPhase, nightAmount } from './dayNight'
import { lightDir } from './look'
import { skyUniforms } from './weatherLook'
import { frameFor, type Frame } from './Weather'
import { isFree } from './freeCam'
import { lowSun, sky, skyFx } from './skyFx'
import { fogUniforms } from './heightFog'
import { haloSpots, haloVersion } from './halos'

// The air over town: fog rolling along the ground, a rainbow
// after a shower and lamps haloed in the damp. Each is one instanced draw, and
// draws nothing at all while it's not needed.


// ---------- Ground fog ----------
// The fog itself is in every material's fog chunk (heightFog.ts); this sets it
// for the weather, the time of day and the wind.
type FogStyle = { floor: number; height: number; density: number; patch: number; scale: number }
const FOG_STYLES: Record<string, FogStyle> = {
  // A low, even blanket: streets and lawns sink into it, roofs stay clear.
  valley: { floor: 0, height: 0.9, density: 1.5, patch: 0.35, scale: 0.05 },
  // Rolling banks drifting through town, with clear gaps between them.
  banks: { floor: 0, height: 1.7, density: 0.6, patch: 1, scale: 0.04 },
  // A sea of cloud: only the towers break through.
  sea: { floor: 2.6, height: 0.8, density: 1.6, patch: 0.3, scale: 0.03 },
}
const pinnedStyle = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('fogstyle')
const FOG_STYLE = FOG_STYLES[pinnedStyle ?? ''] ?? FOG_STYLES.banks
const DAY_SHADE = new Color('#c9d3dd')
const DAY_LIT = new Color('#ffffff')
const DAWN_LIT = new Color('#ffe6cc')
const NIGHT_SHADE = new Color('#232a40')
const NIGHT_LIT = new Color('#3e4766')
function GroundFog() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  useEffect(() => () => { fogUniforms.uHF.value = 0 }, [])
  useFrame((_, dt) => {
    const b = sky.banks
    const u = fogUniforms
    u.uHF.value = Math.min(1, b * 1.25)
    if (b < 0.01) return
    const w = weatherNow()
    const phase = dayPhase()
    const night = nightAmount(phase)
    // Mist lies lower and thinner than real fog.
    const st = FOG_STYLE
    u.uHFHeight.value = st.height * (0.55 + 0.45 * (1 - sky.low))
    u.uHFFloor.value = st.floor * (0.4 + 0.6 * (1 - sky.low))
    u.uHFDensity.value = st.density
    u.uHFPatch.value = st.patch
    u.uHFScale.value = st.scale
    u.uHFGlow.value = 0.85 * night
    // Phones skip the fine wisps: one layer of noise per pixel instead of two.
    u.uHFDetail.value = Math.min(size.width, size.height) < 700 ? 0 : 1
    const step = Math.min(dt, 0.1) * (0.01 + w.wind * 0.04)
    u.uHFDrift.value.x += step
    u.uHFDrift.value.y += step * 0.45
    // Bright white by day, warm at sunrise and sunset, deep blue by night.
    u.uHFShade.value.copy(DAY_SHADE).lerp(NIGHT_SHADE, night)
    u.uHFLit.value.copy(DAY_LIT).lerp(DAWN_LIT, lowSun(phase) * 0.7).lerp(NIGHT_LIT, night)
    // In the free view the far haze has its own colour; the ground fog takes it on
    // so the two blend into one another instead of reading as two layers.
    const haze = scene.fog && 'color' in scene.fog ? scene.fog.color : null
    if (isFree(camera) && haze) {
      u.uHFShade.value.copy(haze).multiplyScalar(0.94)
      u.uHFLit.value.copy(haze).lerp(u.uHFLit.value, 0.35)
    }
    // The fog is mixed in after the output colour conversion, so it's given in sRGB.
    u.uHFShade.value.convertLinearToSRGB()
    u.uHFLit.value.convertLinearToSRGB()
  })
  return null
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

export function Atmosphere() {
  return (
    <>
      <SkyClock />
      <GroundFog />
      <Rainbow />
      <LampHalos />
    </>
  )
}
