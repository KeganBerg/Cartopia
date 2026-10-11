import { useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useGame } from '../game/store'
import {
  buildingDef, buildingLevel, upgradable, upgradePayout, upgradePartsPayout, upgradeXp, upgradeJobSeconds, upgradeFuelCap,
  buildingUpgradeCost, MAX_BUILDING_LEVEL, BUILDINGS, CARS, takesDriver, loves, driverPayout, carDef, type BuildingDef,
} from '../game/data'
import { workingDriver, type PlacedBuilding } from '../game/store'
import { CarThumb } from '../scene/BuildingPreview'
import { BuildingModel } from '../scene/BuildingModel'
import { seat } from '../scene/fit'
import { Panel } from './Menus'

const n = (v: number) => v.toLocaleString()
const time = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}m${sec % 60 ? ` ${sec % 60}s` : ''}` : `${sec}s`)

// Turntable of the building at a given level. Fits the model to the frame by
// its own bounds: base on the floor, centred, and scaled down so even a
// level 10 tower stays fully in view.
const FIT_H = 1.9
const FIT_W = 2.3

function Spinner({ def, level }: { def: BuildingDef; level: number }) {
  const ref = useRef<Group>(null)
  const inner = useRef<Group>(null)
  useLayoutEffect(() => {
    if (inner.current && ref.current) seat(inner.current, ref.current, (b) => Math.min(FIT_H / b.h, FIT_W / (b.r * 2)))
  }, [def, level])
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.5
  })
  return (
    <group ref={ref} rotation-y={-0.5}>
      <group ref={inner}>
        <BuildingModel def={def} level={level} />
      </group>
    </group>
  )
}

function LevelPreview({ def, level }: { def: BuildingDef; level: number }) {
  return (
    <div className="upgrade-preview">
      <Canvas camera={{ position: [3.4, 2.6, 3.4], fov: 35 }} dpr={[1, 1.5]} onCreated={({ camera }) => camera.lookAt(0, FIT_H / 2, 0)}>
        <hemisphereLight args={['#ffffff', '#90a4ae', 1]} />
        <directionalLight position={[3, 5, 2]} intensity={1.4} />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
          <circleGeometry args={[1.5, 40]} />
          <meshStandardMaterial color="#cfd8dc" />
        </mesh>
        <Spinner def={def} level={level} />
      </Canvas>
      <span className="upgrade-tag">Level {level}{level > 1 ? ' look' : ''}</span>
    </div>
  )
}

function Pips({ level }: { level: number }) {
  return (
    <div className="upgrade-pips" aria-label={`Level ${level} of ${MAX_BUILDING_LEVEL}`}>
      {Array.from({ length: MAX_BUILDING_LEVEL }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
    </div>
  )
}

// Who drives for this business: pick one of your cars, favourites first.
function Driver({ b, d }: { b: PlacedBuilding; d: BuildingDef }) {
  const cars = useGame((s) => s.cars)
  const buildings = useGame((s) => s.buildings)
  const assign = useGame((s) => s.assignCar)
  const s = useGame()
  const [picking, setPicking] = useState(false)
  const lvl = buildingLevel(b)
  const car = cars.find((c) => c.uid === b.car)
  const base = upgradePayout(d, lvl)
  const fans = CARS.filter((c) => loves(c, d.id))
  const workplace = (uid: string) => buildings.find((o) => o.car === uid && o.uid !== b.uid)
  const sorted = [...cars].sort((x, y) => Number(loves(carDef(y.model), d.id)) - Number(loves(carDef(x.model), d.id)))
  const anyFan = cars.some((c) => loves(carDef(c.model), d.id))

  if (car && !picking) {
    const cd = carDef(car.model)
    const broken = car.flat || car.lowFuel
    return (
      <div className="driver">
        <div className="driver-head">Driver</div>
        <div className="driver-car">
          <CarThumb size="sm" color={car.color} finish={car.finish} body={cd.body} stripe={car.stripe} />
          <div>
            <b>{cd.name}</b>
            <div className={broken ? 'driver-bonus off' : 'driver-bonus'}>
              {broken ? 'No bonus until it is fixed' : `${loves(cd, d.id) ? '❤️ Loves it · +25%' : '+10%'} · $${n(driverPayout(d, lvl, workingDriver(s, b)))} a job`}
            </div>
          </div>
          <button className="buy small alt" onClick={() => setPicking(true)}>Change</button>
        </div>
        {broken && (
          <button className="upgrade-short" onClick={() => { s.selectCar(car.uid); s.openPanel('flat') }}>
            {car.flat ? '🛞 It has a flat tire.' : '⛽ It ran out of gas.'} Fix it to get the bonus back.
          </button>
        )}
        {!broken && !loves(cd, d.id) && fans.length > 0 && (
          <p className="card-stat driver-tip">A car that loves the {d.name} earns +25%: {fans.map((c) => c.name).join(', ')}.</p>
        )}
      </div>
    )
  }

  return (
    <div className="driver">
      <div className="driver-head">
        {car ? 'Pick a new driver' : 'Put a car to work here'}
        {picking && <button className="driver-cancel" onClick={() => setPicking(false)}>Cancel</button>}
      </div>
      <p className="card-stat driver-tip">A driver adds +10% to every job (${n(Math.round(base * 1.1))}), or +25% (${n(Math.round(base * 1.25))}) if it ❤️ loves the {d.name}.</p>
      <div className="driver-list">
        {sorted.map((c) => {
          const cd = carDef(c.model)
          const fan = loves(cd, d.id)
          const at = workplace(c.uid)
          return (
            <button key={c.uid} className={`driver-pick${fan ? ' fan' : ''}${c.uid === b.car ? ' sel' : ''}`} onClick={() => { assign(b.uid, c.uid); setPicking(false) }}>
              <CarThumb size="xs" color={c.color} finish={c.finish} body={cd.body} stripe={c.stripe} />
              <span className="driver-pick-name">{cd.name}{(at || c.flat || c.lowFuel) && <small>{[at && `at ${buildingDef(at.def).name}`, c.flat && '🛞 flat tire', c.lowFuel && '⛽ out of gas'].filter(Boolean).join(' · ')}</small>}</span>
              <span className="driver-pick-bonus">{fan ? '❤️ +25%' : '+10%'}</span>
            </button>
          )
        })}
      </div>
      {car && <button className="driver-remove" onClick={() => { assign(b.uid, null); setPicking(false) }}>Take {carDef(car.model).name} off this job</button>}
      {!anyFan && fans.length > 0 && (
        <button className="upgrade-short" onClick={() => s.focusShop(fans.some((f) => !f.rescueOnly) ? 'showroom' : 'rescue', fans.find((f) => !f.rescueOnly)?.id ?? null)}>
          None of your cars love the {d.name} yet. These do: {fans.map((c) => c.name).join(', ')}. How do I get one?
        </button>
      )}
    </div>
  )
}

export function UpgradePanel() {
  const s = useGame()
  const b = s.buildings.find((o) => o.uid === s.upgrading)
  const close = () => useGame.setState({ panel: null, upgrading: null })
  if (!b) return null
  const d = buildingDef(b.def)
  if (!upgradable(d)) return null
  const lvl = buildingLevel(b)
  const max = lvl >= MAX_BUILDING_LEVEL
  const next = max ? lvl : lvl + 1
  const cost = buildingUpgradeCost(d, lvl)
  const shortCoins = Math.max(0, cost.coins - s.coins)
  const shortParts = Math.max(0, cost.parts - s.parts)

  const rows: { label: string; now: string; next: string }[] = []
  if (d.jobSeconds) {
    const driver = workingDriver(s, b)
    rows.push({ label: driver ? 'Coins per job (with driver)' : 'Coins per job', now: `$${n(driverPayout(d, lvl, driver))}`, next: `$${n(driverPayout(d, next, driver))}` })
    if (d.partsPayout) rows.push({ label: 'Parts per job', now: `⚙ ${upgradePartsPayout(d, lvl)}`, next: `⚙ ${upgradePartsPayout(d, next)}` })
    rows.push({ label: 'Job time', now: time(upgradeJobSeconds(d, lvl)), next: time(upgradeJobSeconds(d, next)) })
    rows.push({ label: 'XP per job', now: `${upgradeXp(d, lvl)}`, next: `${upgradeXp(d, next)}` })
  }
  if (d.fuelCap) rows.push({ label: 'Max fuel', now: `+${upgradeFuelCap(d, lvl)}`, next: `+${upgradeFuelCap(d, next)}` })

  return (
    <Panel title={`${d.name} · Level ${lvl}`} onClose={close}>
      <div className="upgrade">
        <LevelPreview def={d} level={next} />
        <Pips level={lvl} />
        {max ? (
          <p className="upgrade-max">⭐ Max level! Your {d.name} is as fancy as it gets.</p>
        ) : (
          <>
            <table className="upgrade-stats">
              <thead><tr><th /><th>Now</th><th>Level {next}</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}><td>{r.label}</td><td>{r.now}</td><td className="up">{r.next}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="card-stat upgrade-note">Each level makes it taller and fancier on the same lot.</p>
            <button className={`buy upgrade-buy${shortCoins || shortParts ? ' short' : ''}`} onClick={() => s.upgradeBuilding(b.uid)}>
              ⬆ Upgrade · ${n(cost.coins)}{cost.parts ? ` · ⚙ ${cost.parts}` : ''}
            </button>
            {(shortCoins > 0 || shortParts > 0) && (
              <button className="upgrade-short" onClick={() => (shortCoins ? s.showNeed('coins', shortCoins, `upgrading your ${d.name}`) : s.showNeed('parts', shortParts, `upgrading your ${d.name}`))}>
                You need {shortCoins ? `$${n(shortCoins)} more` : ''}{shortCoins && shortParts ? ' and ' : ''}{shortParts ? `${shortParts} more parts` : ''}. How do I get more?
              </button>
            )}
          </>
        )}
        {takesDriver(d) && <Driver b={b} d={d} />}
      </div>
    </Panel>
  )
}

// Shop section listing what the player owns that can still be upgraded.
export function ShopUpgrades() {
  const buildings = useGame((s) => s.buildings)
  const coins = useGame((s) => s.coins)
  const parts = useGame((s) => s.parts)
  const openUpgrade = useGame((s) => s.openUpgrade)
  const order = (id: string) => BUILDINGS.findIndex((d) => d.id === id)
  // Cheapest next upgrade first; maxed-out buildings last.
  const costOf = (b: (typeof buildings)[number]) =>
    buildingLevel(b) >= MAX_BUILDING_LEVEL ? Infinity : buildingUpgradeCost(buildingDef(b.def), buildingLevel(b)).coins
  const sorted = buildings
    .filter((b) => upgradable(buildingDef(b.def)))
    .sort((a, b) => costOf(a) - costOf(b) || order(a.def) - order(b.def))
  if (!sorted.length) return null
  return (
    <section>
      <p className="hint">Upgraded buildings grow taller and fancier, pay more coins and finish jobs sooner. Cheapest first.</p>
      <div className="upgrade-list">
        {sorted.map((b) => {
          const d = buildingDef(b.def)
          const lvl = buildingLevel(b)
          const max = lvl >= MAX_BUILDING_LEVEL
          const cost = buildingUpgradeCost(d, lvl)
          const afford = coins >= cost.coins && parts >= cost.parts
          return (
            <button key={b.uid} className={`upgrade-row${afford && !max ? ' ready' : ''}`} onClick={() => openUpgrade(b.uid)}>
              <span className="upgrade-row-name">{d.name}</span>
              <Pips level={lvl} />
              <span className="price">{max ? '⭐ Max' : `$${n(cost.coins)}${cost.parts ? ` ⚙${cost.parts}` : ''}`}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
