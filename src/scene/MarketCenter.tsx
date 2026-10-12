import type { ReactNode } from 'react'
import { marketLayout, BAY_D, BAY_W, type MarketLayout } from '../game/marketCenter'
import { Box, Cyl, Bulbs, Flag, GOLD, type Mat, type V3 } from './NewBuildings'
import { LitSign } from './OfficeBuildings'
import { GiantProp } from './GrowthKit'
import { Tree } from './edgeKit'
import { TownCar } from './TravelCenter'
import { TrueSize, useMergeScale } from './mergeScale'
import { glowMats } from './dayNight'
import { signTexture } from './signTexture'
import { PAL, SEASON } from './season'
import { asphaltTex, concreteTex } from './textures'
import { decal } from './layers'

// Fresh Mart Supercenter: the market's form for a merged block at level 7-10
// (see src/game/marketCenter.ts for the layout). Built in true units for the
// whole block and kept at true size, so the doors, carts and cars are the size
// of the shoppers walking in.

const NAME = 'FRESH MART'
const GREEN = '#2e7d32'
const LEAF = '#66bb6a'
const CREAM = '#fff8e1'
const FRUIT = ['#e53935', '#fb8c00', '#fdd835', '#7cb342', '#8e24aa']

type Props = { m: Mat; win: ReactNode; bulb: ReactNode; level: number; ghost?: boolean }

export function MarketCenter(props: Props) {
  const [sx, , sz] = useMergeScale()
  const t = marketLayout(sx, sz)
  return (
    <TrueSize>
      <Center {...props} t={t} />
    </TrueSize>
  )
}

function Center({ m, win, bulb, level, ghost, t }: Props & { t: MarketLayout }) {
  const { L, D, store: s } = t
  if (ghost) return <Box m={m} at={[s.x, s.h / 2, s.z]} s={[s.w, s.h, s.d]} c={CREAM} />
  return (
    <group>
      <Box m={m} at={[0, 0.03, 0]} s={[L - 0.12, 0.04, D - 0.12]} c="#ffffff" t={asphaltTex()} shadow={false} />
      <Store m={m} win={win} bulb={bulb} level={level} t={t} />
      <Walk m={m} t={t} />
      {t.garden && <Garden m={m} bulb={bulb} t={t} />}
      <Parking m={m} t={t} />
      <Pylon m={m} t={t} level={level} />
    </group>
  )
}

