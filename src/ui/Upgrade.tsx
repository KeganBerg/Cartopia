import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type Group, type Mesh, type PerspectiveCamera } from 'three'
import { useGame } from '../game/store'
import {
  buildingDef, buildingLevel, upgradable, upgradePayout, jobXp, xpGain, upgradeJobSeconds, upgradeFuelCap,
  buildingUpgradeCost, maxLevel, themable, decorGrows, TOURIST_PER_LEVEL, VISITORS, houseResidents, levelName, buildingUpgradeXp, BUILDINGS, CARS, takesDriver, loves, driverPayout, mergedParts, mergedFuelExtra, mergeBonus, mergeGain, carDef, type BuildingDef,
} from '../game/data'
import { workingDriver, type PlacedBuilding } from '../game/store'
import { groupOf, isLandmark, landmarkName, GLOBE_NAME, mergeGroups } from '../game/merge'
import { BuildingThumb, CarThumb, spinThumb } from '../scene/BuildingPreview'
import { BuildingModel } from '../scene/BuildingModel'
import { VanguardTower } from '../scene/Landmark'
import { GlobeTower } from '../scene/GlobeTower'
import { frame, seat } from '../scene/fit'
import { Panel } from './Menus'
import { RaveButton } from './Techno'
import { Preview } from '../scene/Stage'
import { COLOR_THEMES, themeFor, type ColorTheme } from '../game/cityLook'
import { Tint } from '../scene/CityTint'
import { townRates } from '../game/townRates'
import { compact } from './format'
import { CoinIcon } from './Icon'
import './upgrades.css'

const n = (v: number) => v.toLocaleString()
// The extra tourist odds a grown garden or statue adds, as a share of the usual odds.
const tourPct = (level: number) => Math.round(((level - 1) * TOURIST_PER_LEVEL * 100) / VISITORS.tourist.weight)
const time = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}m${sec % 60 ? ` ${sec % 60}s` : ''}` : `${sec}s`)

// Turntable of the building at a given level. The model sits on the floor at
// its natural size and the camera backs off until the whole thing, spinning,
// fills the frame, so a level 10 sky tower is as easy to see as a pizza shop.
const VIEW = new Vector3(3.4, 2.6, 3.4)
// Drawn in the shared turntable canvas (scene/Stage.tsx), not a new one each time the panel opens.
const CAM = { position: VIEW.toArray(), fov: 35, near: 0.1, far: 1000 }

function Spinner({ def, level, landmark, theme }: { def: BuildingDef; level: number; landmark?: string | null; theme: ColorTheme | null }) {
  const ref = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const disc = useRef<Mesh>(null)
  const camera = useThree((t) => t.camera as PerspectiveCamera)
  const size = useThree((t) => t.size)
  useLayoutEffect(() => {
    if (!inner.current || !ref.current) return
    // Measured by its vertices: a turned pyramid roof's loose box is 1.4x too wide.
    const b = seat(inner.current, ref.current, undefined, true)
    // The disc hugs the model's swept footprint so a small shop fills the card too.
    const floor = Math.max(b.r * 1.08, 0.3)
    disc.current?.scale.setScalar(floor)
    camera.aspect = size.width / Math.max(1, size.height)
    frame(camera, b, VIEW, { floor, pad: 0.06 })
  }, [def, level, landmark, camera, size])
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.5
  })
  return (
    <>
      <mesh ref={disc} rotation-x={-Math.PI / 2} position-y={-0.02}>
        <circleGeometry args={[1, 40]} />
        <meshStandardMaterial color="#cfd8dc" />
      </mesh>
      <group ref={ref} rotation-y={-0.5}>
        <group ref={inner}>
          {/* In the colours it wears in town. */}
          <Tint theme={theme}>{landmark === GLOBE_NAME ? <GlobeTower /> : landmark ? <VanguardTower /> : <BuildingModel def={def} level={level} />}</Tint>
        </group>
      </group>
    </>
  )
}

// `landmark`: the landmark the block is (or this upgrade makes it), shown instead of one house.
function LevelPreview({ def, level, landmark, theme }: { def: BuildingDef; level: number; landmark?: string | null; theme: ColorTheme | null }) {
  const scene = useMemo(() => (
    <>
      <hemisphereLight args={['#ffffff', '#90a4ae', 1]} />
      <directionalLight position={[3, 5, 2]} intensity={1.4} />
      <Spinner def={def} level={level} landmark={landmark} theme={theme} />
    </>
  ), [def, level, landmark, theme])
  return (
    <div className="upgrade-preview">
      <Preview.StageSlot cam={CAM}>{scene}</Preview.StageSlot>
      <span className="upgrade-tag">{landmark ? landmark : `Level ${level}${level > 1 ? ' look' : ''}`}</span>
    </div>
  )
}

function Pips({ level, max }: { level: number; max: number }) {
  return (
    <div className="upgrade-pips" aria-label={`Level ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
    </div>
  )
}

