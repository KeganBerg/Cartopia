// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mergeGroups, mergeCandidates, applyMerge, applySplit, groupTurn, groupScale, rotateGroup, isLandmark, mergeBoosts } from './merge'
import { useGame, readyRewards, fuelCap, type PlacedBuilding } from './store'
import { buildingDef, buildingUpgradeCost, upgradePayout, upgradeFuelCap, MERGE_BONUS } from './data'

let n = 0
const b = (def: string, x: number, z: number, extra: Partial<PlacedBuilding> = {}): PlacedBuilding => ({ uid: `b${n++}`, def, x, z, jobEndsAt: null, ...extra })
// An n x n square of `def` lots starting at (x, z).
const square = (def: string, x: number, z: number, size: number, extra: Partial<PlacedBuilding> = {}) => {
  const d = buildingDef(def)
  const out: PlacedBuilding[] = []
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) out.push(b(def, x + i * d.w, z + j * d.h, extra))
  return out
}

describe('merging buildings', () => {
  it('finds four matching buildings in a square', () => {
    const town = square('pizza', 2, 2, 2)
    const c = mergeCandidates(town)
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ code: 2, x: 2, z: 2, w: 2, h: 2 })
  })

  it('needs the same building at the same level', () => {
    const town = square('pizza', 2, 2, 2)
    town[3] = { ...town[3], level: 2 }
    expect(mergeCandidates(town).filter((c) => c.code === 2)).toHaveLength(0)
    expect(mergeCandidates([...square('pizza', 0, 0, 2).slice(0, 3), b('donut', 1, 1)]).filter((c) => c.code === 2)).toHaveLength(0)
  })

  it('works for wide lots too', () => {
    const town = square('diner', 0, 0, 2)
    const g = mergeCandidates(town)[0]
    expect(g).toMatchObject({ w: 4, h: 2 })
  })

  it('merges, then merges four merged blocks into a giant one, and splits back a step at a time', () => {
    let town = square('house', 0, 0, 4)
    // Four overlapping-free 2x2 merges first.
    for (const [x, z] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
      const c = mergeCandidates(town).find((o) => o.x === x && o.z === z && o.code === 2)!
      town = applyMerge(town, c)
    }
    let m = mergeGroups(town)
    expect(m.groups.size).toBe(4)
    const big = mergeCandidates(town, m).filter((c) => c.code === 4)
    expect(big).toHaveLength(1)
    town = applyMerge(town, big[0])
    m = mergeGroups(town)
    expect(m.groups.size).toBe(1)
    expect([...m.groups.values()][0]).toMatchObject({ code: 4, w: 4, h: 4 })
    expect(m.owner.size).toBe(16)
    // Every building is still in the save.
    expect(town).toHaveLength(16)

    town = applySplit(town, [...m.groups.values()][0])
    expect(mergeGroups(town).groups.size).toBe(4)
    town = applySplit(town, mergeGroups(town).groups.get(town[0].uid)!)
    expect(mergeGroups(town).groups.size).toBe(3)
    expect(town[0].merge).toBeUndefined()
  })

  it('ignores a merge flag whose block no longer lines up', () => {
    const town = square('pizza', 2, 2, 2)
    town[0] = { ...town[0], merge: 2 }
    expect(mergeGroups(town).groups.size).toBe(1)
    town[3] = { ...town[3], x: 10 }
    expect(mergeGroups(town).groups.size).toBe(0)
    // Unknown buildings never merge.
    expect(mergeCandidates(square('not-a-building', 0, 0, 2))).toHaveLength(0)
  })

  it('merges two side by side, and two pairs into a square', () => {
    let town = [b('pizza', 0, 0), b('pizza', 1, 0), b('pizza', 5, 0), b('pizza', 5, 1)]
    const c = mergeCandidates(town)
    expect(c.map((o) => [o.code, o.w, o.h])).toEqual([[21, 2, 1], [12, 1, 2]])
    town = applyMerge(town, c[0])
    expect(mergeGroups(town).groups.size).toBe(1)
    // A 2x2 offers only the square merge, not its pairs.
    let sq = square('pizza', 0, 0, 2)
    expect(mergeCandidates(sq).map((o) => o.code)).toEqual([2])
    // Two pairs inside a square can still become the square.
    sq = applyMerge(applyMerge(sq, { ...mergeCandidates([sq[0], sq[1]])[0] }), mergeCandidates([sq[2], sq[3]])[0])
    expect(mergeGroups(sq).groups.size).toBe(2)
    const up = mergeCandidates(sq).find((o) => o.code === 2)!
    sq = applyMerge(sq, up)
    const m = mergeGroups(sq)
    expect([...m.groups.values()].map((g) => g.code)).toEqual([2])
    expect(m.owner.size).toBe(4)
  })

  it('stretches a pair along its length', () => {
    const [g] = mergeCandidates([b('pizza', 0, 0), b('pizza', 1, 0)])
    expect(groupTurn(g, new Set())).toBe(0)
    expect(groupScale(g, 0)).toEqual([2, 1, 1])
    const [t] = mergeCandidates([b('pizza', 0, 0), b('pizza', 0, 1)])
    expect(groupTurn(t, new Set(['1,1']))).toBe(1)
    expect(groupScale(t, 1)).toEqual([2, 1, 1])
  })

  it('faces the merged building at a road along its edge', () => {
    const [g] = mergeCandidates(square('pizza', 2, 2, 2))
    expect(groupTurn(g, new Set(['2,4']))).toBe(0)
    expect(groupTurn(g, new Set(['4,3']))).toBe(1)
    expect(groupTurn(g, new Set(['3,1']))).toBe(2)
  })
})

