import { describe, expect, it } from 'vitest'
import { GROOVES } from './clubGrooves'
import { BAR_MS, decksAt, grooveOf, leadAt, MIX_BARS, RUN_BARS, SWAP_BARS } from './clubSet'

// Kegan: "I don't like hearing the same house beat for 1 hour straight." The
// club plays a DJ set that mixes through its grooves.

describe('club grooves', () => {
  it('keeps every groove a full house groove', () => {
    expect(GROOVES.length).toBeGreaterThanOrEqual(7)
    for (const g of GROOVES) {
      expect(g.bass).toHaveLength(16)
      expect(g.loop.length).toBeGreaterThan(0)
      if (g.acid) expect(g.acid.notes).toHaveLength(16)
    }
  })
})

describe('the club set', () => {
  it('plays every groove each round, never the same one twice in a row', () => {
    for (let r = 0; r < 20; r++) {
      const round = Array.from({ length: GROOVES.length }, (_, i) => grooveOf(r * GROOVES.length + i))
      expect(new Set(round).size).toBe(GROOVES.length)
    }
    for (let k = 1; k < 300; k++) expect(grooveOf(k)).not.toBe(grooveOf(k - 1))
  })

  it('a ten-minute night hears three or four grooves', () => {
    const night = 10 * 60000
    for (let start = 0; start < 50 * RUN_BARS * BAR_MS; start += 37_000) {
      const heard = new Set<number>()
      for (let ms = start; ms < start + night; ms += BAR_MS) heard.add(leadAt(Math.floor(ms / (BAR_MS / 16))).run)
      expect(heard.size).toBeGreaterThanOrEqual(3)
      expect(heard.size).toBeLessThanOrEqual(5)
    }
  })

  it('mixes from one groove into the next with no hard cut', () => {
    for (let run = 1; run < 8; run++) {
      const into = run * RUN_BARS - MIX_BARS
      for (let bar = into - 2; bar < into + MIX_BARS + 2; bar++) {
        for (let k = 0; k < 16; k++) {
          const n = bar * 16 + k
          const d = decksAt(n)
          // At most two decks, and exactly one kick and bass at a time.
          expect(d.length).toBeLessThanOrEqual(2)
          expect(d.filter((x) => x.lows).length).toBe(1)
          // The incoming groove comes in quietly, the outgoing one fades away.
          if (d.length === 2) {
            const step = 1 / (SWAP_BARS * 16) + 1e-9
            const prev = decksAt(n - 1)
            if (prev.length === 2) {
              expect(Math.abs(d[0].highs - prev[0].highs)).toBeLessThanOrEqual(step)
              expect(Math.abs(d[1].highs - prev[1].highs)).toBeLessThanOrEqual(step)
            }
          }
        }
      }
      // Before the mix the old groove plays alone; after it, the new one.
      expect(decksAt((into - 1) * 16).map((d) => d.run)).toEqual([run - 1])
      expect(decksAt((into + MIX_BARS) * 16).map((d) => d.run)).toEqual([run])
      // The kick and bass hand over halfway through the mix, in step.
      expect(leadAt((into + SWAP_BARS) * 16 - 1).run).toBe(run - 1)
      expect(leadAt((into + SWAP_BARS) * 16).run).toBe(run)
    }
  })

  it('arranges each groove: parts drop in and out, a breakdown, fills', () => {
    const run = 3
    const start = run * RUN_BARS - MIX_BARS
    const bars = Array.from({ length: RUN_BARS + MIX_BARS }, (_, b) => decksAt((start + b) * 16 + 4).find((d) => d.run === run)!)
    // A breakdown with no kick, then the drop with a crash.
    expect(bars.filter((d) => !d.lows).length).toBeGreaterThanOrEqual(8 + SWAP_BARS * 2)
    expect(decksAt((start + 56) * 16).find((d) => d.run === run)!.crash).toBe(true)
    // Somewhere the chords or hats sit out for a while, somewhere they're back.
    const sets = new Set(bars.map((d) => `${d.stabs}${d.closedHats}`))
    expect(sets.size).toBeGreaterThan(1)
    // Phrase-ending fills roll claps.
    expect(bars.some((_, b) => b % 8 === 7 && decksAt((start + b) * 16 + 14).find((x) => x.run === run)!.roll > 0)).toBe(true)
  })
})
