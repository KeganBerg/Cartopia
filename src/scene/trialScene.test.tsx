// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Mesh, PlaneGeometry, Sprite, type Object3D, type Texture } from 'three'
import { PodiumSet, STEP, type PodiumCar } from './TrialScene'
import { CARS } from '../game/data'

// Every painted text face in the Time Trial scene (podium numbers, name tags, the scoreboard)
// must have a texture the same shape as the face it's drawn on, or the digits come out squashed
// or stretched. The low podium steps are much wider than tall; a fixed-size texture squashed the
// "2" and "3" (Kegan, 2026-10-16).

const car = (n: number): PodiumCar => ({ look: { body: CARS[n].body, model: CARS[n].id, color: '#c62828' }, name: `@Player${n}`, t: 6.7 + n * 0.2, owner: `o${n}`, mine: n === 0 })

const aspectOf = (map: Texture) => {
  const img = map.image as { width: number; height: number }
  return img.width / img.height
}

describe('Time Trial text faces', () => {
  it('each texture matches the shape of its face', async () => {
    const r = await ReactThreeTestRenderer.create(<PodiumSet podium={[car(0), car(1), car(2)]} best={6.737} place={1} />)
    const faces: { what: string; face: number; tex: number }[] = []
    ;(r.scene.instance as Object3D).traverse((o) => {
      const map = ((o as Mesh).material as { map?: Texture | null } | undefined)?.map
      if (!map?.userData.text) return
      if (o instanceof Mesh && o.geometry instanceof PlaneGeometry) {
        const { width, height } = o.geometry.parameters
        faces.push({ what: 'plane', face: width / height, tex: aspectOf(map) })
      } else if (o instanceof Sprite) {
        faces.push({ what: 'sprite', face: o.scale.x / o.scale.y, tex: aspectOf(map) })
      }
    })
    await r.unmount()
    // Three step faces, three name tags and the scoreboard.
    expect(faces.length).toBe(STEP.length * 2 + 1)
    for (const f of faces) expect(Math.abs(f.tex / f.face - 1), `${f.what} face ${f.face.toFixed(2)} vs texture ${f.tex.toFixed(2)}`).toBeLessThan(0.03)
  }, 60_000)
})
