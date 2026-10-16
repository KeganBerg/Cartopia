// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { Object3D, OrthographicCamera } from 'three'
import { BOW_RADIUS, placeBow } from './Atmosphere'

const townCam = (zoom: number, x = 0) => {
  const c = new OrthographicCamera(-20, 20, 12, -12, 0.1, 1000)
  c.position.set(60 + x, 60, 60)
  c.lookAt(x, 0, 0)
  c.zoom = zoom
  c.updateProjectionMatrix()
  c.updateMatrixWorld()
  return c
}

describe('town rainbow', () => {
  it('stays the same size and place in the world at any zoom or pan', () => {
    const a = new Object3D()
    const b = new Object3D()
    placeBow(a, townCam(1))
    placeBow(b, townCam(3.5, 14))
    expect(a.scale.x).toBe(BOW_RADIUS)
    expect(b.scale.x).toBe(BOW_RADIUS)
    expect(b.position.distanceTo(a.position)).toBeLessThan(1e-6)
  })
})
