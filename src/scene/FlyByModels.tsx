import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute, BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Euler, Matrix4, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion,
  ShaderMaterial, SphereGeometry, TorusGeometry, Vector3, BoxGeometry, type Group, type Mesh, type Object3D,
} from 'three'
import { bake, bakedMaterial, type Finish } from './bake'
import { signTexture } from './signTexture'
import { heliParts, rotorStep, TAIL_RATIO } from './ServiceVehicles'
import { dayPhase, nightAmount } from './dayNight'
import { reduceMotionOn } from '../lib/prefs'
import { calmFlashing } from '../game/flashing'

// The craft that fly over the town (SkyExtras.tsx): airliners in made-up
// liveries, a banner plane towing a message, a news helicopter, the CARTOPIA
// blimp and a cartoon rocket. Each body is baked (bake.ts) into one mesh drawn
// with one shared material, so a detailed craft is one draw plus its moving
// bits (props, rotor, blinking lights). All fly nose first along +z. Only one is
// ever up at a time, and the rest are hidden, so they cost nothing.

type V3 = [number, number, number]
type Part = [BufferGeometry, Finish, Matrix4?]
const NO_RAY = () => null
const at = (p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) =>
  new Matrix4().compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(r[0], r[1], r[2], 'YXZ')), new Vector3(...s))

export const flyMat = bakedMaterial()
const signMat = (text: string, bg: string, fg: string, aspect: number) => bakedMaterial(false, signTexture(text, bg, fg, aspect))

// ---------- parts ----------
const BOX = new BoxGeometry(1, 1, 1)
const box = (f: Finish, s: V3, p: V3, r?: V3): Part => [BOX, f, at(p, r, s)]
const sph = (f: Finish, p: V3, s: V3, w = 20, h = 12): Part => [new SphereGeometry(1, w, h), f, at(p, [0, 0, 0], s)]
// A tube along z from z0 (radius rb) to z1 (radius rt), its axis at height y.
const tube = (f: Finish, rt: number, rb: number, z0: number, z1: number, x = 0, y = 0, n = 16): Part =>
  [new CylinderGeometry(rt, rb, z1 - z0, n), f, at([x, y, (z0 + z1) / 2], [Math.PI / 2, 0, 0])]
// A rod between two points.
function rod(f: Finish, a: V3, b: V3, r: number, n = 6): Part {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const len = d.length()
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize())
  return [new CylinderGeometry(r, r, len, n), f, new Matrix4().compose(new Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new Vector3(1, 1, 1))]
}
// A strip of a tube's skin (livery bands): theta 0 is underneath, PI/2 the right (+x) side.
const band = (f: Finish, r: number, z0: number, z1: number, t0: number, t1: number, y = 0): Part =>
  [new CylinderGeometry(r, r, z1 - z0, 24, 1, true, t0, t1 - t0), f, at([0, y, (z0 + z1) / 2], [Math.PI / 2, 0, 0])]

// A closed solid lofted between two outlines with matching corners. Faces are
// turned to face out from the middle, so either hand of a wing comes out right.
function loft(a: V3[], b: V3[]) {
  const pts: V3[] = []
  const c = new Vector3()
  for (const p of [...a, ...b]) c.add(new Vector3(...p))
  c.divideScalar(a.length + b.length)
  const tri = (p: V3, q: V3, r: V3) => {
    const P = new Vector3(...p), Q = new Vector3(...q), R = new Vector3(...r)
    const n = Q.clone().sub(P).cross(R.clone().sub(P))
    const mid = P.clone().add(Q).add(R).divideScalar(3).sub(c)
    if (n.dot(mid) < 0) pts.push(p, r, q)
    else pts.push(p, q, r)
  }
  const n = a.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    tri(a[i], a[j], b[j])
    tri(a[i], b[j], b[i])
  }
  for (let i = 1; i < n - 1; i++) {
    tri(a[0], a[i], a[i + 1])
    tri(b[0], b[i], b[i + 1])
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pts.flat()), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array(pts.length * 2), 2))
  g.computeVertexNormals()
  return g
}

// A tapered, swept wing (or fin, or tailplane) with an airfoil-ish section:
// its root at the origin, leading edge first (+z), reaching `span` along x
// (sd -1: along -x), its tip raised by `lift`. `sym`: the same both faces (fins).
function wing(root: number, tip: number, span: number, sweep: number, thick: number, { lift = 0, sd = 1, sym = false, tipThick = thick * 0.45 } = {}) {
  const sec = (x: number, y: number, le: number, chord: number, t: number): V3[] => [
    [x, y, le], [x, y + t * 0.5, le - chord * 0.3], [x, y, le - chord], [x, y - t * (sym ? 0.5 : 0.22), le - chord * 0.35],
  ]
  return loft(sec(0, 0, 0, root, thick), sec(sd * span, lift, -sweep, tip, tipThick))
}
const piece = (g: BufferGeometry, f: Finish, p: V3, r?: V3): Part => [g, f, at(p, r)]

