import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BackSide, BufferAttribute, BufferGeometry, Color, Fog, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, MeshBasicMaterial,
  OrthographicCamera, ShaderMaterial, Vector2, Vector3, type Camera,
} from 'three'
import { strike, weatherNow, type Weather as WeatherState } from '../game/weather'
export { raceWeather } from '../game/weather'
import { applyNight, dayPhase, nightAmount } from './dayNight'
import { gloomOf, groundUniforms, hazeColor } from './weatherLook'
import type { Look } from './look'
import { isFree } from './freeCam'
import { calmFlashing } from '../game/flashing'
import { sky } from './skyFx'


// Rain, snow, splashes, lightning and fog. Everything that falls is one
// instanced quad per drop, moved entirely on the GPU from a time uniform, so a
// downpour costs one draw call and no per-frame work on the CPU.

const PRECIP_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uSpan;
uniform float uTop;
uniform float uSpeed;
uniform float uLen;
uniform float uWidth;
uniform float uRound;
uniform vec3 uCenter;
uniform vec2 uWind;
varying vec2 vUv;
varying float vFade;
void main() {
  float speed = uSpeed * (0.75 + 0.5 * aSeed.w);
  float fallen = fract(aSeed.y + uTime * speed / uTop);
  float y = uTop * (1.0 - fallen);
  float age = fallen * uTop / speed;
  vec2 xz = aSeed.xz * uSpan + uWind * age;
  // Snowflakes wander as they fall.
  xz += uRound * vec2(sin(uTime * 1.3 + aSeed.w * 40.0), cos(uTime * 1.1 + aSeed.x * 30.0)) * 0.6;
  // Wrap into a box around the view so the weather follows the camera.
  xz = uCenter.xz + mod(xz - uCenter.xz + 0.5 * uSpan, uSpan) - 0.5 * uSpan;
  vec4 mv = modelViewMatrix * vec4(xz.x, y, xz.y, 1.0);
  // Streaks line up with how the drop moves on screen.
  vec2 dir = (viewMatrix * vec4(uWind.x, -speed, uWind.y, 0.0)).xy;
  float dl = length(dir);
  dir = dl > 1e-4 ? dir / dl : vec2(0.0, -1.0);
  vec2 side = vec2(-dir.y, dir.x);
  float w = uWidth * (0.6 + 0.8 * aSeed.w);
  float len = mix(uLen, w, uRound);
  mv.xy += side * position.x * w - dir * (position.y - 0.5 * uRound) * len;
  vUv = vec2(position.x * 2.0, position.y);
  // Fade in at the top, and fade out drops right in front of a race camera.
  vFade = smoothstep(0.0, 0.06, fallen) * smoothstep(1.2, 3.5, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`

const PRECIP_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uRound;
varying vec2 vUv;
varying float vFade;
void main() {
  float a;
  if (uRound > 0.5) a = smoothstep(1.0, 0.35, length(vec2(vUv.x, vUv.y * 2.0 - 1.0)));
  else a = (1.0 - abs(vUv.x)) * (1.0 - vUv.y * 0.8);
  gl_FragColor = vec4(uColor, a * uOpacity * vFade);
  #include <colorspace_fragment>
}
`

// Rings that spread where raindrops land, re-placed at random every cycle.
const SPLASH_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uSpan;
uniform vec3 uCenter;
varying vec2 vUv;
varying float vPhase;
void main() {
  float t = uTime * (1.4 + aSeed.w) + aSeed.y;
  float cycle = floor(t);
  vPhase = fract(t);
  vec2 r = fract(sin(vec2(cycle * 12.9898 + aSeed.x * 78.233, cycle * 39.346 + aSeed.z * 11.135)) * 43758.5453);
  vec2 xz = uCenter.xz + (r - 0.5) * uSpan;
  float size = 0.1 + 0.22 * vPhase;
  vUv = position.xy * 2.0;
  gl_Position = projectionMatrix * viewMatrix * vec4(xz.x + position.x * size * 2.0, 0.04, xz.y + position.y * size * 2.0, 1.0);
}
`

const SPLASH_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vPhase;
void main() {
  float d = length(vUv);
  float ring = smoothstep(0.6, 0.85, d) * smoothstep(1.0, 0.86, d);
  gl_FragColor = vec4(uColor, ring * (1.0 - vPhase) * uOpacity);
  #include <colorspace_fragment>
}
`

function quad(centred: boolean) {
  const y0 = centred ? -0.5 : 0
  const g = new InstancedBufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, y0, 0, 0.5, y0, 0, 0.5, y0 + 1, 0, -0.5, y0 + 1, 0]), 3))
  g.setIndex([0, 1, 2, 0, 2, 3])
  return g
}

