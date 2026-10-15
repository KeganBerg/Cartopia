import type { ReactNode } from 'react'
import { levelLift } from '../game/data'
import { growthStage } from '../game/growth'
import { Box, Cyl, Sign, Pool, Flag, ShellBuilding, GOLD, SNOW, type Mat, type V3, type NewModelProps } from './NewBuildings'
import { Facade, Upright } from './mergeScale'
import { PAL } from './season'
import { PEOPLE_SIZED } from './keepShape'
import { asphaltTex, awningTex, corrugatedTex, grassTex, paverTex, shutterTex } from './textures'

// Town services from the third wave of buildings (laundromat, vet, post office,
// library, bus depot, city hall). Plain static meshes in the town's shared
// colours, so Batch merges them. Lots face +z (the front door side). Each grows
// floors with ShellBuilding and takes a new form at level 4 and level 7 (names
// in src/game/growth.ts).

export const SERVICE_MODELS = new Set(['laundry', 'vet', 'postoffice', 'library', 'busdepot', 'cityhall'])

type Kit = { m: Mat; win: ReactNode; bulb: ReactNode; ghost?: boolean; lvl: number }

// Bubbles and the like, meant to hang in the air (see floating.ts).
const AIR = { air: true }
const roofSnow = (c: string) => (SNOW ? '#f4f8fb' : c)
const STONE = '#f5f1e8'
const STEP = '#e0ddd5'

// ---- Small lot pieces ----

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
function Lamp({ m, bulb, at, ghost, twin }: { m: Mat; bulb: ReactNode; at: V3; ghost?: boolean; twin?: boolean }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.5, 0]} r={0.025} r2={0.035} h={1} c="#263238" seg={6} />
      {twin ? (
        <group>
          <Box m={m} at={[0, 0.98, 0]} s={[0.3, 0.025, 0.025]} c="#263238" shadow={false} />
          {[-0.14, 0.14].map((x) => <mesh key={x} position={[x, 1.04, 0]}><sphereGeometry args={[0.06, 8, 6]} />{bulb}</mesh>)}
        </group>
      ) : (
        <mesh position={[0, 1.04, 0]}><sphereGeometry args={[0.07, 8, 6]} />{bulb}</mesh>
      )}
      {!ghost && <Pool r={0.5} />}
    </group>
  )
}

function Bench({ m, at, rot = 0, c = '#8d6e63' }: { m: Mat; at: V3; rot?: number; c?: string }) {
  return (
    <group position={at} rotation-y={rot}>
      <Box m={m} at={[0, 0.16, 0]} s={[0.46, 0.035, 0.14]} c={c} />
      <Box m={m} at={[0, 0.27, -0.07]} s={[0.46, 0.12, 0.025]} c={c} />
      {[-0.19, 0.19].map((x) => <Box key={x} m={m} at={[x, 0.08, 0]} s={[0.03, 0.16, 0.12]} c="#37474f" shadow={false} />)}
    </group>
  )
}

// A flat painted mark on the ground (y is its height).
function Paint({ m, at, s, c = '#fafafa', rot = 0 }: { m: Mat; at: V3; s: [number, number]; c?: string; rot?: number }) {
  return (
    <mesh position={at} rotation={[-Math.PI / 2, 0, rot]}>
      <planeGeometry args={s} />
      {m(c)}
    </mesh>
  )
}

function Planter({ m, at, w = 0.34 }: { m: Mat; at: V3; w?: number }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.08, 0]} s={[w, 0.16, 0.18]} c="#a1887f" />
      <Box m={m} at={[0, 0.2, 0]} s={[w - 0.06, 0.1, 0.12]} c={PAL.bush[0]} />
      {[-w / 4, w / 4].map((x, i) => <mesh key={x} position={[x, 0.27, 0]}><sphereGeometry args={[0.045, 6, 5]} />{m(i ? '#f06292' : '#fff176')}</mesh>)}
    </group>
  )
}

// A blue mail drop box: legs, a box with a rounded top and a slot.
function Mailbox({ m, at, rot = 0 }: { m: Mat; at: V3; rot?: number }) {
  return (
    <group position={at} rotation-y={rot} userData={PEOPLE_SIZED}>
      {[-0.07, 0.07].map((x) => <Box key={x} m={m} at={[x, 0.05, 0]} s={[0.03, 0.1, 0.12]} c="#0d47a1" shadow={false} />)}
      <Box m={m} at={[0, 0.2, 0]} s={[0.2, 0.2, 0.16]} c="#1565c0" />
      <Cyl m={m} at={[0, 0.3, 0]} r={0.08} h={0.2} c="#1565c0" seg={12} rot={[0, 0, Math.PI / 2]} />
      <Box m={m} at={[0, 0.27, 0.09]} s={[0.12, 0.02, 0.01]} c="#263238" shadow={false} />
      <Box m={m} at={[0, 0.19, 0.09]} s={[0.1, 0.06, 0.01]} c="#fafafa" shadow={false} />
    </group>
  )
}

// A delivery van, long along z, nose at +z. Van-sized however big the block.
function Van({ m, at, rot = 0, body = '#fafafa', stripe = '#1565c0', band = '#c62828' }: { m: Mat; at: V3; rot?: number; body?: string; stripe?: string; band?: string }) {
  return (
    <group position={at}>
      <Upright size={1}>
        <group rotation-y={rot}>
          <Box m={m} at={[0, 0.26, -0.06]} s={[0.38, 0.36, 0.6]} c={body} />
          <Box m={m} at={[0, 0.18, 0.32]} s={[0.36, 0.2, 0.16]} c={body} />
          <Box m={m} at={[0, 0.35, 0.25]} s={[0.32, 0.12, 0.01]} c="#263238" shadow={false} />
          <Box m={m} at={[0, 0.25, -0.06]} s={[0.41, 0.05, 0.56]} c={stripe} shadow={false} />
          <Box m={m} at={[0, 0.19, -0.06]} s={[0.41, 0.025, 0.56]} c={band} shadow={false} />
          {[-0.12, 0.12].map((x) => <Box key={x} m={m} at={[x, 0.2, 0.41]} s={[0.07, 0.04, 0.01]} c="#fff9c4" shadow={false} />)}
          {[[-0.19, 0.24], [0.19, 0.24], [-0.19, -0.24], [0.19, -0.24]].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.075, z]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.075, 0.075, 0.05, 10]} />
              {m('#212121')}
            </mesh>
          ))}
        </group>
      </Upright>
    </group>
  )
}

// A yellow-and-white city bus, long along z, nose at +z.
function CityBus({ m, at, rot = 0 }: { m: Mat; at: V3; rot?: number }) {
  return (
    <group position={at}>
      <Upright size={1}>
        <group rotation-y={rot}>
          <Box m={m} at={[0, 0.2, 0]} s={[0.44, 0.24, 1.3]} c="#f9a825" />
          <Box m={m} at={[0, 0.42, 0]} s={[0.44, 0.2, 1.3]} c="#fafafa" />
          <Box m={m} at={[0, 0.42, -0.06]} s={[0.47, 0.12, 1.08]} c="#263238" shadow={false} />
          <Box m={m} at={[0, 0.55, -0.1]} s={[0.3, 0.06, 0.5]} c="#cfd8dc" />
          <Box m={m} at={[0, 0.36, 0.66]} s={[0.38, 0.18, 0.01]} c="#263238" shadow={false} />
          <Box m={m} at={[0, 0.49, 0.66]} s={[0.26, 0.05, 0.012]} c="#ffb300" shadow={false} />
          <Box m={m} at={[0, 0.1, 0.665]} s={[0.48, 0.05, 0.03]} c="#37474f" shadow={false} />
          {[-0.14, 0.14].map((x) => <Box key={x} m={m} at={[x, 0.18, 0.66]} s={[0.07, 0.04, 0.01]} c="#fff9c4" shadow={false} />)}
          <Box m={m} at={[0.24, 0.3, 0.2]} s={[0.02, 0.4, 0.2]} c="#37474f" shadow={false} />
          {[0.42, -0.42].map((z) => (
            <mesh key={z} position={[0, 0.09, z]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.09, 0.09, 0.5, 10]} />
              {m('#212121')}
            </mesh>
          ))}
        </group>
      </Upright>
    </group>
  )
}

