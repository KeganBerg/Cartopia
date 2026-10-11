import type { ReactNode } from 'react'
import { glowMats } from './dayNight'
import { PAL } from './season'
import { CarModel } from './CarModel'
import { decal, LAYER } from './layers'
import { manholeTex } from './textures'
import { Upright, useMergeScale } from './mergeScale'

// Small dressing that makes buildings and props read as lived-in: trims,
// pipes, bins, curbs and so on. Everything here is static and reuses the
// colours the models already use, so the town batch (Batch.tsx) merges it into
// the draws that already exist instead of adding new ones.

const c = (color: string) => <meshStandardMaterial color={color} />
const flat = (color: string) => <meshStandardMaterial color={color} flatShading />
const win = <primitive object={glowMats.window} attach="material" dispose={null} />

type V3 = [number, number, number]
const Box = ({ p, s, children, r, cast }: { p: V3; s: V3; children: ReactNode; r?: V3; cast?: boolean }) => (
  <mesh position={p} rotation={r} castShadow={cast}>
    <boxGeometry args={s} />
    {children}
  </mesh>
)

// Generic storefront: stone plinth, roof parapet and hatch, downspouts, shop
// window mullions, lintels over upper windows, an awning valance, a gas meter
// and a bin by the corner.
export function ShopDetail({ W, D, h, F, roof, rows, cols, awning, mullions }: { W: number; D: number; h: number; F: number; roof: string; rows: number[]; cols: number[]; awning: ReactNode; mullions: boolean }) {
  const back = -0.1 - D * 0.36
  const side = W * 0.41
  const top = h + 0.13
  return (
    <group>
      <Box p={[0, 0.06, -0.1]} s={[W * 0.83, 0.12, D * 0.73]}>{c('#b0bec5')}</Box>
      {/* Parapet round the back and sides of the roof, and a lip along the front. */}
      <Box p={[0, top + 0.05, -0.1 - D * 0.39 + 0.03]} s={[W * 0.88, 0.1, 0.06]} cast>{c(roof)}</Box>
      {[-1, 1].map((sd) => <Box key={sd} p={[sd * (W * 0.44 - 0.03), top + 0.05, -0.1]} s={[0.06, 0.1, D * 0.78]} cast>{c(roof)}</Box>)}
      <Box p={[0, top + 0.02, -0.1 + D * 0.39 - 0.02]} s={[W * 0.88, 0.04, 0.04]}>{c(roof)}</Box>
      {/* Roof hatch and a vent stack. */}
      <Box p={[-W * 0.28, top + 0.05, back + 0.35]} s={[0.26, 0.08, 0.26]} cast>{c('#cfd8dc')}</Box>
      <mesh position={[-W * 0.12, top + 0.12, back + 0.22]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.22, 8]} />{c('#90a4ae')}</mesh>
      {/* Downspouts on the back corners. */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (side - 0.05), (h + 0.1) / 2, back - 0.03]}>
          <cylinderGeometry args={[0.025, 0.025, h + 0.1, 6]} />
          {c('#90a4ae')}
        </mesh>
      ))}
      {/* Mullions and a transom bar dividing the big shop window. */}
      {mullions && (
        <group>
          {[-1, 1].map((sd) => (
            <group key={sd}>
              {[W * 0.35, (0.25 + W * 0.35) / 2].map((x) => <Box key={x} p={[sd * x, 0.42, F + 0.012]} s={[0.03, 0.62, 0.02]}>{c('#eceff1')}</Box>)}
              <Box p={[(sd * (0.25 + W * 0.35)) / 2, 0.64, F + 0.012]} s={[W * 0.35 - 0.25, 0.025, 0.02]}>{c('#eceff1')}</Box>
            </group>
          ))}
        </group>
      )}
      {/* Lintels over the upper-floor windows. */}
      {rows.map((y) => cols.map((x) => <Box key={`${y}${x}`} p={[x, y + 0.215, F + 0.02]} s={[0.42, 0.035, 0.05]}>{c('#eceff1')}</Box>))}
      {/* Scalloped valance hanging off the awning. */}
      <mesh position={[0, 0.69, F + 0.4]}>
        <boxGeometry args={[W * 0.76, 0.07, 0.02]} />
        {awning}
      </mesh>
      {/* Gas meter and conduit on the right-hand wall. */}
      <Box p={[side + 0.03, 0.35, back + 0.2]} s={[0.05, 0.16, 0.12]}>{c('#546e7a')}</Box>
      <mesh position={[side + 0.02, (h + 0.43) / 2, back + 0.2]}><cylinderGeometry args={[0.012, 0.012, h - 0.43, 5]} />{c('#90a4ae')}</mesh>
      {/* Bin by the front corner. */}
      <group position={[side + 0.06, 0, F - 0.05]}>
        <mesh position={[0, 0.11, 0]} castShadow><cylinderGeometry args={[0.08, 0.07, 0.22, 10]} />{c('#37474f')}</mesh>
        <mesh position={[0, 0.235, 0]}><cylinderGeometry args={[0.09, 0.09, 0.03, 10]} />{c('#546e7a')}</mesh>
      </group>
    </group>
  )
}

