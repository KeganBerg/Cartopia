import type { NewModelProps } from './NewBuildings'

// Homes: cottage, bungalow, cabin (see "More homes" in game/data.ts). Stub until modelled.
export const COZY_HOMES = new Set(['cottage', 'bungalow', 'cabin'])

export function CozyHomeModel({ def, m }: NewModelProps) {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[1.2, 1, 1.2]} />
      {m(def.color)}
    </mesh>
  )
}
