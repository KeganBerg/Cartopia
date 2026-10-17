import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PAY_BUILDING, canBuyPacks } from './payGate'
import { BUILDINGS } from './data'

describe('pay gate', () => {
  it('opens on the Crew House', () => {
    expect(BUILDINGS.find((b) => b.id === PAY_BUILDING)?.name).toBe('Crew House')
    expect(canBuyPacks({ buildings: [] })).toBe(false)
    expect(canBuyPacks({ buildings: null })).toBe(false)
    expect(canBuyPacks({ buildings: [{ def: 'crew' }] })).toBe(true)
    expect(canBuyPacks({ buildings: [{ def: 'crew' }] as unknown as null })).toBe(true)
    expect(canBuyPacks({ buildings: [], admin: true })).toBe(true)
  })

  // Every way into the Bank or Car Packs goes through the gate. A new button that opens either
  // one has to be added here on purpose, behind unlocked(s, 'bank').
  it('nothing opens a real-money menu outside the gated places', () => {
    const dir = new URL('../ui/', import.meta.url)
    const hits = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
      .flatMap((f) => [...readFileSync(new URL(f, dir), 'utf8').matchAll(/(openPanel|swapPanel)\(\s*['"](bank|carpacks)['"]/g)].map(() => f))
    expect([...new Set(hits)].sort()).toEqual(['Hud.tsx', 'Need.tsx'])
    const hud = readFileSync(new URL('Hud.tsx', dir), 'utf8')
    expect(hud).toContain("bank.on ? s.openPanel('bank')")
    expect(hud).not.toMatch(/gems\.on && <button className={`goals-btn bank-btn/)
    expect(readFileSync(new URL('Need.tsx', dir), 'utf8')).toMatch(/unlocked\(s, 'bank'\) \? \[\{ icon: '🏦'/)
    const app = readFileSync(new URL('../App.tsx', dir), 'utf8')
    expect(app).toContain("panel === 'bank' && bankOn")
    expect(app).toContain("panel === 'carpacks' && bankOn")
  })

  it('checkout refuses a town without one', () => {
    const fn = readFileSync(new URL('../../netlify/functions/checkout.mts', import.meta.url), 'utf8')
    expect(fn).toMatch(/if \(!canBuyPacks\(\{ buildings: row\?\.buildings \}\)\)/)
    expect(fn).toContain("json({ error: 'crew' }, 403)")
  })
})
