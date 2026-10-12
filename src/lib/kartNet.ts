import { FIELD, ITEMS, wrapAngle, type ItemId, type Kart, type KartNote, type KartRace } from '../game/kart'

// Live kart races: every browser runs the whole race, drives its own kart (the host also
// drives the AI fillers) and copies everyone else's from what they broadcast.
//   * ~10 times a second each browser sends a snapshot of the karts it drives,
//   * others show those karts a little in the past (DELAY), smoothly between snapshots,
//     running on with the last speed for a moment if one is late,
//   * items, crates and used-up hazards go out as notes so every track looks the same, and
//     a hit is always decided by the browser driving the kart that was hit,
//   * a player who goes quiet has their kart taken over by an AI driver on the other browser.
// The channel is anything with send/on, so tests run it over a fake one.

export type NetChannel = {
  send: (event: string, payload: unknown) => void
  on: (event: string, cb: (payload: unknown) => void) => void
}

export const SNAP_HZ = 10
export const DELAY = 0.16 // seconds of race time other karts are shown behind
const MAX_EXTRAP = 0.35
export const QUIET = 5 // seconds without a snapshot before a player counts as gone

// One kart in a snapshot. Positions and timers, rounded to keep messages small.
const F = ['x', 'z', 'y', 'h', 'vx', 'vz', 'vy', 'steer', 'drift', 'charge', 'boost', 'spin', 'spinYaw', 'shield', 'flat', 'smoke', 'emp', 'tow', 'towTarget', 'lap', 'idx', 'done', 'air'] as const
type Field = (typeof F)[number]
const r2 = (v: number) => Math.round(v * 100) / 100

export function packKart(k: Kart): number[] {
  return [k.id, ...F.map((f) => {
    const v = k[f as keyof Kart]
    return f === 'done' ? (v === null ? -1 : r2(v as number)) : f === 'air' ? (v ? 1 : 0) : r2(v as number)
  })]
}

type Snap = { t: number; v: number[] }

// Anything from another browser gets checked before it touches the race.
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const LIMIT: Partial<Record<Field, number>> = { x: 2000, z: 2000, y: 40, vx: 80, vz: 80, vy: 80, steer: 1, drift: 1, charge: 5, boost: 3, spin: 2, shield: 9, flat: 5, smoke: 3, emp: 3, tow: 4 }
function cleanSnap(raw: unknown, n: number): { id: number; v: number[] } | null {
  if (!Array.isArray(raw) || raw.length !== F.length + 1 || !raw.every(fin)) return null
  const id = raw[0]
  if (!Number.isInteger(id) || id < 0 || id >= n) return null
  const v = raw.slice(1).map((x, i) => {
    const f = F[i]
    // Indexes into the race stay whole numbers in range.
    if (f === 'towTarget') return Number.isInteger(x) && x >= 0 && x < n ? x : -1
    if (f === 'lap') return Math.max(0, Math.min(9, Math.round(x)))
    if (f === 'idx') return Math.max(0, Math.round(x))
    const lim = LIMIT[f]
    return lim === undefined ? x : Math.max(-lim, Math.min(lim, x))
  })
  return { id, v }
}
function cleanNote(raw: unknown, n: number): KartNote | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const kart = o.kart
  if (o.k === 'gone') return fin(o.id) ? { k: 'gone', id: o.id } : null
  if (!fin(kart) || kart < 0 || kart >= n) return null
  if (o.k === 'crate') return fin(o.i) ? { k: 'crate', kart, i: o.i } : null
  if (o.k === 'item' && typeof o.item === 'string' && o.item in ITEMS && fin(o.x) && fin(o.z) && fin(o.h) && fin(o.id) && fin(o.target)) {
    const targets = Array.isArray(o.targets) ? o.targets.filter((t): t is number => fin(t) && t >= 0 && t < n).slice(0, 3) : undefined
    return { k: 'item', kart, item: o.item as ItemId, x: o.x, z: o.z, h: o.h, id: o.id, target: o.target >= 0 && o.target < n ? o.target : -1, targets }
  }
  return null
}

const lerp = (a: number[], b: number[], f: Field, u: number) => {
  const i = F.indexOf(f)
  return a[i] + (b[i] - a[i]) * u
}
function set(k: Kart, v: number[]) {
  F.forEach((f, i) => {
    if (f === 'done') k.done = v[i] < 0 ? null : v[i]
    else if (f === 'air') k.air = v[i] > 0
    else (k as unknown as Record<string, number>)[f] = v[i]
  })
}

export class KartLink {
  race: KartRace
  me: string
  owners: string[] // per kart: the player id whose browser drives it
  ch: NetChannel
  private bufs: Snap[][]
  private off: number | null = null // their race clock minus ours, smoothed
  private heard = new Map<string, number>() // player id -> our race time when last heard
  private picked: number[] // per kart: crates taken and not yet used, so a note can't conjure items
  private sentAt = -1
  gone = new Set<string>()
  onGone?: (player: string) => void