// Tall windows with round tops along a front, laid out in bays so a merged
// pair draws more of them. Leaves the middle (|x| < skip) for the entrance.
function ArchRow({ m, win, at, len, y, w = 0.28, h = 0.6, skip, step = 0.42, trim = STONE }: { m: Mat; win: ReactNode; at: V3; len: number; y: number; w?: number; h?: number; skip: number; step?: number; trim?: string }) {
  return (
    <Facade at={at} len={len}>
      {(L) => {
        const xs: number[] = []
        for (let x = skip + w / 2; x + w / 2 <= L / 2 - 0.12; x += step) xs.push(-x, x)
        return xs.map((x) => (
          <group key={x} position={[x, y, 0]}>
            <mesh position={[0, 0, 0.006]}><planeGeometry args={[w, h]} />{win}</mesh>
            <mesh position={[0, h / 2, 0.006]}><circleGeometry args={[w / 2, 12, 0, Math.PI]} />{win}</mesh>
            <Box m={m} at={[0, -h / 2 - 0.02, 0.03]} s={[w + 0.08, 0.04, 0.06]} c={trim} shadow={false} />
            <Box m={m} at={[0, h / 2 + w / 2 + 0.02, 0.02]} s={[0.06, 0.07, 0.04]} c={trim} shadow={false} />
          </group>
        ))
      }}
    </Facade>
  )
}

// A classical entrance on a front at z: steps up to a row of columns, a lettered
// frieze and a pediment (with a clock in it, if asked). True shape in a pair.
function Portico({ k, z, span, colH, n, sign, fg, signW, clock, stone = STONE, base = 0 }: { k: Kit; z: number; span: number; colH: number; n: number; sign: string; fg: string; signW: number; clock?: boolean; stone?: string; base?: number }) {
  const { m, win, bulb, ghost } = k
  const y0 = 0.18
  const yE = y0 + colH
  const eh = signW / 4 + 0.08
  const ph = 0.3
  const sc = ph / 0.36
  const W = span + 0.3
  return (
    <Upright>
      <group position={[0, base, 0]}>
        {[0, 1, 2].map((i) => {
          const top = y0 - 0.06 * i
          const bot = 0.004 * i
          const zb = z - 0.03 - 0.01 * i
          const zfr = z + 0.4 + 0.1 * i
          return <Box key={i} m={m} at={[0, (top + bot) / 2, (zb + zfr) / 2]} s={[W + 0.12 * i, top - bot, zfr - zb]} c={STEP} shadow={false} />
        })}
        {Array.from({ length: n }, (_, i) => {
          const x = -span / 2 + (span * i) / (n - 1)
          return (
            <group key={i}>
              <Cyl m={m} at={[x, y0 + colH / 2, z + 0.3]} r={0.055} r2={0.065} h={colH} c={stone} seg={10} />
              <Box m={m} at={[x, yE - 0.025, z + 0.3]} s={[0.16, 0.05, 0.16]} c={stone} shadow={false} />
            </group>
          )
        })}
        <Box m={m} at={[0, yE + eh / 2, z + 0.19]} s={[W, eh, 0.42]} c={stone} />
        {!ghost && <Sign text={sign} w={signW} at={[0, yE + eh / 2, z + 0.404]} bg={stone} fg={fg} />}
        <mesh position={[0, yE + eh + 0.12 * sc, z + 0.19]} rotation={[-Math.PI / 2, 0, 0]} scale={[(W + 0.1) / 0.416, 1, sc]} castShadow>
          <cylinderGeometry args={[0.24, 0.24, 0.4, 3]} />
          {m(stone)}
        </mesh>
        {clock && (
          <group position={[0, yE + eh + ph * 0.36, z + 0.396]}>
            <mesh><circleGeometry args={[0.09, 16]} />{bulb}</mesh>
            <Box m={m} at={[0, 0.025, 0.006]} s={[0.014, 0.06, 0.006]} c="#212121" shadow={false} />
            <Box m={m} at={[0.02, 0, 0.006]} s={[0.05, 0.012, 0.006]} c="#212121" shadow={false} />
          </group>
        )}
        {/* The doors: panelled wood under a lit fanlight, a lantern either side. */}
        <mesh position={[0, y0 + 0.34, z + 0.006]}><planeGeometry args={[0.4, 0.68]} />{m('#5d4037')}</mesh>
        <Box m={m} at={[0, y0 + 0.34, z + 0.012]} s={[0.012, 0.66, 0.006]} c="#3e2723" shadow={false} />
        <mesh position={[0, y0 + 0.68, z + 0.006]}><circleGeometry args={[0.2, 12, 0, Math.PI]} />{win}</mesh>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.32, y0 + 0.5, z + 0.05]}><boxGeometry args={[0.07, 0.1, 0.07]} />{bulb}</mesh>)}
      </group>
    </Upright>
  )
}

// ---- Laundromat ----

