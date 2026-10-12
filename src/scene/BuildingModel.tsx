import type { ReactNode } from 'react'
import { TILE, levelLift, type BuildingDef } from '../game/data'
import { useGame } from '../game/store'
import { signTexture } from './signTexture'
import { signMat } from './closingTime'
import { CarModel } from './CarModel'
import { Upright, useBays, useMergeScale } from './mergeScale'
import { ObstacleDetail, BillboardDetail, DriveInDetail, FountainDetail, GarageDetail, HouseDetail, PondDetail, ShopDetail, SpeedwayDetail, StatueDetail, TreeDetail } from './BuildingDetail'
import { NEW_MODELS, NewBuildingModel } from './NewBuildings'
import { PropMesh } from './propKit'
import { DECOR_PROPS, benchBin } from './decorProps'
import { Bulbs } from './edgeKit'
import { OFFICE_MODELS, OfficeModel } from './OfficeBuildings'
import { CAMPUS_MODELS, CampusModel } from './CampusBuildings'
import { HouseLevels } from './HouseLevels'
import { TRAILER_JUNK, TrailerJunkModel } from './TrailerJunkyard'
import { PARK_STYLES, ParkStyleModel } from './ParkStyles'
import { RustysYard } from './RustysYard'
import { glassMat } from './OfficeBuildings'
import { GROWTH_MODELS, GrowthModel } from './GrowthTowers'
import { growthStage } from '../game/growth'
import type { Texture } from 'three'
import { glowMats } from './dayNight'
import { tickMovie } from './movie'
import { useFrame } from '@react-three/fiber'
import { PAL, SEASON } from './season'
import { LAYER, decal } from './layers'
import { brickTex, sidingTex, shingleTex, gravelTex, awningTex, windowTex, paverTex, shutterTex, pumpTex } from './textures'
import { PEOPLE_SIZED } from './keepShape'

type Props = { def: BuildingDef; ghost?: boolean; valid?: boolean; level?: number }


const GOLD = '#ffc107'

// Upgrade trimmings, added as a building levels up.
function Flag({ y, color, x = 0, z = 0, star, rot = 0 }: { y: number; color: string; x?: number; z?: number; star?: boolean; rot?: number }) {
  return (
    <group position={[x, y, z]} rotation-y={rot}>
      <mesh position={[0, 0.45, 0]} castShadow><cylinderGeometry args={[0.02, 0.025, 0.9, 6]} /><meshStandardMaterial color="#eceff1" metalness={0.4} /></mesh>
      <mesh position={[0.17, 0.75, 0]}><boxGeometry args={[0.32, 0.2, 0.015]} /><meshStandardMaterial color={color} /></mesh>
      {star ? (
        <mesh position={[0, 0.98, 0]} rotation-z={Math.PI / 2}><octahedronGeometry args={[0.11, 0]} /><meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} emissive={GOLD} emissiveIntensity={0.25} /></mesh>
      ) : (
        <mesh position={[0, 0.92, 0]}><sphereGeometry args={[0.04, 8, 6]} /><meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} /></mesh>
      )}
    </group>
  )
}

// A row of little bulbs, lit at night.
function Lights(props: { from: [number, number, number]; to: [number, number, number]; n: number; posts?: number }) {
  return <Bulbs r={0.035} {...props} />
}

// Shared material props so ghost previews render translucent.
function useMat(ghost?: boolean, valid?: boolean) {
  return (color: string, map?: Texture) => (
    <meshStandardMaterial
      map={ghost ? null : map ?? null}
      color={ghost ? (valid ? '#66bb6a' : '#ef5350') : color}
      transparent={ghost}
      opacity={ghost ? 0.55 : 1}
    />
  )
}

// The steel stand a giant roof prop is bolted to, from the roof up `h`.
function Stand({ y, h }: { y: number; h: number }) {
  return (
    <group position-y={y}>
      <mesh position-y={0.015}><cylinderGeometry args={[0.16, 0.18, 0.03, 12]} /><meshStandardMaterial color="#78909c" metalness={0.4} roughness={0.5} /></mesh>
      <mesh position-y={h / 2}><cylinderGeometry args={[0.05, 0.06, h, 8]} /><meshStandardMaterial color="#90a4ae" metalness={0.4} roughness={0.5} /></mesh>
    </group>
  )
}

