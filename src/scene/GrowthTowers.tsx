import type { ReactNode } from 'react'
import { CylinderGeometry } from 'three'
import type { BuildingDef } from '../game/data'
import { growthStage, midFloors, towerFloors } from '../game/growth'
import { Box, Cyl, Sign, Pool, Neon, Bulbs, Flag, Parasol, BlockCar, GOLD, type Mat, type V3 } from './NewBuildings'
import { Glass, GlassBlock, glassMat, LitSign, RoofPlant, PadLights } from './OfficeBuildings'
import { CarModel } from './CarModel'
import { Upright, useBays, useMergeScale } from './mergeScale'
import { WashCenter } from './WashCenter'
import { isMarketCenter } from '../game/marketCenter'
import { isResort } from '../game/resortCenter'
import { ResortCenter } from './ResortCenter'
import { MarketCenter } from './MarketCenter'
import { isWashCenter } from '../game/washCenter'
import { ShopTower } from './ShopTower'
import { glowMats } from './dayNight'
import { concreteTex, helipadTex, shutterTex, gravelTex } from './textures'
import { Storefront, BrickFloors, StoneShaft, GlassDrum, WaterTank, GiantProp, Beacon, type Kit, type Giant } from './GrowthKit'
import { PEOPLE_SIZED } from './keepShape'
import { LAYER } from './layers'

// The grown forms of shops and services (names in src/game/growth.ts). Level
// 4-6 rebuilds the business as a bigger building of its kind (a brick walk-up
// over the shop, a hotel, a plaza), one floor more each level; level 7-10 is a
// tower on the shop's ground floor, 9 to 19 floors, crowned with the business's
// giant sign prop. Lots face +z like the rest of the town.

type Props = { def: BuildingDef; ghost?: boolean; m: Mat; win: ReactNode; bulb: ReactNode; level: number }


// Spray in the air: meant to float (see floating.ts).
const AIR = { air: true }

// Rooftop sign on a steel frame, like the old downtown walk-ups.
function RoofSign({ m, text, w, at, bg, fg, board, ghost }: { m: Mat; text: string; w: number; at: V3; bg: string; fg: string; board: string; ghost?: boolean }) {
  return (
    <group position={at}>
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[(sd * w) / 2.6, 0.12, -0.06]} s={[0.03, 0.24, 0.03]} c="#37474f" shadow={false} />)}
      <Box m={m} at={[0, 0.11, -0.18]} rot={[-0.73, 0, 0]} s={[0.03, 0.03, 0.33]} c="#37474f" shadow={false} />
      <Box m={m} at={[0, 0.24 + w / 8, -0.03]} s={[w + 0.08, w / 4 + 0.08, 0.05]} c={board} shadow={false} />
      {!ghost && <Sign text={text} w={w} at={[0, 0.24 + w / 8, 0]} bg={bg} fg={fg} />}
      <Bulbs from={[-w / 2, 0.28 + w / 4 + 0.04, 0.03]} to={[w / 2, 0.28 + w / 4 + 0.04, 0.03]} n={7} />
    </group>
  )
}

// ---- Food shops: a brick walk-up at 4-6, a tower with a giant prop at 7-10 ----

type Food = {
  wall: string; brick: string; trim: string; awning: string; sign: string; signFg: string; board: string; cafe?: string; giant: Giant
}

const FOOD: Record<string, Food> = {
  pizza: {
    wall: '#c0504d', brick: '#a8483a', trim: '#f5f5f5', awning: '#c62828', sign: 'PIZZA', signFg: '#c62828', board: '#f5f5f5', cafe: '#c62828', giant: 'pizza',
  },
  donut: {
    wall: '#f48fb1', brick: '#ec7aa3', trim: '#fff8e1', awning: '#f06292', sign: 'DONUTS', signFg: '#d81b60', board: '#fff8e1', cafe: '#f06292', giant: 'donut',
  },
  burger: {
    wall: '#ffb300', brick: '#b5532e', trim: '#fff3e0', awning: '#d84315', sign: 'BURGERS', signFg: '#d84315', board: '#fff3e0', cafe: '#d84315', giant: 'burger',
  },
  icecream: {
    wall: '#b3e5fc', brick: '#e1bee7', trim: '#ffffff', awning: '#f06292', sign: 'ICE CREAM', signFg: '#ec407a', board: '#ffffff', cafe: '#4fc3f7', giant: 'cone',
  },
  coffee: {
    wall: '#8d6e63', brick: '#6d4c41', trim: '#e8f5e9', awning: '#2e7d32', sign: 'COFFEE', signFg: '#2e7d32', board: '#e8f5e9', cafe: '#2e7d32', giant: 'mug',
  },
}

function FoodModel({ def, ghost, m, win, bulb, level }: Props) {
  const f = FOOD[def.id]
  const k: Kit = { m, win, bulb, ghost }
  const st = growthStage(level)
  if (st === 2) {
    const fl = midFloors(level)
    const H = 1.0 + fl * 0.44
    return (
      <group>
        <Storefront k={k} w={1.7} d={1.45} z0={-0.1} h={1.0} wall={f.wall} tex="brick" trim={f.trim} awning={f.awning} cafe={f.cafe} />
        <BrickFloors k={k} w={1.7} d={1.45} z0={-0.1} y0={1.0} floors={fl} wall={f.brick} trim={f.trim} />
        <RoofSign m={m} text={f.sign} w={1.2} at={[0, H + 0.1, 0.5]} bg="#fffde7" fg={f.signFg} board={f.board} ghost={ghost} />
        {!ghost && <WaterTank m={m} at={[-0.45, H + 0.1, -0.45]} />}
        <GiantProp m={m} kind={f.giant} at={[0.32, H + 0.1, -0.35]} s={0.85} plinth={f.trim} />
        {level >= 6 && !ghost && <Flag at={[-0.7, H + 0.1, 0.45]} color={f.awning} />}
      </group>
    )
  }
  return <ShopTower def={def} ghost={ghost} m={m} win={win} bulb={bulb} level={level} look={{ sign: f.sign, color: f.awning, brick: f.brick, giant: f.giant }} />
}

