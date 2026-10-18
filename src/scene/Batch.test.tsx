// @vitest-environment jsdom
import './testCanvas'
import { Activity } from 'react'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { BoxGeometry, type BufferAttribute, type Mesh, type Object3D } from 'three'
import { Batch } from './Batch'

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

// A row of shops 30 units apart, so each sits in its own 24-unit cell.
function Street({ lit, level }: { lit: string; level: number }) {
  return (
    <Batch version={`${lit}${level}`} cell={24}>
      {['a', 'b', 'c'].map((id, i) => (
        <group key={id} name={id} position={[i * 30 + 5, 0, 5]}>
          <mesh name={`${id}-box`} castShadow>
            <boxGeometry args={[1, id === 'b' ? level : 1, 1]} />
            <meshStandardMaterial color={id === lit ? '#ffcc00' : '#c0504d'} />
          </mesh>
          <mesh name={`${id}-glass`}>
            <boxGeometry />
            <meshStandardMaterial color="#88ccff" transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
    </Batch>
  )
}

const mergedMeshes = (scene: Object3D) => {
  const out: Mesh[] = []
  scene.traverse((o) => {
    if ((o as Mesh).isMesh && !o.name) out.push(o as Mesh)
  })
  return out
}
const vertsOf = (meshes: Mesh[]) => meshes.reduce((n, m) => n + m.geometry.getAttribute('position').count, 0)

describe('Batch rebuilds only what changed', () => {
  // Upgrading one building used to re-merge the whole town: seconds on a phone.
  it('keeps the merged cells a change did not touch', async () => {
    const r = await ReactThreeTestRenderer.create(<Street lit="" level={1} />)
    const scene = r.scene.instance as Object3D
    const before = mergedMeshes(scene)
    // Three plain cells plus one see-through set.
    expect(before.length).toBe(4)
    const box = new BoxGeometry().getAttribute('position').count
    expect(vertsOf(before)).toBe(box * 6)
    await r.update(<Street lit="" level={2} />)
    const after = mergedMeshes(scene)
    expect(after.length).toBe(4)
    // b's cell is rebuilt; a's and c's merged meshes are the very same objects.
    expect(after.filter((m) => before.includes(m)).length).toBe(3)
    await r.update(<Street lit="c" level={2} />)
    const recoloured = mergedMeshes(scene)
    expect(recoloured.filter((m) => after.includes(m)).length).toBe(3)
    // Everything is still drawn exactly once, merged.
    expect(vertsOf(recoloured)).toBe(box * 6)
    for (const id of ['a', 'b', 'c']) expect((scene.getObjectByName(`${id}-box`) as Mesh).visible).toBe(false)
  })

  it('puts the originals back when it is turned off or unmounted', async () => {
    const r = await ReactThreeTestRenderer.create(<Street lit="" level={1} />)
    const scene = r.scene.instance as Object3D
    await r.update(
      <Batch version="x" off>
        <mesh name="solo">
          <boxGeometry />
          <meshStandardMaterial />
        </mesh>
      </Batch>,
    )
    expect(mergedMeshes(scene).length).toBe(0)
    expect((scene.getObjectByName('solo') as Mesh).visible).toBe(true)
  })
})

// A frozen town only updates matrices for what moves: a bouncing building and
// anything mounted after the last rebuild.
function Frozen({ extra, spin }: { extra?: boolean; spin: { x: number } }) {
  return (
    <Batch version={1} freeze>
      <group name="still" position={[3, 0, 0]} userData={{ hours: { seed: 1, kind: 1 } }}>
        <mesh name="still-box">
          <boxGeometry />
          <meshStandardMaterial />
        </mesh>
        {extra && (
          <mesh name="late" position={[0, 2, 0]}>
            <boxGeometry />
            <meshStandardMaterial />
          </mesh>
        )}
      </group>
      <group name="bouncy" position={[-3, 0, 0]} userData={{ hours: { seed: 2, kind: 1 } }}>
        <group name="pop" userData={{ noBatch: true }} ref={(g) => void (g && Object.assign(spin, { g }))}>
          <mesh name="pop-box">
            <boxGeometry />
            <meshStandardMaterial />
          </mesh>
        </group>
      </group>
    </Batch>
  )
}

describe('frozen Batch', () => {
  it('keeps live parts and late arrivals in step without updating the rest', async () => {
    const spin = { x: 0 } as { x: number; g?: Object3D }
    const r = await ReactThreeTestRenderer.create(<Frozen spin={spin} />)
    const scene = r.scene.instance as Object3D
    const y = (name: string) => scene.getObjectByName(name)!.matrixWorld.elements[13]
    // The bouncing part follows its animation.
    spin.g!.position.y = 1.5
    scene.updateMatrixWorld()
    expect(y('pop-box')).toBeCloseTo(1.5)
    // A merged original isn't recomputed between rebuilds (it isn't drawn).
    scene.getObjectByName('still-box')!.position.y = 5
    scene.updateMatrixWorld()
    expect(y('still-box')).toBeCloseTo(0)
    // Something mounted later lands in place on the next frame, not at the origin.
    await r.update(<Frozen spin={spin} extra />)
    scene.updateMatrixWorld()
    expect(y('late')).toBeCloseTo(2)
    expect(scene.getObjectByName('late')!.matrixWorld.elements[12]).toBeCloseTo(3)
  })
})

// Prune: groups emptied by merging stop being walked each frame, and come back when live.
function Yard({ live }: { live: boolean }) {
  return (
    <Batch version={live ? 1 : 0} freeze prune>
      <group name="crate">
        <group name="lid">
          <mesh name="lid-box"><boxGeometry /><meshStandardMaterial color="#8d6e63" /></mesh>
        </group>
      </group>
      <group name="crew">
        <mesh name="crew-box"><boxGeometry /><meshStandardMaterial color="#1565c0" /></mesh>
        <instancedMesh name="crew-fans" args={[new BoxGeometry(), undefined, 2]} />
      </group>
      <group name="tool" userData={live ? { noBatch: true } : {}}>
        <mesh name="tool-box"><boxGeometry /><meshStandardMaterial color="#c62828" /></mesh>
      </group>
    </Batch>
  )
}

describe('Batch prune', () => {
  it('hides groups with nothing left to draw, and only those', async () => {
    const r = await ReactThreeTestRenderer.create(<Yard live={false} />)
    const scene = r.scene.instance as Object3D
    const shown = (n: string) => scene.getObjectByName(n)!.visible
    expect(shown('crate')).toBe(false)
    expect(shown('lid')).toBe(false)
    expect(shown('crew')).toBe(true) // the fans are still drawn live
    expect(shown('tool')).toBe(false)
    // Marked live: its group shows again and its box is drawn on its own.
    await r.update(<Yard live />)
    expect(shown('tool')).toBe(true)
    expect(shown('tool-box')).toBe(true)
    expect(shown('crate')).toBe(false)
    // Gone: the originals are left as they were.
    const crate = scene.getObjectByName('crate')!, lid = scene.getObjectByName('lid')!
    await r.unmount()
    expect(crate.visible).toBe(true)
    expect(lid.visible).toBe(true)
  })
})

describe('Batch release', () => {
  it('lets a merged mesh drop its vertices once the GPU has them, bounds kept', async () => {
    const r = await ReactThreeTestRenderer.create(
      <Batch version={1} release>
        <mesh name="box">
          <boxGeometry />
          <meshStandardMaterial color="#c0504d" />
        </mesh>
      </Batch>,
    )
    const merged = mergedMeshes(r.scene.instance as Object3D)
    expect(merged.length).toBe(1)
    const g = merged[0].geometry
    expect(g.boundingSphere).not.toBeNull()
    const pos = g.getAttribute('position') as BufferAttribute
    pos.onUploadCallback()
    expect(pos.array).toBeNull()
    // The hidden original keeps its own, so taps still find it.
    const box = r.scene.instance.getObjectByName('box') as Mesh
    expect(box.geometry.getAttribute('position').array).not.toBeNull()
  })
})

describe('Batch kept out of sight', () => {
  it('reuses its merged meshes when a kept menu shows again, instead of merging again', async () => {
    const page = (mode: 'visible' | 'hidden') => (
      <Activity mode={mode}>
        <Town picked="" />
      </Activity>
    )
    const r = await ReactThreeTestRenderer.create(page('visible'))
    const scene = r.scene.instance as Object3D
    const mergedGeos = () => {
      const out: string[] = []
      scene.traverse((o) => void (o.userData.merged && out.push((o as Mesh).geometry.uuid)))
      return out
    }
    const before = mergedGeos()
    expect(before.length).toBeGreaterThan(0)
    await r.update(page('hidden'))
    await r.update(page('visible'))
    expect(mergedGeos()).toEqual(before)
    expect(live(scene)).toEqual([])
  })
})
