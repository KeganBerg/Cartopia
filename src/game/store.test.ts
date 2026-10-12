// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { useGame, readyRewards, today, buildPrice, paintPrice } from './store'
import { boostsSpent } from './boosts'
import { CAMPAIGN, CAMPAIGN_RACES, DEALS, DEAL_SLOTS, buildingDef, campaignReward, carDef, dealOffer, dealsFor, finishDef, modDef, upgradeCost, xpToNext } from './data'

describe('level-up bonuses', () => {
  it('add on top of a race reward instead of replacing it', () => {
    // A Monday with today's bonuses used, so the race pays its plain prize.
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 12, 12))
    useGame.setState({ level: 1, xp: xpToNext(1) - 1, coins: 1000, bucks: 10, levelUp: null, boosts: boostsSpent(Date.UTC(2026, 9, 12, 12)) })
    useGame.getState().finishRace(true, 500)
    vi.restoreAllMocks()
    const s = useGame.getState()
    expect(s.level).toBe(2)
    expect(s.coins).toBe(1000 + 500 + 200)
    expect(s.bucks).toBe(11)
  })

  it('still charge for a mod that levels you up', () => {
    const car = { uid: 'c2', model: 'pip', color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }
    useGame.setState({ level: 9, xp: xpToNext(9) - 1, coins: 10000, parts: 50, bucks: 10, levelUp: null, cars: [car], deals: { day: today(), used: DEALS.map((d) => d.id) } })
    expect(useGame.getState().modCar('c2', 'gtwing')).toBe(true)
    const s = useGame.getState()
    expect(s.level).toBe(10)
    expect(s.coins).toBe(10000 - 4000 + 1000)
    expect(s.bucks).toBe(11)
  })

  it('never take away fuel already above the new tank size', () => {
    useGame.setState({ level: 1, xp: xpToNext(1) - 1, coins: 1000, bucks: 10, fuel: 500, levelUp: null })
    useGame.getState().finishRace(true, 0)
    expect(useGame.getState().level).toBe(2)
    expect(useGame.getState().fuel).toBe(500)
  })

  it('still charge for a car upgrade that levels you up', () => {
    const car = { uid: 'c1', model: 'pip', color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }
    useGame.setState({ level: 1, xp: xpToNext(1) - 1, coins: 2500, parts: 10, bucks: 10, levelUp: null, cars: [car] })
    const cost = upgradeCost(carDef('pip'), 0)
    expect(useGame.getState().upgradeCar('c1', 'engine')).toBe(true)
    const s = useGame.getState()
    expect(s.level).toBe(2)
    expect(s.coins).toBe(2500 - cost.coins + 200)
    expect(s.parts).toBe(10 - cost.parts)
  })
})

describe('car mods', () => {
  it('keeps swapped-out parts so they go back on for free', () => {
    const car = { uid: 'm1', model: 'pip', color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }
    // Today's deals all used, so full prices apply whatever the date.
    useGame.setState({ level: 10, xp: 0, coins: 10000, parts: 50, bucks: 0, levelUp: null, cars: [car], deals: { day: today(), used: DEALS.map((d) => d.id) } })
    const g = () => useGame.getState()
    expect(g().modCar('m1', 'ducktail')).toBe(true)
    expect(g().modCar('m1', 'gtwing')).toBe(true)
    expect(g().coins).toBe(10000 - 1200 - 4000)
    expect(g().cars[0].mods).toEqual(['gtwing'])
    expect(g().cars[0].ownedMods).toEqual(['ducktail', 'gtwing'])
    // Back to the ducktail: no charge.
    expect(g().modCar('m1', 'ducktail')).toBe(true)
    expect(g().coins).toBe(10000 - 1200 - 4000)
    expect(g().cars[0].mods).toEqual(['ducktail'])
    // Taking it off keeps it owned.
    expect(g().modCar('m1', 'ducktail', true)).toBe(true)
    expect(g().cars[0].mods).toEqual([])
    expect(g().cars[0].ownedMods).toEqual(['ducktail', 'gtwing'])
  })
})

