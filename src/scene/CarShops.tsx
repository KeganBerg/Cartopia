import { useMemo, type ReactNode } from 'react'
import { ExtrudeGeometry, Shape } from 'three'
import { levelLift, type Body, type Panels } from '../game/data'
import { growthStage } from '../game/growth'
import { ShellBuilding, Box, Cyl, Sign, Pool, Neon, Trims, Flag, SNOW, type Mat, type V3, type NewModelProps } from './NewBuildings'
import { CarModel } from './CarModel'
import { Facade, Upright } from './mergeScale'
import { PEOPLE_SIZED } from './keepShape'
import { WaterTank } from './GrowthKit'
import { brickTex, concreteTex, gravelTex, shutterTex, awningTex, checkerTex } from './textures'

// Car shops from the third wave of buildings (exhaust, brakes, wraps, dyno, engines, race fab).
// Lots face +z (the front door side), like the rest of the town. Each one is a
// working garage with its job out on the apron (a car up on a lift, on the
// alignment rack, on the dyno rollers, an engine on the hoist) and a giant
// roadside landmark on the roof that says what it does from far above. They
// grow a floor every few levels and change form at level 4 and 7 (growth.ts).

export const CAR_SHOP_MODELS = new Set(['muffler', 'brakes', 'wraps', 'dynolab', 'engines', 'racefab'])

type K = { m: Mat; win: ReactNode; bulb: ReactNode; ghost?: boolean; lvl: number }

const CHROME = '#d7dee2'
const STEEL = '#78909c'
const DARK = '#263238'
const BAY_DARK = '#1c2329'
const TYRE = '#212121'
// Upgrades lift these lower than the town's shops: they're working sheds.
const GROW = 0.55
const roofOf = (c: string) => (SNOW ? '#f4f8fb' : c)

// ---------------------------------------------------------------- kit

// The lot's paving, its top 0.05 up.
function Lot({ m, w, d, z = 0, c = '#ffffff', tex }: { m: Mat; w: number; d: number; z?: number; c?: string; tex?: Parameters<Mat>[1] }) {
  return <Box m={m} at={[0, 0.025, z]} s={[w, 0.05, d]} c={c} t={tex ?? concreteTex(Math.max(1, Math.round(w / 1.5)), Math.max(1, Math.round(d / 1.5)))} shadow={false} />
}

// A service bay in a wall facing +z at zf: a trimmed frame round a roll-up door, or a dark open bay.
function Bay({ m, bulb, x, zf, w, h, trim, open, lamp = true }: { m: Mat; bulb: ReactNode; x: number; zf: number; w: number; h: number; trim: string; open?: boolean; lamp?: boolean }) {
  return (
    <group>
      <Box m={m} at={[x, (h + 0.05) / 2, zf + 0.012]} s={[w + 0.1, h + 0.05, 0.025]} c={trim} shadow={false} />
      <mesh position={[x, h / 2, zf + 0.03]}>
        <planeGeometry args={[w, h]} />
        {open ? m(BAY_DARK) : m('#ffffff', shutterTex())}
      </mesh>
      {open && <Box m={m} at={[x, h - 0.06, zf + 0.033]} s={[w - 0.1, 0.03, 0.008]} c="#fff8e1" shadow={false} />}
      {lamp && <mesh position={[x, h + 0.1, zf + 0.04]}><boxGeometry args={[0.14, 0.06, 0.07]} />{bulb}</mesh>}
    </group>
  )
}

// A shop door in a wall facing +z: frame, door, a glass slot, push bar and a step.
function Door({ m, win, x, zf, c = '#37474f', frame = '#eceff1' }: { m: Mat; win: ReactNode; x: number; zf: number; c?: string; frame?: string }) {
  return (
    <group>
      <Box m={m} at={[x, 0.32, zf + 0.01]} s={[0.36, 0.64, 0.02]} c={frame} shadow={false} />
      <mesh position={[x, 0.31, zf + 0.024]}><planeGeometry args={[0.28, 0.58]} />{m(c)}</mesh>
      <mesh position={[x, 0.44, zf + 0.028]}><planeGeometry args={[0.18, 0.22]} />{win}</mesh>
      <Box m={m} at={[x, 0.27, zf + 0.034]} s={[0.22, 0.018, 0.014]} c="#cfd8dc" shadow={false} />
      <Box m={m} at={[x, 0.05, zf + 0.1]} s={[0.46, 0.1, 0.18]} c="#cfd8dc" />
    </group>
  )
}

// A lit window with a sill, in a wall facing +z at zf.
function Pane({ m, win, x, y, zf, w = 0.36, h = 0.36, sill = '#eceff1' }: { m: Mat; win: ReactNode; x: number; y: number; zf: number; w?: number; h?: number; sill?: string }) {
  return (
    <group>
      <mesh position={[x, y, zf + 0.006]}><planeGeometry args={[w, h]} />{win}</mesh>
      <Box m={m} at={[x, y - h / 2 - 0.02, zf + 0.03]} s={[w + 0.06, 0.035, 0.06]} c={sill} shadow={false} />
    </group>
  )
}

// A name board fixed flat to a wall facing +z.
function Fascia({ m, text, at, w, bg, fg, board }: { m: Mat; text: string; at: V3; w: number; bg: string; fg: string; board: string }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, 0, 0.02]} s={[w + 0.08, w / 4 + 0.08, 0.04]} c={board} shadow={false} />
      <Sign text={text} w={w} at={[0, 0, 0.043]} bg={bg} fg={fg} />
    </group>
  )
}

// A name board standing on the roof on steel legs (at: its middle, y the roof top).
function RoofSign({ m, text, at, w, bg, fg, board }: { m: Mat; text: string; at: V3; w: number; bg: string; fg: string; board: string }) {
  const lift = 0.26
  return (
    <group position={at}>
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[(sd * w) / 2.8, lift / 2, -0.06]} s={[0.05, lift, 0.05]} c="#455a64" shadow={false} />)}
      <Box m={m} at={[0, lift + w / 8, -0.03]} s={[w + 0.08, w / 4 + 0.08, 0.05]} c={board} shadow={false} />
      <Sign text={text} w={w} at={[0, lift + w / 8, 0]} bg={bg} fg={fg} />
    </group>
  )
}

// Lamp post with a warm head that lights at night, and its pool of light.
function Lamp({ m, bulb, at, ghost, arm = 0 }: { m: Mat; bulb: ReactNode; at: V3; ghost?: boolean; arm?: number }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.03, 0]} s={[0.12, 0.06, 0.12]} c="#90a4ae" />
      <Cyl m={m} at={[0, 0.55, 0]} r={0.025} r2={0.035} h={1} c={DARK} seg={6} />
      <group rotation-y={arm}>
        <Box m={m} at={[0, 1.03, 0.07]} s={[0.04, 0.03, 0.18]} c={DARK} shadow={false} />
        <mesh position={[0, 1.0, 0.15]}><boxGeometry args={[0.1, 0.05, 0.12]} />{bulb}</mesh>
      </group>
      {!ghost && <Pool r={0.55} z={0.12} />}
    </group>
  )
}

function Cone({ m, at }: { m: Mat; at: V3 }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.01, 0]} s={[0.12, 0.02, 0.12]} c="#ff6f00" shadow={false} />
      <mesh position={[0, 0.11, 0]} castShadow><coneGeometry args={[0.05, 0.18, 8]} />{m('#ff6f00')}</mesh>
      <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.031, 0.04, 0.035, 8]} />{m('#fafafa')}</mesh>
    </group>
  )
}

// A stack of tyres, the top one banded in a colour.
function Tyres({ m, at, n = 3, band }: { m: Mat; at: V3; n?: number; band?: string }) {
  return (
    <group position={at} userData={PEOPLE_SIZED}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[0, 0.06 + i * 0.11, 0]} rotation-x={Math.PI / 2} castShadow>
          <torusGeometry args={[0.12, 0.055, 8, 14]} />
          {m(band && i === n - 1 ? band : TYRE)}
        </mesh>
      ))}
    </group>
  )
}

function Drum({ m, at, c }: { m: Mat; at: V3; c: string }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.16, 0]} r={0.1} h={0.32} c={c} seg={10} />
      <Cyl m={m} at={[0, 0.2, 0]} r={0.103} h={0.025} c="#eceff1" seg={10} />
    </group>
  )
}

