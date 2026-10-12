import { describe, expect, it } from 'vitest'
import { FIELD, KartRace, LAPS, TRACKS, buildTrack, gpField, idleInput, lateral, wrapAngle, type KartEvent, type KartInput, type Track } from './kart'

// Driving checks from the player's side: a scripted "keyboard player" (full lock or nothing,
// the way arrow keys steer) and a "thumb" player (smooth steering, a hard slide drifts, as the
// portrait touch stick does) racing the AI on every circuit both ways.

const ALL = TRACKS.flatMap((d) => [buildTrack(d, false), buildTrack(d, true)])
const DT = 1 / 120 // the screen steps the race at this fixed rate

// Where a player would aim: a point down the road, on the inside of the next bend.
function aim(t: Track, race: KartRace, me: number) {
  const k = race.karts[me]
  const speed = Math.hypot(k.vx, k.vz)
  const j = (k.idx + Math.round(6 + speed * 0.5)) % t.n
  let bend = 0
  for (let d = 2; d < 24; d += 2) bend += t.curve[(k.idx + d) % t.n]
  const off = Math.max(-1, Math.min(1, bend * 3)) * (t.half - 1.4)
  const want = Math.atan2(t.x[j] + t.nx[j] * off - k.x, t.z[j] + t.nz[j] * off - k.z)
  return { err: wrapAngle(want - k.h), bend, speed }
}
// Both hold a drift through a bend the way a player holds the button: start it turning in,
// let go as the road straightens.
function holdDrift(race: KartRace, me: number, bend: number, steer: number) {
  const k = race.karts[me]
  return k.drift !== 0 ? Math.abs(bend) > 0.2 && Math.sign(bend) === k.drift : Math.abs(bend) > 0.45 && Math.sign(steer) === Math.sign(bend) && Math.abs(steer) > 0.25
}
function keyboard(t: Track, race: KartRace, me: number): KartInput {
  const { err, bend } = aim(t, race, me)
  const steer = err > 0.05 ? 1 : err < -0.05 ? -1 : 0
  return { ...idleInput(), gas: 1, steer, drift: holdDrift(race, me, bend, steer) }
}
function thumb(t: Track, race: KartRace, me: number): KartInput {
  const { err, bend } = aim(t, race, me)
  const steer = Math.max(-1, Math.min(1, err * 3))
  return { ...idleInput(), gas: 1, steer, drift: holdDrift(race, me, bend, steer) }
}

function race(t: Track, player: typeof keyboard, seed = 3) {
  const r = new KartRace(t, gpField(['A', 'B', 'C', 'D', 'E'], 2, 40, { name: 'Me', pi: 40 }), seed)
  const me = r.karts.findIndex((k) => !k.ai)
  let walls = 0, stuck = 0, turbos = 0, slow = 0
  while (r.karts[me].done === null && r.t < 200) {
    const inp = player(t, r, me)
    r.step(DT, r.karts.map((_, i) => (i === me ? inp : idleInput())), true)
    const k = r.karts[me]
    for (const e of r.events as KartEvent[]) if (e.kart === me) { if (e.kind === 'wall') walls++; if (e.kind === 'turbo') turbos++ }
    const v = Math.hypot(k.vx, k.vz)
    slow = r.t > 4 && v < 2 && k.spin <= 0 ? slow + DT : 0
    stuck = Math.max(stuck, slow)
  }
  return { r, me, walls, stuck, turbos, k: r.karts[me] }
}

