import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CylinderGeometry, DoubleSide, Mesh, PlaneGeometry, Quaternion, ShaderMaterial, Vector2, Vector3,
  type Camera, type Group, type OrthographicCamera, type PerspectiveCamera,
} from 'three'
import { weatherNow } from '../game/weather'
import { auroraHour, flyByGap, meteorGap, pickFlyBy, skyClear, skyPins, type FlyBy } from '../game/skyExtras'
import { reduceMotionOn, systemReducedMotion, useLite, usePrefs } from '../lib/prefs'
import { calmFlashing } from '../game/flashing'
import { dayPhase, nightAmount } from './dayNight'
import { frameFor, type Frame } from './Weather'
import { isFree } from './freeCam'
import { A_CITY } from './horizonLand'
import { BalloonModel } from './KartExtras'
import { Box, Cone, Cyl } from './RaceVenues'

// Extras in the town's sky (timing in game/skyExtras.ts): northern lights in
// the small hours, shooting stars, and planes, balloons and the odd rocket
// passing over. In the free view the lights and stars sit in the sky low over
// the far city; from the bird's-eye view, which never sees the sky, they hang
// in the air over the top of the screen like the rainbow does. Saver skips the
// aurora and the fly-bys; reduced motion skips the shooting stars and slows
// the aurora right down. The moon's phase is drawn by the free view's sky
// (Horizon.tsx).

const NOISE = /* glsl */ `
float xHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float xNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(xHash(i), xHash(i + vec2(1, 0)), f.x), mix(xHash(i + vec2(0, 1)), xHash(i + vec2(1, 1)), f.x), f.y);
}
`

