import { CatmullRomCurve3, Vector3 } from 'three'
import type { VenueId } from '../scene/venues'
import { GLASS_W, glassAt, local, placeObstacles, type Obstacle } from './obstacles'

// Kart circuits: the Grand Prix is driven, not dragged. Each race is three laps of a
// looping circuit against five AI rivals, with drifts that charge a mini turbo, boost
// pads, jumps and prize crates that hand out items. Everything here is pure: the scene
// (scene/KartScene.tsx) draws a KartRace and feeds it the player's controls each frame.
// World scale matches the race venues: a car is about 1.7 units long.

export const LAPS = 3
export const KART_LEN = 1.7
export const KART_R = 0.72 // collision radius between karts
export const FIELD = 6 // karts on the grid, the player included

export type KartTheme = 'town' | 'docks' | 'desert'
export type FeatureKind = 'boost' | 'ramp' | 'crates'
// at: how far round the lap (0..1, forward direction); off: across the road (+ left); w: width.
export type TrackFeature = { kind: FeatureKind; at: number; off?: number; w?: number }
export type TrackDef = {
  id: string; name: string; short: string; theme: KartTheme; venue: VenueId; icon: string
  half: number // half width of the tarmac
  pts: [number, number][] // control points of the centre line, a closed loop
  features: TrackFeature[]
}

export const TRACKS: TrackDef[] = [
  {
    id: 'main', name: 'Main Street Circuit', short: 'Main St', theme: 'town', venue: 'main', icon: '🏙️', half: 3.6,
    pts: [[0, -46], [28, -46], [50, -38], [58, -18], [46, -2], [30, 2], [24, 16], [34, 30], [50, 36], [52, 52], [36, 62], [10, 60], [-12, 50], [-22, 34], [-40, 30], [-56, 20], [-60, 0], [-50, -24], [-30, -42]],
    features: [
      { kind: 'crates', at: 0.1 }, { kind: 'boost', at: 0.2, off: -1.4 }, { kind: 'ramp', at: 0.34, w: 4.4 },
      { kind: 'crates', at: 0.48 }, { kind: 'boost', at: 0.62, off: 1.5 }, { kind: 'crates', at: 0.78 }, { kind: 'boost', at: 0.9, off: 0 },
    ],
  },
  {
    id: 'docks', name: 'Harbor Hairpins', short: 'Harbor', theme: 'docks', venue: 'docks', icon: '⚓', half: 3.5,
    pts: [[0, -40], [36, -40], [56, -30], [56, -12], [38, -6], [18, -4], [12, 8], [22, 20], [48, 22], [62, 36], [52, 54], [24, 56], [-4, 48], [-20, 34], [-38, 40], [-56, 34], [-62, 14], [-52, 2], [-54, -16], [-44, -32], [-24, -40]],
    features: [
      { kind: 'boost', at: 0.06, off: 0 }, { kind: 'crates', at: 0.16 }, { kind: 'ramp', at: 0.4, w: 7 }, { kind: 'crates', at: 0.52 },
      { kind: 'boost', at: 0.6, off: -1.4 }, { kind: 'crates', at: 0.74 }, { kind: 'boost', at: 0.85, off: 1.4 },
    ],
  },
  {
    id: 'canyon', name: 'Red Rock Rally', short: 'Canyon', theme: 'desert', venue: 'desert', icon: '🏜️', half: 3.8,
    pts: [[0, -52], [40, -50], [66, -36], [70, -10], [56, 8], [60, 30], [44, 52], [16, 58], [-6, 44], [-14, 24], [-30, 14], [-52, 24], [-68, 10], [-66, -18], [-46, -42], [-22, -52]],
    features: [
      { kind: 'crates', at: 0.08 }, { kind: 'ramp', at: 0.17, w: 7.6 }, { kind: 'boost', at: 0.3, off: 1.6 }, { kind: 'crates', at: 0.42 },
      { kind: 'boost', at: 0.55, off: -1.6 }, { kind: 'ramp', at: 0.66, w: 4.2 }, { kind: 'crates', at: 0.76 }, { kind: 'boost', at: 0.92, off: 0 },
    ],
  },
]

// The Grand Prix's six races: each circuit forwards, then each one the other way round.
export const gpTrack = (round: number) => ({ def: TRACKS[round % TRACKS.length], reverse: round >= TRACKS.length })

export type Pad = { i: number; off: number; w: number; l: number; x: number; z: number; h: number }
export type Track = {
  def: TrackDef; reverse: boolean; n: number; len: number; half: number
  wall: number // centre to the barrier face
  x: Float32Array; z: Float32Array; tx: Float32Array; tz: Float32Array; nx: Float32Array; nz: Float32Array
  curve: Float32Array // signed bend (+ left), radians per unit
  boosts: Pad[]; ramps: Pad[]; crates: { x: number; z: number; i: number }[]
}

export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

const RUNOFF = 2.1 // kerb and verge between the tarmac and the barrier

const cache = new Map<string, Track>()
export function buildTrack(def: TrackDef, reverse = false): Track {
  const key = `${def.id}:${reverse}`
  const hit = cache.get(key)
  if (hit) return hit
  const pts = reverse ? [def.pts[0], ...def.pts.slice(1).reverse()] : def.pts
  const curve = new CatmullRomCurve3(pts.map(([x, z]) => new Vector3(x, 0, z)), true, 'centripetal')
  const n = Math.round(curve.getLength())
  const sp = curve.getSpacedPoints(n)
  const t: Track = {
    def, reverse, n, len: 0, half: def.half, wall: def.half + RUNOFF,
    x: new Float32Array(n), z: new Float32Array(n), tx: new Float32Array(n), tz: new Float32Array(n), nx: new Float32Array(n), nz: new Float32Array(n),
    curve: new Float32Array(n), boosts: [], ramps: [], crates: [],
  }
  for (let i = 0; i < n; i++) { t.x[i] = sp[i].x; t.z[i] = sp[i].z }
  let len = 0
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n
    let dx = t.x[b] - t.x[a], dz = t.z[b] - t.z[a]
    const l = Math.hypot(dx, dz) || 1
    dx /= l; dz /= l
    t.tx[i] = dx; t.tz[i] = dz
    // Left of travel: with heading h, forward is (sin h, cos h) and +h turns left.
    t.nx[i] = dz; t.nz[i] = -dx
    len += Math.hypot(t.x[b] - t.x[i], t.z[b] - t.z[i])
  }
  t.len = len
  for (let i = 0; i < n; i++) {
    const a = (i + n - 2) % n, b = (i + 2) % n
    const ha = Math.atan2(t.tx[a], t.tz[a]), hb = Math.atan2(t.tx[b], t.tz[b])
    t.curve[i] = wrapAngle(hb - ha) / 4
  }
  for (const f of def.features) {
    const at = reverse ? (1 - f.at) % 1 : f.at
    const i = Math.round(at * n) % n
    const off = (reverse ? -1 : 1) * (f.off ?? 0)
    const h = Math.atan2(t.tx[i], t.tz[i])
    const at3 = (o: number) => ({ x: t.x[i] + t.nx[i] * o, z: t.z[i] + t.nz[i] * o })
    if (f.kind === 'boost') t.boosts.push({ i, off, w: f.w ?? 2.4, l: 4.2, ...at3(off), h })
    else if (f.kind === 'ramp') t.ramps.push({ i, off, w: f.w ?? def.half * 2, l: 3.4, ...at3(off), h })
    else for (const o of [-2.4, -0.8, 0.8, 2.4]) t.crates.push({ ...at3(o * (def.half / 3.6)), i })
  }
  cache.set(key, t)
  return t
}

