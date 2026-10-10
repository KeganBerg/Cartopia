import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { ringPath, toWorld } from './layout'

// Placeholder garage until owned cars come from Supabase.
const DEMO_CARS = [
  { id: 'a', color: '#d62828', speed: 2.2, offset: 0 },
  { id: 'b', color: '#1d3557', speed: 1.6, offset: 14 },
  { id: 'c', color: '#ffb703', speed: 2.8, offset: 27 },
]

function Car({ color, speed, offset }: { color: string; speed: number; offset: number }) {
  const ref = useRef<Group>(null)
  const progress = useRef(offset)

  useFrame((_, dt) => {
    const car = ref.current
    if (!car) return
    progress.current = (progress.current + dt * speed) % ringPath.length
    const i = Math.floor(progress.current)
    const t = progress.current - i
    const [ax, az] = toWorld(...ringPath[i])
    const [bx, bz] = toWorld(...ringPath[(i + 1) % ringPath.length])
    car.position.set(ax + (bx - ax) * t, 0.25, az + (bz - az) * t)
    car.rotation.y = Math.atan2(bx - ax, bz - az)
  })

  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.35, 1.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.3, -0.1]} castShadow>
        <boxGeometry args={[0.6, 0.25, 0.6]} />
        <meshStandardMaterial color="#e0f4ff" />
      </mesh>
    </group>
  )
}

export function Cars() {
  return (
    <>
      {DEMO_CARS.map((c) => (
        <Car key={c.id} {...c} />
      ))}
    </>
  )
}
