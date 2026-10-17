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
