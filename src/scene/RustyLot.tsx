import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { MeshBasicMaterial } from 'three'
import { useGame, canPlace, lotSize } from '../game/store'
import { RUSTY_LOT, TILE, buildingDef } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { centerOf } from './World'
import { decal, LAYER } from './layers'

// While the tutorial asks for Rusty's Rescue, the lot the starter town keeps for it
// glows with a see-through Rusty's on it, so the player knows where it goes before
// opening the Shop. Placing it starts on the same lot (World's placement ghost), still glowing.
export function RustyLot() {
  // While placing, the pad keeps glowing under the placement ghost, which World draws.
  const placing = useGame((s) => s.mode === 'place' && s.placing === 'rescue')
  const show = useGame((s) => s.tutorial === 3 && (s.mode === 'play' || (s.mode === 'place' && s.placing === 'rescue')) && !s.visiting && !s.buildings.some((b) => b.def === 'rescue') && canPlace(s, 'rescue', ...RUSTY_LOT))
  const pad = useRef<MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (pad.current) pad.current.opacity = 0.35 + 0.25 * Math.sin(clock.elapsedTime * 3)
  })
  if (!show) return null
  const [w, h] = lotSize('rescue')
  const [cx, cz] = centerOf('rescue', ...RUSTY_LOT)
  return (
    <group position={[cx, 0, cz]}>
      <mesh rotation-x={-Math.PI / 2} position-y={LAYER.paint + 0.01}>
        <planeGeometry args={[w * TILE - 0.2, h * TILE - 0.2]} />
        <meshBasicMaterial ref={pad} color="#ffca28" transparent opacity={0.5} depthWrite={false} {...decal(2)} />
      </mesh>
      {!placing && <BuildingModel def={buildingDef('rescue')} ghost valid />}
    </group>
  )
}