// Speedway: red and white curbs round the infield, a crowd in the stands and a
// timing tower by the start line.
export function SpeedwayDetail({ sh, roof }: { sh: number; roof: string }) {
  const kerbs = Array.from({ length: 28 }, (_, i) => (i / 28) * Math.PI * 2)
  const crowd: { p: V3; k: number }[] = []
  ;[0.3, 0.55, 0.8].forEach((y, row) => {
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * 0.17 + (Math.PI * 1.06 * (i + (row % 2) * 0.5)) / 26
      const r = 1.84 - row * 0.02
      crowd.push({ p: [Math.sin(a) * r, (y * sh) / 0.9 + 0.07, Math.cos(a) * r], k: (i * 7 + row * 3) % 4 })
    }
  })
  const shirts = ['#ef5350', '#fafafa', '#42a5f5', '#ffca28']
  return (
    <group>
      {kerbs.map((a, i) => (
        <mesh key={i} position={[Math.sin(a) * 1.22, 0.095, Math.cos(a) * 1.22]} rotation-y={a}>
          <boxGeometry args={[0.24, 0.03, 0.06]} />
          {c(i % 2 ? '#fafafa' : '#ef5350')}
        </mesh>
      ))}
      {crowd.map(({ p, k }, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.06, 0.08, 0.06]} />
          {c(shirts[k])}
        </mesh>
      ))}
      {/* Timing tower in the open corner, its cab glazed all round. */}
      <group position={[-1.55, 0, 0.75]}>
        <Box p={[0, 0.5, 0]} s={[0.28, 1, 0.28]} cast>{c('#eceff1')}</Box>
        <Box p={[0, 1.12, 0]} s={[0.4, 0.24, 0.4]} cast>{c('#37474f')}</Box>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[Math.sin((i * Math.PI) / 2) * 0.202, 1.12, Math.cos((i * Math.PI) / 2) * 0.202]} rotation-y={(i * Math.PI) / 2}>
            <planeGeometry args={[0.34, 0.16]} />
            {win}
          </mesh>
        ))}
        <Box p={[0, 1.27, 0]} s={[0.46, 0.06, 0.46]} cast>{c(roof)}</Box>
      </group>
    </group>
  )
}

