import { describe, expect, it } from 'vitest'
import { ShaderChunk } from 'three'
import { SAFE } from './safeColor'

// The guard runs in GLSL; this repeats it in JS to pin down what it does to a pixel.
const guard = (v: number) => Math.min(SAFE, Math.max(-SAFE, Number.isNaN(v) ? 0 : v))

describe('safe colour', () => {
  it('ends every material with the guard', () => {
    expect(ShaderChunk.colorspace_fragment).toContain('isnan(gl_FragColor)')
    expect(ShaderChunk.colorspace_fragment.match(/nanc/g)?.length).toBeGreaterThan(0)
  })

  it('turns NaN black, holds infinity under the half-float limit and leaves normal colour alone', () => {
    expect(guard(NaN)).toBe(0)
    expect(guard(Infinity)).toBe(SAFE)
    expect(guard(-Infinity)).toBe(-SAFE)
    expect(guard(1e9)).toBe(SAFE)
    expect(SAFE).toBeLessThan(65504)
    // Bright enough for any glow: the bloom starts at 1 and tone mapping tops out well below this.
    expect(SAFE).toBeGreaterThanOrEqual(1000)
    expect(guard(0.42)).toBe(0.42)
    expect(guard(3.5)).toBe(3.5)
  })
})
