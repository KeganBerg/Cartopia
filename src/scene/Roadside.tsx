import { BufferAttribute, BufferGeometry, ExtrudeGeometry, MeshStandardMaterial, Shape } from 'three'
import { HaloSpot } from './halos'
import { TILE } from '../game/data'
import { glowMats } from './dayNight'
import { LightPool } from './BuildingModel'
import { decal, LAYER } from './layers'
import { drainTex, paverTex, roadWearTex, tactileTex } from './textures'
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

// Sidewalk heights: the paving top, and the kerb standing just proud of it.
const PAVE = 0.08
const KERB = 0.09
const KERB_W = 0.06
const KERB_COLOR = '#cfd8dc'
// Radius of the rounded kerb where a sidewalk turns an inside corner (dead ends, bends).
export const FILLET = 0.2
// Width of a curb ramp: the crosswalk's stripes are 0.34 long.
const RAMP = 0.34

// The sides at the -x and +x ends of a side's local frame (see SIDE_ROT).
export const ENDS: Record<Side, [Side, Side]> = { s: ['w', 'e'], e: ['s', 'n'], w: ['n', 's'], n: ['e', 'w'] }

// What a sidewalk strip meets at one end: more sidewalk round an inside corner,
// a crosswalk (a curb ramp), or the next tile's sidewalk carrying straight on.
export type End = 'corner' | 'ramp' | 'open'

// A flat 2D outline stood up as a slab `h` tall: the outline's (x, y) lands on
// the ground at (x, z), and its top face carries the outline's own UVs, one
// texture repeat per world unit.
function slab(shape: Shape, h: number) {
  const g = new ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 10 })
  g.rotateX(Math.PI / 2)
  g.translate(0, h, 0)
  return g
}

// Pieces for the corner at local (+half, +half). The kerbs reach a hair past the
// paving they edge so their faces never sit flush with it (no flicker).
const CORNER = (() => {
  const r = WALK
  const c = HALF
  // Outside corner of a block where two roads meet: a quarter round of paving
  // that joins the two sidewalks, with the kerb sweeping round its edge.
  const pave = new Shape()
  pave.moveTo(c, c)
  pave.lineTo(c - r, c)
  pave.absarc(c, c, r, Math.PI, Math.PI * 1.5, false)
  pave.lineTo(c, c)
  const kerb = new Shape()
  kerb.moveTo(c - r - 0.002, c)
  kerb.absarc(c, c, r + 0.002, Math.PI, Math.PI * 1.5, false)
  kerb.lineTo(c, c - r + KERB_W)
  kerb.absarc(c, c, r - KERB_W, Math.PI * 1.5, Math.PI, true)
  kerb.lineTo(c - r - 0.002, c)
  // Inside corner, where sidewalks on two sides of a tile meet: fill the square
  // corner of the road with a rounded kerb instead of a sharp notch.
  const e = c - r // road edge
  const o = e - FILLET // centre of the rounding
  const fill = new Shape()
  fill.moveTo(e, e)
  fill.lineTo(e, o)
  fill.absarc(o, o, FILLET, 0, Math.PI / 2, false)
  fill.lineTo(e, e)
  const rim = new Shape()
  rim.moveTo(e + KERB_W, o)
  rim.absarc(o, o, FILLET + KERB_W, 0, Math.PI / 2, false)
  rim.lineTo(o, e - 0.002)
  rim.absarc(o, o, FILLET - 0.002, Math.PI / 2, 0, true)
  rim.lineTo(e + KERB_W, o)
  return { pave: slab(pave, PAVE), kerb: slab(kerb, KERB), fill: slab(fill, PAVE), rim: slab(rim, KERB) }
})()

// `turn` rotates the piece onto one of the tile's corners: 0 south-east, 1
// north-east, 2 north-west, 3 south-west.
const cornerRot = (turn: number) => (turn * Math.PI) / 2

// The rounded sidewalk on the outside corner of a block, where two roads meet
// at a bend or junction and the sidewalks would otherwise stop short.
export function CornerCurb({ turn }: { turn: number }) {
  return (
    <group rotation-y={cornerRot(turn)}>
      <mesh geometry={CORNER.pave} receiveShadow><meshStandardMaterial map={paverTex(1, 1)} /></mesh>
      <mesh geometry={CORNER.kerb} receiveShadow><meshStandardMaterial color={KERB_COLOR} /></mesh>
    </group>
  )
}

// The rounded kerb filling an inside corner, where a tile has sidewalk on two
// neighbouring sides (bends, dead ends).
export function CornerFillet({ turn }: { turn: number }) {
  return (
    <group rotation-y={cornerRot(turn)}>
      <mesh geometry={CORNER.fill} receiveShadow><meshStandardMaterial map={paverTex(1, 1)} /></mesh>
      <mesh geometry={CORNER.rim} receiveShadow><meshStandardMaterial color={KERB_COLOR} /></mesh>
    </group>
  )
}

// Raised sidewalk along one edge of a road tile. Strips along north and south
// edges stop short of a corner shared with an east or west strip, so the two
// never overlap. The kerb rounds off inside corners, and drops away where a
// crosswalk lands, with a yellow tactile pad marking the ramp.
export function Sidewalk({ side, ends, drain }: { side: Side; ends: [End, End]; drain?: boolean }) {
  const cut = side === 'n' || side === 's'
  const lo = ends[0] === 'corner' && cut ? -HALF + WALK : -HALF
  const hi = ends[1] === 'corner' && cut ? HALF - WALK : HALF
  // Kerb runs, split around any ramps.
  const runs: [number, number][] = []
  let from = ends[0] === 'corner' ? -HALF + WALK + FILLET : -HALF
  const to = ends[1] === 'corner' ? HALF - WALK - FILLET : HALF
  const ramps = ([0, 1] as const).filter((i) => ends[i] === 'ramp').map((i) => (i ? 1 : -1) * (HALF - 0.32))
  for (const r of ramps.sort((a, b) => a - b)) {
    runs.push([from, r - RAMP / 2])
    from = r + RAMP / 2
  }
  runs.push([from, to])
  const z = HALF - WALK / 2
  const kz = HALF - WALK + KERB_W / 2 - 0.002
  return (
    <group rotation-y={SIDE_ROT[side]}>
      <mesh position={[(lo + hi) / 2, PAVE / 2, z]} receiveShadow>
        <boxGeometry args={[hi - lo, PAVE, WALK]} />
        <meshStandardMaterial map={paverTex((hi - lo) / 2, 0.5)} />
      </mesh>
      {runs.filter(([a, b]) => b - a > 0.01).map(([a, b]) => (
        <mesh key={a} position={[(a + b) / 2, KERB / 2, kz]}>
          <boxGeometry args={[b - a, KERB, KERB_W + 0.004]} />
          <meshStandardMaterial color={KERB_COLOR} />
        </mesh>
      ))}
      {ramps.map((x) => (
        <mesh key={x} position={[x, PAVE + 0.004, HALF - WALK + 0.075]} receiveShadow>
          <boxGeometry args={[RAMP - 0.04, 0.008, 0.13]} />
          <meshStandardMaterial map={tactileTex(2.5, 1)} />
        </mesh>
      ))}
      {drain && (
        <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0.5, LAYER.paint, HALF - WALK - 0.06]}>
          <planeGeometry args={[0.12, 0.3]} />
          <meshStandardMaterial map={drainTex()} {...decal()} />
        </mesh>
      )}
    </group>
  )
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
      <HaloSpot at={[0.55, 1.7, half - 0.44]} />
    </group>
  )
}
