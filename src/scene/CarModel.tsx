import type { Body } from '../game/data'

const SHAPES: Record<Body, { len: number; wid: number; body: number; cabin: [number, number, number]; cabinZ: number; lift: number }> = {
  compact: { len: 0.95, wid: 0.6, body: 0.28, cabin: [0.52, 0.26, 0.55], cabinZ: -0.05, lift: 0.1 },
  sedan: { len: 1.2, wid: 0.62, body: 0.26, cabin: [0.54, 0.24, 0.6], cabinZ: -0.05, lift: 0.1 },
  sports: { len: 1.2, wid: 0.64, body: 0.2, cabin: [0.5, 0.18, 0.5], cabinZ: -0.1, lift: 0.08 },
  muscle: { len: 1.3, wid: 0.66, body: 0.26, cabin: [0.54, 0.2, 0.5], cabinZ: -0.15, lift: 0.1 },
  truck: { len: 1.35, wid: 0.68, body: 0.32, cabin: [0.6, 0.3, 0.5], cabinZ: 0.2, lift: 0.16 },
  super: { len: 1.25, wid: 0.7, body: 0.17, cabin: [0.48, 0.15, 0.45], cabinZ: -0.05, lift: 0.07 },
}

// A chunky toy-style car. Faces +z.
export function CarModel({ body, color, highlight }: { body: Body; color: string; highlight?: boolean }) {
  const s = SHAPES[body]
  const wheelZ = s.len * 0.32
  const wheelX = s.wid / 2
  return (
    <group>
      <mesh position={[0, s.lift + s.body / 2, 0]} castShadow>
        <boxGeometry args={[s.wid, s.body, s.len]} />
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.35} emissive={highlight ? '#ffffff' : '#000000'} emissiveIntensity={highlight ? 0.25 : 0} />
      </mesh>
      <mesh position={[0, s.lift + s.body + s.cabin[1] / 2, s.cabinZ]} castShadow>
        <boxGeometry args={s.cabin} />
        <meshStandardMaterial color="#263238" metalness={0.6} roughness={0.15} />
      </mesh>
      {body === 'truck' && (
        <mesh position={[0, s.lift + s.body + 0.04, -s.len * 0.3]}>
          <boxGeometry args={[s.wid * 0.9, 0.08, s.len * 0.35]} />
          <meshStandardMaterial color="#3e2723" />
        </mesh>
      )}
      {(body === 'sports' || body === 'super') && (
        <mesh position={[0, s.lift + s.body + 0.1, -s.len / 2 + 0.06]}>
          <boxGeometry args={[s.wid * 0.95, 0.04, 0.12]} />
          <meshStandardMaterial color="#212121" />
        </mesh>
      )}
      {[[-wheelX, wheelZ], [wheelX, wheelZ], [-wheelX, -wheelZ], [wheelX, -wheelZ]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.11, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.11, 0.11, 0.1, 12]} />
          <meshStandardMaterial color="#212121" />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * s.wid * 0.3, s.lift + s.body * 0.6, s.len / 2 + 0.001]}>
          <planeGeometry args={[0.12, 0.07]} />
          <meshBasicMaterial color="#fff9c4" />
        </mesh>
      ))}
    </group>
  )
}
