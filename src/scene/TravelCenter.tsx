import type { ReactNode } from 'react'
import type { BuildingDef } from '../game/data'
import { travelLayout, ISLAND, type TravelLayout } from '../game/travelCenter'
import { Box, Cyl, Bulbs, Flag, GOLD, type Mat, type V3 } from './NewBuildings'
import { LitSign } from './OfficeBuildings'
import { CarModel } from './CarModel'
import { bodyScale } from './townCarSize'
import { TrueSize, useMergeScale } from './mergeScale'
import { glowMats } from './dayNight'
import { signTexture } from './signTexture'
import { asphaltTex, brickTex, concreteTex, pumpTex } from './textures'
import { decal } from './layers'

// Big Bison: the gas station's travel stop, for a merged block at level 7-10
// (see src/game/travelCenter.ts for the layout and why). Built in true units
// for the whole block and kept at true size, so its pumps, cars and doors are
// the size of the people walking in.

const NAME = 'BIG BISON'
const RED = '#c62828'
const YELLOW = '#ffca28'
const BROWN = '#5d4037'
const TAN = '#d9b98c'

type Props = { def: BuildingDef; m: Mat; win: ReactNode; bulb: ReactNode; level: number; ghost?: boolean }

export function TravelCenter(props: Props) {
  const [sx, , sz] = useMergeScale()
  const t = travelLayout(sx, sz)
  return (
    <TrueSize>
      <Stop {...props} t={t} />
    </TrueSize>
  )
}

function Stop({ m, win, bulb, level, ghost, t }: Props & { t: TravelLayout }) {
  const { L, D, store, canopy } = t
  if (ghost) {
    return (
      <group>
        <Box m={m} at={[store.x, store.h / 2, store.z]} s={[store.w, store.h, store.d]} c={TAN} />
        <Box m={m} at={[canopy.x, 1.55, canopy.z]} s={[canopy.w, 0.2, canopy.d]} c="#fafafa" />
      </group>
    )
  }
  return (
    <group>
      {/* Asphalt over the whole block, a kerbed edge, and the painted walk to the doors. */}
      <Box m={m} at={[0, 0.03, 0]} s={[L - 0.12, 0.04, D - 0.12]} c="#ffffff" t={asphaltTex()} shadow={false} />
      <Walk m={m} t={t} />
      <Store m={m} win={win} bulb={bulb} level={level} t={t} />
      <Canopy m={m} bulb={bulb} level={level} t={t} />
      <Parking m={m} t={t} />
      <Pylon m={m} t={t} level={level} />
      {t.statue && <Statue m={m} at={t.statue} gold={level >= 10} />}
      {level >= 9 && <Chargers m={m} t={t} />}
    </group>
  )
}

// The zebra walk from the street to the front doors, and the sidewalk under the porch.
function Walk({ m, t }: { m: Mat; t: TravelLayout }) {
  const { store, door, D } = t
  const z0 = store.z + store.d / 2
  const walk = D / 2 - 0.1 - (z0 + 0.5)
  const n = Math.max(0, Math.floor(walk / 0.18))
  return (
    <group>
      <Box m={m} at={[store.x, 0.06, z0 + 0.253]} s={[store.w + 0.2, 0.06, 0.494]} c="#ffffff" t={concreteTex(store.w / 2, 0.3)} shadow={false} />
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[door[0], 0.051, z0 + 0.6 + i * 0.18]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.5, 0.09]} />
          <meshStandardMaterial color="#fafafa" {...decal()} />
        </mesh>
      ))}
    </group>
  )
}

