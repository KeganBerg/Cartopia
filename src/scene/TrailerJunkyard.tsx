import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import { CarModel } from './CarModel'
import { Upright } from './mergeScale'
import { PEOPLE_SIZED } from './keepShape'
import { SEASON, PAL } from './season'
import { brickTex, concreteTex, corrugatedTex, gravelTex, paverTex, shingleTex, sidingTex, soilTex } from './textures'
import { Ball, Box, Bulbs, Cyl, Flag, GOLD, Patch, Pool, Sign, type EdgeProps, type Mat, type V3 } from './edgeKit'
import type { ReactNode } from 'react'

// Trailer homes and the junkyard. Lots face +z like the rest of town.
// Trailer homes (1x1) stay low as they level up: a single-wide (1-3), a
// double-wide with a deck (4-6), then a little trailer court of two homes
// round a shared patio (7-10). The junkyard (2x2) is a fenced scrapyard with
// a crane swinging wrecks onto the crusher and stacks that grow each level.

export const TRAILER_JUNK = new Set(['trailer', 'junkyard'])

const SNOW = SEASON === 'winter'
const LIVE = { noBatch: true }

// ---- Trailer homes ----

// A single-wide mobile home, long side along x, door side facing +z.
function SingleWide({ m, win, bulb, at, rot = 0, len = 1.45, color, stripe, ghost, airstream, hood }: {
  m: Mat; win: ReactNode; bulb: ReactNode; at: V3; rot?: number; len?: number; color: string; stripe: string; ghost?: boolean; airstream?: boolean; hood?: boolean
}) {
  const d = 0.58
  const zf = d / 2
  if (airstream)
    return (
      <group position={at} rotation-y={rot}>
        {/* Polished aluminium capsule on its axle, with a rounded window band. */}
        <mesh position={[0, 0.42, 0]} rotation-z={Math.PI / 2} scale={[1, 1, 0.95]} castShadow receiveShadow>
          <capsuleGeometry args={[0.29, len - 0.58, 6, 14]} />
          <meshStandardMaterial color="#d6dde2" metalness={0.55} roughness={0.28} />
        </mesh>
        <Box m={m} at={[0, 0.17, 0]} s={[len * 0.7, 0.06, d * 0.8]} c="#455a64" shadow={false} />
        {[-0.1, 0.12].map((x) => <Cyl key={x} m={m} at={[x, 0.11, zf - 0.02]} r={0.1} h={0.06} c="#212121" seg={12} rot={[Math.PI / 2, 0, 0]} />)}
        {[-0.42, -0.18, 0.36].map((x) => (
          <mesh key={x} position={[x, 0.5, zf - 0.01]}>
            <planeGeometry args={[0.16, 0.12]} />
            {win}
          </mesh>
        ))}
        <mesh position={[0.12, 0.38, zf - 0.005]}><planeGeometry args={[0.15, 0.32]} />{m('#b0bec5')}</mesh>
        <Box m={m} at={[0, 0.58, zf + 0.03]} s={[0.5, 0.02, 0.18]} c={stripe} rot={[0.25, 0, 0]} />
        <Box m={m} at={[-len / 2 - 0.06, 0.17, 0]} s={[0.3, 0.04, 0.06]} c="#37474f" />
        <Box m={m} at={[-len / 2 - 0.16, 0.075, 0]} s={[0.03, 0.15, 0.03]} c="#37474f" />
        {!ghost && <mesh position={[0.12, 0.6, zf + 0.03]}><boxGeometry args={[0.06, 0.05, 0.04]} />{bulb}</mesh>}
      </group>
    )
  const roofC = SNOW ? '#f4f8fb' : '#eceff1'
  return (
    <group position={at} rotation-y={rot}>
      {/* Lattice skirting hides the blocks it sits on. */}
      <Box m={m} at={[0, 0.08, 0]} s={[len - 0.04, 0.16, d - 0.04]} c="#bcaaa4" t={corrugatedTex(4, 1)} />
      <Box m={m} at={[0, 0.42, 0]} s={[len, 0.52, d]} c={color} t={corrugatedTex(Math.round(len * 4), 1)} />
      <Box m={m} at={[0, 0.34, 0]} s={[len + 0.006, 0.05, d + 0.006]} c={stripe} shadow={false} />
      <Box m={m} at={[0, 0.6, 0]} s={[len + 0.006, 0.025, d + 0.006]} c={stripe} shadow={false} />
      {/* Low rounded roof. */}
      <mesh position={[0, 0.68, 0]} rotation-z={Math.PI / 2} scale={[0.22, 1, 1]} castShadow>
        <cylinderGeometry args={[d / 2 + 0.02, d / 2 + 0.02, len + 0.03, 12, 1, false, 0, Math.PI]} />
        {m(roofC)}
      </mesh>
      {/* Windows down the front and at each end, with little awnings. */}
      {[-0.5, -0.22, 0.46].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.47, zf + 0.004]}><planeGeometry args={[0.2, 0.17]} />{win}</mesh>
          <Box m={m} at={[x, 0.58, zf + 0.04]} s={[0.24, 0.015, 0.08]} c={stripe} rot={[0.35, 0, 0]} shadow={false} />
        </group>
      ))}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (len / 2 + 0.004), 0.47, 0]} rotation-y={(sd * Math.PI) / 2}><planeGeometry args={[0.18, 0.16]} />{win}</mesh>
      ))}
      {/* Front door, an aluminium awning on two poles and wooden steps. */}
      <mesh position={[0.15, 0.36, zf + 0.006]}><planeGeometry args={[0.15, 0.34]} />{m('#eceff1')}</mesh>
      <mesh position={[0.15, 0.44, zf + 0.009]}><planeGeometry args={[0.09, 0.09]} />{win}</mesh>
      {/* Round a shared patio the awning shrinks to a door hood, so no poles stand in the patio. */}
      {hood ? (
        <Box m={m} at={[0.15, 0.66, zf + 0.07]} s={[0.3, 0.02, 0.14]} c="#cfd8dc" rot={[0.12, 0, 0]} />
      ) : (
        <>
          <Box m={m} at={[0.15, 0.64, zf + 0.17]} s={[0.46, 0.02, 0.34]} c="#cfd8dc" rot={[0.08, 0, 0]} />
          {[-0.06, 0.36].map((x) => <Cyl key={x} m={m} at={[x, 0.32, zf + 0.32]} r={0.01} h={0.64} c="#b0bec5" seg={5} />)}
        </>
      )}
      <Box m={m} at={[0.15, 0.075, zf + 0.12]} s={[0.26, 0.15, 0.12]} c="#8d6e63" />
      <Box m={m} at={[0.15, 0.04, zf + 0.23]} s={[0.26, 0.08, 0.1]} c="#8d6e63" />
      {!ghost && <mesh position={[0.32, 0.5, zf + 0.02]}><boxGeometry args={[0.05, 0.05, 0.04]} />{bulb}</mesh>}
      {/* Hitch tongue still on the end, a propane bottle and a window AC unit. */}
      <Box m={m} at={[-len / 2 - 0.08, 0.18, 0]} s={[0.22, 0.035, 0.05]} c="#37474f" rot={[0, 0.0, 0]} />
      <Cyl m={m} at={[-len / 2 - 0.16, 0.1, 0]} r={0.015} h={0.16} c="#37474f" seg={5} />
      <group position={[-len / 2 + 0.05, 0, -zf - 0.08]}>
        <Cyl m={m} at={[0, 0.1, 0]} r={0.055} h={0.2} c="#fafafa" seg={10} />
        <Ball m={m} at={[0, 0.21, 0]} r={0.055} c="#fafafa" />
      </group>
      <Box m={m} at={[0.46, 0.3, -zf - 0.05]} s={[0.18, 0.12, 0.1]} c="#b0bec5" />
    </group>
  )
}

