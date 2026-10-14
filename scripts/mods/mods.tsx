// One car wearing the given mods, for preview shots of new parts.
// Dev only: `npm run dev`, then open /scripts/mods/mods.html?body=sports&mods=skydeck,titan&color=%23e53935&a=0.25
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { CarModel } from '../../src/scene/CarModel'
import type { Body } from '../../src/game/data'

const q = new URLSearchParams(location.search)
const body = (q.get('body') ?? 'sports') as Body
const mods = (q.get('mods') ?? '').split(',').filter(Boolean)
const color = q.get('color') ?? '#e53935'
const a = Number(q.get('a') ?? 0.25) * Math.PI
const h = Number(q.get('h') ?? 1)
const d = Number(q.get('d') ?? 2.6)

function App() {
  return (
    <Canvas shadows camera={{ position: [Math.sin(a) * d, h, Math.cos(a) * d], fov: 34 }} gl={{ toneMapping: NeutralToneMapping }} onCreated={({ camera }) => camera.lookAt(0, 0.22, 0)}>
      <color attach="background" args={[q.get('night') ? '#1b2333' : '#b9cbd6']} />
      <ambientLight intensity={q.get('night') ? 0.25 : 0.8} />
      <directionalLight position={[3, 6, 4]} intensity={q.get('night') ? 0.4 : 2.2} castShadow />
      <hemisphereLight args={['#dfefff', '#557755', 0.6]} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={q.get('night') ? '#2a2f38' : '#9aa3a8'} />
      </mesh>
      <CarModel body={body} color={color} mods={mods} />
    </Canvas>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
