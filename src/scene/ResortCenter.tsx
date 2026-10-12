import type { ReactNode } from 'react'
import { resortLayout, type ResortLayout, type Rect } from '../game/resortCenter'
import { Box, Cyl, Bulbs, Flag, Parasol, GOLD, type Mat } from './NewBuildings'
import { LitSign } from './OfficeBuildings'
import { TownCar } from './TravelCenter'
import { PropMesh } from './propKit'
import { DECOR_PROPS } from './decorProps'
import { TrueSize, useMergeScale } from './mergeScale'
import { glowMats } from './dayNight'
import { concreteTex } from './textures'

// Palm Cove Resort: the motel's form for a merged block at level 7-10 (see
// src/game/resortCenter.ts for the layout). Hotel wings round a pool deck,
// built in true units for the whole block and kept at true size, so the
// loungers, doors and cars are the size of the guests walking in.

const NAME = 'PALM COVE'
const PEACH = '#ffe0b2'
const TEAL = '#00897b'
const SAND = '#f3e5c8'
const WATER = '#4dd0e1'
const BASE = 0.05
const FH = 0.42

type Props = { m: Mat; win: ReactNode; bulb: ReactNode; level: number; ghost?: boolean }

export function ResortCenter(props: Props) {
  const [sx, , sz] = useMergeScale()
  const t = resortLayout(sx, sz)
  return (
    <TrueSize>
      <Resort {...props} t={t} />
    </TrueSize>
  )
}

function Resort({ m, win, bulb, level, ghost, t }: Props & { t: ResortLayout }) {
  const { L, D, wing } = t
  const floors = 3 + Math.max(0, level - 7)
  if (ghost) return <Box m={m} at={[wing.x, (floors * FH + 0.5) / 2, wing.z]} s={[wing.w, floors * FH + 0.5, wing.d]} c={PEACH} />
  return (
    <group>
      <Box m={m} at={[0, 0.03, 0]} s={[L - 0.12, 0.04, D - 0.12]} c="#ffffff" t={concreteTex(L / 2, D / 2)} shadow={false} />
      <Wing m={m} win={win} r={wing} floors={floors} faces={[1]} sign={NAME} level={level} />
      {t.sides.map((r, i) => <Wing key={i} m={m} win={win} r={r} floors={2} faces={[1, i ? -2 : 2]} sign={null} level={level} />)}
      {t.lobby && <Lobby m={m} bulb={bulb} r={t.lobby} drive={D >= 6} />}
      <Doors m={m} bulb={bulb} t={t} />
      <Deck m={m} bulb={bulb} t={t} level={level} />
      <Hedges m={m} t={t} />
      {level >= 8 && <Flag at={[wing.x + wing.w / 2 - 0.25, BASE + 0.5 + floors * FH + 0.06, wing.z - wing.d / 2 + 0.2]} color={TEAL} star={level >= 10} />}
    </group>
  )
}