const wrapI = (i: number, n: number) => ((i % n) + n) % n

// The nearest centre-line sample to (x, z), searching around a hint so a loop that
// passes close to itself never snaps a kart onto the wrong stretch.
export function locate(t: Track, x: number, z: number, hint: number, span = 14) {
  let best = hint, bd = Infinity
  for (let k = -span; k <= span; k++) {
    const i = wrapI(hint + k, t.n)
    const d = (t.x[i] - x) ** 2 + (t.z[i] - z) ** 2
    if (d < bd) { bd = d; best = i }
  }
  return best
}
export const lateral = (t: Track, i: number, x: number, z: number) => (x - t.x[i]) * t.nx[i] + (z - t.z[i]) * t.nz[i]
const along = (t: Track, i: number, x: number, z: number) => (x - t.x[i]) * t.tx[i] + (z - t.z[i]) * t.tz[i]

// ---------- karts ----------

export type ItemId = 'nitro' | 'oil' | 'hornet' | 'shield' | 'tow' | 'tacks' | 'smoke' | 'emp' | 'nitro3' | 'ghost' | 'bomb' | 'splat' | 'rocket'
// Invented names and looks. Power-ups: a can of nitro, a bubble shield, a tow magnet that
// reels you up to the kart ahead. Debuffs for others: an oil slick (spin), a homing hornet
// drone (spin), a tack strip (flat tyre), a smoke bomb (slow, can't see) and a static
// storm that zaps the karts ahead (no boost, no items). The second batch: three nitro cans
// in one, a phantom mode that drives through karts and hazards, a bumper bomb lobbed up the
// road, a paint splat over the screens of everyone ahead and a rocket ride that drives
// itself up the field, bowling karts aside.
export const ITEMS: Record<ItemId, { name: string; icon: string }> = {
  nitro: { name: 'Nitro Can', icon: '🧪' },
  oil: { name: 'Oil Slick', icon: '🛢️' },
  hornet: { name: 'Homing Hornet', icon: '🐝' },
  shield: { name: 'Bubble Shield', icon: '🫧' },
  tow: { name: 'Tow Magnet', icon: '🧲' },
  tacks: { name: 'Tack Strip', icon: '📌' },
  smoke: { name: 'Smoke Bomb', icon: '💨' },
  emp: { name: 'Static Storm', icon: '⚡' },
  nitro3: { name: 'Nitro Triple', icon: '🔥' },
  ghost: { name: 'Phantom Mode', icon: '👻' },
  bomb: { name: 'Bumper Bomb', icon: '💣' },
  splat: { name: 'Paint Splat', icon: '🎨' },
  rocket: { name: 'Rocket Ride', icon: '🚀' },
}

// How often each item comes out of a crate, from the leader's odds to last place's.
// Leaders get defence and things to drop behind; the back of the field gets the catch-up.
const ODDS: Record<ItemId, [number, number]> = {
  shield: [3, 0.4], oil: [3, 0.8], tacks: [2.2, 0.8], smoke: [2, 0.8],
  nitro: [1.2, 3.2], hornet: [0.4, 2.6], tow: [0.2, 2.8], emp: [0, 1.6],
  ghost: [1.6, 1], bomb: [1.4, 1.4], splat: [0, 1.6], nitro3: [0, 1.8], rocket: [0, 1.2],
}
// Catch-up items only the back half of the field draws: they never help a leader pull away.
const BACK_HALF: ItemId[] = ['emp', 'splat', 'nitro3', 'rocket']
export function itemOdds(rank: number, field = FIELD): Record<ItemId, number> {
  const back = field > 1 ? rank / (field - 1) : 0 // 0 leading, 1 last
  const w = {} as Record<ItemId, number>
  let sum = 0
  for (const id of Object.keys(ODDS) as ItemId[]) {
    const [a, b] = ODDS[id]
    w[id] = BACK_HALF.includes(id) && back < 0.5 ? 0 : a + (b - a) * back
    sum += w[id]
  }
  for (const id of Object.keys(w) as ItemId[]) w[id] /= sum
  return w
}

// Effects that last a while: seconds left on each.
export const FLAT_TIME = 4, SMOKE_TIME = 1.6, EMP_TIME = 2.6, TOW_TIME = 3.2
export const TOW_RANGE = 45
export const GHOST_TIME = 3.5, SPLAT_TIME = 3.2, ROCKET_TIME = 3
export const BOMB_R = 4.5 // blast radius
const BOMB_FUSE = 0.8, BOMB_THROW = 20 // seconds in the air, track points ahead it lands

export type KartStats = { top: number; acc: number }
// Performance from PI, flattening out at the top so a big PI edge is worth a few
// percent of pace and driving well (drifts, boosts, items) still decides the race.
export function kartStats(pi: number): KartStats {
  const k = 1 - Math.exp(-Math.max(1, pi) / 90)
  return { top: 15 + 9 * k, acc: 9 + 6 * k }
}

