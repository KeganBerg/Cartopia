import { describe, expect, it } from 'vitest'
import { spread, type Placed } from './anchors'

// The bubble layout before it was made quick: every spot tried against every bubble placed
// before it. The quick one must put every bubble in exactly the same spot.
const HOP = 64
const CHIP = 8
type Box = { left: number; right: number; top: number; bottom: number }
function reference(placed: Placed[], width: number, height: number, hud: Box[], done: (a: Placed, under: boolean) => void) {
  const underHud = (x: number, y: number, w: number, h: number) => hud.some((r) => x + w / 2 > r.left && x - w / 2 < r.right && y > r.top && y - h < r.bottom)
  const top = Math.min(200, height / 3)
  const free = (a: Placed, x: number, y: number, upto: number) => {
    if (x - a.w / 2 < 2 || x + a.w / 2 + CHIP > width - 2 || y - a.h < Math.min(top, a.y0 - a.h) || underHud(x, y, a.w, a.h)) return false
    for (let j = 0; j < upto; j++) {
      const b = placed[j]
      if (Math.abs(x - b.x) < (a.w + b.w) / 2 + CHIP && y > b.y - b.h - CHIP && y - a.h - CHIP < b.y) return false
    }
    return true
  }
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i]
    if (!a.fixed) a.x = Math.min(Math.max(a.x, a.w / 2 + 4), width - a.w / 2 - CHIP - 4)
    if (!a.fixed && !free(a, a.x, a.y, i)) {
      let best: [number, number] | null = null
      let bestD = HOP * HOP
      for (let j = 0; j < i; j++) {
        const b = placed[j]
        const spots: [number, number][] = [
          [a.x, b.y - b.h - CHIP - 1], [a.x, b.y + a.h + CHIP + 1],
          [b.x - (a.w + b.w) / 2 - CHIP - 1, a.y], [b.x + (a.w + b.w) / 2 + CHIP + 1, a.y],
        ]
        for (const [x, y] of spots) {
          const d = (x - a.x) ** 2 + (y - a.y) ** 2
          if (d < bestD && free(a, x, y, i)) {
            best = [x, y]
            bestD = d
          }
        }
      }
      if (best) [a.x, a.y] = best
    }
    done(a, !a.fixed && underHud(a.x, a.y, a.w, a.h))
  }
}

// A seeded random town's worth of bubbles, crowded together like a big town zoomed out.
function bubbles(seed: number, n: number, width: number, height: number) {
  let s = seed
  const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
  const out: Placed[] = []
  for (let i = 0; i < n; i++) {
    const x = r() * (width + 80) - 40
    const y = r() * height
    out.push({ el: {} as HTMLElement, x, y, x0: x, y0: y, w: 28 + Math.round(r() * 60), h: 26 + Math.round(r() * 14), fixed: r() < 0.05 })
  }
  return out.sort((a, b) => b.y - a.y)
}

const run = (fn: typeof spread, list: Placed[], width: number, height: number, hud: Box[], slide: number) => {
  const got: number[] = []
  fn(list, width, height, hud, (a, under) => {
    got.push(a.x, a.y, under ? 1 : 0)
    // The projector slides each bubble part way to its spot before the next is placed.
    if (!a.fixed) {
      a.x = a.x0 + (a.x - a.x0) * slide
      a.y = a.y0 + (a.y - a.y0) * slide
    }
  })
  return got
}

describe('bubble spread', () => {
  const hud: Box[] = [{ left: 0, right: 160, top: 0, bottom: 60 }, { left: 250, right: 390, top: 0, bottom: 48 }]
  it('puts every bubble where the full search did', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const n = 10 + (seed * 7) % 140
      const [w, h] = seed % 2 ? [390, 844] : [1280, 720]
      const slide = seed % 3 ? 1 : 0.3
      const a = bubbles(seed, n, w, h)
      const b = a.map((p) => ({ ...p }))
      expect(run(spread, a, w, h, hud, slide)).toEqual(run(reference, b, w, h, hud, slide))
    }
  })
  it('stays quick with a big town on screen', () => {
    const list = bubbles(7, 160, 390, 844)
    const t = performance.now()
    for (let k = 0; k < 20; k++) run(spread, list.map((p) => ({ ...p })), 390, 844, hud, 1)
    // The full search took tens of ms for each of these; the quick one well under one.
    expect((performance.now() - t) / 20).toBeLessThan(5)
  })
})
