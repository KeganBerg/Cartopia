import type { ReactNode } from 'react'
import { CylinderGeometry } from 'three'
import type { BuildingDef } from '../game/data'
import { growthStage, midFloors, towerFloors } from '../game/growth'
import { Box, Cyl, Sign, Pool, Neon, Bulbs, Flag, Parasol, BlockCar, GOLD, type Mat, type V3 } from './NewBuildings'
import { Glass, GlassBlock, glassMat, LitSign, RoofPlant, Planter, PadLights } from './OfficeBuildings'
import { CarModel } from './CarModel'
import { Upright } from './mergeScale'
import { glowMats } from './dayNight'
import { PAL, SEASON } from './season'
import { concreteTex, helipadTex, sidingTex } from './textures'
import { Storefront, BrickFloors, StoneShaft, GlassDrum, RibbonDrum, WaterTank, GiantProp, Beacon, type Kit, type Giant } from './GrowthKit'

// The grown forms of shops and services (names in src/game/growth.ts). Level
// 4-6 rebuilds the business as a bigger building of its kind (a brick walk-up
// over the shop, a hotel, a plaza), one floor more each level; level 7-10 is a
// tower on the shop's ground floor, 9 to 19 floors, crowned with the business's
// giant sign prop. Lots face +z like the rest of the town.

type Props = { def: BuildingDef; ghost?: boolean; m: Mat; win: ReactNode; bulb: ReactNode; level: number }

const SNOW = SEASON === 'winter'
const GLASS_FH = 0.3

// Rooftop sign on a steel frame, like the old downtown walk-ups.
function RoofSign({ m, text, w, at, bg, fg, board, ghost }: { m: Mat; text: string; w: number; at: V3; bg: string; fg: string; board: string; ghost?: boolean }) {
  return (
    <group position={at}>
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[(sd * w) / 2.6, 0.12, -0.06]} s={[0.03, 0.24, 0.03]} c="#37474f" shadow={false} />)}
      <Box m={m} at={[0, 0.12, -0.12]} rot={[0.5, 0, 0]} s={[0.03, 0.03, 0.26]} c="#37474f" shadow={false} />
      <Box m={m} at={[0, 0.24 + w / 8, -0.03]} s={[w + 0.08, w / 4 + 0.08, 0.05]} c={board} shadow={false} />
      {!ghost && <Sign text={text} w={w} at={[0, 0.24 + w / 8, 0]} bg={bg} fg={fg} />}
      <Bulbs from={[-w / 2, 0.28 + w / 4 + 0.04, 0.03]} to={[w / 2, 0.28 + w / 4 + 0.04, 0.03]} n={7} />
    </group>
  )
}

// ---- Food shops: a brick walk-up at 4-6, a tower with a giant prop at 7-10 ----

type Food = {
  wall: string; brick: string; trim: string; awning: string; sign: string; signFg: string; board: string; cafe?: string; giant: Giant
  tower: (k: Kit, y0: number, h: number, lvl: number) => ReactNode
  top: (h: number) => number
}

