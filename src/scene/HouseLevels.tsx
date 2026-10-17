import type { ReactNode } from 'react'
import type { Texture } from 'three'
import { homeStage, type BuildingDef } from '../game/data'
import { brickTex, shingleTex, sidingTex } from './textures'
import { SEASON } from './season'
import { Facade } from './mergeScale'
import { doorTag } from './doors'

// Upgraded houses (level 2-10) on the same 1x1 lot: a bigger, nicer house at
// levels 2-3, a brick apartment block at 4-6 (one more floor each level) and a
// glass apartment tower at 7-10 that keeps climbing. Level 1 is the plain
// house in BuildingModel.

type Mat = (color: string, map?: Texture) => ReactNode
type Props = { def: BuildingDef; level: number; ghost?: boolean; m: Mat; win: ReactNode; bulb: ReactNode }

const GOLD = '#ffc107'
const LEAF = '#43a047'
const flat = (color: string) => <meshStandardMaterial color={color} flatShading />

// Windows on all four walls of a w x d box: `n` across each wall on every
// floor height in `ys`. `front: false` leaves the front wall bare (for doors).
// A merged pair's longer faces get more columns (see Facade).
function Windows({ w, d, ys, n, win, size = [0.22, 0.22], front = true }: { w: number; d: number; ys: number[]; n: number; win: ReactNode; size?: [number, number]; front?: boolean }) {
  const out: ReactNode[] = []
  for (let side = front ? 0 : 1; side < 4; side++) {
    const along = side % 2 === 0 ? w : d
    const off = (side % 2 === 0 ? d : w) / 2 + 0.006
    const at: [number, number, number] = side === 0 ? [0, 0, off] : side === 1 ? [off, 0, 0] : side === 2 ? [0, 0, -off] : [-off, 0, 0]
    out.push(
      <Facade key={side} at={at} ry={(side * Math.PI) / 2} len={along}>
        {(L) => {
          const k = Math.round((n * L) / along)
          return ys.flatMap((y) => Array.from({ length: k }, (_, i) => (
            <mesh key={`${y}:${i}`} position={[((i + 0.5) / k - 0.5) * L * 0.86, y, 0]}>
              <planeGeometry args={size} />
              {win}
            </mesh>
          )))
        }}
      </Facade>,
    )
  }
  return <group>{out}</group>
}

function Shrub({ x, z, r = 0.14 }: { x: number; z: number; r?: number }) {
  return <mesh position={[x, r * 0.8, z]} castShadow><icosahedronGeometry args={[r, 0]} />{flat(LEAF)}</mesh>
}

function Fence({ m }: { m: Mat }) {
  return (
    <group>
      {[-0.75, -0.6, -0.45, -0.3, 0.3, 0.45, 0.6, 0.75].map((x) => (
        <mesh key={x} position={[x, 0.13, 0.95]} castShadow><boxGeometry args={[0.05, 0.26, 0.03]} />{m('#fafafa')}</mesh>
      ))}
      {[-0.525, 0.525].map((x) => (
        <mesh key={x} position={[x, 0.18, 0.95]}><boxGeometry args={[0.5, 0.04, 0.02]} />{m('#fafafa')}</mesh>
      ))}
    </group>
  )
}

