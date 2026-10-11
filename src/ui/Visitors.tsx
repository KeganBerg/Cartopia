import { Vector3 } from 'three'
import { useGame } from '../game/store'
import { carDef, performance } from '../game/data'
import { anchors, anchorRef } from '../scene/anchors'
import { centerOf } from '../scene/World'
import { useNow } from '../scene/useNow'
import { CarThumb } from '../scene/BuildingPreview'
import { useVisitors, tapVisitor, leave } from '../lib/visitors'
import { openStreetRace } from './Race'
import { Panel } from './Menus'

// The bubble over a visitor in town: over its car, or over Rusty's for a barn tip.
export function VisitorBadges() {
  const v = useVisitors((s) => s.visitor)
  const busy = useVisitors((s) => s.busy)
  const show = useGame((s) => !s.visiting && s.mode === 'play')
  const rusty = useGame((s) => s.buildings.find((b) => b.def === 'rescue'))
  const now = useNow()
  if (!v || v.gone || !show) return null
  let id = `car:visitor:${v.id}`
  if (v.kind === 'barn') {
    if (!rusty) return null
    const [x, z] = centerOf(rusty.def, rusty.x, rusty.z, rusty.rot)
    id = `tip:${rusty.uid}`
    anchors.set(id, new Vector3(x, 3.7, z))
  }
  const left = Math.max(0, Math.ceil((v.expiresAt - now) / 1000))
  const label = v.kind === 'racer' ? '🏁 Race me!'
    : v.kind === 'tourist' ? <>📸 <span className="coin">$</span></>
    : v.kind === 'mystery' ? <>❓ <span className="time">{left}s</span></>
    : '📞 Barn tip!'
  return (
    <div className="badges">
      <div className="anchor" data-clamp ref={anchorRef(id)}>
        <button className={`badge badge-visitor badge-visitor-${v.kind}`} disabled={busy} onClick={tapVisitor}>{label}</button>
      </div>
    </div>
  )
}

// A street racer's challenge: who they are, and what beating them pays. Racing them costs no fuel.
export function StreetRaceCard() {
  const v = useVisitors((s) => s.visitor)
  const open = useVisitors((s) => s.card)
  const cars = useGame((s) => s.cars)
  if (!open || !v || v.kind !== 'racer' || v.gone) return null
  const best = Math.max(0, ...cars.map((c) => performance(carDef(c.model), c.upgrades, c.mods)))
  const close = () => useVisitors.setState({ card: false })
  const odds = v.pi <= best ? 'Even match' : v.pi - best < 8 ? 'Tough' : 'Very tough'
  return (
    <Panel title="Street challenge" onClose={close}>
      <div className="street-card">
        <CarThumb size="sm" color={v.color} body={v.body} model={v.model} stripe="#fafafa" />
        <div>
          <b>{v.name}</b>
          <small>{carDef(v.model).name} · PI {v.pi} · {odds}</small>
        </div>
      </div>
      <div className="street-prize">
        <span>Win: race prize +</span>
        {v.coins > 0 && <span className="chip">${v.coins.toLocaleString()}</span>}
        {v.parts > 0 && <span className="chip">⚙ {v.parts}</span>}
        {v.bucks > 0 && <span className="chip">B{v.bucks}</span>}
        <span className="chip free">⛽ Free race</span>
      </div>
      <div className="street-actions">
        <button className="buy" onClick={() => { close(); openStreetRace(v) }}>Race!</button>
        <button className="ghost" onClick={() => { close(); leave() }}>No thanks</button>
      </div>
    </Panel>
  )
}
