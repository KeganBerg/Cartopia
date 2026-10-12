import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BackSide, BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Fog, IcosahedronGeometry, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, RingGeometry, ShaderMaterial, SphereGeometry, Vector3, type InstancedMesh, type Mesh,
} from 'three'
import { weatherNow } from '../game/weather'
import { dayPhase, duskAmount, nightAmount } from './dayNight'
import { lightDir } from './look'
import { hazeColor } from './weatherLook'
import { Kit, kitMat } from './kit'
import { PAL, SEASON } from './season'
import { A_CITY, A_LAKE, A_MTN, A_WOODS, CITY, HWY0, HWY_DIR, HWY_LEN, R0, R1, SNOWLINE, TAU, angDist, buildTerrain, forest, heightAt, hwy, hwyHeight, lakeOf, polar, rail, smooth } from './horizonLand'
import { towerGlowTex, towerTex, waterTex } from './textures'
import { rand } from './RaceVenues'
import { Countryside } from './Countryside'

// The world past the edge of town, seen only from the free camera: a sky that
// follows the clock, the season and the weather, and generated country rolling
// out to the horizon. Each side has its own character so turning the camera
// round always shows something new:
//   - behind the usual view (+x +z, where building fronts face): a snowy
//     mountain range with a wind farm turning on its foothills
//   - ahead of it (-x -z): patchwork farmland, a highway and a distant city
//     whose windows light up at night
//   - left (-x +z): a big lake between wooded hills
//   - right (+x -z): forested hills with hot-air balloons drifting over them
// Everything is built once, instanced, and only mounted in free view, so the
// bird's-eye town pays nothing for it.

// Built once per page, the first time the free view opens.
let made: ReturnType<typeof buildWorld> | null = null
function buildWorld(small: boolean) {
  const terrain = buildTerrain()
  // Trees: dense where the forest noise says so, never in fields, water, the city or on the road.
  const r = rand(77)
  const pines: Spot[] = []
  const oaks: Spot[] = []
  const want = small ? 1300 : 2600
  for (let tries = 0; tries < want * 12 && pines.length + oaks.length < want; tries++) {
    const rr = 200 + r() ** 1.3 * 640
    const a = r() * TAU
    const [x, z] = polar(rr, a)
    const f = forest(x, z)
    if (f < 0.62 || r() > (f - 0.5) * 2.4) continue
    if (lakeOf(x, z) < 1.15 || hwy(x, z).d < 24 || rail(x, z).d < 16 || Math.hypot(x - CITY[0], z - CITY[1]) < 200) continue
    const farm = 1 - smooth(0.55, 1.15, angDist(Math.atan2(z, x), A_CITY))
    if (farm > 0.3 && rr > 230 && rr < 700 && r() < 0.85) continue
    const y = heightAt(x, z)
    const slope = Math.hypot(heightAt(x + 2, z) - y, heightAt(x, z + 2) - y) / 2
    if (slope > 0.7 || y > SNOWLINE - 10 + (SEASON === 'winter' ? 400 : 0) || y > 150) continue
    const s = 3.6 + r() * 3.4 + rr / 260
    const high = y > 45 || SEASON === 'winter' || r() < 0.45
    ;(high ? pines : oaks).push({ x, y: y - 0.3, z, s, ry: r() * TAU, tint: r() })
  }
  // Wind turbines along the mountain foothills.
  const turbines: Spot[] = []
  for (let i = 0; i < 9; i++) {
    const a = A_MTN - 0.42 + i * 0.105 + (r() - 0.5) * 0.03
    const rr = 345 + (i % 2) * 40 + r() * 15
    const [x, z] = polar(rr, a)
    turbines.push({ x, y: heightAt(x, z) - 0.5, z, s: 1, ry: 0, tint: r() })
  }
  // City: towers tallest in the middle, many stepping back in tiers near the top,
  // a ring of low blocks round their feet, so the skyline has depth rather than a row of boxes.
  const towers: Tower[] = []
  for (let i = 0; i < (small ? 46 : 70); i++) {
    const rr = 120 * Math.sqrt(r())
    const a = r() * TAU
    const mid = 1 - rr / 120
    const slim = r() < 0.3
    const w = slim ? 10 + r() * 6 : 14 + r() * 16
    const d = w * (0.7 + r() * 0.5)
    const h = 22 + r() * 40 + mid * mid * 120
    const x = CITY[0] + Math.cos(a) * rr * 1.5, z = CITY[1] + Math.sin(a) * rr
    const c = Math.floor(r() * 99)
    towers.push({ x, z, w, d, h, c, y: 2 })
    // Setbacks: one or two narrower tiers on the taller towers.
    if (h > 55 && r() < 0.75) {
      const h2 = h * (0.12 + r() * 0.1)
      towers.push({ x, z, w: w * 0.72, d: d * 0.72, h: h2, c, y: 2 + h })
      if (h > 110 && r() < 0.7) towers.push({ x, z, w: w * 0.45, d: d * 0.45, h: h * 0.08, c, y: 2 + h + h2 })
    } else if (r() < 0.6) {
      // Plant rooms and water tanks on the lower roofs.
      towers.push({ x: x + w * 0.15, z, w: w * 0.35, d: d * 0.3, h: 3.5, c: 3, y: 2 + h })
    }
  }
  for (let i = 0; i < (small ? 34 : 60); i++) {
    const a = r() * TAU
    const rr = 125 + r() * 75
    const w = 16 + r() * 22
    towers.push({ x: CITY[0] + Math.cos(a) * rr * 1.5, z: CITY[1] + Math.sin(a) * rr, w, d: w * (0.6 + r() * 0.6), h: 7 + r() * 18, c: Math.floor(r() * 99), y: 2 })
  }
  return { terrain, pines, oaks, turbines, towers }
}
const world = (small: boolean) => (made ??= buildWorld(small))

