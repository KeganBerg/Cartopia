// Synthesised songs of common East Coast backyard birds. Each song is a few
// whistled notes gliding along a pitch path, some with a fast trill, shaped
// after the real bird's rhythm rather than sampled from a recording.
import type { Season } from '../scene/season'

export type Species = 'robin' | 'cardinal' | 'songSparrow' | 'chickadee' | 'houseSparrow' | 'goldfinch' | 'dove' | 'blueJay' | 'woodpecker'

// How common each bird is in each season (relative weights).
const BY_SEASON: Record<Season, Partial<Record<Species, number>>> = {
  spring: { robin: 3, cardinal: 3, songSparrow: 2, chickadee: 1, houseSparrow: 2, goldfinch: 1, dove: 2, woodpecker: 1 },
  summer: { robin: 2, cardinal: 3, songSparrow: 1, chickadee: 1, houseSparrow: 3, goldfinch: 2, dove: 2 },
  fall: { chickadee: 2, blueJay: 3, houseSparrow: 2, cardinal: 1, goldfinch: 1, woodpecker: 1, dove: 1 },
  winter: { chickadee: 3, cardinal: 2, houseSparrow: 1, blueJay: 1, woodpecker: 1 },
}

export function pickSpecies(season: Season, r = Math.random()): Species {
  const list = Object.entries(BY_SEASON[season]) as [Species, number][]
  let x = r * list.reduce((n, [, w]) => n + w, 0)
  for (const [s, w] of list) if ((x -= w) < 0) return s
  return list[0][0]
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

type Path = [number, number][] // [fraction of the note, frequency]
type NoteOpts = { trill?: [number, number]; wave?: OscillatorType; attack?: number }

// One note: a pitch glide with a soft envelope, and an optional trill (rate Hz, depth Hz).
function note(ctx: BaseAudioContext, dest: AudioNode, t: number, dur: number, peak: number, path: Path, o: NoteOpts = {}) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = o.wave ?? 'sine'
  osc.frequency.setValueAtTime(path[0][1], t)
  for (const [f, hz] of path.slice(1)) osc.frequency.linearRampToValueAtTime(hz, t + f * dur)
  if (o.trill) {
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = o.trill[0]
    depth.gain.value = o.trill[1]
    lfo.connect(depth).connect(osc.frequency)
    lfo.start(t)
    lfo.stop(t + dur + 0.05)
  }
  const a = o.attack ?? Math.min(0.02, dur / 4)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + a)
  g.gain.setValueAtTime(peak, t + Math.max(a, dur * 0.6))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(dest)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