  constructor(race: KartRace, me: string, owners: string[], ch: NetChannel) {
    this.race = race
    this.me = me
    this.owners = owners
    this.ch = ch
    this.bufs = race.karts.map(() => [])
    this.picked = race.karts.map(() => 0)
    race.owned = (id) => this.drives(id)
    for (const p of new Set(owners)) if (p !== me) this.heard.set(p, 0)
    ch.on('snap', (p) => this.onSnap(p))
    ch.on('notes', (p) => this.onNotes(p))
  }

  // Karts we drive: our own, plus any whose player has gone quiet (taken over by AI here).
  drives(id: number) {
    const o = this.owners[id]
    return o === this.me || this.gone.has(o)
  }

  private onSnap(raw: unknown) {
    if (!raw || typeof raw !== 'object') return
    const p = raw as { t?: unknown; from?: unknown; k?: unknown }
    if (!fin(p.t) || typeof p.from !== 'string' || !Array.isArray(p.k) || p.k.length > FIELD) return
    if (this.gone.has(p.from) || p.from === this.me) return
    this.heard.set(p.from, this.race.t)
    const sample = p.t - this.race.t
    // Smooth the clock gap, but follow a sudden improvement (a shorter delay) at once.
    this.off = this.off === null || sample < this.off ? sample : this.off * 0.95 + sample * 0.05
    for (const raw2 of p.k) {
      const s = cleanSnap(raw2, this.race.karts.length)
      if (!s || this.owners[s.id] !== p.from) continue
      const buf = this.bufs[s.id]
      if (buf.length && buf[buf.length - 1].t >= p.t) continue
      buf.push({ t: p.t, v: s.v })
      if (buf.length > 30) buf.shift()
    }
  }

  private onNotes(raw: unknown) {
    if (!raw || typeof raw !== 'object') return
    const p = raw as { from?: unknown; n?: unknown }
    if (typeof p.from !== 'string' || p.from === this.me || !Array.isArray(p.n)) return
    for (const r of p.n.slice(0, 20)) {
      const n = cleanNote(r, this.race.karts.length)
      // Only a kart's own browser speaks for it.
      if (!n || (n.k !== 'gone' && this.owners[n.kart] !== p.from)) continue
      // An item needs a crate behind it.
      if (n.k === 'crate') this.picked[n.kart] = Math.min(2, this.picked[n.kart] + 1)
      if (n.k === 'item') {
        if (this.picked[n.kart] <= 0) continue
        this.picked[n.kart]--
      }
      this.race.apply(n)
    }
  }

  // Call once a frame after stepping the race.
  tick() {
    const race = this.race
    if (race.notes.length) {
      this.ch.send('notes', { from: this.me, n: race.notes })
      race.notes = []
    }
    if (race.t - this.sentAt >= 1 / SNAP_HZ || this.sentAt < 0) {
      this.sentAt = race.t
      const mine = race.karts.filter((k) => this.drives(k.id))
      this.ch.send('snap', { from: this.me, t: r2(race.t), k: mine.map(packKart) })
    }
    // Someone gone quiet: their karts carry on here, driven by the AI.
    if (race.t > QUIET) for (const [p, at] of this.heard) {
      if (this.gone.has(p) || race.t - at < QUIET) continue
      this.gone.add(p)
      for (const k of race.karts) if (this.owners[k.id] === p) k.ai = true
      this.onGone?.(p)
    }
    this.show()
  }

  // Puts every kart we don't drive where its player's browser had it DELAY ago.
  show() {
    if (this.off === null) return
    const rt = this.race.t + this.off - DELAY
    for (const k of this.race.karts) {
      if (this.drives(k.id)) continue
      const buf = this.bufs[k.id]
      if (!buf.length) continue
      while (buf.length > 2 && buf[1].t <= rt) buf.shift()
      const a = buf[0], b = buf[1]
      if (b && rt >= a.t && rt <= b.t) {
        const u = (rt - a.t) / (b.t - a.t || 1)
        set(k, b.v)
        for (const f of ['x', 'z', 'y', 'vx', 'vz', 'steer', 'charge'] as const) k[f] = lerp(a.v, b.v, f, u)
        k.h = a.v[F.indexOf('h')] + wrapAngle(b.v[F.indexOf('h')] - a.v[F.indexOf('h')]) * u
        k.spinYaw = lerp(a.v, b.v, 'spinYaw', u)
      } else {
        // Late: run on from the newest snapshot at its speed, for a moment.
        const last = buf[buf.length - 1]
        set(k, last.v)
        const dt = Math.max(0, Math.min(MAX_EXTRAP, rt - last.t))
        k.x += k.vx * dt
        k.z += k.vz * dt
      }
      const t = this.race.track
      if (k.done !== null && !this.race.finishOrder.includes(k.id)) {
        this.race.finishOrder.push(k.id)
        this.race.events.push({ kind: 'finish', kart: k.id, value: this.race.finishOrder.length })
      }
      k.idx = Math.max(0, Math.min(t.n - 1, Math.round(k.idx)))
    }
  }
}