function Store({ m, win, bulb, level, t }: { m: Mat; win: ReactNode; bulb: ReactNode; level: number; t: TravelLayout }) {
  const { store: s, door } = t
  const zf = s.z + s.d / 2
  const ent = Math.min(1.5, s.w * 0.36)
  // Window bays either side of the entrance, true size across the front.
  const bays: number[] = []
  for (let x = s.x - s.w / 2 + 0.35; x <= s.x + s.w / 2 - 0.3; x += 0.5) if (Math.abs(x - door[0]) > ent / 2 + 0.2) bays.push(x)
  const units: number[] = []
  for (let x = s.x - s.w / 2 + 0.5; x <= s.x + s.w / 2 - 0.5; x += 1.2) units.push(x)
  const signW = Math.min(ent * 1.6, 2.6)
  const posts = Math.max(2, Math.round(s.w / 1.1) + 1)
  const fronts: number[] = []
  for (let x = s.x - s.w / 2 + 0.7; x <= s.x + s.w / 2 - 0.6; x += 2.1) if (Math.abs(x - door[0]) > ent / 2 + 0.55) fronts.push(x)
  return (
    <group>
      {/* Brick walls on a stone base, a white roof deck and a red fascia band. */}
      <Box m={m} at={[s.x, s.h / 2, s.z]} s={[s.w, s.h, s.d]} c={TAN} t={brickTex(s.w * 1.4, s.h * 1.6)} />
      <Box m={m} at={[s.x, 0.17, s.z]} s={[s.w + 0.03, 0.3, s.d + 0.03]} c="#8d6e63" />
      <Box m={m} at={[s.x, s.h + 0.03, s.z]} s={[s.w + 0.06, 0.06, s.d + 0.06]} c="#eceff1" />
      <Box m={m} at={[s.x, s.h - 0.08, zf + 0.04]} s={[s.w + 0.08, 0.22, 0.04]} c={RED} />
      {/* Big shop windows, lit warm after dark. */}
      {bays.map((x) => (
        <group key={x}>
          <mesh position={[x, 0.66, zf + 0.004]}>
            <planeGeometry args={[0.42, 0.68]} />
            {win}
          </mesh>
          <Box m={m} at={[x, 0.34, zf + 0.02]} s={[0.46, 0.04, 0.04]} c="#eceff1" shadow={false} />
        </group>
      ))}
      {/* Stepped false fronts along the roofline, like an old main street. */}
      {fronts.map((x) => (
        <group key={x} position={[x, s.h, zf - 0.04]}>
          <Box m={m} at={[0, 0.14, 0]} s={[0.9, 0.28, 0.08]} c={TAN} t={brickTex(1, 0.35)} />
          <Box m={m} at={[0, 0.3, 0]} s={[0.96, 0.05, 0.12]} c="#8d6e63" shadow={false} />
        </group>
      ))}
      {/* The entrance: a tall red gable with the bison over the doors. */}
      <group position={[door[0], 0, zf]}>
        <Box m={m} at={[0, (s.h + 0.6) / 2, 0.12]} s={[ent, s.h + 0.6, 0.24]} c={RED} />
        <Box m={m} at={[0, s.h + 0.62, 0.12]} s={[ent + 0.08, 0.06, 0.3]} c="#fafafa" />
        <Box m={m} at={[0, 0.5, 0.245]} s={[ent * 0.66, 0.92, 0.01]} c="#37474f" shadow={false} />
        {/* Glass doors with the lit shop behind them: people walk in here. */}
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[(sd * ent * 0.3) / 2 + sd * 0.01, 0.43, 0.252]}>
            <planeGeometry args={[ent * 0.3, 0.76]} />
            {bulb}
          </mesh>
        ))}
        <Box m={m} at={[0, 0.43, 0.256]} s={[0.025, 0.76, 0.01]} c="#cfd8dc" shadow={false} />
        <Box m={m} at={[0, 0.84, 0.256]} s={[ent * 0.62, 0.025, 0.01]} c="#cfd8dc" shadow={false} />
        <LitSign text={NAME} w={signW} at={[0, s.h - 0.1, 0.25]} bg={RED} fg="#fffde7" m={m} />
        <Logo m={m} at={[0, s.h + 0.12 + ent * 0.32, 0.26]} r={ent * 0.32} />
      </group>
      {/* The porch along the front: red roof on white posts, lights underneath. */}
      <group position={[s.x, 0, zf]}>
        <Box m={m} at={[0, 1.16, 0.17]} s={[s.w + 0.1, 0.06, 0.36]} c={RED} />
        <mesh position={[0, 1.126, 0.17]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[s.w, 0.3]} />
          {bulb}
        </mesh>
        {Array.from({ length: posts }, (_, i) => {
          const x = -s.w / 2 + 0.05 + (i * (s.w - 0.1)) / (posts - 1)
          return Math.abs(s.x + x - door[0]) < ent / 2 + 0.1 ? null : <Cyl key={i} m={m} at={[x, 0.6, 0.32]} r={0.035} h={1.08} c="#fafafa" seg={8} />
        })}
      </group>
      <PorchLife m={m} t={t} ent={ent} />
      {/* Roof: air handlers and vents, a flag from level 8. */}
      {units.map((x, i) => (
        <group key={x} position={[x, s.h + 0.06, s.z - s.d * 0.15 + (i % 2) * 0.25]}>
          <Box m={m} at={[0, 0.13, 0]} s={[0.42, 0.26, 0.32]} c="#b0bec5" />
          <mesh position={[0, 0.265, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.11, 12]} />{m('#546e7a')}</mesh>
        </group>
      ))}
      {level >= 8 && <Flag at={[s.x + s.w / 2 - 0.2, s.h + 0.06, s.z - s.d / 2 + 0.2]} color={RED} star={level >= 10} />}
      {/* The name down the side too, for the cars coming the other way. */}
      <group position={[s.x + s.w / 2 + 0.004, s.h * 0.62, s.z]} rotation-y={Math.PI / 2}>
        <LitSign text={NAME} w={Math.min(s.d * 0.85, 1.8)} at={[0, 0, 0]} bg={RED} fg="#fffde7" m={m} />
      </group>
    </group>
  )
}

