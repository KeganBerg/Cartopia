import type { ReactNode } from 'react'
import type { Texture } from 'three'
import { CarModel } from './CarModel'
import { signTexture } from './signTexture'
import { glowMats } from './dayNight'
import { decal } from './layers'
import { concreteTex, corrugatedTex, gravelTex } from './textures'
import { Crane, Crusher } from './TrailerJunkyard'
import { growthStage } from '../game/growth'
import { doorTag } from './doors'

// Rusty's Rescue: a rust-red Quonset workshop with a car up on the lift out
// front, his tow truck parked by the gate and a fenced junkyard full of crushed
// cars, tyres and drums. Lot is 2x1 tiles and faces +z, like the rest of town.
// Every piece is a plain static mesh, so Batch bakes the lot into a few draws.
// It grows like the other businesses: at level 4 (Recovery Yard) a tracked
// crane moves into the junkyard, and at 7 (Restoration Works) a car crusher
// joins it and the car on the lift comes out gleaming.

type V3 = [number, number, number]
type Mat = (color: string, map?: Texture) => ReactNode
type Props = { m: Mat; ghost?: boolean; sign: boolean; bulb: ReactNode; win: ReactNode; lvl: number; lift: number }

const GOLD = '#ffc107'
const RUST = '#b9572c'
// Quonset hut: a half-cylinder lying front to back.
const QX = -0.82
const QR = 0.92
const QZ0 = -0.92 // back
const QZ1 = 0.22 // front, where the bay door is
const QY = 0.06
// The front porch, where people walk in: a little boarded entry on the gable's left.
const PX = QX - 0.62
const PW = 0.44
const PTOP = 0.81

function Box({ m, at, s, c, t, rot, shadow = true }: { m: Mat; at: V3; s: V3; c: string; t?: Texture; rot?: V3; shadow?: boolean }) {
  return (
    <mesh position={at} rotation={rot} castShadow={shadow} receiveShadow>
      <boxGeometry args={s} />
      {m(c, t)}
    </mesh>
  )
}

function Cyl({ m, at, r, r2 = r, h, c, seg = 12, rot }: { m: Mat; at: V3; r: number; r2?: number; h: number; c: string; seg?: number; rot?: V3 }) {
  return (
    <mesh position={at} rotation={rot} castShadow>
      <cylinderGeometry args={[r, r2, h, seg]} />
      {m(c)}
    </mesh>
  )
}

function Tyre({ m, at, rot = [Math.PI / 2, 0, 0] }: { m: Mat; at: V3; rot?: V3 }) {
  return (
    <mesh position={at} rotation={rot} castShadow>
      <torusGeometry args={[0.11, 0.05, 8, 12]} />
      {m('#263238')}
    </mesh>
  )
}

// A car squashed flat by the crusher: a slab of faded paint with a window strip.
function Crushed({ m, at, c, rot = 0 }: { m: Mat; at: V3; c: string; rot?: number }) {
  return (
    <group position={at} rotation-y={rot}>
      <Box m={m} at={[0, 0, 0]} s={[0.62, 0.13, 0.32]} c={c} />
      <Box m={m} at={[0.02, 0.005, 0.162]} s={[0.34, 0.05, 0.01]} c="#37474f" shadow={false} />
      <Box m={m} at={[-0.22, -0.01, 0.161]} s={[0.1, 0.07, 0.01]} c="#8d4a24" shadow={false} />
    </group>
  )
}

function Drum({ m, at, c }: { m: Mat; at: V3; c: string }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.15, 0]} r={0.09} h={0.3} c={c} seg={10} />
      <Cyl m={m} at={[0, 0.1, 0]} r={0.092} h={0.025} c="#37474f" seg={10} />
      <Cyl m={m} at={[0, 0.21, 0]} r={0.092} h={0.025} c="#37474f" seg={10} />
    </group>
  )
}

