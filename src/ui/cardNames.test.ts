// Card names and buttons never get cut off (Kegan 10-16: "Liberty Firebolt High..." on a pack
// card, and "✓ In garage" wrapping to two lines): names wrap to a second line instead of "...",
// and a card's tag and buy button each stay on one line.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// Every declaration block for a selector, as written in the file.
const rules = (file: string, selector: string) => {
  const css = readFileSync(file, 'utf8')
  const out: string[] = []
  const re = /([^{}]+)\{([^}]*)\}/g
  for (let m = re.exec(css); m; m = re.exec(css)) if (m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').some((s) => s.trim() === selector)) out.push(m[2])
  return out
}

describe('card names and buttons stay whole', () => {
  for (const [file, sel] of [['src/ui/car-packs.css', '.pk-name'], ['src/ui/car-packs.css', '.pk-grid .pk-name'], ['src/ui/shop.css', '.shop-card .card-name'], ['src/ui/upgrades.css', '.ug-name']]) {
    it(`${sel} wraps rather than trailing off`, () => {
      const r = rules(file, sel)
      expect(r.length, `${sel} in ${file}`).toBeGreaterThan(0)
      for (const d of r) {
        expect(d).not.toMatch(/white-space:\s*nowrap/)
        expect(d).not.toMatch(/text-overflow:\s*ellipsis/)
      }
    })
  }

  it('pack card tags and buttons keep to one line', () => {
    expect(rules('src/ui/car-packs.css', '.pk-foot .pk-tiertag').join()).toMatch(/white-space:\s*nowrap/)
    expect(rules('src/ui/car-packs.css', '.pk-foot .pk-buy').join()).toMatch(/white-space:\s*nowrap/)
  })

  it('an owned pack says so in a word, so its button matches the price buttons', () => {
    expect(readFileSync('src/ui/CarPacks.tsx', 'utf8')).toContain('✓ Owned')
  })
})
