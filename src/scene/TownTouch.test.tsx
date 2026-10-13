// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { useEffect } from 'react'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { TownTouch } from './TownTouch'

// A stand-in for MapControls: TownTouch only reads its target and zoom limits.
const controls = { target: new Vector3(), minZoom: 12, maxZoom: 90, update: () => {} }
let canvas: HTMLCanvasElement

function Town({ busy }: { busy: () => boolean }) {
  const set = useThree((s) => s.set)
  const camera = useThree((s) => s.camera)
  canvas = useThree((s) => s.gl.domElement)
  useEffect(() => {
    camera.position.set(75, 80, 75)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    set({ controls: controls as never })
  }, [set, camera])
  return <TownTouch enabled busy={busy} />
}

// jsdom has no PointerEvent; TownTouch only reads these fields.
const finger = (target: EventTarget, type: string, x: number, y: number) => {
  const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })
  Object.assign(e, { pointerId: 1, pointerType: 'touch' })
  target.dispatchEvent(e)
}

async function drag(busy: () => boolean) {
  controls.target.set(0, 0, 0)
  const r = await ReactThreeTestRenderer.create(<Town busy={busy} />, { orthographic: true, camera: { zoom: 30 } })
  // Window listeners only hear events from elements in the page.
  document.body.appendChild(canvas)
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800, x: 0, y: 0, toJSON: () => ({}) })
  finger(canvas, 'pointerdown', 200, 400)
  for (let i = 1; i <= 10; i++) finger(canvas, 'pointermove', 200 + i * 6, 400 + i * 4)
  finger(canvas, 'pointerup', 260, 440)
  const moved = controls.target.length()
  await r.unmount()
  canvas.remove()
  return moved
}

describe('TownTouch', () => {
  it('drags the map with one finger', async () => {
    expect(await drag(() => false)).toBeGreaterThan(1)
  })

  // Picking a building starts a drag before React turns TownTouch off; the
  // finger must move the building, not the map (Move "didn't work at all").
  it('leaves the map still while a building is being dragged', async () => {
    expect(await drag(() => true)).toBe(0)
  })
})
