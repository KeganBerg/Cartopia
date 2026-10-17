// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, type InstancedMesh, type Mesh, type Object3D } from 'three'
import { BUILDINGS, TILE } from '../game/data'
import { groupScale, mergeable, type MergeGroup } from '../game/merge'
import { BuildingModel } from './BuildingModel'
import { KeepShapes, MergeScale } from './mergeScale'
import { limitFor } from './keepShape'
import { GATE, doorsIn, type DoorSpot } from './doors'

// Townspeople walk in and out of buildings through their real front doors
// (doors.ts). Every building people visit or live in, at every level and as
// every merged block, must show a tagged door on its street side, standing on
// the ground, with a clear walk from the lot's front edge up to it and room for
// it to swing open.

type Scale = [number, number, number]
const PAIR = groupScale({ cols: 2, rows: 1 } as MergeGroup, 0)
const runs = (id: string): [number, Scale][] => [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l): [number, Scale] => [l, [1, 1, 1]]),
  ...(mergeable(id) ? ([PAIR, [2, 2, 2], [4, 4, 4]] as Scale[]).flatMap((s) => [1, 4, 7, 10].map((l): [number, Scale] => [l, s])) : []),
]
const tag = (s: Scale) => (s[0] === 1 && s[2] === 1 ? '' : s[0] === s[1] ? ` ${s[0]}x${s[0]}` : ' pair')

// What townspeople visit: everything but decorations and wild scenery (and
// the club, whose line and bouncer bring people in through its own door).
export const VISITED = BUILDINGS.filter((d) => !d.parked && d.kind !== 'decor' && d.kind !== 'obstacle' && !d.nightOnly)

// A walker is this wide, and anything that low (a step, a mat, a kerb) or that
// high (an awning, a sign) is stepped over or walked under.
const BODY = 0.3
const LOW = 0.12
const HIGH = 0.62

function solids(root: Object3D, k: number) {
  const out: [Mesh, Box3][] = []
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh || (m as InstancedMesh).isInstancedMesh || m.userData.door || !o.visible) return
    const b = new Box3().setFromObject(m)
    if (b.isEmpty() || b.max.y <= LOW * k || b.min.y >= HIGH) return
    out.push([m, b])
  })
  return out
}

const label = (m: Mesh, b: Box3) =>
  `${m.geometry.type.replace('Geometry', '')} #${(m.material as { color?: { getHexString(): string } }).color?.getHexString() ?? '?'} @${[(b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2].map((v) => v.toFixed(2)).join(',')}`

// What's wrong with a building's doors in one render (nothing, if it's fine).
export function doorFaults(root: Object3D, lotDepth: number, k: number): string[] {
  const doors = doorsIn(root, null)
  const front = doors.filter((d) => d.nz === 1)
  if (!front.length) return [doors.length ? `no street-side door (only ${doors.map((d) => `${d.nx},${d.nz}`).join(' ')})` : 'no door']
  const bad: string[] = []
  const walls = solids(root, k)
  for (const d of front) {
    if (d.y > 0.2 * k) bad.push(`door at x${d.x.toFixed(2)} floats ${d.y.toFixed(2)} up`)
    if (d.z > lotDepth / 2) bad.push(`door at x${d.x.toFixed(2)} stands off the lot`)
    const free = (minX: number, maxX: number, minZ: number, maxZ: number, what: string) => {
      const sweep = new Box3().set({ x: minX, y: LOW * k, z: minZ } as never, { x: maxX, y: HIGH, z: maxZ } as never)
      for (const [m, b] of walls) if (b.intersectsBox(sweep)) return bad.push(`${what} at x${d.x.toFixed(2)} blocked by ${label(m, b)}`)
    }
    // The walk from the street edge of the lot to the door.
    free(d.x - BODY / 2, d.x + BODY / 2, d.z + 0.03, lotDepth / 2, 'walk to door')
    // Through a gate, people walk on into the venue and stay a while in sight.
    if (d.kind === 'gate') free(d.x - BODY / 2, d.x + BODY / 2, d.z - GATE * k, d.z - 0.03, 'walk in through gate')
    // Room for the door to open out (a gate has nothing to open).
    if (d.kind === 'swing') {
      const L = d.x - d.w / 2, R = d.x + d.w / 2
      const left = new Box3().set({ x: L, y: LOW * k, z: d.z + 0.01 } as never, { x: L + d.w * 0.25, y: HIGH, z: d.z + d.w } as never)
      const right = new Box3().set({ x: R - d.w * 0.25, y: LOW * k, z: d.z + 0.01 } as never, { x: R, y: HIGH, z: d.z + d.w } as never)
      if (walls.some(([, b]) => b.intersectsBox(left)) && walls.some(([, b]) => b.intersectsBox(right))) bad.push(`door at x${d.x.toFixed(2)} has no room to swing open`)
    }
  }
  return bad
}

async function draw(def: (typeof BUILDINGS)[number], level: number, scale: Scale) {
  const r = await ReactThreeTestRenderer.create(
    <group scale={scale}>
      <MergeScale.Provider value={scale}>
        <KeepShapes limit={limitFor(def)}>
          <BuildingModel def={def} level={level} />
        </KeepShapes>
      </MergeScale.Provider>
    </group>,
  )
  await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
  return r
}

export const report = (d: DoorSpot) => `${d.kind} ${d.w.toFixed(2)}x${d.h.toFixed(2)} @${d.x.toFixed(2)},${d.z.toFixed(2)}`

describe('every visited building has a front door people can walk in', () => {
  for (const def of VISITED) {
    it(def.id, async () => {
      const bad: string[] = []
      for (const [level, scale] of runs(def.id)) {
        const r = await draw(def, level, scale)
        const root = r.scene.instance as Object3D
        for (const f of doorFaults(root, def.h * TILE * scale[2], scale[1])) bad.push(`L${level}${tag(scale)}: ${f}`)
        await r.unmount()
      }
      if (process.env.DOOR_REPORT) (await import('node:fs')).appendFileSync(process.env.DOOR_REPORT, JSON.stringify({ id: def.id, bad }) + '\n')
      expect(bad).toEqual([])
    }, 240_000)
  }
})
