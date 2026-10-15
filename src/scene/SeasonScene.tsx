import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, ExtrudeGeometry, SRGBColorSpace, Shape, type PerspectiveCamera } from 'three'
import { RaceScene, type RacerView } from './RaceScene'
import { ROAD } from './RaceVenues'
import { venue } from './venues'
import { raceWeather } from './Weather'
import type { Body, Finish, Panels, SkinnedSlot } from '../game/data'
import type { Trim } from '../game/trim'
import type { HatFit } from '../game/hats'

// Star Pass (ui/Season.tsx) drawn on Main Street at midnight: an arch over the road for every tier
// with its prize on a lit sign and a star on top, the player's race car at their tier, and the
// season's own car parked at the finish line under the last arch. The camera follows `view.z`.

export const PASS_GAP = 6 // world units between tiers
export const PASS_FIRST = 6 // tier 1, past the start line
const SCALE = 0.25 // race metres per world unit (RaceScene)

export type Tier = { n: number; coins: number; parts: number; gems: number; skin?: string; car?: string; state: 'got' | 'ready' | 'locked' }
export type PassView = { z: number }
type Look = { body: Body; model?: string; color: string; finish?: Finish; skin?: string; modSkin?: Partial<Record<SkinnedSlot, string>>; panels?: Panels; mods?: string[]; trim?: Trim; hat?: HatFit | null }

const BG = { got: '#45b649', ready: '#ffc533', locked: '#e3e9f1' }
const INK = { got: '#ffffff', ready: '#14213d', locked: '#4a6283' }
const STAR = { got: '#ffd54f', ready: '#ffb300', locked: '#78909c' }
const POST = { got: '#2e7d32', ready: '#ff8f00', locked: '#546e7a' }
const FONT = '"Arial Black", Impact, system-ui, sans-serif'
const signs = new Map<string, CanvasTexture>()

