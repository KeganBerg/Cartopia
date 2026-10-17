import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry, type Mesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { modDef, type Body, type ModSlot, type SkinnedSlot } from '../game/data'
import type { RimStyle } from './carWheels'
import { withSkin } from './skins'
import { carFrame, lowBumper, type ModFrame } from './CarModel'
import { decal } from './layers'
import { glowTex } from './textures'

// Bolt-on mod parts for a car. Every part of one material is merged into a
// single mesh, so a fully modded car adds one draw call per material it uses
// (paint, carbon, chrome, glass, lamps, neon, burnt titanium and, in races,
// exhaust flames) however many parts it wears.

type Frame = ModFrame
export type Kind = 'paint' | 'carbon' | 'chrome' | 'glass' | 'flame' | 'lamp' | 'neon' | 'ti'
type Parts = Record<Kind, BufferGeometry[]>
// Every kind but flames, in draw order.
export const SOLID_KINDS: Exclude<Kind, 'flame'>[] = ['paint', 'carbon', 'chrome', 'ti', 'lamp', 'neon', 'glass']

export const carbon = new MeshStandardMaterial({ color: '#1d1f22', metalness: 0.35, roughness: 0.45 })
// Kept off full metal so it still reads as bright chrome in previews that have no reflections.
export const chrome = new MeshStandardMaterial({ color: '#f5f7f8', metalness: 0.6, roughness: 0.2 })
export const glass = new MeshStandardMaterial({ color: '#cfe8ff', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false })
const flame = new MeshBasicMaterial({ color: '#ff8f00', transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false })
// Lamp lenses and neon tubes glow the same day and night; burnt titanium is blued, heat-tinted metal.
export const lamp = new MeshBasicMaterial({ color: '#fff4c4' })
export const neon = new MeshBasicMaterial({ color: '#3ef4ff', toneMapped: false })
export const ti = new MeshStandardMaterial({ color: '#7d6cc9', metalness: 0.7, roughness: 0.22 })
// The shared material for each kind of part (paint takes the car's colour instead).
export const KIND_MAT: Record<Exclude<Kind, 'paint' | 'flame'>, MeshStandardMaterial | MeshBasicMaterial> = { carbon, chrome, glass, lamp, neon, ti }

// A disc facing +z (a lamp lens or a pipe's dark mouth), centred at x, y, z.
function lens(r: number, x: number, y: number, z: number, d = 0.006) {
  return pipe(r, d, x, y, z)
}
// A cylinder standing up, centred at x, y, z.
function post(r: number, h: number, x: number, y: number, z: number, seg = 10) {
  return new CylinderGeometry(r, r, h, seg).translate(x, y, z)
}
// A bar from a to b (any direction), round, for tubes and struts.
function tube(r: number, a: [number, number, number], b: [number, number, number], seg = 10) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const len = Math.hypot(d[0], d[1], d[2])
  const g = new CylinderGeometry(r, r, len, seg)
  // Tip the cylinder's y axis onto a-b.
  const yaw = Math.atan2(d[0], d[2])
  const pitch = Math.acos(Math.max(-1, Math.min(1, d[1] / len)))
  g.rotateX(pitch)
  g.rotateY(yaw)
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
  return g
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  const g = new BoxGeometry(w, h, d)
  if (rz) g.rotateZ(rz)
  if (rx) g.rotateX(rx)
  if (ry) g.rotateY(ry)
  g.translate(x, y, z)
  return g
}

// A pipe running along the car (z axis). Twelve sides, so no flat side faces
// straight up, down or sideways onto the boxy body parts it runs past.
function pipe(r: number, len: number, x: number, y: number, z: number, r2 = r) {
  const g = new CylinderGeometry(r2, r, len, 12, 1, false)
  g.rotateX(Math.PI / 2)
  g.translate(x, y, z)
  return g
}

// The bottom of the nose, where front lips and splitters bolt on, and how wide it is.
const noseLift = (f: Frame) => (f.noseY === undefined ? f.lift : f.noseY - 0.009)
const noseW = (f: Frame) => (f.nose === undefined ? f.bodyW : f.nose * 2)
// A front lip: a blade under the nose with a raised fence along its leading edge, bolted on
// across the top and braced up to the bumper by two struts. Swept lips fold their corners back.
// Under a nose that tapers in, the blade is cut to the nose's own width and tucked back under
// it, bolted straight to its floor (struts out in front of a low pointed nose read as stilts).
function frontLip(f: Frame, p: Parts, k: Kind, w: number, t: number, d: number, y: number, z: number, sweep: boolean) {
  if (f.nose !== undefined) {
    w = Math.min(w, f.nose * 2)
    y += noseLift(f) - f.lift
    z = Math.min(z, f.front + 0.05 - d / 2)
  }
  const mid = sweep ? 0.72 : 1
  p[k].push(box(w * mid, t, d, 0, y, z))
  // The corners stop inside the body's sides and ahead of the wheel wells.
  const out = Math.min(w, f.bodyW) * 0.49
  if (sweep) for (const sd of [-1, 1]) p[k].push(box(w * 0.18, t - 0.009, d * 0.6, sd * (out - w * 0.09), y - 0.002, z + d * 0.05, 0, sd * 0.22))
  p.carbon.push(box(w * mid - 0.02, 0.014, 0.008, 0, y + t / 2 + 0.006, z + d / 2 - 0.007))
  if (f.nose !== undefined) return
  for (let i = -2; i <= 2; i++) p.chrome.push(post(0.0055, 0.012, i * w * 0.14, y + t / 2, z - d * 0.12, 8))
  for (const sd of [-1, 1]) p.chrome.push(tube(0.005, [sd * w * 0.24, y + t / 2 - 0.002, z + d * 0.18], [sd * w * 0.24, y + 0.06, f.front - 0.006], 6))
}


// Hood parts keep their sides clear of the long edges on the stock hood: the racing
// stripes (0.037 and 0.103 off the centre line), the Tusker's hood ridge (0.045) and the
// vent slots in the cowl at the base of the windshield (every 0.07 of the width, 0.012 wide).
const hoodLines = (f: Frame) => (f.body === 'tusker' ? [0.037, 0.045, 0.103] : [0.037, 0.103])
const cowlLines = (f: Frame) => [0, 1, 2, 3, 4].flatMap((i) => [i * 0.07 * f.bodyW - 0.006, i * 0.07 * f.bodyW + 0.006])
// The sides of the grille on noses that run straight up into the hood (0.3 or 0.42 of the
// width across, framed by bars 0.008 thick).
const grilleLines = (f: Frame) => [0.15, 0.21].flatMap((k) => [k * f.bodyW - 0.004, k * f.bodyW + 0.004])
const CLEAR = 0.0025

// A slat centred at c (off the centre line) with half width w, moved the least it takes
// for neither side to lie on one of those lines.
function clearOf(c: number, w: number, lines: number[]) {
  const ok = (x: number) => lines.every((l) => Math.abs(Math.abs(x) - w - l) >= CLEAR && Math.abs(Math.abs(x) + w - l) >= CLEAR)
  for (let i = 0; i < 80; i++) for (const x of [c + i * 0.00025 * Math.sign(c), c - i * 0.00025 * Math.sign(c)]) if (ok(x)) return x
  return c
}

