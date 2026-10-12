import { describe, expect, it } from 'vitest'
import { ARCADE_FEEL, KART_FEEL, ThumbDrift, thumbSteer, type SteerFeel } from '../ui/DriveControls'
import { KartRace, TOUCH_ASSIST, TRACKS, buildTrack, gpField, idleInput, wrapAngle, type KartEvent, type Track } from './kart'

const ALL = TRACKS.flatMap((d) => [buildTrack(d, false), buildTrack(d, true)])
const DT = 1 / 120
function aim(t: Track, race: KartRace, me: number) {
  const k = race.karts[me]
  const speed = Math.hypot(k.vx, k.vz)
  const j = (k.idx + Math.round(6 + speed * 0.5)) % t.n
  let bend = 0
  for (let d = 2; d < 24; d += 2) bend += t.curve[(k.idx + d) % t.n]
  const off = Math.max(-1, Math.min(1, bend * 3)) * (t.half - 1.4)
  const want = Math.atan2(t.x[j] + t.nx[j] * off - k.x, t.z[j] + t.nz[j] * off - k.z)
  return wrapAngle(want - k.h)
}
// A human thumb on the portrait slider: sees the kart 0.15 s late, aims with a moderate gain,
// puts the thumb where that steer lives on the slider (give or take 8 px of wobble), and the
// slider decides about drifts. Every drift here is an accident: this player never means one.
function run(t: Track, feel: SteerFeel, assist: number, seed = 7) {
  const r = new KartRace(t, gpField(['A', 'B', 'C', 'D', 'E'], 2, 40, { name: 'Me', pi: 40 }), 3)
  const me = r.karts.findIndex((k) => !k.ai)
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const hist: number[] = []
  const drift = new ThumbDrift(feel.drift)
  let walls = 0, drifts = 0, off = 0, px = 0, spins = 0
  while (r.karts[me].done === null && r.t < 200) {
    hist.push(aim(t, r, me))
    const err = hist[Math.max(0, hist.length - 1 - 18)]
    const want = Math.max(-1, Math.min(1, err * 2.2))
    const wantPx = -Math.sign(want) * (Math.abs(want) < 0.02 ? 0 : feel.dead + Math.abs(want) ** (1 / feel.curve) * (feel.range - feel.dead))
    px += (wantPx + (rnd() - 0.5) * 16 - px) * 0.12 // thumbs don't jump
    px = Math.max(-feel.range, Math.min(feel.range, px))
    const steer = thumbSteer(px, feel)
    const was = drift.dir
    if (drift.update(steer, r.t * 1000) && !was) drifts++
    r.step(DT, r.karts.map((_, i) => (i === me ? { ...idleInput(), gas: 1, steer, drift: drift.dir !== 0, assist } : idleInput())), true)
    for (const e of r.events as KartEvent[]) if (e.kart === me) { if (e.kind === 'wall') walls++; if (e.kind === 'hit') spins++ }
    if (r.karts[me].offroad) off += DT
  }
  const k = r.karts[me]
  const best = Math.min(...r.karts.filter((o) => o.done !== null && o.ai).map((o) => o.done!), Infinity)
  return { done: k.done, walls, drifts, off, ratio: best < Infinity && k.done !== null ? (k.done - spins * 2) / best : 1 }
}

describe('kart steering with a thumb on a phone', () => {
  it('the kart slider: no accidental drifts, off the walls, on the pace, on every circuit', () => {
    for (const t of ALL) {
      const id = `${t.def.id}${t.reverse ? ' rev' : ''}`
      const old = run(t, ARCADE_FEEL, 0), now = run(t, KART_FEEL, TOUCH_ASSIST)
      if (process.env.THUMB_LOG) console.log(id, JSON.stringify({ old, now }))
      expect(now.done, id).not.toBeNull()
      expect(now.drifts, id).toBeLessThanOrEqual(1)
      expect(now.walls, id).toBeLessThanOrEqual(2)
      expect(now.off, id).toBeLessThan(1)
      expect(now.ratio, id).toBeLessThan(1.06)
    }
  })

  it('a quick flick still drifts, held while the thumb stays out', () => {
    const d = new ThumbDrift('flick')
    d.reset(0)
    expect(d.update(0.2, 40)).toBe(0)
    expect(d.update(0.95, 120)).toBe(1)
    expect(d.update(0.6, 600)).toBe(1)
    expect(d.update(0.1, 700)).toBe(0)
    // Easing out wide over half a second never does.
    d.reset(0)
    for (let ms = 0; ms <= 600; ms += 16) expect(d.update(ms / 600, ms)).toBe(0)
  })

  it('the slider is fine near the middle and full lock at the end of travel', () => {
    expect(thumbSteer(4, KART_FEEL)).toBe(0)
    expect(thumbSteer(KART_FEEL.range, KART_FEEL)).toBe(-1)
    expect(thumbSteer(-KART_FEEL.range, KART_FEEL)).toBe(1)
    expect(Math.abs(thumbSteer(30, KART_FEEL))).toBeLessThan(Math.abs(thumbSteer(30, ARCADE_FEEL)) * 0.6)
  })
})
