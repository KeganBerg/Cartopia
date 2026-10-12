// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { Mesh, Object3D } from 'three'
import { Batch, batchOff } from './Batch'

function Town({ picked, off }: { picked: string; off?: boolean }) {
  return (
    <Batch version={picked} off={off}>
      {['a', 'b', 'c'].map((id, i) => (
        <group key={id} name={id} position={[i * 2, 0, 0]} userData={id === picked ? { noBatch: true } : {}}>
          <mesh name={`${id}-box`}>
            <boxGeometry />
            <meshStandardMaterial color="#c0504d" />
          </mesh>
        </group>
      ))}
    </Batch>
  )
}

const live = (scene: Object3D) => ['a', 'b', 'c'].filter((id) => (scene.getObjectByName(`${id}-box`) as Mesh).visible)

describe('Batch in edit modes', () => {
  // Kegan's PC nearly froze moving buildings: Edit mode used to draw the town piece by piece.
  it('keeps the town merged in every mode but road and bulldoze painting', () => {
    for (const mode of ['play', 'move', 'place', 'merge', 'expand']) expect(batchOff(mode)).toBe(false)
    for (const mode of ['road', 'bulldoze']) expect(batchOff(mode)).toBe(true)
  })

  it('leaves only the picked building live, and follows a new pick', async () => {
    const r = await ReactThreeTestRenderer.create(<Town picked="b" />)
    const scene = r.scene.instance as Object3D
    expect(live(scene)).toEqual(['b'])
    await r.update(<Town picked="c" />)
    expect(live(scene)).toEqual(['c'])
    await r.update(<Town picked="c" off />)
    expect(live(scene)).toEqual(['a', 'b', 'c'])
  })
})
