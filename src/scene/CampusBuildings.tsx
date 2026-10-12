import type { ReactNode } from 'react'
import { levelLift, type BuildingDef } from '../game/data'
import { signTexture } from './signTexture'
import { Upright } from './mergeScale'
import { PAL } from './season'
import { asphaltTex, brickTex, grassTex, paverTex, sidingTex, shingleTex } from './textures'
import { Box, Cyl, Sign, Pool, Bulbs, Flag, ShellBuilding, BlockCar, GOLD, SNOW, type Mat, type V3 } from './NewBuildings'
import { Crowd, LearnerCar, StudentCars } from './CampusLife'
import { loop, smoothLoop, track, playMove, routeMove } from './campusPaths'

// Schools, the university and the driving academy: the big late-game lots.
// Static pieces share the town's colours so Batch merges them; the people and
// learner cars that move are in CampusLife (left out of Batch). Lots face +z.
// Every one grows a floor every other level (ShellBuilding) and picks up the
// usual upgrade trims, plus a few of its own (more buses, a skid pad, banners).

export const CAMPUS_MODELS = new Set(['academy', 'school', 'highschool', 'university'])

type Props = { def: BuildingDef; ghost?: boolean; m: Mat; win: ReactNode; bulb: ReactNode; level?: number }

const GROW = 0.5
const PAINT = '#fafafa'
const YELLOW = '#fdd835'
const BUS = '#f9a825'
const roofSnow = (c: string) => (SNOW ? '#f4f8fb' : c)

// A flat painted mark on the ground (y is its height above the lot).
function Paint({ m, at, s, c = PAINT, rot = 0 }: { m: Mat; at: V3; s: [number, number]; c?: string; rot?: number }) {
  return (
    <mesh position={at} rotation={[-Math.PI / 2, 0, rot]}>
      <planeGeometry args={s} />
      {m(c)}
    </mesh>
  )
}

// A round flat patch (a skid pad, a hopscotch spot, a track bend).
function Disc({ m, at, r, c, seg = 24, map }: { m: Mat; at: V3; r: number; c: string; seg?: number; map?: Parameters<Mat>[1] }) {
  return (
    <mesh position={at} receiveShadow>
      <cylinderGeometry args={[r, r, 0.012, seg]} />
      {m(c, map)}
    </mesh>
  )
}

// Cartoon tree in the season's colours, like the town oak but smaller.
function Tree({ m, at, s = 1 }: { m: Mat; at: V3; s?: number }) {
  return (
    <group position={at} scale={s}>
      <Cyl m={m} at={[0, 0.3, 0]} r={0.06} r2={0.1} h={0.6} c="#7b5034" seg={7} />
      {([[0, 0.85, 0, 0.36], [0.2, 0.7, 0.08, 0.25], [-0.2, 0.72, -0.05, 0.27], [0.03, 1.08, -0.03, 0.24]] as const).map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={PAL.leaves[i]} flatShading />
        </mesh>
      ))}
    </group>
  )
}

// Lamp post with a warm head that lights at night, and its pool of light.
function Lamp({ m, bulb, at, ghost, banner }: { m: Mat; bulb: ReactNode; at: V3; ghost?: boolean; banner?: string }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.5, 0]} r={0.025} r2={0.035} h={1} c="#263238" seg={6} />
      <mesh position={[0, 1.04, 0]}><sphereGeometry args={[0.07, 8, 6]} />{bulb}</mesh>
      {banner && <Box m={m} at={[0.08, 0.72, 0.006]} s={[0.12, 0.3, 0.012]} c={banner} shadow={false} />}
      {!ghost && <Pool r={0.5} />}
    </group>
  )
}

function Bench({ m, at, rot = 0 }: { m: Mat; at: V3; rot?: number }) {
  return (
    <group position={at} rotation-y={rot}>
      <Box m={m} at={[0, 0.16, 0]} s={[0.46, 0.035, 0.14]} c="#8d6e63" />
      <Box m={m} at={[0, 0.27, -0.07]} s={[0.46, 0.12, 0.025]} c="#8d6e63" />
      {[-0.19, 0.19].map((x) => <Box key={x} m={m} at={[x, 0.08, 0]} s={[0.03, 0.16, 0.12]} c="#37474f" shadow={false} />)}
    </group>
  )
}

function Cone({ m, at }: { m: Mat; at: V3 }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.01, 0]} s={[0.12, 0.02, 0.12]} c="#ff6f00" shadow={false} />
      <mesh position={[0, 0.1, 0]} castShadow><coneGeometry args={[0.05, 0.18, 8]} />{m('#ff6f00')}</mesh>
      <mesh position={[0, 0.11, 0]}><cylinderGeometry args={[0.033, 0.042, 0.035, 8]} />{m(PAINT)}</mesh>
    </group>
  )
}

