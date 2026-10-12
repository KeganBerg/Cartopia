import { describe, expect, it } from 'vitest'
import { nextUp, rankLadder } from './crewRaces'

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
})
