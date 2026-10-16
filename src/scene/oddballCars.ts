import { BoxGeometry, CircleGeometry, CylinderGeometry, PlaneGeometry, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, Vector2 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Kit } from './CarModel'
import { wellGeo, wellOutline, type ExoticFit, type ExoticHelpers } from './exoticCars'
import type { Body } from '../game/data'

// Oddballs: goofy vehicles that wouldn't normally race (an ice cream truck, a monster
// truck, a parcel van). Chunky boxes in the same toy style as every other car, built
// from the same parts, so town traffic bakes them and the garage draws them the same.
// Their wheel sizes and spots live in CarModel.tsx SHAPES, which these numbers match.
// No real brand names or logos.

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
const plane = (w: number, h: number) => new PlaneGeometry(w, h)
const disc = (r: number, seg = 16) => new CircleGeometry(r, seg)
const half = (r: number, seg = 8) => new CircleGeometry(r, seg, Math.PI, Math.PI)
const cyl = (rt: number, rb: number, h: number, seg = 12) => new CylinderGeometry(rt, rb, h, seg)
const ball = (r: number) => new SphereGeometry(r, 14, 10)
// A flat polygon in its own x/y plane, facing +z.
const poly = (pts: [number, number][]) => new ShapeGeometry(new Shape(pts.map(([x, y]) => new Vector2(x, y))))
// Turns a flat part (facing +z) to face out of the car's side: sd 1 is +x, -1 is -x.
const side = (sd: number): [number, number, number] => [0, (sd * Math.PI) / 2, 0]
const BACK: [number, number, number] = [0, Math.PI, 0]

// Dark wells behind the tyres so the wheels sit in the body, like every road car.
// Each stops short of the rounded corners at the ends of the body (front, back), of the seams
// between its boxes (at the z listed in gaps), and of a nose narrower than the body (in from
// nose on).
function arches(k: Kit, hw: number, wz: number, r: number, front: number, back: number, gaps: number[] = [], nose = Infinity) {
  for (const z of [wz, -wz]) for (const sd of [-1, 1]) {
    const ok = (lx: number) => {
      const wz2 = z - sd * lx
      return wz2 < Math.min(front - 0.06, nose) && wz2 > back + 0.06 && gaps.every((gz) => Math.abs(wz2 - gz) > 0.05)
    }
    k.add('black', wellGeo(wellOutline(r * 1.18, r, ok)), [sd * (hw + 0.003), r, z], side(sd))
  }
}

// Round headlamp in a chrome ring, on a face looking +z.
function headlamp(k: Kit, x: number, y: number, z: number, r: number) {
  k.add('chrome', new TorusGeometry(r, r * 0.22, 5, 16), [x, y, z + 0.002])
  k.add('lamp', disc(r, 14), [x, y, z + 0.004])
}

export const ICECREAM = { len: 1.42, wid: 0.74, wheel: 0.15, lift: 0.12 }