describe('kart driving, from the player side', () => {
  for (const [name, player] of [['keyboard', keyboard], ['touch', thumb]] as const) {
    it(`a ${name} player laps every circuit both ways, cleanly, and on the pace`, () => {
      for (const t of ALL) {
        const id = `${t.def.id}${t.reverse ? ' rev' : ''} (${name})`
        const { r, walls, stuck, turbos, k } = race(t, player)
        expect(k.done, id).not.toBeNull()
        expect(k.lap, id).toBe(LAPS + 1)
        expect(stuck, id).toBeLessThan(1)
        // A tidy player barely touches the barriers over three laps...
        expect(walls, id).toBeLessThanOrEqual(3)
        // ...earns drift turbos in the bends...
        expect(turbos, id).toBeGreaterThanOrEqual(3)
        // ...and runs with the AI pack (same PI): within 8% of the winner's time.
        const best = Math.min(...r.karts.filter((o) => o.done !== null && o.ai).map((o) => o.done!), Infinity)
        if (best < Infinity) expect(k.done! / best, id).toBeLessThan(1.08)
      }
    })
  }

  it('straight into a barrier: no tunnelling, and backing off it gets you going again', () => {
    for (const t of ALL) {
      const r = new KartRace(t, [{ name: 'Me', pi: 120, ai: false }], 1)
      const k = r.karts[0]
      // Flat out at right angles to the barrier.
      const i = 40
      k.x = t.x[i]; k.z = t.z[i]; k.idx = i
      k.h = Math.atan2(t.nx[i], t.nz[i])
      k.vx = Math.sin(k.h) * 22; k.vz = Math.cos(k.h) * 22
      for (let f = 0; f < 240; f++) {
        r.step(DT, [{ ...idleInput(), gas: 1 }], true)
        expect(Math.abs(lateral(t, k.idx, k.x, k.z)), t.def.id).toBeLessThan(t.wall + 0.05)
      }
      // Reverse out and steer away, then drive on.
      for (let f = 0; f < 120; f++) r.step(DT, [{ ...idleInput(), brake: 1, steer: 1 }], true)
      const from = r.progress(k)
      for (let f = 0; f < 480; f++) {
        const { err } = aim(t, r, 0)
        r.step(DT, [{ ...idleInput(), gas: 1, steer: Math.max(-1, Math.min(1, err * 3)) }], true)
      }
      expect(r.progress(k) - from, t.def.id).toBeGreaterThan(30 / t.n)
    }
  })

  it('backing over the line and driving on counts no extra lap', () => {
    const t = ALL[0]
    const r = new KartRace(t, [{ name: 'Me', pi: 60, ai: false }], 1)
    const k = r.karts[0]
    const go = (secs: number, inp: Partial<KartInput>) => { for (let f = 0; f < secs * 120; f++) r.step(DT, [{ ...idleInput(), ...inp, steer: inp.brake ? 0 : Math.max(-1, Math.min(1, aim(t, r, 0).err * 3)) }], true) }
    go(2, { gas: 1 })
    const lap = k.lap
    go(4, { brake: 1 })
    go(4, { gas: 1 })
    expect(k.lap).toBe(lap)
  })

  it('ramps launch a fast kart into the air and land it on the track', () => {
    const t = ALL.find((x) => x.ramps.length)!
    const r = new KartRace(t, [{ name: 'Me', pi: 80, ai: false }], 1)
    const k = r.karts[0]
    let peak = 0, air = 0, landed = false
    for (let f = 0; f < 120 * 60 && !landed; f++) {
      r.step(DT, [{ ...idleInput(), gas: 1, steer: Math.max(-1, Math.min(1, aim(t, r, 0).err * 3)) }], true)
      if (r.events.some((e) => e.kind === 'jump')) air = 0.0001
      if (air > 0) { air += DT; peak = Math.max(peak, k.y); if (!k.air && air > 0.2 && k.drift === 0) landed = true }
    }
    expect(landed).toBe(true)
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThan(5)
    expect(Math.abs(lateral(t, k.idx, k.x, k.z))).toBeLessThan(t.half + 1)
  })

  it('field size matches the grid', () => expect(gpField(['A', 'B', 'C', 'D', 'E'], 2, 40, { name: 'Me', pi: 40 })).toHaveLength(FIELD))
})