// A hotel wing: a lobby-height ground floor, then floors of rooms with
// balconies on the faces listed (1: +z, 2: +x, -2: -x), a teal roof edge.
function Wing({ m, win, r, floors, faces, sign, level }: { m: Mat; win: ReactNode; r: Rect; floors: number; faces: number[]; sign: string | null; level: number }) {
  const h = 0.5 + floors * FH
  return (
    <group position={[r.x, BASE, r.z]}>
      <Box m={m} at={[0, h / 2, 0]} s={[r.w, h, r.d]} c={PEACH} />
      <Box m={m} at={[0, 0.25, 0]} s={[r.w + 0.03, 0.5, r.d + 0.03]} c="#fff3e0" />
      <Box m={m} at={[0, h + 0.05, 0]} s={[r.w + 0.08, 0.1, r.d + 0.08]} c={TEAL} />
      {faces.map((f) => {
        // Turn so the face looks along local +z, then lay the rooms along it.
        const along = Math.abs(f) === 1 ? r.w : r.d
        const out = Math.abs(f) === 1 ? r.d / 2 : r.w / 2
        const rot = f === 1 ? 0 : f === 2 ? Math.PI / 2 : -Math.PI / 2
        const fins: number[] = []
        for (let x = -along / 2 + 1.0; x <= along / 2 - 0.3; x += 1.0) fins.push(x)
        return (
          <group key={f} rotation-y={rot}>
            {Array.from({ length: floors }, (_, i) => {
              const y = 0.5 + i * FH
              return (
                <group key={i}>
                  <mesh position={[0, y + 0.2, out + 0.004]}>
                    <planeGeometry args={[along - 0.16, 0.24]} />
                    {win}
                  </mesh>
                  {/* Balcony slab and its glass rail. */}
                  <Box m={m} at={[0, y + 0.02, out + 0.09]} s={[along - 0.1, 0.035, 0.18]} c="#fafafa" />
                  <Box m={m} at={[0, y + 0.1, out + 0.178]} s={[along - 0.1, 0.13, 0.012]} c="#b2ebf2" shadow={false} />
                  <Box m={m} at={[0, y + 0.17, out + 0.178]} s={[along - 0.1, 0.015, 0.024]} c={TEAL} shadow={false} />
                </group>
              )
            })}
            {/* Fins between the rooms, from the first balcony to the roof. */}
            {fins.map((x) => <Box key={x} m={m} at={[x, 0.5 + (floors * FH) / 2, out + 0.1]} s={[0.05, floors * FH, 0.2]} c="#fff3e0" shadow={false} />)}
            {/* Ground floor: big windows onto the deck. */}
            <mesh position={[0, 0.27, out + 0.004]}>
              <planeGeometry args={[along - 0.3, 0.3]} />
              {win}
            </mesh>
            {sign && f === 1 && (
              <group>
                <Box m={m} at={[0, h + 0.3, 0]} s={[Math.min(2.4, along * 0.4) + 0.1, 0.4, 0.08]} c={level >= 10 ? GOLD : TEAL} />
                <LitSign text={sign} w={Math.min(2.4, along * 0.4)} h={0.32} at={[0, h + 0.3, 0.042]} bg={TEAL} fg="#ffffff" m={m} />
              </group>
            )}
          </group>
        )
      })}
    </group>
  )
}

// The lobby pavilion: glass front under a deep teal roof, and on a big block
// a drop-off canopy over the drive with cars pulling up.
function Lobby({ m, bulb, r, drive }: { m: Mat; bulb: ReactNode; r: Rect; drive: boolean }) {
  const zf = r.d / 2
  return (
    <group position={[r.x, BASE, r.z]}>
      <Box m={m} at={[0, 0.4, 0]} s={[r.w, 0.8, r.d]} c={PEACH} />
      <mesh position={[0, 0.4, zf + 0.004]}>
        <planeGeometry args={[r.w - 0.2, 0.6]} />
        <meshStandardMaterial color="#b2ebf2" roughness={0.1} metalness={0.4} />
      </mesh>
      <Box m={m} at={[0, 0.86, 0.05]} s={[r.w + 0.3, 0.12, r.d + 0.3]} c={TEAL} />
      <LitSign text={NAME} w={Math.min(1.4, r.w * 0.7)} h={0.18} at={[0, 0.86, zf + 0.204]} bg={TEAL} fg="#ffffff" m={m} />
      {drive && (
        <group>
          {/* The canopy out over the drive on four posts, lit underneath. */}
          <Box m={m} at={[0, 0.98, zf + 0.42]} s={[r.w + 0.4, 0.08, 0.7]} c={TEAL} />
          <mesh position={[0, 0.937, zf + 0.42]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[r.w, 0.55]} />
            {bulb}
          </mesh>
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[(sd * (r.w + 0.2)) / 2, 0.47, zf + 0.7]} s={[0.07, 0.94, 0.07]} c="#fff3e0" />)}
          <group position={[0.45, 0, zf + 0.42]} rotation-y={Math.PI / 2}>
            <TownCar n={3} />
          </group>
        </group>
      )}
    </group>
  )
}

