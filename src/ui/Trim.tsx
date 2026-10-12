import { useGame, type OwnedCar, type Preset } from '../game/store'
import { carDef, isBike } from '../game/data'
import { PRESET_SLOTS, TRIM_KINDS, sameTrim, tidyTrim, trimCost, trimLocked, type Trim, type TrimKind } from '../game/trim'
import { CarThumb } from '../scene/BuildingPreview'

// The Garage's Trim tab (game/trim.ts): window tint, headlight colour and door handles, tried
// on the preview first and bought together; and three saved looks to put on any car.

const NONE: (Preset | null)[] = []

export function TrimShop({ car, trim, setTrim }: { car: OwnedCar; trim: Trim | undefined; setTrim: (t: Trim | null) => void }) {
  const level = useGame((s) => s.level)
  const buy = useGame((s) => s.setTrim)
  const bike = isBike(carDef(car.model).body)
  const now = tidyTrim(car.trim)
  const changed = !sameTrim(trim, now)
  const cost = trimCost(now, trim)
  const lock = trimLocked(level, now, trim)
  const pick = (kind: TrimKind, id: string) => {
    const next = tidyTrim({ ...trim, [kind]: id })
    setTrim(sameTrim(next, now) ? null : next ?? {})
  }
  // Bikes have no windows or doors: only the headlight.
  const kinds = bike ? TRIM_KINDS.filter((k) => k.id === 'lights') : TRIM_KINDS
  return (
    <div className="trim-shop">
      {changed && (
        <div className="try-bar on">
          <span className="try-what">Trying <b>new trim</b></span>
          <button className="try-cancel" onClick={() => setTrim(null)}>Undo</button>
          <button className="buy small" disabled={!!lock} onClick={() => { if (buy(car.uid, trim ?? {})) setTrim(null) }}>
            {lock ? `🔒 Level ${lock.level}` : `Buy · ${cost ? `$${cost.toLocaleString()}` : 'Free'}`}
          </button>
        </div>
      )}
      {kinds.map((k) => (
        <div key={k.id}>
          <h4>{k.name}</h4>
          <div className="trim-opts">
            {k.list.map((d) => {
              const on = (trim?.[k.id] ?? 'stock') === d.id
              const had = (now?.[k.id] ?? 'stock') === d.id
              const locked = !!d.level && level < d.level && !had
              return (
                <button key={d.id} className={`trim-opt${on ? ' sel' : ''}${locked ? ' locked' : ''}`} disabled={locked} onClick={() => pick(k.id, d.id)}>
                  <i className={`trim-chip trim-${k.id}`} style={{ background: d.color || car.color }} />
                  <b>{d.name}</b>
                  <small>{locked ? `🔒 Lv ${d.level}` : had ? '✔' : d.coins ? `$${d.coins.toLocaleString()}` : 'Free'}</small>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <Presets car={car} />
    </div>
  )
}

// Three slots: save this car's whole look, or put a saved one on it at the usual prices.
function Presets({ car }: { car: OwnedCar }) {
  const presets = useGame((s) => s.presets) ?? NONE
  const save = useGame((s) => s.savePreset)
  const apply = useGame((s) => s.applyPreset)
  const clear = useGame((s) => s.clearPreset)
  const d = carDef(car.model)
  return (
    <>
      <h4>Saved looks <small>Paint, panels and trim</small></h4>
      <div className="presets">
        {Array.from({ length: PRESET_SLOTS }, (_, i) => {
          const p = presets[i]
          return (
            <div key={i} className={p ? 'preset' : 'preset empty'}>
              {p ? (
                <>
                  <CarThumb size="sm" color={p.color} finish={p.finish} stripe={p.stripe} panels={p.panels} trim={p.trim} body={d.body} model={d.id} />
                  <span className="preset-row">
                    <button className="buy small" onClick={() => apply(i, car.uid)}>Use</button>
                    <button className="buy small alt" onClick={() => save(i, car.uid)} title="Replace with this car's look">💾</button>
                    <button className="sell small" onClick={() => clear(i)} aria-label="Delete">✕</button>
                  </span>
                </>
              ) : (
                <button className="buy small alt" onClick={() => save(i, car.uid)}>💾 Save this look</button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