const FOOD: Record<string, Food> = {
  pizza: {
    wall: '#c0504d', brick: '#a8483a', trim: '#f5f5f5', awning: '#c62828', sign: 'PIZZA', signFg: '#c62828', board: '#f5f5f5', cafe: '#c62828', giant: 'pizza',
    tower: (k, y0, h) => <StoneShaft k={k} z={-0.25} y0={y0} w={1.3} d={1.0} h={h} stone="#c8734f" tint="#a9c4de" pier="#f3e5d0" bays={3} />,
    top: (h) => h + 0.08,
  },
  donut: {
    wall: '#f48fb1', brick: '#ec7aa3', trim: '#fff8e1', awning: '#f06292', sign: 'DONUTS', signFg: '#d81b60', board: '#fff8e1', cafe: '#f06292', giant: 'donut',
    tower: (k, y0, h) => <RibbonDrum k={k} z={-0.22} y0={y0} r={0.62} floors={Math.round(h / GLASS_FH)} fh={GLASS_FH} wall="#f48fb1" band="#fff8e1" tint="#b3e5fc" />,
    top: (h) => h + 0.08,
  },
  burger: {
    wall: '#ffb300', brick: '#b5532e', trim: '#fff3e0', awning: '#d84315', sign: 'BURGERS', signFg: '#d84315', board: '#fff3e0', cafe: '#d84315', giant: 'burger',
    tower: (k, y0, h) => (
      <group>
        <GlassBlock m={k.m} ghost={k.ghost} x={0} z={-0.25} y0={y0} w={1.3} d={1.0} h={h} tint="#ffcc80" frame="#5d4037" />
        {!k.ghost && [-0.45, -0.15, 0.15, 0.45].map((x) => <Box key={x} m={k.m} at={[x, y0 + h / 2, 0.27]} s={[0.04, h, 0.05]} c="#d84315" shadow={false} />)}
      </group>
    ),
    top: (h) => h + 0.08,
  },
  icecream: {
    wall: '#b3e5fc', brick: '#e1bee7', trim: '#ffffff', awning: '#f06292', sign: 'ICE CREAM', signFg: '#ec407a', board: '#ffffff', cafe: '#4fc3f7', giant: 'cone',
    // Soft-serve tiers: three drums, each narrower than the one below.
    tower: (k, y0, h) => {
      const h1 = Math.round((h * 0.55) / GLASS_FH) * GLASS_FH
      const h2 = Math.round((h * 0.3) / GLASS_FH) * GLASS_FH
      const h3 = Math.max(GLASS_FH * 2, h - h1 - h2)
      return (
        <group>
          <GlassDrum k={k} z={-0.22} y0={y0} r={0.66} h={h1} tint="#b3e5fc" frame="#f8bbd0" />
          <GlassDrum k={k} z={-0.22} y0={y0 + h1 + 0.08} r={0.52} h={h2} tint="#b3e5fc" frame="#f8bbd0" />
          <GlassDrum k={k} z={-0.22} y0={y0 + h1 + h2 + 0.16} r={0.38} h={h3} tint="#b3e5fc" frame="#f8bbd0" />
        </group>
      )
    },
    top: (h) => h + 0.24,
  },
  coffee: {
    wall: '#8d6e63', brick: '#6d4c41', trim: '#e8f5e9', awning: '#2e7d32', sign: 'COFFEE', signFg: '#2e7d32', board: '#e8f5e9', cafe: '#2e7d32', giant: 'mug',
    // A slim brick tower under a green copper mansard.
    tower: (k, y0, h) => {
      const fl = Math.round(h / 0.34)
      return (
        <group position={[0, 0, -0.25]}>
          <BrickFloors k={k} w={1.3} d={1.0} y0={y0} floors={fl} fh={0.34} wall="#6d4c41" trim="#e8f5e9" escape={false} />
          <mesh position={[0, y0 + fl * 0.34 + 0.32, 0]} rotation-y={Math.PI / 4} castShadow>
            <cylinderGeometry args={[0.55, 0.98, 0.42, 4]} />
            {k.m(SNOW ? '#eef4f7' : '#4db6ac')}
          </mesh>
        </group>
      )
    },
    top: (h) => Math.round(h / 0.34) * 0.34 + 0.53,
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
  const h = towerFloors(level) * GLASS_FH
  const y0 = 1.06
  const top = y0 + f.top(h)
  return (
    <group>
      <Storefront k={k} w={1.8} d={1.6} z0={-0.05} h={1.0} wall={f.wall} tex="brick" trim={f.trim} awning={f.awning} sign={f.sign} signFg={f.signFg} board={f.board} cafe={f.cafe} />
      {f.tower(k, y0, h, level)}
      <GiantProp m={m} kind={f.giant} at={[0, top, -0.25]} s={1.2} plinth={level >= 10 ? GOLD : f.trim} />
      {!ghost && <Beacon m={m} at={[0.5, top, -0.55]} h={0.45} />}
      {!ghost && level >= 8 && <Flag at={[-0.75, 1.04, 0.5]} color={f.awning} star={level >= 10} />}
    </group>
  )
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
// band of glass round every floor and chrome lines between.
function StreamBlock({ k, x = 0, z, y0, len, d, floors, fh, wall, chrome, tint }: { k: Kit; x?: number; z: number; y0: number; len: number; d: number; floors: number; fh: number; wall: string; chrome: string; tint: string }) {
  const { m, ghost } = k
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
    </group>
  )
}

// Googie starburst on a mast.
function Starburst({ m, at, c }: { m: Mat; at: V3; c: string }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, 0.35, 0]} r={0.025} h={0.7} c="#eceff1" seg={6} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Box key={i} m={m} at={[0, 0.8, 0]} rot={[0, (i * Math.PI) / 6, (i * Math.PI) / 3]} s={[0.5, 0.03, 0.03]} c={i % 2 ? c : GOLD} shadow={false} />
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
  const h = towerFloors(level) * 0.32
  const y0 = 1.0
  return (
    <group>
      <StreamBlock k={k} z={-0.15} y0={0} len={3.6} d={1.45} floors={1} fh={0.95} wall={def.color} chrome="#eceff1" tint={tint} />
      <StreamBlock k={k} z={-0.3} y0={y0} len={2.3} d={1.0} floors={towerFloors(level)} fh={0.32} wall={wall} chrome={def.roof} tint={tint} />
      {/* A fin up the front carrying the name, like a 1930s picture palace. */}
      <Box m={m} at={[-0.95, y0 + h * 0.5, 0.25]} s={[0.08, h * 0.7, 0.32]} c={def.roof} />
      {!ghost && <LitSign text="DINER" w={0.9} at={[-0.95, 1.6, 0.42]} bg="#fffde7" fg="#c62828" m={m} />}
      <Box m={m} at={[0, 0.9, 0.82]} s={[1.3, 0.04, 0.42]} c={def.roof} />
      <Box m={m} at={[0, 0.5, 0.585]} s={[0.5, 0.82, 0.02]} c="#eceff1" shadow={false} />
      <mesh position={[0, 0.42, 0.6]}><planeGeometry args={[0.4, 0.7]} />{m('#37474f')}</mesh>
      <Bulbs from={[-0.65, 0.86, 1.03]} to={[0.65, 0.86, 1.03]} n={8} />
      <Starburst m={m} at={[0, y0 + h + 0.08, -0.3]} c={def.roof} />
      {level >= 10 && <Cyl m={m} at={[0, y0 + h + 0.12, -0.3]} r={0.3} h={0.04} c={GOLD} seg={16} />}
      {!ghost && <Pool r={0.9} z={1.0} />}
      {!ghost && [-1.4, 1.4].map((x) => <Parasol key={x} m={m} at={[x, 0, 0.82]} c={def.roof} />)}
    </group>
  )
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
        {!ghost && <LitSign text="BOWLING" w={1.6} at={[0, H - 0.25, 0.536]} bg="#311b92" fg="#ffeb3b" m={m} />}
        {/* The pylon: a tall mast with a giant pin and ball on top. */}
        <group position={[1.55, 0, 0.75]}>
          <Cyl m={m} at={[0, (H + 0.8) / 2, 0]} r={0.05} h={H + 0.8} c="#eceff1" seg={8} />
          <GiantProp m={m} kind="pin" at={[0, H + 0.8, 0]} s={0.75} plinth="#7e57c2" />
        </group>
        {!ghost && <Pool r={0.8} z={0.9} />}
      </group>
    )
  }
  const h = towerFloors(level) * GLASS_FH
  const y0 = 1.1
  return (
    <group>
      <Storefront k={k} w={3.6} d={1.6} z0={-0.15} h={1.05} wall={def.color} tex="plain" trim="#ede7f6" awning="#7e57c2" sign="BOWLING" signBg="#311b92" signFg="#ffeb3b" board="#7e57c2" />
      <GlassBlock m={m} ghost={ghost} x={-0.3} z={-0.35} y0={y0} w={2.0} d={1.0} h={h} tint="#b39ddb" frame="#4527a0" />
      {!ghost && [-1, 1].map((sd) => <Neon key={sd} at={[-0.3 + sd * 1.01, y0 + h / 2, 0.16]} s={[0.03, h, 0.03]} c="#d500f9" />)}
      <GiantProp m={m} kind="pin" at={[-0.3, y0 + h + 0.08, -0.35]} s={1.25} plinth={level >= 10 ? GOLD : '#ede7f6'} />
      {!ghost && <Beacon m={m} at={[0.5, y0 + h + 0.08, -0.7]} h={0.5} />}
      {!ghost && <Pool r={0.9} z={0.9} />}
    </group>
  )
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

