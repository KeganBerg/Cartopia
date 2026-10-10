import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'

// A few puffy clouds drifting high over the town. They never cast shadows or
// catch taps, and wrap around once they leave the map.
const SPAN = 70
const PUFFS = [
  [0, 0, 0, 1.6], [1.5, -0.2, 0.3, 1.2], [-1.4, -0.3, -0.2, 1.1], [0.6, 0.5, -0.6, 1.0], [-0.5, 0.4, 0.7, 0.9],
] as const

export function Clouds() {
  const clouds = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({
      x: -SPAN / 2 + (i * SPAN) / 6 + (i % 2) * 4,
      z: ((i * 37) % 50) - 25,
      y: 18 + (i % 3) * 2,
      s: 0.5 + ((i * 13) % 5) / 12,
      v: 0.5 + (i % 3) * 0.25,
    })),
    [],
  )
  const refs = useRef<(Group | null)[]>([])
  useFrame((_, dt) => {
    refs.current.forEach((g, i) => {
      if (!g) return
      g.position.x += clouds[i].v * Math.min(dt, 0.1)
      if (g.position.x > SPAN / 2) g.position.x -= SPAN
    })
  })
  return (
    <>
      {clouds.map((c, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }} position={[c.x, c.y, c.z]} scale={c.s}>
          {PUFFS.map(([x, y, z, r], k) => (
            <mesh key={k} position={[x, y, z]} raycast={() => null}>
              <icosahedronGeometry args={[r, 1]} />
              <meshLambertMaterial color="#ffffff" emissive="#dfefff" emissiveIntensity={0.35} transparent opacity={0.6} depthWrite={false} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}