// Ice cream truck: a pastel step van with a serving window under a striped awning on
// the left side, a giant cone on the roof and loudspeakers for the jingle.
export function iceCreamGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const { len, wid, wheel: r } = ICECREAM
  const hw = wid / 2
  const front = len / 2
  const wz = len * 0.33
  const bot = 0.15
  const top = 0.88
  // The box behind, the cab, and a short hood over the engine.
  k.add('paint', rbox(wid, top - bot, 0.92, 0.05), [0, (top + bot) / 2, -0.24])
  k.add('paint', rbox(wid, 0.51, 0.3, 0.05), [0, bot + 0.255, 0.31])
  k.add('paint', rbox(wid, 0.27, 0.28, 0.05), [0, bot + 0.135, 0.56])
  k.add('dark', rbox(wid * 1.01, 0.06, len * 0.8, 0.025), [0, 0.16, 0])
  arches(k, hw * 1.01, wz, r, front, -front, [0.44])
  // A pink trim band round the roof edge.
  k.add('pink', rbox(wid + 0.012, 0.035, 0.935, 0.012), [0, top - 0.012, -0.24])

  // Cab glass: a near-upright windshield and a window in each door.
  k.add('glass', plane(wid * 0.84, 0.18), [0, 0.555, 0.47], [-0.08, 0, 0])
  k.add('black', box(wid * 0.86, 0.02, 0.012), [0, 0.452, 0.462])
  for (const sd of [-1, 1]) {
    k.add('glass', plane(0.2, 0.16), [sd * (hw + 0.004), 0.55, 0.32], side(sd))
    // Door shut lines and a handle.
    k.add('dark', box(0.006, 0.36, 0.008), [sd * (hw + 0.002), 0.4, 0.2])
    k.add('chrome', box(0.01, 0.012, 0.04), [sd * (hw + 0.006), 0.44, 0.23])
    // Mirrors on short arms by the windshield.
    k.add('black', box(0.04, 0.012, 0.012), [sd * (hw + 0.02), 0.52, 0.44])
    k.add('black', rbox(0.018, 0.08, 0.05, 0.008), [sd * (hw + 0.045), 0.52, 0.44])
  }
  // Wipers on the windshield's base.
  for (const x of [-0.14, 0.12]) k.add('black', box(0.16, 0.008, 0.01), [x, 0.47, 0.482], [0, 0, 0.2])

  // Pastel stripes along both sides of the box and cab, and across the back.
  for (const sd of [-1, 1]) {
    k.add('pink', plane(1.14, 0.045), [sd * (hw + 0.008), 0.365, -0.12], side(sd))
    k.add('mint', plane(1.14, 0.045), [sd * (hw + 0.008), 0.415, -0.12], side(sd))
  }
  k.add('pink', plane(wid * 0.94, 0.045), [0, 0.365, -front - 0.004], BACK)
  k.add('mint', plane(wid * 0.94, 0.045), [0, 0.415, -front - 0.004], BACK)

  // Serving window on the left (+x) side: a dark hatch with a sliding pane, a counter,
  // a menu board, and a scalloped awning in pink and cream stripes.
  const sx = hw + 0.003
  const wzc = -0.25
  k.add('black', plane(0.44, 0.24), [sx, 0.62, wzc], side(1))
  k.add('cream', plane(0.2, 0.05), [sx + 0.001, 0.53, wzc + 0.09], side(1))
  for (const [dz, part] of [[0.05, 'pink'], [0.12, 'mint'], [0.19, 'pink']] as const) k.add(part, ball(0.03), [sx, 0.565, wzc + dz - 0.03])
  k.add('glass', plane(0.21, 0.22), [sx + 0.004, 0.62, wzc - 0.11], side(1))
  for (const dz of [-0.22, 0, 0.22]) k.add('chrome', box(0.012, 0.25, 0.014), [sx + 0.004, 0.62, wzc + dz])
  k.add('chrome', box(0.012, 0.014, 0.46), [sx + 0.004, 0.745, wzc])
  k.add('chrome', rbox(0.06, 0.018, 0.48, 0.006), [sx + 0.028, 0.495, wzc])
  k.add('cream', plane(0.13, 0.18), [sx + 0.001, 0.62, 0.09], side(1))
  for (const [dy, part] of [[0.05, 'pink'], [0, 'mint'], [-0.05, 'pink']] as const) {
    k.add(part, disc(0.017, 10), [sx + 0.003, 0.62 + dy, 0.12], side(1))
    k.add('dark', plane(0.05, 0.008), [sx + 0.003, 0.62 + dy, 0.065], side(1))
  }
  const slats = 5
  const sw = 0.5 / slats
  const tilt = -0.38
  const out = 0.11
  for (let i = 0; i < slats; i++) {
    const z = wzc - 0.25 + sw * (i + 0.5)
    const part = i % 2 ? 'cream' : 'pink'
    k.add(part, box(out, 0.012, sw), [sx + (out / 2) * Math.cos(tilt), 0.8 + (out / 2) * Math.sin(tilt), z], [0, 0, tilt])
    k.add(part, half(sw / 2), [sx + out * Math.cos(tilt) + 0.004, 0.8 + out * Math.sin(tilt), z], side(1))
  }
  k.add('chrome', box(0.012, 0.012, 0.49), [sx + 0.004, 0.8, wzc])

  // On the right (-x) side, a big cone picture.
  const dx = -(hw + 0.004)
  k.add('waffle', poly([[-0.08, 0.05], [0.08, 0.05], [0, -0.17]]), [dx, 0.6, -0.25], side(-1))
  k.add('pink', disc(0.075, 16), [dx - 0.003, 0.69, -0.25], side(-1))
  k.add('mint', disc(0.06, 16), [dx - 0.006, 0.78, -0.26], side(-1))
  k.add('tail', disc(0.018, 10), [dx - 0.009, 0.845, -0.26], side(-1))

  // The giant cone on the roof: a waffle cone, two scoops and a cherry, on a stand.
  const cz = -0.28
  k.add('chrome', cyl(0.03, 0.045, 0.05), [0, top + 0.025, cz])
  k.add('waffle', cyl(0.1, 0.012, 0.22, 14), [0, top + 0.13, cz])
  for (const t of [0.35, 0.65]) k.add('wood', new TorusGeometry(0.012 + (0.1 - 0.012) * t + 0.002, 0.005, 4, 14), [0, top + 0.02 + 0.22 * t, cz], [Math.PI / 2, 0, 0])
  k.add('pink', ball(0.095), [0, top + 0.27, cz])
  k.add('pink', new TorusGeometry(0.095, 0.022, 6, 14), [0, top + 0.245, cz], [Math.PI / 2, 0, 0])
  k.add('mint', ball(0.075), [0, top + 0.37, cz])
  k.add('cream', cyl(0.002, 0.05, 0.07, 10), [0, top + 0.45, cz])
  k.add('tail', ball(0.026), [0, top + 0.5, cz])
  // Loudspeaker horns on the front of the roof, for the jingle.
  for (const sd of [-1, 1]) {
    k.add('chrome', cyl(0.04, 0.012, 0.08, 12), [sd * 0.13, top + 0.04, 0.12], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.034, 12), [sd * 0.13, top + 0.04, 0.162])
    k.add('chrome', box(0.012, 0.04, 0.012), [sd * 0.13, top + 0.012, 0.1])
  }

  // Nose: round lamps, a grille and a chrome bumper.
  const nz = front
  for (const sd of [-1, 1]) {
    headlamp(k, sd * 0.25, 0.32, nz, 0.042)
    k.add('amber', plane(0.05, 0.02), [sd * 0.25, 0.255, nz + 0.003])
  }
  k.add('black', plane(0.28, 0.1), [0, 0.31, nz + 0.003])
  for (let i = 0; i < 4; i++) k.add('chrome', box(0.27, 0.008, 0.008), [0, 0.275 + i * 0.024, nz + 0.006])
  k.add('chrome', rbox(wid * 1.02, 0.05, 0.05, 0.02), [0, 0.19, nz + 0.01])
  k.add('dark', plane(0.13, 0.04), [0, 0.19, nz + 0.038])

  // Back: tail lamps, a window in the rear door, and a step bumper.
  const rz = -front - 0.004
  for (const sd of [-1, 1]) {
    k.add('tail', plane(0.05, 0.08), [sd * 0.3, 0.27, rz], BACK)
    k.add('amber', plane(0.05, 0.025), [sd * 0.3, 0.33, rz], BACK)
  }
  k.add('glass', plane(0.32, 0.14), [0, 0.7, rz], BACK)
  k.add('dark', box(0.006, 0.6, 0.006), [0, 0.5, rz])
  k.add('chrome', box(0.012, 0.03, 0.012), [0.03, 0.5, rz - 0.006])
  k.add('chrome', rbox(wid * 1.02, 0.05, 0.06, 0.02), [0, 0.19, -front - 0.016])
  if (!fit.exhaust) k.add('chrome', cyl(0.018, 0.018, 0.08, 8), [-0.24, 0.17, -front - 0.01], [Math.PI / 2, 0, 0])

  h.brakes(k, hw - 0.02, wz, r, 0.14)
}