// Room the other fitted mods need: where exhaust tips come out at the back (x, radius), and how far
// a body kit's skirts stand out from the body side.
type Room = { tips: [number, number][]; skirt: number; arch: number; out: number }
const TIPS: Record<string, (f: Frame) => [number, number][]> = {
  twintips: (f) => [-1, 1].map((sd) => [sd * f.bodyW * 0.26, 0.028]),
  quadtips: (f) => (f.bodyW < 0.3 ? [] : [-0.33, -0.2, 0.2, 0.33].map((k) => [k * f.bodyW, 0.026])),
  titan: (f) => (f.bodyW < 0.3 ? [] : [-0.16, 0.16].map((k) => [k * f.bodyW, 0.044])),
  flamepipes: (f) => (f.bodyW < 0.3 ? [] : [-0.22, -0.12, 0.12, 0.22].map((k) => [k * f.bodyW * 1.6, 0.036])),
}
// How far out from the body side each kit's skirts reach.
const SKIRT: Record<string, number> = { streetkit: 0.027, widebody: 0.045, carbonkit: 0.038, rallykit: 0.027, boxflares: 0.046, aerokit: 0.043 }
// Noses that curve away at the corners, leaving nothing for canards to bolt to.
const ROUND_NOSE: Body[] = ['horseshoe', 'scissor', 'teardrop', 'formula', 'pontoon', 'highboy', 'longtail', 'bubble']
// Where valances and diffusers hang at the tail: off the floor, or up at the tail where it sits
// high above the floor (the formula car's engine cover).
const rearLift = (f: Frame) => Math.max(f.lift, f.pipeY - 0.1)
// How far the hood sits below the usual hood line where hood mods go, on bodies drawn with
// their own curved hoods.
const HOOD_DROP: Partial<Record<Body, number>> = { restomuscle: 0.024, horseshoe: 0.021, teardrop: 0.01, longnose: 0.02, longtail: 0.026 }
// How far a curved roof falls away under a roof bar's feet.
const ROOF_DROP: Partial<Record<Body, number>> = { horseshoe: 0.056, teardrop: 0.047, scissor: 0.023, timeattack: 0.016, longtail: 0.066 }
const TUCK_FOG: Body[] = ['teardrop', 'pontoon']
// How much further wing posts reach down into a deck that falls away at the sides.
const POST_DEEP: Partial<Record<Body, number>> = { bubble: 0.02, highboy: 0.03 }
// Bodies drawn narrower than their wheels (the monster truck), or whose sills tuck in under the
// widest point: side kits, pipes and neon sit on the body itself.
// Pack cars drawn to their own shapes get the body's real ends and floor (measured from their
// geometry): the hot rod's narrow tub on its frame rails, with side kits outside its lakes pipes;
// the long-tail's tail.
const BODY_SIDE: Partial<Record<Body, Partial<Frame>>> = {
  monster: { side: 0.34, bodyW: 0.68 },
  highboy: { lift: 0.152, side: 0.345, pipeSide: 0.279, bodyW: 0.56, front: 0.63, rear: -0.665, pipeY: 0.27, postW: 0.4 },
  timeattack: { side: 0.38, nose: 0.37, noseY: 0.078 },
  longtail: { front: 0.68, rear: -0.84, nose: 0.255, noseY: 0.072 },
  // Noses that taper in toward the front: the bottom's half width 3 cm back from the tip, and
  // its height (measured from each body's geometry; see modFit's lip check).
  scissor: { nose: 0.274, noseY: 0.073 },
  horseshoe: { nose: 0.26, noseY: 0.081 },
  teardrop: { nose: 0.241, noseY: 0.081 },
  pontoon: { nose: 0.205, noseY: 0.091 },
  midship: { nose: 0.318, noseY: 0.074 },
  popup: { nose: 0.308, noseY: 0.085 },
  ponycar: { nose: 0.309, noseY: 0.102 },
  stepnose: { nose: 0.317, noseY: 0.087 },
  gtcoupe: { nose: 0.317, noseY: 0.078 },
  restomuscle: { nose: 0.349, noseY: 0.094 },
  musclecoupe: { nose: 0.331, noseY: 0.115 },
  // Side kits go on the armour skirts over the tracks (see the tank in CarModel), not down
  // among the road wheels.
  tank: { sill: 0.52, sillY: 0.215 },
}
const SILL_IN: Partial<Record<Body, number>> = { tank: 0.03, icecream: 0.014, pontoon: 0.02 }
// Where side skirts bolt on: the body side, or the face of whatever stands out over the wheels.
const sillX = (f: Frame) => f.sill ?? f.side
const sillY = (f: Frame) => f.sillY ?? f.lift
// On the tank, kits don't hang skirts: they bolt appliqué armour over its own armour skirt.
// `plates` panels side by side along the skirt (a gap between each), standing a little proud
// of its face, with a bolt at every corner. The skirt's height and length come from the tank
// in CarModel (centred at 1.62 wheel heights, 0.62 wheels tall, wz * 2 + 1.7 wheels long).
function tankArmour(f: Frame, p: Parts, plates: number) {
  const len = f.wz * 2 + f.wheel * 1.5
  const gap = 0.014
  const seg = (len - gap * (plates - 1)) / plates
  const t = 0.016
  const h = f.wheel * 0.46
  const y = f.wheel * 1.6
  for (const sd of [-1, 1]) for (let i = 0; i < plates; i++) {
    const z = -len / 2 + seg / 2 + i * (seg + gap)
    p.paint.push(box(t, h, seg, sd * (sillX(f) + t / 2), y, z))
    // A bevel along the top edge, leaning back to the skirt.
    p.paint.push(box(t * 0.6, 0.012, seg, sd * (sillX(f) + t * 0.3), y + h / 2 + 0.004, z, 0, 0, sd * 0.6))
    for (const dy of [-1, 1]) for (const dz of [-1, 1]) p.chrome.push(box(0.006, 0.012, 0.012, sd * (sillX(f) + t + 0.002), y + dy * (h / 2 - 0.014), z + dz * (seg / 2 - 0.016)))
  }
}
function withRoom(f: Frame, all: string[]): Frame & { room: Room } {
  // How far a kit's wheel arches reach along the car from each axle.
  const arch = all.includes('boxflares') ? f.wheel * 1.28 : all.includes('widebody') ? f.wheel * 1.2 + 0.035 : 0
  const bs = BODY_SIDE[f.body]
  const g: Frame = { ...f, ...bs, side: (bs?.side ?? f.side) - (SILL_IN[f.body] ?? 0), hoodTop: f.hoodTop - (HOOD_DROP[f.body] ?? 0) }
  // How far out a kit's arches reach from the middle of the car.
  const out = all.includes('boxflares') ? Math.max(g.wx + 0.05, sillX(g) + 0.03) + 0.045 : all.includes('widebody') ? Math.max(g.wx + 0.055, sillX(g) + 0.035) + 0.052 : 0
  return { ...g, room: { tips: all.flatMap((id) => TIPS[id]?.(g) ?? []), skirt: Math.max(0, ...all.map((id) => SKIRT[id] ?? 0)), arch, out } }
}
// The frame a mod is built on, with room left for the others fitted with it.
export const modFrame = (body: Body, all: string[], model?: string) => withRoom(carFrame(body, model), all)
const roomOf = (f: Frame): Room => (f as Frame & { room?: Room }).room ?? { tips: [], skirt: 0, arch: 0, out: 0 }
// Bodies whose own flares bulge up over the rear wheels like a kit's arches.
const FLARED: Body[] = ['groupb']
const archOf = (f: Frame) => roomOf(f).arch || (FLARED.includes(f.body) ? f.wheel * 1.2 + 0.035 : 0)
// On a low car with a trunk a wing whose top stands this far up the deck would tower over the
// roof: the wing comes down on shorter posts until its top sits just over the roof line, keeping
// its lowest piece (low, up from the deck) clear above any kit arch over the rear wheels.
// A wing up on the roof (no trunk) stands on short posts, its lowest piece just clear of the roof.
const wingDrop = (f: Frame, top: number, low: number) =>
  Math.min(
    top * 0.45,
    archOf(f) ? f.deck + low - f.wheel - archOf(f) - 0.06 : 1,
    f.deck < f.roof - 0.05 ? Math.max(0, f.deck + top - f.roof - 0.03) : low - 0.03,
  )
// The stretches of [x0, x1] left after cutting out a gap round each exhaust tip.
function aroundTips(f: Frame, x0: number, x1: number, pad = 0.012): [number, number][] {
  let out: [number, number][] = [[x0, x1]]
  for (const [x, r] of roomOf(f).tips) {
    out = out.flatMap(([a, b]): [number, number][] => {
      const c0 = x - r - pad, c1 = x + r + pad
      if (c1 <= a || c0 >= b) return [[a, b]]
      return [[a, c0], [c1, b]].filter(([u, v]) => v - u > 0.02) as [number, number][]
    })
  }
  return out
}
// Whether a thin upright piece at x would run into an exhaust tip.
const nearTip = (f: Frame, x: number, half: number, pad = 0.012) => roomOf(f).tips.some(([t, r]) => Math.abs(t - x) < r + half + pad)