// A car, car-sized however big the block it's parked in.
function Car({ at, rot = 0, body, color, stripe, panels, children }: { at: V3; rot?: number; body: Body; color: string; stripe?: string; panels?: Panels; children?: ReactNode }) {
  return (
    <group position={at}>
      <Upright size={1}>
        <group rotation-y={rot}>
          <CarModel body={body} color={color} stripe={stripe} panels={panels} />
          {children}
        </group>
      </Upright>
    </group>
  )
}

// A glass floor set on the roof (at: middle of its floor), with a cap in the shop's colour.
function RoofBox({ m, win, at, w, d, h, wall, cap }: { m: Mat; win: ReactNode; at: V3; w: number; d: number; h: number; wall: string; cap: string }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, h / 2, 0]} s={[w, h, d]} c={wall} />
      <Facade at={[0, 0, d / 2]} len={w}>
        {(L) => (
          <group>
            <mesh position={[0, h * 0.5, 0.006]}><planeGeometry args={[L - 0.12, h * 0.6]} />{win}</mesh>
            {Array.from({ length: Math.max(1, Math.round(L / 0.4) - 1) }, (_, i) => (
              <Box key={i} m={m} at={[-L / 2 + ((i + 1) * L) / Math.round(L / 0.4), h * 0.5, 0.016]} s={[0.025, h * 0.6, 0.02]} c={wall} shadow={false} />
            ))}
          </group>
        )}
      </Facade>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (w / 2 + 0.006), h * 0.5, 0]} rotation-y={(sd * Math.PI) / 2}>
          <planeGeometry args={[d - 0.12, h * 0.6]} />
          {win}
        </mesh>
      ))}
      <Box m={m} at={[0, h + 0.03, 0]} s={[w + 0.08, 0.06, d + 0.08]} c={cap} />
    </group>
  )
}

// A round steel stack up a wall, out past the roof, with a slash-cut chrome tip.
function Stack({ m, at, h, glow }: { m: Mat; at: V3; h: number; glow?: string }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.04, 0]} s={[0.16, 0.08, 0.16]} c="#455a64" />
      <Cyl m={m} at={[0, h / 2, 0]} r={0.05} h={h} c={STEEL} seg={10} />
      {[0.35, h * 0.5, h - 0.4].map((y) => <Cyl key={y} m={m} at={[0, y, 0]} r={0.062} h={0.03} c="#455a64" seg={10} />)}
      <Cyl m={m} at={[0, h + 0.1, 0]} r={0.075} r2={0.06} h={0.22} c={CHROME} seg={12} />
      {glow && <Neon at={[0, h + 0.212, 0]} s={[0.07, 0.006, 0.07]} c={glow} />}
    </group>
  )
}

// One sawtooth roof bay: a ramp up from the back to a glazed face looking +z
// (origin at the front foot, `w` across, `d` deep, `rise` high).
function Tooth({ m, win, w, d, rise, c }: { m: Mat; win: ReactNode; w: number; d: number; rise: number; c: string }) {
  const geo = useMemo(() => {
    const s = new Shape()
    s.moveTo(0, 0)
    s.lineTo(d, 0)
    s.lineTo(0, rise)
    s.closePath()
    return new ExtrudeGeometry(s, { depth: w, bevelEnabled: false })
  }, [w, d, rise])
  return (
    <group>
      <mesh geometry={geo} position={[-w / 2, 0, 0]} rotation-y={Math.PI / 2} castShadow receiveShadow>
        {m(c)}
      </mesh>
      <mesh position={[0, rise * 0.5, 0.006]}><planeGeometry args={[w - 0.08, rise * 0.72]} />{win}</mesh>
    </group>
  )
}

// An engine block: a V of cylinder banks with valve covers, intake on top, a pulley in front (faces +z).
function Engine({ m, cover = '#c62828', block = '#78909c', air }: { m: Mat; cover?: string; block?: string; air?: boolean }) {
  return (
    <group>
      <Box m={m} at={[0, 0.04, 0]} s={[0.2, 0.08, 0.34]} c="#455a64" />
      <Box m={m} at={[0, 0.16, 0]} s={[0.28, 0.16, 0.36]} c={block} />
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.1, 0.28, 0]} rotation-z={-sd * 0.55}>
          <Box m={m} at={[0, 0, 0]} s={[0.13, 0.12, 0.34]} c={block} />
          <Box m={m} at={[0, 0.075, 0]} s={[0.11, 0.04, 0.32]} c={cover} />
        </group>
      ))}
      <Box m={m} at={[0, 0.33, 0]} s={[0.1, 0.08, 0.28]} c="#90a4ae" />
      <Cyl m={m} at={[0, 0.16, 0.2]} r={0.07} h={0.04} c={DARK} seg={12} rot={[Math.PI / 2, 0, 0]} />
      {air && (
        <group>
          <Cyl m={m} at={[0, 0.4, 0]} r={0.05} h={0.06} c={CHROME} seg={10} />
          <Cyl m={m} at={[0, 0.45, 0]} r={0.14} h={0.05} c={CHROME} seg={16} />
        </group>
      )}
    </group>
  )
}

// ---------------------------------------------------------------- models

// 1x1 shops share a box 1.8 wide and 1.25 deep at the back of the lot.
const W1 = 1.8, D1 = 1.25, Z1 = -0.37, F1 = Z1 + D1 / 2, H1 = 1.4

