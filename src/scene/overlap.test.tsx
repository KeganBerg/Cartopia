// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, Matrix4, Vector3, type Material, type Mesh, type Object3D, type Texture } from 'three'
import { BUILDINGS, TILE } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { VanguardTower } from './Landmark'
import { GlobeTower } from './GlobeTower'
import { DAY_MS } from '../game/clock'

// Noon and midnight on the town clock.
const NOON = 0, MIDNIGHT = DAY_MS / 2

// Nothing poking out or cut off. For every building at each growth form:
//  - off the lot: no piece reaches past the building's own tiles into a
//    neighbour, or more than a step over the pavement out front (birds,
//    helicopters and light pools on the ground are allowed out);
//  - covered signs: nothing solid sits in front of a sign's lettering;
//  - squashed signs: lettering drawn on a board of the wrong shape comes out
//    squashed or stretched, so the board must match its texture's shape
//    (4:1 unless signTexture was given another).
// Mark something meant to fly out over the road with userData.air.

const LEVELS = [1, 4, 7, 10]
// How far past the lot edge a piece may reach: each lot's paving stops 0.05
// short of its edge (World.tsx), so this stays in the gap between lots.
const OVER = 0.05
// Out front (+z) is the pavement, not a neighbour: an awning, a step or the
// path may reach a little way over it.
const FRONT = 0.2
// Lettering may be this much off 4:1 before it reads squashed.
const SQUASH = 0.2
// Covered when something solid hides this much of a sign's face.
const COVER = 0.12
const PIERCE = 0.02
// Rusty's Rescue is still being reworked in its own thread: its crane yard
// reaches past the back of the lot and the 24H TOW board is squashed. Drop it
// from here once that lands.
const LATER = new Set<string>([])

function shown(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}
function airborne(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.userData.air) return true
  return false
}
const mat = (o: Object3D) => [(o as Mesh).material].flat()[0] as Material & { map?: Texture | null; color?: { getHexString(): string } }
// Glows and pools that don't write depth light the ground; they aren't objects.
const glow = (o: Object3D) => mat(o).transparent && !mat(o).depthWrite
const text = (o: Object3D) => !!mat(o).map?.userData?.text
const name = (o: Object3D) => {
  const at = o.getWorldPosition(new Vector3())
  const label = mat(o).map?.userData?.label
  return `${label ? `"${label}"` : (o as Mesh).geometry.type.replace('Geometry', '')} #${mat(o).color?.getHexString() ?? '?'} @${[at.x, at.y, at.z].map((v) => v.toFixed(2)).join(',')}`
}

