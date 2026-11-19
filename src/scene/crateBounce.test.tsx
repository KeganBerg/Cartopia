// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { Clock, Object3D } from 'three'
import { useThree } from '@react-three/fiber'
import { crateDef, type CrateDrop, type CrateId } from '../game/crates'
import { CrateScene, LIFT, type CratePace } from './CrateScene'

// A ×10 opening drops nine crates at the quick pace and the last at the full one. The strain
// hops used to start the moment a crate landed, on top of its landing bounce, so every crate
// bounced twice. This records each opening frame by frame, from the drop to the burst.

vi.mock('./PostFx', () => ({ PostFx: () => null }))
vi.mock('./SkyEnv', () => ({ SkyEnv: () => null }))
vi.mock('./warm', () => ({ pinPrograms: () => {}, warmShaders: async () => {} }))
vi.mock('../lib/sound', () => ({ crateSfx: { charge: () => {}, reveal: () => {} }, sfx: { boost: () => {} } }))
vi.mock('../lib/arcadeSound', () => ({ bumpSound: () => {} }))
vi.mock('../lib/crateOpenSfx', () => ({ crateOpenSound: () => {} }))

const clock: { c: Clock | null } = { c: null }
function GrabClock() {
  clock.c = useThree((s) => s.clock)
  return null
}

const drop: CrateDrop = { kind: 'coins', coins: 500, jackpot: false }

// The crate's height above the lift in every frame from when it first touches down to its burst.
async function heights(crate: CrateId, pace: CratePace) {
  const r = await ReactThreeTestRenderer.create(
    <>
      <GrabClock />
      <CrateScene run={1} def={crateDef(crate)!} phase="open" drop={drop} prizeCar={null} onReveal={() => {}} skip={0} pace={pace} />
    </>,
    { frameloop: 'never' },
  )
  const root = r.scene.instance as unknown as Object3D
  const ys: number[] = []
  let landed = false
  for (let f = 0; f < 400; f++) {
    clock.c!.elapsedTime = 5 + f / 60
    await r.advanceFrames(1, 1 / 60)
    if (root.getObjectByName('crate-beam')?.visible) break
    const y = root.getObjectByName('crate')!.position.y - LIFT
    if (y < 0.01) landed = true
    if (landed) ys.push(y)
  }
  await r.unmount()
  return ys
}

// Each time the crate tops out and starts back down: a double bounce has two, even when it
// doesn't quite touch the lift between them.
function peaks(ys: number[]) {
  return ys.filter((y, i) => i > 0 && i < ys.length - 1 && y > 0.01 && y > ys[i - 1] && y >= ys[i + 1]).length
}

describe('a ×10 crate opening', () => {
  it('lands each quick crate with one bounce, then bursts', async () => {
    for (const crate of ['street', 'garage', 'gold', 'diamond'] as const) {
      const ys = await heights(crate, 'quick')
      expect(ys.length, crate).toBeGreaterThan(0)
      expect(peaks(ys), `${crate}: ${ys.map((y) => y.toFixed(3)).join(' ')}`).toBe(1)
    }
  }, 60000)

  it('lets the last crate settle from its landing bounce before it strains', async () => {
    // The full pace knocks a few times as it strains; each knock starts from the lift.
    for (const crate of ['street', 'diamond'] as const) {
      const ys = await heights(crate, 'full')
      const first = ys.findIndex((y) => y > 0.01)
      const down = ys.findIndex((y, i) => i > first && y < 0.005)
      expect(down, `${crate}: ${ys.map((y) => y.toFixed(3)).join(' ')}`).toBeGreaterThan(first)
      // Its landing bounce is a single hump of its own, with no strain knock on top of it.
      const hump = ys.slice(first, down)
      expect(peaks(hump), `${crate}: ${hump.map((y) => y.toFixed(3)).join(' ')}`).toBe(1)
      expect(Math.max(...hump), crate).toBeLessThan(0.125)
    }
  }, 60000)
})