// assist (touch only, 0..1): with the thumb near the middle the kart leans towards the racing
// line, fading out as the thumb steers harder, so a phone player isn't fighting tiny slips.
// thumb (portrait touch): drifts come from the steering thumb, which in a slide only has its
// own side of the slider, so that side covers the whole slide (see thumbSlide).
export type KartInput = { steer: number; gas: number; brake: number; drift: boolean; item: boolean; assist?: number; thumb?: boolean }
// In a thumb drift: just out of the middle swings it widest, all the way out pulls it tightest.
// (Below THUMB_LET_GO the slider has already ended the drift.)
export const THUMB_LET_GO = 0.2
export function thumbSlide(steer: number, dir: number) {
  const u = Math.max(THUMB_LET_GO, Math.min(1, steer * dir))
  return dir * (-1 + (2 * (u - THUMB_LET_GO)) / (1 - THUMB_LET_GO))
}
export const TOUCH_ASSIST = 0.45 // how much a phone player's kart leans to the line
export const idleInput = (): KartInput => ({ steer: 0, gas: 0, brake: 0, drift: false, item: false })

export type Kart = {
  id: number; name: string; ai: boolean; stats: KartStats
  x: number; z: number; y: number; vx: number; vz: number; vy: number; h: number
  steer: number // smoothed steering, -1..1
  idx: number; lap: number; done: number | null
  drift: number; charge: number; boost: number; spin: number; shield: number
  item: ItemId | null; itemHeld: boolean; bump: number; offroad: boolean; air: boolean
  lane: number // AI: preferred line across the road
  skill: number // AI: 0..1, how neat its line and braking are
  spinYaw: number
  flat: number; smoke: number; emp: number; tow: number // effect timers, seconds left
  ghost: number; splat: number; rocket: number
  ice: number // seconds of slide left after an ice patch
  towTarget: number // kart being reeled in, -1 for none
  uses: number // cans left in a Nitro Triple
}

// id: unique across every browser in a live race (the dropping kart's id * 1e5 + a count).
export type Hazard = { x: number; z: number; t: number; id?: number }
export type Strip = Hazard & { h: number } // tack strip lying across the road
export type Hornet = { x: number; z: number; from: number; target: number; t: number; id?: number }
// A bumper bomb flies from where it was thrown (sx, sz) to where it lands, then goes off.
export type Bomb = Hazard & { sx: number; sz: number; from: number; boom: boolean }

// What happened to karts this browser drives that the other browsers in a live race need to
// copy: an item used (with where it landed), a crate taken, a dropped hazard or hornet used up.
export type KartNote =
  | { k: 'item'; kart: number; item: ItemId; x: number; z: number; h: number; id: number; target: number; targets?: number[] }
  | { k: 'crate'; kart: number; i: number }
  | { k: 'gone'; id: number }
export type KartEvent = {
  kind: 'bump' | 'wall' | 'boost' | 'item' | 'hit' | 'lap' | 'finish' | 'turbo' | 'jump' | 'land' | 'crate' | 'block' | 'flat' | 'smoke' | 'zap' | 'tow' | 'ghost' | 'splat' | 'rocket' | 'boom' | 'boxes' | 'pothole' | 'ice' | 'glass'
  kart: number; value?: number
}
export const SMOKE_R = 3.6
const SMOKE_LIFE = 7

export const DRIFT_BLUE = 0.75
export const DRIFT_ORANGE = 1.7
const GRAVITY = 30
// Bumper Blast: everyone races the same kart, and bumps land hard.
export const BLAST_PI = 40
const BLAST_KNOCK = 2.6
const BLAST_SPIN = 9 // closing speed that spins out the kart that got hit
const SLIDE = 3 // how fast a kart pressed against a pile of boxes slides along it to the open lane

// obstacles: the road has obstacles (game/obstacles.ts). blast: Bumper Blast.
export type KartRules = { obstacles?: boolean; blast?: boolean }

export class KartRace {
  track: Track
  karts: Kart[]
  t = 0
  oil: Hazard[] = []
  hornets: Hornet[] = []
  tacks: Strip[] = []
  smoke: Hazard[] = []
  bombs: Bomb[] = []
  crateTaken: number[]
  events: KartEvent[] = []
  rand: () => number
  finishOrder: number[] = []
  // Live races: which karts this browser drives (the rest are copied from the others), and
  // what needs telling to them. Single player owns every kart and nobody reads the notes.
  owned: (id: number) => boolean = () => true
  notes: KartNote[] = []
  obstacles: Obstacle[]
  blast: boolean
  // The crossing a glass pane was last smashed on, per obstacle (-1: never).
  glassBroke: number[]
  private seq = 0

  constructor(track: Track, field: { name: string; pi: number; ai: boolean; skill?: number }[], seed = 1, rules: KartRules = {}) {
    this.track = track
    this.blast = !!rules.blast
    this.obstacles = rules.obstacles || rules.blast ? placeObstacles(track, this.blast) : []
    this.glassBroke = this.obstacles.map(() => -1)
    let s = seed * 9301 + 49297
    this.rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    this.crateTaken = track.crates.map(() => -99)
    // Two-wide grid behind the line, the player at the back like a proper cup start.
    this.karts = field.map((f, k) => {
      const row = Math.floor(k / 2), col = k % 2 ? -1 : 1
      const i = wrapI(-6 - row * 4, track.n)
      const off = col * track.half * 0.45 + (row % 2 ? 0.4 : -0.4)
      return {
        id: k, name: f.name, ai: f.ai, stats: kartStats(this.blast ? BLAST_PI : f.pi),
        x: track.x[i] + track.nx[i] * off, z: track.z[i] + track.nz[i] * off, y: 0, vx: 0, vz: 0, vy: 0, h: Math.atan2(track.tx[i], track.tz[i]),
        steer: 0, idx: i, lap: 0, done: null, drift: 0, charge: 0, boost: 0, spin: 0, shield: 0, item: null, itemHeld: false, bump: 0, offroad: false, air: false,
        lane: (this.rand() - 0.5) * track.half * 0.9, skill: f.skill ?? 0.8, spinYaw: 0,
        flat: 0, smoke: 0, emp: 0, tow: 0, towTarget: -1, ghost: 0, splat: 0, rocket: 0, uses: 0, ice: 0,
      }
    })
  }

  // Distance driven since the start, for placings: laps done plus the way round this lap.
  progress(k: Kart) {
    const s = k.idx / this.track.n
    return k.lap - 1 + (k.lap === 0 && s > 0.5 ? s - 1 : s)
  }

