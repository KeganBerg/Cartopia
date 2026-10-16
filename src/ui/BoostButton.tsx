// How long the "+20%" gain chip floats over the ring after a shift tops the tank up.
export const GAIN_MS = 900

type Tank = { boost: number; burning: boolean; boostUsed: boolean; launched: boolean }
export type BoostGain = { n: number; amt: number }

// What a launch or shift just added to the tank, as a new chip (n keys its animation).
export const nextGain = (prev: BoostGain | null, before: number, after: number): BoostGain | null => {
  const amt = Math.round((after - before) * 100)
  return amt > 0 ? { n: (prev?.n ?? 0) + 1, amt } : prev
}

// The boost tank as a ring that fills with clean driving; tap it once to fire. Each launch or
// shift that adds to the tank floats its gain (+20%) off the ring, on every screen and input.
export function BoostButton({ r, onFire, ready, gain }: { r: Tank; onFire: () => void; ready: boolean; gain?: BoostGain | null }) {
  const spent = r.boostUsed && !r.burning
  const fill = Math.round(r.boost * 100)
  return (
    <button
      className={`boost-btn${r.burning ? ' burning' : ''}${!spent && fill >= 99 ? ' full' : ''}`}
      style={{ ['--fill' as string]: `${fill}%` }}
      onPointerDown={(e) => { e.preventDefault(); onFire() }}
      onContextMenu={(e) => e.preventDefault()}
      disabled={!ready || spent || !r.launched || r.boost <= 0}
      aria-label={`Boost, ${fill}% full`}
    >
      <span>🔥</span>
      <small>{spent ? 'USED' : 'BOOST'}</small>
      {gain && !r.burning && !spent && <b key={gain.n} className="boost-gain" aria-hidden="true">+{gain.amt}%</b>}
    </button>
  )
}
