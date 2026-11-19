// Turns the game's English into another language from a dictionary of English -> translation.
// Keys are the English as written in the code (scripts/i18n/extract.mjs lists them): `{}`
// (a filled-in value) and a lone `#` (a number in goal text) match anything, so "Win {} races"
// also covers "Win 12 races". A translation fills its gaps in order with `{}`, or by
// position with `{0}`, `{1}` when the language puts them the other way round.

export type Dict = Record<string, string>

type Pattern = { re: RegExp; to: string }
export type Compiled = { exact: Map<string, string>; byWord: Map<string, Pattern[]>; loose: Pattern[]; cache: Map<string, string | null> }

const GAP = /\{\}|(?<=^|\s)#(?=\s|$|[.,!?:;)])/g
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const words = (s: string) => s.toLowerCase().match(/[a-z]{3,}/g) ?? []
const CACHE_MAX = 4000

export function compile(dict: Dict): Compiled {
  const exact = new Map<string, string>()
  const byWord = new Map<string, Pattern[]>()
  const loose: Pattern[] = []
  for (const [en, to] of Object.entries(dict)) {
    if (!to || to === en) continue
    if (!GAP.test(en)) {
      exact.set(en, to)
      continue
    }
    GAP.lastIndex = 0
    const parts = en.split(GAP)
    const p: Pattern = { re: new RegExp(`^${parts.map(escape).join('(.+?)')}$`, 's'), to }
    // Filed under its longest word, so a text is only tried against patterns sharing a word.
    const key = parts.flatMap(words).sort((a, b) => b.length - a.length)[0]
    if (!key) loose.push(p)
    else byWord.set(key, [...(byWord.get(key) ?? []), p])
  }
  return { exact, byWord, loose, cache: new Map() }
}

function fill(to: string, gaps: string[]) {
  let i = 0
  return to.replace(/\{(\d*)\}/g, (_, n: string) => gaps[n === '' ? i++ : Number(n)] ?? '')
}

const upFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const SEP = ' · '

// The translation of one piece of text (trimmed), or null when the dictionary has none.
// Past the dictionary's own lines it also tries: the line with a capital the game added
// ("Find old cars…" from "find old cars…"), a count in brackets ("Compact (1)"), and each
// part of a line joined with " · " ("Back Streets · 1/5").
export function lookup(c: Compiled, text: string): string | null {
  const known = c.cache.get(text)
  if (known !== undefined) return known
  let out = find(c, text)
  if (out === null && /^[A-Z][a-z]/.test(text)) {
    const low = find(c, text.charAt(0).toLowerCase() + text.slice(1))
    if (low !== null) out = upFirst(low)
  }
  const count = out === null ? /^(.+?)( \(\d[\d,]*\))$/.exec(text) : null
  if (count) {
    const head = lookup(c, count[1])
    if (head !== null) out = head + count[2]
  }
  if (out === null && text.includes(SEP)) {
    const parts = text.split(SEP)
    const done = parts.map((p) => lookup(c, p))
    if (done.some((d) => d !== null)) out = done.map((d, i) => d ?? parts[i]).join(SEP)
  }
  if (c.cache.size > CACHE_MAX) c.cache.clear()
  c.cache.set(text, out)
  return out
}

function find(c: Compiled, text: string): string | null {
  const hit = c.exact.get(text)
  if (hit !== undefined) return hit
  if (!/[A-Za-z]{2}/.test(text)) return null
  let out: string | null = null
  const tried = new Set<Pattern[]>()
  for (const w of [...new Set(words(text)), '']) {
    const list = w ? c.byWord.get(w) : c.loose
    if (!list || tried.has(list)) continue
    tried.add(list)
    for (const p of list) {
      const m = p.re.exec(text)
      if (!m) continue
      // Gaps are usually numbers or names; a gap that is itself English in the dictionary is translated too.
      out = fill(p.to, m.slice(1).map((g) => c.exact.get(g) ?? g))
      break
    }
    if (out !== null) break
  }
  return out
}

// Translate keeping the text's own leading and trailing spaces.
export function translateText(c: Compiled, raw: string): string | null {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return null
  const to = lookup(c, text)
  if (to === null) return null
  const lead = raw.match(/^\s*/)![0] ? ' ' : ''
  const trail = raw.match(/\s*$/)![0] ? ' ' : ''
  return lead + to + trail
}
