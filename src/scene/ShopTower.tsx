import type { ReactNode } from 'react'
import { TILE, type BuildingDef } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { Box, Neon, Flag, GOLD, type Mat } from './NewBuildings'
import { BrickFloors, GiantProp, spread, type Kit, type Giant } from './GrowthKit'
import { LitSign } from './OfficeBuildings'
import { Facade, Upright } from './mergeScale'

// A shop's last form (level 7-10), the look Kegan picked: the shop stays exactly
// as it was built at level 1, its awning and sign at street level, and a brick
// apartment tower in the shop's colours rises behind the sign, with balconies
// and a fire escape. A tall lit blade sign up the front and a glowing sign box
// on the roof, under the giant prop, say whose tower it is from across town.

export type ShopLook = {
  sign: string
  // The brand colour: the blade, the roof box and the balcony rails.
  color: string
  // The tower's brick.
  brick: string
  giant?: Giant
  // Something of its own on the roof box instead of a giant prop, placed at its top (the diner's starburst).
  crown?: ReactNode
}

// Floors over the shop at levels 7-10: taller than the walk-ups at 4-6 (3-5).
const FLOORS = [6, 8, 10, 12]
const FH = 0.44

type Props = { def: BuildingDef; ghost?: boolean; m: Mat; win: ReactNode; bulb: ReactNode; level: number; look: ShopLook }

export function ShopTower({ def, ghost, m, win, bulb, level, look }: Props) {
  const k: Kit = { m, win, bulb, ghost }
  const fl = FLOORS[Math.min(10, Math.max(7, level)) - 7]
  const W = def.w * TILE
  // Same height as the level 1 shop's walls (BuildingModel's generic storefront).
  const y0 = def.w > 1 ? 1.5 : 1.3
  const tw = def.w > 1 ? W * 0.62 : W * 0.76
  const td = 1.05
  const tz = -0.42
  const zf = tz + td / 2
  const H = y0 + fl * FH
  // The shop's own sign stands on its roof in front of the tower; no balconies behind it.
  const clear = def.sign ? 0.43 + Math.min(W * 0.8, 2.4) / 8 : 0
  const blade = fl * FH - 0.12 - clear - 0.1
  const letters = [...look.sign]
  const step = Math.min(0.42, blade / letters.length)
  return (
    <group>
      {/* Its roof prop moves up to the tower top as the giant one. */}
      <BuildingModel def={{ ...def, prop: undefined }} level={1} ghost={ghost} />
      <BrickFloors k={k} w={tw} d={td} z0={tz} y0={y0} floors={fl} fh={FH} wall={look.brick} trim="#f5f5f5" />
      {/* Balconies on every other window, staggered floor to floor; the left column carries the blade. */}
      <Facade at={[0, 0, zf]} len={tw}>
        {(L) => spread(L, 0.5, 0.86).slice(1).map((x, j) => Array.from({ length: fl }, (_, i) => (i + j) % 2 === 0 && i * FH >= clear && (
          <group key={`${x}:${i}`} position={[x, y0 + i * FH + 0.03, 0]}>
            <Box m={m} at={[0, 0, 0.09]} s={[0.36, 0.03, 0.18]} c="#eceff1" shadow={false} />
            <Box m={m} at={[0, 0.08, 0.175]} s={[0.36, 0.1, 0.012]} c={look.color} shadow={false} />
            {(i * 3 + j) % 4 === 0 && !ghost && <Box m={m} at={[0.1, 0.06, 0.08]} s={[0.07, 0.09, 0.07]} c="#43a047" shadow={false} />}
          </group>
        )))}
      </Facade>
      {!ghost && (
        <>
          {/* The blade: a long lit sign standing out from the wall like an old theatre's, the name in upright letters down both faces. */}
          <group position={[-tw / 2 + 0.2, y0 + clear + blade / 2 + 0.05, zf + 0.3]}>
            <Upright>
              <group rotation-y={Math.PI / 2}>
                <Box m={m} at={[0, 0, 0]} s={[0.54, blade + 0.1, 0.06]} c={look.color} shadow={false} />
                {[1, -1].map((sd) => (
                  <group key={sd} rotation-y={sd > 0 ? 0 : Math.PI}>
                    <Box m={m} at={[0, 0, 0.032]} s={[0.46, blade, 0.004]} c="#212121" shadow={false} />
                    {letters.map((ch, i) => ch !== ' ' && (
                      <LitSign key={i} text={ch} w={step} h={step} at={[0, blade / 2 - (i + 0.5) * step - 0.04, 0.036]} bg="#212121" fg="#fffde7" m={m} />
                    ))}
                  </group>
                ))}
              </group>
              {[blade / 2 - 0.1, -blade / 2 + 0.1].map((y) => <Box key={y} m={m} at={[0, y, -0.29]} s={[0.04, 0.04, 0.06]} c="#37474f" shadow={false} />)}
            </Upright>
          </group>
          {/* The glowing sign box on the roof: the name on the front and the side, neon round the top. */}
          <group position={[0, H + 0.1, tz]}>
            <Box m={m} at={[0, 0.3, 0]} s={[tw * 0.96, 0.6, td * 0.9]} c={look.color} />
            <Facade at={[0, 0.3, (td * 0.9) / 2 + 0.006]} len={tw * 0.96}>
              {() => <LitSign text={look.sign} w={Math.min(tw * 0.86, 2.2)} at={[0, 0, 0]} bg="#fffde7" fg={look.color} m={m} />}
            </Facade>
            <group rotation-y={Math.PI / 2}>
              <LitSign text={look.sign} w={td * 0.8} at={[0, 0.3, (tw * 0.96) / 2 + 0.006]} bg="#fffde7" fg={look.color} m={m} />
            </group>
            <Neon at={[0, 0.62, (td * 0.9) / 2]} s={[tw * 0.96, 0.03, 0.03]} c={look.color} />
            {level >= 8 && <Flag at={[tw * 0.44, 0.6, -td * 0.35]} color={look.color} star={level >= 10} />}
          </group>
        </>
      )}
      <group position={[0, H + 0.72, tz]}>
        {look.crown ?? (look.giant && <GiantProp m={m} kind={look.giant} at={[0, 0, 0]} s={1.05} plinth={level >= 10 ? GOLD : look.color} />)}
      </group>
    </group>
  )
}
