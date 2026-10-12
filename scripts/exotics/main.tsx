// Side-by-side studio renders of cars in the garage preview's light, for judging a new
// car against the ones already in the game. Dev only: `npm run dev`, then shoot.mjs.
// ?models=lambo,fulmine&view=34|side|front|rear|top|low&cols=2&color=%23rrggbb&lean=1
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { carDef } from '../../src/game/data'
import { CarModel, type WheelRig } from '../../src/scene/CarModel'
import { SkyEnv } from '../../src/scene/SkyEnv'

const q = new URLSearchParams(location.search)
const models = (q.get('models') ?? 'lambo').split(',')
const cols = +(q.get('cols') ?? models.length)

const VIEWS: Record<string, [number, number, number]> = {
  '34': [2.1, 1.25, 2.1], c34: [1.3, 0.75, 1.5], cr34: [-1.3, 0.8, -1.5], side: [3.0, 0.45, 0], front: [0.4, 0.7, 3], rear: [-0.6, 0.9, -3], top: [1.2, 3.2, 1.4], low: [2.2, 0.35, 1.4], r34: [-2.1, 1.1, -2.1],
}
const views = (q.get('view') ?? '34').split(',')
const colors = q.get('colors')?.split(',')
const root = document.getElementById('root')!
root.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

function Cell({ id, view, i }: { id: string; view: [number, number, number]; i: number }) {
  const def = carDef(id)
  const color = colors?.[i % colors.length] ?? q.get('color') ?? def.colors[0]
  const rig: WheelRig | undefined = q.get('lean') === '1' ? { steer: [], spin: [], radius: 0.15, base: 1 } : undefined
  return (
    <div className="cell">
      <Canvas camera={{ position: view, fov: 28 }} onCreated={({ camera }) => camera.lookAt(0, 0.2, 0)} gl={{ preserveDrawingBuffer: true }}>
        <SkyEnv />
        <hemisphereLight args={['#ffffff', '#90a4ae', 1]} />
        <directionalLight position={[3, 5, 2]} intensity={1.4} />
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[3, 48]} />
          <meshStandardMaterial color="#cfd8dc" />
        </mesh>
        <CarModel body={def.body} model={id} color={color} finish="gloss" lean={!!rig} rig={rig} />
      </Canvas>
      <span>{def.name}</span>
    </div>
  )
}

const cells = views.flatMap((v) => models.map((m) => [m, v] as const))
createRoot(root).render(<>{cells.map(([m, v], i) => <Cell key={i} id={m} view={VIEWS[v]} i={i} />)}</>)