// ---------- airliner ----------
// Body 2.5 long, wings 2.3 across: the size of the old plane, so it flies at the same scale.
export const LIVERIES = [
  { tail: '#1565c0', stripe: '#1e88e5', accent: '#ffca28' },
  { tail: '#e65100', stripe: '#fb8c00', accent: '#ffe082' },
  { tail: '#00796b', stripe: '#26a69a', accent: '#ffffff' },
  { tail: '#b71c1c', stripe: '#e53935', accent: '#ffffff' },
  { tail: '#4527a0', stripe: '#7e57c2', accent: '#ffca28' },
]
const R = 0.16
const WING = { x: 0.1, y: -0.08, le: 0.42, root: 0.6, tip: 0.16, span: 1.05, sweep: 0.5, lift: 0.08 }
const wingAt = (x: number) => {
  const u = (x - WING.x) / WING.span
  const le = WING.le - WING.sweep * u
  return { le, te: le - (WING.root + (WING.tip - WING.root) * u), y: WING.y + WING.lift * u }
}
const TAIL_A = Math.PI / 2 + 0.16
const TAIL_DIR = new Vector3(0, Math.cos(TAIL_A), Math.sin(TAIL_A))
const TAIL_H = 0.52
const tailEnd = new Vector3(0, 0, -0.75).addScaledVector(TAIL_DIR, -TAIL_H)