// Schedules one song from time t and returns how long it lasts.
export function sing(ctx: BaseAudioContext, dest: AudioNode, kind: Species, t: number, peak: number, noise?: AudioBuffer): number {
  let s = t
  const n = (dur: number, p: number, path: Path, o?: NoteOpts) => note(ctx, dest, s, dur, peak * p, path, o)
  switch (kind) {
    case 'cardinal': {
      // "cheer cheer cheer, birdy birdy birdy": loud down-slurred whistles, then a quick run.
      const f = rand(3600, 4300)
      for (let i = Math.floor(rand(3, 6)); i > 0; i--) {
        n(0.22, 1, [[0, f], [0.25, f * 0.95], [1, f * 0.48]])
        s += 0.34
      }
      if (Math.random() < 0.6) for (let i = Math.floor(rand(4, 8)); i > 0; i--) {
        n(0.09, 0.8, [[0, f * 0.92], [0.5, f * 0.55], [1, f * 0.7]])
        s += 0.12
      }
      break
    }
    case 'robin': {
      // "cheerily, cheer-up, cheerio": short phrases of rising and falling carols.
      for (let ph = Math.floor(rand(2, 5)); ph > 0; ph--) {
        for (let i = Math.floor(rand(2, 4)); i > 0; i--) {
          const a = rand(2000, 2800)
          const b = rand(2500, 3300)
          const d = rand(0.15, 0.24)
          n(d, rand(0.75, 1), [[0, a], [0.4, b], [1, a * rand(0.85, 1.05)]], { trill: [rand(35, 50), 70] })
          s += d + rand(0.04, 0.08)
        }
        s += rand(0.35, 0.7)
      }
      break
    }
    case 'songSparrow': {
      // Three bright notes, a buzzy trill, then a little jumble.
      const f = rand(2500, 3000)
      for (let i = 0; i < 3; i++) {
        n(0.1, 0.9, [[0, f * 1.3], [1, f]])
        s += 0.18
      }
      n(0.55, 0.7, [[0, f * 1.4], [1, f * 1.3]], { trill: [rand(22, 30), rand(700, 1000)] })
      s += 0.62
      for (let i = Math.floor(rand(3, 6)); i > 0; i--) {
        const a = rand(2200, 4500)
        n(0.07, 0.7, [[0, a], [1, a * rand(0.7, 1.2)]])
        s += 0.09
      }
      break
    }
    case 'chickadee':
      if (Math.random() < 0.6) {
        // "fee-bee": two clear whistles, the second lower.
        const f = rand(3700, 4050)
        n(0.34, 1, [[0, f], [1, f * 0.99]], { attack: 0.05 })
        s += 0.42
        n(0.3, 0.85, [[0, f * 0.87], [1, f * 0.84]], { attack: 0.04 })
        s += 0.3
      } else {
        // "chick-a-dee-dee-dee": high chips, then buzzy dees.
        for (const f of [7000, 6200, 6600]) {
          n(0.05, 0.6, [[0, f], [1, f * 0.85]])
          s += 0.08
        }
        for (let i = Math.floor(rand(2, 5)); i > 0; i--) {
          n(0.16, 0.6, [[0, 3600], [1, 3400]], { trill: [rand(80, 110), 500], wave: 'triangle' })
          s += 0.2
        }
      }
      break
    case 'houseSparrow':
      // The town bird: rough, repeated "cheep" calls.
      for (let i = Math.floor(rand(3, 8)); i > 0; i--) {
        const f = rand(3000, 3600)
        n(0.09, rand(0.6, 1), [[0, f], [0.4, f * 1.3], [1, f * 1.05]], { wave: 'triangle', trill: [70, 200] })
        s += rand(0.15, 0.4)
      }
      break
    case 'goldfinch':
      // A long twittering run of quick, varied notes.
      for (let i = Math.floor(rand(10, 18)); i > 0; i--) {
        const a = rand(3000, 6000)
        const d = rand(0.04, 0.09)
        n(d, rand(0.4, 0.8), [[0, a], [1, a * rand(0.7, 1.4)]])
        s += d + rand(0.015, 0.06)
      }
      break
    case 'dove': {
      // "coo-OOO-oo... oo... oo": soft, low and hollow.
      const f = rand(480, 540)
      const o = { attack: 0.08 }
      n(0.35, 0.7, [[0, f], [1, f * 1.15]], o)
      s += 0.38
      n(0.5, 1, [[0, f * 1.18], [0.3, f * 1.22], [1, f * 1.0]], o)
      s += 0.6
      n(0.4, 0.7, [[0, f], [1, f * 0.94]], o)
      s += 0.9
      for (let i = 0; i < 3; i++) {
        n(0.5, 0.75, [[0, f * 0.98], [1, f * 0.92]], o)
        s += 0.75
      }
      break
    }
    case 'blueJay':
      // Harsh "jay! jay!" calls.
      for (let i = Math.floor(rand(2, 4)); i > 0; i--) {
        n(0.26, 0.5, [[0, 2600], [0.3, 2700], [1, 1900]], { wave: 'sawtooth', trill: [60, 150] })
        s += 0.45
      }
      break
    case 'woodpecker': {
      // A drum roll on a hollow branch: fast knocks that fade.
      if (!noise) break
      const knocks = Math.floor(rand(14, 24))
      const rate = rand(16, 22)
      const body = ctx.createBiquadFilter()
      body.type = 'bandpass'
      body.frequency.value = rand(900, 1500)
      body.Q.value = 4
      body.connect(dest)
      for (let i = 0; i < knocks; i++) {
        const k = ctx.createBufferSource()
        const g = ctx.createGain()
        k.buffer = noise
        const at = s + i / rate
        g.gain.setValueAtTime(peak * 3 * (1 - (i / knocks) * 0.6), at)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.025)
        k.connect(g).connect(body)
        k.start(at, Math.random())
        k.stop(at + 0.03)
      }
      s += knocks / rate
      break
    }
  }
  return s - t
}