function Muffler({ k }: { k: K }) {
  const { m, win, bulb, ghost, lvl } = k
  const st = growthStage(lvl)
  const h = H1 + levelLift(lvl) * GROW
  const top = h + 0.13
  const orange = '#ff7043'
  const box = st === 3 ? 0.55 : 0
  return (
    <ShellBuilding m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} w={W1} d={D1} h0={H1} z0={Z1} wall="#37474f" roof={orange} shopfront={null} grow={GROW} rowFrom={1.62}>
      <Lot m={m} w={1.9} d={1.9} />
      <Bay m={m} bulb={bulb} x={-0.36} zf={F1} w={0.92} h={0.82} trim={orange} open />
      {/* Chrome tailpipes hung on the back wall of the open bay. */}
      {[0.46, 0.58, 0.7].map((y, i) => <Cyl key={y} m={m} at={[-0.36 + (i - 1) * 0.06, y, F1 + 0.06]} r={0.022} h={0.62} c={CHROME} seg={8} rot={[0, 0, Math.PI / 2]} />)}
      <Door m={m} win={win} x={0.36} zf={F1} />
      <Pane m={m} win={win} x={0.71} y={0.5} zf={F1} w={0.24} h={0.34} />
      <Fascia m={m} text="EXHAUST" at={[0, 1.16, F1]} w={1.24} bg="#212121" fg={orange} board={orange} />
      {/* A car up on the four-post lift, its new pipes poking out the back.
          Raised only part way, so the car stays under the EXHAUST board. */}
      {!ghost && (
        <group position={[-0.28, 0.05, 0.68]}>
          <Upright>
            <group>
              {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} m={m} at={[sx * 0.68, 0.215, sz * 0.36]} s={[0.07, 0.43, 0.07]} c={orange} />))}
              {[-1, 1].map((sx) => <Box key={sx} m={m} at={[sx * 0.68, 0.28, 0]} s={[0.08, 0.06, 0.8]} c="#455a64" />)}
              {[-1, 1].map((sz) => <Box key={sz} m={m} at={[0, 0.28, sz * 0.24]} s={[1.28, 0.04, 0.16]} c="#546e7a" />)}
              <Box m={m} at={[0, 0.03, 0]} s={[0.3, 0.06, 0.22]} c="#ff7043" />
              <Cyl m={m} at={[0, 0.175, 0]} r={0.03} h={0.23} c={STEEL} seg={8} />
              <Box m={m} at={[0, 0.305, 0]} s={[0.14, 0.03, 0.14]} c="#455a64" shadow={false} />
              <group position={[0, 0.3, 0]} rotation-y={Math.PI / 2}>
                <CarModel body="muscle" color="#1e88e5" stripe="#fafafa" />
              </group>
            </group>
          </Upright>
        </group>
      )}
      {/* A stand of new pipes and a bin of mufflers by the office. */}
      {!ghost && (
        <group position={[0.74, 0.05, 0.78]}>
          {[-0.17, 0.17].map((x) => (
            <group key={x}>
              <Box m={m} at={[x, 0.015, 0]} s={[0.06, 0.03, 0.3]} c="#455a64" shadow={false} />
              <Box m={m} at={[x, 0.32, 0]} s={[0.04, 0.62, 0.04]} c="#455a64" />
            </group>
          ))}
          {[0.18, 0.31, 0.44, 0.57].map((y, i) => (
            <group key={y}>
              <Cyl m={m} at={[0, y, 0.04]} r={0.026} h={0.46} c={i === 1 ? orange : CHROME} seg={8} rot={[0, 0, Math.PI / 2]} />
              <Cyl m={m} at={[0.25, y, 0.04]} r={0.04} r2={0.032} h={0.06} c="#eceff1" seg={10} rot={[0, 0, Math.PI / 2]} />
            </group>
          ))}
        </group>
      )}
      {!ghost && <Cone m={m} at={[0.86, 0.05, 0.36]} />}
      {!ghost && <Lamp m={m} bulb={bulb} ghost={ghost} at={[-0.9, 0, 0.02]} arm={0.4} />}
      {!ghost && <Pool r={0.75} x={-0.3} z={0.7} />}
      {st >= 2 && <Stack m={m} at={[0.957, 0, -0.62]} h={h + 0.55 + box} glow="#ff6d00" />}
      {st === 3 && <Stack m={m} at={[-0.957, 0, -0.62]} h={h + 0.55 + box} glow="#ff6d00" />}
      {st === 3 && <RoofBox m={m} win={win} at={[0, top, Z1 - 0.06]} w={1.2} d={0.82} h={box} wall="#455a64" cap={orange} />}
      {st >= 2 && !ghost && <Neon at={[0, h - 0.05, F1 + 0.012]} s={[W1 - 0.04, 0.035, 0.02]} c="#ff6d00" />}
      {/* Giant muffler on saddles, its tailpipe turned up into a glowing tip. */}
      <group position={[-0.18, top + box, Z1 - 0.06]}>
        <Upright>
          <group scale={st === 3 ? 1.1 : st === 2 ? 1.15 : 1.1}>
            {[-0.3, 0.3].map((x) => <Box key={x} m={m} at={[x, 0.07, 0]} s={[0.12, 0.14, 0.42]} c="#455a64" />)}
            <mesh position={[0, 0.36, 0]} rotation-z={Math.PI / 2} scale={[1, 1, 0.78]} castShadow>
              <cylinderGeometry args={[0.25, 0.25, 0.96, 20]} />
              {m('#b0bec5')}
            </mesh>
            {[-0.49, 0.49].map((x) => (
              <mesh key={x} position={[x, 0.36, 0]} rotation-z={Math.PI / 2} scale={[1, 1, 0.78]}>
                <cylinderGeometry args={[0.235, 0.235, 0.03, 20]} />
                {m('#90a4ae')}
              </mesh>
            ))}
            <mesh position={[0, 0.36, 0]} rotation-z={Math.PI / 2} scale={[1, 1, 0.78]}>
              <cylinderGeometry args={[0.255, 0.255, 0.16, 20]} />
              {m(orange)}
            </mesh>
            <Cyl m={m} at={[-0.58, 0.36, 0]} r={0.06} h={0.16} c={STEEL} seg={10} rot={[0, 0, Math.PI / 2]} />
            <Cyl m={m} at={[0.6, 0.36, 0]} r={0.07} h={0.2} c={CHROME} seg={10} rot={[0, 0, Math.PI / 2]} />
            <mesh position={[0.7, 0.36, 0]}><sphereGeometry args={[0.07, 10, 8]} />{m(CHROME)}</mesh>
            <group position={[0.7, 0.36, 0]} rotation-z={-0.25}>
              <Cyl m={m} at={[0, 0.25, 0]} r={0.07} h={0.5} c={CHROME} seg={10} />
              <Cyl m={m} at={[0, 0.58, 0]} r={0.15} r2={0.1} h={0.22} c="#eceff1" seg={16} />
              <Neon at={[0, 0.692, 0]} s={[0.17, 0.006, 0.17]} c="#ff3d00" />
            </group>
          </group>
        </Upright>
      </group>
    </ShellBuilding>
  )
}

