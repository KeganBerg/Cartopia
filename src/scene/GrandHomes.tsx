import type { NewModelProps } from './NewBuildings'

// Homes: victorian, villa, mansion (see "More homes" in game/data.ts). Stub until modelled.
export const GRAND_HOMES = new Set(['victorian', 'villa', 'mansion'])

export function GrandHomeModel({ def, m }: NewModelProps) {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[1.2, 1, 1.2]} />
      {m(def.color)}
    </mesh>
  )
}
