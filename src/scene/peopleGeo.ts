import { BoxGeometry, BufferAttribute, CapsuleGeometry, Color, CylinderGeometry, SphereGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Townspeople figures with enough shape to hold up in the free camera: arms,
// a belt, a face, ears, hands and shoes. Each stays ONE instanced geometry per
// part, so people cost no extra draws. Parts are white where the person's own
// colour (shirt, skin, trousers) shows through the instance tint, and dark where
// a fixed shade should come out (eyes, belt, soles), since the tint multiplies.

const c = new Color()
function paint(g: BufferGeometry, hex: string) {
  const geo = g.index ? g.toNonIndexed() : g
  c.set(hex)
  const n = geo.getAttribute('position').count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
  geo.setAttribute('color', new BufferAttribute(col, 3))
  geo.deleteAttribute('uv')
  return geo
}
const at = (g: BufferGeometry, x: number, y: number, z: number, rz = 0) => g.rotateZ(rz).translate(x, y, z)

// Body: torso with sleeved arms hanging at the sides and a belt.
export function torsoGeo() {
  return mergeGeometries([
    paint(new CapsuleGeometry(0.085, 0.16, 3, 10), '#ffffff'),
    ...[-1, 1].map((s) => paint(at(new CapsuleGeometry(0.028, 0.14, 2, 6), s * 0.107, 0.03, 0, s * 0.12), '#f2f2f2')),
    paint(at(new CylinderGeometry(0.088, 0.088, 0.022, 10, 1, true), 0, -0.085, 0), '#3a3a3a'),
  ])!
}

// Head: face with eyes, nose, mouth and ears, a neck, and the hands (they ride
// with the head's instance, at the ends of the arms).
export function headGeo() {
  return mergeGeometries([
    paint(new SphereGeometry(0.08, 12, 9), '#ffffff'),
    paint(at(new SphereGeometry(0.014, 6, 4), 0, -0.006, 0.079), '#f0f0f0'),
    ...[-1, 1].map((s) => paint(at(new SphereGeometry(0.019, 6, 4), s * 0.078, 0, -0.004), '#eeeeee')),
    ...[-1, 1].map((s) => paint(at(new SphereGeometry(0.011, 6, 4), s * 0.028, 0.014, 0.07), '#1a1a1a')),
    paint(at(new BoxGeometry(0.03, 0.006, 0.01), 0, -0.03, 0.073), '#8a4a4a'),
    paint(at(new CylinderGeometry(0.032, 0.036, 0.05, 8, 1, true), 0, -0.085, 0), '#e6e6e6'),
    ...[-1, 1].map((s) => paint(at(new SphereGeometry(0.026, 6, 5), s * 0.118, -0.285, 0.005), '#ffffff')),
  ])!
}

// Leg: trouser leg with a shoe at the foot, toe forward.
export function legGeo(len: number) {
  return mergeGeometries([
    paint(new BoxGeometry(0.06, len, 0.07), '#ffffff'),
    paint(at(new BoxGeometry(0.066, 0.04, 0.105), 0, -len / 2 + 0.01, 0.017), '#2b2b2b'),
  ])!
}

// Walked dog: the Dog Park dog (body, head, snout, nose, eyes, ears, legs and a
// raised tail) plus a collar, as ONE geometry so it rides one instance. White
// takes the coat tint; darker shades give the ears and collar a shade of their
// own. Origin on the ground, nose toward +z, at the Dog Park's world size
// divided by `scale` (the townspeople group's scale).
export function dogGeo(scale: number) {
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, hex: string, rx = 0, rz = 0) =>
    paint(new BoxGeometry(sx, sy, sz).rotateX(rx).rotateZ(rz).translate(x, y, z), hex)
  const ball = (r: number, x: number, y: number, z: number, hex: string, w = 8, h = 6) => paint(new SphereGeometry(r, w, h).translate(x, y, z), hex)
  return mergeGeometries([
    paint(new SphereGeometry(0.08, 10, 7).scale(0.7, 0.65, 1.3).translate(0, 0.13, 0), '#ffffff'),
    ball(0.055, 0, 0.2, 0.11, '#ffffff', 10, 7),
    box(0.04, 0.035, 0.05, 0, 0.185, 0.17, '#f2f2f2'),
    box(0.022, 0.02, 0.01, 0, 0.195, 0.197, '#151515'),
    ...[-1, 1].map((s) => ball(0.008, s * 0.024, 0.215, 0.157, '#151515', 6, 4)),
    ...[-1, 1].map((s) => box(0.025, 0.05, 0.02, s * 0.04, 0.24, 0.1, '#9a9a9a', 0, s * 0.24)),
    ...[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, z]) => box(0.025, 0.1, 0.025, x * 0.035, 0.05, z * 0.06, '#ffffff')),
    box(0.015, 0.015, 0.08, 0, 0.18, -0.11, '#ffffff', 0.7),
    paint(new CylinderGeometry(0.043, 0.047, 0.016, 10, 1, true).rotateX(-0.9).translate(0, 0.17, 0.075), '#c62828'),
  ])!.scale(1 / scale, 1 / scale, 1 / scale)
}

// A leash: one unit long from the origin along +z, stretched to reach the dog.
export function leashGeo() {
  return new BoxGeometry(0.009, 0.009, 1).translate(0, 0, 0.5)
}