function Brakes({ k }: { k: K }) {
  const { m, win, bulb, ghost, lvl } = k
  const st = growthStage(lvl)
  const h = H1 + levelLift(lvl) * GROW
  const top = h + 0.13
  const red = '#c62828'
  const box = st === 3 ? 0.55 : 0
  const s = st === 3 ? 1.05 : st === 2 ? 1.15 : 1
  return (
    <ShellBuilding m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} w={W1} d={D1} h0={H1} z0={Z1} wall="#eceff1" tex="siding" roof={red} shopfront={null} grow={GROW} rowFrom={1.62}>
      <Lot m={m} w={1.9} d={1.9} />
      <Box m={m} at={[0, 0.88, F1 + 0.008]} s={[W1 + 0.012, 0.04, 0.016]} c={red} shadow={false} />
      <Bay m={m} bulb={bulb} x={-0.4} zf={F1} w={0.88} h={0.8} trim={red} open />
      <Door m={m} win={win} x={0.62} zf={F1} c={red} />
      <Pane m={m} win={win} x={0.18} y={0.52} zf={F1} w={0.22} h={0.3} />
      <Fascia m={m} text="BRAKES" at={[0, 1.15, F1]} w={1.2} bg="#fafafa" fg={red} board={red} />
      {/* The alignment rack: a car on runways with turn plates, targets clamped
          on its wheels, and the camera beam reading them from the front. */}
      {!ghost && (
        <group position={[-0.27, 0.05, 0.64]}>
          <Upright>
            <group>
              {[-1, 1].map((sz) => (
                <group key={sz}>
                  <Box m={m} at={[0, 0.11, sz * 0.24]} s={[1.24, 0.05, 0.17]} c="#455a64" />
                  {[-0.55, 0.55].map((x) => <Box key={x} m={m} at={[x, 0.045, sz * 0.24]} s={[0.07, 0.09, 0.07]} c="#fdd835" />)}
                  <Box m={m} at={[-0.68, 0.05, sz * 0.24]} rot={[0, 0, 0.35]} s={[0.15, 0.03, 0.17]} c="#546e7a" />
                  <Cyl m={m} at={[0.4, 0.142, sz * 0.24]} r={0.09} h={0.014} c={CHROME} seg={14} />
                </group>
              ))}
              <group position={[0, 0.149, 0]} userData={PEOPLE_SIZED}>
                <group rotation-y={Math.PI / 2}>
                  <CarModel body="sports" color="#fafafa" stripe={red} />
                </group>
              {[-0.4, 0.4].map((x) => (
                <group key={x} position={[x, 0.151, 0.4]}>
                  <Cyl m={m} at={[0, 0, 0]} r={0.1} h={0.02} c="#212121" seg={14} rot={[Math.PI / 2, 0, 0]} />
                  <Cyl m={m} at={[0, 0, 0.02]} r={0.065} h={0.01} c="#fdd835" seg={14} rot={[Math.PI / 2, 0, 0]} />
                  <Box m={m} at={[0, 0, -0.03]} s={[0.03, 0.03, 0.05]} c={STEEL} shadow={false} />
                </group>
              ))}
              </group>
              <group position={[0.84, 0, 0]}>
                <Box m={m} at={[0, 0.02, 0]} s={[0.3, 0.04, 0.3]} c="#455a64" />
                <Box m={m} at={[0, 0.48, 0]} s={[0.07, 0.88, 0.07]} c={DARK} />
                <Box m={m} at={[0, 0.9, 0]} s={[0.085, 0.07, 1.0]} c={red} />
                {[-0.48, 0.48].map((z) => <Box key={z} m={m} at={[-0.05, 0.9, z]} s={[0.12, 0.09, 0.09]} c="#212121" />)}
              </group>
            </group>
          </Upright>
        </group>
      )}
      {!ghost && <Lamp m={m} bulb={bulb} ghost={ghost} at={[0.95, 0, 0.45]} arm={-1.3} />}
      {!ghost && <Pool r={0.75} x={-0.35} z={0.7} />}
      {/* A stop sign pylon by the road from level 4. */}
      {st >= 2 && (
        <group position={[-0.78, 0, 1.08]} rotation-y={0.3}>
          <Box m={m} at={[0, 0.04, -0.075]} s={[0.14, 0.08, 0.14]} c="#90a4ae" />
          <Cyl m={m} at={[0, 0.85, -0.075]} r={0.03} h={1.6} c={STEEL} seg={6} />
          <Cyl m={m} at={[0, 1.65 + (st === 3 ? 0.3 : 0), -0.035]} r={0.27} h={0.02} c="#fafafa" seg={8} rot={[Math.PI / 2, Math.PI / 8, 0]} />
          {st === 3 && <Cyl m={m} at={[0, 1.8, -0.075]} r={0.03} h={0.3} c={STEEL} seg={6} />}
          <Cyl m={m} at={[0, 1.65 + (st === 3 ? 0.3 : 0), -0.01]} r={0.24} h={0.02} c={red} seg={8} rot={[Math.PI / 2, Math.PI / 8, 0]} />
          <Sign text="STOP" w={0.34} at={[0, 1.65 + (st === 3 ? 0.3 : 0), 0.002]} bg={red} fg="#fafafa" />
        </group>
      )}
      {st === 3 && <RoofBox m={m} win={win} at={[0, top, Z1 - 0.06]} w={1.2} d={0.82} h={box} wall="#cfd8dc" cap={red} />}
      {st === 3 && !ghost && <Neon at={[0, h - 0.05, F1 + 0.012]} s={[W1 - 0.04, 0.035, 0.02]} c="#ff1744" />}
      {/* Giant drilled brake disc with its red caliper, turned to the road. */}
      <group position={[0.05, top + box, Z1 - 0.1]}>
        <Upright>
          <group rotation-y={0.35} scale={s}>
            <Box m={m} at={[0, 0.04, 0]} s={[0.56, 0.08, 0.3]} c="#455a64" />
            {[-0.17, 0.17].map((x) => <Box key={x} m={m} at={[x, 0.22, 0]} s={[0.06, 0.3, 0.06]} c="#455a64" />)}
            <group position={[0, 0.77, 0]}>
              <Cyl m={m} at={[0, 0, 0]} r={0.42} h={0.07} c="#b0bec5" seg={28} rot={[Math.PI / 2, 0, 0]} />
              <Cyl m={m} at={[0, 0, 0]} r={0.2} h={0.15} c="#90a4ae" seg={20} rot={[Math.PI / 2, 0, 0]} />
              <Cyl m={m} at={[0, 0, 0]} r={0.07} h={0.17} c={DARK} seg={12} rot={[Math.PI / 2, 0, 0]} />
              {Array.from({ length: 5 }, (_, i) => {
                const a = (i / 5) * Math.PI * 2
                return <Cyl key={i} m={m} at={[Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0]} r={0.022} h={0.18} c="#eceff1" seg={6} rot={[Math.PI / 2, 0, 0]} />
              })}
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2 + 0.2
                const r = i % 2 ? 0.3 : 0.34
                return <Cyl key={i} m={m} at={[Math.cos(a) * r, Math.sin(a) * r, 0]} r={0.025} h={0.076} c="#455a64" seg={8} rot={[Math.PI / 2, 0, 0]} />
              })}
              <group rotation-z={0.65}>
                <mesh position={[0, 0, 0]} castShadow><torusGeometry args={[0.37, 0.085, 8, 14, 0.95]} />{m(red)}</mesh>
              </group>
              <Box m={m} at={[Math.cos(1.1) * 0.37, Math.sin(1.1) * 0.37, 0.086]} rot={[0, 0, 1.1 - Math.PI / 2]} s={[0.16, 0.05, 0.012]} c="#fafafa" shadow={false} />
            </group>
          </group>
        </Upright>
      </group>
    </ShellBuilding>
  )
}

// 2x1 shops: a box 3.7 wide and 1.3 deep at the back of the lot.
const W2 = 3.7, D2 = 1.3, Z2 = -0.3, F2 = Z2 + D2 / 2

