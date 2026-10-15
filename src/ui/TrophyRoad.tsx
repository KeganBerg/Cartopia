import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { PAINTS, carDef, patternDef } from '../game/data'
import { raceCarOf } from '../game/raceCar'
import { MYSTERY_EVERY, ROAD_STEP, roadMystery, roadPay, roadReached, roadTrophies } from '../game/trophyRoad'
import { CarThumb } from '../scene/BuildingPreview'
import { CoinIcon, PartsIcon } from './Icon'
import { PatternSwatch } from './Custom'

// Trophy Road screen (game/trophyRoad.ts): a road winding down the screen with a milestone at
// every ROAD_STEP trophies. Each milestone's prize card sits beside it: coins and parts, and a
// gift on the mystery stops (the paint or pattern it gave, once claimed). The player's race car
// sits on the road at their trophy count. Claimed milestones are green and ticked, reached ones
// gold, the rest grey and locked. The bar's button claims every milestone reached.

const AHEAD = 12
const BEHIND = 6
// Height of one milestone's stretch of road, and the space above the first.
const ROW = 104
const TOP = 120
// One empty list for a save with no road cosmetics yet (a fresh `[]` in the selector would re-render for ever).
const NONE: string[] = []

type Pt = { x: number; y: number }
// The road bends between milestones: down from one, across, and into the next.
const bend = (a: Pt, b: Pt) => `C ${a.x} ${a.y + ROW / 2} ${b.x} ${b.y - ROW / 2} ${b.x} ${b.y}`
// The first t of the bend from a to b (de Casteljau), as a path command, and where it ends.
function part(a: Pt, b: Pt, t: number): { d: string; to: Pt } {
  const c1 = { x: a.x, y: a.y + ROW / 2 }
  const c2 = { x: b.x, y: b.y - ROW / 2 }
  const mix = (p: Pt, q: Pt) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
  const p1 = mix(a, c1), p2 = mix(c1, c2), p3 = mix(c2, b)
  const q1 = mix(p1, p2), q2 = mix(p2, p3)
  const to = mix(q1, q2)
  return { d: `C ${p1.x} ${p1.y} ${q1.x} ${q1.y} ${to.x} ${to.y}`, to }
}

// What a mystery stop gave: a colour or a pattern.
function Item({ id }: { id: string }) {
  const paint = PAINTS.find((p) => p.color === id)
  if (paint) return <i className="tr-won" style={{ background: id }} title={paint.name} />
  return <span className="tr-won pat" title={patternDef(id)?.name}><PatternSwatch id={id} color="#ffb300" /></span>
}

