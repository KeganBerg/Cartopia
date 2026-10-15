import type { NewModelProps } from './NewBuildings'

// Homes: townhouse, duplex, condos (see "More homes" in game/data.ts). Stub until modelled.
export const CITY_HOMES = new Set(['townhouse', 'duplex', 'condos'])

export function CityHomeModel({ def, m }: NewModelProps) {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[1.2, 1, 1.2]} />
      {m(def.color)}
    </mesh>
  )
}
