// @vitest-environment jsdom
// What a phone actually draws: meshes and triangles inside a portrait chase camera's view at a
// few points down each country's race. The whole-mile budget (worldVenues.test) can't see a
// heavy stretch hiding in a light lap; this can. INVIEW=giza,jaipur prints just those.
import '../testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Frustum, Matrix4, PerspectiveCamera, Sphere, type InstancedMesh, type Mesh, type Object3D } from 'three'
import { WORLD_SCENERY } from './WorldVenue'

// Per view. The heaviest strip before the detail passes drew 193 meshes and 295k triangles.
const DRAWS = 200
const TRIS = 320000
const RACE: Record<string, number> = { giza: 100, jaipur: 100, moscow: 100, shanghai: 200, sydney: 200, rome: 200, london: 400, rio: 400, vegas: 400 }
const only = process.env.INVIEW?.split(',')

export async function inView(id: string, race: number) {
  const View = (await WORLD_SCENERY[id as keyof typeof WORLD_SCENERY]()).default
  const r = await ReactThreeTestRenderer.create(<View len={race + 150} race={race} />)
  const scene = r.scene.instance as Object3D
  scene.updateMatrixWorld(true)
  const out: { draws: number; tris: number }[] = []
  for (const f of [0.02, 0.35, 0.7, 1]) {
    const z = race * f
    const cam = new PerspectiveCamera(55, 390 / 844, 0.3, 150)
    cam.position.set(0.4, 2.2, z - 4)
    cam.lookAt(0.4, 1.2, z + 20)
    cam.updateMatrixWorld()
    const fr = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse))
    let draws = 0
    let tris = 0
    scene.traverseVisible((o) => {
      const m = o as Mesh
      if (!m.isMesh) return
      const g = m.geometry
      const im = o as InstancedMesh
      if (im.isInstancedMesh && !im.boundingSphere) im.computeBoundingSphere()
      const bs = im.isInstancedMesh ? im.boundingSphere : (g.boundingSphere ?? (g.computeBoundingSphere(), g.boundingSphere))
      if (!bs) return
      // Horizon follows the camera in the game; here it sits at z 0, so the far set counts only
      // in the first view, which is the honest worst case for it.
      if (m.frustumCulled !== false && !fr.intersectsSphere(new Sphere().copy(bs).applyMatrix4(m.matrixWorld))) return
      draws++
      tris += ((g.index ? g.index.count : g.getAttribute('position').count) / 3) * (im.isInstancedMesh ? im.count : 1)
    })
    out.push({ draws, tris })
  }
  await r.unmount()
  return out
}

describe('World Tour venues in a phone view', () => {
  it('stay within what a phone draws smoothly at every point of the race', async () => {
    const lines: string[] = []
    for (const [id, race] of Object.entries(RACE)) {
      if (only && !only.includes(id)) continue
      const views = await inView(id, race)
      lines.push(`${id.padEnd(9)} ${views.map((v) => `${v.draws}/${Math.round(v.tris / 1000)}k`).join(' ')}`)
      for (const v of views) {
        expect(v.draws, id).toBeLessThan(DRAWS)
        expect(v.tris, id).toBeLessThan(TRIS)
      }
    }
    console.log('\n' + lines.join('\n'))
  }, 600000)
})
