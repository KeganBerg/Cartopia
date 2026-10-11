import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CARS, MOD_SKINS, SKINS, carDef, modDef, modFits } from './data'
import { CRATES, carValue, crateCars, crateDef, crateSkins, crateTables, crateValue, modChoices, rollCrate, skinOdds, type CrateDrop } from './crates'

const dir = new URL('../../supabase/migrations/', import.meta.url)
// The newest migration holding the crate tables.
const serverTables = () => {
  const tag = '$crates$'
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
  })

  it('only holds cars your level has unlocked', () => {
    for (const c of CRATES) {
      for (const level of [c.unlockLevel, 10, 25, 50]) {
        const cars = crateCars(c, level)
        for (const car of cars) {
          expect(car.unlockLevel).toBeLessThanOrEqual(level)
          expect(car.rescueOnly || car.season).toBeFalsy()
          if (!c.gemCars) expect(car.bucks ?? 0).toBe(0)
        }
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
})