// ---- Diner: streamline moderne, rounded ends and ribbon windows ----

const ribbons = new Map<string, CylinderGeometry>()
function ribbonGeo(r: number, h: number) {
  const key = `${r.toFixed(2)}x${h.toFixed(2)}`
  let g = ribbons.get(key)
  if (g) return g
  g = new CylinderGeometry(r, r, h, 24, 1, true)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * 2 * r) / 0.72, (uv.getY(i) * h) / 1.2)
  ribbons.set(key, g)
  return g
}

// A rounded-end block: flat sides in the middle, half drums at each end, a
// band of glass round every floor and chrome lines between. Along a pair it's
// drawn in true shape, just longer (or deeper), so its ends stay round.
function StreamBlock({ k, x = 0, z, y0, len: len0, d: d0, floors, fh, wall, chrome, tint }: { k: Kit; x?: number; z: number; y0: number; len: number; d: number; floors: number; fh: number; wall: string; chrome: string; tint: string }) {
  const { m, ghost } = k
  const [bx, bz] = useBays()
  const len = len0 * bx
  const d = d0 * bz
  const r = d / 2
  const H = floors * fh
  const flat = len - d
  const glass = (key: string, at: V3, geo: CylinderGeometry) => (
    <mesh key={key} position={at} geometry={geo}>
      {ghost ? m(tint) : <primitive object={glassMat(tint)} attach="material" dispose={null} />}
    </mesh>
  )
  return (
    <group position={[x, 0, z]}>
      <Upright>
        <Box m={m} at={[0, y0 + H / 2, 0]} s={[flat, H, d]} c={wall} />
        {[-1, 1].map((sd) => <Cyl key={sd} m={m} at={[(sd * flat) / 2, y0 + H / 2, 0]} r={r} h={H} c={wall} seg={24} />)}
        {Array.from({ length: floors }, (_, i) => {
          const y = y0 + i * fh + fh * 0.55
          return (
            <group key={i}>
              <Glass m={m} ghost={ghost} at={[0, y, r + 0.004]} w={flat} h={fh * 0.5} tint={tint} />
              <Glass m={m} ghost={ghost} at={[0, y, -r - 0.004]} w={flat} h={fh * 0.5} ry={Math.PI} tint={tint} />
              {[-1, 1].map((sd) => glass(`${sd}`, [(sd * flat) / 2, y, 0], ribbonGeo(r + 0.004, fh * 0.5)))}
              {!ghost && <Box m={m} at={[0, y0 + i * fh, r + 0.01]} s={[flat, 0.025, 0.02]} c={chrome} shadow={false} />}
            </group>
          )
        })}
        <Box m={m} at={[0, y0 + H + 0.04, 0]} s={[flat, 0.08, d + 0.08]} c={chrome} />
        {[-1, 1].map((sd) => <Cyl key={sd} m={m} at={[(sd * flat) / 2, y0 + H + 0.04, 0]} r={r + 0.04} h={0.08} c={chrome} seg={24} />)}
      </Upright>
    </group>
  )
}

// Googie starburst on a mast.
function Starburst({ m, at, c }: { m: Mat; at: V3; c: string }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.35, 0]} r={0.025} h={0.7} c="#eceff1" seg={6} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Box key={i} m={m} at={[0, 0.8 + i * 0.002, 0]} rot={[0, (i * Math.PI) / 6, (i * Math.PI) / 3]} s={[0.5, 0.03, 0.03]} c={i % 2 ? c : GOLD} shadow={false} />
      ))}
      <mesh position={[0, 0.8, 0]}><sphereGeometry args={[0.06, 10, 8]} /><primitive object={glowMats.bulb} attach="material" dispose={null} /></mesh>
    </group>
  )
}

function DinerModel({ def, ghost, m, win, bulb, level }: Props) {
  const k: Kit = { m, win, bulb, ghost }
  const st = growthStage(level)
  const wall = '#eceff1'
  const tint = '#b3e5fc'
  if (st === 2) {
    const fl = midFloors(level) - 1
    const H = fl * 0.42 + 0.95
    return (
      <group>
        {/* Diner car below, two to four floors of streamline flats above. */}
        <StreamBlock k={k} z={-0.15} y0={0} len={3.5} d={1.4} floors={1} fh={0.95} wall={def.color} chrome="#eceff1" tint={tint} />
        <StreamBlock k={k} z={-0.2} y0={1.0} len={3.2} d={1.2} floors={fl} fh={0.42} wall={wall} chrome={def.roof} tint={tint} />
        <Box m={m} at={[0, 0.5, 0.57]} s={[0.5, 0.82, 0.02]} c="#eceff1" shadow={false} />
        <mesh position={[0, 0.42, 0.585]}><planeGeometry args={[0.4, 0.7]} />{m('#37474f')}</mesh>
        <Box m={m} at={[0, 0.9, 0.78]} s={[1.2, 0.04, 0.42]} c={def.roof} />
        {[-0.55, 0.55].map((x) => <Cyl key={x} m={m} at={[x, 0.45, 0.95]} r={0.02} h={0.9} c="#eceff1" seg={6} />)}
        <Bulbs from={[-0.6, 0.86, 0.99]} to={[0.6, 0.86, 0.99]} n={7} />
        <RoofSign m={m} text="DINER" w={1.3} at={[0.6, H + 0.06, 0.25]} bg="#fffde7" fg="#c62828" board={def.roof} ghost={ghost} />
        <Starburst m={m} at={[-1.0, H + 0.08, -0.2]} c={def.roof} />
        {!ghost && <Pool r={0.8} z={0.9} />}
        {!ghost && [-1.35, 1.35].map((x) => <Parasol key={x} m={m} at={[x, 0, 0.78]} c={def.roof} />)}
      </group>
    )
  }
  return <ShopTower def={def} ghost={ghost} m={m} win={win} bulb={bulb} level={level} look={{ sign: 'DINER', color: def.roof, brick: '#8f3a3a', crown: <group scale={2.2}><Starburst m={m} at={[0, -0.04, 0]} c={def.roof} /></group> }} />
}

