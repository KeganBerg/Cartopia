import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { BUILDINGS, TILE } from './game/data'
import { BuildingModel } from './scene/BuildingModel'
import { KeepShapes, MergeScale } from './scene/mergeScale'
import { propLimit } from './scene/keepShape'

const q = new URLSearchParams(location.search)
const def = BUILDINGS.find((d) => d.id === q.get('id'))!
const lvl = Number(q.get('level') ?? 4)
const fix = q.get('fix') !== '0'
const scale: [number, number, number] = q.get('single') ? [1, 1, 1] : q.get('dir') === 'z' ? [1, 1, 2] : [2, 1, 1]
const W = def.w * TILE * 2, D = def.h * TILE
document.getElementById('t')!.textContent = `${def.name} · pair · L${lvl}${fix ? '' : ' · OLD'}`
const zoom = Math.min(innerWidth / (Math.hypot(W, D) * 1.08), innerHeight / (Math.hypot(W, D) * 0.62 + 4 + lvl * 0.9))

function Pair() {
  const model = <BuildingModel def={def} level={lvl} />
  return (
    <group scale={scale}>
      <MergeScale.Provider value={fix ? scale : [1, 1, 1]}>
        {fix ? <KeepShapes limit={propLimit(def.w * TILE, def.h * TILE)}>{model}</KeepShapes> : model}
      </MergeScale.Provider>
    </group>
  )
}

createRoot(document.getElementById('root')!).render(
  <Canvas orthographic shadows camera={{ position: [40, 45.5 + lvl * 0.25, 40], zoom, near: 1, far: 200 }} gl={{ toneMapping: NeutralToneMapping, preserveDrawingBuffer: true }} dpr={2}>
    <hemisphereLight args={['#ffffff', '#6d8f4e', 1.4]} />
    <directionalLight position={[8, 14, 5]} intensity={2.2} castShadow />
    <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow><planeGeometry args={[60, 60]} /><meshStandardMaterial color="#8fbf6a" /></mesh>
    <Pair />
  </Canvas>,
)