describe('merged buildings in the store', () => {
  const setup = () => {
    const town = square('pizza', 2, 2, 2)
    useGame.setState({ buildings: town, fuel: 20, fuelUpdatedAt: Date.now(), coins: 100000, parts: 100, level: 5, xp: 0, levelUp: null, visiting: null })
    useGame.getState().mergeBlock(town[0].uid, 2)
    return town
  }

  it('starts and collects every job in the block with one tap', () => {
    const town = setup()
    const g = () => useGame.getState()
    expect(g().buildings[0].merge).toBe(2)
    g().tapBuilding(town[2].uid)
    expect(g().fuel).toBe(20 - 4 * buildingDef('pizza').fuelCost!)
    expect(g().buildings.every((o) => o.jobEndsAt !== null)).toBe(true)
    useGame.setState({ buildings: g().buildings.map((o) => ({ ...o, jobEndsAt: 1 })) })
    const coins = g().coins
    g().tapBuilding(town[1].uid)
    expect(g().coins - coins).toBeGreaterThanOrEqual(4 * upgradePayout(buildingDef('pizza'), 1))
    expect(g().buildings.every((o) => o.jobEndsAt === null)).toBe(true)
  })

  it('upgrades the whole block together and keeps it merged', () => {
    const town = setup()
    const g = () => useGame.getState()
    const cost = buildingUpgradeCost(buildingDef('pizza'), 1)
    expect(g().upgradeBuilding(town[3].uid)).toBe(true)
    expect(g().coins).toBe(100000 - 4 * cost.coins)
    expect(g().buildings.every((o) => o.level === 2)).toBe(true)
    expect(mergeGroups(g().buildings).groups.size).toBe(1)
  })

  it("won't move or bulldoze part of a merged block", () => {
    const town = setup()
    const g = () => useGame.getState()
    expect(g().moveBuilding(town[1].uid, 12, 12)).toBe(false)
    g().bulldoze(3, 3)
    expect(g().buildings).toHaveLength(4)
    g().splitBlock(town[3].uid)
    expect(g().buildings.some((o) => o.merge)).toBe(false)
  })
})

describe("Rusty's Rescue", () => {
  it("can't be bulldozed, so the lot and restore bay stay reachable", () => {
    useGame.setState({ buildings: [b('rescue', 4, 4)], coins: 0, visiting: null })
    useGame.getState().bulldoze(4, 4)
    expect(useGame.getState().buildings).toHaveLength(1)
    expect(useGame.getState().coins).toBe(0)
  })
})