function Wraps({ k }: { k: K }) {
  const { m, win, bulb, ghost, lvl } = k
  const st = growthStage(lvl)
  const H = 1.6
  const h = H + levelLift(lvl) * GROW
  const top = h + 0.13
  const cyan = '#00e5ff'
  const pink = '#ff4fd8'
  return (
    <ShellBuilding m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} w={W2} d={D2} h0={H} z0={Z2} wall="#263238" tex="siding" roof={cyan} shopfront={null} grow={GROW} rowFrom={1.8}>
      <Lot m={m} w={3.9} d={1.88} z={0.01} />
      {/* The glass-front studio: a bright window wall with slim mullions. */}
      <Facade at={[-0.92, 0, F2]} len={1.7}>
        {(L) => (
          <group>
            <Box m={m} at={[0, 0.62, 0.012]} s={[L + 0.08, 1.12, 0.025]} c="#eceff1" shadow={false} />
            <mesh position={[0, 0.62, 0.03]}><planeGeometry args={[L, 1.04]} />{win}</mesh>
            {Array.from({ length: Math.max(1, Math.round(L / 0.42) - 1) }, (_, i) => (
              <Box key={i} m={m} at={[-L / 2 + ((i + 1) * L) / Math.round(L / 0.42), 0.62, 0.04]} s={[0.03, 1.04, 0.02]} c="#eceff1" shadow={false} />
            ))}
            <Box m={m} at={[0, 0.42, 0.04]} s={[L, 0.025, 0.02]} c="#eceff1" shadow={false} />
          </group>
        )}
      </Facade>
      <Door m={m} win={win} x={0.18} zf={F2} c="#37474f" />
      <Bay m={m} bulb={bulb} x={1.1} zf={F2} w={1.0} h={0.95} trim={pink} open />
      {/* The bay's lit back wall: a white booth with neon strips. */}
      <mesh position={[1.1, 0.48, F2 + 0.034]}><planeGeometry args={[0.88, 0.7]} />{m('#eceff1')}</mesh>
      {!ghost && [-0.3, 0, 0.3].map((x) => <Neon key={x} at={[1.1 + x, 0.62, F2 + 0.042]} s={[0.02, 0.5, 0.01]} c={x ? cyan : pink} />)}
      {/* Neon outlines that glow day and night. */}
      {!ghost && (
        <group>
          <Neon at={[0, 1.38, F2 + 0.012]} s={[W2 - 0.04, 0.04, 0.022]} c={cyan} />
          {[-1, 1].map((sd) => <Neon key={sd} at={[sd * (W2 / 2 + 0.006), 0.75, F2 - 0.02]} s={[0.025, 1.4, 0.022]} c={pink} />)}
          <Neon at={[-0.92, 0.1, F2 + 0.03]} s={[1.7, 0.03, 0.02]} c={pink} />
        </group>
      )}
      {/* Colour swatches down the side the road sees. */}
      {[cyan, pink, '#ffd600', '#76ff03', '#ff6d00', '#7c4dff'].map((c, i) => (
        <mesh key={c} position={[W2 / 2 + 0.006, 0.35 + (i % 2) * 0.17, 0.08 + Math.floor(i / 2) * 0.17 - 0.4]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[0.14, 0.14]} />
          {m(c)}
        </mesh>
      ))}
      <RoofSign m={m} text="WRAP LAB" at={[-0.8, top + (st === 3 ? 0.66 : 0), st === 3 ? Z2 + 0.12 : F2 - 0.18]} w={1.5} bg="#12061f" fg={cyan} board={pink} />
      {/* A car halfway through its wrap: magenta film laid over the back half,
          the next sheet hung ready on its frame beside it. */}
      {!ghost && (
        <Car at={[1.0, 0.05, 0.76]} rot={Math.PI / 2} body="coupe" color="#eceff1">
          <Box m={m} at={[0, 0.425, -0.16]} s={[0.5, 0.01, 0.3]} c={pink} shadow={false} />
          <Box m={m} at={[0, 0.3, -0.46]} rot={[-0.5, 0, 0]} s={[0.62, 0.01, 0.3]} c={pink} shadow={false} />
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.366, 0.22, -0.3]} s={[0.01, 0.18, 0.6]} c={pink} shadow={false} />)}
        </Car>
      )}
      {!ghost && (
        <group position={[1.72, 0.05, 0.85]}>
          {[-0.28, 0.28].map((z) => <Box key={z} m={m} at={[0, 0.4, z]} s={[0.04, 0.8, 0.04]} c="#37474f" />)}
          <Box m={m} at={[0, 0.8, 0]} s={[0.05, 0.05, 0.62]} c="#37474f" />
          <Cyl m={m} at={[0, 0.74, 0]} r={0.05} h={0.52} c={cyan} seg={10} rot={[Math.PI / 2, 0, 0]} />
          <Box m={m} at={[0.03, 0.46, 0]} s={[0.008, 0.52, 0.48]} c={cyan} shadow={false} />
        </group>
      )}
      {/* Vinyl rolls racked out front. */}
      {!ghost && (
        <group position={[-1.5, 0.05, 0.78]}>
          {[-0.22, 0.22].map((x) => (
            <group key={x}>
              <Box m={m} at={[x, 0.3, 0]} s={[0.04, 0.6, 0.04]} c="#37474f" />
              <Box m={m} at={[x, 0.015, 0]} s={[0.06, 0.03, 0.3]} c="#37474f" shadow={false} />
            </group>
          ))}
          {[cyan, pink, '#ffd600', '#76ff03', '#212121'].map((c, i) => (
            <Cyl key={c} m={m} at={[0, 0.16 + i * 0.1, 0.05]} r={0.045} h={0.4} c={c} seg={10} rot={[0, 0, Math.PI / 2]} />
          ))}
        </group>
      )}
      {!ghost && (
        <group position={[-0.62, 0.05, 0.86]}>
          <Cyl m={m} at={[0, 0.25, 0]} r={0.07} h={0.5} c={pink} seg={12} />
          <Cyl m={m} at={[0.17, 0.25, 0.02]} r={0.07} h={0.5} c={cyan} seg={12} />
        </group>
      )}
      {!ghost && <Lamp m={m} bulb={bulb} ghost={ghost} at={[0.3, 0, 0.98]} arm={Math.PI} />}
      {!ghost && <Pool r={0.85} x={-0.9} z={0.75} />}
      {/* Level 4: a wrapped delivery van and a magenta stripe up the facade. */}
      {st >= 2 && !ghost && <Car at={[-1.25, 0.05, 0.55]} rot={-Math.PI / 2} body="van" color={cyan} stripe={pink} />}
      {st >= 2 && <Box m={m} at={[0, h - 0.18, F2 + 0.01]} s={[W2 + 0.012, 0.14, 0.02]} c={pink} shadow={false} />}
      {/* Level 7: a wrapped print-room floor on the roof, striped in the brand colours. */}
      {st === 3 && (
        <group position={[-0.8, top, Z2 - 0.08]}>
          <Box m={m} at={[0, 0.3, 0]} s={[1.9, 0.6, 0.9]} c="#ffffff" t={awningTex(pink, '#263238')} />
          <mesh position={[0, 0.3, 0.456]}><planeGeometry args={[1.7, 0.34]} />{win}</mesh>
          <mesh position={[0.956, 0.3, 0]} rotation-y={Math.PI / 2}><planeGeometry args={[0.7, 0.34]} />{win}</mesh>
          <Box m={m} at={[0, 0.63, 0]} s={[1.98, 0.06, 0.98]} c={cyan} />
        </group>
      )}
      {/* Giant vinyl roll on a cradle, its sheet run out over the roof and a squeegee on it. */}
      <group position={[1.0, top, Z2 - 0.05]}>
        <Upright>
          <group scale={st === 3 ? 1.25 : st === 2 ? 1.12 : 1}>
            {[-0.5, 0.5].map((x) => (
              <group key={x}>
                <Box m={m} at={[x, 0.05, 0]} s={[0.08, 0.1, 0.5]} c="#455a64" />
                {[-1, 1].map((sd) => <Box key={sd} m={m} at={[x, 0.22, sd * 0.1]} rot={[sd * 0.5, 0, 0]} s={[0.06, 0.32, 0.06]} c="#455a64" />)}
              </group>
            ))}
            <Cyl m={m} at={[0, 0.42, 0]} r={0.3} h={1.0} c={pink} seg={20} rot={[0, 0, Math.PI / 2]} />
            <Cyl m={m} at={[0, 0.42, 0]} r={0.1} h={1.06} c="#fafafa" seg={12} rot={[0, 0, Math.PI / 2]} />
            <Box m={m} at={[0, 0.07, 0.3]} rot={[0.3, 0, 0]} s={[0.96, 0.012, 0.5]} c={pink} />
            <group position={[0.3, 0.02, 0.4]} rotation={[0, 0.6, 0]}>
              <Box m={m} at={[0, 0.02, 0]} s={[0.42, 0.04, 0.06]} c="#212121" />
              <Box m={m} at={[0, 0.09, 0]} s={[0.4, 0.12, 0.08]} c={cyan} />
            </group>
          </group>
        </Upright>
      </group>
    </ShellBuilding>
  )
}

