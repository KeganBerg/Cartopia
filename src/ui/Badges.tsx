import { Vector3 } from 'three'
import { useState } from 'react'
import { useGame, buyablePlots, type PlacedBuilding } from '../game/store'
import { buildingDef, buildingLevel, jobLevel, carDef, loves, levelLift, plotPrice, START_LAND, upgradeJobSeconds, isOpen } from '../game/data'
import { msUntilNight } from '../game/clock'
import { anchors, anchorRef } from '../scene/anchors'
import { centerOf, plotCenter } from '../scene/World'
import { useNow } from '../scene/useNow'

function fmt(sec: number) {
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`
  return `${sec}s`
}

function JobBadge({ b, now }: { b: PlacedBuilding; now: number }) {
  const d = buildingDef(b.def)
  const tap = useGame((s) => s.tapBuilding)
  const lit = useGame((s) => !!s.highlight?.includes(b.def))
  // A driver at work: a heart when it loves the place, a wrench when it needs fixing.
  const driver = useGame((s) => (b.car ? s.cars.find((c) => c.uid === b.car) : undefined))
  const [cx, cz] = centerOf(b.def, b.x, b.z, b.rot)
  const lvl = buildingLevel(b)
  anchors.set(b.uid, new Vector3(cx, (d.w > 1 ? 2.6 : 2.2) + levelLift(lvl), cz))
  const ready = b.jobEndsAt !== null && now >= b.jobEndsAt
  const working = b.jobEndsAt !== null && !ready
  const left = working ? Math.ceil((b.jobEndsAt! - now) / 1000) : 0
  const pct = working ? Math.max(0, 1 - left / upgradeJobSeconds(d, jobLevel(b))) : 0
  return (
    <div className="anchor" ref={anchorRef(b.uid)}>
      <button className={`badge ${ready ? 'badge-ready' : working ? 'badge-working' : 'badge-idle'}${lit ? ' badge-pulse' : ''}`} onClick={() => tap(b.uid)} title={d.name}>
        {ready ? (
          <span className="coin">{d.kind === 'obstacle' ? '✔' : '$'}</span>
        ) : working ? (
          <>
            <span className="clock">⏱</span>
            <span className="bar"><span style={{ width: `${pct * 100}%` }} /></span>
            <span className="time">{fmt(left)}</span>
          </>
        ) : !isOpen(d, now) ? (
          <span className="start">🌙 {fmt(Math.max(1, Math.ceil(msUntilNight(now) / 1000)))}</span>
        ) : d.kind === 'obstacle' ? (
          <span className="start">🪓 ${d.price.toLocaleString()}</span>
        ) : (
          <span className="start">⛽ {d.fuelCost}</span>
        )}
        {lvl > 1 && <span className="badge-lvl">{lvl}</span>}
        {driver && <span className={`badge-driver${driver.flat || driver.lowFuel ? ' off' : ''}`}>{driver.flat || driver.lowFuel ? '🔧' : loves(carDef(driver.model), d.id) ? '❤️' : '🚗'}</span>}
      </button>
    </div>
  )
}

// The Crew House shows your clan tag, or invites you to find one.
function CrewBadge({ b }: { b: PlacedBuilding }) {
  const tap = useGame((s) => s.tapBuilding)
  const clan = useGame((s) => s.clanBadge)
  const [cx, cz] = centerOf(b.def, b.x, b.z, b.rot)
  anchors.set(b.uid, new Vector3(cx, 2.6, cz))
  return (
    <div className="anchor" ref={anchorRef(b.uid)}>
      <button className="badge badge-crew" style={clan ? { background: clan.color } : undefined} onClick={() => tap(b.uid)} title="Crew House">
        {clan ? `${clan.emblem} ${clan.tag}` : '🛡️ Find a crew'}
      </button>
    </div>
  )
}

// Rusty's shows what the restore bay is up to.
function RescueBadge({ b, now }: { b: PlacedBuilding; now: number }) {
  const tap = useGame((s) => s.tapBuilding)
  const r = useGame((s) => s.restoring)
  const lit = useGame((s) => !!s.highlight?.includes('rescue'))
  const [cx, cz] = centerOf(b.def, b.x, b.z, b.rot)
  anchors.set(b.uid, new Vector3(cx, 2.6, cz))
  const ready = r && now >= r.endsAt
  return (
    <div className="anchor" ref={anchorRef(b.uid)}>
      <button className={`badge ${ready ? 'badge-ready' : 'badge-rescue'}${lit ? ' badge-pulse' : ''}`} onClick={() => tap(b.uid)} title="Rusty's Rescue">
        {ready ? '🚗 Ready!' : r ? <><span className="clock">🔧</span><span className="time">{fmt(Math.ceil((r.endsAt - now) / 1000))}</span></> : '🔍 Find cars'}
      </button>
    </div>
  )
}

// For-sale signs over the plots next to town while expanding.
function ExpandBadges() {
  const land = useGame((s) => s.land)
  const coins = useGame((s) => s.coins)
  const buy = useGame((s) => s.buyPlot)
  const [pick, setPick] = useState<string | null>(null)
  const price = plotPrice(land.length - START_LAND.length)
  return (
    <>
      {buyablePlots(land).map(([px, pz]) => {
        const k = `${px},${pz}`
        const [cx, cz] = plotCenter(px, pz)
        anchors.set(`plot:${k}`, new Vector3(cx, 0.5, cz))
        return (
          <div key={k} className="anchor" ref={anchorRef(`plot:${k}`)}>
            {pick === k ? (
              <span className="badge badge-sale confirm">
                Buy for ${price.toLocaleString()}?
                <button className="buy small" onClick={() => { buy(px, pz); setPick(null) }}>Yes</button>
                <button className="sell" onClick={() => setPick(null)}>✕</button>
              </span>
            ) : (
              <button className={`badge badge-sale${coins < price ? ' broke' : ''}`} onClick={() => setPick(k)}>🪧 For sale · ${price.toLocaleString()}</button>
            )}
          </div>
        )
      })}
    </>
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
  if (visiting) return null
  if (mode === 'expand') return <div className="badges"><ExpandBadges /></div>
  if (mode !== 'play') return null
  return (
    <div className="badges">
      {buildings.filter((b) => buildingDef(b.def).jobSeconds).map((b) => (
        <JobBadge key={b.uid} b={b} now={now} />
      ))}
      {buildings.filter((b) => b.def === 'rescue').map((b) => (
        <RescueBadge key={b.uid} b={b} now={now} />
      ))}
      {buildings.filter((b) => b.def === 'crew').map((b) => (
        <CrewBadge key={b.uid} b={b} />
      ))}
      {cars.filter((c) => c.flat || c.lowFuel).map((c) => (
        <div key={c.uid} className="anchor" ref={anchorRef(`car:${c.uid}`)}>
          <button className="badge badge-flat" title={carDef(c.model).name} onClick={() => { selectCar(c.uid); openPanel('flat') }}>
            {c.flat ? '🛞 Flat!' : '⛽ No gas!'}
          </button>
        </div>
      ))}
    </div>
  )
}