describe('welcome back report', () => {
  it('previews exactly what Collect All pays', () => {
    const past = Date.now() - 1000
    const later = Date.now() + 600_000
    const b = (uid: string, def: string, jobEndsAt: number | null, level?: number) => ({ uid, def, x: 0, z: 0, jobEndsAt, level })
    useGame.setState({
      level: 5, xp: 0, coins: 0, parts: 0, fuel: 0, levelUp: null,
      cars: [{ uid: 'g1', model: 'pip', color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 }, lowFuel: true }],
      buildings: [b('r', 'rescue', null), b('g', 'gas', null), b('p1', 'pizza', past), b('p2', 'pizza', past, 3), b('t', 'tires', past), b('d', 'diner', later)],
    })
    const r = readyRewards(useGame.getState(), Date.now())
    expect(r.collected).toBe(3)
    expect(r.filled).toBe(1)
    expect(r.jobs.map((j) => [j.def, j.n])).toEqual(expect.arrayContaining([['pizza', 2], ['tires', 1]]))
    useGame.getState().collectAll(true)
    const s = useGame.getState()
    expect(s.coins).toBe(r.coins)
    expect(s.parts).toBe(r.parts)
    expect(s.buildings.find((o) => o.uid === 'd')?.jobEndsAt).toBe(later)
  })
})

describe('campaign', () => {
  const g = () => useGame.getState()
  const start = () => useGame.setState((s) => ({ level: 20, xp: 0, coins: 0, bucks: 0, trophies: 0, campaign: {}, campaignPrize: null, levelUp: null, boosts: s.boosts && { ...s.boosts, streak: 0 } }))

  it('pays the full reward for a first win and less for a replay', () => {
    start()
    const first = campaignReward(CAMPAIGN[0], 0, true)
    expect(g().campaignResult('c1', 0, 9, 9.2)).toBe(1)
    expect(g().coins).toBe(first)
    expect(g().campaign['c1-0']).toBe(1)
    useGame.setState((s) => ({ boosts: s.boosts && { ...s.boosts, streak: 0 } })) // no win-streak bonus on the payout checked
    g().campaignResult('c1', 0, 9, 10)
    expect(g().coins).toBe(first + campaignReward(CAMPAIGN[0], 0, false))
    expect(g().campaign['c1-0']).toBe(3)
    // A loss never takes stars away.
    expect(g().campaignResult('c1', 0, 10, 9)).toBe(0)
    expect(g().campaign['c1-0']).toBe(3)
  })

  it('pays the chapter bonus once, and the star bonus once', () => {
    start()
    for (let i = 0; i < CAMPAIGN_RACES; i++) g().campaignResult('c1', i, 9, 9.1)
    const ch = CAMPAIGN[0]
    expect(g().bucks).toBe(ch.bucks)
    expect(g().campaignPrize).toMatchObject({ chapter: 'c1', cleared: true, perfect: false, coins: ch.coins })
    g().campaignResult('c1', 0, 9, 9.1)
    expect(g().bucks).toBe(ch.bucks)
    for (let i = 0; i < CAMPAIGN_RACES; i++) g().campaignResult('c1', i, 9, 10)
    expect(g().bucks).toBe(ch.bucks + ch.starBucks)
    expect(g().campaignPrize).toMatchObject({ cleared: false, perfect: true, coins: 0 })
  })
})

describe('daily and weekly tasks', () => {
  it('count from when the day began, pay once each, and open the chest after all three', async () => {
    const { rolledQuests, taskProgress } = await import('./store')
    const { QUEST_PAY, payAt, xpToNext: toNext } = await import('./data')
    const g = () => useGame.getState()
    useGame.setState({ level: 5, xp: 0, coins: 0, parts: 0, bucks: 0, fuel: 0, levelUp: null, quests: null, stats: { ...g().stats, jobs: 50, races: 7 } })
    useGame.setState({ quests: rolledQuests(g()) })
    const q = g().quests!
    expect(q.daily).toHaveLength(3)
    expect(q.dayBase.jobs).toBe(50)
    // Finish every task by bumping each counter past its target.
    const stats = { ...g().stats }
    for (const t of q.daily) {
      const stat = (await import('./store')).taskDef('daily', t.id)!.stat
      stats[stat] = (q.dayBase[stat] ?? 0) + t.n
    }
    useGame.setState({ stats })
    for (const t of q.daily) expect(taskProgress(g(), 'daily', t)).toBeGreaterThanOrEqual(t.n)
    g().claimChest('daily')
    expect(g().quests!.dayChest).toBe(false)
    for (const t of q.daily) g().claimTask('daily', t.id)
    g().claimTask('daily', q.daily[0].id)
    const pay = payAt(QUEST_PAY.daily.task, 5)
    expect(g().coins).toBe(pay.coins * 3)
    expect(g().xp + (g().level > 5 ? toNext(5) : 0)).toBeGreaterThan(0)
    g().claimChest('daily')
    g().claimChest('daily')
    expect(g().quests!.dayChest).toBe(true)
    expect(g().parts).toBe(QUEST_PAY.daily.chest.parts)
    expect(g().coins).toBe(pay.coins * 3 + payAt(QUEST_PAY.daily.chest, 5).coins)
    // Same day: nothing rolls over.
    expect(rolledQuests(g())).toBeNull()
    // Next day: fresh daily tasks, the week carries on.
    const next = rolledQuests(g(), Date.now() + 86400000)!
    expect(next.dayDone).toEqual([])
    expect(next.dayChest).toBe(false)
  })
})

