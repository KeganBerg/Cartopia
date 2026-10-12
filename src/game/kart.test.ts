import { describe, expect, it } from 'vitest'
import { BOMB_R, CATCH_UP, catchUp, DRIFT_ORANGE, FIELD, GHOST_TIME, KartRace, LAPS, TRACKS, buildTrack, gpField, idleInput, itemOdds, kartStats, lateral, locate, type ItemId, type Kart } from './kart'

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
  const CATCH: ItemId[] = ['nitro', 'hornet', 'tow', 'emp', 'nitro3', 'splat', 'rocket']
  const sum = (o: Record<ItemId, number>, ids: ItemId[]) => ids.reduce((a, id) => a + o[id], 0)

  it('leaders get defence, the back of the field gets the catch-up', () => {
    for (let r = 0; r < FIELD; r++) expect(Object.values(itemOdds(r)).reduce((a, b) => a + b)).toBeCloseTo(1)
    expect(itemOdds(0).emp).toBe(0)
    expect(itemOdds(1).emp).toBe(0)
    for (const id of ['splat', 'nitro3', 'rocket'] as ItemId[]) expect(itemOdds(1)[id], id).toBe(0)
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

  it('a hornet flies past a kart that has already finished', () => {
    const race = new KartRace(RING, [{ name: 'A', pi: 40, ai: false }, { name: 'B', pi: 40, ai: false }, { name: 'C', pi: 40, ai: false }], 1)
    const [a, b, c] = race.karts
    shift(race, a, 60); shift(race, b, 30)
    a.done = 50; race.finishOrder.push(a.id)
    c.item = 'hornet'
    race.useItem(c, race.order())
    expect(race.hornets.map((h) => h.target)).toEqual([b.id])
  })
})