// Drive-in: a snack bar with a popcorn bucket on the roof, and cars parked
// up watching the film beside speaker posts. A merged drive-in is drawn
// scaled up, so its cars and posts undo that scale and the lot fills the
// bigger footprint with more rows instead.
export function DriveInDetail() {
  const [sx, sy, sz] = useMergeScale()
  const merged = sx !== 1 || sy !== 1 || sz !== 1
  return (
    <group>
      <group position={[1.2, 0, 1.3]}>
        <Box p={[0, 0.32, 0]} s={[0.9, 0.64, 0.7]} cast>{c('#e53935')}</Box>
        <Box p={[0, 0.68, -0.05]} s={[1.02, 0.08, 0.86]} cast>{c('#fafafa')}</Box>
        <mesh position={[0, 0.4, -0.352]} rotation-y={Math.PI}>
          <planeGeometry args={[0.6, 0.26]} />
          {win}
        </mesh>
        <Box p={[0, 0.25, -0.38]} s={[0.66, 0.04, 0.08]}>{c('#fafafa')}</Box>
        {/* Popcorn bucket: striped tub heaped with popcorn. */}
        <group position={[0, 0.72, 0.02]}>
          <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.24, 0.17, 0.5, 12]} />{c('#fafafa')}</mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.sin(a) * 0.207, 0.25, Math.cos(a) * 0.207]} rotation={[0, a, 0]}>
                <boxGeometry args={[0.07, 0.5, 0.02]} />
                {c('#e53935')}
              </mesh>
            )
          })}
          {[[0, 0.55, 0, 0.13], [0.11, 0.52, 0.06, 0.1], [-0.1, 0.53, -0.04, 0.11], [0.02, 0.5, -0.13, 0.1], [-0.05, 0.51, 0.13, 0.1], [0.04, 0.66, 0.02, 0.09]].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]}><icosahedronGeometry args={[r, 0]} />{flat('#fff59d')}</mesh>
          ))}
        </group>
      </group>
      {merged ? <DriveInLot sx={sx} sz={sz} /> : (
        <>
          {[[-0.45, '#1e88e5'], [0.45, '#fdd835']].map(([x, col]) => (
            <group key={x as number} position={[x as number, 0.05, 0.32]} rotation-y={Math.PI}>
              <CarModel body={x === -0.45 ? 'classic' : 'compact'} color={col as string} />
            </group>
          ))}
          {[[-0.9, -0.2], [0, -0.2], [0.9, -0.2], [-0.9, 0.9], [0, 0.9]].map(([x, z], i) => <SpeakerPost key={i} x={x} z={z} />)}
        </>
      )}
    </group>
  )
}

function SpeakerPost({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.025, 0.025, 0.5, 6]} />{c('#78909c')}</mesh>
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.12, 0.08, 0.06]} />{c('#37474f')}</mesh>
    </group>
  )
}

const LOT_BODIES = ['classic', 'compact', 'sedan', 'coupe', 'wagon', 'hatch', 'muscle', 'suv'] as const
const LOT_COLORS = ['#1e88e5', '#fdd835', '#e53935', '#43a047', '#fafafa', '#8e24aa', '#fb8c00', '#00897b', '#546e7a']
// Most a merged lot parks, so a giant 4x4 drive-in stays cheap to build.
const LOT_MAX = 30

// Rows of cars facing the screen, laid out in town units over a merged lot.
// Positions are in the model's scaled space; each car and post sits in an
// Upright at true size. A few bays stay empty so the lot doesn't look tiled.
function DriveInLot({ sx, sz }: { sx: number; sz: number }) {
  const bay = 1.15 // car to car across a row
  const cols = Math.max(2, Math.floor((3 * sx) / bay))
  // The lot runs from just behind the screen to the back fence.
  const front = -0.6 * sz + 0.55
  const back = 1.45 * sz - 0.6
  const rows = sz === 1 ? 1 : Math.max(1, Math.floor((back - front) / 1.45) + 1)
  const rowZ = (r: number) => (rows === 1 ? 0.32 : front + ((back - front) * r) / (rows - 1))
  // The snack bar stands in the back corner (model space 1.2, 1.3), about
  // 1 x 0.86 across; keep a car clear of it, with a wider gap on the road
  // side where the tall stand would hide a car from the camera.
  const snack = (x: number, z: number) => x > 1.2 * sx - 0.5 * sx - 0.9 && Math.abs(z - 1.3 * sz) < 0.43 * sz + 0.6
  const cars: { x: number; z: number; i: number }[] = []
  const posts: [number, number][] = []
  for (let r = 0; r < rows; r++) {
    const z = rowZ(r)
    for (let i = 0; i <= cols; i++) {
      const x = (i - cols / 2) * bay
      if (!snack(x, z - 0.52)) posts.push([x, z - 0.52])
    }
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5 - cols / 2) * bay
      if (snack(x, z)) continue
      const n = r * 31 + i * 7
      // Leave about one bay in five empty, never the front row's middle.
      if ((Math.imul(n + 1, 0x9e3779b1) >>> 0) % 5 === 0 && !(r === 0 && Math.abs(x) < bay)) continue
      cars.push({ x, z, i: n })
    }
  }
  return (
    <>
      {cars.slice(0, LOT_MAX).map(({ x, z, i }) => (
        <group key={`${x},${z}`} position={[x / sx, 0.05, z / sz]}>
          <Upright size={1}>
            <group rotation-y={Math.PI}>
              <CarModel body={LOT_BODIES[i % LOT_BODIES.length]} color={LOT_COLORS[(i * 5) % LOT_COLORS.length]} />
            </group>
          </Upright>
        </group>
      ))}
      {posts.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x / sx, 0, z / sz]}>
          <Upright size={1}><SpeakerPost x={0} z={0} /></Upright>
        </group>
      ))}
    </>
  )
}

