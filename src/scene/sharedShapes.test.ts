import { describe, expect, it } from 'vitest'
import { BoxGeometry, CylinderGeometry } from 'three'
import { SHARED, sharedShapes } from './sharedShapes'
import { plainMat } from './shared'

// What <boxGeometry args={...} /> and the other simple shapes build in the game (main.tsx loads these into R3F).
const { BoxGeometry: Box, CylinderGeometry: Cyl } = SHARED

describe('shared shapes', () => {
  it('gives every mesh with the same numbers the same geometry', () => {
    const a = new Box(1, 0.25, 0.125)
    expect(new Box(1, 0.25, 0.125)).toBe(a)
    expect(a).toBeInstanceOf(BoxGeometry)
    expect(a.parameters).toMatchObject({ width: 1, height: 0.25, depth: 0.125 })
    expect(a.getAttribute('position').array).toEqual(new BoxGeometry(1, 0.25, 0.125).getAttribute('position').array)
    // Flags (an open-ended cylinder) share too, and count.
    expect(new Cyl(0.1, 0.1, 1, 8, 1, true)).toBe(new Cyl(0.1, 0.1, 1, 8, 1, true))
    expect(new Cyl(0.1, 0.1, 1, 8, 1, true)).not.toBe(new Cyl(0.1, 0.1, 1, 8, 1, false))
    expect(new Cyl(0.1, 0.1, 1, 8)).toBeInstanceOf(CylinderGeometry)
  })

  it('keeps a shape until its last mesh has gone', () => {
    const before = sharedShapes()
    const a = new Box(0.75, 0.5, 0.5)
    new Box(0.75, 0.5, 0.5)
    new Box(0.75, 0.5, 0.5)
    expect(sharedShapes()).toBe(before + 1)
    let disposed = 0
    a.addEventListener('dispose', () => void disposed++)
    a.dispose()
    a.dispose()
    expect(disposed).toBe(0)
    expect(new Box(0.75, 0.5, 0.5)).toBe(a)
    a.dispose()
    a.dispose()
    expect(disposed).toBe(1)
    expect(sharedShapes()).toBe(before)
    expect(new Box(0.75, 0.5, 0.5)).not.toBe(a)
  })

  it('gives a new size its own shape, and a copy its own geometry', () => {
    const a = new Box(2, 1, 1)
    expect(new Box(3, 1, 1)).not.toBe(a)
    const copy = a.clone()
    expect(copy).not.toBe(a)
    expect(copy.parameters.width).toBe(2)
    expect(copy.getAttribute('position').array).toEqual(a.getAttribute('position').array)
    copy.translate(5, 0, 0)
    expect(a.getAttribute('position').getX(0)).toBe(new BoxGeometry(2, 1, 1).getAttribute('position').getX(0))
    expect(new Box()).not.toBe(new Box())
  })
})

describe('plain materials', () => {
  it('shares one per colour and texture', () => {
    expect(plainMat('#ff0000')).toBe(plainMat('#ff0000'))
    expect(plainMat('#ff0000')).not.toBe(plainMat('#00ff00'))
    expect(plainMat('#ff0000').color.getHexString()).toBe('ff0000')
  })
})
