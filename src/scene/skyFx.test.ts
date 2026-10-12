import { describe, expect, it } from 'vitest'
import { FEEL, mixOf, type Weather, type WeatherKind } from '../game/weather'
import { skyFx } from './skyFx'

const at = (kind: WeatherKind, extra: Partial<Weather> = {}): Weather => ({ kind, strength: 1, mix: mixOf(kind), ...FEEL[kind], wet: 0, cover: 0, flash: 0, ...extra })
const NOON = 0
const MIDNIGHT = 0.5
const SUNRISE = 0.77

describe('skyFx', () => {
  it('lays fog banks on the ground in fog and mist, and none on a clear day', () => {
    expect(skyFx(at('fog'), NOON, 'fall').banks).toBe(1)
    const mist = skyFx(at('mist'), SUNRISE, 'spring')
    expect(mist.banks).toBeGreaterThan(0.5)
    expect(mist.low).toBe(1)
    expect(skyFx(at('clear'), NOON, 'summer').banks).toBe(0)
  })

  it('sends sun shafts at sunrise, never in fog, a downpour or at noon on a clear day', () => {
    expect(skyFx(at('clear'), SUNRISE, 'summer').rays).toBeGreaterThan(0.5)
    expect(skyFx(at('fog'), NOON, 'fall').rays).toBe(0)
    expect(skyFx(at('rain'), SUNRISE, 'summer').rays).toBe(0)
    expect(skyFx(at('clear'), NOON, 'summer').rays).toBe(0)
    expect(skyFx(at('fog'), MIDNIGHT, 'fall').rays).toBe(0)
  })

  it('puts a rainbow up while the streets dry after a shower, by day and not in winter', () => {
    expect(skyFx(at('clearing', { wet: 0.7 }), NOON, 'summer').rainbow).toBe(1)
    expect(skyFx(at('clearing', { wet: 0 }), NOON, 'summer').rainbow).toBe(0)
    expect(skyFx(at('clearing', { wet: 0.7 }), MIDNIGHT, 'summer').rainbow).toBe(0)
    expect(skyFx(at('clearing', { wet: 0.7 }), NOON, 'winter').rainbow).toBe(0)
    expect(skyFx(at('clearing', { wet: 0.7 }), NOON, 'summer').glint).toBeGreaterThan(0.5)
  })

  it('haloes the lamps at night, more in fog', () => {
    const clear = skyFx(at('clear'), MIDNIGHT, 'fall').halo
    const fog = skyFx(at('fog'), MIDNIGHT, 'fall').halo
    expect(clear).toBeGreaterThan(0)
    expect(fog).toBeGreaterThan(clear * 2)
    expect(skyFx(at('clear'), NOON, 'fall').halo).toBe(0)
  })

  it('bakes only on heat days', () => {
    expect(skyFx(at('heat'), NOON, 'summer').heat).toBe(1)
    expect(skyFx(at('clear'), NOON, 'summer').heat).toBe(0)
  })
})
