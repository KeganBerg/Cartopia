// Renders one town building at a level, as it sits in town, for asset checks.
// Dev only: `npm run dev`, then `node scripts/assets/shoot.mjs` captures every
// building at L1/L4/L7/L10 and as a merged pair.
// ?id=<building>&level=1..10&pair=0|1&night=0|1&side=0..3
import { createRoot } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MeshBasicMaterial, NeutralToneMapping, type Group, type Mesh, type OrthographicCamera } from 'three'
import { floating, describe } from '../../src/scene/floating'
import { BUILDINGS, TILE } from '../../src/game/data'
import { BuildingModel } from '../../src/scene/BuildingModel'
import { KeepShapes, MergeScale } from '../../src/scene/mergeScale'
import { limitFor } from '../../src/scene/keepShape'
import { applyNight } from '../../src/scene/dayNight'
import { Batch } from '../../src/scene/Batch'
import { paverTex } from '../../src/scene/textures'

const q = new URLSearchParams(location.search)
const def = BUILDINGS.find((d) => d.id === (q.get('id') ?? 'bowling'))!
const level = Number(q.get('level') ?? 1)
const pair = q.get('pair') === '1'
const night = q.get('night') === '1'
const side = Number(q.get('side') ?? 0)
const mark = q.get('mark') === '1'
const zoomIn = Number(q.get('zoom') ?? 1)
const scale: [number, number, number] = pair ? [2, 1.5, 1] : [1, 1, 1]
applyNight(night ? 1 : 0)

function Cam() {
  const { camera, size } = useThree()
  useEffect(() => {
    const c = camera as OrthographicCamera
    const a = Math.PI / 4 + (side * Math.PI) / 2
    c.position.set(Math.sin(a) * 60, 52, Math.cos(a) * 60)
    c.lookAt(0, 1.2 * scale[1], 0)
    const span = Math.max(def.w * TILE * scale[0], def.h * TILE * scale[2], 3) * 1.6 + 1.5
    c.zoom = (Math.min(size.width, size.height) / span) * zoomIn
    c.updateProjectionMatrix()
  }, [camera, size])
  return null
}

const PINK = new MeshBasicMaterial({ color: '#ff00ff' })
// Paints every floating piece bright pink (see src/scene/floating.ts).
function Mark({ root }: { root: React.RefObject<Group | null> }) {
  const n = useRef(0)
  useFrame(() => {
    if (++n.current !== 3 || !root.current) return
    const bad = floating(root.current)
    for (const c of bad) for (const p of c.members) (p.o as Mesh).material = PINK
    ;(window as unknown as { floats: string[] }).floats = bad.map(describe)
    console.log('floating', bad.length)
  })
  return null
}

function App() {
  const root = useRef<Group>(null)
  const W = def.w * TILE * scale[0], D = def.h * TILE * scale[2]
  return (
    <Canvas shadows orthographic camera={{ position: [60, 52, 60], zoom: 60, near: 1, far: 400 }} gl={{ toneMapping: NeutralToneMapping, preserveDrawingBuffer: true }}>
      <color attach="background" args={[night ? '#1c2533' : '#9fb8c8']} />
      <ambientLight intensity={night ? 0.35 : 0.9} />
      <hemisphereLight args={['#dfefff', '#5d6b4a', night ? 0.25 : 0.7]} />
      <directionalLight position={[20, 40, 12]} intensity={night ? 0.25 : 2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      <Cam />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#6f8f5a" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
        <planeGeometry args={[W - 0.1, D - 0.1]} />
        <meshStandardMaterial map={paverTex(def.w * scale[0], def.h * scale[2])} />
      </mesh>
      <Batch version={1} off={mark}>
        <group scale={scale} ref={root}>
          <MergeScale.Provider value={scale}>
            <KeepShapes limit={limitFor(def)}>
              <BuildingModel def={def} level={level} />
            </KeepShapes>
          </MergeScale.Provider>
        </group>
      </Batch>
      {mark && <Mark root={root} />}
    </Canvas>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