function Store({ m, win, bulb, level, t }: { m: Mat; win: ReactNode; bulb: ReactNode; level: number; t: MarketLayout }) {
  const { store: s, door } = t
  const zf = s.z + s.d / 2
  const ent = Math.min(1.6, s.w * 0.34)
  const eh = s.h + 0.35
  // Window bays either side of the entrance, and the produce stands under awnings.
  const bays: number[] = []
  for (let x = s.x - s.w / 2 + 0.35; x <= s.x + s.w / 2 - 0.3; x += 0.5) if (Math.abs(x - door[0]) > ent / 2 + 0.2) bays.push(x)
  const units: number[] = []
  for (let x = s.x - s.w / 2 + 0.6; x <= s.x + s.w / 2 - 0.6; x += 1.3) if (Math.abs(x - door[0]) > 0.9) units.push(x)
  const lights: number[] = []
  for (let x = s.x - s.w / 2 + 0.9; x <= s.x + s.w / 2 - 0.9; x += 1.3) lights.push(x)
  const awn = Math.min(1.5, (s.w - ent) / 2 - 0.3)
  return (
    <group>
      {/* Cream walls on a stone base, a pale roof deck, a deep green fascia. */}
      <Box m={m} at={[s.x, s.h / 2, s.z]} s={[s.w, s.h, s.d]} c={CREAM} t={concreteTex(s.w, s.h)} />
      <Box m={m} at={[s.x, 0.14, s.z]} s={[s.w + 0.03, 0.24, s.d + 0.03]} c="#a1887f" />
      <Box m={m} at={[s.x, s.h + 0.03, s.z]} s={[s.w + 0.06, 0.06, s.d + 0.06]} c="#eceff1" />
      <Box m={m} at={[s.x, s.h - 0.14, zf + 0.04]} s={[s.w + 0.08, 0.3, 0.05]} c={GREEN} />
      <Box m={m} at={[s.x, s.h - 0.31, zf + 0.04]} s={[s.w + 0.08, 0.04, 0.05]} c={LEAF} shadow={false} />
      {bays.map((x) => (
        <group key={x}>
          <mesh position={[x, 0.62, zf + 0.004]}>
            <planeGeometry args={[0.42, 0.62]} />
            {win}
          </mesh>
          <Box m={m} at={[x, 0.29, zf + 0.02]} s={[0.46, 0.04, 0.04]} c="#eceff1" shadow={false} />
        </group>
      ))}
      {/* Rooftop units and skylights; solar panels at level 10. */}
      {units.map((x, i) => (
        <group key={x} position={[x, s.h + 0.06, s.z - s.d * 0.15]}>
          {i % 2 ? (
            <Box m={m} at={[0, 0.02, 0]} s={[0.6, 0.04, 0.5]} c="#b3e5fc" shadow={false} />
          ) : (
            <group>
              <Box m={m} at={[0, 0.12, 0]} s={[0.42, 0.24, 0.32]} c="#b0bec5" />
              <Cyl m={m} at={[0, 0.25, 0]} r={0.1} h={0.03} c="#78909c" seg={12} />
            </group>
          )}
          {level >= 10 && <Box m={m} at={[0, 0.03, s.d * 0.4]} rot={[-0.25, 0, 0]} s={[1.0, 0.03, 0.42]} c="#1a237e" />}
        </group>
      ))}
      {level >= 8 && <Flag at={[s.x + s.w / 2 - 0.2, s.h + 0.06, s.z - s.d / 2 + 0.2]} color={GREEN} star={level >= 10} />}
      {/* The entrance: a tall glass hall with the sign, and a giant apple on the roof behind. */}
      <group position={[door[0], 0, zf]}>
        <Box m={m} at={[0, eh / 2, 0.15]} s={[ent, eh, 0.3]} c={GREEN} />
        <mesh position={[0, (eh - 0.3) / 2 + 0.05, 0.302]}>
          <planeGeometry args={[ent - 0.16, eh - 0.4]} />
          <meshStandardMaterial color="#b3e5fc" roughness={0.1} metalness={0.4} />
        </mesh>
        {/* Two pairs of sliding doors, lit from inside: people walk in here. */}
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * ent * 0.22, 0, 0.306]}>
            <mesh position={[0, 0.4, 0]}>
              <planeGeometry args={[ent * 0.3, 0.72]} />
              {bulb}
            </mesh>
            <Box m={m} at={[0, 0.4, 0.004]} s={[0.02, 0.72, 0.008]} c="#cfd8dc" shadow={false} />
            <mesh position={[0, 0.86, 0.004]}>
              <planeGeometry args={[0.24, 0.1]} />
              <meshBasicMaterial map={signTexture(sd < 0 ? 'IN' : 'OUT', sd < 0 ? GREEN : '#c62828', '#ffffff', 2.4)} toneMapped={false} />
            </mesh>
          </group>
        ))}
        {[-1, 0.5, 1].map((f, i) => <Box key={i} m={m} at={[f === 0.5 ? 0 : (f * (ent - 0.08)) / 2, (eh - 0.3) / 2 + 0.05, 0.31]} s={[0.05, eh - 0.4, 0.02]} c="#eceff1" shadow={false} />)}
        <Box m={m} at={[0, eh + 0.03, 0.15]} s={[ent + 0.08, 0.06, 0.36]} c="#eceff1" />
        <LitSign text={NAME} w={Math.min(ent * 0.9, 1.5)} at={[0, eh - 0.15, 0.31]} bg={GREEN} fg="#ffffff" m={m} />
        <GiantProp m={m} kind="apple" at={[0, s.h + 0.06, -0.6]} s={Math.min(1.3, ent * 0.7)} plinth={level >= 10 ? GOLD : '#fafafa'} />
      </group>
      {/* Striped awnings over the produce stands either side of the doors. */}
      {awn > 0.5 && [-1, 1].map((sd) => {
        const x = door[0] + sd * (ent / 2 + 0.15 + awn / 2)
        const n = Math.max(2, Math.floor(awn / 0.2))
        return (
          <group key={sd} position={[x, 0, zf]}>
            {Array.from({ length: n }, (_, i) => (
              <Box key={i} m={m} at={[-awn / 2 + (i + 0.5) * (awn / n), 1.0, 0.18]} rot={[0.35, 0, 0]} s={[awn / n, 0.03, 0.38]} c={i % 2 ? '#fafafa' : LEAF} shadow={false} />
            ))}
            {Array.from({ length: Math.max(1, Math.floor(awn / 0.42)) }, (_, i) => (
              <Stand key={i} m={m} at={[-awn / 2 + 0.22 + i * 0.42, 0, 0.2]} n={i + sd} />
            ))}
          </group>
        )
      })}
      {/* Night lights along the fascia. */}
      {lights.map((x) => (
        <mesh key={x} position={[x, s.h - 0.33, zf + 0.09]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[0.2, 0.06]} />
          <primitive object={glowMats.bulb} attach="material" dispose={null} />
        </mesh>
      ))}
      <Carts m={m} at={[door[0] + ent / 2 + 0.05, 0, zf + 0.42]} n={4} />
    </group>
  )
}

