import { describe, expect, it } from 'vitest'
import { CUSTOM_PAINT, CUSTOM_PAINT_CRATE, PAINTS } from './data'
import { CRATES, crateOwnedSkins, crateSkins, crateTables, rollCrate, skinOdds } from './crates'
import { paintOpen } from './paintRivals'
import { hexToHsv, hsvToHex } from '../lib/hsv'

describe('Custom Colour', () => {
  it('is a legendary paint in the Diamond Crate only', () => {
    expect(CUSTOM_PAINT.tier).toBe('legendary')
    for (const c of CRATES) expect(crateSkins(c).some((x) => x.id === CUSTOM_PAINT.id), c.id).toBe(c.id === CUSTOM_PAINT_CRATE)
    const p = skinOdds(CRATES.find((c) => c.id === 'diamond')!).find((x) => x.id === CUSTOM_PAINT.id)!.p
    expect(p).toBeGreaterThan(0)
    expect(crateTables().skins[CUSTOM_PAINT.id]).toEqual({ tier: 'legendary', only: 'diamond' })
  })

  it('drops from Diamond Crates, then pays coins once owned', () => {
    const diamond = CRATES.find((c) => c.id === 'diamond')!
    let seed = 7
    const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
    const got = Array.from({ length: 20000 }, () => rollCrate(diamond, 30, [{ uid: 'a', model: 'civic' }], rand))
      .filter((d) => (d.kind === 'skin' || d.kind === 'skindupe') && d.skin === CUSTOM_PAINT.id)
    expect(got.length).toBeGreaterThan(0)
    const owned = { skins: crateOwnedSkins({ level: 30, skins: [CUSTOM_PAINT.id] }), modSkins: [] }
    const again = Array.from({ length: 20000 }, () => rollCrate(diamond, 30, [{ uid: 'a', model: 'civic' }], rand, owned))
      .filter((d) => d.kind === 'skin' && d.skin === CUSTOM_PAINT.id)
    expect(again).toEqual([])
  })

  it('opens every colour once won', () => {
    const offChart = '#19ffb0'
    expect(PAINTS.some((p) => p.color === offChart)).toBe(false)
    expect(paintOpen({}, offChart)).toBe(false)
    expect(paintOpen({ skins: [CUSTOM_PAINT.id] }, offChart)).toBe(true)
    expect(paintOpen({ rivalRow: {} }, '#ec407a')).toBe(false)
    expect(paintOpen({ rivalRow: {}, skins: [CUSTOM_PAINT.id] }, '#ec407a')).toBe(true)
    expect(paintOpen({ skins: [CUSTOM_PAINT.id] }, 'red')).toBe(false)
  })

  it('turns picker colours into hex and back', () => {
    expect(hsvToHex([0, 1, 1])).toBe('#ff0000')
    expect(hsvToHex([120, 1, 1])).toBe('#00ff00')
    expect(hsvToHex([240, 1, 0.5])).toBe('#000080')
    for (const p of PAINTS) expect(hsvToHex(hexToHsv(p.color))).toBe(p.color)
  })
})