function Flamingo({ m, at, rot = 0 }: { m: Mat; at: V3; rot?: number }) {
  return (
    <group position={at} rotation-y={rot}>
      <Cyl m={m} at={[0, 0.07, 0]} r={0.005} h={0.14} c="#455a64" seg={4} />
      <mesh position={[0, 0.17, 0]} scale={[1, 0.7, 1.4]} castShadow><sphereGeometry args={[0.045, 8, 6]} />{m('#f06292')}</mesh>
      <Cyl m={m} at={[0, 0.23, 0.04]} r={0.008} h={0.1} c="#f06292" seg={5} rot={[0.3, 0, 0]} />
      <Ball m={m} at={[0, 0.28, 0.055]} r={0.018} c="#f06292" />
      <Box m={m} at={[0, 0.275, 0.08]} s={[0.012, 0.012, 0.03]} c="#212121" shadow={false} />
    </group>
  )
}

function LawnChair({ m, at, rot = 0, c }: { m: Mat; at: V3; rot?: number; c: string }) {
  return (
    <group position={at} rotation-y={rot}>
      <Box m={m} at={[0, 0.1, 0]} s={[0.16, 0.012, 0.14]} c={c} />
      <Box m={m} at={[0, 0.18, -0.07]} s={[0.16, 0.16, 0.012]} c={c} rot={[-0.25, 0, 0]} />
      {[-0.08, 0.08].map((x) => <Box key={x} m={m} at={[x, 0.06, 0]} s={[0.01, 0.12, 0.15]} c="#cfd8dc" shadow={false} />)}
    </group>
  )
}

function Grill({ m, at }: { m: Mat; at: V3 }) {
  return (
    <group position={at}>
      <mesh position={[0, 0.2, 0]} castShadow><sphereGeometry args={[0.07, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />{m('#212121')}</mesh>
      {/* The lid sits on the bowl's rim. */}
      <mesh position={[0, 0.165, 0]} castShadow><sphereGeometry args={[0.07, 10, 4, 0, Math.PI * 2, 0, Math.PI / 3]} />{m('#263238')}</mesh>
      {[0, 2.1, 4.2].map((a) => <Cyl key={a} m={m} at={[Math.sin(a) * 0.04, 0.08, Math.cos(a) * 0.04]} r={0.006} h={0.17} c="#424242" seg={4} />)}
    </group>
  )
}

function Mailbox({ m, at, c = '#37474f' }: { m: Mat; at: V3; c?: string }) {
  return (
    // One people-sized piece, so a merged lot keeps the box on its post.
    <group position={at} userData={PEOPLE_SIZED}>
      <Box m={m} at={[0, 0.17, 0]} s={[0.03, 0.34, 0.03]} c="#6d4c41" />
      <Box m={m} at={[0, 0.37, 0]} s={[0.08, 0.07, 0.14]} c={c} />
      <Box m={m} at={[0.045, 0.39, -0.03]} s={[0.01, 0.06, 0.02]} c="#e53935" shadow={false} />
    </group>
  )
}

// Clothesline between two T-posts with the washing out.
function Clothesline({ m, at, rot = 0 }: { m: Mat; at: V3; rot?: number }) {
  return (
    <group position={at} rotation-y={rot}>
      {[-0.35, 0.35].map((x) => (
        <group key={x}>
          <Cyl m={m} at={[x, 0.25, 0]} r={0.012} h={0.5} c="#90a4ae" seg={5} />
          <Box m={m} at={[x, 0.49, 0]} s={[0.02, 0.02, 0.18]} c="#90a4ae" shadow={false} />
        </group>
      ))}
      <Box m={m} at={[0, 0.48, 0.07]} s={[0.7, 0.005, 0.005]} c="#eceff1" shadow={false} />
      {[[-0.22, '#42a5f5', 0.12], [-0.05, '#fafafa', 0.1], [0.12, '#ef5350', 0.14], [0.27, '#ffee58', 0.08]].map(([x, c, h]) => (
        <Box key={x as number} m={m} at={[x as number, 0.48 - (h as number) / 2, 0.07]} s={[0.1, h as number, 0.008]} c={c as string} />
      ))}
    </group>
  )
}

function Gnome({ m, at }: { m: Mat; at: V3 }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.04, 0]} r={0.03} r2={0.035} h={0.08} c="#1e88e5" seg={8} />
      <Ball m={m} at={[0, 0.1, 0]} r={0.025} c="#ffccbc" />
      <Ball m={m} at={[0, 0.085, 0.015]} r={0.02} c="#fafafa" />
      <mesh position={[0, 0.15, 0]} castShadow><coneGeometry args={[0.027, 0.07, 8]} />{m('#e53935')}</mesh>
    </group>
  )
}

