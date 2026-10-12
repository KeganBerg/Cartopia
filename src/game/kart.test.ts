import { describe, expect, it } from 'vitest'
import { DRIFT_ORANGE, FIELD, KartRace, LAPS, TRACKS, buildTrack, gpField, idleInput, itemOdds, kartStats, lateral, locate, type ItemId, type Kart } from './kart'

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

const RING = buildTrack({ id: 'ring30', name: 'Ring', short: 'Ring', theme: 'town', venue: 'main', icon: '', half: 7, features: [], pts: Array.from({ length: 16 }, (_, i) => [Math.sin(i / 16 * Math.PI * 2) * 30, Math.cos(i / 16 * Math.PI * 2) * 30] as [number, number]) })
const drive = (race: KartRace, secs: number, each?: (k: Kart[]) => void) => {
  for (let f = 0; f < secs * 60; f++) { each?.(race.karts); race.step(1 / 60, [], true) }
}
// Put a kart `ahead` points of track in front of where it is now.
const shift = (race: KartRace, k: Kart, ahead: number) => {
  const t = race.track
  const i = (k.idx + ahead + t.n) % t.n
  k.x = t.x[i]; k.z = t.z[i]; k.idx = i; k.h = Math.atan2(t.tx[i], t.tz[i])
}

describe('kart items', () => {
  const CATCH: ItemId[] = ['nitro', 'hornet', 'tow', 'emp']
  const sum = (o: Record<ItemId, number>, ids: ItemId[]) => ids.reduce((a, id) => a + o[id], 0)

  it('leaders get defence, the back of the field gets the catch-up', () => {
    for (let r = 0; r < FIELD; r++) expect(Object.values(itemOdds(r)).reduce((a, b) => a + b)).toBeCloseTo(1)
    expect(itemOdds(0).emp).toBe(0)
    expect(itemOdds(1).emp).toBe(0)
    expect(sum(itemOdds(0), CATCH)).toBeLessThan(0.25)
    expect(sum(itemOdds(FIELD - 1), CATCH)).toBeGreaterThan(0.6)
    for (let r = 1; r < FIELD; r++) expect(sum(itemOdds(r), CATCH)).toBeGreaterThan(sum(itemOdds(r - 1), CATCH))
    // Every item turns up somewhere in the field.
    for (const id of Object.keys(itemOdds(0)) as ItemId[]) expect(Math.max(...Array.from({ length: FIELD }, (_, r) => itemOdds(r)[id])), id).toBeGreaterThan(0.05)
  })

  it('a tack strip gives a flat tyre that costs real pace', () => {
    const run = (tacks: boolean) => {
      const race = new KartRace(RING, [{ name: 'A', pi: 50, ai: true, skill: 1 }], 1)
      const k = race.karts[0]
      drive(race, 3)
      if (tacks) {
        const t = race.track, i = (k.idx + 12) % t.n
        race.tacks.push({ x: t.x[i] + t.nx[i] * lateral(t, k.idx, k.x, k.z), z: t.z[i] + t.nz[i] * lateral(t, k.idx, k.x, k.z), t: race.t - 1, h: Math.atan2(t.tx[i], t.tz[i]) })
      }
      const start = race.progress(k)
      drive(race, 3)
      return { k, race, gone: race.progress(k) - start }
    }
    const clean = run(false), hit = run(true)
    expect(hit.race.tacks.length).toBe(0)
    expect(hit.k.flat).toBeGreaterThan(0)
    expect(hit.gone).toBeLessThan(clean.gone * 0.92)
  })

  it('a smoke bomb slows whoever drives into it, but not through a bubble shield', () => {
    for (const shielded of [false, true]) {
      const race = new KartRace(RING, [{ name: 'A', pi: 50, ai: true }], 1)
      const k = race.karts[0]
      drive(race, 2)
      const t = race.track, i = (k.idx + 10) % t.n
      // Dropped in this kart's lane, as a kart driving the same line ahead would.
      const off = lateral(t, k.idx, k.x, k.z)
      race.smoke.push({ x: t.x[i] + t.nx[i] * off, z: t.z[i] + t.nz[i] * off, t: race.t - 1 })
      let smoked = false
      drive(race, 2, () => { if (shielded) k.shield = 1; smoked ||= k.smoke > 0 })
      expect(smoked).toBe(!shielded)
    }
  })

  it('a static storm zaps up to three karts ahead and no one behind', () => {
    const race = new KartRace(ALL[0], gpField(['A', 'B', 'C', 'D', 'E', 'F'], 2, 40, { name: 'Me', pi: 40 }).map((f) => ({ ...f, ai: true })), 3)
    drive(race, 6)
    const order = race.order()
    const user = order[4]
    order[2].shield = 5
    user.item = 'emp'
    race.useItem(user, order)
    expect(order[0].emp).toBe(0) // out of reach: four ahead
    expect(order[1].emp).toBeGreaterThan(0)
    expect(order[2].emp).toBe(0) // the shield took it
    expect(order[2].shield).toBe(0)
    expect(order[3].emp).toBeGreaterThan(0)
    expect(order[5].emp).toBe(0)
    // While zapped: no boost and the item can't be used.
    order[1].item = 'nitro'
    order[1].boost = 1
    race.step(1 / 60, [], true)
    expect(order[1].boost).toBe(0)
    expect(order[1].item).toBe('nitro')
  })

  it('a tow magnet reels you in to the kart ahead', () => {
    const run = (tow: boolean) => {
      const race = new KartRace(RING, [{ name: 'A', pi: 50, ai: true, skill: 1 }, { name: 'B', pi: 50, ai: true, skill: 1 }], 2)
      const [a, b] = race.karts
      drive(race, 3)
      shift(race, b, 0)
      shift(race, a, -30)
      a.vx = b.vx; a.vz = b.vz
      const gap = () => (race.progress(b) - race.progress(a)) * race.track.n
      const g0 = gap()
      if (tow) { a.item = 'tow'; race.useItem(a, race.order()) }
      expect(a.towTarget).toBe(tow ? b.id : -1)
      drive(race, 2.5)
      return g0 - gap()
    }
    expect(run(true)).toBeGreaterThan(run(false) + 6)
  })

  it('a race full of items still finishes, every kart within reach of the winner', () => {
    for (const t of [ALL[0], ALL[3], ALL[4]]) {
      const race = new KartRace(t, gpField(['A', 'B', 'C', 'D', 'E', 'F'], 3, 50, { name: 'Me', pi: 50 }).map((f) => ({ ...f, ai: true })), 11)
      const used = new Set<ItemId>()
      while (race.finishOrder.length < FIELD && race.t < 240) {
        for (const k of race.karts) if (k.item) used.add(k.item)
        race.step(1 / 60, [], true)
      }
      expect(race.finishOrder.length, t.def.id).toBe(FIELD)
      expect(used.size, t.def.id).toBeGreaterThan(4)
      const done = race.finishOrder.map((i) => race.karts[i].done!)
      expect(done[FIELD - 1] - done[0], t.def.id).toBeLessThan(30)
    }
  })
})
