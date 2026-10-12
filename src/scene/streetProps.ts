import { CanvasTexture, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import { PropKit, prop, type Look } from './propKit'

// Sidewalk furniture, modelled for the free camera's street-level view: real
// hoop racks and bikes, slatted bins, hydrants with caps and chains, and so on.
// Each kind is built once (propKit) and baked into the town's static mesh, so
// the detail costs triangles but no extra draws. Local frame: the origin sits on
// the sidewalk, -z faces the road.

const STEEL: Look = { c: '#a7b1b8', r: 0.35, m: 0.7 }
const GALV: Look = { c: '#b9c2c7', r: 0.45, m: 0.55 }
const BLACK: Look = { c: '#1c1f22', r: 0.7 }
const RUBBER: Look = { c: '#202124', r: 0.95 }
const CONCRETE: Look = { c: '#b7b1a5', r: 0.95 }
const L = (c: string, r = 0.7, m = 0, cast = false): Look => ({ c, r, m, cast })
const cast = (l: Look): Look => ({ ...l, cast: true })

// A bicycle running along z (front wheel at +z), wheels on the ground.
function bike(k: PropKit, x: number, z: number, paint: string, basket = false) {
  const R = 0.062
  const y = R + 0.008
  const at = (dy: number, dz: number): [number, number, number] => [x, y + dy, z + dz]
  const frame = L(paint, 0.35)
  for (const dz of [-0.1, 0.1]) {
    k.torus(RUBBER, R, 0.008, at(0, dz), [0, Math.PI / 2, 0], Math.PI * 2, 16, 4)
    k.torus(STEEL, R - 0.009, 0.0035, at(0, dz), [0, Math.PI / 2, 0], Math.PI * 2, 12, 3)
    k.cyl(STEEL, 0.008, 0.008, 0.03, at(0, dz), [0, 0, Math.PI / 2], 6)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI
      k.rod(GALV, at(Math.sin(a) * (R - 0.01), dz + Math.cos(a) * (R - 0.01)), at(-Math.sin(a) * (R - 0.01), dz - Math.cos(a) * (R - 0.01)), 0.0012, 3)
    }
  }
  const bb = at(-0.008, -0.015)
  const seat = at(0.085, -0.045)
  const head = at(0.088, 0.062)
  const headLo = at(0.06, 0.07)
  k.rod(frame, bb, seat, 0.006)
  k.rod(frame, seat, head, 0.0055)
  k.rod(frame, bb, headLo, 0.0065)
  k.rod(frame, headLo, head, 0.007)
  for (const s of [-1, 1]) {
    k.rod(frame, [x + s * 0.008, bb[1], bb[2]], [x + s * 0.012, y, z - 0.1], 0.004)
    k.rod(frame, [x + s * 0.006, seat[1] - 0.006, seat[2]], [x + s * 0.012, y, z - 0.1], 0.0035)
    k.rod(STEEL, [x + s * 0.006, headLo[1], headLo[2]], [x + s * 0.012, y, z + 0.1], 0.0035)
  }
  // Seat post and saddle, stem and bars.
  k.rod(STEEL, seat, at(0.11, -0.052), 0.004)
  k.box(BLACK, [0.026, 0.01, 0.05], at(0.115, -0.05))
  k.rod(STEEL, head, at(0.112, 0.058), 0.004)
  k.rod(STEEL, at(0.112, 0.058), at(0.112, 0.072), 0.003)
  k.rod(STEEL, [x - 0.04, y + 0.114, z + 0.07], [x + 0.04, y + 0.114, z + 0.07], 0.0035)
  for (const s of [-1, 1]) k.cyl(RUBBER, 0.005, 0.005, 0.02, [x + s * 0.042, y + 0.114, z + 0.07], [0, 0, Math.PI / 2], 6)
  // Chainring, cranks and pedals; chain runs back to the hub.
  k.torus(STEEL, 0.022, 0.003, [x + 0.012, bb[1], bb[2]], [0, Math.PI / 2, 0], Math.PI * 2, 14, 3)
  for (const s of [-1, 1]) {
    k.rod(STEEL, [x + s * 0.016, bb[1], bb[2]], [x + s * 0.016, bb[1] - s * 0.03, bb[2] + s * 0.012], 0.003)
    k.box(BLACK, [0.02, 0.005, 0.012], [x + s * 0.026, bb[1] - s * 0.03, bb[2] + s * 0.012])
  }
  for (const s of [-1, 1]) k.rod(L('#3a3f44', 0.5, 0.5), [x + 0.012, bb[1] + s * 0.02, bb[2]], [x + 0.012, y + s * 0.01, z - 0.1], 0.0015, 3)
  // Fenders over each wheel.
  for (const dz of [-0.1, 0.1]) k.torus(L(paint, 0.4), R + 0.012, 0.004, at(0, dz), [0, Math.PI / 2, dz > 0 ? 0.4 : Math.PI * 0.35], Math.PI * 0.55, 8, 3)
  if (basket) {
    k.box(L('#c8a165', 0.9), [0.06, 0.035, 0.045], at(0.1, 0.1))
    k.box(L('#8d6e46', 0.9), [0.054, 0.004, 0.04], at(0.083, 0.1))
  }
}

