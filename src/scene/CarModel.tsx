import { useMemo } from 'react'
import { Color } from 'three'
import type { Body } from '../game/data'

type Shape = {
  len: number; wid: number
  body: number // lower body height
  lift: number // ground clearance
  cabinLen: number; cabinH: number; cabinZ: number
  taper: number // how much the cabin roof narrows (0 = box)
  hood: number // hood bulge height
  wheel: number
  spoiler?: boolean; bed?: boolean; scoop?: boolean
}

const SHAPES: Record<Body, Shape> = {
  compact: { len: 0.95, wid: 0.6, body: 0.24, lift: 0.1, cabinLen: 0.58, cabinH: 0.27, cabinZ: -0.06, taper: 0.7, hood: 0, wheel: 0.11 },
  sedan: { len: 1.22, wid: 0.62, body: 0.22, lift: 0.1, cabinLen: 0.62, cabinH: 0.24, cabinZ: -0.06, taper: 0.72, hood: 0, wheel: 0.11 },
  sports: { len: 1.22, wid: 0.66, body: 0.17, lift: 0.08, cabinLen: 0.5, cabinH: 0.17, cabinZ: -0.12, taper: 0.62, hood: 0.03, wheel: 0.11, spoiler: true },
  muscle: { len: 1.32, wid: 0.66, body: 0.23, lift: 0.1, cabinLen: 0.5, cabinH: 0.2, cabinZ: -0.16, taper: 0.75, hood: 0.05, wheel: 0.12, scoop: true },
  truck: { len: 1.38, wid: 0.7, body: 0.3, lift: 0.17, cabinLen: 0.48, cabinH: 0.3, cabinZ: 0.2, taper: 0.88, hood: 0, wheel: 0.15, bed: true },
  super: { len: 1.28, wid: 0.72, body: 0.14, lift: 0.07, cabinLen: 0.48, cabinH: 0.15, cabinZ: -0.04, taper: 0.55, hood: 0.02, wheel: 0.11, spoiler: true, scoop: true },
}

// Toy-style car built from primitives. Faces +z.
export function CarModel({ body, color, highlight }: { body: Body; color: string; highlight?: boolean }) {
  const s = SHAPES[body]
  const dark = useMemo(() => '#' + new Color(color).multiplyScalar(0.6).getHexString(), [color])
  const top = s.lift + s.body
  const wz = s.len * 0.33
  const wx = s.wid / 2 - 0.02
  const paint = <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} emissive={highlight ? '#ffffff' : '#000000'} emissiveIntensity={highlight ? 0.25 : 0} />
  return (
    <group>
      {/* Lower body with slightly darker skirt. */}
      <mesh position={[0, s.lift + s.body * 0.55, 0]} castShadow>
        <boxGeometry args={[s.wid, s.body * 0.9, s.len]} />
        {paint}
      </mesh>
      <mesh position={[0, s.lift + 0.03, 0]}>
        <boxGeometry args={[s.wid * 1.02, 0.06, s.len * 0.98]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      {/* Tapered cabin: a 4-sided frustum rotated so its faces line up with the car. */}
      <group position={[0, top + s.cabinH / 2, s.cabinZ]} scale={[s.wid * 0.62, 1, s.cabinLen * 0.71]}>
        <mesh rotation-y={Math.PI / 4} castShadow>
          <cylinderGeometry args={[s.taper, 1, s.cabinH, 4, 1]} />
          {paint}
        </mesh>
      </group>
      {/* Glass band around the cabin. */}
      <group position={[0, top + s.cabinH * 0.5, s.cabinZ]} scale={[s.wid * 0.63, 1, s.cabinLen * 0.72]}>
        <mesh rotation-y={Math.PI / 4}>
          <cylinderGeometry args={[s.taper + (1 - s.taper) * 0.25, 1 - (1 - s.taper) * 0.25, s.cabinH * 0.5, 4, 1]} />
          <meshStandardMaterial color="#1c2833" metalness={0.8} roughness={0.1} />
        </mesh>
      </group>
      {s.hood > 0 && (
        <mesh position={[0, top + s.hood / 2, s.len * 0.28]}>
          <boxGeometry args={[s.wid * 0.5, s.hood, s.len * 0.3]} />
          {paint}
        </mesh>
      )}
      {s.scoop && (
        <mesh position={[0, top + s.hood + 0.03, s.len * 0.25]}>
          <boxGeometry args={[0.16, 0.06, 0.16]} />
          <meshStandardMaterial color="#212121" />
        </mesh>
      )}
      {s.bed && (
        <mesh position={[0, top + 0.01, -s.len * 0.27]}>
          <boxGeometry args={[s.wid * 0.84, 0.03, s.len * 0.4]} />
          <meshStandardMaterial color="#2b2b2b" />
        </mesh>
      )}
      {s.spoiler && (
        <group position={[0, top, -s.len / 2 + 0.07]}>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * s.wid * 0.32, 0.06, 0]}>
              <boxGeometry args={[0.03, 0.12, 0.04]} />
              <meshStandardMaterial color="#212121" />
            </mesh>
          ))}
          <mesh position={[0, 0.13, 0]}>
            <boxGeometry args={[s.wid * 0.95, 0.03, 0.14]} />
            <meshStandardMaterial color={body === 'super' ? '#212121' : color} />
          </mesh>
        </group>
      )}
      {/* Bumpers. */}
      {[1, -1].map((sd) => (
        <mesh key={sd} position={[0, s.lift + 0.07, sd * (s.len / 2 + 0.015)]}>
          <boxGeometry args={[s.wid * 0.98, 0.07, 0.04]} />
          <meshStandardMaterial color="#cfd8dc" metalness={0.7} roughness={0.25} />
        </mesh>
      ))}
      {/* Lights. */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh position={[sd * s.wid * 0.32, s.lift + s.body * 0.6, s.len / 2 + 0.002]}>
            <planeGeometry args={[0.13, 0.07]} />
            <meshBasicMaterial color="#fffde7" />
          </mesh>
          <mesh position={[sd * s.wid * 0.32, s.lift + s.body * 0.6, -s.len / 2 - 0.002]} rotation-y={Math.PI}>
            <planeGeometry args={[0.13, 0.06]} />
            <meshBasicMaterial color="#ff1744" />
          </mesh>
        </group>
      ))}
      {/* Wheels with hubcaps. */}
      {[[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]].map(([x, z], i) => (
        <group key={i} position={[x, s.wheel, z]} rotation-z={Math.PI / 2}>
          <mesh castShadow>
            <cylinderGeometry args={[s.wheel, s.wheel, 0.1, 14]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          <mesh position={[0, x > 0 ? 0.051 : -0.051, 0]}>
            <cylinderGeometry args={[s.wheel * 0.55, s.wheel * 0.55, 0.01, 10]} />
            <meshStandardMaterial color="#eceff1" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
