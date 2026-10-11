import { Icon } from './Icon'
import { useGame, currentSeason, tierReady, seasonClaimable } from '../game/store'
import { SEASON_TIERS, STARS_PER_TIER, SEASON_CAR_BUCKS, seasonOf, seasonEndsAt, carDef, seasonSkin, seasonModSkin, type SeasonPrize } from '../game/data'
import { Panel } from './Menus'
import { CarThumb } from '../scene/BuildingPreview'
import { useNow } from '../scene/useNow'

export function SeasonButton() {
  const ready = useGame(seasonClaimable)
  return (
    <button className="goals-btn" onClick={() => useGame.getState().openPanel('season')} title="Season">
      <Icon name="star" />{ready > 0 && <span className="goal-badge">{ready}</span>}
    </button>
  )
}

const left = (ms: number) => {
  const h = Math.max(1, Math.ceil(ms / 3600000))
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`
}

function Prize({ p, car, tier }: { p: SeasonPrize; car?: string; tier: number }) {
  if (p.car && car) return <span className="tier-prize">🚗</span>
  const bucks = p.bucks + (p.car ? SEASON_CAR_BUCKS : 0)
  const skin = seasonSkin(tier) ?? seasonModSkin(tier)
  return (
    <span className="tier-prize">
      {skin && <i className="tier-skin" style={{ background: skin.swatch }} title={`${skin.name} skin`} />}
      {!!p.coins && <><i className="coin-ico ico">$</i>{p.coins >= 1000 ? `${(p.coins / 1000).toFixed(p.coins % 1000 ? 1 : 0)}k` : p.coins}</>}
      {!!p.parts && <><i className="parts-ico ico">⚙</i>{p.parts}</>}
      {!!bucks && <><i className="buck-ico ico">💎</i>{bucks}</>}
    </span>
  )
}

export function SeasonPanel() {
  const s = useGame()
  const now = useNow()
  const p = currentSeason(s, now)
  const def = seasonOf(p.n)
  const car = def.car ? carDef(def.car) : null
  const tier = Math.min(SEASON_TIERS.length, Math.floor(p.stars / STARS_PER_TIER))
  const into = tier >= SEASON_TIERS.length ? STARS_PER_TIER : p.stars % STARS_PER_TIER
  const gotCar = !!car && p.claimed.includes(SEASON_TIERS.length - 1)
  return (
    <Panel title={`${def.icon} ${def.name}`}>
      <div className="season-head">
        {car && (
          <div className={gotCar ? 'season-car got' : 'season-car'}>
            <CarThumb size="sm" color={car.colors[0]} body={car.body} />
            <div>
              <b>{car.name}</b>
              <small>{gotCar ? 'Yours! ✔' : `Tier ${SEASON_TIERS.length} prize · season only`}</small>
            </div>
          </div>
        )}
        <div className="season-progress">
          <span>⭐ {p.stars} · Tier {tier}/{SEASON_TIERS.length}</span>
          <div className="bar"><span style={{ width: `${(into / STARS_PER_TIER) * 100}%` }} /></div>
          <small>Ends in {left(seasonEndsAt(p.n) - now)} · earn ⭐ from daily and weekly tasks</small>
        </div>
      </div>
      <div className="tiers">
        {SEASON_TIERS.map((prize, i) => {
          const claimed = p.claimed.includes(i)
          const ready = tierReady(p, i)
          return (
            <button key={i} className={`tier${claimed ? ' claimed' : ready ? ' ready' : ''}${prize.car ? ' final' : ''}`}
              disabled={!ready} onClick={() => s.claimTier(i)}>
              <small>{i + 1}</small>
              <Prize p={prize} car={def.car} tier={i + 1} />
              {claimed ? <em>✔</em> : ready ? <em>Collect</em> : null}
            </button>
          )
        })}
      </div>
      <button className="buy alt" onClick={() => s.openPanel('goals')}>📋 Go to tasks</button>
    </Panel>
  )
}
