import { useMemo, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { carDef } from '../game/data'
import { raceCarOf } from '../game/raceCar'
import { ROAD_STEP, roadMystery, roadPay, roadReached, roadTrophies } from '../game/trophyRoad'
import { StageSlot } from '../scene/Stage'
import { ROAD_FIRST, ROAD_GAP, TrophyRoadScene, type Milestone, type RoadView } from '../scene/TrophyRoadScene'
import { CoinIcon } from './Icon'

// Trophy Road screen (game/trophyRoad.ts), drawn on the Main Street drag strip
// (scene/TrophyRoadScene.tsx): a gantry over the road at every ROAD_STEP trophies with its
// prize on the sign, a gift on the mystery ones, and the player's race car on the road at
// their trophy count. Drag the road (or tap a milestone below it) to look along it.
// Green and ticked: claimed. Gold: reached, waiting to be claimed. Grey: locked.
// The bar's button claims every milestone reached.

const BEHIND = 1
const SHOWN = 11
const ROAD_CAM = { position: [1.1, 3.1, -4] as [number, number, number], fov: 55, near: 0.3, far: 150 }

export function TrophyRoad() {
  const trophies = useGame((s) => s.trophies)
  const claimed = useGame((s) => s.road ?? 0)
  const car = useGame((s) => raceCarOf(s.cars, s.raceCar))
  const reached = roadReached(trophies)
  const toNext = roadTrophies(reached) - trophies
  // The milestones on the strip: one behind the first unclaimed, then the ones ahead.
  const from = Math.max(0, Math.min(claimed, reached) - BEHIND)
  const stops = useMemo<Milestone[]>(() => Array.from({ length: SHOWN }, (_, k) => {
    const i = from + k
    const pay = roadPay(i)
    return { trophies: roadTrophies(i), coins: pay.coins, parts: pay.parts, state: i < claimed ? 'got' : i < reached ? 'ready' : 'locked', gift: roadMystery(i) && i >= claimed }
  }), [from, claimed, reached])
  // Milestone i is at (i + 1) * ROAD_STEP trophies; the car sits that far along the strip.
  const zOf = (u: number) => ROAD_FIRST + (u - from) * ROAD_GAP
  const end = zOf(from + SHOWN - 1)
  const carZ = Math.max(0.5, Math.min(end, zOf(trophies / ROAD_STEP - 1)))
  const view = useRef<RoadView>({ z: carZ })
  const [at, setAt] = useState(carZ)
  const look = (z: number) => {
    view.current.z = Math.max(0, Math.min(end, z))
    setAt(view.current.z)
  }
  // Drag along the road: up or left goes further along it.
  const drag = useRef<{ x: number; y: number; z: number } | null>(null)
  const mine = useMemo(() => car && ({ body: carDef(car.model).body, model: car.model, color: car.color, finish: car.finish, skin: car.skin, modSkin: car.modSkin, panels: car.panels, mods: car.mods, trim: car.trim, hat: car.hat }), [car])
  const scene = useMemo(() => mine && <TrophyRoadScene stops={stops} carZ={carZ} car={mine} view={view} />, [stops, carZ, mine, view])
  const next = roadPay(reached)
  const near = Math.round((at - ROAD_FIRST) / ROAD_GAP) + from
  return (
    <div className="tr-road">
      <div className="tr-head">
        <b className="tr-count">🏆 {trophies.toLocaleString()}</b>
        <span className="tr-bar"><i style={{ width: `${((trophies % ROAD_STEP) / ROAD_STEP) * 100}%` }} /><em>{toNext} to go</em></span>
        <span className="tr-next" title="Next prize">{roadMystery(reached) ? '🎁' : <><CoinIcon size={20} />{next.coins.toLocaleString()}</>}</span>
      </div>
      <div
        className="tr-scene"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, z: view.current.z }
          e.currentTarget.setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (d) look(d.z + (d.y - e.clientY + (d.x - e.clientX)) * 0.04)
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onWheel={(e) => look(view.current.z + e.deltaY * 0.01)}
      >
        {scene && <StageSlot cam={ROAD_CAM} through>{scene}</StageSlot>}
      </div>
      <div className="tr-chips" role="list" aria-label="Trophy Road">
        {stops.map((m, k) => (
          <button key={m.trophies} role="listitem" className={`tr-stop ${m.state}${from + k === near ? ' on' : ''}`} onClick={() => look(zOf(from + k))} aria-label={`${m.trophies} trophies`}>
            {m.gift && <i aria-hidden>🎁</i>}
            <b>{m.trophies}</b>
          </button>
        ))}
      </div>
    </div>
  )
}

// Stops reached but not yet claimed, for the bar's button and the Race menu's dot.
export const roadReady = (trophies: number, claimed: number | undefined) => Math.max(0, roadReached(trophies) - (claimed ?? 0))
