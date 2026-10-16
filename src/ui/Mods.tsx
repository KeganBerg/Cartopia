import { useState } from 'react'
import { useGame, modPrice, type OwnedCar, gateLevel } from '../game/store'
import { ModSkinPicker, TrackSkinPicker } from './Skins'
import { MODS, SKINNED_SLOTS, modSlotsFor, modName, slotInfo, type SkinnedSlot, carDef, modFits, fittedMods, modDef, ownedMods, performance, type ModDef, type ModSlot } from '../game/data'

// The car's mods with `tryId` swapped into its slot, for previewing before buying.
export function withMod(mods: string[] | undefined, tryId: string | null) {
  const m = tryId ? modDef(tryId) : undefined
  if (!m) return mods ?? []
  return [...(mods ?? []).filter((id) => modDef(id)?.slot !== m.slot), m.id]
}

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
  if (m.bucks) return `💎 ${m.bucks}`
  return `$${coins.toLocaleString()}${m.parts ? ` + ${m.parts}⚙` : ''}`
}

// Cheapest first, coin parts before gem parts, so each card along the row is a step up.
const byPrice = (a: ModDef, b: ModDef) => Math.sign(a.bucks) - Math.sign(b.bucks) || a.bucks - b.bucks || a.coins - b.coins

// The slot the next Mods tab opens on (a daily deal sends you to its part's slot).
let nextModSlot: ModSlot = 'spoiler'
export function openModSlot(slot: ModSlot) {
  nextModSlot = slot
}

// Mod shop for one car: pick a slot, tap a part to try it on the preview, then fit it.
// skinTry: a mod skin being tried on a slot's part (skin null: trying none).
export function ModShop({ car, trying, setTrying, skinTry, setSkinTry }: {
  car: OwnedCar; trying: string | null; setTrying: (id: string | null) => void
  skinTry: { slot: SkinnedSlot | 'tracks'; skin: string | null } | null; setSkinTry: (t: { slot: SkinnedSlot | 'tracks'; skin: string | null } | null) => void
}) {
  const level = useGame((s) => s.level)
  const gate = useGame(gateLevel)
  const modCar = useGame((s) => s.modCar)
  const deals = useGame((s) => s.deals)
  const def = carDef(car.model)
  const slots = modSlotsFor(def.body)
  const [slot, setSlot] = useState<ModSlot>(() => {
    const s = nextModSlot
    nextModSlot = 'spoiler'
    return slots.some((x) => x.id === s) ? s : 'spoiler'
  })
  const fit = fittedMods(car.mods, def.body)
  const owned = ownedMods(car)
  const basePi = performance(def, car.upgrades, car.mods)
  const info = slotInfo(slot, def.body)
  return (
    <div className="mods">
      <div className="mod-tabs" role="tablist">
        {slots.map((x) => slotInfo(x.id, def.body)).map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === slot}
            className={s.id === slot ? 'mod-tab sel' : 'mod-tab'}
            onClick={() => { setSlot(s.id); setTrying(null); setSkinTry(null) }}
          >
            <span className="mod-tab-icon">{s.icon}</span>
            <span>{s.name}</span>
            {fit[s.id] && <i className="mod-dot" />}
          </button>
        ))}
      </div>
      <p className="mod-hint">{info.stat}</p>
      <div className="mod-list">
        {MODS.filter((m) => m.slot === slot && modFits(m, def.body)).sort(byPrice).map((m) => {
          const fitted = fit[slot] === m.id
          const have = owned.includes(m.id)
          const locked = !have && gate < m.unlockLevel
          const pi = performance(def, car.upgrades, withMod(car.mods, m.id))
          const gain = pi - basePi
          const deal = modPrice({ deals, level }, m.id)
          return (
            <div
              key={m.id}
              className={`mod-card${fitted ? ' fitted' : ''}${trying === m.id ? ' trying' : ''}${locked ? ' locked' : ''}`}
              onClick={() => setTrying(trying === m.id || fitted ? null : m.id)}
            >
              <div className="mod-name">{modName(m, def.body)}</div>
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
      {SKINNED_SLOTS.includes(slot as SkinnedSlot) && (fit[slot] ? (
        <ModSkinPicker car={car} slot={slot as SkinnedSlot} trying={skinTry?.slot === slot ? skinTry.skin : undefined}
          setTrying={(skin) => setSkinTry(skin === undefined ? null : { slot: slot as SkinnedSlot, skin })} />
      ) : <p className="mod-hint small">🎨 Fit a {info.name.toLowerCase()} part to give it a mod skin.</p>)}
      {slot === 'rims' && def.body === 'tank' && (
        <TrackSkinPicker car={car} trying={skinTry?.slot === 'tracks' ? skinTry.skin : undefined}
          setTrying={(skin) => setSkinTry(skin === undefined ? null : { slot: 'tracks', skin })} />
      )}
    </div>
  )
}
