import { useGame } from '../game/store'
import { lampPost, type LampPost as Design } from '../game/cityLook'
import { glowMats } from './dayNight'
import { HaloSpot } from './halos'
import { PropMesh } from './propKit'
import { globeLamp, streetLamp } from './streetProps'
import { DECOR_PROPS } from './decorProps'

// Where each design's light sits, with the post at the origin and its arm out over -z.
const HEAD: Record<Exclude<Design, 'auto'>, [number, number, number]> = {
  cobra: [0, 1.7, -0.44],
  lantern: [0, 1.56, -0.4],
  globe: [0, 1.68, 0],
}

// The city's lamp post design (Menu > Town). `auto` keeps the lamp's own design.
export function useLampDesign(own: Exclude<Design, 'auto'>) {
  const post = useGame((s) => lampPost(s.lights))
  return post === 'auto' ? own : post
}

// A street lamp in one design, lit at night in the city's light colour, with its pool of light.
export function LampPost({ design, pool = 0.95, poolY = 0.09 }: { design: Exclude<Design, 'auto'>; pool?: number; poolY?: number }) {
  const [hx, hy, hz] = HEAD[design]
  return (
    <group>
      {design === 'cobra' && <PropMesh parts={streetLamp()} />}
      {design === 'lantern' && <group rotation-y={Math.PI / 2}><PropMesh parts={DECOR_PROPS.lamp()} /></group>}
      {design === 'globe' && <PropMesh parts={globeLamp()} />}
      <mesh rotation-x={-Math.PI / 2} position={[hx, poolY, hz - (design === 'cobra' ? 0.06 : 0)]} renderOrder={2}>
        <planeGeometry args={[pool * 2, pool * 2]} />
        <primitive object={glowMats.lampPool} attach="material" dispose={null} />
      </mesh>
      <HaloSpot at={[hx, hy, hz]} />
    </group>
  )
}