// Rocking chairs, ice chests, bins and planters along the porch.
function PorchLife({ m, t, ent }: { m: Mat; t: TravelLayout; ent: number }) {
  const { store: s, door } = t
  const z = s.z + s.d / 2 + 0.16
  const spots: number[] = []
  for (let x = s.x - s.w / 2 + 0.3; x <= s.x + s.w / 2 - 0.25; x += 0.42) if (Math.abs(x - door[0]) > ent / 2 + 0.25) spots.push(x)
  return (
    <group position-y={0.09}>
      {spots.map((x, i) => {
        const k = i % 4
        if (k === 0) {
          // Ice chest.
          return (
            <group key={x} position={[x, 0, z]}>
              <Box m={m} at={[0, 0.17, 0]} s={[0.34, 0.34, 0.2]} c="#eceff1" />
              <Box m={m} at={[0, 0.35, 0]} s={[0.36, 0.03, 0.22]} c="#0277bd" />
              <mesh position={[0, 0.2, 0.104]}>
                <planeGeometry args={[0.26, 0.08]} />
                <meshBasicMaterial map={signTexture('ICE', '#29b6f6', '#ffffff', 0.26 / 0.08)} />
              </mesh>
            </group>
          )
        }
        if (k === 2) {
          // Planter with a shrub.
          return (
            <group key={x} position={[x, 0, z]}>
              <Box m={m} at={[0, 0.09, 0]} s={[0.24, 0.18, 0.18]} c="#8d6e63" />
              <mesh position={[0, 0.27, 0]} castShadow><icosahedronGeometry args={[0.13, 0]} />{m('#43a047')}</mesh>
            </group>
          )
        }
        // Rocking chairs, a pair facing the lot.
        return (
          <group key={x} position={[x, 0, z]}>
            {[-0.09, 0.09].map((dx) => (
              <group key={dx} position={[dx, 0, 0]}>
                <Box m={m} at={[0, 0.13, 0]} s={[0.13, 0.025, 0.13]} c={BROWN} shadow={false} />
                <Box m={m} at={[0, 0.24, -0.06]} s={[0.13, 0.22, 0.02]} c={BROWN} shadow={false} />
                {/* Rockers: a curved runner each side, up to the seat. */}
                {[-0.055, 0.055].map((rx) => <Box key={rx} m={m} at={[rx, 0.06, 0]} s={[0.015, 0.12, 0.17]} c={BROWN} shadow={false} />)}
              </group>
            ))}
          </group>
        )
      })}
    </group>
  )
}

