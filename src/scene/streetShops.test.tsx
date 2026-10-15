// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { InstancedMesh, Object3D } from 'three'
import { StreetShops, streetPieces, type Slot } from './StreetShops'

// A mile on Main Street: hundreds of spots, but only a handful of models to build.
const slots: Slot[] = Array.from({ length: 300 }, (_, i) => ({ z: i * 5, side: i % 2 ? 1 : -1, def: ['pizza', 'diner', 'gas'][i % 3] }))

describe('streetPieces', () => {
  const pieces = streetPieces(slots)

  it('builds each shop and tree once, however long the street', () => {
    expect(pieces.map((p) => p.key).sort()).toEqual(['shop:diner', 'shop:gas', 'shop:pizza', 'tree:palm', 'tree:tree'])
  })

  it('still stands a shop and a tree at every spot', () => {
    const count = (shop: boolean) => pieces.filter((p) => p.shop === shop).reduce((n, p) => n + p.at.length, 0)
    expect(count(true)).toBe(300)
    expect(count(false)).toBe(300)
  })

  it('puts each shop on its own side of the road, down the street', () => {
    const pizza = pieces.find((p) => p.key === 'shop:pizza')!
    expect(pizza.at[0].elements[12]).toBeLessThan(0)
    expect(pizza.at[0].elements[14]).toBe(0)
    expect(pizza.at[1].elements[14]).toBe(15)
  })
})

describe('StreetShops', () => {
  it('draws the merged models at every spot and hides the models themselves', async () => {
    const r = await ReactThreeTestRenderer.create(<StreetShops slots={slots} />)
    const all: Object3D[] = []
    r.scene.instance.traverse((o) => void all.push(o))
    const many = all.filter((o) => (o as InstancedMesh).isInstancedMesh) as InstancedMesh[]
    expect(many.length).toBeGreaterThan(0)
    const parts = new Set(many.map((m) => m.geometry.uuid))
    expect(parts.size).toBeGreaterThan(4)
    const pattern = all.find((o) => o.children.some((c) => c.name === 'shop:pizza'))!
    expect(pattern.visible).toBe(false)
    await r.unmount()
  })
})
