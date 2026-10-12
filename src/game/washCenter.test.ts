import { describe, expect, it } from 'vitest'
import { washLayout, isWashCenter, TUNNEL_D } from './washCenter'

const BLOCKS: [number, number][] = [[2, 1], [1, 2], [2, 2], [4, 4]]

describe('wash center layout', () => {
  it('only merged car washes at level 7+ become one', () => {
    expect(isWashCenter('carwash', 7, [2, 1, 1])).toBe(true)
    expect(isWashCenter('carwash', 10, [4, 4, 4])).toBe(true)
    expect(isWashCenter('carwash', 6, [2, 2, 2])).toBe(false)
    expect(isWashCenter('carwash', 10, [1, 1, 1])).toBe(false)
    expect(isWashCenter('gas', 10, [2, 2, 2])).toBe(false)
  })

  for (const [sx, sz] of BLOCKS) {
    it(`fits the ${sx}x${sz} block without vacuum bays in the tunnels`, () => {
      const w = washLayout(sx, sz)
      expect(w.tunnels.length).toBeGreaterThan(0)
      expect(w.vacs.length).toBeGreaterThan(0)
      for (const t of w.tunnels) {
        expect(t.x0).toBeGreaterThanOrEqual(-w.L / 2)
        expect(t.x1).toBeLessThanOrEqual(w.L / 2)
        expect(Math.abs(t.z) + TUNNEL_D / 2).toBeLessThanOrEqual(w.D / 2)
      }
      const lastTunnel = w.tunnels[w.tunnels.length - 1]
      // A bay's reach from its centre: the posts on one side, the car's
      // length on the other (turned a quarter when parked along the front).
      const [hx, back, ahead] = w.along ? [0.5, 0.47, 0.3] : [0.47, 0.45, 0.55]
      for (const v of w.vacs) {
        expect(Math.abs(v.x) + hx).toBeLessThanOrEqual(w.L / 2)
        expect(v.z + ahead).toBeLessThanOrEqual(w.D / 2)
        expect(v.z - back).toBeGreaterThan(lastTunnel.z + TUNNEL_D / 2)
      }
    })
  }
})
