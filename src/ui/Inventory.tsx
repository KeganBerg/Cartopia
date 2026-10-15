import { useGame, type PlacedBuilding } from '../game/store'
import { buildingDef, buildingLevel } from '../game/data'
import { BuildingThumb } from '../scene/BuildingPreview'
import { themeFor } from '../game/cityLook'
import { Panel } from './Menus'
import { Icon } from './Icon'

const NONE: PlacedBuilding[] = []

// Bulldozed buildings and decor, kept with their level. A tap places one again for free.
export function InventoryPanel() {
  const stored = useGame((s) => s.stored ?? NONE)
  const pickStored = useGame((s) => s.pickStored)
  const city = useGame((s) => s.cityTheme)
  // One card per building type and level, with how many are waiting.
  const groups = new Map<string, PlacedBuilding[]>()
  for (const b of stored) {
    const k = `${b.def}|${buildingLevel(b)}|${b.tint ?? ''}`
    groups.set(k, [...(groups.get(k) ?? []), b])
  }
  const cards = [...groups.values()].sort((a, b) => buildingLevel(b[0]) - buildingLevel(a[0]) || buildingDef(a[0].def).name.localeCompare(buildingDef(b[0].def).name))
  return (
    <Panel title="Inventory" wide>
      {cards.length === 0 ? (
        <div className="inv-empty">
          <Icon name="bulldoze" size={40} />
          <div>Bulldozed buildings land here</div>
        </div>
      ) : (
        <div className="cards rows">
          {cards.map((list) => {
            const b = list[0]
            const d = buildingDef(b.def)
            const lvl = buildingLevel(b)
            return (
              <button key={`${b.def}|${lvl}|${b.tint ?? ''}`} className="card inv-card" onClick={() => pickStored(b.uid)}>
                <BuildingThumb def={d} level={lvl} theme={themeFor(b.tint, city, d.kind === 'decor')} />
                <div className="card-text">
                  <div className="card-name">{d.name}</div>
                  {lvl > 1 && <div className="card-stat">⭐ Level {lvl}</div>}
                </div>
                {list.length > 1 && <span className="inv-count">×{list.length}</span>}
                <span className="price">Place</span>
              </button>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