function seeded(g: InstancedBufferGeometry, count: number) {
  const a = new Float32Array(count * 4)
  for (let i = 0; i < a.length; i++) a[i] = Math.random()
  g.setAttribute('aSeed', new InstancedBufferAttribute(a, 4))
  g.instanceCount = 0
  return g
}

// Where the weather box sits and how big it is, so it always fills the view.
export type Frame = { center: Vector3; span: number; top: number; px: number }
const fwd = new Vector3()
export function frameFor(camera: Camera, out: Frame, race: boolean) {
  camera.getWorldDirection(fwd)
  if (race) {
    out.center.copy(camera.position).addScaledVector(fwd, 9).setY(0)
    out.span = 22
    out.top = 7
    out.px = 0.006
    return out
  }
  // Free view (perspective): a box on the ground ahead of the camera, sized to how far up it is.
  if (isFree(camera)) {
    const t = fwd.y < -0.05 ? Math.min(-camera.position.y / fwd.y, 45) : 30
    out.center.copy(camera.position).addScaledVector(fwd, t).setY(0)
    const d = camera.position.distanceTo(out.center)
    out.span = Math.ceil(Math.min(120, Math.max(40, d * 1.2 + 20)) / 8) * 8
    out.top = Math.max(22, camera.position.y + 6)
    out.px = 0.02 + d * 0.0006
    return out
  }
  // Bird's-eye: centre on the ground point in the middle of the screen.
  const cam = camera as OrthographicCamera
  const t = fwd.y < -0.05 ? -cam.position.y / fwd.y : 100
  out.center.copy(cam.position).addScaledVector(fwd, t)
  const w = (cam.right - cam.left) / cam.zoom
  const h = (cam.top - cam.bottom) / cam.zoom / Math.max(0.3, -fwd.y)
  // Rounded up in steps so zooming doesn't reshuffle every drop.
  out.span = Math.ceil((Math.max(w, h) * 1.15 + 14) / 8) * 8
  out.top = 22
  out.px = 1 / cam.zoom
  return out
}

const RAIN_DAY = new Color('#d6e2ee')
const RAIN_NIGHT = new Color('#8c9ab5')
const SNOW_NIGHT = new Color('#9fabc4')

type Sizes = { rain: number; splash: number; snow: number }

