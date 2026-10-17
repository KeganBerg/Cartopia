import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useGame } from '../game/store'
import { tutTarget } from '../ui/Tutorial'
import { RUSTY_LOT } from '../game/data'
import { centerOf } from './World'
import { VIEW, isFree } from './freeCam'
import { tutPoint } from '../ui/tutPoint'

// Where the tutorial is pointing in the town, if anywhere: the pizza place to tap
// (the one with a job going, else the one nearest the view) or Rusty's.
function focusOf(s: ReturnType<typeof useGame.getState>): [number, number] | null {
  // Building Rusty's: the lot kept for it, while the Shop is closed.
  if (s.tutorial === 3 && !s.panel && !s.visiting && !s.buildings.some((b) => b.def === 'rescue')) return centerOf('rescue', ...RUSTY_LOT)
  const t = tutTarget(s)
  if (t === 'pizza') {
    const pizzas = s.buildings.filter((b) => b.def === 'pizza')
    const busy = pizzas.find((b) => b.jobEndsAt !== null)
    const near = (b: (typeof pizzas)[number]) => {
      const [x, z] = centerOf(b.def, b.x, b.z, b.rot)
      return (x - VIEW.x) ** 2 + (z - VIEW.z) ** 2
    }
    const b = busy ?? [...pizzas].sort((a, c) => near(a) - near(c))[0]
    return b ? centerOf(b.def, b.x, b.z, b.rot) : null
  }
  if (t === 'rescue') {
    const b = s.buildings.find((o) => o.def === 'rescue')
    return b ? centerOf(b.def, b.x, b.z, b.rot) : null
  }
  return null
}

// Each tutorial step that points at something in town brings it on screen: if it's
// near an edge (or under the HUD or the tutorial card), the view glides over to it.
// It only moves when the step or its target changes, so it never fights the player.
export function TutorialCamera() {
  const get = useThree((s) => s.get)
  const key = useGame((s) => {
    const f = focusOf(s)
    return f ? `${s.tutorial}:${f[0]},${f[1]}` : ''
  })
  const glide = useRef<{ from: Vector3; to: Vector3; t: number } | null>(null)

  useEffect(() => {
    if (!key) return
    const f = focusOf(useGame.getState())
    const { camera, size } = get()
    if (!f || isFree(camera)) return
    const p = new Vector3(f[0], 1, f[1]).project(camera)
    const sx = (p.x + 1) / 2
    const sy = (1 - p.y) / 2
    // Safe box: clear of the HUD on top and the tutorial card and bottom bar below.
    const top = Math.min(0.3, 170 / size.height)
    // Short screens (a phone on its side) lose more to the card, which sits mid-height there.
    const bottom = 1 - Math.min(size.height < 500 ? 0.55 : 0.4, 230 / size.height)
    if (sx > 0.12 && sx < 0.88 && sy > top && sy < bottom) return
    // Put it in the middle of that box, so the HUD above and the card below never cover it.
    const want = new Vector3(0, 1 - (top + bottom), 0.5).unproject(camera)
    const at = new Vector3(f[0], 1, f[1])
    const ray = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    // Move along the ground plane: shift by the difference between where the point is and where we want it.
    const hit = (v: Vector3) => v.clone().add(ray.clone().multiplyScalar(-(v.y - 1) / ray.y))
    const delta = at.clone().sub(hit(want))
    delta.y = 0
    glide.current = { from: VIEW.clone(), to: VIEW.clone().add(delta), t: 0 }
  }, [key, get])

  // Placing Rusty's: where its ghost sits on screen, for the pointing hand.
  const lot = useRef(new Vector3())
  useFrame(() => {
    const s = useGame.getState()
    if (s.tutorial !== 3 || s.mode !== 'place' || s.placing !== 'rescue' || s.visiting || s.panel) { tutPoint.at = null; return }
    const { camera, gl } = get()
    const [x, z] = centerOf('rescue', ...RUSTY_LOT)
    const p = lot.current.set(x, 0.6, z).project(camera)
    const r = gl.domElement.getBoundingClientRect()
    tutPoint.at = { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }
  })

  useFrame((_, dt) => {
    const g = glide.current
    if (!g) return
    const { camera, controls } = get()
    if (isFree(camera)) { glide.current = null; return }
    g.t = Math.min(1, g.t + dt / 0.8)
    const e = g.t < 0.5 ? 2 * g.t * g.t : 1 - (-2 * g.t + 2) ** 2 / 2
    const next = g.from.clone().lerp(g.to, e)
    const step = next.sub(VIEW)
    camera.position.add(step)
    VIEW.add(step)
    ;(controls as { update?: () => void } | null)?.update?.()
    if (g.t >= 1) glide.current = null
  })
  return null
}