export const PARCEL = { len: 1.36, wid: 0.72, wheel: 0.15, lift: 0.12 }

// Parcel van: a tall, square brown step van with a flat nose, a big upright windshield,
// a sliding side door left open on the kerb side (+x) with parcels stacked inside, and
// a roll-up door at the back.
export function parcelGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const { len, wid, wheel: r } = PARCEL
  const hw = wid / 2
  const front = len / 2
  const wz = len * 0.33
  const bot = 0.15
  const top = 0.9
  k.add('paint', rbox(wid, top - bot, 1.1, 0.045), [0, (top + bot) / 2, -0.13])
  k.add('paint', rbox(wid * 0.98, 0.27, 0.28, 0.045), [0, bot + 0.135, front - 0.14])
  k.add('dark', rbox(wid * 1.01, 0.06, len * 0.82, 0.025), [0, 0.16, 0])
  // Out past the skirt and the parcels in the open doorway.
  arches(k, hw * 1.01 + 0.008, wz, r, front, -front, [0.41], front - 0.28)
  const fz = 0.42
  // Windshield in two flat panes with a post between them, and a dark visor over them.
  k.add('glass', plane(wid * 0.86, 0.3), [0, 0.64, fz + 0.002])
  k.add('black', box(0.024, 0.3, 0.01), [0, 0.64, fz + 0.004])
  k.add('black', box(wid * 0.9, 0.022, 0.012), [0, 0.485, fz + 0.004])
  k.add('dark', rbox(wid * 0.96, 0.05, 0.06, 0.015), [0, 0.82, fz + 0.02])
  for (const x of [-0.13, 0.15]) k.add('black', box(0.012, 0.18, 0.008), [x, 0.58, fz + 0.007], [0, 0, 0.12])
  for (const x of [-0.24, 0, 0.24]) k.add('amber', box(0.04, 0.02, 0.025), [x, top + 0.008, fz - 0.02])

  // Kerb side: the sliding door is open, pushed back along its track, and the doorway
  // shows the dark inside with parcels stacked up and a step below.
  const ox = hw + 0.003
  const dz0 = 0.13
  const dz1 = 0.38
  const dzc = (dz0 + dz1) / 2
  k.add('black', plane(dz1 - dz0, 0.66), [ox, 0.52, dzc], side(1))
  for (const [z, y, w, hh] of [[0.2, 0.25, 0.1, 0.09], [0.31, 0.24, 0.08, 0.07], [0.2, 0.35, 0.09, 0.08], [0.32, 0.32, 0.07, 0.07], [0.22, 0.44, 0.07, 0.06]]) {
    k.add('waffle', plane(w, hh), [ox + 0.002, y, z], side(1))
    k.add('dark', plane(w, 0.012), [ox + 0.005, y, z], side(1))
  }
  k.add('seat', plane(0.07, 0.16), [ox + 0.002, 0.44, 0.355], side(1))
  k.add('dark', box(0.04, 0.012, dz1 - dz0), [ox + 0.018, 0.2, dzc])
  k.add('black', box(0.012, 0.02, 0.56), [ox + 0.006, 0.855, dzc - 0.14])
  const door = dzc - 0.25
  k.add('paint', rbox(0.016, 0.64, dz1 - dz0, 0.006), [ox + 0.014, 0.52, door])
  k.add('glass', plane(0.15, 0.2), [ox + 0.025, 0.68, door], side(1))
  k.add('black', box(0.008, 0.06, 0.016), [ox + 0.024, 0.5, door + 0.09])
  // Far side: the driver's door shut, with a window.
  const fx = -(hw + 0.003)
  k.add('glass', plane(0.18, 0.2), [fx, 0.68, dzc], side(-1))
  for (const z of [dz0, dz1 - 0.01]) k.add('dark', box(0.006, 0.66, 0.006), [fx, 0.52, z])
  k.add('chrome', box(0.01, 0.012, 0.04), [fx - 0.004, 0.5, dz0 + 0.04])
  for (const sd of [-1, 1]) {
    // Rub rail along the side (behind the open door on the kerb side), and mirrors on arms.
    const z0 = -front + 0.04
    const z1 = sd > 0 ? door - 0.13 : dz1
    k.add('black', box(0.012, 0.03, z1 - z0), [sd * (hw + 0.006), 0.36, (z0 + z1) / 2])
    k.add('black', box(0.04, 0.012, 0.012), [sd * (hw + 0.02), 0.64, fz + 0.01])
    k.add('black', rbox(0.02, 0.12, 0.05, 0.008), [sd * (hw + 0.045), 0.64, fz + 0.01])
    // A plain parcel picture on the box: no lettering.
    k.add('waffle', plane(0.18, 0.13), [sd * (hw + 0.004), 0.62, -0.38], side(sd))
    k.add('dark', plane(0.18, 0.016), [sd * (hw + 0.007), 0.62, -0.38], side(sd))
    k.add('dark', plane(0.016, 0.13), [sd * (hw + 0.007), 0.62, -0.38], side(sd))
  }

  // Flat nose: round lamps, a grille and a black bumper.
  for (const sd of [-1, 1]) {
    headlamp(k, sd * 0.24, 0.31, front, 0.04)
    k.add('amber', plane(0.045, 0.02), [sd * 0.24, 0.245, front + 0.003])
  }
  k.add('black', plane(0.3, 0.11), [0, 0.3, front + 0.003])
  for (let i = 0; i < 4; i++) k.add('dark', box(0.29, 0.01, 0.008), [0, 0.264 + i * 0.024, front + 0.006])
  k.add('black', rbox(wid * 1.02, 0.06, 0.05, 0.02), [0, 0.19, front + 0.01])

  // Back: a roll-up door in slats, lamps up the corners and a step bumper.
  const bz = -front + 0.004 - 0.008
  k.add('dark', plane(wid * 0.8, 0.66), [0, 0.53, bz], BACK)
  for (let y = 0.24; y < 0.85; y += 0.055) k.add('black', box(wid * 0.8, 0.006, 0.006), [0, y, bz - 0.003])
  k.add('chrome', box(0.08, 0.016, 0.014), [0, 0.27, bz - 0.008])
  for (const sd of [-1, 1]) {
    k.add('tail', plane(0.04, 0.12), [sd * 0.33, 0.3, bz], BACK)
    k.add('amber', plane(0.04, 0.03), [sd * 0.33, 0.39, bz], BACK)
    k.add('tail', box(0.04, 0.02, 0.02), [sd * 0.25, top + 0.008, -front + 0.03])
  }
  k.add('black', rbox(wid * 1.02, 0.05, 0.065, 0.02), [0, 0.18, -front - 0.0225])
  if (!fit.exhaust) k.add('chrome', cyl(0.016, 0.016, 0.08, 8), [-0.22, 0.15, -front - 0.02], [Math.PI / 2, 0, 0])

  h.brakes(k, hw - 0.02, wz, r, 0.14)
}

