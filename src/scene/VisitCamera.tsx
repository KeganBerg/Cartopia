import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type OrthographicCamera } from 'three'
import { useGame } from '../game/store'
import { VIEW, isFree } from './freeCam'
import { townFocus, type Focus } from './townFocus'

type View = { x: number; z: number; zoom: number }

// The zoom ResponsiveZoom starts a screen of this size on.
const baseZoom = (w: number, h: number) => Math.min(38, Math.max(18, Math.sqrt(w * h) / 24))

const corner = new Vector3()

// Zoom that fits the town's box on screen (with room for the HUD), never closer
// than the usual view and never further out than the bird's-eye view allows.
function fitZoom(cam: OrthographicCamera, f: Focus, w: number, h: number) {
  const z0 = baseZoom(w, h)
  cam.zoom = z0
  cam.updateProjectionMatrix()
  cam.updateMatrixWorld()
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const [x, z] of [[f.minX, f.minZ], [f.minX, f.maxZ], [f.maxX, f.minZ], [f.maxX, f.maxZ]]) {
    corner.set(x, 0, z).project(cam)
    x0 = Math.min(x0, corner.x)
    x1 = Math.max(x1, corner.x)
    y0 = Math.min(y0, corner.y)
    y1 = Math.max(y1, corner.y)
  }
  // Screen is 2 across in these units; leave a margin, more top and bottom for the bars.
  const k = Math.max((x1 - x0) / 1.8, (y1 - y0) / 1.5)
  return Math.max(12, z0 / Math.max(1, k))
}

// Visiting someone's town opens on that town: the view moves to its middle and
// zooms to show it, wherever you'd panned your own town to. Heading home puts
// back the view you left.
export function VisitCamera() {
  const get = useThree((s) => s.get)
  const town = useGame((s) => s.visiting?.ownerId ?? null)
  // Starts at home, so a game that opens straight into a visit frames it too.
  const was = useRef<string | null>(null)
  const home = useRef<View | null>(null)
  // Applied on the next bird's-eye frame: the free view hands its camera back a frame after a visit starts.
  const pending = useRef<{ to: Focus | View; fit: boolean } | null>(null)

  useEffect(() => {
    if (was.current === town) return
    const cam = get().camera
    if (was.current === null && !isFree(cam)) home.current = { x: VIEW.x, z: VIEW.z, zoom: cam.zoom }
    else if (was.current === null) home.current = { x: VIEW.x, z: VIEW.z, zoom: 0 }
    was.current = town
    const s = useGame.getState()
    if (town !== null && s.visiting) {
      const f = townFocus(s.visiting)
      pending.current = f ? { to: f, fit: true } : null
    } else if (home.current) {
      pending.current = { to: home.current, fit: false }
      home.current = null
    }
  }, [town, get])

  useFrame(() => {
    const p = pending.current
    if (!p) return
    const { camera, controls, size } = get()
    if (isFree(camera)) return
    pending.current = null
    const cam = camera as OrthographicCamera
    const step = new Vector3(p.to.x - VIEW.x, 0, p.to.z - VIEW.z)
    cam.position.add(step)
    VIEW.add(step)
    const zoom = p.fit ? fitZoom(cam, p.to as Focus, size.width, size.height) : (p.to as View).zoom
    if (zoom > 0) {
      cam.zoom = zoom
      cam.updateProjectionMatrix()
    }
    ;(controls as { update?: () => void } | null)?.update?.()
  })
  return null
}
