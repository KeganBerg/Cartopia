import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pickThumbs, STILL_PER_FRAME, type Slot as S } from './thumbCopy'

const slot = (key: string, still: boolean, fresh = true): S => ({ key, still, fresh, seen: true, ctx: {} as CanvasRenderingContext2D, canvas: { width: 100, height: 80 } as HTMLCanvasElement })

describe('still thumbnails', () => {
  it('draws a still picture once and leaves it', () => {
    const s = slot('b|shop|10', true)
    expect(pickThumbs([s], () => true).need.size).toBe(1)
    s.fresh = false
    const { need, waiting } = pickThumbs([s], () => true)
    expect(need.size).toBe(0)
    expect(waiting).toBe(false)
  })

  it('fills a page of still pictures a few per frame, never all in one', () => {
    const page = Array.from({ length: 40 }, (_, i) => slot(`b|k${i}|10`, true))
    const { need, waiting } = pickThumbs(page, () => true)
    expect(need.size).toBe(STILL_PER_FRAME)
    expect(waiting).toBe(true)
  })

  it('keeps turning thumbnails turning, and draws a model once for its still and turning copies', () => {
    const spin = slot('c|car', false, false)
    const { need } = pickThumbs([spin, slot('c|car', true), slot('c|car', true)], () => true)
    expect(need.size).toBe(2)
    expect([...need.values()].find((n) => n.still)!.slots).toHaveLength(2)
  })

  it('waits for a model that has not mounted yet', () => {
    const { need, waiting } = pickThumbs([slot('b|new|1', true)], () => false)
    expect(need.size).toBe(0)
    expect(waiting).toBe(true)
  })

  // Shop > Upgrades in a late-game town redrew every card's detailed building 24 times a second.
  it('shows Shop > Upgrades cards as still pictures', () => {
    expect(readFileSync('src/ui/Upgrade.tsx', 'utf8')).toMatch(/<BuildingThumb [^>]*\bstill\b/)
  })
})

// Kegan 10-16/10-17 "still being squished": the Car Packs showcase (wide) and the pack card
// (squarer) show the same car, were drawn once at the bigger of each side, and the card's copy
// came out squeezed. Every copy must keep the shape it was drawn at.
describe('thumbnail shape', () => {
  const box = (key: string, width: number, height: number): S => ({ key, still: false, fresh: true, seen: true, ctx: {} as CanvasRenderingContext2D, canvas: { width, height } as HTMLCanvasElement })
  const ratio = (w: number, h: number) => w / h

  it('draws one model separately for boxes of different shapes', () => {
    const { need } = pickThumbs([box('sc|vanta', 520, 200), box('sc|vanta', 190, 130)], () => true)
    expect(need.size).toBe(2)
  })

  it('never copies a drawing into a box of another shape', () => {
    const sizes = [[520, 200], [190, 130], [180, 120], [96, 96], [300, 210], [150, 60], [600, 600], [64, 48]]
    const { need } = pickThumbs(sizes.map(([w, h]) => box('c|car', w, h)), () => true)
    for (const n of need.values()) for (const s of n.slots) {
      const off = ratio(s.canvas.width, s.canvas.height) / ratio(n.w, n.h)
      expect(Math.abs(off - 1), `${s.canvas.width}x${s.canvas.height} from ${n.w}x${n.h}`).toBeLessThan(0.03)
      expect(n.w).toBeGreaterThanOrEqual(s.canvas.width - 1)
    }
  })

  it('still draws one model once for two boxes of the same shape', () => {
    const { need } = pickThumbs([box('c|car', 100, 80), box('c|car', 200, 160)], () => true)
    expect(need.size).toBe(1)
    expect([...need.values()][0]).toMatchObject({ w: 200, h: 160 })
  })
})