function Dynolab({ k }: { k: K }) {
  const { m, win, bulb, ghost, lvl } = k
  const st = growthStage(lvl)
  const H = 1.55
  const h = H + levelLift(lvl) * GROW
  const top = h + 0.13
  const yellow = '#fdd835'
  return (
    <ShellBuilding m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} w={W2} d={D2} h0={H} z0={Z2} wall="#cfd8dc" tex="siding" roof={yellow} shopfront={null} grow={GROW} rowFrom={1.75}>
      <Lot m={m} w={3.9} d={1.88} z={0.01} />
      <Bay m={m} bulb={bulb} x={-0.85} zf={F2} w={1.4} h={1.05} trim={yellow} open />
      <Box m={m} at={[0, 1.27, F2 + 0.008]} s={[W2 + 0.012, 0.08, 0.016]} c="#212121" shadow={false} />
      {/* The lounge: windows either side of a door, to watch the runs. */}
      <Pane m={m} win={win} x={0.82} y={0.55} zf={F2} w={0.3} h={0.4} />
      <Door m={m} win={win} x={1.26} zf={F2} c="#212121" />
      <Pane m={m} win={win} x={1.68} y={0.55} zf={F2} w={0.24} h={0.4} />
      <Bay m={m} bulb={bulb} x={0.22} zf={F2} w={0.62} h={0.85} trim={yellow} />
      {/* The dyno: a car strapped down on the rollers, a fan blowing at its nose,
          its exhaust drawn off up a duct to a fan on the roof. */}
      {!ghost && (
        <group position={[-0.85, 0.05, 0.74]}>
          <Upright>
            <group>
              <Box m={m} at={[0, 0.02, 0]} s={[1.44, 0.04, 0.76]} c="#455a64" />
              {[-1, 1].map((sz) => <Box key={sz} m={m} at={[0, 0.044, sz * 0.36]} s={[1.44, 0.008, 0.04]} c={yellow} shadow={false} />)}
              {[-0.48, -0.32].map((x) => <Cyl key={x} m={m} at={[x, 0.05, 0]} r={0.06} h={0.68} c={CHROME} seg={10} rot={[Math.PI / 2, 0, 0]} />)}
              <group position={[0, 0.05, 0]} rotation-y={Math.PI / 2}>
                <CarModel body="widebody" color="#e53935" stripe="#212121" />
              </group>
              <group position={[0.84, 0, 0]}>
                {[-1, 1].map((sd) => <Box key={sd} m={m} at={[0, 0.16, sd * 0.16]} s={[0.06, 0.32, 0.05]} c={DARK} />)}
                <Cyl m={m} at={[0, 0.36, 0]} r={0.26} h={0.2} c={yellow} seg={18} rot={[0, 0, Math.PI / 2]} />
                <Cyl m={m} at={[0, 0.36, 0]} r={0.22} h={0.23} c={DARK} seg={18} rot={[0, 0, Math.PI / 2]} />
                {[0, 1].map((i) => <Box key={i} m={m} at={[-0.11, 0.36, 0]} rot={[i ? 0.8 : -0.8, 0, 0]} s={[0.02, 0.4, 0.04]} c="#90a4ae" shadow={false} />)}
              </group>
            </group>
          </Upright>
        </group>
      )}
      {/* Extraction duct from the tail pipe, across the apron and up the wall. */}
      <group>
        <Box m={m} at={[-1.73, (h + 0.4) / 2, F2 + 0.08]} s={[0.16, h + 0.4, 0.14]} c="#90a4ae" />
        {[0.5, 1.0].map((y) => <Box key={y} m={m} at={[-1.73, y, F2 + 0.08]} s={[0.18, 0.03, 0.16]} c="#607d8b" shadow={false} />)}
        <Box m={m} at={[-1.73, h + 0.42, F2 - 0.02]} s={[0.24, 0.16, 0.36]} c="#607d8b" />
        {!ghost && <Cyl m={m} at={[-1.73, 0.18, (F2 + 0.15 + 0.74) / 2]} r={0.05} h={0.74 - F2 - 0.15} c="#424242" seg={10} rot={[Math.PI / 2, 0, 0]} />}
      </group>
      {/* The power graph screen, its curves in neon. */}
      {!ghost && (
        <group position={[0.45, 0.05, 1.0]} rotation-y={0.35}>
          {[-0.22, 0.22].map((x) => <Box key={x} m={m} at={[x, 0.25, 0]} s={[0.04, 0.5, 0.04]} c={DARK} />)}
          <Box m={m} at={[0, 0.72, 0]} s={[0.62, 0.42, 0.05]} c="#212121" />
          <mesh position={[0, 0.72, 0.026]}><planeGeometry args={[0.56, 0.36]} />{m('#0d1b2a')}</mesh>
          {[[-0.24, 0.6, 0.12, 0.4], [-0.13, 0.66, 0.12, 0.6], [-0.02, 0.74, 0.12, 0.45], [0.09, 0.8, 0.12, 0.2], [0.2, 0.82, 0.12, -0.15]].map(([x, y, l, a]) => (
            <group key={x} position={[x, y, 0.032]} rotation-z={a}><Neon at={[0, 0, 0]} s={[l, 0.012, 0.004]} c="#76ff03" /></group>
          ))}
          {[[-0.24, 0.78, 0.12, 0.1], [-0.13, 0.79, 0.12, 0.05], [-0.02, 0.795, 0.12, -0.1], [0.09, 0.78, 0.12, -0.3], [0.2, 0.74, 0.12, -0.5]].map(([x, y, l, a]) => (
            <group key={x} position={[x, y, 0.034]} rotation-z={a}><Neon at={[0, 0, 0]} s={[l, 0.012, 0.004]} c="#ff1744" /></group>
          ))}
        </group>
      )}
      <RoofSign m={m} text="DYNO" at={[-0.85, top, F2 - 0.18]} w={1.2} bg="#212121" fg={yellow} board={yellow} />
      {!ghost && <Tyres m={m} at={st >= 2 ? [0.5, 0.05, 0.56] : [1.45, 0.05, 0.8]} n={4} band={yellow} />}
      {!ghost && <Lamp m={m} bulb={bulb} ghost={ghost} at={[1.86, 0, 0.45]} arm={-Math.PI / 2} />}
      {!ghost && <Pool r={0.9} x={-0.85} z={0.8} />}
      {/* Level 4: a checkered stripe and a second car waiting its run; level 7: the lab floor. */}
      {st >= 2 && <Box m={m} at={[0, 1.27, F2 + 0.018]} s={[W2 - 0.6, 0.08, 0.004]} c="#ffffff" t={checkerTex(16)} shadow={false} />}
      {st >= 2 && !ghost && <Car at={[1.32, 0.05, 0.74]} rot={Math.PI / 2} body="sports" color="#212121" stripe={yellow} />}
      {st === 3 && <RoofBox m={m} win={win} at={[-0.85, top, Z2 - 0.32]} w={1.7} d={0.6} h={0.55} wall="#455a64" cap={yellow} />}
      {/* Giant tachometer leaning back on its stand, needle in the red. */}
      <group position={[1.0, top, Z2 - 0.05]}>
        <Upright>
          <group scale={st === 3 ? 1.25 : st === 2 ? 1.12 : 1}>
            <Box m={m} at={[0, 0.04, 0]} s={[0.6, 0.08, 0.4]} c="#455a64" />
            {[-0.2, 0.2].map((x) => <Box key={x} m={m} at={[x, 0.26, -0.08]} s={[0.06, 0.4, 0.06]} c="#455a64" />)}
            <group position={[0, 0.6, 0]} rotation-x={-0.45}>
              <Cyl m={m} at={[0, 0, 0]} r={0.5} h={0.12} c={CHROME} seg={28} rot={[Math.PI / 2, 0, 0]} />
              <Cyl m={m} at={[0, 0, 0.004]} r={0.44} h={0.12} c="#212121" seg={28} rot={[Math.PI / 2, 0, 0]} />
              {Array.from({ length: 10 }, (_, i) => {
                const a = Math.PI * 1.25 - (i / 9) * Math.PI * 1.5
                return <Box key={i} m={m} at={[Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.068]} rot={[0, 0, a + Math.PI / 2]} s={[0.035, 0.1, 0.01]} c={i >= 8 ? '#ff1744' : '#fafafa'} shadow={false} />
              })}
              <group rotation-z={-0.62}>
                <Box m={m} at={[0, 0.15, 0.078]} s={[0.035, 0.32, 0.012]} c="#ff3d00" shadow={false} />
              </group>
              <Cyl m={m} at={[0, 0, 0.08]} r={0.05} h={0.03} c={yellow} seg={12} rot={[Math.PI / 2, 0, 0]} />
            </group>
          </group>
        </Upright>
      </group>
    </ShellBuilding>
  )
}

