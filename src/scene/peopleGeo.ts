import { BoxGeometry, BufferAttribute, CapsuleGeometry, Color, CylinderGeometry, MeshStandardMaterial, SphereGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Townspeople figures with enough shape to hold up in the free camera: arms,
// a belt, a face, ears, hands and shoes. Each stays ONE instanced geometry per
// part, so people cost no extra draws. Parts are white where the person's own
// colour (shirt, skin, trousers) shows through the instance tint, and dark where
// a fixed shade should come out (eyes, belt, soles), since the tint multiplies.

const c = new Color()
export function paint(g: BufferGeometry, hex: string) {
  const geo = g.index ? g.toNonIndexed() : g
  c.set(hex)
  const n = geo.getAttribute('position').count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
  geo.setAttribute('color', new BufferAttribute(col, 3))
  geo.deleteAttribute('uv')
  return geo
}
export const at = (g: BufferGeometry, x: number, y: number, z: number, rz = 0) => g.rotateZ(rz).translate(x, y, z)

// Body: torso with sleeved arms hanging at the sides and a belt. Without
// `arms`, for a figure that moves its arms itself (armGeo, handGeo, clubArmGeo).
export function torsoGeo(arms = true) {
  return mergeGeometries([
    paint(new CapsuleGeometry(0.085, 0.16, 3, 10), '#ffffff'),
    ...(arms ? [-1, 1].map((s) => paint(at(new CapsuleGeometry(0.028, 0.14, 2, 6), s * 0.107, 0.03, 0, s * 0.12), '#f2f2f2')) : []),
    paint(at(new CylinderGeometry(0.088, 0.088, 0.022, 10, 1, true), 0, -0.085, 0), '#3a3a3a'),
  ])!
}

// Head: face with eyes, nose, mouth and ears, a neck, and the hands (they ride
// with the head's instance, at the ends of the arms; left off without `hands`).
export function headGeo(hands = true) {
  return mergeGeometries(headParts(hands))!
}
export function headParts(hands = true) {
  return [
    paint(new SphereGeometry(0.08, 12, 9), '#ffffff'),
    paint(at(new SphereGeometry(0.014, 6, 4), 0, -0.006, 0.079), '#f0f0f0'),
    ...[-1, 1].map((s) => paint(at(new SphereGeometry(0.019, 6, 4), s * 0.078, 0, -0.004), '#eeeeee')),
    ...[-1, 1].map((s) => paint(at(new SphereGeometry(0.011, 6, 4), s * 0.028, 0.014, 0.07), '#1a1a1a')),
    paint(at(new BoxGeometry(0.03, 0.006, 0.01), 0, -0.03, 0.073), '#8a4a4a'),
    paint(at(new CylinderGeometry(0.032, 0.036, 0.05, 8, 1, true), 0, -0.085, 0), '#e6e6e6'),
    ...(hands ? [-1, 1].map((s) => paint(at(new SphereGeometry(0.026, 6, 5), s * 0.118, -0.285, 0.005), '#ffffff')) : []),
  ]
}

// A loose sleeved arm hung from its shoulder at the origin, and the hand at its
// end, for figures that move their arms (torsoGeo(false), headGeo(false)).
export const ARM_LEN = 0.196
export const armGeo = () => paint(new CapsuleGeometry(0.028, 0.14, 2, 6).translate(0, -ARM_LEN / 2, 0), '#f2f2f2')
export const handGeo = () => paint(new SphereGeometry(0.026, 6, 5).translate(0, -ARM_LEN - 0.006, 0.005), '#ffffff')

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
// A `limb` attribute marks the parts dogMaterial() moves on the GPU: x = 1 for
// a leg (y = which diagonal pair, z = the leg's hip z), x = 2 for the tail.
export const DOG_HIP = 0.1
export const DOG_TAIL_Z = -0.075
export function dogGeo(scale: number) {
  const limb = (g: BufferGeometry, x = 0, y = 0, z = 0) => {
    const n = g.getAttribute('position').count
    const v = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) v.set([x, y, z], i * 3)
    g.setAttribute('limb', new BufferAttribute(v, 3))
    return g
  }
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, hex: string, rx = 0, rz = 0) =>
    limb(paint(new BoxGeometry(sx, sy, sz).rotateX(rx).rotateZ(rz).translate(x, y, z), hex))
  const ball = (r: number, x: number, y: number, z: number, hex: string, w = 8, h = 6) => limb(paint(new SphereGeometry(r, w, h).translate(x, y, z), hex))
  // Legs: thigh, shin and a darker paw, so a trotting leg reads as a leg.
  const leg = (x: number, z: number) => {
    const pair = x * z > 0 ? 1 : -1
    return [
      limb(paint(new CylinderGeometry(0.016, 0.012, 0.09, 6).translate(x * 0.035, 0.055, z * 0.06), '#ffffff'), 1, pair, z * 0.06 / scale),
      limb(paint(new SphereGeometry(0.015, 6, 4).scale(1, 0.6, 1.3).translate(x * 0.035, 0.008, z * 0.06 + 0.005), '#d8d8d8'), 1, pair, z * 0.06 / scale),
    ]
  }
  return mergeGeometries([
    limb(paint(new SphereGeometry(0.08, 12, 8).scale(0.7, 0.65, 1.3).translate(0, 0.13, 0), '#ffffff')),
    // Chest and haunches round the body out.
    ball(0.045, 0, 0.125, 0.065, '#ffffff', 8, 6),
    ball(0.047, 0, 0.13, -0.065, '#ffffff', 8, 6),
    ball(0.055, 0, 0.2, 0.11, '#ffffff', 10, 7),
    box(0.04, 0.035, 0.05, 0, 0.185, 0.17, '#f2f2f2'),
    box(0.022, 0.02, 0.01, 0, 0.195, 0.197, '#151515'),
    box(0.024, 0.005, 0.006, 0, 0.17, 0.193, '#6d3a3a'),
    ...[-1, 1].map((s) => ball(0.008, s * 0.024, 0.215, 0.157, '#151515', 6, 4)),
    ...[-1, 1].map((s) => box(0.012, 0.01, 0.01, s * 0.024, 0.228, 0.152, '#8a8a8a')),
    ...[-1, 1].map((s) => box(0.025, 0.05, 0.02, s * 0.04, 0.24, 0.1, '#9a9a9a', 0, s * 0.24)),
    ...[[-1, 1], [1, 1], [-1, -1], [1, -1]].flatMap(([x, z]) => leg(x, z)),
    limb(paint(new CylinderGeometry(0.006, 0.01, 0.085, 5).rotateX(-0.7).translate(0, 0.195, -0.105), '#ffffff'), 2),
    limb(paint(new CylinderGeometry(0.043, 0.047, 0.016, 10, 1, true).rotateX(-0.9).translate(0, 0.17, 0.075), '#c62828')),
    // A tag on the collar.
    limb(paint(new CylinderGeometry(0.009, 0.009, 0.003, 8).rotateX(Math.PI / 2 - 0.4).translate(0, 0.145, 0.1), '#ffd54f')),
  ])!.scale(1 / scale, 1 / scale, 1 / scale)
}

