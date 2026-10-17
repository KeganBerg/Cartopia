import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { ANGLES, ANGLE_TIME, DRAG_VIEWS, KART_VIEWS, LINE_CLEAR, TOP_HOLD, VIEW_NAME, angleCam, damp, direct, dragViewCam, freshDirector, photoCam, nextView, type Angle, type DragView } from './raceCam'
const ROAD = 1.6 // the street's half width (RaceVenues.tsx)

// Runs the director over a race: `topAt` seconds in the car reaches top gear, the line `finish` seconds in.
function run(topAt: number, finish: number, allowed = true) {
  const d = freshDirector()
  const shots: { t: number; angle: Angle | null; eta: number }[] = []
  const dt = 1 / 60
  for (let t = 0; t < finish; t += dt) {
    const eta = finish - t
    direct(d, dt, t >= topAt, eta, allowed)
    shots.push({ t, angle: d.angle, eta })
  }
  return shots
}

describe('race camera', () => {
  it('cuts round every angle in order once in top gear, then back to the chase before the line', () => {
    const shots = run(5, 25)
    const seq = shots.map((s) => s.angle).filter((a, i, all) => a !== all[i - 1])
    expect(seq.slice(0, 5)).toEqual([null, 'low', 'side', 'front', null])
    expect(shots.find((s) => s.angle)!.t).toBeGreaterThanOrEqual(5 + TOP_HOLD - 0.02)
    // Nothing but the chase as the car comes to the line.
    expect(shots.filter((s) => s.eta < LINE_CLEAR).every((s) => !s.angle)).toBe(true)
  })

  it('plays each angle in full and never starts one it cannot finish', () => {
    for (const [top, fin] of [[5, 25], [6, 9.5], [7.5, 9.5], [2, 12]]) {
      const shots = run(top, fin)
      let len = 0
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i]
        if (s.angle && s.angle === shots[i - 1]?.angle) len++
        else if (shots[i - 1]?.angle) {
          expect((len + 1) / 60).toBeGreaterThanOrEqual(ANGLE_TIME - 0.02)
          len = 0
        }
      }
    }
  })

  it('stays on the chase out of top gear, under reduced motion or a replay', () => {
    expect(run(99, 25).every((s) => !s.angle)).toBe(true)
    expect(run(2, 25, false).every((s) => !s.angle)).toBe(true)
  })

  it('keeps every angle on the tarmac, clear of the barriers, and looking down the strip', () => {
    const pos = new Vector3()
    const at = new Vector3()
    for (const a of ANGLES) for (const tall of [false, true]) for (const t of [0, ANGLE_TIME]) {
      angleCam(a, t, 0.75, 100, 0.9, ROAD, tall, pos, at)
      expect(Math.abs(pos.x)).toBeLessThan(ROAD)
      expect(pos.y).toBeGreaterThan(0.2)
      expect(pos.distanceTo(at)).toBeGreaterThan(1)
    }
  })

  it('smooths the same at any frame rate', () => {
    const at = (fps: number) => {
      let x = 0
      for (let i = 0; i < fps; i++) x += (1 - x) * damp(5, 1 / fps)
      return x
    }
    expect(at(30)).toBeCloseTo(at(144), 6)
  })
})

describe('picked race views', () => {
  it('step round every view and back to the chase', () => {
    let v: DragView = 'chase'
    const seen = DRAG_VIEWS.map(() => (v = nextView(DRAG_VIEWS, v)))
    expect(seen).toEqual(['far', 'bumper', 'tv', 'chase'])
    expect(nextView(KART_VIEWS, 'top')).toBe('chase')
    for (const k of [...DRAG_VIEWS, ...KART_VIEWS]) expect(VIEW_NAME[k]).toBeTruthy()
  })

  it('keep the camera off the cars and on the street, looking down the track, on phones and wide screens', () => {
    const LANE = 0.75
    const nose = 1.4 * 0.7
    const pos = new Vector3()
    const at = new Vector3()
    for (const tall of [true, false]) for (const v of DRAG_VIEWS.filter((x) => x !== 'chase') as Exclude<DragView, 'chase'>[]) {
      // Side by side, me well ahead, the rival well ahead.
      for (const [z, rz] of [[20, 20], [40, 30], [30, 40], [60, 20]]) {
        const fov = dragViewCam(v, LANE, z, -LANE, rz, nose, ROAD, tall, pos, at)
        expect(Math.abs(fov)).toBeLessThan(15)
        // Above the road, never inside either car's box (1.4x model: ~0.6 tall, nose each way).
        expect(pos.y).toBeGreaterThan(0.2)
        for (const [cx, cz] of [[LANE, z], [-LANE, rz]]) {
          const inside = Math.abs(pos.x - cx) < 0.55 && Math.abs(pos.z - cz) < nose && pos.y < 0.65
          expect(inside, `${v} ${tall} inside a car`).toBe(false)
        }
        // Within the street and its kerbs (the crowd and buildings stand beyond).
        expect(Math.abs(pos.x)).toBeLessThan(ROAD + 1.6)
        // Never looking back past my car, except the TV camera that pans back across the pair.
        if (v !== 'tv') expect(at.z).toBeGreaterThan(pos.z)
        else expect(at.z).toBeLessThan(pos.z)
        // My car stays the subject: never more than a few car lengths from the lens in the wide view.
        if (v === 'far') expect(z - pos.z).toBeLessThan(12)
        // A tall phone keeps both lanes in the narrow frame from the wide view.
        if (v === 'far') expect(Math.abs(at.x)).toBeLessThan(0.3)
      }
    }
  })
})

describe('photo-finish camera', () => {
  it('stands on the tarmac inside the barriers, past the line, looking back at it with the cars mid-frame', () => {
    const pos = new Vector3()
    const at = new Vector3()
    for (const tall of [true, false]) {
      photoCam(100, ROAD, tall, pos, at)
      // A kerbside prop or barrier filled the lower half of a phone's frame when it stood beyond the road.
      expect(pos.x).toBeLessThan(ROAD)
      expect(pos.z).toBeGreaterThan(100)
      expect(at.z).toBeLessThan(100)
      // Looking at car height, so the cars sit in the middle of a tall frame, not up in its top third.
      expect(at.y).toBeGreaterThanOrEqual(0.25)
    }
  })
})