// ---- Bowling: a wide alley with a pin pylon, then a tower with a giant pin ----

function BowlingModel({ def, ghost, m, win, bulb, level }: Props) {
  const k: Kit = { m, win, bulb, ghost }
  if (growthStage(level) === 2) {
    const fl = midFloors(level) - 2
    const H = 1.05 + fl * 0.44
    return (
      <group>
        <Storefront k={k} w={3.5} d={1.45} z0={-0.2} h={1.05} wall={def.color} tex="plain" trim="#ede7f6" awning="#7e57c2" />
        <BrickFloors k={k} w={3.5} d={1.45} z0={-0.2} y0={1.05} floors={fl} wall="#5e35b1" trim="#ede7f6" tex="plain" escape={false} />
        {/* Zig-zag Googie roof line. */}
        {[-1.3, -0.45, 0.4, 1.25].map((x, i) => (
          <Box key={x} m={m} at={[x, H + 0.2, -0.2]} rot={[0, 0, i % 2 ? 0.35 : -0.35]} s={[0.9, 0.05, 1.55]} c="#ede7f6" />
        ))}
        {!ghost && <LitSign text="BOWLING" w={1.6} at={[0, H - 0.21, 0.536]} bg="#311b92" fg="#ffeb3b" m={m} />}
        {/* The pylon: a tall mast with a giant pin and ball on top. */}
        <group position={[1.55, 0, 0.75]}>
          <Cyl m={m} at={[0, (H + 0.8) / 2, 0]} r={0.05} h={H + 0.8} c="#eceff1" seg={8} />
          <GiantProp m={m} kind="pin" at={[0, H + 0.8, 0]} s={0.75} plinth="#7e57c2" />
        </group>
        {!ghost && <Pool r={0.8} z={0.9} />}
      </group>
    )
  }
  return <ShopTower def={def} ghost={ghost} m={m} win={win} bulb={bulb} level={level} look={{ sign: 'BOWLING', color: '#7e57c2', brick: '#4a2f8a', giant: 'pin' }} />
}

// ---- Motel: a hotel with balconies, then a grand hotel tower with a roof pool ----

function Balconies({ m, w, z, ys, c, rail }: { m: Mat; w: number; z: number; ys: number[]; c: string; rail: string }) {
  const n = Math.max(2, Math.round(w / 0.55))
  return (
    <group>
      {ys.flatMap((y) => Array.from({ length: n }, (_, i) => {
        const x = ((i + 0.5) / n - 0.5) * w * 0.9
        return (
          <group key={`${y}:${i}`} position={[x, y, z]}>
            <Box m={m} at={[0, 0, 0.09]} s={[w / n - 0.08, 0.025, 0.18]} c={c} shadow={false} />
            <Box m={m} at={[0, 0.07, 0.175]} s={[w / n - 0.08, 0.11, 0.012]} c={rail} shadow={false} />
          </group>
        )
      }))}
    </group>
  )
}

function MotelModel({ def, ghost, m, win, bulb, level }: Props) {
  const scale = useMergeScale()
  if (isResort(def.id, level, scale)) return <ResortCenter m={m} win={win} bulb={bulb} level={level} ghost={ghost} />
  const k: Kit = { m, win, bulb, ghost }
  const teal = def.roof
  if (growthStage(level) === 2) {
    const fl = midFloors(level)
    const fh = 0.42
    const H = 0.95 + fl * fh
    const ys = Array.from({ length: fl }, (_, i) => 0.95 + i * fh)
    return (
      <group>
        <Storefront k={k} w={3.4} d={1.3} z0={-0.3} h={0.95} wall={def.color} tex="plain" trim="#fafafa" awning={teal} />
        <BrickFloors k={k} w={3.4} d={1.3} z0={-0.3} y0={0.95} floors={fl} fh={fh} wall={def.color} trim="#fafafa" tex="plain" escape={false} />
        <Balconies m={m} w={3.4} z={0.35} ys={ys} c="#fafafa" rail={teal} />
        {/* Porte-cochere over the door, and the name on the roof. */}
        <Box m={m} at={[0, 0.88, 0.75]} s={[1.3, 0.06, 0.8]} c={teal} />
        {[-0.6, 0.6].map((x) => <Cyl key={x} m={m} at={[x, 0.44, 1.08]} r={0.03} h={0.88} c="#fafafa" seg={8} />)}
        <Bulbs from={[-0.62, 0.84, 1.15]} to={[0.62, 0.84, 1.15]} n={7} />
        <RoofSign m={m} text="HOTEL" w={1.5} at={[-0.6, H + 0.1, 0.1]} bg="#fffde7" fg={teal} board={teal} ghost={ghost} />
        {!ghost && <RoofPlant m={m} at={[1.1, H + 0.1, -0.5]} />}
        {!ghost && <Pool r={0.9} z={1.0} />}
      </group>
    )
  }
  return <ShopTower def={def} ghost={ghost} m={m} win={win} bulb={bulb} level={level} look={{ sign: 'HOTEL', color: teal, brick: '#a1887f' }} />
}

// ---- Fresh Mart: a two-level plaza with roof parking, then a tower ----

