import { Suspense, lazy, useEffect, type ComponentType } from 'react'
import type { AnyVenueId, WorldVenueId } from '../venues'

// The World Tour's own strips (one per country, see game/worldTour.ts). Each venue's scenery
// is its own chunk, fetched only when a race there starts (or the World Tour screen warms it),
// so nobody downloads nine countries to race in town.
// len: how far down the road to dress; race: the race's own length, where the finish is.
export type WorldProps = { len: number; race: number }

const LOAD: Record<WorldVenueId, () => Promise<{ default: ComponentType<WorldProps> }>> = {
  giza: () => import('./Giza'),
  jaipur: () => import('./Jaipur'),
  moscow: () => import('./Moscow'),
  shanghai: () => import('./Shanghai'),
  sydney: () => import('./Sydney'),
  rome: () => import('./Rome'),
  london: () => import('./London'),
  rio: () => import('./Rio'),
  vegas: () => import('./Vegas'),
}

export const WORLD_SCENERY = LOAD

// Lazy wrappers made once up front; nothing is fetched until one renders.
const VIEWS = Object.fromEntries(Object.entries(LOAD).map(([id, load]) => [id, lazy(load)])) as Partial<Record<string, ComponentType<WorldProps>>>

// Starts fetching a venue ahead of its race.
export function warmWorldVenue(id: AnyVenueId) {
  if (id in LOAD) LOAD[id as WorldVenueId]().catch(() => {})
}

export function WorldVenue({ id, len, race }: { id: AnyVenueId } & WorldProps) {
  // While this one races, fetch the tour's next stop, for the result screen's "next" button.
  useEffect(() => {
    const ids = Object.keys(LOAD)
    const i = ids.indexOf(id)
    if (i >= 0 && i + 1 < ids.length) warmWorldVenue(ids[i + 1] as WorldVenueId)
  }, [id])
  const View = VIEWS[id]
  if (!View) return null
  return (
    <Suspense fallback={null}>
      <View len={len} race={race} />
    </Suspense>
  )
}
