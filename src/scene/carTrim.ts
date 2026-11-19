import { BoxGeometry, CircleGeometry, CylinderGeometry, Euler, PlaneGeometry, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import { roundedBox } from './roundedBox'
import type { Kit, Part } from './CarModel'
import type { RimStyle } from './carWheels'

// The outside face of a closed cabin's windshield (front) or back window (CarModel cabinPanes):
// where the glass is at height y (z), the way out of it (ny, nz), and the tilt (about x) that lays
// a flat part on it. lo and hi bound its flat run, from its foot to where it rounds into the roof.
export type Pane = { at: (y: number) => number; ny: number; nz: number; tilt: number; lo: number; hi: number }
export type Panes = { front: Pane; back: Pane }
// A point lying d out from the pane's face at height y.
export const onPane = (p: Pane, x: number, y: number, d: number): [number, number, number] => [x, y + p.ny * d, p.at(y) + p.nz * d]

// Per-model trim: the bits that make two cars on the same body tell apart up
// close (a sunroof, hood pins, a roof rack, a spare wheel, a gold bird on the
// hood). Everything is added to the car's Kit in a look the car already has
// (paint, black, chrome, lamp...), so it merges into the draws that exist and a
// town car still bakes into its two meshes. Trims never add a material.

type V3 = [number, number, number]

// Measurements of the car being built, taken from carGeo.
export type TrimFrame = {
  len: number; wid: number; lift: number; body: number; wheel: number; cabinZ: number; cabinLen: number
  top: number // rear deck height
  hoodY: number // hood height
  bulge: number // height of the bulge down the middle of the hood (within a quarter width of the centre line)
  hoodFront: number // where the hood ends at the nose
  cowl: number // base of the windshield
  front: number // half the length: the nose is at +front, the tail at -front
  wz: number // axle distance from the middle
  lightY: number // headlight height
  plateY: number // front number plate height
  nose: (y: number) => [number, number, number] // the nose surface at height y: [z, y, tilt]
  ty: number // tail light height
  roofY: number; roofLen: number; roofZ: number // 0 roofLen: no roof
  exhaust: boolean // an exhaust mod is fitted
  spoiler: boolean // a spoiler mod is fitted
  kit: boolean // a body kit is fitted (its arches and skirts cover the doors)
  hood: boolean // a hood mod is fitted
  roofMod: boolean // a roof rack or roof light bar mod is fitted (it replaces the roof gear below)
  closed: boolean
  glass: Panes | null // the outside of the windshield and back window, on closed cabins
}

type Feature =
  | 'roofRack' | 'roofBox' | 'surfboard' | 'sunroof' | 'panoRoof' | 'visors' | 'twoTone' | 'ttop' | 'roofScoop' | 'beacon' | 'lightBar'
  | 'hoodPins' | 'hoodVents' | 'hoodChevron' | 'hoodBulges' | 'ornament' | 'lightPods'
  | 'louvers' | 'deckLouvers' | 'sharkFin' | 'tailBand' | 'rearRack' | 'continental' | 'spare' | 'stowage' | 'towHitch' | 'whip'
  | 'sideExhaust' | 'sideStripe' | 'chromeBelt' | 'fenderVents' | 'eyebrows' | 'roundel'
  | 'splitter' | 'canards' | 'bullBar' | 'overriders' | 'snorkel' | 'toolbox' | 'crates' | 'humps'
  | 'stopArm' | 'roofHatches' | 'schoolSign' | 'crossingArm' | 'busMirrors' | 'bone'
  | 'hoodCreases' | 'meshGrille' | 'popups' | 'quadTails' | 'tripleTails' | 'sideSkirts' | 'rearWiper' | 'diffuserFins'
  | 'centerExhaust' | 'stepBars' | 'ladder' | 'tailgateLettering' | 'fuelCap' | 'towStrap' | 'chromeTrimWindow'
  | 'roofSeams' | 'chargePort' | 'boxFlares' | 'trunkWing' | 'sideBlade' | 'horseshoe' | 'swanWing' | 'lipSpoiler'

// What each car gets on top of its body's own detail. Ids not in this build
// (another thread's newer cars) are simply skipped.
const TRIMS: Record<string, Feature[]> = {
  pip: ['roofRack', 'roofBox', 'visors', 'rearWiper'],
  civic: ['sunroof', 'visors', 'chromeBelt', 'hoodCreases'],
  trail: ['bullBar', 'toolbox', 'towHitch', 'snorkel', 'stepBars', 'tailgateLettering'],
  miata: ['rearRack', 'hoodVents', 'popups'],
  stallion: ['hoodPins', 'sideStripe', 'louvers', 'tripleTails'],
  rally: ['lightPods', 'roofScoop', 'roundel', 'splitter', 'towStrap', 'fuelCap'],
  vette: ['sideExhaust', 'fenderVents', 'ttop', 'popups', 'quadTails'],
  charger: ['tailBand', 'hoodPins', 'chromeBelt', 'fuelCap', 'hoodCreases'],
  // No canards: the flares cover the nose's corners where they'd bolt on.
  hellcat: ['hoodVents', 'splitter', 'diffuserFins'],
  gtr: ['splitter', 'canards', 'fenderVents', 'trunkWing', 'quadTails', 'sideSkirts'],
  tomahawk: ['stowage', 'spare', 'beacon'],
  lambo: ['deckLouvers', 'roofScoop', 'splitter', 'popups', 'diffuserFins', 'centerExhaust'],
  hyper: ['sharkFin', 'hoodVents', 'canards', 'splitter', 'diffuserFins', 'sideSkirts'],
  bug: ['rearRack', 'overriders', 'sideStripe'],
  woodie: ['surfboard', 'chromeBelt', 'overriders', 'chromeTrimWindow', 'rearWiper'],
  hauler: ['beacon', 'crates', 'towHitch', 'bullBar', 'tailgateLettering', 'stepBars'],
  cruiser: ['twoTone', 'continental', 'chromeBelt', 'chromeTrimWindow', 'hoodCreases'],
  buggy: ['whip', 'spare', 'bullBar'],
  bandit: ['hoodChevron', 'ttop', 'louvers', 'sideSkirts'],
  lemans: ['roundel', 'splitter', 'sharkFin', 'lightPods', 'fuelCap', 'diffuserFins'],
  gullwing: ['eyebrows', 'hoodBulges', 'chromeBelt', 'chromeTrimWindow', 'roofSeams'],
  // Cars from the More cars set.
  camper: ['roofRack', 'surfboard', 'overriders', 'ladder', 'chromeTrimWindow'],
  hotshot: ['hoodVents', 'sideStripe', 'roundel', 'meshGrille', 'towStrap', 'rearWiper'],
  ridgeback: ['roofRack', 'snorkel', 'bullBar', 'towHitch', 'stepBars', 'rearWiper'],
  kitsune: ['popups', 'sideStripe', 'towStrap', 'rearWiper', 'lipSpoiler'],
  current: ['panoRoof', 'sideStripe', 'chargePort', 'hoodCreases'],
  salon: ['ornament', 'chromeBelt', 'twoTone', 'chromeTrimWindow', 'hoodCreases'],
  stomper: ['lightBar', 'bullBar', 'snorkel', 'crates', 'stepBars', 'tailgateLettering'],
  zenith: ['sharkFin', 'canards', 'deckLouvers', 'splitter', 'diffuserFins', 'centerExhaust'],
  speedster: ['humps', 'roundel', 'rearRack', 'fuelCap'],
  schoolbus: ['stopArm', 'roofHatches', 'schoolSign', 'crossingArm', 'busMirrors'],
  tusker: ['stowage', 'towHitch', 'whip'],
  shaggy: ['roofRack', 'bone', 'towHitch'],
  nightfall: ['splitter', 'canards', 'deckLouvers', 'fenderVents', 'diffuserFins', 'centerExhaust'],
  // Gap fillers.
  kreis: ['boxFlares', 'trunkWing', 'splitter', 'sideSkirts', 'roundel'],
  bergmeister: ['deckLouvers', 'sideStripe', 'fuelCap'],
  rattler: ['sideExhaust', 'roundel', 'hoodPins', 'quadTails', 'splitter'],
  cottonmouth: ['hoodVents', 'sideExhaust', 'fenderVents', 'splitter', 'canards', 'diffuserFins'],
  ringmeister: ['lipSpoiler', 'sideBlade', 'diffuserFins', 'deckLouvers', 'sideSkirts'],
  raiden: ['sharkFin', 'roofScoop', 'roundel', 'splitter', 'canards', 'diffuserFins'],
  sovereign: ['lipSpoiler', 'horseshoe', 'roofScoop', 'diffuserFins', 'centerExhaust', 'sideSkirts'],
  wraith: ['swanWing', 'canards', 'splitter', 'diffuserFins', 'centerExhaust', 'roofScoop'],
}

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)
const rbox = (w: number, h: number, d: number, r: number) => roundedBox(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
const plane = (w: number, h: number) => new PlaneGeometry(w, h)
const disc = (r: number, seg = 14) => new CircleGeometry(r, seg)
const cyl = (rt: number, rb: number, h: number, seg = 10) => new CylinderGeometry(rt, rb, h, seg)

// A rounded bar from a to b.
function bar(k: Kit, part: Part, a: V3, b: V3, t: number) {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize()))
  k.add(part, rbox(t, d.length() + t, t, t * 0.45), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [e.x, e.y, e.z])
}