const BUILD: Record<string, (f: Frame, p: Parts) => void> = {
  // Spoilers sit on the rear deck (or the roof, on cars with no trunk).
  ducktail: (f, p) => {
    p.paint.push(box(f.deckW * 0.86, 0.035, 0.13, 0, f.deck + 0.039, f.deckZ, 0.35))
  },
  gtwing: (f, p) => {
    const z = f.deckZ
    const d = Math.max(0, wingDrop(f, 0.2, 0.145))
    for (const sd of [-1, 1]) {
      // On a round body the posts reach down into a deck that falls away at the sides.
      const deep = POST_DEEP[f.body] ?? 0
      p.carbon.push(box(0.03, 0.17 - d + deep, 0.05, sd * (f.postW ?? f.deckW) * 0.3, f.deck + (0.17 - d) / 2 - deep / 2, z))
      p.carbon.push(box(0.015, 0.07, 0.18, sd * f.deckW * 0.49, f.deck + 0.18 - d, z))
    }
    p.paint.push(box(f.deckW * 0.98, 0.025, 0.17, 0, f.deck + 0.18 - d, z, 0.12))
  },
  attackwing: (f, p) => {
    const z = f.deckZ - 0.03
    const d = Math.max(0, wingDrop(f, 0.35, 0.21))
    for (const sd of [-1, 1]) {
      const deep = POST_DEEP[f.body] ?? 0
      p.carbon.push(box(0.025, 0.28 - d + deep, 0.056, sd * (f.postW ?? f.deckW) * 0.22, f.deck + (0.28 - d) / 2 - deep / 2, z))
      p.paint.push(box(0.016, 0.12, 0.24, sd * f.deckW * 0.56, f.deck + 0.27 - d, z))
    }
    p.carbon.push(box(f.deckW * 1.12, 0.024, 0.2, 0, f.deck + 0.28 - d, z, 0.18))
    p.carbon.push(box(f.deckW * 1.12, 0.018, 0.1, 0, f.deck + 0.33 - d, z - 0.07, 0.45))
  },

  // Exhausts.
  twintips: (f, p) => {
    for (const sd of [-1, 1]) p.chrome.push(pipe(0.028, 0.09, sd * f.bodyW * 0.26, f.pipeY, f.rear - 0.015))
  },
  sidepipes: (f, p) => {
    // Between the wheels (and any kit's arches), out past a body kit's skirts.
    // Where a kit's arches leave too little room between them, the pipes run outside the arches.
    const clear = Math.max(f.wheel * 1.3, roomOf(f).arch + 0.015)
    const outside = roomOf(f).out > 0 && f.wz * 2 - clear * 2 < 0.2
    const zb = Math.max(-f.len * 0.25, outside ? -f.len : -f.wz + clear)
    const zf = Math.min(f.len * 0.22, outside ? f.len : f.wz - clear)
    for (const sd of [-1, 1]) {
      const x = sd * (outside ? roomOf(f).out + 0.031 : roomOf(f).skirt ? f.side + roomOf(f).skirt + 0.031 : (f.pipeSide ?? f.side) + 0.039)
      // Runs into the tip up to where the tip has the same width.
      p.chrome.push(pipe(0.028, zf - 0.06 - zb, x, f.pipeY - 0.015, (zf - 0.06 + zb) / 2))
      // The heat shield stops short of the flared tip.
      p.carbon.push(box(0.02, 0.05, zf - zb - 0.105, x + sd * 0.02, f.pipeY - 0.009, (zf + zb) / 2 - 0.0225))
      p.chrome.push(pipe(0.022, 0.06, x, f.pipeY - 0.015, zf - 0.03, 0.034))
      // Two hangers reach in to the body, which tucks in at the bottom on rounder cars (a kit's
      // skirt holds them otherwise).
      if (!roomOf(f).skirt) for (const z of [zb + 0.07, zf - 0.14]) p.carbon.push(box(0.09, 0.014, 0.022, x - sd * 0.045, f.pipeY - 0.015, z))
    }
  },
  flamepipes: (f, p) => {
    const xs = f.bodyW < 0.3 ? [-0.045, 0.045] : [-0.22, -0.12, 0.12, 0.22].map((x) => x * f.bodyW * 1.6)
    for (const px of xs) {
      p.chrome.push(pipe(0.03, 0.12, px, f.pipeY + 0.005, f.rear - 0.036, 0.036))
      p.carbon.push(pipe(0.022, 0.125, px, f.pipeY + 0.005, f.rear - 0.036))
      const c = new ConeGeometry(0.035, 0.22, 8)
      c.rotateX(-Math.PI / 2)
      // Relative to the pipe exits (see FLAME_Z), so the flicker scales out from the pipes.
      c.translate(px, f.pipeY + 0.005, -0.11)
      p.flame.push(c)
    }
  },

  // Body kits.
  streetkit: (f, p) => {
    // A body-colour lip with swept corners.
    frontLip(f, p, 'paint', f.bodyW * 0.98, 0.028, 0.08, f.lift + 0.025, f.front + 0.015, true)
    // The rear valance parts round the exhaust tips.
    for (const [a, b] of aroundTips(f, -f.bodyW * 0.35, f.bodyW * 0.35)) p.carbon.push(box(b - a, 0.03, 0.07, (a + b) / 2, rearLift(f) + 0.03, f.rear - 0.01))
    if (f.body === 'tank') tankArmour(f, p, 2)
    else for (const sd of [-1, 1]) p.paint.push(box(0.0375, 0.05, f.len * 0.42, sd * (sillX(f) + 0.00825), sillY(f) + 0.055, 0))
  },
  widebody: (f, p) => {
    // A tank has no wheel arches to widen: its kit is armour over the skirt.
    if (f.body === 'tank') tankArmour(f, p, 3)
    else for (const sd of [-1, 1]) {
      for (const z of [f.wz, -f.wz]) {
        // Bolt-on arch over each tyre: a flattened half ring on the side of the car.
        const g = new TorusGeometry(f.wheel * 1.2, 0.035, 6, 14, Math.PI)
        g.scale(1, 1, 1.7)
        g.rotateY(Math.PI / 2)
        const ax = Math.max(f.wx + 0.055, sillX(f) + 0.035)
        g.translate(sd * ax, f.wheel, z)
        p.paint.push(g)
        // Wheels standing clear of the body: each arch is held on a strut from the body.
        // The strut leaves the arch on the side toward the middle of the car and runs in, low, to the body.
        const zi = -Math.sign(z)
        if (f.wx > sillX(f) + 0.05) p.carbon.push(tube(0.012, [sd * ax, f.wheel * 1.77, z + zi * f.wheel * 0.92], [sd * f.bodyW * 0.15, f.lift + 0.12, z + zi * f.wheel * 1.3], 8))
      }
      p.paint.push(box(0.0555, 0.053, f.wz * 2 - f.wheel * 2.64, sd * (sillX(f) + 0.01725), sillY(f) + 0.0555, 0))
    }
    p.carbon.push(box((f.nose === undefined ? f.bodyW * 1.05 : noseW(f) - 0.012), 0.025, 0.1, 0, noseLift(f) + 0.025, f.front + 0.02 - (f.nose === undefined ? 0 : 0.02)))
  },
  carbonkit: (f, p) => {
    if (f.body === 'tank') tankArmour(f, p, 4)
    frontLip(f, p, 'carbon', f.bodyW * 1.08, 0.022, 0.12, f.lift + 0.022, f.front + 0.015, true)
    for (const sd of [-1, 1]) {
      if (f.body !== 'tank') p.carbon.push(box(0.0485, 0.05, f.len * 0.46, sd * (sillX(f) + 0.01375), sillY(f) + 0.053, 0))
      // Canards on the front corners, where the nose is square enough to hold them.
      if (!ROUND_NOSE.includes(f.body)) p.carbon.push(box(0.1, 0.012, 0.06, sd * (noseW(f) / 2 - 0.02), f.lift + 0.13, f.front - 0.02, 0, sd * 0.4))
    }
    // The diffuser parts round the exhaust tips, and drops the fins that would meet one.
    for (const [a, b] of aroundTips(f, -f.bodyW * 0.4, f.bodyW * 0.4)) p.carbon.push(box(b - a, 0.025, 0.1, (a + b) / 2, rearLift(f) + 0.03, f.rear - 0.033))
    for (const x of [-0.2, 0, 0.2]) if (!nearTip(f, x * f.bodyW, 0.006)) p.carbon.push(box(0.012, 0.066, 0.1, x * f.bodyW, rearLift(f) + 0.057, f.rear - 0.033))
  },

  // Hoods, sized to the car's width.
  vented: (f, p) => {
    const h = f.hs
    // Sunk into the hood below the stripes, standing a little proud of the cowl slats.
    for (const sd of [-1, 1]) for (const k of [0, 1, 2]) p.carbon.push(box(0.09 * h, 0.0215, 0.022 * h, sd * 0.1 * h, f.hoodTop + 0.00675, f.hoodZ - 0.005 + (k * 0.045 - 0.05) * h))
  },
  ramscoop: (f, p) => {
    const h = f.hs
    // Sides kept clear of the long edges on the hood.
    const sw = clearOf(0.11 * h, 0, [...hoodLines(f), ...grilleLines(f)]) * 2
    p.paint.push(box(sw, 0.06 * h, 0.2 * h, 0, f.hoodTop + 0.02 * h, f.hoodZ, -0.12))
    p.carbon.push(box(0.17 * h, 0.04 * h, 0.01, 0, f.hoodTop + 0.035 * h, f.hoodZ + 0.1 * h))
    // A chrome grille of three bars across the mouth, under a chrome rim.
    for (const x of [-0.045, 0, 0.045]) p.chrome.push(box(0.008, 0.032 * h, 0.008, x * h, f.hoodTop + 0.035 * h, f.hoodZ + 0.1 * h + 0.005))
    p.chrome.push(box(0.18 * h, 0.008, 0.024, 0, f.hoodTop + 0.055 * h + 0.002, f.hoodZ + 0.1 * h))
  },
  blower: (f, p) => {
    const h = f.hs
    // Kept just clear of the windshield base (the cowl) and the front edge of the hood,
    // so its ends never lie flush with the ends of the hood stripes.
    const cowl = 2 * f.hoodZ - f.len * 0.4
    const span = (d: number): [number, number] => {
      const z0 = Math.max(f.hoodZ - 0.01 - d / 2, cowl + 0.003)
      const z1 = Math.min(f.hoodZ - 0.01 + d / 2, f.len * 0.4 - 0.006)
      return [z1 - z0, (z0 + z1) / 2]
    }
    // Sunk a little into the hood, below the stripes.
    const [bd, bz] = span(0.14 * h)
    p.chrome.push(box(0.15 * h, 0.09 * h + 0.004, bd, 0, f.hoodTop + 0.045 * h - 0.002, bz))
    // The middle fin is a touch wider than the cowl's vent slots (0.012); the others keep
    // clear of the slots' sides where the blower reaches back over the cowl.
    const [sd, sz] = span(0.146 * h)
    const lines = sz - sd / 2 < cowl + 0.03 ? [...hoodLines(f), ...cowlLines(f)] : hoodLines(f)
    for (const x of [-0.045, 0, 0.045]) p.chrome.push(box(x ? 0.012 : 0.0165, 0.1 * h + 0.007, sd, x ? clearOf(x * h, 0.006, lines) : 0, f.hoodTop + 0.05 * h - 0.0005, sz))
    // A drive pulley and belt on the front of the case.
    const z1 = bz + bd / 2
    p.chrome.push(pipe(0.032 * h, 0.014, 0, f.hoodTop + 0.06 * h, z1 + 0.007))
    p.carbon.push(box(0.028 * h, 0.06 * h, 0.008, 0, f.hoodTop + 0.03 * h - 0.004, z1 + 0.007))
    // The injector hat: a plate across the fin tops and a chrome scoop with a dark mouth and two butterflies.
    p.carbon.push(box(0.15 * h, 0.016 * h, 0.1 * h, 0, f.hoodTop + 0.108 * h, bz))
    const hz = bz + 0.005
    p.chrome.push(box(0.12 * h, 0.05 * h, 0.08 * h, 0, f.hoodTop + 0.141 * h - 0.002, hz))
    p.carbon.push(box(0.1 * h, 0.032 * h, 0.006, 0, f.hoodTop + 0.143 * h, hz + 0.04 * h + 0.002))
    for (const x of [-0.025, 0.025]) p.chrome.push(box(0.004, 0.03 * h, 0.006, x * h, f.hoodTop + 0.143 * h, hz + 0.04 * h + 0.005))
  },

  // Batch 3 spoilers.
  swanneck: (f, p) => {
    // The wing hangs from two curved necks that rise behind it and hook over onto its top.
    const z = f.deckZ + 0.01
    const d = Math.max(0, wingDrop(f, 0.22, 0.12))
    const y = f.deck + 0.17 - d
    for (const sd of [-1, 1]) {
      const x = sd * (f.postW ?? f.deckW) * 0.2
      p.carbon.push(box(0.024, 0.2 - d, 0.04, x, f.deck + (0.2 - d) / 2, z + 0.035))
      p.carbon.push(box(0.024, 0.026, 0.1, x, f.deck + 0.205 - d, z - 0.005, -0.35))
      p.carbon.push(box(0.024, 0.05, 0.03, x, y + 0.03, z - 0.045))
      p.carbon.push(box(0.014, 0.11, 0.23, sd * f.deckW * 0.53, y + 0.005, z - 0.05))
    }
    p.paint.push(box(f.deckW * 1.06, 0.022, 0.19, 0, y, z - 0.05, 0.14))
    p.chrome.push(box(f.deckW * 1.0, 0.024, 0.008, 0, y + 0.012, z - 0.142))
  },
  skydeck: (f, p) => {
    // Two stacked elements between tall end plates, on four pylons.
    const z = f.deckZ - 0.02
    const d = Math.max(0, wingDrop(f, 0.36, 0.155))
    for (const sd of [-1, 1]) {
      for (const k of [0.12, 0.28]) p.carbon.push(box(0.022, 0.22 - d, 0.05, clearOf(sd * (f.postW ?? f.deckW) * k, 0.011, hoodLines(f)), f.deck + (0.22 - d) / 2, z + 0.02))
      p.carbon.push(box(0.014, 0.19, 0.28, sd * f.deckW * 0.54, f.deck + 0.25 - d, z - 0.04))
      p.chrome.push(box(0.018, 0.016, 0.03, sd * f.deckW * 0.54, f.deck + 0.355 - d, z - 0.13))
    }
    p.paint.push(box(f.deckW * 1.08, 0.024, 0.2, 0, f.deck + 0.22 - d, z - 0.02, 0.1))
    p.carbon.push(box(f.deckW * 1.08, 0.018, 0.12, 0, f.deck + 0.3 - d, z - 0.1, 0.42))
  },
  roofrack: (f, p) => {
    // A chrome rack on the roof rails, loaded with a spare wheel, jerry cans and a cargo box.
    const y = f.roof + 0.035
    const L = f.roofLen * 0.86
    const z = f.roofZ
    for (const sd of [-1, 1]) {
      p.chrome.push(box(0.018, 0.018, L, sd * f.bodyW * 0.33, y, z))
      for (const k of [-0.4, 0.4]) p.carbon.push(box(0.028, 0.034, 0.03, sd * f.bodyW * 0.33, f.roof + 0.014, z + k * L))
    }
    for (const k of [-0.4, -0.13, 0.13, 0.4]) p.chrome.push(box(f.bodyW * 0.74, 0.012, 0.014, 0, y - 0.004, z + k * L))
    // A slatted floor on the cross bars for the load to sit on.
    p.carbon.push(box(f.bodyW * 0.6, 0.006, L * 0.84, 0, y + 0.0055, z))
    const spare = new CylinderGeometry(0.075, 0.075, 0.045, 14)
    spare.translate(-f.bodyW * 0.14, y + 0.03, z - L * 0.22)
    p.carbon.push(spare)
    p.chrome.push(post(0.035, 0.05, -f.bodyW * 0.14, y + 0.03, z - L * 0.22, 10))
    for (const k of [0.06, 0.18]) p.paint.push(box(0.08, 0.1, 0.05, f.bodyW * k, y + 0.055, z - L * 0.28))
    p.carbon.push(box(f.bodyW * 0.5, 0.075, L * 0.42, 0, y + 0.042, z + L * 0.22))
  },

  // Batch 3 exhausts.
  quadtips: (f, p) => {
    const bike = f.bodyW < 0.3
    const spots: [number, number][] = bike
      ? [[-0.045, 0], [-0.045, 0.045], [0.045, 0], [0.045, 0.045]]
      : [-0.33, -0.2, 0.2, 0.33].map((k): [number, number] => [k * f.bodyW, 0])
    for (const [x, dy] of spots) {
      p.chrome.push(pipe(0.023, 0.09, x, f.pipeY + dy, f.rear - 0.012, 0.026))
      p.carbon.push(lens(0.017, x, f.pipeY + dy, f.rear + 0.037))
    }
  },
  zoomies: (f, p) => {
    // Short headers bursting out of the sides behind the front wheels, angled up and back.
    const z0 = f.wz - Math.max(f.wheel * 1.25, roomOf(f).arch + 0.016)
    // Out past a body kit's skirts.
    const side = roomOf(f).skirt ? f.side + roomOf(f).skirt : (f.pipeSide ?? f.side)
    for (const sd of [-1, 1]) {
      // The collector runs back in under the body, which tucks in at the bottom on rounder cars.
      const w = roomOf(f).skirt ? 0.03 : 0.07
      p.carbon.push(box(w, 0.06, 0.16, sd * (side + 0.033 - w / 2), f.lift + 0.075, z0 - 0.09))
      for (let i = 0; i < 4; i++) {
        const z = z0 - i * 0.042
        const a: [number, number, number] = [sd * (side + 0.02), f.lift + 0.08, z]
        p.chrome.push(tube(0.014, a, [sd * (side + 0.075), f.lift + 0.16 + i * 0.005, z - 0.05]))
      }
    }
  },
  titan: (f, p) => {
    // Two big flared tips in heat-blued titanium, dark inside.
    const xs = f.bodyW < 0.3 ? [-0.05, 0.05] : [-0.16, 0.16].map((k) => k * f.bodyW)
    for (const x of xs) {
      p.ti.push(pipe(0.034, 0.13, x, f.pipeY + 0.004, f.rear - 0.012, 0.044))
      p.carbon.push(lens(0.036, x, f.pipeY + 0.004, f.rear + 0.054))
      p.chrome.push(pipe(0.03, 0.03, x, f.pipeY + 0.004, f.rear - 0.07, 0.03))
    }
  },

  // Batch 3 body kits.
  rallykit: (f, p) => {
    // Mud flaps behind every wheel, a chrome skid plate under the nose and rock guards on the sills.
    // The flaps hang from the underside of the body, with a chrome weight bar along the bottom.
    // They tuck up inside the sill, clear of its rounded edge, and the back pair stays under the
    // body (or hang off its back edge); a car with no room behind the back wheels gets none there.
    const top = f.lift + 0.03
    const h = Math.max(0.05, Math.min(0.17, top - 0.03))
    const x = Math.min(f.wx, f.side - 0.06)
    if (f.body === 'tank') tankArmour(f, p, 5)
    for (const sd of [-1, 1]) {
      // Tracks run where the flaps would hang.
      if (f.sill === undefined) for (const zz of [f.wz, -f.wz]) {
        const z = Math.max(zz - f.wheel * 1.32, f.rear - 0.004)
        if (z > zz - f.wheel - 0.015) continue
        // Wheels standing out past the body leave nothing behind them to hang a back flap from.
        if (zz < 0 && f.wx > f.side - 0.02) continue
        p.paint.push(box(0.1, h, 0.012, sd * x, top - h / 2, z))
        p.chrome.push(box(0.104, 0.012, 0.016, sd * x, top - h + 0.008, z))
      }
      if (f.body !== 'tank') p.carbon.push(box(0.0375, 0.04, f.wz * 2 - f.wheel * 2.9, sd * (sillX(f) + 0.00825), sillY(f) + 0.03, 0))
    }
    // Skid plate tucked under the nose, rising to the bumper, held by two bolts.
    p.chrome.push(box(Math.min(f.bodyW * 0.7, noseW(f) * 0.9), 0.012, 0.15, 0, noseLift(f) + 0.018, f.front - 0.045, -0.35))
    for (const sd of [-1, 1]) p.carbon.push(post(0.008, 0.008, sd * Math.min(f.bodyW * 0.22, noseW(f) * 0.28), noseLift(f) + 0.0155, f.front - 0.075, 8))
    for (const [a, b] of aroundTips(f, -f.bodyW * 0.24, f.bodyW * 0.24)) p.carbon.push(box(b - a, 0.05, 0.04, (a + b) / 2, rearLift(f) + 0.029, f.rear - 0.012))
  },
  boxflares: (f, p) => {
    // Square bolt-on flares over each wheel, joined by skirts, with a chrome bolt at each corner.
    // Each flare runs from inside the body side out past the tyre.
    const x0 = f.side - 0.02
    const x1 = Math.max(f.wx + 0.05, f.side + 0.03) + 0.045
    const x = (x0 + x1) / 2
    const w = x1 - x0
    const top = f.wheel * 2 + 0.02
    // The outer top edge is bevelled, so the flare reads as a pressed panel and not a box.
    const c = 0.04
    const wi = w - c * 0.7
    if (f.body === 'tank') tankArmour(f, p, 3)
    const xi = x - c * 0.35
    for (const sd of [-1, 1]) {
      for (const zz of [f.wz, -f.wz]) {
        const L = f.wheel * 2.56
        p.paint.push(box(wi, 0.028, L, sd * xi, top, zz))
        p.paint.push(box(c, 0.028, L - 0.006, sd * (x1 - c * 0.42), top - 0.011, zz, 0, 0, -sd * 0.62))
        for (const e of [-1, 1]) {
          const yb = f.lift + 0.03
          // Ahead of the front wheels a tapering nose has already turned in: the end panel
          // closes the flare back in to it, so its corner doesn't stand off in the air.
          const xa = zz > 0 && e > 0 && f.nose !== undefined ? Math.min(x0, f.nose - 0.01) : x0
          p.paint.push(box(x1 - xa, top - 0.03 - yb, 0.026, sd * (x1 + xa) / 2, (top - 0.03 + yb) / 2, zz + e * (L / 2 - 0.013)))
          p.paint.push(box(x1 - xa - c * 0.7, 0.03, 0.026, sd * (xa + x1 - c * 0.7) / 2, top - 0.015, zz + e * (L / 2 - 0.013)))
          p.chrome.push(post(0.008, 0.012, sd * (x1 - c - 0.02), top + 0.016, zz + e * (L / 2 - 0.02), 6))
        }
      }
      if (f.body !== 'tank') p.paint.push(box(0.06, 0.04, f.wz * 2 - f.wheel * 2.56, sd * (f.side + 0.016), f.lift + 0.034, 0))
    }
    p.carbon.push(box((f.nose === undefined ? f.bodyW * 1.04 : noseW(f) - 0.012), 0.03, 0.1, 0, noseLift(f) + (f.nose === undefined ? 0.03 : 0.022), f.front + 0.02 - (f.nose === undefined ? 0 : 0.02)))
  },
  aerokit: (f, p) => {
    if (f.body === 'tank') tankArmour(f, p, 4)
    // Front splitter with end plates and stacked canards, slim skirts, and a finned diffuser.
    frontLip(f, p, 'carbon', f.bodyW * 1.1, 0.016, 0.13, f.lift + 0.012, f.front + 0.02, false)
    for (const sd of [-1, 1]) {
      // End plates at the blade's tips (tucked in under a tapering nose with the blade).
      if (f.nose === undefined) p.carbon.push(box(0.012, 0.05, 0.11, sd * f.bodyW * 0.55, f.lift + 0.03, f.front + 0.025))
      else p.carbon.push(box(0.012, 0.03, 0.1, sd * (noseW(f) / 2 - 0.006), noseLift(f) + 0.024, f.front + 0.0))
      // Each canard runs back into the nose's corner (a wheel well behind it is no mount).
      if (!ROUND_NOSE.includes(f.body)) for (const [y, k] of [[0.11, 0], [0.14, 1]]) p.carbon.push(box(0.12, 0.01, 0.05, sd * (noseW(f) / 2 - 0.04 - k * 0.01), f.lift + y, f.front - 0.015 - k * 0.01, 0, sd * 0.45))
      if (f.body !== 'tank') {
        p.carbon.push(box(0.045, 0.03, f.len * 0.48, sd * (f.side + 0.0125), f.lift + 0.035, 0))
        p.paint.push(box(0.035, 0.012, f.len * 0.42, sd * (f.side + 0.025), f.lift + 0.056, 0))
      }
    }
    // Narrow enough to pass between the stock tailpipes; its fins sit between a stock diffuser's.
    for (const [a, b] of aroundTips(f, -f.bodyW * 0.23, f.bodyW * 0.23)) p.carbon.push(box(b - a, 0.02, 0.12, (a + b) / 2, rearLift(f) + 0.016, f.rear + 0.045, 0.25))
    for (let k = -2; k < 2; k++) if (!nearTip(f, (k + 0.5) * 0.11 * f.bodyW, 0.005)) p.carbon.push(box(0.01, 0.07, 0.13, (k + 0.5) * 0.11 * f.bodyW, rearLift(f) + 0.047, f.rear + 0.02))
  },
  bullbar: (f, p) => {
    // Chrome bull bar standing off the nose, with a black skid plate under it.
    const z = f.front + 0.09
    const top = f.lift + 0.24
    for (const sd of [-1, 1]) {
      p.chrome.push(post(0.017, top - f.lift * 0.5, sd * f.bodyW * 0.24, (top + f.lift * 0.5) / 2, z))
      p.carbon.push(box(0.03, 0.03, 0.11, sd * f.bodyW * 0.24, f.lift + 0.08, z - 0.06))
      p.chrome.push(tube(0.014, [sd * f.bodyW * 0.24, top - 0.02, z], [sd * f.bodyW * 0.42, f.lift + 0.08, z - 0.03]))
    }
    p.chrome.push(tube(0.017, [-f.bodyW * 0.26, top, z], [f.bodyW * 0.26, top, z]))
    p.chrome.push(tube(0.015, [-f.bodyW * 0.42, f.lift + 0.1, z - 0.02], [f.bodyW * 0.42, f.lift + 0.1, z - 0.02]))
    p.carbon.push(box(f.bodyW * 0.56, 0.014, 0.1, 0, f.lift * 0.55, z - 0.03, -0.3))
  },

  // Batch 3 hoods.
  cowl: (f, p) => {
    const h = f.hs
    // A long low bulge rising toward the windshield, open at the back, with hood pins up front.
    // Its open back end stays clear of the vent slots at the base of the windshield.
    const sw = clearOf(0.13 * h, 0, [...hoodLines(f), ...grilleLines(f)]) * 2
    const back = Math.max(f.hoodZ - 0.1 * h, 2 * f.hoodZ - f.len * 0.4 + 0.06)
    const front = f.hoodZ + 0.08 * h
    const mid = (back + front) / 2
    p.paint.push(box(sw, 0.05 * h, front - back, 0, f.hoodTop + 0.012 * h, mid, 0.12))
    p.carbon.push(box(sw * 0.78, 0.03 * h, 0.01, 0, f.hoodTop + 0.03 * h, back + 0.006))
    // Hood pins just ahead of the bulge, where the hood is flat.
    for (const sd of [-1, 1]) p.chrome.push(post(0.009, 0.026, sd * sw * 0.32, f.hoodTop, front + 0.03, 8))
  },
  louvres: (f, p) => {
    const h = f.hs
    // Two banks of tilted slats either side of the middle.
    for (const sd of [-1, 1]) {
      const x = clearOf(sd * 0.125 * h, 0.045 * h, hoodLines(f))
      for (let k = 0; k < 5; k++) p.carbon.push(box(0.09 * h, 0.01, 0.034 * h, x, f.hoodTop, f.hoodZ + (0.07 - k * 0.032) * h, -0.55))
    }
  },
  twinturbo: (f, p) => {
    const h = f.hs
    // Two turbos poking up through the hood: blued snail housings, chrome intakes facing forward.
    for (const sd of [-1, 1]) {
      const x = clearOf(sd * 0.075 * h, 0.022 * h, hoodLines(f))
      const y = f.hoodTop + 0.03 * h
      const snail = new CylinderGeometry(0.046 * h, 0.046 * h, 0.044 * h, 14)
      snail.rotateZ(Math.PI / 2)
      snail.translate(x, y, f.hoodZ - 0.02)
      p.ti.push(snail)
      p.chrome.push(pipe(0.022 * h, 0.09 * h, x, y + 0.012 * h, f.hoodZ + 0.04 * h, 0.03 * h))
      p.carbon.push(lens(0.018 * h, x, y + 0.012 * h, f.hoodZ + 0.04 * h + 0.047 * h))
      p.chrome.push(tube(0.012 * h, [x, y + 0.04 * h, f.hoodZ - 0.03], [x * 0.3, y + 0.075 * h, f.hoodZ - 0.06]))
    }
  },

  // Lights.
  foglamps: (f, p) => {
    for (const sd of [-1, 1]) {
      // Set in and back on noses that curve away at the corners.
      const tuck = TUCK_FOG.includes(f.body)
      // On a low car's slim bumper smaller lamps sit in the bar itself instead of riding over its top.
      const low = lowBumper(f.body)
      const r = low ? 0.021 : 0.03
      const x = sd * f.bodyW * (tuck ? 0.3 : 0.37)
      const y = f.lift + (low ? 0.055 : 0.075)
      const z = f.front + (tuck ? -0.006 : 0.012)
      p.carbon.push(pipe(r, 0.05, x, y, z))
      p.lamp.push(lens(r - 0.007, x, y, z + 0.0285))
    }
  },
  roofbar: (f, p) => {
    // A bar of six spot lamps across the front of the roof, on two feet.
    const z = f.roofZ + f.roofLen * 0.32
    const y = f.roof + 0.036
    // The feet reach down to a roof that curves away at the sides.
    const drop = ROOF_DROP[f.body] ?? 0
    for (const sd of [-1, 1]) p.carbon.push(box(0.03, 0.04 + drop, 0.03, sd * f.roofW * (drop ? 0.22 : 0.32), f.roof + 0.004 - drop / 2, z))
    p.carbon.push(box(f.roofW * 0.86, 0.034, 0.04, 0, y, z))
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * f.roofW * 0.14
      p.chrome.push(lens(0.017, x, y, z + 0.0215, 0.005))
      p.lamp.push(lens(0.013, x, y, z + 0.025, 0.005))
    }
  },
  underglow: (f, p) => {
    // Neon tubes round the underside (the light they throw on the road is drawn on its own).
    // Tall enough to reach up into a body whose floor sits a little higher.
    const y = f.lift - 0.003
    // Under the body itself, inside anything that stands out along the sills.
    const x = Math.min(f.side - 0.04, f.bodyW / 2 - 0.02)
    for (const sd of [-1, 1]) p.neon.push(box(0.012, 0.022, f.len * 0.62, sd * x, y, 0))
    for (const zz of [f.len * 0.33, -f.len * 0.33]) p.neon.push(box(f.bodyW * 0.62, 0.022, 0.012, 0, y, zz))
  },

  // School bus specials.
  luggage: (f, p) => {
    // Chrome roof rack heaped with suitcases and a strapped-down trunk.
    const z0 = f.deckZ + f.len * 0.3
    const L = f.len * 0.5
    for (const sd of [-1, 1]) {
      p.chrome.push(box(0.02, 0.02, L, sd * f.bodyW * 0.36, f.deck + 0.05, z0))
      for (const z of [-0.45, 0, 0.45]) p.chrome.push(box(0.02, 0.05, 0.02, sd * f.bodyW * 0.36, f.deck + 0.025, z0 + z * L))
    }
    for (const z of [-0.45, -0.15, 0.15, 0.45]) p.chrome.push(box(f.bodyW * 0.72, 0.015, 0.015, 0, f.deck + 0.045, z0 + z * L))
    // A floor across the slats, so every bag stands on something.
    p.carbon.push(box(f.bodyW * 0.7, 0.014, L * 0.86, 0, f.deck + 0.0505, z0))
    const bags: [number, number, number, number, number, number, Kind][] = [
      [0.2, 0.1, 0.16, -0.12, -0.3, 0.2, 'paint'],
      [0.16, 0.14, 0.12, 0.13, -0.32, -0.1, 'carbon'],
      [0.26, 0.09, 0.18, 0, 0, 0.05, 'carbon'],
      [0.14, 0.1, 0.14, -0.15, 0.26, -0.3, 'carbon'],
      [0.18, 0.12, 0.2, 0.12, 0.28, 0.25, 'paint'],
      [0.12, 0.08, 0.1, 0.02, 0.05, 0.4, 'paint'],
    ]
    for (const [w, h, d, x, z, ry, k] of bags) {
      const y = f.deck + 0.055 + h / 2 + (k === 'paint' && z === 0.05 ? 0.09 : 0)
      p[k].push(box(w, h, d, x * f.bodyW * 1.4, y, z0 + z * L, 0, ry))
    }
  },
  stacks: (f, p) => {
    // Big rig chrome stacks rising either side of the cab, with rain caps.
    const z = 2 * f.hoodZ - f.len * 0.4 - 0.05
    for (const sd of [-1, 1]) {
      const x = sd * (f.side + 0.04)
      const top = f.deck + 0.16
      const g = new CylinderGeometry(0.03, 0.03, top - f.pipeY, 10)
      g.translate(x, (top + f.pipeY) / 2, z)
      p.chrome.push(g)
      p.chrome.push(box(0.044, 0.025, 0.06, sd * (f.side + 0.018), f.pipeY + 0.02, z))
      p.carbon.push(box(0.065, 0.006, 0.065, x, top + 0.01, z - 0.012, -0.5))
      p.carbon.push(box(0.04, 0.12, 0.012, x, f.lift + 0.24, z, 0))
    }
  },
  cowcatcher: (f, p) => {
    // Wild West cow catcher: slatted chrome wedge pointing out of the front bumper.
    const tip = f.front + 0.16
    for (let i = -5; i <= 5; i++) {
      const x = (i / 5) * f.bodyW * 0.48
      const z = tip - (Math.abs(i) / 5) * 0.15
      p.chrome.push(box(0.016, 0.16, 0.02, x, f.lift * 0.5 + 0.06, z - 0.03, -0.55))
    }
    for (const sd of [-1, 1]) {
      const len = Math.hypot(f.bodyW * 0.48, 0.15)
      const a = Math.atan2(0.15, f.bodyW * 0.48)
      for (const [y, dz] of [[f.lift * 0.5 + 0.005, 0], [f.lift + 0.1, 0.06]]) p.paint.push(box(len, 0.022, 0.025, sd * f.bodyW * 0.24, y, tip - 0.075 - dz, 0, sd * a))
    }
    // Bolted to the bus by a beam across the bumper.
    p.carbon.push(box(f.bodyW * 0.96, 0.04, 0.03, 0, f.lift + 0.1, f.front + 0.004))
  },
  disco: (f, p) => {
    // Mirror ball spinning on a pole over the front of the roof.
    const z = 2 * f.hoodZ - f.len * 0.4 - 0.12
    const g = new CylinderGeometry(0.01, 0.01, 0.12, 6)
    g.translate(0, f.deck + 0.06, z)
    p.chrome.push(g)
    const ball = new SphereGeometry(0.085, 10, 7).toNonIndexed()
    ball.computeVertexNormals()
    ball.translate(0, f.deck + 0.2, z)
    p.chrome.push(ball)
    p.carbon.push(box(0.012, 0.04, 0.012, 0, f.deck + 0.29, z))
  },

  // Tomahawk tank specials.
  flag: (f, p) => {
    // Battle standard on a tall pole at the back corner, flying back in the wind.
    const x = -f.bodyW * 0.32
    const z = f.deckZ + 0.02
    const g = new CylinderGeometry(0.008, 0.012, 0.56, 6)
    g.translate(x, f.deck + 0.28, z)
    p.chrome.push(g)
    p.paint.push(box(0.008, 0.16, 0.26, x, f.deck + 0.46, z - 0.13, 0, 0.12))
    p.carbon.push(box(0.013, 0.04, 0.266, x, f.deck + 0.46, z - 0.13, 0, 0.12))
    p.chrome.push(new SphereGeometry(0.018, 8, 6).translate(x, f.deck + 0.57, z))
  },
  smoke: (f, p) => {
    // Banks of smoke grenade launchers on the rear deck, angled up and out, three a side.
    const z = f.deckZ + 0.14
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.09, 0.07, 0.16, sd * f.bodyW * 0.3, f.deck + 0.035, z))
      for (let i = 0; i < 3; i++) {
        const g = new CylinderGeometry(0.032, 0.032, 0.15, 8)
        g.rotateZ(sd * -0.6)
        g.translate(sd * (f.bodyW * 0.3 + 0.03), f.deck + 0.1, z - 0.05 + i * 0.05)
        p.paint.push(g)
        const cap = new CylinderGeometry(0.035, 0.035, 0.012, 8)
        cap.rotateZ(sd * -0.6)
        cap.translate(sd * (f.bodyW * 0.3 + 0.03 + Math.sin(0.6) * 0.077), f.deck + 0.1 + Math.cos(0.6) * 0.077, z - 0.05 + i * 0.05)
        p.chrome.push(cap)
      }
    }
  },
  reactive: (f, p) => {
    // Bricks of reactive armour tiled over the track skirts and across the nose.
    // The upper row stops short of the ends, where the hull slopes away. Each side's bricks hang on a
    // backing plate bolted to the hull.
    for (const sd of [-1, 1]) p.carbon.push(box(0.06, f.wheel * 0.76, f.wz * 2.05, sd * (f.side - 0.05), f.wheel * 1.59, 0))
    for (const sd of [-1, 1]) for (let i = -4; i <= 4; i++) for (const r of Math.abs(i) < 4 ? [0, 1] : [0]) {
      p[(i + r) % 2 ? 'carbon' : 'paint'].push(box(0.04, f.wheel * 0.38, f.wz * 0.22, sd * (f.side - 0.005), f.wheel * (1.38 + r * 0.42), (i * f.wz) / 4.2))
    }
    for (let i = -3; i <= 3; i++) p.paint.push(box(f.bodyW * 0.12, 0.08, 0.04, (i * f.bodyW) / 7.4, f.lift + 0.15, f.front + 0.02, 0.4))
  },
  watercannon: (f, p) => {
    // Little turret on the hood with a long chrome nozzle.
    const y = f.hoodTop
    const base = new CylinderGeometry(0.1, 0.12, 0.084, 14)
    base.translate(0, y + 0.038, f.hoodZ)
    p.paint.push(base)
    p.carbon.push(box(0.12, 0.07, 0.12, 0, y + 0.115, f.hoodZ))
    p.chrome.push(pipe(0.022, 0.32, 0, y + 0.12, f.hoodZ + 0.2, 0.03))
    p.chrome.push(pipe(0.032, 0.04, 0, y + 0.12, f.hoodZ + 0.36, 0.026))
    for (const sd of [-1, 1]) p.carbon.push(box(0.03, 0.05, 0.05, sd * 0.07, y + 0.16, f.hoodZ - 0.03))
  },

  // Shaggy dog van specials.
  bigtail: (f, p) => {
    // Huge fluffy tail curling up off the back.
    for (let i = 0; i < 7; i++) {
      const t = i / 6
      const r = 0.045 + Math.sin(t * Math.PI) * 0.035
      const s = new SphereGeometry(r, 10, 8)
      s.translate(Math.sin(t * 2.5) * 0.05, f.deck - 0.36 + t * 0.34, f.rear - 0.05 - Math.sin(t * Math.PI * 0.6) * 0.22)
      p.paint.push(s)
    }
    p.carbon.push(new SphereGeometry(0.05, 10, 8).translate(0.05, f.deck + 0.01, f.rear - 0.22))
  },
  bubbles: (f, p) => {
    // Bubble wand where the exhaust should be, and a trail of bubbles drifting over the roof.
    p.chrome.push(pipe(0.025, 0.08, f.bodyW * 0.25, f.pipeY, f.rear - 0.02))
    const ring = new TorusGeometry(0.05, 0.008, 5, 14)
    ring.translate(f.bodyW * 0.25, f.pipeY + 0.06, f.rear - 0.07)
    p.chrome.push(ring)
    const spots: [number, number, number, number][] = [
      [0.25, 0.14, -0.14, 0.04], [0.2, 0.26, -0.22, 0.055], [0.3, 0.36, -0.12, 0.03],
      [0.1, 0.44, -0.3, 0.065], [0.32, 0.5, -0.25, 0.035], [0, 0.6, -0.18, 0.045], [0.18, 0.66, -0.38, 0.03],
    ]
    for (const [x, y, z, r] of spots) p.glass.push(new SphereGeometry(r, 12, 8).translate(x * f.bodyW, f.pipeY + y, f.rear + z))
  },
  collar: (f, p) => {
    // Spiked collar round the "neck" where the cab meets the hood, with a gold name tag.
    const z = 2 * f.hoodZ - f.len * 0.4 - 0.03
    const h = f.deck - f.lift - 0.1
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.0375, h, 0.07, sd * (f.side + 0.00825), f.lift + 0.05 + h / 2, z))
      for (let i = 0; i < 4; i++) {
        const c = new ConeGeometry(0.018, 0.05, 6)
        c.rotateZ(-sd * Math.PI / 2)
        c.translate(sd * (f.side + 0.05), f.lift + 0.1 + (i * (h - 0.1)) / 3, z)
        p.chrome.push(c)
      }
    }
    p.carbon.push(box(f.bodyW * 0.86, 0.03, 0.07, 0, f.deck + 0.012, z))
    for (let i = -2; i <= 2; i++) {
      const c = new ConeGeometry(0.018, 0.05, 6)
      c.translate((i * f.bodyW) / 6, f.deck + 0.05, z)
      p.chrome.push(c)
    }
    p.chrome.push(new CylinderGeometry(0.04, 0.04, 0.01, 12).rotateX(Math.PI / 2).translate(0, f.hoodTop - 0.05, f.front + 0.02))
  },
  bone: (f, p) => {
    // A big cartoon bone lying across the hood.
    const y = f.hoodTop + 0.035
    const z = f.hoodZ + 0.02
    p.chrome.push(new CylinderGeometry(0.028, 0.028, 0.26, 8).rotateZ(Math.PI / 2).translate(0, y, z))
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.chrome.push(new SphereGeometry(0.04, 10, 8).translate(sx * 0.14, y, z + sz * 0.032))
  },

  // Kodiak Tusker specials.
  radar: (f, p) => {
    // Radar dish on a mast at the back, tilted up at the sky.
    const z = f.deckZ + 0.12
    const g = new CylinderGeometry(0.02, 0.028, 0.34, 8)
    g.translate(0, f.deck + 0.17, z)
    p.carbon.push(g)
    const dish = new CylinderGeometry(0.17, 0.05, 0.07, 18)
    dish.rotateX(-0.6)
    dish.translate(0, f.deck + 0.37, z)
    p.paint.push(dish)
    p.chrome.push(new TorusGeometry(0.17, 0.012, 5, 18).rotateX(Math.PI / 2 - 0.6).translate(0, f.deck + 0.405, z - 0.02))
    p.carbon.push(new CylinderGeometry(0.012, 0.012, 0.16, 5).rotateX(-0.6).translate(0, f.deck + 0.44, z - 0.05))
    p.carbon.push(new SphereGeometry(0.025, 8, 6).translate(0, f.deck + 0.5, z - 0.09))
  },
  snorkel: (f, p) => {
    // Raised air intake running up the front corner past the cage.
    const x = f.side + 0.035
    const z = f.front - f.len * 0.25
    const top = f.deck + 0.34
    const g = new CylinderGeometry(0.03, 0.03, top - f.lift - 0.08, 8)
    g.translate(x, (top + f.lift + 0.08) / 2, z)
    p.carbon.push(g)
    p.carbon.push(pipe(0.03, 0.12, x, top, z + 0.03))
    p.carbon.push(box(0.08, 0.06, 0.05, x, top, z + 0.1, 0.4))
  },
  plating: (f, p) => {
    // Extra slab armour bolted on the doors, the nose and the tail.
    for (const sd of [-1, 1]) {
      p.paint.push(box(0.03, 0.14, f.wz * 2 - f.wheel * 2.4, sd * (f.side + 0.03), f.lift + 0.12, 0))
      for (const z of [-0.12, 0, 0.12]) p.chrome.push(box(0.008, 0.02, 0.02, sd * (f.side + 0.047), f.lift + 0.16, z))
    }
    p.carbon.push(box(f.bodyW * 0.9 - 0.006, 0.12, 0.04, 0, f.lift + 0.08, f.front + 0.04, -0.3))
    p.carbon.push(box(f.bodyW * 0.8, 0.1, 0.04, 0, f.lift + 0.08, f.rear - 0.03))
  },
  lightbar: (f, p) => {
    // Hoop over the front seats carrying four big spotlights.
    const z = 2 * f.hoodZ - f.len * 0.4 - 0.04
    const top = f.deck + 0.3
    for (const sd of [-1, 1]) p.carbon.push(box(0.03, top - f.deck + 0.05, 0.03, sd * f.bodyW * 0.42, f.deck + (top - f.deck) / 2 - 0.02, z))
    p.carbon.push(box(f.bodyW * 0.88, 0.035, 0.035, 0, top, z))
    for (const x of [-0.3, -0.1, 0.1, 0.3]) {
      p.carbon.push(pipe(0.04, 0.05, x * f.bodyW, top + 0.05, z + 0.01))
      p.chrome.push(new CylinderGeometry(0.034, 0.034, 0.005, 12).rotateX(Math.PI / 2).translate(x * f.bodyW, top + 0.05, z + 0.037))
    }
  },

  // Motorbike specials.
  tailfairing: (f, p) => {
    p.paint.push(box(0.15, 0.08, 0.24, 0, f.deck, f.deckZ, -0.22))
    p.carbon.push(box(0.12, 0.012, 0.18, 0, f.deck + 0.042, f.deckZ + 0.017, -0.22))
  },
  saddlebags: (f, p) => {
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.07, 0.13, 0.22, sd * 0.11, f.wheel + 0.1, -f.wz + 0.06))
      p.chrome.push(box(0.074, 0.012, 0.18, sd * 0.11, f.wheel + 0.13, -f.wz + 0.06))
    }
  },
  windscreen: (f, p) => {
    p.glass.push(box(0.2, 0.2, 0.01, 0, f.hoodTop + 0.12, f.hoodZ + 0.02, -0.4))
    p.chrome.push(box(0.21, 0.012, 0.016, 0, f.hoodTop + 0.21, f.hoodZ - 0.018, -0.4))
  },

  // Formula specials.
  campod: (f, p) => {
    p.carbon.push(box(0.08, 0.035, 0.08, 0, f.hoodTop + 0.02, f.hoodZ))
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.03, 0.03, 0.05, sd * 0.06, f.hoodTop + 0.03, f.hoodZ))
      p.chrome.push(new CylinderGeometry(0.01, 0.01, 0.005, 8).rotateX(Math.PI / 2).translate(sd * 0.06, f.hoodTop + 0.03, f.hoodZ + 0.027))
    }
  },
  bargeboards: (_f, p) => {
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.012, 0.1, 0.18, sd * 0.2, 0.12, 0.2, 0, sd * 0.25))
      for (const k of [0, 1, 2]) p.carbon.push(box(0.01, 0.06, 0.06, sd * (0.23 + k * 0.012), 0.11, 0.06 - k * 0.07, 0, sd * 0.3))
      p.carbon.push(box(0.08, 0.008, 0.16, sd * 0.25, 0.18, -0.1))
    }
  },
}

