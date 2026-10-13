import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// A lost closing brace (easy to drop when merging) silently nests every rule
// after it inside the previous @media block, so they only apply on some
// screens. That broke the HUD and the coin flights once; catch it here.
function problems(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  const out: string[] = []
  let depth = 0
  text.split('\n').forEach((line, i) => {
    if (depth > 0 && /^[^\s}@]/.test(line)) out.push(`line ${i + 1} starts a rule while still inside a block`)
    for (const ch of line) {
      if (ch === '{') depth++
      else if (ch === '}' && --depth < 0) {
        out.push(`line ${i + 1} has an extra }`)
        depth = 0
      }
    }
  })
  if (depth) out.push(`${depth} block(s) never closed`)
  return out
}

describe('stylesheets', () => {
  for (const file of ['index.css', 'theme.css', 'ui/crates.css', 'ui/chat.css', 'ui/race-menu.css', 'ui/loading.css', 'ui/goal.css', 'ui/purchase.css', 'ui/confirm.css']) {
    it(`${file} has balanced braces`, () => {
      expect(problems(readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'))).toEqual([])
    })
  }
})

// The tutorial's goal screen reuses the word "goal", which is also every card
// in the Goals panel. An unscoped .goal rule there pushed each card down 80px.
describe('goal screen stylesheet', () => {
  it('only styles the goal screen card, never the Goals panel cards', () => {
    const css = readFileSync(new URL('./ui/goal.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css.match(/(^|[\s,{}])\.goal(?![-\w])/gm) ?? []).toEqual([])
  })
})