// Where a flat part at height y sits on the nose, lifted `out` off the surface along
// its normal (so it stays clear where the nose curves back into the hood): [z, y, tilt].
function onNose(f: TrimFrame, y: number, out: number): V3 {
  const [z, ny, rx] = f.nose(y)
  return [z + Math.cos(rx) * out, ny - Math.sin(rx) * out, rx]
}

// Small finishing touches every car gets: badges front and back, and characters on the plates.
function badges(k: Kit, f: TrimFrame) {
  const [bz, by, bt] = onNose(f, f.lightY + 0.04, 0.0135)
  k.add('chrome', disc(0.018, 12), [0, by, bz], [bt, 0, 0])
  k.add('chrome', box(0.07, 0.012, 0.0125), [0, f.ty + 0.045, -f.front - 0.00425])
  for (const [z, y, sd] of [[f.front + 0.04, f.plateY, 1], [-f.front - 0.0385, f.lift + 0.13, -1]] as const)
    for (const x of [-0.032, 0, 0.032]) k.add('dark', plane(0.018, 0.016), [x, y, z], [0, sd < 0 ? Math.PI : 0, 0])
}

const SIDES = [-1, 1] as const

function feature(k: Kit, f: Feature, t: TrimFrame, all: Feature[]) {
  const { wid, len, lift, top, hoodY, front, roofY, roofLen, roofZ, wz, wheel } = t
  const roof = roofLen > 0
  switch (f) {
    case 'boxFlares':
      // Squared-off blistered arches over all four wheels.
      for (const sd of SIDES) for (const z of [wz, -wz]) k.add('paint', new TorusGeometry(wheel * 1.22, 0.036, 4, 5, Math.PI), [sd * (wid / 2 + 0.014), wheel, z], [0, (sd * Math.PI) / 2, 0], [1, 1, 1.5])
      return
    case 'trunkWing':
      // Small wing on the trunk lid, standing on two short legs.
      if (t.spoiler) return
      for (const sd of SIDES) k.add('black', box(0.02, 0.045, 0.03), [sd * wid * 0.3, top + 0.022, -front + 0.09])
      k.add('black', box(wid * 0.82, 0.018, 0.1), [0, top + 0.05, -front + 0.08], [0.1, 0, 0])
      k.add('black', box(wid * 0.82, 0.016, 0.006), [0, top + 0.06, -front + 0.032])
      return
    case 'lipSpoiler':
      // A slim lip along the tail in place of a wing (CarModel leaves out the stock wing).
      if (t.spoiler) return
      k.add('paint', box(wid * 0.86, 0.022, 0.07), [0, top + 0.01, -front + 0.05], [0.3, 0, 0])
      k.add('black', box(wid * 0.84, 0.006, 0.004), [0, top + 0.021, -front + 0.017])
      return
    case 'sideBlade':
      // A contrasting blade behind each door, with an intake slot cut into it.
      for (const sd of SIDES) {
        const p: V3 = [sd * (wid / 2 + 0.007), lift + t.body * 0.55, -wz + wheel * 1.45]
        k.add('black', plane(0.15, t.body * 0.85), p, [0, (sd * Math.PI) / 2, 0])
        k.add('dark', plane(0.09, 0.03), [p[0] + sd * 0.002, p[1] + 0.01, p[2] - 0.01], [0, (sd * Math.PI) / 2, 0])
      }
      return
    case 'horseshoe': {
      // A chrome horseshoe grille in the nose, and a chrome curve sweeping round each door.
      const [z, y, rx] = onNose(t, t.lightY - 0.01, 0.008)
      k.add('dark', disc(0.04, 14), [0, y, z], [rx, 0, 0])
      k.add('chrome', new TorusGeometry(0.044, 0.008, 4, 16, Math.PI * 1.5), [0, y, z + 0.002], [rx, 0, -Math.PI * 0.25])
      for (const sd of SIDES) k.add('chrome', new TorusGeometry(t.body * 0.42, 0.006, 3, 16, Math.PI), [sd * (wid / 2 + 0.006), lift + t.body * 0.58, t.cabinZ - t.cabinLen * 0.1], [0, (sd * Math.PI) / 2, sd * Math.PI / 2])
      return
    }
    case 'swanWing':
      // A big rear wing hung from two swan-neck posts, with endplates.
      if (t.spoiler) return
      for (const sd of SIDES) {
        bar(k, 'black', [sd * wid * 0.18, top, -front + 0.24], [sd * wid * 0.18, top + 0.17, -front + 0.17], 0.02)
        bar(k, 'black', [sd * wid * 0.18, top + 0.17, -front + 0.17], [sd * wid * 0.18, top + 0.15, -front + 0.1], 0.02)
        k.add('paint', box(0.012, 0.07, 0.17), [sd * wid * 0.46, top + 0.13, -front + 0.1])
      }
      k.add('paint', box(wid * 0.92, 0.02, 0.14), [0, top + 0.14, -front + 0.1], [0.08, 0, 0])
      k.add('black', box(wid * 0.9, 0.012, 0.05), [0, top + 0.16, -front + 0.04], [0.45, 0, 0])
      return
    case 'hoodCreases':
      for (const sd of SIDES) k.add('dark', box(0.006, 0.003, (t.hoodFront - t.cowl) * 0.85), [sd * wid * 0.27, hoodY + 0.002, (t.cowl + t.hoodFront) / 2])
      return
    case 'meshGrille': {
      // Honeycomb dots across the grille.
      const [z, y, rx] = onNose(t, t.lightY, 0.0135)
      for (let r = -1; r <= 1; r++) for (let i = -4; i <= 4; i++) k.add('black', disc(0.006, 6), [i * 0.022 + (r % 2 ? 0.011 : 0), y + r * 0.014, z], [rx, 0, 0])
      return
    }
    case 'popups':
      // Pop-up lamp lids flush in the front of the hood: a seam round each and a dark edge.
      for (const sd of SIDES) {
        const x = sd * wid * 0.3
        const z = t.hoodFront - 0.07
        k.add('dark', box(0.13, 0.003, 0.004), [x, hoodY + 0.002, z + 0.04])
        k.add('dark', box(0.13, 0.003, 0.004), [x, hoodY + 0.002, z - 0.04])
        for (const e of [-1, 1]) k.add('dark', box(0.004, 0.003, 0.08), [x + e * 0.065, hoodY + 0.002, z])
      }
      return
    case 'quadTails':
      // Two round lamps a side with chrome rings, over the stock cluster.
      for (const sd of SIDES) for (const lx of [0.2, 0.36]) {
        k.add('black', disc(0.034, 14), [sd * wid * lx, t.ty, -front - 0.011], [0, Math.PI, 0])
        k.add('tail', disc(0.027, 14), [sd * wid * lx, t.ty, -front - 0.0135], [0, Math.PI, 0])
        k.add('chrome', new TorusGeometry(0.03, 0.004, 3, 14), [sd * wid * lx, t.ty, -front - 0.0135])
      }
      return
    case 'tripleTails':
      // Three upright bars in each tail light.
      for (const sd of SIDES) {
        k.add('black', plane(0.16, 0.065), [sd * wid * 0.3, t.ty, -front - 0.011], [0, Math.PI, 0])
        for (const i of [-1, 0, 1]) k.add('tail', plane(0.036, 0.05), [sd * wid * 0.3 + i * 0.048, t.ty, -front - 0.0135], [0, Math.PI, 0])
      }
      return
    case 'sideSkirts':
      for (const sd of SIDES) k.add('black', box(0.03, 0.025, wz * 2 - wheel * 2.44), [sd * (wid / 2 + 0.0075), lift + 0.035, 0])
      return
    case 'rearWiper': {
      // Lying on the outside of the back window, following its slope.
      if (!roof || !t.glass) return
      const g = t.glass.back
      k.add('black', box(0.12, 0.01, 0.006), onPane(g, 0.03, (Math.min(roofY, g.hi) + top) / 2 - 0.02, 0.006), [g.tilt, 0, 0.3])
      return
    }
    case 'diffuserFins':
      k.add('black', box(wid * 0.8 - 0.006, 0.012, 0.09), [0, lift + 0.033, -front + 0.01])
      for (let i = -3; i <= 3; i++) k.add('black', box(0.006, 0.055, 0.09), [i * wid * 0.11, lift + 0.055, -front + 0.01])
      return
    case 'centerExhaust':
      if (t.exhaust) return
      // Out through the bumper either side of the number plate, between the diffuser's fins.
      for (const x of [-wid * 0.165, wid * 0.165]) {
        k.add('chrome', cyl(0.022, 0.022, 0.06, 12), [x, lift + 0.07, -front - 0.02], [Math.PI / 2, 0, 0])
        k.add('black', disc(0.016, 10), [x, lift + 0.07, -front - 0.053], [0, Math.PI, 0])
      }
      return
    case 'stepBars':
      for (const sd of SIDES) {
        k.add('chrome', rbox(0.05, 0.02, wz * 2 - wheel * 2.6, 0.008), [sd * (wid / 2 + 0.035), lift + 0.01, 0])
        for (const z of [-0.5, 0.5]) k.add('black', box(0.04, 0.03, 0.02), [sd * (wid / 2 + 0.0125), lift + 0.02, z * (wz * 2 - wheel * 2.8)])
      }
      return
    case 'ladder': {
      // Rails from the bumper up past the roof's back edge, hooked over onto the roof.
      const x = -wid * 0.3
      const z = -front - 0.025
      const y1 = roof ? roofY + 0.02 : top + 0.06
      for (const sd of [-1, 1]) {
        k.add('chrome', box(0.01, y1 - lift - 0.03, 0.01), [x + sd * 0.04, (y1 + lift + 0.03) / 2, z])
        if (roof) bar(k, 'chrome', [x + sd * 0.04, y1, z], [x + sd * 0.04, y1, roofZ - roofLen / 2 + 0.03], 0.01)
      }
      for (let y = lift + 0.08; y < y1 - 0.02; y += 0.06) k.add('chrome', box(0.08, 0.008, 0.008), [x, y, z])
      return
    }
    case 'tailgateLettering':
      for (let i = 0; i < 4; i++) k.add('chrome', plane(0.045, 0.035), [(i - 1.5) * 0.06, top - 0.045, -front - 0.006], [0, Math.PI, 0])
      return
    case 'fuelCap':
      // Racing filler on the left rear quarter.
    {
      // Clear of the back window, on cars whose cabin runs far back.
      const z = Math.min(-front + 0.2, t.glass ? t.glass.back.at(top) - 0.04 : Infinity)
      k.add('chrome', cyl(0.03, 0.03, 0.014, 16), [-wid * 0.36, top + 0.002, z])
      k.add('black', disc(0.012, 8), [-wid * 0.36, top + 0.0115, z], [-Math.PI / 2, 0, 0])
      return
    }
    case 'towStrap':
      // Inboard of the fog lamp on that side.
      k.add('tail', box(0.035, 0.05, 0.008), [wid * 0.16, lift + 0.05, front + 0.03])
      return
    case 'chromeTrimWindow':
      if (!roof) return
      // Centred on the black window trim, in two lengths either side of the door pillar.
      for (const sd of SIDES) {
        const z0 = t.cabinZ - t.cabinLen * 0.43
        const z1 = t.cabinZ + t.cabinLen * 0.43
        const p = roofZ - roofLen * 0.05
        for (const [a, b] of [[z0, p - 0.015], [p + 0.015, z1]]) if (b > a) k.add('chrome', box(0.007, 0.01, b - a), [sd * wid * 0.402, top + 0.022, (a + b) / 2])
      }
      return
    case 'roofSeams':
      if (!roof) return
      k.add('chrome', box(0.012, 0.004, roofLen * 0.95), [0, roofY + 0.002, roofZ])
      for (const sd of SIDES) k.add('dark', box(0.004, 0.003, roofLen * 0.9), [sd * wid * 0.3, roofY + 0.002, roofZ])
      return
    case 'chargePort':
      k.add('dark', plane(0.04, 0.03), [-(wid / 2 + 0.004), top - 0.05, wz + wheel * 1.25], [0, -Math.PI / 2, 0])
      k.add('lamp', plane(0.012, 0.012), [-(wid / 2 + 0.006), top - 0.05, wz + wheel * 1.25], [0, -Math.PI / 2, 0])
      return
    case 'roofRack':
      if (!roof || t.roofMod) return
      for (const sd of SIDES) {
        k.add('chrome', box(0.018, 0.018, roofLen * 0.86), [sd * wid * 0.31, roofY + 0.035, roofZ])
        for (const z of [-0.38, 0.38]) k.add('black', box(0.024, 0.035, 0.025), [sd * wid * 0.31, roofY + 0.015, roofZ + z * roofLen])
      }
      for (const z of [-0.3, 0, 0.3]) k.add('black', box(wid * 0.66, 0.012, 0.02), [0, roofY + 0.045, roofZ + z * roofLen])
      return
    case 'roofBox':
      if (roof && !t.roofMod) k.add('black', rbox(wid * 0.48, 0.07, roofLen * 0.62, 0.03), [0, roofY + 0.085, roofZ - roofLen * 0.05])
      return
    case 'surfboard':
      if (!roof || t.roofMod) return
      // With no roof rack under it, the board rides on a pair of bars on feet, as tall as the rack's.
      if (!all.includes('roofRack')) for (const z of [-0.3, 0.3]) {
        k.add('black', box(wid * 0.5, 0.012, 0.02), [0, roofY + 0.045, roofZ + z * roofLen])
        for (const sd of SIDES) k.add('black', box(0.024, 0.04, 0.025), [sd * wid * 0.22, roofY + 0.02, roofZ + z * roofLen])
      }
      k.add('wood', new SphereGeometry(1, 14, 6), [0, roofY + 0.065, roofZ - 0.02], [0, 0, 0], [wid * 0.15, 0.014, len * 0.44])
      k.add('chrome', box(0.012, 0.004, len * 0.7), [0, roofY + 0.08, roofZ - 0.02])
      k.add('black', box(0.004, 0.04, 0.05), [0, roofY + 0.05, roofZ - 0.02 - len * 0.38])
      return
    case 'sunroof':
      if (!roof) return
      k.add('black', box(wid * 0.48, 0.007, roofLen * 0.42), [0, roofY + 0.0005, roofZ + roofLen * 0.12])
      k.add('glass', box(wid * 0.42, 0.006, roofLen * 0.36), [0, roofY + 0.0035, roofZ + roofLen * 0.12])
      return
    case 'panoRoof':
      if (roof) k.add('glass', box(wid * 0.74, 0.006, roofLen * 0.9), [0, roofY + 0.003, roofZ])
      return
    case 'visors':
      if (roof) for (const sd of SIDES) k.add('black', box(0.03, 0.008, roofLen * 0.8), [sd * wid * 0.41, roofY - 0.02, roofZ], [0, 0, sd * -0.5])
      return
    case 'twoTone':
      if (roof) k.add('chrome', box(wid * 0.85, 0.006, roofLen * 0.97), [0, roofY + 0.002, roofZ])
      return
    case 'ttop':
      if (!roof) return
      for (const sd of SIDES) k.add('glass', box(wid * 0.3, 0.006, roofLen * 0.62), [sd * wid * 0.19, roofY + 0.003, roofZ + roofLen * 0.08])
      k.add('chrome', box(0.035, 0.007, roofLen * 0.92), [0, roofY + 0.004, roofZ])
      return
    case 'roofScoop':
      if (!roof || t.roofMod) return
      k.add('black', rbox(0.12, 0.045, 0.13, 0.018), [0, roofY + 0.02, roofZ + roofLen * 0.1])
      k.add('dark', box(0.09, 0.022, 0.004), [0, roofY + 0.028, roofZ + roofLen * 0.1 + 0.066])
      return
    case 'beacon':
      if (!roof) {
        k.add('black', cyl(0.006, 0.006, 0.12, 5), [-wid * 0.3, top + 0.06, -front + 0.14])
        k.add('amber', cyl(0.028, 0.03, 0.04, 10), [-wid * 0.3, top + 0.14, -front + 0.14])
        return
      }
      k.add('chrome', cyl(0.035, 0.035, 0.012, 10), [0, roofY + 0.006, roofZ - roofLen * 0.15])
      k.add('amber', cyl(0.026, 0.03, 0.045, 10), [0, roofY + 0.034, roofZ - roofLen * 0.15])
      return
    case 'lightBar':
      if (!roof || t.roofMod) return
      k.add('black', rbox(wid * 0.72, 0.04, 0.05, 0.012), [0, roofY + 0.04, roofZ + roofLen * 0.38])
      for (const x of [-0.3, -0.15, 0, 0.15, 0.3]) k.add('lamp', disc(0.016, 10), [x * wid, roofY + 0.04, roofZ + roofLen * 0.38 + 0.028])
      for (const sd of SIDES) k.add('black', box(0.015, 0.03, 0.015), [sd * wid * 0.32, roofY + 0.012, roofZ + roofLen * 0.38])
      return
    case 'hoodPins':
      for (const sd of SIDES) {
        k.add('chrome', cyl(0.013, 0.013, 0.01, 10), [sd * wid * 0.27, hoodY + 0.003, t.hoodFront - 0.05])
        k.add('black', box(0.004, 0.003, 0.03), [sd * wid * 0.27, hoodY + 0.009, t.hoodFront - 0.05])
      }
      return
    case 'hoodVents':
      if (t.hood) return
      for (const sd of SIDES) for (let i = 0; i < 4; i++) k.add('black', box(0.1, 0.006, 0.01), [sd * wid * 0.18, hoodY + t.bulge + 0.004, (t.cowl + t.hoodFront) / 2 + (i - 1.5) * 0.024])
      return
    case 'hoodChevron': {
      // A gold bird with spread wings on the nose of the hood, ahead of any scoop.
      const z = t.hoodFront - 0.075
      const y = hoodY + t.bulge + 0.006
      for (const sd of SIDES) {
        k.add('amber', plane(0.17, 0.03), [sd * 0.07, y, z], [-Math.PI / 2, 0, sd * -0.45])
        k.add('amber', plane(0.1, 0.022), [sd * 0.1, y, z - 0.045], [-Math.PI / 2, 0, sd * -0.25])
      }
      k.add('amber', disc(0.025, 10), [0, y + 0.001, z + 0.02], [-Math.PI / 2, 0, 0])
      return
    }
    case 'hoodBulges':
      for (const sd of SIDES) k.add('paint', rbox(0.1, 0.035, (t.hoodFront - t.cowl) * 0.7, 0.016), [sd * wid * 0.2, hoodY + t.bulge + 0.004, (t.cowl + t.hoodFront) / 2])
      return
    case 'ornament':
      k.add('chrome', cyl(0.008, 0.012, 0.04, 8), [0, hoodY + 0.02, t.hoodFront - 0.02])
      k.add('chrome', new SphereGeometry(0.018, 10, 8), [0, hoodY + 0.05, t.hoodFront - 0.02], [0, 0, 0], [0.5, 1, 1.4])
      return
    case 'lightPods':
      // Spread wide, so the inner pair stays clear of a scoop down the middle of the hood.
      k.add('black', box(wid * 0.76, 0.014, 0.02), [0, hoodY + 0.03, t.hoodFront - 0.01])
      for (const x of [-0.34, -0.18, 0.18, 0.34]) {
        k.add('black', cyl(0.03, 0.03, 0.03, 12), [x * wid, hoodY + 0.055, t.hoodFront], [Math.PI / 2, 0, 0])
        k.add('lamp', disc(0.025, 12), [x * wid, hoodY + 0.055, t.hoodFront + 0.018])
      }
      return
    case 'louvers': {
      // Slats lying on the back window, from its foot up to where it rounds into the roof.
      if (!roof || !t.glass) return
      const g = t.glass.back
      const hi = Math.min(roofY, g.hi)
      for (let i = 1; i <= 4; i++) k.add('black', box(wid * 0.62, 0.024, 0.008), onPane(g, 0, top + (hi - top) * (i / 5), 0.01), [g.tilt, 0, 0])
      return
    }
    case 'deckLouvers':
      // As many rows as fit between the tail and the back window.
      for (let i = 0; i < 5; i++) {
        const z = -front + 0.12 + i * 0.035
        if (!t.glass || z + 0.012 < t.glass.back.at(top)) k.add('black', box(wid * 0.56, 0.006, 0.016), [0, top + 0.006, z])
      }
      return
    case 'sharkFin':
    {
      // On the deck behind the back window, or along the back of the roof when the window
      // leaves too little deck for it.
      const gz = t.glass ? t.glass.back.at(top - 0.005) - 0.006 : Infinity
      const fl = Math.min(len * 0.3, gz + front - 0.04)
      if (fl > len * 0.18) k.add('paint', rbox(0.014, 0.08, fl, 0.006), [0, top + 0.035, Math.min(-len * 0.26, gz - fl / 2)])
      else if (roof) k.add('paint', rbox(0.014, 0.05, roofLen * 0.5, 0.006), [0, roofY + 0.02, roofZ - roofLen * 0.22])
      return
    }
    case 'tailBand':
      k.add('black', box(wid + 0.008, 0.05, 0.16), [0, top - 0.03, -front + 0.08])
      return
    case 'rearRack':
      for (const sd of SIDES) k.add('chrome', box(0.012, 0.012, 0.16), [sd * wid * 0.22, top + 0.03, -front + 0.13])
      for (const z of [-front + 0.07, -front + 0.13, -front + 0.19]) k.add('chrome', box(wid * 0.46, 0.01, 0.01), [0, top + 0.035, z])
      for (const sd of SIDES) k.add('chrome', box(0.01, 0.033, 0.01), [sd * wid * 0.22, top + 0.0135, -front + 0.07])
      return
    case 'continental':
      k.add('paint', cyl(wheel * 0.85, wheel * 0.85, 0.07, 18), [0, lift + 0.12, -front - 0.0725], [Math.PI / 2, 0, 0])
      k.add('chrome', new TorusGeometry(wheel * 0.85, 0.012, 5, 18), [0, lift + 0.12, -front - 0.1085])
      k.add('chrome', disc(wheel * 0.35, 14), [0, lift + 0.12, -front - 0.110], [0, Math.PI, 0])
      return
    case 'spare': {
      // Closed cars hang it on the tail, high enough to clear the tail lights and bumper.
      // Open ones have no clean spot: the roll hoop or a wing mod's posts stand where it would go.
      if (!t.closed) return
      const r = wheel * 0.85
      const [y, z, dz] = [Math.max(lift + t.body * 0.55, t.ty + 0.045 + r), -front - 0.06, -1]
      // A tyre with a dark rim dish inside a bright lip, and a domed hub cap.
      k.add('black', cyl(r, r, 0.1, 18), [0, y, z], [Math.PI / 2, 0, 0])
      k.add('black', disc(r * 0.65, 16), [0, y, z + dz * 0.0525], [0, Math.PI, 0])
      k.add('chrome', new TorusGeometry(r * 0.66, 0.011, 5, 20), [0, y, z + dz * 0.05])
      k.add('chrome', cyl(r * 0.17, r * 0.23, 0.022, 12), [0, y, z + dz * 0.061], [Math.PI / 2, 0, 0])
      return
    }
    case 'stowage':
      // Jerry cans on the tail and a pair of ammo boxes on the deck.
      for (const sd of SIDES) {
        k.add('dark', rbox(0.06, 0.12, 0.1, 0.012), [sd * wid * 0.3, top - 0.05, -front - 0.0475])
        k.add('black', box(0.04, 0.012, 0.02), [sd * wid * 0.3, top + 0.016, -front - 0.04])
      }
      for (const x of [-0.08, 0.08]) k.add('dark', rbox(0.12, 0.06, 0.08, 0.008), [x, top + 0.027, -front + 0.12])
      return
    case 'towHitch':
      k.add('black', box(0.04, 0.04, 0.1), [0, lift + 0.04, -front - 0.04])
      k.add('chrome', new SphereGeometry(0.022, 10, 8), [0, lift + 0.08, -front - 0.085])
      return
    case 'whip':
      k.add('black', cyl(0.004, 0.006, 0.6, 4), [-wid * 0.36, top + 0.3, -front + 0.1])
      k.add('tail', box(0.004, 0.06, 0.11), [-wid * 0.36, top + 0.56, -front + 0.1 - 0.058])
      return
    case 'sideExhaust':
      // An exhaust mod takes the place of the stock side pipes.
      if (t.exhaust) return
      for (const sd of SIDES) {
        k.add('chrome', cyl(0.022, 0.022, wz * 1.2, 10), [sd * (wid / 2 + 0.028), lift + 0.05, 0], [Math.PI / 2, 0, 0])
        k.add('black', box(0.012, 0.03, wz * 0.9), [sd * (wid / 2 + 0.05), lift + 0.05, 0])
      }
      return
    case 'sideStripe':
      for (const sd of SIDES) k.add('dark', plane(len * 0.78, 0.035), [sd * (wid / 2 + 0.0022), lift + t.body * 0.72, -0.02], [0, (sd * Math.PI) / 2, 0])
      return
    case 'chromeBelt':
      for (const sd of SIDES) k.add('chrome', box(0.0175, 0.012, len * 0.82), [sd * (wid / 2 + 0.00575), lift + t.body * 0.5, 0])
      return
    case 'fenderVents':
      for (const sd of SIDES) for (let i = 0; i < 3; i++) k.add('black', box(0.008, 0.01, 0.08), [sd * (wid / 2 + 0.004), lift + t.body * 0.45 + i * 0.024, wz - wheel * 1.45])
      return
    case 'eyebrows':
      for (const sd of SIDES) for (const z of [wz, -wz]) k.add('chrome', new TorusGeometry(wheel * 1.26, 0.008, 4, 14, Math.PI), [sd * (wid / 2 + 0.006), wheel, z], [0, (sd * Math.PI) / 2, 0], [1, 1, 1.2])
      return
    case 'roundel':
      // A white racing disc on each door with a black number one, standing clear of the
      // door seams and wheel wells. A body kit's arches and skirts would cover the doors, so
      // then it goes on the roof (and on open cars with a kit there's no number at all).
      if (t.kit) {
        if (t.roofLen < 0.2) return
        const y = t.roofY + 0.0085
        k.add('lamp', disc(0.065, 18), [0, y, t.roofZ], [-Math.PI / 2, 0, 0])
        k.add('black', plane(0.014, 0.07), [0, y + 0.0025, t.roofZ], [-Math.PI / 2, 0, 0])
        k.add('black', plane(0.025, 0.012), [0.008, y + 0.0025, t.roofZ - 0.03], [-Math.PI / 2, 0, -0.6])
        return
      }
      for (const sd of SIDES) {
        const p: V3 = [sd * (wid / 2 + 0.0085), lift + t.body * 0.55, t.cabinZ]
        k.add('lamp', disc(0.065, 18), p, [0, (sd * Math.PI) / 2, 0])
        k.add('black', plane(0.014, 0.07), [p[0] + sd * 0.0045, p[1], p[2]], [0, (sd * Math.PI) / 2, 0])
        k.add('black', plane(0.025, 0.012), [p[0] + sd * 0.0045, p[1] + 0.03, p[2] + 0.008], [0, (sd * Math.PI) / 2, -0.6])
      }
      return
    case 'splitter':
      // Tucked under the bumper, its lip just showing ahead of it, and inside the nose's corners.
      k.add('black', box(wid * 0.94 - 0.006, 0.012, 0.07), [0, lift + 0.012, front + 0.004])
      for (const sd of SIDES) k.add('black', box(0.012, 0.032, 0.07), [sd * (wid * 0.47 - 0.009), lift + 0.024, front + 0.004])
      return
    case 'canards':
      for (const sd of SIDES) for (const dy of [0, -0.035]) k.add('black', box(0.012, 0.006, 0.07), [sd * (wid / 2 + 0.002), t.lightY - 0.04 + dy, front - 0.04], [0, 0, sd * -0.3])
      return
    case 'bullBar': {
      // A body kit (the Bull Bar mod among them) takes its place.
      if (t.kit) return
      const z = front + 0.07
      const y = t.lightY + 0.06
      // The hoop stays between the headlights so it never crosses a lamp.
      k.add('black', box(wid * 0.38, 0.026, 0.026), [0, y, z])
      k.add('black', box(wid * 0.82, 0.026, 0.026), [0, lift + 0.05, z])
      for (const sd of SIDES) bar(k, 'black', [sd * wid * 0.17, lift + 0.05, z], [sd * wid * 0.17, y, z], 0.026)
      for (const sd of SIDES) bar(k, 'black', [sd * wid * 0.17, lift + 0.05, z], [sd * wid * 0.17, lift + 0.05, front - 0.02], 0.022)
      return
    }
    case 'overriders':
      for (const zs of [1, -1]) for (const sd of SIDES) k.add('chrome', rbox(0.025, 0.1, 0.03, 0.01), [sd * wid * 0.2, lift + 0.08, zs * (front + 0.02)])
      return
    case 'snorkel': {
      if (!roof) return
      const x = wid / 2 + 0.02
      bar(k, 'black', [x, lift + t.body * 0.6, t.cowl + 0.06], [x, top + 0.02, t.cowl + 0.06], 0.035)
      bar(k, 'black', [x, top + 0.02, t.cowl + 0.06], [x - 0.02, roofY + 0.02, t.cowl - 0.06], 0.035)
      k.add('black', rbox(0.05, 0.04, 0.06, 0.012), [x - 0.02, roofY + 0.04, t.cowl - 0.05])
      return
    }
    case 'toolbox':
      k.add('chrome', box(wid * 0.82, 0.07, 0.09), [0, top + 0.045, -len * 0.1])
      k.add('black', box(wid * 0.7, 0.004, 0.06), [0, top + 0.082, -len * 0.1])
      return
    case 'crates':
      k.add('wood', box(0.17, 0.12, 0.17), [-wid * 0.15, top + 0.07, -len * 0.33])
      k.add('wood', box(0.14, 0.1, 0.14), [wid * 0.17, top + 0.06, -len * 0.22], [0, 0.3, 0])
      k.add('wood', box(0.12, 0.09, 0.12), [-wid * 0.13, top + 0.175, -len * 0.33], [0, -0.25, 0])
      for (const y of [0.04, 0.1]) k.add('black', box(0.176, 0.008, 0.176), [-wid * 0.15, top + y, -len * 0.33])
      return
    case 'humps':
      for (const sd of SIDES) k.add('paint', new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), [sd * wid * 0.2, top, t.cabinZ - t.cabinLen * 0.5 - 0.1], [0, 0, 0], [wid * 0.12, 0.08, 0.22])
      return
    case 'stopArm': {
      // A red stop sign with a white rim, folded flat against the driver's side.
      const p: V3 = [wid / 2 + 0.012, lift + t.body * 0.75, front - 0.42]
      k.add('black', box(0.012, 0.02, 0.07), [p[0] - 0.009, p[1], p[2] + 0.06])
      k.add('lamp', disc(0.068, 8), p, [Math.PI / 8, Math.PI / 2, 0])
      k.add('tail', disc(0.058, 8), [p[0] + 0.0025, p[1], p[2]], [Math.PI / 8, Math.PI / 2, 0])
      k.add('lamp', box(0.002, 0.008, 0.06), [p[0] + 0.004, p[1], p[2]])
      return
    }
    case 'roofHatches':
      if (!roof) return
      for (const u of [0.24, -0.24]) {
        k.add('black', box(wid * 0.34, 0.014, 0.2), [0, roofY + 0.006, roofZ + u * roofLen])
        k.add('dark', box(wid * 0.3, 0.015, 0.17), [0, roofY + 0.0095, roofZ + u * roofLen])
      }
      return
    case 'schoolSign': {
      // An amber name board over the windscreen with dark letters.
      if (!roof) return
      const z = t.cabinZ + t.cabinLen / 2 + 0.018
      const y = roofY - 0.04
      k.add('black', plane(wid * 0.56, 0.05), [0, y, z])
      k.add('amber', plane(wid * 0.52, 0.036), [0, y, z + 0.0025])
      for (let i = 0; i < 6; i++) k.add('black', plane(0.024, 0.022), [(i - 2.5) * wid * 0.075, y, z + 0.005])
      return
    }
    case 'crossingArm':
      // The swing-out crossing gate, folded along the front bumper.
      k.add('amber', box(wid * 0.42, 0.014, 0.014), [-wid * 0.18, lift + 0.07, front + 0.05])
      k.add('black', box(0.03, 0.03, 0.03), [-wid * 0.41, lift + 0.07, front + 0.04])
      return
    case 'busMirrors':
      // Crossover mirrors on stalks at the front corners.
      for (const sd of SIDES) {
        bar(k, 'black', [sd * wid * 0.42, t.lightY + 0.04, front - 0.04], [sd * (wid / 2 + 0.05), t.lightY + 0.14, front + 0.05], 0.012)
        k.add('black', new SphereGeometry(0.034, 10, 8), [sd * (wid / 2 + 0.05), t.lightY + 0.17, front + 0.05], [0, 0, 0], [1, 0.8, 0.5])
      }
      return
    case 'bone': {
      // A big chew bone strapped to the roof rack.
      if (!roof) return
      const y = roofY + 0.075
      k.add('lamp', cyl(0.022, 0.022, roofLen * 0.5, 8), [0, y, roofZ], [Math.PI / 2, 0, 0])
      for (const z of [-1, 1]) for (const sd of SIDES) k.add('lamp', new SphereGeometry(0.034, 10, 8), [sd * 0.03, y, roofZ + z * roofLen * 0.26])
      k.add('black', box(0.06, 0.008, 0.012), [0, y + 0.022, roofZ])
      return
    }
  }
}

