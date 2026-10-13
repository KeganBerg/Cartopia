import { describe, expect, it } from 'vitest'
import { GROOVES } from './clubGrooves'
import { BREAK_FROM, CYCLE_BARS, deckAt, DROP_AT, nightWith, sixAt, sixteenthMs, trackOf, wallOf } from './clubSet'
import { DAY_MS, OPEN_FROM, OPEN_TO, nextPhaseAt } from '../game/clock'

// Kegan: "I still only hear one edm track for the club each night make more
// tracks so each night is different." Every night plays its own track, and
// the tracks are different kinds of dance music, not one house beat.

describe('club tracks', () => {
  it('every track is complete', () => {
    expect(GROOVES.length).toBeGreaterThanOrEqual(12)
    for (const g of GROOVES) {
      expect(g.bass).toHaveLength(16)
      expect(g.loop.length).toBeGreaterThan(0)
      expect(g.bpm).toBeGreaterThanOrEqual(90)
      expect(g.bpm).toBeLessThanOrEqual(180)
      if (g.acid) expect(g.acid.notes).toHaveLength(16)
      if (g.lead) expect(g.lead.notes.length % 16).toBe(0)
      for (const k of [...(g.kick ?? []), ...g.claps, ...g.openHats, ...(g.perc ?? [])]) expect(k >= 0 && k < 16).toBe(true)
    }
  })

  it('the tracks really differ: tempos, drum patterns, sounds', () => {
    // Many different tempos, from slow reggaeton to fast drum and bass.
    const bpms = GROOVES.map((g) => g.bpm)
    expect(new Set(bpms).size).toBeGreaterThanOrEqual(GROOVES.length - 2)
    expect(Math.max(...bpms) - Math.min(...bpms)).toBeGreaterThanOrEqual(60)
    // Not all four to the floor with a clap: several drum patterns and sounds.
    const drums = new Set(GROOVES.map((g) => `${g.kick ?? 'four'}|${g.claps}|${g.snare ?? 'clap'}`))
    expect(drums.size).toBeGreaterThanOrEqual(6)
    expect(new Set(GROOVES.map((g) => g.kickTone ?? 'house')).size).toBe(4)
    expect(new Set(GROOVES.map((g) => g.bassTone ?? 'saw')).size).toBe(5)
    // Most have a hook, in several different sounds.
    expect(GROOVES.filter((g) => g.lead).length).toBeGreaterThanOrEqual(9)
    expect(new Set(GROOVES.map((g) => g.lead?.tone).filter(Boolean)).size).toBe(5)
    // No two tracks share a fingerprint.
    const print = (g: (typeof GROOVES)[number]) => JSON.stringify([g.bpm, g.kick, g.claps, g.bass, g.lead?.notes, g.acid])
    expect(new Set(GROOVES.map(print)).size).toBe(GROOVES.length)
  })
})

describe('one track a night', () => {
  it('plays every track each round of nights, never the same one two nights running', () => {
    const n = GROOVES.length
    for (let r = 0; r < 30; r++) {
      const round = Array.from({ length: n }, (_, i) => trackOf(r * n + i))
      expect(new Set(round).size).toBe(n)
    }
    for (let night = 1; night < 500; night++) expect(trackOf(night)).not.toBe(trackOf(night - 1))
  })

  it('the whole night (dusk to dawn) is one track, and the next night is another', () => {
    for (let day = 0; day < 40; day++) {
      const open = nextPhaseAt(OPEN_FROM, day * DAY_MS)
      const close = nextPhaseAt(OPEN_TO, open)
      const heard = new Set<number>()
      for (let ms = open; ms < close; ms += 5000) heard.add(deckAt(sixAt(ms).night, sixAt(ms).n).groove)
      expect(heard.size).toBe(1)
      const next = nextPhaseAt(OPEN_FROM, close)
      expect(deckAt(sixAt(next).night, sixAt(next).n).groove).not.toBe([...heard][0])
    }
  })

  it('counts each track\'s sixteenths at its own tempo, with no gap into the next night', () => {
    for (let night = 100; night < 100 + GROOVES.length; night++) {
      const six = sixteenthMs(trackOf(night))
      expect(wallOf(night, 1) - wallOf(night, 0)).toBeCloseTo(six)
      const ms = night * DAY_MS + 123_456
      const p = sixAt(ms)
      expect(p.night).toBe(night)
      expect(wallOf(night, p.n)).toBeLessThanOrEqual(ms)
      expect(wallOf(night, p.n + 1)).toBeGreaterThan(ms)
      // The last sixteenth of a night is less than one sixteenth before the next.
      const last = sixAt((night + 1) * DAY_MS - 1)
      expect(last.night).toBe(night)
      expect(wallOf(night + 1, 0) - wallOf(night, last.n)).toBeLessThanOrEqual(six + 1e-6)
    }
  })
})

describe('the arrangement', () => {
  const night = (g: number) => nightWith(g, 50)
  const bars = (g: number) => Array.from({ length: CYCLE_BARS }, (_, b) => Array.from({ length: 16 }, (_, k) => deckAt(night(g), b * 16 + k)))

  it('never goes quiet: something plays in every bar of every track', () => {
    GROOVES.forEach((g, i) => {
      for (const bar of bars(i)) {
        const sounds = bar.some((d) => d.kick || (d.bass && g.bass[d.k]) || (d.stabs && g.stabs[d.bar % g.stabs.length].includes(d.k)) || (d.lead && g.lead?.notes[(d.bar * 16 + d.k) % g.lead.notes.length] != null) || g.acid?.notes[d.k] != null || d.closedHats || (d.claps && g.claps.includes(d.k)))
        expect(sounds, `${g.name} bar ${bar[0].bar}`).toBe(true)
      }
    })
  })

  it('a breakdown with no kick, a riser and roll, then the drop with a crash', () => {
    const b = bars(0)
    for (let bar = BREAK_FROM; bar < DROP_AT; bar++) expect(b[bar].some((d) => d.kick)).toBe(false)
    expect(b[DROP_AT - 2][0].riser).toBeGreaterThan(0)
    expect(b[DROP_AT - 1][14].roll).toBeGreaterThan(0)
    expect(b[DROP_AT][0].crash).toBe(true)
    expect(b[DROP_AT][0].kick).toBe(true)
  })

  it('the hook comes in after the groove, and parts drop in and out', () => {
    GROOVES.forEach((g, i) => {
      const b = bars(i)
      expect(b[0][0].lead).toBe(false)
      if (g.lead) expect(b[16][0].lead).toBe(true)
    })
    const sets = new Set(bars(1).map((bar) => `${bar[0].stabs}${bar[0].closedHats}`))
    expect(sets.size).toBeGreaterThan(1)
  })

  it('each track\'s kick follows its own pattern', () => {
    GROOVES.forEach((g, i) => {
      const kicks = bars(i)[2].filter((d) => d.kick).map((d) => d.k)
      expect(kicks).toEqual(g.kick ?? [0, 4, 8, 12])
    })
  })
})