// The pump canopies: one long white roof per row of islands, red-banded and lit
// underneath, the name along the front one. Gaps between rows let the pumps
// and cars show from above.
function Canopy({ m, bulb, level, t }: { m: Mat; bulb: ReactNode; level: number; t: TravelLayout }) {
  const c = t.canopy
  const y = 1.55
  const rows = [...new Set(t.islands.map((p) => p.z))].sort((a, b) => a - b)
  // A single row gets the whole canopy; several get a strip each.
  const strips = rows.length > 1 ? rows.map((z) => ({ z, d: 0.56 })) : [{ z: c.z, d: c.d }]
  const names: number[] = []
  const step = 3.2
  const n = Math.max(1, Math.floor(c.w / step))
  for (let i = 0; i < n; i++) names.push(c.x + (i - (n - 1) / 2) * step)
  const panels = Math.max(1, Math.floor(c.w / 0.6))
  const vents = Math.max(1, Math.floor(c.w / 2.4))
  return (
    <group>
      {strips.map((st, i) => {
        const zf = st.z + st.d / 2
        const first = i === strips.length - 1
        return (
          <group key={st.z}>
            <Box m={m} at={[c.x, y, st.z]} s={[c.w, 0.16, st.d]} c="#fafafa" />
            <Box m={m} at={[c.x, y, zf + 0.01]} s={[c.w + 0.04, 0.2, 0.03]} c={RED} />
            <Box m={m} at={[c.x, y, st.z - st.d / 2 - 0.01]} s={[c.w + 0.04, 0.2, 0.03]} c={RED} />
            {[-1, 1].map((sd) => <Box key={sd} m={m} at={[c.x + sd * (c.w / 2 + 0.01), y, st.z]} s={[0.03, 0.2, st.d]} c={RED} />)}
            <Box m={m} at={[c.x, y + 0.115, zf + 0.01]} s={[c.w + 0.05, 0.03, 0.04]} c={YELLOW} shadow={false} />
            <mesh position={[c.x, y - 0.082, st.z]} rotation-x={Math.PI / 2}>
              <planeGeometry args={[c.w - 0.1, st.d - 0.1]} />
              {bulb}
            </mesh>
            {first && names.map((x) => <LitSign key={x} text={NAME} w={1.2} at={[x, y, zf + 0.034]} bg={RED} fg="#fffde7" m={m} />)}
            {first && <Bulbs from={[c.x - c.w / 2, y - 0.13, zf + 0.03]} to={[c.x + c.w / 2, y - 0.13, zf + 0.03]} n={Math.round(c.w * 3)} />}
            {/* Roof vents, and solar panels at level 10. */}
            {Array.from({ length: vents }, (_, j) => (
              <Box key={j} m={m} at={[c.x + (j - (vents - 1) / 2) * 2.4, y + 0.11, st.z]} s={[0.24, 0.06, 0.18]} c="#cfd8dc" shadow={false} />
            ))}
            {level >= 10 && Array.from({ length: panels }, (_, j) => (
              <Box key={`s${j}`} m={m} at={[c.x - c.w / 2 + 0.3 + (j * (c.w - 0.6)) / Math.max(1, panels - 1), y + 0.1, st.z]} rot={[-0.2, 0, 0]} s={[0.5, 0.02, st.d * 0.75]} c="#1a237e" shadow={false} />
            ))}
          </group>
        )
      })}
      {t.islands.map((p, i) => <Island key={i} m={m} at={[p.x, 0, p.z]} h={y - 0.08} n={i} side={p.z === rows[rows.length - 1] ? 1 : p.z === rows[0] ? -1 : 0} />)}
      {t.islands.map((p, i) => (
        <mesh key={`p${i}`} rotation-x={-Math.PI / 2} position={[p.x, 0.056, p.z]} renderOrder={2}>
          <planeGeometry args={[1.8, 1.1]} />
          <primitive object={glowMats.pool} attach="material" dispose={null} />
        </mesh>
      ))}
    </group>
  )
}

