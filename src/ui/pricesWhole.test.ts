// Players always see a whole price (Kegan 10-17: "Buy · $1,5…" in the car parts shop). The full
// check opens every shop in a browser (scripts/pricecheck/check.mjs); this one keeps the CSS and
// the labels from bringing the "..." back.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

const css = ['src/index.css', 'src/theme.css', ...readdirSync('src/ui').filter((f) => f.endsWith('.css')).map((f) => `src/ui/${f}`)]
const tsx = readdirSync('src/ui').filter((f) => f.endsWith('.tsx')).map((f) => `src/ui/${f}`)

describe('prices show whole', () => {
  it('no price, cost or buy button style trails off with "..."', () => {
    const hits: string[] = []
    for (const f of css) {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      for (const m of src.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const sel = m[1].trim()
        if (/\.(buy|price|cost)\b|[\w-]*(price|cost|-buy)\b/.test(sel) && /text-overflow:\s*ellipsis/.test(m[2])) hits.push(`${f}: ${sel}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('buy buttons show the price, not "Buy ·" in front of it', () => {
    const hits = tsx.flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l })).filter(({ l }) => /Buy · /.test(l)))
    expect(hits.map(({ f, i }) => `${f}:${i}`)).toEqual([])
  })
})