// How far behind the bumper the flame pipes end.
const FLAME_Z = 0.096

const cache = new Map<string, Partial<Record<Kind, BufferGeometry>>>()

// Hood parts sized for a mid-size car reach back into the windshield of a truck or van with a
// short hood, and a ducktail into the back window of a hatch: slide the part forward (or back)
// until it clears the glass.
const GLASS_GAP = 0.004
function clearGlass(f: Frame, slot: ModSlot | undefined, p: Parts) {
  if (!f.glass || (slot !== 'hood' && slot !== 'spoiler')) return
  const pane = slot === 'hood' ? f.glass.front : f.glass.back
  const dir = slot === 'hood' ? 1 : -1
  let need = 0
  for (const list of Object.values(p)) for (const g of list) {
    const pos = g.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      if (y < pane.lo || y > pane.hi) continue
      need = Math.max(need, (pane.at(y) - pos.getZ(i)) * dir + GLASS_GAP)
    }
  }
  if (need > 0) for (const list of Object.values(p)) for (const g of list) g.translate(0, 0, need * dir)
}

// On a tracked body (the Tomahawk) the hood parts are guns: a cast mantlet bolted to the hood with
// trunnion caps either side, and a barrel running forward past the nose. Each hood part keeps its
// id and stats; only what it looks like changes. Barrels are built along +z from the mantlet's face.
type Gun = { len: number; r: number; tip: number; mant: number; muzzle: 'ring' | 'flare' | 'brake' | 'bigbrake' | 'none'; sleeves?: number; evac?: boolean; twin?: boolean; shield?: boolean }
const GUNS: Record<string, Gun> = {
  vented: { len: 0.2, r: 0.034, tip: 0.032, mant: 1, muzzle: 'ring' },
  cowl: { len: 0.34, r: 0.022, tip: 0.018, mant: 0.86, muzzle: 'flare', shield: true },
  ramscoop: { len: 0.46, r: 0.022, tip: 0.018, mant: 1, muzzle: 'brake' },
  louvres: { len: 0.42, r: 0.023, tip: 0.02, mant: 1, muzzle: 'ring', sleeves: 3 },
  blower: { len: 0.36, r: 0.011, tip: 0.01, mant: 0.95, muzzle: 'none', twin: true },
  twinturbo: { len: 0.5, r: 0.028, tip: 0.024, mant: 1.15, muzzle: 'bigbrake', evac: true },
}
function gun(f: Frame, p: Parts, g: Gun) {
  const h = f.hs
  const m = g.mant
  const top = f.hoodTop
  const mz = f.hoodZ - 0.03
  // The mantlet: a low cast block with a rounded front, sunk a touch into the hood.
  const mw = 0.2 * h * m, mh = 0.075 * h * m, md = 0.15 * h * m
  p.paint.push(box(mw, mh + 0.004, md, 0, top + mh / 2 - 0.002, mz, 0))
  const nose = new CylinderGeometry(mh / 2, mh / 2, mw * 0.86, 16, 1, false, 0, Math.PI)
  nose.rotateZ(Math.PI / 2)
  nose.rotateX(Math.PI / 2)
  nose.translate(0, top + mh / 2, mz + md / 2)
  p.paint.push(nose)
  // Trunnion caps on each side, with a bolt ring.
  for (const sd of [-1, 1]) {
    const cap = new CylinderGeometry(mh * 0.34, mh * 0.38, 0.016, 12)
    cap.rotateZ(Math.PI / 2)
    cap.translate(sd * (mw / 2 + 0.006), top + mh / 2, mz)
    p.carbon.push(cap)
    const bolt = new CylinderGeometry(0.008, 0.008, 0.006, 6)
    bolt.rotateZ(Math.PI / 2)
    bolt.translate(sd * (mw / 2 + 0.0155), top + mh / 2, mz)
    p.chrome.push(bolt)
  }
  const y = top + mh / 2
  const z0 = mz + md / 2 + mh / 2 - 0.01
  const xs = g.twin ? [-0.034 * h, 0.034 * h] : [0]
  // The barrels are built level, then raised a few degrees about the mantlet so their muzzles ride clear of the nose.
  const before = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.length])) as Record<keyof Parts, number>
  for (const x of xs) {
    // Barrel root collar in the mantlet's face, then the barrel tapering to the muzzle.
    p.carbon.push(pipe(g.r * 1.7, 0.05 * h, x, y, z0 + 0.02 * h))
    const L = g.len * h
    p.carbon.push(pipe(g.r, L, x, y, z0 + 0.045 * h + L / 2, g.tip))
    if (g.twin) {
      // Perforated cooling jacket over the root of each autocannon barrel.
      p.chrome.push(pipe(g.r * 1.7, 0.12 * h, x, y, z0 + 0.105 * h))
      for (let k = 0; k < 4; k++) p.carbon.push(box(0.006, g.r * 3.6, 0.012, x, y, z0 + 0.065 * h + k * 0.026 * h))
    }
    for (let k = 0; k < (g.sleeves ?? 0); k++) p.paint.push(pipe(g.r * 1.28, 0.07 * h, x, y, z0 + 0.1 * h + k * 0.11 * h))
    if (g.evac) p.carbon.push(pipe(g.r * 1.6, 0.09 * h, x, y, z0 + 0.045 * h + L * 0.55, g.r * 1.6))
    const end = z0 + 0.045 * h + L
    if (g.muzzle === 'ring') p.chrome.push(pipe(g.tip * 1.3, 0.03 * h, x, y, end - 0.012 * h))
    if (g.muzzle === 'flare') p.chrome.push(pipe(g.tip * 1.05, 0.04 * h, x, y, end - 0.016 * h, g.tip * 1.5))
    if (g.muzzle === 'brake' || g.muzzle === 'bigbrake') {
      // A muzzle brake: a block with ports cut out of both sides, and a dark bore at the front.
      const k = g.muzzle === 'bigbrake' ? 1.25 : 1
      const bw = g.tip * 3.2 * k, bh = g.tip * 2.5 * k, bd = 0.07 * h * k
      p.carbon.push(box(bw, bh, bd, x, y, end + bd / 2 - 0.01))
      for (const sd of [-1, 1]) for (const dz of [-0.2, 0.2]) p.chrome.push(box(0.004, bh * 0.6, bd * 0.24, x + sd * (bw / 2 + 0.0015), y, end + bd / 2 - 0.01 + dz * bd))
      p.carbon.push(lens(g.tip * 0.9, x, y, end + bd - 0.01))
    } else {
      // The dark bore just in front of the muzzle's face.
      const dz = g.muzzle === 'none' ? 0.002 : g.muzzle === 'flare' ? 0.01 : 0.003 * h
      p.carbon.push(lens(g.tip * 0.75, x, y, end + dz))
    }
  }
  for (const k of Object.keys(p) as (keyof Parts)[]) for (const piece of p[k].slice(before[k])) piece.translate(0, -y, -z0).rotateX(-0.08).translate(0, y, z0)
  if (g.twin) p.carbon.push(box(0.05 * h, 0.05 * h, 0.08 * h, 0.075 * h, top + mh + 0.022 * h, mz - 0.01))
  // A small gun shield across the mantlet's face, the field gun's.
  if (g.shield) p.paint.push(box(mw * 1.5, mh * 1.3, 0.012, 0, top + mh * 0.62, z0 + 0.06 * h, -0.12))
}