// The way in, wherever the doors are: glass doors lit from inside, a small canopy.
function Doors({ m, bulb, t }: { m: Mat; bulb: ReactNode; t: ResortLayout }) {
  const [x, z] = t.door
  const zf = z - 0.12
  return (
    <group position={[x, BASE, zf]}>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * 0.13, 0.38, 0.02]}>
          <planeGeometry args={[0.24, 0.66]} />
          {bulb}
        </mesh>
      ))}
      <Box m={m} at={[0, 0.38, 0.026]} s={[0.025, 0.66, 0.008]} c="#cfd8dc" shadow={false} />
      <Box m={m} at={[0, 0.78, 0.12]} s={[0.7, 0.05, 0.24]} c={TEAL} />
    </group>
  )
}

// The pool deck: paving round the pool, loungers and parasols along its sides,
// palms at the corners, the tiki bar, the slide from level 9, lights after dark.
function Deck({ m, bulb, t, level }: { m: Mat; bulb: ReactNode; t: ResortLayout; level: number }) {
  const { deck: d, pool: p } = t
  const y = BASE + 0.04
  const strips: [number, number, number, number][] = [
    [d.x, (d.z - d.d / 2 + p.z - p.d / 2) / 2, d.w, p.z - p.d / 2 - (d.z - d.d / 2)],
    [d.x, (p.z + p.d / 2 + d.z + d.d / 2) / 2, d.w, d.z + d.d / 2 - (p.z + p.d / 2)],
    [(d.x - d.w / 2 + p.x - p.w / 2) / 2, p.z, p.x - p.w / 2 - (d.x - d.w / 2), p.d],
    [(p.x + p.w / 2 + d.x + d.w / 2) / 2, p.z, d.x + d.w / 2 - (p.x + p.w / 2), p.d],
  ]
  const lights: number[] = []
  for (let x = p.x - p.w / 2 + 0.3; x <= p.x + p.w / 2 - 0.3; x += 0.6) lights.push(x)
  const island = p.w > 6
  return (
    <group>
      {strips.map(([x, z, w, dd], i) => dd > 0.01 && w > 0.01 && <Box key={i} m={m} at={[x, BASE + 0.02, z]} s={[w, 0.04, dd]} c={SAND} t={concreteTex(w * 1.5, dd * 1.5)} shadow={false} />)}
      {/* The water, its white coping, and lights set in the walls. */}
      <Box m={m} at={[p.x, BASE + 0.01, p.z]} s={[p.w, 0.02, p.d]} c={WATER} shadow={false} />
      <mesh position={[p.x, BASE + 0.021, p.z]} rotation-x={-Math.PI / 2} renderOrder={2}>
        <planeGeometry args={[p.w, p.d]} />
        <primitive object={glowMats.poolWater} attach="material" dispose={null} />
      </mesh>
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[p.x, y + 0.01, p.z + (sd * (p.d + 0.06)) / 2]} s={[p.w + 0.12, 0.02, 0.06]} c="#fafafa" shadow={false} />)}
      {[-1, 1].map((sd) => <Box key={`e${sd}`} m={m} at={[p.x + (sd * (p.w + 0.06)) / 2, y + 0.01, p.z]} s={[0.06, 0.02, p.d]} c="#fafafa" shadow={false} />)}
      {lights.map((x) => (
        <mesh key={x} position={[x, BASE + 0.03, p.z + p.d / 2 - 0.004]} rotation-y={Math.PI}>
          <planeGeometry args={[0.08, 0.02]} />
          <primitive object={glowMats.neonCyan} attach="material" dispose={null} />
        </mesh>
      ))}
      {island && (
        <group position={[p.x, 0, p.z]}>
          <Cyl m={m} at={[0, BASE + 0.04, 0]} r={0.5} r2={0.55} h={0.08} c="#ffe082" seg={18} />
          <group position={[0, BASE + 0.08, 0]} scale={0.8}><PropMesh parts={DECOR_PROPS.palm()} /></group>
        </group>
      )}
      {t.loungers.map((l, i) => (
        <group key={`${l.x},${l.z}`}>
          <Lounger m={m} at={[l.x, y, l.z]} face={l.face} c={i % 4 === 1 ? '#ff8a65' : '#4fc3f7'} />
          {i % 4 === 2 && <Parasol m={m} at={[l.x + 0.21, y, l.z]} c={i % 8 === 2 ? '#ff7043' : TEAL} />}
        </group>
      ))}
      {t.palms.map(([x, z]) => <group key={`${x},${z}`} position={[x, y, z]} scale={0.8}><PropMesh parts={DECOR_PROPS.palm()} /></group>)}
      {t.bar && <Tiki m={m} bulb={bulb} at={t.bar} />}
      {t.slide && level >= 9 && <Slide m={m} at={t.slide} toward={-1} />}
    </group>
  )
}