function RoofPool({ m, at, w, d, ghost }: { m: Mat; at: V3; w: number; d: number; ghost?: boolean }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.03, 0]} s={[w, 0.06, d]} c="#d7ccc8" shadow={false} />
      <mesh position={[0, 0.065, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w * 0.6, d * 0.55]} />
        <meshStandardMaterial color={SNOW ? '#cfe8f3' : '#4fc3f7'} roughness={0.1} metalness={0.2} />
      </mesh>
      {!ghost && [-1, 1].map((sd) => <Parasol key={sd} m={m} at={[sd * w * 0.36, 0.06, d * 0.3]} c="#00897b" />)}
      {!ghost && [-0.15, 0.15].map((x) => <Box key={x} m={m} at={[x, 0.1, -d * 0.38]} rot={[-0.2, 0, 0]} s={[0.12, 0.03, 0.3]} c="#fafafa" shadow={false} />)}
    </group>
  )
}

function MotelModel({ def, ghost, m, win, bulb, level }: Props) {
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
  const fl = towerFloors(level)
  const fh = 0.3
  const h = fl * fh
  const y0 = 1.0
  const ys = Array.from({ length: fl }, (_, i) => y0 + i * fh)
  return (
    <group>
      <Storefront k={k} w={3.6} d={1.6} z0={-0.15} h={1.0} wall="#d7ccc8" tex="stone" trim="#fafafa" awning={teal} />
      {/* A slab tower in cream stucco, balconies on every floor, glass behind. */}
      <GlassBlock m={m} ghost={ghost} x={0} z={-0.35} y0={y0} w={2.8} d={0.9} h={h} tint="#80cbc4" frame="#fafafa" />
      <Balconies m={m} w={2.8} z={0.1} ys={ys} c="#fafafa" rail={teal} />
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 1.48, y0 + h / 2, -0.35]} s={[0.22, h, 1.0]} c={def.color} t={sidingTex(1, Math.max(1, Math.round(h * 1.5)))} />)}
      <RoofPool m={m} at={[0, y0 + h + 0.08, -0.35]} w={2.6} d={0.85} ghost={ghost} />
      {!ghost && <LitSign text="GRAND HOTEL" w={1.5} at={[0, y0 + h - 0.25, 0.11 + 0.02]} bg={teal} fg="#fff8e1" m={m} />}
      <Box m={m} at={[0, 0.9, 0.85]} s={[1.6, 0.06, 0.9]} c={teal} />
      {[-0.75, 0.75].map((x) => <Cyl key={x} m={m} at={[x, 0.45, 1.22]} r={0.035} h={0.9} c={level >= 10 ? GOLD : '#fafafa'} seg={8} />)}
      <Bulbs from={[-0.78, 0.86, 1.3]} to={[0.78, 0.86, 1.3]} n={9} />
      {!ghost && level >= 8 && [-1.5, 1.5].map((x) => <Flag key={x} at={[x, y0 + h + 0.08, -0.35]} color={teal} star={level >= 10} />)}
      {!ghost && (
        <group position={[1.35, 0.05, 0.75]}>
          <Upright>
            <group rotation-y={Math.PI / 2} scale={0.85}>
              <CarModel body="luxury" color="#1a1a2e" />
            </group>
          </Upright>
        </group>
      )}
      {!ghost && <Pool r={1.0} z={1.0} />}
    </group>
  )
}

