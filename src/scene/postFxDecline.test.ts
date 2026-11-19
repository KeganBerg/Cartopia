import { describe, expect, it, vi } from 'vitest'

vi.mock('@react-three/postprocessing', () => ({ Bloom: () => null, EffectComposer: () => null, ToneMapping: () => null }))
const { declineStep } = await import('./PostFx')

describe('effects step-down', () => {
  it('never rebuilds shaders mid-race: the race keeps its tier and the next race starts a step lower', () => {
    expect(declineStep('high', false, false)).toEqual({ live: 'high', save: 'low' })
    expect(declineStep('low', false, false)).toEqual({ live: 'low', save: 'off' })
  })

  it('steps down only once per race, however often the frame rate dips', () => {
    expect(declineStep('high', false, true)).toBeNull()
  })

  it('still steps the town down there and then, to the floor and no further', () => {
    expect(declineStep('high', true, false)).toEqual({ live: 'low', save: 'low' })
    expect(declineStep('off', true, false)).toEqual({ live: 'off', save: 'off' })
  })
})