const airliners = new Map<number, BufferGeometry>()
export function airlinerGeo(i: number) {
  const hit = airliners.get(i)
  if (hit) return hit
  const L = LIVERIES[i % LIVERIES.length]
  const white: Finish = { color: '#f2f4f6', metal: 0.25, rough: 0.38 }
  const belly: Finish = { color: '#b8c3cb', metal: 0.3, rough: 0.45 }
  const tail: Finish = { color: L.tail, metal: 0.2, rough: 0.4 }
  const stripe: Finish = { color: L.stripe, metal: 0.2, rough: 0.4 }
  const accent: Finish = { color: L.accent, rough: 0.45 }
  const glass: Finish = { color: '#1b2833', metal: 0.7, rough: 0.12 }
  const wingF: Finish = { color: '#dce2e7', metal: 0.4, rough: 0.4 }
  const flap: Finish = { color: '#aab4bc', metal: 0.4, rough: 0.45 }
  const cowl: Finish = { color: '#e3e8ec', metal: 0.55, rough: 0.28 }
  const dark: Finish = { color: '#262f36', metal: 0.5, rough: 0.5 }
  const chrome: Finish = { color: '#c9d1d8', metal: 0.9, rough: 0.2 }
  const red: Finish = { color: '#ff2a2a', unlit: true }
  const green: Finish = { color: '#2aff6a', unlit: true }
  const lamp: Finish = { color: '#ffffff', unlit: true }
  const parts: Part[] = [
    // Fuselage, rounded nose, tail cone sweeping up to the tail.
    tube(white, R, R, -0.75, 0.85, 0, 0, 28),
    sph(white, [0, 0, 0.85], [R, R * 0.96, 0.34], 28, 16),
    [new CylinderGeometry(R, 0.045, TAIL_H, 24), white, at([0, TAIL_DIR.y * -TAIL_H / 2, -0.75 - TAIL_DIR.z * TAIL_H / 2], [TAIL_A, 0, 0])],
    sph(white, [tailEnd.x, tailEnd.y, tailEnd.z], [0.045, 0.045, 0.06], 12, 8),
    // Wing-to-body fairing.
    sph(belly, [0, -0.1, 0.13], [0.15, 0.075, 0.44], 20, 10),
    // Livery: grey belly, a cheatline in two colours down each side.
    band(belly, R + 0.004, -0.72, 0.8, -0.85, 0.85),
    ...[1, -1].flatMap((sd): Part[] => {
      const t = (a: number, b: number): [number, number] => (sd > 0 ? [a, b] : [-b, -a])
      return [
        band(stripe, R + 0.004, -0.72, 0.8, ...t(Math.PI / 2 + 0.1, Math.PI / 2 + 0.22)),
        band(accent, R + 0.004, -0.72, 0.8, ...t(Math.PI / 2 - 0.04, Math.PI / 2 + 0.05)),
      ]
    }),
    // A row of cabin windows each side, the doors marked by a gap.
    ...[1, -1].flatMap((sd) => {
      const th = sd * (Math.PI / 2 + 0.36)
      const r = R + 0.003
      const out: Part[] = []
      for (let z = -0.6; z <= 0.62; z += 0.062) {
        if (Math.abs(z - 0.02) < 0.04) continue
        out.push(box(glass, [0.012, 0.026, 0.022], [r * Math.sin(th), -r * Math.cos(th), z], [0, 0, th - Math.PI / 2]))
      }
      // Doors: a darker outline front and back.
      for (const z of [0.7, -0.68]) out.push(box({ color: '#c3ccd3', metal: 0.3, rough: 0.4 }, [0.01, 0.075, 0.045], [(R + 0.004) * Math.sin(th), -(R + 0.004) * Math.cos(th), z], [0, 0, th - Math.PI / 2]))
      return out
    }),
    // Flight deck windows wrapped round the nose, a pillar down the middle.
    ...[[Math.PI / 2 - 0.75, 0.68], [Math.PI / 2 + 0.07, 0.68], [Math.PI / 2 - 1.2, 0.36], [Math.PI / 2 + 0.84, 0.36]].map(([p0, pl]): Part =>
      [new SphereGeometry(1, 8, 4, p0, pl, 0.9, 0.32), glass, at([0, 0, 0.85], [0, 0, 0], [R * 1.03, R * 0.96 * 1.03, 0.34 * 1.03])]),
    // Wings with flaps, ailerons, flap-track fairings and winglets.
    ...[1, -1].flatMap((sd): Part[] => {
      const tip = wingAt(WING.x + WING.span)
      const f0 = wingAt(0.16), f1 = wingAt(0.66), a0 = wingAt(0.7), a1 = wingAt(1.02)
      return [
        piece(wing(WING.root, WING.tip, WING.span, WING.sweep, 0.075, { lift: WING.lift, sd }), wingF, [sd * WING.x, WING.y, WING.le]),
        piece(wing(0.11, 0.1, 0.5, f0.te - f1.te, 0.03, { lift: f1.y - f0.y, sd, tipThick: 0.026 }), flap, [sd * 0.16, f0.y + 0.002, f0.te + 0.075]),
        piece(wing(0.09, 0.07, 0.32, a0.te - a1.te, 0.022, { lift: a1.y - a0.y, sd, tipThick: 0.018 }), flap, [sd * 0.7, a0.y + 0.002, a0.te + 0.06]),
        ...[0.3, 0.52].map((x): Part => sph(belly, [sd * x, wingAt(x).y - 0.025, wingAt(x).te + 0.03], [0.022, 0.026, 0.14], 10, 6)),
        piece(wing(WING.tip, 0.07, 0.17, 0.1, 0.02, { sym: true }), tail, [sd * (WING.x + WING.span - 0.01), tip.y, tip.le - 0.005], [0, 0, sd * (Math.PI / 2 - 0.25)]),
        // Nav lights: red on the left (+x) wingtip, green on the right.
        sph(sd > 0 ? red : green, [sd * (WING.x + WING.span + 0.012), tip.y + 0.005, tip.le - 0.05], [0.028, 0.028, 0.028], 8, 6),
      ]
    }),
    // Two engines: nacelle, intake lip, fan, spinner, exhaust and pylon.
    ...[1, -1].flatMap((sd): Part[] => {
      const x = sd * 0.45, w = wingAt(0.45), y = w.y - 0.12
      return [
        tube(cowl, 0.082, 0.07, 0.1, 0.5, x, y, 20),
        [new TorusGeometry(0.076, 0.012, 6, 20), chrome, at([x, y, 0.5])],
        tube(dark, 0.074, 0.074, 0.46, 0.49, x, y, 16),
        [new ConeGeometry(0.028, 0.06, 10), chrome, at([x, y, 0.515], [Math.PI / 2, 0, 0])],
        tube(stripe, 0.0855, 0.0855, 0.3, 0.36, x, y, 20),
        tube(dark, 0.06, 0.04, 0.0, 0.1, x, y, 14),
        [new ConeGeometry(0.035, 0.08, 10), dark, at([x, y, -0.03], [-Math.PI / 2, 0, 0])],
        box(wingF, [0.024, 0.08, 0.3], [x, y + 0.075, 0.28]),
      ]
    }),
    // Tailplanes (with elevators) and the fin in the airline's colour, its rudder and badge.
    ...[1, -1].flatMap((sd): Part[] => [
      piece(wing(0.28, 0.11, 0.42, 0.24, 0.035, { lift: 0.04, sd }), white, [sd * 0.04, 0.05, -0.9]),
      piece(wing(0.07, 0.05, 0.36, 0.06, 0.016, { lift: 0.034, sd, tipThick: 0.012 }), flap, [sd * 0.08, 0.054, -1.14]),
    ]),
    piece(wing(0.45, 0.19, 0.56, 0.36, 0.044, { sym: true }), tail, [0, 0.06, -0.78], [0, 0, Math.PI / 2]),
    piece(wing(0.1, 0.08, 0.5, 0.13, 0.03, { sym: true, tipThick: 0.018 }), stripe, [0, 0.1, -1.15], [0, 0, Math.PI / 2]),
    [new CylinderGeometry(0.075, 0.075, 0.046, 18), accent, at([0, 0.33, -1.11], [0, 0, Math.PI / 2])],
    [new CylinderGeometry(0.045, 0.045, 0.05, 14), tail, at([0, 0.33, -1.11], [0, 0, Math.PI / 2])],
    // White tail light, beacon mounts and antennas.
    sph(lamp, [tailEnd.x, tailEnd.y, tailEnd.z - 0.06], [0.022, 0.022, 0.022], 8, 6),
    box(dark, [0.01, 0.05, 0.035], [0, R + 0.02, 0.3], [-0.4, 0, 0]),
    box(dark, [0.01, 0.04, 0.03], [0, -R - 0.015, -0.3], [0.4, 0, 0]),
  ]
  const g = bake(parts)
  airliners.set(i, g)
  return g
}