// One mod's pieces on a body, each piece on its own (the fit tests look at them one by one).
export function modParts(f: Frame, id: string): Parts {
  const own: Parts = { paint: [], carbon: [], chrome: [], glass: [], flame: [], lamp: [], neon: [], ti: [] }
  const g = f.body === 'tank' ? GUNS[id] : undefined
  if (g) gun(f, own, g)
  else BUILD[id]?.(f, own)
  clearGlass(f, modDef(id)?.slot, own)
  return own
}

// all: every mod fitted to the car, when ids is only some of them (parts wearing a mod skin are
// drawn on their own), so each part still leaves room for the others.
// model: the car on the body, when it has its own proportions (carLooks.ts).
export function modGeo(body: Body, ids: string[], all: string[] = ids, model?: string) {
  const key = `${body}|${model ?? ''}|${ids.join(',')}|${all.join(',')}`
  const hit = cache.get(key)
  if (hit) return hit
  const f = withRoom(carFrame(body, model), all)
  const parts: Parts = { paint: [], carbon: [], chrome: [], glass: [], flame: [], lamp: [], neon: [], ti: [] }
  for (const id of ids) {
    const own = modParts(f, id)
    for (const k of Object.keys(own) as Kind[]) parts[k].push(...own[k])
  }
  const out: Partial<Record<Kind, BufferGeometry>> = {}
  for (const k of Object.keys(parts) as Kind[]) {
    const list = parts[k]
    if (!list.length) continue
    out[k] = mergeGeometries(list.map((g) => g.toNonIndexed()))
    list.forEach((g) => g.dispose())
  }
  cache.set(key, out)
  return out
}