function Dish({ m, at }: { m: Mat; at: V3 }) {
  return (
    <group position={at} rotation={[0, -0.5, 0]}>
      <Cyl m={m} at={[0, 0.05, 0]} r={0.008} h={0.1} c="#9e9e9e" seg={4} />
      <mesh position={[0, 0.12, 0.02]} rotation-x={-0.9} castShadow><sphereGeometry args={[0.08, 10, 4, 0, Math.PI * 2, 0, 0.9]} />{m('#eceff1')}</mesh>
    </group>
  )
}

// A low wire fence along the front of the lot, gap for the path.
function WireFence({ m, z }: { m: Mat; z: number }) {
  const posts = [-0.92, -0.62, -0.32, 0.32, 0.62, 0.92]
  return (
    <group>
      {/* Square posts, so a merged lot stretches them with the rails they hold. */}
      {posts.map((x) => <Box key={x} m={m} at={[x, 0.12, z]} s={[0.022, 0.24, 0.022]} c="#78909c" shadow={false} />)}
      {[0.1, 0.21].map((y) => [-0.62, 0.62].map((x) => (
        <Box key={`${x}${y}`} m={m} at={[x, y, z]} s={[0.6, 0.008, 0.008]} c="#90a4ae" shadow={false} />
      )))}
    </group>
  )
}

function DoubleWide({ m, win, bulb, lvl, color, roof, trim, ghost }: { m: Mat; win: ReactNode; bulb: ReactNode; lvl: number; color: string; roof: string; trim: string; ghost?: boolean }) {
  const w = 1.5, d = 0.95, h = 0.56
  const z0 = -0.3
  const zf = z0 + d / 2
  const roofC = SNOW ? '#f4f8fb' : roof
  return (
    <group position={[-0.12, 0, 0]}>
      <Box m={m} at={[0, 0.07, z0]} s={[w - 0.04, 0.14, d - 0.04]} c="#a1887f" t={brickTex(3, 1)} />
      <Box m={m} at={[0, 0.14 + h / 2, z0]} s={[w, h, d]} c={color} t={sidingTex(2, 1)} />
      {/* Shallow gable roof over both halves, the seam down the middle. */}
      <mesh position={[0, 0.14 + h + 0.09, z0]} rotation={[0, 0, Math.PI / 2]} scale={[0.36, 1, 1.05]} castShadow>
        <cylinderGeometry args={[d / 2 + 0.06, d / 2 + 0.06, w + 0.1, 3, 1]} />
        {m(roofC, shingleTex(2, 1))}
      </mesh>
      <Box m={m} at={[0, 0.14 + h + 0.005, z0]} s={[w + 0.096, 0.03, d + 0.1]} c="#eceff1" shadow={false} />
      {[-0.55, -0.25, 0.42].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.45, zf + 0.004]}><planeGeometry args={[0.2, 0.2]} />{win}</mesh>
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[x + sd * 0.13, 0.45, zf + 0.01]} s={[0.05, 0.21, 0.01]} c={trim} shadow={false} />)}
        </group>
      ))}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (w / 2 + 0.004), 0.45, z0]} rotation-y={(sd * Math.PI) / 2}><planeGeometry args={[0.22, 0.2]} />{win}</mesh>
      ))}
      <mesh position={[0.1, 0.35, zf + 0.004]}><planeGeometry args={[0.17, 0.36]} />{m('#5d4037')}</mesh>
      {!ghost && <mesh position={[0.25, 0.5, zf + 0.02]}><boxGeometry args={[0.05, 0.05, 0.04]} />{bulb}</mesh>}
      {/* Wooden deck along the front with rails and steps. */}
      <Box m={m} at={[0.05, 0.13, zf + 0.22]} s={[1.15, 0.04, 0.44]} c="#a1887f" t={paverTex(3, 1)} />
      {[-0.5, -0.1, 0.3, 0.6].map((x) => <Box key={x} m={m} at={[x, 0.06, zf + 0.416]} s={[0.04, 0.12, 0.04]} c="#795548" />)}
      <Box m={m} at={[-0.22, 0.3, zf + 0.43]} s={[0.66, 0.025, 0.025]} c="#8d6e63" />
      {[-0.5, -0.38, -0.26, -0.14, -0.02, 0.1].map((x) => <Box key={x} m={m} at={[x, 0.22, zf + 0.43]} s={[0.015, 0.16, 0.015]} c="#8d6e63" shadow={false} />)}
      <Box m={m} at={[0.45, 0.0475, zf + 0.51]} s={[0.26, 0.095, 0.14]} c="#8d6e63" />
      {/* Level 5: string lights over the deck. Level 6: a hot tub out back. */}
      {!ghost && lvl >= 5 && (
        <group>
          <Cyl m={m} at={[0.62, 0.3, zf + 0.42]} r={0.012} h={0.6} c="#6d4c41" seg={5} />
          <Bulbs from={[-0.6, 0.62, zf + 0.02]} to={[0.62, 0.6, zf + 0.42]} n={8} sag={0.06} />
        </group>
      )}
      {!ghost && lvl >= 6 && (
        <group position={[0.86, 0, -0.62]}>
          <Box m={m} at={[0, 0.1, 0]} s={[0.32, 0.2, 0.32]} c="#6d4c41" />
          <mesh position={[0, 0.205, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.27, 0.27]} /><meshStandardMaterial color="#4dd0e1" roughness={0.15} /></mesh>
        </group>
      )}
      {lvl >= 5 && <Dish m={m} at={[0.5, 0.14 + h + 0.12, z0 - 0.2]} />}
    </group>
  )
}