function Engines({ k }: { k: K }) {
  const { m, win, bulb, ghost, lvl } = k
  const st = growthStage(lvl)
  const brick = '#8d6e63'
  const slate = '#455a64'
  const w = W2, d = 1.4, z0 = -0.3, zf = z0 + d / 2
  const h = 1.35 + levelLift(lvl) * GROW
  // Sawtooth over the left two thirds; the right third is flat for the giant V8.
  const sw = 2.45, sx = -w / 2 + sw / 2
  const td = d / 3
  const rise = 0.34
  const rows: number[] = []
  for (let y = 1.6; y + 0.22 <= h - 0.1; y += 0.5) rows.push(y)
  return (
    <group>
      <Lot m={m} w={3.9} d={1.88} z={0.01} />
      <Box m={m} at={[0, h / 2, z0]} s={[w, h, d]} c={brick} t={brickTex(4, Math.max(1, Math.round(h * 1.4)))} />
      <Box m={m} at={[0, h + 0.04, z0]} s={[w + 0.06, 0.08, d + 0.06]} c={slate} />
      <mesh position={[sx + sw / 2 + (w / 2 - sx - sw / 2) / 2, h + 0.083, z0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w - sw - 0.06, d - 0.04]} />
        {m('#ffffff', gravelTex(1, 1))}
      </mesh>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[sx, h + 0.08, zf - i * td]}>
          <Tooth m={m} win={win} w={sw} d={td} rise={rise} c={roofOf(slate)} />
        </group>
      ))}
      {/* Stone band and arched factory windows, a floor of them per upgrade. */}
      <Box m={m} at={[0, 1.0, zf + 0.012]} s={[w + 0.012, 0.05, 0.03]} c="#d7ccc8" shadow={false} />
      <Facade at={[0, 0, zf]} len={w}>
        {(L) => rows.map((y) => Array.from({ length: Math.round(L / 0.62) }, (_, i) => -L / 2 + (i + 0.5) * (L / Math.round(L / 0.62))).map((x) => (
          <group key={`${y}${x}`}>
            <mesh position={[x, y, 0.006]}><planeGeometry args={[0.32, 0.36]} />{win}</mesh>
            <Box m={m} at={[x, y + 0.21, 0.02]} s={[0.4, 0.06, 0.04]} c="#d7ccc8" shadow={false} />
            <Box m={m} at={[x, y, 0.012]} s={[0.02, 0.36, 0.012]} c="#3e2723" shadow={false} />
          </group>
        )))}
      </Facade>
      {/* Bays, factory windows and the office door. */}
      <Bay m={m} bulb={bulb} x={-1.3} zf={zf} w={0.86} h={0.86} trim={slate} open />
      <Bay m={m} bulb={bulb} x={-0.3} zf={zf} w={0.86} h={0.86} trim={slate} />
      {[0.55, 1.08].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.55, zf + 0.006]}><planeGeometry args={[0.4, 0.5]} />{win}</mesh>
          <Box m={m} at={[x, 0.55, zf + 0.014]} s={[0.4, 0.02, 0.012]} c="#3e2723" shadow={false} />
          <Box m={m} at={[x, 0.55, zf + 0.014]} s={[0.02, 0.5, 0.012]} c="#3e2723" shadow={false} />
          <Box m={m} at={[x, 0.28, zf + 0.03]} s={[0.46, 0.04, 0.06]} c="#d7ccc8" shadow={false} />
          <Box m={m} at={[x, 0.83, zf + 0.02]} s={[0.48, 0.06, 0.04]} c="#d7ccc8" shadow={false} />
        </group>
      ))}
      <Door m={m} win={win} x={1.6} zf={zf} c="#3e2723" frame="#d7ccc8" />
      <Fascia m={m} text="ENGINES" at={[-0.15, 1.17, zf + 0.03]} w={1.1} bg="#fff8e1" fg="#3e2723" board="#212121" />
      {/* Gantry hoist with an engine hanging from its chain. */}
      {!ghost && (
        <group position={[-1.35, 0.05, 0.8]}>
          {[-0.48, 0.48].map((x) => (
            <group key={x}>
              <Box m={m} at={[x, 0.03, 0]} s={[0.08, 0.06, 0.5]} c="#f9a825" />
              {[-1, 1].map((sd) => <Box key={sd} m={m} at={[x, 0.6, sd * 0.11]} rot={[sd * 0.38, 0, 0]} s={[0.06, 1.2, 0.06]} c="#f9a825" />)}
            </group>
          ))}
          <Box m={m} at={[0, 1.18, 0]} s={[1.04, 0.08, 0.08]} c="#f9a825" />
          <Box m={m} at={[0.08, 1.1, 0]} s={[0.14, 0.08, 0.12]} c={DARK} />
          <Box m={m} at={[0.08, 0.77, 0]} s={[0.015, 0.6, 0.015]} c="#9e9e9e" shadow={false} />
          <Box m={m} at={[0.08, 0.06, 0]} s={[0.34, 0.12, 0.42]} c="#1565c0" />
          <group position={[0.08, 0.12, 0]} scale={0.95}><Engine m={m} cover="#1565c0" /></group>
        </group>
      )}
      {/* Engines on their stands, out for the rebuild. */}
      {!ghost && [0.15, 0.78].map((x, i) => (
        <group key={x} position={[x, 0.05, 0.92]}>
          <Box m={m} at={[0, 0.02, 0]} s={[0.36, 0.04, 0.06]} c="#c62828" />
          <Box m={m} at={[0, 0.02, 0]} s={[0.06, 0.04, 0.36]} c="#c62828" />
          <Box m={m} at={[0, 0.17, 0]} s={[0.05, 0.26, 0.05]} c="#c62828" />
          <group position={[0, 0.3, 0]} scale={0.85} rotation-y={i ? -0.5 : 0.4}><Engine m={m} cover={i ? '#c62828' : '#2e7d32'} /></group>
        </group>
      ))}
      {!ghost && <Drum m={m} at={[1.75, 0.05, 0.62]} c="#455a64" />}
      {!ghost && <Drum m={m} at={[1.62, 0.05, 0.86]} c="#c62828" />}
      {!ghost && <Lamp m={m} bulb={bulb} ghost={ghost} at={[1.25, 0, 0.98]} arm={Math.PI} />}
      {!ghost && <Pool r={0.9} x={-0.8} z={0.8} />}
      {/* Level 4: a brick chimney; level 7: a second one and a water tower: an engine factory. */}
      {st >= 2 && (
        <group position={[-1.55, 0, -0.74]}>
          <Box m={m} at={[0, (h + 1.3) / 2, 0]} s={[0.3, h + 1.3, 0.3]} c={brick} t={brickTex(1, Math.max(1, Math.round(h + 1.3)))} />
          {[h + 0.9, h + 1.25].map((y) => <Box key={y} m={m} at={[0, y, 0]} s={[0.36, 0.06, 0.36]} c="#d7ccc8" shadow={false} />)}
        </group>
      )}
      {st === 3 && (
        <group position={[-0.95, 0, -0.74]}>
          <Box m={m} at={[0, (h + 1.0) / 2, 0]} s={[0.26, h + 1.0, 0.26]} c={brick} t={brickTex(1, Math.max(1, Math.round(h + 1)))} />
          <Box m={m} at={[0, h + 0.95, 0]} s={[0.32, 0.06, 0.32]} c="#d7ccc8" shadow={false} />
        </group>
      )}
      {st === 3 && <WaterTank m={m} at={[1.62, h + 0.08, -0.82]} s={1} />}
      {!ghost && <Trims m={m} lvl={lvl} w={w} d={d} h={h + 0.08} z0={z0} flag={brick} />}
      {/* Giant V8 on the flat end of the roof. */}
      <group position={[st === 3 ? 1.08 : 1.15, h + 0.08, z0 + 0.12]}>
        <Upright>
          <group scale={st === 3 ? 2.5 : st === 2 ? 2.4 : 2.2} rotation-y={0.35}>
            <Box m={m} at={[0, 0.02, 0]} s={[0.36, 0.04, 0.44]} c={slate} />
            <group position-y={0.04}>
              <Engine m={m} air />
              {[-1, 1].map((sd) => [-0.1, 0, 0.1].map((z) => (
                <Cyl key={`${sd}${z}`} m={m} at={[sd * 0.2, 0.17, z]} r={0.018} h={0.1} c={CHROME} seg={6} rot={[0, 0, Math.PI / 2]} />
              )))}
            </group>
          </group>
        </Upright>
      </group>
    </group>
  )
}