describe('turning merged blocks', () => {
  const all = () => true
  const one = (town: PlacedBuilding[]) => [...mergeGroups(town).groups.values()][0]

  it('turns a square block of square lots in place, all the way round', () => {
    const blk = square('pizza', 2, 2, 2)
    let town = applyMerge(blk, mergeCandidates(blk)[0])
    const start = town.map((o) => [o.x, o.z])
    for (let t = 1; t <= 4; t++) {
      const g = one(town)
      town = rotateGroup(town, g, groupTurn(g, new Set()), all)!
      expect(groupTurn(one(town), new Set())).toBe(t % 4)
    }
    expect(town.map((o) => [o.x, o.z])).toEqual(start)
  })

  it('turns a pair from along x to along z and back, keeping each building', () => {
    const pair = [b('pizza', 5, 5, { jobEndsAt: 123, car: 'c1' }), b('pizza', 6, 5)]
    let town = applyMerge(pair, mergeCandidates(pair)[0])
    let g = one(town)
    town = rotateGroup(town, g, groupTurn(g, new Set()), all)!
    g = one(town)
    expect(g).toMatchObject({ code: 12, w: 1, h: 2 })
    expect(groupTurn(g, new Set())).toBe(1)
    expect(town.find((o) => o.car === 'c1')).toMatchObject({ jobEndsAt: 123 })
    // Round trip lands where it began.
    for (let i = 0; i < 3; i++) town = rotateGroup(town, one(town), groupTurn(one(town), new Set()), all)!
    expect(one(town)).toMatchObject({ code: 21, x: 5, z: 5 })
  })

  it('swaps width and depth for wide lots and still validates', () => {
    const blk = square('diner', 0, 0, 2)
    let town = applyMerge(blk, mergeCandidates(blk)[0])
    town = rotateGroup(town, one(town), groupTurn(one(town), new Set()), all)!
    const g = one(town)
    expect(g).toMatchObject({ code: 2, w: 2, h: 4 })
    expect(town.every((o) => o.rot === 1)).toBe(true)
  })

  it('refuses when the turned block would not fit', () => {
    const pair = [b('pizza', 5, 5), b('pizza', 6, 5)]
    const town = applyMerge(pair, mergeCandidates(pair)[0])
    const g = one(town)
    expect(rotateGroup(town, g, 0, (_x, z) => z === 5)).toBeNull()
  })
})

describe('turning a merged block in the store', () => {
  it('turns it in place on owned land and keeps it merged after a reload', () => {
    const pair = [b('pizza', 5, 5), b('pizza', 6, 5)]
    useGame.setState({ buildings: applyMerge(pair, mergeCandidates(pair)[0]), roads: [], visiting: null })
    expect(useGame.getState().rotateBlock(pair[1].uid)).toBe(true)
    const saved = JSON.parse(JSON.stringify(useGame.getState().buildings)) as PlacedBuilding[]
    expect([...mergeGroups(saved).groups.values()][0]).toMatchObject({ code: 12 })
    // Blocked by a house where the turned pair would go.
    useGame.setState({ buildings: [...applyMerge(pair, mergeCandidates(pair)[0]), b('house', 5, 6), b('house', 6, 6), b('house', 5, 4), b('house', 6, 4)] })
    expect(useGame.getState().rotateBlock(pair[0].uid)).toBe(false)
  })
})

describe('landmark', () => {
  const block = (level: number, code = 2) => {
    const hs = [b('house', 0, 0, { level, merge: code }), b('house', 1, 0, { level }), b('house', 0, 1, { level }), b('house', 1, 1, { level })]
    return mergeGroups(hs).groups.get(hs[0].uid)!
  }
  it('four level 10 houses in a square are the Vanguard Tower', () => {
    expect(isLandmark(block(10))).toBe(true)
  })
  it('lower houses, pairs and other buildings stay plain', () => {
    expect(isLandmark(block(9))).toBe(false)
    const pair = [b('house', 0, 0, { level: 10, merge: 21 }), b('house', 1, 0, { level: 10 })]
    expect(isLandmark(mergeGroups(pair).groups.get(pair[0].uid)!)).toBe(false)
    const shops = [b('pizza', 0, 0, { level: 10, merge: 2 }), b('pizza', 1, 0, { level: 10 }), b('pizza', 0, 1, { level: 10 }), b('pizza', 1, 1, { level: 10 })]
    expect(isLandmark(mergeGroups(shops).groups.get(shops[0].uid)!)).toBe(false)
  })
})

