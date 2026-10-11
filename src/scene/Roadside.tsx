import { BufferAttribute, BufferGeometry, MeshStandardMaterial } from 'three'
import { TILE } from '../game/data'
import { glowMats } from './dayNight'
import { decal } from './layers'
import { roadWearTex } from './textures'

// Street-level detail for road tiles: wear on the asphalt (grime along the
// kerbs, hairline cracks, tar patches, oil drips where cars wait) and small
// furniture on the sidewalks (bins, newspaper boxes, mailboxes, bollards,
// planters, signs, utility boxes). The wear decals share one material, so Batch
// draws all of them at once; the furniture is plain colours that bake for free.

type Side = 'e' | 'w' | 's' | 'n'
const HALF = TILE / 2
const WALK = 0.4
// Turns a side's local frame (+z facing that edge of the tile) into the tile's.
export const SIDE_ROT: Record<Side, number> = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }

// A flat quad lying on the ground (unit square), its UVs picking one of the four
// cells of the wear texture. `alongZ` runs the texture's v across z instead of x.
function cellQuad(cell: number, gradientZ = false) {
  const g = new BufferGeometry()
  const p = [-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5]
  const uv: number[] = []
  for (let i = 0; i < 4; i++) {
    const x = p[i * 3], z = p[i * 3 + 2]
    // Kerb grime fades away from +z (the kerb); the others map plainly.
    if (gradientZ) uv.push((cell + (0.5 - z)) / 4, x + 0.5)
    else uv.push((cell + x + 0.5) / 4, 0.5 - z)
  }
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3))
  g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  g.setIndex([0, 2, 1, 1, 2, 3])
  return g
}

const QUAD = { crack: cellQuad(0), patch: cellQuad(1), oil: cellQuad(2), grime: cellQuad(3, true) }
let wearMat: MeshStandardMaterial | null = null
const wear = () => (wearMat ??= new MeshStandardMaterial({ map: roadWearTex(), transparent: true, depthWrite: false, roughness: 0.9, ...decal(2) }))

// Above the asphalt, under the paint.
const Y = 0.026

function Decal({ kind, x, z, w, d, ry = 0 }: { kind: keyof typeof QUAD; x: number; z: number; w: number; d: number; ry?: number }) {
  return (
    <mesh geometry={QUAD[kind]} position={[x, Y, z]} rotation-y={ry} scale={[w, 1, d]} renderOrder={1}>
      <primitive object={wear()} attach="material" dispose={null} />
    </mesh>
  )
}

// Wear for one road tile. `kerbs` are the sides with a sidewalk; `plain` is a
// straight stretch clear of crossings, where cracks and patches go; `h` is a
// per-tile hash in 0..1.
export function RoadWear({ kerbs, plain, alongX, h }: { kerbs: Side[]; plain: boolean; alongX: boolean; h: number }) {
  return (
    <group>
      {kerbs.map((sd) => (
        <group key={sd} rotation-y={SIDE_ROT[sd]}>
          <Decal kind="grime" x={0} z={HALF - WALK - 0.16} w={TILE} d={0.32} />
        </group>
      ))}
      {plain && h < 0.3 && <Decal kind="crack" x={(h - 0.15) * 3} z={(h * 7) % 1 - 0.5} w={0.45} d={1.3} ry={alongX ? Math.PI / 2 : 0} />}
      {plain && h > 0.86 && <Decal kind="patch" x={0} z={h > 0.93 ? 0.42 : -0.42} w={0.75} d={1.1} ry={alongX ? Math.PI / 2 : 0} />}
      {plain && h > 0.4 && h < 0.52 && (
        // Oil drips down the middle of a lane.
        <group rotation-y={alongX ? 0 : Math.PI / 2}>
          <Decal kind="oil" x={(h - 0.46) * 8} z={h < 0.46 ? 0.45 : -0.45} w={0.42} d={0.3} ry={h * 9} />
        </group>
      )}
    </group>
  )
}