describe('story goals', () => {
  it('credit things the town already has and wait for their level', async () => {
    const { activeGoals, goalDone } = await import('./store')
    const { GOALS } = await import('./data')
    const club = GOALS.find((x) => x.def === 'club')!
    useGame.setState({ level: 5, claimedGoals: GOALS.filter((x) => x.id !== club.id).map((x) => x.id) })
    expect(activeGoals(useGame.getState())).toEqual([])
    useGame.setState({ level: 6, buildings: [...useGame.getState().buildings, { uid: 'club1', def: 'club', x: 0, z: 0, jobEndsAt: null }] })
    expect(activeGoals(useGame.getState()).map((x) => x.id)).toEqual([club.id])
    expect(goalDone(useGame.getState(), club)).toBe(true)
  })
})

describe('collection sets', () => {
  const g = () => useGame.getState()
  const car = (model: string) => ({ uid: model, model, color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } })

  it('pays a full set once and ignores an incomplete one', () => {
    useGame.setState({ level: 20, xp: 0, coins: 0, bucks: 0, trophies: 0, claimedSets: [], levelUp: null, cars: ['pip', 'civic', 'trail', 'miata'].map(car) })
    g().claimSet('bikes')
    expect(g().coins).toBe(0)
    g().claimSet('daily')
    expect(g().claimedSets).toEqual(['daily'])
    expect([g().coins, g().bucks, g().trophies, g().xp]).toEqual([1500, 2, 5, 60])
    g().claimSet('daily')
    expect(g().coins).toBe(1500)
  })
})

describe('daily deals', () => {
  const car = { uid: 'd1', model: 'pip', color: '#e53935', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }
  const g = () => useGame.getState()

  it('picks one deal per slot, the same for a given day, rotating day to day', () => {
    expect(dealsFor('2026-10-11')).toEqual(dealsFor('2026-10-11'))
    expect(dealsFor('2026-10-11').map((d) => d.id)).toEqual(DEAL_SLOTS.map((s, i) => {
      const n = Date.UTC(2026, 9, 11) / 86400000
      return s.deals[(n * s.step + i) % s.deals.length].id
    }))
    const week = new Set(Array.from({ length: 7 }, (_, i) => dealsFor(`2026-10-${String(11 + i).padStart(2, '0')}`)[2].id))
    expect(week.size).toBeGreaterThan(4)
    for (const d of DEALS) {
      const o = dealOffer(d)
      expect(o.now.coins + o.now.bucks * 1000).toBeLessThan(o.was.coins + o.was.bucks * 1000)
    }
  })

  it('sells each of today\'s deals once at the deal price', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // Two weeks covers both car-shop kinds (mods and paint) and every supplies deal.
    for (let day = 0; day < 14; day++) {
      vi.setSystemTime(Date.UTC(2026, 9, 11 + day, 12))
      useGame.setState({ level: 20, xp: 0, coins: 50000, parts: 100, bucks: 20, fuel: 0, levelUp: null, cars: [car], deals: null })
      const [supplies, carDeal, decor] = dealsFor(today())
      // Supplies: bought straight from the panel, then sold out.
      const o = dealOffer(supplies)
      expect(g().buyDeal(supplies.id)).toBe(true)
      expect(g().coins).toBe(50000 - o.now.coins)
      expect(g().bucks).toBe(20 - o.now.bucks)
      expect(g().buyDeal(supplies.id)).toBe(false)
      // Decor: the Shop price drops for one build.
      const b = buildingDef(decor.item!)
      expect(buildPrice(g(), b.id).coins).toBe(dealOffer(decor).now.coins)
      useGame.setState({ deals: { day: today(), used: [...g().deals!.used, decor.id] } })
      expect(buildPrice(g(), b.id)).toMatchObject({ coins: b.price, deal: null })
      // Car deals: the mod or finish is cheaper until it's bought once.
      const before = g().coins
      if (carDeal.kind === 'mod') {
        expect(g().modCar('d1', carDeal.item!)).toBe(true)
        expect(before - g().coins).toBe(dealOffer(carDeal).now.coins)
        expect(modDef(carDeal.item!)!.coins).toBe(dealOffer(carDeal).was.coins)
      } else {
        const job = { color: car.color, finish: carDeal.item as 'matte' | 'chrome', stripe: null }
        expect(paintPrice(g(), g().cars[0], job).coins).toBe(dealOffer(carDeal).now.coins)
        expect(g().paintCar('d1', job)).toBe(true)
        expect(before - g().coins).toBe(dealOffer(carDeal).now.coins)
        expect(finishDef(job.finish).coins).toBe(dealOffer(carDeal).was.coins)
      }
      expect(g().deals).toEqual({ day: today(), used: [supplies.id, decor.id, carDeal.id] })
    }
    vi.useRealTimers()
  })

  it('forgets yesterday\'s purchases', () => {
    const [supplies] = dealsFor(today())
    useGame.setState({ level: 20, coins: 50000, bucks: 20, fuel: 0, deals: { day: '2000-01-01', used: [supplies.id] } })
    expect(g().buyDeal(supplies.id)).toBe(true)
    expect(g().deals).toEqual({ day: today(), used: [supplies.id] })
  })
})

