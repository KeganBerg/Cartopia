import { Icon, CoinIcon, FuelIcon } from './Icon'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useGame, lastCollectAll, collectAllSkips, collectAllListeners, COLLECT_ALL_MS } from '../game/store'
import { buildingDef, isOpen } from '../game/data'

const subscribe = (fn: () => void) => (collectAllListeners.add(fn), () => collectAllListeners.delete(fn))
// How long the skipped-chore icons stay up after a tap.
const SKIP_MS = 5000

// One button for every chore: fix flats, fill up cars, collect what's ready
// and restart what's idle. Usable once a minute; a ring counts down while it
// recharges. Chores the coins or fuel couldn't cover show as struck icons.
export function CollectAllButton() {
  const last = useSyncExternalStore(subscribe, lastCollectAll)
  const skips = useSyncExternalStore(subscribe, collectAllSkips)
  const collectAll = useGame((s) => s.collectAll)
  const buildings = useGame((s) => s.buildings)
  const carWork = useGame((s) => s.cars.some((c) => c.lowFuel || c.flat))
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, COLLECT_ALL_MS - (now - last))
  const ready = buildings.filter((b) => buildingDef(b.def).jobSeconds && b.jobEndsAt !== null && now >= b.jobEndsAt).length
  const idle = buildings.filter((b) => buildingDef(b.def).jobSeconds && buildingDef(b.def).kind !== 'obstacle' && b.jobEndsAt === null && isOpen(buildingDef(b.def), now)).length
  const work = ready + (carWork ? 1 : 0) + idle
  const pct = left ? (1 - left / COLLECT_ALL_MS) * 100 : 100
  const showSkips = now - skips.at < SKIP_MS
  return (
    <button
      className={`collect-all ${left ? 'cooling' : work ? 'has-work' : ''}`}
      onClick={() => collectAll()}
      title="Do it all: fix, fuel, collect, restart"
      aria-label="Fix, fuel, collect and restart everything"
      style={{ ['--pct' as string]: `${pct}%` }}
    >
      <span className="collect-ico"><Icon name="bolt" size={30} /></span>
      {left ? <span className="collect-time">{Math.ceil(left / 1000)}s</span> : ready > 0 && <span className="collect-badge">{ready}</span>}
      {showSkips && (skips.fuel > 0 || skips.coins > 0) && (
        <span className="collect-skips">
          {skips.fuel > 0 && <span className="collect-skip" data-tap-tip title={`Low fuel: ${skips.fuel} not started`}><FuelIcon size={16} /></span>}
          {skips.coins > 0 && <span className="collect-skip" data-tap-tip title={`Low coins: ${skips.coins} car${skips.coins > 1 ? 's' : ''} not fixed`}><CoinIcon size={16} /></span>}
        </span>
      )}
    </button>
  )
}