// The dog's material: legs swing in diagonal pairs (a trot) and the tail wags,
// both driven by a per-dog `gait` instance attribute (x = leg swing in radians,
// y = tail wag), so a moving dog costs no extra draws.
export function dogMaterial(scale: number) {
  const m = new MeshStandardMaterial({ vertexColors: true })
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 limb;\nattribute vec2 gait;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if (limb.x > 0.5 && limb.x < 1.5) {
          float a = gait.x * limb.y;
          vec2 p = transformed.yz - vec2(${(DOG_HIP / scale).toFixed(5)}, limb.z);
          transformed.yz = vec2(${(DOG_HIP / scale).toFixed(5)}, limb.z) + vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
        } else if (limb.x > 1.5) {
          vec2 base = vec2(0.0, ${(DOG_TAIL_Z / scale).toFixed(5)});
          vec2 p = transformed.xz - base;
          float a = gait.y;
          transformed.xz = base + vec2(p.x * cos(a) + p.y * sin(a), -p.x * sin(a) + p.y * cos(a));
        }`,
      )
  }
  m.customProgramCacheKey = () => 'walked-dog'
  return m
}

// A leash: one unit long from the origin along +z, stretched to reach the dog.
export function leashGeo() {
  return new BoxGeometry(0.009, 0.009, 1).translate(0, 0, 0.5)
}

// Townspeople proportions, shared by every figure that should match them:
// parts are placed from the hip up, in model units, and drawn `scale` bigger.
export const PERSON = { scale: 1.3, leg: 0.24, torso: 0.15, head: 0.36, hair: 0.385 }
// A standing townsperson's height in world units, feet to the top of the hair.
export const PERSON_H = (PERSON.leg + PERSON.hair + 0.085 * 0.8) * PERSON.scale