  // Finished karts by finishing order, then everyone else by distance.
  order(): Kart[] {
    // By finishing time, which in a live race also settles karts whose finish reached us late.
    const done = this.finishOrder.map((i) => this.karts[i]).sort((a, b) => a.done! - b.done!)
    const rest = this.karts.filter((k) => k.done === null).sort((a, b) => this.progress(b) - this.progress(a))
    return [...done, ...rest]
  }
  place(k: Kart) { return this.order().indexOf(k) + 1 }

  step(dt: number, inputs: KartInput[], running: boolean) {
    this.events = []
    if (running) this.t += dt
    const order = this.order()
    this.karts.forEach((k, i) => {
      if (!this.owned(k.id)) return
      let inp = !running ? idleInput() : k.done !== null ? this.autoInput(k, order, true) : k.ai ? this.autoInput(k, order, false) : inputs[i] ?? idleInput()
      if (running && inp.assist && !inp.brake && k.drift === 0 && k.done === null && !k.ai) {
        const w = inp.assist * Math.max(0, 1 - Math.abs(inp.steer) * 2)
        if (w > 0) inp = { ...inp, steer: inp.steer + (this.autoInput(k, order, false).steer - inp.steer) * w }
      }
      this.drive(k, inp, dt, order)
    })
    this.collideKarts()
    this.updateItems(dt)
  }

  // ---------- AI ----------

  autoInput(k: Kart, order: Kart[], cruise: boolean): KartInput {
    const t = this.track
    const speed = Math.hypot(k.vx, k.vz)
    const look = Math.round(5 + speed * 0.45)
    const j = wrapI(k.idx + look, t.n)
    // Bend ahead decides both the line (cut to the inside) and the corner speed.
    let bend = 0, peak = 0
    for (let d = 2; d < 22 + speed; d += 2) {
      const c = t.curve[wrapI(k.idx + d, t.n)]
      bend += c
      peak = Math.max(peak, Math.abs(c))
    }
    const inside = Math.max(-1, Math.min(1, bend * 3.2)) * (t.half - 1.2)
    let off = Math.max(-(t.half - 0.9), Math.min(t.half - 0.9, inside * (0.55 + 0.45 * k.skill) + k.lane * (1 - Math.abs(inside) / t.half)))
    // Line up with a boost pad if one is just ahead.
    for (const p of t.boosts) {
      const ahead = wrapI(p.i - k.idx, t.n)
      if (ahead > 4 && ahead < 30) off = p.off
    }
    // Steer round a pile of boxes, to the open side.
    for (const o of this.obstacles) {
      if (o.kind !== 'boxes') continue
      const ahead = wrapI(o.i - k.idx, t.n)
      // From well before it until the kart is past it, so one alongside doesn't cut back in.
      if ((ahead < 28 || ahead > t.n - 4) && Math.abs(off - o.off) < o.w / 2 + 1.1) off = o.off - Math.sign(o.off) * (o.w / 2 + 1.4)
    }
    // Ease around a kart right in front.
    for (const o of this.karts) {
      if (o === k) continue
      const ahead = along(t, k.idx, o.x, o.z) - along(t, k.idx, k.x, k.z)
      if (ahead > 0 && ahead < 5) {
        const side = lateral(t, k.idx, o.x, o.z) - lateral(t, k.idx, k.x, k.z)
        if (Math.abs(side) < 1.6) off += side > 0 ? -1.8 : 1.8
      }
    }
    off = Math.max(-(t.half - 0.6), Math.min(t.half - 0.6, off))
    const tx = t.x[j] + t.nx[j] * off, tz = t.z[j] + t.nz[j] * off
    const want = Math.atan2(tx - k.x, tz - k.z)
    const err = wrapAngle(want - k.h)
    const steer = Math.max(-1, Math.min(1, err * 2.6))
    const corner = Math.sqrt(36 / Math.max(peak, 0.005)) * (0.85 + 0.25 * k.skill)
    const fast = speed > corner + 1.5
    // A gentle rubber band: rivals well behind the leader find a little pace, the leader none.
    const inp: KartInput = { steer, gas: cruise ? 0.6 : fast ? 0 : 1, brake: fast && speed > corner + 4 ? 0.6 : 0, drift: false, item: false }
    if (!cruise && k.item && k.emp <= 0) {
      const rank = order.indexOf(k)
      const chaser = this.karts.some((o) => o !== k && wrapI(k.idx - o.idx, t.n) < 14 && Math.abs(this.progress(o) - this.progress(k)) < 0.5)
      if ((k.item === 'nitro' || k.item === 'nitro3') && Math.abs(bend) < 0.15) inp.item = true
      else if ((k.item === 'hornet' || k.item === 'emp' || k.item === 'splat' || k.item === 'rocket') && rank > 0) inp.item = true
      else if (k.item === 'bomb' && (rank === 0 || this.karts.some((o) => o !== k && o.done === null && wrapI(o.idx - k.idx, t.n) > 10 && wrapI(o.idx - k.idx, t.n) < 30))) inp.item = true
      else if (k.item === 'ghost' && (this.hornets.some((h) => h.target === k.id) || this.dangerAhead(k) || (chaser && rank === 0))) inp.item = true
      else if ((k.item === 'oil' || k.item === 'tacks' || k.item === 'smoke') && chaser) inp.item = true
      else if (k.item === 'tow' && rank > 0 && this.towTargetFor(k, order) >= 0) inp.item = true
      else if (k.item === 'shield') inp.item = true
    }
    // Paint on the visor: the line wanders until it wipes off.
    if (k.splat > 0 && !cruise) inp.steer = Math.max(-1, Math.min(1, inp.steer + Math.sin(this.t * 4.3 + k.id * 1.7) * 0.45))
    return inp
  }

  // An oil slick, tack strip or smoke cloud on the road just ahead.
  dangerAhead(k: Kart) {
    const fx = Math.sin(k.h), fz = Math.cos(k.h)
    const near = (h: Hazard) => {
      const dx = h.x - k.x, dz = h.z - k.z
      const a = dx * fx + dz * fz
      return a > 2 && a < 16 && Math.abs(dx * fz - dz * fx) < 2.5
    }
    return this.oil.some(near) || this.tacks.some(near) || this.smoke.some(near)
  }

  // ---------- physics ----------