// ---------- Aurora ----------
// Curtains of light: a bright green hem that folds and sways along the band,
// fine rays drifting through it, fading up into purple. vUv.x runs along the
// band (in curtain units), vUv.y from its foot (0) to its top (1); vEdge fades
// out its two ends.
const AURORA_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uSoft;
uniform float uFoot;
varying vec2 vUv;
varying float vEdge;
${NOISE}
void main() {
  float x = vUv.x, t = uTime;
  float fold = xNoise(vec2(x * 0.35 + t * 0.02, 1.7)) * 2.0 + xNoise(vec2(x * 0.9 - t * 0.035, 7.3)) * 0.6;
  float xx = x + fold;
  float base = 0.1 + 0.22 * xNoise(vec2(x * 0.5 - t * 0.015, 3.1));
  float h = vUv.y - base;
  float r = xNoise(vec2(xx * 9.0 + t * 0.12, 0.5)) * 0.6 + xNoise(vec2(xx * 23.0 - t * 0.2, 4.0)) * 0.4;
  float rays = 0.3 + 1.1 * r * r;
  float hem = smoothstep(-uSoft, 0.015, h);
  float green = hem * exp(-max(h, 0.0) * 3.5) + (1.0 - hem) * exp(h * 30.0 * 0.025 / uSoft) * 0.4;
  float purple = hem * smoothstep(0.04, 0.35, h) * exp(-h * 1.4) * 1.1;
  // Brighter patches drift along the band.
  float bright = 0.25 + 0.75 * smoothstep(0.2, 0.7, xNoise(vec2(x * 0.25 + t * 0.01, 11.0)));
  vec3 c = (vec3(0.2, 1.0, 0.5) * green + vec3(0.62, 0.3, 1.0) * purple) * rays * bright;
  c *= smoothstep(1.0, 0.65, vUv.y) * smoothstep(0.0, uFoot, vUv.y) * sin(3.14159 * clamp(vEdge, 0.0, 1.0));
  gl_FragColor = vec4(c * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`
// Free view: a band round the camera, low over the far city.
const BAND_VERT = /* glsl */ `
uniform float uSpan;
varying vec2 vUv;
varying float vEdge;
void main() {
  vUv = vec2(uv.x * uSpan, uv.y);
  vEdge = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // Just in front of the sky dome, behind everything else.
  gl_Position.z = gl_Position.w * 0.99998;
}
`
// Bird's-eye: across the top of the screen.
const SCREEN_VERT = /* glsl */ `
uniform float uAspect;
varying vec2 vUv;
varying float vEdge;
void main() {
  vUv = vec2(position.x * uAspect * 1.6 + 20.0, (position.y - 0.3) / 0.7);
  vEdge = 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`
const BAND_R = 1500
const BAND_WIDE = 2.6 // radians of horizon it spans
const EL0 = 1 * (Math.PI / 180)
const EL1 = 24 * (Math.PI / 180)

function auroraMat(vert: string, extra: Record<string, { value: number }>) {
  return new ShaderMaterial({
    vertexShader: vert, fragmentShader: AURORA_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uSoft: { value: 0.025 }, uFoot: { value: 0.1 }, ...extra },
  })
}

function Aurora() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const { band, screen } = useMemo(() => {
    // Three.js measures a cylinder's angle from +z towards +x; the horizon's from +x towards +z.
    const mid = Math.PI / 2 - A_CITY
    const y0 = BAND_R * Math.tan(EL0), y1 = BAND_R * Math.tan(EL1)
    const g = new CylinderGeometry(BAND_R, BAND_R, y1 - y0, 48, 1, true, mid - BAND_WIDE / 2, BAND_WIDE)
    g.translate(0, (y0 + y1) / 2, 0)
    const band = new Mesh(g, auroraMat(BAND_VERT, { uSpan: { value: 14 } }))
    const q = new BufferGeometry()
    q.setAttribute('position', new BufferAttribute(new Float32Array([-1, 0.3, 0, 1, 0.3, 0, 1, 1, 0, -1, 1, 0]), 3))
    q.setIndex([0, 1, 2, 0, 2, 3])
    const screen = new Mesh(q, auroraMat(SCREEN_VERT, { uAspect: { value: 1 } }))
    for (const m of [band, screen]) {
      m.frustumCulled = false
      m.raycast = () => {}
      m.visible = false
    }
    band.renderOrder = -9
    screen.renderOrder = 8
    screen.material.depthTest = false
    // Over the roofs the curtains' hem is soft, so it doesn't rule a line across the town.
    screen.material.uniforms.uSoft.value = 0.14
    screen.material.uniforms.uFoot.value = 0.5
    return { band, screen }
  }, [])
  useEffect(() => () => { for (const m of [band, screen]) { m.geometry.dispose(); m.material.dispose() } }, [band, screen])
  const clock = useRef({ t: 0, checked: -Infinity, hour: 0 })
  const bandRef = useRef<typeof band>(null)
  const screenRef = useRef<typeof screen>(null)
  useFrame((_, dt) => {
    const c = clock.current
    const band = bandRef.current, screen = screenRef.current
    if (!band || !screen) return
    // The device clock only needs reading now and then.
    c.t += Math.min(dt, 0.1) * (reduceMotionOn() ? 0.15 : 1)
    if (Math.abs(c.t - c.checked) > 5) {
      c.checked = c.t
      c.hour = auroraHour()
    }
    const w = weatherNow()
    const o = c.hour * nightAmount(dayPhase()) * (skyPins.has('aurora') ? 1 : skyClear(w))
    const free = isFree(camera)
    band.visible = free && o > 0.01
    screen.visible = !free && o > 0.01
    if (band.visible) {
      band.position.copy(camera.position)
      band.material.uniforms.uTime.value = c.t
      band.material.uniforms.uOpacity.value = o * 1.1
    }
    if (screen.visible) {
      const u = screen.material.uniforms
      u.uTime.value = c.t
      u.uAspect.value = size.width / Math.max(1, size.height)
      // Over the roofs it's a soft glow, so the town stays easy to read.
      u.uOpacity.value = o * 0.32
    }
  })
  return (
    <>
      <primitive ref={bandRef} object={band} />
      <primitive ref={screenRef} object={screen} />
    </>
  )
}

// ---------- Shooting stars ----------
// One thin streak quad, drawn in screen space between two points (in pixels from
// the middle of the screen): the tail (x 0) to the bright head (x 1).
const METEOR_VERT = /* glsl */ `
uniform vec2 uA;
uniform vec2 uB;
uniform vec2 uRes;
uniform float uWidth;
uniform float uZ;
varying vec2 vP;
void main() {
  vP = position.xy;
  vec2 along = uB - uA;
  vec2 n = normalize(vec2(-along.y, along.x) + 1e-5);
  vec2 p = uA + along * position.x + n * position.y * uWidth;
  gl_Position = vec4(p * 2.0 / uRes, uZ, 1.0);
}
`
const METEOR_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec2 vP;
void main() {
  float across = 1.0 - abs(vP.y);
  float a = pow(vP.x, 2.2) * across * across;
  // A brighter spark at the head.
  a += smoothstep(0.9, 1.0, vP.x) * across * 0.8;
  gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), a * uOpacity);
  #include <colorspace_fragment>
}
`
type Meteor = { at: number; dur: number; next: number; free: boolean; a: Vector3; b: Vector3; sa: Vector2; sb: Vector2 }
const tmp = new Vector3()
const fwd = new Vector3()

function Meteors() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const mesh = useMemo(() => {
    const g = new PlaneGeometry(1, 2)
    g.translate(0.5, 0, 0)
    const m = new ShaderMaterial({
      vertexShader: METEOR_VERT, fragmentShader: METEOR_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
      uniforms: { uA: { value: new Vector2() }, uB: { value: new Vector2() }, uRes: { value: new Vector2() }, uWidth: { value: 2 }, uZ: { value: 0 }, uOpacity: { value: 0 } },
    })
    const mesh = new Mesh(g, m)
    mesh.frustumCulled = false
    mesh.raycast = () => {}
    mesh.renderOrder = 9
    mesh.visible = false
    return mesh
  }, [])
  useEffect(() => () => { mesh.geometry.dispose(); mesh.material.dispose() }, [mesh])
  // `next` < 0: not scheduled yet.
  const st = useRef<Meteor>({ at: -Infinity, dur: 1, next: -1, free: false, a: new Vector3(), b: new Vector3(), sa: new Vector2(), sb: new Vector2() })
  useDevHook('meteor', st)
  const ref = useRef<typeof mesh>(null)
  useFrame(({ clock }) => {
    const s = st.current
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    const free = isFree(camera)
    if (s.next < 0) s.next = t + meteorGap(Math.random())
    if (t >= s.next) {
      s.next = t + meteorGap(Math.random())
      const n = nightAmount(dayPhase())
      const ok = skyPins.has('meteor') ? n > 0.3 : n > 0.7 && skyClear(weatherNow()) > 0.5
      if (ok) launch(s, t, free, camera, size.width, size.height)
    }
    const k = (t - s.at) / s.dur
    // Switching view mid-streak just drops it.
    mesh.visible = k >= 0 && k < 1 && s.free === free
    if (!mesh.visible) return
    const u = mesh.material.uniforms
    // The head races along; the tail trails a third of the path behind it.
    const head = 0.15 + 0.85 * k
    const tail = Math.max(0, head - 0.35)
    if (free) {
      if (!skyPoint(camera, tmp.copy(s.a).lerp(s.b, tail).normalize(), u.uA.value, size.width, size.height) || !skyPoint(camera, tmp.copy(s.a).lerp(s.b, head).normalize(), u.uB.value, size.width, size.height)) {
        mesh.visible = false
        return
      }
    } else {
      u.uA.value.copy(s.sa).lerp(s.sb, tail)
      u.uB.value.copy(s.sa).lerp(s.sb, head)
    }
    u.uRes.value.set(size.width, size.height)
    u.uWidth.value = 2
    // In the free view it's behind the hills and buildings; from above it's in the air.
    u.uZ.value = free ? 0.99997 : 0
    mesh.material.depthTest = free
    u.uOpacity.value = Math.sin(Math.PI * k) ** 0.6 * 0.95
  })
  return <primitive ref={ref} object={mesh} />
}

// Picks a streak: in the free view a path low across the sky ahead (as
// directions); from above, a slant across the top half of the screen (in pixels).
function launch(s: Meteor, t: number, free: boolean, camera: Camera, w: number, h: number) {
  s.at = t
  s.dur = 0.7 + Math.random() * 0.5
  s.free = free
  const side = Math.random() < 0.5 ? -1 : 1
  if (free) {
    camera.getWorldDirection(fwd)
    const az = Math.atan2(fwd.z, fwd.x) + (Math.random() - 0.5) * 0.7
    // The free view never tilts far above the horizon, so start it a little below
    // the top of the screen (under the HUD), never down in the haze.
    const top = Math.asin(Math.min(1, Math.max(-1, fwd.y))) + (((camera as PerspectiveCamera).fov ?? 45) / 2) * (Math.PI / 180)
    const el = Math.min(30 * (Math.PI / 180), Math.max(9 * (Math.PI / 180), top - (5 + Math.random() * 4) * (Math.PI / 180)))
    const dir = (a: number, e: number, out: Vector3) => out.set(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e))
    dir(az, el, s.a)
    dir(az + side * (0.18 + Math.random() * 0.12), el - (4 + Math.random() * 3) * (Math.PI / 180), s.b)
    return
  }
  s.sa.set((Math.random() - 0.5) * w * 0.7, h * (0.15 + Math.random() * 0.3))
  const ang = (20 + Math.random() * 20) * (Math.PI / 180)
  const len = Math.min(w, h) * (0.3 + Math.random() * 0.15)
  s.sb.set(s.sa.x + side * Math.cos(ang) * len, s.sa.y - Math.sin(ang) * len)
}

// Where a direction in the sky lands on screen, in pixels from the middle. False if it's behind the camera.
const proj = new Vector3()
function skyPoint(camera: Camera, dir: Vector3, out: Vector2, w: number, h: number) {
  proj.copy(camera.position).addScaledVector(dir, 1000).project(camera)
  if (proj.z > 1) return false
  out.set((proj.x * w) / 2, (proj.y * h) / 2)
  return true
}

// Dev builds only: lets headless screenshot scripts, far too slow to catch a
// one-second streak, hold a meteor or a fly-by part way through
// (window.__sky.meteor / .flight, timed by window.__sky.clock).
function useDevHook(name: 'meteor' | 'flight', state: React.RefObject<object>) {
  const clock = useThree((s) => s.clock)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __sky?: Record<string, unknown> }
    w.__sky = { ...w.__sky, clock, [name]: state.current }
  }, [clock, name, state])
}

