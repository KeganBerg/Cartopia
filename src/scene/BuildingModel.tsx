import { TILE, type BuildingDef } from '../game/data'
import { useGame } from '../game/store'
import { signTexture } from './signTexture'
import { CarModel } from './CarModel'
import type { Texture } from 'three'
import { glowMats } from './dayNight'
import { PAL, SEASON } from './season'
import { LAYER, decal } from './layers'
import { brickTex, sidingTex, shingleTex, gravelTex, awningTex, windowTex, paverTex, shutterTex, pumpTex } from './textures'

type Props = { def: BuildingDef; ghost?: boolean; valid?: boolean }

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
          <mesh position-y={0.05} castShadow><cylinderGeometry args={[0.38, 0.38, 0.1, 20]} /><meshStandardMaterial color="#e0a052" /></mesh>
          <mesh position-y={0.15}><cylinderGeometry args={[0.4, 0.4, 0.1, 20]} /><meshStandardMaterial color="#5d4037" /></mesh>
          <mesh position-y={0.21}><cylinderGeometry args={[0.42, 0.42, 0.03, 20]} /><meshStandardMaterial color="#66bb6a" /></mesh>
          <mesh position-y={0.3}><sphereGeometry args={[0.38, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e0a052" /></mesh>
        </group>
      )
    case 'cone':
      return (
        <group position={[0, y + 0.4, -0.1]}>
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

// Warm pool of light on the ground that only shows after dark.
export function LightPool({ r, x = 0, z = 0, y = 0.075 }: { r: number; x?: number; z?: number; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]} renderOrder={2}>
      <planeGeometry args={[r * 2, r * 2]} />
      <primitive object={glowMats.pool} attach="material" dispose={null} />
    </mesh>
  )
}

// The Crew House flies a flag in the player's clan color.
function CrewFlag({ x, z }: { x: number; z: number }) {
  const color = useGame((s) => s.clanBadge?.color ?? '#ff7043')
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.8, 0]} castShadow><cylinderGeometry args={[0.025, 0.03, 1.6, 8]} /><meshStandardMaterial color="#cfd8dc" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 1.62, 0]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#ffd54f" /></mesh>
      <mesh position={[0.24, 1.38, 0]} castShadow><boxGeometry args={[0.46, 0.3, 0.02]} /><meshStandardMaterial color={color} /></mesh>
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
      <mesh position={[hx, 0.44, len / 2 - 0.08]}>
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
      <mesh position={[hx, 0.86, len / 2 - 0.08]}>
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
          {[-0.3, 0.3].map((z) => <mesh key={z} position={[0, 0.17, z]} castShadow><boxGeometry args={[0.7, 0.04, 0.12]} />{m('#a1887f')}</mesh>)}
          <group position={[0.62, 0, 0.55]}>
            <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.13, 0.13, 0.4, 12]} />{m('#455a64')}</mesh>
            <mesh position={[0, 0.41, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.11, 12]} />{bulb}</mesh>
          </group>
          <LightPool r={0.6} x={0.62} z={0.55} />
        </group>
      )}
      {!ghost && <CrewFlag x={1.75} z={-0.7} />}
      {!ghost && <CrewFlag x={-1.85} z={0.75} />}
      {/* Sign on a frame across the top of the arch. */}
      {sign && (
        <group position={[hx, 1.22, len / 2 - 0.15]}>
          {[-0.5, 0.5].map((x) => <mesh key={x} position={[x, -0.18, -0.02]}><boxGeometry args={[0.04, 0.36, 0.04]} />{m('#37474f')}</mesh>)}
          <mesh position={[0, 0, -0.03]}><boxGeometry args={[1.28, 0.36, 0.05]} /><meshStandardMaterial color={ghost ? '#66bb6a' : clan} /></mesh>
          <Sign text="CREW HOUSE" w={1.2} y={0} z={0} bg="#263238" fg="#ffffff" />
        </group>
      )}
    </group>
  )
}

function Sign({ text, w, y, z, bg, fg }: { text: string; w: number; y: number; z: number; bg?: string; fg?: string }) {
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[w, w / 4]} />
      <meshBasicMaterial map={signTexture(text, bg, fg)} toneMapped={false} />
    </mesh>
  )
}