describe('merge bonus', () => {
  const merged = (town: PlacedBuilding[], code: number) => applyMerge(town, mergeCandidates(town).find((c) => c.code === code)!)
  const done = (town: PlacedBuilding[]) => town.map((o) => ({ ...o, jobEndsAt: 1 }))
  const pay = (town: PlacedBuilding[]) => readyRewards({ buildings: done(town), cars: [], level: 5 }, Date.now()).coins

  it('grows with the block: a pair, a 2x2, a giant 4x4', () => {
    expect(MERGE_BONUS[2]).toBeGreaterThan(0)
    expect(MERGE_BONUS[4]).toBeGreaterThan(MERGE_BONUS[2])
    expect(MERGE_BONUS[16]).toBeGreaterThan(MERGE_BONUS[4])
  })

  it('a merged block earns more than the same buildings left loose', () => {
    const loose = square('pizza', 2, 2, 2, { level: 3 })
    const one = upgradePayout(buildingDef('pizza'), 3)
    expect(pay(loose)).toBe(4 * one)
    expect(pay(merged(loose, 2))).toBe(4 * Math.round(one * (1 + MERGE_BONUS[4])))
    const pair = loose.slice(0, 2)
    expect(pay(merged(pair, 21))).toBe(2 * Math.round(one * (1 + MERGE_BONUS[2])))
    expect([...mergeBoosts(merged(loose, 2)).values()]).toEqual([0.25, 0.25, 0.25, 0.25])
  })

  it('pays it on a tap and on Collect All', () => {
    const town = merged(square('pizza', 2, 2, 2), 2)
    const one = upgradePayout(buildingDef('pizza'), 1)
    const bonus = 4 * Math.round(one * (1 + MERGE_BONUS[4]))
    useGame.setState({ buildings: done(town), coins: 0, level: 5, xp: 0, levelUp: null, visiting: null, stats: { ...useGame.getState().stats, coinsEarned: 0 } })
    useGame.getState().tapBuilding(town[0].uid)
    expect(useGame.getState().stats.coinsEarned).toBe(bonus)
    useGame.setState({ buildings: done(town), stats: { ...useGame.getState().stats, coinsEarned: 0 } })
    useGame.getState().collectAll()
    expect(useGame.getState().stats.coinsEarned).toBe(bonus)
  })

  it('merged houses and gas stations hold more fuel', () => {
    const houses = square('house', 0, 0, 2, { level: 4 })
    const base = fuelCap({ level: 5, buildings: houses })
    expect(base).toBe(fuelCap({ level: 5, buildings: [] }) + 4 * upgradeFuelCap(buildingDef('house'), 4))
    expect(fuelCap({ level: 5, buildings: merged(houses, 2) })).toBe(base + Math.ceil(4 * 3 * MERGE_BONUS[4]))
  })
})

describe('merge bonus on the server', () => {
  // The guard banks the bonus by merge code (see 0088_merge_bonus.sql): its numbers must match MERGE_BONUS.
  it('matches MERGE_BONUS', () => {
    const dir = `${process.cwd()}/supabase/migrations`
    const sql = readdirSync(dir).sort().map((f) => readFileSync(`${dir}/${f}`, 'utf8')).filter((q) => q.includes('-- merge:begin')).pop()!
    const block = sql.slice(sql.indexOf('-- merge:begin'), sql.indexOf('-- merge:end'))
    const codes: Record<string, number> = { 21: 2, 12: 2, 2: 4, 4: 16 }
    for (const [code, n] of Object.entries(codes)) expect(block).toContain(`when '${code}' then ${n} * ${MERGE_BONUS[n]}`)
    expect(sql).toContain(`least(m.want, ${MERGE_BONUS[16]} * m.n)`)
  })
})