function MarketModel({ def, ghost, m, win, bulb, level }: Props) {
  const scale = useMergeScale()
  if (isMarketCenter(def.id, level, scale)) return <MarketCenter m={m} win={win} bulb={bulb} level={level} ghost={ghost} />
  const k: Kit = { m, win, bulb, ghost }
  const green = def.roof
  if (growthStage(level) === 2) {
    const decks = level - 3
    const H = 1.0 + 0.6 * decks
    return (
      <group>
        <Storefront k={k} w={3.6} d={1.6} z0={-0.15} h={1.0} wall={def.color} tex="plain" trim="#fafafa" awning="#43a047" />
        {/* Parking decks over the store, with cars and a ramp down the side. */}
        {Array.from({ length: decks }, (_, i) => {
          const y = 1.0 + i * 0.6
          return (
            <group key={i}>
              <Box m={m} at={[0, y + 0.3, -0.15]} s={[3.6, 0.6, 1.6]} c="#9e9e9e" t={concreteTex(3, 1)} />
              <Box m={m} at={[0, y + 0.3, 0.66]} s={[3.62, 0.36, 0.02]} c="#424242" shadow={false} />
              <Box m={m} at={[0, y + 0.52, 0.665]} s={[3.62, 0.08, 0.03]} c={green} shadow={false} />
              {!ghost && [-1.2, -0.4, 0.4, 1.2].map((x, j) => (j + i) % 3 === 2 ? null : <BlockCar key={x} m={m} at={[x, y + 0.24, 0.45]} c={['#e53935', '#1e88e5', '#fdd835', '#eceff1'][(j + i) % 4]} rot={0} />)}
            </group>
          )
        })}
        <Box m={m} at={[0, H + 0.03, -0.15]} s={[3.66, 0.06, 1.66]} c="#757575" />
        {!ghost && [-1.0, 0, 1.0].map((x) => <Box key={x} m={m} at={[x, H + 0.065, -0.15]} s={[0.04, 0.005, 0.9]} c="#fafafa" shadow={false} />)}
        <Box m={m} at={[-1.9, (H + 0.1) / 2, -0.1]} rot={[0, 0, 0.0]} s={[0.25, H + 0.1, 1.4]} c="#8d8d8d" t={concreteTex(1, 2)} />
        <RoofSign m={m} text="FRESH MART" w={1.6} at={[0.8, H + 0.06, 0.45]} bg="#fffde7" fg={green} board={green} ghost={ghost} />
        <GiantProp m={m} kind="apple" at={[-1.0, H + 0.06, 0.2]} s={0.8} plinth="#fafafa" />
        {!ghost && [-1.25, 1.25].map((x) => <Parasol key={x} m={m} at={[x, 0, 0.85]} c="#43a047" />)}
        {!ghost && <Pool r={0.9} z={0.95} />}
      </group>
    )
  }
  return <ShopTower def={def} ghost={ghost} m={m} win={win} bulb={bulb} level={level} look={{ sign: 'FRESH MART', color: green, brick: '#8d6e63', giant: 'apple' }} />
}

// ---- Pixel Palace: a neon block, then a tower of offset glowing boxes ----

function ArcadeModel({ def, ghost, m, win, bulb, level }: Props) {
  const k: Kit = { m, win, bulb, ghost }
  const violet = '#4527a0'
  const neon = ['#ff4fd8', '#00e5ff', '#76ff03', '#ffea00']
  if (growthStage(level) === 2) {
    const fl = midFloors(level)
    const H = 1.0 + fl * 0.42
    return (
      <group>
        <Storefront k={k} w={1.7} d={1.4} z0={-0.1} h={1.0} wall={violet} tex="plain" trim="#1a1035" awning="#ec407a" />
        <BrickFloors k={k} w={1.7} d={1.4} z0={-0.1} y0={1.0} floors={fl} fh={0.42} wall="#311b92" trim="#1a1035" tex="plain" escape={false} />
        {!ghost && (
          <group>
            {/* A big screen on the front with pixel blocks, neon round the edges. */}
            <Box m={m} at={[0, 1.0 + (fl * 0.42) / 2, 0.62]} s={[1.1, fl * 0.42 - 0.2, 0.04]} c="#120818" shadow={false} />
            {Array.from({ length: 12 }, (_, i) => (
              <Neon key={i} at={[-0.4 + (i % 4) * 0.27, 1.25 + Math.floor(i / 4) * 0.22 * (fl / 3), 0.645]} s={[0.18, 0.12, 0.01]} c={neon[(i * 7) % 4]} />
            ))}
            {/* Posts just past the bar's ends and a thinner bar, so no two neon faces share a plane. */}
            {[-1, 1].map((sd) => <Neon key={sd} at={[sd * 0.866, H / 2, 0.626]} s={[0.035, H, 0.035]} c={neon[sd < 0 ? 0 : 1]} />)}
            <Neon at={[0, H, 0.624]} s={[1.72, 0.035, 0.026]} c="#76ff03" />
          </group>
        )}
        <RoofSign m={m} text="ARCADE" w={1.2} at={[0, H + 0.08, 0.4]} bg="#1a1035" fg="#ff4fd8" board="#ec407a" ghost={ghost} />
        <GiantProp m={m} kind="joystick" at={[0.35, H + 0.08, -0.4]} s={0.75} plinth="#1a1035" />
      </group>
    )
  }
  return <ShopTower def={def} ghost={ghost} m={m} win={win} bulb={bulb} level={level} look={{ sign: 'ARCADE', color: '#ec407a', brick: '#311b92', giant: 'joystick' }} />
}

// ---- Tuner: a glass showroom with cars on two floors, then a car tower ----

const CAR_COLS = ['#ff3d00', '#eceff1', '#212121', '#ffd600', '#1e88e5', '#d50000', '#76ff03', '#7e57c2']