function Precip({ sizes, race, get }: { sizes: Sizes; race: boolean; get: () => WeatherState }) {
  const camera = useThree((s) => s.camera)
  const rain = useMemo(() => {
    const geo = seeded(quad(false), sizes.rain)
    const mat = new ShaderMaterial({
      vertexShader: PRECIP_VERT, fragmentShader: PRECIP_FRAG, transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uSpan: { value: 60 }, uTop: { value: 22 }, uSpeed: { value: 24 }, uLen: { value: 1.1 }, uWidth: { value: 0.05 },
        uRound: { value: 0 }, uCenter: { value: new Vector3() }, uWind: { value: new Vector2() }, uColor: { value: new Color() }, uOpacity: { value: 0.5 },
      },
    })
    return { geo, mat }
  }, [sizes.rain])
  const snow = useMemo(() => {
    const geo = seeded(quad(true), sizes.snow)
    const mat = new ShaderMaterial({
      vertexShader: PRECIP_VERT, fragmentShader: PRECIP_FRAG, transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uSpan: { value: 60 }, uTop: { value: 22 }, uSpeed: { value: 3 }, uLen: { value: 0 }, uWidth: { value: 0.1 },
        uRound: { value: 1 }, uCenter: { value: new Vector3() }, uWind: { value: new Vector2() }, uColor: { value: new Color('#ffffff') }, uOpacity: { value: 0.95 },
      },
    })
    return { geo, mat }
  }, [sizes.snow])
  const splash = useMemo(() => {
    const geo = seeded(quad(true), sizes.splash)
    geo.rotateX(-Math.PI / 2)
    const mat = new ShaderMaterial({
      vertexShader: SPLASH_VERT, fragmentShader: SPLASH_FRAG, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uSpan: { value: 60 }, uCenter: { value: new Vector3() }, uColor: { value: new Color('#e3edf7') }, uOpacity: { value: 0.5 } },
    })
    return { geo, mat }
  }, [sizes.splash])
  useEffect(() => () => {
    for (const p of [rain, snow, splash]) { p.geo.dispose(); p.mat.dispose() }
  }, [rain, snow, splash])

  const frame = useMemo<Frame>(() => ({ center: new Vector3(), span: 60, top: 22, px: 0.03 }), [])
  const meshes = useRef<(Mesh | null)[]>([])
  useFrame(({ clock }) => {
    const w = get()
    frameFor(camera, frame, race)
    const t = clock.elapsedTime
    const night = nightAmount(dayPhase())
    // The wind blows mostly one way across town, a little harder in gusts.
    const gust = w.wind * (race ? 5 : 9)
    const r = rain.mat.uniforms
    r.uTime.value = t
    r.uSpan.value = frame.span
    r.uTop.value = frame.top
    r.uSpeed.value = race ? 16 : 26
    r.uLen.value = (race ? 0.55 : 1.3) * (0.6 + 0.4 * w.rain)
    r.uWidth.value = race ? 0.012 : 1.5 * frame.px
    r.uCenter.value.copy(frame.center)
    r.uWind.value.set(gust, gust * 0.35)
    r.uColor.value.copy(RAIN_DAY).lerp(RAIN_NIGHT, night)
    r.uOpacity.value = (race ? 0.45 : 0.32) + 0.25 * w.rain + w.flash * 0.3
    rain.geo.instanceCount = Math.round(sizes.rain * Math.min(1, w.rain))

    const s = snow.mat.uniforms
    s.uTime.value = t
    s.uSpan.value = frame.span
    s.uTop.value = frame.top
    s.uSpeed.value = (race ? 2.2 : 3.2) * (1 + w.wind * 0.6)
    s.uWidth.value = race ? 0.035 : 4.2 * frame.px
    s.uCenter.value.copy(frame.center)
    s.uWind.value.set(gust * 1.4, gust * 0.5)
    // Blowing sand rides the snow layer: tan grains racing sideways.
    const sand = w.dust > w.snow
    s.uColor.value.set(sand ? '#b48650' : '#ffffff').lerp(SNOW_NIGHT, sand ? 0 : night * 0.6)
    s.uOpacity.value = sand ? 0.7 : 0.95
    if (sand) {
      s.uSpeed.value = race ? 1.2 : 1.5
      s.uWind.value.set(gust * 2.4, gust * 0.8)
      s.uWidth.value = race ? 0.04 : 3.4 * frame.px
    }
    snow.geo.instanceCount = Math.round(sizes.snow * Math.min(1, Math.max(w.snow, w.dust)))

    const p = splash.mat.uniforms
    p.uTime.value = t
    p.uSpan.value = race ? 16 : frame.span * 0.8
    p.uCenter.value.copy(frame.center)
    p.uOpacity.value = 0.55 * (1 - night * 0.5)
    splash.geo.instanceCount = Math.round(sizes.splash * Math.min(1, w.rain * 1.3))
    // Clear skies draw nothing at all.
    ;[rain, snow, splash].forEach((p, i) => { const m = meshes.current[i]; if (m) m.visible = p.geo.instanceCount > 0 })
  })
  return (
    <>
      <mesh ref={(m) => { meshes.current[0] = m }} geometry={rain.geo} material={rain.mat} frustumCulled={false} raycast={() => null} renderOrder={5} />
      <mesh ref={(m) => { meshes.current[1] = m }} geometry={snow.geo} material={snow.mat} frustumCulled={false} raycast={() => null} renderOrder={5} />
      <mesh ref={(m) => { meshes.current[2] = m }} geometry={splash.geo} material={splash.mat} frustumCulled={false} raycast={() => null} renderOrder={4} />
    </>
  )
}

// Lightning in storms: a jagged bolt somewhere in view and a flash that lights
// the whole scene, then thunder (for sound) a moment later.
const SEGS = 22
const flashCurve = (t: number) => (t < 0 ? 0 : t < 0.07 ? 1 : t < 0.13 ? 0.25 : t < 0.2 ? 0.85 : Math.max(0, 0.85 * (1 - (t - 0.2) / 0.45)))
// Reduce flashing (or reduced motion) gets one soft glow per strike instead of a flicker.
const softFlash = (t: number) => (t < 0 ? 0 : 0.3 * Math.max(0, 1 - Math.abs(t - 0.25) / 0.25))

