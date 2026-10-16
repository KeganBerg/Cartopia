import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace, type PerspectiveCamera } from 'three'
import { RaceScene, type RacerView } from './RaceScene'
import { CarModel } from './CarModel'
import type { Venue } from './venues'
import { TRACK } from '../game/race'
import type { BoardCar } from '../lib/trialServer'

// The Weekly Time Trial (ui/TimeTrial.tsx) staged on the week's venue: the player's car on the
// line beside its white ghost, a three-step podium up the strip with this week's top three cars
// (tap one to open that player's profile), each under a name tag with its time, and a
// scoreboard behind it with the player's best and place.

// A car as its owner saved it: paint, finish, skins, panels, trim, mods and hat.
export type TrialLook = BoardCar
export type PodiumCar = { look: TrialLook; name: string; t: number; owner: string; mine: boolean }

const FONT = '"Arial Black", Impact, system-ui, sans-serif'
const GOLD = ['#ffc533', '#cfd8dc', '#e0874a']
const TRIM = ['#b8860b', '#78909c', '#9c4f1f']
// Podium steps, by place: x across the road (the camera looks up the strip, so +x is screen
// left), the step's height, and how the car on it is turned to face the camera.
export const STEP: { x: number; h: number; ry: number }[] = [
  { x: 0, h: 0.62, ry: Math.PI + 0.55 },
  { x: 1.07, h: 0.42, ry: Math.PI - 0.6 },
  { x: -1.07, h: 0.27, ry: Math.PI + 0.6 },
]
const PODIUM_Z = 6.6
export const W = 1.04
const D = 1.25

const texs = new Map<string, CanvasTexture>()
function tex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const hit = texs.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  t.userData.text = true
  texs.set(key, t)
  return t
}

// Shrinks the font until the text fits.
function fit(g: CanvasRenderingContext2D, text: string, size: number, room: number, min = 24) {
  g.font = `900 ${size}px ${FONT}`
  while (g.measureText(text).width > room && size > min) {
    size -= 4
    g.font = `900 ${size}px ${FONT}`
  }
}

// A step's face: its big place number on the medal colour. The canvas has the face's own shape
// (wide and short on the low steps), so the number keeps its proportions instead of being
// squashed to fit a fixed-size texture (trialScene.test.tsx checks every text face).
const STEP_PX = 160
const stepTex = (i: number) => {
  const h = STEP_PX
  const w = Math.round((STEP_PX * W) / STEP[i].h)
  return tex(`step${i}`, w, h, (g) => {
    g.fillStyle = GOLD[i]
    g.fillRect(0, 0, w, h)
    g.fillStyle = TRIM[i]
    g.fillRect(0, 0, w, 10)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `900 ${Math.round(h * 0.78)}px ${FONT}`
    g.lineJoin = 'round'
    g.lineWidth = Math.round(h * 0.1)
    g.strokeStyle = '#14213d'
    g.strokeText(String(i + 1), w / 2, h * 0.58)
    g.fillStyle = '#ffffff'
    g.fillText(String(i + 1), w / 2, h * 0.58)
  })
}

// The tag over a podium car: the player's name, and their time in amber digits.
const tagTex = (name: string, t: number, i: number, mine: boolean) => tex(`tag|${name}|${t}|${i}|${mine}`, 512, 200, (g) => {
  g.fillStyle = mine ? '#1e5fbf' : '#14213d'
  g.beginPath()
  g.roundRect(6, 6, 500, 188, 40)
  g.fill()
  g.lineWidth = 10
  g.strokeStyle = GOLD[i]
  g.stroke()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#ffffff'
  fit(g, name, 64, 460)
  g.fillText(name, 256, 64)
  g.fillStyle = '#ffb300'
  g.font = `900 76px ${FONT}`
  g.fillText(`${t.toFixed(3)}s`, 256, 142)
})