// A tilted crate stand piled with fruit.
function Stand({ m, at, n }: { m: Mat; at: V3; n: number }) {
  const c = FRUIT[((n % FRUIT.length) + FRUIT.length) % FRUIT.length]
  return (
    <group position={at}>
      {[-0.1, 0.1].map((x) => <Box key={x} m={m} at={[x, 0.11, 0]} s={[0.03, 0.22, 0.22]} c="#6d4c41" />)}
      <Box m={m} at={[0, 0.25, 0]} rot={[0.3, 0, 0]} s={[0.34, 0.08, 0.24]} c="#a1887f" />
      <Box m={m} at={[0, 0.3, 0.012]} rot={[0.3, 0, 0]} s={[0.3, 0.04, 0.2]} c={c} shadow={false} />
    </group>
  )
}

// A row of nested shopping carts, running along x from `at`.
function Carts({ m, at, n }: { m: Mat; at: V3; n: number }) {
  return (
    <group position={at}>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[i * 0.09, 0, 0]}>
          <Box m={m} at={[0.08, 0.2, 0]} s={[0.2, 0.14, 0.16]} c="#b0bec5" shadow={false} />
          <Box m={m} at={[-0.03, 0.3, 0]} s={[0.02, 0.02, 0.17]} c="#e53935" shadow={false} />
          {[-0.06, 0.06].map((z) => <Box key={z} m={m} at={[0.08, 0.08, z]} s={[0.18, 0.1, 0.015]} c="#78909c" shadow={false} />)}
        </group>
      ))}
    </group>
  )
}

// The sidewalk along the shop front and the zebra crossing from the street to the doors.
function Walk({ m, t }: { m: Mat; t: MarketLayout }) {
  const { store: s, door, D, L, trees } = t
  const zf = s.z + s.d / 2
  const z0 = zf + 0.6
  const n = Math.max(0, Math.floor((D / 2 - 0.35 - z0) / 0.18))
  const deep = D >= 3.5
  return (
    <group>
      <Box m={m} at={[s.x, 0.06, zf + 0.17]} s={[s.w, 0.06, 0.34]} c="#ffffff" t={concreteTex(s.w / 2, 0.3)} shadow={false} />
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[door[0], 0.051, z0 + i * 0.18]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.5, 0.09]} />
          <meshStandardMaterial color="#fafafa" {...decal()} />
        </mesh>
      ))}
      {/* A planted strip along the road, with trees, broken for the crossing. */}
      {deep && (
        <group>
          {[[-L / 2 + 0.1, door[0] - 0.42], [door[0] + 0.42, L / 2 - 0.1]].map(([a, b]) => (
            <Box key={a} m={m} at={[(a + b) / 2, 0.07, D / 2 - 0.2]} s={[b - a, 0.06, 0.2]} c="#7cb342" shadow={false} />
          ))}
          {trees.map((x) => <Tree key={x} m={m} at={[x, 0.1, D / 2 - 0.2]} s={0.75} leaves={PAL.leaves} bare={SEASON === 'winter'} />)}
        </group>
      )}
    </group>
  )
}

