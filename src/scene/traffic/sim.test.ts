import { describe, expect, it } from 'vitest'
import { Traffic, overlap, seedRandom, type Box, type CarSpec } from './sim'
import type { Building } from './net'

// Faces south unless told otherwise; good enough for test towns.
const turnOf = (b: Building) => b.rot ?? 0

function grid(n: number, step: number, at = 2) {
  const roads = new Set<string>()
  for (let i = 0; i < n; i++) {
    for (let x = at; x <= at + (n - 1) * step; x++) roads.add(`${x},${at + i * step}`)
    for (let z = at; z <= at + (n - 1) * step; z++) roads.add(`${at + i * step},${z}`)
  }
  return [...roads]
}

function cars(n: number, stalled = 0): CarSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `c${String(i).padStart(2, '0')}`,
    len: [0.98, 0.76, 1.0, 1.22][i % 4],
    wid: [0.53, 0.51, 0.54, 0.54][i % 4],
    cruise: 1.6 + (i % 5) * 0.4,
    stalled: i < stalled,
  }))
}

// Pairs of cars whose bodies touch (shrunk a hair so kissing bumpers don't count).
function overlaps(t: Traffic) {
  const list = [...t.agents.values()]
  const out: string[] = []
  const shrink = (b: Box): Box => ({ ...b, hl: b.hl - 0.03, hw: b.hw - 0.03 })
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j]
      if (a.boxes.some((p) => b.boxes.some((q) => overlap(shrink(p), shrink(q))))) out.push(`${a.uid}/${b.uid}`)
    }
  }
  return out
}

function run(t: Traffic, seconds: number, check: (t: Traffic, at: number) => void) {
  for (let f = 0; f < seconds * 30; f++) {
    t.step(1 / 30)
    if (f % 3 === 0) check(t, f / 30)
  }
}

