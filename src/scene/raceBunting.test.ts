// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { BUNTING_LOW, CHASE_Y } from './RaceScene'

describe('bunting over the drag strip', () => {
  // On phones the chase camera flew through every bunting line: a pennant filled the screen.
  it('hangs well above the chase camera', () => {
    expect(BUNTING_LOW - Math.max(CHASE_Y.tall, CHASE_Y.wide)).toBeGreaterThan(0.5)
  })
})
