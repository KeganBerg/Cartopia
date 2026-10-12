import type { ReactNode } from 'react'
import { washLayout, TUNNEL_D, type WashLayout } from '../game/washCenter'
import { Box, Cyl, Bulbs, Flag, GOLD, type Mat, type V3 } from './NewBuildings'
import { LitSign } from './OfficeBuildings'
import { TownCar } from './TravelCenter'
import { TrueSize, useMergeScale } from './mergeScale'
import { glowMats } from './dayNight'
import { signTexture } from './signTexture'
import { asphaltTex, concreteTex } from './textures'
import { decal } from './layers'

// The Bubble Car Spa: a merged car wash at level 7-10, built for the whole
// block (layout in src/game/washCenter.ts). Express tunnels with foam and
// spinning brushes behind their glass sides, cars queueing at the pay kiosks
// and steaming out the far end, and rows of vacuum bays under bright arches.

const NAME = 'BUBBLE SPA'
const BLUE = '#0288d1'
const SKY = '#4fc3f7'
const PINK = '#ec407a'
const ARCH = ['#ec407a', '#ffca28', '#29b6f6', '#66bb6a']

type Props = { m: Mat; win: ReactNode; bulb: ReactNode; level: number; ghost?: boolean }

export function WashCenter(props: Props) {
  const [sx, , sz] = useMergeScale()
  return (
    <TrueSize>
      <Spa {...props} t={washLayout(sx, sz)} />
    </TrueSize>
  )
}

function Spa({ m, bulb, level, ghost, t }: Props & { t: WashLayout }) {
  if (ghost) {
    return (
      <group>
        {t.tunnels.map((u) => <Box key={u.z} m={m} at={[(u.x0 + u.x1) / 2, 0.55, u.z]} s={[u.x1 - u.x0, 1.1, TUNNEL_D]} c={SKY} />)}
      </group>
    )
  }
  return (
    <group>
      <Box m={m} at={[0, 0.03, 0]} s={[t.L - 0.12, 0.04, t.D - 0.12]} c="#ffffff" t={asphaltTex()} shadow={false} />
      {t.tunnels.map((u, i) => <Tunnel key={u.z} m={m} bulb={bulb} x0={u.x0} x1={u.x1} z={u.z} n={i} level={level} room={t.L / 2 - u.x1} />)}
      {t.vacs.map((v, i) => <VacBay key={`${v.x},${v.z}`} m={m} bulb={bulb} at={[v.x, 0, v.z]} along={t.along} n={i} />)}
      <Pylon m={m} at={[t.pylon[0], 0, t.pylon[1]]} level={level} />
    </group>
  )
}

