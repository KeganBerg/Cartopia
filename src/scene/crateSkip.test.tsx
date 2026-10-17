// @vitest-environment jsdom
import './testCanvas'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { Clock, Object3D } from 'three'
import { useThree } from '@react-three/fiber'
import { crateDef, type CrateDrop, type CrateId } from '../game/crates'
import { CrateScene, LIFT, type CratePace } from './CrateScene'

// Speed-opening (tapping through a ×10 run, or tapping as soon as a crate drops in) used to
// burst the crate in mid-air: a tap to skip jumped the opening to its burst while the crate was
// still falling onto the lift, so it shattered up by the Crate Depot sign and the prize rose
// out of an empty lift. A skip now lands the crate first.

// The test renderer has no real WebGL context for the post-processing passes or shader warming.
vi.mock('./PostFx', () => ({ PostFx: () => null }))
vi.mock('./SkyEnv', () => ({ SkyEnv: () => null }))
vi.mock('./warm', () => ({ pinPrograms: () => {}, warmShaders: async () => {} }))
vi.mock('../lib/sound', () => ({ crateSfx: { charge: () => {}, reveal: () => {} }, sfx: { boost: () => {} } }))
vi.mock('../lib/arcadeSound', () => ({ bumpSound: () => {} }))
vi.mock('../lib/crateOpenSfx', () => ({ crateOpenSound: () => {} }))

afterEach(() => vi.restoreAllMocks())

// The test renderer calls frame callbacks without ticking the clock: the test sets it.
const clock: { c: Clock | null } = { c: null }
function GrabClock() {
  clock.c = useThree((s) => s.clock)
  return null
}

const drop: CrateDrop = { kind: 'coins', coins: 500, jackpot: false }
const find = (o: Object3D, name: string): Object3D | undefined => o.getObjectByName(name)

// Opens one crate with `taps` taps to skip at the given times (seconds after it starts dropping)
// and reports how high the crate was in the frame its burst began, and when that was.
async function burstHeight(crate: CrateId, pace: CratePace, taps: number[]) {
  const scene = (skip: number) => (
    <>
      <GrabClock />
      <CrateScene run={1} def={crateDef(crate)!} phase="open" drop={drop} prizeCar={null} onReveal={() => {}} skip={skip} pace={pace} />
    </>
  )
  const r = await ReactThreeTestRenderer.create(scene(0), { frameloop: 'never' })
  const root = r.scene.instance as unknown as Object3D
  let skip = 0
  let hit: { y: number; at: number } | null = null
  for (let f = 0; f < 300 && hit == null; f++) {
    const now = f / 60
    if (skip < taps.length && now >= taps[skip]) await r.update(scene(++skip))
    clock.c!.elapsedTime = 5 + now
    await r.advanceFrames(1, 1 / 60)
    if (find(root, 'crate-beam')?.visible) hit = { y: find(root, 'crate')!.position.y, at: now }
  }
  await r.unmount()
  return hit
}

describe('tapping to skip a crate opening', () => {
  it('never bursts a crate before it is down on the lift', async () => {
    for (const crate of ['street', 'diamond'] as const) {
      for (const pace of ['quick', 'full'] as const) {
        // A tap as it starts to fall, a tap halfway down, and a burst of taps.
        for (const taps of [[0.02], [0.12], [0.02, 0.05, 0.09, 0.13]]) {
          const hit = await burstHeight(crate, pace, taps)
          expect(hit, `${crate} ${pace} ${taps}`).not.toBeNull()
          expect(Math.abs(hit!.y - LIFT), `${crate} ${pace} ${taps}`).toBeLessThan(0.2)
        }
      }
    }
  }, 60000)

  it('still opens straight away when tapped', async () => {
    // Skipped as it starts to fall, a crate lands and bursts within a frame or two of the tap.
    for (const pace of ['quick', 'full'] as const) {
      const hit = await burstHeight('gold', pace, [0.02])
      expect(hit!.at, pace).toBeLessThan(0.1)
    }
  }, 30000)
})
