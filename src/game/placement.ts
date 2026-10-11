import { useGame, type PlacedBuilding } from './store'
import { buildingDef } from './data'

// The turn the placement ghost currently shows, so Rotate turns from what the player sees.
let ghostTurn = 0

export function setGhostTurn(t: number) {
  ghostTurn = t
}

// Turns the building being placed a quarter turn clockwise.
export function rotatePlacement() {
  const s = useGame.getState()
  if (s.mode !== 'place' || !s.placing) return
  s.setPlaceRot(((s.placeRot ?? ghostTurn) + 1) % 4)
}

// Quarter turns that point a building's front at an adjacent road. Non-square lots can only flip.
function roadTurn(b: Pick<PlacedBuilding, 'def' | 'x' | 'z'>, roads: Set<string>) {
  const d = buildingDef(b.def)
  const edge = (dir: 'S' | 'E' | 'N' | 'W') => {
    for (let i = 0; i < Math.max(d.w, d.h); i++) {
      const t =
        dir === 'S' ? [b.x + i, b.z + d.h] : dir === 'N' ? [b.x + i, b.z - 1]
        : dir === 'E' ? [b.x + d.w, b.z + i] : [b.x - 1, b.z + i]
      const inRange = dir === 'S' || dir === 'N' ? i < d.w : i < d.h
      if (inRange && roads.has(`${t[0]},${t[1]}`)) return true
    }
    return false
  }
  const square = d.w === d.h
  if (edge('S')) return 0
  if (square && edge('E')) return 1
  if (edge('N')) return 2
  if (square && edge('W')) return 3
  return 0
}

// The player's chosen turn, or else face the road. Decorations face south unless turned.
export function turnOf(b: Pick<PlacedBuilding, 'def' | 'x' | 'z' | 'rot'>, roads: Set<string>) {
  if (b.rot != null) return b.rot
  const kind = buildingDef(b.def).kind
  return kind === 'decor' || kind === 'obstacle' ? 0 : roadTurn(b, roads)
}