function Lightning({ race, get }: { race: boolean; get: () => WeatherState }) {
  const camera = useThree((s) => s.camera)
  const bolt = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(SEGS * 4 * 3), 3))
    const idx: number[] = []
    for (let i = 0; i < SEGS; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3)
    geo.setIndex(idx)
    const mat = new MeshBasicMaterial({ color: new Color(3.2, 3.2, 4), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false })
    const mesh = new Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.raycast = () => {}
    mesh.visible = false
    return mesh
  }, [])
  useEffect(() => () => { bolt.geometry.dispose(); (bolt.material as MeshBasicMaterial).dispose() }, [bolt])
  const state = useRef({ next: 3 + Math.random() * 5, at: -10 })
  const frame = useMemo<Frame>(() => ({ center: new Vector3(), span: 60, top: 22, px: 0.03 }), [])

  const build = () => {
    frameFor(camera, frame, race)
    const view = camera.getWorldDirection(new Vector3())
    // In a race the bolt lands well down the road; in town, somewhere in view.
    const ground = frame.center.clone()
    if (race) ground.addScaledVector(view.clone().setY(0).normalize(), 30).add(new Vector3((Math.random() - 0.5) * 30, 0, 0))
    else ground.add(new Vector3((Math.random() - 0.5) * frame.span * 0.5, 0, (Math.random() - 0.5) * frame.span * 0.5))
    const height = race ? 30 : 45
    const width = race ? 0.18 : 0.12 + frame.px * 2.5
    const pos = bolt.geometry.getAttribute('position') as BufferAttribute
    const main = SEGS - 6
    const pts: Vector3[] = []
    for (let i = 0; i <= main; i++) {
      const k = i / main
      const j = i === 0 || i === main ? 0 : 1
      pts.push(new Vector3(ground.x + j * (Math.random() - 0.5) * 3.2, height * (1 - k), ground.z + j * (Math.random() - 0.5) * 3.2))
    }
    const quadAt = (q: number, a: Vector3, b: Vector3, wd: number) => {
      const side = new Vector3().subVectors(b, a).cross(view).normalize().multiplyScalar(wd / 2)
      pos.setXYZ(q * 4, a.x - side.x, a.y - side.y, a.z - side.z)
      pos.setXYZ(q * 4 + 1, a.x + side.x, a.y + side.y, a.z + side.z)
      pos.setXYZ(q * 4 + 2, b.x + side.x, b.y + side.y, b.z + side.z)
      pos.setXYZ(q * 4 + 3, b.x - side.x, b.y - side.y, b.z - side.z)
    }
    for (let i = 0; i < main; i++) quadAt(i, pts[i], pts[i + 1], width)
    // One fork off the upper half.
    let at = pts[2 + Math.floor(Math.random() * 4)].clone()
    const dir = new Vector3((Math.random() - 0.5) * 2, -2.2, (Math.random() - 0.5) * 2).normalize()
    for (let i = main; i < SEGS; i++) {
      const nxt = at.clone().addScaledVector(dir, 2.6).add(new Vector3((Math.random() - 0.5) * 1.4, 0, (Math.random() - 0.5) * 1.4))
      quadAt(i, at, nxt, width * 0.6)
      at = nxt
    }
    pos.needsUpdate = true
  }

  useFrame(({ clock }) => {
    const w = get()
    const t = clock.elapsedTime
    const s = state.current
    const stormy = w.kind === 'storm' && w.rain > 0.5
    if (stormy && t > s.next) {
      s.at = t
      s.next = t + 4 + Math.random() * 9
      build()
      // Sound travels slower than light: a far strike rumbles in later and softer.
      const far = Math.random()
      strike(400 + far * 2200, 1 - far * 0.6)
    } else if (!stormy && s.next < t + 2) s.next = t + 2 + Math.random() * 4
    const f = (calmFlashing() ? softFlash : flashCurve)(t - s.at)
    w.flash = f
    const m = bolt.material as MeshBasicMaterial
    m.opacity = Math.min(1, f * 1.4)
    bolt.visible = f > 0.01
  })
  return <primitive object={bolt} />
}

