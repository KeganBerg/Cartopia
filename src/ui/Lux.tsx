import './lux.css'

// How much a pack shows off, 0 to 5, by its price among the packs on the same screen: the
// cheapest stays plain and each step up adds glow, a shine, a spinning gold rim, sparkles,
// and on the top pack a holo rim and a float (Kegan, 2026-10-17).
export const LUX_TOP = 5
export function luxLevels(prices: number[]): number[] {
  const steps = [...new Set(prices)].sort((a, b) => a - b)
  const top = Math.max(1, steps.length - 1)
  return prices.map((p) => Math.round((steps.indexOf(p) / top) * LUX_TOP))
}

export const luxClass = (n: number) => (n > 0 ? ` lux lux-${n}` : '')

// Fixed sparkle spots so every card twinkles the same way on every render.
const SPARKS = [
  [12, 18, 0], [84, 12, 0.7], [70, 46, 1.4], [20, 62, 2.1], [52, 8, 2.8],
  [90, 70, 0.35], [8, 40, 1.05], [40, 34, 1.75], [62, 80, 2.45],
]

// The effect layer: drawn over the card, never takes a tap. Put it first inside the card.
export function LuxFx({ n }: { n: number }) {
  if (n <= 0) return null
  const sparks = n >= 5 ? SPARKS : n >= 4 ? SPARKS.slice(0, 5) : []
  return (
    <span className="lux-fx" aria-hidden>
      {n >= 2 && <span className="lux-shine" />}
      {n >= 3 && <span className="lux-ring" />}
      {sparks.map(([x, y, d], i) => (
        <span key={i} className="lux-spark" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` } as React.CSSProperties} />
      ))}
    </span>
  )
}