function Laundry({ k, def, lvl }: { k: Kit; def: NewModelProps['def']; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const st = growthStage(lvl)
  const w = 1.7, d = 1.25, z0 = -0.3, zf = z0 + d / 2, h0 = 1.3
  const h = h0 + levelLift(lvl)
  const teal = def.roof
  const live = !ghost
  // The basket sits on the lower roof; the tower takes its corner at level 7,
  // so it moves back behind the sign, clear of the flag.
  const basket: V3 = st === 3 ? [-0.5, h + 0.13, -0.42] : [0.42, h + 0.13, -0.58]
  return (
    <group>
      <Box m={m} at={[0, 0.03, 0.66]} s={[1.8, 0.05, 0.62]} c="#ffffff" t={paverTex(2, 1)} shadow={false} />
      <ShellBuilding {...k} w={w} d={d} h0={h0} z0={z0} wall={st > 1 ? '#80deea' : def.color} tex={st > 1 ? 'brick' : 'siding'} roof={teal} sign={def.sign} signBg="#ffffff" signFg={teal} shopfront={null}>
        {/* Glass front with rows of washers, dryers stacked on top. */}
        <Facade at={[-0.2, 0, zf]} len={1.1}>
          {(L) => {
            const n = Math.max(2, Math.floor(L / 0.36))
            const sp = L / n
            const glass = (
              <group key="glass">
                <mesh position={[0, 0.5, 0.005]}><planeGeometry args={[L + 0.05, 0.72]} />{win}</mesh>
                <Box m={m} at={[0, 0.08, 0.015]} s={[L + 0.15, 0.16, 0.03]} c="#eceff1" shadow={false} />
                <Box m={m} at={[0, 0.88, 0.015]} s={[L + 0.15, 0.04, 0.03]} c="#eceff1" shadow={false} />
              </group>
            )
            return [glass, ...Array.from({ length: n }, (_, i) => {
              const x = -L / 2 + sp * (i + 0.5)
              return (
                <group key={i} position={[x, 0, 0]}>
                  <mesh position={[0, 0.33, 0.009]}><planeGeometry args={[0.28, 0.26]} />{m('#fafafa')}</mesh>
                  <mesh position={[0, 0.32, 0.013]}><circleGeometry args={[0.095, 14]} />{m('#90a4ae')}</mesh>
                  <mesh position={[0, 0.32, 0.017]}><circleGeometry args={[0.07, 14]} />{m(i % 2 ? '#4fc3f7' : '#81d4fa')}</mesh>
                  <mesh position={[0, 0.63, 0.009]}><planeGeometry args={[0.28, 0.2]} />{m('#eceff1')}</mesh>
                  <mesh position={[0, 0.62, 0.013]}><circleGeometry args={[0.065, 12]} />{m('#ffcc80')}</mesh>
                  {i > 0 && <Box m={m} at={[-sp / 2, 0.5, 0.012]} s={[0.025, 0.72, 0.02]} c="#eceff1" shadow={false} />}
                </group>
              )
            })]
          }}
        </Facade>
        {/* Door with a push bar and a lit step. */}
        <group position={[0.6, 0, zf]}>
          <Box m={m} at={[0, 0.38, 0.01]} s={[0.42, 0.76, 0.02]} c="#eceff1" shadow={false} />
          <mesh position={[0, 0.36, 0.022]}><planeGeometry args={[0.32, 0.66]} />{m(teal)}</mesh>
          <mesh position={[0, 0.46, 0.026]}><planeGeometry args={[0.22, 0.34]} />{win}</mesh>
          <Box m={m} at={[0, 0.3, 0.032]} s={[0.24, 0.02, 0.014]} c="#cfd8dc" shadow={false} />
          <Box m={m} at={[0, 0.05, 0.1]} s={[0.5, 0.1, 0.2]} c="#cfd8dc" />
        </group>
        <Box m={m} at={[0, 1.02, zf + 0.15]} rot={[0.45, 0, 0]} s={[1.64, 0.03, 0.32]} c="#ffffff" t={awningTex(teal)} />
        <mesh position={[0.6, 0.84, zf + 0.05]}><boxGeometry args={[0.1, 0.08, 0.08]} />{bulb}</mesh>
        {/* Dryer vents on the side wall. */}
        {[-0.15, -0.45].map((z) => <Box key={z} m={m} at={[w / 2 + 0.03, 1.08, z]} s={[0.06, 0.08, 0.12]} c="#b0bec5" shadow={false} />)}
        {/* Clotheslines on the roof from level 4. */}
        {st === 2 && live && (
          <group position={[-0.35, h + 0.13, -0.35]}>
            {[-0.3, 0.3].map((x) => (
              <group key={x}>
                <Box m={m} at={[x, 0.3, 0]} s={[0.03, 0.6, 0.03]} c="#90a4ae" shadow={false} />
                <Box m={m} at={[x, 0.58, 0]} s={[0.03, 0.03, 0.2]} c="#90a4ae" shadow={false} />
              </group>
            ))}
            {[-0.06, 0.06].map((z) => <Box key={z} m={m} at={[0, 0.58, z]} s={[0.6, 0.01, 0.01]} c="#eceff1" shadow={false} />)}
            {([[-0.15, 0.06, '#f06292'], [0.05, 0.06, '#fff176'], [-0.05, -0.06, '#64b5f6'], [0.17, -0.06, '#81c784']] as const).map(([x, z, c]) => (
              <Box key={c} m={m} at={[x, 0.505, z]} s={[0.12, 0.14, 0.012]} c={c} shadow={false} />
            ))}
          </group>
        )}
      </ShellBuilding>
      {/* Laundry Tower: a setback block crowned with a giant washing machine. */}
      {st === 3 && (
        <group position={[0.3, h + 0.13, 0]}>
          <ShellBuilding {...k} lvl={1} w={1.0} d={0.7} h0={1.25} z0={-0.55} rowFrom={0.35} wall="#e0f7fa" tex="siding" roof={teal} shopfront={null} />
          <group position={[0, 1.38, -0.55]}>
            <Upright>
              <group>
                <Box m={m} at={[0, 0.28, 0]} s={[0.6, 0.56, 0.5]} c="#fafafa" />
                <Box m={m} at={[0, 0.5, 0.255]} s={[0.56, 0.08, 0.01]} c="#b0bec5" shadow={false} />
                {[-0.18, 0.18].map((x) => <Cyl key={x} m={m} at={[x, 0.5, 0.265]} r={0.025} h={0.02} c={x < 0 ? '#e53935' : '#43a047'} seg={8} rot={[Math.PI / 2, 0, 0]} />)}
                <Cyl m={m} at={[0, 0.24, 0.265]} r={0.19} h={0.03} c="#90a4ae" seg={18} rot={[Math.PI / 2, 0, 0]} />
                <Cyl m={m} at={[0, 0.24, 0.275]} r={0.15} h={0.03} c="#4fc3f7" seg={18} rot={[Math.PI / 2, 0, 0]} />
                {live && [[-0.12, 0.62, 0, 0.09], [0.08, 0.64, -0.08, 0.1], [0.2, 0.61, 0.08, 0.07]].map(([x, y, z, r]) => (
                  <mesh key={x} position={[x, y, z]}><sphereGeometry args={[r, 8, 6]} />{m('#e1f5fe')}</mesh>
                ))}
              </group>
            </Upright>
          </group>
        </group>
      )}
      {/* A giant laundry basket heaped with washing, soap bubbles drifting up. */}
      <group position={basket}>
        <Upright>
          <group>
            <Cyl m={m} at={[0, 0.15, 0]} r={0.26} r2={0.21} h={0.3} c="#d7a86e" seg={14} />
            {[[0.08, 0.232], [0.22, 0.255]].map(([y, r]) => <Cyl key={y} m={m} at={[0, y, 0]} r={r} h={0.03} c="#a1724a" seg={14} />)}
            <mesh position={[0, 0.28, 0]} rotation-y={0.3}><torusGeometry args={[0.24, 0.018, 5, 14, Math.PI]} />{m('#a1724a')}</mesh>
            {([[-0.08, 0.31, 0.03, 0.12, '#f06292'], [0.09, 0.32, -0.05, 0.11, '#fff176'], [0.03, 0.34, 0.1, 0.09, '#64b5f6']] as const).map(([x, y, z, r, c]) => (
              <mesh key={c} position={[x, y, z]} scale={[1, 0.65, 1]}><sphereGeometry args={[r, 10, 6]} />{m(c)}</mesh>
            ))}
            {live && (
              <group userData={AIR}>
                {[[-0.2, 0.55, 0.1, 0.07], [0.05, 0.7, -0.08, 0.09], [0.24, 0.58, 0.06, 0.06]].map(([x, y, z, r]) => (
                  <mesh key={x} position={[x, y, z]}><sphereGeometry args={[r, 8, 6]} />{m('#e1f5fe')}</mesh>
                ))}
              </group>
            )}
          </group>
        </Upright>
      </group>
      {/* Bench by the window, a rolling laundry cart by the door. */}
      {live && <Bench m={m} at={[-0.45, 0.055, 0.78]} c="#00838f" />}
      {live && (
        <group position={[0.84, 0.055, 0.66]} userData={PEOPLE_SIZED}>
          <Box m={m} at={[0, 0.16, 0]} s={[0.16, 0.16, 0.22]} c="#b0bec5" />
          <Box m={m} at={[0, 0.26, 0]} s={[0.13, 0.04, 0.18]} c="#f8bbd0" shadow={false} />
          <Box m={m} at={[0, 0.3, -0.12]} s={[0.16, 0.03, 0.02]} c="#78909c" shadow={false} />
          {[[-0.06, -0.08], [0.06, -0.08], [-0.06, 0.08], [0.06, 0.08]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.04, z]} s={[0.02, 0.08, 0.02]} c="#455a64" shadow={false} />)}
        </group>
      )}
      {live && <Pool r={0.7} x={0.1} z={0.8} />}
    </group>
  )
}

// ---- Vet ----

function DogBone({ m, at, s = 1, rot = 0.4 }: { m: Mat; at: V3; s?: number; rot?: number }) {
  return (
    <group position={at}>
      <Upright>
        <group rotation-y={rot} scale={s}>
          <Cyl m={m} at={[0, 0.08, 0]} r={0.055} h={0.46} c="#fff8e1" seg={10} rot={[0, 0, Math.PI / 2]} />
          {[[-0.24, -0.06], [-0.24, 0.06], [0.24, -0.06], [0.24, 0.06]].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.08, z]} castShadow><sphereGeometry args={[0.085, 10, 8]} />{m('#fff8e1')}</mesh>
          ))}
        </group>
      </Upright>
    </group>
  )
}