// House: white window frames and flower boxes, shutters, a porch canopy over
// the door and bushes by the corners.
export function HouseDetail() {
  return (
    <group>
      {[-0.4, 0.4].map((x) => (
        <group key={x}>
          <Box p={[x, 0.75, 0.615]} s={[0.34, 0.035, 0.03]}>{c('#fafafa')}</Box>
          <Box p={[x, 0.455, 0.63]} s={[0.32, 0.05, 0.07]}>{c('#795548')}</Box>
          {[-0.09, 0, 0.09].map((fx, i) => <mesh key={fx} position={[x + fx, 0.5, 0.64]}><icosahedronGeometry args={[0.045, 0]} />{flat(['#ff4081', '#ffeb3b', '#ff4081'][i])}</mesh>)}
          <Box p={[x + Math.sign(x) * 0.19, 0.6, 0.607]} s={[0.07, 0.28, 0.015]}>{c('#795548')}</Box>
        </group>
      ))}
      <Box p={[0, 0.66, 0.627]} s={[0.36, 0.035, 0.03]}>{c('#fafafa')}</Box>
      <Box p={[0, 0.77, 0.75]} s={[0.5, 0.035, 0.28]} r={[0.25, 0, 0]} cast>{c('#fafafa')}</Box>
      {[-1, 1].map((sd) => <Box key={sd} p={[sd * 0.22, 0.37, 0.86]} s={[0.035, 0.74, 0.035]}>{c('#fafafa')}</Box>)}
      {[[-0.6, 0.66, 0.16], [0.6, 0.66, 0.13], [-0.66, -0.5, 0.15]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, r * 0.8, z]} castShadow><icosahedronGeometry args={[r, 0]} />{flat('#43a047')}</mesh>
      ))}
    </group>
  )
}

// Fuller oak crown and root flare.
export function TreeDetail() {
  return (
    <group>
      {([[0.25, 1.3, -0.22, 0.3], [-0.28, 1.32, 0.18, 0.28], [0.22, 1.2, 0.3, 0.26]] as const).map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow><icosahedronGeometry args={[r, 1]} />{flat(PAL.leaves[(i + 2) % 5])}</mesh>
      ))}
      {[0, 1, 2, 3].map((i) => {
        const a = i * 1.57 + 0.4
        return (
          <mesh key={i} position={[Math.sin(a) * 0.15, 0.04, Math.cos(a) * 0.15]} rotation={[Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9]}>
            <coneGeometry args={[0.05, 0.18, 5]} />
            {c('#7b5034')}
          </mesh>
        )
      })}
    </group>
  )
}