function RoofProp({ prop, y }: { prop: NonNullable<BuildingDef['prop']>; y: number }) {
  switch (prop) {
    case 'donut':
      return (
        <group position={[0, y + 0.45, -0.1]}>
          <mesh rotation-x={-0.3} castShadow><torusGeometry args={[0.32, 0.15, 12, 24]} /><meshStandardMaterial color="#d7a86e" /></mesh>
          <mesh rotation-x={-0.3} position={[0, 0.05, 0.02]}><torusGeometry args={[0.32, 0.12, 12, 24]} /><meshStandardMaterial color="#f06292" /></mesh>
        </group>
      )
    case 'burger':
      return (
        <group position={[0, y + 0.15, -0.1]}>
          <Stand y={-0.15} h={0.16} />
          <mesh position-y={0.05} castShadow><cylinderGeometry args={[0.38, 0.38, 0.1, 20]} /><meshStandardMaterial color="#e0a052" /></mesh>
          <mesh position-y={0.15}><cylinderGeometry args={[0.4, 0.4, 0.1, 20]} /><meshStandardMaterial color="#5d4037" /></mesh>
          <mesh position-y={0.21}><cylinderGeometry args={[0.42, 0.42, 0.03, 20]} /><meshStandardMaterial color="#66bb6a" /></mesh>
          <mesh position-y={0.225}><sphereGeometry args={[0.38, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e0a052" /></mesh>
        </group>
      )
    case 'cone':
      return (
        <group position={[0, y + 0.4, -0.1]}>
          <Stand y={-0.4} h={0.14} />
          <mesh rotation-x={Math.PI} castShadow><coneGeometry args={[0.22, 0.6, 14]} /><meshStandardMaterial color="#d7a86e" /></mesh>
          <mesh position-y={0.38}><sphereGeometry args={[0.26, 14, 10]} /><meshStandardMaterial color="#f8bbd0" /></mesh>
        </group>
      )
    case 'tire':
      return (
        <mesh position={[0, y + 0.45, -0.1]} castShadow><torusGeometry args={[0.32, 0.14, 12, 24]} /><meshStandardMaterial color="#212121" /></mesh>
      )
    case 'pin':
      return (
        <group position={[0.6, y + 0.4, -0.1]}>
          <Stand y={-0.4} h={0.23} />
          <mesh castShadow><sphereGeometry args={[0.2, 14, 10]} /><meshStandardMaterial color="#fafafa" /></mesh>
          <mesh position-y={0.28}><cylinderGeometry args={[0.08, 0.12, 0.3, 12]} /><meshStandardMaterial color="#fafafa" /></mesh>
          <mesh position-y={0.24}><cylinderGeometry args={[0.105, 0.105, 0.05, 12]} /><meshStandardMaterial color="#e53935" /></mesh>
          <mesh position-y={0.47}><sphereGeometry args={[0.1, 12, 8]} /><meshStandardMaterial color="#fafafa" /></mesh>
        </group>
      )
    case 'popcorn':
      return null
  }
}

// The grown Speedway: a roof canopy over the stands and a big screen in the gap
// (level 4), then a full ring roof with VIP suites and light pylons (level 7).
function SpeedwayGrown({ m, sh, roof, lvl, ghost }: { m: ReturnType<typeof useMat>; sh: number; roof: string; lvl: number; ghost?: boolean }) {
  const full = growthStage(lvl) === 3
  const a0 = full ? 0 : Math.PI * 0.15
  const arc = full ? Math.PI * 2 : Math.PI * 1.1
  const y = sh + (full ? 0.75 : 0.45)
  const posts = full ? 16 : 9
  const gap = Math.PI * 1.7
  return (
    <group>
      {/* Canopy: a sloped ring on slim posts round the back of the stands. */}
      <mesh position={[0, y, 0]} castShadow>
        <cylinderGeometry args={[1.45, 2.02, 0.22, 48, 1, true, a0, arc]} />
        <meshStandardMaterial color="#eceff1" side={2} />
      </mesh>
      <mesh position={[0, y + 0.115, 0]}>
        <cylinderGeometry args={[2.03, 2.03, 0.04, 48, 1, true, a0, arc]} />
        <meshStandardMaterial color={lvl >= 10 ? GOLD : roof} metalness={lvl >= 10 ? 0.5 : 0} side={2} />
      </mesh>
      {Array.from({ length: posts }, (_, i) => {
        const a = a0 + (arc * (i + (full ? 0 : 0.5))) / posts
        // A full ring hangs from the back posts only, so the view into the bowl stays open.
        if (full && Math.sin(a) + Math.cos(a) > 0.2) return null
        return (
          <mesh key={i} position={[Math.sin(a) * 2.0, y / 2, Math.cos(a) * 2.0]} castShadow>
            <boxGeometry args={[0.05, y, 0.05]} />
            {m('#b0bec5')}
          </mesh>
        )
      })}
      {full && (
        <group>
          {/* VIP suites: a glass band under the roof, all the way round. */}
          <mesh position={[0, sh + 0.42, 0]}>
            <cylinderGeometry args={[1.98, 1.98, 0.32, 48, 1, true]} />
            {ghost ? m('#90caf9') : <primitive object={glassMat('#90caf9')} attach="material" dispose={null} />}
          </mesh>
          {!ghost && [0.25, 0.75, 1.25, 1.75].map((t) => {
            const a = Math.PI * t
            return (
              <group key={t} position={[Math.sin(a) * 2.3, 0, Math.cos(a) * 2.3]}>
                <mesh position={[0, (y + 1.4) / 2, 0]} castShadow><cylinderGeometry args={[0.04, 0.07, y + 1.4, 6]} />{m('#90a4ae')}</mesh>
                <mesh position={[0, y + 1.45, 0]} rotation-y={a + Math.PI}><boxGeometry args={[0.5, 0.26, 0.06]} /><primitive object={glowMats.bulb} attach="material" dispose={null} /></mesh>
              </group>
            )
          })}
          {!ghost && <Lights from={[-1.4, y + 0.16, 1.45]} to={[1.4, y + 0.16, 1.45]} n={14} />}
        </group>
      )}
      {/* The big screen, on two legs in the gap of the stands (over the roof when it's a full ring). */}
      {!ghost && (
        <group position={[Math.sin(gap) * 1.55, 0, Math.cos(gap) * 1.55]} rotation-y={gap + Math.PI}>
          {[-0.4, 0.4].map((x) => <mesh key={x} position={[x, (full ? y + 0.6 : 0.9) / 2, 0]} castShadow><boxGeometry args={[0.06, full ? y + 0.6 : 0.9, 0.06]} />{m('#455a64')}</mesh>)}
          <mesh position={[0, full ? y + 0.9 : 1.2, 0]} castShadow><boxGeometry args={[1.0, 0.6, 0.08]} />{m('#263238')}</mesh>
          <mesh position={[0, full ? y + 0.9 : 1.2, 0.045]}><planeGeometry args={[0.92, 0.52]} /><primitive object={glowMats.screen} attach="material" dispose={null} /></mesh>
        </group>
      )}
    </group>
  )
}

// A lattice tower: four legs with cross bracing every `step`.
function Truss({ m, at, h, w = 0.3, c = '#90a4ae' }: { m: ReturnType<typeof useMat>; at: [number, number, number]; h: number; w?: number; c?: string }) {
  const n = Math.max(1, Math.floor(h / 0.4))
  return (
    <group position={at}>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} position={[(sx * w) / 2, h / 2, (sz * w) / 2]} castShadow><boxGeometry args={[0.035, h, 0.035]} />{m(c)}</mesh>))}
      {Array.from({ length: n }, (_, i) => (
        <group key={i}>
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((ry) => (
            <group key={ry} rotation-y={ry}>
              <mesh position={[0, (i + 0.5) * (h / n), w / 2]} rotation-z={i % 2 ? 0.7 : -0.7}><boxGeometry args={[0.015, Math.hypot(w, h / n), 0.015]} />{m(c)}</mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

// One pump, facing the forecourt both ways, standing on y = 0.
function Pump({ m, roof, x }: { m: ReturnType<typeof useMat>; roof: string; x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.33, 0]} castShadow>
        <boxGeometry args={[0.34, 0.66, 0.26]} />
        {m('#fafafa')}
      </mesh>
      {[0.137, -0.137].map((z) => (
        <mesh key={z} position={[0, 0.33, z]} rotation-y={z < 0 ? Math.PI : 0}>
          <planeGeometry args={[0.32, 0.64]} />
          {m('#ffffff', pumpTex(roof))}
        </mesh>
      ))}
    </group>
  )
}

// The pump island under the gas canopy: two pumps. A 2x2 or 4x4 block's canopy
// is two or four times as big, but pumps stay pump-sized (people fill up at
// them): it gets a second island and more pumps along each one instead.
function GasPumps({ m, roof }: { m: ReturnType<typeof useMat>; roof: string }) {
  const [sx, sy, sz] = useMergeScale()
  const k = sx === sy && sy === sz ? sx : 1
  if (k === 1) {
    return (
      <group>
        <mesh position={[0, 0.1, -0.45]} receiveShadow>
          <boxGeometry args={[1.5, 0.1, 0.36]} />
          {m('#ffca28')}
        </mesh>
        {[-0.4, 0.4].map((x) => (
          <group key={x} position={[0, 0.15, -0.45]}>
            <Pump m={m} roof={roof} x={x} />
          </group>
        ))}
      </group>
    )
  }
  // Islands as long as the block's island, at true height, true-sized pumps
  // spread along them; one row on the back posts' line, one under the front.
  const len = 1.5 * k
  const n = 2 * k - 1
  return (
    <group>
      {[-0.45, 0.15].map((z) => (
        <group key={z} position={[0, 0.055, z]}>
          <Upright size={1}>
            <mesh position={[0, 0.05, 0]} receiveShadow>
              <boxGeometry args={[len, 0.1, 0.36]} />
              {m('#ffca28')}
            </mesh>
            <group position-y={0.1}>
              {Array.from({ length: n }, (_, i) => <Pump key={i} m={m} roof={roof} x={((i + 0.5) / n - 0.5) * (len - 0.3)} />)}
            </group>
          </Upright>
        </group>
      ))}
    </group>
  )
}

// A tall roadside pylon with a sign box on top (and whatever else hangs on it:
// `children`, in the pylon's own frame). One piece, kept in shape on a merged pair.
function Pylon({ m, at, h, w, text, bg, fg, frame, children }: { m: ReturnType<typeof useMat>; at: [number, number, number]; h: number; w: number; text: string; bg: string; fg: string; frame: string; children?: ReactNode }) {
  return (
    <group position={at}>
      <Upright>
        {[-1, 1].map((sd) => <mesh key={sd} position={[(sd * w) / 3, h / 2, 0]} castShadow><boxGeometry args={[0.07, h, 0.07]} />{m('#90a4ae')}</mesh>)}
        <mesh position={[0, h + w / 8, 0]} castShadow><boxGeometry args={[w + 0.1, w / 4 + 0.1, 0.1]} />{m(frame)}</mesh>
        <Sign text={text} w={w} y={h + w / 8} z={0.056} bg={bg} fg={fg} />
        <Lights from={[-w / 2, h + w / 4 + 0.09, 0.06]} to={[w / 2, h + w / 4 + 0.09, 0.06]} n={8} />
        {children}
      </Upright>
    </group>
  )
}

// The grown gas station: a tall price pylon (level 4), then a travel centre with
// solar panels on the canopy and a second, taller pylon (level 7).
function GasGrown({ m, lvl, cl, ghost, roof }: { m: ReturnType<typeof useMat>; lvl: number; cl: number; ghost?: boolean; roof: string }) {
  const big = growthStage(lvl) === 3
  if (ghost) return null
  return (
    <group>
      <Pylon m={m} at={[-1.55, 0, -0.85]} h={big ? 3.4 : 2.6} w={0.9} text={big ? 'TRAVEL' : 'GAS'} bg={roof} fg="#ffffff" frame="#fafafa">
        <group position={[0, big ? 3.0 : 2.2, 0.03]}>
          <mesh><boxGeometry args={[0.7, 0.28, 0.06]} />{m('#263238')}</mesh>
          <mesh position={[0, 0, 0.035]}><planeGeometry args={[0.62, 0.22]} /><meshBasicMaterial map={signTexture('⛽ 1.89', '#263238', '#ffca28', 0.62 / 0.22)} /></mesh>
        </group>
      </Pylon>
      {big && (
        <group>
          {/* Solar panels across the canopy roof. */}
          {[-0.75, -0.25, 0.25, 0.75].flatMap((x) => [-0.55, 0.05].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 1.66 + cl, -0.2 + z + 0.25]} rotation-x={-0.25}>
              <boxGeometry args={[0.44, 0.02, 0.5]} />
              <meshStandardMaterial color="#1a237e" metalness={0.4} roughness={0.3} />
            </mesh>
          )))}
          {/* EV chargers along the side. */}
          {[0.1, 0.45].map((z) => (
            <group key={z} position={[1.88, 0, z]}>
              <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.12, 0.6, 0.18]} />{m('#eceff1')}</mesh>
              <mesh position={[-0.061, 0.42, 0]} rotation-y={-Math.PI / 2}><planeGeometry args={[0.1, 0.1]} /><primitive object={glowMats.bulb} attach="material" dispose={null} /></mesh>
              <mesh position={[0, 0.62, 0]}><boxGeometry args={[0.14, 0.04, 0.2]} />{m('#43a047')}</mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

// The grown Drive-In: a marquee on a pole by the gate (level 4), then truss
// towers either side of the screen with spotlights on top (level 7).
function DriveInGrown({ m, lvl, sl, ghost, roof }: { m: ReturnType<typeof useMat>; lvl: number; sl: number; ghost?: boolean; roof: string }) {
  if (ghost) return null
  const big = growthStage(lvl) === 3
  return (
    <group>
      <Pylon m={m} at={[1.4, 0, 1.55]} h={big ? 2.4 : 1.8} w={1.0} text="MOVIES" bg="#fafafa" fg="#3e2723" frame={roof} />
      {big && [-1.75, 1.75].map((x) => (
        // Grows to a merged pair's height, so the light string still runs top to top.
        <group key={x} position={[x, 0, -1.5]} userData={{ stretch: true }}><Upright tall><group position={[-x, 0, 1.5]}>
          <Truss m={m} at={[x, 0, -1.5]} h={3.2 + sl} />
          <mesh position={[x, 3.24 + sl, -1.5]} castShadow><boxGeometry args={[0.4, 0.08, 0.4]} />{m('#455a64')}</mesh>
          <mesh position={[x, 3.42 + sl, -1.45]} rotation-x={-0.6}><cylinderGeometry args={[0.1, 0.08, 0.2, 10]} />{m('#eceff1')}</mesh>
          <mesh position={[x, 3.48 + sl, -1.38]} rotation-x={-0.6}><circleGeometry args={[0.08, 10]} /><primitive object={glowMats.bulb} attach="material" dispose={null} /></mesh>
        </group></Upright></group>
      ))}
      {big && <Lights from={[-1.75, 3.33 + sl, -1.38]} to={[1.75, 3.33 + sl, -1.38]} n={16} />}
    </group>
  )
}

// Warm pool of light on the ground that only shows after dark.
export function LightPool({ r, x = 0, z = 0, y = 0.075 }: { r: number; x?: number; z?: number; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]} renderOrder={2}>
      <planeGeometry args={[r * 2, r * 2]} />
      <primitive object={glowMats.pool} attach="material" dispose={null} />
    </mesh>
  )
}

// Clan-colored parts stay out of the Batch merge: the color can arrive after
// the town is merged, and a merged copy would keep the old one.
const LIVE = { noBatch: true }

// The Crew House flies a flag in the player's clan color.
function CrewFlag({ x, z }: { x: number; z: number }) {
  const color = useGame((s) => s.clanBadge?.color ?? '#ff7043')
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.8, 0]} castShadow><cylinderGeometry args={[0.025, 0.03, 1.6, 8]} /><meshStandardMaterial color="#cfd8dc" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 1.62, 0]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#ffd54f" /></mesh>
      <mesh position={[0.24, 1.38, 0]} castShadow userData={LIVE}><boxGeometry args={[0.46, 0.3, 0.02]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0.24, 1.38, 0.012]}><circleGeometry args={[0.08, 16]} /><meshStandardMaterial color="#fffde7" /></mesh>
    </group>
  )
}

