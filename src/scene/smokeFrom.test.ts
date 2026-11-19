import { describe, expect, it } from 'vitest'
import { smokeFrom } from './WorldFx'

// Busy businesses puff smoke from their roof. On a tower the old fixed height
// left a white puff stuck halfway up the glass (Kegan, 10-17).
describe('chimney smoke', () => {
  it('rises from a low roof, flag and all', () => {
    expect(smokeFrom(2.2, 1.9)).toBe(2.2)
    expect(smokeFrom(2.2, 3.4)).toBe(2.2)
  })
  it('never starts partway up a tower', () => {
    expect(smokeFrom(2.5, 9.6)).toBeNull()
    expect(smokeFrom(2.5, 4.2)).toBeNull()
  })
  it('skips a lot it cannot measure', () => {
    expect(smokeFrom(2.2, null)).toBeNull()
  })
})