describe('kart items, second batch', () => {
  // Karts driven by the test (not the AI, which would use whatever they hold).
  const field = (n: number) => Array.from({ length: n }, (_, i) => ({ name: 'K' + i, pi: 50, ai: false, skill: 1 }))
  const run = (race: KartRace, secs: number) => {
    for (let f = 0; f < secs * 60; f++) race.step(1 / 60, race.karts.map((k) => ({ ...race.autoInput(k, race.order(), false), item: false })), true)
  }

  it('a Nitro Triple boosts three times, then the slot is empty', () => {
    const race = new KartRace(RING, field(1), 1)
    const k = race.karts[0]
    run(race, 2)
    k.item = 'nitro3'; k.uses = 3
    for (let n = 0; n < 3; n++) {
      expect(k.item).toBe('nitro3')
      race.useItem(k, race.order())
      expect(k.boost).toBeGreaterThan(1)
      run(race, 1.5)
    }
    expect(k.item).toBe(null)
    expect(race.notes.filter((x) => x.k === 'item').map((x) => (x as { target: number }).target)).toEqual([2, 1, 0])
  })

  it('Phantom Mode drives through karts and hazards untouched', () => {
    const race = new KartRace(RING, field(2), 1)
    const [a, b] = race.karts
    run(race, 2)
    a.item = 'ghost'
    race.useItem(a, race.order())
    expect(a.ghost).toBe(GHOST_TIME)
    // Oil right under it, a hornet on it, and the other kart sat on top of it: nothing.
    race.oil.push({ x: a.x, z: a.z, t: race.t - 1 })
    race.hit(a)
    race.step(1 / 60, [], true)
    expect(a.spin).toBe(0)
    expect(race.oil.length).toBe(1)
    race.oil = []
    b.x = a.x + 0.3; b.z = a.z; b.y = a.y; b.vx = 0; b.vz = 0
    const bx = b.x
    race.step(1 / 60, [], true)
    expect(Math.abs(b.x - bx)).toBeLessThan(0.1)
    // Once it wears off, the oil bites again.
    a.ghost = 0
    race.oil.push({ x: a.x, z: a.z, t: race.t - 1 })
    race.step(1 / 60, [], true)
    expect(a.spin).toBeGreaterThan(0)
  })

  it('a Bumper Bomb lands up the road and spins out whoever is near it', () => {
    const race = new KartRace(RING, field(3), 1)
    const [a, b, c] = race.karts
    run(race, 2)
    shift(race, b, 20)
    shift(race, c, 60)
    a.item = 'bomb'
    race.useItem(a, race.order())
    expect(race.bombs.length).toBe(1)
    const bomb = race.bombs[0]
    expect(Math.hypot(bomb.x - a.x, bomb.z - a.z)).toBeGreaterThan(10)
    // Park b on the landing spot.
    b.x = bomb.x + 1; b.z = bomb.z; b.vx = 0; b.vz = 0
    for (let f = 0; f < 60; f++) { b.vx = 0; b.vz = 0; race.step(1 / 60, [], true) }
    expect(Math.hypot(b.x - bomb.x, b.z - bomb.z)).toBeLessThan(BOMB_R)
    expect(b.spin).toBeGreaterThan(0)
    expect(c.spin).toBe(0)
    expect(a.spin).toBe(0)
  })

  it('a Paint Splat hits everyone ahead (not through a shield) and costs the AI pace', () => {
    const race = new KartRace(ALL[0], gpField(['A', 'B', 'C', 'D', 'E', 'F'], 2, 40, { name: 'Me', pi: 40 }).map((f) => ({ ...f, ai: true })), 3)
    drive(race, 6)
    const order = race.order()
    for (const k of order) { k.shield = 0; k.ghost = 0; k.rocket = 0 }
    order[1].shield = 5
    order[4].item = 'splat'
    race.useItem(order[4], order)
    expect(order.map((k) => k.splat > 0)).toEqual([true, false, true, true, false, false])

    const pace = (splat: boolean) => {
      const r = new KartRace(ALL[0], [{ name: 'A', pi: 50, ai: true, skill: 1 }], 1)
      drive(r, 3)
      const p0 = r.progress(r.karts[0])
      drive(r, 3, ([k]) => { if (splat) k.splat = 1 })
      return r.progress(r.karts[0]) - p0
    }
    expect(pace(true)).toBeLessThan(pace(false) * 0.97)
  })

  it('a Rocket Ride drives itself up the field and bowls karts aside', () => {
    const go = (rocket: boolean) => {
      const race = new KartRace(ALL[0], field(1), 1)
      const k = race.karts[0]
      run(race, 2)
      const p0 = race.progress(k)
      if (rocket) { k.item = 'rocket'; race.useItem(k, race.order()) }
      // No input at all: the rocket steers.
      let hits = 0
      for (let f = 0; f < 3 * 60; f++) { race.step(1 / 60, [rocket ? idleInput() : { ...race.autoInput(k, race.order(), false), item: false }], true); hits += race.events.filter((e) => e.kind === 'wall').length }
      return { gone: (race.progress(k) - p0) * race.track.n, hits }
    }
    const plain = go(false), rocket = go(true)
    expect(rocket.gone).toBeGreaterThan(plain.gone * 1.15)
    expect(rocket.hits).toBeLessThanOrEqual(1)

    // Through a kart and an oil slick: the kart spins, the rocket doesn't.
    const race = new KartRace(RING, field(2), 1)
    const [a, b] = race.karts
    run(race, 2)
    a.item = 'rocket'
    race.useItem(a, race.order())
    race.oil.push({ x: a.x, z: a.z, t: race.t - 1 })
    b.x = a.x + 0.8; b.z = a.z
    race.step(1 / 60, [], true)
    expect(b.spin).toBeGreaterThan(0)
    expect(a.spin).toBe(0)
  })
})

describe('kart catch-up', () => {
  it('gives the back half a small boost, most at the very back, none up front', () => {
    expect(catchUp(0, 8)).toBe(0)
    expect(catchUp(3, 8)).toBe(0)
    expect(catchUp(5, 8)).toBeGreaterThan(0)
    expect(catchUp(7, 8)).toBeCloseTo(CATCH_UP)
    expect(catchUp(6, 8)).toBeLessThan(catchUp(7, 8))
    expect(catchUp(0, 1)).toBe(0)
  })
})
