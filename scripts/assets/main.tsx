// Renders one town building at a level, as it sits in town, for asset checks.
// Dev only: `npm run dev`, then `node scripts/assets/shoot.mjs` captures every
// building at L1/L4/L7/L10 and as a merged pair.
// ?id=<building>&level=1..10&pair=0|1|2|4&night=0|1&side=0..3
// pair: 1 a 1x2 pair, 2 a 2x2 block, 4 a 4x4 block. land=vanguard|globe draws that landmark instead.
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
import { VanguardTower } from '../../src/scene/Landmark'
import { GlobeTower } from '../../src/scene/GlobeTower'

const q = new URLSearchParams(location.search)
const def = BUILDINGS.find((d) => d.id === (q.get('id') ?? 'bowling'))!
const level = Number(q.get('level') ?? 1)
const pair = Number(q.get('pair') ?? 0)
const night = q.get('night') === '1'
const side = Number(q.get('side') ?? 0)
const mark = q.get('mark') === '1'
const zoomIn = Number(q.get('zoom') ?? 1)
const land = q.get('land')
// The landmark's lot in units (the Globe Tower's runs along x).
const LAND: Record<string, [number, number]> = { vanguard: [4, 4], globe: [8, 4] }
const scale: [number, number, number] = pair === 1 ? [2, 1, 1] : pair > 1 ? [pair, pair, pair] : [1, 1, 1]
applyNight(night ? 1 : 0)

function Cam() {
  const { camera, size } = useThree()
  useEffect(() => {
    const c = camera as OrthographicCamera
    const a = Math.PI / 4 + (side * Math.PI) / 2
    c.position.set(Math.sin(a) * 60, 52, Math.cos(a) * 60)
    c.lookAt(0, land ? Number(q.get('look') ?? 7) : 1.2 * scale[1], 0)
    const span = land ? 21 : Math.max(def.w * TILE * scale[0], def.h * TILE * scale[2], 3) * 1.6 + 1.5
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

// A townsperson for scale (as tall as the ones walking about, ~0.6), out front.
function Person({ at }: { at: [number, number, number] }) {
  return (
    <group position={at} scale={1.3}>
      {[-0.045, 0.045].map((x) => <mesh key={x} position={[x, 0.12, 0]}><boxGeometry args={[0.055, 0.24, 0.055]} /><meshStandardMaterial color="#263238" /></mesh>)}
      <mesh position={[0, 0.32, 0]}><capsuleGeometry args={[0.085, 0.16, 3, 8]} /><meshStandardMaterial color="#ff2bd6" /></mesh>
      <mesh position={[0, 0.53, 0]}><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial color="#e0ac8a" /></mesh>
    </group>
  )
}

function App() {
  const root = useRef<Group>(null)
  const [W, D] = land ? LAND[land] : [def.w * TILE * scale[0], def.h * TILE * scale[2]]
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
        <meshStandardMaterial map={paverTex(W / TILE, D / TILE)} />
      </mesh>
      <Batch version={1} off={mark}>
        <group scale={scale} ref={root}>
          <MergeScale.Provider value={scale}>
            <KeepShapes limit={limitFor(def)}>
              {land === 'globe' ? <GlobeTower /> : land ? <VanguardTower /> : <BuildingModel def={def} level={level} />}
            </KeepShapes>
          </MergeScale.Provider>
        </group>
      </Batch>
      {mark && <Mark root={root} />}
      {pair > 1 && <Person at={[-W / 2 + 0.25, 0, D / 2 + 0.25]} />}
    </Canvas>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