// ---- Fresh Mart: a two-level plaza with roof parking, then a tower ----

function MarketModel({ def, ghost, m, win, bulb, level }: Props) {
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
        <Box m={m} at={[-1.95, (H + 0.1) / 2, -0.1]} rot={[0, 0, 0.0]} s={[0.25, H + 0.1, 1.4]} c="#8d8d8d" t={concreteTex(1, 2)} />
        <RoofSign m={m} text="FRESH MART" w={1.6} at={[0.8, H + 0.06, 0.45]} bg="#fffde7" fg={green} board={green} ghost={ghost} />
        <GiantProp m={m} kind="apple" at={[-1.0, H + 0.06, 0.2]} s={0.8} plinth="#fafafa" />
        {!ghost && [-1.25, 1.25].map((x) => <Parasol key={x} m={m} at={[x, 0, 0.9]} c="#43a047" />)}
        {!ghost && <Pool r={0.9} z={0.95} />}
      </group>
    )
  }
  const h = towerFloors(level) * GLASS_FH
  const y0 = 1.7
  return (
    <group>
      {/* Two floors of shops behind glass, the tower set back on top. */}
      <Storefront k={k} w={3.6} d={1.6} z0={-0.15} h={1.0} wall={def.color} tex="plain" trim="#fafafa" awning="#43a047" />
      <GlassBlock m={m} ghost={ghost} x={0} z={-0.15} y0={1.0} w={3.6} d={1.6} h={0.62} tint="#a5d6a7" frame="#fafafa" />
      {!ghost && <LitSign text="FRESH MART" w={1.6} at={[0, 1.31, 0.66]} bg="#fafafa" fg={green} m={m} />}
      <GlassBlock m={m} ghost={ghost} x={0.5} z={-0.4} y0={y0} w={1.9} d={1.0} h={h} tint="#a5d6a7" frame={green} />
      <Box m={m} at={[-1.0, y0 + 0.05, 0]} s={[0.9, 0.1, 0.9]} c={PAL.grass} />
      {!ghost && [-1.25, -0.75].map((x) => <Planter key={x} m={m} at={[x, y0 + 0.08, 0.1]} />)}
      <GiantProp m={m} kind="apple" at={[0.5, y0 + h + 0.08, -0.4]} s={1.3} plinth={level >= 10 ? GOLD : '#fafafa'} />
      {!ghost && <Beacon m={m} at={[1.2, y0 + h + 0.08, -0.7]} h={0.45} />}
      {!ghost && [-1.25, 1.25].map((x) => <Parasol key={x} m={m} at={[x, 0, 0.9]} c="#43a047" />)}
      {!ghost && <Pool r={0.9} z={0.95} />}
    </group>
  )
}

