// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { ReactNode } from 'react'
import { Object3D, Vector3, type Mesh, type MeshStandardMaterial } from 'three'
import { BUILDINGS } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { CarModel, wheelRig } from './CarModel'
import { KeepShapes, MergeScale } from './mergeScale'
import { limitFor } from './keepShape'

// Cars in a merged pair keep their wheels under their arches. mergeShape.test
// checks every wheel stays round, but a car kept piece by piece passes that
// while its wheels ride out on the stretch: each wheel round, all four stuck
// out from the body like outriggers (the academy's learner cars, three times).
// So this measures how far each tyre sits from its car's middle, merged and
// not, and they must match.

const academy = BUILDINGS.find((d) => d.id === 'academy')!
const PAIRS: [number, number, number][] = [[2, 1, 1], [1, 1, 2]]
const ONE: [number, number, number] = [1, 1, 1]

const isTyre = (o: Object3D) => {
  const m = (o as Mesh).material as MeshStandardMaterial | undefined
  return (o as Mesh).isMesh && !!m?.color && m.color.getHexString() === '1c1c1e' && Math.abs(m.roughness - 0.92) < 1e-6
}

async function draw(scale: [number, number, number], children: ReactNode) {
  const r = await ReactThreeTestRenderer.create(
    <group scale={scale}>
      <MergeScale.Provider value={scale}>
        <KeepShapes limit={limitFor(academy)}>{children}</KeepShapes>
      </MergeScale.Provider>
    </group>,
  )
  await ReactThreeTestRenderer.act(async () => r.advanceFrames(3, 1 / 60))
  const scene = r.scene.instance as Object3D
  scene.updateMatrixWorld(true)
  // Each car's tyre distances from the car's middle, nearest first. A tyre sits
  // in its spin group, in its steer group, in the car's own group.
  const byCar = new Map<Object3D, number[]>()
  scene.traverse((t) => {
    const car = t.parent?.parent?.parent
    if (!isTyre(t) || !car) return
    const mid = car.getWorldPosition(new Vector3())
    const d = byCar.get(car) ?? []
    d.push(t.getWorldPosition(new Vector3()).setY(mid.y).distanceTo(mid))
    byCar.set(car, d)
  })
  const cars = [...byCar.values()].map((d) => d.sort((a, b) => a - b))
  await r.unmount()
  return cars
}

function sameWheels(merged: number[][], plain: number[][]) {
  expect(merged.length).toBe(plain.length)
  const key = (c: number[]) => c.map((v) => v.toFixed(3)).join()
  const want = plain.map(key).sort()
  const got = merged.map(key).sort()
  for (let i = 0; i < want.length; i++) {
    const a = want[i].split(',').map(Number)
    const b = got[i].split(',').map(Number)
    for (let j = 0; j < a.length; j++) expect(Math.abs(a[j] - b[j])).toBeLessThan(0.01)
  }
}

describe('cars keep their wheels under their arches in merged pairs', () => {
  for (const level of [1, 4, 7, 10]) {
    it(`academy learner cars, level ${level}`, async () => {
      const plain = await draw(ONE, <BuildingModel def={academy} level={level} />)
      expect(plain.length).toBeGreaterThanOrEqual(3)
      for (const s of PAIRS) sameWheels(await draw(s, <BuildingModel def={academy} level={level} />), plain)
    })
  }

  // A driving car with headlight beams, not wrapped in <Upright>: its box with
  // the beams is bigger than a prop, so it used to be kept part by part.
  it('a driving car outside <Upright>', async () => {
    const car = () => (
      <group position={[0.4, 0.06, 0.6]} rotation-y={0.7}>
        <group scale={0.8}>
          <CarModel body="compact" model="pip" color="#e53935" rig={wheelRig('compact')} beams />
        </group>
      </group>
    )
    const plain = await draw(ONE, car())
    expect(plain).toHaveLength(1)
    for (const s of PAIRS) sameWheels(await draw(s, car()), plain)
  })
})
