// One car in a car skin (or every bolt-on part in a mod skin), for checking how skins sit on bodies and parts.
// Dev only: `npm run dev`, then open /scripts/skins/skins.html?body=truck&skin=riptide&mods=streetkit,gtwing,ramscoop&a=0.1
// modskin=<id> puts that mod skin on the spoiler, exhaust, kit and hood; lean=1 draws it the way town traffic is.
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { CarModel } from '../../src/scene/CarModel'
import type { Body } from '../../src/game/data'

const q = new URLSearchParams(location.search)
const body = (q.get('body') ?? 'sports') as Body
const model = q.get('model') || undefined
const mods = (q.get('mods') ?? '').split(',').filter(Boolean)
const color = q.get('color') ?? '#fdd835'
const a = Number(q.get('a') ?? 0.25) * Math.PI
const h = Number(q.get('h') ?? 0.9)
const d = Number(q.get('d') ?? 2.7)
const ms = q.get('modskin')
const lean = q.get('lean') === '1'

function App() {
  return (
    <Canvas camera={{ position: [Math.sin(a) * d, h, Math.cos(a) * d], fov: 34 }} gl={{ toneMapping: NeutralToneMapping }} onCreated={({ camera }) => camera.lookAt(0, 0.3, 0)}>
      <color attach="background" args={['#b9cbd6']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 6, 4]} intensity={2.2} />
      <hemisphereLight args={['#dfefff', '#557755', 0.6]} />
      <CarModel body={body} model={model} color={color} mods={mods} skin={q.get('skin')} lean={lean} rig={lean ? { steer: [], spin: [], radius: 0.15, base: 0 } : undefined}
        modSkin={ms ? { spoiler: ms, exhaust: ms, kit: ms, hood: ms } : undefined} />
    </Canvas>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