export function RustysYard({ m, ghost, sign, bulb, win, lvl, lift }: Props) {
  // The crushed-car stack and the roadside sign grow with upgrades.
  const stack = 2 + Math.min(4, Math.round(lift / 0.5))
  const stage = growthStage(lvl)
  const pole = 1.35 + lift * 0.5
  const qTop = QY + QR
  const qLen = QZ1 - QZ0
  const qMid = (QZ0 + QZ1) / 2
  return (
    <group>
      {/* Gravel yard with a concrete apron in front of the bay. */}
      <Box m={m} at={[0, 0.025, 0]} s={[3.9, 0.05, 1.92]} c="#ffffff" t={gravelTex(4, 2)} shadow={false} />
      <Box m={m} at={[QX, 0.03, 0.6]} s={[1.9, 0.05, 0.76]} c="#ffffff" t={concreteTex(2, 0.8)} shadow={false} />

      {/* The Quonset: corrugated arch on a block footing, ribs following the curve. */}
      <mesh position={[QX, QY, qMid]} rotation-x={-Math.PI / 2} castShadow receiveShadow>
        <cylinderGeometry args={[QR, QR, qLen, 18, 1, true, -Math.PI / 2, Math.PI]} />
        {m(RUST, corrugatedTex(1, 3, true))}
      </mesh>
      <mesh position={[QX, QY, QZ0 - 0.001]} rotation-y={Math.PI}>
        <circleGeometry args={[QR, 18, 0, Math.PI]} />
        {m('#8f4422')}
      </mesh>
      {/* Front gable: painted boards with a white rim. */}
      <mesh position={[QX, QY, QZ1 + 0.002]}>
        <circleGeometry args={[QR - 0.01, 18, 0, Math.PI]} />
        {m('#efe2c8')}
      </mesh>
      <mesh position={[QX, QY, QZ1 + 0.004]}>
        <ringGeometry args={[QR - 0.06, QR + 0.005, 18, 1, 0, Math.PI]} />
        {m(lvl >= 9 && !ghost ? GOLD : '#fafafa')}
      </mesh>
      {/* Roof ribs, a skylight strip and a turbine vent. */}
      {[0.15, 0.5, 0.85].map((f) => (
        <mesh key={f} position={[QX, QY, QZ0 + qLen * f]} rotation-x={-Math.PI / 2}>
          <cylinderGeometry args={[QR + 0.015, QR + 0.015, 0.035, 18, 1, true, -Math.PI / 2, Math.PI]} />
          {m('#7a3518')}
        </mesh>
      ))}
      {!ghost && (
        <>
          <mesh position={[QX - 0.32, QY + QR * 0.94, qMid - 0.05]} rotation={[-Math.PI / 2, -0.36, 0]}>
            <planeGeometry args={[0.2, qLen * 0.62]} />
            {win}
          </mesh>
          <Cyl m={m} at={[QX + 0.22, qTop + 0.04, -0.6]} r={0.05} h={0.12} c="#90a4ae" seg={8} />
          <mesh position={[QX + 0.22, qTop + 0.14, -0.6]} castShadow>
            <sphereGeometry args={[0.085, 10, 6]} />
            <meshStandardMaterial color="#cfd8dc" metalness={0.5} roughness={0.35} flatShading />
          </mesh>
        </>
      )}
      {/* Bay door, rolled half up, showing the dark shop inside. */}
      <mesh position={[QX, QY + 0.33, QZ1 + 0.006]}>
        <planeGeometry args={[0.86, 0.66]} />
        {m('#2a2d31')}
      </mesh>
      <mesh position={[QX, QY + 0.56, QZ1 + 0.008]}>
        <planeGeometry args={[0.86, 0.22]} />
        {m('#d9dde0', corrugatedTex(3, 0.7, true))}
      </mesh>
      <Cyl m={m} at={[QX, QY + 0.68, QZ1 + 0.03]} r={0.04} h={0.92} c="#90a4ae" seg={8} rot={[0, 0, Math.PI / 2]} />
      {[-0.46, 0.46].map((x) => (
        <Box key={x} m={m} at={[QX + x, QY + 0.34, QZ1 + 0.02]} s={[0.05, 0.68, 0.04]} c="#fafafa" />
      ))}
      {/* Round porthole windows: one on the gable, one on the porch's side. */}
      {[[QX + 0.66, QY + 0.38, QZ1 + 0.006, 0], [PX - PW / 2 - 0.002, 0.48, QZ1 + 0.09, -Math.PI / 2]].map(([x, y, z, ry]) => (
        <group key={x} position={[x, y, z]} rotation-y={ry}>
          <mesh><circleGeometry args={[0.1, 14]} />{m('#fafafa')}</mesh>
          <mesh position-z={0.002}><circleGeometry args={[0.075, 14]} />{win}</mesh>
        </group>
      ))}
      {/* The porch: painted boards like the gable under a rust tin roof, a
          white-framed door, a concrete step and a lamp. */}
      <Box m={m} at={[PX, (0.05 + PTOP) / 2, QZ1 + 0.08]} s={[PW, PTOP - 0.05, 0.26]} c="#efe2c8" />
      <Box m={m} at={[PX, PTOP + 0.025, QZ1 + 0.09]} s={[PW + 0.06, 0.05, 0.32]} c="#7a3518" />
      <Box m={m} at={[PX, 0.385, QZ1 + 0.214]} s={[0.36, 0.67, 0.006]} c="#fafafa" shadow={false} />
      <mesh position={[PX, 0.36, QZ1 + 0.219]} userData={doorTag()}>
        <planeGeometry args={[0.3, 0.6]} />
        {m('#8f4422')}
      </mesh>
      <Box m={m} at={[PX + 0.1, 0.37, QZ1 + 0.223]} s={[0.03, 0.05, 0.006]} c="#cfd8dc" shadow={false} />
      <Box m={m} at={[PX, 0.07, QZ1 + 0.27]} s={[0.4, 0.04, 0.1]} c="#9e9e9e" />
      <mesh position={[PX, 0.75, QZ1 + 0.237]}>
        <boxGeometry args={[0.1, 0.04, 0.05]} />
        {bulb}
      </mesh>
      <mesh position={[QX, QY + 0.74, QZ1 + 0.06]}>
        <boxGeometry args={[0.18, 0.05, 0.08]} />
        {bulb}
      </mesh>
      {sign && (
        <>
          {/* The board the lettering is painted on, bolted to the gable. */}
          <Box m={m} at={[QX, QY + 0.84, QZ1 + 0.0225]} s={[1.0, 0.28, 0.045]} c="#b71c1c" />
          {[-0.46, 0.46].flatMap((x) => [-0.11, 0.11].map((y) => (
            <Cyl key={`${x}${y}`} m={m} at={[QX + x, QY + 0.84 + y, QZ1 + 0.047]} r={0.009} h={0.006} c="#cfd8dc" seg={6} rot={[Math.PI / 2, 0, 0]} />
          )))}
        </>
      )}
      {sign && (
        <mesh position={[QX, QY + 0.66 + 0.18, QZ1 + 0.05]}>
          <planeGeometry args={[0.95, 0.95 / 4]} />
          <meshBasicMaterial map={signTexture("RUSTY'S", '#fffde7', '#c62828')} toneMapped={false} />
        </mesh>
      )}

      {/* A rescued classic up on the two-post lift in front of the bay. */}
      {!ghost && (
        <group position={[QX, 0.05, 0.62]}>
          {/* Two-post lift: channel columns on bolted base plates, a carriage
              on each column with two swing arms reaching under the car's
              jacking points, rubber pads, the hydraulic lines under a floor plate,
              and the control box on the left column. */}
          {[-1, 1].map((sd) => (
            <group key={sd} position={[sd * 0.36, 0, 0]}>
              <Box m={m} at={[0, 0.012, 0]} s={[0.17, 0.024, 0.17]} c="#455a64" />
              {[[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]].map(([bx, bz]) => <Cyl key={`${bx}${bz}`} m={m} at={[bx, 0.03, bz]} r={0.008} h={0.014} c="#b0bec5" seg={6} />)}
              <Box m={m} at={[0, 0.33, 0]} s={[0.08, 0.62, 0.08]} c="#ffb300" />
              {/* The channel the carriage rides in, facing the car, with its safety-lock ladder. */}
              <Box m={m} at={[-sd * 0.041, 0.33, 0]} s={[0.004, 0.6, 0.036]} c="#37474f" shadow={false} />
              {Array.from({ length: 6 }, (_, i) => <Box key={i} m={m} at={[-sd * 0.0445, 0.12 + i * 0.08, 0]} s={[0.003, 0.012, 0.03]} c="#90a4ae" shadow={false} />)}
              <Box m={m} at={[-sd * 0.06, 0.3, 0]} s={[0.04, 0.12, 0.09]} c="#37474f" />
              {/* Swing arms, angled forward and back, ending in rubber pads under the sills. */}
              {[-1, 1].map((fz) => {
                const tx = -sd * 0.2, tz = fz * 0.24, dx = tx - -sd * 0.06, dz = tz
                const len = Math.hypot(dx, dz)
                return (
                  <group key={fz}>
                    <Box m={m} at={[(-sd * 0.06 + tx) / 2, 0.3, tz / 2]} s={[len, 0.03, 0.04]} c="#ffb300" rot={[0, -Math.atan2(dz, dx), 0]} />
                    <Cyl m={m} at={[tx, 0.325, tz]} r={0.03} h={0.022} c="#212121" seg={10} />
                  </group>
                )
              })}
            </group>
          ))}
          <Box m={m} at={[0, 0.01, 0]} s={[0.55, 0.02, 0.14]} c="#455a64" />
          <group position={[-0.43, 0.5, 0.02]}>
            <Box m={m} at={[0, 0, 0]} s={[0.06, 0.11, 0.07]} c="#eceff1" />
            <Cyl m={m} at={[0, 0.02, 0.038]} r={0.012} h={0.008} c="#43a047" seg={8} rot={[Math.PI / 2, 0, 0]} />
            <Cyl m={m} at={[0, -0.02, 0.038]} r={0.012} h={0.008} c="#e53935" seg={8} rot={[Math.PI / 2, 0, 0]} />
          </group>
          {/* Up on the pads, wheels hanging clear of the floor. */}
          <group position={[0, 0.3, 0]} scale={0.55}>
            {stage === 3 ? <CarModel body="classic" color="#c62828" finish="gloss" /> : <CarModel body="classic" color="#5d8aa8" rusty />}
          </group>
          {/* Rolling tool chest (drawers with chrome pulls, a lid, a push bar
              and casters) and a wheel off the car. */}
          <group position={[0.62, 0, 0.18]}>
            <Box m={m} at={[0, 0.17, 0]} s={[0.2, 0.26, 0.14]} c="#d32f2f" />
            <Box m={m} at={[0, 0.31, 0]} s={[0.21, 0.02, 0.15]} c="#b71c1c" />
            {[0.24, 0.19, 0.14, 0.075].map((y, i) => (
              <group key={y}>
                <Box m={m} at={[0, y, 0.0715]} s={[0.18, i === 3 ? 0.07 : 0.042, 0.003]} c="#c62828" shadow={false} />
                <Box m={m} at={[0, y + (i === 3 ? 0.022 : 0.012), 0.075]} s={[0.12, 0.008, 0.006]} c="#cfd8dc" shadow={false} />
              </group>
            ))}
            {[-0.04, 0.04].map((z) => <Box key={z} m={m} at={[0.112, 0.25, z]} s={[0.026, 0.012, 0.012]} c="#90a4ae" />)}
            <Cyl m={m} at={[0.128, 0.25, 0]} r={0.008} h={0.11} c="#cfd8dc" seg={6} rot={[Math.PI / 2, 0, 0]} />
            {[[-0.08, -0.05], [0.08, -0.05], [-0.08, 0.05], [0.08, 0.05]].map(([cx, cz]) => (
              <group key={`${cx}${cz}`}>
                <Box m={m} at={[cx, 0.035, cz]} s={[0.03, 0.01, 0.03]} c="#37474f" />
                <Cyl m={m} at={[cx, 0.016, cz]} r={0.016} h={0.014} c="#212121" seg={8} rot={[0, 0, Math.PI / 2]} />
              </group>
            ))}
          </group>
          <Tyre m={m} at={[-0.12, 0.06, 0.32]} rot={[-Math.PI / 2, 0, 0]} />
        </group>
      )}
      {/* Oil stain under the lift. */}
      {!ghost && (
        <mesh position={[QX + 0.1, 0.058, 0.68]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.2, 14]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.2} depthWrite={false} {...decal()} />
        </mesh>
      )}

      {/* The junkyard: sheet-metal fence of odd panels round the back corner. */}
      {/* The last panel is a little narrower so it stops at the lot's edge. */}
      {[0.32, 0.62, 0.92, 1.22, 1.52, 1.8].map((x, i) => (
        <Box key={x} m={m} at={[i === 5 ? 1.925 : x + 0.14, 0.3 + (i % 2) * 0.03, -0.9]} s={[i === 5 ? 0.23 : 0.29, 0.6 + (i % 2) * 0.06, 0.03]} c={['#90a4ae', '#a1887f', '#78909c', '#b0855f'][i % 4]} t={corrugatedTex(1, 1)} />
      ))}
      {[-0.62, -0.32, -0.02].map((z, i) => (
        <Box key={z} m={m} at={[1.92, 0.3 + (i % 2) * 0.03, z]} s={[0.03, 0.6 + (i % 2) * 0.06, 0.29]} c={['#a1887f', '#78909c', '#90a4ae'][i]} t={corrugatedTex(1, 1)} />
      ))}
      {[0.32, 1.06, 1.92].map((x) => (
        <Box key={x} m={m} at={[x, 0.36, -0.9]} s={[0.05, 0.72, 0.05]} c="#546e7a" />
      ))}
      {!ghost && (
        <>
          {/* Crushed cars stacked up (more of them as the yard levels up). */}
          {Array.from({ length: stack }, (_, i) => (
            <Crushed key={i} m={m} at={[1.45 + ((i * 37) % 5) * 0.012 - 0.02, 0.12 + i * 0.135, -0.6 + (i % 2) * 0.03]} c={['#7b8f6a', '#a35d3a', '#6a7f99', '#b39b5a', '#8a6f8f', '#9b5145'][i % 6]} rot={(i % 3) * 0.12 - 0.1} />
          ))}
          {/* A rusted-out shell waiting its turn. */}
          {stage === 1 && (
            <group position={[0.74, 0.05, -0.5]} rotation-y={0.5} scale={0.45}>
              <CarModel body="sedan" color="#8d6e63" rusty />
            </group>
          )}
          {/* Tyre pile and oil drums. */}
          {[[0.48, 0.09, -0.12], [0.7, 0.09, -0.12], [0.59, 0.09, 0.05], [0.59, 0.19, -0.04]].map((p, i) => (
            <Tyre key={i} m={m} at={p as V3} rot={[-Math.PI / 2, 0, i * 0.4]} />
          ))}
          {stage < 3 && (
            <>
              <Drum m={m} at={[1.78, 0.05, -0.12]} c="#1e88e5" />
              <Drum m={m} at={[1.6, 0.05, -0.08]} c="#e53935" />
              <Drum m={m} at={[1.75, 0.05, 0.08]} c="#43a047" />
            </>
          )}
          {/* Recovery Yard: a tracked crane swinging over the junk. */}
          {stage >= 2 && (
            <group position={[0.86, 0.05, -0.45]} rotation-y={Math.PI / 2} scale={0.62}>
              <Crane m={m} at={[0, 0, 0]} />
            </group>
          )}
          {/* Restoration Works: a crusher for what can't be saved. */}
          {stage === 3 && (
            <group position={[1.5, 0.05, -0.08]} scale={0.6}>
              <Crusher m={m} at={[0, 0, 0]} bulb={bulb} />
            </group>
          )}
          {/* Engine hoist with a block hanging off its chain. */}
          {stage === 1 && <group position={[1.08, 0.05, -0.15]} rotation-y={-0.4}>
            <Box m={m} at={[0, 0.02, 0]} s={[0.05, 0.04, 0.5]} c="#c62828" />
            <Box m={m} at={[0, 0.3, -0.18]} s={[0.05, 0.6, 0.05]} c="#c62828" />
            <Box m={m} at={[0, 0.6, -0.02]} s={[0.05, 0.05, 0.4]} c="#c62828" rot={[-0.25, 0, 0]} />
            <Box m={m} at={[0, 0.5, 0.16]} s={[0.012, 0.14, 0.012]} c="#212121" shadow={false} />
            <Box m={m} at={[0, 0.36, 0.16]} s={[0.16, 0.13, 0.12]} c="#607d8b" />
            <Box m={m} at={[0, 0.45, 0.16]} s={[0.12, 0.04, 0.1]} c="#455a64" />
          </group>}
        </>
      )}

      {/* Rusty's tow truck, parked along the front of the yard. */}
      {!ghost && (
        <group position={[1.16, 0.05, 0.6]} rotation-y={Math.PI / 2} scale={0.7}>
          <CarModel body="truck" color="#ff8f00" />
          <Box m={m} at={[0, 0.66, -0.52]} s={[0.07, 0.07, 0.55]} c="#37474f" rot={[0.45, 0, 0]} />
          <Box m={m} at={[0, 0.48, -0.78]} s={[0.012, 0.18, 0.012]} c="#212121" shadow={false} />
          <Box m={m} at={[0, 0.38, -0.78]} s={[0.12, 0.03, 0.05]} c="#ffca28" shadow={false} />
          <mesh position={[0, 0.9, -0.12]}>
            <boxGeometry args={[0.42, 0.06, 0.15]} />
            <meshStandardMaterial color="#ffca28" emissive="#ffb300" emissiveIntensity={0.6} />
          </mesh>
        </group>
      )}

      {/* Roadside pole sign with a giant wrench on top. */}
      <group position={[-1.82, 0, 0.8]}>
        <Cyl m={m} at={[0, pole / 2, 0]} r={0.035} h={pole} c="#78909c" seg={8} />
        <Box m={m} at={[0.22, pole - 0.1, 0]} s={[0.56, 0.3, 0.05]} c="#c62828" />
        {/* Clamps holding the board to the pole, a cap on the pole, and the
            lettering on both faces. */}
        {[pole - 0.2, pole - 0.03].map((y) => <Cyl key={y} m={m} at={[0, y, 0]} r={0.045} h={0.03} c="#546e7a" seg={8} />)}
        <Cyl m={m} at={[0, pole + 0.01, 0]} r={0.045} h={0.02} c="#546e7a" seg={8} />
        {sign && [1, -1].map((f) => (
          <mesh key={f} position={[0.22, pole - 0.1, f * 0.027]} rotation-y={f > 0 ? 0 : Math.PI}>
            <planeGeometry args={[0.5, 0.25]} />
            <meshBasicMaterial map={signTexture('24H TOW', '#fffde7', '#c62828', 2)} toneMapped={false} />
          </mesh>
        ))}
        <group position={[0.22, pole + 0.2, 0]} rotation-z={0.6}>
          <Box m={m} at={[0, 0, 0]} s={[0.07, 0.36, 0.04]} c="#cfd8dc" />
          <mesh position={[0, 0.22, 0]}>
            <torusGeometry args={[0.07, 0.03, 6, 10, Math.PI * 1.5]} />
            {m('#cfd8dc')}
          </mesh>
        </group>
        {lvl >= 5 && !ghost && [-0.04, 0.48].map((x) => (
          <mesh key={x} position={[x, pole + 0.07, 0.04]}>
            <sphereGeometry args={[0.03, 6, 5]} />
            <primitive object={glowMats.bulb} attach="material" dispose={null} />
          </mesh>
        ))}
      </group>

      {/* Night: a pool of light on the apron. */}
      {!ghost && (
        <mesh rotation-x={-Math.PI / 2} position={[QX, 0.075, 0.62]} renderOrder={2}>
          <planeGeometry args={[1.5, 1.5]} />
          <primitive object={glowMats.pool} attach="material" dispose={null} />
        </mesh>
      )}

      {/* Upgrade trimmings: bulbs round the arch (5), a flag (8, star at 10). */}
      {lvl >= 5 && !ghost && Array.from({ length: 11 }, (_, i) => {
        const a = Math.PI * (0.06 + (i / 10) * 0.88)
        // None buried in the porch.
        if (Math.abs(QX + Math.cos(a) * QR - PX) < PW / 2 + 0.04 && QY + Math.sin(a) * QR < PTOP + 0.08) return null
        return (
          <mesh key={i} position={[QX + Math.cos(a) * (QR + 0.02), QY + Math.sin(a) * (QR + 0.02), QZ1 + 0.03]}>
            <sphereGeometry args={[0.03, 6, 5]} />
            <primitive object={glowMats.bulb} attach="material" dispose={null} />
          </mesh>
        )
      })}
      {lvl >= 8 && !ghost && (
        <group position={[QX, qTop - 0.02, QZ0 + 0.3]}>
          <mesh position={[0, 0.45, 0]} castShadow><cylinderGeometry args={[0.02, 0.025, 0.9, 6]} /><meshStandardMaterial color="#eceff1" metalness={0.4} /></mesh>
          <mesh position={[0.17, 0.75, 0]}><boxGeometry args={[0.32, 0.2, 0.015]} /><meshStandardMaterial color="#c62828" /></mesh>
          {lvl >= 10 ? (
            <mesh position={[0, 0.98, 0]} rotation-z={Math.PI / 2}><octahedronGeometry args={[0.11, 0]} /><meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} emissive={GOLD} emissiveIntensity={0.25} /></mesh>
          ) : (
            <mesh position={[0, 0.92, 0]}><sphereGeometry args={[0.04, 8, 6]} /><meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} /></mesh>
          )}
        </group>
      )}
    </group>
  )
}
