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
    len: [1.34, 1.05, 1.52, 1.63][i % 4],
    wid: [0.73, 0.7, 0.81, 0.86][i % 4],
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
