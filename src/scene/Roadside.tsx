import { BufferAttribute, BufferGeometry, MeshStandardMaterial } from 'three'
import { TILE } from '../game/data'
import { glowMats } from './dayNight'
import { LightPool } from './BuildingModel'
import { decal } from './layers'
import { roadWearTex } from './textures'
import { PropMesh } from './propKit'
import { STREET_PROPS, hydrant, plateGeo, speedPlate, streetLamp } from './streetProps'

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

export function StreetProp({ kind, side, at }: { kind: PropKind; side: Side; at: number }) {
  return (
    <group rotation-y={SIDE_ROT[side]}>
      <group position={[at, 0.08, HALF - 0.1]}>
        <PropMesh parts={STREET_PROPS[kind]()} />
        {kind === 'sign' && (
          <mesh geometry={plateGeo} material={speedPlate()} position={[0, 0.56, -0.0195]} rotation-y={Math.PI} dispose={null} />
        )}
        {kind === 'box' && (
          // Status light, lit at night.
          <mesh position={[-0.07, 0.29, -0.062]}><boxGeometry args={[0.016, 0.016, 0.004]} /><primitive object={glowMats.bulb} attach="material" dispose={null} /></mesh>
        )}
      </group>
    </group>
  )
}

// Fire hydrant on the sidewalk.
export function Hydrant({ side }: { side: 'e' | 'w' | 's' | 'n' }) {
  const at = TILE / 2 - 0.2
  const [x, z] = { e: [at, 0.6], w: [-at, -0.6], s: [-0.6, at], n: [0.6, -at] }[side]
  // Pumper outlet towards the road.
  return (
    <group position={[x, 0.08, z]} rotation-y={SIDE_ROT[side]}>
      <PropMesh parts={hydrant()} />
    </group>
  )
}

// Street lamp on the sidewalk, arm reaching over the road. Lit at night.
export function StreetLamp({ side }: { side: 'e' | 'w' | 's' | 'n' }) {
  const half = TILE / 2 - 0.18
  const rot = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[side]
  return (
    <group rotation-y={rot}>
      <group position={[0.55, 0, half]}>
        <PropMesh parts={streetLamp()} />
      </group>
      {/* Above the kerb so the glow spills over the sidewalk too. */}
      <LightPool r={0.95} x={0.55} z={half - 0.5} y={0.09} />
    </group>
  )
}