// Crew House: a corrugated Quonset clubhouse with a roll-up door, a deck out
// front and flags in the clan's color, so it reads nothing like a storefront.
function CrewHouse({ m, ghost, sign, bulb, win }: { m: ReturnType<typeof useMat>; ghost?: boolean; sign: boolean; bulb: React.ReactNode; win: React.ReactNode }) {
  const clan = useGame((s) => s.clanBadge?.color ?? '#ff7043')
  const r = 0.95
  const len = 1.5
  const hx = -0.55
  return (
    <group>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[3.9, 0.05, 1.9]} />
        {m('#ffffff', paverTex(4, 2))}
      </mesh>
      {/* Half-buried ribbed tube makes the arched hut. */}
      <mesh position={[hx, 0.05, -0.1]} rotation-x={Math.PI / 2} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, len, 14, 1, true]} />
        <meshStandardMaterial color={ghost ? '#66bb6a' : '#cfd8dc'} metalness={ghost ? 0 : 0.15} roughness={0.55} flatShading side={2} transparent={ghost} opacity={ghost ? 0.55 : 1} />
      </mesh>
      {[-1, 1].map((e) => (
        <mesh key={e} position={[hx, 0.05, -0.1 + e * (len / 2)]} rotation-y={e < 0 ? Math.PI : 0}>
          <circleGeometry args={[r, 14, 0, Math.PI]} />
          {m('#37474f')}
        </mesh>
      ))}
      {/* Roll-up garage door with a clan-color racing stripe. */}
      <mesh position={[hx, 0.42, len / 2 - 0.09]}>
        <planeGeometry args={[0.95, 0.74]} />
        {m('#cfd8dc')}
      </mesh>
      {[0.2, 0.36, 0.52, 0.68].map((y) => (
        <mesh key={y} position={[hx, y, len / 2 - 0.085]}>
          <planeGeometry args={[0.95, 0.015]} />
          {m('#90a4ae')}
        </mesh>
      ))}
      <mesh userData={LIVE} position={[hx, 0.44, len / 2 - 0.08]}>
        <planeGeometry args={[0.95, 0.09]} />
        <meshStandardMaterial color={ghost ? '#66bb6a' : clan} />
      </mesh>
      {/* Porthole windows either side of the door. */}
      {[-0.68, 0.68].map((dx) => (
        <mesh key={dx} position={[hx + dx, 0.5, len / 2 - 0.085]}>
          <circleGeometry args={[0.12, 16]} />
          {win}
        </mesh>
      ))}
      {/* Clan banner hanging down the arch. */}
      <mesh userData={LIVE} position={[hx, 0.86, len / 2 - 0.08]}>
        <planeGeometry args={[0.36, 0.22]} />
        <meshStandardMaterial color={ghost ? '#66bb6a' : clan} />
      </mesh>
      <mesh position={[hx, 0.86, len / 2 - 0.075]}>
        <circleGeometry args={[0.07, 12]} />
        {m('#fffde7')}
      </mesh>
      {/* Wooden deck with a picnic table and a glowing fire barrel. */}
      <mesh position={[1.15, 0.09, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.35, 0.08, 1.5]} />
        {m('#8d6e63')}
      </mesh>
      {!ghost && (
        <group position={[1.05, 0.13, -0.15]}>
          <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.7, 0.05, 0.36]} />{m('#a1887f')}</mesh>
          {[-0.28, 0.28].map((x) => <mesh key={x} position={[x, 0.15, 0]}><boxGeometry args={[0.05, 0.3, 0.3]} />{m('#6d4c41')}</mesh>)}
          {[-0.3, 0.3].map((z) => (
            <group key={z}>
              <mesh position={[0, 0.17, z]} castShadow><boxGeometry args={[0.7, 0.04, 0.12]} />{m('#a1887f')}</mesh>
              {[-0.26, 0.26].map((x) => <mesh key={x} position={[x, 0.075, z]}><boxGeometry args={[0.04, 0.15, 0.08]} />{m('#6d4c41')}</mesh>)}
            </group>
          ))}
          <group position={[0.62, 0, 0.55]}>
            <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.13, 0.13, 0.4, 12]} />{m('#455a64')}</mesh>
            <mesh position={[0, 0.41, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.11, 12]} />{bulb}</mesh>
          </group>
          <LightPool r={0.6} x={0.62} z={0.55} />
        </group>
      )}
      {!ghost && <CrewFlag x={1.5} z={-0.7} />}
      {!ghost && <CrewFlag x={-1.85} z={0.75} />}
      {/* Sign on a frame across the top of the arch. */}
      {sign && (
        <group position={[hx, 1.22, len / 2 - 0.15]}>
          {[-0.5, 0.5].map((x) => <mesh key={x} position={[x, -0.18, -0.03]}><boxGeometry args={[0.04, 0.36, 0.04]} />{m('#37474f')}</mesh>)}
          <mesh userData={LIVE} position={[0, 0, -0.03]}><boxGeometry args={[1.28, 0.36, 0.05]} /><meshStandardMaterial color={ghost ? '#66bb6a' : clan} /></mesh>
          <Sign text="CREW HOUSE" w={1.2} y={0} z={0} bg="#263238" fg="#ffffff" />
        </group>
      )}
    </group>
  )
}

// Advances the shared Drive-In film; many screens still redraw it once a frame.
function MovieReel() {
  useFrame(() => tickMovie())
  return null
}

function Sign({ text, w, y, z, bg, fg }: { text: string; w: number; y: number; z: number; bg?: string; fg?: string }) {
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[w, w / 4]} />
      <primitive object={signMat(text, bg, fg)} attach="material" dispose={null} />
    </mesh>
  )
}

