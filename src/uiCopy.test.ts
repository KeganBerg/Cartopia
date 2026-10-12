// UI rules check (docs/ui-rules.md): on-screen copy stays short. Any line a player
// reads over MAX_WORDS words fails, except the ones already in BASELINE, which
// may only shrink. Fix a screen by showing it (renders, icons, numbers) rather
// than raising a number here.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { visibleCopy, wordCount } from './uiCopy'

const MAX_WORDS = 12

// Long lines that predate the rule, per file. Lower these as screens are cleaned
// up; never raise them. Settings/account help and crew screens are next.
const BASELINE: Record<string, number> = {
  'src/ui/Account.tsx': 9,
  'src/ui/Alerts.tsx': 1,
  'src/ui/Bank.tsx': 2,
  'src/ui/Chat.tsx': 1,
  'src/ui/FlashWarning.tsx': 1, // seizure warning: safety copy stays in full
  'src/ui/Settings.tsx': 1, // delete-account warning: safety copy stays in full
  'src/ui/Social.tsx': 3,
  'src/ui/Username.tsx': 2,
}

const files = [
  'src/App.tsx',
  ...readdirSync('src/ui').filter((f) => f.endsWith('.tsx')).map((f) => `src/ui/${f}`),
  ...readdirSync('src/scene').filter((f) => f.endsWith('.tsx')).map((f) => `src/scene/${f}`),
]

describe('UI copy stays short (docs/ui-rules.md)', () => {
  it('counts words the way a player reads them', () => {
    expect(wordCount('Beat the boss · +$3,900')).toBe(4)
    expect(wordCount('${n} of ${m} won')).toBe(4)
  })

  it('finds JSX text and shown literals, not tooltips', () => {
    const found = visibleCopy(`const A = () => <div title="a very long tooltip that nobody reads unless they hover over it">
      <p>Golden hour on the boardwalk, salt spray in the air.</p>
      {won ? 'Fit it in the Paint Shop' : 'Beat the boss'}
    </div>`).map((c) => c.text)
    expect(found).toContain('Golden hour on the boardwalk, salt spray in the air.')
    expect(found).toContain('Fit it in the Paint Shop')
    expect(found.some((t) => t.includes('tooltip'))).toBe(false)
  })

  for (const f of files) {
    it(`${f} has no new walls of text`, () => {
      const long = visibleCopy(readFileSync(f, 'utf8'), f).filter((c) => c.words > MAX_WORDS)
      const allowed = BASELINE[f] ?? 0
      expect(long.length, `Copy over ${MAX_WORDS} words in ${f} (see docs/ui-rules.md):\n${long.map((c) => `  line ${c.line}: ${c.text}`).join('\n')}`).toBeLessThanOrEqual(allowed)
    })
  }

  it('flavour blurbs are never rendered as on-screen text', () => {
    // Blurbs in game data are for tooltips only (title={x.blurb}).
    const hits = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l }))
      .filter(({ l }) => /\{[\w.?]+\.blurb\}/.test(l) && !/title=\{[\w.?]+\.blurb\}/.test(l)))
    expect(hits.map(({ f, i, l }) => `${f}:${i} ${l.trim()}`)).toEqual([])
  })
})
