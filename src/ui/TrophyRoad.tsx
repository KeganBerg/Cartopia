import { useGame } from '../game/store'
import { PAINTS, patternDef } from '../game/data'
import { ROAD, ROAD_STEP, roadPrize, roadReached, roadTrophies, type RoadPrize } from '../game/trophyRoad'

// Trophy Road screen (game/trophyRoad.ts): a strip of stops, one per ROAD_STEP trophies,
// each showing its prize. Claimed stops are ticked, reached ones glow, the rest are locked.
// The bar's button claims every stop reached.

// Shows the stops up to a few past the last one reached, so the road always has a next goal.
const shown = (reached: number) => Math.max(ROAD.length, reached + 4)

function Prize({ p }: { p: RoadPrize }) {
  if (p.paint) {
    const name = PAINTS.find((x) => x.color === p.paint)?.name
    return <span className="tr-prize" title={name}><i className="pr-swatch" style={{ background: p.paint }} /><small>{name}</small></span>
  }
  if (p.pattern) {
    const pat = patternDef(p.pattern)
    return <span className="tr-prize" title={pat?.name}><i className="tr-ico">🖌️</i><small>{pat?.name}</small></span>
  }
  return <span className="tr-prize"><i className="tr-ico">💰</i><small>${(p.coins ?? 0).toLocaleString()}{p.parts ? ` · ⚙${p.parts}` : ''}</small></span>
}

export function TrophyRoad() {
  const trophies = useGame((s) => s.trophies)
  const claimed = useGame((s) => s.road ?? 0)
  const reached = roadReached(trophies)
  const toNext = roadTrophies(reached) - trophies
  return (
    <div className="tr-road">
      <div className="tr-head">
        <b>🏆 {trophies.toLocaleString()}</b>
        <span className="rm-progress"><i style={{ width: `${((trophies % ROAD_STEP) / ROAD_STEP) * 100}%` }} /></span>
        <small>{toNext} to the next stop</small>
      </div>
      <div className="tr-strip" role="list" aria-label="Trophy Road">
        {Array.from({ length: shown(reached) }, (_, i) => {
          const state = i < claimed ? 'got' : i < reached ? 'ready' : 'locked'
          return (
            <div key={i} role="listitem" className={`tr-stop ${state}`}>
              <b>🏆 {roadTrophies(i)}</b>
              <Prize p={roadPrize(i)} />
              <span className="tr-state" aria-hidden>{state === 'got' ? '✔' : state === 'ready' ? '🎁' : '🔒'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Stops reached but not yet claimed, for the bar's button and the Race menu's dot.
export const roadReady = (trophies: number, claimed: number | undefined) => Math.max(0, roadReached(trophies) - (claimed ?? 0))