function Flames({ geometry }: { geometry: BufferGeometry }) {
  const ref = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime * 30
    m.scale.set(1, 1, 0.7 + 0.3 * Math.abs(Math.sin(t) * Math.cos(t * 0.37)))
  })
  return <mesh ref={ref} geometry={geometry} material={flame} renderOrder={3} />
}

// The mod parts fitted, in a fixed slot order.
export const modIds = (fit: Partial<Record<ModSlot, string>>) => (['spoiler', 'exhaust', 'kit', 'hood', 'lights'] as ModSlot[]).map((s) => fit[s]).filter((id): id is string => !!id)

// A mod part's material with a mod skin (by number) drawn into it.
function SkinnedMat({ n, color, metal, rough }: { n: number; color: string; metal: number; rough: number }) {
  const hook = useMemo(() => ({ onBeforeCompile: (sh: Parameters<typeof withSkin>[0]) => withSkin(sh, String(n)), customProgramCacheKey: () => `skin-${n}` }), [n])
  return <meshStandardMaterial key={n} {...hook} color={color} metalness={metal} roughness={rough} />
}

// The parts wearing a mod skin, drawn one part at a time (paint, carbon, chrome and
// titanium all take the skin; glass, lamps, neon and flames don't).
function SkinnedPart({ body, model, id, all, n, tint, metal }: { body: Body; model?: string; id: string; all: string[]; n: number; tint: string; metal: number }) {
  const g = modGeo(body, [id], all, model)
  const hex = (m: MeshStandardMaterial) => '#' + m.color.getHexString()
  return (
    <>
      {g.paint && <mesh geometry={g.paint} castShadow><SkinnedMat n={n} color={tint} metal={metal} rough={0.3} /></mesh>}
      {g.carbon && <mesh geometry={g.carbon} castShadow><SkinnedMat n={n} color={hex(carbon)} metal={carbon.metalness} rough={carbon.roughness} /></mesh>}
      {g.chrome && <mesh geometry={g.chrome}><SkinnedMat n={n} color={hex(chrome)} metal={chrome.metalness} rough={chrome.roughness} /></mesh>}
      {g.ti && <mesh geometry={g.ti}><SkinnedMat n={n} color={hex(ti)} metal={ti.metalness} rough={ti.roughness} /></mesh>}
      {g.lamp && <mesh geometry={g.lamp} material={lamp} />}
      {g.neon && <mesh geometry={g.neon} material={neon} />}
      {g.glass && <mesh geometry={g.glass} material={glass} renderOrder={2} />}
    </>
  )
}

