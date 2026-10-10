import { Canvas } from '@react-three/fiber'
import { MapControls } from '@react-three/drei'
import { Town } from './game/Town'
import { Cars } from './game/Cars'
import { supabase } from './lib/supabase'

export default function App() {
  return (
    <>
      <Canvas shadows orthographic camera={{ position: [30, 30, 30], zoom: 28, near: 0.1, far: 500 }}>
        <color attach="background" args={['#9fd7f5']} />
        <ambientLight intensity={0.6} />
        <directionalLight castShadow position={[20, 40, 10]} intensity={1.2} shadow-mapSize={[2048, 2048]} />
        <Town />
        <Cars />
        <MapControls enableRotate={false} minZoom={10} maxZoom={80} />
      </Canvas>
      <div className="hud">
        Cartopia · drag to pan, scroll to zoom
        {!supabase && ' · offline (no Supabase env set)'}
      </div>
    </>
  )
}
