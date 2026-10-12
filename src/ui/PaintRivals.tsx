import { useGame, type OwnedCar } from '../game/store'
import { CARS, PAINTS, SKILLS, carDef } from '../game/data'
import { DIST } from '../game/distance'
import { PAINT_RIVALS, PAINTS_TO_COLLECT, TIERS, paintRival, paintsOpen, rowPrize, rowSkills, type PaintRival } from '../game/paintRivals'
import { venue as venueById } from '../scene/venues'
import { CarThumb } from '../scene/BuildingPreview'
import { openGarageTab } from './Menus'
import { openRaceTab } from './Race'
import { artStyle } from './venueArt'
import { TileClip } from './TileClip'

// Paint rivals screen (game/paintRivals.ts): every rival as a car tile in their colour,
// the one picked on a venue banner, and their colour on your own car as the prize.
// The race bar's button races the picked rival.

const flames = (r: PaintRival) => '🔥'.repeat(r.tier)
const paintName = (r: PaintRival) => PAINTS.find((p) => p.color === r.paint)?.name ?? 'Paint'
const money = (n: number) => (n >= 10000 ? `$${Math.round(n / 1000)}k` : `$${n.toLocaleString()}`)

// The rival the screen opens on: one asked for (a locked swatch in the Paint Shop), else the
// easiest one not yet beaten.
let nextPick: string | null = null
export function firstRowPick(row: Record<string, number>) {
  const asked = nextPick
  nextPick = null
  return asked ?? (PAINT_RIVALS.find((r) => !(row[r.id] > 0)) ?? PAINT_RIVALS[0]).id
}
export function openPaintRival(id: string) {
  nextPick = id
  openRaceTab('rivals')
}

export const rowPrizeOf = (r: PaintRival, row: Record<string, number>) => rowPrize(r, !(row[r.id] > 0))

export function PaintRivals({ sel, setSel, car }: { sel: string; setSel: (id: string) => void; car: OwnedCar | undefined }) {
  const row = useGame((s) => s.rivalRow)
  const r = paintRival(sel) ?? PAINT_RIVALS[0]
  const beaten = (row[r.id] ?? 0) > 0
  const v = venueById(r.venue)
  const rc = carDef(r.car)
  const d = car ? carDef(car.model) : CARS[0]
  return (
    <div className="rm-split rm-prow" style={{ '--pr': r.paint } as React.CSSProperties}>
      <div className="rm-left">
        <div className={`rm-banner rm-photo${r.night ? ' rm-night' : ''}`} style={artStyle('tour', r.venue, r.night)}>
          <TileClip mode="tour" venue={r.venue} night={r.night} />
          <span className="rm-eyebrow">{v.icon} {v.name}{r.night && ' · 🌙'} · {DIST[r.dist].label}</span>
          <b className="rm-ttl">{r.icon} {r.name}</b>
          <span className="rv-bubble">{r.line}</span>
          <span className="rm-chips">
            <span title={TIERS[r.tier]}>{flames(r)}</span>
            <span>PI {r.pi}</span>
            {rowSkills(r) && rc.skill && <span title={`${SKILLS[rc.skill].name}: ${SKILLS[rc.skill].text}`}>{SKILLS[rc.skill].icon}</span>}
            <span className={beaten ? 'got' : ''}>{beaten ? `✔ ×${row[r.id]}` : `🏁 ${money(rowPrizeOf(r, row))}`}</span>
          </span>
        </div>
        <div className={`ev-reward pr-reward${beaten ? ' got' : ''}`}>
          <div className="ev-reward-car">
            <CarThumb size="lg" color={r.paint} finish={car?.finish} body={d.body} model={d.id} stripe={car?.stripe} mods={car?.mods} />
            <span className="ev-reward-state">{beaten ? '✔' : '🔒'}</span>
          </div>
          <div className="ev-reward-info">
            <b>{paintName(r)}</b>
            <span className="ev-reward-chips"><i className="pr-swatch" style={{ background: r.paint }} /><em>🎨 Paint</em></span>
          </div>
        </div>
      </div>
      <div className="rm-right">
        <div className="pr-grid" role="listbox" aria-label="Paint rivals">
          {PAINT_RIVALS.map((x) => {
            const won = (row[x.id] ?? 0) > 0
            const xc = carDef(x.car)
            return (
              <button key={x.id} role="option" aria-selected={x.id === r.id} aria-label={x.name} title={`${x.name} · ${TIERS[x.tier]}`}
                className={`pr-tile t${x.tier}${x.id === r.id ? ' sel' : ''}${won ? ' done' : ''}`} style={{ '--pr': x.paint } as React.CSSProperties}
                onClick={() => setSel(x.id)}>
                <CarThumb size="xs" color={x.paint} body={xc.body} model={xc.id} />
                <span className="pr-face" aria-hidden>{x.icon}</span>
                {won && <span className="pr-tick" aria-hidden>✔</span>}
                <small>{flames(x)}</small>
                <b>PI {x.pi}</b>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const rowChip = (row: Record<string, number>, oldPaints?: boolean) => `🎨 ${paintsOpen({ rivalRow: row, oldPaints })}/${PAINTS_TO_COLLECT}`

// After the first win over a rival: their colour on your car, and a button to go paint it.
export function PaintPrizePopup() {
  const id = useGame((s) => s.paintPrize)
  const close = useGame((s) => s.closePaintPrize)
  const cars = useGame((s) => s.cars)
  const raceCar = useGame((s) => s.raceCar)
  const r = id ? paintRival(id) : null
  if (!r) return null
  const car = cars.find((c) => c.uid === raceCar) ?? cars[0]
  const d = car ? carDef(car.model) : CARS[0]
  const paintIt = () => {
    close()
    if (car) openGarageTab('paint', { car: car.uid, color: r.paint })
  }
  return (
    <div className="overlay prize-overlay">
      <div className="prize pr-prize" style={{ '--pr': r.paint } as React.CSSProperties}>
        <h2>{r.icon} {r.name} beaten!</h2>
        <CarThumb size="lg" color={r.paint} finish={car?.finish} body={d.body} model={d.id} stripe={car?.stripe} mods={car?.mods} />
        <h3><i className="pr-swatch" style={{ background: r.paint }} /> {paintName(r)} unlocked</h3>
        <div className="row">
          <button className="buy alt" onClick={close}>Nice!</button>
          {car && <button className="buy" onClick={paintIt}>🎨 Paint it</button>}
        </div>
      </div>
    </div>
  )
}