const disc = (g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) => {
  g.fillStyle = c
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
}
const short = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}K` : String(n))

// A flat lit sign: the tier number big, the prize under it, and a tick or lock in the corner.
function signTex(t: Tier) {
  const k = `${t.n}|${t.coins}|${t.parts}|${t.gems}|${t.skin}|${t.car}|${t.state}`
  const hit = signs.get(k)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 384
  c.height = 228
  const g = c.getContext('2d')!
  g.fillStyle = '#14213d'
  g.beginPath()
  g.roundRect(0, 0, 384, 228, 30)
  g.fill()
  g.fillStyle = BG[t.state]
  g.beginPath()
  g.roundRect(10, 10, 364, 208, 22)
  g.fill()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = INK[t.state]
  g.font = `900 96px ${FONT}`
  g.fillText(String(t.n), 192, 84)
  // The prize: a skin swatch, then coins, parts or gems, or the season car's name.
  g.font = `900 48px ${FONT}`
  if (t.car) {
    g.font = `900 34px ${FONT}`
    g.fillText(t.car, 192, 172)
  } else {
    const text = t.coins ? short(t.coins) : t.parts ? String(t.parts) : String(t.gems)
    const w = g.measureText(text).width
    const icons = t.skin ? 2 : 1
    let x = 192 - (w + icons * 52) / 2 + 22
    if (t.skin) {
      const cols = t.skin.match(/#[0-9a-f]{3,8}/gi) ?? ['#ff4081']
      disc(g, x, 172, 24, '#14213d')
      cols.forEach((col, i) => {
        g.fillStyle = col
        g.beginPath()
        g.moveTo(x, 172)
        g.arc(x, 172, 20, (i / cols.length) * Math.PI * 2, ((i + 1) / cols.length) * Math.PI * 2)
        g.fill()
      })
      x += 52
    }
    if (t.coins) {
      disc(g, x, 172, 24, '#14213d')
      disc(g, x, 172, 20, '#b86e00')
      disc(g, x, 169, 18, '#ffc533')
    } else {
      g.font = `40px system-ui, sans-serif`
      g.fillText(t.parts ? '⚙' : '💎', x, 174)
    }
    g.font = `900 48px ${FONT}`
    g.fillStyle = INK[t.state]
    g.textAlign = 'left'
    g.fillText(text, x + 30, 174)
  }
  if (t.state !== 'ready') {
    disc(g, 336, 48, 30, '#14213d')
    disc(g, 336, 48, 24, t.state === 'got' ? '#45b649' : '#ffffff')
    g.textAlign = 'center'
    g.font = `900 30px system-ui, sans-serif`
    g.fillStyle = t.state === 'got' ? '#ffffff' : '#14213d'
    g.fillText(t.state === 'got' ? '✔' : '🔒', 336, 50)
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  tex.userData.text = true
  signs.set(k, tex)
  return tex
}

// A five-point star, shared by every arch.
let starGeo: ExtrudeGeometry | null = null
function star() {
  if (starGeo) return starGeo
  const s = new Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.16 : 0.36
    const a = Math.PI / 2 + (i * Math.PI) / 5
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  starGeo = new ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false })
  starGeo.translate(0, 0, -0.05)
  return starGeo
}

function Arch({ z, t }: { z: number; t: Tier }) {
  const big = !!t.car
  const half = ROAD + (big ? 0.45 : 0.25)
  const tall = big ? 3.4 : 2.7
  const post = POST[t.state]
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * half, tall / 2, 0]}>
          <boxGeometry args={[big ? 0.22 : 0.14, tall, big ? 0.22 : 0.14]} />
          <meshStandardMaterial color={post} />
        </mesh>
      ))}
      <mesh position={[0, tall - 0.08, 0]}>
        <boxGeometry args={[half * 2 + 0.2, big ? 0.2 : 0.12, 0.12]} />
        <meshStandardMaterial color={post} />
      </mesh>
      {/* The sign faces back down the road, towards the camera. */}
      <mesh position={[0, tall - 0.75, -0.08]} rotation-y={Math.PI}>
        <planeGeometry args={big ? [2.8, 1.66] : [2.0, 1.19]} />
        <meshBasicMaterial map={signTex(t)} color="#c8c8c8" toneMapped={false} fog={false} />
      </mesh>
      <mesh geometry={star()} position={[0, tall + (big ? 0.5 : 0.36), 0]} scale={big ? 1.5 : 1}>
        <meshBasicMaterial color={STAR[t.state]} toneMapped={false} fog={false} />
      </mesh>
    </group>
  )
}

// Follows view.z: high, behind and off to the right, looking up the road at the tiers ahead.
// Narrow (phone) views sit further back.
function PassCam({ view }: { view: RefObject<PassView> }) {
  const at = useRef<number | null>(null)
  useFrame(({ camera, size, gl, setSize }, dt) => {
    // The canvas measures itself while the panel is still scaling in (a transform, so nothing
    // re-measures once it's open): match the slot's real size.
    const slot = gl.domElement.closest('.stage-slot')
    if (slot && (Math.abs(slot.clientWidth - size.width) > 1 || Math.abs(slot.clientHeight - size.height) > 1)) setSize(slot.clientWidth, slot.clientHeight)
    const z = view.current?.z ?? 0
    at.current = at.current === null ? z : at.current + (z - at.current) * Math.min(1, dt * 8)
    const k = Math.min(1.6, Math.max(1, 1.25 / (size.width / size.height)))
    const c = camera as PerspectiveCamera
    c.position.set(Math.max(4.4, 3.2 * k), 5 * k, at.current - 4.5 * k)
    c.lookAt(0, 0.6, at.current + 6)
  })
  return null
}

export function SeasonScene({ tiers, carZ, car, prize, view }: { tiers: Tier[]; carZ: number; car: Look; prize: { body: Body; model?: string; color: string } | null; view: RefObject<PassView> }) {
  const end = PASS_FIRST + (tiers.length - 1) * PASS_GAP
  const me = useRef<RacerView>({ dist: carZ / SCALE }) as RefObject<RacerView>
  useEffect(() => {
    me.current!.dist = carZ / SCALE
  }, [carZ])
  // The season car waits at the finish line, under the last arch.
  const them = useRef<RacerView>({ dist: prize ? end / SCALE : -900 }) as RefObject<RacerView>
  const weather = useMemo(() => ({ ...raceWeather('main', 'star-pass'), kind: 'clear', rain: 0, snow: 0, cloud: 0.1, haze: 0, dust: 0, wet: 0, cover: 0 }) as never, [])
  return (
    <>
      <RaceScene track={end / SCALE} me={me} them={them} mine={car} theirs={prize ?? car} venue={venue('main')} weather={weather} night />
      {tiers.map((t, k) => <Arch key={t.n} z={PASS_FIRST + k * PASS_GAP} t={t} />)}
      <PassCam view={view} />
    </>
  )
}
