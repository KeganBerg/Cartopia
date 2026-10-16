// @vitest-environment jsdom
import '../testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { BufferGeometry, Mesh, Object3D } from 'three'
import { VENUES, WORLD_VENUES, pickVenue, venue } from '../venues'
import { WORLD_TOUR } from '../../game/worldTour'
import { WORLD_SCENERY } from './WorldVenue'

// Across the whole mile; the camera only ever sees the stretch ahead (far plane 150), about a
// quarter of these at once. Measured 160 to 640 draws and 14k to 82k shape vertices.
const DRAWS = 800
const VERTS = 150000

describe('World Tour venues', () => {
  it('gives every tour stop its own country venue', () => {
    const ids = WORLD_TOUR.map((r) => r.venue)
    expect(new Set(ids).size).toBe(WORLD_TOUR.length)
    expect([...ids].sort()).toEqual(WORLD_VENUES.map((v) => v.id).sort())
    for (const id of ids) {
      expect(venue(id).id).toBe(id)
      expect(venue(id).world).toBe(true)
      expect(VENUES.map((v) => v.id)).toContain(venue(id).base)
    }
  })
  it('keeps the original maps in every other mode', () => {
    for (let i = 0; i < 300; i++) expect(pickVenue(`race-${i}`).world).toBeFalsy()
  })
  it('has its own scenery for each country, not a stand-in', async () => {
    expect(Object.keys(WORLD_SCENERY).sort()).toEqual(WORLD_VENUES.map((v) => v.id).sort())
    const views = new Set()
    for (const load of Object.values(WORLD_SCENERY)) views.add((await load()).default)
    expect(views.size).toBe(WORLD_VENUES.length)
  }, 60000)
  // Phones: a mile of country stays a few hundred draws and a few MB of shapes, because
  // repeated houses, trees and lamps are instanced and the rest is merged.
  it('dresses a mile within the phone budget', async () => {
    for (const [id, load] of Object.entries(WORLD_SCENERY)) {
      const View = (await load()).default
      const r = await ReactThreeTestRenderer.create(<View len={550} race={400} />)
      const scene = r.scene.instance as Object3D
      let draws = 0
      const geos = new Set<BufferGeometry>()
      scene.traverseVisible((o) => {
        const m = o as Mesh
        if (!m.isMesh) return
        draws++
        geos.add(m.geometry)
      })
      const verts = [...geos].reduce((n, g) => n + g.getAttribute('position').count, 0)
      await r.unmount()
      expect(draws, id).toBeLessThan(DRAWS)
      expect(verts, id).toBeLessThan(VERTS)
    }
  }, 120000)
})
