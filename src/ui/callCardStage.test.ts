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

// Kegan 10-17: a gold card showed a dark band between its frame and the art, and a second rounded
// corner inside the frame. The art must fill its frame edge to edge on every screen.
describe('Call Card art fills its frame', () => {
  const all = ['call-cards.css', 'race-menu.css', 'crates.css'].map((f) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')).join('\n')
  const fs = CALL_CARDS.map((c) => Number(css.match(new RegExp(`\\.cc-on-${c.id} \\{[^}]*--f:\\s*([.\\d]+)`))?.[1]))

  it('has square corners, so no second corner shows inside a rounded frame', () => {
    const rule = css.match(/^\.cc \{([^}]*)\}/m)?.[1] ?? ''
    expect(rule).toContain('inset: 0')
    expect(rule).not.toMatch(/border-radius/)
  })

  it('only ever slides up on a stage, never down (no band above it)', () => {
    const rule = css.match(/\.cc-stage > \.cc \{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/top:\s*min\(0%,/)
  })

  it('every stage puts its ground at or above every card\'s own ground', () => {
    const gs = [...all.matchAll(/\{[^}]*?--g:\s*([^;}]+)/g)].map((m) => m[1].trim())
    expect(gs.length).toBeGreaterThan(0)
    for (const g of gs) {
      if (g.startsWith('var(--f')) continue
      expect(Number(g), `--g: ${g}`).toBeLessThanOrEqual(Math.min(...fs))
    }
  })
})
