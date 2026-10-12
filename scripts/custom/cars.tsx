// Close-ups of cars in custom panel paint, for checking the panels land on the right parts.
// Dev only: `npm run dev`, then open /scripts/custom/cars.html?side=0|1&lean=0|1
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { CarModel } from '../../src/scene/CarModel'
import type { Body, Finish, Panels } from '../../src/game/data'

const q = new URLSearchParams(location.search)
const side = Number(q.get('side') ?? 0)
// lean=1: drawn the way town traffic is (baked, wheels from a pool not shown here).
const lean = q.get('lean') === '1'
const ROWS: { body: Body; color: string; finish?: Finish; panels: Panels }[] = [
  { body: 'sports', color: '#43a047', panels: { body: { pattern: 'camo' }, hood: { color: '#212121' }, rims: { color: '#fdd835' } } },
  { body: 'muscle', color: '#1e88e5', panels: { hood: { color: '#fafafa', pattern: 'checker' }, roof: { color: '#212121' }, doors: { color: '#fafafa' }, rims: { color: '#e53935' } } },
  { body: 'sedan', color: '#fb8c00', panels: { body: { pattern: 'tiger' }, doors: { color: '#212121', pattern: 'carbon' } } },
  { body: 'suv', color: '#9e9e9e', panels: { body: { pattern: 'digicamo' }, roof: { color: '#fafafa' } } },
  { body: 'super', color: '#ec407a', finish: 'matte', panels: { body: { pattern: 'camo' } } },
  { body: 'truck', color: '#6d4c41', panels: { hood: { color: '#fdd835', pattern: 'tiger' }, doors: { color: '#212121' } } },
  { body: 'bubble', color: '#00acc1', panels: { roof: { color: '#fafafa' }, doors: { color: '#fafafa' } } },
  { body: 'chopper', color: '#8e24aa', panels: { body: { pattern: 'camo' }, rims: { color: '#fdd835' } } },
  { body: 'classic', color: '#e53935', panels: { roof: { color: '#fafafa' }, hood: { pattern: 'carbon' } } },
]

function App() {
  const a = side ? -Math.PI * 0.75 : Math.PI * 0.25
  return (
    <Canvas camera={{ position: [Math.sin(a) * 6.4, 4.6, Math.cos(a) * 6.4], fov: 42 }} gl={{ toneMapping: NeutralToneMapping }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 6, 4]} intensity={2.2} />
      <hemisphereLight args={['#dfefff', '#557755', 0.6]} />
      {ROWS.map((r, i) => (
        <group key={i} position={[((i % 3) - 1) * 1.9, 0, (Math.floor(i / 3) - 1) * 1.9]}>
          <CarModel body={r.body} color={r.color} finish={r.finish} panels={r.panels} lean={lean} rig={lean ? { steer: [], spin: [], radius: 0.15, base: 0 } : undefined} />
        </group>
      ))}
    </Canvas>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
