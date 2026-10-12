import { describe, expect, it } from 'vitest'
import { DRIFT_ORANGE, FIELD, KartRace, LAPS, TRACKS, buildTrack, gpField, idleInput, kartStats, lateral, locate } from './kart'

const ALL = TRACKS.flatMap((d) => [buildTrack(d, false), buildTrack(d, true)])

describe('kart circuits', () => {
  it('never pass close enough to themselves for the barriers to touch', () => {
    for (const t of ALL) {
      let worst = Infinity
      for (let i = 0; i < t.n; i += 2) for (let j = 0; j < t.n; j += 2) {
        const gap = Math.min(Math.abs(i - j), t.n - Math.abs(i - j))
        if (gap < 40) continue
        worst = Math.min(worst, Math.hypot(t.x[i] - t.x[j], t.z[i] - t.z[j]))
      }
      // Two barriers and room for scenery between them.
      expect(worst, t.def.id).toBeGreaterThan(t.wall * 2 + 3)
    }
  })

  it('are a sensible length and bend no tighter than a kart can take', () => {
    for (const t of ALL) {
      expect(t.len, t.def.id).toBeGreaterThan(280)
      expect(t.len, t.def.id).toBeLessThan(520)
      for (let i = 0; i < t.n; i++) expect(Math.abs(t.curve[i]), `${t.def.id} @${i}`).toBeLessThan(1 / 6)
    }
  })

  it('place every pad, ramp and crate on the tarmac', () => {
    for (const t of ALL) {
      for (const p of [...t.boosts, ...t.ramps]) expect(Math.abs(p.off) + p.w / 2, t.def.id).toBeLessThanOrEqual(t.half + 0.01)
      for (const c of t.crates) expect(Math.abs(lateral(t, locate(t, c.x, c.z, c.i), c.x, c.z))).toBeLessThan(t.half)
    }
  })

  it('reverse runs the same loop the other way from the same line', () => {
    for (const d of TRACKS) {
      const f = buildTrack(d), r = buildTrack(d, true)
      expect(Math.abs(f.len - r.len)).toBeLessThan(3)
      expect(Math.hypot(f.x[0] - r.x[0], f.z[0] - r.z[0])).toBeLessThan(0.01)
      expect(f.tx[0] * r.tx[0] + f.tz[0] * r.tz[0]).toBeLessThan(-0.9)
    }
  })

  it('AI karts drive every circuit both ways, three laps, without getting stuck', () => {
    for (const t of ALL) {
      const field = gpField(['A', 'B', 'C', 'D', 'E', 'F'], 2, 40, { name: 'Me', pi: 40 }).map((f) => ({ ...f, ai: true }))
      const race = new KartRace(t, field, 3)
      const dt = 1 / 60
      while (race.finishOrder.length < FIELD && race.t < 240) race.step(dt, [], true)
      expect(race.finishOrder.length, t.def.id + (t.reverse ? ' rev' : '')).toBe(FIELD)
      const lap = race.karts[race.finishOrder[0]].done! / LAPS
      // A lap takes 15 to 40 seconds.
      expect(lap, t.def.id).toBeGreaterThan(15)
      expect(lap, t.def.id).toBeLessThan(40)
    }
  })

  it('keeps every kart inside the barriers', () => {
    const t = ALL[1]
    const race = new KartRace(t, gpField(['A', 'B', 'C', 'D', 'E', 'F'], 5, 60, { name: 'Me', pi: 30 }), 7)
    const me = race.karts.length - 1
    for (let f = 0; f < 60 * 40; f++) {
      // The player holds full lock left with the gas down: scraping the wall all the way.
      race.step(1 / 60, race.karts.map((_, i) => (i === me ? { ...idleInput(), gas: 1, steer: 1 } : idleInput())), true)
      for (const k of race.karts) expect(Math.abs(lateral(t, k.idx, k.x, k.z))).toBeLessThan(t.wall + 0.05)
    }
  })

  it('a faster car has a higher top speed, flattening out at the top', () => {
    expect(kartStats(60).top).toBeGreaterThan(kartStats(30).top)
    expect(kartStats(240).top - kartStats(200).top).toBeLessThan(kartStats(60).top - kartStats(20).top)
  })

  it('a drift released after a long slide fires a mini turbo', () => {
    // A wide ring, so a held drift can go round without meeting a barrier.
    const ring = buildTrack({ id: 'ring', name: 'Ring', short: 'Ring', theme: 'town', venue: 'main', icon: '', half: 7, features: [], pts: Array.from({ length: 16 }, (_, i) => [Math.sin(i / 16 * Math.PI * 2) * 24, Math.cos(i / 16 * Math.PI * 2) * 24] as [number, number]) })
    const race = new KartRace(ring, [{ name: 'Me', pi: 50, ai: false }], 1)
    const k = race.karts[0]
    const turn = Math.sign(ring.curve[0])
    // Steer like an AI driver would (it follows the ring), holding drift for the middle stretch.
    const go = (drift: boolean, s: number) => {
      for (let f = 0; f < s * 60; f++) race.step(1 / 60, [{ ...race.autoInput(k, race.karts, false), gas: 1, brake: 0, drift }], true)
    }
    go(false, 2)
    go(true, 3)
    expect(k.drift).toBe(turn)
    expect(k.charge).toBeGreaterThan(DRIFT_ORANGE)
    expect(Math.hypot(k.vx, k.vz)).toBeGreaterThan(10)
    go(false, 0.05)
    expect(k.boost).toBeGreaterThan(1)
  })
})