export function BuildingModel({ def, ghost, valid, level = 1 }: Props) {
  const [bx] = useBays()
  const m = useMat(ghost, valid)
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  const lift = levelLift(lvl)
  const trim = !ghost
  const W = def.w * TILE
  const D = def.h * TILE
  const sign = !ghost && def.sign
  // Windows share one material that lights up warmly at night.
  const win = ghost ? m('#ffffff', windowTex()) : <primitive object={glowMats.window} attach="material" dispose={null} />
  const bulb = ghost ? m('#fff8e1') : <primitive object={glowMats.bulb} attach="material" dispose={null} />

  // A building from a newer version of the game: a tarp-covered crate and a cone.
  if (def.parked)
    return (
      <group>
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[W * 0.6, 0.7, D * 0.6]} />
          {m(def.roof)}
        </mesh>
        <mesh position={[0.62, 0.22, 0.62]} castShadow>
          <coneGeometry args={[0.16, 0.44, 12]} />
          {m(def.color)}
        </mesh>
      </group>
    )

  if (lvl >= 4 && GROWTH_MODELS.has(def.id)) return <GrowthModel def={def} ghost={ghost} m={m} win={win} bulb={bulb} level={lvl} />
  if (NEW_MODELS.has(def.id)) return <NewBuildingModel def={def} ghost={ghost} valid={valid} m={m} win={win} bulb={bulb} level={lvl} />
  if (OFFICE_MODELS.has(def.id)) return <OfficeModel def={def} ghost={ghost} m={m} bulb={bulb} level={lvl} />
  if (TRAILER_JUNK.has(def.id)) return <TrailerJunkModel id={def.id} m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} lift={lift} roof={def.roof} color={def.color} />
  if (PARK_STYLES.has(def.id)) return <ParkStyleModel id={def.id} m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} lift={lift} roof={def.roof} color={def.color} />
  if (CAMPUS_MODELS.has(def.id)) return <CampusModel def={def} ghost={ghost} m={m} win={win} bulb={bulb} level={lvl} />

  switch (def.id) {
    case 'bush':
      return (
        <group>
          {[[-0.3, 0.1, 0.42], [0.25, -0.2, 0.5], [0.1, 0.3, 0.36]].map(([x, z, r], i) => (
            <mesh key={i} position={[x, r * 0.8, z]} castShadow>
              <sphereGeometry args={[r, 10, 8]} />
              {m(PAL.bush[i % 2])}
            </mesh>
          ))}
          {!ghost && <ObstacleDetail id={def.id} />}
        </group>
      )
    case 'rock':
      return (
        <group>
          <mesh position={[0, 0.4, 0]} rotation={[0.3, 0.6, 0.2]} castShadow>
            <dodecahedronGeometry args={[0.65, 0]} />
            {m(def.color)}
          </mesh>
          <mesh position={[0.5, 0.2, 0.35]} rotation={[0.5, 0.2, 0]} castShadow>
            <dodecahedronGeometry args={[0.3, 0]} />
            {m(def.roof)}
          </mesh>
          {!ghost && <ObstacleDetail id={def.id} />}
        </group>
      )
    case 'cactus':
      return (
        <group>
          <mesh position={[0, 0.75, 0]} castShadow>
            <capsuleGeometry args={[0.2, 1.1, 4, 10]} />
            {m(def.color)}
          </mesh>
          <mesh position={[0.35, 0.85, 0]} rotation-z={-0.2} castShadow>
            <capsuleGeometry args={[0.12, 0.45, 4, 8]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[-0.32, 1.05, 0]} rotation-z={0.25} castShadow>
            <capsuleGeometry args={[0.11, 0.35, 4, 8]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.55, 0.6, 0.12, 14]} />
            {m('#d7b77b')}
          </mesh>
          {!ghost && <ObstacleDetail id={def.id} />}
        </group>
      )
    case 'tree': {
      const g = ghost ? (valid ? '#66bb6a' : '#ef5350') : null
      if (PAL.bare && !ghost) {
        // Winter: bare branches with snow on the tips.
        return (
          <group>
            <mesh position={[0, 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.16, 1, 7]} />
              {m('#6d4c41')}
            </mesh>
            {[0, 1, 2, 3, 4].map((i) => {
              const a = i * 1.26
              const tilt = 0.6 + (i % 2) * 0.25
              return (
                <group key={i} position={[0, 0.75 + (i % 3) * 0.18, 0]} rotation={[0, a, tilt]}>
                  <mesh position={[0, 0.3, 0]} castShadow>
                    <cylinderGeometry args={[0.025, 0.05, 0.6, 5]} />
                    {m('#6d4c41')}
                  </mesh>
                  <mesh position={[0, 0.62, 0]}>
                    <icosahedronGeometry args={[0.09, 0]} />
                    <meshStandardMaterial color="#ffffff" flatShading />
                  </mesh>
                </group>
              )
            })}
            <mesh position={[0, LAYER.lot, 0]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.55, 16]} />
              <meshStandardMaterial color="#ffffff" {...decal()} />
            </mesh>
          </group>
        )
      }
      // Cartoon oak: tapered trunk under a cluster of faceted leaf balls, coloured for the season.
      return (
        <group>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.17, 0.7, 7]} />
            {m('#7b5034')}
          </mesh>
          {([[0, 1.15, 0, 0.55], [0.32, 0.95, 0.12, 0.38], [-0.3, 0.98, -0.08, 0.4], [0.05, 1.5, -0.05, 0.38], [-0.08, 1.02, 0.32, 0.34]] as const).map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} castShadow>
              <icosahedronGeometry args={[r, 1]} />
              <meshStandardMaterial color={g ?? PAL.leaves[i]} transparent={ghost} opacity={ghost ? 0.55 : 1} flatShading />
            </mesh>
          ))}
          {!ghost && <TreeDetail />}
        </group>
      )
    }
    case 'palm':
      // Curved, banded trunk with drooping fronds and coconuts.
      return (
        <group>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[i * i * 0.012, 0.18 + i * 0.32, 0]} rotation-z={-0.05 - i * 0.03} castShadow>
              <cylinderGeometry args={[0.09 - i * 0.008, 0.11 - i * 0.008, 0.34, 7]} />
              {m(i % 2 ? '#a1887f' : '#8d6e63')}
            </mesh>
          ))}
          {/* The crown the fronds sprout from. */}
          <mesh position={[0.2, 1.66, 0]}><cylinderGeometry args={[0.08, 0.075, 0.14, 7]} />{m('#7a8a3a')}</mesh>
          <group position={[0.2, 1.7, 0]}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <group key={i} rotation-y={(i * Math.PI * 2) / 7}>
                {[0, 1, 2].map((j) => (
                  <mesh key={j} position={[0.17 + j * 0.24, 0.02 - j * j * 0.07, 0]} rotation-z={-0.15 - j * 0.35} castShadow>
                    <boxGeometry args={[0.28, 0.03, 0.2 - j * 0.04]} />
                    {m(j === 2 ? PAL.fronds[1] : PAL.fronds[0])}
                  </mesh>
                ))}
              </group>
            ))}
            {[0, 1, 2].map((i) => (
              <mesh key={`c${i}`} position={[Math.cos(i * 2.1) * 0.1, -0.1, Math.sin(i * 2.1) * 0.1]}>
                <sphereGeometry args={[0.07, 8, 6]} />
                {m('#6d4c41')}
              </mesh>
            ))}
          </group>
        </group>
      )
    case 'fountain':
      return (
        <group>
          <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.85, 0.9, 0.3, 24]} />
            {m(def.color)}
          </mesh>
          <mesh position={[0, 0.31, 0]}>
            <cylinderGeometry args={[0.72, 0.72, 0.03, 24]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.18, 0.8]} />
            {m(def.color)}
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <sphereGeometry args={[0.22, 12, 8]} />
            {m('#b3e5fc')}
          </mesh>
          {!ghost && <LightPool r={1.1} />}
          {!ghost && <FountainDetail stone={def.color} />}
        </group>
      )
    case 'flowers':
      if (!ghost) return <PropMesh parts={DECOR_PROPS.flowers()} />
      return (
        <group>
          <mesh position={[0, 0.08, 0]} receiveShadow><boxGeometry args={[1.3, 0.16, 1.3]} />{m(def.roof)}</mesh>
          {[[-0.4, -0.4], [0, -0.35], [0.4, -0.4], [-0.35, 0], [0.05, 0.05], [0.4, 0], [-0.4, 0.4], [0, 0.4], [0.4, 0.38]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.26, z]}><sphereGeometry args={[0.13, 8, 6]} />{m(['#e91e63', '#ffeb3b', '#ab47bc', '#ff7043'][i % 4])}</mesh>
          ))}
        </group>
      )
    case 'lamp':
      if (!ghost)
        return (
          <group>
            <PropMesh parts={DECOR_PROPS.lamp()} />
            <LightPool r={0.9} x={0.4} />
          </group>
        )
      return (
        <group>
          <mesh position={[0, 0.9, 0]} castShadow><cylinderGeometry args={[0.04, 0.06, 1.8]} />{m(def.color)}</mesh>
          <mesh position={[0.2, 1.78, 0]}><boxGeometry args={[0.45, 0.05, 0.08]} />{m(def.color)}</mesh>
          <mesh position={[0.38, 1.72, 0]}><sphereGeometry args={[0.1, 10, 8]} />{bulb}</mesh>
          {!ghost && <LightPool r={0.9} x={0.38} />}
        </group>
      )
    case 'bench':
      if (!ghost)
        return (
          <group>
            <PropMesh parts={DECOR_PROPS.bench(def.color)} />
            {/* A litter bin beside it. */}
            <group position={[0.74, 0, 0.08]} scale={1.2}><PropMesh parts={benchBin()} /></group>
          </group>
        )
      return (
        <group>
          <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[1, 0.06, 0.32]} />{m(def.color)}</mesh>
          <mesh position={[0, 0.5, -0.15]} castShadow><boxGeometry args={[1, 0.3, 0.05]} />{m(def.color)}</mesh>
          {[-0.42, 0.42].map((x) => <mesh key={x} position={[x, 0.15, 0]}><boxGeometry args={[0.06, 0.3, 0.3]} />{m(def.roof)}</mesh>)}
        </group>
      )
    case 'billboard':
      return (
        <group>
          {[-0.5, 0.5].map((x) => <mesh key={x} position={[x, 0.9, 0]} castShadow><boxGeometry args={[0.08, 1.8, 0.07]} />{m('#78909c')}</mesh>)}
          <mesh position={[0, 1.7, 0]} castShadow><boxGeometry args={[1.8, 0.8, 0.08]} />{m(def.color)}</mesh>
          {!ghost && (
            <mesh position={[0, 1.7, 0.05]}>
              <planeGeometry args={[1.7, 0.7]} />
              <meshBasicMaterial map={signTexture('CARTOPIA', '#1e88e5', '#ffffff', 1.7 / 0.7)} toneMapped={false} />
            </mesh>
          )}
          {!ghost && [-0.5, 0.5].map((x) => (
            <mesh key={x} position={[x, 1.215, 0.21]} rotation-x={-0.6}><boxGeometry args={[0.12, 0.08, 0.12]} />{bulb}</mesh>
          ))}
          {!ghost && <LightPool r={0.8} z={0.5} />}
          {!ghost && <BillboardDetail />}
        </group>
      )
    case 'statue':
      return (
        <group>
          <mesh position={[0, 0.35, 0]} castShadow><boxGeometry args={[1, 0.7, 1]} />{m(def.roof)}</mesh>
          <group position={[0, 0.7, 0]}>
            <Upright>
              <group rotation-y={0.6} scale={1.2}>
                {ghost ? <mesh position-y={0.25}><boxGeometry args={[0.7, 0.4, 1.2]} />{m(def.color)}</mesh> : <CarModel body="super" color={def.color} />}
              </group>
            </Upright>
          </group>
          {!ghost && <StatueDetail stone={def.roof} />}
        </group>
      )
    case 'pond':
      return (
        <group>
          <mesh position={[0, 0.03, 0]} receiveShadow><cylinderGeometry args={[1.8, 1.8, 0.06, 32]} />{m(def.roof)}</mesh>
          <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[1.5, 1.5, 0.04, 32]} />{m(def.color)}</mesh>
          {!ghost && [[0.4, 0.2], [-0.5, -0.3]].map(([x, z], i) => (
            <group key={i} position={[x, 0.15, z]}>
              <mesh><sphereGeometry args={[0.12, 10, 8]} /><meshStandardMaterial color="#fff59d" /></mesh>
              <mesh position={[0, 0.1, 0.08]}><sphereGeometry args={[0.07, 8, 6]} /><meshStandardMaterial color="#fff59d" /></mesh>
              <mesh position={[0, 0.1, 0.16]}><coneGeometry args={[0.03, 0.06, 6]} /><meshStandardMaterial color="#ff9800" /></mesh>
            </group>
          ))}
          {[[1.4, 1.2], [-1.3, 1.3], [1.3, -1.3]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.3, z]} castShadow><sphereGeometry args={[0.3, 10, 8]} />{m('#388e3c')}</mesh>
          ))}
          {!ghost && <PondDetail />}
        </group>
      )
    case 'stadium': {
      // Upgrades raise the stands and the floodlights.
      const sh = 0.9 + lift * 0.5
      return (
        <group>
          <mesh position={[0, 0.03, 0]} receiveShadow><cylinderGeometry args={[1.9, 1.9, 0.06, 40]} />{m('#5f646b')}</mesh>
          <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[1.2, 1.2, 0.04, 40]} />{m('#66bb6a')}</mesh>
          <mesh position={[0, sh / 2, 0]} castShadow>
            <cylinderGeometry args={[1.95, 1.95, sh, 40, 1, true, Math.PI * 0.15, Math.PI * 1.1]} />
            <meshStandardMaterial color={ghost ? (valid ? '#66bb6a' : '#ef5350') : def.color} side={2} transparent={ghost} opacity={ghost ? 0.55 : 1} />
          </mesh>
          <mesh position={[0, sh + 0.05, 0]}>
            <cylinderGeometry args={[2.0, 2.0, 0.12, 40, 1, true, Math.PI * 0.15, Math.PI * 1.1]} />
            <meshStandardMaterial color={trim && lvl >= 9 ? GOLD : def.roof} metalness={trim && lvl >= 9 ? 0.5 : 0} side={2} />
          </mesh>
          {/* Track lane line and a chequered start line. */}
          <mesh position={[0, 0.07, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.53, 1.57, 48]} />
            <meshStandardMaterial color={ghost ? (valid ? '#66bb6a' : '#ef5350') : '#fafafa'} transparent={ghost} opacity={ghost ? 0.55 : 1} {...decal()} />
          </mesh>
          {!ghost && (
            <mesh position={[0, 0.08, 1.55]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.7, 0.18]} />
              <meshBasicMaterial map={signTexture('▚▚▚▚', '#ffffff', '#111111')} {...decal(2)} />
            </mesh>
          )}
          {/* Crowd: coloured seat rows along the stands. */}
          {!ghost && [0.3, 0.55, 0.8].map((y, i) => (
            <mesh key={y} position={[0, (y * sh) / 0.9, 0]}>
              <cylinderGeometry args={[1.9 - i * 0.02, 1.9 - i * 0.02, 0.06, 40, 1, true, Math.PI * 0.15, Math.PI * 1.1]} />
              <meshStandardMaterial color={['#ffca28', '#42a5f5', '#ef5350'][i]} side={2} />
            </mesh>
          ))}
          {/* Floodlight towers that light the track at night. */}
          {!ghost && [[-1.6, 1.6], [1.6, 1.6]].map(([x, z]) => (
            <group key={x} position={[x, 0, z]}>
              <group>
                <mesh position={[0, 1.1 + lift / 2, 0]} castShadow><cylinderGeometry args={[0.04, 0.06, 2.2 + lift, 6]} />{m('#90a4ae')}</mesh>
                <mesh position={[0, 2.25 + lift, 0]} rotation-y={Math.atan2(-x, -z)}><boxGeometry args={[0.4, 0.22, 0.06]} />{bulb}</mesh>
              </group>
              <LightPool r={1.3} x={-x * 0.5} z={-z * 0.5} y={0.1} />
            </group>
          ))}
          {trim && lvl >= 5 && Array.from({ length: 18 }, (_, i) => {
            const a = Math.PI * 0.15 + (Math.PI * 1.1 * i) / 17
            return (
              <mesh key={i} position={[Math.sin(a) * 1.99, sh + 0.13, Math.cos(a) * 1.99]}>
                <sphereGeometry args={[0.04, 6, 5]} />
                <primitive object={glowMats.bulb} attach="material" dispose={null} />
              </mesh>
            )
          })}
          {trim && lvl >= 8 && [0.35, 0.7, 1.05].map((t) => {
            const a = Math.PI * 0.15 + Math.PI * 1.1 * t
            // Flying in over the bowl, so they stay on the lot.
            return <Flag key={t} x={Math.sin(a) * 1.95} y={sh + 0.1} z={Math.cos(a) * 1.95} rot={a + Math.PI / 2} color={def.roof} star={lvl >= 10} />
          })}
          {!ghost && <SpeedwayDetail sh={sh} roof={def.roof} />}
          {lvl >= 4 && <SpeedwayGrown m={m} sh={sh} roof={def.roof} lvl={lvl} ghost={ghost} />}
          {sign && <Sign text="SPEEDWAY" w={2} y={1.25 + lift * 0.5} z={0} bg="#c62828" fg="#ffffff" />}
        </group>
      )
    }
    case 'house':
      if (lvl > 1) return <HouseLevels def={def} level={lvl} ghost={ghost} m={m} win={win} bulb={bulb} />
      return (
        <group>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.3, 1, 1.2]} />
            {m(def.color, sidingTex(1, 1.5))}
          </mesh>
          <mesh position={[0, 1.35, 0]} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[1.15, 0.7, 4]} />
            {m(SEASON === 'winter' ? '#f4f8fb' : def.roof, shingleTex(3, 1.5))}
          </mesh>
          <mesh position={[0, 0.3, 0.61]}>
            <planeGeometry args={[0.3, 0.6]} />
            {m('#795548')}
          </mesh>
          {[-0.4, 0.4].map((x) => (
            <mesh key={x} position={[x, 0.6, 0.605]}>
              <planeGeometry args={[0.28, 0.26]} />
              {win}
            </mesh>
          ))}
          <mesh position={[0.656, 0.6, 0]} rotation-y={Math.PI / 2}>
            <planeGeometry args={[0.3, 0.26]} />
            {win}
          </mesh>
          {/* Chimney, porch light, step, path and a picket fence. */}
          <mesh position={[0.35, 1.5, -0.25]} castShadow>
            <boxGeometry args={[0.18, 0.5, 0.18]} />
            {m('#a1665e', brickTex(0.3, 0.5))}
          </mesh>
          <mesh position={[0.25, 0.68, 0.64]}>
            <boxGeometry args={[0.07, 0.07, 0.06]} />
            {bulb}
          </mesh>
          {!ghost && (
            <>
              <LightPool r={0.55} z={0.9} />
              <mesh position={[0, 0.03, 0.7]} receiveShadow><boxGeometry args={[0.42, 0.06, 0.16]} />{m('#bdbdbd')}</mesh>
              <mesh position={[0, LAYER.lot + 0.015, 0.85]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.3, 0.3]} /><meshStandardMaterial color="#d7ccc8" {...decal()} /></mesh>
              {[-0.75, -0.6, -0.45, -0.3, 0.3, 0.45, 0.6, 0.75].map((x) => (
                <mesh key={x} position={[x, 0.13, 0.95]} castShadow><boxGeometry args={[0.05, 0.26, 0.03]} />{m('#fafafa')}</mesh>
              ))}
              {[-0.525, 0.525].map((x) => (
                <mesh key={x} position={[x, 0.18, 0.95]}><boxGeometry args={[0.5, 0.04, 0.02]} />{m('#fafafa')}</mesh>
              ))}
              <group position={[0.85, 0, 0.85]}>
                <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.03, 0.4, 0.03]} />{m('#5d4037')}</mesh>
                <mesh position={[0, 0.42, 0]}><boxGeometry args={[0.1, 0.08, 0.16]} />{m('#1e88e5')}</mesh>
              </group>
              <HouseDetail />
            </>
          )}
        </group>
      )
    case 'showroom':
      return (
        <group>
          {/* Paved plaza with a brick plinth under the glass rotunda. */}
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <boxGeometry args={[W * 0.95, 0.1, D * 0.95]} />
            {m('#ffffff', paverTex(4))}
          </mesh>
          <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.62, 1.7, 0.22, 32]} />
            {m('#b0796b', brickTex(6, 0.4))}
          </mesh>
          <mesh position={[0, 1.1, 0]} castShadow>
            <cylinderGeometry args={[1.5, 1.5, 1.6, 32, 1, true]} />
            <meshStandardMaterial color={ghost ? (valid ? '#66bb6a' : '#ef5350') : '#9be7f5'} transparent opacity={ghost ? 0.55 : 0.55} metalness={0.4} roughness={0.05} side={2} />
          </mesh>
          {/* Chrome mullions around the glass. */}
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.sin(a) * 1.5, 1.1, Math.cos(a) * 1.5]} castShadow>
                <boxGeometry args={[0.07, 1.6, 0.07]} />
                <meshStandardMaterial color="#eceff1" metalness={0.6} roughness={0.25} />
              </mesh>
            )
          })}
          <mesh position={[0, 2.05, 0]} castShadow>
            <cylinderGeometry args={[1.7, 1.62, 0.32, 32]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[0, 2.05, 0]}>
            <cylinderGeometry args={[1.73, 1.73, 0.12, 32]} />
            {m('#e53935')}
          </mesh>
          {/* Ceiling light and a glow on the plaza after dark. */}
          <mesh position={[0, 1.88, 0]} rotation-x={Math.PI / 2}>
            <circleGeometry args={[1.45, 32]} />
            {bulb}
          </mesh>
          {!ghost && <LightPool r={2.1} y={0.115} />}
          {/* Display car on a turntable. */}
          <mesh position={[0, 0.34, 0]}>
            <cylinderGeometry args={[1.05, 1.05, 0.06, 32]} />
            <meshStandardMaterial color="#cfd8dc" metalness={0.5} roughness={0.3} />
          </mesh>
          {!ghost && (
            <group position={[0, 0.37, 0]} rotation-y={0.6} scale={1.25}>
              <CarModel body="sports" color="#d32f2f" />
            </group>
          )}
          {/* Flags at the plaza corners. */}
          {!ghost && [[-1.75, 1.75, '#e53935'], [1.75, 1.75, '#ffca28'], [1.75, -1.75, '#1e88e5']].map(([x, z, c]) => (
            <group key={c as string} position={[x as number, 0, z as number]}>
              <mesh position={[0, 0.9, 0]} castShadow>
                <cylinderGeometry args={[0.03, 0.03, 1.8]} />
                {m('#eceff1')}
              </mesh>
              {/* Flying in over the plaza, not out over the neighbours. */}
              <mesh position={[(x as number) > 0 ? -0.2 : 0.2, 1.6, 0]}>
                <boxGeometry args={[0.4, 0.26, 0.02]} />
                {m(c as string)}
              </mesh>
            </group>
          ))}
          {sign && <Sign text="SHOWROOM" w={2.4} y={2.05} z={1.72} bg="#eceff1" fg="#37474f" />}
        </group>
      )
    case 'garage':
      return (
        <group>
          {/* Brick workshop with a gravel roof and three roll-up doors. */}
          <mesh position={[0, 0.8, -0.3]} castShadow receiveShadow>
            <boxGeometry args={[W * 0.9, 1.6, D * 0.6]} />
            {m('#c9b8ad', brickTex(4, 2))}
          </mesh>
          <mesh position={[0, 1.66, -0.3]} castShadow>
            <boxGeometry args={[W * 0.95, 0.14, D * 0.65]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[0, 1.745, -0.3]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[W * 0.88, D * 0.58]} />
            {m('#ffffff', gravelTex(4, 2.4))}
          </mesh>
          {[-1.1, 0, 1.1].map((x) => (
            <group key={x}>
              <mesh position={[x, 0.55, D * 0.3 - 0.29]}>
                <planeGeometry args={[0.86, 1.05]} />
                {m('#ffffff', shutterTex())}
              </mesh>
              <mesh position={[x, 1.12, D * 0.3 - 0.28]}>
                <boxGeometry args={[0.96, 0.08, 0.05]} />
                {m('#455a64')}
              </mesh>
              {/* Wall lamp over each door. */}
              <mesh position={[x, 1.21, D * 0.3 - 0.26]}>
                <boxGeometry args={[0.16, 0.06, 0.1]} />
                {bulb}
              </mesh>
            </group>
          ))}
          {/* Concrete apron with oil stains and a tyre stack. */}
          <mesh position={[0, 0.03, 1.1]} receiveShadow>
            <boxGeometry args={[W * 0.9 - 0.01, 0.05, 1.2]} />
            {m('#ffffff', paverTex(4, 1.2))}
          </mesh>
          {!ghost && [-1.1, 0, 1.1].map((x) => <LightPool key={x} r={0.6} x={x} z={0.75} />)}
          {!ghost && [[-0.9, 1.0], [0.4, 1.3]].map(([x, z]) => (
            <mesh key={x} position={[x, 0.065, z]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.22, 16]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} {...decal()} />
            </mesh>
          ))}
          {!ghost && [0, 1, 2].map((i) => (
            <mesh key={i} position={[1.6, 0.1 + i * 0.16, 0.45]} rotation-x={Math.PI / 2} castShadow>
              <torusGeometry args={[0.16, 0.07, 8, 16]} />
              {m('#263238')}
            </mesh>
          ))}
          {!ghost && <GarageDetail W={W} D={D} />}
          {/* A board standing on the roof edge (it used to sit inside the wall, and
              under the eave the roof hid its top half). */}
          {sign && (
            <group position={[0, 1.745, D * 0.3 - 0.36]}>
              {[-0.6, 0.6].map((x) => (
                <mesh key={x} position={[x, 0.06, -0.04]}>
                  <boxGeometry args={[0.05, 0.12, 0.05]} />
                  {m('#37474f')}
                </mesh>
              ))}
              <mesh position={[0, 0.32, -0.025]} castShadow>
                <boxGeometry args={[1.66, 0.44, 0.04]} />
                {m('#37474f')}
              </mesh>
              <Sign text="MY GARAGE" w={1.6} y={0.32} z={0.0} bg="#263238" fg="#ffca28" />
            </group>
          )}
        </group>
      )
    case 'gas': {
      // Canopy rises half as fast as the shop grows.
      const cl = lift * 0.5
      const gasRows: number[] = []
      for (let y = 1.05; y + 0.2 <= 1.1 + lift - 0.1; y += 0.55) gasRows.push(y)
      return (
        <group>
          {/* Forecourt slab. */}
          <mesh position={[0, 0.03, 0]} receiveShadow>
            <boxGeometry args={[W * 0.96, 0.05, D * 0.94]} />
            {m('#ffffff', paverTex(4, 2))}
          </mesh>
          {/* Canopy over the pumps at the back, leaving the front clear for
              cars to swing in from the road, pull up and drive out. */}
          {[[-0.85, -0.45], [0.85, -0.45], [-0.85, -0.9], [0.85, -0.9]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.75 + cl / 2, z]} castShadow>
              <boxGeometry args={[0.12, 1.4 + cl, 0.12]} />
              {m('#eeeeee')}
            </mesh>
          ))}
          <mesh position={[0, 1.5 + cl, -0.2]} castShadow>
            <boxGeometry args={[2.2, 0.22, 1.5]} />
            {m('#fafafa')}
          </mesh>
          <mesh position={[0, 1.5 + cl, -0.2]}>
            <boxGeometry args={[2.24, 0.1, 1.54]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[0, 1.375 + cl, -0.2]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[2.0, 1.3]} />
            {bulb}
          </mesh>
          {!ghost && <LightPool r={1.2} z={0} />}
          <GasPumps m={m} roof={def.roof} />
          {/* Little shop tucked in the back corner, with a striped awning: one
              piece with its windows, so a merged pair keeps them on its walls. */}
          <group>
            <mesh position={[1.53, (1.1 + lift) / 2, -0.65]} castShadow receiveShadow>
              <boxGeometry args={[0.75, 1.1 + lift, 0.6]} />
              {m(def.color, brickTex(1, 1.2 + lift))}
            </mesh>
            <mesh position={[1.53, 1.14 + lift, -0.65]} castShadow>
              <boxGeometry args={[0.82, 0.1, 0.68]} />
              {m(def.roof)}
            </mesh>
            <mesh position={[1.53, 0.45, -0.34]}>
              <planeGeometry args={[0.6, 0.5]} />
              {win}
            </mesh>
            <mesh position={[1.53, 0.84, -0.27]} rotation-x={-0.5}>
              <planeGeometry args={[0.72, 0.28]} />
              {m('#ffffff', awningTex(def.roof))}
            </mesh>
            {gasRows.flatMap((y) => [
              <mesh key={`f${y}`} position={[1.53, y, -0.344]}>
                <planeGeometry args={[0.36, 0.38]} />
                {win}
              </mesh>,
              <mesh key={`s${y}`} position={[1.911, y, -0.65]} rotation-y={Math.PI / 2}>
                <planeGeometry args={[0.36, 0.38]} />
                {win}
              </mesh>,
            ])}
            {/* Upgrades: a white band under the roof and a flag on top. */}
            {trim && lvl >= 3 && (
              <mesh position={[1.53, 1.06 + lift, -0.65]}>
                <boxGeometry args={[0.79, 0.06, 0.64]} />
                {m('#fafafa')}
              </mesh>
            )}
            {trim && lvl >= 8 && <Flag x={1.4} y={1.19 + lift} z={-0.8} color={def.roof} star={lvl >= 10} />}
          </group>
          {/* Price sign on a pole. */}
          {!ghost && (
            <group position={[-1.75, 0, -0.7]}>
              <mesh position={[0, 0.8, -0.03]} castShadow>
                <cylinderGeometry args={[0.04, 0.04, 1.6]} />
                {m('#90a4ae')}
              </mesh>
              <mesh position={[0, 1.6, 0]} castShadow>
                <boxGeometry args={[0.5, 0.4, 0.06]} />
                {m(def.roof)}
              </mesh>
              <mesh position={[0, 1.6, 0.037]}>
                <planeGeometry args={[0.42, 0.32]} />
                <meshBasicMaterial map={signTexture('⛽ 1.99', '#263238', '#ffca28', 0.42 / 0.32)} />
              </mesh>
            </group>
          )}
          {/* Upgrades: canopy bulbs and a gold trim (the shop's band and flag ride with the shop above). */}
          {trim && lvl >= 5 && <Lights from={[-1.05, 1.38 + cl, 0.57]} to={[1.05, 1.38 + cl, 0.57]} n={12} />}
          {trim && lvl >= 9 && (
            <mesh position={[0, 1.5 + cl, 0.565]}>
              <boxGeometry args={[2.26, 0.04, 0.02]} />
              <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} />
            </mesh>
          )}
          {sign && <Sign text="GAS" w={1.2} y={1.5 + cl} z={0.58} bg={def.roof} fg="#ffffff" />}
          {lvl >= 4 && <GasGrown m={m} lvl={lvl} cl={cl} ghost={ghost} roof={def.roof} />}
        </group>
      )
    }
    case 'rescue':
      return <RustysYard m={m} ghost={ghost} sign={!!sign} bulb={bulb} win={win} lvl={lvl} lift={lift} />
    case 'crew':
      return <CrewHouse m={m} ghost={ghost} sign={!!sign} bulb={bulb} win={win} />
    case 'cinema': {
      // Upgrades raise the screen on taller legs.
      const sl = lift * 0.5
      return (
        <group>
          <mesh position={[0, 1.4 + sl, -1.5]} castShadow>
            <boxGeometry args={[3, 1.8, 0.15]} />
            {m('#37474f')}
          </mesh>
          {[-1.2, 1.2].map((x) => (
            <mesh key={x} position={[x, 0.6 + sl / 2, -1.55]} castShadow>
              <boxGeometry args={[0.15, 1.2 + sl, 0.15]} />
              {m('#5d4037')}
            </mesh>
          ))}
          {[-1.9, 1.9].map((x) => (
            <mesh key={x} position={[x, 0.35, 0]} castShadow>
              <boxGeometry args={[0.1, 0.7, 3.8]} />
              {m(def.color)}
            </mesh>
          ))}
          <mesh position={[0, 0.03, 0.2]} receiveShadow>
            <boxGeometry args={[3.6, 0.05, 3]} />
            {m('#757575')}
          </mesh>
          {ghost ? (
            <mesh position={[1.2, 0.5, 1.3]}>
              <boxGeometry args={[0.8, 1, 0.8]} />
              {m('#e53935')}
            </mesh>
          ) : (
            <DriveInDetail />
          )}
          {/* The film: one shared animated texture, kept out of Batch by its live material. */}
          {!ghost && (
            <mesh position={[0, 1.4 + sl, -1.42]}>
              <planeGeometry args={[2.8, 1.575]} />
              <primitive object={glowMats.screen} attach="material" dispose={null} />
              <MovieReel />
            </mesh>
          )}
          {!ghost && <LightPool r={1.2} x={1.2} z={1.3} />}
          {trim && lvl >= 3 && (
            <mesh position={[0, 2.33 + sl, -1.5]} castShadow>
              <boxGeometry args={[3.1, 0.08, 0.2]} />
              {m(lvl >= 9 ? GOLD : def.roof)}
            </mesh>
          )}
          {trim && lvl >= 5 && <Lights from={[-1.5, 2.42 + sl, -1.4]} to={[1.5, 2.42 + sl, -1.4]} n={14} />}
          {trim && lvl >= 8 && [-1.45, 1.45].map((x) => <Flag key={x} x={x} y={2.37 + sl} z={-1.5} color="#e53935" star={lvl >= 10} />)}
          {sign && (
            <group>
              {/* Struts holding the name board up off the screen's top edge. */}
              {[-0.75, 0.75].map((x) => (
                <mesh key={x} position={[x, 2.36 + sl, -1.49]}>
                  <boxGeometry args={[0.06, 0.16, 0.06]} />
                  {m('#5d4037')}
                </mesh>
              ))}
              <mesh position={[0, 2.7 + sl, -1.47]} castShadow>
                <boxGeometry args={[2.05, 0.6, 0.06]} />
                {m(def.roof)}
              </mesh>
              <Sign text="DRIVE-IN" w={1.9} y={2.7 + sl} z={-1.435} bg="#fafafa" fg="#3e2723" />
            </group>
          )}
          {lvl >= 4 && <DriveInGrown m={m} lvl={lvl} sl={sl} ghost={ghost} roof={def.roof} />}
        </group>
      )
    }
    default: {
      // Generic storefront: body, roof trim, awning and a sign over the door.
      // Upgrades stack extra floors on top of the shop and add trimmings.
      const h0 = def.w > 1 ? 1.5 : 1.3
      const h = h0 + lift
      const F = D * 0.36 - 0.1 // front wall, where the windows and door hang
      const rows: number[] = []
      for (let y = 1.25; y + 0.2 <= h - 0.12; y += 0.55) rows.push(y)
      const one = def.w > 1 ? [-1.2, -0.4, 0.4, 1.2] : [-0.42, 0.42]
      // A merged pair's front is twice as long: the row repeats once per shop
      // width, squeezed back into the model's frame (the pair stretches it out).
      const cols = bx > 1 ? [-1, 1].flatMap((o) => one.map((x) => (x + o * W * 0.41) / bx)) : one
      return (
        <group>
          <mesh position={[0, h / 2, -0.1]} castShadow receiveShadow>
            <boxGeometry args={[W * 0.82, h, D * 0.72]} />
            {m(def.color, brickTex(W * 0.6, h * 0.8))}
          </mesh>
          {/* Flat gravel roof inside a coloured parapet. */}
          <mesh position={[0, h + 0.06, -0.1]} castShadow>
            <boxGeometry args={[W * 0.88, 0.14, D * 0.78]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[0, h + 0.14, -0.1]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[W * 0.78, D * 0.68]} />
            {m('#ffffff', gravelTex(W, D))}
          </mesh>
          {/* Big shop windows either side of the door. */}
          <mesh position={[0, 0.42, F + 0.005]}>
            <planeGeometry args={[W * 0.7, 0.62]} />
            {win}
          </mesh>
          <mesh position={[0, 0.08, F + 0.015]}>
            <boxGeometry args={[W * 0.82, 0.16, 0.03]} />
            {m('#eceff1')}
          </mesh>
          <mesh position={[0, 0.82, F + 0.2]} rotation-x={0.45} castShadow>
            <boxGeometry args={[W * 0.76, 0.03, 0.44]} />
            {m('#ffffff', awningTex(def.roof === '#f5f5f5' || def.roof === '#fff8e1' ? def.color : def.roof))}
          </mesh>
          <mesh position={[0, 0.32, F + 0.036]}>
            <planeGeometry args={[0.4, 0.6]} />
            {m('#4e342e')}
          </mesh>
          {/* Door frame, step and wall lamps either side. */}
          <mesh position={[0, 0.33, F + 0.02]}>
            <boxGeometry args={[0.5, 0.68, 0.02]} />
            {m('#eceff1')}
          </mesh>
          <mesh position={[0, 0.03, F + 0.12]} receiveShadow>
            <boxGeometry args={[0.6, 0.06, 0.22]} />
            {m('#cfd8dc')}
          </mesh>
          {[-0.36, 0.36].map((x) => (
            <mesh key={x} position={[x, 0.7, F + 0.05]}>
              <boxGeometry args={[0.08, 0.1, 0.08]} />
              {bulb}
            </mesh>
          ))}
          {!ghost && <LightPool r={0.7} z={F + 0.35} />}
          {/* Side windows on the right-hand wall. */}
          {[-0.35, 0.25].map((z) => (
            <mesh key={z} position={[W * 0.41 + 0.006, h0 * 0.55, z - 0.1]} rotation-y={Math.PI / 2}>
              <planeGeometry args={[0.42, 0.42]} />
              {win}
            </mesh>
          ))}
          {/* Upper floors from upgrades: rows of windows front and side. */}
          {rows.map((y) => (
            <group key={y}>
              {cols.map((x) => (
                <group key={x}>
                  <mesh position={[x, y, F + 0.006]}>
                    <planeGeometry args={[0.36, 0.38]} />
                    {win}
                  </mesh>
                  {trim && lvl >= 4 && (
                    <mesh position={[x, y - 0.22, F + 0.04]} castShadow>
                      <boxGeometry args={[0.42, 0.04, 0.08]} />
                      {m('#fafafa')}
                    </mesh>
                  )}
                  {trim && lvl >= 6 && [-0.12, 0, 0.12].map((fx, i) => (
                    <mesh key={fx} position={[x + fx, y - 0.16, F + 0.05]}>
                      <icosahedronGeometry args={[0.055, 0]} />
                      <meshStandardMaterial color={['#ec407a', '#ffee58', '#ab47bc'][i]} flatShading />
                    </mesh>
                  ))}
                </group>
              ))}
              {/* Back wall, and both side walls. */}
              {cols.map((x) => (
                <mesh key={x} position={[x, y, -0.1 - D * 0.36 - 0.006]} rotation-y={Math.PI}>
                  <planeGeometry args={[0.36, 0.38]} />
                  {win}
                </mesh>
              ))}
              {[-1, 1].map((sd) => [-0.35, 0.25].map((z) => (
                <mesh key={`${sd}${z}`} position={[sd * (W * 0.41 + 0.006), y, z - 0.1]} rotation-y={(sd * Math.PI) / 2}>
                  <planeGeometry args={[0.36, 0.38]} />
                  {win}
                </mesh>
              )))}
            </group>
          ))}
          {/* Level 3: white cornice under the roof, and a band between floors. */}
          {trim && lvl >= 3 && (
            <mesh position={[0, h - 0.06, -0.1]} castShadow>
              <boxGeometry args={[W * 0.85, 0.07, D * 0.75]} />
              {m('#fafafa')}
            </mesh>
          )}
          {trim && lvl >= 3 && rows.length > 0 && (
            <mesh position={[0, 0.98, -0.1]}>
              <boxGeometry args={[W * 0.84, 0.05, D * 0.74]} />
              {m('#eceff1')}
            </mesh>
          )}
          {/* Level 5: a string of bulbs along the front of the roof. */}
          {trim && lvl >= 5 && <Lights from={[-W * 0.43, h + 0.17, F + 0.06]} to={[W * 0.43, h + 0.17, F + 0.06]} n={def.w > 1 ? 13 : 7} />}
          {/* Level 7: stone pilasters on the front corners. */}
          {trim && lvl >= 7 && [-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * W * 0.41, h / 2, F]} castShadow>
              <boxGeometry args={[0.12, h, 0.12]} />
              {m('#f5f5f5')}
            </mesh>
          ))}
          {/* Level 8: a flag on the roof (gold star on top at level 10). */}
          {trim && lvl >= 8 && <Flag x={-W * 0.32} y={h + 0.13} z={-0.1 - D * 0.24} color={def.roof === '#f5f5f5' || def.roof === '#fff8e1' ? def.color : def.roof} star={lvl >= 10} />}
          {/* Level 9: gold trim along the front of the roof. */}
          {trim && lvl >= 9 && (
            <mesh position={[0, h + 0.1, F + 0.035]}>
              <boxGeometry args={[W * 0.89, 0.05, 0.03]} />
              <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} />
            </mesh>
          )}
          {!ghost && <ShopDetail W={W} D={D} h={h} F={F} roof={def.roof} rows={rows} cols={cols} awning={m('#ffffff', awningTex(def.roof === '#f5f5f5' || def.roof === '#fff8e1' ? def.color : def.roof))} mullions={def.id !== 'motel' && def.id !== 'carwash'} />}
          {/* Planters by the door. */}
          {!ghost && [-1, 1].map((sd) => (
            <group key={sd} position={[sd * (W * 0.41 - 0.12), 0, F + 0.15]}>
              <mesh position={[0, 0.09, 0]} castShadow><boxGeometry args={[0.2, 0.18, 0.2]} />{m('#8d6e63')}</mesh>
              <mesh position={[0, 0.25, 0]} castShadow><icosahedronGeometry args={[0.13, 0]} /><meshStandardMaterial color="#43a047" flatShading /></mesh>
              {lvl >= 2 && [[0.07, 0.04], [-0.06, 0.07], [0.02, -0.07]].map(([fx, fz], i) => (
                <mesh key={i} position={[fx, 0.35, fz]}><icosahedronGeometry args={[0.045, 0]} /><meshStandardMaterial color={['#ff4081', '#ffeb3b', '#ffffff'][i]} flatShading /></mesh>
              ))}
            </group>
          ))}
          {/* Rooftop air conditioner and vent, unless a big prop sits up there. */}
          {!def.prop && !ghost && (
            <group position={[W * 0.22, h + 0.14, -0.3]}>
              <mesh position={[0, 0.12, 0]} castShadow><boxGeometry args={[0.36, 0.24, 0.3]} />{m('#b0bec5')}</mesh>
              <mesh position={[0, 0.25, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.1, 12]} />{m('#546e7a')}</mesh>
              <mesh position={[-0.45, 0.12, 0.1]} castShadow><cylinderGeometry args={[0.05, 0.05, 0.24, 8]} />{m('#90a4ae')}</mesh>
            </group>
          )}
          {/* One group, so a merged shop keeps the stack stacked. */}
          {def.id === 'tires' && !ghost && <group userData={PEOPLE_SIZED}>{[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[-W * 0.36, 0.08 + i * 0.13, F + 0.32]} rotation-x={Math.PI / 2} castShadow>
              <torusGeometry args={[0.15, 0.065, 8, 16]} />
              {m('#212121')}
            </mesh>
          ))}</group>}
          {def.id === 'carwash' && !ghost && [-0.45, 0.45].map((x) => (
            <mesh key={x} position={[x, 0.6, F + 0.15]} castShadow>
              <cylinderGeometry args={[0.13, 0.13, 0.9, 10]} />
              <meshStandardMaterial color={x < 0 ? '#29b6f6' : '#ffca28'} roughness={1} />
            </mesh>
          ))}
          {def.prop && (
            // One piece in a merged pair: it keeps its shape, standing on the roof.
            <group position-y={h + 0.13}>
              <Upright>
                <group position-y={-(h + 0.13)}><RoofProp prop={def.prop} y={h + 0.13} /></group>
              </Upright>
            </group>
          )}
          {def.id === 'motel' && [-1.2, -0.6, 0.6, 1.2].map((x) => (
            <mesh key={x} position={[x, 0.32, F + 0.012]}>
              <planeGeometry args={[0.3, 0.55]} />
              {m('#00897b')}
            </mesh>
          ))}
          {def.id === 'carwash' && (
            <mesh position={[0, 0.6, F + 0.012]}>
              <planeGeometry args={[1.4, 1]} />
              {m('#0277bd')}
            </mesh>
          )}
          {sign && (
            <group position={[0, h + 0.38, D * 0.22]}>
              <mesh position={[0, 0, -0.03]}>
                <boxGeometry args={[Math.min(W * 0.8, 2.4) + 0.08, Math.min(W * 0.8, 2.4) / 4 + 0.08, 0.05]} />
                <meshStandardMaterial color={def.roof} />
              </mesh>
              <Sign text={def.sign!} w={Math.min(W * 0.8, 2.4)} y={0} z={0} bg="#fffde7" fg={def.id === 'tires' ? '#212121' : '#c62828'} />
            </group>
          )}
        </group>
      )
    }
  }
}