function TunerModel({ def, ghost, m, win, bulb, level }: Props) {
  const k: Kit = { m, win, bulb, ghost }
  const orange = def.roof
  if (growthStage(level) === 2) {
    const decks = level - 2
    const fh = 0.62
    const H = decks * fh
    return (
      <group>
        {/* Open glass showroom: thin floor slabs, posts and a car on each bay. */}
        {Array.from({ length: decks }, (_, i) => (
          <group key={i}>
            <Box m={m} at={[0, i * fh + 0.03, -0.25]} s={[3.5, 0.06, 1.3]} c="#263238" />
            {!ghost && [-1.15, 0, 1.15].map((x, j) => <BlockCar key={x} m={m} at={[x, i * fh + 0.04, -0.2]} c={CAR_COLS[(i * 3 + j) % CAR_COLS.length]} rot={Math.PI / 2 + (j - 1) * 0.3} />)}
          </group>
        ))}
        <Box m={m} at={[0, H + 0.04, -0.25]} s={[3.6, 0.08, 1.4]} c="#212121" />
        {[-1.756, -0.58, 0.58, 1.756].flatMap((x) => [0.43, -0.93].map((z) => <Box key={`${x}${z}`} m={m} at={[x, H / 2, z]} s={[0.06, H, 0.06]} c="#212121" shadow={false} />))}
        {/* Glass on the sides and back, the front left open to show the cars. */}
        <Glass m={m} ghost={ghost} at={[0, H / 2, -0.94]} w={3.5} h={H} ry={Math.PI} tint="#cfd8dc" />
        {[-1, 1].map((sd) => <Glass key={sd} m={m} ghost={ghost} at={[sd * 1.77, H / 2, -0.25]} w={1.3} h={H} ry={(sd * Math.PI) / 2} tint="#cfd8dc" />)}
        {!ghost && Array.from({ length: decks }, (_, i) => <Neon key={i} at={[0, i * fh + 0.07, 0.44]} s={[3.5, 0.025, 0.025]} c={orange} />)}
        <RoofSign m={m} text="TUNER" w={1.4} at={[0, H + 0.08, 0.1]} bg="#212121" fg={orange} board={orange} ghost={ghost} />
        {!ghost && <Pool r={1.0} z={0.8} />}
      </group>
    )
  }
  const fl = level + 1
  const fh = 0.48
  const H = fl * fh
  const r = 0.85
  const cx = -0.6
  const cz = -0.08
  return (
    <group>
      {/* Lobby pavilion and the car tower: open floors round a glass lift core. */}
      <GlassBlock m={m} ghost={ghost} x={1.2} z={-0.1} w={1.3} d={1.5} h={0.9} tint="#cfd8dc" frame="#212121" />
      {!ghost && <LitSign text="TUNER" w={1.0} at={[1.2, 1.12, 0.66]} bg="#212121" fg={orange} m={m} />}
      <Box m={m} at={[1.2, 0.98, 0.625]} s={[1.08, 0.3, 0.04]} c={orange} shadow={false} />
      {/* The car tower stays round along a pair: kept in shape round its own axis. */}
      <group position={[cx, 0, cz]}>
        <Upright>
          <group position={[-cx, 0, -cz]}>
            <GlassDrum k={k} x={cx} z={cz} y0={0} r={0.26} h={H + 0.3} tint="#cfd8dc" frame="#212121" bands={false} />
            {Array.from({ length: fl }, (_, i) => {
              const y = (i + 1) * fh - 0.1
              return (
                <group key={i} position={[cx, 0, cz]}>
                  <Cyl m={m} at={[0, y, 0]} r={r} h={0.05} c="#37474f" seg={20} />
                  {/* Guard rail round the deck's edge: a ring, so it passes outside the parked cars. */}
                  <mesh position={[0, y + 0.12, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[r - 0.02, 0.01, 4, 32]} />{m('#cfd8dc')}</mesh>
                  {!ghost && [0, 1, 2, 3].map((j) => {
                    const a = (j / 4) * Math.PI * 2 + i * 0.6
                    return <BlockCar key={j} m={m} at={[Math.sin(a) * 0.55, y + 0.025, Math.cos(a) * 0.55]} c={CAR_COLS[(i * 4 + j) % CAR_COLS.length]} rot={a + Math.PI / 2} />
                  })}
                </group>
              )
            })}
            {[0, 1, 2, 3, 4, 5].map((j) => {
              const a = (j / 6) * Math.PI * 2
              return <Box key={j} m={m} at={[cx + Math.sin(a) * (r + 0.02), (H + 0.1) / 2, cz + Math.cos(a) * (r + 0.02)]} s={[0.05, H + 0.1, 0.05]} c="#212121" />
            })}
            <Cyl m={m} at={[cx, H + 0.1, cz]} r={r + 0.08} h={0.08} c={orange} seg={20} />
            {!ghost && <Neon at={[cx, H + 0.16, cz]} s={[0.02, 0.02, 0.02]} c={orange} />}
            {!ghost && <Beacon m={m} at={[cx, H + 0.14, cz]} h={0.6} />}
            {level >= 10 && <Cyl m={m} at={[cx, H + 0.18, cz]} r={r + 0.1} h={0.03} c={GOLD} seg={20} />}
          </group>
        </Upright>
      </group>
      {!ghost && <Pool r={1.0} x={1.2} z={0.8} />}
    </group>
  )
}

// ---- Police: a stone precinct, then a headquarters tower with a pad on top ----

function PoliceModel({ def, ghost, m, win, bulb, level }: Props) {
  const k: Kit = { m, win, bulb, ghost }
  const navy = def.roof
  const front = (z: number) => (
    <group>
      {/* Columned entrance up a few steps, blue lamps, a patrol car. */}
      <Box m={m} at={[0, 1.0, z + 0.25]} s={[1.1, 0.1, 0.5]} c="#eceff1" />
      {[-0.45, 0.45].map((x) => <Cyl key={x} m={m} at={[x, 0.5, z + 0.43]} r={0.06} h={0.95} c="#fafafa" seg={10} />)}
      {[0, 1, 2].map((i) => <Box key={i} m={m} at={[0, 0.03 + i * 0.05, z + 0.57 - i * 0.1]} s={[1.0, 0.06 + i * 0.05, 0.12]} c="#e0e0e0" shadow={false} />)}
      {!ghost && [-0.32, 0.32].map((x) => <mesh key={x} position={[x, 0.78, z + 0.08]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color="#42a5f5" emissive="#1e88e5" emissiveIntensity={0.6} /></mesh>)}
      {!ghost && (
        <group position={[-1.3, LAYER.lot, z + 0.4]}>
          <Upright>
            <group rotation-y={Math.PI / 2} userData={PEOPLE_SIZED}>
              <CarModel body="sedan" color="#fafafa" stripe="#1a237e" />
              <Box m={m} at={[-0.08, 0.6, -0.02]} s={[0.1, 0.05, 0.34]} c="#e0e0e0" />
              <Box m={m} at={[-0.08, 0.64, 0.088]} s={[0.096, 0.05, 0.116]} c="#e53935" />
              <Box m={m} at={[-0.08, 0.64, -0.128]} s={[0.096, 0.05, 0.116]} c="#1e88e5" />
            </group>
          </Upright>
        </group>
      )}
      {!ghost && <Flag at={[1.45, 0, z + 0.4]} color="#1565c0" tall={1.6} star={level >= 10} />}
      {!ghost && <Pool r={0.8} z={z + 0.6} />}
    </group>
  )
  if (growthStage(level) === 2) {
    const fl = midFloors(level)
    const H = 1.1 + fl * 0.42
    return (
      <group>
        <Box m={m} at={[0, 0.55, -0.3]} s={[3.5, 1.1, 1.35]} c={def.color} t={concreteTex(3, 1)} />
        {[-1.25, -0.65, 0.65, 1.25].map((x) => <mesh key={x} position={[x, 0.6, 0.377]}><planeGeometry args={[0.42, 0.5]} />{win}</mesh>)}
        <mesh position={[0, 0.42, 0.378]}><planeGeometry args={[0.44, 0.74]} />{m('#37474f')}</mesh>
        <BrickFloors k={k} w={3.5} d={1.35} z0={-0.3} y0={1.1} floors={fl} fh={0.42} wall="#b0bec5" trim="#eceff1" tex="stone" escape={false} />
        <Box m={m} at={[0, 1.12, 0.389]} s={[3.52, 0.12, 0.02]} c="#1565c0" shadow={false} />
        {front(0.35)}
        <RoofSign m={m} text="POLICE" w={1.3} at={[-0.7, H + 0.1, 0.1]} bg={navy} fg="#ffffff" board={navy} ghost={ghost} />
        {/* Radio mast on the roof. */}
        <group position={[1.1, H + 0.1, -0.6]}>
          {[0, 1, 2].map((i) => <Box key={i} m={m} at={[0, 0.35 + i * 0.3, 0]} rot={[0, 0, i % 2 ? 0.4 : -0.4]} s={[0.02, 0.32, 0.02]} c="#b0bec5" shadow={false} />)}
          <Beacon m={m} at={[0, 0, 0]} h={1.0} />
        </group>
      </group>
    )
  }
  const h = towerFloors(level) * 0.32
  const y0 = 1.1
  return (
    <group>
      <Box m={m} at={[0, 0.55, -0.3]} s={[3.6, 1.1, 1.35]} c={def.color} t={concreteTex(3, 1)} />
      {[-1.25, -0.65, 0.65, 1.25].map((x) => <mesh key={x} position={[x, 0.6, 0.377]}><planeGeometry args={[0.42, 0.5]} />{win}</mesh>)}
      <mesh position={[0, 0.42, 0.378]}><planeGeometry args={[0.44, 0.74]} />{m('#37474f')}</mesh>
      <Box m={m} at={[0, 1.12, -0.3]} s={[3.66, 0.06, 1.41]} c={navy} />
      {!ghost && <LitSign text="POLICE HQ" w={1.2} at={[0.9, 0.88, 0.385]} bg={navy} fg="#ffffff" m={m} />}
      <StoneShaft k={k} x={0} z={-0.45} y0={y0} w={1.9} d={1.0} h={h} stone="#cfd8dc" tint="#90caf9" pier="#eceff1" bays={4} />
      <Box m={m} at={[0, y0 + h - 0.2, 0.08]} s={[1.95, 0.1, 0.02]} c="#1565c0" shadow={false} />
      {front(0.35)}
      {/* Rooftop helipad and the comms mast. */}
      <group position={[0, y0 + h + 0.08, -0.45]}>
        <Box m={m} at={[0, 0.05, 0]} s={[1.0, 0.1, 0.95]} c="#78909c" />
        <mesh position={[0, 0.104, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.9, 0.9]} />{m('#ffffff', helipadTex('#fafafa', '#fafafa'))}</mesh>
        {!ghost && <PadLights bulb={bulb} r={0.48} n={8} y={0.12} />}
        <group position={[0.85, 0, 0.3]}>
          {[0, 1, 2].map((i) => <Box key={i} m={m} at={[0, 0.35 + i * 0.3, 0]} rot={[0, 0, i % 2 ? 0.4 : -0.4]} s={[0.02, 0.32, 0.02]} c="#b0bec5" shadow={false} />)}
          <Beacon m={m} at={[0, 0, 0]} h={1.1} />
        </group>
      </group>
      {level >= 10 && <Box m={m} at={[0, y0 + h + 0.02, 0.08]} s={[1.99, 0.05, 0.03]} c={GOLD} shadow={false} />}
    </group>
  )
}

// ---- Car shops: a service center (level 4), then the same with a showroom floor
// and a giant roadside landmark on the roof (level 7) ----

type Auto = { wall: string; trim: string; sign: string; signFg: string; board: string }
const AUTO: Record<string, Auto> = {
  tires: { wall: '#455a64', trim: '#eceff1', sign: 'TIRES', signFg: '#212121', board: '#ffca28' },
  lube: { wall: '#eceff1', trim: '#ffb300', sign: 'LUBE & GO', signFg: '#e65100', board: '#ffb300' },
  carwash: { wall: '#4fc3f7', trim: '#e1f5fe', sign: 'CAR WASH', signFg: '#0277bd', board: '#e1f5fe' },
  parts: { wall: '#1565c0', trim: '#bbdefb', sign: 'PARTS', signFg: '#1565c0', board: '#bbdefb' },
  bodyshop: { wall: '#90a4ae', trim: '#263238', sign: 'PAINT & BODY', signFg: '#263238', board: '#ff7043' },
}

function Landmark({ m, id, at, s }: { m: Mat; id: string; at: V3; s: number }) {
  return (
    <group position={at}>
    <Upright>
    <group scale={s}>
      {/* A low plinth bolts the landmark to the roof. */}
      {id !== 'tires' && <Cyl m={m} at={[0, 0.03, 0]} r={0.42} r2={0.46} h={0.06} c="#78909c" seg={16} />}
      {id === 'tires' && (
        <group position={[0, 0.62, 0]}>
          <mesh castShadow><torusGeometry args={[0.42, 0.2, 12, 24]} />{m('#212121')}</mesh>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2
            return <Box key={i} m={m} at={[Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.19]} rot={[0, 0, a]} s={[0.06, 0.16, 0.03]} c="#37474f" shadow={false} />
          })}
          <Cyl m={m} at={[0, 0, 0]} r={0.26} h={0.16} c="#cfd8dc" seg={16} rot={[Math.PI / 2, 0, 0]} />
          <Cyl m={m} at={[0, 0, 0.09]} r={0.08} h={0.04} c="#ffca28" seg={10} rot={[Math.PI / 2, 0, 0]} />
        </group>
      )}
      {id === 'lube' && (
        <group>
          <Cyl m={m} at={[0, 0.45, 0]} r={0.3} h={0.8} c="#ffb300" seg={16} />
          <Cyl m={m} at={[0, 0.45, 0]} r={0.305} h={0.22} c="#e65100" seg={16} />
          <Cyl m={m} at={[0, 0.88, 0]} r={0.12} r2={0.3} h={0.1} c="#ffb300" seg={16} />
          <Cyl m={m} at={[0.18, 1.0, 0]} r={0.035} h={0.4} c="#9e9e9e" seg={8} rot={[0, 0, -0.9]} />
          <mesh position={[0.36, 0.86, 0]}><sphereGeometry args={[0.05, 8, 6]} />{m('#5d4037')}</mesh>
        </group>
      )}
      {id === 'carwash' && (
        <group>
          {[-0.3, 0.3].map((x, i) => (
            <group key={x}>
              <Cyl m={m} at={[x, 0.5, 0]} r={0.2} h={0.9} c={i ? '#ffca28' : '#ec407a'} seg={12} />
              <Cyl m={m} at={[x, 1.0, 0]} r={0.04} h={0.12} c="#90a4ae" seg={6} />
            </group>
          ))}
          <Box m={m} at={[0, 1.08, 0]} s={[0.8, 0.06, 0.08]} c="#90a4ae" />
          {/* Soap foam heaped on the bar. */}
          {[[0.0, 1.2, 0.02, 0.14], [-0.21, 1.18, -0.02, 0.11], [0.21, 1.19, 0.03, 0.12], [0.03, 1.38, 0, 0.1], [-0.12, 1.33, 0.05, 0.08], [0.15, 1.34, -0.03, 0.07]].map(([x, y, z, r]) => (
            <mesh key={`${x}${y}`} position={[x, y, z]}><sphereGeometry args={[r, 10, 8]} /><meshStandardMaterial color="#e1f5fe" roughness={0.1} metalness={0.3} /></mesh>
          ))}
        </group>
      )}
      {id === 'parts' && (
        <group position={[0, 0.7, 0]} rotation-z={0.6}>
          {/* A giant wrench. */}
          <Box m={m} at={[0, 0, 0]} s={[0.14, 1.1, 0.06]} c="#b0bec5" />
          <mesh position={[0, 0.62, 0]} castShadow><torusGeometry args={[0.16, 0.06, 6, 12, Math.PI * 1.4]} />{m('#b0bec5')}</mesh>
          <mesh position={[0, -0.62, 0]} castShadow><torusGeometry args={[0.13, 0.05, 6, 16]} />{m('#b0bec5')}</mesh>
        </group>
      )}
      {id === 'bodyshop' && (
        <group position-y={-0.02} rotation-z={-0.25}>
          {/* A giant spray can mid-spray. */}
          <Cyl m={m} at={[0, 0.5, 0]} r={0.22} h={0.85} c="#ff7043" seg={14} />
          <Cyl m={m} at={[0, 0.5, 0]} r={0.225} h={0.2} c="#fafafa" seg={14} />
          <mesh position={[0, 0.925, 0]}><sphereGeometry args={[0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />{m('#cfd8dc')}</mesh>
          <Box m={m} at={[0, 1.18, 0]} s={[0.08, 0.1, 0.08]} c="#263238" />
          {[[0.08, 1.24], [0.19, 1.3], [0.35, 1.38]].map(([x, y], i) => <mesh key={x} position={[x, y, 0]} userData={AIR}><sphereGeometry args={[0.055 + i * 0.03, 8, 6]} />{m(['#ff7043', '#ab47bc', '#29b6f6'][i])}</mesh>)}
        </group>
      )}
    </group>
    </Upright>
    </group>
  )
}

function AutoModel({ def, ghost, m, win, bulb, level }: Props) {
  // A merged car wash's last form is a whole wash center, built for the block.
  const scale = useMergeScale()
  if (isWashCenter(def.id, level, scale)) return <WashCenter m={m} win={win} bulb={bulb} level={level} ghost={ghost} />
  const a = AUTO[def.id]
  const st = growthStage(level)
  const wide = def.w > 1
  const W = wide ? 3.5 : 1.7
  const D = 1.3
  const z0 = -0.3
  const zf = z0 + D / 2
  const h = 1.1
  const up = st === 3 ? 0.62 : 0
  const bays = wide ? [-1.15, -0.25, 0.65] : [-0.35, 0.4]
  const bw = wide ? 0.78 : 0.62
  return (
    <group>
      <Box m={m} at={[0, 0.025, 0.1]} s={[W + 0.3, 0.05, 1.9]} c="#9e9e9e" t={concreteTex(2, 1)} shadow={false} />
      <Box m={m} at={[0, h / 2, z0]} s={[W, h, D]} c={a.wall} t={concreteTex(Math.max(1, Math.round(W)), 1)} />
      {/* Roll-up bay doors, the middle one open with a car on the lift. */}
      {bays.map((x, i) => (
        <group key={x}>
          <Box m={m} at={[x, 0.42, zf + 0.012]} s={[bw + 0.08, 0.86, 0.025]} c={a.trim} shadow={false} />
          <mesh position={[x, 0.4, zf + 0.027]}>
            <planeGeometry args={[bw, 0.78]} />
            {i === 1 ? m('#263238') : m('#ffffff', shutterTex())}
          </mesh>
          <mesh position={[x, 0.88, zf + 0.04]}><boxGeometry args={[0.12, 0.05, 0.06]} />{bulb}</mesh>
        </group>
      ))}
      {!ghost && <BlockCar m={m} at={[bays[1], 0.15, zf - 0.3]} c={CAR_COLS[def.id.length % CAR_COLS.length]} rot={0} />}
      {/* Office corner and roof edge. */}
      {wide && <mesh position={[1.45, 0.45, zf + 0.006]}><planeGeometry args={[0.4, 0.5]} />{win}</mesh>}
      <Box m={m} at={[0, h + 0.04, z0]} s={[W + 0.08, 0.08, D + 0.08]} c={a.trim} />
      <mesh position={[0, h + 0.084, z0]} rotation-x={-Math.PI / 2}><planeGeometry args={[W, D]} />{m('#cfd8dc', gravelTex(Math.max(1, Math.round(W)), 1))}</mesh>
      {st === 3 && (
        // Showroom floor: a glass band set back on the roof.
        <GlassBlock m={m} ghost={ghost} x={0} z={z0 - 0.1} y0={h + 0.08} w={W - 0.3} d={D - 0.4} h={up - 0.08} tint="#cfd8dc" frame={a.trim} />
      )}
      <RoofSign m={m} text={a.sign} w={wide ? 1.7 : 1.2} at={[wide ? -0.6 : 0, h + up + 0.08, zf - 0.15]} bg="#fffde7" fg={a.signFg} board={a.board} ghost={ghost} />
      {/* Sized and placed to stay on the roof (the giant tyre stands wide, so it sits nearer the middle). */}
      <Landmark m={m} id={def.id} at={[wide ? 1.05 : def.id === 'tires' ? 0.2 : 0.45, h + up + 0.08, z0 - 0.1]} s={st === 3 ? 1.2 : 0.8} />
      {/* Forecourt: cones, a tyre stack or oil drums by the door. */}
      {!ghost && (
        <group>
          {[-1, 1].map((sd) => (
            <group key={sd} position={[sd * (W / 2 - 0.1), 0, zf + 0.3]}>
              <mesh position={[0, 0.1, 0]} castShadow><coneGeometry args={[0.06, 0.2, 8]} />{m('#ff6d00')}</mesh>
            </group>
          ))}
          {def.id === 'tires' && <group userData={PEOPLE_SIZED}>{[0, 1, 2, 3].map((i) => <mesh key={i} position={[-W / 2 + 0.25, 0.08 + i * 0.12, zf + 0.25]} rotation-x={Math.PI / 2} castShadow><torusGeometry args={[0.13, 0.06, 8, 14]} />{m('#212121')}</mesh>)}</group>}
          {def.id === 'lube' && <group userData={PEOPLE_SIZED}>{[0, 1].map((i) => <Cyl key={i} m={m} at={[W / 2 - 0.3 - i * 0.22, 0.16, zf + 0.25]} r={0.1} h={0.3} c={i ? '#1565c0' : '#ffb300'} seg={10} />)}</group>}
          {st === 3 && <Flag at={[-W / 2 + 0.1, h + up + 0.08, z0 - 0.5]} color={a.board} star={level >= 10} />}
          <Pool r={0.9} z={zf + 0.4} />
        </group>
      )}
    </group>
  )
}

export const GROWTH_MODELS = new Set([...Object.keys(FOOD), ...Object.keys(AUTO), 'diner', 'bowling', 'motel', 'market', 'arcade', 'tuner', 'police'])

// The grown form of a business at level 4+, or null for its own model.
export function GrowthModel(props: Props) {
  if (props.level < 4) return null
  const id = props.def.id
  if (FOOD[id]) return <FoodModel {...props} />
  if (AUTO[id]) return <AutoModel {...props} />
  switch (id) {
    case 'diner': return <DinerModel {...props} />
    case 'bowling': return <BowlingModel {...props} />
    case 'motel': return <MotelModel {...props} />
    case 'market': return <MarketModel {...props} />
    case 'arcade': return <ArcadeModel {...props} />
    case 'tuner': return <TunerModel {...props} />
    case 'police': return <PoliceModel {...props} />
    default: return null
  }
}
