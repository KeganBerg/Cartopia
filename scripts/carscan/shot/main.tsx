// One car in the garage preview's light, for checking a restyled scan against the car it replaces.
// Dev only: `npm run dev`, then `node scripts/carscan/shot/shoot.mjs`.
// ?model=<car id>&color=%23rrggbb&view=34|side|front|rear|top&old=1 (old: the procedural body, no scan)
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { carDef } from '../../../src/game/data'
import { CarModel } from '../../../src/scene/CarModel'
import { SkyEnv } from '../../../src/scene/SkyEnv'
import { SCANS } from '../../../src/scene/scans'

const q = new URLSearchParams(location.search)
const model = q.get('model') ?? 'current'
if (q.get('old') === '1') delete SCANS[model]
const def = carDef(model)
const color = q.get('color') ?? def.colors[1] ?? def.colors[0]
const VIEWS: Record<string, [number, number, number]> = {
  '34': [2.1, 1.25, 2.1], side: [3.0, 0.45, 0], front: [0.4, 0.7, 3], rear: [-0.6, 0.9, -3], top: [1.2, 3.2, 1.4], low: [2.2, 0.35, 1.4],
}
const view = VIEWS[q.get('view') ?? '34']

createRoot(document.getElementById('root')!).render(
  <Canvas camera={{ position: view, fov: 28 }} onCreated={({ camera }) => camera.lookAt(0, 0.22, 0)}>
    <SkyEnv />
    <hemisphereLight args={['#ffffff', '#90a4ae', 1]} />
    <directionalLight position={[3, 5, 2]} intensity={1.4} />
    <mesh rotation-x={-Math.PI / 2}>
      <circleGeometry args={[3, 48]} />
      <meshStandardMaterial color="#cfd8dc" />
    </mesh>
    <CarModel body={def.body} model={model} color={color} finish="metallic" />
  </Canvas>,
)
