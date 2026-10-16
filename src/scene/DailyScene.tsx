import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace, type PerspectiveCamera } from 'three'
import { RaceScene, type RacerView } from './RaceScene'
import { ROAD } from './RaceVenues'
import type { Venue } from './venues'
import { TRACK } from '../game/race'
import type { Body } from '../game/data'

// The Daily Run (ui/DailyRun.tsx) staged on the day's venue in the day's weather (the same roll
// the run itself uses): the loaner car on the line beside its white par ghost, and a timing
// tower by the start showing today's best like a drag strip's ET board.

type Look = { body: Body; model?: string; color: string }

const FONT = '"Arial Black", Impact, system-ui, sans-serif'
const MEDAL = ['#ffc533', '#cfd8dc', '#e0874a']
const boards = new Map<string, CanvasTexture>()

// The board's face: the day number, then the best time with its medal.
function boardTex(n: number, best: number | null, medal: number | null) {
  const k = `${n}|${best}|${medal}`
  const hit = boards.get(k)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 320
  const g = c.getContext('2d')!
  g.fillStyle = '#0d1424'
  g.fillRect(0, 0, 512, 320)
  g.fillStyle = '#1f2a44'
  g.fillRect(0, 0, 512, 92)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#ffffff'
  g.font = `900 56px ${FONT}`
  g.fillText(`DAILY #${n}`, 256, 50)
  // The time in big amber digits, shrunk until it fits beside the medal.
  const text = best !== null ? best.toFixed(3) : '--.---'
  const room = medal !== null ? 380 : 470
  const x = medal !== null ? 210 : 256
  let size = 132
  g.font = `900 ${size}px ${FONT}`
  while (g.measureText(text).width > room && size > 60) {
    size -= 6
    g.font = `900 ${size}px ${FONT}`
  }
  g.fillStyle = best !== null ? '#ffb300' : '#6b5228'
  g.fillText(text, x, 210)
  if (medal !== null) {
    g.fillStyle = MEDAL[medal]
    g.beginPath()
    g.arc(452, 206, 38, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#0d1424'
    g.font = `900 46px ${FONT}`
    g.fillText(String(medal + 1), 452, 210)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  t.userData.text = true
  boards.set(k, t)
  return t
}

// A two-legged steel tower on the left kerb up the strip, its board turned back towards the line.
function TimingTower({ n, best, medal }: { n: number; best: number | null; medal: number | null }) {
  return (
    <group position={[-(ROAD + 0.45), 0, 3.4]} rotation-y={Math.PI - 0.5} scale={1.15}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.62, 0.8, -0.14]}>
          <boxGeometry args={[0.1, 1.6, 0.1]} />
          <meshStandardMaterial color="#37474f" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {[0.55, 1.2].map((y) => (
        <mesh key={y} position={[0, y, -0.14]}>
          <boxGeometry args={[1.24, 0.06, 0.06]} />
          <meshStandardMaterial color="#37474f" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 2.05, -0.06]}>
        <boxGeometry args={[1.56, 1.02, 0.1]} />
        <meshStandardMaterial color="#14213d" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.05, 0.002]}>
        <planeGeometry args={[1.44, 0.9]} />
        <meshBasicMaterial map={boardTex(n, best, medal)} toneMapped={false} fog={false} />
      </mesh>
      {/* A hood over the board, and a beacon on top. */}
      <mesh position={[0, 2.6, 0.06]} rotation-x={0.25}>
        <boxGeometry args={[1.6, 0.04, 0.3]} />
        <meshStandardMaterial color="#263238" />
      </mesh>
      <mesh position={[0.6, 2.72, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.12, 10]} />
        <meshBasicMaterial color="#ff5252" toneMapped={false} />
      </mesh>
    </group>
  )
}

// Low behind the line on the player's side, looking past the cars up the strip at the timing
// tower. Sways a touch; narrow (phone) views step back and widen to keep both cars in.
function DailyCam() {
  useFrame(({ camera, size, gl, setSize, clock }) => {
    // The canvas measures itself while the panel is still scaling in: match the slot's real size.
    const slot = gl.domElement.closest('.stage-slot')
    if (slot && (Math.abs(slot.clientWidth - size.width) > 1 || Math.abs(slot.clientHeight - size.height) > 1)) setSize(slot.clientWidth, slot.clientHeight)
    const aspect = size.width / size.height
    const k = Math.min(1, Math.max(0, (1.4 - aspect) / 0.9)) // 0 wide, 1 phone
    const c = camera as PerspectiveCamera
    // RaceScene sets its own field of view for the chase camera: this shot wants its own.
    const fov = 46 + 14 * k
    if (Math.abs(c.fov - fov) > 0.01) {
      c.fov = fov
      c.updateProjectionMatrix()
    }
    const sway = Math.sin(clock.elapsedTime * 0.3) * 0.12
    c.position.set(0.95 + sway, 1.5, -4.6 + 0.2 * k)
    c.lookAt(-0.55 + 0.15 * k, 0.3 + 0.55 * k, 3)
  })
  return null
}

export function DailyScene({ venue, seed, car, n, best, medal }: { venue: Venue; seed: string; car: Look; n: number; best: number | null; medal: number | null }) {
  // Both staged on the line: the loaner in the player's lane, the par ghost beside it.
  const me = useRef<RacerView>({ dist: 0 }) as RefObject<RacerView>
  const them = useRef<RacerView>({ dist: 0 }) as RefObject<RacerView>
  const ghost = useMemo(() => ({ body: car.body, model: car.model, color: '#eceff1' }), [car.body, car.model])
  return (
    <>
      <RaceScene track={TRACK} me={me} them={them} mine={car} theirs={ghost} venue={venue} weatherSeed={seed} />
      <TimingTower n={n} best={best} medal={medal} />
      <DailyCam />
    </>
  )
}
