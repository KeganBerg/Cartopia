// Dev only: Rusty's Rescue town model at four levels, for before/after shots.
// http://localhost:5173/scripts/rescue/yard.html?night=1
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { BuildingModel } from '../../src/scene/BuildingModel'
import { buildingDef } from '../../src/game/data'
import { asphaltTex } from '../../src/scene/textures'

const night = new URLSearchParams(location.search).get('night') === '1'
const LV = [1, 4, 7, 10]

function Scene() {
  return (
    <>
      <color attach="background" args={[night ? '#1d2740' : '#cfe8f5']} />
      <hemisphereLight args={[night ? '#4a5a8a' : '#ffffff', '#5b6b3a', night ? 0.5 : 1.3]} />
      <directionalLight position={[5, 9, 6]} intensity={night ? 0.3 : 2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#7cb342" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 1.55]} receiveShadow>
        <planeGeometry args={[40, 1.1]} />
        <meshStandardMaterial map={asphaltTex(20, 1)} />
      </mesh>
      {LV.map((l, i) => (
        <group key={l} position={[(i % 2 ? 2.4 : -2.4), 0, i < 2 ? -1.6 : 2.9]}>
          <BuildingModel def={buildingDef('rescue')} level={l} />
        </group>
      ))}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <Canvas shadows camera={{ position: [0, 7.5, 9.5], fov: 42 }} gl={{ toneMapping: NeutralToneMapping }} onCreated={({ camera }) => camera.lookAt(0, 0, 0.6)}>
    <Scene />
  </Canvas>
)