export function TrophyRoad() {
  const trophies = useGame((s) => s.trophies)
  const claimed = useGame((s) => s.road ?? 0)
  const items = useGame((s) => s.roadItems) ?? NONE
  const car = useGame((s) => raceCarOf(s.cars, s.raceCar))
  const reached = roadReached(trophies)
  const toNext = roadTrophies(reached) - trophies
  // The last few stops claimed and the next ones. Mystery stops claimed line up, in order, with the items they gave.
  const from = Math.max(0, Math.min(claimed, reached) - BEHIND)
  const stops = Array.from({ length: Math.max(reached, claimed) + AHEAD - from }, (_, k) => from + k)
  const gave = (i: number) => (roadMystery(i) && i < claimed ? items[Math.floor(i / MYSTERY_EVERY)] : undefined)

  const map = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(360)
  useLayoutEffect(() => {
    const el = map.current
    if (!el) return
    const fit = () => setW(el.clientWidth || 360)
    fit()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])

  // Milestones zig-zag between the left and right of the screen; the prize sits on the other side.
  const left = (i: number) => i % 2 === 0
  const at = (i: number): Pt => ({ x: w * (left(i) ? 0.25 : 0.75), y: TOP + (i - from) * ROW })
  const start: Pt = { x: w / 2, y: 0 }
  const end = stops.length ? at(stops[stops.length - 1]) : start
  const road = useMemo(() => {
    let d = `M ${start.x} ${start.y} ` + (stops.length ? bend(start, at(stops[0])) : '')
    for (let k = 1; k < stops.length; k++) d += ' ' + bend(at(stops[k - 1]), at(stops[k]))
    return d + ` L ${end.x} ${end.y + ROW * 0.6}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, from, stops.length])
  // Where the car is, in milestones (milestone i sits at (i + 1) * ROAD_STEP trophies), and the
  // road driven to get there, drawn over in gold.
  const last = stops[stops.length - 1] ?? from
  const pos = Math.min(last, trophies / ROAD_STEP - 1)
  const { driven, me } = useMemo(() => {
    let d = `M ${start.x} ${start.y}`
    let prev = start
    for (const i of stops) {
      if (i > pos) break
      d += ' ' + bend(prev, at(i))
      prev = at(i)
    }
    const k = Math.floor(pos)
    const t = k < from ? Math.max(0, pos - (from - 1)) : pos - k
    const nextAt = k < from ? at(from) : at(k + 1)
    if (t <= 0 || k >= last) return { driven: d, me: prev }
    const cut = part(prev, nextAt, t)
    return { driven: `${d} ${cut.d}`, me: cut.to }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, from, stops.length, pos])

  // Opens with the car in view.
  const scroller = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = Math.max(0, me.y - el.clientHeight * 0.4)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w])

  const next = roadPay(reached)
  return (
    <div className="tr-road">
      <div className="tr-head">
        <b className="tr-count">🏆 {trophies.toLocaleString()}</b>
        <span className="tr-bar"><i style={{ width: `${((trophies % ROAD_STEP) / ROAD_STEP) * 100}%` }} /><em>{toNext} to go</em></span>
        <span className="tr-next" title="Next prize">{roadMystery(reached) ? '🎁' : <><CoinIcon size={20} />{next.coins.toLocaleString()}</>}</span>
      </div>
      <div className="tr-scroll" ref={scroller}>
        <div className="tr-map" ref={map} style={{ height: end.y + ROW * 0.6 }} role="list" aria-label="Trophy Road">
          <svg className="tr-svg" width={w} height={end.y + ROW * 0.6} aria-hidden>
            <path d={road} className="tr-edge" />
            <path d={road} className="tr-asphalt" />
            <path d={road} className="tr-dash" />
            <path d={driven} className="tr-driven" />
          </svg>
          {stops.map((i) => {
            const state = i < claimed ? 'got' : i < reached ? 'ready' : 'locked'
            const pay = roadPay(i)
            const box = roadMystery(i)
            const won = gave(i)
            const p = at(i)
            return (
              <div key={i} role="listitem" className={`tr-stop ${state}${box ? ' mystery' : ''} ${left(i) ? 'l' : 'r'}`} style={{ top: p.y }}>
                <span className="tr-node" style={{ left: p.x }}>
                  <b>{roadTrophies(i)}</b>
                  {state !== 'ready' && <i className="tr-badge" aria-hidden>{state === 'got' ? '✔' : '🔒'}</i>}
                </span>
                <span className="tr-card">
                  {box && <span className="tr-gift">{won ? <Item id={won} /> : <i>🎁</i>}</span>}
                  <span className="tr-pay">
                    <span><CoinIcon size={22} />{pay.coins.toLocaleString()}</span>
                    <span><PartsIcon size={22} />{pay.parts}</span>
                  </span>
                </span>
              </div>
            )
          })}
          {car && (
            <div className={Math.abs(pos - Math.round(pos)) < 0.3 && pos >= from - 0.3 ? "tr-car on-node" : "tr-car"} style={{ left: me.x, top: Math.max(me.y, 112) }} aria-label={`${trophies} trophies`}>
              <CarThumb size="xs" color={car.color} finish={car.finish} skin={car.skin} modSkin={car.modSkin} panels={car.panels} trim={car.trim} hat={car.hat} body={carDef(car.model).body} model={car.model} stripe={car.stripe} mods={car.mods} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Stops reached but not yet claimed, for the bar's button and the Race menu's dot.
export const roadReady = (trophies: number, claimed: number | undefined) => Math.max(0, roadReached(trophies) - (claimed ?? 0))
