// Town traffic. Every car follows lane curves through the road tiles, keeps
// its distance from whatever is ahead, takes turns at junctions (waiting for
// green at four-ways), pulls up at businesses, and swings round cars stopped
// at the curb. Plain TypeScript so it can be tested without a renderer.
import { pointAt, poseAt, type Curve, type V2 } from './curves'
import { YELLOW, type Light } from './layout'
import {
  D, LANE, buildNet, conflicts, exits, opp, priority, right, roadCurve, route, tkey,
  type Building, type Net, type Node, type Stop, type TurnOf,
} from './net'

export type TripKind = 'gas' | 'tires' | 'tow'

export type CarSpec = {
  uid: string
  len: number // body length in world units
  wid: number
  cruise: number // top speed, world units per second
  stalled: boolean // flat tire or out of gas: pull over and wait
  low?: boolean // a low-PI beater: it keeps heading home to the trailer homes
  favors?: string[] // building types it drops in at most (school buses: the schools)
}

type Leg = {
  c: Curve
  node: string | null // road tile, or null inside a lot
  inDir: number
  outDir: number
  junction: boolean
  turn: number // 0 straight, 1 bend, 2 U-turn
  stopS?: number // pull up here (arc length) ...
  stopFor?: number // ... for this long
  stopKind?: 'curb' | 'pump' | 'stall' | 'tow'
  lot?: string // on a forecourt: the road tile its driveway turns in from
  granted: boolean
}

export type Agent = {
  uid: string
  len: number
  wid: number
  cruise: number
  legs: Leg[]
  ci: number // index of the leg being driven
  s: number // arc length along it
  v: number
  odo: number // total distance driven, for overtaking swings
  x: number
  z: number
  yaw: number
  hx: number
  hz: number
  stalled: boolean
  parked: number // seconds left pulled up, 0 when moving
  parkedAt: Leg | null
  wait: number // seconds sat still while wanting to go
  plan: (number | { at: 'curb' | 'bay'; kind: TripKind | 'visit' })[] // upcoming exits for a trip, then what to do on arrival
  trip: { stop: Stop; kind: TripKind | 'visit' } | null
  nextVisit: number
  tow: 0 | 1 | 2 | 3 // none, waiting for room, towing, unhooking
  truck: number // 0..1 how much of the tow truck is showing
  towT: number // seconds on the hook
  ot: null | { target: string; start: number; merge: number }
  approach: null | { dist: number; chain: Leg[] } // junction tiles it is waiting to cross, nose distance to the first
  arrived: number | null // when it pulled up asking to cross, for first come first served
  halt: number | null // when it came to a stop at a stop sign
  boxes: Box[] // the body, as short boxes laid along its path this frame
  claim: Box[] // lane an overtaking car has claimed ahead of it
  rerouteAt: number
  pend: null | { target: string; need: number } // waiting to overtake: asks oncoming cars to hold back
  gapTo: string | null // whatever it is following
  gap: number
  queuedAt: number // last time it was held waiting its turn at a forecourt
  show: number // 0..1 faded in, for arriving and the rare car that has to give up
  leaving: boolean
  pull: number | null // broken down on the verge: odometer reading where it pulled over
}

const ACCEL = 1.6
const BRAKE = 3.2
const GAP = 0.22 // bumper to bumper when queued
const PARKED_GAP = 1.0 // room left behind a parked car to pull round it
const TURN_V = 1.15
const UTURN_V = 0.7
const LOT_V = 1.0
const SWING = 1.0 // distance over which an overtaking car changes lane
const TRUCK = { len: 1.0, gap: 0.1 } // the tow truck at its town size (TownCars townScale)
const TOW_MAX = 120 // seconds a car can be on the hook before it gives up and respawns
const PASS_V = 1.5
// Our directions (east, west, south, north) as walkGraph's crosswalk sides (south, east, north, west).
const SIDE = [1, 3, 0, 2]
const STOP_LINE = 0.6 // how far short of an intersection cars wait
const PULL = 1.04 // how far a broken-down car pulls over onto the verge, clear of its lane and the sidewalk
const PULL_RAMP = 1.4 // distance over which it eases off the road (and back on)
const PULL_FLAT = 0.9 // either side of the spot, where it is all the way over
const STALL_REACH = 4 // how far up the road a broken-down car looks for somewhere to pull over
const JAMMED = 45 // seconds stuck before a car gives up
// Traffic lights that answer to who's waiting. A green lasts at least MIN_GREEN,
// changes early once its road goes quiet and someone waits across it, and at
// most MAX_GREEN while cross traffic waits. With nobody waiting across, it stays.
const MIN_GREEN = 4
const MAX_GREEN = 12
const SENSE = 7 // how far up the road the lights notice a car coming
const REST_GREEN = 40 // change anyway now and then, in case someone wasn't noticed

// A short oriented box: centre, heading, half length and half width.
export type Box = { x: number; z: number; ux: number; uz: number; hl: number; hw: number }

export function overlap(a: Box, b: Box) {
  const dx = b.x - a.x, dz = b.z - a.z
  if (Math.abs(dx) + Math.abs(dz) > (a.hl + a.hw + b.hl + b.hw) * 1.5) return false
  // The four candidate separating axes, without allocating (this runs thousands of times a frame).
  return !(apart(a, b, dx, dz, a.ux, a.uz) || apart(a, b, dx, dz, -a.uz, a.ux) || apart(a, b, dx, dz, b.ux, b.uz) || apart(a, b, dx, dz, -b.uz, b.ux))
}

function apart(a: Box, b: Box, dx: number, dz: number, nx: number, nz: number) {
  const ra = a.hl * Math.abs(a.ux * nx + a.uz * nz) + a.hw * Math.abs(-a.uz * nx + a.ux * nz)
  const rb = b.hl * Math.abs(b.ux * nx + b.uz * nz) + b.hw * Math.abs(-b.uz * nx + b.ux * nz)
  return Math.abs(dx * nx + dz * nz) > ra + rb
}