describe('tutorial paint pick', () => {
  const car = () => ({ uid: 't1', model: 'pip', color: '#e53935', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } })

  it('paints the body and rims in starter colours for free, once, during the tutorial', () => {
    useGame.setState({ tutorial: 6, coins: 100, bucks: 0, xp: 0, cars: [car()] })
    const stats = useGame.getState().stats
    expect(useGame.getState().tutorialStyle('t1', '#1e88e5', '#212121')).toBe(true)
    const s = useGame.getState()
    expect(s.cars[0].color).toBe('#1e88e5')
    expect(s.cars[0].panels).toEqual({ rims: { color: '#212121' } })
    expect([s.coins, s.bucks, s.xp, s.stats]).toEqual([100, 0, 0, stats])
  })

  it('refuses locked colours and finished tutorials', () => {
    useGame.setState({ tutorial: 6, cars: [car()] })
    expect(useGame.getState().tutorialStyle('t1', '#ffd700', '#212121')).toBe(false)
    expect(useGame.getState().tutorialStyle('t1', '#1e88e5', '#8e24aa')).toBe(false)
    useGame.setState({ tutorial: 99 })
    expect(useGame.getState().tutorialStyle('t1', '#1e88e5', '#212121')).toBe(false)
    expect(useGame.getState().cars[0].color).toBe('#e53935')
  })
})

describe('selling a car', () => {
  it('takes it off the meet display and stops racing with it', () => {
    const car = (uid: string) => ({ uid, model: 'pip', color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } })
    useGame.setState({ cars: [car('s1'), car('s2')], showcase: ['s1', 's2'], raceCar: 's1', buildings: [], coins: 0 })
    useGame.getState().sellCar('s1')
    const s = useGame.getState()
    expect(s.cars.map((c) => c.uid)).toEqual(['s2'])
    expect(s.showcase).toEqual(['s2'])
    expect(s.raceCar).toBeNull()
  })
})

describe('second bug hunt', () => {
  const car = (uid: string, model = 'pip') => ({ uid, model, color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } })

  it("won't sell a gem car for nothing", () => {
    useGame.setState({ cars: [car('g1', 'sovereign'), car('g2')], buildings: [], coins: 0, toast: () => {} })
    useGame.getState().sellCar('g1')
    expect(useGame.getState().cars.map((c) => c.uid)).toEqual(['g1', 'g2'])
  })

  it('only counts a paid paint job toward painting goals', () => {
    useGame.setState({ cars: [{ ...car('p1'), stripe: '#fafafa', panels: { hood: { color: '#e53935' } } } as never], coins: 0, bucks: 0, stats: {} as never })
    expect(useGame.getState().paintCar('p1', { color: '#fff', finish: 'gloss', stripe: null })).toBe(true)
    expect(useGame.getState().paintPanels('p1', {})).toBe(true)
    expect(useGame.getState().stats.painted ?? 0).toBe(0)
  })

  it('counts a car from a crate as a new car', () => {
    useGame.setState({ cars: [car('c1')], coins: 1000, crates: 0, stats: {} as never })
    useGame.getState().applyCrate({ seq: 1, crate: 'street', cost: { coins: 300, bucks: 0 }, drop: { kind: 'car', model: 'pip', uid: 'c9', color: '#fff' } })
    expect(useGame.getState().cars).toHaveLength(2)
    expect(useGame.getState().stats.carsBought).toBe(1)
  })
})
