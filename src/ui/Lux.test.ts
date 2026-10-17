import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { BUCKS_PACKS, CAR_PACKS } from '../game/bucksPacks'
import { LUX_TOP, luxLevels } from './Lux'

describe('pack cards get richer with price (Kegan, 2026-10-17)', () => {
  for (const [name, packs] of [['gem packs', BUCKS_PACKS], ['car packs', CAR_PACKS]] as const) {
    it(`${name}: cheapest plain, dearest the most, never less for more money`, () => {
      const prices = packs.map((p) => p.price)
      const lux = luxLevels(prices)
      const order = prices.map((p, i) => [p, lux[i]]).sort((a, b) => a[0] - b[0])
      expect(order[0][1]).toBe(0)
      expect(order.at(-1)![1]).toBe(LUX_TOP)
      for (let i = 1; i < order.length; i++) expect(order[i][1]).toBeGreaterThanOrEqual(order[i - 1][1])
    })
  }
  it('every gem pack is its own step up', () => {
    expect(new Set(luxLevels(BUCKS_PACKS.map((p) => p.price))).size).toBe(BUCKS_PACKS.length)
  })
  it('both shops draw the effect layer', () => {
    for (const f of ['Bank.tsx', 'CarPacks.tsx']) expect(readFileSync(new URL(f, import.meta.url), 'utf8')).toContain('<LuxFx')
  })
  it('stays phone-cheap: only transforms, opacity and the glow animate', () => {
    const css = readFileSync(new URL('lux.css', import.meta.url), 'utf8')
    for (const [, body] of css.matchAll(/@keyframes \w+ \{([^@]*?)\}\s*(?=@|\.|\/\*|$)/g)) {
      for (const [, prop] of body.matchAll(/([a-z-]+):/g)) expect(['transform', 'opacity', 'box-shadow']).toContain(prop)
    }
  })
})
