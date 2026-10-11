import { Vector3 } from 'three'
import { useMemo, useState, type CSSProperties } from 'react'
import { useGame, buyablePlots, today, type PlacedBuilding } from '../game/store'
import { buildingDef, buildingLevel, jobLevel, carDef, loves, levelLift, plotPrice, START_LAND, upgradeJobSeconds, isOpen } from '../game/data'
import { msUntilNight } from '../game/clock'
import { anchors, anchorRef } from '../scene/anchors'
import { centerOf, groupCenter, plotCenter } from '../scene/World'
import { mergeGroups, mergeCandidates, type MergeGroup } from '../game/merge'
import { useNow } from '../scene/useNow'
import { tutTarget } from './Tutorial'
import { helpable, helpAct, askingForHelp } from '../game/help'
import { useHelp, helpsLeft, helpBuilding } from '../lib/help'

function fmt(sec: number) {
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`
  return `${sec}s`
}
// Phones show only the biggest unit, next to a progress ring.
const short = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)}h` : sec >= 60 ? `${Math.ceil(sec / 60)}m` : `${sec}s`)

// Badge height over a merged block: as tall as its model grows (see groupScale).
const lift = (g: MergeGroup) => (g.cols === g.rows ? g.cols : 1)

// `g` and `members` are the whole block for a merged business: one badge for all of it.
function JobBadge({ b, now, g, members = [b] }: { b: PlacedBuilding; now: number; g?: MergeGroup; members?: PlacedBuilding[] }) {
  const d = buildingDef(b.def)
  const tap = useGame((s) => s.tapBuilding)
  const lit = useGame((s) => !!s.highlight?.includes(b.def) || (b.def === 'pizza' && tutTarget(s) === 'pizza'))
  // A driver at work: a heart when it loves the place, a wrench when it needs fixing.
  const driver = useGame((s) => (b.car ? s.cars.find((c) => c.uid === b.car) : undefined))
  const n = members.length
  const k = g ? lift(g) : 1
  const [cx, cz] = g ? groupCenter(g) : centerOf(b.def, b.x, b.z, b.rot)
  const lvl = buildingLevel(b)
  anchors.set(b.uid, new Vector3(cx, ((d.w > 1 ? 2.6 : 2.2) + levelLift(lvl)) * k, cz))
  const ready = members.some((o) => o.jobEndsAt !== null && now >= o.jobEndsAt)
  const idle = members.filter((o) => o.jobEndsAt === null).length
  const working = !ready && !idle
  const end = Math.max(...members.map((o) => o.jobEndsAt ?? 0))
  const left = working ? Math.ceil((end - now) / 1000) : 0
  const pct = working ? Math.max(0, 1 - left / upgradeJobSeconds(d, jobLevel(b))) : 0
  return (
    <div className="anchor" ref={anchorRef(b.uid)}>
      <button className={`badge ${ready ? 'badge-ready' : working ? 'badge-working' : 'badge-idle'}${lit ? ' badge-pulse' : ''}`} onClick={() => tap(b.uid)} title={d.name}>
        {ready ? (
          <span className="coin">{d.kind === 'obstacle' ? '✔' : '$'}</span>
        ) : working ? (
          <>
            <span className="clock" style={{ '--p': `${pct * 360}deg` } as CSSProperties}>⏱</span>
            <span className="bar"><span style={{ width: `${pct * 100}%` }} /></span>
            <span className="time">{fmt(left)}</span>
            <span className="time-short">{short(left)}</span>
          </>
        ) : !isOpen(d, now) ? (
          <span className="start">🌙 {fmt(Math.max(1, Math.ceil(msUntilNight(now) / 1000)))}</span>
        ) : d.kind === 'obstacle' ? (
          <span className="start">🪓 ${d.price.toLocaleString()}</span>
        ) : (
          <span className="start">⛽ {(d.fuelCost ?? 0) * idle}</span>
        )}
        {n > 1 && <span className="badge-merge">×{n}</span>}
        {lvl > 1 && <span className="badge-lvl">{lvl}</span>}
        {driver && <span className={`badge-driver${driver.flat || driver.lowFuel ? ' off' : ''}`}>{driver.flat || driver.lowFuel ? '🔧' : loves(carDef(driver.model), d.id) ? '❤️' : '🚗'}</span>}
      </button>
    </div>
  )
}

