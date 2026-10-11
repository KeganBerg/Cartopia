import { describe, expect, it } from 'vitest'
import { BoxGeometry, DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Texture } from 'three'
import { bake, bakeable } from './bake'

describe('baking plain parts together', () => {
  it('only takes materials whose look a vertex can carry', () => {
    expect(bakeable(new MeshStandardMaterial({ color: '#c62828', roughness: 0.4, metalness: 0.2, emissive: '#ff0000', emissiveIntensity: 2 }))).toBe(true)
    expect(bakeable(new MeshStandardMaterial({ side: DoubleSide }))).toBe(true)
    expect(bakeable(new MeshBasicMaterial({ color: '#fafafa' }))).toBe(true)
    expect(bakeable(new MeshStandardMaterial({ map: new Texture() }))).toBe(false)
    expect(bakeable(new MeshStandardMaterial({ transparent: true, opacity: 0.5 }))).toBe(false)
    expect(bakeable(new MeshStandardMaterial({ flatShading: true }))).toBe(false)
    expect(bakeable(new MeshBasicMaterial({ toneMapped: false }))).toBe(false)
    expect(bakeable(new MeshPhysicalMaterial())).toBe(false)
    const custom = new MeshStandardMaterial()
    custom.onBeforeCompile = () => {}
    expect(bakeable(custom)).toBe(false)
  })

  it('merges parts with their finish per vertex, double-sided parts drawn both ways', () => {
    const g = bake([
      [new BoxGeometry(1, 1, 1), { color: '#ff0000', rough: 0.3 }],
      [new BoxGeometry(1, 1, 1), { color: '#00ff00', double: true, unlit: true }],
    ])
    const one = new BoxGeometry(1, 1, 1)
    const verts = one.getAttribute('position').count
    expect(g.getAttribute('position').count).toBe(verts * 3)
    expect(g.index!.count).toBe(one.index!.count * 3)
    const look = g.getAttribute('look')
    expect(look.getY(0)).toBeCloseTo(0.3)
    expect(look.getZ(verts)).toBe(1)
    // The back copy has its normals flipped and its winding reversed.
    const n = g.getAttribute('normal')
    expect(n.getX(verts * 2)).toBe(-n.getX(verts))
    const idx = g.index!.array
    const front = one.index!.count
    expect([idx[front * 2], idx[front * 2 + 1], idx[front * 2 + 2]]).toEqual([idx[front] + verts, idx[front + 2] + verts, idx[front + 1] + verts])
  })
})
