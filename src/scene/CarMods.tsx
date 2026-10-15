import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry, type Mesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { modDef, type Body, type ModSlot, type SkinnedSlot } from '../game/data'
import type { RimStyle } from './carWheels'
import { withSkin } from './skins'
import { carFrame, type ModFrame } from './CarModel'
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

function box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0) {
  const g = new BoxGeometry(w, h, d)
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

const BUILD: Record<string, (f: Frame, p: Parts) => void> = {
  // Spoilers sit on the rear deck (or the roof, on cars with no trunk).
  ducktail: (f, p) => {
    p.paint.push(box(f.deckW * 0.86, 0.035, 0.13, 0, f.deck + 0.039, f.deckZ, 0.35))
  },
  gtwing: (f, p) => {
    const z = f.deckZ
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.03, 0.17, 0.05, sd * f.deckW * 0.3, f.deck + 0.085, z))
      p.carbon.push(box(0.015, 0.07, 0.18, sd * f.deckW * 0.49, f.deck + 0.18, z))
    }
    p.paint.push(box(f.deckW * 0.98, 0.025, 0.17, 0, f.deck + 0.18, z, 0.12))
  },
  attackwing: (f, p) => {
    const z = f.deckZ - 0.03
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.025, 0.28, 0.056, sd * f.deckW * 0.22, f.deck + 0.14, z))
      p.paint.push(box(0.016, 0.12, 0.24, sd * f.deckW * 0.56, f.deck + 0.27, z))
    }
    p.carbon.push(box(f.deckW * 1.12, 0.024, 0.2, 0, f.deck + 0.28, z, 0.18))
    p.carbon.push(box(f.deckW * 1.12, 0.018, 0.1, 0, f.deck + 0.33, z - 0.07, 0.45))
  },

  // Exhausts.
  twintips: (f, p) => {
    for (const sd of [-1, 1]) p.chrome.push(pipe(0.028, 0.09, sd * f.bodyW * 0.26, f.pipeY, f.rear - 0.015))
  },
  sidepipes: (f, p) => {
    for (const sd of [-1, 1]) {
      const x = sd * (f.side + 0.039)
      // Runs into the tip up to where the tip has the same width.
      p.chrome.push(pipe(0.028, f.len * 0.44, x, f.pipeY - 0.015, -f.len * 0.03))
      p.carbon.push(box(0.02, 0.05, f.len * 0.3, x + sd * 0.02, f.pipeY - 0.007, -f.len * 0.04))
      p.chrome.push(pipe(0.022, 0.06, x, f.pipeY - 0.015, f.len * 0.19, 0.034))
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
    p.carbon.push(box(f.bodyW * 0.98, 0.025, 0.08, 0, f.lift + 0.025, f.front + 0.015))
    p.carbon.push(box(f.bodyW * 0.7, 0.03, 0.07, 0, f.lift + 0.03, f.rear - 0.01))
    for (const sd of [-1, 1]) p.paint.push(box(0.0375, 0.05, f.len * 0.42, sd * (f.side + 0.00825), f.lift + 0.055, 0))
  },
  widebody: (f, p) => {
    for (const sd of [-1, 1]) {
      for (const z of [f.wz, -f.wz]) {
        // Bolt-on arch over each tyre: a flattened half ring on the side of the car.
        const g = new TorusGeometry(f.wheel * 1.2, 0.035, 6, 14, Math.PI)
        g.scale(1, 1, 1.7)
        g.rotateY(Math.PI / 2)
        g.translate(sd * Math.max(f.wx + 0.055, f.side + 0.035), f.wheel, z)
        p.paint.push(g)
      }
      p.paint.push(box(0.0555, 0.053, f.wz * 2 - f.wheel * 2.6, sd * (f.side + 0.01725), f.lift + 0.0555, 0))
    }
    p.carbon.push(box(f.bodyW * 1.05, 0.025, 0.1, 0, f.lift + 0.025, f.front + 0.02))
  },
  carbonkit: (f, p) => {
    p.carbon.push(box(f.bodyW * 1.08, 0.022, 0.14, 0, f.lift + 0.022, f.front + 0.03))
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.0485, 0.05, f.len * 0.46, sd * (f.side + 0.01375), f.lift + 0.053, 0))
      // Canards on the front corners.
      p.carbon.push(box(0.1, 0.012, 0.06, sd * (f.bodyW / 2 - 0.02), f.lift + 0.13, f.front - 0.02, 0, sd * 0.4))
    }
    p.carbon.push(box(f.bodyW * 0.8, 0.025, 0.1, 0, f.lift + 0.03, f.rear - 0.033))
    for (const x of [-0.2, 0, 0.2]) p.carbon.push(box(0.012, 0.066, 0.1, x * f.bodyW, f.lift + 0.057, f.rear - 0.033))
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
    p.carbon.push(box(0.18 * h, 0.06 * h, 0.1 * h, 0, f.hoodTop + 0.12 * h, f.hoodZ + 0.01, -0.15))
  },

  // Batch 3 spoilers.
  swanneck: (f, p) => {
    // The wing hangs from two curved necks that rise behind it and hook over onto its top.
    const z = f.deckZ + 0.01
    const y = f.deck + 0.17
    for (const sd of [-1, 1]) {
      const x = sd * f.deckW * 0.2
      p.carbon.push(box(0.024, 0.2, 0.04, x, f.deck + 0.1, z + 0.035))
      p.carbon.push(box(0.024, 0.026, 0.1, x, f.deck + 0.205, z - 0.005, -0.35))
      p.carbon.push(box(0.024, 0.05, 0.03, x, y + 0.03, z - 0.045))
      p.carbon.push(box(0.014, 0.11, 0.23, sd * f.deckW * 0.53, y + 0.005, z - 0.05))
    }
    p.paint.push(box(f.deckW * 1.06, 0.022, 0.19, 0, y, z - 0.05, 0.14))
    p.chrome.push(box(f.deckW * 1.0, 0.024, 0.008, 0, y + 0.012, z - 0.142))
  },
  skydeck: (f, p) => {
    // Two stacked elements between tall end plates, on four pylons.
    const z = f.deckZ - 0.02
    for (const sd of [-1, 1]) {
      for (const k of [0.12, 0.28]) p.carbon.push(box(0.022, 0.22, 0.05, clearOf(sd * f.deckW * k, 0.011, hoodLines(f)), f.deck + 0.11, z + 0.02))
      p.carbon.push(box(0.014, 0.19, 0.28, sd * f.deckW * 0.54, f.deck + 0.25, z - 0.04))
      p.chrome.push(box(0.018, 0.016, 0.03, sd * f.deckW * 0.54, f.deck + 0.355, z - 0.13))
    }
    p.paint.push(box(f.deckW * 1.08, 0.024, 0.2, 0, f.deck + 0.22, z - 0.02, 0.1))
    p.carbon.push(box(f.deckW * 1.08, 0.018, 0.12, 0, f.deck + 0.3, z - 0.1, 0.42))
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
    const z0 = f.wz - f.wheel * 1.25
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.03, 0.06, 0.16, sd * (f.side + 0.018), f.lift + 0.075, z0 - 0.09))
      for (let i = 0; i < 4; i++) {
        const z = z0 - i * 0.042
        const a: [number, number, number] = [sd * (f.side + 0.02), f.lift + 0.08, z]
        p.chrome.push(tube(0.014, a, [sd * (f.side + 0.075), f.lift + 0.16 + i * 0.005, z - 0.05]))
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
    for (const sd of [-1, 1]) {
      for (const zz of [f.wz, -f.wz]) p.paint.push(box(0.1, 0.12, 0.012, sd * f.wx, 0.085, zz - f.wheel * 1.32))
      p.carbon.push(box(0.0375, 0.04, f.wz * 2 - f.wheel * 2.9, sd * (f.side + 0.00825), f.lift + 0.03, 0))
    }
    p.chrome.push(box(f.bodyW * 0.7, 0.012, 0.15, 0, f.lift * 0.75, f.front - 0.04, -0.35))
    p.carbon.push(box(f.bodyW * 0.5, 0.03, 0.04, 0, f.lift + 0.02, f.rear - 0.012))
  },
  boxflares: (f, p) => {
    // Square bolt-on flares over each wheel, joined by skirts, with a chrome bolt at each corner.
    // Each flare runs from inside the body side out past the tyre.
    const x0 = f.side - 0.02
    const x1 = Math.max(f.wx + 0.05, f.side + 0.03) + 0.045
    const x = (x0 + x1) / 2
    const w = x1 - x0
    const top = f.wheel * 2 + 0.02
    for (const sd of [-1, 1]) {
      for (const zz of [f.wz, -f.wz]) {
        const L = f.wheel * 2.56
        p.paint.push(box(w, 0.028, L, sd * x, top, zz))
        for (const e of [-1, 1]) {
          const yb = f.lift + 0.03
          p.paint.push(box(w, top - yb, 0.026, sd * x, (top + yb) / 2, zz + e * (L / 2 - 0.013)))
          p.chrome.push(post(0.008, 0.012, sd * (x1 - 0.015), top + 0.016, zz + e * (L / 2 - 0.02), 6))
        }
      }
      p.paint.push(box(0.06, 0.04, f.wz * 2 - f.wheel * 2.56, sd * (f.side + 0.016), f.lift + 0.034, 0))
    }
    p.carbon.push(box(f.bodyW * 1.04, 0.03, 0.1, 0, f.lift + 0.03, f.front + 0.02))
  },
  aerokit: (f, p) => {
    // Front splitter with end plates and stacked canards, slim skirts, and a finned diffuser.
    p.carbon.push(box(f.bodyW * 1.1, 0.016, 0.16, 0, f.lift + 0.012, f.front + 0.035))
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.012, 0.05, 0.12, sd * f.bodyW * 0.55, f.lift + 0.03, f.front + 0.035))
      for (const [y, k] of [[0.11, 0], [0.16, 1]]) p.carbon.push(box(0.09, 0.01, 0.05, sd * (f.bodyW / 2 - 0.025 - k * 0.01), f.lift + y, f.front - 0.015 - k * 0.01, 0, sd * 0.45))
      p.carbon.push(box(0.045, 0.03, f.len * 0.48, sd * (f.side + 0.0125), f.lift + 0.035, 0))
      p.paint.push(box(0.035, 0.012, f.len * 0.42, sd * (f.side + 0.025), f.lift + 0.056, 0))
    }
    // Narrow enough to pass between the stock tailpipes; its fins sit between a stock diffuser's.
    p.carbon.push(box(f.bodyW * 0.46, 0.02, 0.12, 0, f.lift + 0.016, f.rear + 0.045, 0.25))
    for (let k = -2; k < 2; k++) p.carbon.push(box(0.01, 0.07, 0.13, (k + 0.5) * 0.11 * f.bodyW, f.lift + 0.047, f.rear + 0.02))
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
    for (const sd of [-1, 1]) p.chrome.push(post(0.009, 0.024, sd * f.bodyW * 0.34, f.hoodTop + 0.004, f.hoodZ, 8))
  },
  louvres: (f, p) => {
    const h = f.hs
    // Two banks of tilted slats either side of the middle.
    for (const sd of [-1, 1]) {
      const x = clearOf(sd * 0.125 * h, 0.045 * h, hoodLines(f))
      for (let k = 0; k < 5; k++) p.carbon.push(box(0.09 * h, 0.01, 0.034 * h, x, f.hoodTop + 0.004, f.hoodZ + (0.07 - k * 0.032) * h, -0.55))
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
      const x = sd * f.bodyW * 0.37
      const y = f.lift + 0.075
      p.carbon.push(pipe(0.03, 0.05, x, y, f.front + 0.012))
      p.lamp.push(lens(0.023, x, y, f.front + 0.0405))
    }
  },
  roofbar: (f, p) => {
    // A bar of six spot lamps across the front of the roof, on two feet.
    const z = f.roofZ + f.roofLen * 0.32
    const y = f.roof + 0.036
    for (const sd of [-1, 1]) p.carbon.push(box(0.03, 0.04, 0.03, sd * f.roofW * 0.32, f.roof + 0.004, z))
    p.carbon.push(box(f.roofW * 0.86, 0.034, 0.04, 0, y, z))
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * f.roofW * 0.14
      p.chrome.push(lens(0.017, x, y, z + 0.0215, 0.005))
      p.lamp.push(lens(0.013, x, y, z + 0.025, 0.005))
    }
  },
  underglow: (f, p) => {
    // Neon tubes round the underside (the light they throw on the road is drawn on its own).
    const y = f.lift - 0.008
    for (const sd of [-1, 1]) p.neon.push(box(0.012, 0.012, f.len * 0.62, sd * (f.side - 0.04), y, 0))
    for (const zz of [f.len * 0.33, -f.len * 0.33]) p.neon.push(box(f.bodyW * 0.62, 0.012, 0.012, 0, y, zz))
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
    p.chrome.push(box(0.03, 0.02, 0.01, 0, f.deck + 0.2, z0 + 0.05 * L))
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
      for (const y of [0.02, f.lift + 0.1]) p.paint.push(box(len, 0.022, 0.025, sd * f.bodyW * 0.24, y, tip - 0.075 - (y > 0.05 ? 0.06 : 0), 0, sd * a))
    }
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
    for (const sd of [-1, 1]) for (let i = -4; i <= 4; i++) for (const r of [0, 1]) {
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

export function modGeo(body: Body, ids: string[]) {
  const key = `${body}|${ids.join(',')}`
  const hit = cache.get(key)
  if (hit) return hit
  const f = carFrame(body)
  const parts: Parts = { paint: [], carbon: [], chrome: [], glass: [], flame: [], lamp: [], neon: [], ti: [] }
  for (const id of ids) {
    const own: Parts = { paint: [], carbon: [], chrome: [], glass: [], flame: [], lamp: [], neon: [], ti: [] }
    BUILD[id]?.(f, own)
    clearGlass(f, modDef(id)?.slot, own)
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
function SkinnedPart({ body, id, n, tint, metal }: { body: Body; id: string; n: number; tint: string; metal: number }) {
  const g = modGeo(body, [id])
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
export function CarMods({ body, fit, tint, metal, flames, skins, skin = 0 }: { body: Body; fit: Partial<Record<ModSlot, string>>; tint: string; metal: number; flames?: boolean; skins?: Partial<Record<SkinnedSlot, number>>; skin?: number }) {
  const all = modIds(fit)
  if (!all.length) return null
  const { skinned, plain: ids } = splitSkinned(all, skins)
  const g = ids.length ? modGeo(body, ids) : {}
  // Flames come from the exhaust, skinned or not.
  const fl = modGeo(body, all).flame
  return (
    <group>
      {skinned.map(([id, n]) => <SkinnedPart key={id} body={body} id={id} n={n} tint={tint} metal={metal} />)}
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