// ---- Pixel Palace: a neon block, then a tower of offset glowing boxes ----

function ArcadeModel({ ghost, m, win, bulb, level }: Props) {
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
            {[-1, 1].map((sd) => <Neon key={sd} at={[sd * 0.86, H / 2, 0.62]} s={[0.035, H, 0.035]} c={neon[sd < 0 ? 0 : 1]} />)}
            <Neon at={[0, H, 0.62]} s={[1.72, 0.035, 0.035]} c="#76ff03" />
          </group>
        )}
        <RoofSign m={m} text="ARCADE" w={1.2} at={[0, H + 0.08, 0.4]} bg="#1a1035" fg="#ff4fd8" board="#ec407a" ghost={ghost} />
        <GiantProp m={m} kind="joystick" at={[0.35, H + 0.08, -0.4]} s={0.75} plinth="#1a1035" />
      </group>
    )
  }
  const fl = towerFloors(level)
  const blocks = Math.ceil(fl / 3)
  const fh = 0.3
  const y0 = 1.05
  const top = y0 + blocks * fh * 3
  return (
    <group>
      <Storefront k={k} w={1.8} d={1.6} z0={-0.05} h={1.0} wall={violet} tex="plain" trim="#1a1035" awning="#ec407a" sign="ARCADE" signBg="#1a1035" signFg="#ff4fd8" board="#ec407a" />
      {/* Three-floor boxes stacked with a shift each, like a pile of cartridges. */}
      {Array.from({ length: blocks }, (_, i) => {
        const y = y0 + i * fh * 3
        const x = [0, 0.14, -0.1, 0.08][i % 4]
        const z = -0.25 + [0, -0.06, 0.05, -0.02][i % 4]
        const c = neon[i % 4]
        return (
          <group key={i} position={[x, 0, z]}>
            <GlassBlock m={m} ghost={ghost} x={0} z={0} y0={y} w={1.25} d={0.95} h={fh * 3 - 0.04} tint={i % 2 ? '#b39ddb' : '#90caf9'} frame="#1a1035" />
            {!ghost && [-1, 1].map((sd) => <Neon key={sd} at={[sd * 0.63, y + fh * 1.5, 0.48]} s={[0.03, fh * 3 - 0.06, 0.03]} c={c} />)}
            {!ghost && <Neon at={[0, y + fh * 3 - 0.02, 0.485]} s={[1.27, 0.03, 0.03]} c={c} />}
          </group>
        )
      })}
      <GiantProp m={m} kind="joystick" at={[0.08, top + 0.04, -0.27]} s={1.2} plinth={level >= 10 ? GOLD : '#1a1035'} />
      {!ghost && <Beacon m={m} at={[-0.45, top + 0.04, -0.55]} h={0.45} />}
    </group>
  )
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
        {[-1.75, -0.58, 0.58, 1.75].flatMap((x) => [0.43, -0.93].map((z) => <Box key={`${x}${z}`} m={m} at={[x, H / 2, z]} s={[0.06, H, 0.06]} c="#212121" shadow={false} />))}
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
  const cz = -0.15
  return (
    <group>
      {/* Lobby pavilion and the car tower: open floors round a glass lift core. */}
      <GlassBlock m={m} ghost={ghost} x={1.2} z={-0.1} w={1.3} d={1.5} h={0.9} tint="#cfd8dc" frame="#212121" />
      {!ghost && <LitSign text="TUNER" w={1.0} at={[1.2, 1.12, 0.66]} bg="#212121" fg={orange} m={m} />}
      <Box m={m} at={[1.2, 0.98, 0.66]} s={[1.08, 0.3, 0.04]} c={orange} shadow={false} />
      <GlassDrum k={k} x={cx} z={cz} y0={0} r={0.26} h={H + 0.3} tint="#cfd8dc" frame="#212121" bands={false} />
      {Array.from({ length: fl }, (_, i) => {
        const y = (i + 1) * fh - 0.1
        return (
          <group key={i} position={[cx, 0, cz]}>
            <Cyl m={m} at={[0, y, 0]} r={r} h={0.05} c="#37474f" seg={20} />
            <Cyl m={m} at={[0, y + 0.12, 0]} r={r + 0.01} h={0.015} c="#cfd8dc" seg={20} />
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
        <group position={[-1.3, 0.05, z + 0.4]}>
          <Upright>
            <group rotation-y={Math.PI / 2}>
              <CarModel body="sedan" color="#fafafa" stripe="#1a237e" />
              <Box m={m} at={[-0.08, 0.6, -0.02]} s={[0.1, 0.05, 0.34]} c="#e0e0e0" />
              <Box m={m} at={[-0.08, 0.64, 0.09]} s={[0.1, 0.05, 0.12]} c="#e53935" />
              <Box m={m} at={[-0.08, 0.64, -0.13]} s={[0.1, 0.05, 0.12]} c="#1e88e5" />
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
        <Box m={m} at={[0, 1.12, 0.385]} s={[3.52, 0.12, 0.02]} c="#1565c0" shadow={false} />
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
        <mesh position={[0, 0.101, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.9, 0.9]} />{m('#ffffff', helipadTex('#fafafa', '#fafafa'))}</mesh>
        {!ghost && <PadLights bulb={bulb} r={0.48} n={8} y={0.12} />}
        <group position={[0.85, 0, 0.3]}>
          {[0, 1, 2].map((i) => <Box key={i} m={m} at={[0, 0.35 + i * 0.3, 0]} rot={[0, 0, i % 2 ? 0.4 : -0.4]} s={[0.02, 0.32, 0.02]} c="#b0bec5" shadow={false} />)}
          <Beacon m={m} at={[0, 0, 0]} h={1.1} />
        </group>
      </group>
      {level >= 10 && <Box m={m} at={[0, y0 + h + 0.02, 0.08]} s={[1.98, 0.05, 0.03]} c={GOLD} shadow={false} />}
    </group>
  )
}

export const GROWTH_MODELS = new Set([...Object.keys(FOOD), 'diner', 'bowling', 'motel', 'market', 'arcade', 'tuner', 'police'])

// The grown form of a business at level 4+, or null for its own model.
export function GrowthModel(props: Props) {
  if (props.level < 4) return null
  const id = props.def.id
  if (FOOD[id]) return <FoodModel {...props} />
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
