// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Vector3, type Matrix4, type Mesh, type Object3D } from 'three'
import { CARS, MODS, TRACK_SKINS, isBike } from '../game/data'
import { CarModel, carFrame, isTracked, wheelRig } from './CarModel'
import { gearSlabs, linkCount, linkGeo, placeLinks, trackLoop, type Pads } from './tankTrack'

// Kegan (2026-10-16): "Make all look like a real tank track, tanks don't have wheels right?"
// The Tomahawk's tracks ran round car tyres on gold spoke rims. A tracked body now has only
// tank running gear inside its tracks (sprocket, idler, road wheels, rollers, arms): no car
// tyre or rim mesh may render on it, whatever Rims mod, rim paint or track skin it wears, in
// the garage (whole) or in town (lean).

const tracked = [...new Set(CARS.map((c) => c.body))].filter((b) => !isBike(b) && isTracked(b))
const RIMS = MODS.filter((m) => m.slot === 'rims').map((m) => m.id)

async function meshes(el: React.ReactElement) {
  const r = await ReactThreeTestRenderer.create(el)
  await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
  const out: Mesh[] = []
  ;(r.scene.instance as Object3D).traverse((o) => void ((o as Mesh).isMesh && out.push(o as Mesh)))
  await r.unmount()
  return out
}

describe('tracked bodies have tank running gear, never car wheels', () => {
  it('there is a tracked body to check', () => expect(tracked.length).toBeGreaterThan(0))
  for (const body of tracked) {
    const model = CARS.find((c) => c.body === body)!.id
    for (const lean of [false, true]) it(`${body} ${lean ? 'in town' : 'whole'}`, async () => {
      const looks = [undefined, ...RIMS].map((rims, i) => ({ rims, skin: TRACK_SKINS[i % TRACK_SKINS.length]?.id }))
      for (const { rims, skin } of looks) {
        const all = await meshes(
          <CarModel body={body} model={model} color="#c62828" mods={rims ? [rims] : []} modSkin={skin ? { tracks: skin } : null} panels={{ rims: { color: '#ffd34d' } }} lean={lean} rig={wheelRig(body)} />,
        )
        const wheels = all.filter((m) => m.geometry.userData.carWheel)
        expect(wheels.map((m) => `${rims ?? 'stock'} ${m.name || m.geometry.type}`)).toEqual([])
        expect(all.filter((m) => m.userData.tankGear).length).toBeGreaterThanOrEqual(3)
      }
    }, 120_000)
  }
})

// Kegan (2026-10-17): "Are tracks supposed to be clipping?" The links' guide horns ran
// straight through the return rollers on the top run. Every link, at every point round the
// loop and with every kind of pad, must stay clear of every wheel, the idler and the sprocket:
// no point of a link (its corners, the middle of each face and edge) may be inside one.
describe('track links clear the running gear', () => {
  const s = carFrame('tank')
  for (const pads of ['steel', 'rubber', 'paddle', 'studs', 'allweather'] as Pads[]) it(pads, () => {
    const loop = trackLoop(s.wheel, s.wz, pads)
    const slabs = gearSlabs(loop, s.wx)
    const geo = linkGeo(pads).geo
    const flat = (geo.index ? geo.toNonIndexed() : geo).getAttribute('position')
    // Each triangle's corners, edge middles and middle.
    const pts: Vector3[] = []
    for (let t = 0; t < flat.count; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(flat, t + k))
      pts.push(a, b, c, a.clone().add(b).multiplyScalar(0.5), b.clone().add(c).multiplyScalar(0.5), c.clone().add(a).multiplyScalar(0.5), a.clone().add(b).add(c).divideScalar(3))
    }
    const worst = new Map<string, number>()
    const v = new Vector3()
    // A few steps through one link's pitch covers every place a link can be.
    for (let k = 0; k < 5; k++) placeLinks(loop, s.wx, (k / 5) * (loop.len / linkCount(loop)), (_, m: Matrix4) => {
      for (const p of pts) {
        v.copy(p).applyMatrix4(m)
        for (const sl of slabs) {
          if (v.x <= sl.x0 + 5e-4 || v.x >= sl.x1 - 5e-4) continue
          const deep = sl.r - Math.hypot(v.y - sl.y, v.z - sl.z)
          if (deep > 5e-4) worst.set(sl.name, Math.max(worst.get(sl.name) ?? 0, deep))
        }
      }
    })
    expect([...worst].map(([n, d]) => `${n} ${(d * 100).toFixed(1)} cm deep`)).toEqual([])
  })
})