// The garden centre: a fenced yard of plant tables under a glass roof.
function Garden({ m, bulb, t }: { m: Mat; bulb: ReactNode; t: MarketLayout }) {
  const g = t.garden!
  const rows: number[] = []
  for (let z = -g.d / 2 + 0.3; z <= g.d / 2 - 0.35; z += 0.45) rows.push(z)
  const posts: number[] = []
  for (let x = -g.w / 2; x <= g.w / 2 + 0.01; x += g.w / Math.max(2, Math.round(g.w / 0.4))) posts.push(x)
  return (
    <group position={[g.x, 0, g.z]}>
      <Box m={m} at={[0, 0.06, 0]} s={[g.w, 0.06, g.d]} c="#ffffff" t={concreteTex(g.w, g.d)} shadow={false} />
      {/* Glass roof over the back half, on green posts. */}
      <Box m={m} at={[0, 1.0, -g.d / 4]} s={[g.w, 0.04, g.d / 2]} c="#c8e6c9" />
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[(sd * (g.w - 0.06)) / 2, 0.53, -0.04]} s={[0.05, 0.94, 0.05]} c={GREEN} />)}
      <mesh position={[0, 0.975, -g.d / 4]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[g.w - 0.2, g.d / 2 - 0.1]} />
        {bulb}
      </mesh>
      {/* Fence along the front and the open side, with a gap by the store. */}
      {posts.map((x) => <Box key={x} m={m} at={[x, 0.3, g.d / 2 - 0.02]} s={[0.03, 0.48, 0.03]} c={GREEN} shadow={false} />)}
      <Box m={m} at={[0, 0.52, g.d / 2 - 0.02]} s={[g.w, 0.03, 0.03]} c={GREEN} shadow={false} />
      <Box m={m} at={[0, 0.3, g.d / 2 - 0.02]} s={[g.w, 0.3, 0.008]} c="#a5d6a7" shadow={false} />
      <Box m={m} at={[-g.w / 2 + 0.01, 0.3, 0]} s={[0.008, 0.3, g.d]} c="#a5d6a7" shadow={false} />
      <Box m={m} at={[-g.w / 2 + 0.01, 0.52, 0]} s={[0.03, 0.03, g.d]} c={GREEN} shadow={false} />
      {/* Tables of potted flowers and shrubs. */}
      {rows.map((z, r) => (
        <group key={z} position={[0.05, 0, z]}>
          <Box m={m} at={[0, 0.27, 0]} s={[g.w - 0.5, 0.04, 0.26]} c="#8d6e63" />
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[(sd * (g.w - 0.6)) / 2, 0.15, 0]} s={[0.04, 0.2, 0.22]} c="#5d4037" />)}
          {Array.from({ length: Math.max(2, Math.floor((g.w - 0.6) / 0.17)) }, (_, i) => {
            const x = -(g.w - 0.6) / 2 + 0.08 + i * 0.17
            const bloom = FRUIT[(i + r * 2) % FRUIT.length]
            return (
              <group key={i} position={[x, 0.29, (i % 2) * 0.08 - 0.04]}>
                <Cyl m={m} at={[0, 0.045, 0]} r={0.045} r2={0.035} h={0.09} c="#bf6b3f" seg={8} />
                <mesh position={[0, 0.12, 0]}><icosahedronGeometry args={[0.06, 0]} />{m(i % 3 ? '#43a047' : '#2e7d32')}</mesh>
                {i % 3 !== 2 && <mesh position={[0, 0.17, 0]}><sphereGeometry args={[0.03, 6, 5]} />{m(bloom)}</mesh>}
              </group>
            )
          })}
        </group>
      ))}
      <mesh position={[0, 0.66, g.d / 2 - 0.0]}>
        <planeGeometry args={[Math.min(1, g.w * 0.6), 0.2]} />
        <meshBasicMaterial map={signTexture('GARDEN', GREEN, '#ffffff', Math.min(1, g.w * 0.6) / 0.2)} toneMapped={false} />
      </mesh>
    </group>
  )
}

