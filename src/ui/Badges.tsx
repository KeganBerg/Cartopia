import { Vector3 } from 'three'
import { useGame, type PlacedBuilding } from '../game/store'
import { buildingDef, carDef } from '../game/data'
import { anchors, anchorRef } from '../scene/anchors'
import { centerOf } from '../scene/World'
import { useNow } from '../scene/useNow'

function fmt(sec: number) {
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`
  return `${sec}s`
}

function JobBadge({ b, now }: { b: PlacedBuilding; now: number }) {
  const d = buildingDef(b.def)
  const tap = useGame((s) => s.tapBuilding)
  const [cx, cz] = centerOf(b.def, b.x, b.z)
  anchors.set(b.uid, new Vector3(cx, d.w > 1 ? 2.6 : 2.2, cz))
  const ready = b.jobEndsAt !== null && now >= b.jobEndsAt
  const working = b.jobEndsAt !== null && !ready
  const left = working ? Math.ceil((b.jobEndsAt! - now) / 1000) : 0
  const pct = working ? 1 - left / d.jobSeconds! : 0
  return (
    <div className="anchor" ref={anchorRef(b.uid)}>
      <button className={`badge ${ready ? 'badge-ready' : working ? 'badge-working' : 'badge-idle'}`} onClick={() => tap(b.uid)} title={d.name}>
        {ready ? (
          <span className="coin">$</span>
        ) : working ? (
          <>
            <span className="clock">⏱</span>
            <span className="bar"><span style={{ width: `${pct * 100}%` }} /></span>
            <span className="time">{fmt(left)}</span>
          </>
        ) : (
          <span className="start">⛽ {d.fuelCost}</span>
        )}
      </button>
    </div>
  )
}

// Bubbles over businesses and broken-down cars, pinned to the 3D scene.
export function Badges() {
  const now = useNow()
  const buildings = useGame((s) => s.buildings)
  const cars = useGame((s) => s.cars)
  const mode = useGame((s) => s.mode)
  const visiting = useGame((s) => !!s.visiting)
  const openPanel = useGame((s) => s.openPanel)
  const selectCar = useGame((s) => s.selectCar)
  if (mode !== 'play' || visiting) return null
  return (
    <div className="badges">
      {buildings.filter((b) => buildingDef(b.def).jobSeconds).map((b) => (
        <JobBadge key={b.uid} b={b} now={now} />
      ))}
      {cars.filter((c) => c.flat).map((c) => (
        <div key={c.uid} className="anchor" ref={anchorRef(`car:${c.uid}`)}>
          <button className="badge badge-flat" title={carDef(c.model).name} onClick={() => { selectCar(c.uid); openPanel('flat') }}>
            🛞 Flat!
          </button>
        </div>
      ))}
    </div>
  )
}
