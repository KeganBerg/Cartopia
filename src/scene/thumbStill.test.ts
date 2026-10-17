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