// The car park: painted bays, cars in most, a cart corral now and then, and lamps.
function Parking({ m, t }: { m: Mat; t: MarketLayout }) {
  return (
    <group>
      {t.bays.map((b, i) => {
        const corral = i % 9 === 4
        return (
          <group key={`${b.x},${b.z}`} position={[b.x, 0, b.z]}>
            {[-1, 1].map((sd) => (
              <mesh key={sd} position={[(sd * BAY_W) / 2, 0.051, 0]} rotation-x={-Math.PI / 2}>
                <planeGeometry args={[0.025, BAY_D - 0.1]} />
                <meshStandardMaterial color="#fafafa" {...decal()} />
              </mesh>
            ))}
            {corral ? (
              <group>
                {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.18, 0.2, 0]} s={[0.025, 0.025, 0.8]} c="#90a4ae" shadow={false} />)}
                {[-0.38, 0.38].flatMap((z) => [-1, 1].map((sd) => <Box key={`${z}${sd}`} m={m} at={[sd * 0.18, 0.13, z]} s={[0.03, 0.18, 0.03]} c="#90a4ae" shadow={false} />))}
                <group rotation-y={Math.PI / 2}>
                  <Carts m={m} at={[-0.25, 0.05, 0]} n={3} />
                </group>
              </group>
            ) : (
              (i * 7) % 5 !== 1 && (
                <group position-y={0.05} rotation-y={b.face === 1 ? 0 : Math.PI}>
                  <TownCar n={i * 5 + 1} />
                </group>
              )
            )}
          </group>
        )
      })}
      {t.lamps.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box m={m} at={[0, 0.08, 0]} s={[0.14, 0.12, 0.14]} c="#cfd8dc" />
          <Cyl m={m} at={[0, 1.0, 0]} r={0.03} h={1.85} c="#607d8b" seg={8} />
          <Box m={m} at={[0, 1.93, 0]} s={[0.36, 0.05, 0.12]} c="#455a64" shadow={false} />
          <mesh position={[0, 1.9, 0]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[0.32, 0.09]} />
            <primitive object={glowMats.bulb} attach="material" dispose={null} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.056, 0]} renderOrder={2}>
            <planeGeometry args={[1.8, 1.8]} />
            <primitive object={glowMats.pool} attach="material" dispose={null} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// The tall sign by the road: the apple on top, the name, and the hours.
function Pylon({ m, t, level }: { m: Mat; t: MarketLayout; level: number }) {
  const [x, z] = t.pylon
  const h = Math.min(2.4 + t.L * 0.1, 4.2) + (level - 7) * 0.12
  const w = 1.1
  return (
    <group position={[x, 0, z]}>
      <Box m={m} at={[0, h / 2, 0]} s={[0.12, h, 0.12]} c="#90a4ae" />
      <Box m={m} at={[0, 0.13, 0]} s={[0.5, 0.26, 0.3]} c="#a1887f" />
      <Box m={m} at={[0, h - 0.2, 0]} s={[w + 0.1, 0.4, 0.1]} c={GREEN} />
      <LitSign text={NAME} w={w} h={0.3} at={[0, h - 0.2, 0.052]} bg={GREEN} fg="#ffffff" m={m} />
      <Box m={m} at={[0, h - 0.66, 0]} s={[w * 0.8, 0.4, 0.08]} c="#fffde7" />
      <mesh position={[0, h - 0.66, 0.042]}>
        <planeGeometry args={[w * 0.72, 0.32]} />
        <meshBasicMaterial map={signTexture('OPEN 24H', '#fffde7', GREEN, (w * 0.72) / 0.32)} toneMapped={false} />
      </mesh>
      <Bulbs from={[-w / 2, h + 0.03, 0.06]} to={[w / 2, h + 0.03, 0.06]} n={9} />
      <GiantProp m={m} kind="apple" at={[0, h, 0]} s={1.1} plinth={level >= 10 ? GOLD : '#fafafa'} />
    </group>
  )
}