function TrailerHome({ m, win, bulb, ghost, lvl, color, roof }: EdgeProps) {
  const yard = !ghost
  const stripe = roof === '#b0bec5' ? '#26a69a' : roof
  if (lvl >= 7) {
    // Trailer court: two homes end-on to the street round a shared patio.
    return (
      <group>
        <Box m={m} at={[0, 0.02, 0]} s={[1.94, 0.04, 1.94]} c="#ffffff" t={gravelTex(3, 3)} shadow={false} />
        <Box m={m} at={[0, 0.045, 0.2]} s={[0.56, 0.03, 1.4]} c="#ffffff" t={paverTex(1, 3)} shadow={false} />
        <SingleWide m={m} win={win} bulb={bulb} ghost={ghost} at={[-0.6, 0, -0.1]} rot={Math.PI / 2} len={1.4} color={color} stripe={stripe} hood />
        <SingleWide m={m} win={win} bulb={bulb} ghost={ghost} at={[0.6, 0, -0.1]} rot={-Math.PI / 2} len={1.4} color="#fff8e1" stripe="#ef6c00" airstream={lvl >= 9} hood />
        {yard && (
          <group>
            {/* Picnic table and a fire pit on the patio under string lights. */}
            <group position={[0, 0, -0.35]}>
              <Box m={m} at={[0, 0.2, 0]} s={[0.22, 0.03, 0.42]} c="#a1887f" />
              {[-0.16, 0.16].map((x) => <Box key={x} m={m} at={[x, 0.12, 0]} s={[0.07, 0.025, 0.42]} c="#a1887f" />)}
              {/* A-frame legs at each end. */}
              {[-0.15, 0.15].map((z) => [-1, 1].map((sd) => <Box key={`${z}${sd}`} m={m} at={[sd * 0.14, 0.1, z]} s={[0.025, 0.28, 0.03]} c="#8d6e63" rot={[0, 0, sd * 0.785]} />))}
            </group>
            <group position={[0, 0.05, 0.3]}>
              {Array.from({ length: 8 }, (_, i) => <Ball key={i} m={m} at={[Math.sin(i * 0.785) * 0.12, 0.03, Math.cos(i * 0.785) * 0.12]} r={0.04} c="#9e9e9e" flat />)}
              {[0, 1.2].map((r) => <Cyl key={r} m={m} at={[0, 0.03, 0]} r={0.015} h={0.16} c="#5d4037" seg={5} rot={[Math.PI / 2, r, 0.3]} />)}
              <mesh position={[0, 0.06, 0]}><coneGeometry args={[0.05, 0.1, 6]} />{bulb}</mesh>
            </group>
            <Bulbs from={[-0.32, 0.68, -0.85]} to={[0.32, 0.68, 0.55]} n={9} sag={0.08} />
            <Bulbs from={[0.32, 0.68, -0.85]} to={[-0.32, 0.68, 0.55]} n={9} sag={0.08} />
            {[[-0.32, -0.85], [0.32, 0.55], [0.32, -0.85], [-0.32, 0.55]].map(([x, z]) => <Cyl key={`${x}${z}`} m={m} at={[x, 0.345, z]} r={0.012} h={0.69} c="#6d4c41" seg={5} />)}
            <Pool r={0.5} z={0} />
            {/* Court sign by the road. */}
            <group position={[-0.62, 0, 0.88]}>
              {[-0.22, 0.22].map((x) => <Box key={x} m={m} at={[x, 0.2, 0]} s={[0.04, 0.4, 0.04]} c="#5d4037" />)}
              <Box m={m} at={[0, 0.37, -0.01]} s={[0.52, 0.16, 0.03]} c={lvl >= 9 ? GOLD : '#5d4037'} />
              <Sign text="SUNNY PINES" w={0.48} at={[0, 0.37, 0.008]} bg="#fff8e1" fg="#2e7d32" />
            </group>
            {lvl >= 8 && <Flag at={[0.65, 0, 0.85]} color="#2e7d32" star={lvl >= 10} tall={0.75} />}
            <Flamingo m={m} at={[0.25, 0, 0.82]} rot={-0.6} />
            <Flamingo m={m} at={[0.38, 0, 0.78]} rot={0.4} />
            <Grill m={m} at={[-0.26, 0, 0.12]} />
            <LawnChair m={m} at={[0.2, 0, 0.12]} rot={-2.4} c="#26a69a" />
            <Mailbox m={m} at={[0.88, 0, 0.7]} />
            <Mailbox m={m} at={[-0.95, 0, 0.6]} c="#1565c0" />
          </group>
        )}
      </group>
    )
  }
  if (lvl >= 4) {
    return (
      <group>
        <Box m={m} at={[0.78, 0.02, 0.45]} s={[0.4, 0.04, 1.05]} c="#ffffff" t={gravelTex(1, 2)} shadow={false} />
        <DoubleWide m={m} win={win} bulb={bulb} lvl={lvl} color={color} roof="#6d7b84" trim={stripe} ghost={ghost} />
        {yard && (
          <group>
            <Flamingo m={m} at={[-0.7, 0, 0.75]} rot={0.5} />
            <Flamingo m={m} at={[-0.56, 0, 0.82]} rot={-0.3} />
            <Mailbox m={m} at={[0.88, 0, 0.9]} />
            <Grill m={m} at={[-0.52, 0, 0.45]} />
            <LawnChair m={m} at={[0.16, 0.15, 0.4]} rot={0.3} c="#ef5350" />
            <Gnome m={m} at={[-0.88, 0, 0.92]} />
            <Clothesline m={m} at={[-0.95, 0, -0.45]} rot={Math.PI / 2} />
            <WireFence m={m} z={0.96} />
            <Pool r={0.5} x={0.1} z={0.6} />
          </group>
        )}
      </group>
    )
  }
  return (
    <group>
      {/* Gravel pad under the home and a gravel drive on the right. */}
      <Box m={m} at={[-0.12, 0.02, -0.25]} s={[1.65, 0.04, 0.85]} c="#ffffff" t={gravelTex(2, 1)} shadow={false} />
      <Box m={m} at={[0.78, 0.022, 0.45]} s={[0.4, 0.044, 1.05]} c="#ffffff" t={gravelTex(1, 2)} shadow={false} />
      <SingleWide m={m} win={win} bulb={bulb} ghost={ghost} at={[-0.12, 0, -0.3]} color={color} stripe={stripe} />
      {lvl >= 2 && <Dish m={m} at={[-0.55, 0.72, -0.4]} />}
      {yard && (
        <group>
          <Flamingo m={m} at={[-0.6, 0, 0.55]} rot={0.5} />
          <Flamingo m={m} at={[-0.45, 0, 0.62]} rot={-0.3} />
          <LawnChair m={m} at={[-0.1, 0, 0.42]} rot={0.3} c="#26a69a" />
          {lvl >= 2 && <LawnChair m={m} at={[0.22, 0, 0.5]} rot={-0.4} c="#ef5350" />}
          <Grill m={m} at={[-0.85, 0, 0.3]} />
          <Mailbox m={m} at={[0.88, 0, 0.9]} />
          {lvl >= 2 && <Clothesline m={m} at={[-0.15, 0, -0.85]} />}
          {lvl >= 3 && (
            <group>
              <Gnome m={m} at={[-0.88, 0, 0.88]} />
              <Box m={m} at={[-0.6, 0.04, 0.88]} s={[0.4, 0.06, 0.12]} c="#6d4c41" />
              {[-0.75, -0.65, -0.55, -0.45].map((x, i) => <Ball key={x} m={m} at={[x, 0.1, 0.88]} r={0.035} c={PAL.bare ? '#2e7d32' : ['#e91e63', '#ffeb3b', '#ab47bc', '#ff7043'][i]} />)}
              <Bulbs from={[-0.2, 0.62, 0.2]} to={[0.5, 0.62, 0.2]} n={6} sag={0.05} />
            </group>
          )}
          <WireFence m={m} z={0.96} />
          <Pool r={0.45} x={0.03} z={0.25} />
        </group>
      )}
    </group>
  )
}

