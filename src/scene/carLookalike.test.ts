// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { CARS, isBike } from '../game/data'
import { carFrame, freshGeo } from './CarModel'
import { edgeGap, edges, likeness, silhouette } from './carSilhouette'
import { MODEL_SHAPE } from './carLooks'

// No two cars may read as the same car in another colour. Each car (stock, no mods) is drawn
// into outline masks from the side, the front and above, scaled to one length as the showroom
// shows it, and every pair is compared two ways: how much the outlines overlap, and how far
// apart their roof line, shoulder line and plan width run. Two cars on one body with nothing of
// their own (src/scene/carLooks.ts) overlap 0.96 to 1.0 and sit within a cell or so.

// Mean overlap over union above this is a look-alike.
const MAX_OVERLAP = 0.95
// Mean edge gap (in 0.0125 cells, the side counted twice) below this is a look-alike.
const MIN_GAP = 1.5

describe('every car has a look of its own', () => {
  const cars = CARS.filter((c) => !isBike(c.body))
  const sil = cars.map((c) => {
    const f = carFrame(c.body, c.id)
    const s = silhouette(Object.values(freshGeo(c.body, {}, c.id).parts), { radius: f.wheel, width: 0.14, wx: f.wx, wz: f.wz }, 1.4 / f.len)
    return { s, e: edges(s) }
  })
  it('no two cars share an outline', () => {
    const bad: string[] = []
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
      const o = likeness(sil[i].s, sil[j].s).mean
      const g = edgeGap(sil[i].e, sil[j].e)
      const gap = (g.side * 2 + g.front + g.top) / 4
      if (o > MAX_OVERLAP || gap < MIN_GAP) bad.push(`${cars[i].id} (${cars[i].body}) and ${cars[j].id} (${cars[j].body}): overlap ${o.toFixed(3)}, gap ${gap.toFixed(2)}`)
    }
    expect(bad).toEqual([])
  })
  // The check itself: without their own proportions the Rattler GT and the Brawler are the
  // same muscle car with different trim, as they were before carLooks.ts, and that is caught.
  it('flags two cars that differ only in trim', () => {
    const own = { rattler: MODEL_SHAPE.rattler, charger: MODEL_SHAPE.charger }
    delete MODEL_SHAPE.rattler
    delete MODEL_SHAPE.charger
    try {
      const f = carFrame('muscle')
      const draw = (model: string) => silhouette(Object.values(freshGeo('muscle', {}, model).parts), { radius: f.wheel, width: 0.14, wx: f.wx, wz: f.wz }, 1.4 / f.len)
      expect(likeness(draw('rattler'), draw('charger')).mean).toBeGreaterThan(MAX_OVERLAP)
    } finally {
      Object.assign(MODEL_SHAPE, own)
      freshGeo('muscle', {})
    }
  })
}, 600000)
