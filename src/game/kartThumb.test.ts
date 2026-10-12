import { describe, expect, it } from 'vitest'
import { ARCADE_FEEL, KART_FEEL, KART_SHARP, ThumbDrift, thumbSteer, type SteerFeel } from '../ui/DriveControls'
import { KartRace, SHARP_ASSIST, TOUCH_ASSIST, thumbSlide, TRACKS, buildTrack, gpField, idleInput, wrapAngle, type KartEvent, type Track } from './kart'

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
function bendAhead(t: Track, race: KartRace, me: number) {
  let bend = 0
  for (let d = 2; d < 24; d += 2) bend += t.curve[(race.karts[me].idx + d) % t.n]
  return bend
}
// A human thumb on the portrait slider: sees the kart 0.15 s late, aims with a moderate gain,
// puts the thumb where that steer lives on the slider (give or take 8 px of wobble), and the
// slider decides about drifts. Every drift here is an accident: this player never means one.
// flicker: this player does mean to drift (and reacts at once, like the bots in kartDrive.test), flicking the thumb out turning into big bends and
// letting it come back as the road straightens.
function run(t: Track, feel: SteerFeel, assist: number, flicker = false, seed = 7) {
  const r = new KartRace(t, gpField(['A', 'B', 'C', 'D', 'E'], 2, 40, { name: 'Me', pi: 40 }), 3)
  const me = r.karts.findIndex((k) => !k.ai)
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const hist: number[] = []
  const drift = new ThumbDrift(feel.drift)
  let walls = 0, drifts = 0, off = 0, px = 0, spins = 0, turbos = 0
  while (r.karts[me].done === null && r.t < 200) {
    hist.push(aim(t, r, me))
    const err = hist[Math.max(0, hist.length - 1 - (flicker ? 0 : 18))]
    const want = Math.max(-1, Math.min(1, err * 2.2))
    const wantPx = -Math.sign(want) * (Math.abs(want) < 0.02 ? 0 : feel.dead + Math.abs(want) ** (1 / feel.curve) * (feel.range - feel.dead))
    px += (wantPx + (rnd() - 0.5) * 16 - px) * 0.12 // thumbs don't jump
    if (flicker) {
      const bend = bendAhead(t, r, me), side = Math.sign(bend)
      if (drift.dir === 0 && Math.abs(bend) > 0.45 && Math.sign(want) === side) px = -side * feel.range // the flick
      else if (drift.dir !== 0 && Math.abs(bend) > 0.2 && err * 3 * drift.dir > -1.5) {
        // Holding the slide: the thumb's own side of the slider sets how tight it goes.
        const e = Math.max(-1, Math.min(1, err * 3 * drift.dir))
        const u = 0.22 + ((e + 1) / 2) * 0.78
        px = -drift.dir * (feel.dead + u ** (1 / feel.curve) * (feel.range - feel.dead))
      }
      else if (drift.dir !== 0) px = 0 // let go as it straightens (or when it's sliding in too tight)
    }
    px = Math.max(-feel.range, Math.min(feel.range, px))
    const thumb = thumbSteer(px, feel)
    const was = drift.dir
    if (drift.update(thumb, r.t * 1000) && !was) drifts++
    const steer = thumb
    r.step(DT, r.karts.map((_, i) => (i === me ? { ...idleInput(), gas: 1, steer, drift: drift.dir !== 0, assist, thumb: feel.drift === 'flick' } : idleInput())), true)
    for (const e of r.events as KartEvent[]) if (e.kart === me) { if (e.kind === 'wall') walls++; if (e.kind === 'hit') spins++; if (e.kind === 'turbo') turbos++ }
    if (r.karts[me].offroad) off += DT
  }
  const k = r.karts[me]
  const best = Math.min(...r.karts.filter((o) => o.done !== null && o.ai).map((o) => o.done!), Infinity)
  return { done: k.done, walls, drifts, turbos, off, ratio: best < Infinity && k.done !== null ? (k.done - spins * 2) / best : 1 }
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

  it('sharp steering: twitchier but still clean, on every circuit', () => {
    for (const t of ALL) {
      const id = `${t.def.id}${t.reverse ? ' rev' : ''}`
      const now = run(t, KART_SHARP, SHARP_ASSIST), flick = run(t, KART_SHARP, SHARP_ASSIST, true)
      if (process.env.THUMB_LOG) console.log('sharp', id, JSON.stringify({ now, flick }))
      expect(now.done, id).not.toBeNull()
      expect(now.drifts, id).toBeLessThanOrEqual(1)
      expect(now.walls, id).toBeLessThanOrEqual(2)
      expect(now.off, id).toBeLessThan(2)
      expect(now.ratio, id).toBeLessThan(1.08)
      expect(flick.turbos, id).toBeGreaterThanOrEqual(3)
      expect(flick.walls, id).toBeLessThanOrEqual(2)
      expect(flick.ratio, id).toBeLessThan(1.08)
    }
  })

  it('a player who flicks into the big bends drifts there and earns turbos, on every circuit', () => {
    for (const t of ALL) {
      const id = `${t.def.id}${t.reverse ? ' rev' : ''}`
      const r = run(t, KART_FEEL, TOUCH_ASSIST, true)
      if (process.env.THUMB_LOG) console.log('flick', id, JSON.stringify(r))
      expect(r.done, id).not.toBeNull()
      expect(r.turbos, id).toBeGreaterThanOrEqual(3)
      expect(r.walls, id).toBeLessThanOrEqual(2)
      expect(r.off, id).toBeLessThan(8)
      expect(r.ratio, id).toBeLessThan(1.08)
    }
  })

  it('a quick flick still drifts, held while the thumb stays out', () => {
    const d = new ThumbDrift('flick')
    d.reset(0)
    expect(d.update(0.2, 40)).toBe(0)
    expect(d.update(0.95, 120)).toBe(1)
    expect(d.update(0.6, 600)).toBe(1)
    // In the slide, just out of the middle swings it widest and all the way out tightest.
    expect(thumbSlide(0.2, 1)).toBeCloseTo(-1)
    expect(thumbSlide(1, 1)).toBeCloseTo(1)
    expect(thumbSlide(-0.6, -1)).toBeCloseTo(0)
    expect(d.update(0.1, 700)).toBe(0)
    // From a steer already held through a bend, a flick further out drifts too.
    d.reset(0)
    for (let ms = 0; ms <= 400; ms += 16) expect(d.update(0.4, ms)).toBe(0)
    expect(d.update(0.95, 480)).toBe(1)
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