  drive(k: Kart, inp: KartInput, dt: number, order: Kart[]) {
    const t = this.track
    // Rocket ride: the rocket does the driving (the AI's line, flat out).
    if (k.rocket > 0 && k.spin <= 0) inp = { ...this.autoInput(k, order, true), gas: 1, brake: 0, drift: false, item: false }
    const fx = Math.sin(k.h), fz = Math.cos(k.h)
    const sx = fz, sz = -fx // left
    let vf = k.vx * fx + k.vz * fz
    let vl = k.vx * sx + k.vz * sz
    const vf0 = vf
    const rank = order.indexOf(k)
    const band = k.ai ? 1 + Math.min(0.06, Math.max(-0.03, (rank - 2) * 0.015)) : 1
    // Static storm: the boost and any drift charge go dead for a moment.
    if (k.emp > 0) { k.boost = 0; k.charge = 0 }
    let top = k.stats.top * band * (k.offroad ? 0.55 : 1)
    if (k.flat > 0) top *= 0.74
    if (k.smoke > 0) top *= 0.84
    if (k.emp > 0) top *= 0.68
    if (k.splat > 0) top *= 0.94
    if (k.ghost > 0) top *= 1.1
    if (k.rocket > 0) top = k.stats.top * 1.45
    else if (k.boost > 0) top *= 1.32
    else if (k.tow > 0) top *= 1.26
    k.boost = Math.max(0, k.boost - dt)
    k.shield = Math.max(0, k.shield - dt)
    k.bump = Math.max(0, k.bump - dt)
    k.flat = Math.max(0, k.flat - dt)
    k.smoke = Math.max(0, k.smoke - dt)
    k.emp = Math.max(0, k.emp - dt)
    k.tow = Math.max(0, k.tow - dt)
    if (k.tow <= 0) k.towTarget = -1
    k.ghost = Math.max(0, k.ghost - dt)
    k.splat = Math.max(0, k.splat - dt)
    k.rocket = Math.max(0, k.rocket - dt)
    k.ice = Math.max(0, k.ice - dt)

    if (k.spin > 0) {
      k.spin -= dt
      k.spinYaw += dt * 14
      vf *= Math.exp(-3 * dt)
      vl *= Math.exp(-4 * dt)
      k.drift = 0
      k.charge = 0
      if (k.spin <= 0) k.spinYaw = 0
    } else {
      if (k.boost > 0 || k.rocket > 0 || (k.tow > 0 && inp.gas > 0)) vf += (top - vf) * Math.min(1, dt * (k.boost > 0 || k.rocket > 0 ? 4 : 2.5))
      else if (inp.gas > 0 && vf < top) vf += k.stats.acc * inp.gas * Math.max(0.15, 1 - vf / top) * dt
      else if (vf > top) vf += (top - vf) * Math.min(1, dt * 2)
      if (inp.brake > 0) vf = vf > 0.5 ? vf - 22 * inp.brake * dt : Math.max(-top * 0.35, vf - 7 * inp.brake * dt)
      if (inp.gas <= 0 && inp.brake <= 0) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 4 * dt)

      // Drift: hold it with a direction to slide; the longer the slide the bigger the turbo on release.
      const speed = Math.abs(vf)
      if (inp.drift && k.drift === 0 && !k.air && k.emp <= 0 && speed > 7 && Math.abs(inp.steer) > 0.25) {
        k.drift = Math.sign(inp.steer)
        k.charge = 0
        k.vy = 3.2
        k.air = true
      }
      if (k.drift !== 0 && (!inp.drift || speed < 5 || k.emp > 0)) {
        if (k.charge >= DRIFT_ORANGE) { k.boost = Math.max(k.boost, 1.25); this.events.push({ kind: 'turbo', kart: k.id, value: 2 }) }
        else if (k.charge >= DRIFT_BLUE) { k.boost = Math.max(k.boost, 0.65); this.events.push({ kind: 'turbo', kart: k.id, value: 1 }) }
        k.drift = 0
        k.charge = 0
      }
      // A flat tyre drags the kart towards its side (which side comes from the kart's id).
      const pull = k.flat > 0 ? (k.id % 2 ? 0.28 : -0.28) : 0
      // The tow magnet steers a little towards the kart it is reeling in.
      let tug = 0
      if (k.tow > 0 && k.towTarget >= 0) {
        const o = this.karts[k.towTarget]
        tug = Math.max(-0.35, Math.min(0.35, wrapAngle(Math.atan2(o.x - k.x, o.z - k.z) - k.h) * 1.2))
      }
      const steer = inp.thumb && k.drift !== 0 ? thumbSlide(inp.steer, k.drift) : inp.steer
      const want = Math.max(-1, Math.min(1, steer + pull + tug))
      k.steer += (want - k.steer) * Math.min(1, dt * 10)
      const turn = 2.3 * Math.min(1, speed / 5) * (1 - 0.3 * Math.min(1, speed / k.stats.top)) * Math.sign(vf || 1) * (k.ice > 0 ? 0.7 : 1)
      let yaw: number
      if (k.drift !== 0) {
        yaw = k.drift * turn * (0.75 + 0.45 * k.steer * k.drift)
        if (!k.air) k.charge += dt * (0.7 + 0.5 * Math.max(0, k.steer * k.drift))
      } else yaw = k.steer * turn
      k.h += yaw * dt
    }
    if (k.drift !== 0 && k.spin <= 0) {
      // Sliding: the kart travels a little outside where its nose points and keeps its speed.
      const spd = Math.max(0, Math.hypot(k.vx, k.vz) + vf - vf0) * (1 - 0.04 * dt)
      const dir = k.h - k.drift * 0.32
      const want = { x: Math.sin(dir) * spd, z: Math.cos(dir) * spd }
      const a = Math.min(1, dt * 7)
      k.vx += (want.x - k.vx) * a
      k.vz += (want.z - k.vz) * a
    } else {
      // On ice the tyres barely hold, so the kart slides wide.
      vl *= Math.exp(-(k.air ? 0.6 : k.ice > 0 ? 1.4 : 9) * dt)
      k.vx = fx * vf + sx * vl
      k.vz = fz * vf + sz * vl
    }
    if (k.spin > 0) k.h += 0 // the spin is shown with spinYaw; the heading holds

    // Air time.
    if (k.air) {
      k.vy -= GRAVITY * dt
      k.y += k.vy * dt
      if (k.y <= 0) {
        if (k.vy < -6) this.events.push({ kind: 'land', kart: k.id })
        k.y = 0
        k.vy = 0
        k.air = false
      }
    }

