// Stills of a race venue for review (the World Tour venues in scene/world/ especially).
// Dev only: `npm run dev`, then `node scripts/venueshot/shoot.mjs <venue> [out] [night]`.
// ?venue=<id>&d=<metres>&night=1&dist=<race metres>: both cars parked d metres down the strip,
// seen from the race's own chase camera. window.shoot(views) renders free camera views
// (position and aim in world units) after that, for close-ups of the scenery.
import { createRoot } from 'react-dom/client'
import { useEffect, useRef, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { NeutralToneMapping, type PerspectiveCamera } from 'three'
import { RaceScene, startLights, type RacerView } from '../../src/scene/RaceScene'
import { SharedShapes } from '../../src/scene/sharedShapes'
import { venue as venueById } from '../../src/scene/venues'
import { raceWeather } from '../../src/game/weather'
import { carDef } from '../../src/game/data'

const q = new URLSearchParams(location.search)
const v = venueById(q.get('venue') ?? 'main')
const night = q.get('night') === '1'
const d = Number(q.get('d') ?? 4)
const track = Number(q.get("dist") ?? 400)
const car = (model: string, color: string) => ({ body: carDef(model).body, model, color })
startLights.n = 0

type View = { pos: [number, number, number]; at: [number, number, number]; fov?: number }
function Shooter() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    const w = window as unknown as { shoot: (v: View[]) => string[]; ready: boolean }
    w.shoot = (views) => views.map((vw) => {
      const cam = camera as PerspectiveCamera
      cam.position.set(...vw.pos)
      cam.lookAt(...vw.at)
      cam.fov = vw.fov ?? 50
      cam.updateProjectionMatrix()
      gl.render(scene, cam)
      return gl.domElement.toDataURL('image/png')
    })
    ;(window as unknown as { __scene: unknown }).__scene = scene
    w.ready = true
  }, [gl, scene, camera])
  return null
}

function Scene() {
  const me = useRef<RacerView>({ dist: d }) as RefObject<RacerView>
  const them = useRef<RacerView>({ dist: d - 1.5 }) as RefObject<RacerView>
  const weather = { ...raceWeather(v.id, 'shot'), kind: 'clear', rain: 0, snow: v.base === 'snow' ? 0.25 : 0, cloud: 0.1, haze: 0, dust: 0, wet: 0, cover: v.base === 'snow' ? 0.4 : 0 } as never
  return <RaceScene track={track} me={me} them={them} mine={car('gtr', '#eceff1')} theirs={car('lambo', '#fdd835')} venue={v} weather={weather} night={night} />
}

createRoot(document.getElementById('root')!).render(
  <Canvas camera={{ position: [0.4, 2.2, -4], fov: 55, near: 0.3, far: 150 }} dpr={1} gl={{ toneMapping: NeutralToneMapping, preserveDrawingBuffer: true }}>
    <SharedShapes />
    <Scene />
    <Shooter />
  </Canvas>,
)
