// Trim: the small touches on a car beyond its paint. Window tint, headlight colour and door
// handles, each bought once per car in the Garage's Trim tab (coins only; taking one back to
// stock is free). Presets keep a whole look (paint, panels and trim) to put on any car later.
// Trim is looks only and only ever costs coins, so the server guard has nothing to pay or check.

export type TrimDef = { id: string; name: string; coins: number; color: string; level?: number }

// Glass colour and how see-through it is (the town bakes it solid with the same colour).
export type TintDef = TrimDef & { opacity: number }
export const TINTS: TintDef[] = [
  { id: 'stock', name: 'Stock', coins: 0, color: '#3d6a8c', opacity: 0.55 },
  { id: 'clear', name: 'Clear', coins: 400, color: '#9fc6dd', opacity: 0.3 },
  { id: 'smoke', name: 'Smoke', coins: 600, color: '#2a3238', opacity: 0.72 },
  { id: 'limo', name: 'Limo', coins: 900, color: '#0c0e10', opacity: 0.9, level: 5 },
  { id: 'blue', name: 'Blue Mirror', coins: 1200, color: '#2f7fd6', opacity: 0.8, level: 8 },
  { id: 'gold', name: 'Gold Mirror', coins: 1500, color: '#c99a2e', opacity: 0.8, level: 12 },
]

export const LIGHTS: TrimDef[] = [
  { id: 'stock', name: 'Stock', coins: 0, color: '#fffde7' },
  { id: 'warm', name: 'Warm', coins: 300, color: '#ffd27a' },
  { id: 'ice', name: 'Ice Blue', coins: 500, color: '#b5e3ff' },
  { id: 'yellow', name: 'Fog Yellow', coins: 500, color: '#ffe14d' },
  { id: 'violet', name: 'Violet', coins: 800, color: '#d3a6ff', level: 6 },
  { id: 'mint', name: 'Mint', coins: 800, color: '#a6ffd3', level: 6 },
]

// Door handles: chrome as they come, painted the car's colour, or black.
export const HANDLES: TrimDef[] = [
  { id: 'stock', name: 'Chrome', coins: 0, color: '#cfd8dc' },
  { id: 'body', name: 'Body colour', coins: 250, color: '' },
  { id: 'black', name: 'Black', coins: 250, color: '#161616' },
]

export type TrimKind = 'tint' | 'lights' | 'handles'
export type Trim = Partial<Record<TrimKind, string>>
export const TRIM_KINDS: { id: TrimKind; name: string; list: TrimDef[] }[] = [
  { id: 'tint', name: 'Window tint', list: TINTS },
  { id: 'lights', name: 'Headlights', list: LIGHTS },
  { id: 'handles', name: 'Door handles', list: HANDLES },
]

export const trimDef = (kind: TrimKind, id?: string | null) => {
  const list = TRIM_KINDS.find((k) => k.id === kind)!.list
  return list.find((d) => d.id === id) ?? list[0]
}
export const tintDef = (id?: string | null) => TINTS.find((d) => d.id === id) ?? TINTS[0]

// Only the picks that aren't stock, or undefined when everything is stock (keeps saves small).
export function tidyTrim(t?: Trim | null): Trim | undefined {
  const out: Trim = {}
  for (const k of TRIM_KINDS) {
    const id = t?.[k.id]
    if (id && id !== 'stock' && k.list.some((d) => d.id === id)) out[k.id] = id
  }
  return Object.keys(out).length ? out : undefined
}
export const sameTrim = (a?: Trim | null, b?: Trim | null) => JSON.stringify(tidyTrim(a) ?? {}) === JSON.stringify(tidyTrim(b) ?? {})

// What changing a car's trim costs: each new pick once, going back to stock free.
export function trimCost(was?: Trim | null, next?: Trim | null) {
  let coins = 0
  for (const k of TRIM_KINDS) {
    const id = next?.[k.id] ?? 'stock'
    if (id !== (was?.[k.id] ?? 'stock')) coins += trimDef(k.id, id).coins
  }
  return coins
}

// The first pick that needs a higher level than the player has (and isn't already on the car).
export function trimLocked(level: number, was?: Trim | null, next?: Trim | null) {
  for (const k of TRIM_KINDS) {
    const id = next?.[k.id]
    const d = trimDef(k.id, id)
    if (id && id !== was?.[k.id] && d.level && level < d.level) return d
  }
  return null
}

// A saved look: a car's paint, panels and trim, to put on any car later.
export const PRESET_SLOTS = 3
