import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { openCrate, setCrateOpener, useGame } from './store'
import { crateCost, crateDef, dropTier, revealOrder, type CrateDrop, type CrateOpen } from './crates'

const g = () => useGame.getState()

describe('open ×10', () => {
  beforeEach(() => {
    setCrateOpener(null)
    useGame.setState({ level: 30, coins: 10_000_000, bucks: 100_000, crates: 0, cratePity: {}, freeCrates: [], skins: [], modSkins: [], hats: [], restoParts: [] })
  })

  it('charges ten times the single price and gives ten prizes (a guest rolls them in the browser)', async () => {
    const one = crateCost(crateDef('gold')!, 30)
    const before = { coins: g().coins, bucks: g().bucks }
    const got = await openCrate('gold', undefined, 10)
    expect(got).toHaveLength(10)
    expect(got!.every((o) => o.cost.bucks === one.bucks && o.cost.coins === one.coins)).toBe(true)
    expect(g().bucks).toBe(before.bucks - one.bucks * 10)
    // Coins only go up by what was won.
    const won = got!.reduce((a, o) => a + ('coins' in o.drop ? o.drop.coins : 0), 0)
    expect(g().coins).toBe(before.coins + won)
  })

  it('opens none when ten cost more than you have', async () => {
    const one = crateCost(crateDef('gold')!, 30)
    useGame.setState({ bucks: one.bucks * 10 - 1 })
    expect(await openCrate('gold', undefined, 10)).toBeNull()
    expect(g().bucks).toBe(one.bucks * 10 - 1)
  })

  it('asks the server for all ten in one call when signed in, and adds what comes back', async () => {
    const calls: (number | undefined)[] = []
    const opens: CrateOpen[] = Array.from({ length: 10 }, (_, i) => ({ seq: i + 1, crate: 'street', cost: { coins: 100, bucks: 0 }, drop: { kind: 'coins', coins: 50, jackpot: false } }))
    setCrateOpener(async (_c, _f, count) => {
      calls.push(count)
      return opens
    })
    const before = g().coins
    expect(await openCrate('street', undefined, 10)).toHaveLength(10)
    expect(calls).toEqual([10])
    expect(g().crates).toBe(10)
    expect(g().coins).toBe(before - 1000 + 500)
  })

  it('never opens a free crate ten times', async () => {
    const counts: (number | undefined)[] = []
    setCrateOpener(async (_c, _f, count) => {
      counts.push(count)
      return [{ seq: 1, crate: 'garage', cost: { coins: 0, bucks: 0 }, drop: { kind: 'coins', coins: 5, jackpot: false } }]
    })
    useGame.setState({ freeCrates: ['cup:city-1'] })
    await openCrate('garage', 'cup:city-1', 10)
    expect(counts).toEqual([1])
  })
})

describe('revealOrder', () => {
  it('shows the rarest last and keeps ties in the order they were opened', () => {
    const drops: CrateDrop[] = [
      { kind: 'car', model: 'vette', uid: 'k1', color: '#fff' },
      { kind: 'coins', coins: 900, jackpot: false },
      { kind: 'mod', car: 'c', mod: 'attackwing' },
      { kind: 'coins', coins: 4000, jackpot: true },
      { kind: 'coins', coins: 300, jackpot: false },
      { kind: 'dupe', model: 'civic', coins: 700 },
    ]
    const order = revealOrder(drops.map((drop, i) => ({ i, drop }))).map((o) => o.i)
    expect(order[order.length - 1]).toBe(0)
    expect(order.slice(0, 3)).toEqual([4, 1, 5])
    const tiers = revealOrder(drops.map((drop) => ({ drop }))).map((o) => dropTier(o.drop))
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers)
  })
})

describe('crate_open_many (0082)', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/0082_crate_open_many.sql', import.meta.url), 'utf8')
  it('rolls each open with crate_open itself and checks the whole price', () => {
    expect(sql).toContain('o := public.crate_open(p_crate);')
    expect(sql).toMatch(/\* p_count/)
    expect(sql).toContain("set_config('econ.crate_batch', me::text, true)")
    // No second copy of the crate table to go stale: it's read from crate_open() itself.
    expect(sql.match(/\$crates\$\{/g)).toHaveLength(1)
  })
})
