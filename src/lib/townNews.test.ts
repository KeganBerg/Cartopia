import { describe, expect, it } from 'vitest'
import { pickNews } from './townNews'
import type { BoardRow } from './clans'

const row = (id: string, week: Partial<BoardRow['week']>): BoardRow => ({
  ownerId: id, townName: id, level: 1, trophies: 0, raceWins: 0, power: 0, clan: null,
  week: { power: 0, race_wins: 0, trophies: 0, level: 0, ...week },
})

describe('town news', () => {
  it('names the leader of each weekly board', () => {
    const items = pickNews([[row('a', { race_wins: 9 })], [row('b', { level: 2 })], [row('c', { trophies: 4 })]])
    expect(items.map((i) => [i.metric, i.row.ownerId, i.n])).toEqual([['race_wins', 'a', 9], ['level', 'b', 2], ['trophies', 'c', 4]])
  })

  it('gives each player one story and skips empty boards', () => {
    const a = row('a', { race_wins: 9, level: 3 })
    const items = pickNews([[a], [a, row('b', { level: 1 })], [row('c', { trophies: 0 })]])
    expect(items.map((i) => i.row.ownerId)).toEqual(['a', 'b'])
  })
})