// The tower's board: the player's best this week and their place.
const boardTex = (best: number | null, place: number | null) => tex(`board|${best}|${place}`, 512, 320, (g) => {
  g.fillStyle = '#0d1424'
  g.fillRect(0, 0, 512, 320)
  g.fillStyle = '#1f2a44'
  g.fillRect(0, 0, 512, 92)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#ffffff'
  g.font = `900 56px ${FONT}`
  g.fillText('YOUR BEST', 256, 50)
  const text = best !== null ? best.toFixed(3) : '--.---'
  const withPlace = place !== null
  fit(g, text, 132, withPlace ? 360 : 470, 60)
  g.fillStyle = best !== null ? '#ffb300' : '#6b5228'
  g.fillText(text, withPlace ? 200 : 256, 210)
  if (withPlace) {
    g.fillStyle = place <= 3 ? GOLD[place - 1] : '#2f7ff0'
    g.beginPath()
    g.arc(446, 206, 46, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = place <= 3 ? '#0d1424' : '#ffffff'
    fit(g, String(place), 54, 76)
    g.fillText(String(place), 446, 210)
  }
})

function Step({ i, car, onPick }: { i: number; car?: PodiumCar; onPick?: (owner: string) => void }) {
  const s = STEP[i]
  return (
    <group position={[s.x, 0, PODIUM_Z]}>
      <mesh position={[0, s.h / 2, 0]}>
        <boxGeometry args={[W, s.h, D]} />
        <meshStandardMaterial color={GOLD[i]} metalness={i === 1 ? 0.5 : 0.25} roughness={0.45} />
      </mesh>
      {/* Its number on the face towards the line, and a red carpet on top. */}
      <mesh position={[0, s.h / 2, -D / 2 - 0.003]} rotation-y={Math.PI}>
        <planeGeometry args={[W, s.h]} />
        <meshBasicMaterial map={stepTex(i)} toneMapped={false} />
      </mesh>
      <mesh position={[0, s.h + 0.006, 0]}>
        <boxGeometry args={[W - 0.06, 0.012, D - 0.06]} />
        <meshStandardMaterial color="#c62828" roughness={0.9} />
      </mesh>
      {car && (
        <>
          <group
            position={[0, s.h + 0.012, 0]}
            rotation-y={s.ry}
            onClick={onPick && ((e) => { e.stopPropagation(); onPick(car.owner) })}
          >
            <CarModel {...car.look} lean />
          </group>
          <sprite position={[0, s.h + 0.9, 0]} scale={[0.98, 0.38, 1]}>
            <spriteMaterial map={tagTex(car.name, car.t, i, car.mine)} toneMapped={false} fog={false} />
          </sprite>
        </>
      )}
    </group>
  )
}

// A two-legged steel scoreboard standing behind the podium, facing the line.
function TimingTower({ best, place }: { best: number | null; place: number | null }) {
  return (
    <group position={[0, 0.36, PODIUM_Z + 1.9]} rotation-y={Math.PI} scale={0.9}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.62, 0.6, -0.14]}>
          <boxGeometry args={[0.1, 2, 0.1]} />
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
        <meshBasicMaterial map={boardTex(best, place)} toneMapped={false} fog={false} />
      </mesh>
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

// Just past the line (the player's car and its ghost wait behind it), looking up the strip at
// the podium. Sways a touch; narrow (phone) views step back and widen to keep the whole podium in.
function TrialCam() {
  useFrame(({ camera, size, gl, setSize, clock }) => {
    // The canvas measures itself while the panel is still scaling in: match the slot's real size.
    const slot = gl.domElement.closest('.stage-slot')
    if (slot && (Math.abs(slot.clientWidth - size.width) > 1 || Math.abs(slot.clientHeight - size.height) > 1)) setSize(slot.clientWidth, slot.clientHeight)
    const aspect = size.width / size.height
    const k = Math.min(1, Math.max(0, (1.4 - aspect) / 0.9)) // 0 wide, 1 phone
    const c = camera as PerspectiveCamera
    const fov = 46 + 14 * k
    if (Math.abs(c.fov - fov) > 0.01) {
      c.fov = fov
      c.updateProjectionMatrix()
    }
    const sway = Math.sin(clock.elapsedTime * 0.3) * 0.15
    c.position.set(0.3 + sway, 1.35 + 0.25 * k, 1.9 - 1.1 * k)
    c.lookAt(-0.05, 0.85, PODIUM_Z)
  })
  return null
}

// The podium with its cars and tags, and the scoreboard: everything this scene adds to the strip.
export function PodiumSet({ podium, best, place, onPick }: { podium: PodiumCar[]; best: number | null; place: number | null; onPick?: (owner: string) => void }) {
  return (
    <>
      {STEP.map((_, i) => <Step key={i} i={i} car={podium[i]} onPick={onPick} />)}
      <TimingTower best={best} place={place} />
    </>
  )
}

export function TrialScene({ venue, seed, car, podium, best, place, onPick }: {
  venue: Venue; seed: string; car: Parameters<typeof RaceScene>[0]['mine']; podium: PodiumCar[]; best: number | null; place: number | null; onPick?: (owner: string) => void
}) {
  const me = useRef<RacerView>({ dist: 0 }) as RefObject<RacerView>
  const them = useRef<RacerView>({ dist: 0 }) as RefObject<RacerView>
  const ghost = useMemo(() => ({ body: car.body, model: car.model, color: '#eceff1' }), [car.body, car.model])
  return (
    <>
      <RaceScene track={TRACK} me={me} them={them} mine={car} theirs={ghost} venue={venue} weatherSeed={seed} />
      <PodiumSet podium={podium} best={best} place={place} onPick={onPick} />
      <TrialCam />
    </>
  )
}
