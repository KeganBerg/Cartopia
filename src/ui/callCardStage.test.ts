import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CALL_CARDS, STOCK_CARD } from '../game/callCards'

// A car stands on a Call Card's ground only if the card says where that ground is (--f), what
// colour fills below its scene (--cc-base) and, for crate cards, the colour of its light
// (--cc-glow). A new card without them leaves the car floating in front of the scene.
const css = readFileSync(new URL('./call-cards.css', import.meta.url), 'utf8')

describe('Call Card stages', () => {
  for (const c of CALL_CARDS) {
    it(`${c.id} has a ground, a base colour${c.id === STOCK_CARD ? '' : ' and a light'}`, () => {
      const rule = css.match(new RegExp(`\\.cc-on-${c.id} \\{([^}]*)\\}`))?.[1] ?? ''
      const f = Number(rule.match(/--f:\s*([.\d]+)/)?.[1])
      // Low enough that the car isn't cut off, high enough that it isn't in the sky.
      expect(f).toBeGreaterThanOrEqual(0.55)
      expect(f).toBeLessThanOrEqual(0.85)
      expect(rule).toMatch(/--cc-base:\s*#[0-9a-f]{6}/)
      if (c.id !== STOCK_CARD) expect(rule).toMatch(/--cc-glow:\s*#[0-9a-f]{6}/)
    })
  }
})