// Fountain: an upper bowl, arcs of water and a stone rim.
export function FountainDetail({ stone }: { stone: string }) {
  return (
    <group>
      <mesh position={[0, 0.92, 0]} castShadow><cylinderGeometry args={[0.38, 0.2, 0.12, 20]} />{c(stone)}</mesh>
      <mesh position={[0, 0.985, 0]}><cylinderGeometry args={[0.32, 0.32, 0.02, 20]} />{c('#b3e5fc')}</mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return [0.45, 0.6].map((r, j) => (
          <mesh key={`${i}${j}`} position={[Math.sin(a) * r, 0.62 - j * 0.22, Math.cos(a) * r]}>
            <sphereGeometry args={[0.04 - j * 0.008, 6, 5]} />
            {c('#b3e5fc')}
          </mesh>
        ))
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.sin(a) * 0.86, 0.32, Math.cos(a) * 0.86]} rotation-y={a}>
            <boxGeometry args={[0.36, 0.05, 0.12]} />
            {c('#cfd8dc')}
          </mesh>
        )
      })}
    </group>
  )
}

// Flower bed: a timber border and leaves under the blooms.
export function FlowerDetail() {
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[[0, 0, -0.66, 0.66][i], 0.11, [-0.66, 0.66, 0, 0][i]]} castShadow>
          <boxGeometry args={i < 2 ? [1.4, 0.22, 0.08] : [0.08, 0.22, 1.4]} />
          {c('#8d6e63')}
        </mesh>
      ))}
      {[[-0.4, -0.4], [0, -0.35], [0.4, -0.4], [-0.35, 0], [0.05, 0.05], [0.4, 0], [-0.4, 0.4], [0, 0.4], [0.4, 0.38]].map(([x, z], i) => (
        <mesh key={i} position={[x + 0.07, 0.2, z + 0.06]}><icosahedronGeometry args={[0.12, 0]} />{flat('#43a047')}</mesh>
      ))}
    </group>
  )
}

// Park bench: slatted seat and back, armrests and a bin.
export function BenchDetail({ wood, iron }: { wood: string; iron: string }) {
  return (
    <group>
      {[-0.1, 0, 0.1].map((z) => <Box key={z} p={[0, 0.34, z]} s={[1, 0.03, 0.08]}>{c(wood)}</Box>)}
      {[0.46, 0.58].map((y) => <Box key={y} p={[0, y, -0.18]} s={[1, 0.08, 0.03]} cast>{c(wood)}</Box>)}
      {[-0.48, 0.48].map((x) => <Box key={x} p={[x, 0.45, 0]} s={[0.05, 0.04, 0.3]}>{c(iron)}</Box>)}
      <group position={[0.72, 0, 0.1]}>
        <mesh position={[0, 0.16, 0]} castShadow><cylinderGeometry args={[0.1, 0.09, 0.32, 10]} />{c('#37474f')}</mesh>
        <mesh position={[0, 0.33, 0]}><cylinderGeometry args={[0.11, 0.11, 0.03, 10]} />{c('#546e7a')}</mesh>
      </group>
    </group>
  )
}

// Street lamp: a cast base and a cap over the globe.
export function LampDetail({ iron }: { iron: string }) {
  return (
    <group>
      <mesh position={[0, 0.08, 0]} castShadow><cylinderGeometry args={[0.09, 0.12, 0.16, 8]} />{c(iron)}</mesh>
      <mesh position={[0.38, 1.81, 0]}><coneGeometry args={[0.13, 0.08, 8]} />{c(iron)}</mesh>
      <mesh position={[0.07, 1.68, 0]} rotation-z={0.8}><boxGeometry args={[0.03, 0.18, 0.03]} />{c(iron)}</mesh>
    </group>
  )
}

// Billboard: a catwalk under the board and a ladder up to it.
export function BillboardDetail() {
  return (
    <group>
      <Box p={[0, 1.27, 0.15]} s={[1.8, 0.03, 0.22]}>{c('#78909c')}</Box>
      <Box p={[0, 1.4, 0.25]} s={[1.8, 0.02, 0.02]}>{c('#78909c')}</Box>
      {[-0.07, 0.07].map((x) => <Box key={x} p={[-0.5 + x, 0.64, 0.12]} s={[0.02, 1.28, 0.02]}>{c('#78909c')}</Box>)}
      {[0.2, 0.4, 0.6, 0.8, 1.0, 1.2].map((y) => <Box key={y} p={[-0.5, y, 0.12]} s={[0.14, 0.02, 0.02]}>{c('#78909c')}</Box>)}
    </group>
  )
}