// One express tunnel: a long glass-sided hall under an arched blue roof, the
// pay kiosk and a queue at the way in, blowers and a dripping car at the way out.
function Tunnel({ m, bulb, x0, x1, z, n, level, room }: { m: Mat; bulb: ReactNode; x0: number; x1: number; z: number; n: number; level: number; room: number }) {
  const len = x1 - x0
  const cx = (x0 + x1) / 2
  const h = 0.95
  const d = TUNNEL_D
  const zf = d / 2
  // Glass panes along the front wall, true size, framed in white.
  const panes: number[] = []
  for (let x = x0 + 0.45; x <= x1 - 0.4; x += 0.42) panes.push(x)
  const ribs = Math.max(2, Math.floor(len / 0.9))
  const brushes = [x0 + 0.7, x0 + 1.2, x0 + 1.7].filter((x) => x < x1 - 1)
  return (
    <group position={[0, 0, z]}>
      {/* Floor channel, back wall and the end piers. */}
      <Box m={m} at={[cx, 0.06, 0]} s={[len, 0.04, d - 0.01]} c="#cfd8dc" t={concreteTex(len, 1)} shadow={false} />
      <Box m={m} at={[cx, (h - 0.01) / 2, -zf + 0.05]} s={[len, h - 0.01, 0.1]} c="#e1f5fe" />
      {[x0, x1].map((x) => (
        <group key={x}>
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[x, h / 2, sd * (zf - 0.058)]} s={[0.14, h, 0.124]} c={BLUE} />)}
          <Box m={m} at={[x, h + 0.06, 0]} s={[0.16, 0.12, d]} c={BLUE} />
        </group>
      ))}
      {/* The glass front wall: low sill, tall panes, see the wash going on inside. */}
      <Box m={m} at={[cx, 0.12, zf - 0.04]} s={[len, 0.2, 0.06]} c={BLUE} />
      {panes.map((x) => (
        <group key={x}>
          <mesh position={[x, 0.58, zf - 0.03]}>
            <planeGeometry args={[0.38, 0.68]} />
            <meshStandardMaterial color="#b3e5fc" transparent opacity={0.35} roughness={0.1} metalness={0.2} depthWrite={false} />
          </mesh>
          <Box m={m} at={[x + 0.21, 0.58, zf - 0.03]} s={[0.03, 0.72, 0.04]} c="#fafafa" shadow={false} />
        </group>
      ))}
      <Box m={m} at={[cx, h - 0.02, zf - 0.03]} s={[len, 0.05, 0.05]} c="#fafafa" shadow={false} />
      {/* Arched roof: a half barrel along the tunnel, with white ribs. */}
      <mesh position={[cx, h, 0]} rotation-z={Math.PI / 2} scale={[1, 1, 1]} castShadow>
        <cylinderGeometry args={[d / 2, d / 2, len, 20, 1, false, 0, Math.PI]} />
        {m(SKY)}
      </mesh>
      {Array.from({ length: ribs }, (_, i) => x0 + 0.2 + (i * (len - 0.4)) / (ribs - 1)).map((x) => (
        <mesh key={x} position={[x, h, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[d / 2 + 0.012, d / 2 + 0.012, 0.05, 20, 1, false, 0, Math.PI]} />
          {m('#fafafa')}
        </mesh>
      ))}
      {/* Inside: spinning brushes, foam, a car going through. */}
      {brushes.map((x, i) => (
        <group key={x}>
          {[-1, 1].map((sd) => <Cyl key={sd} m={m} at={[x, 0.42, sd * 0.32]} r={0.09} h={0.66} c={ARCH[(i + (sd > 0 ? 1 : 0)) % ARCH.length]} seg={10} />)}
          <Cyl m={m} at={[x, 0.82, 0]} r={0.07} h={0.6} c={ARCH[(i + 2) % ARCH.length]} seg={10} rot={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
      <group position={[x0 + 1.25, 0.05, 0]} rotation-y={Math.PI / 2}>
        <TownCar n={n + 1} />
      </group>
      {/* Suds heaped on the floor along both walls. */}
      {[[0.75, -0.3, 0.1], [0.9, -0.33, 0.13], [1.1, -0.31, 0.11], [1.4, 0.32, 0.1], [1.55, 0.3, 0.12], [1.7, 0.33, 0.09]].map(([dx, dz, r]) => (
        <mesh key={`${dx}${dz}`} position={[x0 + dx, 0.05 + r * 0.6, dz]}><sphereGeometry args={[r, 10, 8]} /><meshStandardMaterial color="#f5fbff" roughness={0.15} /></mesh>
      ))}
      {/* Neon along the eaves, lit after dark. */}
      <mesh position={[cx, h + 0.005, zf - 0.005]}>
        <boxGeometry args={[len, 0.03, 0.03]} />
        <primitive object={glowMats.neonCyan} attach="material" dispose={null} />
      </mesh>
      <mesh position={[cx, 0.24, zf + 0.005]}>
        <boxGeometry args={[len, 0.025, 0.025]} />
        <primitive object={glowMats.neonPink} attach="material" dispose={null} />
      </mesh>
      <LitSign text={NAME} w={Math.min(2.2, len * 0.42)} at={[cx, h + d * 0.36, d * 0.26]} bg={PINK} fg="#ffffff" m={m} />
      {/* Way in: the curtain of coloured strips, a lit ENTER sign and the pay kiosk. */}
      <group position={[x0, 0, 0]}>
        {Array.from({ length: 7 }, (_, i) => (
          <Box key={i} m={m} at={[0.02, 0.52, -0.3 + i * 0.1]} s={[0.012, 0.6, 0.07]} c={ARCH[i % ARCH.length]} shadow={false} />
        ))}
        <group position={[-0.09, h - 0.07, 0]} rotation-y={-Math.PI / 2}>
          <mesh>
            <planeGeometry args={[0.5, 0.14]} />
            <meshBasicMaterial map={signTexture('ENTER', '#2e7d32', '#ffffff', 0.5 / 0.14)} toneMapped={false} />
          </mesh>
        </group>
        <group position={[-0.45, 0, 0.32]}>
          <Box m={m} at={[0, 0.06, 0]} s={[0.5, 0.06, 0.26]} c="#cfd8dc" />
          <Box m={m} at={[0, 0.36, -0.02]} s={[0.22, 0.56, 0.16]} c="#eceff1" />
          <Box m={m} at={[0, 0.66, -0.02]} s={[0.3, 0.05, 0.22]} c={PINK} />
          <mesh position={[0.114, 0.46, -0.02]} rotation-y={Math.PI / 2}><planeGeometry args={[0.1, 0.12]} />{bulb}</mesh>
          {/* The gate arm. */}
          <Box m={m} at={[0.3, 0.235, -0.02]} s={[0.04, 0.37, 0.04]} c="#455a64" shadow={false} />
          <Box m={m} at={[0.3, 0.4, -0.3]} s={[0.025, 0.025, 0.56]} c="#fafafa" shadow={false} />
        </group>
        <group position={[-0.95, 0.05, 0]} rotation-y={Math.PI / 2}>
          <TownCar n={n + 4} />
        </group>
      </group>
      {/* Way out: blowers over the exit and a shiny car rolling off. */}
      <group position={[x1, 0, 0]}>
        {[-0.25, 0.25].map((dz) => <Cyl key={dz} m={m} at={[-0.12, h - 0.12, dz]} r={0.08} h={0.16} c="#eceff1" seg={10} rot={[0, 0, Math.PI / 2]} />)}
        <group position={[0.09, h - 0.07, 0]} rotation-y={Math.PI / 2}>
          <mesh>
            <planeGeometry args={[0.44, 0.14]} />
            <meshBasicMaterial map={signTexture('EXIT', '#c62828', '#ffffff', 0.44 / 0.14)} toneMapped={false} />
          </mesh>
        </group>
        {room >= 0.75 && (
          <group position={[0.4, 0.05, 0]} rotation-y={Math.PI / 2}>
            <TownCar n={n + 6} />
          </group>
        )}
      </group>
      {/* Painted lane arrows into the tunnel. */}
      {[-1.25, -0.75].map((dx) => (
        <mesh key={dx} position={[x0 + dx + 0.2, 0.051, 0.28]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.24, 0.06]} />
          <meshStandardMaterial color="#fafafa" {...decal()} />
        </mesh>
      ))}
      {/* On the roof: a heap of giant soap bubbles, and a flag from level 8. */}
      {[[0, 0.18, 0.2], [0.22, 0.12, 0.15], [-0.2, 0.1, 0.13], [0.06, 0.38, 0.12]].map(([dx, y, r]) => (
        <mesh key={`${dx}${y}`} position={[x1 - 0.7 + dx, h + d / 2 + y, -0.08]}>
          <sphereGeometry args={[r, 14, 10]} />
          <meshStandardMaterial color="#e1f5fe" roughness={0.05} metalness={0.35} transparent opacity={0.85} />
        </mesh>
      ))}
      {level >= 8 && <Flag at={[x0 + 0.3, h + d / 2 - 0.05, 0]} color={PINK} star={level >= 10} />}
      {/* Light under the canopy edge at night. */}
      <Bulbs from={[x0, h - 0.07, zf + 0.02]} to={[x1, h - 0.07, zf + 0.02]} n={Math.round(len * 3)} />
    </group>
  )
}

// A vacuum bay: a coloured steel arch over the space, a hose drop, a vacuum post,
// and often a car having its mats cleaned.
function VacBay({ m, bulb, at, along, n }: { m: Mat; bulb: ReactNode; at: V3; along: boolean; n: number }) {
  const c = ARCH[n % ARCH.length]
  const car = n % 2 === 0
  return (
    <group position={at} rotation-y={along ? Math.PI / 2 : 0}>
      {/* Painted bay line, the arch on its post at the bay's edge, the hose drop. */}
      <mesh position={[0.44, 0.051, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.025, 1.05]} />
        <meshStandardMaterial color="#fafafa" {...decal()} />
      </mesh>
      <Box m={m} at={[0.44, 0.7, -0.42]} s={[0.05, 1.3, 0.05]} c={c} />
      <Box m={m} at={[0.2, 1.33, -0.42]} s={[0.5, 0.05, 0.05]} c={c} />
      {/* A light under the arch and its glow on the bay after dark. */}
      <mesh position={[0.2, 1.295, -0.42]}><boxGeometry args={[0.2, 0.02, 0.035]} />{bulb}</mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.056, 0]} renderOrder={2}>
        <planeGeometry args={[0.85, 1.0]} />
        <primitive object={glowMats.pool} attach="material" dispose={null} />
      </mesh>
      <mesh position={[-0.04, 1.08, -0.42]}><cylinderGeometry args={[0.014, 0.014, 0.46, 6]} />{m('#37474f')}</mesh>
      <group position={[0.44, 0, 0.42]}>
        <Box m={m} at={[0, 0.03, 0]} s={[0.16, 0.06, 0.16]} c="#cfd8dc" />
        <Box m={m} at={[0, 0.3, 0]} s={[0.11, 0.48, 0.11]} c="#ffca28" />
        <Box m={m} at={[0, 0.56, 0]} s={[0.14, 0.04, 0.14]} c={BLUE} />
      </group>
      {car && (
        <group position={[0, 0.05, 0]}>
          <TownCar n={n + 3} />
        </group>
      )}
    </group>
  )
}