function RaceFab({ k }: { k: K }) {
  const { m, win, bulb, ghost, lvl } = k
  const st = growthStage(lvl)
  const red = '#d50000'
  const H = 1.7
  const h = H + levelLift(lvl) * GROW
  const top = h + 0.13
  const x0 = -0.45, w = 2.9, d = 1.7, z0 = -1.08, zf = z0 + d / 2
  const tower = st === 3 ? 0.9 : 0
  return (
    <group>
      <Lot m={m} w={3.9} d={3.9} />
      <ShellBuilding m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} w={w} d={d} h0={H} z0={z0} x0={x0} wall="#fafafa" tex="siding" roof={red} shopfront={null} grow={GROW} rowFrom={1.85}>
        {/* Team stripes: a red band and a thin black one over the bays. */}
        <Box m={m} at={[0, 1.3, zf + 0.008]} s={[w + 0.012, 0.12, 0.016]} c={red} shadow={false} />
        <Box m={m} at={[0, 1.42, zf + 0.008]} s={[w + 0.012, 0.03, 0.016]} c="#212121" shadow={false} />
        <Bay m={m} bulb={bulb} x={-0.9} zf={zf} w={0.95} h={1.08} trim="#212121" open />
        <Bay m={m} bulb={bulb} x={0.2} zf={zf} w={0.95} h={1.08} trim="#212121" />
        <mesh position={[1.08, 0.62, zf + 0.006]}><planeGeometry args={[0.5, 0.6]} />{win}</mesh>
        <Door m={m} win={win} x={1.08} zf={zf} c="#212121" />
      </ShellBuilding>
      <RoofSign m={m} text="RACE FAB" at={[-1.1, top, zf - 0.2]} w={1.6} bg="#fafafa" fg={red} board={red} />
      {/* The race car out of its bay, on the apron. */}
      {!ghost && <Car at={[-1.35, 0.05, 0.12]} rot={0} body="formula" color={red} stripe="#fafafa" />}
      {/* Tyre stacks and a tool chest by the bays. */}
      {!ghost && [[-0.45, 0.0], [-0.2, 0.1], [-0.45, 0.28]].map(([x, z], i) => <Tyres key={i} m={m} at={[x, 0.05, z]} n={4} band={i % 2 ? '#fafafa' : red} />)}
      {!ghost && (
        <group position={[0.35, 0.05, -0.05]} userData={PEOPLE_SIZED}>
          <Box m={m} at={[0, 0.22, 0]} s={[0.4, 0.44, 0.22]} c={red} />
          {[0.1, 0.2, 0.3].map((y) => <Box key={y} m={m} at={[0, y, 0.112]} s={[0.34, 0.012, 0.006]} c="#eceff1" shadow={false} />)}
        </group>
      )}
      {/* The team transporter along the side: cab up front, the trailer in team colours. */}
      {!ghost && (
        <group position={[1.48, 0, -0.35]}>
          <Upright size={1}>
            <group userData={{ whole: true }}>
              <Box m={m} at={[0, 0.5, -0.45]} s={[0.66, 0.78, 2.3]} c="#fafafa" />
              <Box m={m} at={[0.333, 0.62, -0.45]} s={[0.006, 0.18, 2.26]} c={red} shadow={false} />
              <Box m={m} at={[0.333, 0.32, -0.45]} s={[0.006, 0.05, 2.26]} c="#212121" shadow={false} />
              <Box m={m} at={[0, 0.9, -0.45]} s={[0.68, 0.03, 2.32]} c={red} />
              <group position={[0.338, 0.47, -0.45]} rotation-y={Math.PI / 2}>
                <Sign text="RACE FAB" w={1.1} at={[0, 0, 0]} bg="#fafafa" fg={red} />
              </group>
              <Box m={m} at={[0, 0.2, 0.7]} s={[0.2, 0.1, 0.12]} c={DARK} />
              <Box m={m} at={[0, 0.48, 1.04]} s={[0.66, 0.6, 0.56]} c={red} />
              <Box m={m} at={[0, 0.62, 1.322]} s={[0.56, 0.24, 0.006]} c="#263238" shadow={false} />
              <Box m={m} at={[0, 0.82, 0.94]} s={[0.6, 0.06, 0.36]} c="#fafafa" />
              {[-0.336, 0.336].map((x) => [1.1, -0.9, -1.25].map((z) => (
                <Cyl key={`${x}${z}`} m={m} at={[x, 0.15, z]} r={0.15} h={0.08} c={TYRE} seg={12} rot={[0, 0, Math.PI / 2]} />
              )))}
            </group>
          </Upright>
        </group>
      )}
      {/* The pit wall along the front: a barrier, the debris fence and the team's stand. */}
      <group position={[-0.45, 0, 1.62]}>
        <Box m={m} at={[0, 0.16, 0]} s={[2.9, 0.22, 0.14]} c="#eceff1" />
        <Box m={m} at={[0, 0.2, 0.072]} s={[2.88, 0.06, 0.006]} c={red} shadow={false} />
        {Array.from({ length: 7 }, (_, i) => <Box key={i} m={m} at={[-1.4 + i * (2.8 / 6), 0.55, -0.03]} s={[0.03, 0.6, 0.03]} c={STEEL} shadow={false} />)}
        <Box m={m} at={[0, 0.84, -0.03]} s={[2.86, 0.025, 0.025]} c={STEEL} shadow={false} />
      </group>
      {!ghost && (
        <group position={[0.58, 0.05, 1.18]}>
          <Box m={m} at={[0, 0.15, 0]} s={[0.84, 0.3, 0.4]} c="#37474f" />
          {[-0.38, 0.38].flatMap((x) => [-0.17, 0.17].map((z) => <Box key={`${x}${z}`} m={m} at={[x, 0.6, z]} s={[0.04, 0.6, 0.04]} c={STEEL} shadow={false} />))}
          <Box m={m} at={[0, 0.92, 0]} s={[0.9, 0.04, 0.46]} c={red} />
          {[-0.25, 0.05, 0.3].map((x) => (
            <group key={x}>
              <Box m={m} at={[x, 0.46, 0.12]} s={[0.22, 0.14, 0.03]} c="#212121" />
              <mesh position={[x, 0.46, 0.142]}><planeGeometry args={[0.18, 0.1]} />{m('#4fc3f7')}</mesh>
              <Box m={m} at={[x, 0.34, -0.06]} s={[0.12, 0.08, 0.12]} c="#212121" />
            </group>
          ))}
        </group>
      )}
      {!ghost && <Lamp m={m} bulb={bulb} ghost={ghost} at={[-1.85, 0, 0.75]} arm={Math.PI / 2} />}
      {!ghost && <Lamp m={m} bulb={bulb} ghost={ghost} at={[0.75, 0, 0.55]} arm={-Math.PI / 2} />}
      {!ghost && <Pool r={1.0} x={-0.9} z={0.1} />}
      {/* Level 4: a second car on stands; level 7: the HQ tower and team flags on the pit wall. */}
      {st >= 2 && !ghost && <Car at={[-0.45, 0.05, 1.0]} rot={Math.PI / 2} body="prototype" color="#fafafa" stripe={red} />}
      {st === 3 && (
        <group position={[0.35, top, z0 - 0.15]}>
          <Box m={m} at={[0, tower / 2, 0]} s={[1.1, tower, 1.1]} c="#212121" />
          {[0.25, 0.6].map((y) => (
            <group key={y}>
              <mesh position={[0, y, 0.556]}><planeGeometry args={[1.0, 0.24]} />{win}</mesh>
              <mesh position={[0.556, y, 0]} rotation-y={Math.PI / 2}><planeGeometry args={[1.0, 0.24]} />{win}</mesh>
            </group>
          ))}
          <Box m={m} at={[0, tower + 0.04, 0]} s={[1.18, 0.08, 1.18]} c={red} />
        </group>
      )}
      {st === 3 && !ghost && [-1.6, -0.7, 0.2].map((x, i) => <Flag key={x} at={[x, 0.27, 1.6]} color={i % 2 ? '#fafafa' : red} tall={1.1} />)}
      {/* Giant rear wing on two pylons. */}
      <group position={[0.35, top + tower + (st === 3 ? 0.08 : 0), z0 - 0.15]}>
        <Upright>
          <group scale={st === 3 ? 1.0 : st === 2 ? 1.2 : 1.1}>
            {[-0.25, 0.25].map((x) => (
              <group key={x}>
                <Box m={m} at={[x, 0.02, 0]} s={[0.14, 0.04, 0.3]} c="#212121" />
                <Box m={m} at={[x, 0.3, 0.02]} rot={[-0.2, 0, 0]} s={[0.05, 0.56, 0.12]} c="#212121" />
              </group>
            ))}
            {[-0.66, 0.66].map((x) => <Box key={x} m={m} at={[x, 0.66, 0]} s={[0.05, 0.42, 0.66]} c={red} />)}
            <Box m={m} at={[0, 0.58, 0]} rot={[0.18, 0, 0]} s={[1.27, 0.05, 0.5]} c="#fafafa" />
            <Box m={m} at={[0, 0.76, -0.2]} rot={[0.5, 0, 0]} s={[1.27, 0.04, 0.24]} c={red} />
            <Box m={m} at={[0, 0.605, 0.18]} rot={[0.18, 0, 0]} s={[1.2, 0.006, 0.08]} c="#212121" shadow={false} />
          </group>
        </Upright>
      </group>
    </group>
  )
}

export function CarShopModel({ def, ghost, m, win, bulb, level = 1 }: NewModelProps) {
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  const k: K = { m, win, bulb, ghost, lvl }
  switch (def.id) {
    case 'muffler': return <Muffler k={k} />
    case 'brakes': return <Brakes k={k} />
    case 'wraps': return <Wraps k={k} />
    case 'dynolab': return <Dynolab k={k} />
    case 'engines': return <Engines k={k} />
    case 'racefab': return <RaceFab k={k} />
    default:
      return <ShellBuilding m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} w={def.w * 1.7} d={def.h * 1.3} h0={1.3} wall={def.color} roof={def.roof} sign={def.sign} shopfront={def.roof} />
  }
}
