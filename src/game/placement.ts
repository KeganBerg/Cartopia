import { useGame, canPlace, lotSize, type PlacedBuilding } from './store'
import { buildingDef } from './data'
import { groupOf } from './merge'

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
export function roadTurn(b: Pick<PlacedBuilding, 'def' | 'x' | 'z'>, roads: Set<string>) {
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

// Turns the building picked in move mode a quarter turn in place, keeping it
// centred on the same spot. Its roads and driveway turn with it, and town cars
// park at whichever side turnOf says is the front.
export function rotateSelected() {
  const s = useGame.getState()
  const b = s.buildings.find((o) => o.uid === s.selected)
  if (s.mode !== 'move' || !b) return
  // A merged block turns as one building.
  if (groupOf(s.buildings, b.uid)) return void s.rotateBlock(b.uid)
  const from = turnOf(b, new Set(s.roads))
  const to = (from + 1) % 4
  const [w, h] = lotSize(b.def, from)
  const [w2, h2] = lotSize(b.def, to)
  const x = b.x + (w - w2) / 2
  const z = b.z + (h - h2) / 2
  // A 2x1 lot has no exact middle once turned. Round one way going sideways and
  // back the other way coming home, so turning all the way round lands where it began.
  const near = to % 2 ? Math.floor : Math.ceil
  const far = to % 2 ? Math.ceil : Math.floor
  const spots: [number, number][] = [[near(x), near(z)], [far(x), near(z)], [near(x), far(z)], [far(x), far(z)]]
  const spot = spots.find(([sx, sz]) => canPlace(s, b.def, sx, sz, to, b.uid))
  if (!spot || !s.moveBuilding(b.uid, spot[0], spot[1], to)) {
    s.toast('No room to turn it here. Drag it somewhere roomier first.')
  }
}

// R on desktop turns whatever is being placed or moved.
export function rotateCurrent() {
  if (useGame.getState().mode === 'move') rotateSelected()
  else rotatePlacement()
}
