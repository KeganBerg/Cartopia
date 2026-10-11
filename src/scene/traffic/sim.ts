// Town traffic. Every car follows lane curves through the road tiles, keeps
// its distance from whatever is ahead, takes turns at junctions (waiting for
// green at four-ways), pulls up at businesses, and swings round cars stopped
// at the curb. Plain TypeScript so it can be tested without a renderer.
import { dirAt, pointAt, type Curve, type V2 } from './curves'
import {
  D, LANE, buildNet, conflicts, exits, lightFor, opp, priority, right, roadCurve, route, tkey,
  type Building, type Net, type Node, type Stop, type TurnOf,
} from './net'

export type TripKind = 'gas' | 'tires' | 'tow'

export type CarSpec = {
  uid: string
  len: number // body length in world units
  wid: number
  cruise: number // top speed, world units per second
  stalled: boolean // flat tire or out of gas: pull over and wait
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
  ot: null | { target: string; start: number; merge: number }
  approach: null | { dist: number; chain: Leg[] } // junction tiles it is waiting to cross, nose distance to the first
  arrived: number | null // when it pulled up asking to cross, for first come first served
  boxes: Box[] // the body, as short boxes laid along its path this frame
  claim: Box[] // lane an overtaking car has claimed ahead of it
  rerouteAt: number
  pend: null | { target: string; need: number } // waiting to overtake: asks oncoming cars to hold back
  gapTo: string | null // whatever it is following
  gap: number
  queuedAt: number // last time it was held waiting its turn at a forecourt
  show: number // 0..1 faded in, for arriving and the rare car that has to give up
  leaving: boolean
}

const ACCEL = 1.6
const BRAKE = 3.2
const GAP = 0.22 // bumper to bumper when queued
const PARKED_GAP = 1.0 // room left behind a parked car to pull round it
const TURN_V = 1.15
const UTURN_V = 0.7
const LOT_V = 1.0
const SWING = 1.0 // distance over which an overtaking car changes lane
const TRUCK = { len: 1.52, gap: 0.12 }
const PASS_V = 1.5
// Our directions (east, west, south, north) as walkGraph's crosswalk sides (south, east, north, west).
const SIDE = [1, 3, 0, 2]
const STOP_LINE = 0.6 // how far short of an intersection cars wait
const JAMMED = 45 // seconds stuck before a car gives up

// A short oriented box: centre, heading, half length and half width.
export type Box = { x: number; z: number; ux: number; uz: number; hl: number; hw: number }