// The cars that love this business, as pictures: a tap opens the showroom on one.
function FanStrip({ fans, go }: { fans: typeof CARS; go: () => void }) {
  return (
    <button className="driver-fans" onClick={go} title={fans.map((c) => c.name).join(', ')}>
      <span className="driver-fans-tag">❤️ +25%</span>
      {fans.slice(0, 5).map((c) => <CarThumb key={c.id} size="xs" color={c.colors[0]} body={c.body} model={c.id} />)}
      <span className="driver-fans-go">➜</span>
    </button>
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
  const shopFans = () => s.focusShop(fans.some((f) => !f.rescueOnly) ? 'showroom' : 'rescue', fans.find((f) => !f.rescueOnly)?.id ?? null)

  if (car && !picking) {
    const cd = carDef(car.model)
    const broken = car.flat || car.lowFuel
    return (
      <div className="driver">
        <div className="driver-head">Driver</div>
        <div className="driver-car">
          <CarThumb size="sm" color={car.color} finish={car.finish} skin={car.skin} modSkin={car.modSkin} hat={car.hat} body={cd.body} model={cd.id} stripe={car.stripe} />
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
            {car.flat ? '🛞 Flat tire' : '⛽ Out of gas'} · Fix
          </button>
        )}
        {!broken && !loves(cd, d.id) && fans.length > 0 && <FanStrip fans={fans} go={shopFans} />}
      </div>
    )
  }

  return (
    <div className="driver">
      <div className="driver-head">
        {car ? '🚗 New driver' : '🚗 Driver'}
        {picking && <button className="driver-cancel" onClick={() => setPicking(false)}>Cancel</button>}
      </div>
      <p className="card-stat driver-tip" title={`A driver adds +10% to every job, or +25% if it loves the ${d.name}`}>+10% ${n(Math.round(base * 1.1))} · ❤️ +25% ${n(Math.round(base * 1.25))}</p>
      <div className="driver-list">
        {sorted.map((c) => {
          const cd = carDef(c.model)
          const fan = loves(cd, d.id)
          const at = workplace(c.uid)
          return (
            <button key={c.uid} className={`driver-pick${fan ? ' fan' : ''}${c.uid === b.car ? ' sel' : ''}`} onClick={() => { assign(b.uid, c.uid); setPicking(false) }}>
              <CarThumb size="xs" color={c.color} finish={c.finish} skin={c.skin} modSkin={c.modSkin} hat={c.hat} body={cd.body} model={cd.id} stripe={c.stripe} />
              <span className="driver-pick-name">{cd.name}{(at || c.flat || c.lowFuel) && <small>{[at && `at ${buildingDef(at.def).name}`, c.flat && '🛞 flat tire', c.lowFuel && '⛽ out of gas'].filter(Boolean).join(' · ')}</small>}</span>
              <span className="driver-pick-bonus">{fan ? '❤️ +25%' : '+10%'}</span>
            </button>
          )
        })}
      </div>
      {car && <button className="driver-remove" onClick={() => { assign(b.uid, null); setPicking(false) }}>Take {carDef(car.model).name} off this job</button>}
      {!anyFan && fans.length > 0 && <FanStrip fans={fans} go={shopFans} />}
    </div>
  )
}