export const MONSTER = { len: 1.4, wid: 1.04, wheel: 0.27, lift: 0.56, track: 0.4, tyre: 0.24 }

// Monster truck: a pickup body lifted high over four huge tyres on exposed axles,
// with coil-over shocks, a roof light bar, flames down the sides and stacks behind the cab.
export function monsterGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const { len, wheel: r, lift, track } = MONSTER
  const front = 0.66
  const back = -0.65
  const wz = len * 0.33
  const bw = 0.68
  const hw = bw / 2
  const deck = 0.7

  // Chassis: frame rails, axles with a diff in the middle, links up to the frame.
  for (const sd of [-1, 1]) k.add('black', box(0.05, 0.07, 1.26), [sd * 0.18, 0.47, 0])
  for (const z of [wz, -wz]) {
    k.add('black', cyl(0.035, 0.035, track * 2 - 0.1, 10), [0, r, z], [0, 0, Math.PI / 2])
    k.add('dark', ball(0.075), [0, r, z])
    for (const sd of [-1, 1]) {
      h.bar(k, 'black', [sd * 0.18, r + 0.02, z], [sd * 0.18, 0.45, z - Math.sign(z) * 0.2], 0.035)
      // Two coil-over shocks per wheel, leaning in to the frame.
      for (const dz of [-0.07, 0.07]) {
        const a: [number, number, number] = [sd * 0.27, r + 0.03, z + dz]
        const b: [number, number, number] = [sd * 0.22, lift + 0.02, z + dz * 1.4]
        h.bar(k, 'chrome', a, b, 0.024)
        const m: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.03, (a[2] + b[2]) / 2]
        h.bar(k, 'amber', [m[0], m[1] - 0.07, m[2]], [m[0], m[1] + 0.07, m[2]], 0.042)
      }
    }
  }

  // Body: a lower tub, a hood, the cab and a bed with walls and a tailgate.
  k.add('paint', rbox(bw, deck - lift, front - back, 0.035), [0, (deck + lift) / 2, (front + back) / 2])
  k.add('paint', rbox(bw, 0.14, 0.34, 0.04), [0, deck + 0.06, 0.49])
  k.add('paint', rbox(bw * 0.96, 0.3, 0.38, 0.05), [0, deck + 0.15, 0.15])
  const bedZ0 = back
  const bedZ1 = -0.05
  const bedC = (bedZ0 + bedZ1) / 2
  for (const sd of [-1, 1]) k.add('paint', rbox(0.04, 0.12, bedZ1 - bedZ0, 0.012), [sd * (hw - 0.02), deck + 0.05, bedC])
  k.add('paint', rbox(bw, 0.12, 0.04, 0.012), [0, deck + 0.05, bedZ0 + 0.02])
  k.add('black', plane(bw - 0.08, bedZ1 - bedZ0 - 0.05), [0, deck + 0.002, bedC + 0.01], [-Math.PI / 2, 0, 0])
  // A roll bar standing in the bed.
  k.add('chrome', new TorusGeometry(0.26, 0.018, 6, 16, Math.PI), [0, deck + 0.06, -0.16], [0, 0, 0], [1, 0.75, 1])
  for (const sd of [-1, 1]) k.add('chrome', cyl(0.018, 0.018, 0.06, 8), [sd * 0.26, deck + 0.03, -0.16])

  // Cab glass and trim.
  const ct = deck + 0.3
  k.add('glass', plane(bw * 0.82, 0.17), [0, ct - 0.1, 0.352], [-0.1, 0, 0])
  k.add('glass', plane(bw * 0.78, 0.13), [0, ct - 0.09, -0.042], BACK)
  for (const sd of [-1, 1]) {
    k.add('glass', plane(0.3, 0.14), [sd * (hw * 0.96 + 0.004), ct - 0.095, 0.16], side(sd))
    k.add('black', box(0.06, 0.012, 0.012), [sd * (hw + 0.03), ct - 0.12, 0.3])
    k.add('black', rbox(0.02, 0.08, 0.05, 0.008), [sd * (hw + 0.065), ct - 0.12, 0.3])
    k.add('dark', box(0.006, 0.12, 0.008), [sd * (hw + 0.002), deck - 0.07, 0.0])
    // Flames licking back down each side.
    // Drawn tip forward: on the +x side the part's own x runs to the back, so it's flipped.
    const pts: [number, number][] = [[0, 0.05], [-0.1, 0.04], [-0.06, 0.02], [-0.2, 0.01], [-0.12, -0.005], [-0.24, -0.025], [-0.08, -0.03], [-0.14, -0.05], [0, -0.05], [0.05, 0]]
    k.add('amber', poly(pts.map(([x, y]) => [-sd * x, y])), [sd * (hw + 0.003), (deck + lift) / 2, 0.5], side(sd))
  }
  // Roof light bar.
  k.add('black', box(0.5, 0.04, 0.06), [0, ct + 0.03, 0.26])
  for (const x of [-0.18, -0.06, 0.06, 0.18]) k.add('lamp', disc(0.022, 10), [x, ct + 0.03, 0.292])
  for (const sd of [-1, 1]) k.add('black', box(0.02, 0.03, 0.03), [sd * 0.2, ct + 0.005, 0.26])

  // Hood scoop, unless a hood mod sits there instead.
  if (!fit.hood) {
    k.add('chrome', rbox(0.2, 0.07, 0.16, 0.025), [0, deck + 0.16, 0.5])
    k.add('black', plane(0.16, 0.04), [0, deck + 0.165, 0.583])
  }
  // Exhaust stacks behind the cab.
  if (!fit.exhaust) for (const sd of [-1, 1]) {
    k.add('chrome', cyl(0.028, 0.028, 0.32, 10), [sd * 0.27, deck + 0.2, -0.08])
    k.add('black', disc(0.024, 10), [sd * 0.27, deck + 0.361, -0.08], [-Math.PI / 2, 0, 0])
  }

  // Nose: grille, lamps and a tube bumper; back: tail lamps and a bumper.
  const nz = front + 0.002
  k.add('chrome', plane(0.32, 0.09), [0, deck + 0.05, nz])
  for (let i = 0; i < 3; i++) k.add('black', box(0.3, 0.01, 0.006), [0, deck + 0.025 + i * 0.025, nz + 0.003])
  for (const sd of [-1, 1]) {
    headlamp(k, sd * 0.24, deck + 0.05, nz, 0.038)
    k.add('amber', plane(0.05, 0.02), [sd * 0.24, lift + 0.07, nz])
  }
  k.add('black', cyl(0.025, 0.025, bw + 0.06, 10), [0, lift + 0.03, front + 0.04], [0, 0, Math.PI / 2])
  for (const sd of [-1, 1]) h.bar(k, 'black', [sd * 0.2, lift + 0.03, front + 0.04], [sd * 0.2, lift + 0.1, front - 0.01], 0.025)
  for (const sd of [-1, 1]) k.add('tail', plane(0.06, 0.07), [sd * 0.27, deck + 0.05, back - 0.004], BACK)
  k.add('black', rbox(bw + 0.04, 0.05, 0.06, 0.02), [0, lift + 0.015, back - 0.03])

  h.brakes(k, track, wz, r, MONSTER.tyre)
}

// Oddball bodies by name, and what draws each (drawn through the same path as EXOTIC).
export const ODDBALL: Partial<Record<Body, (k: Kit, fit: ExoticFit, h: ExoticHelpers) => void>> = { icecream: iceCreamGeo, monster: monsterGeo, parcel: parcelGeo }
