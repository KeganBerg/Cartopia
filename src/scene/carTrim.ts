import { BoxGeometry, CircleGeometry, CylinderGeometry, Euler, PlaneGeometry, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Kit, Part } from './CarModel'

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
  ty: number // tail light height
  roofY: number; roofLen: number; roofZ: number // 0 roofLen: no roof
  closed: boolean
}

type Feature =
  | 'roofRack' | 'roofBox' | 'surfboard' | 'sunroof' | 'panoRoof' | 'visors' | 'twoTone' | 'ttop' | 'roofScoop' | 'beacon' | 'lightBar'
  | 'hoodPins' | 'hoodVents' | 'hoodChevron' | 'hoodBulges' | 'ornament' | 'lightPods'
  | 'louvers' | 'deckLouvers' | 'sharkFin' | 'tailBand' | 'rearRack' | 'continental' | 'spare' | 'stowage' | 'towHitch' | 'whip'
  | 'sideExhaust' | 'sideStripe' | 'chromeBelt' | 'fenderVents' | 'eyebrows' | 'roundel'
  | 'splitter' | 'canards' | 'bullBar' | 'overriders' | 'snorkel' | 'toolbox' | 'crates' | 'humps'

// What each car gets on top of its body's own detail. Ids not in this build
// (another thread's newer cars) are simply skipped.
const TRIMS: Record<string, Feature[]> = {
  pip: ['roofRack', 'roofBox', 'visors'],
  civic: ['sunroof', 'visors', 'chromeBelt'],
  trail: ['bullBar', 'toolbox', 'towHitch', 'snorkel'],
  miata: ['rearRack', 'hoodVents'],
  stallion: ['hoodPins', 'sideStripe', 'louvers'],
  rally: ['lightPods', 'roofScoop', 'roundel', 'splitter'],
  vette: ['sideExhaust', 'fenderVents', 'ttop'],
  charger: ['tailBand', 'hoodPins', 'chromeBelt'],
  hellcat: ['hoodVents', 'splitter', 'canards'],
  gtr: ['splitter', 'canards', 'fenderVents', 'sunroof'],
  tomahawk: ['stowage', 'spare', 'beacon'],
  lambo: ['deckLouvers', 'roofScoop', 'splitter'],
  hyper: ['sharkFin', 'hoodVents', 'canards', 'splitter'],
  bug: ['rearRack', 'overriders', 'sideStripe'],
  woodie: ['surfboard', 'chromeBelt', 'overriders'],
  hauler: ['beacon', 'crates', 'towHitch', 'bullBar'],
  cruiser: ['twoTone', 'continental', 'chromeBelt'],
  buggy: ['whip', 'spare', 'bullBar'],
  bandit: ['hoodChevron', 'ttop', 'louvers'],
  lemans: ['roundel', 'splitter', 'sharkFin', 'lightPods'],
  gullwing: ['eyebrows', 'hoodBulges', 'chromeBelt'],
  // Cars from the More cars set.
  camper: ['roofRack', 'surfboard', 'overriders'],
  hotshot: ['hoodVents', 'sideStripe', 'roundel'],
  ridgeback: ['roofRack', 'snorkel', 'bullBar', 'towHitch'],
  kitsune: ['canards', 'fenderVents', 'sideStripe', 'splitter'],
  current: ['panoRoof', 'sideStripe'],
  salon: ['ornament', 'chromeBelt', 'twoTone'],
  stomper: ['lightBar', 'bullBar', 'snorkel', 'crates'],
  zenith: ['sharkFin', 'canards', 'deckLouvers', 'splitter'],
  speedster: ['humps', 'roundel', 'rearRack'],
}

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
const plane = (w: number, h: number) => new PlaneGeometry(w, h)
const disc = (r: number, seg = 14) => new CircleGeometry(r, seg)
const cyl = (rt: number, rb: number, h: number, seg = 10) => new CylinderGeometry(rt, rb, h, seg)

// A rounded bar from a to b.
function bar(k: Kit, part: Part, a: V3, b: V3, t: number) {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize()))
  k.add(part, rbox(t, d.length() + t, t, t * 0.45), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [e.x, e.y, e.z])
}

