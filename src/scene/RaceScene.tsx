import { useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, type Group, type Mesh } from 'three'
import type { Body } from '../game/data'
import { CarModel } from './CarModel'
import { signTexture } from './signTexture'
import { skyTex } from './textures'

export type RacerView = { dist: number }
const SCALE = 0.25 // metres of race distance per world unit
const LANE = 0.75

type Props = {
  track: number
  me: RefObject<RacerView>
  them: RefObject<RacerView>
  mine: { body: Body; color: string }
  theirs: { body: Body; color: string }
}

function SkyDome() {
  const ref = useRef<Mesh>(null)
  useFrame(({ camera }) => ref.current?.position.set(camera.position.x, 0, camera.position.z))
  return (
    <mesh ref={ref} raycast={() => null}>
      <sphereGeometry args={[90, 24, 8, 0, Math.PI * 2, 0.9, Math.PI / 2 - 0.75]} />
      <meshBasicMaterial map={skyTex(4)} side={BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}

// Drag strip seen from a chase camera behind the player's car.
export function RaceScene({ track, me, them, mine, theirs }: Props) {
  const meRef = useRef<Group>(null)
  const themRef = useRef<Group>(null)
  const { camera } = useThree()
  const len = track * SCALE

  useFrame(() => {
    const mz = (me.current?.dist ?? 0) * SCALE
    const tz = (them.current?.dist ?? 0) * SCALE
    meRef.current?.position.set(LANE, 0, mz)
    themRef.current?.position.set(-LANE, 0, tz)
    const lead = Math.max(mz, tz)
    const target = Math.min(mz, len)
    camera.position.lerp({ x: LANE * 0.5, y: 2.2, z: target - 4.2 } as never, 0.15)
    camera.lookAt(LANE * 0.3, 0.3, Math.min(target + 3 + (lead - target) * 0.3, len + 4))
  })

  return (
    <>
      <fog attach="fog" args={['#d9f2ff', 25, 70]} />
      <color attach="background" args={['#3d9bff']} />
      {/* Sky band around the horizon; the background colour fills above it. */}
      <SkyDome />
      <hemisphereLight args={['#ffffff', '#6b8e4e', 0.8]} />
      <directionalLight position={[5, 10, 2]} intensity={1.5} castShadow />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, len / 2]} receiveShadow>
        <planeGeometry args={[80, len + 80]} />
        <meshStandardMaterial color="#6ab04c" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, len / 2 + 5]} receiveShadow>
        <planeGeometry args={[3.2, len + 20]} />
        <meshStandardMaterial color="#4a4f55" />
      </mesh>
      {/* Centre line dashes and edge lines. */}
      {Array.from({ length: Math.ceil((len + 20) / 2) }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 0.005, i * 2 - 5]}>
          <planeGeometry args={[0.06, 1]} />
          <meshBasicMaterial color="#fafafa" />
        </mesh>
      ))}
      {[-1.55, 1.55].map((x) => (
        <mesh key={x} rotation-x={-Math.PI / 2} position={[x, 0.005, len / 2 + 5]}>
          <planeGeometry args={[0.08, len + 20]} />
          <meshBasicMaterial color="#ffd54f" />
        </mesh>
      ))}
      {/* Start and finish lines. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -0.6]}>
        <planeGeometry args={[3.2, 0.15]} />
        <meshBasicMaterial color="#fafafa" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, len]}>
        <planeGeometry args={[3.2, 0.5]} />
        <meshBasicMaterial map={signTexture('▚▚▚▚▚▚▚▚', '#ffffff', '#111111')} />
      </mesh>
      <group position={[0, 0, len]}>
        {[-1.9, 1.9].map((x) => (
          <mesh key={x} position={[x, 1.2, 0]}>
            <boxGeometry args={[0.15, 2.4, 0.15]} />
            <meshStandardMaterial color="#eceff1" />
          </mesh>
        ))}
        <mesh position={[0, 2.4, 0]} rotation-y={Math.PI}>
          <planeGeometry args={[3.9, 0.7]} />
          <meshBasicMaterial map={signTexture('FINISH', '#c62828', '#ffffff')} toneMapped={false} />
        </mesh>
      </group>
      {/* Grandstands and trees for a sense of speed. */}
      {Array.from({ length: Math.ceil(len / 6) + 4 }, (_, i) => (
        <group key={i}>
          <mesh position={[i % 3 === 0 ? -4 : 4.2, 0.6, i * 6]} castShadow>
            <sphereGeometry args={[0.7, 8, 6]} />
            <meshStandardMaterial color="#2e7d32" />
          </mesh>
          {i % 4 === 1 && (
            <mesh position={[-3.2, 0.5, i * 6]}>
              <boxGeometry args={[1.6, 1, 4]} />
              <meshStandardMaterial color={i % 8 === 1 ? '#1e88e5' : '#e53935'} />
            </mesh>
          )}
        </group>
      ))}
      <group ref={meRef} scale={1.4}>
        <CarModel body={mine.body} color={mine.color} />
      </group>
      <group ref={themRef} scale={1.4}>
        <CarModel body={theirs.body} color={theirs.color} />
      </group>
    </>
  )
}
