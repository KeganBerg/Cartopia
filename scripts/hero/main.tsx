// Renders the hero pictures on the Race menu's tiles (src/assets/race-menu/).
// Dev only: `npm run dev`, then `node scripts/hero/shoot.mjs` captures each shot.
// A shot is picked by URL: ?shot=camp|tour|gp|trial&venue=<id>&night=1
import { createRoot } from 'react-dom/client'
import { useRef, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { NeutralToneMapping, type PerspectiveCamera } from 'three'
import { RaceScene, startLights, type RacerView } from '../../src/scene/RaceScene'
import { CarModel } from '../../src/scene/CarModel'
import { venue as venueById } from '../../src/scene/venues'
import { raceWeather } from '../../src/game/weather'
import { carDef } from '../../src/game/data'
import { TRACK } from '../../src/game/race'
import { signTexture } from '../../src/scene/signTexture'
import { glowTex } from '../../src/scene/textures'

const q = new URLSearchParams(location.search)
const shot = q.get('shot') ?? 'camp'
const v = venueById(q.get('venue') ?? 'main')
const night = q.get('night') === '1'
const LEN = TRACK * 0.25
const LANE = 0.75

type Car = { model: string; color: string; finish?: 'gloss' | 'metallic' | 'pearl' | 'matte' | 'chrome' }
const car = (c: Car) => ({ body: carDef(c.model).body, model: c.model, color: c.color, finish: c.finish })
// The player's car (right lane) and the rival (left lane) for each kind of shot.
const CARS: Record<string, [Car, Car]> = {
  camp: [{ model: 'vette', color: '#e53935', finish: 'metallic' }, { model: 'charger', color: '#263238' }],
  tour: [{ model: 'gtr', color: '#eceff1', finish: 'pearl' }, { model: 'lambo', color: '#fdd835', finish: 'metallic' }],
  gp: [{ model: 'vette', color: '#e53935' }, { model: 'vette', color: '#e53935' }],
  trial: [{ model: 'rally', color: '#1e88e5', finish: 'metallic' }, { model: 'rally', color: '#1e88e5' }],
}

// Where the race puts each car (race metres), and the camera.
type Cam = { pos: [number, number, number]; at: [number, number, number]; fov: number }
const SHOTS: Record<string, { me: number; them: number; cam: Cam }> = {
  // Head on at the start line under the lights, both cars staged.
  camp: { me: 0, them: 0, cam: { pos: [0.3, 1.25, 8.6], at: [0, 0.2, -0.5], fov: 40 } },
  // Low on the kerb at the finish, both noses on the line.
  tour: { me: TRACK - 1.5, them: TRACK - 0.6, cam: { pos: [0.5, 1.0, LEN + 8.4], at: [0, 0.4, LEN - 0.6], fov: 40 } },
  // The podium on the finish line; the racers are parked out of sight.
  gp: { me: -900, them: -900, cam: { pos: [0.3, 1.3, LEN - 8.4], at: [0, 0.75, LEN + 0.5], fov: 50 } },
  // A lone car flat out down the strip, from low beside the road ahead of it.
  trial: { me: 236, them: -900, cam: { pos: [1.45, 0.6, 236 * 0.25 + 4.6], at: [0.45, 0.25, 236 * 0.25 - 0.8], fov: 40 } },
}

const s = SHOTS[shot]
const pair = CARS[shot]

function HeroCam({ cam }: { cam: Cam }) {
  // Runs after the race scene's own chase camera each frame, so it wins.
  useFrame(({ camera }) => {
    const c = camera as PerspectiveCamera
    if (c.fov !== cam.fov) { c.fov = cam.fov; c.updateProjectionMatrix() }
    c.position.set(...cam.pos)
    c.lookAt(...cam.at)
  })
  return null
}

// Grand Prix podium: three steps on the finish line, the top three cars on them, a trophy and confetti.
const STEPS: { x: number; h: number; n: string; c: Car }[] = [
  { x: 0, h: 0.62, n: '1', c: { model: 'lambo', color: '#fdd835', finish: 'metallic' } },
  { x: 1.15, h: 0.4, n: '2', c: { model: 'gtr', color: '#eceff1', finish: 'pearl' } },
  { x: -1.15, h: 0.25, n: '3', c: { model: 'vette', color: '#e53935', finish: 'metallic' } },
]
const STEP_COL = ['#ffb300', '#78909c', '#f4511e']
function Podium() {
  const confetti = useRef(Array.from({ length: 160 }, (_, i) => {
    const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1
    return { p: [(r(1) - 0.5) * 5.5, 0.7 + r(2) * 2.6, LEN - 2.5 + r(3) * 3] as [number, number, number], rot: [r(4) * 6, r(5) * 6, r(6) * 6] as [number, number, number], c: ['#ff1744', '#ffd600', '#00e5ff', '#76ff03', '#ff4081', '#ffffff'][i % 6] }
  })).current
  return (
    <group>
      {STEPS.map((st, i) => (
        <group key={i} position={[st.x, 0, LEN + 0.2]}>
          <mesh position={[0, st.h / 2, 0]}>
            <boxGeometry args={[1.12, st.h, 2.3]} />
            <meshStandardMaterial color="#fafafa" />
          </mesh>
          <mesh position={[0, st.h - 0.03, 0]}>
            <boxGeometry args={[1.14, 0.06, 2.32]} />
            <meshStandardMaterial color={STEP_COL[i]} metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh position={[0, st.h / 2 - 0.03, -1.155]} rotation-y={Math.PI}>
            <planeGeometry args={[0.5, Math.min(0.42, st.h * 0.8)]} />
            <meshBasicMaterial map={signTexture(st.n, STEP_COL[i], '#ffffff')} toneMapped={false} />
          </mesh>
          <group position={[0, st.h, 0.25]} rotation-y={Math.PI + st.x * 0.2} scale={1.4}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.005}>
              <planeGeometry args={[0.9, 1.5]} />
              <meshBasicMaterial map={glowTex()} color="#000000" transparent opacity={0.3} depthWrite={false} />
            </mesh>
            <CarModel {...car(st.c)} />
          </group>
        </group>
      ))}
      {/* The trophy, standing on top of the finish gantry. */}
      <group position={[0, 3.3, LEN]} scale={1.7}>
        <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.32, 0.12, 0.32]} /><meshStandardMaterial color="#3e2723" /></mesh>
        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.04, 0.07, 0.2, 16]} /><meshStandardMaterial color="#ffc107" metalness={0.9} roughness={0.2} /></mesh>
        <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.2, 0.06, 0.3, 24]} /><meshStandardMaterial color="#ffc107" metalness={0.9} roughness={0.2} /></mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * 0.21, 0.45, 0]} rotation-z={sd * 0.3}><torusGeometry args={[0.07, 0.018, 8, 16, Math.PI]} /><meshStandardMaterial color="#ffc107" metalness={0.9} roughness={0.2} /></mesh>
        ))}
      </group>
      {confetti.map((k, i) => (
        <mesh key={i} position={k.p} rotation={k.rot}>
          <planeGeometry args={[0.07, 0.04]} />
          <meshBasicMaterial color={k.c} side={2} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// The start lights only face the drivers; the head-on shot gets a matching set on the front.
function FrontLights() {
  return (
    <group position={[0, 2.5, -0.77]}>
      {['#ff1744', '#ff1744', '#ffab00'].map((c, i) => (
        <mesh key={i} position={[(i - 1) * 0.38, 0, 0]}>
          <circleGeometry args={[0.13, 18]} />
          <meshBasicMaterial color={c} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// Time trial: a lit split-time board beside the strip, just behind the car.
function SplitBoard() {
  const z = 236 * 0.25 - 4
  return (
    <group position={[-1.95, 0, z]}>
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 1.1, 0]}><boxGeometry args={[0.07, 2.2, 0.07]} /><meshStandardMaterial color="#37474f" /></mesh>
      ))}
      <mesh position={[0, 1.95, -0.03]}><boxGeometry args={[1.35, 0.6, 0.06]} /><meshStandardMaterial color="#212121" /></mesh>
      <mesh position={[0, 1.95, 0.005]}>
        <planeGeometry args={[1.25, 0.5]} />
        <meshBasicMaterial map={signTexture('6.412', '#101418', '#76ff03')} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Hero() {
  const me = useRef<RacerView>({ dist: s.me }) as RefObject<RacerView>
  const them = useRef<RacerView>({ dist: s.them }) as RefObject<RacerView>
  // The start shot has the lights on red-red-amber.
  startLights.n = shot === 'camp' ? 1 : 99
  const weather = { ...raceWeather(v.id, 'hero'), kind: 'clear', rain: 0, snow: v.id === 'snow' ? 0.25 : 0, cloud: 0.1, haze: 0, dust: 0, wet: 0, cover: v.id === 'snow' ? 0.4 : 0 } as never
  return (
    <>
      <RaceScene track={TRACK} me={me} them={them} mine={car(pair[0])} theirs={car(pair[1])} venue={v} weather={weather} night={night} />
      {shot === 'gp' && <Podium />}
      {shot === 'camp' && <FrontLights />}
      {shot === 'trial' && <SplitBoard />}
      <HeroCam cam={s.cam} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <Canvas camera={{ position: [0, 2, -4], fov: 55, near: 0.1, far: 150 }} dpr={1} gl={{ toneMapping: NeutralToneMapping, preserveDrawingBuffer: true }}>
    <Hero />
  </Canvas>,
)
