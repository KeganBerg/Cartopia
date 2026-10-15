import { useEffect, useState } from 'react'
import { useGame, type OwnedCar } from '../game/store'
import { carDef } from '../game/data'
import { townToVisit } from '../lib/friends'
import { carPi, closePlayerCard, fetchPlayerCard, usePlayerCard, type PlayerCard } from '../lib/playerCard'
import { CarThumb } from '../scene/BuildingPreview'
import { CarInspect, CarPreview } from '../scene/CarPreview'
import { LikeButton } from './Meet'
import { PlayerName } from './Username'
import { LoadingBand } from './Loading'
import { Icon } from './Icon'

// Cars past this many stay off the strip: a big garage would draw dozens of thumbs.
const STRIP_MAX = 40

const lookOf = (c: OwnedCar) => {
  const d = carDef(c.model)
  return { body: d.body, model: d.id, color: c.color, finish: c.finish ?? 'gloss', stripe: c.stripe ?? null, skin: c.skin, modSkin: c.modSkin, panels: c.panels, trim: c.trim, mods: c.mods, hat: c.hat }
}

function Stat({ icon, n, tip }: { icon: string; n: number | string; tip: string }) {
  return (
    <div className="pc-stat" title={tip}>
      <span aria-hidden>{icon}</span>
      <b>{n}</b>
    </div>
  )
}

function Body({ card, start }: { card: PlayerCard; start?: string }) {
  const visit = useGame((s) => s.visit)
  const toast = useGame((s) => s.toast)
  const [pick, setPick] = useState(() => (start && card.cars.some((c) => c.uid === start) ? start : card.cars[0]?.uid))
  const [inspect, setInspect] = useState(false)
  const car = card.cars.find((c) => c.uid === pick) ?? card.cars[0]
  const go = async () => {
    const town = await townToVisit(card.ownerId)
    if (town === 'stale') return
    if (!town) return toast("Couldn't load that town")
    closePlayerCard()
    visit(town)
  }
  return (
    <>
      {card.crew && (
        <div className="pc-crew" title="Crew" style={{ ['--crew' as string]: card.crew.color }}>
          <span className="pc-emblem" aria-hidden>{card.crew.emblem}</span>
          <b>[{card.crew.tag}]</b> {card.crew.name}
        </div>
      )}
      <div className="pc-stats">
        <Stat icon="⭐" n={card.level} tip="Level" />
        <Stat icon="⚡" n={card.bestPi} tip="Best PI: their fastest car" />
        <Stat icon="🏁" n={card.raceWins} tip="Races won" />
        <Stat icon="🏆" n={card.trophies} tip="Trophies" />
      </div>
      {car ? (
        <>
          <div className="pc-view">
            {inspect ? (
              <>
                <div className="car-preview" />
                <CarInspect title={carDef(car.model).name} {...lookOf(car)} onClose={() => setInspect(false)} />
              </>
            ) : (
              <CarPreview key={car.uid} {...lookOf(car)} onExpand={() => setInspect(true)} />
            )}
            <div className="pc-car-name">
              <b>{carDef(car.model).name}</b>
              <span className="pc-pi" title="PI: performance index">PI {carPi(car)}</span>
            </div>
          </div>
          <div className="pc-strip" role="listbox" aria-label="Cars">
            {card.cars.slice(0, STRIP_MAX).map((c) => {
              const d = carDef(c.model)
              const on = c.uid === car.uid
              return (
                <button key={c.uid} role="option" aria-selected={on} className={on ? 'pc-chip on' : 'pc-chip'} onClick={() => setPick(c.uid)} title={d.name}>
                  <CarThumb size="sm" color={c.color} finish={c.finish} skin={c.skin} modSkin={c.modSkin} panels={c.panels} trim={c.trim} hat={c.hat} body={d.body} model={d.id} stripe={c.stripe} mods={c.mods} />
                  <small>{card.showcase.includes(c.uid) && <i aria-label="On show">⭐</i>}{carPi(c)}</small>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div className="pc-empty" aria-label="No cars yet">🚗 0</div>
      )}
      <div className="pc-acts">
        <LikeButton owner={card.ownerId} />
        <button className="buy pc-visit" onClick={go}>🏘️ Visit</button>
      </div>
    </>
  )
}

// The profile popup over the Car Meet: tap any player's name or car to open it.
export function PlayerCardPopup() {
  const open = usePlayerCard((s) => s.open)
  const [card, setCard] = useState<PlayerCard | null | 'none'>(null)
  useEffect(() => {
    if (!open) return
    let live = true
    setCard(null)
    fetchPlayerCard(open.id).then((c) => live && setCard(c ?? 'none'), () => live && setCard('none'))
    return () => { live = false }
  }, [open?.id])
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.car-inspect')) closePlayerCard() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open])
  // Leaving the meet closes it.
  useEffect(() => closePlayerCard, [])
  if (!open) return null
  return (
    <div className="overlay pc-overlay" onClick={closePlayerCard}>
      <div className="panel pc-card" role="dialog" aria-label="Player profile" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2><PlayerName id={open.id.startsWith('demo-') ? null : open.id} town={card && card !== 'none' ? card.townName : open.town} /></h2>
          <button className="close" aria-label="Close" onClick={closePlayerCard}><Icon name="close" size={16} /></button>
        </div>
        <div className="panel-body">
          {card === null && <LoadingBand label="Loading their garage" />}
          {card === 'none' && <div className="pc-empty">🚫</div>}
          {card && card !== 'none' && <Body key={card.ownerId} card={card} start={open.car} />}
        </div>
      </div>
    </div>
  )
}