// Levels 2-3: a two-storey house; level 3 adds a porch, balcony and garden.
function BigHouse({ def, level, ghost, m, win, bulb }: Props) {
  const roof = SEASON === 'winter' ? '#f4f8fb' : def.roof
  const H = 1.5
  const fancy = level >= 3
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.36, H, 1.24]} />
        {m(def.color, sidingTex(1, 2.2))}
      </mesh>
      <mesh position={[0, H + 0.38, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[1.2, 0.76, 4]} />
        {m(roof, shingleTex(3, 1.5))}
      </mesh>
      <mesh position={[0.38, H + 0.5, -0.28]} castShadow>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
        {m('#a1665e', brickTex(0.3, 0.6))}
      </mesh>
      {/* Door, then windows: two downstairs, three up, and the sides. */}
      <mesh position={[0, 0.3, 0.625]} userData={doorTag()}><planeGeometry args={[0.3, 0.6]} />{m('#5d4037')}</mesh>
      {[-0.42, 0.42].map((x) => <mesh key={x} position={[x, 0.5, 0.625]}><planeGeometry args={[0.28, 0.26]} />{win}</mesh>)}
      {[-0.42, 0, 0.42].map((x) => <mesh key={x} position={[x, 1.1, 0.625]}><planeGeometry args={[0.26, 0.26]} />{win}</mesh>)}
      <Windows w={1.36} d={1.24} ys={[0.5, 1.1]} n={2} win={win} size={[0.26, 0.26]} front={false} />
      <mesh position={[0.24, 0.66, 0.65]}><boxGeometry args={[0.07, 0.07, 0.06]} />{bulb}</mesh>
      {!ghost && (
        <>
          {/* Flower boxes under the upstairs windows. */}
          {[-0.42, 0, 0.42].map((x) => (
            <group key={x}>
              <mesh position={[x, 0.95, 0.66]}><boxGeometry args={[0.3, 0.06, 0.08]} />{m('#795548')}</mesh>
              {[-0.08, 0, 0.08].map((fx, i) => <mesh key={fx} position={[x + fx, 1, 0.68]}><icosahedronGeometry args={[0.045, 0]} />{flat(['#ff4081', '#ffeb3b', '#ff4081'][i])}</mesh>)}
            </group>
          ))}
          <mesh position={[0, 0.03, 0.74]} receiveShadow><boxGeometry args={[0.42, 0.06, 0.2]} />{m('#bdbdbd')}</mesh>
          <Fence m={m} />
          <Shrub x={-0.62} z={0.72} />
          <Shrub x={0.62} z={0.72} r={0.12} />
          {fancy && (
            <>
              {/* Covered porch on two posts, with a balcony on top. */}
              <mesh position={[0, 0.76, 0.84]} castShadow><boxGeometry args={[0.9, 0.05, 0.42]} />{m('#fafafa')}</mesh>
              {[-0.4, 0.4].map((x) => <mesh key={x} position={[x, 0.38, 1.0]}><boxGeometry args={[0.05, 0.76, 0.05]} />{m('#fafafa')}</mesh>)}
              <mesh position={[0, 0.88, 1.04]}><boxGeometry args={[0.9, 0.18, 0.03]} />{m('#fafafa')}</mesh>
              {/* Shutters beside the upstairs windows. */}
              {[-0.42, 0, 0.42].flatMap((x) => [-1, 1].map((sd) => (
                <mesh key={`${x}${sd}`} position={[x + sd * 0.17, 1.1, 0.628]}><planeGeometry args={[0.07, 0.28]} />{m('#2e7d32')}</mesh>
              )))}
              {/* A garden lamp and a little tree in the yard. */}
              <mesh position={[-0.82, 0.25, 0.55]}><cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />{m('#37474f')}</mesh>
              <mesh position={[-0.82, 0.52, 0.55]}><sphereGeometry args={[0.06, 8, 6]} />{bulb}</mesh>
              <mesh position={[0.8, 0.2, -0.75]}><cylinderGeometry args={[0.04, 0.05, 0.4, 6]} />{m('#6d4c41')}</mesh>
              <mesh position={[0.8, 0.55, -0.75]} castShadow><icosahedronGeometry args={[0.26, 0]} />{flat('#66bb6a')}</mesh>
            </>
          )}
        </>
      )}
    </group>
  )
}

