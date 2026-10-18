import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chooseFocus, costEach, pickThumbs, spinsFor, STILL_PER_FRAME, type Slot as S } from './thumbCopy'

const slot = (key: string, o: Partial<S> = {}): S => ({ key, still: false, scene: false, angle: 0.12, at: -Infinity, fresh: true, seen: true, ctx: {} as CanvasRenderingContext2D, canvas: { width: 100, height: 80 } as HTMLCanvasElement, ...o })
const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height })
const GAP = 1000 / 60 - 4

// Plays `ms` of 60 Hz frames, `spins` turning drawings a frame, and says how often each slot drew.
function play(page: S[], ms: number, spins: number, focus: S | null = null) {
  const drew = new Map<S, number>()
  for (let now = 0; now < ms; now += 1000 / 60) {
    const { need } = pickThumbs(page, () => true, { focus, now, gap: GAP, spins })
    for (const n of need.values()) for (const s of n.slots) {
      drew.set(s, (drew.get(s) ?? 0) + 1)
      s.at = now
      s.fresh = false
    }
  }
  return page.map((s) => ((drew.get(s) ?? 0) * 1000) / ms)
}

describe('thumbnails: every one on screen turns', () => {
  // Kegan, gem packs: "Why does only one spin". A smoothness fix had let only the hero turn.
  it('turns every car on screen, the hero at full rate', () => {
    const page = Array.from({ length: 9 }, (_, i) => slot(`c|car${i}`))
    const rates = play(page, 2000, 4, page[4])
    expect(rates[4]).toBeGreaterThanOrEqual(59)
    for (const r of rates) expect(r).toBeGreaterThanOrEqual(20)
  })

  it('draws every car every frame when the budget has room', () => {
    const page = Array.from({ length: 6 }, (_, i) => slot(`c|car${i}`))
    for (const r of play(page, 1000, spinsFor(6, 0.5))) expect(r).toBeGreaterThanOrEqual(59)
  })

  it('skips cars off screen, and holds them all with reduced motion', () => {
    const on = slot('c|on', { fresh: false })
    const off = slot('c|off', { fresh: false, seen: false })
    expect([...pickThumbs([on, off], () => true, { now: 100, gap: GAP }).need.values()].map((n) => n.key)).toEqual(['c|on'])
    expect(pickThumbs([on, off], () => true, { now: 200, gap: GAP, still: true }).need.size).toBe(0)
  })

  it('sizes the share to what a drawing costs, never below two', () => {
    expect(spinsFor(6, 1.5)).toBe(4)
    expect(spinsFor(6, 20)).toBe(2)
  })

  it('holds Upgrades buildings still unless the mouse is over one', () => {
    const b = slot('b|shop|10', { still: true, fresh: false })
    expect(pickThumbs([b], () => true, { now: 100, gap: GAP }).need.size).toBe(0)
    expect(pickThumbs([b], () => true, { now: 100, gap: GAP, hover: b }).need.size).toBe(1)
  })

  it('draws a held picture once and leaves it', () => {
    const s = slot('b|shop|10', { still: true })
    expect(pickThumbs([s], () => true).need.size).toBe(1)
    s.fresh = false
    const { need, waiting } = pickThumbs([s], () => true)
    expect(need.size).toBe(0)
    expect(waiting).toBe(false)
  })

  it('fills a page of held pictures a few per frame, never all in one', () => {
    const page = Array.from({ length: 40 }, (_, i) => slot(`b|k${i}|10`, { still: true }))
    const { need, waiting } = pickThumbs(page, () => true)
    expect(need.size).toBe(STILL_PER_FRAME)
    expect(waiting).toBe(true)
  })

  it('draws one model once for two held copies at the same turn', () => {
    const { need } = pickThumbs([slot('c|car', { still: true }), slot('c|car', { still: true })], () => true)
    expect(need.size).toBe(1)
    expect([...need.values()][0].slots).toHaveLength(2)
  })

  it('keeps arcade scenes animating only when they are due', () => {
    const sc = slot('s|arcade', { scene: true, fresh: false })
    expect(pickThumbs([sc], () => true, { scenes: true }).need.size).toBe(1)
    expect(pickThumbs([sc], () => true, { scenes: false }).need.size).toBe(0)
  })

  it('waits for a model that has not mounted yet', () => {
    const { need, waiting } = pickThumbs([slot('b|new|1')], () => false)
    expect(need.size).toBe(0)
    expect(waiting).toBe(true)
  })

  it('picks the hero car, or the card nearest the middle of a grid', () => {
    expect(chooseFocus([{ slot: 'small', box: box(150, 400, 90, 60) }, { slot: 'hero', box: box(20, 40, 300, 160) }], 390, 844)).toBe('hero')
    const grid = [0, 1, 2, 3, 4, 5].map((i) => ({ slot: i, box: box((i % 2) * 190, Math.floor(i / 2) * 280, 180, 120) }))
    expect(chooseFocus(grid, 390, 844)).toBe(3)
    expect(chooseFocus([{ slot: 'gone', box: box(0, 900, 100, 100) }], 390, 844)).toBe(null)
  })

  // Shop > Upgrades in a late-game town redrew every card's detailed building 24 times a second.
  it('shows Shop > Upgrades cards as held pictures', () => {
    expect(readFileSync('src/ui/Upgrade.tsx', 'utf8')).toMatch(/<BuildingThumb [^>]*\bstill\b/)
  })
})