// Whether a model carries a feature (CarModel leaves out stock parts it replaces).
export const hasTrim = (model: string | undefined, f: Feature) => !!model && !!TRIMS[model]?.includes(f)

export function trimCar(k: Kit, model: string | undefined, t: TrimFrame) {
  badges(k, t)
  // roofY is the top of the glass; the painted roof panel's rounded edge sits on it.
  const onRoof = t.roofLen > 0 ? { ...t, roofY: t.roofY + 0.016 } : t
  const all = (model && TRIMS[model]) || []
  for (const f of all) feature(k, f, onRoof, all)
}

// Bikes: a basket and top box on the scooter, saddlebags and a screen on the
// cruiser, a number board on the sport bike.
export function trimBike(k: Kit, model: string | undefined, b: { r: number; wz: number; head: [number, number]; seat: [number, number] }) {
  const [hy, hz] = b.head
  const [sy, sz] = b.seat
  if (model === 'zippy') {
    k.add('chrome', box(0.14, 0.08, 0.1), [0, hy - 0.06, hz + 0.12])
    k.add('black', box(0.12, 0.004, 0.08), [0, hy - 0.02, hz + 0.12])
    k.add('paint', rbox(0.18, 0.12, 0.16, 0.04), [0, sy + 0.04, sz - 0.24])
    k.add('tail', plane(0.1, 0.015), [0, sy + 0.02, sz - 0.322], [0, Math.PI, 0])
  }
  if (model === 'baron') {
    for (const sd of SIDES) {
      k.add('seat', rbox(0.07, 0.12, 0.2, 0.03), [sd * 0.12, b.r * 2 + 0.02, -b.wz + 0.06])
      k.add('chrome', disc(0.012, 8), [sd * 0.1575, b.r * 2 + 0.04, -b.wz + 0.06], [0, (sd * Math.PI) / 2, 0])
    }
    k.add('screen', box(0.2, 0.16, 0.008), [0, hy + 0.12, hz + 0.03], [-0.2, 0, 0])
    // Two struts from the screen's foot down to the head tube clamp.
    for (const sd of SIDES) bar(k, 'chrome', [sd * 0.07, hy + 0.048, hz + 0.044], [sd * 0.03, hy - 0.02, hz + 0.01], 0.008)
  }
  if (model === 'shinden') {
    for (const sd of SIDES) k.add('dark', plane(0.18, 0.04), [sd * 0.083, b.r + 0.04, 0.04], [0, (sd * Math.PI) / 2, -0.1])
  }
}