export const STREET_PROPS = {
  // Three steel hoop racks bolted to the pavement, two bikes locked to them.
  bikes: () => prop('bikes', (k) => {
    for (const x of [-0.2, 0, 0.2]) {
      for (const s of [-1, 1]) {
        k.cyl(cast(STEEL), 0.009, 0.009, 0.12, [x, 0.06, s * 0.07], undefined, 8)
        k.cyl(GALV, 0.02, 0.02, 0.006, [x, 0.003, s * 0.07], undefined, 8)
      }
      k.torus(cast(STEEL), 0.07, 0.009, [x, 0.12, 0], [0, Math.PI / 2, 0], Math.PI, 10, 5)
    }
    bike(k, -0.165, 0.005, '#d84339', true)
    bike(k, 0.035, -0.01, '#1f8a8a')
    // U-lock on the first bike.
    k.torus(L('#ffca28', 0.4), 0.02, 0.003, [-0.18, 0.09, 0.07], [0, Math.PI / 2, 0], Math.PI, 8, 3)
  }),

  // Slatted litter bin: a ring of timber slats round a dark liner, domed lid with a mouth.
  bin: () => prop('bin', (k) => {
    const green = L('#2e6b3a', 0.55)
    k.cyl(cast(L('#24262a', 0.8)), 0.066, 0.066, 0.25, [0, 0.13, 0], undefined, 12)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      k.box(cast(L(i % 2 ? '#8a5a35' : '#7b4f2e', 0.85)), [0.026, 0.22, 0.012], [Math.sin(a) * 0.072, 0.135, Math.cos(a) * 0.072], [0, a, 0])
    }
    for (const y of [0.04, 0.23]) k.torus(green, 0.077, 0.007, [0, y, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 18, 4)
    k.cyl(green, 0.08, 0.08, 0.02, [0, 0.262, 0], undefined, 14)
    k.sphere(green, 0.078, [0, 0.27, 0], [1, 0.55, 1], 14, 5, Math.PI / 2)
    k.box(BLACK, [0.07, 0.035, 0.02], [0, 0.29, -0.06], [-0.5, 0, 0])
    k.cyl(green, 0.07, 0.075, 0.025, [0, 0.012, 0], undefined, 12)
    k.box(L('#f4f4f4', 0.6), [0.03, 0.03, 0.002], [0, 0.17, -0.079])
  }),

  // Two newspaper vending boxes on pedestals: windowed fronts showing the paper,
  // coin mechanisms and pull handles.
  news: () => prop('news', (k) => {
    for (const [x, c] of [[-0.085, '#c62828'], [0.085, '#1565c0']] as const) {
      const paint = L(c, 0.45)
      k.rod(BLACK, [x, 0, 0.01], [x, 0.06, 0.01], 0.012, 6)
      k.box(BLACK, [0.1, 0.008, 0.09], [x, 0.004, 0.01])
      k.box(cast(paint), [0.14, 0.16, 0.12], [x, 0.14, 0.01])
      k.box(paint, [0.15, 0.02, 0.13], [x, 0.23, 0.01], [0.25, 0, 0])
      k.box(L('#2b2f33', 0.5), [0.12, 0.085, 0.004], [x, 0.155, -0.051])
      k.box(L('#e9e6dc', 0.9), [0.1, 0.07, 0.002], [x, 0.155, -0.054])
      for (const y of [0.17, 0.162, 0.154, 0.146, 0.138]) k.box(L('#8f8f8f', 0.9), [y === 0.17 ? 0.07 : 0.04, 0.004, 0.001], [x - (y === 0.17 ? 0 : 0.02), y, -0.0555])
      k.rod(STEEL, [x - 0.03, 0.105, -0.058], [x + 0.03, 0.105, -0.058], 0.004)
      k.box(L('#9ea7ad', 0.35, 0.6), [0.03, 0.04, 0.008], [x + 0.045, 0.205, -0.055])
      k.box(BLACK, [0.003, 0.016, 0.004], [x + 0.045, 0.21, -0.06])
    }
  }),

  // Blue curbside mailbox: rounded top, pull-down chute with a handle, legs on feet.
  mail: () => prop('mail', (k) => {
    const blue = L('#1d4f9c', 0.45)
    const dark = L('#163a70', 0.5)
    k.box(cast(blue), [0.16, 0.2, 0.14], [0, 0.17, 0])
    k.cyl(cast(blue), 0.08, 0.08, 0.14, [0, 0.27, 0], [Math.PI / 2, 0, 0], 16)
    k.box(dark, [0.164, 0.012, 0.144], [0, 0.072, 0])
    // Chute: a hinged door with a handle on the road side.
    k.box(dark, [0.11, 0.05, 0.03], [0, 0.29, -0.07], [0.35, 0, 0])
    k.rod(STEEL, [-0.035, 0.27, -0.09], [0.035, 0.27, -0.09], 0.005)
    // Emblem and pickup-time plate.
    k.box(L('#f2f2f2', 0.5), [0.06, 0.04, 0.002], [0, 0.18, -0.071])
    k.box(blue, [0.04, 0.012, 0.002], [0, 0.18, -0.0725])
    k.box(L('#f2f2f2', 0.5), [0.002, 0.05, 0.06], [0.081, 0.17, 0])
    for (const [x, z] of [[-0.065, -0.055], [0.065, -0.055], [-0.065, 0.055], [0.065, 0.055]]) {
      k.box(dark, [0.018, 0.07, 0.018], [x, 0.035, z])
      k.box(dark, [0.03, 0.006, 0.03], [x, 0.003, z])
    }
  }),

  // Three steel bollards with domed caps, reflective bands and base collars.
  bollards: () => prop('bollards', (k) => {
    for (const x of [-0.3, 0, 0.3]) {
      k.cyl(cast(L('#3b4a52', 0.5)), 0.03, 0.033, 0.2, [x, 0.1, 0], undefined, 12)
      k.sphere(L('#3b4a52', 0.5), 0.03, [x, 0.2, 0], [1, 0.6, 1], 12, 3, Math.PI / 2)
      k.cyl(L('#f5c518', 0.3), 0.0315, 0.0315, 0.02, [x, 0.165, 0], undefined, 12)
      k.cyl(L('#eceff1', 0.3), 0.0315, 0.0315, 0.012, [x, 0.14, 0], undefined, 12)
      k.cyl(GALV, 0.045, 0.048, 0.015, [x, 0.0075, 0], undefined, 12)
    }
  }),

  // Cast-stone planter with a lipped rim, a clipped shrub and a few flowers.
  planter: () => prop('planter', (k) => {
    k.box(cast(CONCRETE), [0.3, 0.13, 0.15], [0, 0.075, 0])
    k.box(L('#a39d91', 0.95), [0.32, 0.02, 0.17], [0, 0.005, 0])
    for (const [sx, sz, x, z] of [[0.33, 0.025, 0, -0.08], [0.33, 0.025, 0, 0.08], [0.025, 0.18, -0.155, 0], [0.025, 0.18, 0.155, 0]]) {
      k.box(L('#c7c1b5', 0.9), [sx, 0.025, sz], [x, 0.15, z])
    }
    k.box(L('#4e342e', 1), [0.28, 0.01, 0.13], [0, 0.14, 0])
    const leaf = ['#2e7d32', '#388e3c', '#43a047', '#2f6f2a']
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4
      const r = i ? 0.06 : 0
      k.ico(i ? L(leaf[i % 4], 0.85) : cast(L(leaf[0], 0.85)), i ? 0.055 : 0.07, [Math.sin(a) * r * 1.6, 0.2 + (i ? 0 : 0.03), Math.cos(a) * r * 0.6], [1, 0.85, 1])
    }
    for (let i = 0; i < 6; i++) {
      const a = i * 1.9 + 0.3
      k.ico(L(i % 2 ? '#f06292' : '#fff176', 0.7), 0.014, [Math.sin(a) * 0.1, 0.235 + (i % 3) * 0.012, Math.cos(a) * 0.045], [1, 1, 1], 0)
    }
  }),

  // Speed limit sign: galvanised post, the plate's back braced by brackets.
  sign: () => prop('sign', (k) => {
    k.cyl(cast(GALV), 0.012, 0.014, 0.66, [0, 0.33, 0], undefined, 8)
    k.cyl(GALV, 0.022, 0.022, 0.012, [0, 0.006, 0], undefined, 8)
    k.box(L('#9aa3a8', 0.5, 0.5), [0.17, 0.21, 0.006], [0, 0.56, -0.016])
    for (const y of [0.5, 0.62]) k.box(STEEL, [0.03, 0.012, 0.012], [0, y, -0.008])
    k.sphere(GALV, 0.013, [0, 0.66, 0], [1, 0.6, 1], 8, 3, Math.PI / 2)
  }),

  // Utility cabinet: plinth, twin doors with handles, louvred vents, warning sticker.
  box: () => prop('box', (k) => {
    const body = L('#8fa2ab', 0.55)
    k.box(CONCRETE, [0.28, 0.03, 0.15], [0, 0.015, 0])
    k.box(cast(body), [0.24, 0.3, 0.12], [0, 0.18, 0])
    k.box(L('#75868f', 0.55), [0.26, 0.022, 0.14], [0, 0.34, 0])
    k.box(L('#5b6a71', 0.6), [0.003, 0.27, 0.002], [0, 0.18, -0.061])
    for (const s of [-1, 1]) {
      k.rod(STEEL, [s * 0.02, 0.17, -0.064], [s * 0.02, 0.21, -0.064], 0.004)
      for (let i = 0; i < 4; i++) k.box(L('#6d7d85', 0.6), [0.07, 0.006, 0.006], [s * 0.07, 0.09 + i * 0.016, -0.062], [0.5, 0, 0])
    }
    k.cone(L('#fbc02d', 0.5), 0.016, 0.001, [-0.07, 0.25, -0.0615], [Math.PI / 2, 0, 0], 3)
    k.box(L('#eceff1', 0.5), [0.05, 0.03, 0.002], [0.07, 0.25, -0.061])
  }),

  // Two parking meters: posts on flanges, rounded heads with a display dome and coin slot.
  meter: () => prop('meter', (k) => {
    for (const x of [-0.15, 0.15]) {
      k.cyl(cast(L('#56666e', 0.5)), 0.011, 0.013, 0.26, [x, 0.13, 0], undefined, 8)
      k.cyl(GALV, 0.022, 0.024, 0.01, [x, 0.005, 0], undefined, 8)
      k.box(cast(L('#4a5961', 0.5)), [0.06, 0.07, 0.05], [x, 0.3, 0])
      k.cyl(L('#4a5961', 0.5), 0.03, 0.03, 0.05, [x, 0.335, 0], [Math.PI / 2, 0, 0], 12)
      k.sphere(L('#9fb3bd', 0.15, 0.3), 0.022, [x, 0.335, -0.022], [1, 1, 0.5], 10, 6)
      k.box(L('#d0d8dc', 0.3), [0.03, 0.016, 0.002], [x, 0.29, -0.026])
      k.box(BLACK, [0.004, 0.014, 0.003], [x + 0.018, 0.29, -0.027])
      k.box(L('#ffca28', 0.4), [0.03, 0.01, 0.002], [x, 0.272, -0.026])
    }
  }),
}

