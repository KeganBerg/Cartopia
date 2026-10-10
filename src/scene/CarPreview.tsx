import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { Body } from '../game/data'
import { CarModel } from './CarModel'

function Spinner(props: { body: Body; color: string; stripe?: string | null }) {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.6
  })
  return (
    <group ref={ref} scale={2.2}>
      <CarModel {...props} />
    </group>
  )
}

// Turntable view of a car, used in the garage.
export function CarPreview(props: { body: Body; color: string; stripe?: string | null }) {
  return (
    <div className="car-preview">
      <Canvas camera={{ position: [2.6, 1.8, 2.6], fov: 35 }} dpr={[1, 1.5]} onCreated={({ camera }) => camera.lookAt(0, 0.35, 0)}>
        <hemisphereLight args={['#ffffff', '#90a4ae', 1]} />
        <directionalLight position={[3, 5, 2]} intensity={1.4} />
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.8, 40]} />
          <meshStandardMaterial color="#cfd8dc" />
        </mesh>
        <Spinner {...props} />
      </Canvas>
    </div>
  )
}