// A yellow school bus, long along z: black rub rails, a row of windows, a stop arm.
function SchoolBus({ m, at, rot = 0 }: { m: Mat; at: V3; rot?: number }) {
  return (
    <group position={at}>
      {/* Bus-sized however big the block it's parked in. */}
      <Upright size={1}>
        <group rotation-y={rot}>
          <Box m={m} at={[0, 0.3, -0.06]} s={[0.44, 0.4, 1.12]} c={BUS} />
          <Box m={m} at={[0, 0.2, 0.58]} s={[0.42, 0.22, 0.2]} c={BUS} />
          <Box m={m} at={[0, 0.51, -0.06]} s={[0.4, 0.04, 1.08]} c="#fafafa" />
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <Box m={m} at={[sd * 0.222, 0.4, -0.08]} s={[0.006, 0.12, 0.96]} c="#263238" shadow={false} />
              {[0.22, 0.14].map((y) => <Box key={y} m={m} at={[sd * 0.223, y, -0.06]} s={[0.006, 0.02, 1.1]} c="#212121" shadow={false} />)}
            </group>
          ))}
          <Box m={m} at={[0, 0.4, 0.487]} s={[0.36, 0.13, 0.006]} c="#263238" shadow={false} />
          <Box m={m} at={[0, 0.48, 0.498]} s={[0.24, 0.05, 0.01]} c="#212121" shadow={false} />
          <Box m={m} at={[-0.25, 0.32, 0.3]} s={[0.05, 0.1, 0.01]} c="#d32f2f" shadow={false} />
          <Box m={m} at={[0, 0.12, 0.69]} s={[0.46, 0.06, 0.03]} c="#212121" shadow={false} />
          {[0.42, -0.38].map((z) => (
            <mesh key={z} position={[0, 0.1, z]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.1, 0.1, 0.46, 10]} />
              {m('#212121')}
            </mesh>
          ))}
        </group>
      </Upright>
    </group>
  )
}

// Ground-floor windows along a building front (x positions), with white sills.
function FrontWindows({ m, win, xs, y, z, w = 0.34, h = 0.36 }: { m: Mat; win: ReactNode; xs: number[]; y: number; z: number; w?: number; h?: number }) {
  return (
    <group>
      {xs.map((x) => (
        <group key={x}>
          <mesh position={[x, y, z]}><planeGeometry args={[w, h]} />{win}</mesh>
          <Box m={m} at={[x, y - h / 2 - 0.02, z + 0.03]} s={[w + 0.06, 0.035, 0.06]} c="#fafafa" shadow={false} />
        </group>
      ))}
    </group>
  )
}

// Classical columns under a triangular pediment (centre x, front z, width, column height).
function Portico({ m, x, z, w, h, n, c = '#fafafa' }: { m: Mat; x: number; z: number; w: number; h: number; n: number; c?: string }) {
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2].map((i) => <Box key={i} m={m} at={[0, 0.03 + i * 0.05, 0.12 - i * 0.07 + 0.12]} s={[w + 0.3 - i * 0.1, 0.06 + i * 0.05, 0.3]} c="#e0e0e0" shadow={false} />)}
      {Array.from({ length: n }, (_, i) => (
        <Cyl key={i} m={m} at={[-w / 2 + (w * i) / (n - 1), h / 2 + 0.12, 0]} r={0.06} r2={0.07} h={h - 0.12} c={c} seg={10} />
      ))}
      <Box m={m} at={[0, h + 0.1, -0.08]} s={[w + 0.22, 0.14, 0.42]} c={c} />
      <mesh position={[0, h + 0.27, -0.08]} rotation={[-Math.PI / 2, 0, 0]} scale={[(w + 0.22) / 0.416, 1, 0.83]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.42, 3]} />
        {m(c)}
      </mesh>
    </group>
  )
}