// ---------- Fly-bys ----------
type Flight = { kind: FlyBy | null; at: number; dur: number; next: number; from: Vector3; to: Vector3; scale: number; free: boolean }
const UP = new Vector3(0, 1, 0)
const quat = new Quaternion()
const vel = new Vector3()
const side = new Vector3()
const mid = new Vector3()

// Seconds to cross, how high over the town from the bird's-eye view, and in the
// free view, how far up the sky (degrees) over the spot well ahead of the camera,
// where it can be seen: the free view never tilts far above the horizon.
const FLIGHT: Record<FlyBy, { dur: number; y: number; el: number }> = {
  plane: { dur: 34, y: 34, el: 9 },
  balloon: { dur: 80, y: 26, el: 6 },
  rocket: { dur: 7, y: 24, el: 2 },
}
const AHEAD = 180
// The town's balloon, in one of these, picked once a visit.
const BALLOONS = [['#e53935', '#fdd835'], ['#1e88e5', '#ffffff'], ['#43a047', '#ff7043'], ['#8e24aa', '#ffca28']]
const TOWN_BALLOON = BALLOONS[Math.floor(Math.random() * BALLOONS.length)]

function FlyBys() {
  const camera = useThree((s) => s.camera)
  const refs = useRef<Record<FlyBy, Group | null>>({ plane: null, balloon: null, rocket: null })
  const strobe = useRef<Group>(null)
  const beacon = useRef<Group>(null)
  const flame = useRef<Group>(null)
  const frame = useMemo<Frame>(() => ({ center: new Vector3(), span: 60, top: 22, px: 0.03 }), [])
  // `next` < 0: not scheduled yet.
  const st = useRef<Flight>({ kind: null, at: 0, dur: 1, next: -1, from: new Vector3(), to: new Vector3(), scale: 1, free: false })
  useDevHook('flight', st)
  useFrame(({ clock }) => {
    const s = st.current
    const t = clock.elapsedTime
    // The first one comes over a little sooner than the rest.
    if (s.next < 0) s.next = t + flyByGap(Math.random()) * 0.3
    if (!s.kind && t >= s.next) {
      const w = weatherNow()
      const fair = w.rain < 0.1 && w.snow < 0.1 && w.wind < 0.5 && w.haze < 0.4
      s.kind = pickFlyBy(Math.random(), Math.random(), nightAmount(dayPhase()), fair, w.mix.storm + w.mix.blizzard > 0.5)
      if (s.kind) route(s, t, camera, frame)
      else s.next = t + flyByGap(Math.random())
    }
    for (const k of ['plane', 'balloon', 'rocket'] as const) if (refs.current[k]) refs.current[k].visible = s.kind === k
    if (!s.kind) return
    const g = refs.current[s.kind]
    const k = (t - s.at) / s.dur
    // Switching view mid-flight ends it: its path was set for the other view.
    if (k >= 1 || !g || s.free !== isFree(camera)) {
      s.kind = null
      s.next = t + flyByGap(Math.random())
      return
    }
    g.position.lerpVectors(s.from, s.to, k)
    g.scale.setScalar(s.scale)
    vel.subVectors(s.to, s.from).normalize()
    if (s.kind === 'balloon') {
      // Bobs gently and turns slowly as it drifts.
      g.position.y += Math.sin(t * 0.4) * 0.6 * s.scale
      g.rotation.set(0, t * 0.05, 0)
    } else if (s.kind === 'plane') {
      g.rotation.set(0, Math.atan2(vel.x, vel.z), 0)
      // Navigation lights: a white strobe and a red beacon, steady when motion is reduced.
      const calm = reduceMotionOn() || calmFlashing()
      if (strobe.current) strobe.current.visible = calm || (t * 0.9) % 1 < 0.08
      if (beacon.current) beacon.current.visible = calm || (t * 0.7 + 0.5) % 1 < 0.35
    } else {
      // Rockets climb as they go, nose first, the flame flickering.
      g.position.y += k * k * 40 * s.scale
      vel.subVectors(s.to, s.from).add(tmp.set(0, 80 * k * s.scale, 0)).normalize()
      g.quaternion.copy(quat.setFromUnitVectors(UP, vel))
      if (flame.current) flame.current.scale.set(1, 0.8 + Math.sin(t * 40) * 0.2 + Math.random() * 0.15, 1)
    }
  })
  return (
    <group>
      <group ref={(g) => { refs.current.plane = g }} visible={false}>
        <group scale={0.7}><Plane strobe={strobe} beacon={beacon} /></group>
      </group>
      <group ref={(g) => { refs.current.balloon = g }} visible={false}>
        <group scale={0.27}><BalloonModel c={TOWN_BALLOON} /></group>
      </group>
      <group ref={(g) => { refs.current.rocket = g }} visible={false}>
        <Rocket flame={flame} />
      </group>
    </group>
  )
}

