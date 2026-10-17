import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { countFrame, readFrames } from './FpsMeter'
import { frameGate, townFps } from '../scene/frameCap'

// Draws one second of screen refreshes at `hz` through a cap, and counts the frames drawn.
const drawn = (hz: number, fps: number) => {
  const due = frameGate(fps)
  let n = 0
  for (let i = 0; i < hz; i++) if (due((i * 1000) / hz)) n++
  return n
}

describe('frame rate', () => {
  it('caps the town at 60 on fast monitors and lets 60 Hz keep every frame', () => {
    expect(drawn(60, 60)).toBe(60)
    expect(drawn(120, 60)).toBe(60)
    expect(drawn(240, 60)).toBe(60)
    expect(drawn(144, 60)).toBeLessThanOrEqual(72)
    expect(drawn(240, 30)).toBeLessThanOrEqual(35)
    expect(drawn(240, Infinity)).toBe(240)
  })

  it('runs the free camera at the monitor rate only on a capable desktop', () => {
    expect(townFps('high', 60, true, true, true)).toBe(Infinity)
    expect(townFps('auto', 60, true, true, true)).toBe(Infinity)
    expect(townFps('auto', 60, false, true, true)).toBe(60)
    expect(townFps('high', 60, true, true, false)).toBe(60)
    expect(townFps('high', 60, true, false, true)).toBe(60)
    expect(townFps('saver', 60, true, true, true)).toBe(30)
    expect(townFps('auto', 30, false, false, false)).toBe(30)
  })

  it('reads the busiest view and its slowest frame', () => {
    readFrames(1)
    for (let i = 0; i < 30; i++) countFrame('town', i * 16)
    countFrame('town', 30 * 16 + 40)
    for (let i = 0; i < 120; i++) countFrame('race', 5000 + i * 4)
    expect(readFrames(500)).toEqual({ fps: 240, worst: 4 })
    for (let i = 0; i < 30; i++) countFrame("town", 2000 + i * 16)
    countFrame("town", 2000 + 29 * 16 + 40)
    expect(readFrames(500)).toEqual({ fps: 62, worst: 40 })
  })

  it('skips a paused view coming back as a slow frame', () => {
    readFrames(1)
    countFrame('preview', 0)
    countFrame('preview', 16)
    countFrame('preview', 9000)
    expect(readFrames(500).worst).toBe(16)
  })

  // A pan or scroll used to ask for a frame on every screen refresh (drei's MapControls),
  // so a 240 Hz monitor drew the town 240 times a second while the view glided.
  it('keeps the town camera and the car turntables on the cap', () => {
    const world = readFileSync('src/scene/World.tsx', 'utf8')
    expect(world).not.toMatch(/MapControls[^\n]*@react-three\/drei/)
    expect(world).toContain('<TownControls')
    expect(readFileSync('src/scene/TownControls.tsx', 'utf8')).not.toContain('invalidate')
    expect(readFileSync('src/scene/Stage.tsx', 'utf8')).toMatch(/Preview = makeStage\([^)]*, 60\)/)
  })
})

describe('frame rate under a menu', () => {
  it('shows the page rate when no 3D view drew', () => {
    readFrames(1)
    const page = { n: 30, last: 0, worst: 18 }
    expect(readFrames(500, page)).toEqual({ fps: 60, worst: 18 })
    countFrame('town', 100)
    countFrame('town', 116)
    expect(readFrames(500, { n: 120, last: 0, worst: 5 }).fps).toBe(4)
  })
})