// One piece of sidewalk furniture on side `side`, `at` along the tile. Kept to the
// lawn edge of the sidewalk so walkers pass on the kerb side.
export type PropKind = 'bin' | 'news' | 'mail' | 'bollards' | 'planter' | 'sign' | 'box' | 'bikes' | 'meter'
export const PROPS: PropKind[] = ['bin', 'news', 'mail', 'bollards', 'planter', 'sign', 'box', 'bikes', 'meter']

const M = (c: string, rough = 0.8, metal = 0) => <meshStandardMaterial color={c} roughness={rough} metalness={metal} />

export function StreetProp({ kind, side, at }: { kind: PropKind; side: Side; at: number }) {
  return (
    <group rotation-y={SIDE_ROT[side]}>
      <group position={[at, 0.08, HALF - 0.1]}>
        {kind === 'bin' && (
          // Green litter bin with a domed lid and a dark mouth.
          <>
            <mesh position-y={0.13} castShadow><cylinderGeometry args={[0.075, 0.065, 0.26, 8]} />{M('#2e7d32')}</mesh>
            <mesh position-y={0.27}><sphereGeometry args={[0.08, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />{M('#1b5e20')}</mesh>
            <mesh position={[0, 0.22, -0.07]}><boxGeometry args={[0.07, 0.04, 0.02]} />{M('#212121')}</mesh>
            {[-1, 1].map((s) => <mesh key={s} position={[s * 0.075, 0.08, 0]}><boxGeometry args={[0.01, 0.16, 0.03]} />{M('#9e9e9e', 0.4, 0.6)}</mesh>)}
          </>
        )}
        {kind === 'news' && (
          // A pair of newspaper boxes, one red, one blue, with windows.
          <>
            {[[-0.09, '#c62828'], [0.09, '#1565c0']].map(([x, c]) => (
              <group key={x as number} position-x={x as number}>
                <mesh position-y={0.12} castShadow><boxGeometry args={[0.14, 0.2, 0.12]} />{M(c as string, 0.5)}</mesh>
                <mesh position={[0, 0.15, -0.061]}><boxGeometry args={[0.1, 0.07, 0.005]} />{M('#cfd8dc', 0.2)}</mesh>
                <mesh position-y={0.01}><boxGeometry args={[0.03, 0.02, 0.03]} />{M('#424242')}</mesh>
              </group>
            ))}
          </>
        )}
        {kind === 'mail' && (
          // Blue curbside mailbox with a rounded top on stubby legs.
          <>
            <mesh position-y={0.17} castShadow><boxGeometry args={[0.15, 0.2, 0.14]} />{M('#1e4fa3', 0.5)}</mesh>
            <mesh position-y={0.27} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.075, 0.075, 0.14, 10, 1, false, 0, Math.PI]} />{M('#1e4fa3', 0.5)}</mesh>
            <mesh position={[0, 0.24, -0.071]}><boxGeometry args={[0.09, 0.015, 0.005]} />{M('#0d2b5e')}</mesh>
            {[[-0.06, -0.05], [0.06, -0.05], [-0.06, 0.05], [0.06, 0.05]].map(([x, z]) => (
              <mesh key={`${x}${z}`} position={[x, 0.035, z]}><boxGeometry args={[0.02, 0.07, 0.02]} />{M('#0d2b5e')}</mesh>
            ))}
          </>
        )}
        {kind === 'bollards' && (
          // Three short posts with a reflective band.
          <>
            {[-0.3, 0, 0.3].map((x) => (
              <group key={x} position-x={x}>
                <mesh position-y={0.1} castShadow><cylinderGeometry args={[0.03, 0.035, 0.2, 8]} />{M('#37474f', 0.5, 0.3)}</mesh>
                <mesh position-y={0.16}><cylinderGeometry args={[0.032, 0.032, 0.025, 8]} />{M('#fdd835', 0.3)}</mesh>
              </group>
            ))}
          </>
        )}
        {kind === 'planter' && (
          // Concrete planter with a little shrub.
          <>
            <mesh position-y={0.07} castShadow><boxGeometry args={[0.32, 0.14, 0.16]} />{M('#b0a99a')}</mesh>
            <mesh position-y={0.14}><boxGeometry args={[0.28, 0.01, 0.12]} />{M('#5d4037')}</mesh>
            {[-0.08, 0.08].map((x, i) => <mesh key={x} position={[x, 0.2, 0]}><icosahedronGeometry args={[0.08, 0]} /><meshStandardMaterial color={i ? '#43a047' : '#2e7d32'} flatShading /></mesh>)}
          </>
        )}
        {kind === 'sign' && (
          // Speed limit sign on a post, facing the road.
          <>
            <mesh position-y={0.32} castShadow><cylinderGeometry args={[0.012, 0.012, 0.64, 6]} />{M('#9e9e9e', 0.4, 0.6)}</mesh>
            <mesh position={[0, 0.58, -0.015]}><boxGeometry args={[0.16, 0.2, 0.01]} />{M('#fafafa', 0.4)}</mesh>
            <mesh position={[0, 0.58, -0.021]}><boxGeometry args={[0.13, 0.17, 0.002]} />{M('#212121', 0.4)}</mesh>
            <mesh position={[0, 0.58, -0.023]}><boxGeometry args={[0.12, 0.16, 0.002]} />{M('#fafafa', 0.4)}</mesh>
            <mesh position={[0, 0.54, -0.025]}><boxGeometry args={[0.06, 0.05, 0.002]} />{M('#212121', 0.4)}</mesh>
            <mesh position={[0, 0.62, -0.025]}><boxGeometry args={[0.09, 0.015, 0.002]} />{M('#212121', 0.4)}</mesh>
          </>
        )}
        {kind === 'box' && (
          // Grey utility cabinet with vents and a status light.
          <>
            <mesh position-y={0.16} castShadow><boxGeometry args={[0.24, 0.32, 0.12]} />{M('#90a4ae', 0.5, 0.2)}</mesh>
            <mesh position-y={0.33}><boxGeometry args={[0.26, 0.02, 0.14]} />{M('#78909c', 0.5, 0.2)}</mesh>
            {[0.1, 0.14, 0.18].map((y) => <mesh key={y} position={[0.05, y, -0.061]}><boxGeometry args={[0.08, 0.01, 0.003]} />{M('#546e7a')}</mesh>)}
            <mesh position={[-0.07, 0.26, -0.062]}><boxGeometry args={[0.02, 0.02, 0.004]} /><primitive object={glowMats.bulb} attach="material" dispose={null} /></mesh>
          </>
        )}
        {kind === 'bikes' && (
          // Bike rack: two steel hoops, one with a parked bike.
          <>
            {[-0.12, 0.12].map((x) => (
              <mesh key={x} position={[x, 0.1, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.09, 0.012, 4, 10, Math.PI]} />{M('#b0bec5', 0.3, 0.7)}</mesh>
            ))}
            <group position={[-0.12, 0, 0.04]} rotation-y={Math.PI / 2}>
              {[-0.11, 0.11].map((z) => <mesh key={z} position={[0, 0.08, z]} rotation-y={Math.PI / 2}><torusGeometry args={[0.07, 0.012, 4, 12]} />{M('#212121')}</mesh>)}
              <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.015, 0.015, 0.2]} />{M('#e53935', 0.4)}</mesh>
              <mesh position={[0, 0.16, -0.06]}><boxGeometry args={[0.04, 0.012, 0.05]} />{M('#212121')}</mesh>
            </group>
          </>
        )}
        {kind === 'meter' && (
          // Pair of parking meters at the kerb.
          <>
            {[-0.15, 0.15].map((x) => (
              <group key={x} position-x={x}>
                <mesh position-y={0.14}><cylinderGeometry args={[0.012, 0.012, 0.28, 6]} />{M('#546e7a', 0.4, 0.5)}</mesh>
                <mesh position-y={0.31}><boxGeometry args={[0.06, 0.08, 0.05]} />{M('#455a64', 0.4, 0.5)}</mesh>
                <mesh position={[0, 0.32, -0.026]}><boxGeometry args={[0.04, 0.03, 0.003]} />{M('#cfd8dc', 0.2)}</mesh>
              </group>
            ))}
          </>
        )}
      </group>
    </group>
  )
}