// Sets a flight's path: straight across the middle of the view, a little to one
// side, at its height. From above, "the middle" is the spot at that height in
// the middle of the screen; in the free view, a spot well ahead of the camera.
function route(s: Flight, t: number, camera: Camera, frame: Frame) {
  const f = FLIGHT[s.kind!]
  const free = isFree(camera)
  s.free = free
  s.at = t
  s.dur = f.dur * (0.85 + Math.random() * 0.3)
  camera.getWorldDirection(fwd)
  let span: number
  if (free) {
    s.scale = 4
    const ahead = fwd.clone().setY(0).normalize()
    mid.copy(camera.position).addScaledVector(ahead, AHEAD)
    mid.y += AHEAD * Math.tan(f.el * (Math.PI / 180))
    span = 420
  } else {
    s.scale = 1
    frameFor(camera, frame, false)
    const cam = camera as OrthographicCamera
    // Back up the line of sight from the ground to the flying height.
    mid.copy(frame.center).addScaledVector(fwd, -f.y / Math.max(0.2, -fwd.y))
    span = Math.max(40, ((cam.right - cam.left) / cam.zoom) * 1.3)
  }
  // Across the view, at any angle from straight across to about 40 degrees off it.
  const yaw = Math.atan2(fwd.x, fwd.z) + Math.PI / 2 + (Math.random() - 0.5) * 1.4 + (Math.random() < 0.5 ? Math.PI : 0)
  vel.set(Math.sin(yaw), 0, Math.cos(yaw))
  side.set(vel.z, 0, -vel.x)
  mid.addScaledVector(side, (Math.random() - 0.5) * span * 0.25)
  s.from.copy(mid).addScaledVector(vel, -span / 2)
  s.to.copy(mid).addScaledVector(vel, span / 2)
  if (s.kind === 'rocket') {
    // It starts low and climbs out of sight.
    s.from.y -= 14 * s.scale
  }
}