function Dog({ m, at, rot = 0, c = '#d7a86e' }: { m: Mat; at: V3; rot?: number; c?: string }) {
  return (
    <group position={at} rotation-y={rot} userData={PEOPLE_SIZED}>
      <Box m={m} at={[0, 0.11, 0]} s={[0.1, 0.08, 0.2]} c={c} />
      <Box m={m} at={[0, 0.18, 0.11]} s={[0.1, 0.09, 0.1]} c={c} />
      <Box m={m} at={[0, 0.16, 0.175]} s={[0.05, 0.04, 0.04]} c="#5d4037" shadow={false} />
      {[-0.05, 0.05].map((x) => <Box key={x} m={m} at={[x, 0.2, 0.09]} s={[0.02, 0.08, 0.05]} c="#5d4037" shadow={false} />)}
      {[[-0.035, -0.07], [0.035, -0.07], [-0.035, 0.07], [0.035, 0.07]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.035, z]} s={[0.025, 0.07, 0.025]} c={c} shadow={false} />)}
      <Box m={m} at={[0, 0.17, -0.12]} rot={[0.7, 0, 0]} s={[0.02, 0.09, 0.02]} c={c} shadow={false} />
    </group>
  )
}

function Vet({ k, def, lvl }: { k: Kit; def: NewModelProps['def']; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const st = growthStage(lvl)
  const live = !ghost
  const w = 1.4, d = 1.2, x0 = -0.22, z0 = -0.3, zf = z0 + d / 2, h0 = 1.2
  const h = h0 + levelLift(lvl) * (st === 1 ? 0.5 : 1)
  const green = def.roof
  return (
    <group>
      {/* Front path and the fenced dog run along the side. */}
      <Box m={m} at={[x0, 0.03, 0.62]} s={[1.42, 0.05, 0.62]} c="#ffffff" t={paverTex(2, 1)} shadow={false} />
      <Box m={m} at={[0.705, 0.03, -0.05]} s={[0.39, 0.05, 1.7]} c="#ffffff" t={grassTex(1, 2)} shadow={false} />
      <group>
        {[-0.86, -0.44, 0, 0.4, 0.76].map((z) => <Box key={z} m={m} at={[0.89, 0.2, z]} s={[0.04, 0.3, 0.04]} c="#fafafa" />)}
        {[0.54, 0.715].map((x) => <Box key={x} m={m} at={[x, 0.2, 0.76]} s={[0.04, 0.3, 0.04]} c="#fafafa" />)}
        {[0.13, 0.27].map((y) => (
          <group key={y}>
            <Box m={m} at={[0.89, y, -0.05]} s={[0.025, 0.035, 1.62]} c="#fafafa" shadow={false} />
            <Box m={m} at={[0.715, y, 0.76]} s={[0.35, 0.035, 0.025]} c="#fafafa" shadow={false} />
          </group>
        ))}
      </group>
      {/* Doghouse, a dog, a ball and a hydrant in the run. */}
      <group position={[0.7, 0.055, -0.62]}>
        <Box m={m} at={[0, 0.12, 0]} s={[0.3, 0.24, 0.32]} c="#ef5350" />
        {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.085, 0.3, 0]} rot={[0, 0, -sd * 0.65]} s={[0.22, 0.03, 0.38]} c="#5d4037" />)}
        <mesh position={[0, 0.1, 0.162]}><planeGeometry args={[0.12, 0.13]} />{m('#3e2723')}</mesh>
        <mesh position={[0, 0.165, 0.162]}><circleGeometry args={[0.06, 10, 0, Math.PI]} />{m('#3e2723')}</mesh>
      </group>
      {live && <Dog m={m} at={[0.7, 0.055, 0.05]} rot={0.4} />}
      {live && <mesh position={[0.8, 0.095, 0.48]}><sphereGeometry args={[0.04, 8, 6]} />{m('#e53935')}</mesh>}
      {live && (
        <group position={[0.8, 0.055, -0.2]}>
          <Cyl m={m} at={[0, 0.1, 0]} r={0.045} h={0.2} c="#fdd835" seg={8} />
          <mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.045, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />{m('#fdd835')}</mesh>
        </group>
      )}
      {/* Paw sign on a post by the gate. */}
      <group position={[-0.84, 0.055, 0.84]}>
        <Upright>
          <group>
            <Cyl m={m} at={[0, 0.33, 0]} r={0.022} h={0.66} c="#37474f" seg={6} />
            <Cyl m={m} at={[0, 0.78, 0]} r={0.2} h={0.04} c={green} seg={18} rot={[Math.PI / 2, 0, 0]} />
            <mesh position={[0, 0.75, 0.024]}><circleGeometry args={[0.07, 14]} />{m('#fafafa')}</mesh>
            {[[-0.085, 0.83], [-0.032, 0.87], [0.032, 0.87], [0.085, 0.83]].map(([x, y]) => (
              <mesh key={x} position={[x, y, 0.024]}><circleGeometry args={[0.03, 10]} />{m('#fafafa')}</mesh>
            ))}
          </group>
        </Upright>
      </group>
      <ShellBuilding {...k} w={w} d={d} h0={h0} x0={x0} z0={z0} wall={def.color} tex="siding" roof={green} sign={st > 1 ? def.sign : undefined} signBg="#ffffff" signFg={green} shopfront={null} grow={st === 1 ? 0.5 : 1}>
        {/* Window with a flower box, the VET board, a door under a green canopy. */}
        <mesh position={[-0.33, 0.5, zf + 0.005]}><planeGeometry args={[0.5, 0.42]} />{win}</mesh>
        <Box m={m} at={[-0.33, 0.5, zf + 0.012]} s={[0.02, 0.42, 0.012]} c="#fafafa" shadow={false} />
        <Box m={m} at={[-0.33, 0.25, zf + 0.05]} s={[0.56, 0.1, 0.1]} c="#8d6e63" />
        {[-0.52, -0.4, -0.27, -0.14].map((x, i) => <mesh key={x} position={[x, 0.33, zf + 0.05]}><sphereGeometry args={[0.04, 6, 5]} />{m(['#f06292', '#fff176', '#ba68c8', '#ff8a65'][i])}</mesh>)}
        <Box m={m} at={[-0.33, 0.92, zf + 0.02]} s={[0.64, 0.22, 0.04]} c={green} />
        {live && <Sign text={def.sign ?? 'VET'} w={0.56} at={[-0.33, 0.92, zf + 0.042]} bg="#ffffff" fg={green} />}
        <group position={[0.3, 0, zf]}>
          <Box m={m} at={[0, 0.36, 0.01]} s={[0.42, 0.72, 0.02]} c="#ffffff" shadow={false} />
          <mesh position={[0, 0.34, 0.022]}><planeGeometry args={[0.32, 0.64]} />{m('#2e7d32')}</mesh>
          <mesh position={[0, 0.44, 0.026]}><planeGeometry args={[0.2, 0.28]} />{win}</mesh>
          <Box m={m} at={[0, 0.05, 0.1]} s={[0.5, 0.1, 0.2]} c="#cfd8dc" />
        </group>
        <Box m={m} at={[0.3, 0.84, zf + 0.15]} rot={[0.4, 0, 0]} s={[0.6, 0.03, 0.3]} c={green} />
        {[0.0, 0.6].map((x) => <mesh key={x} position={[x, 0.62, zf + 0.04]}><boxGeometry args={[0.07, 0.09, 0.07]} />{bulb}</mesh>)}
        {/* Cottage clinic: a green hip roof with the bone on its flat top. */}
        {st === 1 && (
          <group>
            <group position={[0, h + 0.13, z0]} scale={[w + 0.12, 1, d + 0.12]}>
              <mesh position={[0, 0.2, 0]} rotation-y={Math.PI / 4} castShadow>
                <cylinderGeometry args={[0.24, 0.7071, 0.4, 4]} />
                {m(roofSnow(green))}
              </mesh>
            </group>
            <DogBone m={m} at={[0, h + 0.53, z0]} s={0.9} />
          </group>
        )}
        {/* Animal Hospital: a green cross lit on the front. */}
        {st === 3 && (
          <group position={[0, h - 0.5, zf + 0.012]}>
            <Box m={m} at={[0, 0, 0]} s={[0.3, 0.3, 0.02]} c="#fafafa" shadow={false} />
            <mesh position={[0, 0, 0.012]}><boxGeometry args={[0.22, 0.07, 0.006]} /><meshStandardMaterial color="#43a047" emissive="#43a047" emissiveIntensity={0.7} /></mesh>
            <mesh position={[0, 0, 0.0125]}><boxGeometry args={[0.07, 0.22, 0.005]} /><meshStandardMaterial color="#43a047" emissive="#43a047" emissiveIntensity={0.7} /></mesh>
          </group>
        )}
      </ShellBuilding>
      {st === 2 && <DogBone m={m} at={[x0 + 0.3, h + 0.13, -0.68]} s={1.3} />}
      {st === 3 && (
        <group position={[x0 + 0.15, h + 0.13, 0]}>
          <ShellBuilding {...k} lvl={1} w={0.95} d={0.7} h0={0.9} z0={-0.55} rowFrom={0.4} wall="#e8f5e9" tex="siding" roof={green} shopfront={null} />
          <DogBone m={m} at={[0, 1.03, -0.55]} s={1.3} />
        </group>
      )}
      {/* An animal ambulance out front once it's a hospital, a bench before that. */}
      {live && st === 3 ? (
        <Van m={m} at={[-0.5, 0.055, 0.66]} rot={Math.PI / 2} stripe={green} band="#fafafa" />
      ) : (
        live && <Bench m={m} at={[-0.4, 0.055, 0.78]} c={green} />
      )}
      {live && <Pool r={0.6} x={0.08} z={0.8} />}
    </group>
  )
}

