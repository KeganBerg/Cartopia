import { useLayoutEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Box3, Sphere, type Group } from 'three'
import type { Body } from '../game/data'
import { CarModel } from './CarModel'

// How big the car's bounding sphere appears; the camera below fits this with room to spare.
const FIT = 1.05

function Spinner(props: { body: Body; color: string; stripe?: string | null }) {
  const ref = useRef<Group>(null)
  const inner = useRef<Group>(null)
  // Scale every body to the same size on screen, so long trucks and tiny bubble cars both fit whole.
  useLayoutEffect(() => {
    const g = inner.current
    if (!g) return
    g.scale.setScalar(1)
    g.position.set(0, 0, 0)
    const sphere = new Box3().setFromObject(g).getBoundingSphere(new Sphere())
    const k = FIT / sphere.radius
    g.scale.setScalar(k)
    g.position.set(-sphere.center.x * k, 0, -sphere.center.z * k)
  }, [props.body])
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.6
  })
  return (
    <group ref={ref}>
      <group ref={inner}>
        <CarModel {...props} />
      </group>
    </group>
  )
}

// Turntable view of a car, used in the garage and when a restored car rolls out.
export function CarPreview(props: { body: Body; color: string; stripe?: string | null }) {
  return (
    <div className="car-preview">
      <Canvas camera={{ position: [2.7, 1.9, 2.7], fov: 35 }} dpr={[1, 1.5]} onCreated={({ camera }) => camera.lookAt(0, 0.42, 0)}>
        <hemisphereLight args={['#ffffff', '#90a4ae', 1]} />
        <directionalLight position={[3, 5, 2]} intensity={1.4} />
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.5, 40]} />
          <meshStandardMaterial color="#cfd8dc" />
        </mesh>
        <Spinner {...props} />
      </Canvas>
    </div>
  )
}