export function CampusModel({ def, ghost, m, win, bulb, level = 1 }: Props) {
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  // Schools spread out more than up: half the usual upgrade height.
  const lift = levelLift(lvl) * GROW
  const shell = { m, win, bulb, ghost, lvl, grow: GROW }
  const live = !ghost

  switch (def.id) {
    // ---- Driving Academy: an office, a carport of learner cars and a cone course ----
    case 'academy': {
      const h = 1.15 + lift
      // Learners weave east along the near lane, swing round the far end and
      // cruise back along the outer lane. The course keeps clear of the strip
      // along the front where townspeople come and go at the doors, and of the
      // office, signs and parking box; the two lanes sit far enough apart that
      // passing cars never touch (checked frame by frame against car boxes).
      const weave = smoothLoop([
        [-1, 0.43], [-0.8, 0.36], [-0.4, 0.43], [0, 0.5], [0.4, 0.43], [0.8, 0.36], [1, 0.43], [1.27, 0.54],
        [1.39, 0.81], [1.27, 1.09], [1, 1.2], [0, 1.2], [-1, 1.2], [-1.27, 1.09], [-1.39, 0.81], [-1.27, 0.54],
      ])
      return (
        <group>
          <Box m={m} at={[0, 0.03, 0]} s={[3.9, 0.06, 3.9]} c="#ffffff" t={asphaltTex()} shadow={false} />
          {/* Course markings: an outer lane, the slalom line, a stop line and a crosswalk. */}
          <Paint m={m} at={[0, 0.062, 1.9]} s={[3.8, 0.04]} />
          <Paint m={m} at={[0, 0.062, -0.3]} s={[3.8, 0.04]} />
          {[-1, 1].map((sd) => <Paint key={sd} m={m} at={[sd * 1.9, 0.062, 0.8]} s={[0.04, 2.2]} />)}
          {/* Cones on the island between the two lanes. */}
          <Paint m={m} at={[0, 0.062, 0.82]} s={[2.0, 0.02]} c={YELLOW} />
          {[-0.8, 0.8].map((x) => <Cone key={x} m={m} at={[x, 0.06, 0.82]} />)}
          {[-0.25, 0, 0.25, 0.5].map((x) => <Paint key={x} m={m} at={[x - 1.0, 0.063, 0.0]} s={[0.12, 0.42]} />)}
          <Paint m={m} at={[-0.4, 0.063, -0.08]} s={[0.06, 0.4]} />
          {/* Parallel parking box with cones at its corners. */}
          <Paint m={m} at={[0.85, 0.063, 0.02]} s={[1.0, 0.03]} c={YELLOW} />
          <Paint m={m} at={[0.85, 0.063, -0.22]} s={[1.0, 0.03]} c={YELLOW} />
          <Cone m={m} at={[0.33, 0.06, -0.15]} />
          <Cone m={m} at={[1.37, 0.06, -0.15]} />
          {/* Skid pad from level 4: a wet-look circle with a painted ring. */}
          {lvl >= 4 && (
            <group>
              <Disc m={m} at={[1.45, 0.066, -0.55]} r={0.36} c={PAINT} />
              <Disc m={m} at={[1.45, 0.068, -0.55]} r={0.33} c="#78909c" />
            </group>
          )}
          {/* Stop sign and a little set of training lights at the stop line. */}
          <group position={[-0.05, 0.06, -0.25]}>
            <Cyl m={m} at={[0, 0.35, 0]} r={0.015} h={0.7} c="#9e9e9e" seg={6} />
            <mesh position={[0, 0.72, 0.02]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.1, 0.1, 0.015, 8]} />{m('#d32f2f')}</mesh>
          </group>
          <group position={[-1.85, 0.06, -0.15]}>
            <Cyl m={m} at={[0, 0.4, 0]} r={0.02} h={0.8} c="#37474f" seg={6} />
            <Box m={m} at={[0, 0.88, 0]} s={[0.12, 0.3, 0.1]} c="#212121" />
            {[['#e53935', 0.97], [YELLOW, 0.88], ['#43a047', 0.79]].map(([c, y]) => (
              <mesh key={c} position={[0, Number(y), 0.052]}><circleGeometry args={[0.035, 10]} />{c === '#43a047' ? bulb : m(String(c))}</mesh>
            ))}
          </group>
          {/* The office, with a giant learner plate on the roof. */}
          <ShellBuilding {...shell} w={1.9} d={1.2} h0={1.15} x0={-0.95} z0={-1.3} wall="#eceff1" tex="siding" roof="#ff6f00" sign="DRIVING ACADEMY" signBg="#ff6f00" signFg="#ffffff" shopfront="#ff6f00" />
          {live && (
            <group position={[-0.95, h + 0.15, -1.65]} rotation-x={-0.25}>
              <Box m={m} at={[0, 0.25, -0.03]} s={[0.56, 0.56, 0.04]} c="#d50000" />
              <mesh position={[0, 0.25, 0]}><planeGeometry args={[0.5, 0.5]} /><meshBasicMaterial map={signTexture('L', '#ffffff', '#d50000', 1)} toneMapped={false} /></mesh>
              {[-0.2, 0.2].map((x) => <Box key={x} m={m} at={[x, -0.02, -0.06]} s={[0.04, 0.3, 0.04]} c="#78909c" />)}
            </group>
          )}
          {/* Carport for the academy's own cars. */}
          <group position={[1.05, 0, -1.35]}>
            {[[-0.8, -0.45], [0.8, -0.45], [-0.8, 0.45], [0.8, 0.45]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.45, z]} s={[0.07, 0.9, 0.07]} c="#90a4ae" />)}
            <Box m={m} at={[0, 0.93, 0]} s={[1.8, 0.06, 1.1]} c={roofSnow('#ff6f00')} />
            {[-0.4, 0.4].map((x) => <Paint key={x} m={m} at={[x, 0.063, 0]} s={[0.03, 0.9]} />)}
            {live && <group position={[-0.4, 0.06, 0.05]}><Upright><LearnerCar i={1} rot={Math.PI} /></Upright></group>}
            {live && lvl < 7 && <group position={[0.4, 0.06, 0.05]}><Upright><LearnerCar i={0} rot={Math.PI} /></Upright></group>}
          </group>
          {live && <Tree m={m} at={[-1.66, 0.06, -0.55]} s={0.7} />}
          {live && <Lamp m={m} bulb={bulb} ghost={ghost} at={[1.85, 0.06, 0.2]} />}
          {live && <Lamp m={m} bulb={bulb} ghost={ghost} at={[-1.85, 0.06, 1.85]} />}
          {live && <StudentCars n={lvl >= 7 ? 3 : 2} drive={weave} />}
          {live && <Crowd n={2} move={(i, t) => [-0.6 + i * 0.3 + Math.sin(t * 0.3 + i) * 0.1, -0.45 + Math.cos(t * 0.25 + i) * 0.05]} hours="campus" />}
        </group>
      )
    }

    // ---- Elementary School: brick schoolhouse, gym, bus loop and playground ----
    case 'school': {
      const h = 1.3 + lift
      const kids = 6 + Math.floor(lvl / 2)
      return (
        <group>
          <Box m={m} at={[0, 0.03, 0]} s={[3.894, 0.06, 3.9]} c="#ffffff" t={grassTex(2, 2)} shadow={false} />
          {/* Bus loop along the front with a yellow curb. */}
          <Box m={m} at={[0, 0.035, 1.5]} s={[3.9, 0.07, 0.8]} c="#ffffff" t={asphaltTex()} shadow={false} />
          <Box m={m} at={[0, 0.06, 1.08]} s={[3.9, 0.05, 0.06]} c={YELLOW} shadow={false} />
          <Paint m={m} at={[-0.6, 0.072, 1.82]} s={[0.9, 0.18]} c={YELLOW} />
          <SchoolBus m={m} at={[-0.95, 0.07, 1.5]} rot={Math.PI / 2} />
          {lvl >= 5 && <SchoolBus m={m} at={[0.75, 0.07, 1.5]} rot={Math.PI / 2} />}
          {/* Path to the door and a flag out front. */}
          <Box m={m} at={[-0.5, 0.04, 0.33]} s={[0.55, 0.08, 1.5]} c="#ffffff" t={paverTex(1, 3)} shadow={false} />
          {live && <Flag at={[-1.1, 0.06, 0.6]} color="#1565c0" tall={1.5} star={lvl >= 10} />}
          {/* The schoolhouse. */}
          <ShellBuilding {...shell} w={2.9} d={1.4} h0={1.3} x0={-0.5} z0={-1.15} wall="#c1694f" roof="#1565c0" sign="ELEMENTARY" signBg="#fffde7" signFg="#1565c0" shopfront={null}>
            <FrontWindows m={m} win={win} xs={[-1.15, -0.75, 0.75, 1.15]} y={0.55} z={-0.44} />
            <Portico m={m} x={0} z={-0.3} w={0.7} h={0.95} n={2} />
            <mesh position={[0, 0.4, -0.443]}><planeGeometry args={[0.46, 0.7]} />{m('#5d4037')}</mesh>
            <Box m={m} at={[0, 0.4, -0.438]} s={[0.02, 0.7, 0.01]} c="#3e2723" shadow={false} />
            {/* Bell cupola on the ridge. */}
            <group position={[0, h + 0.14, -1.15]}>
              <Box m={m} at={[0, 0.15, 0]} s={[0.36, 0.3, 0.36]} c="#fafafa" />
              <mesh position={[0, 0.17, 0.182]}><circleGeometry args={[0.09, 14]} />{bulb}</mesh>
              <mesh position={[0, 0.45, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.3, 0.3, 4]} />{m(roofSnow('#1565c0'))}</mesh>
              <Cyl m={m} at={[0, 0.65, 0]} r={0.01} h={0.14} c={GOLD} seg={5} />
            </group>
          </ShellBuilding>
          {/* Gym wing with a rounded roof. */}
          <group position={[1.45, 0, -1.0]}>
            <Box m={m} at={[0, 0.5, 0]} s={[0.95, 1, 1.7]} c="#d7ccc8" t={sidingTex(1, 2)} />
            <mesh position={[0, 1, 0]} rotation-x={-Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.48, 0.48, 1.72, 14, 1, false, -Math.PI / 2, Math.PI]} />
              {m(roofSnow('#1565c0'))}
            </mesh>
            <mesh position={[0, 0.45, 0.856]}><planeGeometry args={[0.4, 0.55]} />{m('#90a4ae')}</mesh>
            <mesh position={[0, 0.85, 0.856]}><planeGeometry args={[0.6, 0.15]} />{win}</mesh>
          </group>
          {/* Playground and blacktop: rubber matting, swings, a slide, hopscotch and four-square. */}
          <Box m={m} at={[1.05, 0.065, 0.45]} s={[1.6, 0.03, 1.05]} c="#e57373" shadow={false} />
          <Paint m={m} at={[0.7, 0.083, 0.45]} s={[0.5, 0.5]} c={PAINT} />
          <Paint m={m} at={[0.7, 0.085, 0.45]} s={[0.46, 0.46]} c="#e57373" />
          <Paint m={m} at={[0.7, 0.087, 0.45]} s={[0.5, 0.02]} />
          <Paint m={m} at={[0.7, 0.087, 0.45]} s={[0.02, 0.5]} />
          {[0, 1, 2, 3].map((i) => <Paint key={i} m={m} at={[1.3 + (i % 2) * 0.1 - 0.05, 0.085, 0.75 - i * 0.14]} s={[0.12, 0.12]} c={['#fdd835', '#4fc3f7', '#81c784', '#ce93d8'][i]} />)}
          <group position={[1.55, 0.08, 0.2]}>
            {[-0.3, 0.3].map((x) => [-1, 1].map((sd) => <Box key={`${x}${sd}`} m={m} at={[x, 0.38, sd * 0.13]} rot={[sd * 0.32, 0, 0]} s={[0.04, 0.78, 0.04]} c="#ff7043" />))}
            <Box m={m} at={[0, 0.74, 0]} s={[0.66, 0.04, 0.04]} c="#ff7043" />
            {[-0.12, 0.12].map((x) => <Box key={x} m={m} at={[x, 0.24, 0]} s={[0.14, 0.025, 0.07]} c="#212121" />)}
            {/* Chains from the seats up to the top bar. */}
            {[-0.18, -0.06, 0.06, 0.18].map((x) => <Box key={`c${x}`} m={m} at={[x, 0.485, 0]} s={[0.008, 0.47, 0.008]} c="#90a4ae" shadow={false} />)}
          </group>
          <group position={[0.45, 0.08, 0.15]}>
            <Box m={m} at={[0, 0.32, 0]} s={[0.3, 0.04, 0.3]} c={YELLOW} />
            {[[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.17, z]} s={[0.035, 0.34, 0.035]} c="#1e88e5" />)}
            <Box m={m} at={[0.32, 0.18, 0]} rot={[0, 0, -0.6]} s={[0.46, 0.03, 0.18]} c="#43a047" />
          </group>
          {/* Welcome sign with this week's news, a bench and a bike rack. */}
          {live && (
            <group position={[-1.45, 0.06, 0.85]}>
              {[-0.3, 0.3].map((x) => <Box key={x} m={m} at={[x, 0.2, 0]} s={[0.06, 0.4, 0.06]} c="#5d4037" />)}
              <Box m={m} at={[0, 0.48, -0.02]} s={[0.78, 0.3, 0.05]} c="#1565c0" />
              <Sign text="SPELLING BEE FRI" w={0.72} at={[0, 0.48, 0.01]} bg="#fffde7" fg="#1565c0" />
            </group>
          )}
          {live && <Bench m={m} at={[-1.45, 0.06, 0.25]} rot={Math.PI / 2} />}
          <group position={[0.1, 0.06, -0.15]}>
            {[-0.15, 0, 0.15].map((x) => (
              <mesh key={x} position={[x, 0, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.08, 0.012, 5, 10, Math.PI]} />{m('#90a4ae')}</mesh>
            ))}
          </group>
          {live && <Tree m={m} at={[-1.6, 0.06, -0.35]} s={0.75} />}
          {live && <Tree m={m} at={[1.75, 0.06, 0.95]} s={0.6} />}
          {live && <Lamp m={m} bulb={bulb} ghost={ghost} at={[0.05, 0.06, 0.95]} />}
          {live && <Crowd n={kids} kids move={playMove(1.05, 0.45, 0.7, 0.42)} hours="school" />}
        </group>
      )
    }

    // ---- High School: three storeys, student parking and a lit football field with a track ----
    case 'highschool': {
      const h = 1.75 + lift
      const cx = 1.85, straight = 1.6, r = 0.82
      const runners = 4 + Math.floor(lvl / 3)
      const towers: [number, number][] = [[0.68, -1.6], [0.68, 1.6], [2.85, -1.7], [2.85, 1.7]]
      return (
        <group>
          <Box m={m} at={[0, 0.03, 0]} s={[5.894, 0.06, 3.9]} c="#ffffff" t={grassTex(3, 2)} shadow={false} />
          {/* Student parking in front: stalls, a few cars and a bus at the kerb. */}
          <Box m={m} at={[-1.45, 0.035, 1.2]} s={[2.95, 0.07, 1.45]} c="#ffffff" t={asphaltTex()} shadow={false} />
          {[-2.6, -2.1, -1.6, -1.1, -0.6].map((x) => <Paint key={x} m={m} at={[x, 0.072, 0.85]} s={[0.03, 0.55]} />)}
          {live && ([[-2.35, '#e53935'], [-1.85, '#fafafa'], [-0.85, '#1e88e5']] as const).map(([x, c]) => <BlockCar key={x} m={m} at={[x, 0.07, 0.85]} c={c} rot={Math.PI} />)}
          {live && lvl >= 4 && <BlockCar m={m} at={[-1.35, 0.07, 0.85]} c="#43a047" rot={Math.PI} />}
          <SchoolBus m={m} at={[-1.6, 0.07, 1.6]} rot={Math.PI / 2} />
          {lvl >= 6 && <SchoolBus m={m} at={[-0.35, 0.07, 1.6]} rot={Math.PI / 2} />}
          {/* The school, with a glass entrance block and a mascot banner. */}
          <ShellBuilding {...shell} w={3.1} d={1.5} h0={1.75} x0={-1.4} z0={-1.15} wall="#a1887f" roof="#2e7d32" sign="HIGH SCHOOL" signBg="#fffde7" signFg="#2e7d32" shopfront={null}>
            <FrontWindows m={m} win={win} xs={[-1.25, -0.85, 0.85, 1.25]} y={0.55} z={-0.394} />
            <Box m={m} at={[0, 0.6, -0.25]} s={[1.0, 1.2, 0.3]} c="#cfd8dc" />
            <mesh position={[0, 0.55, -0.098]}><planeGeometry args={[0.85, 1.0]} />{win}</mesh>
            <Box m={m} at={[0, 1.24, -0.05]} s={[1.2, 0.06, 0.5]} c="#2e7d32" />
            <mesh position={[0, 0.3, -0.094]}><planeGeometry args={[0.4, 0.58]} />{m('#37474f')}</mesh>
            {/* Hung between the upper windows, clear of their sills. */}
            <group position={[0.8, h - 0.5, -0.38]}>
              <Box m={m} at={[0, 0, 0]} s={[0.42, 0.62, 0.02]} c="#2e7d32" shadow={false} />
              <mesh position={[0, 0, 0.012]}><planeGeometry args={[0.36, 0.56]} /><meshBasicMaterial map={signTexture('BOLTS', '#2e7d32', '#fdd835', 0.36 / 0.56)} toneMapped={false} /></mesh>
            </group>
            {/* Rooftop air handlers. */}
            {[-0.9, 0.3].map((x) => <Box key={x} m={m} at={[x, h + 0.25, -1.4]} s={[0.4, 0.22, 0.32]} c="#b0bec5" />)}
          </ShellBuilding>
          {live && <Flag at={[-0.1, 0.06, 0.25]} color="#2e7d32" tall={1.6} star={lvl >= 10} />}
          {/* Track and field: red oval, green pitch, yard lines and goalposts. */}
          <group position={[cx, 0.06, 0]}>
            <Box m={m} at={[0, 0.006, 0]} s={[2 * (r + 0.3), 0.012, straight]} c="#c75b39" shadow={false} />
            {[-1, 1].map((sd) => <Disc key={sd} m={m} at={[0, 0.006, (sd * straight) / 2]} r={r + 0.3} c="#c75b39" seg={28} />)}
            <Box m={m} at={[0, 0.013, 0]} s={[2 * (r - 0.02), 0.012, straight - 0.004]} c={PAINT} shadow={false} />
            {[-1, 1].map((sd) => <Disc key={sd} m={m} at={[0, 0.013, (sd * straight) / 2]} r={r - 0.02} c={PAINT} seg={28} />)}
            <Box m={m} at={[0, 0.02, 0]} s={[2 * (r - 0.06), 0.012, straight - 0.008]} c="#ffffff" t={grassTex(1, 2)} shadow={false} />
            {[-1, 1].map((sd) => <Disc key={sd} m={m} at={[0, 0.017, (sd * straight) / 2]} r={r - 0.06} c={PAL.grass} seg={28} />)}
            {[-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75].map((z) => <Paint key={z} m={m} at={[0, 0.032, z * 1.3]} s={[1.3, 0.02]} />)}
            {[-1, 1].map((sd) => (
              <group key={sd} position={[0, 0, sd * 1.25]}>
                <Cyl m={m} at={[0, 0.2, 0]} r={0.015} h={0.4} c={YELLOW} seg={6} />
                <Box m={m} at={[0, 0.4, 0]} s={[0.4, 0.025, 0.025]} c={YELLOW} />
                {[-0.19, 0.19].map((x) => <Box key={x} m={m} at={[x, 0.6, 0]} s={[0.025, 0.4, 0.025]} c={YELLOW} />)}
              </group>
            ))}
          </group>
          {/* Bleachers on the near side and a scoreboard at the far end. */}
          <group position={[0.42, 0.06, 0]}>
            {[0, 1, 2, 3].map((i) => <Box key={i} m={m} at={[-i * 0.07, 0.07 + i * 0.1, 0]} s={[0.1, 0.14 + i * 0.2, i % 2 ? 1.796 : 1.8]} c={i % 2 ? '#b0bec5' : '#cfd8dc'} />)}
            <Box m={m} at={[-0.252, 0.75, 0]} s={[0.02, 0.4, 1.8]} c="#90a4ae" shadow={false} />
          </group>
          {live && (
            <group position={[1.0, 0.06, -1.85]} rotation-y={0.3}>
              {[-0.28, 0.28].map((x) => <Box key={x} m={m} at={[x, 0.45, 0]} s={[0.05, 0.9, 0.05]} c="#37474f" />)}
              <Box m={m} at={[0, 1.05, 0]} s={[0.76, 0.3, 0.08]} c="#212121" />
              <mesh position={[0, 1.05, 0.042]}><planeGeometry args={[0.7, 0.24]} /><meshBasicMaterial map={signTexture('HOME 21  VIS 14', '#212121', '#ffca28', 0.7 / 0.24)} toneMapped={false} /></mesh>
            </group>
          )}
          {/* Floodlight towers: lit after dark, pooling light on the field. */}
          {towers.map(([x, z]) => (
            <group key={`${x}${z}`} position={[x, 0.06, z]}>
              <Cyl m={m} at={[0, 1.1, 0]} r={0.03} r2={0.05} h={2.2} c="#90a4ae" seg={6} />
              <Box m={m} at={[0, 2.25, 0]} s={[0.36, 0.2, 0.06]} c="#455a64" />
              <mesh position={[0, 2.25, x < cx ? 0.035 : -0.035]} rotation-y={x < cx ? 0 : Math.PI}><planeGeometry args={[0.32, 0.16]} />{bulb}</mesh>
            </group>
          ))}
          {live && <Pool r={1.4} x={cx} z={-0.7} />}
          {live && <Pool r={1.4} x={cx} z={0.7} />}
          {live && <Tree m={m} at={[-2.66, 0.06, -0.15]} s={0.7} />}
          {live && <Lamp m={m} bulb={bulb} ghost={ghost} at={[0.1, 0.06, 1.85]} />}
          {live && <Crowd n={runners} move={routeMove(track(cx, 0, straight, r + 0.14), 16, 0.03)} hours="school" uniform="#2e7d32" />}
          {live && <Crowd n={4} move={routeMove(loop([[-1.4, 0.2], [-0.2, 0.3], [-0.2, 1.95], [-2.8, 1.95], [-2.8, 0.3]]), 40)} hours="campus" />}
        </group>
      )
    }

    // ---- University: a domed hall, two brick halls round a quad, a bell tower and a gate ----
    case 'university': {
      const h = 1.7 + lift
      const hallH = 1.3 + lift
      const students = 8 + lvl
      const banner = lvl >= 4 ? '#6a1b9a' : undefined
      const quad = loop([[0, 2.75], [0, 0.6], [1.25, 0.6], [1.25, -0.9], [0, -1.0], [-1.25, -0.9], [-1.25, 0.6], [0, 0.6]])
      return (
        <group>
          <Box m={m} at={[0, 0.03, 0]} s={[5.9, 0.06, 5.9]} c="#ffffff" t={grassTex(3, 3)} shadow={false} />
          {/* Paths: the long walk from the gate and a cross walk through the quad. */}
          <Box m={m} at={[0, 0.04, 0.55]} s={[0.6, 0.08, 4.9]} c="#ffffff" t={paverTex(1, 8)} shadow={false} />
          <Box m={m} at={[0, 0.042, 0.6]} s={[3.3, 0.084, 0.5]} c="#ffffff" t={paverTex(6, 1)} shadow={false} />
          <Box m={m} at={[0, 0.042, -0.95]} s={[2.9, 0.084, 0.4]} c="#ffffff" t={paverTex(5, 1)} shadow={false} />
          {/* Fountain where the paths cross. */}
          <group position={[0, 0.08, 0.6]}>
            <Cyl m={m} at={[0, 0.07, 0]} r={0.5} h={0.14} c="#cfd8dc" seg={20} />
            <mesh position={[0, 0.13, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.44, 20]} />{m('#4fc3f7')}</mesh>
            <Cyl m={m} at={[0, 0.3, 0]} r={0.06} h={0.36} c="#cfd8dc" seg={8} />
            <Cyl m={m} at={[0, 0.45, 0]} r={0.2} r2={0.12} h={0.06} c="#cfd8dc" seg={14} />
            <mesh position={[0, 0.56, 0]}><sphereGeometry args={[0.07, 8, 6]} />{m('#b3e5fc')}</mesh>
          </group>
          {/* The great hall: stone front, columns, and a dome on a drum. */}
          <ShellBuilding {...shell} w={3.4} d={1.6} h0={1.7} x0={0} z0={-2.05} wall="#e0d6c8" roof="#455a64" shopfront={null}>
            <FrontWindows m={m} win={win} xs={[-1.45, -1.05, 1.05, 1.45]} y={0.6} z={-1.244} h={0.5} />
            <Portico m={m} x={0} z={-0.98} w={1.6} h={1.3} n={6} />
            <mesh position={[0, 0.5, -1.244]}><planeGeometry args={[0.45, 0.8]} />{m('#5d4037')}</mesh>
            <group position={[0, h + 0.14, -2.05]}>
              <Cyl m={m} at={[0, 0.2, 0]} r={0.6} h={0.4} c="#e0d6c8" seg={20} />
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i / 8) * Math.PI * 2
                return <mesh key={i} position={[Math.sin(a) * 0.605, 0.2, Math.cos(a) * 0.605]} rotation-y={a}><planeGeometry args={[0.14, 0.24]} />{win}</mesh>
              })}
              <mesh position={[0, 0.4, 0]} castShadow><sphereGeometry args={[0.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />{m(SNOW ? '#f4f8fb' : lvl >= 6 ? GOLD : '#7fb8a4')}</mesh>
              <Cyl m={m} at={[0, 1.08, 0]} r={0.09} h={0.18} c="#fafafa" seg={8} />
              <mesh position={[0, 1.24, 0]} castShadow><coneGeometry args={[0.1, 0.16, 8]} />{m(GOLD)}</mesh>
            </group>
          </ShellBuilding>
          {/* Brick halls facing each other across the quad. */}
          {[-1, 1].map((sd) => (
            <group key={sd} position={[sd * 2.2, 0, 0.25]} rotation-y={(-sd * Math.PI) / 2}>
              <ShellBuilding {...shell} w={2.7} d={1.1} h0={1.3} z0={0} wall="#b5654a" roof="#37474f" shopfront={null}>
                <FrontWindows m={m} win={win} xs={[-0.95, -0.55, 0.55, 0.95]} y={0.55} z={0.556} />
                <Box m={m} at={[0, 0.42, 0.57]} s={[0.5, 0.84, 0.04]} c="#fafafa" shadow={false} />
                <mesh position={[0, 0.38, 0.594]}><planeGeometry args={[0.4, 0.74]} />{m('#4e342e')}</mesh>
                <mesh position={[0, hallH + 0.3, 0]} rotation-y={Math.PI / 4} castShadow>
                  <coneGeometry args={[0.35, 0.3, 4]} />
                  {m(roofSnow('#37474f'), shingleTex(1, 1))}
                </mesh>
              </ShellBuilding>
            </group>
          ))}
          {/* Bell tower at the back corner, clock on the front. */}
          <group position={[2.35, 0.06, -2.35]}>
            <Box m={m} at={[0, 1.4, 0]} s={[0.6, 2.8, 0.6]} c="#b5654a" t={brickTex(1, 3)} />
            {[-0.24, 0.24].map((x) => [-0.24, 0.24].map((z) => <Box key={`${x}${z}`} m={m} at={[x, 3.05, z]} s={[0.1, 0.5, 0.1]} c="#e0d6c8" />))}
            <mesh position={[0, 3.1, 0]}><sphereGeometry args={[0.13, 10, 8]} />{m(GOLD)}</mesh>
            {/* The yoke the bell hangs from, post to post. */}
            <Box m={m} at={[0, 3.245, 0]} s={[0.58, 0.04, 0.05]} c="#5d4037" shadow={false} />
            <Box m={m} at={[0, 3.33, 0]} s={[0.7, 0.06, 0.7]} c="#e0d6c8" />
            <mesh position={[0, 3.62, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.5, 0.55, 4]} />{m(roofSnow('#455a64'))}</mesh>
            <mesh position={[0, 2.45, 0.302]}><circleGeometry args={[0.2, 18]} />{bulb}</mesh>
            <Box m={m} at={[0, 2.47, 0.31]} rot={[0, 0, 0.9]} s={[0.02, 0.14, 0.01]} c="#212121" shadow={false} />
          </group>
          {/* Front gate: brick pillars with lanterns, and the name over the walk. */}
          <group position={[0, 0.06, 2.72]}>
            {[-1, 1].map((sd) => (
              <group key={sd}>
                <Box m={m} at={[sd * 0.62, 0.55, 0]} s={[0.24, 1.1, 0.24]} c="#b5654a" t={brickTex(1, 2)} />
                <Box m={m} at={[sd * 0.62, 1.13, 0]} s={[0.3, 0.06, 0.3]} c="#e0d6c8" />
                <mesh position={[sd * 0.62, 1.25, 0]}><boxGeometry args={[0.12, 0.16, 0.12]} />{bulb}</mesh>
                {/* Low wall and hedge along the front. */}
                <Box m={m} at={[sd * 1.85, 0.15, 0]} s={[2.2, 0.3, 0.14]} c="#b5654a" t={brickTex(4, 1)} />
                <Box m={m} at={[sd * 1.85, 0.36, -0.12]} s={[2.1, 0.24, 0.16]} c={PAL.bush[0]} />
              </group>
            ))}
            <Box m={m} at={[0, 1.05, 0]} s={[1.5, 0.3, 0.08]} c="#6a1b9a" />
            {live && <Sign text="RIDGEMONT UNIVERSITY" w={1.38} at={[0, 1.05, 0.045]} bg="#6a1b9a" fg="#fafafa" />}
          </group>
          {/* Trees down the walk, benches and lamps round the quad. */}
          {live && [[-0.75, 1.55], [0.75, 1.55], [-0.75, 2.3], [0.75, 2.3], [-2.6, 2.2], [2.6, 2.2], [-2.55, -2.4]].map(([x, z]) => <Tree key={`${x}${z}`} m={m} at={[x, 0.06, z]} s={0.85} />)}
          {live && [[-0.75, 0.95, 0], [0.75, 0.95, Math.PI], [-0.7, -0.6, 0], [0.7, -0.6, Math.PI]].map(([x, z, r]) => <Bench key={`${x}${z}`} m={m} at={[x, 0.06, z]} rot={r + Math.PI / 2} />)}
          {live && [[-0.45, 2.0], [0.45, 2.0], [-1.55, 0.35], [1.55, 0.35], [-1.0, -1.25], [1.0, -1.25]].map(([x, z]) => <Lamp key={`${x}${z}`} m={m} bulb={bulb} ghost={ghost} at={[x, 0.06, z]} banner={banner} />)}
          {live && lvl >= 5 && <Bulbs from={[-0.62, 1.42, 2.72]} to={[0.62, 1.42, 2.72]} n={7} />}
          {live && <Crowd n={students} move={routeMove(quad, 70, 0.12)} hours="campus" />}
          {live && <Pool r={1.2} z={0.6} />}
        </group>
      )
    }
  }
  return null
}
