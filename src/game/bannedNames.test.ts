import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUILDINGS, CARS, SKINS, TRACK_SKINS } from './data'
import { GROWTH, growthName } from './growth'

// Names that point at real-world tragedies or wars never show in the game.
const BANNED = [/twin\s*towers?/i, /desert\s*storm/i]
const banned = (s: string) => BANNED.some((b) => b.test(s))

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return sources(p)
    return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : []
  })

describe('banned names', () => {
  it('no building growth name uses a banned name', () => {
    for (const [id, names] of Object.entries(GROWTH)) for (const n of names) expect(banned(n), `${id}: ${n}`).toBe(false)
  })

  it('no building, car or skin name uses a banned name', () => {
    for (const d of [...BUILDINGS, ...CARS, ...SKINS, ...TRACK_SKINS]) expect(banned(d.name), `${d.id}: ${d.name}`).toBe(false)
  })

  it('no source file shows a banned name', () => {
    for (const f of sources(join(__dirname, '..'))) {
      // Saved ids (never shown) stay as they are so old saves keep working.
      const hits = readFileSync(f, 'utf8').split('\n').map((l) => l.replace(/\bid: '[^']*'/g, '')).filter(banned)
      expect(hits, f).toEqual([])
    }
  })

  it('HQ at level 10 is Skybridge Towers', () => {
    expect(growthName('hq', 'Corporate HQ', 10)).toBe('Skybridge Towers')
  })
})