// The roadside sign: the name, a bubble on top and the price board.
function Pylon({ m, at, level }: { m: Mat; at: V3; level: number }) {
  const h = 2.6 + (level - 7) * 0.12
  const w = 1.1
  return (
    <group position={at}>
      <Box m={m} at={[0, (h - 0.01) / 2, 0]} s={[0.1, h - 0.01, 0.09]} c="#90a4ae" />
      <Box m={m} at={[0, 0.12, 0]} s={[0.5, 0.24, 0.3]} c={BLUE} />
      <Box m={m} at={[0, h - 0.2, 0]} s={[w + 0.1, 0.4, 0.1]} c={PINK} />
      <LitSign text={NAME} w={w} h={0.3} at={[0, h - 0.2, 0.052]} bg={PINK} fg="#ffffff" m={m} />
      <Box m={m} at={[0, h - 0.66, 0]} s={[w * 0.8, 0.4, 0.08]} c="#263238" />
      <mesh position={[0, h - 0.66, 0.042]}>
        <planeGeometry args={[w * 0.72, 0.32]} />
        <meshBasicMaterial map={signTexture('WASH $5', '#263238', '#4fc3f7', (w * 0.72) / 0.32)} toneMapped={false} />
      </mesh>
      <mesh position={[0, h + 0.32, 0]}>
        <sphereGeometry args={[0.3, 16, 12]} />
        <meshStandardMaterial color="#b3e5fc" roughness={0.05} metalness={0.35} transparent opacity={0.9} />
      </mesh>
      <Cyl m={m} at={[0, h + 0.02, 0]} r={0.12} h={0.04} c={level >= 10 ? GOLD : BLUE} seg={12} />
      <Bulbs from={[-w / 2, h + 0.03, 0.06]} to={[w / 2, h + 0.03, 0.06]} n={9} />
    </group>
  )
}
