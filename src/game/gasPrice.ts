// The price on the Big Bison sign: the live Los Angeles pump price (US EIA's weekly
// retail survey, regular, all formulations), fetched by netlify/functions/gas-price.mts.
// Display only: fill-up payouts never read it.

export const GAS_FALLBACK = 4.89
export const EIA_SERIES = 'EMM_EPMR_PTE_Y05LA_DPG'

// A believable pump price in dollars, or null for anything else.
export function gasPrice(v: unknown): number | null {
  const n = typeof v === 'string' ? Number.parseFloat(v) : typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n) || n < 1 || n > 20) return null
  return Math.round(n * 100) / 100
}

// The newest week from an EIA API v2 reply (sorted newest first, but don't count on it).
export function eiaLatest(json: unknown): { price: number; period: string } | null {
  const rows = (json as { response?: { data?: { period?: unknown; value?: unknown }[] } })?.response?.data
  if (!Array.isArray(rows)) return null
  let best: { price: number; period: string } | null = null
  for (const r of rows) {
    const price = gasPrice(r?.value)
    const period = typeof r?.period === 'string' ? r.period : ''
    if (price != null && period && (!best || period > best.period)) best = { price, period }
  }
  return best
}

export const gasLabel = (p: number) => p.toFixed(2)
