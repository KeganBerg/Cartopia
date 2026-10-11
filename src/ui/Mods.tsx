import { useState } from 'react'
import { useGame, modPrice, type OwnedCar } from '../game/store'
import { MODS, MOD_SLOTS, carDef, modFits, fittedMods, modDef, ownedMods, performance, type ModDef, type ModSlot } from '../game/data'

// The car's mods with `tryId` swapped into its slot, for previewing before buying.
export function withMod(mods: string[] | undefined, tryId: string | null) {
  const m = tryId ? modDef(tryId) : undefined
  if (!m) return mods ?? []
  return [...(mods ?? []).filter((id) => modDef(id)?.slot !== m.slot), m.id]
}

// Tires stay off the shelf until races feel the weather (the race screen wiring follows).
const SHOP_SLOTS = MOD_SLOTS.filter((s) => s.id !== 'tires')

const STAT_NAME = { power: 'Power', grip: 'Grip', weight: 'Weight' } as const

const TREAD_NAME = { wet: '🌧️ Rain', snow: '❄️ Snow', dust: '🏜️ Sand' } as const

function statLine(m: ModDef) {
  // Tires add no PI; they hold the strip in bad weather.
  if (m.tread) return (Object.keys(TREAD_NAME) as (keyof typeof TREAD_NAME)[]).filter((k) => m.tread![k]).map((k) => `${TREAD_NAME[k]}${m.tread![k]! < 1 ? ` ${Math.round(m.tread![k]! * 100)}%` : ''}`).join(' · ')
  return (['power', 'grip', 'weight'] as const)
    .filter((k) => m[k])
    .map((k) => `${m[k] > 0 ? '+' : ''}${m[k]} ${STAT_NAME[k]}`)
    .join(' · ')
}

function price(m: ModDef, coins = m.coins) {
  if (m.bucks) return `B ${m.bucks}`
  return `$${coins.toLocaleString()}${m.parts ? ` + ${m.parts}⚙` : ''}`
}

// The slot the next Mods tab opens on (a daily deal sends you to its part's slot).
let nextModSlot: ModSlot = 'spoiler'
export function openModSlot(slot: ModSlot) {
  nextModSlot = slot
}

// Mod shop for one car: pick a slot, tap a part to try it on the preview, then fit it.
export function ModShop({ car, trying, setTrying }: { car: OwnedCar; trying: string | null; setTrying: (id: string | null) => void }) {
  const level = useGame((s) => s.level)
  const modCar = useGame((s) => s.modCar)
  const deals = useGame((s) => s.deals)
  const def = carDef(car.model)
  const [slot, setSlot] = useState<ModSlot>(() => {
    const s = nextModSlot
    nextModSlot = 'spoiler'
    return s
  })
  const fit = fittedMods(car.mods, def.body)
  const owned = ownedMods(car)
  const basePi = performance(def, car.upgrades, car.mods)
  const info = MOD_SLOTS.find((s) => s.id === slot)!
  return (
    <div className="mods">
      <div className="mod-tabs" role="tablist">
        {SHOP_SLOTS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === slot}
            className={s.id === slot ? 'mod-tab sel' : 'mod-tab'}
            onClick={() => { setSlot(s.id); setTrying(null) }}
          >
            <span className="mod-tab-icon">{s.icon}</span>
            <span>{s.name}</span>
            {fit[s.id] && <i className="mod-dot" />}
          </button>
        ))}
      </div>
      <p className="mod-hint">{info.stat}. Tap a part to try it on.</p>
      <div className="mod-list">
        {MODS.filter((m) => m.slot === slot && modFits(m, def.body)).map((m) => {
          const fitted = fit[slot] === m.id
          const have = owned.includes(m.id)
          const locked = !have && level < m.unlockLevel
          const pi = performance(def, car.upgrades, withMod(car.mods, m.id))
          const gain = pi - basePi
          const deal = modPrice({ deals, level }, m.id)
          return (
            <div
              key={m.id}
              className={`mod-card${fitted ? ' fitted' : ''}${trying === m.id ? ' trying' : ''}${locked ? ' locked' : ''}`}
              onClick={() => setTrying(trying === m.id || fitted ? null : m.id)}
            >
              <div className="mod-name">{m.name}</div>
              <div className="mod-stats">{statLine(m)}</div>
              <div className="mod-pi">{fitted ? `PI ${basePi}` : `PI ${basePi} → ${pi}`}{!fitted && gain > 0 && <b> +{gain}</b>}</div>
              {fitted ? (
                <button className="mod-remove" onClick={(e) => { e.stopPropagation(); modCar(car.uid, m.id, true) }}>✔ Fitted · Take off</button>
              ) : have ? (
                <button className="buy small owned" onClick={(e) => { e.stopPropagation(); if (modCar(car.uid, m.id)) setTrying(null) }}>Equip</button>
              ) : locked ? (
                <button className="price locked-btn" onClick={(e) => { e.stopPropagation(); modCar(car.uid, m.id) }}>🔒 Level {m.unlockLevel}</button>
              ) : (
                <button
                  className={m.bucks ? 'buy small premium' : 'buy small'}
                  onClick={(e) => { e.stopPropagation(); if (modCar(car.uid, m.id)) setTrying(null) }}
                >{deal.deal && <span className="deal-tag">DEAL</span>}Buy · {price(m, deal.coins)}</button>
              )}
            </div>
          )
        })}
      </div>
      <p className="mod-hint small">Parts you buy stay with this car, so you can swap back for free.</p>
    </div>
  )
}