function Lounger({ m, at, face, c }: { m: Mat; at: [number, number, number]; face: 1 | -1; c: string }) {
  return (
    <group position={at} rotation-y={face === 1 ? 0 : Math.PI}>
      {[-0.13, 0.13].map((z) => <Box key={z} m={m} at={[0, 0.04, z]} s={[0.16, 0.08, 0.025]} c="#eceff1" shadow={false} />)}
      <Box m={m} at={[0, 0.095, 0.03]} s={[0.17, 0.03, 0.3]} c={c} />
      <Box m={m} at={[0, 0.15, -0.15]} rot={[0.7, 0, 0]} s={[0.17, 0.03, 0.16]} c={c} />
    </group>
  )
}

// A thatched tiki bar: a round counter, stools and a lamp-lit straw roof on posts.
function Tiki({ m, bulb, at }: { m: Mat; bulb: ReactNode; at: [number, number] }) {
  const y = BASE + 0.04
  return (
    <group position={[at[0], y, at[1]]}>
      <Cyl m={m} at={[0, 0.16, 0]} r={0.26} h={0.32} c="#8d6e63" seg={14} />
      <Cyl m={m} at={[0, 0.335, 0]} r={0.3} h={0.03} c="#5d4037" seg={14} />
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return <Cyl key={i} m={m} at={[Math.cos(a) * 0.22, 0.47, Math.sin(a) * 0.22]} r={0.02} h={0.28} c="#6d4c41" seg={6} />
      })}
      <mesh position={[0, 0.7, 0]} castShadow><coneGeometry args={[0.46, 0.28, 10]} />{m('#d4a24c')}</mesh>
      <mesh position={[0, 0.555, 0]} rotation-x={Math.PI / 2}><circleGeometry args={[0.12, 10]} />{bulb}</mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <group key={i} position={[Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4]}>
            <Cyl m={m} at={[0, 0.1, 0]} r={0.015} h={0.2} c="#5d4037" seg={6} />
            <Cyl m={m} at={[0, 0.21, 0]} r={0.06} h={0.03} c="#ff7043" seg={8} />
          </group>
        )
      })}
      <Bulbs from={[-0.3, 0.6, 0.3]} to={[0.3, 0.6, 0.3]} n={5} sag={0.03} />
    </group>
  )
}