// Mod part ids split into the ones wearing a mod skin (with its number) and the rest.
export function splitSkinned(ids: string[], skins?: Partial<Record<SkinnedSlot, number>>) {
  const skinned: [string, number][] = []
  const plain: string[] = []
  for (const id of ids) {
    const n = skins?.[modDef(id)?.slot as SkinnedSlot] ?? 0
    if (n) skinned.push([id, n])
    else plain.push(id)
  }
  return { skinned, plain }
}

// skins: a mod skin number per slot. Skinned parts cost a few extra draws here; town
// cars bake them instead (see LeanCar in CarModel.tsx). skin: the body's own skin, worn by
// body-colour parts that have no mod skin, so a scoop or flare doesn't show up as bare paint.
export function CarMods({ body, model, fit, tint, metal, flames, skins, skin = 0 }: { body: Body; model?: string; fit: Partial<Record<ModSlot, string>>; tint: string; metal: number; flames?: boolean; skins?: Partial<Record<SkinnedSlot, number>>; skin?: number }) {
  const all = modIds(fit)
  if (!all.length) return null
  const { skinned, plain: ids } = splitSkinned(all, skins)
  const g = ids.length ? modGeo(body, ids, all, model) : {}
  // Flames come from the exhaust, skinned or not.
  const fl = modGeo(body, all, all, model).flame
  return (
    <group>
      {skinned.map(([id, n]) => <SkinnedPart key={id} body={body} model={model} id={id} all={all} n={n} tint={tint} metal={metal} />)}
      {g.paint && <mesh geometry={g.paint} castShadow>{skin ? <SkinnedMat n={skin} color={tint} metal={metal} rough={0.3} /> : <meshStandardMaterial color={tint} metalness={metal} roughness={0.3} />}</mesh>}
      {g.carbon && <mesh geometry={g.carbon} material={carbon} castShadow />}
      {g.chrome && <mesh geometry={g.chrome} material={chrome} />}
      {g.ti && <mesh geometry={g.ti} material={ti} />}
      {g.lamp && <mesh geometry={g.lamp} material={lamp} />}
      {g.neon && <mesh geometry={g.neon} material={neon} />}
      {g.glass && <mesh geometry={g.glass} material={glass} renderOrder={2} />}
      {fl && flames && (
        <group position-z={carFrame(body).rear - FLAME_Z}><Flames geometry={fl} /></group>
      )}
    </group>
  )
}

