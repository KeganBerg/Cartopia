import { describe, expect, it } from 'vitest'
import { ladderPlaces, nextUp, rankLadder } from './crewRaces'

const r = (id: string, time: number | null, par = false) => ({ id, time, par })

describe('crew ladder', () => {
  it('puts real runs first, then par-only racers, then racers with no car', () => {
    const ladder = rankLadder([r('none', null), r('par', 9, true), r('slow', 12), r('fast', 8.5), r('par2', 7, true)])
    expect(ladder.map((x) => x.id)).toEqual(['fast', 'slow', 'par2', 'par', 'none'])
  })

  it('says who to beat next and by how much', () => {
    const ladder = rankLadder([r('a', 8), r('b', 8.25), r('c', 9, true)])
    expect(nextUp(ladder, 'a')).toBeNull()
    expect(nextUp(ladder, 'b')).toEqual({ racer: ladder[0], gap: 0.25 })
    // No run yet: there's someone to pass but no gap to quote.
    expect(nextUp(ladder, 'c')).toEqual({ racer: ladder[1], gap: null })
    expect(nextUp(ladder, 'nobody')).toBeNull()
  })

  // Kegan, 2026-10-18: he and Gabe both ran 6.658s, and the podium put them 1st and 2nd.
  it('equal times share a place and are marked as a tie', () => {
    const ladder = rankLadder([r('gabe', 6.658), r('me', 6.658), r('third', 7.112), r('par', 7, true), r('par2', 7, true), r('none', null)])
    expect(ladderPlaces(ladder)).toEqual([
      { place: 1, tied: true }, { place: 1, tied: true }, { place: 3, tied: false },
      { place: 4, tied: false }, { place: 5, tied: false }, { place: 6, tied: false },
    ])
    expect(nextUp(ladder, 'me')).toEqual({ racer: ladder[0], gap: 0 })
    expect(ladderPlaces(rankLadder([r('a', 8), r('b', 8.001)]))).toEqual([{ place: 1, tied: false }, { place: 2, tied: false }])
  })
})
