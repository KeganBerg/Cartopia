import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace, type PerspectiveCamera } from 'three'
import { RaceScene, type RacerView } from './RaceScene'
import { ROAD } from './RaceVenues'
import { venue } from './venues'
import { raceWeather } from './Weather'
import { TRACK } from '../game/race'
import type { Body, Finish, Panels, SkinnedSlot } from '../game/data'
import type { Trim } from '../game/trim'
import type { HatFit } from '../game/hats'

// Trophy Road (ui/TrophyRoad.tsx) drawn on the Main Street drag strip: a gantry over the road
// at every milestone with its sign (trophies, coins, parts), a gift on top of the mystery ones,
// and the player's own car on the road at their trophy count. The camera follows `view.z`.

export const ROAD_GAP = 6 // world units between milestones
export const ROAD_FIRST = 6 // the first milestone shown, past the start line
const SCALE = 0.25 // race metres per world unit (RaceScene)

export type Milestone = { trophies: number; coins: number; parts: number; state: 'got' | 'ready' | 'locked'; gift: boolean }
export type RoadView = { z: number }
type Look = { body: Body; model?: string; color: string; finish?: Finish; skin?: string; modSkin?: Partial<Record<SkinnedSlot, string>>; panels?: Panels; mods?: string[]; trim?: Trim; hat?: HatFit | null }

const BG = { got: '#45b649', ready: '#ffc533', locked: '#e3e9f1' }
const INK = { got: '#ffffff', ready: '#14213d', locked: '#4a6283' }
const signs = new Map<string, CanvasTexture>()

// A flat sign: the trophy count big, the coins and parts under it, and a tick or lock.
function signTex(m: Milestone) {
  const k = `${m.trophies}|${m.coins}|${m.parts}|${m.state}|${m.gift}`
  const hit = signs.get(k)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 300
  const g = c.getContext('2d')!
  const r = 40
  g.fillStyle = '#14213d'
  g.beginPath()
  g.roundRect(0, 0, 512, 300, r)
  g.fill()
  g.fillStyle = BG[m.state]
  g.beginPath()
  g.roundRect(14, 14, 484, 272, r - 12)
  g.fill()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = INK[m.state]
  g.font = '900 128px "Arial Black", Impact, system-ui, sans-serif'
  g.fillText(String(m.trophies), 256, 112)
  // Coins: a gold disc and the amount; parts after it.
  g.font = '900 64px "Arial Black", Impact, system-ui, sans-serif'
  const coins = m.coins >= 10000 ? `${(m.coins / 1000).toFixed(m.coins % 1000 ? 1 : 0)}K` : m.coins.toLocaleString()
  const line = `${coins}   ⚙${m.parts}`
  const w = g.measureText(line).width + 64
  const x0 = 256 - w / 2
  g.fillStyle = '#14213d'
  g.beginPath()
  g.arc(x0 + 26, 228, 31, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#b86e00'
  g.beginPath()
  g.arc(x0 + 26, 228, 26, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#ffc533'
  g.beginPath()
  g.arc(x0 + 26, 224, 24, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = INK[m.state]
  g.textAlign = 'left'
  g.fillText(line, x0 + 64, 230)
  // The state badge in the corner.
  if (m.state !== 'ready') {
    g.fillStyle = '#14213d'
    g.beginPath()
    g.arc(452, 60, 40, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = m.state === 'got' ? '#45b649' : '#ffffff'
    g.beginPath()
    g.arc(452, 60, 32, 0, Math.PI * 2)
    g.fill()
    g.textAlign = 'center'
    g.font = '900 40px system-ui, sans-serif'
    g.fillStyle = m.state === 'got' ? '#ffffff' : '#14213d'
    g.fillText(m.state === 'got' ? '✔' : '🔒', 452, 63)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  t.userData.text = true
  signs.set(k, t)
  return t
}

// A wrapped present on top of a mystery milestone's gantry.
function Gift() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.42, 0.4, 0.42]} /><meshStandardMaterial color="#e53935" roughness={0.8} /></mesh>
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.1, 0.41, 0.43]} /><meshStandardMaterial color="#ffd54f" roughness={0.8} /></mesh>
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.43, 0.41, 0.1]} /><meshStandardMaterial color="#ffd54f" roughness={0.8} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.09, 0.45, 0]} rotation-z={s * 0.6}><torusGeometry args={[0.08, 0.03, 6, 12]} /><meshStandardMaterial color="#ffd54f" roughness={0.8} /></mesh>
      ))}
    </group>
  )
}

function Gantry({ z, m }: { z: number; m: Milestone }) {
  const post = m.state === 'got' ? '#2e7d32' : m.state === 'ready' ? '#ff8f00' : '#90a4ae'
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (ROAD + 0.25), 1.35, 0]}>
          <boxGeometry args={[0.14, 2.7, 0.14]} />
          <meshStandardMaterial color={post} />
        </mesh>
      ))}
      <mesh position={[0, 2.62, 0]}>
        <boxGeometry args={[ROAD * 2 + 0.64, 0.12, 0.12]} />
        <meshStandardMaterial color={post} />
      </mesh>
      {/* The sign faces back down the road, towards the camera. */}
      <mesh position={[0, 1.94, -0.08]} rotation-y={Math.PI}>
        <planeGeometry args={[2.2, 1.29]} />
        <meshBasicMaterial map={signTex(m)} toneMapped={false} />
      </mesh>
      {m.gift && <group position={[0, 2.68, 0]}><Gift /></group>}
    </group>
  )
}

// Follows view.z: high, behind and off to the right, so a gantry just behind the car never
// hides it, looking up the road at the milestones ahead. Narrow (phone) views sit further back.
function RoadCam({ view }: { view: RefObject<RoadView> }) {
  const at = useRef<number | null>(null)
  useFrame(({ camera, size }, dt) => {
    const z = view.current?.z ?? 0
    at.current = at.current === null ? z : at.current + (z - at.current) * Math.min(1, dt * 8)
    const k = Math.min(1.6, Math.max(1, 1.25 / (size.width / size.height)))
    const c = camera as PerspectiveCamera
    c.position.set(Math.max(4.4, 3.2 * k), 5 * k, at.current - 4.5 * k)
    c.lookAt(0, 0.6, at.current + 6)
  })
  return null
}

export function TrophyRoadScene({ stops, carZ, car, view }: { stops: Milestone[]; carZ: number; car: Look; view: RefObject<RoadView> }) {
  const me = useRef<RacerView>({ dist: carZ / SCALE }) as RefObject<RacerView>
  useEffect(() => {
    me.current!.dist = carZ / SCALE
  }, [carZ])
  // Parked far out of sight: the strip has no rival.
  const them = useRef<RacerView>({ dist: -900 }) as RefObject<RacerView>
  const weather = useMemo(() => ({ ...raceWeather('main', 'trophy-road'), kind: 'clear', rain: 0, snow: 0, cloud: 0.1, haze: 0, dust: 0, wet: 0, cover: 0 }) as never, [])
  return (
    <>
      <RaceScene track={TRACK} me={me} them={them} mine={car} theirs={car} venue={venue('main')} weather={weather} />
      {stops.map((m, k) => <Gantry key={m.trophies} z={ROAD_FIRST + k * ROAD_GAP} m={m} />)}
      <RoadCam view={view} />
    </>
  )
}
