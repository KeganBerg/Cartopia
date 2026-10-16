// Renders the Menu > Town option pictures from the real game models (see shoot.mjs).
// ?what=theme&theme=<id|own>  three buildings in daylight, tinted with a town colour theme
// ?what=lamp&post=<cobra|lantern|globe|auto>&tone=<id>  a lamp post at night in one light colour
import { createRoot } from 'react-dom/client'
import { useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, NeutralToneMapping, type OrthographicCamera } from 'three'
import { BuildingModel } from '../../src/scene/BuildingModel'
import { SkyEnv } from '../../src/scene/SkyEnv'
import { Grounded } from '../../src/scene/ServiceVehicles'
import { applyNight, setLampTone } from '../../src/scene/dayNight'
import { LampPost } from '../../src/scene/LampPosts'
import { Tint } from '../../src/scene/CityTint'
import { asphaltTex, awningTex, brickTex, glowTex, paverTex } from '../../src/scene/textures'
import { CarModel } from '../../src/scene/CarModel'
import { PropMesh } from '../../src/scene/propKit'
import { hydrant } from '../../src/scene/streetProps'
import { DECOR_PROPS } from '../../src/scene/decorProps'
import { LAYER } from '../../src/scene/layers'
import { lookFor } from '../../src/scene/look'
import { CARS, TILE, buildingDef } from '../../src/game/data'
import { colorTheme, lightTone } from '../../src/game/cityLook'

const q = new URLSearchParams(location.search)
const what = q.get('what') ?? 'theme'
const night = what === 'lamp'
const look = lookFor(night ? 1 : 0, 0)
applyNight(night ? 1 : 0)
setLampTone(lightTone({ tone: q.get('tone') ?? 'warm' }).c)

function Frame({ width, y, pitch, x = 0 }: { width: number; y: number; pitch: number; x?: number }) {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    const c = camera as OrthographicCamera
    const p = (pitch * Math.PI) / 180
    const yaw = -0.5
    c.position.set(x + Math.sin(yaw) * Math.cos(p) * 60, y + Math.sin(p) * 60, Math.cos(yaw) * Math.cos(p) * 60)
    c.lookAt(x, y, 0)
    c.zoom = size.width / width
    c.updateProjectionMatrix()
  }, [camera, size, width, y, pitch, x])
  return null
}

// The paving everything stands on.
function Ground({ w, d }: { w: number; d: number }) {
  return (
    <mesh position={[0, LAYER.lot - 0.004 - 0.06, 0]}>
      <boxGeometry args={[w, 0.12, d]} />
      <meshStandardMaterial map={paverTex(w / 2, d / 2)} />
    </mesh>
  )
}

const ROW = ['house', 'pizza', 'coffee']
function Theme() {
  const id = q.get('theme')
  // Buildings merge their parts after the first commit; tint again once they have.
  const [, setTick] = useState(0)
  const frames = useRef(0)
  useFrame(({ scene }) => {
    if (++frames.current === 10 || frames.current === 20) setTick(frames.current)
  })
  let x = 0
  const items = ROW.map((id) => {
    const def = buildingDef(id)
    const at = x + (def.w * TILE) / 2
    x += def.w * TILE + 0.1 * TILE
    return <group key={id} position={[at, 0, 0]}><Grounded.Provider value><BuildingModel def={def} level={2} /></Grounded.Provider></group>
  })
  return (
    <>
      <Tint theme={id === 'own' ? null : colorTheme(id)}>
        <group position={[-x / 2, 0, 0]}>{items}</group>
      </Tint>
      <Ground w={x + 0.4} d={TILE * 2.2} />
      <Frame width={x * 1.05} y={0.8} pitch={28} />
    </>
  )
}

// A street corner at night: pavement and kerb, a brick shopfront behind with a lit window, a
// bench and hydrant, a car parked at the kerb and the side street's zebra crossing. The lamp
// (both designs for Mixed) lights it all in the chosen colour, framed close so it reads on a phone.
// Where each design's bulb hangs, matching LampPost's heads.
const HEAD_AT: Record<'cobra' | 'lantern' | 'globe', [number, number, number]> = { cobra: [0, 1.66, -0.44], lantern: [0, 1.56, -0.4], globe: [0, 1.68, 0] }

