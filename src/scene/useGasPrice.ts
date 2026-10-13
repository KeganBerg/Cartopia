import { useSyncExternalStore } from 'react'
import { GAS_FALLBACK, gasPrice } from '../game/gasPrice'

// The Big Bison sign's price: asked for once per visit, remembered for a day so the
// sign shows the last live price straight away (see src/game/gasPrice.ts).
const KEY = 'cartopia-gas'
const DAY = 24 * 60 * 60 * 1000
let price = GAS_FALLBACK
let asked = false
const subs = new Set<() => void>()

function remembered(): number | null {
  try {
    const { p, at } = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return Date.now() - at < DAY ? gasPrice(p) : null
  } catch {
    return null
  }
}

function set(p: number) {
  if (p === price) return
  price = p
  for (const f of subs) f()
}

function ask() {
  if (asked || typeof window === 'undefined') return
  asked = true
  const known = remembered()
  if (known != null) return set(known)
  fetch('/.netlify/functions/gas-price')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const p = gasPrice(j?.price)
      if (p == null) return
      set(p)
      try {
        if (j.live) localStorage.setItem(KEY, JSON.stringify({ p, at: Date.now() }))
      } catch { /* private mode */ }
    })
    .catch(() => {})
}

function subscribe(f: () => void) {
  subs.add(f)
  ask()
  return () => void subs.delete(f)
}

export const useGasPrice = () => useSyncExternalStore(subscribe, () => price)