// Levels 4-6: a brick apartment block, three to five floors. The ground
// floor is a taller lobby, so a townsperson fits through its doors.
function Apartments({ level, ghost, m, win, bulb }: Props) {
  const floors = level - 1
  const FH = 0.42
  const GF = 0.68
  const W = 1.62
  const D = 1.42
  const H = GF + (floors - 1) * FH + 0.08
  const ups = Array.from({ length: floors - 1 }, (_, i) => GF + i * FH + FH * 0.5)
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        {m('#c98a6e', brickTex(1.6, H * 1.2))}
      </mesh>
      {/* Parapet cap and a stone band at every floor. */}
      <mesh position={[0, H + 0.04, 0]} castShadow><boxGeometry args={[W + 0.06, 0.08, D + 0.06]} />{m('#eceff1')}</mesh>
      {Array.from({ length: floors - 1 }, (_, i) => (
        <mesh key={i} position={[0, GF + i * FH, 0]}><boxGeometry args={[W + 0.03, 0.03, D + 0.03]} />{m('#e0d6cc')}</mesh>
      ))}
      <Windows w={W} d={D} ys={ups} n={3} win={win} size={[0.24, 0.24]} />
      <Windows w={W} d={D} ys={[GF * 0.48]} n={3} win={win} size={[0.24, 0.32]} front={false} />
      {/* Ground floor front: glass doors under a canopy, and two shop windows. */}
      <mesh position={[0, 0.3, D / 2 + 0.006]} userData={doorTag('slide')}><planeGeometry args={[0.36, 0.6]} />{m('#37474f')}</mesh>
      {[-0.5, 0.5].map((x) => <mesh key={x} position={[x, 0.34, D / 2 + 0.006]}><planeGeometry args={[0.36, 0.34]} />{win}</mesh>)}
      <mesh position={[0, GF + 0.02, D / 2 + 0.14]} castShadow><boxGeometry args={[0.6, 0.04, 0.28]} />{m('#1565c0')}</mesh>
      <mesh position={[0, GF - 0.02, D / 2 + 0.02]}><boxGeometry args={[0.08, 0.05, 0.04]} />{bulb}</mesh>
      {!ghost && (
        <>
          {/* Balconies on the upper floors. */}
          {ups.flatMap((y) => [-0.5, 0.5].map((x) => (
            <group key={`${x}:${y}`} position={[x, y - FH * 0.42, D / 2 + 0.1]}>
              <mesh castShadow><boxGeometry args={[0.38, 0.03, 0.2]} />{m('#eceff1')}</mesh>
              <mesh position={[0, 0.07, 0.1]}><boxGeometry args={[0.372, 0.12, 0.015]} />{m('#455a64')}</mesh>
            </group>
          )))}
          <mesh position={[0, 0.03, D / 2 + 0.25]} receiveShadow><boxGeometry args={[0.5, 0.06, 0.4]} />{m('#bdbdbd')}</mesh>
          <Shrub x={-0.6} z={D / 2 + 0.2} />
          <Shrub x={0.6} z={D / 2 + 0.2} />
          <Shrub x={-0.85} z={-0.5} r={0.12} />
          {/* Rooftop: a water tank from level 5, a garden with an umbrella at 6. */}
          {level >= 5 && (
            <group position={[0.4, H + 0.08, -0.3]}>
              {[-0.12, 0.12].flatMap((x) => [-0.12, 0.12].map((z) => (
                <mesh key={`${x}${z}`} position={[x, 0.12, z]}><boxGeometry args={[0.03, 0.24, 0.03]} />{m('#5d4037')}</mesh>
              )))}
              <mesh position={[0, 0.42, 0]} castShadow><cylinderGeometry args={[0.2, 0.2, 0.36, 12]} />{m('#8d6e63')}</mesh>
              <mesh position={[0, 0.66, 0]}><coneGeometry args={[0.22, 0.14, 12]} />{m('#5d4037')}</mesh>
            </group>
          )}
          {level >= 6 && (
            <group position={[-0.35, H + 0.08, 0.2]}>
              <mesh position={[0, 0.06, 0]}><boxGeometry args={[0.6, 0.12, 0.5]} />{m('#795548')}</mesh>
              <Shrub x={-0.15} z={0} r={0.12} />
              <Shrub x={0.15} z={0.05} r={0.1} />
              <mesh position={[0.35, 0.3, 0.35]}><cylinderGeometry args={[0.015, 0.015, 0.6, 6]} />{m('#eceff1')}</mesh>
              <mesh position={[0.35, 0.6, 0.35]} castShadow><coneGeometry args={[0.28, 0.14, 8]} />{m('#e53935')}</mesh>
            </group>
          )}
        </>
      )}
    </group>
  )
}