export function UpgradePanel() {
  const s = useGame()
  const b = s.buildings.find((o) => o.uid === s.upgrading)
  // Back to the menu it was opened from; opened from the town (a tap, or Edit > Move), it
  // closes straight back to the town and whatever mode the player was in.
  const close = () => (useGame.getState().panelBack.length ? useGame.getState().closePanel() : useGame.setState({ panel: null, upgrading: null }))
  // The X always goes straight to the town; the back arrow shows when there is a menu to go back to.
  const toTown = () => useGame.setState({ panel: null, panelBack: [], upgrading: null })
  if (!b) return null
  const d = buildingDef(b.def)
  if (!themable(d)) return null
  const canUp = upgradable(d)
  const lvl = buildingLevel(b)
  const max = lvl >= maxLevel(d)
  const next = max ? lvl : lvl + 1
  // A merged block shows and upgrades all its buildings at once.
  const members = groupOf(s.buildings, b.uid)?.members ?? [b]
  const k = members.length
  // Merged blocks earn a bonus on top (MERGE_BONUS): +10% a pair, +25% a 2x2, +50% a 4x4.
  const boost = k > 1 ? mergeBonus(k) : 0
  const gain = boost ? mergeGain(d) : null
  const one = buildingUpgradeCost(d, lvl)
  const cost = { coins: one.coins * k, parts: one.parts * k }
  const sum = (f: (o: PlacedBuilding) => number) => members.reduce((t, o) => t + f(o), 0)
  const shortCoins = Math.max(0, cost.coins - s.coins)
  const shortParts = Math.max(0, cost.parts - s.parts)

  const rows: { label: string; now: string; next: string }[] = []
  if (d.jobSeconds) {
    const driver = members.some((o) => workingDriver(s, o))
    rows.push({ label: driver ? 'Coins per job (with driver)' : 'Coins per job', now: `$${n(sum((o) => driverPayout(d, lvl, workingDriver(s, o), boost)))}`, next: `$${n(sum((o) => driverPayout(d, next, workingDriver(s, o), boost)))}` })
    if (d.partsPayout) rows.push({ label: 'Parts per job', now: `⚙ ${mergedParts(d, lvl, boost) * k}`, next: `⚙ ${mergedParts(d, next, boost) * k}` })
    rows.push({ label: 'Job time', now: time(upgradeJobSeconds(d, lvl)), next: time(upgradeJobSeconds(d, next)) })
    rows.push({ label: 'XP per job', now: `${xpGain(s.level, jobXp(d, lvl, s.level) * k)}`, next: `${xpGain(s.level, jobXp(d, next, s.level) * k)}` })
  }
  // Grown decor draws more tourists (see touristWeight in data.ts).
  if (decorGrows(d)) rows.push({ label: '📸 Tourists', now: `+${tourPct(lvl) * k}%`, next: `+${tourPct(next) * k}%` })
  const fuel = (l: number) => upgradeFuelCap(d, l) * k + (k > 1 ? mergedFuelExtra(d, l, k) : 0)
  if (upgradeFuelCap(d, next) > 0) rows.push({ label: 'Max fuel', now: `+${fuel(lvl)}`, next: `+${fuel(next)}` })
  // A business that rebuilds into its next form says what it becomes.
  if (d.kind !== 'house' && levelName(d, next) !== levelName(d, lvl)) rows.push({ label: 'Building', now: levelName(d, lvl), next: levelName(d, next) })
  const block = groupOf(s.buildings, b.uid)
  const landmark = block && isLandmark(block) ? landmarkName(block) : null
  // A merged block of houses reaching level 10 becomes a landmark (a Vanguard or Globe Tower).
  const becomes = block && isLandmark({ ...block, anchor: { ...block.anchor, level: next } }) ? landmarkName(block) : null
  if (d.kind === 'house') {
    const now = landmark ?? levelName(d, lvl)
    const then = becomes ?? levelName(d, next)
    // Only when the house actually turns into something else.
    if (now !== then) rows.push({ label: 'Building', now, next: then })
    rows.push({ label: 'Residents', now: `${houseResidents(lvl) * k}`, next: `${houseResidents(next) * k}` })
    rows.push({ label: 'Upgrade XP', now: '', next: `+${xpGain(s.level, buildingUpgradeXp(lvl) * k)}` })
  }
  const name = landmark ? landmark : levelName(d, lvl) + (k > 1 ? ` ×${k}` : '')

  return (
    <Panel title={canUp ? `${name} · Level ${lvl}` : name} onClose={toTown} onBack={s.panelBack.length ? s.closePanel : undefined}>
      <div className="upgrade">
        <LevelPreview def={d} level={canUp ? next : lvl} landmark={becomes} theme={themeFor(b.tint, s.cityTheme, d.kind === 'decor')} />
        {canUp && <Pips level={lvl} max={maxLevel(d)} />}
        {gain && <p className="merge-boost" title="Merge bonus">🧩 ×{k} · {gain} +{Math.round(boost * 100)}%</p>}
        {!canUp ? null : max ? (
          <p className="upgrade-max">⭐ Max level</p>
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
            <button className={`buy upgrade-buy${shortCoins || shortParts ? ' short' : ''}`} onClick={() => s.upgradeBuilding(b.uid)}>
              ⬆ Upgrade · ${n(cost.coins)}{cost.parts ? ` · ⚙ ${cost.parts}` : ''}
            </button>
            {(shortCoins > 0 || shortParts > 0) && (
              <button className="upgrade-short" onClick={() => (shortCoins ? s.showNeed('coins', shortCoins, `upgrading your ${name}`) : s.showNeed('parts', shortParts, `upgrading your ${name}`))}>
                Need {[shortCoins && `$${n(shortCoins)}`, shortParts && `⚙ ${shortParts}`].filter(Boolean).join(' · ')} ➜
              </button>
            )}
          </>
        )}
        <ThemeStrip uid={b.uid} tint={b.tint} />
        {d.id === 'club' && <RaveButton onStart={close} />}
        {takesDriver(d) && <Driver b={b} d={d} />}
      </div>
    </Panel>
  )
}