// Rim finish for a Rims mod: [colour, metalness, roughness].
export const RIM_LOOK: Record<string, [string, number, number]> = {
  chrome: ['#ffffff', 0.2, 0.1],
  goldmesh: ['#ffc23d', 0.5, 0.25],
  forged: ['#3a3a3a', 0.3, 0.4],
  candy: ['#e0203f', 0.35, 0.15],
  beadlock: ['#b5773a', 0.4, 0.3],
  turbine: ['#f2f4f5', 0.2, 0.18],
  goldwire: ['#ffcc4d', 0.5, 0.15],
}
// A rims mod swaps the stock rim for its own style.
export const RIM_STYLE: Record<string, RimStyle> = { chrome: 'deep', goldmesh: 'mesh', forged: 'split', candy: 'five', beadlock: 'beadlock', turbine: 'turbine', goldwire: 'wire' }

// Neon underglow's light on the road: a soft cyan pool under the car, on the ground
// whatever the car's stance (so it goes outside the body's group).
let poolMat: MeshBasicMaterial | null = null
const pool = () => (poolMat ??= new MeshBasicMaterial({ map: glowTex(), color: neon.color, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, toneMapped: false, ...decal(4) }))
export function UnderglowPool({ body }: { body: Body }) {
  const f = carFrame(body)
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.02} renderOrder={2}>
      <planeGeometry args={[f.bodyW * 1.7, f.len * 1.25]} />
      <primitive object={pool()} attach="material" dispose={null} />
    </mesh>
  )
}
