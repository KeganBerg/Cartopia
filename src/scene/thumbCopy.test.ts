import { describe, expect, it } from 'vitest'
import { copyThumbs } from './thumbCopy'

// A 2D context that remembers what it was drawn from.
const ctx = () => {
  const from: unknown[] = []
  return { from, clearRect: () => {}, drawImage: (img: unknown) => void from.push(img) }
}

describe('thumbnail copies', () => {
  it('reads the 3D picture back once a frame, however many thumbs show', () => {
    const atlas = { id: '3d' } as unknown as CanvasImageSource
    const flat = { id: 'flat' } as unknown as CanvasImageSource
    let reads = 0
    const thumbs = Array.from({ length: 18 }, () => ctx())
    const placed = thumbs.map((c, i) => ({ x: i * 64, y: 0, w: 64, h: 48, slots: [{ canvas: { width: 64, height: 48 }, ctx: c }] }))
    copyThumbs(atlas, 18 * 64, 48, placed, (src) => (reads++, expect(src).toBe(atlas), flat))
    expect(reads).toBe(1)
    for (const c of thumbs) expect(c.from).toEqual([flat])
  })

  it('copies straight from the 3D picture when there is no plain canvas', () => {
    const atlas = { id: '3d' } as unknown as CanvasImageSource
    const c = ctx()
    copyThumbs(atlas, 64, 48, [{ x: 0, y: 0, w: 64, h: 48, slots: [{ canvas: { width: 64, height: 48 }, ctx: c }] }], () => null)
    expect(c.from).toEqual([atlas])
  })
})