// Fog and whiteouts: the scene's fog fades distant ground into the haze colour.
// In town the camera looks down from a fixed distance, so fog starts a little
// in front of the ground at screen centre and thickens towards the top of the screen.
function TownFog() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const fog = useMemo(() => new Fog('#c4ccd6', 1e5, 2e5), [])
  useEffect(() => {
    scene.fog = fog
    return () => { if (scene.fog === fog) scene.fog = null }
  }, [scene, fog])
  const frame = useMemo<Frame>(() => ({ center: new Vector3(), span: 60, top: 22, px: 0.03 }), [])
  useFrame(() => {
    // The free view's far haze is set by Horizon instead.
    if (isFree(camera)) return
    const w = weatherNow()
    // Ground fog banks (Atmosphere.tsx) carry most of a fog's look; the far haze stays light under them.
    const h = w.haze * (1 - 0.9 * sky.banks)
    if (h < 0.01) {
      fog.near = 1e5
      fog.far = 2e5
      return
    }
    frameFor(camera, frame, false)
    const d = camera.position.distanceTo(frame.center)
    fog.near = d - 45
    fog.far = fog.near + 100 / h
    hazeColor(fog.color, w, nightAmount(dayPhase()))
  })
  return null
}

const ground = groundUniforms
const SIZES: Record<'small' | 'big' | 'race', Sizes> = {
  small: { rain: 1400, splash: 260, snow: 1100 },
  big: { rain: 2800, splash: 520, snow: 2200 },
  race: { rain: 1600, splash: 160, snow: 1300 },
}

// The town's weather.
export function Weather({ small }: { small: boolean }) {
  const get = weatherNow
  useFrame(() => {
    const w = weatherNow()
    ground.uWet.value = w.wet
    ground.uCover.value = w.cover
  })
  return (
    <>
      <TownFog />
      <Precip sizes={small ? SIZES.small : SIZES.big} race={false} get={get} />
      <Lightning race={false} get={get} />
    </>
  )
}

// The weather during a race. `look` is the race's lighting, for lightning flashes.
// `night` is the race's darkness (a midnight race forces it; otherwise the clock's).
export function RaceWeather({ w, look, night: dark }: { w: WeatherState; look: Look; night?: number }) {
  const nightOf = () => dark ?? nightAmount(dayPhase())
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const base = useRef<{ near: number; far: number; color: Color; exposure: number } | null>(null)
  // Street lamps and headlights come on in a race-day storm, and go back to the
  // town's weather afterwards.
  useEffect(() => {
    applyNight(nightOf(), gloomOf(w))
    return () => applyNight(nightAmount(dayPhase()), gloomOf(weatherNow()))
  }, [w, dark])
  useEffect(() => {
    const f = scene.fog
    if (f instanceof Fog) {
      base.current = { near: f.near, far: f.far, color: f.color.clone(), exposure: look.grade.exposure }
      f.near *= 1 - 0.65 * w.haze
      f.far *= 1 - 0.6 * w.haze
      f.color.lerp(hazeColor(new Color(), w, nightOf()), Math.min(1, w.haze + w.cloud * 0.5))
    }
    return () => {
      const b = base.current
      if (b && f instanceof Fog) { f.near = b.near; f.far = b.far; f.color.copy(b.color) }
    }
  }, [scene, w, look])
  const get = useMemo(() => () => w, [w])
  // A grey (or sandy) veil over the venue's blue sky when it's overcast.
  const veil = useMemo(() => {
    const night = nightOf()
    const c = new Color(w.dust > 0 ? '#cfa877' : w.haze > w.cloud ? '#c9d1da' : '#87909b').lerp(new Color('#1c2438'), night * 0.8)
    return new MeshBasicMaterial({ color: c, transparent: true, opacity: Math.min(0.88, w.cloud * 0.8 + w.haze * 0.45 + w.dust * 0.45), side: BackSide, fog: false, depthWrite: false })
  }, [w])
  useEffect(() => () => veil.dispose(), [veil])
  const dome = useRef<Mesh>(null)
  useFrame(() => {
    dome.current?.position.set(camera.position.x, 0, camera.position.z)
    ground.uWet.value = w.wet
    ground.uCover.value = w.cover
    if (base.current) look.grade.exposure = base.current.exposure + 0.3 * w.flash
  })
  return (
    <>
      {veil.opacity > 0.01 && (
        <mesh ref={dome} material={veil} raycast={() => null} renderOrder={-1}>
          <sphereGeometry args={[88, 24, 8, 0, Math.PI * 2, 0.9, Math.PI / 2 - 0.75]} />
        </mesh>
      )}
      <Precip sizes={SIZES.race} race get={get} />
      <Lightning race get={get} />
    </>
  )
}