const CAR_COLORS = ['#e53935', '#1e88e5', '#fafafa', '#43a047', '#212121', '#fdd835', '#8e24aa', '#90a4ae']
const BODIES = ['sedan', 'hatch', 'truck', 'suv', 'coupe', 'van', 'wagon', 'compact'] as const

// A customer's car, at the size cars drive round town.
export function TownCar({ n }: { n: number }) {
  const body = BODIES[n % BODIES.length]
  return (
    <group scale={bodyScale(body)}>
      <CarModel body={body} color={CAR_COLORS[n % CAR_COLORS.length]} lean />
    </group>
  )
}

// A pump island: two pumps either side of the canopy post, bollards at the ends,
// and now and then a car filling up.
// `side`: which side has room for a car (1 the front, -1 the back, 0 neither,
// between two rows).
function Island({ m, at, h, n, side }: { m: Mat; at: V3; h: number; n: number; side: number }) {
  const half = ISLAND / 2
  const car = side !== 0 && n % 3 !== 2
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.08, 0]} s={[ISLAND, 0.1, 0.32]} c="#cfd8dc" t={concreteTex(2, 0.5)} />
      <Box m={m} at={[0, 0.135, 0]} s={[ISLAND - 0.04, 0.012, 0.3]} c={YELLOW} shadow={false} />
      <Box m={m} at={[0, (h + 0.14) / 2, 0]} s={[0.1, h - 0.14, 0.1]} c="#fafafa" />
      {[-0.36, 0.36].map((x) => (
        <group key={x} position={[x, 0.14, 0]}>
          <Box m={m} at={[0, 0.3, 0]} s={[0.3, 0.6, 0.22]} c="#fafafa" />
          {[0.114, -0.114].map((z) => (
            <mesh key={z} position={[0, 0.3, z]} rotation-y={z < 0 ? Math.PI : 0}>
              <planeGeometry args={[0.28, 0.58]} />
              {m('#ffffff', pumpTex(RED))}
            </mesh>
          ))}
          <Box m={m} at={[0, 0.62, 0]} s={[0.32, 0.05, 0.24]} c={RED} />
        </group>
      ))}
      {[-half + 0.04, half - 0.04].map((x) => (
        <group key={x} position={[x, 0.14, 0]}>
          <Cyl m={m} at={[0, 0.15, 0]} r={0.035} h={0.3} c={YELLOW} seg={8} />
        </group>
      ))}
      <Cyl m={m} at={[0, 0.27, 0.13]} r={0.06} h={0.26} c="#455a64" seg={10} />
      {car && (
        <group position={[n % 2 ? -0.15 : 0.15, 0.05, side * 0.46]} rotation-y={Math.PI / 2}>
          <TownCar n={n} />
        </group>
      )}
    </group>
  )
}

