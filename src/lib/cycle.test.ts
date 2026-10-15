import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cycle } from './cycle'

describe('cycle', () => {
  it('wraps negative numbers onto the list', () => {
    expect(cycle(['a', 'b', 'c'], -1)).toBe('c')
    expect(cycle(['a', 'b', 'c'], -3)).toBe('a')
    expect(cycle(['a', 'b', 'c'], 4)).toBe('b')
  })
  // World.tsx picks a street prop with cycle(PROPS, x * 5 + z * 3); PROPS has nine kinds.
  const PROPS = ['bin', 'news', 'mail', 'bollards', 'planter', 'sign', 'box', 'bikes', 'meter']
  it('gives a street prop for every road tile, negative ones included', () => {
    // ifinishfast's town had a straight road at -8,-8, where (x*5+z*3) % 9 was -1.
    for (let x = -40; x <= 40; x++) for (let z = -40; z <= 40; z++) expect(PROPS).toContain(cycle(PROPS, x * 5 + z * 3))
  })
})

// Tiles left of or above the centre have negative x and z, so `list[(x ...) % list.length]`
// can pick undefined there. Pick by tile with cycle() instead.
it('no scene code indexes a list with a raw % of tile coordinates', () => {
  const RAW = /\[[^\][]*\b(?:x|z|bx|bz|px|pz|tx|tz)\b[^\][]*%\s*[\w.]+\.length\s*\]/
  const dir = join(__dirname, '../scene')
  const bad = readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).flatMap((f) =>
    readFileSync(join(dir, f), 'utf8').split('\n').map((l, i) => (RAW.test(l) ? `${f}:${i + 1}: ${l.trim()}` : '')).filter(Boolean))
  expect(bad).toEqual([])
})
