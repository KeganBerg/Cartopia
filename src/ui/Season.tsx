import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, CoinIcon, BuckIcon, PartsIcon } from './Icon'
import { useGame, currentSeason, tierReady, seasonClaimable } from '../game/store'
import { seasonNumber, SEASON_TIERS, STARS_PER_TIER, SEASON_CAR_BUCKS, seasonOf, seasonEndsAt, carDef, seasonSkin, seasonModSkin } from '../game/data'
import { raceCarOf } from '../game/raceCar'
import { Panel } from './Menus'
import { StageSlot } from '../scene/Stage'
import { PASS_FIRST, PASS_GAP, SeasonScene, type PassView, type Tier } from '../scene/SeasonScene'
import { useNow } from '../scene/useNow'
import './season.css'

export function SeasonButton() {
  const ready = useGame(seasonClaimable)
  return (
    <button className="goals-btn" onClick={() => useGame.getState().openPanel('season')} title="Star Pass">
      <Icon name="star" />{ready > 0 && <span className="goal-badge">{ready}</span>}
    </button>
  )
}

const left = (ms: number) => {
  const h = Math.max(1, Math.ceil(ms / 3600000))
  return h >= 24 ? `${Math.floor(h / 24)}d` : `${h}h`
}

const PASS_CAM = { position: [4.4, 5, -4] as [number, number, number], fov: 55, near: 0.3, far: 150 }
const zOf = (i: number) => PASS_FIRST + i * PASS_GAP

// Star Pass: stars from daily and weekly tasks unlock a tier every STARS_PER_TIER, drawn as arches
// over Main Street at night (scene/SeasonScene.tsx) with the season's car at the finish line.
// Drag the road, or tap a tier below it, to look along it. The button collects every tier reached.
export function SeasonPanel() {
  const season = useGame((s) => s.season)
  const car = useGame((s) => raceCarOf(s.cars, s.raceCar))
  const now = useNow()
  // Only changes when the save or the season does, so the scene isn't redrawn every tick of the clock.
  const n = seasonNumber(now)
  const p = useMemo(() => currentSeason({ season }, seasonEndsAt(n) - 1), [season, n])
  const def = seasonOf(p.n)
  const prizeCar = def.car ? carDef(def.car) : null
  const last = SEASON_TIERS.length - 1
  const reached = Math.min(SEASON_TIERS.length, Math.floor(p.stars / STARS_PER_TIER))
  const into = reached >= SEASON_TIERS.length ? STARS_PER_TIER : p.stars % STARS_PER_TIER
  const ready = SEASON_TIERS.map((_, i) => i).filter((i) => tierReady(p, i))
  const tiers = useMemo<Tier[]>(() => SEASON_TIERS.map((prize, i) => {
    const skin = seasonSkin(i + 1) ?? seasonModSkin(i + 1)
    const got = p.claimed.includes(i)
    return {
      n: i + 1, coins: prize.coins, parts: prize.parts, gems: prize.bucks + (prize.car && !prizeCar ? SEASON_CAR_BUCKS : 0),
      skin: skin?.swatch, car: prize.car && prizeCar ? prizeCar.name : undefined,
      state: got ? 'got' : p.stars >= (i + 1) * STARS_PER_TIER ? 'ready' : 'locked',
    }
  }), [p, prizeCar])
  // The car sits between the last tier reached and the next, as far as its stars go.
  const carZ = Math.max(0.5, Math.min(zOf(last), zOf(p.stars / STARS_PER_TIER - 1)))
  const firstOpen = ready[0] ?? Math.min(last, reached)
  const start = Math.max(0, Math.min(carZ - PASS_GAP, zOf(firstOpen)))
  const view = useRef<PassView>({ z: start })
  const [at, setAt] = useState(start)
  const look = (z: number) => {
    view.current.z = Math.max(0, Math.min(zOf(last), z))
    setAt(view.current.z)
  }
  const drag = useRef<{ x: number; y: number; z: number } | null>(null)
  const mine = useMemo(() => car && ({ body: carDef(car.model).body, model: car.model, color: car.color, finish: car.finish, skin: car.skin, modSkin: car.modSkin, panels: car.panels, mods: car.mods, trim: car.trim, hat: car.hat }), [car])
  const prize = useMemo(() => prizeCar && { body: prizeCar.body, model: prizeCar.id, color: prizeCar.colors[0] }, [prizeCar])
  const scene = useMemo(() => mine && <SeasonScene tiers={tiers} carZ={carZ} car={mine} prize={prize} view={view} />, [tiers, carZ, mine, prize, view])
  const near = Math.round((at - PASS_FIRST) / PASS_GAP)
  // Keeps the tier being looked at in the middle of the chip row.
  const chips = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = chips.current
    const on = row?.children[Math.max(0, near)] as HTMLElement | undefined
    if (row && on) row.scrollTo({ left: on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth) / 2 })
  }, [near])
  const collect = () => {
    for (const i of ready) useGame.getState().claimTier(i)
  }
  return (
    <Panel title="⭐ Star Pass" className="star-pass">
      <div className="sp-head">
        <b className="sp-count">⭐ {p.stars}</b>
        <span className="sp-bar"><i style={{ width: `${(into / STARS_PER_TIER) * 100}%` }} /><em>{reached >= SEASON_TIERS.length ? 'Max' : `${STARS_PER_TIER - into} to go`}</em></span>
        <span className="sp-ends" title="Season ends">⏱ {left(seasonEndsAt(p.n) - now)}</span>
      </div>
      <div
        className="sp-scene"
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
        {scene && <StageSlot cam={PASS_CAM} through>{scene}</StageSlot>}
      </div>
      <div ref={chips} className="sp-chips" role="list" aria-label="Star Pass tiers">
        {tiers.map((t, i) => (
          <button key={t.n} role="listitem" className={`sp-tier ${t.state}${t.car ? ' final' : ''}${i === near ? ' on' : ''}`} onClick={() => look(zOf(i))} aria-label={`Tier ${t.n}`}>
            {/* The prize as a picture, its tier number in the corner. */}
            {t.car ? '🚗' : t.skin ? <i className="sp-swatch" style={{ background: t.skin }} /> : t.gems ? <BuckIcon size={24} /> : t.parts ? <PartsIcon size={24} /> : <CoinIcon size={24} />}
            <b>{t.n}</b>
          </button>
        ))}
      </div>
      {ready.length > 0
        ? <button className="buy sp-go" onClick={collect}>🎁 Collect {ready.length}</button>
        : <button className="buy alt sp-go" onClick={() => useGame.getState().openPanel('goals')}>📋 Earn ⭐</button>}
    </Panel>
  )
}