    k.x += k.vx * dt
    k.z += k.vz * dt
    const prev = k.idx
    k.idx = locate(t, k.x, k.z, k.idx)
    if (prev > t.n * 0.75 && k.idx < t.n * 0.25) this.crossLine(k)
    else if (prev < t.n * 0.25 && k.idx > t.n * 0.75) k.lap--

    // Barriers either side: push back onto the track and lose the outward speed.
    const d = lateral(t, k.idx, k.x, k.z)
    const lim = t.wall - KART_R * 0.75
    if (Math.abs(d) > lim) {
      const sg = Math.sign(d)
      const nx = t.nx[k.idx] * sg, nz = t.nz[k.idx] * sg
      k.x -= nx * (Math.abs(d) - lim)
      k.z -= nz * (Math.abs(d) - lim)
      const out = k.vx * nx + k.vz * nz
      if (out > 0) {
        k.vx -= nx * out * 1.35
        k.vz -= nz * out * 1.35
        k.vx *= 0.94
        k.vz *= 0.94
        if (out > 4 && k.bump <= 0) { this.events.push({ kind: 'wall', kart: k.id, value: out }); k.bump = 0.3 }
        // Turn the nose back along the wall so a scrape doesn't leave the kart facing it.
        const along2 = Math.atan2(t.tx[k.idx], t.tz[k.idx])
        k.h += wrapAngle(along2 - k.h) * Math.min(1, dt * 6)
      }
    }
    k.offroad = !k.air && Math.abs(d) > t.half + 0.45

    // Pads and ramps.
    if (!k.air) {
      for (const p of t.boosts) if (onPad(t, p, k)) {
        if (k.boost < 0.9) this.events.push({ kind: 'boost', kart: k.id })
        k.boost = Math.max(k.boost, 1.1)
      }
      for (const p of t.ramps) if (onPad(t, p, k) && vf > 4) {
        k.vy = 5 + vf * 0.32
        k.air = true
        this.events.push({ kind: 'jump', kart: k.id })
      }
      this.obstacleHits(k, dt)
    }

    // Prize crates.
    t.crates.forEach((c, ci) => {
      if (this.t - this.crateTaken[ci] < 3 || k.y > 1.6) return
      if (!this.owned(k.id)) return
      if ((c.x - k.x) ** 2 + (c.z - k.z) ** 2 < 1.3 ** 2) {
        this.crateTaken[ci] = this.t
        this.notes.push({ k: 'crate', kart: k.id, i: ci })
        this.events.push({ kind: 'crate', kart: k.id })
        if (!k.item && k.done === null) {
          k.item = this.rollItem(order.indexOf(k))
          k.uses = k.item === 'nitro3' ? 3 : 1
        }
      }
    })

