import { useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Box3, Sphere, type Group } from 'three'
import { useGame } from '../game/store'
import {
  buildingDef, buildingLevel, upgradable, upgradePayout, upgradePartsPayout, upgradeXp, upgradeJobSeconds, upgradeFuelCap,
  buildingUpgradeCost, MAX_BUILDING_LEVEL, BUILDINGS, type BuildingDef,
} from '../game/data'
import { BuildingModel } from '../scene/BuildingModel'
import { Panel } from './Menus'

const n = (v: number) => v.toLocaleString()
const time = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}m${sec % 60 ? ` ${sec % 60}s` : ''}` : `${sec}s`)

// Turntable of the building at a given level, scaled so the tallest level still fits.
function Spinner({ def, level }: { def: BuildingDef; level: number }) {
  const ref = useRef<Group>(null)
  const inner = useRef<Group>(null)
  useLayoutEffect(() => {
    const g = inner.current
    if (!g) return
    g.scale.setScalar(1)
    const sphere = new Box3().setFromObject(g).getBoundingSphere(new Sphere())
    const k = 1.45 / sphere.radius
    g.scale.setScalar(k)
    g.position.set(-sphere.center.x * k, -sphere.center.y * k + 0.55, -sphere.center.z * k)
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
      <Canvas camera={{ position: [3, 2.3, 3], fov: 35 }} dpr={[1, 1.5]} onCreated={({ camera }) => camera.lookAt(0, 0.55, 0)}>
        <hemisphereLight args={['#ffffff', '#90a4ae', 1]} />
        <directionalLight position={[3, 5, 2]} intensity={1.4} />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
          <circleGeometry args={[1.6, 40]} />
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
    rows.push({ label: 'Coins per job', now: `$${n(upgradePayout(d, lvl))}`, next: `$${n(upgradePayout(d, next))}` })
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
  const [all, setAll] = useState(false)
  const order = (id: string) => BUILDINGS.findIndex((d) => d.id === id)
  // Cheapest next upgrade first; maxed-out buildings last.
  const costOf = (b: (typeof buildings)[number]) =>
    buildingLevel(b) >= MAX_BUILDING_LEVEL ? Infinity : buildingUpgradeCost(buildingDef(b.def), buildingLevel(b)).coins
  const sorted = buildings
    .filter((b) => upgradable(buildingDef(b.def)))
    .sort((a, b) => costOf(a) - costOf(b) || order(a.def) - order(b.def))
  if (!sorted.length) return null
  const FEW = 4
  const mine = all ? sorted : sorted.slice(0, FEW)
  return (
    <section>
      <h3>Upgrade your buildings <small>Taller, fancier, more coins, faster jobs</small></h3>
      <div className="upgrade-list">
        {mine.map((b) => {
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
      {sorted.length > FEW && (
        <button className="upgrade-more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${sorted.length}`}</button>
      )}
    </section>
  )
}