export function overlap(a: Box, b: Box) {
  const dx = b.x - a.x, dz = b.z - a.z
  if (Math.abs(dx) + Math.abs(dz) > (a.hl + a.hw + b.hl + b.hw) * 1.5) return false
  const axes: V2[] = [[a.ux, a.uz], [-a.uz, a.ux], [b.ux, b.uz], [-b.uz, b.ux]]
  for (const [nx, nz] of axes) {
    const ra = a.hl * Math.abs(a.ux * nx + a.uz * nz) + a.hw * Math.abs(-a.uz * nx + a.ux * nz)
    const rb = b.hl * Math.abs(b.ux * nx + b.uz * nz) + b.hw * Math.abs(-b.uz * nx + b.ux * nz)
    if (Math.abs(dx * nx + dz * nz) > ra + rb) return false
  }
  return true
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
  private ways = new Map<string, { outs: number[]; to: string; heading: number }[]>()
  private limp = new Map<string, number>() // broken-down cars still looking for a spot, by odometer at breakdown

  setTown(roads: string[], buildings: Building[], turnOf: TurnOf) {
    this.net = buildNet(roads, buildings, turnOf)
    this.ways = new Map()
    // Keep cars where they are when their road still exists; replan what comes next.
    for (const a of [...this.agents.values()]) {
      const leg = a.legs[a.ci]
      const still = leg.node ? this.legValid(leg) : this.lotValid(a)
      if (!still) {
        this.agents.delete(a.uid)
        continue
      }
      for (const l of a.legs) l.granted = false
      if (leg.node) leg.granted = this.held(leg)
      a.trip = null
      a.plan = []
      a.ot = null
      a.parked = 0
      a.parkedAt = null
      this.truncate(a, leg.node ? a.ci : this.lotEnd(a))
      for (const l of a.legs) if (l.stopKind && l.stopKind !== 'stall') this.clearStop(l)
      if (leg.node && leg.granted) this.net.nodes.get(leg.node)!.occ.set(a.uid, { inDir: leg.inDir, outDir: leg.outDir })
    }
    this.syncCars()
  }

  // The cars that should be on the road; stalled ones first so they are always shown.
  setCars(cars: CarSpec[], max: number) {
    this.specs = new Map()
    const sorted = [...cars].sort((a, b) => Number(b.stalled) - Number(a.stalled))
    for (const c of sorted.slice(0, max)) this.specs.set(c.uid, c)
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
    for (const uid of [...this.agents.keys()]) {
      if (!this.specs.has(uid)) this.remove(this.agents.get(uid)!)
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
  }

  private legValid(l: Leg) {
    const n = l.node && this.net.nodes.get(l.node)
    if (!n) return false
    const back = opp(l.inDir)
    return (n.arms[back] || n.lots[back]) && (n.drive[l.outDir] || n.lots[l.outDir]) && !(l.outDir === back && n.degree > 1)
  }

  private lotValid(a: Agent) {
    const end = this.lotEnd(a)
    return end < a.legs.length && this.legValid(a.legs[end])
  }

  // Index of the first road leg at or after the current one.
  private lotEnd(a: Agent) {
    let i = a.ci
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
      if (a.stalled && l?.node) out.add(`${l.node}|${l.inDir}`)
    }
    return out
  }

  private spawn(spec: CarSpec) {
    const nodes = [...this.net.nodes.values()].filter((n) => !n.junction && n.degree > 1)
    if (!nodes.length) return
    const start = Math.floor(rand() * nodes.length)
    for (let i = 0; i < nodes.length * 2; i++) {
      const n = nodes[(start + (i >> 1)) % nodes.length]
      const ins = [0, 1, 2, 3].filter((d) => n.arms[opp(d)] && exits(n, d).length && (n.oneWay < 0 || n.oneWay === d))
      if (!ins.length) continue
      const inDir = ins[(i + (start & 1)) % ins.length]
      const outs = exits(n, inDir)
      const leg = this.makeLeg(n, inDir, outs[Math.floor(rand() * outs.length)])
      const p = pointAt(leg.c, leg.c.len / 2)
      const clear = [...this.agents.values()].every((o) => Math.hypot(o.x - p[0], o.z - p[1]) > 1.9)
      if (!clear) continue
      const a: Agent = {
        uid: spec.uid, len: spec.len, wid: spec.wid, cruise: spec.cruise,
        legs: [leg], ci: 0, s: leg.c.len / 2, v: 0, odo: 0,
        x: p[0], z: p[1], yaw: 0, hx: 0, hz: 1,
        stalled: false, parked: 0, parkedAt: null, wait: 0,
        plan: [], trip: null, nextVisit: 10 + rand() * 40,
        tow: 0, truck: 0, ot: null, rerouteAt: 0, pend: null, approach: null, arrived: null, boxes: [], claim: [], gapTo: null, gap: Infinity,
        show: 0, leaving: false, queuedAt: -1,
      }
      this.agents.set(a.uid, a)
      this.extend(a)
      this.pose(a)
      if (spec.stalled) this.setStalled(a, true)
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
        leg.stopFor = next.kind === 'visit' ? 3 + rand() * 3 : next.kind === 'tow' ? 2.5 : 4
        a.legs.push(leg)
        continue
      }
      const bay = typeof next === 'object' && next.at === 'bay' ? a.trip?.stop.bay : null
      if (bay) {
        a.legs.push(this.makeLeg(node, inDir, bay.lotDir))
        bay.legs.forEach((c, i) => {
          const leg: Leg = { c, node: null, inDir: -1, outDir: -1, junction: false, turn: i === bay.stopLeg ? 0 : 1, granted: false }
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
    const outs = route(this.net, nk, last.outDir, stop.tile, stop.heading, this.stalledLanes())
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
    const c = a.legs[i].c
    const p = pointAt(c, s)
    const h = dirAt(c, s)
    const off = this.swing(a, a.odo + d)
    if (!off) return { p, h }
    const r = right(h)
    const slope = (this.swing(a, a.odo + d + 0.05) - this.swing(a, a.odo + d - 0.05)) / 0.1
    const hx = h[0] + r[0] * slope, hz = h[1] + r[1] * slope
    const l = Math.hypot(hx, hz)
    return { p: [p[0] + r[0] * off, p[1] + r[1] * off], h: [hx / l, hz / l] }
  }

  // Sideways offset while overtaking: out into the other lane, past, and back.
  private swing(a: Agent, o: number) {
    const ot = a.ot
    if (!ot) return 0
    const full = -2 * LANE
    if (o < ot.start) return 0
    if (o < ot.merge) return full * smooth((o - ot.start) / SWING)
    return full * (1 - smooth((o - ot.merge) / SWING))
  }

  private front(a: Agent) {
    return a.len / 2 + (a.tow >= 2 ? TRUCK.gap + TRUCK.len : 0) * a.truck
  }

  private pose(a: Agent) {
    const q = this.sample(a, 0)
    if (!q) return
    a.x = q.p[0]
    a.z = q.p[1]
    a.hx = q.h[0]
    a.hz = q.h[1]
    a.yaw = Math.atan2(q.h[0], q.h[1])
  }

  // Front wheel angle for a car with axles `base` apart, from how sharply its path bends here.
  steerOf(a: Agent, base: number) {
    const f = this.sample(a, 0.3)
    const b = this.sample(a, -0.3)
    if (!f || !b) return 0
    let d = Math.atan2(f.h[0], f.h[1]) - Math.atan2(b.h[0], b.h[1])
    d = Math.atan2(Math.sin(d), Math.cos(d))
    return Math.max(-0.55, Math.min(0.55, Math.atan((base * d) / 0.6)))
  }

  // Where the tow truck sits: on the path just ahead of the towed car.
  truckPose(a: Agent) {
    if (!a.tow || a.tow === 1) return null
    const q = this.sample(a, a.len / 2 + TRUCK.gap + TRUCK.len / 2)
    if (!q) return null
    return { x: q.p[0], z: q.p[1], yaw: Math.atan2(q.h[0], q.h[1]), scale: a.truck }
  }

  // Box covering the stretch of the car's path from d0 to d1 (relative to its centre).
  private slab(a: Agent, d0: number, d1: number, hw = a.wid / 2): Box | null {
    const q = this.sample(a, (d0 + d1) / 2)
    if (!q) return null
    return { x: q.p[0], z: q.p[1], ux: q.h[0], uz: q.h[1], hl: (d1 - d0) / 2 + 0.02, hw }
  }

  private outline(a: Agent) {
    const back = a.len / 2
    const fr = this.front(a)
    const n = Math.max(2, Math.ceil((back + fr) / 0.35))
    const step = (back + fr) / n
    a.boxes = []
    for (let i = 0; i < n; i++) {
      const b = this.slab(a, -back + step * i, -back + step * (i + 1))
      if (b) a.boxes.push(b)
    }
    a.claim = []
    if (a.pend) {
      // The oncoming lane it needs to get past.
      for (let d = fr; d < a.pend.need + 1.5; d += 0.4) {
        const q = this.sample(a, d + 0.2)
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

  // First thing in the way within `look` of the car's nose, as [distance, car].
  private scan(a: Agent, look: number, others: Agent[]): [number, Agent] | null {
    const fr = this.front(a)
    // Already in someone's claimed stretch: carry on out of it rather than stop inside.
    const inside = new Set(others.filter((o) => o.pend && o.claim.some((c) => a.boxes.some((b) => overlap(b, c)))).map((o) => o.uid))
    for (let d = 0; d <= look; d += 0.15) {
      const probe = this.slab(a, fr + d - 0.15, fr + d)
      if (!probe) return null
      for (const o of others) {
        if (a.ot && o.uid === a.ot.target) continue
        // An oncoming overtaker also claims the lane it needs to get back in.
        const opposite = a.hx * o.hx + a.hz * o.hz < -0.5
        if (o.boxes.some((b) => overlap(probe, b))) return [d, o]
        if (opposite && (o.ot || (o.pend && !inside.has(o.uid))) && o.claim.some((b) => overlap(probe, b))) return [d, o]
      }
    }
    return null
  }

  step(rawDt: number) {
    const dt = Math.min(rawDt, 0.1)
    this.t += dt
    const agents = [...this.agents.values()]
    for (const a of agents) this.outline(a)

    for (const a of agents) this.think(a, dt)
    for (const a of agents) this.drive(a, dt)
    for (const a of agents) {
      // Last resort for a hopeless jam: fade out and pop up somewhere quieter.
      if (!a.leaving && !a.parked && !a.stalled && !a.tow && a.wait > JAMMED && !this.queuing(a)) a.leaving = true
      a.show = a.leaving ? Math.max(0, a.show - dt * 2) : Math.min(1, a.show + dt * 2)
      if (a.leaving && !a.show) {
        const spec = this.specs.get(a.uid)
        this.remove(a)
        this.respawns++
        if (spec) this.spawn(spec)
      }
    }
  }

  private think(a: Agent, dt: number) {
    // A service trip was just paid for.
    const trip = this.trips.get(a.uid)
    if (trip && !a.parked) {
      const stop = this.stopFor(trip)
      if (trip === 'tow' && !a.tow) {
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
    if (a.tow === 1 && this.roomAhead(a, a.len / 2 + TRUCK.gap + TRUCK.len + 0.1)) a.tow = 2
    if (a.tow === 2) a.truck = Math.min(1, a.truck + dt * 2.5)
    if (a.tow === 3) {
      a.truck = Math.max(0, a.truck - dt * 2)
      if (!a.truck) a.tow = 0
    }

    // Broken down: pull over on the next straight stretch and wait to be fixed.
    if (a.stalled && !a.legs.some((l) => l.stopKind === 'stall')) this.planStall(a)

    // Now and then, drop in at a business.
    if (!a.stalled && !a.trip && !a.tow && this.net.stops.length) {
      a.nextVisit -= dt
      if (a.nextVisit <= 0) {
        a.nextVisit = 25 + rand() * 45
        const busy = new Set([...this.agents.values()].map((o) => o.trip?.stop.uid))
        const free = this.net.stops.filter((s) => !busy.has(s.uid))
        const home = free.find((s) => s.uid === this.homes.get(a.uid))
        if (home && rand() < 0.6) this.startTrip(a, home, 'visit')
        else if (free.length) this.startTrip(a, free[Math.floor(rand() * free.length)], 'visit')
      }
    }
    this.extend(a)
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
    // Limp on to a spot others can pass; settle for any straight once it has gone far enough.
    const since = a.odo - (this.limp.get(a.uid) ?? (this.limp.set(a.uid, a.odo), a.odo))
    const tests = [(i: number) => good(i) && open(i), (i: number) => fallback(i) && open(i), good, fallback]
    for (const test of since > 40 ? tests : since > 25 ? tests.slice(0, 2) : tests.slice(0, 1)) {
      for (let i = a.ci; i < a.legs.length - 1; i++) {
        const l = a.legs[i]
        const at = l.c.len / 2
        if (i === a.ci && a.s + (a.v * a.v) / (2 * BRAKE) > at - 0.05) continue
        if (!test(i) || l.stopKind) continue
        l.stopS = at
        l.stopFor = Infinity
        l.stopKind = 'stall'
        a.trip = null
        a.plan = []
        // Nothing past the stop: give back any junction it had a turn for.
        this.truncate(a, i)
        this.limp.delete(a.uid)
        return
      }
    }
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
      const light = lightFor(node, leg.inDir, this.t)
      if (light === 'red') return false
      if (light === 'yellow' && (!first || dist > (a.v * a.v) / (2 * BRAKE) + 0.15)) return false
    }
    // One car at a time on a forecourt: wait on the road until it's free.
    if (node.lots[leg.outDir]) {
      const bay = this.net.stops.find((st) => st.bay && st.tile === node.key)?.bay
      if (bay && this.bayBusy(a, node.key, leg.outDir, bay.legs)) {
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
      if (node.signal && lightFor(node, w.inDir, this.t) !== 'green') continue
      if (y.arrived !== null && a.arrived !== null) {
        if (y.arrived < a.arrived || (y.arrived === a.arrived && y.uid < a.uid)) return false
      } else if (y.arrived === null && ap.dist < 2.6 && y.v > 0.5 && a.wait < 5 && this.lane(node, w) > mine) {
        // Don't pull out in front of someone coming along the main road.
        return false
      }
    }
    return true
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
      return !!bay && this.bayBusy(a, n.key, l.outDir, bay.legs)
    }
    return false
  }

  private bayBusy(a: Agent, tile: string, lotDir: number, curves: Curve[]) {
    for (const o of this.agents.values()) {
      if (o === a) continue
      // Turning in, or anywhere on the forecourt (tail included).
      for (let i = Math.max(0, o.ci - 1); i < o.legs.length; i++) {
        const l = o.legs[i]
        if (l.granted && l.node === tile && l.outDir === lotDir) return true
        if (i <= o.ci && !l.node && curves.includes(l.c)) return true
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
  private exitRoom(a: Agent, leg: Leg) {
    const n = this.net.nodes.get(leg.node!)!
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
        // Only ask when close enough to commit; until then just be ready to stop.
        const asking = ahead < (a.v * a.v) / (2 * BRAKE) + 0.7
        if (asking) a.arrived ??= this.t
        // Through a cluster of junction tiles, only the first light counts.
        const lit = chain.findIndex((c) => this.net.nodes.get(c.node!)!.signal)
        const ok = asking && chain.every((c, k) => this.canEnter(a, c, ahead, k === 0, k === lit)) && this.exitRoom(a, chain[chain.length - 1]) && !this.zebraBusy(a.legs[i - 1], chain)
        if (ok) {
          a.arrived = null
          for (const c of chain) {
            c.granted = true
            this.net.nodes.get(c.node!)!.occ.set(a.uid, { inDir: c.inDir, outDir: c.outDir })
          }
        } else {
          // Wait at the stop line, short of the zebra crossing.
          const prev = a.legs[i - 1]
          const line = l.junction && prev.node && !this.net.nodes.get(prev.node)!.junction ? STOP_LINE : 0
          cap(ahead - 0.05 - line)
          // Stuck behind cars that are waiting on each other: try another way through.
          if (asking && a.wait > 4 && this.t > a.rerouteAt) this.reroute(a, chain)
          break
        }
      }
      ahead += l.c.len
    }

    if (!a.approach) a.arrived = null

    // Whatever is in the way along the path ahead.
    a.gapTo = null
    a.gap = Infinity
    const near = look + fr + 2.5
    const others = [...this.agents.values()].filter((o) => o !== a && Math.hypot(o.x - a.x, o.z - a.z) < near + o.len)
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
    if (a.legs.slice(keep + 1).some((l) => l.stopKind)) {
      // Heading for a stop: find another route there.
      const trip = a.trip
      if (!trip) return
      const last = a.legs[keep]
      const n = last.node && this.net.nodes.get(last.node)
      if (!n) return
      const nk = tkey(n.x + D[last.outDir][0], n.z + D[last.outDir][1])
      const outs = route(this.net, nk, last.outDir, trip.stop.tile, trip.stop.heading, new Set([...this.stalledLanes(), ...blocked]))
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
    if (a.tow || a.stalled) return
    const pass = a.gap + p.len + a.len + 0.25
    const need = pass + SWING + a.len / 2
    // Plain road the whole way: gentle bends are fine, junctions and stops are not.
    let ahead = -a.s
    for (let i = a.ci; i < a.legs.length; i++) {
      const l = a.legs[i]
      if (ahead > need) break
      // Never swing out past a car parked where this one means to stop.
      if (!l.node || l.junction || l.turn === 2 || (l.stopKind && !(i === a.ci && (l.stopS ?? 0) < a.s))) return
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