// ---- Junkyard ----

// A car squashed flat by the crusher.
function Slab({ m, at, c, rot = 0 }: { m: Mat; at: V3; c: string; rot?: number }) {
  return (
    <group position={at} rotation-y={rot}>
      <Box m={m} at={[0, 0, 0]} s={[0.64, 0.13, 0.34]} c={c} />
      <Box m={m} at={[0.03, 0.005, 0.172]} s={[0.36, 0.05, 0.01]} c="#37474f" shadow={false} />
      <Box m={m} at={[-0.22, -0.01, 0.171]} s={[0.1, 0.07, 0.01]} c="#8d4a24" shadow={false} />
      <Cyl m={m} at={[0.24, -0.03, 0.185]} r={0.05} h={0.02} c="#263238" seg={8} rot={[Math.PI / 2, 0, 0]} />
    </group>
  )
}

const WRECK = ['#7b8f6a', '#a35d3a', '#6a7f99', '#b39b5a', '#8a6f8f', '#9b5145', '#5d7a7a', '#c08a4a']

function Tyres({ m, at, n }: { m: Mat; at: V3; n: number }) {
  return (
    <group position={at}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[((i * 37) % 3) * 0.02, 0.05 + i * 0.09, ((i * 53) % 3) * 0.02]} rotation-x={Math.PI / 2} castShadow>
          <torusGeometry args={[0.11, 0.045, 8, 12]} />
          {m('#263238')}
        </mesh>
      ))}
    </group>
  )
}

function Drum({ m, at, c, tipped }: { m: Mat; at: V3; c: string; tipped?: boolean }) {
  return (
    <group position={at} rotation={tipped ? [Math.PI / 2, 0, 0.6] : [0, 0, 0]}>
      <Cyl m={m} at={[0, 0.15, 0]} r={0.09} h={0.3} c={c} seg={10} />
      {[0.06, 0.24].map((y) => <Cyl key={y} m={m} at={[0, y, 0]} r={0.093} h={0.02} c="#37474f" seg={10} />)}
    </group>
  )
}

// Boom pivot on the cab, its angle and length, and where its tip ends up; the
// magnet bobs around HOOK_Y under the tip.
const BOOT = [-0.05, 0.55]
const BOOM_A = 0.92
const BOOM_L = 1.9
const TIP = [BOOT[0] - Math.cos(BOOM_A) * BOOM_L, BOOT[1] + Math.sin(BOOM_A) * BOOM_L]
const HOOK_Y = 1.0