// Fire hydrant: flanged base, barrel, bonnet and operating nut, two hose
// outlets and a pumper outlet with chained caps.
export const hydrant = () => prop('hydrant', (k) => {
  const red = L('#d32f2f', 0.45)
  const cap = L('#e8e8e8', 0.4, 0.3)
  k.cyl(L('#9e9e9e', 0.6, 0.4), 0.07, 0.075, 0.025, [0, 0.0125, 0], undefined, 12)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    k.cyl(STEEL, 0.006, 0.006, 0.01, [Math.sin(a) * 0.062, 0.03, Math.cos(a) * 0.062], undefined, 5)
  }
  k.cyl(cast(red), 0.05, 0.055, 0.2, [0, 0.125, 0], undefined, 14)
  k.cyl(red, 0.062, 0.062, 0.018, [0, 0.225, 0], undefined, 14)
  k.sphere(cast(red), 0.055, [0, 0.234, 0], [1, 0.75, 1], 14, 5, Math.PI / 2)
  k.cyl(cap, 0.012, 0.016, 0.03, [0, 0.285, 0], undefined, 5)
  // Side hose outlets.
  for (const s of [-1, 1]) {
    k.cyl(red, 0.022, 0.022, 0.04, [s * 0.065, 0.17, 0], [0, 0, Math.PI / 2], 10)
    k.cyl(cap, 0.026, 0.026, 0.016, [s * 0.088, 0.17, 0], [0, 0, Math.PI / 2], 10)
    k.cyl(cap, 0.008, 0.008, 0.01, [s * 0.099, 0.17, 0], [0, 0, Math.PI / 2], 5)
    k.torus(L('#bdbdbd', 0.4, 0.6), 0.03, 0.0025, [s * 0.075, 0.17, 0], [0, Math.PI / 2, Math.PI], Math.PI, 8, 3)
  }
  // Pumper outlet facing the road.
  k.cyl(red, 0.032, 0.032, 0.04, [0, 0.15, -0.065], [Math.PI / 2, 0, 0], 12)
  k.cyl(cap, 0.036, 0.036, 0.018, [0, 0.15, -0.09], [Math.PI / 2, 0, 0], 12)
  k.cyl(cap, 0.01, 0.01, 0.012, [0, 0.15, -0.103], [Math.PI / 2, 0, 0], 5)
})

