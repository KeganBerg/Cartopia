import { describe, expect, it } from 'vitest'
import { phrase, seeded, SONGS, songsFor } from './townMusic'
import { hz } from './instruments'

const pc = (n: string) => n.replace(/\d+$/, '')

describe('town music', () => {
  it('names only real notes', () => {
    for (const s of SONGS) {
      for (const c of s.chords) for (const n of c) expect(hz(n)).toBeGreaterThan(40)
      for (const n of s.scale) expect(hz(n)).toBeGreaterThan(200)
    }
  })
  it('lands melodies on the chord on strong beats and ends on it', () => {
    for (const s of SONGS)
      for (let k = 0; k < 40; k++) {
        const i = k % s.chords.length
        const chords = [s.chords[i], s.chords[(i + 1) % s.chords.length]] as const
        const notes = phrase(s, [chords[0], chords[1]])
        expect(notes.length).toBeGreaterThan(4)
        for (const [j, n] of notes.entries()) {
          expect(s.scale).toContain(n.note)
          if (n.at % 8 === 0 || j === notes.length - 1) expect(chords[n.at < 16 ? 0 : 1].slice(1).map(pc), s.name).toContain(pc(n.note))
        }
        expect(notes.reduce((a, n) => a + n.len, notes[0].at)).toBe(32)
      }
  })
  it('gives every song the same tune each time it plays', () => {
    const s = SONGS[0]
    const c = [s.chords[0], s.chords[1]] as [typeof s.chords[0], typeof s.chords[0]]
    expect(phrase(s, c, seeded(s.name))).toEqual(phrase(s, c, seeded(s.name)))
    expect(phrase(s, c, seeded(s.name))).not.toEqual(phrase(s, c, seeded(SONGS[1].name)))
  })
  it('gives every season its own three day songs and three night songs', () => {
    const seen = new Set<string>()
    for (const season of ['winter', 'spring', 'summer', 'fall'] as const)
      for (const night of [false, true]) {
        const songs = songsFor(night, season)
        expect(songs.length).toBeGreaterThanOrEqual(3)
        for (const s of songs) {
          expect(seen.has(s.name), s.name).toBe(false)
          seen.add(s.name)
        }
      }
    expect(new Set(SONGS.map((s) => s.name)).size).toBe(SONGS.length)
  })
  it("doesn't bring back a song it just played", () => {
    const night = songsFor(true, 'summer').map((s) => s.name)
    const left = songsFor(true, 'summer', night.slice(0, 2)).map((s) => s.name)
    expect(left).toEqual(night.slice(2))
    // All three just played: only the oldest can come back.
    expect(songsFor(true, 'summer', night).map((s) => s.name)).toEqual([night[0]])
  })
})