// Kegan, a row of three cars: "Only 1/3 are spinning". Every screen with car tiles goes through
// the one scheduler above; none may hold its cars still.
describe('every screen with car tiles', () => {
  const screens = readdirSync('src/ui').filter((f) => f.endsWith('.tsx') && /<(CarThumb|HatThumb)\b/.test(readFileSync(`src/ui/${f}`, 'utf8')))
  it('finds the car screens', () => {
    for (const f of ['CarPacks.tsx', 'Collection.tsx', 'RaceHub.tsx', 'WorldTour.tsx', 'TimeTrial.tsx']) expect(screens).toContain(f)
  })
  it.each(screens)('%s turns its car tiles', (f) => {
    expect(readFileSync(`src/ui/${f}`, 'utf8')).not.toMatch(/<(CarThumb|HatThumb)\b[^>]*\bstill\b/)
  })
})

describe('thumbnails on a slow phone', () => {
  it('still turns every car when only one drawing fits a frame', () => {
    const page = Array.from({ length: 6 }, (_, i) => slot(`c|car${i}`))
    for (const r of play(page, 2000, 1, page[0])) expect(r).toBeGreaterThanOrEqual(9)
  })

  it('keeps the hero smooth on the smallest share', () => {
    const page = Array.from({ length: 6 }, (_, i) => slot(`c|car${i}`))
    const rates = play(page, 2000, spinsFor(6, 20), page[0])
    expect(rates[0]).toBeGreaterThanOrEqual(59)
    for (const r of rates) expect(r).toBeGreaterThanOrEqual(11)
  })
})

// Kegan, Car Packs on a desktop: "All previews are choppy". Each frame pays a fixed read back of the
// 3D picture however many thumbnails draw; counted as theirs, a page of cars looked so dear that two
// turned a frame and the rest moved a few times a second. Plays a page with the drawing costs a
// real frame has, the share sized from what drawing cost, and checks every car turns smoothly.
describe('a page of turning cars with a costly read back', () => {
  function playCosted(n: number, readMs: number, eachMs: number, ms = 3000) {
    const page = Array.from({ length: n }, (_, i) => slot(`c|car${i}`))
    const gaps = new Map<S, number>()
    let cost = 2, usual = Infinity
    for (let now = 0; now < ms; now += 1000 / 60) {
      const { need } = pickThumbs(page, () => true, { focus: page[0], now, gap: GAP, spins: spinsFor(6, cost) })
      const drawn = [...need.values()]
      if (!drawn.length) continue
      for (const d of drawn) for (const s of d.slots) {
        if (now > 1000) gaps.set(s, Math.max(gaps.get(s) ?? 0, now - s.at))
        s.at = now
        s.fresh = false
      }
      // The read back waits a little longer for each extra drawing (GPU work).
      const read = readMs + drawn.length * 0.05
      usual = Math.min(read, usual + 0.05)
      cost = cost * 0.8 + costEach(read + drawn.length * eachMs, read, usual, drawn.length) * 0.2
    }
    return page.map((s) => gaps.get(s) ?? Infinity)
  }

  // The Car Packs showcase keeps every car mounted, the others faded right out: they took turns
  // (and the hero's place) from the cars on show.
  it('gives no turns to a car faded out of sight', () => {
    const on = slot('c|on'), off = slot('c|off', { hidden: true })
    const rates = play([on, off], 1000, 2)
    expect(rates[0]).toBeGreaterThanOrEqual(59)
    expect(rates[1]).toBe(0)
  })

  it('turns every car on a 14-car page at 30 frames a second or better', () => {
    for (const gap of playCosted(14, 4, 0.3)) expect(gap).toBeLessThanOrEqual(34)
  })

  it('still shares out a dear drawing on a slow phone', () => {
    const gaps = playCosted(14, 6, 2)
    expect(gaps[0]).toBeLessThanOrEqual(17)
    for (const gap of gaps) expect(gap).toBeLessThanOrEqual(150)
  })
})
