// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, BufferGeometry, Matrix4, Raycaster, Vector3, type InstancedMesh, type Mesh, type Object3D } from 'three'
import { BUILDINGS } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { limitFor } from './keepShape'
import { KeepShapes, MergeScale } from './mergeScale'
import { BODY, FAN, SEAT, SEAT_IN, armMatrix, fanBody, speedwayStands } from './speedwayCrowd'

// Speedway fans stand at their own seats, feet on the step, like a real
// stadium. Kegan asked about ten times: earlier crowds stood in rows in front
// of the seats, floated over the track, or drifted off the stands in merged
// speedways. This fails any fan who isn't on the step in front of their own
// seat, alone or merged, or who floats, sinks or walks through a seat.

const verts = (g: BufferGeometry) => {
  const p = g.getAttribute('position')
  return Array.from({ length: p.count }, (_, i) => new Vector3().fromBufferAttribute(p, i))
}
const bounds = (g: BufferGeometry) => new Box3().setFromBufferAttribute(g.getAttribute('position') as never)

describe('a fan at their seat', () => {
  const body = fanBody()

  it('stands with shoes flat on the step: not floating, not sunk', () => {
    expect(bounds(body.pants).min.y).toBeCloseTo(0, 4)
    for (const g of [body.shirt, body.skin, body.hair]) expect(bounds(g).min.y).toBeGreaterThan(0)
  })

  it('stands in front of the seat, never in it, and stays on its row', () => {
    // Legs and shoes are all in front of the cushion.
    for (const v of verts(body.pants)) expect(v.z).toBeGreaterThanOrEqual(SEAT.panFront - 0.0002)
    // Toes stop before the edge of the step.
    expect(bounds(body.pants).max.z).toBeLessThanOrEqual(SEAT_IN + 0.0002)
    // Nothing reaches back into the seat back.
    for (const g of Object.values(body)) expect(bounds(g).min.z).toBeGreaterThan(SEAT.backFront)
    // About shoulder-to-shoulder with the next seat, never into it.
    const wide = Math.max(...[body.shirt, body.skin].map((g) => bounds(g).max.x - bounds(g).min.x))
    expect(wide).toBeLessThan(SEAT.w)
  })

  it('is a person standing up, with a face', () => {
    const top = bounds(body.hair).max.y
    expect(top).toBeGreaterThan(SEAT.backTop * 1.5)
    expect(top).toBeLessThan(0.2)
    // The head is the townspeople's: eyes, nose, mouth and ears, not a plain ball.
    expect(body.skin.getAttribute('color')).toBeTruthy()
    expect(body.skin.getAttribute('position').count).toBeGreaterThan(500)
    expect(FAN).toBeLessThan(1)
  })

  it('cheers with their arms only, hung from the shoulders', () => {
    const shoulder = (side: number) => new Vector3(side * BODY.shoulder, BODY.shoulderY, BODY.at)
    for (const cheer of [0, 0.5, 1]) {
      for (const side of [-1, 1] as const) {
        const m = armMatrix(side, cheer, 0.3)
        expect(new Vector3().applyMatrix4(m).distanceTo(shoulder(side))).toBeLessThan(1e-9)
        const hand = new Vector3(0, -BODY.arm, 0).applyMatrix4(m)
        // Down at the side at rest (out from the body), over the head at full cheer.
        if (cheer === 0) {
          expect(hand.y).toBeGreaterThan(BODY.hip * 0.8)
          expect(hand.y).toBeLessThan(BODY.shoulderY)
          expect(hand.x * side).toBeGreaterThan(BODY.shoulder)
        }
        if (cheer === 1) expect(hand.y).toBeGreaterThan(bounds(body.hair).max.y)
      }
    }
  })
})

const stadium = BUILDINGS.find((d) => d.id === 'stadium')!
const find = (root: Object3D, name: string) => {
  let hit: InstancedMesh | undefined
  root.traverse((o) => {
    if (o.name === name) hit = o as InstancedMesh
  })
  return hit!
}

// The speedway as the town draws it: alone, a stretched pair, a 2x2 and a 4x4.
async function draw(level: number, s: [number, number, number]) {
  const r = await ReactThreeTestRenderer.create(
    <group scale={s}>
      <MergeScale.Provider value={s}>
        <KeepShapes limit={limitFor(stadium)}>
          <BuildingModel def={stadium} level={level} />
        </KeepShapes>
      </MergeScale.Provider>
    </group>,
  )
  await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
  return r
}

describe('the grandstand, alone and merged', () => {
  for (const s of [[1, 1, 1], [2, 1, 1], [2, 2, 2], [4, 4, 4]] as [number, number, number][]) {
    for (const level of [1, 4, 7, 10]) {
      it(`stands every fan on the step at their own seat (level ${level}, ${s.join('x')})`, async () => {
        const k = (s[0] + s[2]) / 2
        const { seats, fans } = speedwayStands(level, k)
        expect(new Set(fans).size).toBe(fans.length)
        expect(fans.length / seats.length).toBeGreaterThan(0.35)
        expect(fans.length / seats.length).toBeLessThan(0.8)

        const r = await draw(level, s)
        const root = r.scene.instance as Object3D
        root.updateMatrixWorld(true)
        const seatMesh = find(root, 'speedway-seats')
        expect(seatMesh.count).toBe(seats.length)
        // Every body part is drawn with exactly its own seat's transform.
        const sm = new Matrix4(), fm = new Matrix4()
        for (const part of ['fan-shirt', 'fan-pants', 'fan-skin', 'fan-hair']) {
          const mesh = find(root, part)
          expect(mesh.count).toBe(fans.length)
          fans.forEach((seat, i) => {
            seatMesh.getMatrixAt(seat, sm)
            mesh.getMatrixAt(i, fm)
            fm.elements.forEach((e, j) => expect(e).toBeCloseTo(sm.elements[j], 6))
          })
        }

        // And in the world: straight down from each fan's feet is the step they
        // stand on, right there (not the track below, not thin air).
        const steps = (() => {
          const out: Mesh[] = []
          root.traverse((o) => {
            const m = o as Mesh
            if (m.isMesh && !(m as InstancedMesh).isInstancedMesh && m.geometry.type === 'LatheGeometry') out.push(m)
          })
          return out
        })()
        expect(steps.length).toBeGreaterThan(2)
        const pants = find(root, 'fan-pants')
        const world = new Matrix4(), up = new Vector3()
        const ray = new Raycaster()
        const scaleY = s[1]
        const bad: string[] = []
        fans.forEach((seat, i) => {
          if (i % 5) return
          pants.getMatrixAt(i, fm)
          world.multiplyMatrices(pants.matrixWorld, fm)
          // Upright: the fan's up is the world's up.
          up.set(0, 1, 0).transformDirection(world)
          if (up.y < 0.9999) bad.push(`fan ${i} tipped over`)
          for (const z of [BODY.at - 0.006, BODY.at + 0.012]) {
            const foot = new Vector3(0, 0, z).applyMatrix4(world)
            ray.set(foot.clone().add(new Vector3(0, 0.05 * scaleY, 0)), new Vector3(0, -1, 0))
            const hit = ray.intersectObjects(steps, false)[0]
            const gap = hit ? hit.distance - 0.05 * scaleY : Infinity
            if (Math.abs(gap) > 0.004 * scaleY) bad.push(`fan ${i} (seat ${seat}, row ${seats[seat].row}) foot at z ${z.toFixed(3)} is ${gap.toFixed(3)} above the step`)
          }
        })
        expect(bad.slice(0, 10)).toEqual([])
        await r.unmount()
      })
    }
  }
})
