// Short counters for tight spots like the HUD: 9,999 / 52.6K / 1.2M / 3.4B / 5T.
const UNITS = ['', 'K', 'M', 'B', 'T', 'Q']

export function compact(v: number): string {
  const sign = v < 0 ? '-' : ''
  let a = Math.abs(Math.floor(v))
  if (a < 10_000) return sign + a.toLocaleString()
  let i = 0
  while (a >= 1000 && i < UNITS.length - 1) { a /= 1000; i++ }
  // Round down so the HUD never shows more than you have.
  const d = a < 100 ? 1 : 0
  const f = 10 ** d
  const r = Math.floor(a * f) / f
  return sign + r.toFixed(d).replace(/\.0$/, '') + UNITS[i]
}