// Golden car statue: stepped plinth with a gold plaque.
export function StatueDetail({ stone }: { stone: string }) {
  return (
    <group>
      <Box p={[0, 0.05, 0]} s={[1.24, 0.1, 1.24]}>{c(stone)}</Box>
      <Box p={[0, 0.72, 0]} s={[1.06, 0.05, 1.06]}>{c(stone)}</Box>
      <mesh position={[0, 0.4, 0.505]}>
        <planeGeometry args={[0.44, 0.16]} />
        <meshStandardMaterial color="#ffc107" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

// Duck pond: lily pads, reeds, edge stones and a little jetty.
export function PondDetail() {
  return (
    <group>
      {[[0.7, -0.6, 0.16], [-0.2, 0.8, 0.13], [0.9, 0.5, 0.11], [-0.9, 0.1, 0.14]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, 0.095, z]} rotation-x={-Math.PI / 2}><circleGeometry args={[r, 10, 0.4, Math.PI * 1.8]} /><meshStandardMaterial color="#43a047" {...decal()} /></mesh>
      ))}
      {[[-1.2, -0.7], [-1.1, -0.85], [-1.3, -0.5], [1.15, 0.9], [1.05, 1.05]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.25, z]} rotation={[0.1 * (i % 3), 0, -0.1 * (i % 2)]}><cylinderGeometry args={[0.015, 0.02, 0.4, 4]} />{c('#558b2f')}</mesh>
      ))}
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + 0.2
        return (
          <mesh key={i} position={[Math.sin(a) * 1.55, 0.08, Math.cos(a) * 1.55]} rotation={[i, i * 2, 0]}>
            <dodecahedronGeometry args={[0.1 + (i % 3) * 0.02, 0]} />
            {c('#9e9e9e')}
          </mesh>
        )
      })}
      <group position={[0.3, 0, 1.25]}>
        {[-0.12, 0, 0.12].map((x) => <Box key={x} p={[x, 0.13, 0]} s={[0.1, 0.03, 0.6]} cast>{c('#8d6e63')}</Box>)}
        {[-0.15, 0.15].map((x) => <mesh key={x} position={[x, 0.08, -0.25]}><cylinderGeometry args={[0.03, 0.03, 0.16, 6]} />{c('#6d4c41')}</mesh>)}
      </group>
    </group>
  )
}

