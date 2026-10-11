// The one traffic sim the town scene drives, shared so other things in town
// (people on the pavements, say) can see the cars and the lights.
import { Traffic } from './sim'
import { lightAt } from './layout'

export const liveTraffic = new Traffic()

// May people cross the road on tile `tile` at its edge facing `side` (an
// intersection)? 'walk' while traffic heading into the intersection from that
// road has a red light, 'wait' otherwise, null where there are no lights (look
// both ways: liveTraffic.agents has every car's position and heading).
export function crossingSignal(tile: string, side: number): 'walk' | 'wait' | null {
  const { layout } = liveTraffic.net
  const t = layout.tiles.get(tile)
  if (!t) return null
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const j = layout.tiles.get(`${t.x + D[side][0]},${t.z + D[side][1]}`)
  const c = j && j.cluster >= 0 ? layout.clusters[j.cluster] : null
  if (!c?.signal) return null
  // Cars turning in from the cross street still use the crossing, so keep an
  // eye on them even on 'walk'.
  return lightAt(c.offset, side, liveTraffic.t, c.clear) === 'red' ? 'walk' : 'wait'
}