export function problems(root: Object3D, w: number, d: number) {
  root.updateMatrixWorld(true)
  const out: string[] = []
  const meshes: Mesh[] = []
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh || !shown(o) || airborne(o) || (o as { isInstancedMesh?: boolean }).isInstancedMesh) return
    meshes.push(m)
  })
  const box = new Box3()
  const hw = w / 2 + OVER, hd = d / 2 + OVER
  for (const m of meshes) {
    if (glow(m)) continue
    box.setFromObject(m, true)
    const past = Math.max(box.max.x - hw, -hw - box.min.x, box.max.z - hd - (FRONT - OVER), -hd - box.min.z)
    if (past > 0) out.push(`off the lot by ${past.toFixed(2)}: ${name(m)}`)
  }
  // Signs: their face in its own frame (u across, v up, n out of the face).
  // Boxes and poles: shapes whose bounds are the shape, so what they cover is real.
  const exact = (m: Mesh) => m.geometry.type === 'BoxGeometry' || (m.geometry.type === 'CylinderGeometry' && Math.max((m.geometry as unknown as { parameters: { radiusTop: number; radiusBottom: number } }).parameters.radiusTop, (m.geometry as unknown as { parameters: { radiusBottom: number } }).parameters.radiusBottom) <= 0.1)
  const solids = meshes.filter((m) => !glow(m) && !text(m) && !mat(m).transparent && exact(m))
  const inv = new Matrix4()
  const c = new Vector3()
  for (const s of meshes.filter((m) => text(m) && (m.geometry as { parameters?: { width?: number } }).parameters?.width)) {
    const { width, height } = (s.geometry as unknown as { parameters: { width: number; height: number } }).parameters
    const sc = new Vector3().setFromMatrixScale(s.matrixWorld)
    const sw = width * sc.x, sh = height * sc.y
    const aspect = sw / sh / (mat(s).map?.userData?.aspect ?? 4)
    if (Math.abs(Math.log(aspect)) > Math.log(1 + SQUASH)) out.push(`sign ${aspect > 1 ? 'stretched' : 'squashed'} ${aspect.toFixed(2)}x: ${name(s)}`)
    // Undo the sign's own scale so u, v and n are in world units.
    inv.copy(s.matrixWorld).multiply(new Matrix4().makeScale(1 / sc.x, 1 / sc.y, 1 / sc.z)).invert()
    for (const o of solids) {
      if (o === s) continue
      const g = o.geometry
      if (!g.boundingBox) g.computeBoundingBox()
      const b = new Box3()
      const bb = g.boundingBox!
      for (let i = 0; i < 8; i++) {
        c.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(o.matrixWorld).applyMatrix4(inv)
        b.expandByPoint(c)
      }
      // In front of the face (not the board behind it), and over its lettering.
      if (b.max.z < 0.001 || b.min.z > 0.08) continue
      const du = Math.min(b.max.x, sw / 2) - Math.max(b.min.x, -sw / 2)
      const dv = Math.min(b.max.y, sh / 2) - Math.max(b.min.y, -sh / 2)
      // Something poking through the face from behind shows however little of
      // the lettering (the middle of the face) it hides.
      const lu = Math.min(b.max.x, sw * 0.4) - Math.max(b.min.x, -sw * 0.4)
      const lv = Math.min(b.max.y, sh * 0.3) - Math.max(b.min.y, -sh * 0.3)
      const pierced = b.min.z < 0 && lu > 0 && lv > 0 && (lu * lv) / (sw * sh) >= PIERCE
      if (!pierced && (du <= 0 || dv <= 0 || (du * dv) / (sw * sh) < COVER)) continue
      out.push(`sign covered ${Math.round(((du * dv) / (sw * sh)) * 100)}% by ${name(o)}: ${name(s)}`)
    }
  }
  return out
}

describe('nothing off the lot or cut off', () => {
  for (const def of BUILDINGS.filter((b) => !b.parked && !LATER.has(b.id))) {
    it(def.id, async () => {
      const bad = new Set<string>()
      // Noon and midnight: some pieces only come out after dark.
      for (const level of LEVELS) for (const time of [NOON, MIDNIGHT]) {
        vi.spyOn(Date, 'now').mockReturnValue(time)
        const r = await ReactThreeTestRenderer.create(<BuildingModel def={def} level={level} />)
        await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
        for (const p of problems(r.scene.instance as Object3D, def.w * TILE, def.h * TILE)) bad.add(`L${level}${time === MIDNIGHT ? ' night' : ''} ${p}`)
        await r.unmount()
        vi.restoreAllMocks()
      }
      if (process.env.OVERLAP_REPORT) (await import('node:fs')).appendFileSync(process.env.OVERLAP_REPORT, [...bad].map((b) => `${def.id} ${b}\n`).join(''))
      expect([...bad]).toEqual([])
    })
  }
})

describe('nothing off the lot on landmarks', () => {
  it.each([['vanguard tower', <VanguardTower />, 2], ['globe tower', <GlobeTower />, 4]] as const)('%s', async (_, el, cols) => {
    const bad = new Set<string>()
    for (const time of [NOON, MIDNIGHT]) {
      vi.spyOn(Date, 'now').mockReturnValue(time)
      const r = await ReactThreeTestRenderer.create(el)
      await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
      for (const p of problems(r.scene.instance as Object3D, cols * TILE, 2 * TILE)) bad.add(`${time === MIDNIGHT ? 'night ' : ''}${p}`)
      await r.unmount()
      vi.restoreAllMocks()
    }
    expect([...bad]).toEqual([])
  })
})
