import { useState } from 'react'
import { useGame, type OwnedCar } from '../game/store'
import { COWBOY_COLORS, HATS, HAT_PAINTS, cleanHat, hatChoices, hatDef, hatPaint, hatProgress, ownedHats, sameHat, type HatDef, type HatFit } from '../game/hats'
import { HatThumb } from '../scene/BuildingPreview'

// undefined: not trying anything; null: trying no hat.
export type HatTry = HatFit | null | undefined

const COLOUR_NAMES: Record<string, string> = {
  ...Object.fromEntries(HAT_PAINTS.map((p) => [p.color, p.name])),
  [COWBOY_COLORS[0]]: 'Brown', [COWBOY_COLORS[1]]: 'Dark brown', [COWBOY_COLORS[2]]: 'Black',
}

// How a hat you don't have is won: its challenge's icon and progress, or 📦 for crates only.
function how(d: HatDef, n: number) {
  return d.challenge ? `${d.challenge.icon} ${Math.min(n, d.challenge.goal)}/${d.challenge.goal}` : '🔒 📦'
}
// The tooltip: the challenge, and the crates it drops from.
function hint(d: HatDef) {
  const c = d.challenge ? `${d.challenge.name}: ${d.challenge.text}` : ''
  const box = d.crates?.length ? `${d.challenge ? 'or f' : 'F'}ound in crates` : ''
  return [d.name, c, box].filter(Boolean).join(' · ')
}

function Swatches({ colors, on, pick }: { colors: string[]; on: string; pick: (c: string) => void }) {
  return (
    <div className="paints">
      {colors.map((c) => (
        <button key={c} title={COLOUR_NAMES[c] ?? c} aria-label={COLOUR_NAMES[c] ?? c} className={c === on ? 'dot big sel' : 'dot big'} style={{ backgroundColor: c }} onClick={() => pick(c)} />
      ))}
    </div>
  )
}

// Colours for the hat being tried: swatches, and for caps a one or two colour switch.
function HatColours({ d, hat, set }: { d: HatDef; hat: HatFit; set: (colors: string[]) => void }) {
  const choices = hatChoices(d)!
  const [a, b] = hatPaint(hat)
  const [two, setTwo] = useState(d.colors === 'twoTone' && a !== b)
  if (d.colors !== 'twoTone') return <><h4>Colour</h4><Swatches colors={choices} on={a} pick={(c) => set([c])} /></>
  const second = b !== a ? b : choices.find((c) => c !== a && c === d.base[1]) ?? choices.find((c) => c !== a)!
  return (
    <>
      <div className="hat-tone" role="radiogroup" aria-label="Colours">
        <button role="radio" aria-checked={!two} className={two ? '' : 'sel'} onClick={() => { setTwo(false); set([a]) }}>1 colour</button>
        <button role="radio" aria-checked={two} className={two ? 'sel' : ''} onClick={() => { setTwo(true); set([a, second]) }}>2 colours</button>
      </div>
      <h4>{two ? 'Top' : 'Colour'}</h4>
      <Swatches colors={choices} on={a} pick={(c) => set(two ? [c, second] : [c])} />
      {two && <>
        <h4>Front &amp; brim</h4>
        <Swatches colors={choices} on={second} pick={(c) => set([a, c])} />
      </>}
    </>
  )
}

// The Garage's Hats tab: tap a hat to try it on the preview, pick its colours, then wear it from the bar.
// Hats you don't have show how they're won: a challenge's progress, or crates.
export function HatShop({ car, trying, setTrying }: { car: OwnedCar; trying: HatTry; setTrying: (h: HatTry) => void }) {
  const hats = useGame((s) => s.hats)
  const stats = useGame((s) => s.stats)
  const hatQuest = useGame((s) => s.hatQuest)
  const hatCar = useGame((s) => s.hatCar)
  const owned = ownedHats({ hats })
  const now = cleanHat(car.hat)
  const pick = trying === undefined ? now : trying
  const d = hatDef(pick?.id)
  const changed = trying !== undefined && !sameHat(trying, now)
  const tryOn = (h: HatFit | null) => setTrying(sameHat(h, now) ? undefined : h)
  const go = () => { if (hatCar(car.uid, pick ?? null)) setTrying(undefined) }
  const has = !!d && owned.includes(d.id)
  return (
    <div className="hat-shop">
      {changed && (
        <div className="try-bar on">
          <span className="try-what">{d ? <><span aria-hidden>{d.icon}</span> <b>{d.name}</b></> : <>No hat</>}</span>
          <button className="try-cancel" onClick={() => setTrying(undefined)}>Undo</button>
          {!d ? (
            <button className="buy small" onClick={go}>Take off</button>
          ) : has ? (
            <button className="buy small" onClick={go}>Wear</button>
          ) : (
            <span className="skin-how" title={hint(d)}>{how(d, hatProgress(d, { stats, hatQuest }))}</span>
          )}
        </div>
      )}
      <h4>Hats <small>{owned.length}/{HATS.length}</small></h4>
      <div className="hat-grid">
        <button className={`hat-opt${pick ? '' : ' sel'}`} onClick={() => tryOn(null)} title="No hat">
          <i className="hat-none" aria-hidden>∅</i>
          <b>None</b>
        </button>
        {HATS.map((h) => {
          const mine = owned.includes(h.id)
          const shown: HatFit = pick?.id === h.id ? pick : now?.id === h.id ? now : { id: h.id }
          return (
            <button key={h.id} className={`hat-opt${pick?.id === h.id ? ' sel' : ''}${mine ? ' owned' : ' locked'}`} title={hint(h)}
              onClick={() => tryOn(pick?.id === h.id ? pick : shown)}>
              <HatThumb hat={shown} size="xs" />
              <b>{h.name}</b>
              <small>{mine ? '✔' : how(h, hatProgress(h, { stats, hatQuest }))}</small>
            </button>
          )
        })}
      </div>
      {d && pick && hatChoices(d) && <HatColours key={d.id} d={d} hat={pick} set={(colors) => tryOn(cleanHat({ id: d.id, colors }))} />}
    </div>
  )
}
