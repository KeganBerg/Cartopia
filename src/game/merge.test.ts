// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mergeGroups, mergeCandidates, applyMerge, applySplit, groupTurn } from './merge'
import { useGame, type PlacedBuilding } from './store'
import { buildingDef, buildingUpgradeCost, upgradePayout } from './data'

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
    expect(c[0]).toMatchObject({ size: 2, x: 2, z: 2, w: 2, h: 2 })
  })

  it('needs the same building at the same level', () => {
    const town = square('pizza', 2, 2, 2)
    town[3] = { ...town[3], level: 2 }
    expect(mergeCandidates(town)).toHaveLength(0)
    expect(mergeCandidates([...square('pizza', 0, 0, 2).slice(0, 3), b('donut', 1, 1)])).toHaveLength(0)
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
      const c = mergeCandidates(town).find((o) => o.x === x && o.z === z && o.size === 2)!
      town = applyMerge(town, c)
    }
    let m = mergeGroups(town)
    expect(m.groups.size).toBe(4)
    const big = mergeCandidates(town, m).filter((c) => c.size === 4)
    expect(big).toHaveLength(1)
    town = applyMerge(town, big[0])
    m = mergeGroups(town)
    expect(m.groups.size).toBe(1)
    expect([...m.groups.values()][0]).toMatchObject({ size: 4, w: 4, h: 4 })
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