    // Items: a press uses the one held.
    if (inp.item && !k.itemHeld && k.item && k.spin <= 0 && k.emp <= 0) this.useItem(k, order)
    k.itemHeld = inp.item
  }

  // Boxes, potholes, ice and glass (game/obstacles.ts). Only ever slows a kart.
  obstacleHits(k: Kart, dt: number) {
    const t = this.track
    this.obstacles.forEach((o, oi) => {
      if (k.ghost > 0) return
      const { fwd, side } = local(o, t, k.x, k.z)
      const r = KART_R * 0.6
      if (o.kind === 'boxes') {
        const inF = o.l / 2 + r - Math.abs(fwd), inS = o.w / 2 + r - Math.abs(side)
        if (inF <= 0 || inS <= 0) return
        // Out the short way, losing most of the speed into the pile.
        const fx = Math.sin(o.h), fz = Math.cos(o.h)
        if (inF < inS) {
          const sg = Math.sign(fwd) || -1
          // Back off the face and slide along it towards the open lane, so nobody stays pinned.
          const open = -Math.sign(o.off) * SLIDE * dt
          k.x += fx * inF * sg + t.nx[o.i] * open
          k.z += fz * inF * sg + t.nz[o.i] * open
        }
        else { const sg = Math.sign(side) || -Math.sign(o.off); k.x += t.nx[o.i] * inS * sg; k.z += t.nz[o.i] * inS * sg }
        if (k.bump <= 0) {
          k.vx *= 0.45
          k.vz *= 0.45
          k.bump = 0.4
          this.events.push({ kind: 'boxes', kart: k.id })
        }
      } else if (o.kind === 'pothole') {
        if (Math.hypot(fwd, side) > o.w / 2) return
        k.vx *= 0.8
        k.vz *= 0.8
        k.vy = 2.4
        k.air = true
        this.events.push({ kind: 'pothole', kart: k.id })
      } else if (o.kind === 'ice') {
        if (Math.abs(fwd) > o.l / 2 || Math.abs(side) > o.w / 2) return
        if (k.ice <= 0) this.events.push({ kind: 'ice', kart: k.id })
        k.ice = 1.2
      } else {
        const g = glassAt(o, this.t)
        if (!g || this.glassBroke[oi] === g.cycle) return
        if (Math.abs(fwd) > o.l / 2 + r || Math.abs(side - g.across) > GLASS_W / 2 + r) return
        this.glassBroke[oi] = g.cycle
        k.vx *= 0.75
        k.vz *= 0.75
        this.events.push({ kind: 'glass', kart: k.id })
      }
    })
  }

  crossLine(k: Kart) {
    k.lap++
    if (k.lap > LAPS && k.done === null) {
      k.done = this.t
      this.finishOrder.push(k.id)
      this.events.push({ kind: 'finish', kart: k.id, value: this.finishOrder.length })
    } else if (k.lap > 1) this.events.push({ kind: 'lap', kart: k.id, value: k.lap })
  }

  rollItem(rank: number): ItemId {
    const odds = itemOdds(rank, this.karts.length)
    let r = this.rand()
    for (const id of Object.keys(odds) as ItemId[]) {
      r -= odds[id]
      if (r <= 0) return id
    }
    return 'nitro'
  }

  // The kart the tow magnet latches on to: the next one up the order, if it is in reach.
  towTargetFor(k: Kart, order: Kart[]) {
    const rank = order.indexOf(k)
    if (rank <= 0) return -1
    const o = order[rank - 1]
    const gap = (this.progress(o) - this.progress(k)) * this.track.n
    return o.done === null && gap > 0 && gap < TOW_RANGE ? o.id : -1
  }

  useItem(k: Kart, order: Kart[]) {
    const item = k.item!
    // A Nitro Triple stays in the slot until its third can.
    k.uses = Math.max(0, k.uses - 1)
    if (item !== 'nitro3' || k.uses <= 0) k.item = null
    this.events.push({ kind: 'item', kart: k.id })
    const rank = order.indexOf(k)
    const id = k.id * 1e5 + ++this.seq
    let target = -1, targets: number[] | undefined
    if (item === 'nitro') k.boost = Math.max(k.boost, 1.6)
    else if (item === 'nitro3') { k.boost = Math.min(3, k.boost + 1.1); target = k.uses } // cans used back to back stack up
    else if (item === 'shield') k.shield = 8
    else if (item === 'ghost') { k.ghost = GHOST_TIME; this.events.push({ kind: 'ghost', kart: k.id }) }
    else if (item === 'rocket') { k.rocket = ROCKET_TIME; k.drift = 0; k.charge = 0; this.events.push({ kind: 'rocket', kart: k.id }) }
    else if (item === 'splat') {
      // Everyone ahead still racing gets a faceful.
      targets = order.slice(0, Math.max(0, rank)).filter((o) => o.done === null).map((o) => o.id)
    } else if (item === 'tow') {
      // With nobody in reach it still gives a short shove, so it's never a dud.
      k.tow = TOW_TIME
      k.towTarget = target = this.towTargetFor(k, order)
      this.events.push({ kind: 'tow', kart: k.id, value: k.towTarget })
    } else if (item === 'emp') {
      // Zaps up to three karts ahead, nearest first; a bubble shield soaks it up.
      targets = order.slice(Math.max(0, rank - 3), rank).filter((o) => o.done === null).map((o) => o.id)
    } else if (item === 'hornet') {
      // The nearest kart ahead still racing (a finished one isn't worth a hornet).
      const o = order.slice(0, Math.max(0, rank)).reverse().find((x) => x.done === null)
      target = o ? o.id : -1
    }
    const note: KartNote = { k: 'item', kart: k.id, item, x: k.x, z: k.z, h: k.h, id, target, targets }
    this.notes.push(note)
    this.drop(note)
  }

  // Puts down what an item leaves on the track (or zaps its targets): for our own karts as
  // they use one, and for a live race's other karts as their notes come in.
  drop(n: KartNote & { k: 'item' }) {
    const bx = n.x - Math.sin(n.h) * 1.8, bz = n.z - Math.cos(n.h) * 1.8
    if (n.item === 'oil') this.oil.push({ x: bx, z: bz, t: this.t, id: n.id })
    else if (n.item === 'tacks') this.tacks.push({ x: bx, z: bz, t: this.t, h: n.h, id: n.id })
    else if (n.item === 'smoke') this.smoke.push({ x: n.x - Math.sin(n.h) * 3, z: n.z - Math.cos(n.h) * 3, t: this.t, id: n.id })
    else if (n.item === 'hornet' && n.target >= 0) this.hornets.push({ x: n.x, z: n.z, from: n.kart, target: n.target, t: this.t, id: n.id })
    else if (n.item === 'emp' || n.item === 'splat') {
      for (const i of n.targets ?? []) if (this.owned(i)) this.hit(this.karts[i], n.item === 'emp' ? 'zap' : 'splat')
    } else if (n.item === 'bomb') {
      // Lobbed up the road: lands on the line BOMB_THROW points on, at the thrower's offset.
      const t = this.track
      const i0 = locate(t, n.x, n.z, this.karts[n.kart]?.idx ?? 0, 40)
      const off = Math.max(-t.half + 1, Math.min(t.half - 1, lateral(t, i0, n.x, n.z)))
      const i = wrapI(i0 + BOMB_THROW, t.n)
      this.bombs.push({ sx: n.x, sz: n.z, x: t.x[i] + t.nx[i] * off, z: t.z[i] + t.nz[i] * off, t: this.t, from: n.kart, boom: false, id: n.id })
    }
  }

  // A live race's note from another browser.
  apply(n: KartNote) {
    if (n.k === 'item') {
      if (n.kart >= 0 && n.kart < this.karts.length && !this.owned(n.kart)) {
        this.events.push({ kind: 'item', kart: n.kart })
        this.drop(n)
      }
    } else if (n.k === 'crate') {
      if (n.i >= 0 && n.i < this.crateTaken.length) this.crateTaken[n.i] = this.t
    } else {
      const keep = (h: { id?: number }) => h.id !== n.id
      this.oil = this.oil.filter(keep)
      this.tacks = this.tacks.filter(keep)
      this.hornets = this.hornets.filter(keep)
    }
  }
  private used(h: { id?: number }) {
    if (h.id !== undefined) this.notes.push({ k: 'gone', id: h.id })
  }

  hit(k: Kart, how: 'spin' | 'flat' | 'zap' | 'smoke' | 'splat' = 'spin') {
    // A phantom or a rocket can't be touched.
    if (k.ghost > 0 || k.rocket > 0) return
    if (k.shield > 0) { k.shield = 0; this.events.push({ kind: 'block', kart: k.id }); return }
    if (how === 'flat') { k.flat = FLAT_TIME; this.events.push({ kind: 'flat', kart: k.id }); return }
    if (how === 'zap') { k.emp = EMP_TIME; k.boost = 0; k.tow = 0; this.events.push({ kind: 'zap', kart: k.id }); return }
    if (how === 'splat') { k.splat = SPLAT_TIME; this.events.push({ kind: 'splat', kart: k.id }); return }
    if (how === 'smoke') {
      if (k.smoke <= 0) this.events.push({ kind: 'smoke', kart: k.id })
      k.smoke = SMOKE_TIME
      return
    }
    k.spin = 1.1
    k.boost = 0
    k.tow = 0
    this.events.push({ kind: 'hit', kart: k.id })
  }

  updateItems(dt: number) {
    this.oil = this.oil.filter((o) => {
      if (this.t - o.t > 25) return false
      const victim = this.karts.find((k) => this.owned(k.id) && k.spin <= 0 && k.ghost <= 0 && k.rocket <= 0 && k.y < 0.5 && (k.x - o.x) ** 2 + (k.z - o.z) ** 2 < 1.1 ** 2 && this.t - o.t > 0.4)
      if (victim) { this.hit(victim); this.used(o); return false }
      return true
    })
    // Tacks: a strip across the road, 2.6 wide; driving over it (not jumping it) pops a tyre.
    this.tacks = this.tacks.filter((s) => {
      if (this.t - s.t > 25) return false
      const victim = this.karts.find((k) => {
        if (!this.owned(k.id) || k.y > 0.4 || k.flat > 0 || k.ghost > 0 || k.rocket > 0 || this.t - s.t < 0.4) return false
        const dx = k.x - s.x, dz = k.z - s.z
        const along = dx * Math.sin(s.h) + dz * Math.cos(s.h), across = dx * Math.cos(s.h) - dz * Math.sin(s.h)
        return Math.abs(along) < 0.7 && Math.abs(across) < 1.3 + KART_R * 0.6
      })
      if (victim) { this.hit(victim, 'flat'); this.used(s); return false }
      return true
    })
    // Smoke: a cloud that lingers; anyone inside (but not the shielded) is slowed and blinded.
    this.smoke = this.smoke.filter((c) => {
      const age = this.t - c.t
      if (age > SMOKE_LIFE) return false
      if (age < 0.3) return true
      const r = SMOKE_R * Math.min(1, 0.6 + age * 0.4)
      for (const k of this.karts) {
        if ((k.x - c.x) ** 2 + (k.z - c.z) ** 2 < r * r && k.y < 2) {
          if (k.shield > 0 || k.ghost > 0 || k.rocket > 0 || !this.owned(k.id)) continue
          this.hit(k, 'smoke')
        }
      }
      return true
    })
    // Bombs: fly, land, go off. Everyone this browser drives inside the blast spins out (the
    // thrower too, if they drove into it). The blast lingers on screen a moment after.
    this.bombs = this.bombs.filter((b) => {
      const age = this.t - b.t
      if (!b.boom && age >= BOMB_FUSE) {
        b.boom = true
        this.events.push({ kind: 'boom', kart: b.from })
        for (const k of this.karts) {
          if (!this.owned(k.id) || k.y > 2.5 || (k.x - b.x) ** 2 + (k.z - b.z) ** 2 > BOMB_R * BOMB_R) continue
          this.hit(k)
        }
      }
      return age < BOMB_FUSE + 0.6
    })
    this.hornets = this.hornets.filter((h) => {
      const k = this.karts[h.target]
      const dx = k.x - h.x, dz = k.z - h.z
      const d = Math.hypot(dx, dz)
      if (d < 1 || this.t - h.t > 8) {
        // Only the browser driving the target decides the hit; the others just lose the drone.
        if (d < 1 && this.owned(k.id)) this.hit(k)
        return false
      }
      const v = 42 * dt
      h.x += (dx / d) * Math.min(v, d)
      h.z += (dz / d) * Math.min(v, d)
      return true
    })
  }

  collideKarts() {
    const ks = this.karts
    for (let a = 0; a < ks.length; a++) for (let b = a + 1; b < ks.length; b++) {
      const p = ks[a], q = ks[b]
      // In a live race each browser moves only its own karts: against a kart driven elsewhere,
      // ours takes the whole shove (the other browser does the same for theirs).
      const mp = this.owned(p.id) ? 1 : 0, mq = this.owned(q.id) ? 1 : 0
      if (!mp && !mq) continue
      const wp = mp / (mp + mq) * 2, wq = mq / (mp + mq) * 2
      if (Math.abs(p.y - q.y) > 0.8 || p.ghost > 0 || q.ghost > 0) continue
      const dx = q.x - p.x, dz = q.z - p.z
      const d = Math.hypot(dx, dz)
      if (d >= KART_R * 2 || d < 1e-4) continue
      // A rocket bowls through: whoever it touches spins out (decided by the victim's browser).
      if (p.rocket > 0 || q.rocket > 0) {
        if (p.rocket > 0 && q.rocket <= 0 && mq && q.spin <= 0) this.hit(q)
        if (q.rocket > 0 && p.rocket <= 0 && mp && p.spin <= 0) this.hit(p)
      }
      const nx = dx / d, nz = dz / d
      const push = (KART_R * 2 - d) / 2
      p.x -= nx * push * wp; p.z -= nz * push * wp
      q.x += nx * push * wq; q.z += nz * push * wq
      const rel = (q.vx - p.vx) * nx + (q.vz - p.vz) * nz
      if (rel < 0) {
        const j = -rel * 0.65 * (this.blast ? BLAST_KNOCK : 1)
        // Bumper Blast: a hard ram spins out whoever was hit (the slower of the two along the hit).
        if (this.blast && -rel > BLAST_SPIN) {
          const victim = (p.vx * nx + p.vz * nz) < -(q.vx * nx + q.vz * nz) ? p : q
          if (this.owned(victim.id) && victim.shield <= 0 && victim.spin <= 0) victim.spin = 0.45
        }
        p.vx -= nx * j * wp; p.vz -= nz * j * wp
        q.vx += nx * j * wq; q.vz += nz * j * wq
        if (-rel > 2.5 && p.bump <= 0) { this.events.push({ kind: 'bump', kart: p.id, value: -rel }); p.bump = 0.25; q.bump = 0.25 }
      }
    }
  }
}

