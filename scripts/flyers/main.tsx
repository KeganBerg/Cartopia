// Close-ups of the craft that fly over town (src/scene/FlyByModels.tsx).
// Dev only: `npm run dev`, then `node scripts/flyers/shoot.mjs`.
// ?kind=plane|heli|banner|blimp|rocket&night=0|1&yaw=deg&pitch=deg&look=n
import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { Airliner, BannerPlane, Blimp, NewsHeli, rocketGeo, flyMat } from '../../src/scene/FlyByModels'
import { applyNight } from '../../src/scene/dayNight'

const q = new URLSearchParams(location.search)
const kind = q.get('kind') ?? 'plane'
const night = q.get('night') === '1'
const yaw = (Number(q.get('yaw') ?? 35) * Math.PI) / 180
const pitch = (Number(q.get('pitch') ?? 25) * Math.PI) / 180
const look = { current: Number(q.get('look') ?? 0) }
applyNight(night ? 1 : 0)
const DIST: Record<string, number> = { plane: 4.2, heli: 3.6, banner: 5.2, blimp: 6.2, rocket: 4 }

function Cam() {
  const { camera } = useThree()
  useEffect(() => {
    const d = DIST[kind] ?? 4
    const cz = kind === 'banner' ? -0.8 : 0
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, cz + Math.cos(yaw) * Math.cos(pitch) * d)
    camera.lookAt(0, kind === 'heli' ? 0.4 : 0, cz)
  }, [camera])
  return null
}

function App() {
  return (
    <Canvas camera={{ fov: 40, near: 0.05, far: 200 }} gl={{ toneMapping: NeutralToneMapping, preserveDrawingBuffer: true }}>
      <color attach="background" args={[night ? '#141c2b' : '#9fc3e0']} />
      <ambientLight intensity={night ? 0.25 : 0.9} />
      <hemisphereLight args={['#dfefff', '#5d6b4a', night ? 0.2 : 0.7]} />
      <directionalLight position={[8, 14, 6]} intensity={night ? 0.2 : 2.4} />
      <Cam />
      {kind === 'plane' && <Airliner livery={look} />}
      {kind === 'heli' && <NewsHeli />}
      {kind === 'banner' && <BannerPlane message={look} />}
      {kind === 'blimp' && <Blimp />}
      {kind === 'rocket' && <mesh geometry={rocketGeo} material={flyMat} />}
    </Canvas>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
