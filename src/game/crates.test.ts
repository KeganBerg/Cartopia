import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PIECE_SOURCES, restoTables } from './resto'
import { CARS, MODS, MOD_SKINS, SKINS, carDef, modDef, modFits } from './data'
import { CRATES, carCrate, carValue, carWorth, crateCars, crateDef, crateOdds, crateOddsShown, crateSkins, crateTables, crateValue, homeCars, homeMods, modChoices, modCrate, modWorth, rollCrate, rollSourcePiece, skinOdds, type CrateDrop } from './crates'

const dir = new URL('../../supabase/migrations/', import.meta.url)
// The newest migration holding the crate tables.
const serverTables = (tag = '$crates$') => {
  const sql = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8')).filter((s) => s.includes(tag)).pop()!
  const at = sql.indexOf(tag) + tag.length
  return JSON.parse(sql.slice(at, sql.indexOf(tag, at)))
}

// A repeatable random source.
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const garage = [{ uid: 'a', model: 'civic' }, { uid: 'b', model: 'miata', mods: ['chrome'] }]

describe('crates', () => {
  // When this fails, regenerate the tables in a new migration.
  it('rolls on the server from the same tables', () => {
    expect(serverTables()).toEqual(JSON.parse(JSON.stringify(crateTables())))
    expect(serverTables('$resto$')).toEqual(JSON.parse(JSON.stringify(restoTables())))
  })

  it('only holds cars your level has unlocked', () => {
    for (const c of CRATES) {
      for (const level of [c.unlockLevel, 10, 25, 50]) {
        const cars = crateCars(c, level)
        for (const car of cars) {
          expect(car.unlockLevel).toBeLessThanOrEqual(level)
          expect(car.season).toBeFalsy()
          if (c.pay === 'coins') expect(car.bucks ?? 0).toBe(0)
        }
      }
    }
  })

  it('puts every car and part in one crate by what it is worth', () => {
    for (const car of CARS) {
      const home = carCrate(car)
      // Season prize cars are only won on the season track.
      // Resto-mods are only built from pieces.
      if (car.season || car.parked || car.secret) { expect(home).toBeNull(); continue }
      expect(home, car.id).not.toBeNull()
      if (car.bucks) expect(crateDef(home!)!.pay).toBe('bucks')
    }
    for (const m of MODS) if (m.bucks) expect(crateDef(modCrate(m))!.pay).toBe('bucks')
    // Dearer crates hold dearer things: each coin-priced car or part is worth more than every one
    // in the crates below.
    for (let i = 1; i < CRATES.length; i++) {
      const below = CRATES.slice(0, i)
      const top = (xs: number[]) => Math.max(0, ...xs)
      const carsBelow = top(below.flatMap((c) => homeCars(c).filter((x) => !x.bucks).map(carWorth)))
      for (const car of homeCars(CRATES[i]).filter((x) => !x.bucks)) expect(carWorth(car), car.id).toBeGreaterThan(carsBelow)
      const modsBelow = top(below.flatMap((c) => homeMods(c).filter((x) => !x.bucks).map(modWorth)))
      for (const m of homeMods(CRATES[i]).filter((x) => !x.bucks)) expect(modWorth(m), m.id).toBeGreaterThan(modsBelow)
    }
  })

  it('gives the crate below\'s cars and parts until its own are in reach', () => {
    const diamond = crateDef('diamond')!
    const own = new Set(homeCars(diamond).map((x) => x.id))
    expect(crateCars(diamond, 10).length).toBeGreaterThan(0)
    expect(crateCars(diamond, 10).some((x) => own.has(x.id))).toBe(false)
    expect(crateCars(diamond, 50).every((x) => own.has(x.id))).toBe(true)
    // A two-car garage soon runs out of Diamond parts, then gets Gold ones.
    const parts = modChoices(diamond, 20, garage).flatMap((x) => x.mods)
    expect(parts.length).toBeGreaterThan(0)
  })

  it('keeps the car slice worth no more than its share of the crate', () => {
    for (const c of CRATES) {
      for (const level of [c.unlockLevel, 12, 24, 40, 50]) {
        if (level < c.unlockLevel) continue
        const o = crateOdds(c, level)
        expect(o.coins + o.jackpot + o.mod + o.car + o.skin + o.piece).toBeCloseTo(100)
        const pool = crateCars(c, level)
        const avg = pool.length / pool.reduce((a, x) => a + 1 / carValue(x, level), 0)
        expect((o.car / 100) * avg).toBeLessThanOrEqual(c.carShare * crateValue(c, level) + 1e-6)
      }
    }
  })

  it('gives fitting new parts, cars in reach and coins for duplicates', () => {
    const rand = seeded(7)
    for (const c of CRATES) {
      const level = 14
      const pool = crateCars(c, level).map((x) => x.id)
      for (let i = 0; i < 400; i++) {
        const d: CrateDrop = rollCrate(c, level, garage, rand)
        if (d.kind === 'mod') {
          const car = garage.find((g) => g.uid === d.car)!
          const m = modDef(d.mod)!
          expect(modFits(m, carDef(car.model).body)).toBe(true)
          expect(m.unlockLevel).toBeLessThanOrEqual(level)
          expect(car.mods ?? []).not.toContain(d.mod)
        } else if (d.kind === 'car') {
          expect(pool).toContain(d.model)
          expect(garage.some((g) => g.model === d.model)).toBe(false)
        } else if (d.kind === 'dupe') {
          expect(garage.some((g) => g.model === d.model)).toBe(true)
          expect(d.coins).toBeGreaterThan(0)
        } else if (d.kind === 'skin' || d.kind === 'skindupe') {
          expect(crateSkins(c).some((x) => x.id === d.skin && x.part === d.part)).toBe(true)
          if (d.kind === 'skindupe') expect(d.coins).toBeGreaterThan(0)
        } else if (d.kind === 'piece' || d.kind === 'piecedupe') {
          expect(carDef(d.model).secret).toBe(true)
          expect(carDef(d.model).unlockLevel).toBeLessThanOrEqual(level)
          if (d.kind === 'piecedupe') expect(d.coins).toBeGreaterThan(0)
        } else {
          expect(d.coins).toBeGreaterThan(0)
        }
      }
    }
  })

  it('pays coins when there is no car to fit a part to', () => {
    const rand = seeded(3)
    const street = crateDef('street')!
    expect(modChoices(street, 5, [])).toEqual([])
    for (let i = 0; i < 200; i++) expect(rollCrate(street, 5, [], rand).kind).not.toBe('mod')
  })

  it('holds every body and part skin in some crate, and pays coins for ones you have', () => {
    const anywhere = new Set(CRATES.flatMap((c) => crateSkins(c).map((x) => (x.part ? 'p:' : 'b:') + x.id)))
    // Weekly event skins are only won in their event.
    for (const d of SKINS) expect(anywhere.has('b:' + d.id), d.id).toBe(!('event' in d.unlock))
    for (const d of MOD_SKINS) expect(anywhere).toContain('p:' + d.id)
    for (const c of CRATES) {
      const odds = skinOdds(c)
      if (odds.length) expect(odds.reduce((a, x) => a + x.p, 0)).toBeCloseTo(1)
    }
    const diamond = crateDef('diamond')!
    const all = { skins: SKINS.map((d) => d.id), modSkins: MOD_SKINS.map((d) => d.id) }
    const rand = seeded(11)
    for (let i = 0; i < 300; i++) expect(rollCrate(diamond, 20, garage, rand, all).kind).not.toBe('skin')
    let won = 0
    for (let i = 0; i < 300; i++) if (rollCrate(diamond, 20, garage, rand).kind === 'skin') won++
    expect(won).toBeGreaterThan(10)
  })

  it('returns a bit less than a crate costs on average', () => {
    for (const c of CRATES) {
      for (const level of [Math.max(c.unlockLevel, 8), 20, 35]) {
        const rand = seeded(level * 31 + c.base)
        const v = crateValue(c, level)
        let total = 0
        const n = 3000
        for (let i = 0; i < n; i++) {
          const d = rollCrate(c, level, garage, rand)
          if (d.kind === 'coins' || d.kind === 'dupe') total += d.coins
          // Parts are counted at about a crate's worth, cars at their price.
          else if (d.kind === 'mod' || d.kind === 'skin' || d.kind === 'skindupe') total += d.kind === 'skindupe' ? d.coins : v
          else total += carValue(CARS.find((x) => x.id === d.model)!, level)
        }
        const ev = total / n / v
        expect(ev).toBeGreaterThan(0.6)
        expect(ev).toBeLessThan(1.4)
      }
    }
  })

  describe('resto-mod pieces', () => {
    // Pieces are rare (0.1%), so these rolls use a Diamond crate with a big piece slice.
    const real = crateDef('diamond')!
    const diamond = { ...real, odds: { ...real.odds, piece: 25 } }
    const restos = CARS.filter((c) => c.secret)
    it('rolls pieces for rewards outside crates', () => {
      const lvl = restos[0].unlockLevel
      expect(rollSourcePiece('nowhere', lvl, [], [], () => 0)).toBeNull()
      expect(rollSourcePiece('rusty_track', lvl, [], [], () => 0.99)).toBeNull()
      const d = rollSourcePiece('rusty_track', lvl, [], [`${restos[0].id}:0`], () => 0)
      expect(d).toEqual({ kind: 'piecedupe', model: restos[0].id, piece: 0, coins: PIECE_SOURCES.rusty_track.dupe })
    })
    it('keeps pieces rare', () => {
      for (const id of ['garage', 'gold', 'diamond']) expect(crateOddsShown(crateDef(id)!, 30).piece).toBe(0.1)
    })
    it('drops pieces of unlocked, unbuilt resto-mods only', () => {
      const rand = seeded(11)
      const built = [{ uid: 'z', model: restos[0].id }]
      for (let i = 0; i < 3000; i++) {
        const d = rollCrate(diamond, restos[0].unlockLevel, built, rand)
        if (d.kind !== 'piece' && d.kind !== 'piecedupe') continue
        expect(d.model).not.toBe(restos[0].id)
        expect(carDef(d.model).unlockLevel).toBeLessThanOrEqual(restos[0].unlockLevel)
      }
      expect(crateDef('street')!.odds.piece).toBe(0)
    })
    it('builds the car with the fourth piece and pays coins for a piece you have', () => {
      const m = restos[0].id
      const pieces = [`${m}:0`, `${m}:1`, `${m}:2`]
      let builds = 0
      let dupes = 0
      // Only this car is in reach, so every piece slice is one of its pieces.
      const rand = seeded(5)
      for (let i = 0; i < 4000; i++) {
        const d = rollCrate(diamond, restos[0].unlockLevel, [], rand, { skins: [], modSkins: [], pieces })
        if (d.kind === 'piecedupe') {
          dupes++
          expect(d.coins).toBeGreaterThan(0)
          expect(pieces).toContain(`${d.model}:${d.piece}`)
        }
        if (d.kind === 'piece') {
          expect([d.model, d.piece]).toEqual([m, 3])
          expect(restos[0].colors).toContain(d.color)
          expect(d.uid).toBeTruthy()
          builds++
        }
      }
      expect(builds).toBeGreaterThan(0)
      expect(dupes).toBeGreaterThan(builds)
    })
  })
})