// ---- Post office ----

function Envelope({ m, at }: { m: Mat; at: V3 }) {
  return (
    <group position={at}>
      <Upright>
        <group>
          {[-0.3, 0.3].map((x) => <Box key={x} m={m} at={[x, 0.2, -0.12]} s={[0.04, 0.4, 0.04]} c="#455a64" shadow={false} />)}
          <group position={[0, 0.02, 0]} rotation-x={-0.35}>
            <Box m={m} at={[0, 0.3, 0]} s={[0.9, 0.58, 0.05]} c="#fafafa" />
            {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.215, 0.43, 0.03]} rot={[0, 0, sd * 0.56]} s={[0.52, 0.025, 0.01]} c="#90a4ae" shadow={false} />)}
            <Box m={m} at={[0.3, 0.46, 0.03]} s={[0.17, 0.2, 0.01]} c="#c62828" shadow={false} />
            <Box m={m} at={[0.3, 0.46, 0.037]} s={[0.11, 0.14, 0.006]} c="#ffcdd2" shadow={false} />
            {[0.2, 0.14].map((y) => <Box key={y} m={m} at={[-0.08, y, 0.03]} s={[0.3, 0.025, 0.01]} c="#1565c0" shadow={false} />)}
          </group>
        </group>
      </Upright>
    </group>
  )
}

function PostOffice({ k, def, lvl }: { k: Kit; def: NewModelProps['def']; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const st = growthStage(lvl)
  const live = !ghost
  const w = 2.7, d = 1.2, x0 = -0.55, z0 = -0.3, zf = z0 + d / 2, h0 = 1.5, grow = 0.7
  const h = h0 + levelLift(lvl) * grow
  const blue = def.roof
  const vans = st === 1 ? [1.12] : [1.12, 1.64]
  return (
    <group>
      {/* Front plaza, and the yard where the vans load. */}
      <Box m={m} at={[x0, 0.03, 0.63]} s={[2.72, 0.05, 0.64]} c="#ffffff" t={paverTex(4, 1)} shadow={false} />
      <Box m={m} at={[1.37, 0.03, 0.01]} s={[1.06, 0.05, 1.86]} c="#ffffff" t={asphaltTex()} shadow={false} />
      {[0.86, 1.38, 1.9].map((x) => <Paint key={x} m={m} at={[x, 0.058, -0.05]} s={[0.03, 0.75]} />)}
      {/* The sorting shed: roller doors over a loading dock. */}
      <group position={[1.375, 0, -0.75]}>
        <Box m={m} at={[0, 0.42, 0]} s={[1.03, 0.84, 0.36]} c={def.color} t={corrugatedTex(3, 1)} />
        <Box m={m} at={[0, 0.88, 0]} s={[1.09, 0.08, 0.4]} c={roofSnow(blue)} />
        {[-0.26, 0.26].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.42, 0.183]}><planeGeometry args={[0.4, 0.5]} />{m('#ffffff', shutterTex())}</mesh>
            <mesh position={[x, 0.75, 0.2]}><boxGeometry args={[0.1, 0.05, 0.05]} />{bulb}</mesh>
          </group>
        ))}
        <Box m={m} at={[0, 0.08, 0.25]} s={[1.0, 0.16, 0.14]} c="#9e9e9e" />
        {st === 3 && live && (
          <group position={[0, 0.92, 0]}>
            {([[-0.25, 0, 0.2, '#d7a86e'], [-0.05, 0.03, 0.16, '#c8965a'], [0.2, -0.02, 0.22, '#d7a86e']] as const).map(([x, z, s, c]) => <Box key={x} m={m} at={[x, s / 2, z]} s={[s, s, s]} c={c} />)}
          </group>
        )}
      </group>
      {live && vans.map((x) => <Van key={x} m={m} at={[x, 0.055, -0.03]} />)}
      <ShellBuilding {...k} w={w} d={d} h0={h0} x0={x0} z0={z0} wall="#c47a5a" tex="brick" roof={blue} shopfront={null} grow={grow}>
        {/* Stone base, a blue band, tall arched windows either side of the portico. */}
        <Box m={m} at={[0, 0.08, z0]} s={[w + 0.03, 0.16, d + 0.03]} c={def.color} shadow={false} />
        <Box m={m} at={[0, 0.98, zf + 0.012]} s={[w + 0.02, 0.1, 0.024]} c={blue} shadow={false} />
        <ArchRow m={m} win={win} at={[0, 0, zf]} len={w} y={0.55} w={0.26} h={0.5} skip={0.72} step={0.36} trim={def.color} />
        <Portico k={k} z={zf} span={1.0} colH={0.95} n={4} sign={def.sign ?? 'POST OFFICE'} fg={blue} signW={0.92} clock={st > 1} />
      </ShellBuilding>
      {/* Sorting Hub: an upper block with a radio mast. */}
      {st === 3 && (
        <group position={[x0 - 0.2, h + 0.13, 0]}>
          <ShellBuilding {...k} lvl={1} w={1.6} d={0.7} h0={0.95} z0={-0.55} rowFrom={0.4} wall="#c47a5a" tex="brick" roof={blue} shopfront={null} />
          {live && (
            <group position={[-0.55, 1.08, -0.7]}>
              <Cyl m={m} at={[0, 0.4, 0]} r={0.02} h={0.8} c="#b0bec5" seg={6} />
              <mesh position={[0, 0.83, 0]}><sphereGeometry args={[0.04, 8, 6]} />{bulb}</mesh>
            </group>
          )}
        </group>
      )}
      {/* On the Sorting Hub it moves up onto the upper block's roof. */}
      <Envelope m={m} at={st === 3 ? [x0 + 0.1, h + 1.21, -0.45] : [x0 + 0.75, h + 0.13, -0.55]} />
      {/* Mailboxes, a flag, a lamp and planters along the front. */}
      {live && <Mailbox m={m} at={[0.3, 0.055, 0.8]} />}
      {live && st > 1 && <Mailbox m={m} at={[0.56, 0.055, 0.8]} />}
      {live && <Flag at={[-1.75, 0.055, 0.6]} color={blue} tall={1.5} star={lvl >= 10} />}
      {live && <Lamp m={m} bulb={bulb} ghost={ghost} at={[-1.42, 0.055, 0.82]} />}
      {live && <Planter m={m} at={[-1.05, 0.055, 0.82]} />}
      {live && <Pool r={0.7} x={x0} z={0.9} />}
    </group>
  )
}

// ---- Library ----

