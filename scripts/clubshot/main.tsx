// The club at night with a queue at the rope, for close-ups of the bouncer and dancers.
// window.view(i) poses the camera; window.admit() makes the bouncer wave the first one in.
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { BUILDINGS, TILE } from '../../src/game/data'
import { BuildingModel } from '../../src/scene/BuildingModel'
import { DayNight } from '../../src/scene/DayNight'
import { LAYER } from '../../src/scene/layers'
import { paverTex } from '../../src/scene/textures'
import { SharedShapes } from '../../src/scene/sharedShapes'
import { Figure } from '../../src/scene/Figure'
import { CLUB } from '../../src/scene/clubLayout'
import { SHIRTS, PANTS, SKIN, HAIR } from '../../src/scene/people'
import * as door from '../../src/scene/clubDoor'
import { ClubLife } from '../../src/scene/ClubLife'
const solo = q0().get('solo') === '1'
function q0() { return new URLSearchParams(location.search) }

const q = new URLSearchParams(location.search)
const def = BUILDINGS.find((d) => d.id === 'club')!
const level = Number(q.get('level') ?? 7)
const d = (door as { door?: (k: string, x: number, z: number) => { waiting: boolean; admitted: number } }).door?.('shot', 0, 0)
if (d) d.waiting = true
;(window as unknown as { admit: () => void }).admit = () => {
  if (d) d.admitted = performance.now() / 1000
}

const fy = solo ? 0 : 1.45 + 0.26 * (Math.min(10, level) - 1)
const VIEWS: { p: [number, number, number]; at: [number, number, number]; fov: number }[] = [
  { p: [-0.2, 1.8, 3.6], at: [-0.9, 0.5, 0.6], fov: 30 }, // bouncer and the front of the line
  { p: [-0.7, 0.95, 2.1], at: [-1.4, 0.62, 0.62], fov: 22 }, // bouncer close
  { p: [2.2, fy + 2.4, 3.2], at: [0, fy + 0.3, -0.25], fov: 34 }, // rooftop dancers
  { p: [0.9, fy + 1.0, 1.7], at: [0, fy + 0.4, -0.25], fov: 34 }, // dancers close
  { p: [4.5, 3.5 + fy * 0.5, 6.5], at: [0, fy * 0.5, 0], fov: 40 }, // whole club
  { p: [-2.6, 1.0, 2.0], at: [-1.4, 0.6, 0.62], fov: 22 }, // bouncer from the far side
  { p: [-0.6, 1.1, 2.2], at: [-1.4, 0.5, 0.62], fov: 22 }, // bouncer whole, his front
  { p: [-1.05, 0.95, 1.4], at: [-1.4, 0.82, 0.62], fov: 16 }, // bouncer's head
]

function Cam() {
  const { camera } = useThree()
  ;(window as unknown as { view: (i: number) => void }).view = (i) => {
    const v = VIEWS[i]
    camera.position.set(...v.p)
    camera.lookAt(...v.at)
    ;(camera as unknown as { fov: number }).fov = v.fov
    camera.near = 0.05
    camera.far = 200
    camera.updateProjectionMatrix()
  }
  return null
}

createRoot(document.getElementById('root')!).render(
  <Canvas shadows dpr={Number(q.get('dpr') ?? 1)} camera={{ fov: 35, position: [3, 2, 3] }} gl={{ toneMapping: NeutralToneMapping, preserveDrawingBuffer: true }}>
    <SharedShapes />
    <Cam />
    <DayNight small={false} />
    {q.get('bright') && <ambientLight intensity={2.5} />}
    <mesh rotation-x={-Math.PI / 2} position-y={LAYER.land}>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#3a5f2b" />
    </mesh>
    <mesh rotation-x={-Math.PI / 2} position-y={LAYER.lot}>
      <planeGeometry args={[def.w * TILE - 0.1, def.h * TILE - 0.1]} />
      <meshStandardMaterial map={paverTex(def.w, def.h)} />
    </mesh>
    {solo ? (
      <>
        <directionalLight position={[3, 6, 5]} intensity={2.2} />
        <hemisphereLight args={['#ffffff', '#666666', 1.2]} />
        <ClubLife lvl={level} roofY={3} roofZ={-0.29} floorY={0} floorZ={-0.23} floorW={2.9} floorD={0.94} />
      </>
    ) : (
      <BuildingModel def={def} level={level} />
    )}
    {/* Townspeople waiting in line (the same parts they walk about in). */}
    {[0, 1, 2, 3].map((i) => (
      <group key={i} position={[CLUB.queueX + i * CLUB.gap, 0, CLUB.queueZ]} rotation-y={Math.PI}>
        <Figure shirt={SHIRTS[(i * 3 + 1) % SHIRTS.length]} pants={PANTS[i % PANTS.length]} skin={SKIN[(i * 2 + 1) % SKIN.length]} hat={HAIR[(i + 2) % HAIR.length]} />
      </group>
    ))}
  </Canvas>,
)
;(window as unknown as { ready: boolean }).ready = true
