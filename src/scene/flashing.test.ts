// @vitest-environment jsdom
import './testCanvas'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from 'three'
import { sunDay } from '../game/sun'
import { startEvent, stopEvent, BUILD_MS } from '../game/techno'
import { calmFlashing, setCalmFlashing } from '../game/flashing'
import { clubHit, resetClubBeat } from '../lib/clubBeat'
import { clubLedColor, clubLedGlow } from './clubLeds'

// Reduce flashing (WCAG 2.3.1): with it on, the club windows and Rave Mode's
// lights change no more than 3 times a second. Play a few seconds at midnight
// and count every rise in brightness and every change of colour.

const MIDNIGHT = sunDay(20_000).noon + 12 * 3_600_000
const SECS = 6

function sample(start: number) {
  let t = start
  vi.spyOn(Date, 'now').mockImplementation(() => t)
  vi.spyOn(performance, 'now').mockImplementation(() => t - start)
  const c = new Color()
  let flashes = 0
  let colours = 0
  let prevGlow = -1
  let rising = false
  let prevHex = ''
  for (let ms = 0; ms < SECS * 1000; ms += 10) {
    t = start + ms
    const g = clubLedGlow(ms)
    // A flash: brightness climbs by a noticeable step after falling or holding.
    if (prevGlow >= 0 && g - prevGlow > 0.05 && !rising) flashes++
    rising = prevGlow >= 0 && g > prevGlow + 0.001
    prevGlow = g
    const hex = clubLedColor(c, ms).getHexString()
    if (prevHex && hex !== prevHex) colours++
    prevHex = hex
  }
  return { flashes: flashes / SECS, colours: colours / SECS }
}

afterEach(() => {
  stopEvent('techno')
  setCalmFlashing(false)
  vi.restoreAllMocks()
})

describe('reduce flashing', () => {
  it('is off by default without the device asking for less motion', () => {
    expect(calmFlashing()).toBe(false)
    setCalmFlashing(true)
    expect(calmFlashing()).toBe(true)
    expect(document.documentElement.classList.contains('calm-flash')).toBe(true)
  })

  it('Rave Mode: the club flashes on every kick normally, at most 3 a second with it on', () => {
    const drop = MIDNIGHT + 2000
    vi.spyOn(Date, 'now').mockReturnValue(MIDNIGHT)
    startEvent('techno', { from: drop - BUILD_MS, drop })
    resetClubBeat()
    const loud = sample(drop + 10_000)
    expect(loud.flashes).toBeGreaterThan(2)
    setCalmFlashing(true)
    resetClubBeat()
    const calm = sample(drop + 10_000)
    expect(calm.flashes).toBeLessThanOrEqual(3)
    expect(calm.colours).toBeLessThanOrEqual(3)
  })

  it("the Acid groove's sixteenth-note strobe goes steady", () => {
    // 125 bpm: a kick every beat and the acid line on every sixteenth.
    const play = () => {
      resetClubBeat()
      const sixteenth = 60000 / 125 / 4
      for (let n = 0; n < (SECS * 1000) / sixteenth; n++) {
        if (n % 4 === 0) clubHit(n * sixteenth, 'kick', 1, 3)
        clubHit(n * sixteenth, 'acid', 1, 3)
      }
    }
    play()
    expect(sample(MIDNIGHT).flashes).toBeGreaterThan(3)
    vi.restoreAllMocks()
    play()
    setCalmFlashing(true)
    const calm = sample(MIDNIGHT)
    expect(calm.flashes).toBeLessThanOrEqual(3)
    expect(calm.colours).toBeLessThanOrEqual(3)
  })
})
