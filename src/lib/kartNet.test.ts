import { describe, expect, it } from 'vitest'
import { FIELD, KartRace, TRACKS, buildTrack, gpField, idleInput, type KartInput } from '../game/kart'
import { KartLink, type NetChannel } from './kartNet'

// A fake broadcast channel between two browsers: each message arrives after 50-130 ms
// of race time, in order per sender, unless the sender has been cut off.
class Bus {
  now = 0
  queue: { at: number; to: string; event: string; payload: unknown }[] = []
  subs = new Map<string, Map<string, ((p: unknown) => void)[]>>()
  cut = new Set<string>()
  sent = 0
  rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647) })()
  last = new Map<string, number>()
  channel(me: string): NetChannel {
    this.subs.set(me, new Map())
    return {
      send: (event, payload) => {
        if (this.cut.has(me)) return
        this.sent++
        const copy = JSON.parse(JSON.stringify(payload))
        for (const to of this.subs.keys()) if (to !== me) {
          const at = Math.max(this.last.get(me + to) ?? 0, this.now + 0.05 + this.rand() * 0.08)
          this.last.set(me + to, at)
          this.queue.push({ at, to, event, payload: copy })
        }
      },
      on: (event, cb) => {
        const m = this.subs.get(me)!
        m.set(event, [...(m.get(event) ?? []), cb])
      },
    }
  }
  deliver() {
    const due = this.queue.filter((q) => q.at <= this.now)
    this.queue = this.queue.filter((q) => q.at > this.now)
    for (const q of due) for (const cb of this.subs.get(q.to)?.get(q.event) ?? []) cb(q.payload)
  }
}

function setup(seed = 5) {
  const track = buildTrack(TRACKS[0], false)
  const field = gpField(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'], 1, 45, { name: 'Host', pi: 45 })
  // Two players at the back of the grid; the host's browser also drives the four AI.
  field[4] = { name: 'Guest', pi: 45, ai: false, skill: 1 }
  const owners = ['host', 'host', 'host', 'host', 'guest', 'host']
  const bus = new Bus()
  const a = new KartRace(track, field, seed), b = new KartRace(track, field, seed)
  const la = new KartLink(a, 'host', owners, bus.channel('host'))
  const lb = new KartLink(b, 'guest', owners, bus.channel('guest'))
  const hist: { t: number; x: number; z: number }[] = []
  const errs: number[] = []
  const input = (r: KartRace, i: number): KartInput => ({ ...r.autoInput(r.karts[i], r.order(), false) })
  const step = (secs: number) => {
    for (let f = 0; f < secs * 60; f++) {
      bus.now += 1 / 60
      bus.deliver()
      const ia = a.karts.map((_, i) => (i === 5 ? input(a, 5) : idleInput()))
      const ib = b.karts.map((_, i) => (i === 4 ? input(b, 4) : idleInput()))
      a.step(1 / 60, ia, true)
      b.step(1 / 60, ib, true)
      la.tick()
      lb.tick()
      // How far the guest's view of the host's kart is from where the host had it DELAY + ~90 ms ago.
      hist.push({ t: a.t, x: a.karts[5].x, z: a.karts[5].z })
      const want = hist.find((h) => h.t >= b.t - 0.16 - 0.09)
      if (b.t > 3 && want && a.karts[5].done === null) errs.push(Math.hypot(b.karts[5].x - want.x, b.karts[5].z - want.z))
    }
  }
  return { a, b, la, lb, bus, step, errs }
}

describe('live kart netcode', () => {
  it('shows each browser the other one\'s karts where they really were, smoothly', () => {
    const { a, b, step, errs, bus } = setup()
    step(40)
    const mean = errs.reduce((s, e) => s + e, 0) / errs.length
    expect(mean).toBeLessThan(1.2)
    // The four AI karts on the guest's screen follow the host's.
    for (let i = 0; i < 4; i++) expect(Math.hypot(a.karts[i].x - b.karts[i].x, a.karts[i].z - b.karts[i].z)).toBeLessThan(8)
    // About ten snapshots a second each, plus a few notes.
    expect(bus.sent / 40).toBeLessThan(26)
  })

  it('both browsers see the same race to the end', () => {
    const { a, b, step } = setup(9)
    step(150)
    expect(a.finishOrder.length).toBe(FIELD)
    expect(b.finishOrder.length).toBe(FIELD)
    // The two players agree on who beat whom.
    const ahead = (r: KartRace) => r.order().indexOf(r.karts[5]) < r.order().indexOf(r.karts[4])
    expect(ahead(a)).toBe(ahead(b))
    expect(a.order().map((k) => k.id)).toEqual(b.order().map((k) => k.id))
  })

  it('items, crates and used hazards reach the other browser', () => {
    const { a, b, step, la } = setup(3)
    // Count the item notes the host sends and the ones the guest applies.
    let sent = 0, applied = 0, crates = 0
    const send = la.ch.send
    la.ch.send = (e, p) => {
      if (e === 'notes') sent += (p as { n: { k: string }[] }).n.filter((n) => n.k === 'item').length
      send(e, p)
    }
    const apply = b.apply.bind(b)
    b.apply = (n) => {
      if (n.k === 'item') applied++
      if (n.k === 'crate') crates++
      apply(n)
    }
    step(60)
    step(1) // let the last messages land
    expect(sent).toBeGreaterThan(5)
    expect(applied).toBe(sent)
    expect(crates).toBeGreaterThan(5)
    // What's lying on the track matches: nothing used up on one side is left on the other.
    const ids = (r: KartRace) => [...r.oil, ...r.tacks].map((h) => h.id).sort()
    expect(ids(b)).toEqual(ids(a))
  })

  it('a player who drops out is taken over by the AI on the other browser', () => {
    const { b, lb, bus, step } = setup(4)
    step(10)
    bus.cut.add('host')
    let gone = ''
    lb.onGone = (p) => { gone = p }
    step(150)
    expect(gone).toBe('host')
    expect(lb.drives(5)).toBe(true)
    expect(b.finishOrder.length).toBe(FIELD)
  })

  it('ignores junk from the channel', () => {
    const { b, lb, step } = setup()
    step(2)
    const before = b.karts.map((k) => [k.x, k.z])
    const ch = (lb as unknown as { ch: NetChannel }).ch
    void ch
    const raw = lb as unknown as { onSnap: (p: unknown) => void; onNotes: (p: unknown) => void }
    raw.onSnap({ t: 99, from: 'host', k: [[4, ...Array(23).fill(1e9)]] }) // the guest's own kart: not the host's to move
    raw.onSnap({ t: 'x', from: 'host', k: [] })
    raw.onSnap({ t: 99, from: 'host', k: [[0, NaN]] })
    raw.onNotes({ from: 'host', n: [{ k: 'item', kart: 4, item: 'emp', x: 0, z: 0, h: 0, id: 1, target: -1, targets: [4] }] })
    raw.onNotes({ from: 'host', n: [{ k: 'item', kart: 0, item: 'laser', x: 0, z: 0, h: 0, id: 1, target: -1 }] })
    expect(b.karts[4].x).toBe(before[4][0])
    expect(b.karts[4].emp).toBe(0)
  })
})