// Parking beside the store: striped bays, some taken, and lamps at the lot's corners.
function Parking({ m, t }: { m: Mat; t: TravelLayout }) {
  const { L, D, bays, store } = t
  const zb = store.z + store.d / 2 - 0.1
  return (
    <group>
      {bays.map((b, i) => (
        <group key={b.x}>
          <mesh position={[b.x - 0.275, 0.051, store.z]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.03, Math.min(store.d, 1.1)]} />
            <meshStandardMaterial color="#fafafa" {...decal()} />
          </mesh>
          {i % 3 !== 2 && (
            <group position={[b.x, 0.05, zb - 0.45]} rotation-y={Math.PI}>
              <TownCar n={i * 3 + 2} />
            </group>
          )}
        </group>
      ))}
      {[[-L / 2 + 0.2, -D / 2 + 0.2], [L / 2 - 0.2, D / 2 - 0.2], [-L / 2 + 0.2, D / 2 - 0.2]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cyl m={m} at={[0, 0.9, 0]} r={0.03} h={1.8} c="#607d8b" seg={8} />
          <Box m={m} at={[0, 1.8, 0]} s={[0.24, 0.05, 0.12]} c="#455a64" shadow={false} />
          <mesh position={[0, 1.77, 0]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[0.2, 0.09]} />
            <primitive object={glowMats.bulb} attach="material" dispose={null} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.056, 0]} renderOrder={2}>
            <planeGeometry args={[1.6, 1.6]} />
            <primitive object={glowMats.pool} attach="material" dispose={null} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// The brand: a cartoon bison's head on a yellow disc with a red rim.
function Logo({ m, at, r }: { m: Mat; at: V3; r: number }) {
  return (
    <group position={at}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[r, r, 0.05, 28]} />
        {m(RED)}
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-z={0.012}>
        <cylinderGeometry args={[r * 0.86, r * 0.86, 0.05, 28]} />
        {m(YELLOW)}
      </mesh>
      <group position-z={0.05} scale={r * 0.95}>
        <BisonHead m={m} />
      </group>
    </group>
  )
}

// Face forward (+z), about one unit across horns and all.
function BisonHead({ m }: { m: Mat }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} scale={[1, 0.9, 0.7]}><sphereGeometry args={[0.36, 14, 10]} />{m('#6d4c41')}</mesh>
      {/* Shaggy crown and beard. */}
      <mesh position={[0, 0.26, -0.02]} scale={[1.2, 0.7, 0.8]}><sphereGeometry args={[0.28, 12, 8]} />{m('#3e2723')}</mesh>
      <mesh position={[0, -0.3, 0.06]} scale={[0.7, 1, 0.6]}><sphereGeometry args={[0.16, 10, 8]} />{m('#3e2723')}</mesh>
      {/* Muzzle and nostrils. */}
      <mesh position={[0, -0.1, 0.22]} scale={[1.1, 0.75, 0.7]}><sphereGeometry args={[0.17, 12, 8]} />{m('#a1887f')}</mesh>
      {[-0.06, 0.06].map((x) => <mesh key={x} position={[x, -0.08, 0.34]}><sphereGeometry args={[0.03, 8, 6]} />{m('#212121')}</mesh>)}
      {/* Big friendly eyes. */}
      {[-0.13, 0.13].map((x) => (
        <group key={x} position={[x, 0.08, 0.22]}>
          <mesh><sphereGeometry args={[0.075, 10, 8]} />{m('#ffffff')}</mesh>
          <mesh position={[0, 0, 0.05]}><sphereGeometry args={[0.035, 8, 6]} />{m('#212121')}</mesh>
        </group>
      ))}
      {/* Horns curling up from the sides. */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.34, 0.18, 0]}>
          <mesh rotation-z={-sd * 1.2}><coneGeometry args={[0.07, 0.24, 10]} />{m('#fff8e1')}</mesh>
          <mesh position={[sd * 0.14, 0.12, 0]} rotation-z={-sd * 0.2}><coneGeometry args={[0.045, 0.18, 10]} />{m('#fff8e1')}</mesh>
        </group>
      ))}
      {/* Ears. */}
      {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.4, 0.02, -0.02]} rotation-z={sd * 0.6} scale={[1, 0.5, 0.4]}><sphereGeometry args={[0.1, 8, 6]} />{m('#5d4037')}</mesh>)}
    </group>
  )
}

