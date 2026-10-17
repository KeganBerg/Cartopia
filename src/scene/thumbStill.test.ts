import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chooseFocus, pickThumbs, STILL_PER_FRAME, type Slot as S } from './thumbCopy'

const slot = (key: string, o: Partial<S> = {}): S => ({ key, still: false, scene: false, angle: 0.12, fresh: true, seen: true, ctx: {} as CanvasRenderingContext2D, canvas: { width: 100, height: 80 } as HTMLCanvasElement, ...o })
const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height })

describe('thumbnails: one turns, the rest hold', () => {
  it('draws a held picture once and leaves it', () => {
    const s = slot('b|shop|10')
    expect(pickThumbs([s], () => true).need.size).toBe(1)
    s.fresh = false
    const { need, waiting } = pickThumbs([s], () => true)
    expect(need.size).toBe(0)
    expect(waiting).toBe(false)
  })

  it('draws the turning one every frame', () => {
    const s = slot('c|car', { fresh: false })
    const { need } = pickThumbs([s, slot('c|other', { fresh: false })], () => true, { focus: s })
    expect([...need.values()].map((n) => [n.key, n.spin])).toEqual([['c|car', true]])
  })

  it('fills a page of held pictures a few per frame, never all in one', () => {
    const page = Array.from({ length: 40 }, (_, i) => slot(`b|k${i}|10`))
    const { need, waiting } = pickThumbs(page, () => true)
    expect(need.size).toBe(STILL_PER_FRAME)
    expect(waiting).toBe(true)
  })

  it('draws one model once for two held copies at the same turn', () => {
    const { need } = pickThumbs([slot('c|car'), slot('c|car')], () => true)
    expect(need.size).toBe(1)
    expect([...need.values()][0].slots).toHaveLength(2)
  })

  it('keeps arcade scenes animating only when they are due', () => {
    const sc = slot('s|arcade', { scene: true, fresh: false })
    expect(pickThumbs([sc], () => true, { scenes: true }).need.size).toBe(1)
    expect(pickThumbs([sc], () => true, { scenes: false }).need.size).toBe(0)
  })

  it('waits for a model that has not mounted yet', () => {
    const { need, waiting } = pickThumbs([slot('b|new|1')], () => false)
    expect(need.size).toBe(0)
    expect(waiting).toBe(true)
  })

  it('turns the hero car, or the card nearest the middle of a grid', () => {
    expect(chooseFocus([{ slot: 'small', box: box(150, 400, 90, 60) }, { slot: 'hero', box: box(20, 40, 300, 160) }], 390, 844)).toBe('hero')
    const grid = [0, 1, 2, 3, 4, 5].map((i) => ({ slot: i, box: box((i % 2) * 190, Math.floor(i / 2) * 280, 180, 120) }))
    expect(chooseFocus(grid, 390, 844)).toBe(3)
    expect(chooseFocus([{ slot: 'gone', box: box(0, 900, 100, 100) }], 390, 844)).toBe(null)
  })

  // Shop > Upgrades in a late-game town redrew every card's detailed building 24 times a second.
  it('shows Shop > Upgrades cards as held pictures', () => {
    expect(readFileSync('src/ui/Upgrade.tsx', 'utf8')).toMatch(/<BuildingThumb [^>]*\bstill\b/)
  })
})

// Kegan 10-16/10-17 "still being squished": the Car Packs showcase (wide) and the pack card
// (squarer) show the same car, were drawn once at the bigger of each side, and the card's copy
// came out squeezed. Every copy must keep the shape it was drawn at.
describe('thumbnail shape', () => {
  const sized = (key: string, width: number, height: number) => slot(key, { canvas: { width, height } as HTMLCanvasElement })
  const ratio = (w: number, h: number) => w / h

  it('draws one model separately for boxes of different shapes', () => {
    const { need } = pickThumbs([sized('sc|vanta', 520, 200), sized('sc|vanta', 190, 130)], () => true)
    expect(need.size).toBe(2)
  })

  it('never copies a drawing into a box of another shape, the turning one included', () => {
    const sizes = [[520, 200], [190, 130], [180, 120], [96, 96], [300, 210], [150, 60], [600, 600], [64, 48]]
    const { need } = pickThumbs(sizes.map(([w, h]) => sized('c|car', w, h)), () => true, { budget: 99 })
    for (const n of need.values()) for (const s of n.slots) {
      const off = ratio(s.canvas.width, s.canvas.height) / ratio(n.w, n.h)
      expect(Math.abs(off - 1), `${s.canvas.width}x${s.canvas.height} from ${n.w}x${n.h}`).toBeLessThan(0.03)
      expect(n.w).toBeGreaterThanOrEqual(s.canvas.width - 1)
    }
  })

  it('still draws one model once for two boxes of the same shape', () => {
    const { need } = pickThumbs([sized('c|car', 100, 80), sized('c|car', 200, 160)], () => true)
    expect(need.size).toBe(1)
    expect([...need.values()][0]).toMatchObject({ w: 200, h: 160 })
  })
})
