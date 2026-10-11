import { useGame, hasRusty } from '../game/store'
import { CAR_SETS, CARS, carDef, carSource, setOwned, type CarSet } from '../game/data'
import { CarThumb } from '../scene/BuildingPreview'

// The collection book: every car grouped into sets. Owned cars show in their
// colours, missing ones as silhouettes with where to find them. A full set
// pays a one-time reward.
export function CollectionBook({ onFind }: { onFind: (model: string) => void }) {
  const cars = useGame((s) => s.cars)
  const claimed = useGame((s) => s.claimedSets)
  const owned = new Set(cars.map((c) => c.model))
  const total = CARS.filter((c) => owned.has(c.id)).length
  return (
    <div className="book">
      <div className="book-progress">
        <b>📖 {total} / {CARS.length}</b>
        <span className="book-bar"><i style={{ width: `${(100 * total) / CARS.length}%` }} /></span>
        <small>{claimed.length} / {CAR_SETS.length} sets</small>
      </div>
      {CAR_SETS.map((set) => <SetRow key={set.id} set={set} onFind={onFind} />)}
    </div>
  )
}

function SetRow({ set, onFind }: { set: CarSet; onFind: (model: string) => void }) {
  const cars = useGame((s) => s.cars)
  const done = useGame((s) => s.claimedSets.includes(set.id))
  const claim = useGame((s) => s.claimSet)
  const have = setOwned(set, cars)
  const ready = !done && have === set.cars.length
  return (
    <section className={`book-set ${ready ? 'ready' : ''} ${done ? 'done' : ''}`}>
      <header>
        <span className="book-icon">{set.icon}</span>
        <span className="book-name">{set.name} <small>{have}/{set.cars.length}</small></span>
        <span className="book-reward" title="Set reward">
          <span>💰{set.coins.toLocaleString()}</span><span className="bk">B{set.bucks}</span><span>🏆{set.trophies}</span>
        </span>
        {done ? <span className="book-claimed">✔</span> : ready ? <button className="buy small book-claim" onClick={() => claim(set.id)}>Claim!</button> : null}
      </header>
      <div className="book-cars">
        {set.cars.map((m) => {
          const def = carDef(m)
          const mine = cars.find((c) => c.model === m)
          if (mine) {
            return (
              <div key={m} className="book-car" title={def.name}>
                <CarThumb size="sm" color={mine.color} body={def.body} stripe={mine.stripe} mods={mine.mods} />
                <span className="book-car-name">{def.name}</span>
              </div>
            )
          }
          const src = carSource(def)
          return (
            <button key={m} className="book-car missing" title={`${def.name}: ${src.text}`} onClick={() => onFind(m)}>
              <CarThumb size="sm" color="#37474f" body={def.body} />
              <span className="book-car-name">{def.name}</span>
              <span className="book-src">{src.icon} {src.text}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// Where tapping a missing car goes: the Showroom card, or Rusty's.
export function useFindCar(showShowroom: (model: string) => void) {
  const openPanel = useGame((s) => s.openPanel)
  const openShop = useGame((s) => s.openShop)
  const rusty = useGame((s) => hasRusty(s))
  return (model: string) => {
    if (!carDef(model).rescueOnly) return showShowroom(model)
    if (rusty) openPanel('rescue')
    else openShop('rescue')
  }
}