// The tall sign by the road: the bison on top, the name and today's price below.
function Pylon({ m, t, level }: { m: Mat; t: TravelLayout; level: number }) {
  const [x, z] = t.pylon
  const h = Math.min(2.6 + t.L * 0.12, 4.6) + (level - 7) * 0.12
  const w = 1.1
  return (
    <group position={[x, 0, z]}>
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[(sd * w) / 3, (h - 0.01) / 2, 0]} s={[0.08, h - 0.01, 0.08]} c="#90a4ae" />)}
      <Box m={m} at={[0, 0.15, 0]} s={[w * 0.9, 0.3, 0.24]} c="#8d6e63" />
      <Box m={m} at={[0, h - 0.2, 0]} s={[w + 0.1, 0.4, 0.1]} c={RED} />
      <LitSign text={NAME} w={w} h={0.3} at={[0, h - 0.2, 0.052]} bg={RED} fg="#fffde7" m={m} />
      <Box m={m} at={[0, h - 0.72, 0]} s={[w * 0.8, 0.5, 0.09]} c="#263238" />
      <mesh position={[0, h - 0.72, 0.048]}>
        <planeGeometry args={[w * 0.72, 0.42]} />
        <meshBasicMaterial map={signTexture('⛽ 4.89', '#263238', '#ffca28', (w * 0.72) / 0.42)} toneMapped={false} />
      </mesh>
      <Logo m={m} at={[0, h + w * 0.42, 0]} r={w * 0.45} />
      <Bulbs from={[-w / 2, h + 0.03, 0.06]} to={[w / 2, h + 0.03, 0.06]} n={9} />
    </group>
  )
}

// The bison out front: a big friendly statue on a plinth, for the photos (gold plinth at level 10).
function Statue({ m, at, gold }: { m: Mat; at: V3; gold: boolean }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.1, 0]} s={[0.7, 0.2, 0.42]} c={gold ? GOLD : '#8d6e63'} />
      <group position={[0, 0.2, 0]}>
        {/* Body: big hump at the shoulders, slimmer hindquarters. */}
        <mesh position={[0.1, 0.42, 0]} scale={[1, 0.95, 0.75]} castShadow><sphereGeometry args={[0.26, 14, 10]} />{m('#5d4037')}</mesh>
        <mesh position={[-0.18, 0.36, 0]} scale={[1, 0.8, 0.7]} castShadow><sphereGeometry args={[0.2, 12, 8]} />{m('#6d4c41')}</mesh>
        {[[0.18, 0.1], [0.18, -0.1], [-0.22, 0.09], [-0.22, -0.09]].map(([x, z]) => (
          <Cyl key={`${x}${z}`} m={m} at={[x, 0.12, z]} r={0.045} h={0.24} c="#4e342e" seg={8} />
        ))}
        <group position={[0.38, 0.4, 0]} rotation-y={Math.PI / 2} scale={0.5}>
          <BisonHead m={m} />
        </group>
        <mesh position={[-0.38, 0.4, 0]} rotation-z={0.6}><cylinderGeometry args={[0.015, 0.02, 0.18, 6]} />{m('#3e2723')}</mesh>
      </group>
    </group>
  )
}

// EV chargers at the far end of the parking row (level 9 and up).
function Chargers({ m, t }: { m: Mat; t: TravelLayout }) {
  const { store: s, L } = t
  return (
    <group>
      {[-0.25, 0.2].map((dz) => (
        <group key={dz} position={[-L / 2 + 0.16, 0, s.z + dz]}>
          <Box m={m} at={[0, 0.28, 0]} s={[0.1, 0.56, 0.16]} c="#eceff1" />
          <mesh position={[0.054, 0.4, 0]} rotation-y={Math.PI / 2}><planeGeometry args={[0.08, 0.08]} /><primitive object={glowMats.bulb} attach="material" dispose={null} /></mesh>
          <Box m={m} at={[0, 0.58, 0]} s={[0.12, 0.04, 0.18]} c="#43a047" shadow={false} />
        </group>
      ))}
    </group>
  )
}