// The crane: tracked base, cab and boom swing between the stacks and the
// crusher, an electromagnet dangling a flattened car.
export function Crane({ m, at }: { m: Mat; at: V3 }) {
  const top = useRef<Group>(null)
  const hook = useRef<Group>(null)
  const cable = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (top.current) top.current.rotation.y = 1.1 + Math.sin(t * 0.3) * 1.15
    const y = HOOK_Y + Math.sin(t * 0.6 + 1) * 0.18
    if (hook.current) hook.current.position.y = y
    // The cable runs from the boom tip down to the magnet, however low it hangs.
    if (cable.current) {
      cable.current.position.y = (y + 0.07 + TIP[1]) / 2
      cable.current.scale.y = TIP[1] - y - 0.07
    }
  })
  return (
    <group position={at}>
      {/* A machine: merged, it stays crane-shaped instead of pulling apart. */}
      <Upright>
      {[-0.17, 0.17].map((z) => (
        <group key={z}>
          <Box m={m} at={[0, 0.08, z]} s={[0.62, 0.14, 0.12]} c="#263238" />
          {[-0.24, 0, 0.24].map((x) => <Cyl key={x} m={m} at={[x, 0.08, z]} r={0.055} h={0.13} c="#455a64" seg={8} rot={[Math.PI / 2, 0, 0]} />)}
        </group>
      ))}
      <Cyl m={m} at={[0, 0.19, 0]} r={0.16} h={0.08} c="#37474f" seg={12} />
      <group ref={top} userData={LIVE}>
        <Box m={m} at={[0.05, 0.36, 0]} s={[0.5, 0.24, 0.36]} c="#ffb300" />
        <Box m={m} at={[0.26, 0.33, 0]} s={[0.14, 0.2, 0.38]} c="#455a64" />
        <Box m={m} at={[-0.12, 0.6, 0.09]} s={[0.2, 0.24, 0.17]} c="#ffb300" />
        <mesh position={[-0.12, 0.62, 0.177]}><planeGeometry args={[0.16, 0.14]} /><meshStandardMaterial color="#81d4fa" roughness={0.2} /></mesh>
        <mesh position={[-0.222, 0.62, 0.09]} rotation-y={-Math.PI / 2}><planeGeometry args={[0.13, 0.14]} /><meshStandardMaterial color="#81d4fa" roughness={0.2} /></mesh>
        {/* Boom, angled up and out towards -x from a pivot on the cab, with a pulley at the tip. */}
        <group position={[BOOT[0], BOOT[1], -0.08]} rotation-z={-BOOM_A}>
          <Box m={m} at={[-BOOM_L / 2, 0, 0]} s={[BOOM_L, 0.09, 0.09]} c="#f9a825" />
          {[0.25, 0.5, 0.75].map((f) => <Box key={f} m={m} at={[-BOOM_L * f, 0, 0]} s={[0.03, 0.12, 0.12]} c="#455a64" shadow={false} />)}
          <Cyl m={m} at={[-BOOM_L, 0, 0]} r={0.07} h={0.11} c="#455a64" seg={10} rot={[Math.PI / 2, 0, 0]} />
        </group>
        {/* A brace from the cab roof up to the boom. */}
        <Cyl m={m} at={[-0.1, 0.74, -0.08]} r={0.022} h={0.79} c="#cfd8dc" seg={6} rot={[0, 0, 0.85]} />
        <group position={[TIP[0], 0, -0.08]}>
          <mesh ref={cable} userData={LIVE} position-y={TIP[1] - 0.5}>
            <cylinderGeometry args={[0.006, 0.006, 1, 4]} />
            <meshStandardMaterial color="#212121" />
          </mesh>
          <group ref={hook} position-y={HOOK_Y} userData={LIVE}>
            <Cyl m={m} at={[0, 0, 0]} r={0.16} h={0.07} c="#424242" seg={14} />
            <Cyl m={m} at={[0, 0.05, 0]} r={0.06} h={0.04} c="#ffb300" seg={10} />
            <Slab m={m} at={[0, -0.11, 0]} c="#6a7f99" rot={0.3} />
          </group>
        </group>
      </group>
      </Upright>
    </group>
  )
}

// Car crusher: a frame with a press that slams down on a car and lifts again.
export function Crusher({ m, at, bulb }: { m: Mat; at: V3; bulb: ReactNode }) {
  const press = useRef<Group>(null)
  const car = useRef<Group>(null)
  useFrame(({ clock }) => {
    // Wait, slam down, hold, lift again: a 5-second cycle.
    const p = (clock.elapsedTime % 5) / 5
    const down = p < 0.55 ? 0 : p < 0.62 ? (p - 0.55) / 0.07 : p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2
    const y = 0.92 - down * 0.48
    if (press.current) press.current.position.y = y
    // The car squashes while the press is down.
    if (car.current) car.current.scale.y = p >= 0.6 && p < 0.97 ? 0.35 : 1
  })
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.08, 0]} s={[0.95, 0.16, 0.6]} c="#455a64" t={concreteTex(1, 1)} />
      {[[-0.43, -0.25], [0.43, -0.25], [-0.43, 0.25], [0.43, 0.25]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.6, z]} s={[0.07, 0.9, 0.07]} c="#c62828" />)}
      <Box m={m} at={[0, 1.08, 0]} s={[0.98, 0.12, 0.64]} c="#c62828" />
      {[-0.2, 0.2].map((x) => <Cyl key={x} m={m} at={[x, 1.2, 0]} r={0.05} h={0.14} c="#90a4ae" seg={8} />)}
      <Box m={m} at={[0, 0.17, 0.33]} s={[0.98, 0.04, 0.05]} c="#fdd835" shadow={false} />
      <Box m={m} at={[0.6, 0.3, 0.1]} s={[0.22, 0.4, 0.2]} c="#37474f" />
      <mesh position={[0.6, 0.42, 0.205]}><boxGeometry args={[0.06, 0.06, 0.02]} />{bulb}</mesh>
      <group ref={press} position={[0, 0.92, 0]} userData={LIVE}>
        <Box m={m} at={[0, 0, 0]} s={[0.84, 0.08, 0.52]} c="#78909c" />
        {[-0.2, 0.2].map((x) => <Cyl key={x} m={m} at={[x, 0.1, 0]} r={0.03} h={0.2} c="#cfd8dc" seg={6} />)}
      </group>
      <group ref={car} position={[0, 0.17, 0]} userData={LIVE}>
        {/* A plain boxy wreck: it stays live for the squash, so it's kept to a few meshes. */}
        <Box m={m} at={[0, 0.1, 0]} s={[0.66, 0.14, 0.32]} c="#8d6e63" />
        <Box m={m} at={[-0.04, 0.22, 0]} s={[0.36, 0.12, 0.28]} c="#6d8a99" />
        {[-0.22, 0.22].map((x) => <Cyl key={x} m={m} at={[x, 0.05, 0]} r={0.06} h={0.34} c="#263238" seg={8} rot={[Math.PI / 2, 0, 0]} />)}
      </group>
    </group>
  )
}

