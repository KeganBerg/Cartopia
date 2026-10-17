// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { Mesh, Object3D } from 'three'
import { CARS, MODS, TRACK_SKINS, isBike } from '../game/data'
import { CarModel, isTracked, wheelRig } from './CarModel'

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
