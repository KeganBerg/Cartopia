// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { Object3D } from 'three'
import { CarModel, carFrame } from './CarModel'
import { Footprinted, footprint } from './footprint'
import { CARS } from '../game/data'
import { PARK_LEN, PARKED_W } from '../game/arcade'
import type { Footprint } from '../game/collide'

// The arcade games collide with each car's footprint as drawn. It must cover the whole
// model (wheels and bumpers stick out past the body's frame) and leave out the headlight
// beams, which are painted on the road ahead after dark.

const bodies = [...new Map(CARS.map((c) => [c.body, c])).values()]

async function measure(el: React.ReactElement) {
  const r = await ReactThreeTestRenderer.create(el)
  const f = footprint(r.scene.instance as Object3D)!
  await r.unmount()
  return f
}

describe('car footprints', () => {
  it('cover the model, beams or not', async () => {
    for (const c of bodies) {
      const plain = await measure(<CarModel body={c.body} model={c.id} color="#888" />)
      const lit = await measure(<CarModel body={c.body} model={c.id} color="#888" beams />)
      expect(lit, c.body).toEqual(plain)
      const f = carFrame(c.body)
      expect(plain.l, c.body).toBeGreaterThanOrEqual(f.len - 0.01)
      expect(plain.l, c.body).toBeLessThan(f.len + 0.4)
      expect(plain.w, c.body).toBeGreaterThanOrEqual(f.wid * 0.9)
      expect(Math.abs(plain.cz), c.body).toBeLessThan(0.1)
    }
    // Two full renders per body: over vitest's 5 s default on CI runners now there are more bodies.
  }, 30000)

  it('fits every car in a parking lot car space', async () => {
    for (const c of bodies) {
      let got: Footprint | null = null
      const r = await ReactThreeTestRenderer.create(
        <Footprinted id={c.id} fit={[PARK_LEN, PARKED_W]} onFoot={(f) => void (got = f)}>
          <CarModel body={c.body} model={c.id} color="#888" />
        </Footprinted>,
      )
      const drawn = footprint(r.scene.instance as Object3D)!
      await r.unmount()
      expect(got, c.body).not.toBeNull()
      const f = got! as Footprint
      expect(f.l, c.body).toBeLessThanOrEqual(PARK_LEN + 1e-6)
      expect(f.w, c.body).toBeLessThanOrEqual(PARKED_W + 1e-6)
      // What it reports is what's drawn.
      expect(drawn.w, c.body).toBeCloseTo(f.w, 5)
      expect(drawn.l, c.body).toBeCloseTo(f.l, 5)
    }
  })
})