function Junkyard({ m, win, bulb, ghost, lvl, lift }: EdgeProps) {
  const stack = 3 + Math.min(5, Math.floor(lvl / 2))
  const archH = 1.25 + lift * 0.3
  // Fence panels: corrugated, mismatched, round the back and sides. They
  // overlap a little, so every other one stands a clear step further in (no
  // two overlapping faces in one plane: see coplanar.test.tsx).
  const panels: [number, number, boolean][] = []
  const step = (n: number) => (n % 2) * 0.008
  let n = 0
  for (let x = -1.72; x <= 1.75; x += 0.31) panels.push([x, -1.88 + step(n++), false])
  for (let z = -1.57; z <= 1.0; z += 0.31) {
    panels.push([-1.88 + step(n), z, true], [1.88 - step(n), z, true])
    n++
  }
  return (
    <group>
      {/* Packed dirt yard with a concrete drive from the gate to the crusher. */}
      <Box m={m} at={[0, 0.025, 0]} s={[3.9, 0.05, 3.9]} c="#ffffff" t={soilTex(4, 4)} shadow={false} />
      <Box m={m} at={[0.15, 0.055, 1.15]} s={[1.05, 0.02, 1.5]} c="#ffffff" t={concreteTex(1, 2)} shadow={false} />
      {!ghost && [[-0.4, -0.2, 0.3], [0.9, 0.4, 0.22], [-1.0, 0.9, 0.18], [0.3, -1.2, 0.25]].map(([x, z, r], i) => (
        <Patch key={i} at={[x, 0.058, z]} r={r} c="#000000" opacity={0.22} sx={1.4} />
      ))}
      {panels.map(([x, z, side], i) => (
        <Box key={i} m={m} at={[x, 0.31 + (i % 3) * 0.02, z]} s={side ? [0.03, 0.62 + (i % 2) * 0.05, 0.32] : [0.32, 0.62 + (i % 2) * 0.05, 0.03]}
          c={['#90a4ae', '#a1887f', '#78909c', '#b0855f', '#8d9a8e'][i % 5]} t={corrugatedTex(1, 1)} />
      ))}
      {/* Posts a touch outside the fence line, so a merged yard's never sit flush with a panel. */}
      {[-1.89, 1.89].map((x) => [-1.89, -0.6, 0.65].map((z) => <Box key={`${x}${z}`} m={m} at={[x, 0.36, z]} s={[0.06, 0.72, 0.06]} c="#546e7a" />))}
      {/* Chain-link front with barbed wire on top, either side of the gate. */}
      {[[-1.88, -0.48], [0.78, 1.88]].map(([a, b]) => (
        <group key={a}>
          {Array.from({ length: Math.round((b - a) / 0.45) + 1 }, (_, i) => a + ((b - a) * i) / Math.round((b - a) / 0.45)).map((x) => (
            <Cyl key={x} m={m} at={[x, 0.42, 1.9]} r={0.016} h={0.84} c="#78909c" seg={5} />
          ))}
          {[0.1, 0.4, 0.7, 0.84].map((y) => <Box key={y} m={m} at={[(a + b) / 2, y, 1.9]} s={[b - a, y === 0.84 ? 0.02 : 0.008, 0.008]} c={y === 0.84 ? '#5d6d74' : '#90a4ae'} shadow={false} />)}
          {!ghost && Array.from({ length: Math.round((b - a) / 0.12) }, (_, i) => (
            <Box key={i} m={m} at={[a + 0.06 + i * 0.12, 0.88, 1.9]} s={[0.04, 0.04, 0.005]} c="#78909c" rot={[0, 0, 0.785]} shadow={false} />
          ))}
        </group>
      ))}
      {/* Gate arch with the JUNKYARD sign; one gate leaf swung open. */}
      <group position={[0.15, 0, 1.9]}>
        {[-0.62, 0.62].map((x) => <Box key={x} m={m} at={[x, archH / 2, 0]} s={[0.09, archH, 0.09]} c="#37474f" />)}
        {/* The board spans the posts, so it stretches with them on a merged pair. */}
        <Box m={m} at={[0, archH + 0.1, 0]} s={[1.38, 0.32, 0.06]} c={lvl >= 9 && !ghost ? GOLD : '#212121'} stretch />
        {!ghost && <Sign text="JUNKYARD" w={1.2} at={[0, archH + 0.1, 0.035]} bg="#ffb300" fg="#212121" />}
        {/* A big horseshoe magnet on top of the arch. */}
        <group position={[0, archH + 0.42, 0]}>
          <mesh rotation-z={Math.PI} castShadow><torusGeometry args={[0.13, 0.05, 8, 14, Math.PI]} />{m('#c62828')}</mesh>
          {[-0.13, 0.13].map((x) => <Box key={x} m={m} at={[x, 0.04, 0]} s={[0.1, 0.08, 0.1]} c="#cfd8dc" />)}
        </group>
        {!ghost && lvl >= 5 && <Bulbs from={[-0.62, archH - 0.08, 0.06]} to={[0.62, archH - 0.08, 0.06]} n={9} sag={0.02} />}
        {!ghost && lvl >= 8 && <Flag at={[0.55, archH + 0.26, 0]} color="#ffb300" star={lvl >= 10} tall={0.55} />}
        <group position={[0.6, 0, 0]} rotation-y={-1.2}>
          <Box m={m} at={[-0.28, 0.4, 0]} s={[0.56, 0.7, 0.02]} c="#78909c" t={corrugatedTex(2, 2)} />
        </group>
      </group>
      {/* Site office: an old trailer on blocks, guard dog and his kennel. */}
      <group position={[-1.3, 0, 1.15]}>
        <Box m={m} at={[0, 0.06, 0]} s={[0.84, 0.12, 0.5]} c="#9e9e9e" t={brickTex(2, 1)} />
        <Box m={m} at={[0, 0.38, 0]} s={[0.9, 0.52, 0.56]} c="#d7ccc8" t={corrugatedTex(3, 1)} />
        <Box m={m} at={[0, 0.66, 0]} s={[0.94, 0.04, 0.6]} c="#795548" />
        <mesh position={[-0.2, 0.42, 0.282]}><planeGeometry args={[0.3, 0.2]} />{win}</mesh>
        <mesh position={[0.24, 0.32, 0.282]}><planeGeometry args={[0.16, 0.34]} />{m('#5d4037')}</mesh>
        <Box m={m} at={[0.24, 0.07, 0.36]} s={[0.24, 0.04, 0.14]} c="#8d6e63" />
        {!ghost && <Sign text="OFFICE" w={0.36} at={[-0.2, 0.6, 0.285]} bg="#fafafa" fg="#c62828" />}
        <mesh position={[0.24, 0.55, 0.3]}><boxGeometry args={[0.06, 0.05, 0.04]} />{bulb}</mesh>
        <Box m={m} at={[-0.48, 0.42, 0]} s={[0.08, 0.14, 0.2]} c="#b0bec5" />
        {!ghost && (
          <group position={[0.15, 0, -0.55]}>
            <Box m={m} at={[0, 0.11, 0]} s={[0.24, 0.22, 0.26]} c="#8d6e63" />
            <mesh position={[0, 0.27, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.2, 0.12, 4]} />{m('#c62828')}</mesh>
            <mesh position={[0, 0.1, 0.134]}><planeGeometry args={[0.1, 0.14]} />{m('#212121')}</mesh>
            <group position={[0.02, 0, 0.26]}>
              <mesh position={[0, 0.09, 0]} scale={[0.7, 0.6, 1.3]} castShadow><sphereGeometry args={[0.07, 8, 6]} />{m('#4e342e')}</mesh>
              <Ball m={m} at={[0, 0.14, 0.09]} r={0.045} c="#4e342e" />
              <Box m={m} at={[0, 0.13, 0.135]} s={[0.04, 0.03, 0.04]} c="#3e2723" shadow={false} />
            </group>
          </group>
        )}
      </group>
      {!ghost && (
        <group>
          {/* Crushed-car stacks along the back fence, taller every other level. */}
          {[-1.4, -0.65].map((x, k) => (
            <group key={x}>
              {Array.from({ length: stack - k }, (_, i) => (
                <Slab key={i} m={m} at={[x + ((i * 37) % 5) * 0.012, 0.115 + i * 0.135, -1.55 + (i % 2) * 0.04]} c={WRECK[(i + k * 3) % WRECK.length]} rot={(i % 3) * 0.1 - 0.08} />
              ))}
            </group>
          ))}
          {/* Rows of wrecks waiting, one stacked on another. */}
          <group position={[-1.3, 0.05, -0.7]} rotation-y={Math.PI / 2}>
            <Upright>
              <group scale={0.5}><CarModel body="classic" color="#5d8aa8" rusty /></group>
              {/* Stacked in the same piece, so a merged yard keeps it on the roof below. */}
              {lvl >= 6 && <group position={[0, 0.32, -0.02]} rotation-y={-0.12} scale={0.5}><CarModel body="compact" color="#9b5145" rusty /></group>}
            </Upright>
          </group>
          <group position={[-1.3, 0.05, 0.05]} rotation-y={Math.PI / 2 + 0.15}>
            <Upright><group scale={0.5}><CarModel body="truck" color="#8d6e63" rusty /></group></Upright>
          </group>
          {/* Tyre piles, drums, engine blocks and a heap of scrap. */}
          <Tyres m={m} at={[1.55, 0, -1.5]} n={4 + Math.min(4, Math.floor(lvl / 3))} />
          <Tyres m={m} at={[1.3, 0, -1.55]} n={3} />
          <Tyres m={m} at={[1.55, 0, -1.25]} n={2} />
          <Drum m={m} at={[1.6, 0.05, 0.85]} c="#1e88e5" />
          <Drum m={m} at={[1.42, 0.05, 0.95]} c="#e53935" />
          <Drum m={m} at={[1.5, 0.14, 1.25]} c="#43a047" tipped />
          {[[0.05, -1.45, '#607d8b'], [0.3, -1.5, '#546e7a'], [0.18, -1.3, '#78909c']].map(([x, z, c]) => (
            <group key={c as string} position={[x as number, 0.05, z as number]}>
              <Box m={m} at={[0, 0.08, 0]} s={[0.2, 0.15, 0.14]} c={c as string} />
              <Box m={m} at={[0, 0.18, 0]} s={[0.15, 0.05, 0.1]} c="#455a64" />
            </group>
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <Box key={i} m={m} at={[0.75 + ((i * 29) % 7) * 0.06, 0.06 + (i % 4) * 0.05, -1.45 + ((i * 17) % 5) * 0.06]} s={[0.18, 0.03, 0.12]}
              c={['#8d6e63', '#90a4ae', '#a35d3a', '#6a7f99'][i % 4]} rot={[i * 0.4, i * 0.9, i * 0.3]} />
          ))}
          {/* Parts pallet by the office: what the yard pays out. */}
          <group position={[-0.55, 0.05, 1.45]}>
            <Box m={m} at={[0, 0.03, 0]} s={[0.36, 0.05, 0.3]} c="#a1887f" />
            {[-0.09, 0.09].map((x) => <Box key={x} m={m} at={[x, 0.12, 0]} s={[0.16, 0.13, 0.26]} c="#1565c0" />)}
            <mesh position={[0, 0.24, 0]} rotation-x={Math.PI / 2} castShadow><torusGeometry args={[0.06, 0.02, 6, 8]} />{m('#b0bec5')}</mesh>
          </group>
          <Crane m={m} at={[0.75, 0.05, -0.55]} />
          <group position={[1.1, 0.05, 0.6]} scale={0.72}><Crusher m={m} at={[0, 0, 0]} bulb={bulb} /></group>
          {/* Floodlights for the night shift. */}
          {[[-0.4, -1.75], [1.7, 1.6]].map(([x, z]) => (
            <group key={x} position={[x, 0, z]}>
              <group>
                <Cyl m={m} at={[0, 0.85, 0]} r={0.025} h={1.7} c="#78909c" seg={6} />
                <mesh position={[0, 1.72, 0]} rotation-y={Math.atan2(-x, -z)}><boxGeometry args={[0.24, 0.12, 0.05]} />{bulb}</mesh>
              </group>
              <Pool r={1.0} x={-x * 0.35} z={-z * 0.35} y={0.08} />
            </group>
          ))}
          <Pool r={0.5} x={-1.06} z={1.5} y={0.08} />
        </group>
      )}
    </group>
  )
}

export function TrailerJunkModel(p: EdgeProps & { id: string }) {
  return p.id === 'junkyard' ? <Junkyard {...p} /> : <TrailerHome {...p} />
}