// Levels 7-10: a glass apartment tower on a stone base (lobby height, for
// people), 8 to 18 floors.
const TOWER_FLOORS = [8, 11, 14, 18]
function Tower({ level, ghost, m, win, bulb }: Props) {
  const floors = TOWER_FLOORS[level - 7]
  const FH = 0.36
  const BASE = 0.72
  // From level 9 the top third steps in.
  const low = level >= 9 ? Math.ceil(floors * 0.65) : floors
  const W = 1.34
  const D = 1.24
  const w2 = W * 0.76
  const d2 = D * 0.76
  const H1 = low * FH
  const H2 = (floors - low) * FH
  const top = BASE + H1 + H2
  const glass = '#8fb3c9'
  const bands = (n: number, from: number, w: number, d: number) => Array.from({ length: n }, (_, i) => (
    <mesh key={`${from}:${i}`} position={[0, from + (i + 1) * FH, 0]}><boxGeometry args={[w + 0.03, 0.035, d + 0.03]} />{m('#eceff1')}</mesh>
  ))
  return (
    <group>
      {/* Stone base with a lobby. */}
      <mesh position={[0, BASE / 2, 0]} castShadow receiveShadow><boxGeometry args={[1.76, BASE, 1.62]} />{m('#d7d2c8')}</mesh>
      <mesh position={[0, 0.3, 0.816]} userData={doorTag('slide')}><planeGeometry args={[0.42, 0.6]} />{m('#263238')}</mesh>
      {[-0.55, 0.55].map((x) => <mesh key={x} position={[x, 0.34, 0.816]}><planeGeometry args={[0.42, 0.38]} />{win}</mesh>)}
      <Windows w={1.76} d={1.62} ys={[0.34]} n={3} win={win} size={[0.36, 0.38]} front={false} />
      <mesh position={[0, BASE - 0.04, 0.95]} castShadow><boxGeometry args={[0.7, 0.04, 0.3]} />{m(level >= 10 ? GOLD : '#37474f')}</mesh>
      <mesh position={[0, BASE - 0.07, 0.83]}><boxGeometry args={[0.1, 0.05, 0.04]} />{bulb}</mesh>
      {/* The tower: glass, with a white band at each floor. */}
      <mesh position={[0, BASE + H1 / 2, 0]} castShadow receiveShadow><boxGeometry args={[W, H1, D]} />{m(glass)}</mesh>
      <Windows w={W} d={D} ys={Array.from({ length: low }, (_, i) => BASE + (i + 0.5) * FH)} n={4} win={win} size={[0.24, 0.22]} />
      {bands(low, BASE, W, D)}
      {H2 > 0 && (
        <>
          <mesh position={[0, BASE + H1 + H2 / 2, 0]} castShadow><boxGeometry args={[w2, H2, d2]} />{m(glass)}</mesh>
          <Windows w={w2} d={d2} ys={Array.from({ length: floors - low }, (_, i) => BASE + H1 + (i + 0.5) * FH)} n={3} win={win} size={[0.22, 0.22]} />
          {bands(floors - low, BASE + H1, w2, d2)}
        </>
      )}
      {!ghost && (
        <>
          <Shrub x={-0.75} z={0.95} r={0.12} />
          <Shrub x={0.75} z={0.95} r={0.12} />
          <mesh position={[0, 0.03, 1.0]} receiveShadow><boxGeometry args={[0.6, 0.06, 0.2]} />{m('#bdbdbd')}</mesh>
          {/* Rooftop plant room, an antenna from 8, a roof garden on the setback at 9, a gold spire at 10. */}
          <mesh position={[0.2, top + 0.15, -0.15]} castShadow><boxGeometry args={[0.42, 0.3, 0.36]} />{m('#78909c')}</mesh>
          {level >= 8 && level < 10 && (
            <group position={[-0.2, top, 0.15]}>
              <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.015, 0.025, 0.9, 6]} />{m('#cfd8dc')}</mesh>
              <mesh position={[0, 0.92, 0]}><sphereGeometry args={[0.04, 8, 6]} />{bulb}</mesh>
            </group>
          )}
          {level >= 9 && (
            <group position={[0, BASE + H1, 0]}>
              {/* Corner planters out on the setback ledge, clear of the upper floors. */}
              {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
                <group key={`${sx}${sz}`} position={[(sx * (W + w2)) / 4, 0, (sz * (D + d2)) / 4]}>
                  <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.13, 0.1, 0.12]} />{m('#8d6e63')}</mesh>
                  <group position-y={0.06}><Shrub x={0} z={0} r={0.07} /></group>
                </group>
              )))}
            </group>
          )}
          {level >= 10 && (
            <group position={[0, top, 0]}>
              <mesh position={[0, 0.06, 0]}><boxGeometry args={[w2 + 0.06, 0.12, d2 + 0.06]} />{m(GOLD)}</mesh>
              {/* Spire and its light as one piece, so a merged pair keeps the light on the tip. */}
              <group position={[-0.15, 0.1, 0.1]}>
                <mesh position-y={0.65} castShadow><coneGeometry args={[0.09, 1.3, 8]} /><meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} /></mesh>
                <mesh position-y={1.33}><sphereGeometry args={[0.05, 8, 6]} />{bulb}</mesh>
              </group>
            </group>
          )}
        </>
      )}
    </group>
  )
}

export function HouseLevels(props: Props) {
  const stage = homeStage(props.level)
  if (stage === 'tower') return <Tower {...props} />
  if (stage === 'apartments') return <Apartments {...props} />
  return <BigHouse {...props} />
}