// Street lamp: concrete footing, fluted cast base, tapered pole with collars,
// a curved arm and a cobra-head luminaire with a photocell on top.
export const streetLamp = () => prop('streetLamp', (k) => {
  const iron = L('#3a4a53', 0.5, 0.15)
  k.cyl(CONCRETE, 0.08, 0.085, 0.03, [0, 0.015, 0], undefined, 12)
  k.cyl(cast(iron), 0.045, 0.07, 0.16, [0, 0.11, 0], undefined, 12)
  k.cyl(iron, 0.052, 0.052, 0.02, [0, 0.2, 0], undefined, 12)
  k.cyl(cast(iron), 0.026, 0.036, 1.42, [0, 0.9, 0], undefined, 10)
  for (const y of [0.6, 1.55]) k.cyl(iron, 0.034, 0.034, 0.025, [0, y, 0], undefined, 10)
  // The arm bends from the pole top out over the road (-z).
  k.torus(cast(iron), 0.12, 0.016, [0, 1.6, -0.12], [0, -Math.PI / 2, 0], Math.PI / 2, 8, 6)
  k.rod(cast(iron), [0, 1.72, -0.12], [0, 1.72, -0.36], 0.016, 8)
  k.rod(iron, [0, 1.62, -0.01], [0, 1.715, -0.2], 0.007, 5)
  // Luminaire: a dark shell with a lens under it (lit separately).
  k.sphere(cast(L('#46565f', 0.45, 0.15)), 1, [0, 1.72, -0.44], [0.075, 0.04, 0.13], 12, 6, Math.PI / 2)
  k.cyl(L('#46565f', 0.45, 0.15), 0.02, 0.02, 0.05, [0, 1.72, -0.335], [Math.PI / 2, 0, 0], 8)
  k.cyl(BLACK, 0.012, 0.012, 0.012, [0, 1.765, -0.43], undefined, 8)
  k.sphere({ c: '#fff', glow: true }, 1, [0, 1.718, -0.44], [0.066, 0.022, 0.118], 12, 6)
})

// The speed limit plate's face, painted once.
let plate: MeshStandardMaterial | null = null
export function speedPlate() {
  if (plate) return plate
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = '#fafafa'
  g.fillRect(0, 0, 128, 160)
  g.strokeStyle = '#111'
  g.lineWidth = 6
  g.beginPath()
  g.roundRect(8, 8, 112, 144, 10)
  g.stroke()
  g.fillStyle = '#111'
  g.textAlign = 'center'
  g.font = 'bold 26px Arial, sans-serif'
  g.fillText('SPEED', 64, 44)
  g.fillText('LIMIT', 64, 72)
  g.font = 'bold 64px Arial, sans-serif'
  g.fillText('25', 64, 136)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  t.userData.text = true
  return (plate = new MeshStandardMaterial({ map: t, roughness: 0.5 }))
}
export const plateGeo = new PlaneGeometry(0.16, 0.2)
