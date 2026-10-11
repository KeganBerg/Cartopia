import { useState } from 'react'
import { useGame, type OwnedCar } from '../game/store'
import { MODS, MOD_SLOTS, carDef, fittedMods, modDef, performance, type ModDef, type ModSlot } from '../game/data'

// The car's mods with `tryId` swapped into its slot, for previewing before buying.
export function withMod(mods: string[] | undefined, tryId: string | null) {
  const m = tryId ? modDef(tryId) : undefined
  if (!m) return mods ?? []
  return [...(mods ?? []).filter((id) => modDef(id)?.slot !== m.slot), m.id]
}

const STAT_NAME = { power: 'Power', grip: 'Grip', weight: 'Weight' } as const

function statLine(m: ModDef) {
  return (['power', 'grip', 'weight'] as const)
    .filter((k) => m[k])
    .map((k) => `${m[k] > 0 ? '+' : ''}${m[k]} ${STAT_NAME[k]}`)
    .join(' · ')
}

function price(m: ModDef) {
  if (m.bucks) return `B ${m.bucks}`
  return `$${m.coins.toLocaleString()}${m.parts ? ` + ${m.parts}⚙` : ''}`
}

// Mod shop for one car: pick a slot, tap a part to try it on the preview, then fit it.
export function ModShop({ car, trying, setTrying }: { car: OwnedCar; trying: string | null; setTrying: (id: string | null) => void }) {
  const level = useGame((s) => s.level)
  const modCar = useGame((s) => s.modCar)
  const [slot, setSlot] = useState<ModSlot>('spoiler')
  const def = carDef(car.model)
  const fit = fittedMods(car.mods)
  const basePi = performance(def, car.upgrades, car.mods)
  const info = MOD_SLOTS.find((s) => s.id === slot)!
  return (
    <div className="mods">
      <div className="mod-tabs" role="tablist">
        {MOD_SLOTS.map((s) => (
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
        {MODS.filter((m) => m.slot === slot).map((m) => {
          const fitted = fit[slot] === m.id
          const locked = level < m.unlockLevel
          const pi = performance(def, car.upgrades, withMod(car.mods, m.id))
          const gain = pi - basePi
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
                <button className="mod-remove" onClick={(e) => { e.stopPropagation(); modCar(car.uid, m.id, true) }}>✔ Fitted · Remove</button>
              ) : locked ? (
                <button className="price locked-btn" onClick={(e) => { e.stopPropagation(); modCar(car.uid, m.id) }}>🔒 Level {m.unlockLevel}</button>
              ) : (
                <button
                  className={m.bucks ? 'buy small premium' : 'buy small'}
                  onClick={(e) => { e.stopPropagation(); if (modCar(car.uid, m.id)) setTrying(null) }}
                >{fit[slot] ? 'Swap' : 'Fit'} · {price(m)}</button>
              )}
            </div>
          )
        })}
      </div>
      {fit[slot] && <p className="mod-hint small">Swapping replaces the {modDef(fit[slot]!)!.name}; removed parts aren't refunded.</p>}
    </div>
  )
}