function Books({ m, at }: { m: Mat; at: V3 }) {
  const books: [number, number, number, string, number][] = [
    [0.72, 0.5, 0.12, '#c62828', 0], [0.66, 0.46, 0.1, '#1565c0', 0.18], [0.7, 0.48, 0.14, '#2e7d32', -0.12], [0.58, 0.42, 0.1, '#f9a825', 0.3],
  ]
  let y = 0
  return (
    <group position={at}>
      <Upright>
        <group>
          {books.map(([bw, bd, bh, c, r]) => {
            const yc = y + bh / 2
            y += bh
            return (
              <group key={c} position={[0, yc, 0]} rotation-y={r}>
                <Box m={m} at={[0, 0, 0]} s={[bw, bh, bd]} c={c} />
                <Box m={m} at={[0.02, 0, 0]} s={[bw - 0.06, bh - 0.03, bd + 0.012]} c="#fff8e1" shadow={false} />
              </group>
            )
          })}
          <Box m={m} at={[0.15, y - 0.09, 0.247]} s={[0.04, 0.16, 0.006]} rot={[0, 0.3, 0]} c="#c62828" shadow={false} />
        </group>
      </Upright>
    </group>
  )
}

function Dome({ k, at, r, drum, c, top, windows = 6, cols = 0, clocks = false }: { k: Kit; at: V3; r: number; drum: number; c: string; top: string; windows?: number; cols?: number; clocks?: boolean }) {
  const { m, win, bulb } = k
  return (
    <group position={at}>
      <Upright>
        <group>
          <Cyl m={m} at={[0, drum / 2, 0]} r={r} h={drum} c={c} seg={20} />
          {Array.from({ length: windows }, (_, i) => {
            const a = ((i + 0.5) / windows) * Math.PI * 2
            return <mesh key={i} position={[Math.sin(a) * (r + 0.006), drum * 0.5, Math.cos(a) * (r + 0.006)]} rotation-y={a}><planeGeometry args={[r * 0.24, drum * 0.55]} />{win}</mesh>
          })}
          {clocks && [0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2
            return (
              <group key={i} position={[Math.sin(a) * (r + 0.006), drum * 0.5, Math.cos(a) * (r + 0.006)]} rotation-y={a}>
                <mesh><circleGeometry args={[drum * 0.25, 16]} />{bulb}</mesh>
                <Box m={m} at={[0, drum * 0.08, 0.006]} s={[0.018, drum * 0.2, 0.006]} c="#212121" shadow={false} />
                <Box m={m} at={[drum * 0.07, 0, 0.006]} s={[drum * 0.16, 0.016, 0.006]} c="#212121" shadow={false} />
              </group>
            )
          })}
          {/* No column in front of a clock face. */}
          {Array.from({ length: cols }, (_, i) => i).filter((i) => !clocks || (i * 4) % cols !== 0).map((i) => {
            const a = (i / cols) * Math.PI * 2
            return <Cyl key={i} m={m} at={[Math.sin(a) * (r + 0.07), drum / 2, Math.cos(a) * (r + 0.07)]} r={0.035} h={drum} c={STONE} seg={8} />
          })}
          {cols > 0 && <Cyl m={m} at={[0, drum + 0.02, 0]} r={r + 0.12} h={0.04} c={STONE} seg={24} />}
          <Cyl m={m} at={[0, drum + 0.03, 0]} r={r + 0.05} h={0.06} c={STONE} seg={20} />
          <mesh position={[0, drum + 0.06, 0]} castShadow><sphereGeometry args={[r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />{m(SNOW ? '#f4f8fb' : top)}</mesh>
          <Cyl m={m} at={[0, drum + 0.06 + r + 0.07, 0]} r={r * 0.16} h={0.16} c={STONE} seg={8} />
          <mesh position={[0, drum + 0.06 + r + 0.2, 0]} castShadow><coneGeometry args={[r * 0.18, 0.18, 8]} />{m(GOLD)}</mesh>
        </group>
      </Upright>
    </group>
  )
}

function BookDrop({ m, at }: { m: Mat; at: V3 }) {
  return (
    <group position={at} userData={PEOPLE_SIZED}>
      <Box m={m} at={[0, 0.17, 0]} s={[0.24, 0.34, 0.2]} c="#4e342e" />
      <Box m={m} at={[0, 0.36, -0.01]} rot={[-0.3, 0, 0]} s={[0.26, 0.04, 0.24]} c="#3e2723" />
      <Box m={m} at={[0, 0.27, 0.103]} s={[0.15, 0.025, 0.008]} c="#212121" shadow={false} />
      <Box m={m} at={[0, 0.15, 0.103]} s={[0.12, 0.1, 0.008]} c="#ffcc80" shadow={false} />
    </group>
  )
}

function Library({ k, def, lvl }: { k: Kit; def: NewModelProps['def']; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const st = growthStage(lvl)
  const live = !ghost
  const w = 3.5, d = 1.15, z0 = -0.35, zf = z0 + d / 2, h0 = 1.55, grow = 0.6
  const h = h0 + levelLift(lvl) * grow
  const brown = def.roof
  return (
    <group>
      {/* Lawn with a stone walk up to the steps. */}
      <Box m={m} at={[0, 0.03, 0.6]} s={[3.8, 0.05, 0.72]} c="#ffffff" t={grassTex(4, 1)} shadow={false} />
      <Box m={m} at={[0, 0.04, 0.66]} s={[0.9, 0.05, 0.5]} c="#ffffff" t={paverTex(2, 1)} shadow={false} />
      <ShellBuilding {...k} w={w} d={d} h0={h0} z0={z0} wall={def.color} tex="brick" roof={brown} shopfront={null} grow={grow} rowFrom={1.5}>
        <Box m={m} at={[0, 0.08, z0]} s={[w + 0.03, 0.16, d + 0.03]} c="#a1887f" shadow={false} />
        <Box m={m} at={[0, 1.18, z0]} s={[w + 0.02, 0.06, d + 0.02]} c={STONE} shadow={false} />
        <ArchRow m={m} win={win} at={[0, 0, zf]} len={w} y={0.62} w={0.3} h={0.62} skip={0.72} step={0.42} />
        <Portico k={k} z={zf} span={0.8} colH={1.0} n={4} sign={def.sign ?? 'LIBRARY'} fg={brown} signW={0.84} clock={st === 3} />
      </ShellBuilding>
      <Books m={m} at={[1.0, h + 0.13, -0.6]} />
      {/* Library & Archive: a copper dome; the Grand Library gilds it and rings it with columns. */}
      {st > 1 && <Dome k={k} at={[-0.15, h + 0.13, -0.36]} r={0.42} drum={st === 3 ? 0.55 : 0.32} c={def.color} top={st === 3 ? GOLD : '#4db6ac'} cols={st === 3 ? 10 : 0} />}
      {/* Stone lions guard the steps of the Grand Library. */}
      {st === 3 && live && [-0.78, 0.78].map((x) => (
        <group key={x} position={[x, 0.055, 0.62]}>
          <Box m={m} at={[0, 0.1, 0]} s={[0.24, 0.2, 0.3]} c={STONE} />
          <Box m={m} at={[0, 0.27, -0.03]} s={[0.12, 0.14, 0.22]} c="#d7ccc8" />
          <mesh position={[0, 0.37, 0.08]}><sphereGeometry args={[0.08, 8, 6]} />{m('#d7ccc8')}</mesh>
        </group>
      ))}
      {/* Reading benches, trees, lamps and the book return. */}
      {live && [-1.05, 1.05].map((x) => <Bench key={x} m={m} at={[x, 0.055, 0.66]} c="#6d4c41" />)}
      {live && [-1.62, 1.62].map((x) => <Tree key={x} m={m} at={[x, 0.055, 0.62]} s={0.6} />)}
      {live && [-0.6, 0.6].map((x) => <Lamp key={x} m={m} bulb={bulb} ghost={ghost} at={[x, 0.055, 0.86]} />)}
      {live && <BookDrop m={m} at={[1.3, 0.055, 0.84]} />}
    </group>
  )
}

// ---- Bus depot ----

function Roundel({ m, at }: { m: Mat; at: V3 }) {
  return (
    <group position={at}>
      <Upright>
        <group>
          <Cyl m={m} at={[0, 0.3, 0]} r={0.03} h={0.6} c="#455a64" seg={6} />
          <Cyl m={m} at={[0, 0.85, 0]} r={0.36} h={0.05} c="#f9a825" seg={24} rot={[Math.PI / 2, 0, 0]} />
          <mesh position={[0, 0.85, 0.027]}><circleGeometry args={[0.28, 22]} />{m('#fafafa')}</mesh>
          <Box m={m} at={[0, 0.87, 0.033]} s={[0.34, 0.14, 0.008]} c="#f9a825" shadow={false} />
          <Box m={m} at={[0.02, 0.9, 0.04]} s={[0.24, 0.05, 0.006]} c="#263238" shadow={false} />
          {[-0.1, 0.1].map((x) => <mesh key={x} position={[x, 0.79, 0.04]}><circleGeometry args={[0.035, 10]} />{m('#212121')}</mesh>)}
        </group>
      </Upright>
    </group>
  )
}

function BusDepot({ k, def, lvl }: { k: Kit; def: NewModelProps['def']; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const st = growthStage(lvl)
  const live = !ghost
  const w = 3.6, d = 0.95, z0 = -1.4, zf = z0 + d / 2, h0 = 1.3, grow = 0.6
  const h = h0 + levelLift(lvl) * grow
  const yellow = def.roof
  const bays = [-1.35, -0.45, 0.45, 1.35]
  const parked = bays.slice(0, st === 1 ? 2 : st === 2 ? 3 : 4)
  const islands = [-0.9, 0, 0.9]
  return (
    <group>
      <Box m={m} at={[0, 0.03, 0]} s={[3.8, 0.06, 3.8]} c="#ffffff" t={asphaltTex()} shadow={false} />
      {/* Passenger platform along the terminal, under a long canopy. */}
      <Box m={m} at={[0, 0.11, -0.67]} s={[3.7, 0.1, 0.55]} c="#cfd8dc" shadow={false} />
      <Box m={m} at={[0, 0.17, -0.41]} s={[3.7, 0.02, 0.04]} c="#fdd835" shadow={false} />
      {[-1.5, -0.5, 0.5, 1.5].map((x) => <Cyl key={x} m={m} at={[x, 0.53, -0.5]} r={0.03} h={0.74} c="#546e7a" seg={6} />)}
      <Box m={m} at={[0, 0.92, -0.69]} s={[3.7, 0.05, 0.5]} c={roofSnow(yellow)} />
      {live && [-1.0, 1.0].map((x) => <Bench key={x} m={m} at={[x, 0.16, -0.75]} c="#546e7a" />)}
      {/* Bus bays: painted lanes between islands, each island with a canopy. */}
      {bays.map((x) => <Paint key={x} m={m} at={[x, 0.064, 1.05]} s={[0.4, 0.04]} c="#fdd835" />)}
      {islands.map((x) => (
        <group key={x}>
          <Box m={m} at={[x, 0.09, 0.25]} s={[0.22, 0.06, 1.26]} c="#b0bec5" shadow={false} />
          {[-0.2, 0.7].map((z) => <Box key={z} m={m} at={[x, 0.51, z]} s={[0.05, 0.78, 0.05]} c="#546e7a" />)}
          <Box m={m} at={[x, 0.92, 0.25]} s={[0.24, 0.04, 1.2]} c={roofSnow(yellow)} />
          <mesh position={[x, 0.885, 0.25]}><boxGeometry args={[0.06, 0.03, 1.0]} />{bulb}</mesh>
        </group>
      ))}
      {live && parked.map((x) => <CityBus key={x} m={m} at={[x, 0.06, 0.27]} rot={Math.PI} />)}
      {/* Front: the way in and out, with arrows, and a waiting plaza with the timetable. */}
      {[0.5, 1.4].map((x, i) => (
        <group key={x}>
          <Paint m={m} at={[x, 0.064, 1.55]} s={[0.08, 0.36]} />
          <mesh position={[x, 0.064, 1.3 + (i ? 0.5 : 0)]} rotation={[-Math.PI / 2, 0, i ? Math.PI : 0]}><circleGeometry args={[0.12, 3]} />{m('#fafafa')}</mesh>
        </group>
      ))}
      <Box m={m} at={[-1.25, 0.08, 1.45]} s={[1.26, 0.05, 0.86]} c="#ffffff" t={paverTex(2, 2)} shadow={false} />
      <group position={[-1.25, 0.105, 1.2]}>
        {[-0.42, 0.42].map((x) => <Box key={x} m={m} at={[x, 0.4, 0]} s={[0.05, 0.8, 0.05]} c="#37474f" />)}
        <Box m={m} at={[0, 0.66, -0.01]} s={[0.84, 0.34, 0.04]} c="#263238" />
        {live && <Sign text="DEPARTURES" w={0.76} at={[0, 0.72, 0.012]} bg="#263238" fg="#ffb300" />}
        {[0.56, 0.52].map((y, i) => <Box key={y} m={m} at={[0, y, 0.014]} s={[0.7, 0.02, 0.006]} c={i ? '#4fc3f7' : '#81c784'} shadow={false} />)}
      </group>
      {live && <Bench m={m} at={[-1.5, 0.105, 1.6]} c="#f9a825" />}
      {live && <Bench m={m} at={[-0.95, 0.105, 1.6]} c="#f9a825" />}
      {live && <Tree m={m} at={[-1.7, 0.06, 0.95]} s={0.55} />}
      {live && <Lamp m={m} bulb={bulb} ghost={ghost} at={[-0.65, 0.105, 1.15]} />}
      {live && <Lamp m={m} bulb={bulb} ghost={ghost} at={[1.85, 0.06, 1.85]} />}
      {/* A bus pulling out at the Transit Center. */}
      {live && st > 1 && <CityBus m={m} at={[1.0, 0.06, 1.48]} rot={Math.PI / 2} />}
      {/* The terminal. */}
      <ShellBuilding {...k} w={w} d={d} h0={h0} z0={z0} wall={def.color} tex="siding" roof={yellow} sign={def.sign} signBg="#263238" signFg={yellow} shopfront={null} grow={grow}>
        <mesh position={[0, 0.55, zf + 0.005]}><planeGeometry args={[3.3, 0.6]} />{win}</mesh>
        <Facade at={[0, 0, zf]} len={3.3}>
          {(L) => Array.from({ length: Math.round(L / 0.45) - 1 }, (_, i) => {
            const x = -L / 2 + (L / Math.round(L / 0.45)) * (i + 1)
            return <Box key={i} m={m} at={[x, 0.55, 0.012]} s={[0.03, 0.6, 0.02]} c="#eceff1" shadow={false} />
          })}
        </Facade>
        {[-0.9, 0.9].map((x) => (
          <group key={x}>
            <Box m={m} at={[x, 0.42, zf + 0.03]} s={[0.46, 0.66, 0.02]} c="#37474f" shadow={false} />
            <mesh position={[x, 0.45, zf + 0.042]}><planeGeometry args={[0.38, 0.54]} />{win}</mesh>
          </group>
        ))}
        {/* A clock over the entrance from level 4. */}
        {st > 1 && (
          <group position={[0, 1.0, zf + 0.012]}>
            <mesh><circleGeometry args={[0.13, 16]} />{bulb}</mesh>
            <Box m={m} at={[0, 0.035, 0.006]} s={[0.016, 0.08, 0.006]} c="#212121" shadow={false} />
            <Box m={m} at={[0.03, 0, 0.006]} s={[0.07, 0.016, 0.006]} c="#212121" shadow={false} />
          </group>
        )}
      </ShellBuilding>
      <Roundel m={m} at={[1.3, h + 0.13, -1.6]} />
      {/* Grand Terminal: steel arches over the bays. */}
      {st === 3 && (
        <group>
          {[-0.3, 0.3, 0.9].map((z) => (
            <mesh key={z} position={[0, 0.06, z]} castShadow><torusGeometry args={[1.84, 0.035, 6, 36, Math.PI]} />{m('#78909c')}</mesh>
          ))}
          <Box m={m} at={[0, 1.92, 0.3]} s={[0.06, 0.06, 1.28]} c="#78909c" />
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 1.301, 0.06 + 1.301, 0.3]} rot={[0, 0, -sd * Math.PI / 4]} s={[0.06, 0.06, 1.28]} c="#78909c" />)}
        </group>
      )}
      {live && <Pool r={1.0} x={-0.45} z={0.3} />}
      {live && <Pool r={1.0} x={0.9} z={0.3} />}
    </group>
  )
}