function Lamp() {
  const post = q.get('post') ?? 'cobra'
  const designs = (post === 'auto' ? ['cobra', 'lantern'] : [post]) as ('cobra' | 'lantern' | 'globe')[]
  const tone = lightTone({ tone: q.get('tone') ?? 'warm' }).c
  const xs = designs.length > 1 ? [-0.75, 0.6] : [0.35]
  const car = CARS.find((c) => c.id === 'stallion')!
  const kerb = 0.06
  return (
    <>
      {designs.map((d, i) => (
        <group key={d} position={[xs[i], kerb, 0.1]} rotation-y={d === 'globe' ? 0 : Math.PI}>
          <LampPost design={d} pool={1.4} poolY={0.03} />
          {/* The bulb's glow and the light it throws on the corner. */}
          <sprite position={[HEAD_AT[d][0], HEAD_AT[d][1] - 0.06, HEAD_AT[d][2]]} scale={d === 'globe' ? 0.9 : 0.75} renderOrder={3}>
            <spriteMaterial map={glowTex()} color={tone} blending={AdditiveBlending} depthWrite={false} transparent opacity={0.9} toneMapped={false} />
          </sprite>
          <pointLight position={[HEAD_AT[d][0], HEAD_AT[d][1] - 0.15, HEAD_AT[d][2]]} color={tone} intensity={designs.length > 1 ? 4 : 5.5} distance={4.5} decay={1.6} />
        </group>
      ))}
      {/* Pavement up to the kerb, ending at the side street on the right. */}
      <mesh position={[-1.8, kerb / 2, -1.4]}>
        <boxGeometry args={[5.6, kerb, 3.4]} />
        <meshStandardMaterial map={paverTex(2.8, 1.7)} />
      </mesh>
      <mesh position={[-1.8, kerb / 2, 0.3]}>
        <boxGeometry args={[5.6, kerb + 0.004, 0.08]} />
        <meshStandardMaterial color="#9aa3ad" />
      </mesh>
      <mesh position={[0.98, kerb / 2, -1.4]}>
        <boxGeometry args={[0.08, kerb + 0.004, 3.4]} />
        <meshStandardMaterial color="#9aa3ad" />
      </mesh>
      {/* The roads: asphalt, a dashed centre line and a zebra crossing over the side street. */}
      <mesh position={[0, -0.01, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial map={asphaltTex()} color="#6c7282" />
      </mesh>
      {[-2.6, -1.6, -0.6, 0.4, 1.4, 2.4].map((x) => (
        <mesh key={x} position={[x, 0.002, 1.75]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.5, 0.06]} />
          <meshStandardMaterial color="#f2d36b" />
        </mesh>
      ))}
      {[-1.15, -0.85, -0.55, -0.25, 0.05].map((z) => (
        <mesh key={z} position={[1.75, 0.002, z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[1.1, 0.16]} />
          <meshStandardMaterial color="#e8ebef" />
        </mesh>
      ))}
      {/* A brick shopfront behind, its window still lit. */}
      <mesh position={[-1.8, 1.3, -1.25]}>
        <boxGeometry args={[5.6, 2.6, 0.2]} />
        <meshStandardMaterial map={brickTex(4, 2)} color="#8c7a74" />
      </mesh>
      <mesh position={[-1.1, 0.85, -1.14]}>
        <boxGeometry args={[1.3, 0.9, 0.04]} />
        <meshStandardMaterial color="#2b2f3a" />
      </mesh>
      <mesh position={[-1.1, 0.85, -1.115]}>
        <planeGeometry args={[1.16, 0.78]} />
        <meshBasicMaterial color="#ffcf8a" toneMapped={false} />
      </mesh>
      {/* Window bars, and the shelves inside in silhouette. */}
      {[-1.5, -1.1, -0.7].map((x) => (
        <mesh key={x} position={[x, 0.85, -1.1]}>
          <boxGeometry args={[0.04, 0.8, 0.02]} />
          <meshStandardMaterial color="#2b2f3a" />
        </mesh>
      ))}
      <mesh position={[-1.1, 1.0, -1.1]}>
        <boxGeometry args={[1.2, 0.04, 0.02]} />
        <meshStandardMaterial color="#2b2f3a" />
      </mesh>
      {[0.62, 0.8].map((y) => (
        <mesh key={y} position={[-1.1, y, -1.112]}>
          <planeGeometry args={[1.1, 0.05]} />
          <meshBasicMaterial color="#c98a4a" toneMapped={false} />
        </mesh>
      ))}
      {/* Across the side street, the next block: a darker front with two lit windows upstairs. */}
      <mesh position={[4.4, kerb / 2, -1.4]}>
        <boxGeometry args={[3.6, kerb, 3.4]} />
        <meshStandardMaterial map={paverTex(1.8, 1.7)} />
      </mesh>
      <mesh position={[4.4, 1.6, -1.25]}>
        <boxGeometry args={[3.6, 3.2, 0.2]} />
        <meshStandardMaterial map={brickTex(2.6, 2.4)} color="#7a8094" />
      </mesh>
      {[3.2, 4.0].map((x) => (
        <mesh key={x} position={[x, 0.85, -1.14]}>
          <planeGeometry args={[0.5, 0.7]} />
          <meshBasicMaterial color="#ffd27a" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[-1.1, 1.38, -1.05]} rotation-x={0.5}>
        <boxGeometry args={[1.5, 0.03, 0.34]} />
        <meshStandardMaterial map={awningTex('#2f6f63')} />
      </mesh>
      <group position={[-0.6, kerb, -0.55]}>
        <PropMesh parts={DECOR_PROPS.bench('#a26a3d')} />
      </group>
      <group position={[0.7, kerb, -0.05]}>
        <PropMesh parts={hydrant()} />
      </group>
      <group position={[designs.length > 1 ? -1.6 : -1.05, 0, 0.85]} rotation-y={Math.PI / 2}>
        <CarModel body={car.body} model={car.id} color={car.colors[0]} />
      </group>
      <Frame width={designs.length > 1 ? 3.3 : 2.6} y={1.05} pitch={14} x={designs.length > 1 ? -0.1 : 0.2} />
    </>
  )
}

// After the scene settles, hands the frame to shoot.mjs as WebP.
function Export() {
  const n = useRef(0)
  const gl = useThree((t) => t.gl)
  useFrame(() => {
    if (++n.current !== 40) return
    ;(window as unknown as { __out: unknown }).__out = { data: gl.domElement.toDataURL('image/webp', 0.8) }
  })
  return null
}

createRoot(document.getElementById('root')!).render(
  <Canvas orthographic gl={{ toneMapping: NeutralToneMapping, preserveDrawingBuffer: true }} dpr={1} camera={{ near: 1, far: 200 }}>
    <color attach="background" args={[night ? '#10162b' : '#bfe3f7']} />
    <hemisphereLight args={[look.sky, look.ground, look.hemiIntensity * (night ? 0.5 : 1)]} />
    <directionalLight position={[-20, 40, 30]} intensity={look.sunIntensity * (night ? 0.3 : 1)} color={look.sun} />
    <SkyEnv />
    {what === 'lamp' ? <Lamp /> : <Theme />}
    <Export />
  </Canvas>,
)
