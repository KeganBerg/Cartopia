// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { DECOR_PROPS } from './decorProps'

// Mean z of every vertex at or above a height, over a prop's parts.
function meanZ(parts: ReturnType<typeof DECOR_PROPS.bench>, above: number, below = Infinity) {
  let sum = 0
  let n = 0
  for (const { geo } of parts) {
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i)
      if (y < above || y > below) continue
      sum += p.getZ(i)
      n++
    }
  }
  return sum / n
}

// Townspeople.tsx SEATS sits people on a park bench with their backs to its turn side (+z
// before the bench is turned) and facing the other way. That only holds while the bench's
// backrest is on +z: if the model is ever turned round, SEATS.bench must flip with it, or
// people sit facing the backrest with their legs through it.
describe('park bench', () => {
  it('has its backrest on the +z side', () => {
    // Only the backrest reaches above the arms (0.47 high).
    expect(meanZ(DECOR_PROPS.bench('#8d6e63'), 0.55)).toBeGreaterThan(0.1)
  })

  it('has its seat front open on the -z side', () => {
    // The seat slats reach further towards -z than the backrest does.
    expect(meanZ(DECOR_PROPS.bench('#8d6e63'), 0.3, 0.33)).toBeLessThan(meanZ(DECOR_PROPS.bench('#8d6e63'), 0.55) - 0.1)
  })
})
