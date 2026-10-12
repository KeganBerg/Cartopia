// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { RefObject } from 'react'
import { finishView, RaceScene, type RacerView } from './RaceScene'
import { StageRun } from './Stage'
import { VENUES } from './venues'

// A close finish always plays in slow motion, and a photo finish (under 0.15 s)
// from the kerbside camera with the PHOTO FINISH flash. Every race after the first
// in a session used to lose it: the race canvas is shared (Stage.tsx), so a Retry
// or Next handed the old RaceScene new props instead of a fresh one, and its finish
// replay was still in the 'after' state from the race before.

// The test renderer has no real WebGL context for the post-processing passes.
vi.mock('./PostFx', () => ({ PostFx: () => null }))
vi.mock('./SkyEnv', () => ({ SkyEnv: () => null }))

const beach = VENUES.find((v) => v.id === 'beach')!
const TRACK = 400
const look = { body: 'muscle' as const, color: '#3366ff' }

// Two cars at a steady 80 m/s (about 290 km/h) that reach the line `gap` seconds apart.
function race(gap: number) {
  const me: RefObject<RacerView> = { current: { dist: 0 } }
  const them: RefObject<RacerView> = { current: { dist: 0 } }
  const v = 80
  const at = (t: number) => {
    me.current!.dist = Math.max(0, Math.min(TRACK + 1, (t - gap) * v))
    them.current!.dist = Math.max(0, Math.min(TRACK + 1, t * v))
  }
  return { me, them, at }
}

async function run(r: ReturnType<typeof race>, step: (s: number) => Promise<void>, photos: { n: number }) {
  const before = photos.n
  let busy = false
  finishView.busy = false
  for (let t = 0; t < 6.5; t += 1 / 30) {
    r.at(t)
    await step(1 / 30)
    busy ||= finishView.busy
  }
  return { busy, photo: photos.n > before }
}

describe('race finish slow motion', () => {
  it('plays a photo finish for a 0.01 s gap on every race in a row on the shared canvas', async () => {
    const photos = { n: 0 }
    const onPhoto = () => void photos.n++
    const scene = (r: ReturnType<typeof race>, n: number) => (
      <StageRun run={n}>
        <RaceScene track={TRACK} me={r.me} them={r.them} mine={look} theirs={look} venue={beach} night onPhoto={onPhoto} />
      </StageRun>
    )
    const first = race(0.01)
    const R = await ReactThreeTestRenderer.create(scene(first, 1), { frameloop: 'never' })
    expect(await run(first, (s) => R.advanceFrames(1, s), photos)).toEqual({ busy: true, photo: true })
    // Retry: a new race handed to the same canvas.
    const again = race(0.01)
    await R.update(scene(again, 2))
    expect(await run(again, (s) => R.advanceFrames(1, s), photos)).toEqual({ busy: true, photo: true })
    // A 0.3 s gap is close but not a photo: slow motion without the kerbside camera.
    const close = race(0.3)
    await R.update(scene(close, 3))
    expect(await run(close, (s) => R.advanceFrames(1, s), photos)).toEqual({ busy: true, photo: false })
    // A clear win rolls through at full speed.
    const clear = race(0.8)
    await R.update(scene(clear, 4))
    expect(await run(clear, (s) => R.advanceFrames(1, s), photos)).toEqual({ busy: false, photo: false })
    await R.unmount()
  }, 60000)
})
