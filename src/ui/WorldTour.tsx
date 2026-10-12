import { useGame } from '../game/store'
import { raceCarOf } from '../game/raceCar'
import { CARS, carDef } from '../game/data'
import { DIST } from '../game/distance'
import { REP_TITLES } from '../game/reputation'
import { TOUR_BLUE, WORLD_TOUR, WORLD_TOUR_REP, worldDone, worldPrize } from '../game/worldTour'
import { venue as venueById } from '../scene/venues'
import { CarThumb } from '../scene/BuildingPreview'
import { openGarageTab } from './Menus'
import { useRep } from './Reputation'

// World Tour screen (game/worldTour.ts): the nine countries in order, each beaten one ticked,
// the next one with its racer's hello and a race button, and Tour Blue as the final prize.

export const worldChip = (beaten: number | undefined) => `🌍 ${Math.min(beaten ?? 0, WORLD_TOUR.length)}/${WORLD_TOUR.length}`

export function WorldTour({ onRace }: { onRace: (i: number) => void }) {
  const beaten = useGame((s) => s.worldTour ?? 0)
  const cars = useGame((s) => s.cars)
  const raceCar = useGame((s) => s.raceCar)
  const rep = useRep()
  const open = rep.tier >= WORLD_TOUR_REP
  const done = worldDone(beaten)
  const car = raceCarOf(cars, raceCar)
  const d = car ? carDef(car.model) : CARS[0]
  const need = REP_TITLES[WORLD_TOUR_REP]
  return (
    <div className="wt">
      <div className={`ev-reward pr-reward${done ? ' got' : ''}`}>
        <div className="ev-reward-car">
          <CarThumb size="lg" color={TOUR_BLUE} finish={car?.finish} body={d.body} model={d.id} stripe={car?.stripe} mods={car?.mods} />
          <span className="ev-reward-state">{done ? '✔' : '🔒'}</span>
        </div>
        <div className="ev-reward-info">
          <b>Tour Blue</b>
          <span className="ev-reward-chips"><i className="pr-swatch" style={{ background: TOUR_BLUE }} /><em>🎨 Only from the World Tour</em></span>
          {done && car && <button className="buy small" onClick={() => openGarageTab('paint', { car: car.uid, color: TOUR_BLUE })}>🎨 Paint it</button>}
        </div>
      </div>
      {!open && <p className="wt-gate">{need.icon} Reach <b>{need.name}</b> to start the tour ({rep.toNext.toLocaleString()} reputation to go)</p>}
      <ol className="wt-list">
        {WORLD_TOUR.map((r, i) => {
          const won = i < beaten
          const next = i === beaten
          const v = venueById(r.venue)
          return (
            <li key={r.country} className={`wt-stop${won ? ' done' : next ? ' next' : ' locked'}`}>
              <span className="wt-flag" aria-hidden>{r.flag}</span>
              <span className="wt-info">
                <b>{r.country} · {r.name}</b>
                <small>{v.icon} {v.name}{r.night ? ' · 🌙' : ''} · {DIST[r.dist].label} · PI {r.pi}</small>
                {(won || next) && <i className="wt-line">“{won ? r.beaten : r.hello}”</i>}
              </span>
              {won ? (
                <button className="buy small alt" disabled={!open} onClick={() => onRace(i)}>↻ ${worldPrize(i, false).toLocaleString()}</button>
              ) : next ? (
                <button className="buy small" disabled={!open} onClick={() => onRace(i)}>🏁 ${worldPrize(i, true).toLocaleString()}</button>
              ) : (
                <span className="wt-lock" aria-label="Locked">🔒</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
