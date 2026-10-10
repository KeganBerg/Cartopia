import { useEffect, useState, useSyncExternalStore } from 'react'
import { useGame, lastCollectAll, collectAllListeners, COLLECT_ALL_MS } from '../game/store'
import { buildingDef } from '../game/data'

const subscribe = (fn: () => void) => (collectAllListeners.add(fn), () => collectAllListeners.delete(fn))

// One button that collects everything ready and fuels everything idle,
// usable once a minute. A ring counts down while it recharges.
export function CollectAllButton() {
  const last = useSyncExternalStore(subscribe, lastCollectAll)
  const collectAll = useGame((s) => s.collectAll)
  const buildings = useGame((s) => s.buildings)
  const outOfGas = useGame((s) => s.cars.some((c) => c.lowFuel))
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, COLLECT_ALL_MS - (now - last))
  const ready = buildings.filter((b) => buildingDef(b.def).jobSeconds && b.jobEndsAt !== null && now >= b.jobEndsAt).length
  const idle = buildings.filter((b) => buildingDef(b.def).jobSeconds && buildingDef(b.def).kind !== 'obstacle' && b.jobEndsAt === null).length
  const work = ready + (outOfGas ? 1 : 0) + idle
  const pct = left ? (1 - left / COLLECT_ALL_MS) * 100 : 100
  return (
    <button
      className={`collect-all ${left ? 'cooling' : work ? 'has-work' : ''}`}
      onClick={() => collectAll()}
      title="Collect and fuel everything"
      aria-label="Collect and fuel everything"
      style={{ ['--pct' as string]: `${pct}%` }}
    >
      <span className="collect-ico">⚡</span>
      {left ? <span className="collect-time">{Math.ceil(left / 1000)}s</span> : ready > 0 && <span className="collect-badge">{ready}</span>}
    </button>
  )
}
