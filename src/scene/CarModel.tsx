import { useMemo } from 'react'
import { Color, DoubleSide } from 'three'
import { RoundedBox } from '@react-three/drei'
import { rimTex } from './textures'
import { glowMats } from './dayNight'
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
  round?: boolean // domed cabin and soft body, like a bubble car
  open?: boolean // no roof: windshield and seats only
  rollbar?: boolean
  fins?: boolean // fifties tail fins
  wood?: boolean // wood side panels
  wing?: boolean // tall rally wing
}

const SHAPES: Record<Body, Shape> = {
  compact: { len: 0.95, wid: 0.64, body: 0.27, lift: 0.1, cabinLen: 0.58, cabinH: 0.28, cabinZ: -0.06, taper: 0.72, hood: 0, wheel: 0.15 },
  sedan: { len: 1.22, wid: 0.66, body: 0.24, lift: 0.1, cabinLen: 0.62, cabinH: 0.25, cabinZ: -0.06, taper: 0.74, hood: 0, wheel: 0.15 },
  sports: { len: 1.22, wid: 0.7, body: 0.19, lift: 0.08, cabinLen: 0.52, cabinH: 0.18, cabinZ: -0.12, taper: 0.64, hood: 0.03, wheel: 0.15, spoiler: true },
  muscle: { len: 1.32, wid: 0.7, body: 0.25, lift: 0.1, cabinLen: 0.52, cabinH: 0.21, cabinZ: -0.16, taper: 0.76, hood: 0.05, wheel: 0.16, scoop: true },
  truck: { len: 1.38, wid: 0.74, body: 0.32, lift: 0.18, cabinLen: 0.5, cabinH: 0.31, cabinZ: 0.2, taper: 0.88, hood: 0, wheel: 0.2, bed: true },
  super: { len: 1.28, wid: 0.76, body: 0.16, lift: 0.07, cabinLen: 0.5, cabinH: 0.16, cabinZ: -0.04, taper: 0.56, hood: 0.02, wheel: 0.15, spoiler: true, scoop: true },
  bubble: { len: 0.98, wid: 0.66, body: 0.28, lift: 0.11, cabinLen: 0.6, cabinH: 0.22, cabinZ: -0.04, taper: 0.6, hood: 0, wheel: 0.15, round: true },
  wagon: { len: 1.36, wid: 0.68, body: 0.25, lift: 0.1, cabinLen: 0.9, cabinH: 0.25, cabinZ: -0.16, taper: 0.9, hood: 0, wheel: 0.15, wood: true },
  wedge: { len: 1.3, wid: 0.78, body: 0.14, lift: 0.07, cabinLen: 0.56, cabinH: 0.15, cabinZ: 0.02, taper: 0.42, hood: 0, wheel: 0.15, spoiler: true },
  roadster: { len: 1.08, wid: 0.66, body: 0.2, lift: 0.08, cabinLen: 0.42, cabinH: 0.16, cabinZ: -0.12, taper: 0.7, hood: 0.02, wheel: 0.14, open: true },
  rally: { len: 1.2, wid: 0.68, body: 0.24, lift: 0.11, cabinLen: 0.6, cabinH: 0.24, cabinZ: -0.06, taper: 0.74, hood: 0.02, wheel: 0.16, scoop: true, wing: true },
  classic: { len: 1.48, wid: 0.72, body: 0.25, lift: 0.1, cabinLen: 0.56, cabinH: 0.22, cabinZ: -0.08, taper: 0.8, hood: 0, wheel: 0.15, fins: true },
  offroad: { len: 0.96, wid: 0.7, body: 0.16, lift: 0.2, cabinLen: 0.4, cabinH: 0.2, cabinZ: -0.1, taper: 1, hood: 0, wheel: 0.21, open: true, rollbar: true },
  coupe: { len: 1.26, wid: 0.72, body: 0.21, lift: 0.08, cabinLen: 0.5, cabinH: 0.2, cabinZ: -0.16, taper: 0.62, hood: 0.03, wheel: 0.16 },
}

