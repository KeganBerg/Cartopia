import { describe, expect, it } from 'vitest'
import { BLAST_PI, KartRace, TRACKS, buildTrack, idleInput, kartStats } from './kart'
import { glassAt, placeObstacles } from './obstacles'

const field = (n = 6) => Array.from({ length: n }, (_, i) => ({ name: `K${i}`, pi: 20 + i * 10, ai: i < n - 1 }))

describe('road obstacles', () => {
  it('every track gets all four kinds, clear of pads, ramps and crates', () => {
    for (const def of TRACKS) for (const reverse of [false, true]) {
      const t = buildTrack(def, reverse)
      const obs = placeObstacles(t)
      expect(new Set(obs.map((o) => o.kind))).toEqual(new Set(['boxes', 'pothole', 'ice', 'glass']))
      const busy = [...t.boosts.map((p) => p.i), ...t.ramps.map((p) => p.i), ...t.crates.map((c) => c.i)]
      for (const o of obs) for (const b of busy) expect(Math.min(Math.abs(o.i - b), t.n - Math.abs(o.i - b))).toBeGreaterThanOrEqual(10)
      expect(placeObstacles(t, true).length).toBeGreaterThan(obs.length)
    }
  })

  it('only races with them have them', () => {
    const t = buildTrack(TRACKS[0])
    expect(new KartRace(t, field()).obstacles).toEqual([])
    expect(new KartRace(t, field(), 1, { obstacles: true }).obstacles.length).toBe(4)
  })

  it('a pile of boxes slows a kart and pushes it out, but never stops the race', () => {
    const t = buildTrack(TRACKS[0])
    const race = new KartRace(t, field(1), 1, { obstacles: true })
    race.karts[0].ai = false
    const box = race.obstacles.find((o) => o.kind === 'boxes')!
    const k = race.karts[0]
    // Just short of the pile, flat out at it.
    k.x = box.x - Math.sin(box.h) * 1.2; k.z = box.z - Math.cos(box.h) * 1.2; k.h = box.h; k.idx = box.i
    k.vx = Math.sin(box.h) * 20; k.vz = Math.cos(box.h) * 20
    race.step(1 / 60, [{ ...idleInput(), gas: 1 }], true)
    expect(race.events.some((e) => e.kind === 'boxes')).toBe(true)
    expect(Math.hypot(k.vx, k.vz)).toBeLessThan(12)
  })

  it('an ice patch makes the kart slide for a moment', () => {
    const t = buildTrack(TRACKS[0])
    const race = new KartRace(t, field(1), 1, { obstacles: true })
    race.karts[0].ai = false
    const ice = race.obstacles.find((o) => o.kind === 'ice')!
    const k = race.karts[0]
    k.x = ice.x; k.z = ice.z; k.h = ice.h; k.idx = ice.i
    race.step(1 / 60, [idleInput()], true)
    expect(k.ice).toBeGreaterThan(1)
  })

  it('the glass crosses on a loop and comes back whole after it shatters', () => {
    const t = buildTrack(TRACKS[0])
    const o = placeObstacles(t).find((o) => o.kind === 'glass')!
    const a = glassAt(o, 1)!, b = glassAt(o, 4)!
    expect(a.cycle).toBe(b.cycle)
    expect(Math.sign(b.across - a.across)).not.toBe(0)
    expect(glassAt(o, 6.5)).toBeNull()
    expect(glassAt(o, 9)!.cycle).toBe(a.cycle + 1)
  })
})

describe('AI with obstacles', () => {
  it('every rival still finishes on every track', () => {
    for (const def of TRACKS) for (const blast of [false, true]) {
      const all = field().map((f) => ({ ...f, ai: true }))
      const race = new KartRace(buildTrack(def, true), all, 7, { obstacles: true, blast })
      for (let f = 0; f < 60 * 240 && race.karts.some((k) => k.done === null); f++) race.step(1 / 60, [], true)
      expect(race.karts.every((k) => k.done !== null)).toBe(true)
    }
  })
})

describe('Bumper Blast', () => {
  it('every kart races the same stats, whatever its car', () => {
    const race = new KartRace(buildTrack(TRACKS[1]), field(), 1, { blast: true })
    for (const k of race.karts) expect(k.stats).toEqual(kartStats(BLAST_PI))
    expect(race.obstacles.length).toBeGreaterThan(4)
  })

  it('bumps knock harder, and a hard ram spins out the kart that got hit', () => {
    const run = (blast: boolean) => {
      const race = new KartRace(buildTrack(TRACKS[0]), field(2), 1, { blast })
      const [p, q] = race.karts
      p.x = 0; p.z = 0; q.x = 1.2; q.z = 0
      p.vx = 16; p.vz = 0; q.vx = 0; q.vz = 0
      race.collideKarts()
      return { q: q.vx, spin: q.spin }
    }
    const calm = run(false), wild = run(true)
    expect(wild.q).toBeGreaterThan(calm.q * 2)
    expect(calm.spin).toBe(0)
    expect(wild.spin).toBeGreaterThan(0)
  })
})