describe('town traffic', () => {
  for (const [name, roads, n] of [
    ['grid with four-way lights', grid(3, 5), 22],
    ['dense small grid', grid(3, 3), 16],
    ['single loop', grid(2, 6), 10],
  ] as const) {
    it(`${name}: cars never overlap and nobody gets stuck`, () => {
      seedRandom(7)
      const t = new Traffic()
      t.setTown([...roads], [], turnOf)
      t.setCars(cars(n), n)
      expect(t.agents.size).toBeGreaterThan(n * 0.6)
      const bumps = new Set<string>()
      const stuck = new Map<string, number>()
      let longest = 0
      run(t, 240, (tr) => {
        for (const o of overlaps(tr)) bumps.add(o)
        for (const a of tr.agents.values()) {
          const w = a.parked > 0 ? 0 : a.wait
          stuck.set(a.uid, w)
          longest = Math.max(longest, w)
        }
      })
      expect([...bumps]).toEqual([])
      expect(longest).toBeLessThan(30)
      for (const a of t.agents.values()) expect(a.odo).toBeGreaterThan(40)
    })
  }

  it('cars drive round a broken-down car', () => {
    seedRandom(3)
    const t = new Traffic()
    t.setTown(grid(2, 8), [], turnOf)
    t.setCars(cars(10, 1), 10)
    const bumps = new Set<string>()
    let longest = 0
    run(t, 240, (tr) => {
      for (const o of overlaps(tr)) bumps.add(o)
      for (const a of tr.agents.values()) if (!a.stalled && !a.parked) longest = Math.max(longest, a.wait)
    })
    const broken = t.agents.get('c00')!
    expect(broken.parked).toBeGreaterThan(0)
    expect([...bumps]).toEqual([])
    expect(longest).toBeLessThan(30)
  })

  it('visits the gas station forecourt and pulls back out', () => {
    seedRandom(5)
    const t = new Traffic()
    const roads = grid(2, 8)
    // Gas station facing south onto the top road (z = 2), lot on row 1.
    t.setTown(roads, [{ uid: 'g', def: 'gas', x: 5, z: 1, rot: 0 }], turnOf)
    expect(t.net.stops[0].bay).not.toBeNull()
    t.setCars(cars(1), 1)
    const a = [...t.agents.values()][0]
    t.requestTrip(a.uid, 'gas')
    let pumped = false
    run(t, 120, (tr) => {
      const car = tr.agents.get(a.uid)!
      if (car.parked > 0 && car.parkedAt?.stopKind === 'pump') pumped = true
    })
    expect(pumped).toBe(true)
    expect(t.agents.get(a.uid)!.parked).toBe(0)
  })

  it('cars use the forecourt one at a time', () => {
    seedRandom(8)
    const t = new Traffic()
    t.setTown(grid(2, 8), [{ uid: 'g', def: 'gas', x: 5, z: 1, rot: 0 }], turnOf)
    const bay = t.net.stops[0].bay!
    t.setCars(cars(4), 4)
    for (const a of t.agents.values()) t.requestTrip(a.uid, 'gas')
    const pumped = new Set<string>()
    const bumps = new Set<string>()
    let most = 0
    run(t, 180, (tr) => {
      const inBay = [...tr.agents.values()].filter((a) => a.legs.slice(a.ci).some((l) => !l.node && bay.legs.includes(l.c)) && !a.legs[a.ci].node)
      most = Math.max(most, inBay.length)
      for (const a of tr.agents.values()) if (a.parked > 0 && a.parkedAt?.stopKind === 'pump') pumped.add(a.uid)
      for (const o of overlaps(tr)) bumps.add(o)
    })
    expect(t.respawns).toBe(0)
    expect(most).toBe(1)
    expect(pumped.size).toBe(4)
    expect([...bumps]).toEqual([])
  })

  it('stops for people on the zebra crossings', () => {
    seedRandom(3)
    const t = new Traffic()
    t.setTown(grid(3, 4), [], turnOf)
    t.setCars(cars(8), 8)
    const SIDE = [1, 3, 0, 2]
    const zebras: string[] = []
    for (const r of t.net.layout.tiles.values()) {
      if (r.junction) continue
      for (let d = 0; d < 4; d++) {
        const n = t.net.layout.tiles.get(`${r.x + [1, -1, 0, 0][d]},${r.z + [0, 0, 1, -1][d]}`)
        if (r.arms[d] && n?.junction) zebras.push(`${r.key}:${SIDE[d]}`)
      }
    }
    const walkers = new Map<string, number>()
    t.walkers = walkers
    const inside = new Map<string, number>()
    let crossedWhileBusy = 0
    let movedAfter = 0
    run(t, 70, (tr, at) => {
      if (at >= 10 && at < 40) for (const z of zebras) walkers.set(z, 1)
      else walkers.clear()
      for (const a of tr.agents.values()) {
        const l = a.legs[a.ci]
        const was = inside.get(a.uid)
        const now = l.junction ? a.ci : -1
        // Rolling onto a junction tile from the road while every crossing is busy.
        if (now >= 0 && was === -1 && at > 12 && at < 40 && !a.legs[a.ci - 1]?.junction) crossedWhileBusy++
        if (now >= 0 && was === -1 && at > 41) movedAfter++
        inside.set(a.uid, now)
      }
    })
    expect(zebras.length).toBeGreaterThan(8)
    expect(crossedWhileBusy).toBe(0)
    expect(movedAfter).toBeGreaterThan(0)
  })

  // The starter town with its businesses, as most players have it.
  const starter = () => {
    const roads: string[] = []
    for (let i = 4; i <= 19; i++) roads.push(`${i},4`, `${i},19`, `4,${i}`, `19,${i}`, `${i},11`)
    const blds = [['gas', 6, 3], ['pizza', 10, 3], ['pizza', 12, 3], ['rescue', 14, 3], ['pizza', 17, 10], ['showroom', 9, 9], ['garage', 13, 9]]
    return { roads: [...new Set(roads)], buildings: blds.map(([def, x, z]) => ({ uid: `${def}${x}`, def: def as string, x: x as number, z: z as number, rot: 0 })) }
  }
  // Share of time moving cars spend stopped, the biggest knot of stopped cars, and give-ups.
  const crowding = (t: Traffic, seconds: number, every?: (t: Traffic, at: number) => void) => {
    let still = 0, all = 0, knot = 0
    run(t, seconds, (tr, at) => {
      every?.(tr, at)
      if (at < 10) return
      const live = [...tr.agents.values()].filter((a) => !a.parked && !a.stalled && !a.tow)
      const stopped = live.filter((a) => a.v < 0.05)
      all += live.length
      still += stopped.length
      const seen = new Set<string>()
      for (const a of stopped) {
        if (seen.has(a.uid)) continue
        let size = 0
        const q = [a]
        seen.add(a.uid)
        while (q.length) {
          const c = q.pop()!
          size++
          for (const o of stopped) {
            if (seen.has(o.uid) || Math.hypot(o.x - c.x, o.z - c.z) >= 2.2) continue
            seen.add(o.uid)
            q.push(o)
          }
        }
        knot = Math.max(knot, size)
      }
    })
    return { still: still / all, knot }
  }

  it('broken-down cars pull onto the verge and traffic keeps flowing', () => {
    seedRandom(11)
    const t = new Traffic()
    const { roads, buildings } = starter()
    t.setTown(roads, buildings, turnOf)
    t.setCars(cars(18, 4), 18)
    const bumps = new Set<string>()
    const c = crowding(t, 240, (tr) => {
      for (const o of overlaps(tr)) bumps.add(o)
    })
    const parked = [...t.agents.values()].filter((a) => a.stalled && a.parked)
    expect(parked.length).toBe(4)
    // All four off the road, out of everyone's way.
    for (const a of parked) expect(a.pull).not.toBeNull()
    expect([...bumps]).toEqual([])
    expect(t.respawns).toBe(0)
    expect(c.still).toBeLessThan(0.08)
    expect(c.knot).toBeLessThanOrEqual(4)
  })

  it('side roads at a T have stop signs, and cars stop at them before pulling out', () => {
    seedRandom(4)
    const t = new Traffic()
    const { roads, buildings } = starter()
    t.setTown(roads, buildings, turnOf)
    // The middle street meets the ring road in a T at each end: the side road stops.
    expect([...t.net.stopSigns].sort()).toEqual(['19,11>0', '4,11>1'])
    for (const c of t.net.layout.clusters) expect(c.signal).toBe(false)
    t.setCars(cars(18), 18)
    const seen = new WeakSet<object>()
    const speeds: number[] = []
    const c = crowding(t, 240, (tr) => {
      for (const a of tr.agents.values()) {
        const l = a.legs[a.ci + 1]
        if (l?.granted && !seen.has(l) && tr.net.stopSigns.has(`${l.node}>${l.inDir}`)) {
          seen.add(l)
          speeds.push(a.v)
        }
      }
    })
    expect(speeds.length).toBeGreaterThan(10)
    for (const v of speeds) expect(v).toBeLessThan(0.2)
    expect(t.respawns).toBe(0)
    expect(c.still).toBeLessThan(0.1)
  })

  it('a busy starter town with a run on the gas station does not bunch up', () => {
    seedRandom(11)
    const t = new Traffic()
    const { roads, buildings } = starter()
    t.setTown(roads, buildings, turnOf)
    t.setCars(cars(24), 24)
    const c = crowding(t, 240, (tr, at) => {
      if (at === 20) for (const a of [...tr.agents.values()].slice(0, 8)) tr.requestTrip(a.uid, 'gas')
    })
    expect(t.respawns).toBe(0)
    expect(c.still).toBeLessThan(0.1)
    expect(c.knot).toBeLessThanOrEqual(6)
  })

  it('building something mid gas trip or mid tow never strands a car', () => {
    seedRandom(8)
    const t = new Traffic()
    const roads = grid(2, 8)
    const gas = { uid: 'g', def: 'gas', x: 5, z: 1, rot: 0 }
    const rescue = { uid: 'r', def: 'rescue', x: 5, z: 11, rot: 2 }
    t.setTown(roads, [gas, rescue], turnOf)
    t.setCars(cars(4), 4)
    t.requestTrip('c00', 'gas')
    t.requestTrip('c01', 'tow')
    // Build a house the moment c00 starts turning in to the pumps.
    let rebuilt = false
    let pumped = 0
    let towedHome = false
    run(t, 150, (tr) => {
      const a = tr.agents.get('c00')!
      const l = a.legs[a.ci]
      if (!rebuilt && l.node && tr.net.nodes.get(l.node)!.lots[l.outDir] && l.granted) {
        rebuilt = true
        tr.setTown(roads, [gas, rescue, { uid: 'h', def: 'house', x: 14, z: 14 }], turnOf)
      }
      for (const o of tr.agents.values()) if (o.parked > 0 && o.parkedAt?.stopKind === 'pump') pumped++
      const b = tr.agents.get('c01')
      if (b?.parked && b.parkedAt?.stopKind === 'tow') towedHome = true
    })
    expect(rebuilt).toBe(true)
    // The forecourt doesn't stay blocked: another car can still fill up afterwards.
    pumped = 0
    t.requestTrip('c02', 'gas')
    run(t, 90, (tr) => {
      const a = tr.agents.get('c02')
      if (a?.parked && a.parkedAt?.stopKind === 'pump') pumped++
    })
    expect(pumped).toBeGreaterThan(0)
    expect(towedHome).toBe(true)
    expect(t.agents.get('c01')!.tow).toBe(0)
    expect(t.agents.size).toBe(4)
    for (const a of t.agents.values()) expect(a.wait).toBeLessThan(46)
  })

  it('tows a car to Rusty\'s curb', () => {
    seedRandom(9)
    const t = new Traffic()
    const roads = grid(2, 8)
    t.setTown(roads, [{ uid: 'r', def: 'rescue', x: 5, z: 3, rot: 2 }], turnOf)
    expect(t.net.stops.length).toBe(1)
    t.setCars(cars(4, 1), 4)
    run(t, 20, () => {})
    t.setCars(cars(4, 0), 4)
    t.requestTrip('c00', 'tow')
    let towed = false
    let dropped = false
    const bumps = new Set<string>()
    run(t, 150, (tr) => {
      const car = tr.agents.get('c00')!
      if (car.tow === 2 && car.truck === 1) towed = true
      if (towed && car.parked > 0 && car.parkedAt?.stopKind === 'tow') dropped = true
      for (const o of overlaps(tr)) bumps.add(o)
    })
    expect(towed).toBe(true)
    expect(dropped).toBe(true)
    expect(t.agents.get('c00')!.tow).toBe(0)
    expect([...bumps]).toEqual([])
  })

  // Wide roads: a two-lane avenue through a grid, and a 4x4 square of road where
  // four streets meet.
  const avenueTown = () => {
    const roads = new Set(grid(3, 7, 2))
    for (let x = 0; x <= 23; x++) roads.add(`${x},12`)
    for (let x = 0; x <= 23; x++) roads.add(`${x},13`)
    return [...roads]
  }
  const plazaTown = () => {
    const roads = new Set<string>()
    for (let x = 10; x < 14; x++) for (let z = 10; z < 14; z++) roads.add(`${x},${z}`)
    for (let i = 2; i < 22; i++) {
      roads.add(`${i},12`)
      roads.add(`11,${i}`)
    }
    for (let i = 2; i < 22; i++) {
      roads.add(`2,${i}`)
      roads.add(`21,${i}`)
      roads.add(`${i},2`)
      roads.add(`${i},21`)
    }
    return [...roads]
  }
  for (const [name, town, n] of [['avenue', avenueTown, 24], ['4x4 plaza', plazaTown, 24]] as const) {
    it(`${name}: cars flow without jams`, () => {
      seedRandom(11)
      const t = new Traffic()
      t.setTown(town(), [], turnOf)
      t.setCars(cars(n), n)
      const bumps = new Set<string>()
      let longest = 0
      run(t, 240, (tr) => {
        for (const o of overlaps(tr)) bumps.add(o)
        for (const a of tr.agents.values()) longest = Math.max(longest, a.wait)
      })
      expect([...bumps]).toEqual([])
      expect(t.respawns).toBe(0)
      expect(longest).toBeLessThan(30)
    })
  }

  it('lights change for whoever is waiting, and not for no one', () => {
    seedRandom(2)
    const t = new Traffic()
    t.setTown(plazaTown(), [], turnOf)
    const id = t.net.layout.clusters.find((c) => c.signal)!.id
    const green = () => (t.lightOf(id, 0) === 'green' ? 0 : t.lightOf(id, 2) === 'green' ? 1 : -1)
    // Empty town: whichever way is green stays green.
    run(t, 2, () => {})
    const axis = green()
    expect(axis).toBeGreaterThanOrEqual(0)
    run(t, 30, () => expect(green()).toBe(axis))
    // Someone on foot waits to cross the green road: it changes for them.
    let changed = -1
    run(t, 10, (tr, at) => {
      tr.wantWalk(id, axis === 0 ? 0 : 2)
      if (changed < 0 && tr.lightOf(id, axis === 0 ? 0 : 2) === 'red') changed = at
    })
    expect(changed).toBeGreaterThan(0)
    expect(changed).toBeLessThan(8)
    // A lone car hardly ever sits at a red.
    t.setCars(cars(1), 1)
    let red = 0
    run(t, 120, (tr) => {
      const a = [...tr.agents.values()][0]
      const n = a.approach && tr.net.nodes.get(a.approach.chain[0].node!)
      if (n?.signal && a.v < 0.05 && tr.lightOf(n.cluster, a.approach!.chain[0].inDir) !== 'green') red += 0.1
    })
    expect(red).toBeLessThan(6)
  })

  it('avenues are one-way each side and the 4x4 plaza is one intersection with lights', () => {
    const t = new Traffic()
    t.setTown(avenueTown(), [], turnOf)
    const n = t.net.nodes
    expect(n.get('20,12')!.oneWay).toBe(1) // north side heads west
    expect(n.get('20,13')!.oneWay).toBe(0) // south side heads east
    expect(n.get('9,12')!.junction).toBe(true)
    expect(n.get('9,12')!.cluster).toBe(n.get('9,13')!.cluster)
    expect(n.get('9,12')!.signal).toBe(true)
    t.setTown(plazaTown(), [], turnOf)
    const p = t.net.nodes.get('11,11')!
    const c = t.net.layout.clusters[p.cluster]
    expect(c.tiles.length).toBe(16)
    expect(c.signal).toBe(true)
  })

  // Random sprawling towns: dead ends, T-junctions, crossings and loops.
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    it(`random town ${seed}: no overlaps, no gridlock`, () => {
      seedRandom(seed * 101)
      let r = seed * 7919
      const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
      const roads = new Set<string>()
      let x = 10, z = 10
      for (let i = 0; i < 90; i++) {
        roads.add(`${x},${z}`)
        const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rnd() * 4)]
        const len = 2 + Math.floor(rnd() * 4)
        for (let k = 0; k < len; k++) {
          x = Math.max(0, Math.min(23, x + d[0]))
          z = Math.max(0, Math.min(23, z + d[1]))
          roads.add(`${x},${z}`)
        }
      }
      const t = new Traffic()
      t.setTown([...roads], [], turnOf)
      const n = Math.min(24, Math.floor(roads.size * 0.35))
      t.setCars(cars(n, seed % 3 === 0 ? 1 : 0), n)
      const bumps = new Set<string>()
      let longest = 0
      run(t, 200, (tr) => {
        for (const o of overlaps(tr)) bumps.add(o)
        for (const a of tr.agents.values()) if (!a.stalled && !a.parked) longest = Math.max(longest, a.wait)
      })
      expect([...bumps]).toEqual([])
      // Blobs of road this messy can still knot up now and then; a jammed car
      // gives up and reappears elsewhere, but that should stay rare.
      expect(t.respawns).toBeLessThanOrEqual(4)
      for (const a of t.agents.values()) if (!a.stalled) expect(a.wait).toBeLessThan(46)
    })
  }
})

describe('honking', () => {
  it('drivers stuck behind someone honk now and then, never the stuck car itself', async () => {
    const { HonkWatch } = await import('../../lib/ambience')
    seedRandom(3)
    const t = new Traffic()
    t.setTown(grid(3, 3), [], turnOf)
    t.setCars(cars(16), 16)
    let r = 0.37
    const watch = new HonkWatch(() => (r = (r * 9301 + 0.4927) % 1))
    const times: number[] = []
    run(t, 240, (tr, at) => {
      for (const a of watch.check(tr.agents, at)) {
        expect(a.parked).toBe(0)
        expect(a.stalled).toBe(false)
        expect(a.wait).toBeGreaterThan(2)
        times.push(at)
      }
    })
    expect(times.length).toBeGreaterThan(0)
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(2.5)
  })
})