// A contrail behind each engine: a soft ribbon, crossed so it reads from any angle.
const TRAIL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  // Thin at the engine, spreading out behind.
  p.xy *= mix(0.25, 1.0, uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const TRAIL_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
  float a = smoothstep(0.0, 0.06, vUv.y) * pow(1.0 - vUv.y, 1.6) * across * across;
  gl_FragColor = vec4(vec3(1.0), a * uOpacity);
  #include <colorspace_fragment>
}
`
const TRAIL_LEN = 7
function trailMesh() {
  // Ribbons are built round their own engine's axis, so spreading them is a scale about that axis.
  const geos = [0, Math.PI / 2].map((rz) => {
    const g = new PlaneGeometry(0.24, TRAIL_LEN, 1, 8)
    g.rotateX(-Math.PI / 2)
    g.rotateZ(rz)
    g.translate(0, 0, -TRAIL_LEN / 2)
    const pos = g.getAttribute('position'), uv = g.getAttribute('uv')
    for (let i = 0; i < pos.count; i++) uv.setY(i, -pos.getZ(i) / TRAIL_LEN)
    return g
  })
  return geos
}
export function Airliner({ livery }: { livery: { current: number } }) {
  const body = useRef<Mesh>(null)
  const strobe = useRef<Group>(null)
  const beacon = useRef<Group>(null)
  const root = useRef<Group>(null)
  const trail = useMemo(() => {
    const m = new ShaderMaterial({ vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthWrite: false, side: DoubleSide, fog: false, uniforms: { uOpacity: { value: 0.5 } } })
    return { m, geos: trailMesh() }
  }, [])
  useFrame(({ clock }) => {
    if (!shown(root.current)) return
    const t = clock.elapsedTime
    if (body.current) body.current.geometry = airlinerGeo(livery.current)
    // Strobes and beacons, steady when motion or flashing is reduced.
    const calm = reduceMotionOn() || calmFlashing()
    if (strobe.current) strobe.current.visible = calm || (t * 0.9) % 1 < 0.08
    if (beacon.current) beacon.current.visible = calm || (t * 0.7 + 0.5) % 1 < 0.35
    // Contrails show best against a day sky.
    trail.m.uniforms.uOpacity.value = 0.55 * (1 - 0.85 * nightAmount(dayPhase()))
  })
  return (
    <group ref={root}>
      <mesh ref={body} geometry={airlinerGeo(0)} material={flyMat} raycast={NO_RAY} />
      {[0.45, -0.45].flatMap((x) => trail.geos.map((g, i) => <mesh key={`${x}${i}`} geometry={g} material={trail.m} position={[x, wingAt(0.45).y - 0.12, -0.05]} raycast={NO_RAY} renderOrder={2} />))}
      <group ref={strobe}>
        {[1, -1].map((sd) => <Light key={sd} p={[sd * (WING.x + WING.span + 0.01), wingAt(1.15).y, wingAt(1.15).te + 0.01]} c="#ffffff" r={0.05} />)}
        <Light p={[tailEnd.x, tailEnd.y + 0.01, tailEnd.z - 0.09]} c="#ffffff" r={0.05} />
      </group>
      <group ref={beacon}>
        <Light p={[0, R + 0.05, 0.05]} c="#ff3030" r={0.045} />
        <Light p={[0, -R - 0.05, 0.0]} c="#ff3030" r={0.045} />
      </group>
    </group>
  )
}

// ---------- banner plane ----------
// A little high-wing taildragger, about 1.2 long, towing a banner on a line.
const bannerPlane = (() => {
  const paint: Finish = { color: '#ffc928', metal: 0.15, rough: 0.4 }
  const trim: Finish = { color: '#d32f2f', metal: 0.15, rough: 0.4 }
  const glass: Finish = { color: '#22313d', metal: 0.7, rough: 0.12 }
  const dark: Finish = { color: '#2b3238', metal: 0.3, rough: 0.6 }
  const steel: Finish = { color: '#b0bec5', metal: 0.8, rough: 0.3 }
  const tyre: Finish = { color: '#1c1f22', rough: 0.9 }
  const red: Finish = { color: '#ff2a2a', unlit: true }
  const green: Finish = { color: '#2aff6a', unlit: true }
  const parts: Part[] = [
    // Cowling, cabin, the fuselage tapering back to the tail.
    tube(paint, 0.085, 0.1, 0.36, 0.56, 0, 0.0, 16),
    tube(trim, 0.078, 0.086, 0.555, 0.59, 0, 0.0, 16),
    box(paint, [0.2, 0.24, 0.36], [0, 0.03, 0.18]),
    [new CylinderGeometry(0.1, 0.035, 0.6, 8), paint, at([0, 0.03, -0.3], [Math.PI / 2 - 0.06, Math.PI / 8, 0])],
    box(trim, [0.208, 0.03, 0.36], [0, -0.04, 0.18]),
    box(glass, [0.17, 0.13, 0.012], [0, 0.11, 0.38], [-0.62, 0, 0]),
    ...[1, -1].flatMap((sd): Part[] => [
      box(glass, [0.008, 0.09, 0.13], [sd * 0.102, 0.08, 0.26]),
      box(glass, [0.008, 0.08, 0.1], [sd * 0.102, 0.08, 0.08]),
      // Exhaust stub under the cowl.
      rod(dark, [sd * 0.05, -0.08, 0.42], [sd * 0.06, -0.11, 0.34], 0.012),
    ]),
    // High wing on the cabin roof, red tips, struts down to the fuselage.
    ...[1, -1].flatMap((sd): Part[] => [
      piece(wing(0.24, 0.22, 0.72, 0.01, 0.04, { lift: 0.03, sd }), paint, [0, 0.15, 0.33]),
      box(trim, [0.07, 0.03, 0.235], [sd * 0.69, 0.18, 0.217]),
      sph(sd > 0 ? red : green, [sd * 0.73, 0.18, 0.25], [0.022, 0.022, 0.022], 8, 6),
      rod(steel, [sd * 0.1, -0.06, 0.24], [sd * 0.42, 0.155, 0.27], 0.009),
      rod(steel, [sd * 0.1, -0.06, 0.12], [sd * 0.42, 0.155, 0.15], 0.009),
      // Main gear: leg, wheel, hub.
      rod(steel, [sd * 0.08, -0.08, 0.28], [sd * 0.2, -0.27, 0.3], 0.012),
      rod(steel, [sd * 0.08, -0.08, 0.16], [sd * 0.2, -0.27, 0.3], 0.01),
      [new CylinderGeometry(0.065, 0.065, 0.045, 14), tyre, at([sd * 0.22, -0.28, 0.3], [0, 0, Math.PI / 2])],
      [new CylinderGeometry(0.028, 0.028, 0.05, 10), trim, at([sd * 0.22, -0.28, 0.3], [0, 0, Math.PI / 2])],
      // Tailplane.
      piece(wing(0.18, 0.12, 0.27, 0.04, 0.022, { sd }), paint, [sd * 0.02, 0.05, -0.43]),
    ]),
    // Fin and rudder stripe, tail wheel.
    piece(wing(0.22, 0.11, 0.24, 0.08, 0.022, { sym: true }), trim, [0, 0.05, -0.4], [0, 0, Math.PI / 2]),
    rod(steel, [0, -0.0, -0.55], [0, -0.07, -0.6], 0.008),
    [new CylinderGeometry(0.025, 0.025, 0.02, 10), tyre, at([0, -0.08, -0.6], [0, 0, Math.PI / 2])],
    // Towing hook and the line back to the banner, its bridle and pole.
    rod(dark, [0, -0.03, -0.6], [0, -0.32, -1.45], 0.006, 4),
    rod(dark, [0, -0.32, -1.45], [0, -0.13, -1.55], 0.005, 4),
    rod(dark, [0, -0.32, -1.45], [0, -0.55, -1.55], 0.005, 4),
    rod(steel, [0, -0.11, -1.55], [0, -0.57, -1.55], 0.012),
  ]
  return bake(parts)
})()
const propGeo = (() => {
  const blade: Finish = { color: '#2b3238', metal: 0.4, rough: 0.5 }
  const tipF: Finish = { color: '#fdd835', rough: 0.5 }
  return bake([
    ...[1, -1].flatMap((sd): Part[] => [
      box(blade, [0.035, 0.2, 0.012], [0, sd * 0.11, 0], [0, 0, 0]),
      box(tipF, [0.036, 0.03, 0.013], [0, sd * 0.2, 0]),
    ]),
    [new ConeGeometry(0.04, 0.08, 12), { color: '#d32f2f', metal: 0.3, rough: 0.35 }, at([0, 0, 0.03], [Math.PI / 2, 0, 0])],
  ])
})()

// The banner: segments that ripple in the wind, a face each side so both read right.
export const BANNERS = ['VISIT CARTOPIA', 'RACE TONIGHT!', 'HONK IF YOU DRIFT', 'OPEN A CRATE!']
const BAN = { len: 2.3, h: 0.44, z: -1.56, y: -0.34, seg: 24 }
function bannerFace(sd: 1 | -1) {
  const g = new PlaneGeometry(BAN.len, BAN.h, BAN.seg, 1)
  // +x face: the text runs back from the pole. -x face: its mirror, so it reads too.
  g.rotateY(sd > 0 ? Math.PI / 2 : -Math.PI / 2)
  g.translate(0, BAN.y, BAN.z - BAN.len / 2)
  return g
}

export function BannerPlane({ message }: { message: { current: number } }) {
  const root = useRef<Group>(null)
  const prop = useRef<Mesh>(null)
  const strobe = useRef<Mesh>(null)
  const faces = useMemo(() => [bannerFace(1), bannerFace(-1)], [])
  const rest = useMemo(() => faces.map((g) => Float32Array.from(g.getAttribute('position').array)), [faces])
  const mat = useMemo(() => new MeshStandardMaterial({ map: signTexture(BANNERS[0], '#ffffff', '#d32f2f', 5.2), roughness: 0.9 }), [])
  useFrame(({ clock }, dt) => {
    if (!shown(root.current)) return
    const t = clock.elapsedTime
    const want = signTexture(BANNERS[message.current % BANNERS.length], '#ffffff', '#d32f2f', 5.2)
    if (mat.map !== want) {
      mat.map = want
      mat.needsUpdate = true
    }
    if (prop.current) prop.current.rotation.z += Math.min(dt, 0.1) * 45
    if (strobe.current) strobe.current.visible = reduceMotionOn() || calmFlashing() || t % 1.2 < 0.08
    // Ripples run back along the banner, growing towards its free end.
    const amp = reduceMotionOn() ? 0.02 : 0.06
    faces.forEach((g, k) => {
      const pos = g.getAttribute('position') as BufferAttribute
      const r = rest[k]
      for (let i = 0; i < pos.count; i++) {
        const d = BAN.z - r[i * 3 + 2]
        pos.setX(i, (k ? -0.004 : 0.004) + amp * d * Math.sin(d * 4.5 - t * 9))
      }
      pos.needsUpdate = true
      g.computeVertexNormals()
    })
  })
  return (
    <group ref={root}>
      <mesh geometry={bannerPlane} material={flyMat} raycast={NO_RAY} />
      <mesh ref={prop} geometry={propGeo} material={flyMat} position={[0, 0, 0.6]} raycast={NO_RAY} />
      <Disc p={[0, 0, 0.605]} r={0.22} />
      {faces.map((g, i) => <mesh key={i} geometry={g} material={mat} raycast={NO_RAY} />)}
      <mesh ref={strobe} position={[0, 0.3, -0.46]} raycast={NO_RAY}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------- news helicopter ----------
// The heliport's helicopter (ServiceVehicles.tsx) in news-crew colours, rotor turning.
const NEWS = { body: '#f2f4f6', stripe: '#1e88e5' }
// Its camera ball under the chin and a searchlight.
const newsKit = bake([
  rod({ color: '#37474f', metal: 0.6, rough: 0.4 }, [0, 0.2, 0.42], [0, 0.12, 0.46], 0.02),
  sph({ color: '#263238', metal: 0.5, rough: 0.3 }, [0, 0.1, 0.47], [0.07, 0.07, 0.07], 14, 10),
  sph({ color: '#0d47a1', metal: 0.9, rough: 0.05 }, [0, 0.1, 0.53], [0.035, 0.035, 0.02], 12, 8),
  [new CylinderGeometry(0.035, 0.045, 0.08, 12), { color: '#90a4ae', metal: 0.8, rough: 0.3 }, at([0.18, 0.18, 0.25], [Math.PI / 2, 0, 0])],
  [new CircleGeometry(0.034, 12), { color: '#fff8e1', unlit: true }, at([0.18, 0.18, 0.291])],
])
export function NewsHeli() {
  const root = useRef<Group>(null)
  const rotor = useRef<Mesh>(null)
  const tail = useRef<Mesh>(null)
  const beacon = useRef<Mesh>(null)
  const body = useMemo(() => heliParts.body(NEWS), [])
  useFrame(({ clock }, dt) => {
    if (!shown(root.current)) return
    const step = rotorStep(dt)
    if (rotor.current) rotor.current.rotation.y += step
    if (tail.current) tail.current.rotation.x += step * TAIL_RATIO
    if (beacon.current) {
      const b = clock.elapsedTime % 1.5
      beacon.current.visible = reduceMotionOn() || calmFlashing() || b < 0.08 || (b > 0.22 && b < 0.3)
    }
  })
  return (
    <group ref={root}>
      <mesh geometry={body} material={heliParts.mat} raycast={NO_RAY} />
      <mesh geometry={newsKit} material={flyMat} raycast={NO_RAY} />
      <mesh ref={rotor} geometry={heliParts.blades} material={heliParts.mat} position-y={0.92} raycast={NO_RAY} />
      <Disc p={[0, 0.925, 0]} r={1.0} flat />
      <mesh ref={tail} geometry={heliParts.tail} material={heliParts.mat} position={[0.05, 0.72, -1.22]} raycast={NO_RAY} />
      <Light p={[0.21, 0.55, -1.0]} c="#ff2a2a" r={0.025} />
      <Light p={[-0.21, 0.55, -1.0]} c="#2aff6a" r={0.025} />
      <mesh ref={beacon} position={[0, 0.2, 0]} raycast={NO_RAY}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshBasicMaterial color="#ff3030" toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------- blimp ----------
// The CARTOPIA blimp: 3.4 long, its gondola slung underneath, cross tail, pusher props.
const HULL: V3 = [0.62, 0.62, 1.7]
const blimp = (() => {
  const skin: Finish = { color: '#eef1f4', metal: 0.1, rough: 0.55 }
  const blue: Finish = { color: '#1565c0', metal: 0.1, rough: 0.5 }
  const gold: Finish = { color: '#ffca28', rough: 0.5 }
  const glass: Finish = { color: '#24343f', metal: 0.7, rough: 0.12 }
  const dark: Finish = { color: '#2b3238', metal: 0.4, rough: 0.5 }
  const cab: Finish = { color: '#f5f6f7', metal: 0.25, rough: 0.4 }
  const red: Finish = { color: '#ff2a2a', unlit: true }
  const green: Finish = { color: '#2aff6a', unlit: true }
  // Caps and rings on the hull: slices of a slightly larger copy of it, turned so
  // their angle runs from the nose (0) to the tail (PI).
  const shell = (f: Finish, t0: number, t1: number, k = 1.006): Part =>
    [new SphereGeometry(1, 32, 3, 0, Math.PI * 2, t0, t1 - t0), f, at([0, 0, 0], [Math.PI / 2, 0, 0], [HULL[0] * k, HULL[2] * k, HULL[1] * k])]
  const fin = (rz: number, sd: 1 | -1, p: V3): Part[] => [
    piece(wing(0.56, 0.3, 0.5, 0.16, 0.05, { sd, sym: true }), blue, p, [0, 0, rz]),
    piece(wing(0.1, 0.1, 0.46, -0.09, 0.034, { sd, sym: true, tipThick: 0.03 }), gold, [p[0], p[1], p[2] - 0.5], [0, 0, rz]),
  ]
  const parts: Part[] = [
    sph(skin, [0, 0, 0], HULL, 36, 22),
    shell(blue, 0, 0.34),
    shell(gold, 0.4, 0.46),
    shell(gold, Math.PI - 0.62, Math.PI - 0.56),
    shell(blue, Math.PI - 0.5, Math.PI),
    // Mooring cone on the nose.
    [new ConeGeometry(0.05, 0.08, 10), dark, at([0, 0, HULL[2] + 0.03], [Math.PI / 2, 0, 0])],
    // Cross tail: four fins with gold rudders.
    ...fin(0, 1, [0.18, 0, -1.05]),
    ...fin(0, -1, [-0.18, 0, -1.05]),
    ...fin(Math.PI / 2, 1, [0, 0.18, -1.05]),
    ...fin(-Math.PI / 2, 1, [0, -0.18, -1.05]),
    sph(red, [0.69, 0, -1.25], [0.03, 0.03, 0.03], 8, 6),
    sph(green, [-0.69, 0, -1.25], [0.03, 0.03, 0.03], 8, 6),
    // Gondola: cabin, glazed nose, windows, a gold stripe, engines on outriggers.
    box(cab, [0.26, 0.16, 0.62], [0, -0.63, 0.25]),
    sph(glass, [0, -0.63, 0.56], [0.13, 0.08, 0.17], 16, 10),
    sph(cab, [0, -0.63, -0.06], [0.13, 0.08, 0.12], 16, 10),
    box(gold, [0.268, 0.026, 0.63], [0, -0.69, 0.25]),
    ...[1, -1].flatMap((sd): Part[] => [
      ...[0.02, 0.12, 0.22, 0.32, 0.42].map((z): Part => box(glass, [0.008, 0.06, 0.07], [sd * 0.132, -0.62, z])),
      rod(dark, [sd * 0.12, -0.64, 0.08], [sd * 0.3, -0.6, 0.06], 0.014),
      tube(cab, 0.05, 0.04, -0.06, 0.16, sd * 0.32, -0.6, 14),
      [new TorusGeometry(0.075, 0.012, 6, 18), dark, at([sd * 0.32, -0.6, -0.1])],
      ...[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a): Part => rod(dark, [sd * 0.32, -0.6, -0.06], [sd * 0.32 + Math.cos(a) * 0.075, -0.6 + Math.sin(a) * 0.075, -0.1], 0.005, 4)),
    ]),
    // Landing wheel under the gondola.
    rod(dark, [0, -0.7, 0.05], [0, -0.78, 0.05], 0.012),
    [new CylinderGeometry(0.04, 0.04, 0.03, 12), dark, at([0, -0.8, 0.05], [0, 0, Math.PI / 2])],
  ]
  return bake(parts)
})()
// The name down both flanks: slices of the hull's own shape, a touch larger,
// whose texture runs nose to tail on the right and tail to nose on the left, so
// it reads from either side.
const blimpSign = (() => {
  const k = 1.012
  const side = (p0: number): [BufferGeometry, Finish, Matrix4] =>
    [new SphereGeometry(1, 24, 6, p0, 1.4, Math.PI / 2 - 0.27, 0.5), { color: '#ffffff', unlit: true }, at([0, 0, 0], [0, 0, 0], [HULL[0] * k, HULL[1] * k, HULL[2] * k])]
  return bake([side(Math.PI - 0.7), side(-0.7)], true)
})()
const blimpSignMat = signMat('CARTOPIA', '#1565c0', '#ffffff', 6)
const blimpPropGeo = bake([
  ...[0, 1, 2].map((i): Part => box({ color: '#37474f', metal: 0.4, rough: 0.5 }, [0.022, 0.13, 0.01], [Math.sin((i * Math.PI * 2) / 3) * 0.065, Math.cos((i * Math.PI * 2) / 3) * 0.065, 0], [0, 0, -(i * Math.PI * 2) / 3])),
  [new ConeGeometry(0.02, 0.04, 8), { color: '#ffca28', rough: 0.5 }, at([0, 0, -0.02], [-Math.PI / 2, 0, 0])],
])

export function Blimp() {
  const root = useRef<Group>(null)
  const props = useRef<(Mesh | null)[]>([])
  const strobe = useRef<Mesh>(null)
  useFrame(({ clock }, dt) => {
    if (!shown(root.current)) return
    for (const p of props.current) if (p) p.rotation.z += Math.min(dt, 0.1) * 20
    if (strobe.current) strobe.current.visible = reduceMotionOn() || calmFlashing() || clock.elapsedTime % 1.6 < 0.08
  })
  return (
    <group ref={root}>
      <mesh geometry={blimp} material={flyMat} raycast={NO_RAY} />
      <mesh geometry={blimpSign} material={blimpSignMat} raycast={NO_RAY} />
      {[1, -1].map((sd, i) => <mesh key={sd} ref={(m) => { props.current[i] = m }} geometry={blimpPropGeo} material={flyMat} position={[sd * 0.32, -0.6, -0.1]} raycast={NO_RAY} />)}
      <mesh ref={strobe} position={[0, 0.69, -1.25]} raycast={NO_RAY}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------- rocket ----------
// A cartoon rocket, nose up (+y), about 2 tall.
export const rocketGeo = (() => {
  const white: Finish = { color: '#f5f5f5', metal: 0.2, rough: 0.35 }
  const red: Finish = { color: '#e53935', metal: 0.2, rough: 0.4 }
  const glass: Finish = { color: '#4fc3f7', metal: 0.5, rough: 0.1, emissive: new Color('#4fc3f7').multiplyScalar(0.4) }
  const steel: Finish = { color: '#b0bec5', metal: 0.85, rough: 0.25 }
  const dark: Finish = { color: '#37474f', metal: 0.6, rough: 0.4 }
  return bake([
    [new CylinderGeometry(0.3, 0.3, 1.2, 24), white, at([0, 0, 0])],
    [new ConeGeometry(0.3, 0.55, 24), red, at([0, 0.875, 0])],
    [new CylinderGeometry(0.306, 0.306, 0.08, 24), red, at([0, 0.45, 0])],
    [new CylinderGeometry(0.306, 0.306, 0.06, 24), red, at([0, -0.4, 0])],
    // Porthole with its ring.
    [new SphereGeometry(0.11, 12, 8), glass, at([0, 0.18, 0.25])],
    [new TorusGeometry(0.12, 0.022, 6, 18), steel, at([0, 0.18, 0.29])],
    // Three swept fins and the engine bell.
    ...[0, 1, 2].map((i): Part => piece(wing(0.5, 0.2, 0.32, 0.3, 0.05, { sym: true }), red, [Math.sin((i * Math.PI * 2) / 3) * 0.24, -0.15, Math.cos((i * Math.PI * 2) / 3) * 0.24], [-Math.PI / 2, (i * Math.PI * 2) / 3 - Math.PI / 2, 0])),
    [new CylinderGeometry(0.14, 0.22, 0.2, 18, 1, true), dark, at([0, -0.7, 0])],
    [new CylinderGeometry(0.15, 0.15, 0.04, 18), steel, at([0, -0.6, 0])],
  ])
})()

// ---------- shared bits ----------
// Is this group showing (it and every parent)?
function shown(o: Object3D | null) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false
  return !!o
}

const lightGeo = new SphereGeometry(1, 8, 6)
const lightMats = new Map<string, MeshBasicMaterial>()
export function Light({ p, c, r = 0.07 }: { p: V3; c: string; r?: number }) {
  let m = lightMats.get(c)
  if (!m) lightMats.set(c, (m = new MeshBasicMaterial({ color: c, toneMapped: false })))
  return <mesh geometry={lightGeo} material={m} position={p} scale={r} raycast={NO_RAY} />
}

// The faint blur of a spinning prop or rotor.
const discGeo = new CircleGeometry(1, 28)
const discMat = new MeshBasicMaterial({ color: '#263238', transparent: true, opacity: 0.16, depthWrite: false, side: DoubleSide })
function Disc({ p, r, flat }: { p: V3; r: number; flat?: boolean }) {
  return <mesh geometry={discGeo} material={discMat} position={p} scale={r} rotation-x={flat ? -Math.PI / 2 : 0} raycast={NO_RAY} />
}