// How each model's cabin and wheels look up close: the rim style and colour, brake
// caliper colour (none: plain dark), seat colour, and whitewall tyres. Only cars drawn
// whole use these; town traffic keeps its pooled wheels and solid glass.
export type CarStyle = { rim: RimStyle; rimColor?: string; caliper?: string; seat?: string; ww?: boolean }
const STYLES: Record<string, CarStyle> = {
  pip: { rim: 'steel', rimColor: '#e6e8ea', seat: '#546e7a' },
  civic: { rim: 'five', seat: '#37474f' },
  trail: { rim: 'steel', rimColor: '#eceff1', seat: '#5d4037' },
  miata: { rim: 'split', seat: '#7b3b2a' },
  stallion: { rim: 'deep', rimColor: '#eceff1', seat: '#1c1c1c' },
  rally: { rim: 'five', rimColor: '#d4a72c', caliper: '#e53935', seat: '#263238' },
  vette: { rim: 'split', caliper: '#ffca28', seat: '#1c1c1c' },
  charger: { rim: 'deep', rimColor: '#5f6368', caliper: '#e53935', seat: '#1c1c1c' },
  hellcat: { rim: 'split', rimColor: '#2b2b2b', caliper: '#e53935', seat: '#4a1010' },
  gtr: { rim: 'mesh', rimColor: '#b08d57', caliper: '#ff6d00', seat: '#1c1c1c' },
  sora: { rim: 'split', rimColor: '#3a3d42', seat: '#1c1c1c' },
  stinger: { rim: 'split', rimColor: '#2b2b2b', caliper: '#e53935', seat: '#1c1c1c' },
  hayate: { rim: 'five', rimColor: '#3a3d42', caliper: '#fdd835', seat: '#1c1c1c' },
  kestrel: { rim: 'turbine', rimColor: '#b8bdc2', caliper: '#fdd835', seat: '#212121' },
  thunderjet: { rim: 'five', rimColor: '#c9cdd1', seat: '#6d4c35' },
  scatto: { rim: 'five', rimColor: '#e9eaec', caliper: '#e53935', seat: '#263238' },
  tomahawk: { rim: 'beadlock', rimColor: '#3a3a3a', seat: '#3e2723' },
  camper: { rim: 'steel', rimColor: '#f5f5f5', ww: true, seat: '#a1887f' },
  hotshot: { rim: 'mesh', rimColor: '#f5f5f5', caliper: '#e53935', seat: '#212121' },
  ridgeback: { rim: 'beadlock', rimColor: '#9e9e9e', seat: '#4e342e' },
  kitsune: { rim: 'deep', rimColor: '#c9a227', caliper: '#ff4081', seat: '#212121' },
  current: { rim: 'turbine', rimColor: '#dfe3e6', caliper: '#29b6f6', seat: '#eceff1' },
  salon: { rim: 'classic', ww: true, seat: '#d7b98e' },
  stomper: { rim: 'beadlock', rimColor: '#2a2a2a', seat: '#263238' },
  monoposto: { rim: 'five', rimColor: '#2a2a2a', caliper: '#e53935' },
  zenith: { rim: 'split', rimColor: '#1d1d1d', caliper: '#ff6d00', seat: '#263238' },
  schoolbus: { rim: 'steel', rimColor: '#2f2f2f', seat: '#2e7d32' },
  shaggy: { rim: 'steel', rimColor: '#e0e0e0', ww: true, seat: '#8d6e63' },
  tusker: { rim: 'beadlock', rimColor: '#5d5d3a', seat: '#3e2723' },
  lambo: { rim: 'deep', rimColor: '#e0e0e0', caliper: '#fdd835', seat: '#1c1c1c' },
  hyper: { rim: 'mesh', rimColor: '#1e1e1e', caliper: '#d50000', seat: '#1a237e' },
  bug: { rim: 'steel', rimColor: '#ffffff', ww: true, seat: '#d7ccc8' },
  woodie: { rim: 'classic', ww: true, seat: '#c8a27a' },
  hauler: { rim: 'steel', rimColor: '#c62828', seat: '#5d4037' },
  cruiser: { rim: 'classic', ww: true, seat: '#f8bbd0' },
  buggy: { rim: 'beadlock', rimColor: '#eceff1', seat: '#212121' },
  bandit: { rim: 'turbine', rimColor: '#c9a227', seat: '#1c1c1c' },
  lemans: { rim: 'mesh', rimColor: '#d4d4d4', caliper: '#e53935', seat: '#263238' },
  gullwing: { rim: 'classic', seat: '#b71c1c' },
  speedster: { rim: 'wire', seat: '#6d4c41' },
  nightfall: { rim: 'turbine', rimColor: '#1d1d1d', caliper: '#00e5ff', seat: '#311b92' },
  kreis: { rim: 'mesh', rimColor: '#cfd2d4', caliper: '#1e88e5', seat: '#212121' },
  bergmeister: { rim: 'five', rimColor: '#dfe3e6', caliper: '#e53935', seat: '#3e2723' },
  rattler: { rim: 'split', rimColor: '#2b2b2b', caliper: '#e53935', seat: '#1c1c1c' },
  cottonmouth: { rim: 'deep', rimColor: '#d4d4d4', caliper: '#e53935', seat: '#1c1c1c' },
  ringmeister: { rim: 'turbine', rimColor: '#3a3a3a', caliper: '#d32f2f', seat: '#4a1010' },
  raiden: { rim: 'five', rimColor: '#eceff1', caliper: '#ff6d00', seat: '#263238' },
  sovereign: { rim: 'turbine', rimColor: '#c0c6cc', caliper: '#1a237e', seat: '#d7b98e' },
  wraith: { rim: 'split', rimColor: '#1d1d1d', caliper: '#ff6f00', seat: '#212121' },
  eclat: { rim: 'turbine', rimColor: '#c0c6cc', caliper: '#1565c0', seat: '#d7b98e' },
  orafo: { rim: 'mesh', rimColor: '#c9a227', caliper: '#212121', seat: '#8d4a2a' },
  pontone: { rim: 'wire', caliper: '#212121', seat: '#5d3a1a' },
  sprint: { rim: 'mesh', rimColor: '#a07a3c', caliper: '#c62828', seat: '#3e2723' },
  revenant: { rim: 'split', rimColor: '#d8dadc', caliper: '#d32f2f', seat: '#1c1c1c' },
  fulmine: { rim: 'turbine', rimColor: '#1d1d1d', caliper: '#ffd600', seat: '#212121' },
  scoops: { rim: 'steel', rimColor: '#f8bbd0', ww: true, seat: '#80cbc4' },
  courier: { rim: 'steel', rimColor: '#3e2723', seat: '#4e342e' },
  crusher: { rim: 'beadlock', rimColor: '#cfd8dc', caliper: '#ffd600', seat: '#212121' },
}
// A car this build doesn't know gets plain five-spokes.
export const carStyle = (model?: string): CarStyle => (model && STYLES[model]) || { rim: 'five' }