// Merge tool: a puzzle piece over every square of four matching buildings, and
// scissors over every merged one.
function MergeBadges() {
  const buildings = useGame((s) => s.buildings)
  const merge = useGame((s) => s.mergeBlock)
  const split = useGame((s) => s.splitBlock)
  const rotate = useGame((s) => s.rotateBlock)
  const { merges, candidates } = useMemo(() => {
    const merges = mergeGroups(buildings)
    return { merges, candidates: mergeCandidates(buildings, merges) }
  }, [buildings])
  const pin = (id: string, g: MergeGroup, y: number) => {
    const [cx, cz] = groupCenter(g)
    anchors.set(id, new Vector3(cx, y, cz))
    return anchorRef(id)
  }
  return (
    <>
      {candidates.map((c) => (
        <div key={`m:${c.anchor.uid}:${c.code}`} className="anchor" ref={pin(`m:${c.anchor.uid}:${c.code}`, c, 1.2 * lift(c))}>
          <button className={`badge badge-merge-go${c.members.length === 2 ? ' pair' : ''}`} onClick={() => merge(c.anchor.uid, c.code)} title={`Merge ${c.members.length} ${buildingDef(c.anchor.def).name}`}>
            🧩 Merge ×{c.members.length}
          </button>
        </div>
      ))}
      {[...merges.groups.values()].map((g) => (
        <div key={`s:${g.anchor.uid}`} className="anchor" ref={pin(`s:${g.anchor.uid}`, g, 0.6 * lift(g))}>
          <span className="merge-tools">
            <button className="badge badge-split" onClick={() => rotate(g.anchor.uid)} title="Turn it">🔄</button>
            <button className="badge badge-split" onClick={() => split(g.anchor.uid)} title="Split it back up">✂️ Split</button>
          </span>
        </div>
      ))}
    </>
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

// The arcade games live in the Pixel Palace: a joystick over each one you own opens them.
// A merged block gets one, over its middle, like its job badge.
function ArcadeBadge({ b, g }: { b: PlacedBuilding; g?: MergeGroup }) {
  const open = useGame((s) => s.openPanel)
  const k = g ? lift(g) : 1
  const [cx, cz] = g ? groupCenter(g) : centerOf(b.def, b.x, b.z, b.rot)
  const id = `arc:${b.uid}`
  anchors.set(id, new Vector3(cx, (3.3 + levelLift(buildingLevel(b))) * k, cz))
  return (
    <div className="anchor" ref={anchorRef(id)}>
      <button className="badge badge-arcade" onClick={() => open('arcade')} title="Arcade games" aria-label="Arcade games">🕹️</button>
    </div>
  )
}

// Rusty's shows what the restore bay is up to.
function RescueBadge({ b, now }: { b: PlacedBuilding; now: number }) {
  const tap = useGame((s) => s.tapBuilding)
  const r = useGame((s) => s.restoring)
  const lit = useGame((s) => !!s.highlight?.includes('rescue') || tutTarget(s) === 'rescue')
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

// In a friend's town: a small action bubble over each business you can still help today,
// and a tick over the ones you have.
function HelpBadges() {
  const town = useGame((s) => s.visiting)
  const h = useHelp()
  const buildings = town?.buildings
  const owner = town?.ownerId ?? ''
  const day = today()
  const merges = useMemo(() => mergeGroups(buildings ?? []), [buildings])
  const asking = useMemo(
    () => new Set(askingForHelp((buildings ?? []).filter((b) => helpable(buildingDef(b.def)) && (!merges.owner.has(b.uid) || merges.groups.has(b.uid))), owner, day).map((b) => b.uid)),
    [buildings, merges, owner, day],
  )
  if (!town || !buildings || h.owner !== town.ownerId) return null
  const left = helpsLeft(h)
  return (
    <div className="badges">
      {buildings.filter((b) => asking.has(b.uid) || h.done.includes(b.uid)).map((b) => {
        const done = h.done.includes(b.uid)
        if (!done && !left) return null
        const d = buildingDef(b.def)
        const g = merges.groups.get(b.uid)
        const k = g ? lift(g) : 1
        const [cx, cz] = g ? groupCenter(g) : centerOf(b.def, b.x, b.z, b.rot)
        anchors.set(b.uid, new Vector3(cx, ((d.w > 1 ? 2.6 : 2.2) + levelLift(buildingLevel(b))) * k, cz))
        const act = helpAct(b.def)
        return (
          <div key={b.uid} className="anchor" ref={anchorRef(b.uid)}>
            {done ? (
              <span className="badge badge-helped" title={`Helped ${d.name}`}>✔</span>
            ) : (
              <button className={`badge badge-help${h.busy === b.uid ? ' busy' : ''}`} title={`Help at ${d.name}`} onClick={(e) => helpBuilding(b.uid, e.currentTarget)}>
                <span className="help-icon">{act.icon}</span>
              </button>
            )}
          </div>
        )
      })}
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
  const mergeKey = buildings.map((b) => `${b.uid}:${b.x}:${b.z}:${b.rot ?? ''}:${b.level ?? 1}:${b.merge ?? ''}`).join()
  const merges = useMemo(() => mergeGroups(buildings), [mergeKey]) // eslint-disable-line react-hooks/exhaustive-deps
  if (visiting) return <HelpBadges />
  if (mode === 'expand') return <div className="badges"><ExpandBadges /></div>
  if (mode === 'merge') return <div className="badges"><MergeBadges /></div>
  if (mode !== 'play') return null
  return (
    <div className="badges">
      {buildings.filter((b) => buildingDef(b.def).jobSeconds && (!merges.owner.has(b.uid) || merges.groups.has(b.uid))).map((b) => {
        // Members come from the live list so their timers stay current.
        const g = merges.groups.get(b.uid)
        return <JobBadge key={b.uid} b={b} now={now} g={g} members={g ? buildings.filter((o) => merges.owner.get(o.uid) === b.uid) : undefined} />
      })}
      {buildings.filter((b) => b.def === 'arcade' && (!merges.owner.has(b.uid) || merges.groups.has(b.uid))).map((b) => (
        <ArcadeBadge key={`arc:${b.uid}`} b={b} g={merges.groups.get(b.uid)} />
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