export function BuildingModel({ def, ghost, valid }: Props) {
  const m = useMat(ghost, valid)
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
          <group position={[0.2, 1.72, 0]}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <group key={i} rotation-y={(i * Math.PI * 2) / 7}>
                {[0, 1, 2].map((j) => (
                  <mesh key={j} position={[0.18 + j * 0.24, 0.02 - j * j * 0.07, 0]} rotation-z={-0.15 - j * 0.35} castShadow>
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
        </group>
      )
    case 'flowers':
      return (
        <group>
          <mesh position={[0, 0.08, 0]} receiveShadow><boxGeometry args={[1.3, 0.16, 1.3]} />{m(def.roof)}</mesh>
          {[[-0.4, -0.4], [0, -0.35], [0.4, -0.4], [-0.35, 0], [0.05, 0.05], [0.4, 0], [-0.4, 0.4], [0, 0.4], [0.4, 0.38]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.26, z]}><sphereGeometry args={[0.13, 8, 6]} />{m(['#e91e63', '#ffeb3b', '#ab47bc', '#ff7043'][i % 4])}</mesh>
          ))}
        </group>
      )
    case 'lamp':
      return (
        <group>
          <mesh position={[0, 0.9, 0]} castShadow><cylinderGeometry args={[0.04, 0.06, 1.8]} />{m(def.color)}</mesh>
          <mesh position={[0.2, 1.78, 0]}><boxGeometry args={[0.45, 0.05, 0.08]} />{m(def.color)}</mesh>
          <mesh position={[0.38, 1.72, 0]}><sphereGeometry args={[0.1, 10, 8]} />{bulb}</mesh>
          {!ghost && <LightPool r={0.9} x={0.38} />}
        </group>
      )
    case 'bench':
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
          {[-0.5, 0.5].map((x) => <mesh key={x} position={[x, 0.9, 0]} castShadow><boxGeometry args={[0.08, 1.8, 0.08]} />{m('#78909c')}</mesh>)}
          <mesh position={[0, 1.7, 0]} castShadow><boxGeometry args={[1.8, 0.8, 0.08]} />{m(def.color)}</mesh>
          {!ghost && (
            <mesh position={[0, 1.7, 0.05]}>
              <planeGeometry args={[1.7, 0.7]} />
              <meshBasicMaterial map={signTexture('CARTOPIA', '#1e88e5', '#ffffff')} toneMapped={false} />
            </mesh>
          )}
          {!ghost && [-0.5, 0.5].map((x) => (
            <mesh key={x} position={[x, 1.2, 0.3]} rotation-x={-0.6}><boxGeometry args={[0.12, 0.08, 0.12]} />{bulb}</mesh>
          ))}
          {!ghost && <LightPool r={0.8} z={0.5} />}
        </group>
      )
    case 'statue':
      return (
        <group>
          <mesh position={[0, 0.35, 0]} castShadow><boxGeometry args={[1, 0.7, 1]} />{m(def.roof)}</mesh>
          <group position={[0, 0.7, 0]} rotation-y={0.6} scale={1.2}>
            {ghost ? <mesh position-y={0.25}><boxGeometry args={[0.7, 0.4, 1.2]} />{m(def.color)}</mesh> : <CarModel body="super" color={def.color} />}
          </group>
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
        </group>
      )
    case 'stadium':
      return (
        <group>
          <mesh position={[0, 0.03, 0]} receiveShadow><cylinderGeometry args={[1.9, 1.9, 0.06, 40]} />{m('#5f646b')}</mesh>
          <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[1.2, 1.2, 0.04, 40]} />{m('#66bb6a')}</mesh>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[1.95, 1.95, 0.9, 40, 1, true, Math.PI * 0.15, Math.PI * 1.1]} />
            <meshStandardMaterial color={ghost ? (valid ? '#66bb6a' : '#ef5350') : def.color} side={2} transparent={ghost} opacity={ghost ? 0.55 : 1} />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <cylinderGeometry args={[2.0, 2.0, 0.12, 40, 1, true, Math.PI * 0.15, Math.PI * 1.1]} />
            <meshStandardMaterial color={def.roof} side={2} />
          </mesh>
          {/* Track lane line and a chequered start line. */}
          <mesh position={[0, 0.07, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.53, 1.57, 48]} />
            <meshStandardMaterial color={ghost ? (valid ? '#66bb6a' : '#ef5350') : '#fafafa'} transparent={ghost} opacity={ghost ? 0.55 : 1} {...decal()} />
          </mesh>
          {!ghost && (
            <mesh position={[0, 0.08, 1.55]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.18, 0.7]} />
              <meshBasicMaterial map={signTexture('▚▚▚▚', '#ffffff', '#111111')} {...decal(2)} />
            </mesh>
          )}
          {/* Crowd: coloured seat rows along the stands. */}
          {!ghost && [0.3, 0.55, 0.8].map((y, i) => (
            <mesh key={y} position={[0, y, 0]}>
              <cylinderGeometry args={[1.9 - i * 0.02, 1.9 - i * 0.02, 0.06, 40, 1, true, Math.PI * 0.15, Math.PI * 1.1]} />
              <meshStandardMaterial color={['#ffca28', '#42a5f5', '#ef5350'][i]} side={2} />
            </mesh>
          ))}
          {/* Floodlight towers that light the track at night. */}
          {!ghost && [[-1.6, 1.6], [1.6, 1.6]].map(([x, z]) => (
            <group key={x} position={[x, 0, z]}>
              <mesh position={[0, 1.1, 0]} castShadow><cylinderGeometry args={[0.04, 0.06, 2.2, 6]} />{m('#90a4ae')}</mesh>
              <mesh position={[0, 2.25, 0]} rotation-y={Math.atan2(-x, -z)}><boxGeometry args={[0.4, 0.22, 0.06]} />{bulb}</mesh>
              <LightPool r={1.3} x={-x * 0.5} z={-z * 0.5} y={0.1} />
            </group>
          ))}
          {sign && <Sign text="SPEEDWAY" w={2} y={1.25} z={0} bg="#c62828" fg="#ffffff" />}
        </group>
      )
    case 'house':
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
              <mesh position={[0.2, 1.6, 0]}>
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
              <mesh position={[x, 1.25, D * 0.3 - 0.26]}>
                <boxGeometry args={[0.16, 0.06, 0.1]} />
                {bulb}
              </mesh>
            </group>
          ))}
          {/* Concrete apron with oil stains and a tyre stack. */}
          <mesh position={[0, 0.03, 1.1]} receiveShadow>
            <boxGeometry args={[W * 0.9, 0.05, 1.2]} />
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
          {sign && <Sign text="MY GARAGE" w={2.2} y={1.42} z={0.33} bg="#263238" fg="#ffca28" />}
        </group>
      )
    case 'gas':
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
            <mesh key={i} position={[x, 0.75, z]} castShadow>
              <boxGeometry args={[0.12, 1.4, 0.12]} />
              {m('#eeeeee')}
            </mesh>
          ))}
          <mesh position={[0, 1.5, -0.2]} castShadow>
            <boxGeometry args={[2.2, 0.22, 1.5]} />
            {m('#fafafa')}
          </mesh>
          <mesh position={[0, 1.5, -0.2]}>
            <boxGeometry args={[2.24, 0.1, 1.54]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[0, 1.375, -0.2]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[2.0, 1.3]} />
            {bulb}
          </mesh>
          {!ghost && <LightPool r={1.2} z={0} />}
          {/* Pump island with two pumps facing the forecourt. */}
          <mesh position={[0, 0.1, -0.45]} receiveShadow>
            <boxGeometry args={[1.5, 0.1, 0.36]} />
            {m('#ffca28')}
          </mesh>
          {[-0.4, 0.4].map((x) => (
            <group key={x} position={[x, 0, -0.45]}>
              <mesh position={[0, 0.48, 0]} castShadow>
                <boxGeometry args={[0.34, 0.66, 0.26]} />
                {m('#fafafa')}
              </mesh>
              {[0.137, -0.137].map((z) => (
                <mesh key={z} position={[0, 0.48, z]} rotation-y={z < 0 ? Math.PI : 0}>
                  <planeGeometry args={[0.32, 0.64]} />
                  {m('#ffffff', pumpTex(def.roof))}
                </mesh>
              ))}
            </group>
          ))}
          {/* Little shop tucked in the back corner, with a striped awning. */}
          <mesh position={[1.53, 0.55, -0.65]} castShadow receiveShadow>
            <boxGeometry args={[0.75, 1.1, 0.6]} />
            {m(def.color, brickTex(1, 1.2))}
          </mesh>
          <mesh position={[1.53, 1.14, -0.65]} castShadow>
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
          {/* Price sign on a pole. */}
          {!ghost && (
            <group position={[-1.75, 0, -0.7]}>
              <mesh position={[0, 0.8, 0]} castShadow>
                <cylinderGeometry args={[0.04, 0.04, 1.6]} />
                {m('#90a4ae')}
              </mesh>
              <mesh position={[0, 1.6, 0]} castShadow>
                <boxGeometry args={[0.5, 0.4, 0.06]} />
                {m(def.roof)}
              </mesh>
              <mesh position={[0, 1.6, 0.037]}>
                <planeGeometry args={[0.42, 0.32]} />
                <meshBasicMaterial map={signTexture('⛽ 1.99', '#263238', '#ffca28')} />
              </mesh>
            </group>
          )}
          {sign && <Sign text="GAS" w={1.2} y={1.5} z={0.58} bg={def.roof} fg="#ffffff" />}
        </group>
      )
    case 'crew':
      return <CrewHouse m={m} ghost={ghost} sign={!!sign} bulb={bulb} win={win} />
    case 'cinema':
      return (
        <group>
          <mesh position={[0, 1.4, -1.5]} castShadow>
            <boxGeometry args={[3, 1.8, 0.15]} />
            {m('#fafafa')}
          </mesh>
          {[-1.2, 1.2].map((x) => (
            <mesh key={x} position={[x, 0.6, -1.55]} castShadow>
              <boxGeometry args={[0.15, 1.2, 0.15]} />
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
          <mesh position={[1.2, 0.5, 1.3]} castShadow>
            <boxGeometry args={[0.8, 1, 0.8]} />
            {m('#e53935')}
          </mesh>
          {/* Speaker posts in the lot and a projector beam on the screen. */}
          {!ghost && [[-0.9, -0.2], [0, -0.2], [0.9, -0.2], [-0.9, 0.9], [0, 0.9]].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.025, 0.025, 0.5, 6]} />{m('#78909c')}</mesh>
              <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.12, 0.08, 0.06]} />{m('#37474f')}</mesh>
            </group>
          ))}
          {!ghost && (
            <mesh position={[0, 1.4, -1.42]}>
              <planeGeometry args={[2.8, 1.6]} />
              <primitive object={glowMats.screen} attach="material" dispose={null} />
            </mesh>
          )}
          {!ghost && <LightPool r={1.2} x={1.2} z={1.3} />}
          {sign && <Sign text="DRIVE-IN" w={2.4} y={1.6} z={-1.41} bg="#fafafa" fg="#3e2723" />}
        </group>
      )
    default: {
      // Generic storefront: body, roof trim, awning and a sign over the door.
      const h = def.w > 1 ? 1.5 : 1.3
      const F = D * 0.36 - 0.1 // front wall, where the windows and door hang
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
            <mesh key={z} position={[W * 0.41 + 0.006, h * 0.55, z - 0.1]} rotation-y={Math.PI / 2}>
              <planeGeometry args={[0.42, 0.42]} />
              {win}
            </mesh>
          ))}
          {/* Planters by the door. */}
          {!ghost && [-1, 1].map((sd) => (
            <group key={sd} position={[sd * (W * 0.41 - 0.12), 0, F + 0.15]}>
              <mesh position={[0, 0.09, 0]} castShadow><boxGeometry args={[0.2, 0.18, 0.2]} />{m('#8d6e63')}</mesh>
              <mesh position={[0, 0.25, 0]} castShadow><icosahedronGeometry args={[0.13, 0]} /><meshStandardMaterial color="#43a047" flatShading /></mesh>
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
          {def.id === 'tires' && !ghost && [0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[-W * 0.36, 0.08 + i * 0.13, F + 0.32]} rotation-x={Math.PI / 2} castShadow>
              <torusGeometry args={[0.15, 0.065, 8, 16]} />
              {m('#212121')}
            </mesh>
          ))}
          {def.id === 'carwash' && !ghost && [-0.45, 0.45].map((x) => (
            <mesh key={x} position={[x, 0.6, F + 0.15]} castShadow>
              <cylinderGeometry args={[0.13, 0.13, 0.9, 10]} />
              <meshStandardMaterial color={x < 0 ? '#29b6f6' : '#ffca28'} roughness={1} />
            </mesh>
          ))}
          {def.id === 'rescue' && !ghost && (
            <group position={[W * 0.44, 0, D * 0.3]}>
              {/* Scrap pile: a rusty shell and some old tyres. */}
              <mesh position={[0, 0.14, 0.15]} rotation-y={0.4} castShadow><boxGeometry args={[0.32, 0.22, 0.55]} />{m('#a1663a')}</mesh>
              {[0, 1].map((i) => (
                <mesh key={i} position={[0.05, 0.06 + i * 0.12, -0.3]} rotation-x={Math.PI / 2}><torusGeometry args={[0.12, 0.05, 8, 14]} />{m('#3e2723')}</mesh>
              ))}
            </group>
          )}
          {def.prop && <RoofProp prop={def.prop} y={h + 0.13} />}
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