function onPad(t: Track, p: Pad, k: Kart) {
  const fwd = (k.x - p.x) * Math.sin(p.h) + (k.z - p.z) * Math.cos(p.h)
  const side = (k.x - p.x) * t.nx[p.i] + (k.z - p.z) * t.nz[p.i]
  return Math.abs(fwd) < p.l / 2 && Math.abs(side) < p.w / 2 + 0.2
}

// ---------- Grand Prix field ----------

// Who lines up: the round's named rival at its usual PI (the one to beat), and four
// club racers a little slower. `names` are the series' rivals, so the cup's cast all race.
export function gpField(rivals: string[], round: number, rivalPi: number, me: { name: string; pi: number }) {
  const others = rivals.filter((_, i) => i !== round)
  const field: { name: string; pi: number; ai: boolean; skill: number }[] = [{ name: rivals[round], pi: rivalPi, ai: true, skill: 0.75 + round * 0.04 }]
  others.slice(0, FIELD - 2).forEach((name, i) => field.push({ name, pi: Math.round(rivalPi * (0.8 + i * 0.04)), ai: true, skill: 0.45 + i * 0.08 }))
  field.push({ name: me.name, pi: me.pi, ai: false, skill: 1 })
  return field
}

// Coins for a placing in a kart race outside the Grand Prix's own prizes (none yet): kept small.
export const POINTS = [10, 7, 5, 3, 2, 1]