// Small finishing touches every car gets: badges front and back, and characters on the plates.
function badges(k: Kit, f: TrimFrame) {
  k.add('chrome', disc(0.018, 12), [0, f.lightY + 0.04, f.front + 0.012])
  k.add('chrome', box(0.07, 0.012, 0.004), [0, f.ty + 0.045, -f.front - 0.006])
  for (const [z, y, sd] of [[f.front + 0.037, f.lift + 0.12, 1], [-f.front - 0.037, f.lift + 0.13, -1]] as const)
    for (const x of [-0.032, 0, 0.032]) k.add('dark', plane(0.018, 0.016), [x, y, z], [0, sd < 0 ? Math.PI : 0, 0])
}

const SIDES = [-1, 1] as const

function feature(k: Kit, f: Feature, t: TrimFrame) {
  const { wid, len, lift, top, hoodY, front, roofY, roofLen, roofZ, wz, wheel } = t
  const roof = roofLen > 0
  switch (f) {
    case 'roofRack':
      if (!roof) return
      for (const sd of SIDES) {
        k.add('chrome', box(0.018, 0.018, roofLen * 0.86), [sd * wid * 0.31, roofY + 0.035, roofZ])
        for (const z of [-0.38, 0.38]) k.add('black', box(0.02, 0.035, 0.025), [sd * wid * 0.31, roofY + 0.015, roofZ + z * roofLen])
      }
      for (const z of [-0.3, 0, 0.3]) k.add('black', box(wid * 0.66, 0.012, 0.02), [0, roofY + 0.045, roofZ + z * roofLen])
      return
    case 'roofBox':
      if (roof) k.add('black', rbox(wid * 0.48, 0.07, roofLen * 0.62, 0.03), [0, roofY + 0.085, roofZ - roofLen * 0.05])
      return
    case 'surfboard':
      if (!roof) return
      k.add('wood', new SphereGeometry(1, 14, 6), [0, roofY + 0.065, roofZ - 0.02], [0, 0, 0], [wid * 0.15, 0.014, len * 0.44])
      k.add('chrome', box(0.012, 0.004, len * 0.7), [0, roofY + 0.08, roofZ - 0.02])
      k.add('black', box(0.004, 0.04, 0.05), [0, roofY + 0.05, roofZ - 0.02 - len * 0.38])
      return
    case 'sunroof':
      if (!roof) return
      k.add('black', box(wid * 0.48, 0.004, roofLen * 0.42), [0, roofY + 0.002, roofZ + roofLen * 0.12])
      k.add('glass', box(wid * 0.42, 0.006, roofLen * 0.36), [0, roofY + 0.003, roofZ + roofLen * 0.12])
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
      if (!roof) return
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
      if (!roof) return
      k.add('black', rbox(wid * 0.72, 0.04, 0.05, 0.012), [0, roofY + 0.04, roofZ + roofLen * 0.38])
      for (const x of [-0.3, -0.15, 0, 0.15, 0.3]) k.add('lamp', disc(0.016, 10), [x * wid, roofY + 0.04, roofZ + roofLen * 0.38 + 0.026])
      for (const sd of SIDES) k.add('black', box(0.015, 0.03, 0.015), [sd * wid * 0.32, roofY + 0.012, roofZ + roofLen * 0.38])
      return
    case 'hoodPins':
      for (const sd of SIDES) {
        k.add('chrome', cyl(0.013, 0.013, 0.008, 10), [sd * wid * 0.27, hoodY + 0.004, t.hoodFront - 0.05])
        k.add('black', box(0.004, 0.003, 0.03), [sd * wid * 0.27, hoodY + 0.009, t.hoodFront - 0.05])
      }
      return
    case 'hoodVents':
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
      k.add('black', box(wid * 0.72, 0.014, 0.02), [0, hoodY + 0.03, t.hoodFront - 0.01])
      for (const x of [-0.27, -0.09, 0.09, 0.27]) {
        k.add('black', cyl(0.03, 0.03, 0.03, 12), [x * wid, hoodY + 0.055, t.hoodFront], [Math.PI / 2, 0, 0])
        k.add('lamp', disc(0.025, 12), [x * wid, hoodY + 0.055, t.hoodFront + 0.016])
      }
      return
    case 'louvers': {
      // Slats over the rear window, from the roof down to the deck.
      if (!roof) return
      // From the back edge of the roof down to the base of the rear window (outer glass surface).
      const z0 = roofZ - roofLen / 2 - 0.025
      const z1 = t.cabinZ - t.cabinLen / 2
      const a = Math.atan2(roofY - top, z0 - z1)
      // Lift each slat off the glass along the window's outward normal.
      const [ny, nz] = [Math.cos(a) * 0.012, -Math.sin(a) * 0.012]
      for (let i = 1; i <= 4; i++) {
        const u = i / 5
        k.add('black', box(wid * 0.72, 0.008, 0.026), [0, top + (roofY - top) * u + ny, z1 + (z0 - z1) * u + nz], [a, 0, 0])
      }
      return
    }
    case 'deckLouvers':
      for (let i = 0; i < 5; i++) k.add('black', box(wid * 0.56, 0.006, 0.016), [0, top + 0.004, -front + 0.12 + i * 0.035])
      return
    case 'sharkFin':
      k.add('paint', rbox(0.014, 0.08, len * 0.3, 0.006), [0, top + 0.035, -len * 0.26])
      return
    case 'tailBand':
      k.add('black', box(wid + 0.008, 0.05, 0.16), [0, top - 0.03, -front + 0.08])
      return
    case 'rearRack':
      for (const sd of SIDES) k.add('chrome', box(0.012, 0.012, 0.16), [sd * wid * 0.22, top + 0.03, -front + 0.13])
      for (const z of [-front + 0.07, -front + 0.13, -front + 0.19]) k.add('chrome', box(wid * 0.46, 0.01, 0.01), [0, top + 0.035, z])
      for (const sd of SIDES) k.add('chrome', box(0.01, 0.03, 0.01), [sd * wid * 0.22, top + 0.015, -front + 0.07])
      return
    case 'continental':
      k.add('paint', cyl(wheel * 0.85, wheel * 0.85, 0.07, 18), [0, lift + 0.12, -front - 0.07], [Math.PI / 2, 0, 0])
      k.add('chrome', new TorusGeometry(wheel * 0.85, 0.012, 5, 18), [0, lift + 0.12, -front - 0.106])
      k.add('chrome', disc(wheel * 0.35, 14), [0, lift + 0.12, -front - 0.107], [0, Math.PI, 0])
      return
    case 'spare': {
      const y = t.closed ? lift + t.body * 0.55 : top + 0.06
      k.add('black', cyl(wheel * 0.95, wheel * 0.95, 0.1, 16), [0, y, -front - 0.06], [Math.PI / 2, 0, 0])
      k.add('chrome', disc(wheel * 0.45, 12), [0, y, -front - 0.111], [0, Math.PI, 0])
      k.add('dark', disc(wheel * 0.15, 8), [0, y, -front - 0.113], [0, Math.PI, 0])
      return
    }
    case 'stowage':
      // Jerry cans on the tail and a pair of ammo boxes on the deck.
      for (const sd of SIDES) {
        k.add('dark', rbox(0.06, 0.12, 0.1, 0.012), [sd * wid * 0.3, top - 0.05, -front - 0.05])
        k.add('black', box(0.04, 0.012, 0.02), [sd * wid * 0.3, top + 0.016, -front - 0.04])
      }
      for (const x of [-0.08, 0.08]) k.add('dark', rbox(0.12, 0.06, 0.08, 0.008), [x, top + 0.03, -front + 0.12])
      return
    case 'towHitch':
      k.add('black', box(0.04, 0.04, 0.1), [0, lift + 0.04, -front - 0.04])
      k.add('chrome', new SphereGeometry(0.022, 10, 8), [0, lift + 0.08, -front - 0.085])
      return
    case 'whip':
      k.add('black', cyl(0.004, 0.006, 0.6, 4), [-wid * 0.36, top + 0.3, -front + 0.1])
      k.add('tail', plane(0.11, 0.06), [-wid * 0.36 - 0.055, top + 0.56, -front + 0.1], [0, Math.PI / 2, 0])
      return
    case 'sideExhaust':
      for (const sd of SIDES) {
        k.add('chrome', cyl(0.022, 0.022, wz * 1.2, 10), [sd * (wid / 2 + 0.028), lift + 0.05, 0], [Math.PI / 2, 0, 0])
        k.add('black', box(0.012, 0.03, wz * 0.9), [sd * (wid / 2 + 0.05), lift + 0.05, 0])
      }
      return
    case 'sideStripe':
      for (const sd of SIDES) k.add('dark', plane(len * 0.78, 0.035), [sd * (wid / 2 + 0.005), lift + t.body * 0.72, -0.02], [0, (sd * Math.PI) / 2, 0])
      return
    case 'chromeBelt':
      for (const sd of SIDES) k.add('chrome', box(0.006, 0.012, len * 0.82), [sd * (wid / 2 + 0.004), lift + t.body * 0.5, 0])
      return
    case 'fenderVents':
      for (const sd of SIDES) for (let i = 0; i < 3; i++) k.add('black', box(0.008, 0.01, 0.08), [sd * (wid / 2 + 0.004), lift + t.body * 0.45 + i * 0.024, wz - wheel * 1.45])
      return
    case 'eyebrows':
      for (const sd of SIDES) for (const z of [wz, -wz]) k.add('chrome', new TorusGeometry(wheel * 1.26, 0.008, 4, 14, Math.PI), [sd * (wid / 2 + 0.006), wheel, z], [0, (sd * Math.PI) / 2, 0], [1, 1, 1.2])
      return
    case 'roundel':
      // A white racing disc on each door with a black number one.
      for (const sd of SIDES) {
        const p: V3 = [sd * (wid / 2 + 0.005), lift + t.body * 0.55, t.cabinZ]
        k.add('lamp', disc(0.065, 18), p, [0, (sd * Math.PI) / 2, 0])
        k.add('black', plane(0.014, 0.07), [p[0] + sd * 0.002, p[1], p[2]], [0, (sd * Math.PI) / 2, 0])
        k.add('black', plane(0.025, 0.012), [p[0] + sd * 0.002, p[1] + 0.03, p[2] + 0.008], [0, (sd * Math.PI) / 2, -0.6])
      }
      return
    case 'splitter':
      k.add('black', box(wid * 0.98, 0.012, 0.07), [0, lift + 0.012, front + 0.015])
      for (const sd of SIDES) k.add('black', box(0.012, 0.03, 0.07), [sd * wid * 0.48, lift + 0.025, front + 0.015])
      return
    case 'canards':
      for (const sd of SIDES) for (const dy of [0, -0.035]) k.add('black', box(0.012, 0.006, 0.07), [sd * (wid / 2 + 0.002), t.lightY - 0.04 + dy, front - 0.04], [0, 0, sd * -0.3])
      return
    case 'bullBar': {
      const z = front + 0.07
      const y = t.lightY + 0.06
      k.add('black', box(wid * 0.74, 0.026, 0.026), [0, y, z])
      k.add('black', box(wid * 0.82, 0.026, 0.026), [0, lift + 0.05, z])
      for (const sd of SIDES) bar(k, 'black', [sd * wid * 0.22, lift + 0.05, z], [sd * wid * 0.22, y, z], 0.026)
      for (const sd of SIDES) bar(k, 'black', [sd * wid * 0.22, lift + 0.05, z], [sd * wid * 0.22, lift + 0.05, front - 0.02], 0.022)
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
      for (const y of [0.04, 0.1]) k.add('black', box(0.172, 0.008, 0.172), [-wid * 0.15, top + y, -len * 0.33])
      return
    case 'humps':
      for (const sd of SIDES) k.add('paint', new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), [sd * wid * 0.2, top, t.cabinZ - t.cabinLen * 0.5 - 0.1], [0, 0, 0], [wid * 0.12, 0.08, 0.22])
      return
  }
}

export function trimCar(k: Kit, model: string | undefined, t: TrimFrame) {
  badges(k, t)
  // roofY is the top of the glass; the painted roof panel's rounded edge sits on it.
  const onRoof = t.roofLen > 0 ? { ...t, roofY: t.roofY + 0.016 } : t
  for (const f of (model && TRIMS[model]) || []) feature(k, f, onRoof)
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
      k.add('chrome', disc(0.012, 8), [sd * 0.156, b.r * 2 + 0.04, -b.wz + 0.06], [0, (sd * Math.PI) / 2, 0])
    }
    k.add('screen', box(0.2, 0.16, 0.008), [0, hy + 0.12, hz + 0.03], [-0.2, 0, 0])
  }
  if (model === 'shinden') {
    k.add('lamp', disc(0.05, 14), [0, hy - 0.08, hz + 0.135], [0, 0, 0])
    k.add('black', plane(0.012, 0.05), [0, hy - 0.08, hz + 0.137])
    for (const sd of SIDES) k.add('dark', plane(0.18, 0.04), [sd * 0.083, b.r + 0.04, 0.04], [0, (sd * Math.PI) / 2, -0.1])
  }
}
