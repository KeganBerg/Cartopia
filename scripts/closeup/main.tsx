// Close-up review shots: one car or building, seen from many angles up close.
// Dev only: `npm run dev`, then `node scripts/closeup/shoot.mjs` captures contact sheets.
// ?kind=car&id=<car id>&color=%23e53935&mods=a,b
// ?kind=building&id=<building>&level=1..10&pair=0|1|2
// The page exposes window.shoot(views) -> PNG data URLs, one per view, so a
// sheet of angles costs one page load.
import { createRoot } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Box3, NeutralToneMapping, Vector3, type Group, type PerspectiveCamera } from 'three'
import { BUILDINGS, CARS, TILE } from '../../src/game/data'
import { BuildingModel } from '../../src/scene/BuildingModel'
import { CarModel } from '../../src/scene/CarModel'
import { KeepShapes, MergeScale } from '../../src/scene/mergeScale'
import { limitFor } from '../../src/scene/keepShape'
import { applyNight } from '../../src/scene/dayNight'
import { Batch } from '../../src/scene/Batch'
import { paverTex } from '../../src/scene/textures'
import { SharedShapes } from '../../src/scene/sharedShapes'
import { STREET_PROPS, hydrant, streetLamp, globeLamp } from '../../src/scene/streetProps'
import { WILD_PROPS } from '../../src/scene/decorProps'
import { PropMesh, type Built } from '../../src/scene/propKit'

// Sidewalk and wild props, by name (?kind=prop&id=bin).
const PROPS: Record<string, () => Built> = { ...STREET_PROPS, hydrant, streetLamp, globeLamp, ...Object.fromEntries(Object.entries(WILD_PROPS).map(([k, f]) => ['wild-' + k, f])) }

const q = new URLSearchParams(location.search)
const kind = q.get('kind') ?? 'car'
const id = q.get('id') ?? 'pip'
const night = q.get('night') === '1'
applyNight(night ? 1 : 0)

// One view: azimuth and elevation in degrees, distance as a multiple of the
// model's radius, and the aim as a fraction of the box (0..1 per axis).
type View = { az: number; el: number; d: number; at?: [number, number, number] }

function Shooter({ root }: { root: React.RefObject<Group | null> }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    const box = new Box3()
    const aim = (v: View) => {
      box.setFromObject(root.current!)
      const size = box.getSize(new Vector3())
      const r = Math.max(size.x, size.y, size.z) / 2
      const cam = camera as PerspectiveCamera
      const [fx, fy, fz] = v.at ?? [0.5, 0.4, 0.5]
      const look = new Vector3(box.min.x + size.x * fx, box.min.y + size.y * fy, box.min.z + size.z * fz)
      const az = (v.az * Math.PI) / 180
      const el = (v.el * Math.PI) / 180
      const dist = r * v.d
      cam.position.set(look.x + Math.sin(az) * Math.cos(el) * dist, look.y + Math.sin(el) * dist, look.z + Math.cos(az) * Math.cos(el) * dist)
      cam.near = dist / 50
      cam.far = dist * 50
      cam.lookAt(look)
        cam.updateProjectionMatrix()
    }
    ;(window as unknown as { shoot: (v: View[]) => string[] }).shoot = (views) => views.map((v) => {
      aim(v)
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/png')
    })
    // ?live=1 (clips): point the camera once and let the scene run.
    ;(window as unknown as { aim: (v: View) => void }).aim = aim
    ;(window as unknown as { ready: boolean }).ready = true
  }, [gl, scene, camera, root])
  return null
}

function Car() {
  const def = CARS.find((c) => c.id === id)!
  const mods = (q.get('mods') ?? '').split(',').filter(Boolean)
  return <CarModel body={def.body} model={def.id} color={q.get('color') ?? def.colors[0]} mods={mods} />
}

function Building() {
  const def = BUILDINGS.find((d) => d.id === id)!
  const level = Number(q.get('level') ?? 1)
  const pair = Number(q.get('pair') ?? 0)
  const scale: [number, number, number] = pair === 1 ? [2, 1, 1] : pair > 1 ? [pair, pair, pair] : [1, 1, 1]
  return (
    <Batch version={1}>
      <group scale={scale}>
        <MergeScale.Provider value={scale}>
          <KeepShapes limit={limitFor(def)}>
            <BuildingModel def={def} level={level} />
          </KeepShapes>
        </MergeScale.Provider>
      </group>
    </Batch>
  )
}

function Lot() {
  if (kind !== 'building') return null
  const def = BUILDINGS.find((d) => d.id === id)!
  const pair = Number(q.get('pair') ?? 0)
  const s = pair === 1 ? [2, 1] : pair > 1 ? [pair, pair] : [1, 1]
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
      <planeGeometry args={[def.w * TILE * s[0] - 0.1, def.h * TILE * s[1] - 0.1]} />
      <meshStandardMaterial map={paverTex(def.w * s[0], def.h * s[1])} />
    </mesh>
  )
}

function App() {
  const root = useRef<Group>(null)
  return (
    <Canvas shadows frameloop={q.get('live') ? 'always' : 'demand'} dpr={1} camera={{ fov: 35, position: [3, 2, 3] }} gl={{ toneMapping: NeutralToneMapping, preserveDrawingBuffer: true }}>
      <SharedShapes />
      <color attach="background" args={[night ? '#1c2533' : '#a9bfcc']} />
      <ambientLight intensity={night ? 0.35 : 0.8} />
      <hemisphereLight args={['#dfefff', '#5d6b4a', night ? 0.25 : 0.7]} />
      <directionalLight position={[8, 16, 6]} intensity={night ? 0.3 : 2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-0.0004} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={kind === 'car' ? '#8d969b' : '#6f8f5a'} />
      </mesh>
      <Lot />
      <group ref={root}>{kind === 'car' ? <Car /> : kind === 'prop' ? <PropMesh parts={PROPS[id]()} /> : <Building />}</group>
      <Shooter root={root} />
    </Canvas>
  )
}

// ?list=car|building only lists the ids to shoot.
const list = q.get('list')
if (list) (window as unknown as { ids: string[] }).ids = list === 'car' ? CARS.map((c) => c.id) : list === 'prop' ? Object.keys(PROPS) : BUILDINGS.map((d) => d.id)
else createRoot(document.getElementById('root')!).render(<App />)