// ---- City hall ----

function Fountain({ m, at, ghost }: { m: Mat; at: V3; ghost?: boolean }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.08, 0]} r={0.55} h={0.16} c="#cfd8dc" seg={24} />
      <mesh position={[0, 0.14, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.49, 24]} />{m('#4fc3f7')}</mesh>
      <Cyl m={m} at={[0, 0.3, 0]} r={0.07} h={0.34} c="#cfd8dc" seg={10} />
      <Cyl m={m} at={[0, 0.48, 0]} r={0.24} r2={0.12} h={0.07} c="#cfd8dc" seg={16} />
      <mesh position={[0, 0.522, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.2, 16]} />{m('#4fc3f7')}</mesh>
      <Cyl m={m} at={[0, 0.6, 0]} r={0.035} h={0.18} c="#cfd8dc" seg={8} />
      <mesh position={[0, 0.72, 0]}><sphereGeometry args={[0.07, 8, 6]} />{m('#b3e5fc')}</mesh>
      {!ghost && <Pool r={0.9} />}
    </group>
  )
}

function CityHall({ k, def, lvl }: { k: Kit; def: NewModelProps['def']; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const st = growthStage(lvl)
  const live = !ghost
  const w = 3.3, d = 1.4, z0 = -1.15, zf = z0 + d / 2, h0 = 1.7, grow = 0.6
  const h = h0 + levelLift(lvl) * grow
  const slate = def.roof
  const flags = st === 3 ? ['#1565c0', '#c62828', '#2e7d32', '#f9a825'] : st === 2 ? ['#1565c0', '#c62828', '#2e7d32'] : ['#1565c0', '#c62828']
  return (
    <group>
      <Box m={m} at={[0, 0.03, 0]} s={[3.8, 0.06, 3.8]} c="#ffffff" t={paverTex(5, 5)} shadow={false} />
      {/* Lawns with hedges either side of the plaza. */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Box m={m} at={[sd * 1.42, 0.07, 1.0]} s={[0.9, 0.02, 1.7]} c="#ffffff" t={grassTex(1, 2)} shadow={false} />
          <Box m={m} at={[sd * 1.42, 0.16, 1.82]} s={[0.86, 0.16, 0.12]} c={PAL.bush[0]} />
          <Tree m={m} at={[sd * 1.55, 0.08, 1.35]} s={0.7} />
          {live && <Bench m={m} at={[sd * 1.05, 0.08, 0.75]} rot={-sd * Math.PI / 2} c="#5d4037" />}
        </group>
      ))}
      <Fountain m={m} at={[0, 0.06, 0.9]} ghost={ghost} />
      {live && [[-0.9, 0.2], [0.9, 0.2], [-0.9, 1.65], [0.9, 1.65]].map(([x, z]) => <Lamp key={`${x}${z}`} m={m} bulb={bulb} ghost={ghost} at={[x, 0.06, z]} twin />)}
      {live && flags.map((c, i) => <Flag key={c} at={[(i % 2 ? 1 : -1) * (1.2 + Math.floor(i / 2) * 0.42), 0.08, 0.3]} color={c} tall={1.5} star={lvl >= 10 && i < 2} />)}
      <ShellBuilding {...k} w={w} d={d} h0={h0} z0={z0} wall={def.color} tex="brick" roof={slate} shopfront={null} grow={grow} rowFrom={1.55}>
        <Box m={m} at={[0, 0.1, z0]} s={[w + 0.04, 0.2, d + 0.04]} c="#bdbdbd" shadow={false} />
        <Box m={m} at={[0, 1.32, zf + 0.015]} s={[w + 0.02, 0.07, 0.03]} c={STONE} shadow={false} />
        <ArchRow m={m} win={win} at={[0, 0, zf]} len={w} y={0.7} w={0.28} h={0.62} skip={1.15} step={0.4} />
        <Portico k={k} z={zf} span={1.6} colH={1.2} n={6} sign={def.sign ?? 'CITY HALL'} fg={slate} signW={1.2} clock={st > 1} base={0.06} />
      </ShellBuilding>
      {/* Clock cupola, then a green dome (Civic Center), then a gilded colonnaded dome (Capitol Hall). */}
      {st === 1 ? (
        <group position={[0, h + 0.13, z0]}>
          <Upright>
            <group>
              <Box m={m} at={[0, 0.25, 0]} s={[0.6, 0.5, 0.6]} c={STONE} />
              {[0, 1, 2, 3].map((i) => {
                const a = (i / 4) * Math.PI * 2
                return (
                  <group key={i} position={[Math.sin(a) * 0.306, 0.27, Math.cos(a) * 0.306]} rotation-y={a}>
                    <mesh><circleGeometry args={[0.15, 16]} />{bulb}</mesh>
                    <Box m={m} at={[0, 0.04, 0.006]} s={[0.018, 0.1, 0.006]} c="#212121" shadow={false} />
                    <Box m={m} at={[0.035, 0, 0.006]} s={[0.08, 0.018, 0.006]} c="#212121" shadow={false} />
                  </group>
                )
              })}
              <Box m={m} at={[0, 0.53, 0]} s={[0.68, 0.06, 0.68]} c={slate} />
              <mesh position={[0, 0.56, 0]} castShadow><sphereGeometry args={[0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />{m(roofSnow('#7fb8a4'))}</mesh>
              <Cyl m={m} at={[0, 0.95, 0]} r={0.015} h={0.2} c={GOLD} seg={5} />
            </group>
          </Upright>
        </group>
      ) : (
        <Dome k={k} at={[0, h + 0.13, z0]} r={st === 3 ? 0.54 : 0.55} drum={st === 3 ? 0.7 : 0.42} c={STONE} top={st === 3 ? GOLD : '#7fb8a4'} windows={st === 3 ? 0 : 8} cols={st === 3 ? 16 : 0} clocks={st === 3} />
      )}
      {/* A gilded statue on a plinth for the Capitol. */}
      {st === 3 && live && (
        <group position={[0, 0.06, 1.66]} userData={PEOPLE_SIZED}>
          <Box m={m} at={[0, 0.12, 0]} s={[0.24, 0.24, 0.24]} c={STONE} />
          <Cyl m={m} at={[0, 0.36, 0]} r={0.05} r2={0.07} h={0.24} c={GOLD} seg={8} />
          <mesh position={[0, 0.53, 0]}><sphereGeometry args={[0.05, 8, 6]} />{m(GOLD)}</mesh>
        </group>
      )}
    </group>
  )
}

export function ServiceModel({ def, ghost, m, win, bulb, level = 1 }: NewModelProps) {
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  if (def.kind === 'decor') return <Box m={m} at={[0, 0.1, 0]} s={[def.w * 1.6, 0.2, def.h * 1.6]} c={def.color} />
  const k: Kit = { m, win, bulb, ghost, lvl }
  switch (def.id) {
    case 'laundry': return <Laundry k={k} def={def} lvl={lvl} />
    case 'vet': return <Vet k={k} def={def} lvl={lvl} />
    case 'postoffice': return <PostOffice k={k} def={def} lvl={lvl} />
    case 'library': return <Library k={k} def={def} lvl={lvl} />
    case 'busdepot': return <BusDepot k={k} def={def} lvl={lvl} />
    case 'cityhall': return <CityHall k={k} def={def} lvl={lvl} />
  }
  return <ShellBuilding m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} w={def.w * 1.7} d={def.h * 1.3} h0={1.3} wall={def.color} roof={def.roof} sign={def.sign} shopfront={def.roof} />
}
