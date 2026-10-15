// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, type Mesh, type Object3D } from 'three'
import { CAM_REACH, CAM_TOP, Room, TT_R } from './Showroom'
import { describe as tell, floating } from './floating'

// The Showroom every car preview stands in (scene/Showroom.tsx), built in metres.
const S = 0.45
const shown = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

describe('showroom', () => {
  it('has nothing hanging in the air', async () => {
    const r = await ReactThreeTestRenderer.create(<Room />)
    const bad = floating(r.scene.instance as Object3D).map(tell)
    await r.unmount()
    expect(bad).toEqual([])
  })

  // The camera orbits inside CAM_REACH and under CAM_TOP (CarPreview pulls it in), so nothing
  // standing up may reach into that space, or the camera would pass through it.
  it('keeps every prop clear of where the camera can go', async () => {
    const r = await ReactThreeTestRenderer.create(<Room />)
    const bad: string[] = []
    const box = new Box3()
    ;(r.scene.instance as Object3D).updateMatrixWorld(true)
    ;(r.scene.instance as Object3D).traverse((o) => {
      if (!(o as Mesh).isMesh || !shown(o)) return
      box.setFromObject(o)
      // Flat things on the floor (the floor, rugs, paint) and the pit below it are fine.
      if (box.max.y <= 0.05) return
      if (box.min.y >= CAM_TOP / S) return
      // Nearest point of the box to the turntable's axis, across the floor.
      const nx = Math.max(box.min.x, Math.min(0, box.max.x))
      const nz = Math.max(box.min.z, Math.min(0, box.max.z))
      if (Math.hypot(nx, nz) < CAM_REACH / S + 0.3) bad.push(`${(o as Mesh).geometry.type} at ${box.getCenter(box.min.clone()).toArray().map((v) => v.toFixed(1))}`)
    })
    await r.unmount()
    expect(bad).toEqual([])
  })

  it('leaves the turntable its pit', () => {
    expect(CAM_REACH).toBeGreaterThan(TT_R * 3)
  })
})