// A little airliner, about 2.4 long, flying along +z.
function Plane({ strobe, beacon }: { strobe: React.RefObject<Group | null>; beacon: React.RefObject<Group | null> }) {
  return (
    <group>
      <Cyl p={[0, 0, 0]} r={0.16} h={2.2} c="#eceff1" rot={[Math.PI / 2, 0, 0]} />
      <Cone p={[0, 0, 1.22]} r={0.16} h={0.3} c="#eceff1" />
      <Box p={[0, 0, 0.1]} s={[2.3, 0.05, 0.42]} c="#cfd8dc" />
      <Box p={[0, 0, -0.95]} s={[0.9, 0.04, 0.26]} c="#cfd8dc" />
      <Box p={[0, 0.25, -0.98]} s={[0.05, 0.5, 0.3]} c="#1e88e5" />
      {[-0.55, 0.55].map((x) => <Cyl key={x} p={[x, -0.12, 0.2]} r={0.08} h={0.38} c="#90a4ae" rot={[Math.PI / 2, 0, 0]} />)}
      {/* Red on the left wingtip, green on the right. */}
      <Light p={[1.17, 0, 0.05]} c="#ff2a2a" />
      <Light p={[-1.17, 0, 0.05]} c="#2aff6a" />
      <group ref={strobe}><Light p={[0, 0.06, -1.12]} c="#ffffff" r={0.09} /></group>
      <group ref={beacon}><Light p={[0, -0.18, 0.1]} c="#ff3030" r={0.07} /></group>
    </group>
  )
}

