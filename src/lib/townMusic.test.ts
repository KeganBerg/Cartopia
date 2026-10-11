import { describe, expect, it } from 'vitest'
import { phrase, SONGS } from './townMusic'
import { hz } from './instruments'

const pc = (n: string) => n.replace(/\d+$/, '')

describe('town music', () => {
  it('names only real notes', () => {
    for (const s of Object.values(SONGS)) {
      for (const c of s.chords) for (const n of c) expect(hz(n)).toBeGreaterThan(40)
      for (const n of s.scale) expect(hz(n)).toBeGreaterThan(200)
    }
  })
  it('lands melodies on the chord on strong beats and ends on it', () => {
    for (const s of Object.values(SONGS))
      for (let k = 0; k < 100; k++) {
        const first = k % 2 ? 2 : 0
        const chords = [s.chords[first], s.chords[first + 1]] as const
        const notes = phrase(s, [chords[0], chords[1]])
        expect(notes.length).toBeGreaterThan(4)
        for (const [i, n] of notes.entries()) {
          expect(s.scale).toContain(n.note)
          if (n.at % 8 === 0 || i === notes.length - 1) expect(chords[n.at < 16 ? 0 : 1].slice(1).map(pc)).toContain(pc(n.note))
        }
        expect(notes.reduce((a, n) => a + n.len, notes[0].at)).toBe(32)
      }
  })
})