// Toy-style car built from primitives. Faces +z.
export function CarModel({ body, color, highlight, stripe, beams }: { body: Body; color: string; highlight?: boolean; stripe?: string | null; beams?: boolean }) {
  const s = SHAPES[body]
  const dark = useMemo(() => '#' + new Color(color).multiplyScalar(0.6).getHexString(), [color])
  const top = s.lift + s.body
  const wz = s.len * 0.33
  const wx = s.wid / 2 - 0.02
  const paint = <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} emissive={highlight ? '#ffffff' : '#000000'} emissiveIntensity={highlight ? 0.25 : 0} />
  return (
    <group>
      {/* Lower body with slightly darker skirt. */}
      <RoundedBox args={[s.wid, s.body * 0.95, s.len]} radius={s.round ? s.body * 0.48 : Math.min(0.07, s.body * 0.4)} smoothness={2} position={[0, s.lift + s.body * 0.53, 0]} castShadow>
        {paint}
      </RoundedBox>
      <mesh position={[0, s.lift + 0.03, 0]}>
        <boxGeometry args={[s.wid * 1.02, 0.06, s.len * 0.98]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      {s.round ? (
        <group position={[0, top - 0.02, s.cabinZ]} scale={[s.wid * 0.46, s.cabinH * 1.25, s.cabinLen * 0.58]}>
          {/* Domed cabin: glass all round under a painted roof cap. */}
          <mesh castShadow>
            <sphereGeometry args={[1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#3f6f94" metalness={0.6} roughness={0.08} />
          </mesh>
          <mesh scale={1.02}>
            <sphereGeometry args={[1, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.36]} />
            {paint}
          </mesh>
        </group>
      ) : s.open ? (
        <group position={[0, top, s.cabinZ]}>
          {/* Open top: raked windshield, two seats and an optional roll bar. */}
          <mesh position={[0, s.cabinH * 0.45, s.cabinLen * 0.5]} rotation-x={-0.5}>
            <boxGeometry args={[s.wid * 0.86, s.cabinH * 0.9, 0.02]} />
            <meshStandardMaterial color="#9fd3f2" transparent opacity={0.6} metalness={0.4} roughness={0.05} />
          </mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * s.wid * 0.2, 0.08, 0]}>
              <boxGeometry args={[s.wid * 0.28, 0.16, 0.16]} />
              <meshStandardMaterial color="#3e2723" />
            </mesh>
          ))}
          {s.rollbar && (
            <mesh position={[0, 0.1, -0.12]}>
              <torusGeometry args={[s.wid * 0.3, 0.025, 6, 16, Math.PI]} />
              <meshStandardMaterial color="#cfd8dc" metalness={0.7} roughness={0.25} />
            </mesh>
          )}
        </group>
      ) : (
        <>
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
              <meshStandardMaterial color="#3f6f94" metalness={0.6} roughness={0.08} />
            </mesh>
          </group>
        </>
      )}
      {s.wood && [-1, 1].map((sd) => (
        <mesh key={`w${sd}`} position={[sd * (s.wid / 2 + 0.004), s.lift + s.body * 0.55, -0.05]} rotation-y={sd * Math.PI / 2}>
          <planeGeometry args={[s.len * 0.8, s.body * 0.55]} />
          <meshStandardMaterial color="#8d5a3b" roughness={0.8} />
        </mesh>
      ))}
      {s.fins && [-1, 1].map((sd) => (
        <mesh key={`f${sd}`} position={[sd * s.wid * 0.42, top + 0.04, -s.len * 0.38]} rotation-x={-0.25} castShadow>
          <boxGeometry args={[0.05, 0.1, s.len * 0.26]} />
          {paint}
        </mesh>
      ))}
      {s.wing && (
        <group position={[0, top, -s.len / 2 + 0.08]}>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * s.wid * 0.3, 0.1, 0]}>
              <boxGeometry args={[0.03, 0.2, 0.04]} />
              <meshStandardMaterial color="#212121" />
            </mesh>
          ))}
          <mesh position={[0, 0.21, 0]}>
            <boxGeometry args={[s.wid * 0.9, 0.03, 0.15]} />
            {paint}
          </mesh>
        </group>
      )}
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
      {stripe && (
        <>
          {[-0.07, 0.07].map((x) => (
            <mesh key={x} position={[x, top + 0.003, 0]}>
              <boxGeometry args={[0.07, 0.006, s.len * 0.99]} />
              <meshStandardMaterial color={stripe} />
            </mesh>
          ))}
          {!s.open && !s.round && [-0.07, 0.07].map((x) => (
            <mesh key={`r${x}`} position={[x, top + s.cabinH + 0.003, s.cabinZ]}>
              <boxGeometry args={[0.07, 0.006, s.cabinLen * s.taper * 0.95]} />
              <meshStandardMaterial color={stripe} />
            </mesh>
          ))}
        </>
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
      {/* Headlight beams on the road, visible after dark. */}
      {beams && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, s.len / 2 + 0.55]} renderOrder={2}>
          <planeGeometry args={[s.wid * 1.5, 1.3]} />
          <primitive object={glowMats.beam} attach="material" dispose={null} />
        </mesh>
      )}
      {/* Chunky toy wheels with spoked rims. */}
      {[[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]].map(([x, z], i) => (
        <group key={i} position={[x, s.wheel, z]}>
          <mesh rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[s.wheel, s.wheel, 0.14, 16]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          <mesh position={[x > 0 ? 0.071 : -0.071, 0, 0]} rotation-y={x > 0 ? Math.PI / 2 : -Math.PI / 2}>
            <circleGeometry args={[s.wheel * 0.92, 16]} />
            <meshStandardMaterial map={rimTex()} metalness={0.5} roughness={0.3} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