function Light({ p, c, r = 0.07 }: { p: [number, number, number]; c: string; r?: number }) {
  return (
    <mesh position={p}>
      <sphereGeometry args={[r, 8, 6]} />
      <meshBasicMaterial color={c} toneMapped={false} />
    </mesh>
  )
}

// A cartoon rocket, nose up (+y), about 2 tall.
function Rocket({ flame }: { flame: React.RefObject<Group | null> }) {
  return (
    <group>
      <Cyl p={[0, 0, 0]} r={0.3} h={1.2} c="#f5f5f5" seg={12} />
      <Cone p={[0, 0.85, 0]} r={0.3} h={0.5} c="#e53935" seg={12} />
      <mesh position={[0, 0.2, 0.28]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={0.4} />
      </mesh>
      {[0, 1, 2].map((i) => <Box key={i} ry={(i * Math.PI * 2) / 3} p={[Math.sin((i * Math.PI * 2) / 3) * 0.32, -0.5, Math.cos((i * Math.PI * 2) / 3) * 0.32]} s={[0.05, 0.4, 0.3]} c="#e53935" />)}
      <group ref={flame} position={[0, -0.62, 0]}>
        <mesh position={[0, -0.3, 0]} rotation-x={Math.PI}>
          <coneGeometry args={[0.22, 0.6, 10]} />
          <meshBasicMaterial color="#ff9800" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.2, 0]} rotation-x={Math.PI}>
          <coneGeometry args={[0.12, 0.4, 10]} />
          <meshBasicMaterial color="#fff59d" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

export function SkyExtras() {
  const lite = useLite()
  const calm = usePrefs((p) => p.reduceMotion) ?? systemReducedMotion()
  return (
    <>
      {!lite && <Aurora />}
      {!calm && <Meteors />}
      {!lite && <FlyBys />}
    </>
  )
}
