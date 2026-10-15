import type { ReactNode } from 'react'
import { DECOR_GROWTH, TILE, type BuildingDef } from '../game/data'
import { PAL } from './season'
import { glowMats } from './dayNight'

// Gardens, parks, statues and fountains grow in place as they level up (2-5), drawn around
// the level 1 model on the same lot. Gardens fill out: a hedge border, then flowers, then
// trees in the corners, then lamps and more trees. Statues and fountains rise onto a stepped
// plinth, then get corner fountains, lamps and a ring of flowers. (The Clock Tower grows its
// own shaft, in NewBuildings.)

type Mat = (color: string) => ReactNode
type Props = { def: BuildingDef; level: number; ghost?: boolean; m: Mat; bulb: ReactNode; children: ReactNode }

const FLOWERS = ['#e91e63', '#ffeb3b', '#ab47bc', '#ff7043', '#f48fb1', '#fff176']
const WATER = '#4fc3f7'
const STONE = '#e0ddd5'

function Tree({ x, z, s = 1, m }: { x: number; z: number; s?: number; m: Mat }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.05, 0.07, 0.6, 6]} />{m('#6d4c41')}</mesh>
      <mesh position={[0, 0.78, 0]} castShadow><sphereGeometry args={[0.3, 10, 8]} />{m(PAL.leaves[0])}</mesh>
      <mesh position={[0.1, 0.98, 0.05]} castShadow><sphereGeometry args={[0.2, 8, 6]} />{m(PAL.leaves[2])}</mesh>
    </group>
  )
}

function Lamp({ x, z, m, bulb, lit, h = 1.1 }: { x: number; z: number; m: Mat; bulb: ReactNode; lit: boolean; h?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]}><cylinderGeometry args={[0.022, 0.03, h, 6]} />{m('#37474f')}</mesh>
      {/* Lit in the city's street light colour (Menu > Town), like the street lamps. */}
      <mesh position={[0, h + 0.06, 0]}><sphereGeometry args={[0.07, 10, 8]} />{lit ? <primitive object={glowMats.lamp} attach="material" dispose={null} /> : bulb}</mesh>
    </group>
  )
}

function Garden({ def, level, ghost, m, bulb, children }: Props) {
  const hw = (def.w * TILE) / 2 - 0.1
  const hd = (def.h * TILE) / 2 - 0.1
  const flowers: [number, number][] = []
  if (level >= 3) {
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6 - 0.5
      flowers.push([t * hw * 1.7, -hd + 0.22], [t * hw * 1.7, hd - 0.22])
      if (i % 2 === 0) flowers.push([-hw + 0.22, t * hd * 1.7], [hw - 0.22, t * hd * 1.7])
    }
  }
  return (
    <group>
      {children}
      {/* Level 2: a low clipped hedge round the lot, open at the front, and kept below the sign there. */}
      {[[-1, 0], [1, 0]].map(([sx], i) => (
        <mesh key={`s${i}`} position={[sx * hw, 0.13, 0]} castShadow><boxGeometry args={[0.16, 0.26, hd * 2]} />{m(PAL.bush[0])}</mesh>
      ))}
      <mesh position={[0, 0.13, -hd]} castShadow><boxGeometry args={[hw * 2, 0.26, 0.16]} />{m(PAL.bush[0])}</mesh>
      {[-1, 1].map((sx) => (
        <mesh key={`f${sx}`} position={[sx * hw * 0.62, 0.05, hd]} castShadow><boxGeometry args={[hw * 0.76, 0.1, 0.16]} />{m(PAL.bush[0])}</mesh>
      ))}
      {/* Level 3: flowers in the beds along the hedge. */}
      {flowers.map(([x, z], i) => (
        <mesh key={`fl${i}`} position={[x, 0.07, z]}><sphereGeometry args={[0.09, 8, 6]} />{m(FLOWERS[i % FLOWERS.length])}</mesh>
      ))}
      {/* Level 4: a tree in every corner. */}
      {level >= 4 && [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => <Tree key={`t${i}`} x={sx * (hw - 0.3)} z={sz * (hd - 0.3)} s={def.w > 1 ? 1.2 : 0.8} m={m} />)}
      {/* Level 5: lamps either side of the gate and more trees along the back. */}
      {level >= 5 && (
        <>
          {/* (The koi garden's red gate and the botanical garden's rose arch stand in the opening,
              with their own lanterns and lamps, so they skip these.) */}
          {def.id !== 'koi' && def.id !== 'garden' && [-1, 1].map((sx) => <Lamp key={`l${sx}`} x={sx * hw * 0.22} z={hd} m={m} bulb={bulb} lit={!ghost} />)}
          {[-1, 1].map((sx) => <Lamp key={`b${sx}`} x={sx * hw} z={0} m={m} bulb={bulb} lit={!ghost} />)}
          {def.w > 1 && [-0.35, 0.35].map((t) => <Tree key={`bt${t}`} x={t * hw * 2} z={-hd + 0.3} s={1} m={m} />)}
        </>
      )}
    </group>
  )
}

function Statue({ def, level, ghost, m, bulb, children }: Props) {
  // A stepped plinth that gets taller with each level.
  const steps = Math.min(3, level - 1)
  const rise = steps * 0.1
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => (
        <mesh key={`p${i}`} position={[0, 0.05 + i * 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.9 - i * 0.18, 0.1, 1.9 - i * 0.18]} />
          {m(i % 2 ? '#d7ccc8' : STONE)}
        </mesh>
      ))}
      <group position-y={rise}>{children}</group>
      {/* Level 3: a little fountain at each corner. */}
      {level >= 3 && [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <group key={`f${i}`} position={[sx * 0.78, 0, sz * 0.78]}>
          <mesh position={[0, 0.13, 0]} castShadow><cylinderGeometry args={[0.17, 0.19, 0.18, 12]} />{m(STONE)}</mesh>
          <mesh position={[0, 0.225, 0]}><cylinderGeometry args={[0.14, 0.14, 0.02, 12]} />{m(WATER)}</mesh>
          <mesh position={[0, 0.36, 0]}><coneGeometry args={[0.06, 0.26, 8]} />{m('#b3e5fc')}</mesh>
        </group>
      ))}
      {/* Level 4: a lamp each side, standing on the bottom step clear of the next one and of
          the plaque at the front (a fountain's basin fills the plinth, so it has none). */}
      {level >= 4 && def.id !== 'fountain' && [-1, 1].map((sx) => <Lamp key={`l${sx}`} x={sx * 0.905} z={0} m={m} bulb={bulb} lit={!ghost} h={0.9} />)}
      {/* Level 5: a gold band round the top step and flowers round the base. */}
      {level >= 5 && (
        <>
          <mesh position={[0, rise + 0.01, 0]}><boxGeometry args={[1.58, 0.03, 1.58]} />{m('#ffc107')}</mesh>
          {Array.from({ length: 12 }, (_, i) => {
            const a = ((i + 0.5) / 12) * Math.PI * 2
            return <mesh key={`r${i}`} position={[Math.cos(a) * 0.95, 0.08, Math.sin(a) * 0.95]}><sphereGeometry args={[0.07, 8, 6]} />{m(FLOWERS[i % FLOWERS.length])}</mesh>
          })}
        </>
      )}
    </group>
  )
}

export function DecorLevels(p: Props) {
  const g = DECOR_GROWTH[p.def.id]
  if (g === 'garden') return <Garden {...p} />
  if (g === 'statue') return <Statue {...p} />
  return <>{p.children}</>
}