// Colour themes for this building: a swatch each, and one to go back to its own colours.
function ThemeStrip({ uid, tint }: { uid: string; tint?: string }) {
  const setTint = useGame((s) => s.setBuildingTint)
  const city = useGame((s) => s.cityTheme)
  return (
    <div className="theme-strip" aria-label="Colour theme">
      <button className={`theme-dot own${!tint ? ' sel' : ''}`} title={city ? 'City theme' : 'Own colours'} onClick={() => setTint(uid, null)}>🎨</button>
      {COLOR_THEMES.map((t) => (
        <button key={t.id} className={`theme-dot${tint === t.id ? ' sel' : ''}`} style={{ background: t.c }} title={t.name} aria-label={t.name} onClick={() => setTint(uid, t.id)} />
      ))}
    </div>
  )
}

// What the whole town makes and burns an hour with every job running (game/townRates.ts):
// coins and parts in, the fuel the jobs take against the fuel that refills, and the tank.
function TownRates() {
  const level = useGame((s) => s.level)
  const buildings = useGame((s) => s.buildings)
  const cars = useGame((s) => s.cars)
  const r = useMemo(() => townRates({ level, buildings, cars }), [level, buildings, cars])
  // How much of the jobs' fuel the refill covers.
  const covered = r.fuelUse ? Math.min(1, r.fuelIn / r.fuelUse) : 1
  return (
    <div className="ug-town" aria-label="Your town each hour">
      <div className="ug-tile ug-coins" title="Coins an hour, every job running"><CoinIcon size={26} /><b>{compact(r.coins)}</b><small>/h</small></div>
      <div className="ug-tile ug-parts" title="Parts an hour, every job running"><i>⚙</i><b>{compact(r.parts)}</b><small>/h</small></div>
      <div className="ug-fuel">
        <div className="ug-fuel-nums">
          <span className="ug-use" title="Fuel your jobs use an hour"><i>⛽</i><b>−{compact(r.fuelUse)}</b><small>/h</small></span>
          <span className="ug-in" title="Fuel that refills on its own an hour"><b>+{compact(r.fuelIn)}</b><small>/h</small></span>
          <span className="ug-tank" title="Max fuel">🛢️ <b>{compact(r.tank)}</b></span>
        </div>
        <span className="ug-bar" aria-hidden><i style={{ width: `${covered * 100}%` }} /></span>
      </div>
    </div>
  )
}

