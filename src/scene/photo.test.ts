import { describe, expect, it } from 'vitest'
import { BACKDROPS, FILTERS, backdrop, photoFilter } from './photo'

describe('photo mode', () => {
  it('has unique backdrops and filters, with the showroom then the plain ones first', () => {
    expect(new Set(BACKDROPS.map((b) => b.id)).size).toBe(BACKDROPS.length)
    expect(new Set(FILTERS.map((f) => f.id)).size).toBe(FILTERS.length)
    expect(BACKDROPS[0].id).toBe('showroom')
    expect(BACKDROPS[1]).toMatchObject({ id: 'studio', bg: null })
    expect(FILTERS[0].css).toBe('none')
    expect(backdrop('nope')).toBe(BACKDROPS[0])
    expect(photoFilter('mono').id).toBe('mono')
  })
})