type Spot = { x: number; y: number; z: number; s: number; ry: number; tint: number }
type Tower = { x: number; z: number; w: number; d: number; h: number; c: number; y: number }

// Kept in step with the sky so fog fades the hills into the horizon colour.
const skyHorizon = new Color('#cfe6f7')

export function Horizon() {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  const w = useMemo(() => world(small), [small])
  return (
    <group>
      <Sky small={small} />
      <FarFog />
      <mesh geometry={w.terrain} raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={0.95} flatShading />
      </mesh>
      <Water />
      <Trees spots={w.pines} kind="pine" />
      <Trees spots={w.oaks} kind="oak" />
      <Highway small={small} />
      <City towers={w.towers} />
      <WindFarm spots={w.turbines} />
      <Balloons />
      <Countryside small={small} />
    </group>
  )
}

// ---- Sky ----------------------------------------------------------------------

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w * 0.99999;
}`

const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uMoonDir;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform float uNight;
uniform float uDusk;
uniform float uCover;
uniform float uTime;
uniform vec2 uWind;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < OCTAVES; i++) { v += a * noise(p); p = p * 2.07 + 17.3; a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  float up = max(y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.38));
  // Golden-hour glow along the horizon on the sun's side.
  vec2 sxz = normalize(uSunDir.xz + 1e-4);
  float side = max(dot(normalize(d.xz + 1e-4), sxz), 0.0);
  col = mix(col, uGlow, uDusk * pow(side, 2.5) * pow(1.0 - up, 5.0) * 0.85);
  float s = max(dot(d, uSunDir), 0.0);
  float clear = 1.0 - uCover * 0.9;
  col += uSunCol * (smoothstep(0.9988, 0.9993, s) * 4.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.12) * (1.0 - uNight) * clear;
  float m = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.92, 0.94, 1.0) * (smoothstep(0.99955, 0.9997, m) * 1.6 + pow(m, 80.0) * 0.14) * uNight * clear;
  // Stars, twinkling, fading into the haze near the horizon.
  if (uNight > 0.02) {
    vec3 q = d * 210.0;
    vec3 c = floor(q);
    float h = hash(c.xy * 0.731 + c.z * 3.17);
    float star = step(0.986, h) * smoothstep(0.42, 0.0, length(fract(q) - 0.5));
    star *= 0.6 + 0.4 * sin(uTime * (2.0 + h * 5.0) + h * 40.0);
    col += vec3(star) * uNight * clear * smoothstep(0.02, 0.25, y) * 1.4;
  }
  // A layer of drifting clouds, thicker when the weather turns.
  if (y > 0.0) {
    vec2 uv = d.xz / (y + 0.1) * 1.4 + uWind * uTime;
    float n = fbm(uv);
    float cov = mix(0.52, 0.1, uCover);
    float c = smoothstep(cov, cov + 0.28, n) * smoothstep(0.0, 0.18, y);
    float lit = fbm(uv * 1.9 + 4.0);
    vec3 cc = mix(uCloudShade, uCloudLit, 0.35 + 0.65 * lit) + uSunCol * pow(s, 5.0) * 0.35 * (1.0 - uNight);
    col = mix(col, cc, c * 0.94);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

// Sky colours by time of day, nudged per season.
const SKY = {
  day: { zenith: { winter: '#6fa8e0', spring: '#4f9cec', summer: '#3a8ae6', fall: '#4a8ad8' }[SEASON], horizon: { winter: '#e0ebf4', spring: '#cbe5f7', summer: '#c4e0f6', fall: '#d6e3ec' }[SEASON] },
  dusk: { zenith: '#4a5aa6', horizon: '#f6b08a', glow: '#ff8a4a' },
  night: { zenith: '#060a22', horizon: '#1f2852' },
  cloud: { day: '#ffffff', dayShade: '#b8c3d2', dusk: '#ffc39a', duskShade: '#8a6e90', night: '#3a4166', nightShade: '#151a30', storm: '#7f8995', stormShade: '#454e59' },
}
const K = Object.fromEntries(Object.entries(SKY).flatMap(([k, v]) => Object.entries(v).map(([kk, vv]) => [`${k}.${kk}`, new Color(vv)]))) as Record<string, Color>
const sunTmp = new Vector3()
const haze = new Color()
const grey = new Color()

function Sky({ small }: { small: boolean }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        defines: { OCTAVES: small ? 3 : 4 },
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new Color() }, uHorizon: { value: new Color() }, uGlow: { value: new Color() }, uSunDir: { value: new Vector3() }, uSunCol: { value: new Color('#fff4d6') },
          uMoonDir: { value: new Vector3() }, uCloudLit: { value: new Color() }, uCloudShade: { value: new Color() }, uNight: { value: 0 }, uDusk: { value: 0 }, uCover: { value: 0 },
          uTime: { value: 0 }, uWind: { value: { x: 0.004, y: 0.0015 } },
        },
      }),
    [small],
  )
  useEffect(() => () => mat.dispose(), [mat])
  const geo = useMemo(() => new SphereGeometry(2000, 32, 16), [])
  useEffect(() => () => geo.dispose(), [geo])
  const ref = useRef<Mesh>(null)
  useFrame(({ camera, clock }) => {
    ref.current?.position.copy(camera.position)
    const phase = dayPhase()
    const n = nightAmount(phase)
    const dusk = duskAmount(phase)
    const w = weatherNow()
    const u = mat.uniforms
    u.uTime.value = clock.elapsedTime
    u.uNight.value = n
    u.uDusk.value = dusk
    // Overcast skies go grey; fog and dust bleach them towards the haze.
    const cover = Math.min(1, w.cloud * 1.05 + w.haze * 0.4)
    u.uCover.value = cover
    grey.set(w.dust > 0 ? '#c9a57a' : w.snow > 0 ? '#c3cad2' : '#8f99a4').lerp(K['night.horizon'], n * 0.85)
    const z = (u.uZenith.value as Color).copy(K['day.zenith']).lerp(K['night.zenith'], n).lerp(K['dusk.zenith'], dusk * (1 - n) * 0.8)
    const h = (u.uHorizon.value as Color).copy(K['day.horizon']).lerp(K['night.horizon'], n).lerp(K['dusk.horizon'], dusk * (1 - n * 0.6))
    z.lerp(grey, cover * 0.85)
    h.lerp(grey, cover * 0.7)
    if (w.haze > 0) h.lerp(hazeColor(haze, w, n), w.haze * 0.9)
    ;(u.uGlow.value as Color).copy(K['dusk.glow'])
    ;(u.uCloudLit.value as Color).copy(K['cloud.day']).lerp(K['cloud.night'], n).lerp(K['cloud.dusk'], dusk * (1 - n)).lerp(K['cloud.storm'], w.cloud * (1 - n * 0.7))
    ;(u.uCloudShade.value as Color).copy(K['cloud.dayShade']).lerp(K['cloud.nightShade'], n).lerp(K['cloud.duskShade'], dusk * (1 - n)).lerp(K['cloud.stormShade'], w.cloud * (1 - n * 0.7))
    // The sun sits a little lower in the sky near dusk than the light that lights the town.
    lightDir(phase, 0, sunTmp)
    sunTmp.y *= 1 - 0.75 * dusk
    ;(u.uSunDir.value as Vector3).copy(sunTmp.normalize())
    ;(u.uSunCol.value as Color).set(dusk > 0.3 ? '#ffb070' : '#fff1d0')
    ;(u.uMoonDir.value as Vector3).copy(lightDir(phase, 1, sunTmp))
    u.uWind.value.x = 0.004 + w.wind * 0.012
    // Distant hills take a little of the sky's blue (aerial perspective).
    skyHorizon.copy(h).lerp(z, 0.18)
  })
  return <mesh ref={ref} geometry={geo} material={mat} renderOrder={-10} frustumCulled={false} raycast={() => null} />
}

// Distance haze: the hills fade into the horizon colour. The town itself stays crisp.
function FarFog() {
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    const f = scene.fog
    if (!(f instanceof Fog)) return
    const h = weatherNow().haze
    f.near = 170 * (1 - 0.6 * h)
    f.far = 1700 * (1 - 0.82 * h) + 120
    f.color.copy(skyHorizon)
  })
  return null
}

// ---- Water --------------------------------------------------------------------

function Water() {
  const tex = useMemo(() => {
    const t = waterTex('horizon', 60).clone()
    t.needsUpdate = true
    return t
  }, [])
  const geo = useMemo(() => {
    const g = new RingGeometry(R0, R1, 96, 1)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const mat = useMemo(() => new MeshStandardMaterial({ map: tex, color: SEASON === 'winter' ? '#b9d4e6' : '#9fc6e0', roughness: SEASON === 'winter' ? 0.5 : 0.18, metalness: 0.1 }), [tex])
  useEffect(() => () => { geo.dispose(); mat.dispose(); tex.dispose() }, [geo, mat, tex])
  useFrame((_, dt) => {
    tex.offset.x += dt * 0.004
    tex.offset.y += dt * 0.0025
  })
  return <mesh geometry={geo} material={mat} position-y={-1.4} raycast={() => null} />
}

// ---- Trees --------------------------------------------------------------------

// Far trees are seen from hundreds of units away, so they're a few dozen
// vertices each: a cone stack or a single leaf ball on a stub of trunk. The leaves
// are white and take each instance's tint, so one model gives a whole mixed wood.
const facet = (g: BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g
  n.computeVertexNormals()
  return n
}
function farTree(kind: 'pine' | 'oak') {
  const k = new Kit()
  k.add(facet(new CylinderGeometry(1, 1, 1, 3, 1, true)), '#5d4030', 0, 0.25, 0, 0, 0.09, 0.5, 0.09)
  if (kind === 'pine') {
    const cone = facet(new ConeGeometry(1, 1, 5, 1, true))
    k.add(cone, '#ffffff', 0, 0.8, 0, 0, 0.5, 0.95, 0.5)
    k.add(cone, '#ffffff', 0, 1.3, 0, 0.6, 0.33, 0.75, 0.33)
  } else {
    k.add(facet(new IcosahedronGeometry(1, 0)), '#ffffff', 0, 1.0, 0, 0, 0.62, 0.58, 0.62)
  }
  return k.geometry()!
}
const PINE_TINTS = SEASON === 'winter' ? ['#e9f0f2', '#cfdcd6', '#b9ccc0'] : ['#2e6b30', '#3a7d3a', '#245a2a', '#41823f']
const TREE_TINTS = { pine: PINE_TINTS, oak: [...PAL.leaves] }
let treeGeo: { pine: BufferGeometry; oak: BufferGeometry } | null = null

function Trees({ spots, kind }: { spots: Spot[]; kind: 'pine' | 'oak' }) {
  const ref = useRef<InstancedMesh>(null)
  const geo = (treeGeo ??= { pine: farTree('pine'), oak: farTree('oak') })[kind]
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    const c = new Color()
    const tints = TREE_TINTS[kind]
    spots.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z)
      o.rotation.set(0, p.ry, 0)
      o.scale.set(p.s, p.s * (kind === 'pine' ? 1.35 : 1.05), p.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(tints[Math.floor(p.tint * tints.length) % tints.length]))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [spots, kind])
  if (!spots.length) return null
  return <instancedMesh ref={ref} args={[geo, kitMat, spots.length]} raycast={() => null} userData={{ noBatch: true }} />
}

// ---- Highway ------------------------------------------------------------------

// A ribbon of asphalt following the valley bed, with traffic whose lights come on after dark.
const LANES = [-2.6, -0.9, 0.9, 2.6]
function Highway({ small }: { small: boolean }) {
  const geo = useMemo(() => {
    const pos: number[] = []
    const col: number[] = []
    const asphalt = new Color(SEASON === 'winter' ? '#6b7178' : '#4b4f55')
    const line = new Color(SEASON === 'winter' ? '#d9dee2' : '#e8e2c8')
    const strip = (from: number, to: number, c: Color, lift: number) => {
      for (let s = -HWY_LEN; s < HWY_LEN; s += 12) {
        const quad = [[s, from], [s, to], [s + 12, to], [s + 12, from]].map(([ss, o]) => {
          const x = HWY0[0] + HWY_DIR[0] * ss - HWY_DIR[1] * o
          const z = HWY0[1] + HWY_DIR[1] * ss + HWY_DIR[0] * o
          return [x, hwyHeight(ss) + lift, z]
        })
        for (const k of [0, 1, 2, 0, 2, 3]) {
          pos.push(...quad[k])
          col.push(c.r, c.g, c.b)
        }
      }
    }
    strip(-4.2, 4.2, asphalt, 0.05)
    strip(-0.15, 0.15, line, 0.1)
    for (const e of [-3.8, 3.8]) strip(e - 0.1, e + 0.1, line, 0.1)
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
    g.computeVertexNormals()
    // Face up whichever way the strips were wound.
    const n = g.attributes.normal as BufferAttribute
    for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i))
    return g
  }, [])
  const mat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: 2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }), [])
  const count = small ? 24 : 40
  const cars = useMemo(() => {
    const r = rand(404)
    return Array.from({ length: count }, (_, i) => ({ lane: i % 4, s: (r() * 2 - 1) * HWY_LEN, v: 18 + r() * 14, c: ['#e53935', '#1e88e5', '#fdd835', '#eceff1', '#43a047', '#212121', '#fb8c00'][Math.floor(r() * 7)], truck: r() < 0.2 }))
  }, [count])
  const body = useRef<InstancedMesh>(null)
  const lamps = useRef<InstancedMesh>(null)
  const bodyGeo = useMemo(() => new BoxGeometry(1, 1, 1), [])
  const bodyMat = useMemo(() => new MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }), [])
  const lampMat = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), [])
  useEffect(() => () => { geo.dispose(); mat.dispose(); bodyGeo.dispose(); bodyMat.dispose(); lampMat.dispose() }, [geo, mat, bodyGeo, bodyMat, lampMat])
  useLayoutEffect(() => {
    const c = new Color()
    cars.forEach((car, i) => {
      body.current?.setColorAt(i, c.set(car.c))
      const forward = car.lane >= 2
      // Each car carries two lamps: headlights ahead, tail lights behind.
      lamps.current?.setColorAt(i * 2, c.set(forward ? '#fff6d8' : '#ff2a2a').multiplyScalar(2.2))
      lamps.current?.setColorAt(i * 2 + 1, c.set(forward ? '#ff2a2a' : '#fff6d8').multiplyScalar(2.2))
    })
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true
    if (lamps.current?.instanceColor) lamps.current.instanceColor.needsUpdate = true
  }, [cars])
  const o = useMemo(() => new Object3D(), [])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const b = body.current, l = lamps.current
    if (!b || !l) return
    const n = Math.max(nightAmount(dayPhase()), weatherNow().cloud > 0.6 ? 0.6 : 0)
    l.visible = n > 0.2
    const yaw = Math.atan2(HWY_DIR[0], HWY_DIR[1])
    cars.forEach((car, i) => {
      const dir = car.lane >= 2 ? 1 : -1
      car.s += car.v * dt * dir
      if (car.s > HWY_LEN) car.s -= HWY_LEN * 2
      if (car.s < -HWY_LEN) car.s += HWY_LEN * 2
      const off = LANES[car.lane]
      const x = HWY0[0] + HWY_DIR[0] * car.s - HWY_DIR[1] * off
      const z = HWY0[1] + HWY_DIR[1] * car.s + HWY_DIR[0] * off
      const len = car.truck ? 6 : 3
      const ht = car.truck ? 2.2 : 1.3
      const y = hwyHeight(car.s) + 0.1
      o.position.set(x, y + ht / 2, z)
      o.rotation.set(0, yaw, 0)
      o.scale.set(1.5, ht, len)
      o.updateMatrix()
      b.setMatrixAt(i, o.matrix)
      if (l.visible) {
        for (const end of [1, -1]) {
          const k = (end * dir * len) / 2 + end * dir * 0.05
          o.position.set(x + HWY_DIR[0] * k, y + 0.55, z + HWY_DIR[1] * k)
          o.scale.set(1.6, 0.4, 0.15)
          o.updateMatrix()
          l.setMatrixAt(i * 2 + (end === 1 ? 0 : 1), o.matrix)
        }
      }
    })
    b.instanceMatrix.needsUpdate = true
    if (l.visible) l.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <mesh geometry={geo} material={mat} raycast={() => null} />
      <instancedMesh ref={body} args={[bodyGeo, bodyMat, cars.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={lamps} args={[bodyGeo, lampMat, cars.length * 2]} frustumCulled={false} raycast={() => null} />
    </>
  )
}

// ---- City ---------------------------------------------------------------------

const CITY_DAY = ['#b0bec5', '#cfd8dc', '#90a4ae', '#d7ccc8', '#bcaaa4', '#9fa8da', '#b3c7d6', '#6f8aa3', '#58718a', '#e0d6c8', '#a3b8a8']
function City({ towers }: { towers: Tower[] }) {
  const ref = useRef<InstancedMesh>(null)
  const beacon = useRef<Mesh>(null)
  const mat = useMemo(() => new MeshStandardMaterial({ map: towerTex(), emissiveMap: towerGlowTex(), emissive: new Color('#ffffff'), emissiveIntensity: 0, roughness: 0.7, metalness: 0.15 }), [])
  useEffect(() => () => mat.dispose(), [mat])
  const tallest = useMemo(() => towers.reduce((a, b) => (b.y + b.h > a.y + a.h ? b : a), towers[0]), [towers])
  // Red aircraft lights on the tops of the tallest few.
  const tops = useMemo(() => [...towers].sort((a, b) => b.y + b.h - (a.y + a.h)).slice(1, 9), [towers])
  const blink = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = blink.current
    if (!m) return
    const o = new Object3D()
    tops.forEach((t, i) => {
      o.position.set(t.x, t.y + t.h + 1.2, t.z)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [tops])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    const c = new Color()
    towers.forEach((t, i) => {
      o.position.set(t.x, t.y + t.h / 2, t.z)
      o.rotation.set(0, A_CITY, 0)
      o.scale.set(t.w, t.h, t.d)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(CITY_DAY[t.c % CITY_DAY.length]))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [towers])
  useFrame(({ clock }) => {
    const n = nightAmount(dayPhase())
    mat.emissiveIntensity = Math.max(n, weatherNow().cloud * 0.4) * 1.2
    if (beacon.current) beacon.current.visible = Math.sin(clock.elapsedTime * 3) > 0.2
    if (blink.current) blink.current.visible = Math.sin(clock.elapsedTime * 2.1 + 1) > 0.1
  })
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, mat, towers.length]} raycast={() => null}>
        <boxGeometry />
      </instancedMesh>
      {/* A radio mast on the tallest tower, its red light blinking for aircraft. */}
      <mesh position={[tallest.x, tallest.y + tallest.h + 14, tallest.z]} raycast={() => null}>
        <cylinderGeometry args={[0.5, 1.4, 28, 5]} />
        <meshStandardMaterial color="#9aa3ab" />
      </mesh>
      <mesh ref={beacon} position={[tallest.x, tallest.y + tallest.h + 29, tallest.z]} raycast={() => null}>
        <sphereGeometry args={[2.2, 8, 6]} />
        <meshBasicMaterial color="#ff3030" toneMapped={false} />
      </mesh>
      <instancedMesh ref={blink} args={[undefined, undefined, tops.length]} raycast={() => null}>
        <sphereGeometry args={[1.5, 6, 4]} />
        <meshBasicMaterial color="#ff2a2a" toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

// ---- Wind farm ----------------------------------------------------------------

// Turbines face the wind together; rotors spin faster in a breeze.
const TOWER_H = 64
const BLADE = 30
function WindFarm({ spots }: { spots: Spot[] }) {
  const { tower, nacelle, rotor } = useMemo(() => {
    const t = new CylinderGeometry(1.3, 2.7, TOWER_H, 8, 1, true)
    t.translate(0, TOWER_H / 2, 0)
    const n = new BoxGeometry(4.2, 4.2, 10)
    n.translate(0, TOWER_H + 1.5, -1.5)
    // Three blades and a hub as one geometry, spinning about z.
    const parts: BufferGeometry[] = []
    for (let i = 0; i < 3; i++) {
      const b = new BoxGeometry(2.4, BLADE, 0.6)
      b.translate(0, BLADE / 2 + 1, 0)
      b.rotateZ((i / 3) * TAU)
      parts.push(b)
    }
    parts.push(new IcosahedronGeometry(2.3, 0).toNonIndexed())
    const merged = mergeSimple(parts.map((p) => (p.index ? p.toNonIndexed() : p)))
    return { tower: t, nacelle: n, rotor: merged }
  }, [])
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#f2f4f5', roughness: 0.55 }), [])
  const light = useMemo(() => new MeshBasicMaterial({ color: '#ff2020', toneMapped: false }), [])
  useEffect(() => () => { tower.dispose(); nacelle.dispose(); rotor.dispose(); mat.dispose(); light.dispose() }, [tower, nacelle, rotor, mat, light])
  const towers = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const rotors = useRef<InstancedMesh>(null)
  const lights = useRef<InstancedMesh>(null)
  // Facing roughly towards the town, so the rotors read as discs from it.
  const face = A_MTN + Math.PI
  const yaw = Math.atan2(Math.cos(face), Math.sin(face))
  useLayoutEffect(() => {
    const o = new Object3D()
    spots.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z)
      o.rotation.set(0, yaw, 0)
      o.scale.setScalar(1)
      o.updateMatrix()
      towers.current?.setMatrixAt(i, o.matrix)
      heads.current?.setMatrixAt(i, o.matrix)
      o.position.y += TOWER_H + 4.2
      o.updateMatrix()
      lights.current?.setMatrixAt(i, o.matrix)
    })
    for (const m of [towers.current, heads.current, lights.current]) {
      if (!m) continue
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
  }, [spots, yaw])
  const o = useMemo(() => new Object3D(), [])
  const spin = useRef(spots.map((p) => p.tint * TAU))
  useFrame(({ clock }, delta) => {
    const m = rotors.current
    if (!m) return
    const speed = 0.9 + weatherNow().wind * 2.2
    spots.forEach((p, i) => {
      spin.current[i] += Math.min(delta, 0.1) * speed * (0.85 + p.tint * 0.3)
      o.position.set(p.x + Math.sin(yaw) * 3.8, p.y + TOWER_H + 1.5, p.z + Math.cos(yaw) * 3.8)
      o.rotation.set(0, yaw, spin.current[i], 'YXZ')
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    if (lights.current) lights.current.visible = Math.sin(clock.elapsedTime * 2.2) > 0.3
  })
  return (
    <>
      <instancedMesh ref={towers} args={[tower, mat, spots.length]} raycast={() => null} />
      <instancedMesh ref={heads} args={[nacelle, mat, spots.length]} raycast={() => null} />
      <instancedMesh ref={rotors} args={[rotor, mat, spots.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={lights} args={[undefined, light, spots.length]} raycast={() => null}>
        <sphereGeometry args={[1.3, 6, 4]} />
      </instancedMesh>
    </>
  )
}

// Joins non-indexed geometries that only carry positions and normals.
function mergeSimple(parts: BufferGeometry[]) {
  const pos: number[] = []
  for (const p of parts) pos.push(...(p.attributes.position.array as Float32Array))
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.computeVertexNormals()
  parts.forEach((p) => p.dispose())
  return g
}

// ---- Hot-air balloons -----------------------------------------------------------

const BALLOONS = [
  { a: A_WOODS - 0.25, r: 330, y: 95, c: '#e53935', v: 0.012 },
  { a: A_WOODS + 0.1, r: 420, y: 120, c: '#fdd835', v: -0.009 },
  { a: A_WOODS + 0.42, r: 300, y: 80, c: '#1e88e5', v: 0.01 },
  { a: A_LAKE - 0.5, r: 380, y: 110, c: '#8e24aa', v: -0.011 },
]
function Balloons() {
  const env = useRef<InstancedMesh>(null)
  const band = useRef<InstancedMesh>(null)
  const basket = useRef<InstancedMesh>(null)
  const geos = useMemo(() => {
    const e = new SphereGeometry(1, 14, 10)
    e.scale(9, 11, 9)
    const b = new CylinderGeometry(9.15, 6.5, 4, 14, 1, true)
    b.translate(0, -5.5, 0)
    const k = new BoxGeometry(3.2, 2.6, 3.2)
    k.translate(0, -15, 0)
    return { e, b, k }
  }, [])
  const mats = useMemo(() => ({ env: new MeshStandardMaterial({ roughness: 0.6 }), band: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), basket: new MeshStandardMaterial({ color: '#8d6e63', roughness: 0.9 }) }), [])
  useEffect(() => () => { Object.values(geos).forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()) }, [geos, mats])
  useLayoutEffect(() => {
    const c = new Color()
    BALLOONS.forEach((b, i) => env.current?.setColorAt(i, c.set(b.c)))
    if (env.current?.instanceColor) env.current.instanceColor.needsUpdate = true
  }, [])
  const o = useMemo(() => new Object3D(), [])
  useFrame(({ clock }) => {
    const n = nightAmount(dayPhase())
    const w = weatherNow()
    // They only fly in fair weather, by day.
    const show = n < 0.5 && w.rain < 0.2 && w.snow < 0.2 && w.wind < 0.6
    for (const m of [env.current, band.current, basket.current]) if (m) m.visible = show
    if (!show) return
    const t = clock.elapsedTime
    BALLOONS.forEach((b, i) => {
      const a = b.a + Math.sin(t * b.v * 3 + i) * 0.08 + t * b.v * 0.1
      const [x, z] = polar(b.r, a)
      o.position.set(x, b.y + Math.sin(t * 0.3 + i * 2) * 4, z)
      o.rotation.set(0, t * 0.05 + i, 0)
      o.updateMatrix()
      for (const m of [env.current, band.current, basket.current]) m?.setMatrixAt(i, o.matrix)
    })
    for (const m of [env.current, band.current, basket.current]) if (m) m.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={env} args={[geos.e, mats.env, BALLOONS.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={band} args={[geos.b, mats.band, BALLOONS.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={basket} args={[geos.k, mats.basket, BALLOONS.length]} frustumCulled={false} raycast={() => null} />
    </>
  )
}