// Shop > Upgrades: the town's totals on top, then a card per building (or merged block) with its
// 3D model at its level, the level pips and the next upgrade's price; maxed ones sit together
// at the bottom. `find` (the Shop's search box) narrows it by name.
export function ShopUpgrades({ find = '' }: { find?: string }) {
  const buildings = useGame((s) => s.buildings)
  const coins = useGame((s) => s.coins)
  const parts = useGame((s) => s.parts)
  const city = useGame((s) => s.cityTheme)
  const openUpgrade = useGame((s) => s.openUpgrade)
  const order = (id: string) => BUILDINGS.findIndex((d) => d.id === id)
  // Cheapest next upgrade first; maxed-out buildings last.
  const merges = mergeGroups(buildings)
  const size = (b: (typeof buildings)[number]) => merges.groups.get(b.uid)?.members.length ?? 1
  const costOf = (b: (typeof buildings)[number]) =>
    buildingLevel(b) >= maxLevel(buildingDef(b.def)) ? Infinity : buildingUpgradeCost(buildingDef(b.def), buildingLevel(b)).coins * size(b)
  const sorted = buildings
    .filter((b) => upgradable(buildingDef(b.def)) && (!merges.owner.has(b.uid) || merges.groups.has(b.uid)))
    .filter((b) => !find || levelName(buildingDef(b.def), buildingLevel(b)).toLowerCase().includes(find))
    .sort((a, b) => costOf(a) - costOf(b) || order(a.def) - order(b.def))
  // Identical buildings (same kind, level, colours and block size) stack on one card; a tap
  // opens the first, and upgrading it moves it to its own card.
  const stacks: { b: (typeof buildings)[number]; n: number }[] = []
  const seen = new Map<string, { b: (typeof buildings)[number]; n: number }>()
  for (const b of sorted) {
    const key = `${b.def}|${buildingLevel(b)}|${b.tint ?? ''}|${size(b)}`
    const hit = seen.get(key)
    if (hit) hit.n++
    else {
      const st = { b, n: 1 }
      seen.set(key, st)
      stacks.push(st)
    }
  }
  // A late-game town fills this page with detailed buildings, so they're still pictures;
  // the one under the mouse turns.
  const hover = (on: boolean) => (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') spinThumb(e.currentTarget.querySelector('canvas'), on)
  }
  const open = stacks.filter((t) => costOf(t.b) < Infinity)
  const maxed = stacks.filter((t) => costOf(t.b) === Infinity)
  const card = ({ b, n: count }: { b: (typeof buildings)[number]; n: number }) => {
    const d = buildingDef(b.def)
    const lvl = buildingLevel(b)
    const max = lvl >= maxLevel(d)
    const k = size(b)
    const one = buildingUpgradeCost(d, lvl)
    const cost = { coins: one.coins * k, parts: one.parts * k }
    const afford = coins >= cost.coins && parts >= cost.parts
    return (
      <button key={b.uid} className={`ug-card${max ? ' max' : afford ? ' ready' : ''}${count > 1 ? ' stack' : ''}`} onClick={() => openUpgrade(b.uid)} onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
        <BuildingThumb def={d} level={lvl} theme={themeFor(b.tint, city, d.kind === 'decor')} still />
        {k > 1 && <span className="ug-k" title="Merged block">🧩×{k}</span>}
        {count > 1 && <span className="ug-n" title={`${count} the same`}>×{count}</span>}
        <span className="ug-lv">{max ? '⭐' : lvl}</span>
        <b className="ug-name">{levelName(d, lvl)}</b>
        {!max && <Pips level={lvl} max={maxLevel(d)} />}
        {!max && <span className="ug-price">⬆ ${compact(cost.coins)}{cost.parts ? ` ⚙${compact(cost.parts)}` : ''}</span>}
      </button>
    )
  }
  return (
    <section className="ug">
      <TownRates />
      {!sorted.length && <p className="shop-none">🔍 No match</p>}
      {open.length > 0 && <div className="ug-grid">{open.map(card)}</div>}
      {maxed.length > 0 && (
        <>
          <h4 className="ug-head">⭐ Max · {maxed.reduce((t, x) => t + x.n, 0)}</h4>
          <div className="ug-grid ug-maxed">{maxed.map(card)}</div>
        </>
      )}
    </section>
  )
}
