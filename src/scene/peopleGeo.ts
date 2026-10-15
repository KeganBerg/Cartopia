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

// Townspeople proportions, shared by every figure that should match them:
// parts are placed from the hip up, in model units, and drawn `scale` bigger.
export const PERSON = { scale: 1.3, leg: 0.24, torso: 0.15, head: 0.36, hair: 0.385 }
// A standing townsperson's height in world units, feet to the top of the hair.
export const PERSON_H = (PERSON.leg + PERSON.hair + 0.085 * 0.8) * PERSON.scale
