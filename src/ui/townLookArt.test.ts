// Menu > Town pictures (scripts/townlook renders them) stay sharp on phones: rendered at twice
// the size they're shown, and one for every lamp design, light colour and colour theme.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { COLOR_THEMES, LAMP_POSTS, LIGHT_TONES } from '../game/cityLook'

const DIR = 'src/assets/town-look'

// Width and height from a WebP's header (lossy VP8, lossless VP8L or extended VP8X).
function webpSize(b: Buffer) {
  const kind = b.toString('ascii', 12, 16)
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
  if (kind === 'VP8L') {
    const n = b.readUInt32LE(21)
    return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }
  }
  return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 }
}

describe('Menu > Town pictures', () => {
  const files = new Set(readdirSync(DIR))
  it('has a picture for every lamp, light colour and theme', () => {
    for (const p of LAMP_POSTS) for (const t of LIGHT_TONES) expect(files.has(`lamp-${p.id}-${t.id}.webp`), `lamp-${p.id}-${t.id}`).toBe(true)
    for (const t of [{ id: 'own' }, ...COLOR_THEMES]) expect(files.has(`theme-${t.id}.webp`), `theme-${t.id}`).toBe(true)
  })

  it('renders them at 2x so they stay sharp on a phone', () => {
    for (const f of files) {
      const { w, h } = webpSize(readFileSync(`${DIR}/${f}`))
      if (f.startsWith('lamp-')) expect([w, h], f).toEqual([480, 480])
      else expect([w, h], f).toEqual([720, 440])
    }
  })
})
