import { useGame } from '../game/store'
import { PAINTS, patternDef } from '../game/data'
import { MYSTERY_EVERY, ROAD_STEP, roadMystery, roadPay, roadReached, roadTrophies } from '../game/trophyRoad'

// Trophy Road screen (game/trophyRoad.ts): a strip of stops, one per ROAD_STEP trophies, each
// showing its coins and parts, and 🎁 on the mystery stops (the cosmetic it gave, once claimed).
// Claimed stops are ticked, reached ones glow, the rest are locked. The bar's button claims
// every stop reached.

const AHEAD = 12
const BEHIND = 6
// One empty list for a save with no road cosmetics yet (a fresh `[]` in the selector would re-render for ever).
const NONE: string[] = []

// What a mystery stop gave: a colour swatch or a pattern name.
function Item({ id }: { id: string }) {
  const paint = PAINTS.find((p) => p.color === id)
  if (paint) return <i className="pr-swatch tr-item" style={{ background: id }} title={paint.name} />
  return <i className="tr-ico" title={patternDef(id)?.name}>🖌️</i>
}

export function TrophyRoad() {
  const trophies = useGame((s) => s.trophies)
  const claimed = useGame((s) => s.road ?? 0)
  const items = useGame((s) => s.roadItems) ?? NONE
  const reached = roadReached(trophies)
  const toNext = roadTrophies(reached) - trophies
  // The last few stops claimed and the next ones. Mystery stops claimed line up, in order, with the items they gave.
  const from = Math.max(0, Math.min(claimed, reached) - BEHIND)
  const stops = Array.from({ length: Math.max(reached, claimed) + AHEAD - from }, (_, k) => from + k)
  const gave = (i: number) => (roadMystery(i) && i < claimed ? items[Math.floor(i / MYSTERY_EVERY)] : undefined)
  return (
    <div className="tr-road">
      <div className="tr-head">
        <b>🏆 {trophies.toLocaleString()}</b>
        <span className="rm-progress"><i style={{ width: `${((trophies % ROAD_STEP) / ROAD_STEP) * 100}%` }} /></span>
        <small>🏆 {toNext} ▸ 🎁</small>
      </div>
      <div className="tr-strip" role="list" aria-label="Trophy Road">
        {stops.map((i) => {
          const state = i < claimed ? 'got' : i < reached ? 'ready' : 'locked'
          const pay = roadPay(i)
          const box = roadMystery(i)
          const won = gave(i)
          return (
            <div key={i} role="listitem" className={`tr-stop ${state}${box ? ' mystery' : ''}`}>
              <b>🏆 {roadTrophies(i)}</b>
              <span className="tr-prize">
                {box && (won ? <Item id={won} /> : <i className="tr-ico">🎁</i>)}
                <small>${pay.coins.toLocaleString()} · ⚙{pay.parts}</small>
              </span>
              <span className="tr-state" aria-hidden>{state === 'got' ? '✔' : state === 'ready' ? '✨' : '🔒'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Stops reached but not yet claimed, for the bar's button and the Race menu's dot.
export const roadReady = (trophies: number, claimed: number | undefined) => Math.max(0, roadReached(trophies) - (claimed ?? 0))