// A steady small number for a car, so it picks the same trailer every time.
const hashOf = (uid: string) => {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return h
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

let rand = Math.random
export function seedRandom(seed: number) {
  let s = seed >>> 0
  rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export class Traffic {
  net: Net = buildNet([], [], () => 0)
  agents = new Map<string, Agent>()
  t = 0
  respawns = 0 // cars that sat jammed so long they faded out and came back elsewhere
  // People on each zebra crossing, keyed "x,z:side" (the road tile it's painted
  // on and the side facing the intersection, in walkGraph SIDES order).
  walkers: ReadonlyMap<string, number> = new Map()
  // The business each driver works for (car uid -> building uid): it drops in there most.
  homes: ReadonlyMap<string, string> = new Map()
  private specs = new Map<string, CarSpec>()
  private trips = new Map<string, TripKind>()
  private visits = new Map<string, string>()
  private low = new Set<string>()
  private ways = new Map<string, { outs: number[]; to: string; heading: number }[]>()
  private limp = new Map<string, number>() // broken-down cars still looking for a spot, by odometer at breakdown
  // Each set of lights: which road has right of way (0 east-west, 1 north-south),
  // where it is in its change, and for how long.
  private sigs = new Map<number, { axis: number; phase: 'green' | 'yellow' | 'clear'; t: number; clear: number }>()
  private walkWait = new Map<string, number>() // "cluster:axis" -> last time someone on foot waited to cross that road

  setTown(roads: string[], buildings: Building[], turnOf: TurnOf) {
    const was = new Map<string, { axis: number; phase: 'green' | 'yellow' | 'clear'; t: number; clear: number }>()
    for (const [id, g] of this.sigs) {
      const c = this.net.layout.clusters[id]
      if (c) was.set(c.tiles[0], g)
    }
    this.net = buildNet(roads, buildings, turnOf)
    // Lights that are still there keep going as they were.
    this.sigs = new Map()
    this.walkWait = new Map()
    for (const c of this.net.layout.clusters) {
      if (!c.signal) continue
      const g = was.get(c.tiles[0])
      this.sigs.set(c.id, g ? { ...g, clear: c.clear } : { axis: Math.round(c.offset) % 2, phase: 'green', t: 0, clear: c.clear })
    }
    this.ways = new Map()
    // Keep cars where they are when their road still exists; replan what comes next.
    for (const a of [...this.agents.values()]) {
      const leg = a.legs[a.ci]
      // Turning in to (or on) a forecourt: keep its way through and back out onto the road.
      const inLot = !leg.node || (a.ci + 1 < a.legs.length && !a.legs[a.ci + 1].node)
      const keep = inLot ? this.lotEnd(a, a.ci + (leg.node ? 1 : 0)) : a.ci
      const still = keep < a.legs.length && this.legValid(a.legs[keep]) && (!leg.node || this.legValid(leg))
      // A paid-for trip (gas, tires, a tow) still has to happen, by the new roads.
      if (a.trip && a.trip.kind !== 'visit' && !this.trips.has(a.uid)) this.trips.set(a.uid, a.trip.kind)
      if (!still) {
        // Can't stay where it is: it comes back somewhere on the new roads.
        this.agents.delete(a.uid)
        continue
      }
      for (const l of a.legs) l.granted = false
      if (leg.node) leg.granted = this.held(leg)
      a.trip = null
      a.plan = []
      a.ot = null
      a.pend = null
      a.approach = null
      a.arrived = null
      a.halt = null
      a.gapTo = null
      a.parked = 0
      a.parkedAt = null
      this.truncate(a, keep)
      for (const l of a.legs) if (l.stopKind && l.stopKind !== 'stall') this.clearStop(l)
      if (!a.legs.some((l) => l.stopKind === 'stall')) a.pull = null
      if (leg.node && leg.granted) this.net.nodes.get(leg.node)!.occ.set(a.uid, { inDir: leg.inDir, outDir: leg.outDir })
    }
    this.syncCars()
  }

  // The cars that should be on the road; stalled ones first so they are always shown.
  setCars(cars: CarSpec[], max: number) {
    this.specs = new Map()
    const sorted = [...cars].sort((a, b) => Number(b.stalled) - Number(a.stalled))
    for (const c of sorted.slice(0, max)) this.specs.set(c.uid, c)
    this.low = new Set(cars.filter((c) => c.low).map((c) => c.uid))
    this.syncCars()
  }

  requestTrip(uid: string, kind: TripKind) {
    this.trips.set(uid, kind)
  }

  // Drive to one business (by building uid), e.g. a driver starting its shift.
  requestVisit(uid: string, building: string) {
    this.visits.set(uid, building)
  }

  private syncCars() {
    for (const [uid, a] of [...this.agents]) {
      if (this.specs.has(uid)) continue
      // A visitor leaving town fades out where it is (step() removes it); anything else just goes.
      if (uid.startsWith('visitor:') && a.show > 0) a.leaving = true
      else this.remove(a)
    }
    for (const spec of this.specs.values()) {
      const a = this.agents.get(spec.uid)
      if (a) {
        a.len = spec.len
        a.wid = spec.wid
        a.cruise = spec.cruise
        if (a.stalled !== spec.stalled) this.setStalled(a, spec.stalled)
      } else {
        this.spawn(spec)
      }
    }
  }

  private remove(a: Agent) {
    for (const n of this.net.nodes.values()) n.occ.delete(a.uid)
    this.agents.delete(a.uid)
    this.limp.delete(a.uid)
  }

  private legValid(l: Leg) {
    const n = l.node && this.net.nodes.get(l.node)
    if (!n) return false
    const back = opp(l.inDir)
    return (n.arms[back] || n.lots[back]) && (n.drive[l.outDir] || n.lots[l.outDir]) && !(l.outDir === back && n.degree > 1)
  }

  // Index of the first road leg at or after the current one (or `from`).
  private lotEnd(a: Agent, from = a.ci) {
    let i = from
    while (i < a.legs.length && !a.legs[i].node) i++
    return i
  }

  private makeLeg(node: Node, inDir: number, outDir: number): Leg {
    return {
      c: roadCurve(this.net, node.x, node.z, inDir, outDir),
      node: node.key, inDir, outDir,
      junction: node.junction,
      turn: inDir === outDir ? 0 : outDir === opp(inDir) ? 2 : 1,
      granted: false,
    }
  }

  // Lanes with a broken-down car in them, to steer round when choosing a way.
  private stalledLanes() {
    const out = new Set<string>()
    for (const a of this.agents.values()) {
      const l = a.parkedAt
      if (a.stalled && a.pull === null && l?.node) out.add(`${l.node}|${l.inDir}`)
    }
    return out
  }

  private spawn(spec: CarSpec) {
    const nodes = [...this.net.nodes.values()].filter((n) => !n.junction && n.degree > 1)
    if (!nodes.length) return
    const start = Math.floor(rand() * nodes.length)
    // Already broken down (a reload, say): it appears pulled over on a straight,
    // on the verge if there's one, well apart from the others, rather than driving.
    const spots = spec.stalled ? this.stallSpots(null) : []
    // Plain road for `k` tiles either side, so others get round it clear of any junction.
    const run = (n: Node, d: number, k: number) => [1, -1].every((sd) => Array.from({ length: k }, (_, m) => m + 1).every((m) => {
      const b = this.net.nodes.get(tkey(n.x + D[d][0] * m * sd, n.z + D[d][1] * m * sd))
      return !!b && !b.junction
    }))
    const spot = (n: Node, d: number, k = 2) => exits(n, d).includes(d) && !n.spur && run(n, d, k) && !this.nearStall(n.key, spots)
    const verge = (n: Node, d: number) => this.net.verge.has(tkey(n.x - D[d][1], n.z + D[d][0]))
    const pass = spec.stalled ? [(n: Node, d: number) => spot(n, d, 1) && verge(n, d), spot, () => true] : [() => true]
    for (let i = 0; i < nodes.length * 2 * pass.length; i++) {
      const ok = pass[Math.floor(i / (nodes.length * 2))]
      const n = nodes[(start + ((i % (nodes.length * 2)) >> 1)) % nodes.length]
      const ins = [0, 1, 2, 3].filter((d) => n.arms[opp(d)] && exits(n, d).length && (n.oneWay < 0 || n.oneWay === d) && ok(n, d))
      if (!ins.length) continue
      const inDir = ins[(i + (start & 1)) % ins.length]
      const outs = exits(n, inDir)
      const stop = spec.stalled && (spot(n, inDir) || (spot(n, inDir, 1) && verge(n, inDir)))
      const leg = this.makeLeg(n, inDir, stop ? inDir : outs[Math.floor(rand() * outs.length)])
      const p = pointAt(leg.c, leg.c.len / 2)
      const clear = [...this.agents.values()].every((o) => Math.hypot(o.x - p[0], o.z - p[1]) > 1.9)
      if (!clear) continue
      const a: Agent = {
        uid: spec.uid, len: spec.len, wid: spec.wid, cruise: spec.cruise,
        legs: [leg], ci: 0, s: leg.c.len / 2, v: 0, odo: 0,
        x: p[0], z: p[1], yaw: 0, hx: 0, hz: 1,
        stalled: false, parked: 0, parkedAt: null, wait: 0,
        plan: [], trip: null, nextVisit: 10 + rand() * 40,
        tow: 0, truck: 0, towT: 0, ot: null, rerouteAt: 0, pend: null, approach: null, arrived: null, halt: null, boxes: [], claim: [], gapTo: null, gap: Infinity,
        show: 0, leaving: false, queuedAt: -1, pull: null,
      }
      this.agents.set(a.uid, a)
      if (stop) {
        a.stalled = true
        leg.stopS = a.s
        leg.stopFor = Infinity
        leg.stopKind = 'stall'
        a.parked = Infinity
        a.parkedAt = leg
        if (verge(n, inDir) && spot(n, inDir, 1)) a.pull = a.odo
      }
      this.extend(a)
      this.pose(a)
      if (spec.stalled && !stop) this.setStalled(a, true)
      return
    }
  }

  private setStalled(a: Agent, on: boolean) {
    a.stalled = on
    if (on) {
      a.trip = null
      a.plan = []
      return
    }
    // Fixed: drop any breakdown stop still ahead and drive off once clear.
    if (a.parked > 0 && a.parkedAt?.stopKind === 'stall') a.parked = 0.6
    // Fixed before it got to the verge: stay on the road.
    else a.pull = null
    for (const l of a.legs) if (l.stopKind === 'stall') this.clearStop(l)
  }

  private clearStop(l: Leg) {
    l.stopS = undefined
    l.stopFor = undefined
    l.stopKind = undefined
  }

  // Drop planned legs after index `keep`, giving back any junction turns they held.
  private truncate(a: Agent, keep: number) {
    for (const l of a.legs.splice(keep + 1)) {
      if (l.granted && l.node && !a.legs.some((m) => m.granted && m.node === l.node)) this.net.nodes.get(l.node)?.occ.delete(a.uid)
    }
  }

  // Keep a few legs planned ahead of the car, and always plan right through a
  // cluster of junction tiles so it never has to stop in the middle of one.
  private extend(a: Agent, also?: Set<string>) {
    let avoid: Set<string> | null = null
    const more = () => {
      const n = a.legs.length - a.ci
      const want = a.stalled && !a.legs.some((l) => l.stopKind === 'stall') ? 12 : 5
      return n < want || (a.legs[a.legs.length - 1].junction && n < 14)
    }
    while (more()) {
      const last = a.legs[a.legs.length - 1]
      const from = last.node ? this.net.nodes.get(last.node) : null
      const node = from && this.net.nodes.get(tkey(from.x + D[last.outDir][0], from.z + D[last.outDir][1]))
      if (!node) return
      avoid ??= new Set([...this.stalledLanes(), ...(also ?? [])])
      const inDir = last.outDir
      const next = a.plan.shift()
      if (typeof next === 'object' && next.at === 'curb') {
        const leg = this.makeLeg(node, inDir, inDir)
        leg.stopS = leg.c.len / 2
        leg.stopKind = next.kind === 'tow' ? 'tow' : 'curb'
        // Home at the trailer park: it parks out front for a good while.
        leg.stopFor = next.kind === 'visit' ? (a.trip?.stop.def === 'trailer' ? 12 + rand() * 10 : 3 + rand() * 3) : next.kind === 'tow' ? 2.5 : 4
        a.legs.push(leg)
        continue
      }
      const bay = typeof next === 'object' && next.at === 'bay' ? a.trip?.stop.bay : null
      if (bay) {
        a.legs.push(this.makeLeg(node, inDir, bay.lotDir))
        bay.legs.forEach((c, i) => {
          const leg: Leg = { c, node: null, inDir: -1, outDir: -1, junction: false, turn: i === bay.stopLeg ? 0 : 1, granted: false, lot: node.key }
          if (i === bay.stopLeg) {
            leg.stopS = c.len / 2
            leg.stopFor = 3.5
            leg.stopKind = 'pump'
          }
          a.legs.push(leg)
        })
        const ex = this.net.nodes.get(bay.exit)!
        const inEx = opp(bay.lotDir)
        a.legs.push(this.makeLeg(ex, inEx, this.choose(ex, inEx, avoid)))
        continue
      }
      if (typeof next === 'number' && node.drive[next]) {
        a.legs.push(this.makeLeg(node, inDir, next))
        continue
      }
      if (node.cluster >= 0) {
        // Into an intersection: pick a way out and take the shortest path across.
        let at = node, h = inDir
        for (const o of this.crossing(node, inDir, avoid)) {
          a.legs.push(this.makeLeg(at, h, o))
          const n = this.net.nodes.get(tkey(at.x + D[o][0], at.z + D[o][1]))
          if (!n) break
          at = n
          h = o
        }
        continue
      }
      const recent = new Set(a.legs.slice(a.ci).map((l) => l.node ?? ''))
      a.legs.push(this.makeLeg(node, inDir, this.choose(node, inDir, avoid, recent)))
    }
  }

  // Ways across the intersection entered at `node` heading `inDir`: the turns to
  // make on each of its tiles, ending with the one that leaves it.
  private crossing(node: Node, inDir: number, avoid: Set<string>) {
    const key = `${node.key}|${inDir}`
    let ways = this.ways.get(key)
    if (!ways) {
      ways = []
      const seen = new Set([key])
      const queue: { n: Node; h: number; outs: number[] }[] = [{ n: node, h: inDir, outs: [] }]
      while (queue.length) {
        const { n, h, outs } = queue.shift()!
        for (const o of exits(n, h)) {
          const m = this.net.nodes.get(tkey(n.x + D[o][0], n.z + D[o][1]))
          if (!m) continue
          const path = [...outs, o]
          if (m.cluster === node.cluster) {
            const mk = `${m.key}|${o}`
            if (seen.has(mk)) continue
            seen.add(mk)
            queue.push({ n: m, h: o, outs: path })
          } else {
            ways.push({ outs: path, to: `${m.key}|${o}`, heading: o })
          }
        }
      }
      this.ways.set(key, ways)
    }
    if (!ways.length) return exits(node, inDir).slice(0, 1)
    const weights = ways.map((w) =>
      (w.heading === inDir ? 2.5 : w.heading === opp(inDir) ? 0.05 : 1) * (avoid.has(w.to) ? 0.02 : 1) / w.outs.length ** 2)
    let r = rand() * weights.reduce((p, q) => p + q, 0)
    for (let i = 0; i < ways.length; i++) {
      r -= weights[i]
      if (r <= 0) return ways[i].outs
    }
    return ways[ways.length - 1].outs
  }

  // Wander: prefer carrying straight on, and keep out of lanes blocked by a breakdown.
  // Inside a block of junction tiles (a wide road or plaza), head for the way out
  // rather than wandering round it.
  private choose(node: Node, inDir: number, avoid: Set<string>, recent?: Set<string>) {
    const outs = exits(node, inDir)
    if (outs.length === 1) return outs[0]
    const weights = outs.map((o) => {
      const k = tkey(node.x + D[o][0], node.z + D[o][1])
      const next = this.net.nodes.get(k)
      const deep = next?.junction ? 0.3 ** next.depth : 1
      return (o === inDir ? 2.5 : 1) * deep * (avoid.has(`${k}|${o}`) ? 0.02 : 1) * (recent?.has(k) ? 0.05 : 1)
    })
    let r = rand() * weights.reduce((p, q) => p + q, 0)
    for (let i = 0; i < outs.length; i++) {
      r -= weights[i]
      if (r <= 0) return outs[i]
    }
    return outs[outs.length - 1]
  }

  // Head for a stop. Keeps the legs the car is already committed to.
  private startTrip(a: Agent, stop: Stop, kind: TripKind | 'visit') {
    let keep = Math.min(a.ci + 1, a.legs.length - 1)
    while (keep < a.legs.length - 1 && (!a.legs[keep].node || a.legs[keep].granted)) keep++
    const last = a.legs[keep]
    if (!last.node) return false
    const n = this.net.nodes.get(last.node)!
    const nk = tkey(n.x + D[last.outDir][0], n.z + D[last.outDir][1])
    if (!this.net.nodes.has(nk)) return false
    const stalls = this.stalledLanes()
    const outs = route(this.net, nk, last.outDir, stop.tile, stop.heading, stalls, stalls)
    if (!outs) return false
    this.truncate(a, keep)
    for (let i = a.ci + 1; i < a.legs.length; i++) {
      const l = a.legs[i]
      if (l.stopKind === 'curb' || l.stopKind === 'pump') this.clearStop(l)
    }
    a.trip = { stop, kind }
    a.plan = [...outs, { at: stop.bay ? 'bay' : 'curb', kind }]
    this.extend(a)
    return true
  }

  private stopFor(kind: TripKind) {
    const stops = this.net.stops
    if (kind === 'gas') return stops.find((s) => s.def === 'gas')
    if (kind === 'tires') return stops.find((s) => s.def === 'tires')
    return stops.find((s) => s.def === 'rescue') ?? stops.find((s) => s.def === 'tires')
  }

  // Distance along the car's planned path to a point `d` ahead (negative: behind),
  // including any sideways swing while overtaking.
  sample(a: Agent, d: number): { p: V2; h: V2 } | null {
    const q = this.at(a, d)
    return q && { p: [q.p[0], q.p[1]], h: [q.h[0], q.h[1]] }
  }

  // Scratch pose that at() fills in; only valid until the next call.
  private q = { p: [0, 0] as V2, h: [0, 0] as V2 }

  // Same as sample(), but into the shared scratch pose, so hot loops don't allocate.
  private at(a: Agent, d: number): { p: V2; h: V2 } | null {
    let i = a.ci
    let s = a.s + d
    while (s < 0 && i > 0) {
      i--
      s += a.legs[i].c.len
    }
    while (s > a.legs[i].c.len && i < a.legs.length - 1) {
      s -= a.legs[i].c.len
      i++
    }
    if (s > a.legs[i].c.len + 0.01) return null
    const q = this.q
    const p = q.p, h = q.h
    poseAt(a.legs[i].c, s, p, h)
    const off = this.swing(a, a.odo + d)
    if (!off) return q
    const rx = -h[1], rz = h[0]
    const slope = (this.swing(a, a.odo + d + 0.05) - this.swing(a, a.odo + d - 0.05)) / 0.1
    const hx = h[0] + rx * slope, hz = h[1] + rz * slope
    const l = Math.hypot(hx, hz)
    p[0] += rx * off
    p[1] += rz * off
    h[0] = hx / l
    h[1] = hz / l
    return q
  }

  // Sideways offset while overtaking: out into the other lane, past, and back.
  private swing(a: Agent, o: number) {
    let off = 0
    // Pulled over onto the verge: ease off the road up to the spot, and back on after.
    if (a.pull !== null) {
      // All the way over along the whole car, then a gentle ramp either side.
      const d = Math.abs(o - a.pull) - PULL_FLAT
      off += PULL * (1 - smooth(d / PULL_RAMP))
    }
    const ot = a.ot
    if (!ot) return off
    const full = -2 * LANE
    if (o < ot.start) return off
    if (o < ot.merge) return off + full * smooth((o - ot.start) / SWING)
    return off + full * (1 - smooth((o - ot.merge) / SWING))
  }

  private front(a: Agent) {
    return a.len / 2 + (a.tow >= 2 ? TRUCK.gap + TRUCK.len : 0) * a.truck
  }

  private pose(a: Agent) {
    const q = this.at(a, 0)
    if (!q) return
    a.x = q.p[0]
    a.z = q.p[1]
    a.hx = q.h[0]
    a.hz = q.h[1]
    a.yaw = Math.atan2(q.h[0], q.h[1])
  }

  // Front wheel angle for a car with axles `base` apart, from how sharply its path bends here.
  steerOf(a: Agent, base: number) {
    const f = this.at(a, 0.3)
    if (!f) return 0
    const ahead = Math.atan2(f.h[0], f.h[1])
    const b = this.at(a, -0.3)
    if (!b) return 0
    let d = ahead - Math.atan2(b.h[0], b.h[1])
    d = Math.atan2(Math.sin(d), Math.cos(d))
    return Math.max(-0.55, Math.min(0.55, Math.atan((base * d) / 0.6)))
  }

  // Where the tow truck sits: on the path just ahead of the towed car.
  truckPose(a: Agent) {
    if (!a.tow || a.tow === 1) return null
    const q = this.at(a, a.len / 2 + TRUCK.gap + TRUCK.len / 2)
    if (!q) return null
    return { x: q.p[0], z: q.p[1], yaw: Math.atan2(q.h[0], q.h[1]), scale: a.truck }
  }

  // Box covering the stretch of the car's path from d0 to d1 (relative to its centre).
  private slab(a: Agent, d0: number, d1: number, hw = a.wid / 2): Box | null {
    return this.slabInto({ x: 0, z: 0, ux: 0, uz: 0, hl: 0, hw: 0 }, a, d0, d1, hw)
  }

  private slabInto(out: Box, a: Agent, d0: number, d1: number, hw = a.wid / 2): Box | null {
    const q = this.at(a, (d0 + d1) / 2)
    if (!q) return null
    out.x = q.p[0]
    out.z = q.p[1]
    out.ux = q.h[0]
    out.uz = q.h[1]
    out.hl = (d1 - d0) / 2 + 0.02
    out.hw = hw
    return out
  }

  private outline(a: Agent) {
    const back = a.len / 2
    const fr = this.front(a)
    const n = Math.max(2, Math.ceil((back + fr) / 0.35))
    const step = (back + fr) / n
    // Reuses last frame's boxes rather than allocating new ones.
    const boxes = a.boxes
    let k = 0
    for (let i = 0; i < n; i++) {
      const b = this.slabInto(boxes[k] ?? { x: 0, z: 0, ux: 0, uz: 0, hl: 0, hw: 0 }, a, -back + step * i, -back + step * (i + 1))
      if (b) boxes[k++] = b
    }
    boxes.length = k
    a.claim = []
    if (a.pend) {
      // The oncoming lane it needs to get past.
      for (let d = fr; d < a.pend.need + 1.5; d += 0.4) {
        const q = this.at(a, d + 0.2)
        if (!q) break
        const r = right(q.h)
        a.claim.push({ x: q.p[0] - r[0] * 2 * LANE, z: q.p[1] - r[1] * 2 * LANE, ux: q.h[0], uz: q.h[1], hl: 0.22, hw: a.wid / 2 })
      }
    }
    if (a.ot) {
      const end = a.ot.merge + SWING - a.odo + a.len / 2
      for (let d = fr; d < end; d += 0.4) {
        const b = this.slab(a, d, d + 0.4)
        if (b) a.claim.push(b)
      }
    }
  }

  // Someone other than `uid` turning round on a tile, swinging into the lane heading `inDir`.
  private turningRound(occ: Map<string, { inDir: number; outDir: number }>, uid: string, inDir: number) {
    for (const [u, m] of occ) if (u !== uid && m.inDir === opp(m.outDir) && m.outDir === inDir) return true
    return false
  }

  // Reused by scan() every frame.
  private probe: Box = { x: 0, z: 0, ux: 0, uz: 0, hl: 0, hw: 0 }
  private inside: boolean[] = []
  private near: Agent[] = []

  // First thing in the way within `look` of the car's nose, as [distance, car].
  private scan(a: Agent, look: number, others: Agent[]): [number, Agent] | null {
    const fr = this.front(a)
    // Already in someone's claimed stretch: carry on out of it rather than stop inside.
    const inside = this.inside
    inside.length = 0
    for (const o of others) inside.push(!!o.pend && o.claim.some((c) => a.boxes.some((b) => overlap(b, c))))
    const probe = this.probe
    for (let d = 0; d <= look; d += 0.15) {
      if (!this.slabInto(probe, a, fr + d - 0.15, fr + d)) return null
      for (let k = 0; k < others.length; k++) {
        const o = others[k]
        if (a.ot && o.uid === a.ot.target) continue
        // An oncoming overtaker also claims the lane it needs to get back in.
        const opposite = a.hx * o.hx + a.hz * o.hz < -0.5
        for (const b of o.boxes) if (overlap(probe, b)) return [d, o]
        if (opposite && (o.ot || (o.pend && !inside[k]))) for (const b of o.claim) if (overlap(probe, b)) return [d, o]
      }
    }
    return null
  }

  step(rawDt: number) {
    const dt = Math.min(rawDt, 0.1)
    this.t += dt
    const agents = [...this.agents.values()]
    for (const a of agents) this.outline(a)

    this.runLights(dt)
    for (const a of agents) this.think(a, dt)
    for (const a of agents) this.drive(a, dt)
    for (const a of agents) {
      // Last resort for a hopeless jam: fade out and pop up somewhere quieter.
      if (!a.leaving && !a.parked && !a.stalled && !a.tow && a.wait > JAMMED && !this.queuing(a)) a.leaving = true
      a.show = a.leaving ? Math.max(0, a.show - dt * 2) : Math.min(1, a.show + dt * 2)
      if (a.leaving && !a.show) {
        const spec = this.specs.get(a.uid)
        if (a.trip && a.trip.kind !== 'visit' && !this.trips.has(a.uid)) this.trips.set(a.uid, a.trip.kind)
        this.remove(a)
        this.respawns++
        if (spec) this.spawn(spec)
      }
    }
    // Now and then: bring back any car that found nowhere clear to appear, and
    // forget requests for cars that aren't out any more.
    if (Math.floor(this.t) !== Math.floor(this.t - dt)) {
      for (const spec of this.specs.values()) if (!this.agents.has(spec.uid)) this.spawn(spec)
      for (const uid of [...this.trips.keys()]) if (!this.specs.has(uid)) this.trips.delete(uid)
      for (const uid of [...this.visits.keys()]) if (!this.specs.has(uid)) this.visits.delete(uid)
    }
  }

  private think(a: Agent, dt: number) {
    // A service trip was just paid for.
    const trip = this.trips.get(a.uid)
    if (trip && !a.parked) {
      const stop = this.stopFor(trip)
      // (No Rusty's or tire shop to take it to: no truck.)
      if (trip === 'tow' && stop && !a.tow) {
        a.tow = 1
        a.truck = 0
      }
      // Can't plan a way there from here yet (mid-junction, say): try again next frame.
      if (!stop || this.startTrip(a, stop, trip)) this.trips.delete(a.uid)
    }
    const visit = this.visits.get(a.uid)
    if (visit && !a.parked && !a.stalled && !a.trip && !a.tow) {
      const stop = this.net.stops.find((s) => s.uid === visit)
      if (!stop || this.startTrip(a, stop, 'visit')) this.visits.delete(a.uid)
    }
    // Lost the way to its stop (the plan there got dropped): plan it again.
    if (a.trip && !a.parked && !a.plan.length && !a.legs.slice(a.ci).some((l) => l.stopKind) && !this.trips.has(a.uid)) {
      if (a.trip.kind === 'visit') a.trip = null
      else this.trips.set(a.uid, a.trip.kind)
    }
    if (a.tow === 1 && this.roomAhead(a, a.len / 2 + TRUCK.gap + TRUCK.len + 0.1) && (a.pull === null || this.laneClear(a))) a.tow = 2
    // Nowhere left to tow it to (the town changed under it): unhook.
    if (a.tow && a.tow !== 3 && !a.trip && !this.trips.has(a.uid) && !a.parked) a.tow = 3
    if (a.tow === 2) a.truck = Math.min(1, a.truck + dt * 2.5)
    // Last resort: a tow that still hasn't reached Rusty's fades out and comes back unhitched.
    a.towT = a.tow ? a.towT + dt : 0
    if (a.towT > TOW_MAX && !a.parked && !a.leaving) {
      a.trip = null
      a.plan = []
      a.leaving = true
    }
    if (a.tow === 3) {
      a.truck = Math.max(0, a.truck - dt * 2)
      if (!a.truck) a.tow = 0
    }

    // Broken down: pull over on the next straight stretch and wait to be fixed.
    // Someone else broke down right where it meant to pull over: find another spot.
    if (a.stalled && !a.parked) {
      const mine = a.legs.find((l) => l.stopKind === 'stall')
      if (mine && this.nearStall(mine.node, this.stallSpots(a, true))) this.clearStop(mine)
    }
    if (a.stalled && !a.legs.some((l) => l.stopKind === 'stall')) this.planStall(a)

    // Now and then, drop in at a business.
    if (!a.stalled && !a.trip && !a.tow && this.net.stops.length) {
      a.nextVisit -= dt
      if (a.nextVisit <= 0) {
        a.nextVisit = 25 + rand() * 45
        const busy = new Set([...this.agents.values()].map((o) => o.trip?.stop.uid))
        // Only the town's low-PI cars live at the trailer homes; nobody else pulls up there.
        const low = this.low.has(a.uid)
        const free = this.net.stops.filter((s) => !busy.has(s.uid) && (low || s.def !== 'trailer'))
        const home = free.find((s) => s.uid === this.homes.get(a.uid))
        const pads = low ? this.net.stops.filter((s) => s.def === 'trailer') : []
        // Each beater has its own trailer it keeps coming back to, or any free one.
        const mine = pads.length ? pads[hashOf(a.uid) % pads.length] : null
        const pad = mine && !busy.has(mine.uid) ? mine : free.find((s) => s.def === 'trailer')
        const fav = this.specs.get(a.uid)?.favors
        const liked = fav ? free.filter((s) => fav.includes(s.def)) : []
        if (home && rand() < 0.6) this.startTrip(a, home, 'visit')
        else if (pad && rand() < 0.8) this.startTrip(a, pad, 'visit')
        else if (liked.length && rand() < 0.7) this.startTrip(a, liked[Math.floor(rand() * liked.length)], 'visit')
        else if (free.length) this.startTrip(a, free[Math.floor(rand() * free.length)], 'visit')
      }
    }
    this.extend(a)
  }

  // Tiles where other broken-down cars have stopped (`parkedOnly`) or mean to.
  private stallSpots(a: Agent | null, parkedOnly = false) {
    const out: string[] = []
    for (const o of this.agents.values()) {
      if (o === a || !o.stalled) continue
      if (parkedOnly) {
        if (o.parked && o.parkedAt?.node) out.push(o.parkedAt.node)
      } else for (const l of o.legs) if (l.stopKind === 'stall' && l.node) out.push(l.node)
    }
    return out
  }

  private nearStall(tile: string | null, spots: string[]) {
    if (!tile) return false
    const [x, z] = tile.split(',').map(Number)
    return spots.some((k) => {
      const [sx, sz] = k.split(',').map(Number)
      return Math.abs(sx - x) + Math.abs(sz - z) <= 2
    })
  }

  private planStall(a: Agent) {
    const good = (i: number) => {
      const l = a.legs[i]
      if (!l.node || l.junction || l.turn) return false
      const prev = a.legs[i - 1]
      const next = a.legs[i + 1]
      // Ideally with straight road either side so others can pull round it.
      return !!prev && !!next && !prev.junction && !prev.turn && !next.junction && !next.turn && !!prev.node && !!next.node
    }
    const fallback = (i: number) => {
      const l = a.legs[i]
      return !!l.node && !l.junction && !l.turn
    }
    // Not down a dead end, where everyone would have to squeeze past it twice.
    const open = (i: number) => !this.net.nodes.get(a.legs[i].node ?? '')?.spur
    // Enough plain road past it for a car to pull out, get by and back in before
    // the next junction (two more tiles), so it never bottles up a street.
    // The queue that forms behind it while it's passed mustn't reach back into a junction either.
    const roomy = (i: number) => {
      const ahead = [i + 1, i + 2].every((j) => {
        const l = a.legs[j]
        return !!l?.node && !l.junction && l.turn !== 2 && !l.stopKind
      })
      const n = this.net.nodes.get(a.legs[i].node ?? '')
      if (!ahead || !n) return false
      const [bx, bz] = D[opp(a.legs[i].inDir)]
      return [1, 2].every((m) => {
        const b = this.net.nodes.get(tkey(n.x + bx * m, n.z + bz * m))
        return !!b && !b.junction
      })
    }
    // How far it has limped since it broke down.
    const since = a.odo - (this.limp.get(a.uid) ?? (this.limp.set(a.uid, a.odo), a.odo))
    // Best of all: straight road with open ground beside it to pull right off onto.
    const verge = (i: number) => {
      const l = a.legs[i]
      const n = this.net.nodes.get(l.node ?? '')
      const prev = a.legs[i - 1]
      const next = a.legs[i + 1]
      if (!n || n.junction || l.turn || !prev?.node || !next?.node || prev.junction || next.junction) return false
      const [dx, dz] = D[l.inDir]
      return this.net.verge.has(tkey(n.x - dz, n.z + dx))
    }
    const tests = [
      verge,
      (i: number) => good(i) && open(i) && roomy(i),
      (i: number) => fallback(i) && open(i) && roomy(i),
      (i: number) => fallback(i) && roomy(i),
      good,
      fallback,
      // Still nowhere after limping a while: on a bend, if that's all there is.
      (i: number) => since > STALL_REACH && !!a.legs[i].node && !a.legs[i].junction && a.legs[i].turn !== 2,
    ]
    // Well clear of other broken-down cars (stopped or about to), so no stretch
    // needs two cars passed at once, and think() never has to move it on again.
    const spots = this.stallSpots(a)
    // It pulls over within a few tiles, taking the best spot in reach; if there's
    // nowhere at all (deep in a run of junctions) it takes the first spot past them.
    const reach = STALL_REACH + since
    for (const test of tests) {
      let to = -a.s
      for (let i = a.ci; i < a.legs.length - 1; i++) {
        const l = a.legs[i]
        const at = l.c.len / 2
        const dist = to + at
        to += l.c.len
        if (dist > reach) break
        if (i === a.ci && a.s + (a.v * a.v) / (2 * BRAKE) > at - 0.05) continue
        if (!test(i) || l.stopKind || this.nearStall(l.node, spots)) continue
        l.stopS = at
        l.stopFor = Infinity
        l.stopKind = 'stall'
        a.pull = test === verge ? a.odo + dist : null
        a.trip = null
        a.plan = []
        // Nothing past the stop: give back any junction it had a turn for.
        this.truncate(a, i)
        this.limp.delete(a.uid)
        return
      }
    }
  }

  // No one coming along the lane beside a car pulled over on the verge.
  private laneClear(a: Agent) {
    const [rx, rz] = right([a.hx, a.hz])
    const lx = a.x - rx * PULL, lz = a.z - rz * PULL
    for (const o of this.agents.values()) {
      if (o === a || o.hx * a.hx + o.hz * a.hz < 0.3) continue
      const dx = o.x - lx, dz = o.z - lz
      const along = dx * a.hx + dz * a.hz
      if (Math.abs(dx * a.hz - dz * a.hx) < 0.7 && along > -4 && along < 2) return false
    }
    return true
  }

  // Is the lane clear for `dist` ahead of the car's nose?
  private roomAhead(a: Agent, dist: number) {
    const box = this.slab(a, a.len / 2, dist, 0.45)
    if (!box || !this.sample(a, dist)) return false
    for (const o of this.agents.values()) {
      if (o !== a && o.boxes.some((b) => overlap(box, b))) return false
    }
    return true
  }

  // Can this car have the junction leg `leg`? `dist` is how far its nose is from the tile.
  // Legs a car needs the tile to itself (or a turn) for: junctions, and turning
  // round, which takes both lanes.
  private held(l: Leg) {
    return l.junction || (l.turn === 2 && !!l.node)
  }

  private canEnter(a: Agent, leg: Leg, dist: number, first: boolean, obey = true) {
    const node = this.net.nodes.get(leg.node!)!
    if (!node.junction) {
      // Turning round: one car at a time, and mid-road only with nothing coming.
      if ([...node.occ.keys()].some((u) => u !== a.uid)) return false
      // Turning round to pull into a busy forecourt: wait in lane rather than mid-turn.
      if (this.bayAhead(a, leg)) {
        a.queuedAt = this.t
        return false
      }
      return node.degree < 2 || this.clearToTurn(a, leg)
    }
    if (node.signal && obey) {
      const light = this.lightOf(node.cluster, leg.inDir)
      if (light === 'red') return false
      if (light === 'yellow' && (!first || dist > (a.v * a.v) / (2 * BRAKE) + 0.15)) return false
    }
    // One car at a time on a forecourt: wait on the road until it's free.
    if (node.lots[leg.outDir]) {
      const bay = this.net.stops.find((st) => st.bay && st.tile === node.key)?.bay
      if (bay && this.bayBusy(a, node.key, leg.outDir)) {
        a.queuedAt = this.t
        return false
      }
    }
    for (const [uid, m] of node.occ) {
      if (uid === a.uid || (m.inDir === leg.inDir && m.outDir !== opp(m.inDir) && leg.outDir !== opp(leg.inDir))) continue
      if (conflicts(leg.inDir, leg.outDir, m.inDir, m.outDir)) return false
    }
    // First come, first served among cars waiting to make crossing moves, so no
    // one waits forever and no two cars wait on each other.
    const mine = this.lane(node, leg)
    for (const y of this.agents.values()) {
      const ap = y.approach
      if (y === a || !ap) continue
      const w = ap.chain.find((c) => c.node === node.key)
      if (!w || w.inDir === leg.inDir || !conflicts(leg.inDir, leg.outDir, w.inDir, w.outDir)) continue
      // Not if they are queued behind someone, cannot get out the other side,
      // or are sat at a red light.
      if ((y.gapTo && y.gap < ap.dist) || !this.exitRoom(y, ap.chain[ap.chain.length - 1])) continue
      // (Its light is the one where it drives into the intersection, not this tile's.)
      if (node.signal && this.lightOf(node.cluster, ap.chain[0].inDir) !== 'green') continue
      if (y.arrived !== null && a.arrived !== null) {
        if (y.arrived < a.arrived || (y.arrived === a.arrived && y.uid < a.uid)) return false
      } else if (y.arrived === null && ap.dist < 2.6 && y.v > 0.5 && a.wait < 5 && this.lane(node, w) > mine) {
        // Don't pull out in front of someone coming along the main road.
        return false
      }
    }
    return true
  }

  // The light shown to traffic heading `heading` into intersection `cluster`.
  lightOf(cluster: number, heading: number): Light {
    const g = this.sigs.get(cluster)
    if (!g) return 'green'
    if ((heading < 2 ? 0 : 1) !== g.axis || g.phase === 'clear') return 'red'
    return g.phase
  }

  // Someone on foot is waiting to cross the road whose traffic heads `heading` into `cluster`.
  wantWalk(cluster: number, heading: number) {
    this.walkWait.set(`${cluster}:${heading < 2 ? 0 : 1}`, this.t)
  }

  private runLights(dt: number) {
    if (!this.sigs.size) return
    // Who's waiting at a red, and who's still coming up to each light.
    const waiting = new Set<string>()
    const coming = new Set<string>()
    for (const a of this.agents.values()) {
      if (a.parked || a.stalled) continue
      // The next junction along its way, if it's close (lights see cars coming
      // from a few tiles off, so they can be green by the time they get there).
      let d = a.legs[a.ci].c.len - a.s
      for (let i = a.ci + 1; i < a.legs.length && d < SENSE; i++) {
        const l = a.legs[i]
        if (l.granted || !l.junction) {
          d += l.c.len
          continue
        }
        const n = this.net.nodes.get(l.node!)!
        if (!n.signal) break
        const k = `${n.cluster}:${l.inDir < 2 ? 0 : 1}`
        if (a.v < 0.3 && d < 2) waiting.add(k)
        else coming.add(k)
        break
      }
    }
    for (const [id, g] of this.sigs) {
      g.t += dt
      if (g.phase === 'green') {
        const across = `${id}:${1 - g.axis}`
        const asked = waiting.has(across) || coming.has(across) || this.t - (this.walkWait.get(`${id}:${g.axis}`) ?? -99) < 1
        const mine = `${id}:${g.axis}`
        const busy = coming.has(mine) || waiting.has(mine)
        if ((asked && g.t >= MIN_GREEN && (!busy || g.t >= MAX_GREEN)) || (g.t >= REST_GREEN && !busy)) {
          g.phase = 'yellow'
          g.t = 0
        }
      } else if (g.phase === 'yellow' && g.t >= YELLOW) {
        g.phase = 'clear'
        g.t = 0
      } else if (g.phase === 'clear' && g.t >= g.clear) {
        g.phase = 'green'
        g.axis = 1 - g.axis
        g.t = 0
      }
    }
  }

  // Waiting its turn for the pumps, or queued behind a car that is: not a jam.
  private queuing(a: Agent) {
    let o: Agent | undefined = a
    for (let n = 0; o && n < 8; n++) {
      if (this.t - o.queuedAt < 0.5) return true
      o = o.gapTo ? this.agents.get(o.gapTo) : undefined
    }
    return false
  }

  // Is the forecourt this car turns into a couple of tiles after `leg` taken?
  private bayAhead(a: Agent, leg: Leg) {
    const i = a.legs.indexOf(leg)
    for (let j = i + 1; j >= 1 && j < a.legs.length && j <= i + 3; j++) {
      const l = a.legs[j]
      const n = l.node && this.net.nodes.get(l.node)
      if (!n || !n.lots[l.outDir]) continue
      const bay = this.net.stops.find((st) => st.bay && st.tile === n.key)?.bay
      return !!bay && this.bayBusy(a, n.key, l.outDir)
    }
    return false
  }

  private bayBusy(a: Agent, tile: string, lotDir: number) {
    for (const o of this.agents.values()) {
      if (o === a) continue
      // Turning in, or on the forecourt.
      for (let i = Math.max(0, o.ci - 1); i < o.legs.length; i++) {
        const l = o.legs[i]
        if (l.granted && l.node === tile && l.outDir === lotDir) return true
        // (Once its nose is back out on the road, the next car may start in behind it.)
        if (i === o.ci && !l.node && l.lot === tile) return true
      }
    }
    return false
  }

  private lane(node: Node, leg: Leg) {
    return priority(node, leg.inDir)
  }

  // Someone on the zebra crossing this car would drive over going into the
  // intersection (painted on the tile it comes from) or out of it (on the tile it leaves by).
  private zebraBusy(prev: Leg | undefined, chain: Leg[]) {
    if (!this.walkers.size) return false
    const first = chain[0]
    const last = chain[chain.length - 1]
    if (!first.junction) return false
    if (prev?.node && this.walkers.get(`${prev.node}:${SIDE[first.inDir]}`)) return true
    const n = this.net.nodes.get(last.node!)!
    const out = tkey(n.x + D[last.outDir][0], n.z + D[last.outDir][1])
    return !!this.walkers.get(`${out}:${SIDE[opp(last.outDir)]}`)
  }

  // Room to clear the junction: don't pull in if the lane beyond is backed up.
  // Don't block the box: when the road out is too short to hold the car before
  // the next junction, only go if that junction would let it through too. With
  // no lights there, take it now as well, so no one can cut in and lock it up.
  // Returns the junction turns to take along with this one, or null to wait.
  private beyond(a: Agent, from: number): Leg[] | null {
    let room = 0
    let j = from
    while (j < a.legs.length && !this.held(a.legs[j])) {
      if (a.legs[j].stopS !== undefined) return []
      room += a.legs[j].c.len
      j++
    }
    if (j >= a.legs.length || room > a.len + GAP + STOP_LINE + 0.2) return []
    const chain: Leg[] = []
    for (let k = j; k < a.legs.length && this.held(a.legs[k]) && !a.legs[k].granted; k++) chain.push(a.legs[k])
    for (const c of chain) {
      const n = this.net.nodes.get(c.node!)!
      for (const [uid, m] of n.occ) {
        if (uid !== a.uid && (!n.junction || conflicts(c.inDir, c.outDir, m.inDir, m.outDir))) return null
      }
    }
    if (chain.length && !this.exitRoom(a, chain[chain.length - 1])) return null
    return chain.some((c) => this.net.nodes.get(c.node!)!.signal) ? [] : chain
  }

  private exitRoom(a: Agent, leg: Leg) {
    const n = this.net.nodes.get(leg.node ?? '')
    if (!n) return true
    const nk = tkey(n.x + D[leg.outDir][0], n.z + D[leg.outDir][1])
    if (!this.net.nodes.has(nk)) return true
    const need = a.len + 0.35
    for (const o of this.agents.values()) {
      if (o === a) continue
      const l = o.legs[o.ci]
      if (l.node !== nk) continue
      // (A car finishing a turn round is already back in the other lane.)
      const turnedRound = l.turn === 2 && o.s > l.c.len * 0.6
      if (l.inDir === leg.outDir && !turnedRound && o.s - o.len / 2 < need && o.v < 0.6) return false
      // Someone overtaking towards us in that lane.
      if (o.ot && l.inDir === opp(leg.outDir)) return false
    }
    return true
  }

  private drive(a: Agent, dt: number) {
    const leg = a.legs[a.ci]
    const fr = this.front(a)
    const look = (a.v * a.v) / (2 * BRAKE) + 2

    // Parked at a stop.
    if (a.parked > 0) {
      const done = a.parkedAt?.stopKind !== 'stall' || !a.stalled
      const targeted = [...this.agents.values()].some((o) => o.ot?.target === a.uid)
      if (a.tow === 2 && a.parkedAt?.stopKind === 'tow') a.tow = 3
      if (done && a.tow !== 1 && a.tow !== 3) a.parked -= dt
      // Off on the verge: only ease back onto the road with a gap in the traffic.
      if (a.pull !== null && a.parked <= 0 && !this.laneClear(a)) a.parked = 0.05
      if (a.parked <= 0 && targeted) a.parked = 0.2
      if (a.parked <= 0) {
        const k = a.parkedAt?.stopKind
        if (k === 'curb' || k === 'pump' || k === 'tow') a.trip = null
        if (a.parkedAt) this.clearStop(a.parkedAt)
        a.parked = 0
        a.parkedAt = null
      }
      a.v = 0
      a.approach = null
      a.arrived = null
      return
    }

    let limit = a.cruise
    let hard = Infinity // never move further than this
    const cap = (gap: number) => {
      limit = Math.min(limit, Math.sqrt(Math.max(0, 2 * BRAKE * gap)))
      hard = Math.min(hard, Math.max(0, gap))
    }

    // Slow for bends.
    if (leg.turn) limit = Math.min(limit, leg.turn === 2 ? UTURN_V : TURN_V)
    if (!leg.node) limit = Math.min(limit, LOT_V)
    if (a.ot) limit = Math.min(limit, PASS_V)
    if (a.stalled) limit = Math.min(limit, 0.9)
    let ahead = leg.c.len - a.s
    for (let i = a.ci + 1; i < a.legs.length && ahead < look + 2; i++) {
      const l = a.legs[i]
      if (l.turn || !l.node) {
        const v = l.turn === 2 ? UTURN_V : l.node ? TURN_V : LOT_V
        limit = Math.min(limit, Math.sqrt(v * v + 2 * BRAKE * Math.max(0, ahead - 0.2)))
      }
      ahead += l.c.len
    }

    // Planned stops (curb, pumps, breakdown).
    ahead = -a.s
    for (let i = a.ci; i < a.legs.length && ahead < look + 2; i++) {
      const l = a.legs[i]
      if (l.stopS !== undefined && ahead + l.stopS > -0.01) {
        const gap = ahead + l.stopS
        cap(gap)
        if (gap < 0.02 && a.v < 0.25) {
          a.parked = l.stopFor ?? 3
          a.parkedAt = l
          a.v = 0
          a.s += Math.max(0, gap)
          return
        }
        break
      }
      ahead += l.c.len
    }

    // Someone turning round on a tile ahead swings into our lane there: wait short of it.
    ahead = leg.c.len - a.s - fr
    for (let i = a.ci + 1; i < a.legs.length && ahead < look + 1.5; i++) {
      const l = a.legs[i]
      const n = l.node && !l.junction ? this.net.nodes.get(l.node) : null
      if (n && this.turningRound(n.occ, a.uid, l.inDir)) {
        cap(ahead - 0.1)
        break
      }
      ahead += l.c.len
    }

    // Junctions: ask for a turn before rolling in; a run of junction tiles is taken all at once.
    a.approach = null
    ahead = leg.c.len - a.s - fr
    // Nothing to ask for past a planned stop.
    let until = a.ci
    while (until < a.legs.length - 1 && a.legs[until].stopS === undefined) until++
    for (let i = a.ci + 1; i <= until && ahead < look + 1.5; i++) {
      const l = a.legs[i]
      if (this.held(l) && !l.granted) {
        const chain: Leg[] = []
        // A turn round mid-road is asked for on its own; anything else runs
        // through every junction tile (and dead end) in a row.
        const midRoad = (m: Leg) => !m.junction && this.net.nodes.get(m.node!)!.degree >= 2
        for (let j = i; j < a.legs.length && this.held(a.legs[j]); j++) {
          if (j > i && (midRoad(a.legs[j]) || midRoad(a.legs[i]))) break
          chain.push(a.legs[j])
        }
        a.approach = { dist: ahead, chain }
        const prev = a.legs[i - 1]
        const line = l.junction && prev.node && !this.net.nodes.get(prev.node)!.junction ? STOP_LINE : 0
        // A stop sign: come to a full stop at the line before taking a turn.
        const sign = this.net.stopSigns.has(`${l.node}>${l.inDir}`)
        if (sign && a.v < 0.15 && ahead - line < 0.4) a.halt ??= this.t
        const halted = !sign || (a.halt !== null && this.t - a.halt > 0.5)
        // Only ask when close enough to commit; until then just be ready to stop.
        const asking = ahead < (a.v * a.v) / (2 * BRAKE) + 0.7 && (!sign || a.halt !== null)
        if (asking) a.arrived ??= this.t
        // Through a cluster of junction tiles, only the first light counts.
        const lit = chain.findIndex((c) => this.net.nodes.get(c.node!)!.signal)
        const ok = asking && halted && chain.every((c, k) => this.canEnter(a, c, ahead, k === 0, k === lit)) && this.exitRoom(a, chain[chain.length - 1]) && !this.zebraBusy(a.legs[i - 1], chain)
        const also = ok ? this.beyond(a, i + chain.length) : null
        if (also) {
          chain.push(...also)
          a.arrived = null
          a.halt = null
          for (const c of chain) {
            c.granted = true
            this.net.nodes.get(c.node!)!.occ.set(a.uid, { inDir: c.inDir, outDir: c.outDir })
          }
        } else {
          // Wait at the stop line, short of the zebra crossing.
          cap(ahead - 0.05 - line)
          // Stuck behind cars that are waiting on each other: try another way through.
          if (asking && a.wait > 4 && this.t > a.rerouteAt) this.reroute(a, chain)
          break
        }
      }
      ahead += l.c.len
    }

    if (!a.approach) {
      a.arrived = null
      a.halt = null
    }

    // Whatever is in the way along the path ahead.
    a.gapTo = null
    a.gap = Infinity
    const near = look + fr + 2.5
    const others = this.near
    others.length = 0
    for (const o of this.agents.values()) if (o !== a && Math.hypot(o.x - a.x, o.z - a.z) < near + o.len) others.push(o)
    const hit = this.scan(a, look, others)
    if (hit) {
      a.gap = hit[0]
      a.gapTo = hit[1].uid
    }
    a.pend = null
    if (a.gapTo) {
      const o = this.agents.get(a.gapTo)!
      const room = o.parked > 0 && !a.ot ? PARKED_GAP : GAP
      cap(a.gap - room)
      if (o.parked > 0 && !a.ot && a.v < 0.2 && a.gap < PARKED_GAP + 0.4) {
        this.tryOvertake(a, o)
        // No way past a broken-down car: turn off before it if there's a turning.
        const at = o.parkedAt
        if (!a.ot && o.stalled && at?.node && a.wait > 3 && this.t > a.rerouteAt && !leg.junction) {
          this.reroute(a, [at], true)
        }
      }
    }

    // Accelerate gently, brake as hard as needed, and never close the last gap.
    const dv = limit - a.v
    a.v = Math.max(0, a.v + Math.max(-BRAKE * 3 * dt, Math.min(ACCEL * dt, dv)))
    if (a.tow === 1) a.v = 0
    const move = Math.min(a.v * dt, hard)
    if (move < 0.002) a.wait += dt
    else a.wait = 0
    a.s += move
    a.odo += move
    if (a.ot && a.odo > a.ot.merge + SWING) a.ot = null
    if (a.pull !== null && a.odo > a.pull + PULL_FLAT + PULL_RAMP) a.pull = null

    while (a.s > a.legs[a.ci].c.len && a.ci < a.legs.length - 1) {
      a.s -= a.legs[a.ci].c.len
      a.ci++
      const l = a.legs[a.ci]
      // Shouldn't happen, but never drive into a junction without a turn.
      if (this.held(l) && !l.granted) {
        l.granted = true
        this.net.nodes.get(l.node!)?.occ.set(a.uid, { inDir: l.inDir, outDir: l.outDir })
      }
    }
    // Give back junctions once the tail is clear of them, and forget old legs.
    this.release(a)
    this.pose(a)
  }

  private clearToTurn(a: Agent, l: Leg) {
    const n = this.net.nodes.get(l.node!)!
    const [cx, cz] = pointAt(roadCurve(this.net, n.x, n.z, l.inDir, l.inDir), 1)
    const [fx, fz] = D[l.inDir]
    for (const o of this.agents.values()) {
      if (o === a) continue
      const dx = o.x - cx, dz = o.z - cz
      const along = dx * fx + dz * fz
      const lat = Math.abs(dx * fz - dz * fx)
      if (Math.hypot(dx, dz) < 1.8) return false
      // Coming the other way, close enough to have to brake for us.
      if (o.hx * fx + o.hz * fz < -0.5 && along > 0 && along < 3 + (o.v * o.v) / (2 * BRAKE) + o.len && lat < 1.4) return false
    }
    return true
  }

  // Find another way when the one planned is blocked. `chain` is the stretch to
  // avoid; `now` also gives up turns already granted that the car hasn't reached.
  private reroute(a: Agent, chain: Leg[], now = false) {
    a.rerouteAt = this.t + 3 + rand() * 3
    const blocked = new Set(chain.map((c) => `${c.node}|${c.inDir}`))
    // ... and the backed-up lane beyond it.
    const end = chain[chain.length - 1]
    const en = end.node && this.net.nodes.get(end.node)
    if (en) blocked.add(`${tkey(en.x + D[end.outDir][0], en.z + D[end.outDir][1])}|${end.outDir}`)
    let keep = a.ci
    while (!now && keep < a.legs.length - 1 && a.legs[keep + 1].granted) keep++
    // Never strand a car on a forecourt: keep its way back onto the road.
    keep = Math.min(a.legs.length - 1, Math.max(keep, this.lotEnd(a)))
    // Stuck behind a breakdown with no turning before it: nothing to gain,
    // and a new route would only tell it to turn round somewhere past the blockage.
    const kl = a.legs[keep]
    const kn = kl.node && this.net.nodes.get(kl.node)
    if (now && kn && blocked.has(`${tkey(kn.x + D[kl.outDir][0], kn.z + D[kl.outDir][1])}|${kl.outDir}`)) return
    if (a.legs.slice(keep + 1).some((l) => l.stopKind)) {
      // Heading for a stop: find another route there.
      const trip = a.trip
      if (!trip) return
      const last = a.legs[keep]
      const n = last.node && this.net.nodes.get(last.node)
      if (!n) return
      const nk = tkey(n.x + D[last.outDir][0], n.z + D[last.outDir][1])
      const stalls = this.stalledLanes()
      const outs = route(this.net, nk, last.outDir, trip.stop.tile, trip.stop.heading, new Set([...stalls, ...blocked]), stalls)
      if (!outs) return
      this.truncate(a, keep)
      a.plan = [...outs, { at: trip.stop.bay ? 'bay' : 'curb', kind: trip.kind }]
      this.extend(a)
      return
    }
    this.truncate(a, keep)
    a.plan = []
    this.extend(a, blocked)
  }

  private release(a: Agent) {
    let i = a.ci
    let s = a.s - a.len / 2
    while (s < 0 && i > 0) {
      i--
      s += a.legs[i].c.len
    }
    for (let j = 0; j < i; j++) {
      const l = a.legs[j]
      if (l.granted && l.node) {
        l.granted = false
        const still = a.legs.find((m) => m.granted && m.node === l.node)
        if (still) this.net.nodes.get(l.node)?.occ.set(a.uid, { inDir: still.inDir, outDir: still.outDir })
        else this.net.nodes.get(l.node)?.occ.delete(a.uid)
      }
    }
    if (i > 1) {
      a.legs.splice(0, i - 1)
      a.ci -= i - 1
    }
  }

  // Pull round a car parked at the curb when the other lane is clear and the road
  // runs straight long enough to get past and back in.
  private tryOvertake(a: Agent, p: Agent) {
    // A car limping on a flat still gets round one parked in its way.
    if (a.tow) return
    // Too close behind it to swing out without clipping its back corner (it pulled up
    // after we'd queued): wait for it to go instead.
    if (2 * LANE * smooth(a.gap / SWING) < (a.wid + p.wid) / 2 + 0.04) return
    const pass = a.gap + p.len + a.len + 0.25
    const need = pass + SWING + a.len / 2
    // Straight road the whole way: no junctions, no corners (it would meet whoever is
    // coming round them head on), and no stops.
    let ahead = -a.s
    for (let i = a.ci; i < a.legs.length; i++) {
      const l = a.legs[i]
      if (ahead > need) break
      // Never swing out past a car parked where this one means to stop.
      if (!l.node || l.junction || l.turn || (l.stopKind && !(i === a.ci && (l.stopS ?? 0) < a.s))) return
      ahead += l.c.len
    }
    if (ahead < need) return
    // Been waiting a while: ask oncoming traffic to hold back so a gap opens.
    if (a.wait > 2) a.pend = { target: p.uid, need }
    const others = [...this.agents.values()].filter((o) => o !== a && o !== p && Math.hypot(o.x - a.x, o.z - a.z) < need + 8)
    const blocked = (d0: number, d1: number, off: number) => {
      const q = this.sample(a, (d0 + d1) / 2)
      if (!q) return true
      const r = right(q.h)
      const box: Box = { x: q.p[0] + r[0] * off, z: q.p[1] + r[1] * off, ux: q.h[0], uz: q.h[1], hl: (d1 - d0) / 2, hw: 0.36 }
      return others.some((o) => o.boxes.some((b) => overlap(box, b)))
    }
    // The oncoming lane, from alongside us to well past where we'd pull back in.
    for (let d = -a.len / 2 + 0.3; d < need + 1.5; d += 0.5) if (blocked(d, d + 0.5, -2 * LANE)) return
    // Our own lane where we'd pull back in.
    const back = a.len / 2 + a.gap + p.len
    for (let d = back; d < back + a.len + 1.4; d += 0.5) if (blocked(d, d + 0.5, 0)) return
    a.ot = { target: p.uid, start: a.odo, merge: a.odo + pass }
    a.pend = null
  }
}
