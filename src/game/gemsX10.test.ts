import { describe, expect, it } from 'vitest'
import { gemsX10 } from './store'

// A tiny localStorage stand-in.
const storage = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('gems x10 on load', () => {
  it('multiplies a guest town\'s gems by ten, once', () => {
    const st = storage()
    expect(gemsX10({ bucks: 42 }, st)).toEqual({ bucks: 420 })
    expect(gemsX10({ bucks: 420 }, st)).toEqual({ bucks: 420 })
  })

  it('leaves a signed-in town to the server, and never scales it later', () => {
    const st = storage({ 'cartopia-save-owner': 'u1' })
    expect(gemsX10({ bucks: 42 }, st)).toEqual({ bucks: 42 })
    expect(st.getItem('cartopia-gems-x10')).toBe('1')
  })

  it('marks a brand-new town as already scaled', () => {
    const st = storage()
    expect(gemsX10(null, st)).toBeNull()
    expect(gemsX10({ bucks: 100 }, st)).toEqual({ bucks: 100 })
  })
})