// Garage: roof vents, skylights, an AC unit, a roof hatch and ladder, gutter and bay numbers, downspouts.
export function GarageDetail({ W, D }: { W: number; D: number }) {
  const front = D * 0.3 - 0.3
  return (
    <group>
      {[-1, 0, 1].map((i) => <Box key={i} p={[i * W * 0.28, 1.8, -0.3 - D * 0.1]} s={[0.28, 0.1, 0.22]} cast>{c('#cfd8dc')}</Box>)}
      {/* Skylights over the bays. */}
      {[-1, 0, 1].map((i) => (
        <group key={i} position={[i * W * 0.28, 1.76, front - 0.35]}>
          <Box p={[0, 0, 0]} s={[0.42, 0.04, 0.3]}>{c('#eceff1')}</Box>
          <Box p={[0, 0.03, 0]} s={[0.36, 0.03, 0.24]}>{c('#81d4fa')}</Box>
        </group>
      ))}
      {/* AC unit with a fan grille. */}
      <group position={[-W * 0.3, 1.75, -0.3 - D * 0.22]}>
        <Box p={[0, 0.13, 0]} s={[0.5, 0.26, 0.36]} cast>{c('#b0bec5')}</Box>
        <mesh position={[0, 0.265, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.13, 12]} />{c('#37474f')}</mesh>
        {[-0.06, 0, 0.06].map((x) => <Box key={x} p={[x, 0.27, 0]} s={[0.012, 0.01, 0.26]}>{c('#90a4ae')}</Box>)}
      </group>
      {/* Roof hatch, and a ladder up the side wall to it. */}
      <Box p={[W * 0.3, 1.78, -0.3 - D * 0.22]} s={[0.3, 0.08, 0.3]} cast>{c('#78909c')}</Box>
      <group position={[W * 0.45 + 0.03, 0, -0.3 - D * 0.15]}>
        {[-0.1, 0.1].map((z) => <Box key={z} p={[0, 0.95, z]} s={[0.025, 1.9, 0.025]}>{c('#607d8b')}</Box>)}
        {Array.from({ length: 8 }, (_, i) => <Box key={i} p={[0, 0.25 + i * 0.2, 0]} s={[0.02, 0.02, 0.2]}>{c('#607d8b')}</Box>)}
      </group>
      {/* Gutter along the front edge of the roof. */}
      <Box p={[0, 1.61, D * 0.325 - 0.27]} s={[W * 0.93, 0.07, 0.06]}>{c('#90a4ae')}</Box>
      {/* Bay numbers over the doors. */}
      {[-1.1, 0, 1.1].map((x, i) => (
        <group key={x} position={[x + 0.36, 1.25, front + 0.02]}>
          <Box p={[0, 0, 0]} s={[0.12, 0.12, 0.01]}>{c('#fafafa')}</Box>
          {Array.from({ length: i + 1 }, (_, j) => <Box key={j} p={[(j - i / 2) * 0.03, 0, 0.006]} s={[0.014, 0.08, 0.004]}>{c('#263238')}</Box>)}
        </group>
      ))}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * W * 0.44, 0.85, D * 0.3 - 0.27]}><cylinderGeometry args={[0.025, 0.025, 1.7, 6]} />{c('#90a4ae')}</mesh>
      ))}
    </group>
  )
}

// Ground clutter for a road tile: a manhole cover.
export function Manhole({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, LAYER.paint, z]} rotation-x={-Math.PI / 2}>
      <circleGeometry args={[0.17, 18]} />
      <meshStandardMaterial map={manholeTex()} {...decal()} />
    </mesh>
  )
}

// Obstacles on new land: pebbles round the boulder, a flower on the cactus and
// berries in the bushes.
export function ObstacleDetail({ id }: { id: string }) {
  if (id === 'cactus')
    return (
      <group>
        <mesh position={[0, 1.38, 0]}><icosahedronGeometry args={[0.09, 0]} />{flat('#ff4081')}</mesh>
        <mesh position={[0.37, 1.13, 0]}><icosahedronGeometry args={[0.06, 0]} />{flat('#ffeb3b')}</mesh>
        {[[0.4, 0.3], [-0.35, 0.35], [0.1, -0.45]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.13, z]} rotation={[i, i, 0]}><dodecahedronGeometry args={[0.06, 0]} />{c('#9e9e9e')}</mesh>
        ))}
      </group>
    )
  if (id === 'rock')
    return (
      <group>
        {[[-0.55, -0.3, 0.12], [-0.3, 0.55, 0.09], [0.6, -0.4, 0.1], [0.15, 0.7, 0.07]].map(([x, z, r], i) => (
          <mesh key={i} position={[x, r * 0.7, z]} rotation={[i, i * 2, 0]} castShadow><dodecahedronGeometry args={[r, 0]} />{c('#757575')}</mesh>
        ))}
        <mesh position={[-0.1, 0.92, 0.1]} scale={[1, 0.35, 1]}><icosahedronGeometry args={[0.28, 0]} />{flat('#558b2f')}</mesh>
      </group>
    )
  if (id === 'bush')
    return (
      <group>
        {[[-0.3, 0.55, 0.45], [0.35, 0.5, 0.2], [0.1, 0.5, 0.62], [-0.55, 0.35, 0.2], [0.55, 0.3, -0.1]].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z - 0.1]}><sphereGeometry args={[0.045, 6, 5]} />{c('#e53935')}</mesh>
        ))}
      </group>
    )
  return null
}