// The water slide: a tower with a ladder, and a curling yellow flume down into the pool.
function Slide({ m, at, toward }: { m: Mat; at: [number, number]; toward: 1 | -1 }) {
  const y = BASE + 0.04
  const top = 1.15
  return (
    <group position={[at[0], y, at[1]]}>
      {[[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, top / 2, z]} s={[0.04, top, 0.04]} c="#eceff1" />)}
      <Box m={m} at={[0, top, 0]} s={[0.38, 0.04, 0.38]} c="#29b6f6" />
      <Box m={m} at={[0, top + 0.12, -0.18]} s={[0.38, 0.2, 0.02]} c="#ff7043" shadow={false} />
      {[0.2, 0.45, 0.7, 0.95].map((yy) => <Box key={yy} m={m} at={[0.17, yy, 0.17]} s={[0.04, 0.02, 0.04]} c="#90a4ae" shadow={false} />)}
      {/* A loop round the tower, then the run down into the water. */}
      <mesh position={[0, top - 0.25, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.24, 0.06, 8, 20]} />
        {m('#fdd835')}
      </mesh>
      <mesh position={[toward * 0.62, 0.47, 0]} rotation-z={toward * 0.72}>
        <cylinderGeometry args={[0.06, 0.06, 1.15, 10]} />
        {m('#fdd835')}
      </mesh>
    </group>
  )
}

// Hedges along the road in front of the deck, broken for the doors and the drive.
function Hedges({ m, t }: { m: Mat; t: ResortLayout }) {
  const { L, D, door, lobby, sides } = t
  const z = D / 2 - 0.18
  const gap = lobby && D >= 6 ? lobby.w / 2 + 0.35 : 0.4
  const lo = sides.length ? sides[0].x + sides[0].w / 2 : -L / 2 + 0.1
  const hi = sides.length ? sides[1].x - sides[1].w / 2 : lobby ? lobby.x - lobby.w / 2 - 0.05 : L / 2 - 0.1
  const runs: [number, number][] = []
  if (door[0] - gap > lo && door[0] - gap < hi) runs.push([lo, door[0] - gap], [door[0] + gap, hi])
  else runs.push([lo, hi])
  // The hotel's name on a low stone sign by the road, at the left end.
  const signAt = lo + 0.6
  // On a big block, lawns with palms either side of the drive.
  const z0 = t.deck.z + t.deck.d / 2 + 0.1
  const z1 = z - 0.15
  const lawns: [number, number][] = lobby && D >= 6 && z1 - z0 > 0.5 ? [[lo + 0.1, lobby.x - gap], [lobby.x + gap, hi - 0.1]] : []
  return (
    <group>
      {lawns.map(([a, b]) => {
        const palms: number[] = []
        for (let x = a + 0.5; x <= b - 0.4; x += 1.5) palms.push(x)
        return (
          <group key={a}>
            <Box m={m} at={[(a + b) / 2, BASE + 0.015, (z0 + z1) / 2]} s={[b - a, 0.03, z1 - z0]} c="#7cb342" shadow={false} />
            {palms.map((x, i) => <group key={x} position={[x, BASE + 0.03, (z0 + z1) / 2 + (i % 2 ? 0.2 : -0.2)]} scale={0.7}><PropMesh parts={DECOR_PROPS.palm()} /></group>)}
          </group>
        )
      })}
      {runs.map(([a, b]) => {
        const parts: [number, number][] = a < signAt && signAt < b ? [[a, signAt - 0.5], [signAt + 0.5, b]] : [[a, b]]
        return parts.map(([p, q]) => q - p > 0.1 && <Box key={`${p}`} m={m} at={[(p + q) / 2, BASE + 0.12, z]} s={[q - p, 0.24, 0.2]} c="#558b2f" />)
      })}
      {runs.some(([a, b]) => a < signAt && signAt < b) && (
        <group position={[signAt, BASE, z]}>
          <Box m={m} at={[0, 0.14, 0]} s={[0.9, 0.28, 0.16]} c="#bcaaa4" />
          <LitSign text={NAME} w={0.8} h={0.2} at={[0, 0.15, 0.084]} bg={TEAL} fg="#ffffff" m={m} />
        </group>
      )}
    </group>
  )
}
