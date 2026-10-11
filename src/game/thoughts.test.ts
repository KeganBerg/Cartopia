import { describe, expect, it } from 'vitest'
import { placeChip, shortName } from './thoughts'

describe('thought bubble destination chip', () => {
  it('uses the sign in title case', () => {
    expect(shortName('coffee')).toBe('Coffee')
    expect(shortName('lube')).toBe('Lube & Go')
    expect(shortName('rescue')).toBe("Rusty's")
    expect(shortName('cinema')).toBe('Drive-In')
  })
  it('falls back to the name, and to a kind icon for unknown places', () => {
    expect(placeChip('bench', '🪑')).toBe('🪑 Park Bench')
    expect(placeChip('gas', '🥤')).toBe('⛽ Gas')
    expect(placeChip('bowling')).toBe('🏪 Bowling')
  })
})
