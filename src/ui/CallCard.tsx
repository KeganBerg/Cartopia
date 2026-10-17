import './call-cards.css'
import { callCardDef, callCardOr, TIER_NAME } from '../game/callCards'
import { useGame } from '../game/store'
import { raceCarOf } from '../game/raceCar'
import { carDef } from '../game/data'
import { CarThumb } from '../scene/BuildingPreview'

// A Call Card's animated scene (call-cards.css), filling whatever holds it (position it yourself).
// `tint`: the Showroom card's colour (a rival's or player's car colour). `still`: no motion
// (picker swatches, so a grid of them costs nothing).
export function CallCardArt({ id, tint, still }: { id?: string | null; tint?: string; still?: boolean }) {
  const cid = callCardOr(id)
  return (
    <span className={`cc cc-${cid}${still ? ' still' : ''}`} style={tint ? { ['--cc' as string]: tint } : undefined} aria-hidden>
      <i className="cc-c" /><i className="cc-a" /><i className="cc-b" />
    </span>
  )
}

// The classes for whatever holds a card: its tier frame (cc-tier-rare...; none for the Showroom)
// and its stage (cc-on-neonalley...: where its ground is and the colour of its light, call-cards.css).
export const callCardTier = (id?: string | null) => {
  const cid = callCardOr(id)
  const t = callCardDef(cid)?.tier
  return `${t ? ` cc-tier-${t}` : ''} cc-on-${cid}`
}

// Under a car on a card (a holder with the cc-stage class): the pool of the card's light on its
// ground, the shadow the car casts there and the glow behind it, so the car stands in the scene
// rather than in front of it. One still layer.
export function CallCardGround({ tint }: { tint?: string }) {
  return <i className="cc-ground" style={tint ? { ['--cc' as string]: tint } : undefined} aria-hidden />
}

// "Call Card: Neon Alley · Rare", for a tap tip.
export function callCardTip(id?: string | null) {
  const d = callCardDef(callCardOr(id))!
  return `Call Card: ${d.name}${d.tier ? ` · ${TIER_NAME[d.tier]}` : ''}`
}

// A Call Card with the player's race car standing on it: the picker's preview and a crate prize.
export function CallCardShowcase({ id, still, className }: { id?: string | null; still?: boolean; className?: string }) {
  const car = useGame((s) => raceCarOf(s.cars, s.raceCar))
  const d = car ? carDef(car.model) : null
  return (
    <span className={`cc-show cc-stage${callCardTier(id)}${className ? ` ${className}` : ''}`}>
      <CallCardArt id={id} tint={car?.color} still={still} />
      {car && d && <CallCardGround tint={car.color} />}
      {car && d && (
        <span className="cc-show-car">
          <CarThumb stand body={d.body} model={d.id} color={car.color} finish={car.finish} skin={car.skin} modSkin={car.modSkin} panels={car.panels} trim={car.trim} stripe={car.stripe} mods={car.mods} hat={car.hat} />
        </span>
      )}
    </span>
  )
}
