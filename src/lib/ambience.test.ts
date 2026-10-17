import { describe, expect, it } from 'vitest'
import { ambientMix, keptBuffer, noiseBuffer } from './ambience'

describe('ambientMix', () => {
  it('plays crickets on summer nights and traffic by day', () => {
    const night = ambientMix(1, 'summer')
    const day = ambientMix(0, 'summer')
    expect(night.crickets).toBe(1)
    expect(day.crickets).toBe(0)
    expect(day.traffic).toBeGreaterThan(night.traffic)
    expect(day.cicadas).toBeGreaterThan(0)
  })
  it('keeps winter quiet: no insects or frogs, wind and owls instead', () => {
    for (const n of [0, 0.5, 1]) {
      const m = ambientMix(n, 'winter')
      expect(m.crickets + m.peepers + m.cicadas + m.leaves).toBe(0)
      expect(m.wind).toBeGreaterThan(0.5)
    }
    expect(ambientMix(1, 'winter').owls).toBeGreaterThan(0)
  })
  it('brings spring peepers and fall leaves', () => {
    expect(ambientMix(1, 'spring').peepers).toBe(1)
    expect(ambientMix(0, 'fall').leaves).toBeGreaterThan(ambientMix(0, 'summer').leaves)
  })
  it('stays within 0..1', () => {
    for (const s of ['winter', 'spring', 'summer', 'fall'] as const)
      for (const n of [0, 0.3, 1]) for (const v of Object.values(ambientMix(n, s))) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
  })
})

describe('pickSpecies', () => {
  it('picks only birds that are around that season', async () => {
    const { pickSpecies } = await import('./birdsong')
    for (let r = 0; r < 1; r += 0.01) {
      expect(pickSpecies('winter', r)).not.toBe('robin')
      expect(pickSpecies('summer', r)).not.toBe('blueJay')
    }
  })
})

describe('weatherMix', () => {
  it('sends birds and yard work indoors in rain and snow, and adds wind', async () => {
    const { weatherMix } = await import('./ambience')
    const day = ambientMix(0, 'summer')
    const storm = weatherMix(day, { rain: 1, snow: 0, wind: 0.7, wet: 1 })
    expect(storm.birds).toBeLessThan(day.birds * 0.2)
    expect(storm.yard).toBe(0)
    expect(storm.cicadas).toBe(0)
    expect(storm.wind).toBeGreaterThan(day.wind)
    const snow = weatherMix(ambientMix(0, 'winter'), { rain: 0, snow: 1, wind: 1, wet: 0 })
    expect(snow.traffic).toBeLessThan(ambientMix(0, 'winter').traffic)
    expect(snow.leaves).toBe(0)
    for (const v of Object.values(storm)) expect(v).toBeLessThanOrEqual(1)
  })
})

describe('noiseBuffer', () => {
  // Just enough of an AudioContext to fill a buffer.
  const ctx = {
    sampleRate: 8000,
    createBuffer: (_c: number, len: number) => {
      const data = new Float32Array(len)
      return { getChannelData: () => data, length: len }
    },
  } as unknown as BaseAudioContext
  it('loops brown noise without a jump at the seam', () => {
    for (let k = 0; k < 20; k++) {
      const d = noiseBuffer(ctx, 4, true).getChannelData(0)
      let step = 0
      for (let i = 1; i < d.length; i++) step = Math.max(step, Math.abs(d[i] - d[i - 1]))
      expect(Math.abs(d[d.length - 1] - d[0])).toBeLessThanOrEqual(step)
    }
  })
})

// Leaving the Crate Depot restarts the town's sounds; building their noise and echo again froze the page.
describe('keptBuffer', () => {
  it('builds each sound buffer once per audio context', () => {
    let n = 0
    const a = {} as BaseAudioContext
    const b = {} as BaseAudioContext
    const make = () => ({ n: ++n }) as unknown as AudioBuffer
    expect(keptBuffer(a, 'room', make)).toBe(keptBuffer(a, 'room', make))
    expect(n).toBe(1)
    keptBuffer(b, 'room', make)
    keptBuffer(a, 'hall', make)
    expect(n).toBe(3)
  })

  it('is what the town sounds and music use', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('src/lib/ambience.ts', 'utf8')).not.toMatch(/= (noiseBuffer|echoTail)\(ctx/)
    expect(readFileSync('src/lib/townMusic.ts', 'utf8')).not.toMatch(/= hallBuffer\(ctx/)
  })
})
