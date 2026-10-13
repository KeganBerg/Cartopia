// The player's best drag run's checkpoint times (game/splits.ts), per strip, on this device only:
// they never go into the save. The time trial's "Your best" ghost is timed against them.
import { SPLIT_MARKS } from '../game/splits'

export type BestSplits = { t: number; splits: number[] }
type Store = Record<string, BestSplits>

const KEY = 'cartopia-splits'

export function parseSplits(raw: string | null): Store {
  try {
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    const out: Store = {}
    for (const [k, b] of Object.entries(v ?? {})) {
      const r = b as Partial<BestSplits> | null
      if (r && typeof r.t === 'number' && r.t > 0 && Array.isArray(r.splits) && r.splits.length === SPLIT_MARKS.length && r.splits.every((s) => typeof s === 'number' && s > 0 && s < r.t!)) {
        out[k] = { t: r.t, splits: r.splits }
      }
    }
    return out
  } catch {
    return {}
  }
}

// The store with this run kept, if it's a full run and the best on this strip.
export function withRun(store: Store, key: string, t: number, splits: number[]): Store {
  const old = store[key]
  if (splits.length !== SPLIT_MARKS.length || !SPLIT_MARKS.every((_, i) => splits[i] > 0 && splits[i] < t) || (old && old.t <= t)) return store
  return { ...store, [key]: { t, splits } }
}

function load(): Store {
  try {
    return parseSplits(localStorage.getItem(KEY))
  } catch {
    return {}
  }
}

export const bestSplits = (key: string): BestSplits | null => load()[key] ?? null

export function saveBestSplits(key: string, t: number, splits: number[]) {
  const store = load()
  const next = withRun(store, key, t, splits)
  if (next === store) return
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: splits fall back to the ghost's curve.
  }
}
