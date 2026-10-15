// Renders the Menu > Town option pictures from the real game models (see shoot.mjs).
// ?what=theme&theme=<id|own>  three buildings in daylight, tinted with a town colour theme
// ?what=lamp&post=<cobra|lantern|globe|auto>&tone=<id>  a lamp post at night in one light colour
import { createRoot } from 'react-dom/client'
import { useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { NeutralToneMapping, type OrthographicCamera } from 'three'
import { BuildingModel } from '../../src/scene/BuildingModel'
import { SkyEnv } from '../../src/scene/SkyEnv'
import { Grounded } from '../../src/scene/ServiceVehicles'
import { applyNight, setLampTone } from '../../src/scene/dayNight'
import { LampPost } from '../../src/scene/LampPosts'
import { Tint } from '../../src/scene/CityTint'
import { paverTex } from '../../src/scene/textures'
import { LAYER } from '../../src/scene/layers'
import { lookFor } from '../../src/scene/look'
import { TILE, buildingDef } from '../../src/game/data'
import { colorTheme, lightTone } from '../../src/game/cityLook'

const q = new URLSearchParams(location.search)
const what = q.get('what') ?? 'theme'
const night = what === 'lamp'
const look = lookFor(night ? 1 : 0, 0)
applyNight(night ? 1 : 0)
setLampTone(lightTone({ tone: q.get('tone') ?? 'warm' }).c)

function Frame({ width, y, pitch }: { width: number; y: number; pitch: number }) {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    const c = camera as OrthographicCamera
    const p = (pitch * Math.PI) / 180
    const yaw = -0.5
    c.position.set(Math.sin(yaw) * Math.cos(p) * 60, y + Math.sin(p) * 60, Math.cos(yaw) * Math.cos(p) * 60)
    c.lookAt(0, y, 0)
    c.zoom = size.width / width
    c.updateProjectionMatrix()
  }, [camera, size, width, y, pitch])
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

function Lamp() {
  const post = q.get('post') ?? 'cobra'
  const designs = (post === 'auto' ? ['cobra', 'lantern'] : [post]) as ('cobra' | 'lantern' | 'globe')[]
  return (
    <>
      {designs.map((d, i) => (
        <group key={d} position={[(i - (designs.length - 1) / 2) * 1.6, 0, 0]} rotation-y={d === 'globe' ? 0 : Math.PI}>
          <LampPost design={d} pool={1.25} />
        </group>
      ))}
      <mesh position={[0, LAYER.lot - 0.06, 0]}>
        <boxGeometry args={[5, 0.12, 3]} />
        <meshStandardMaterial color="#4a5675" />
      </mesh>
      <Frame width={designs.length > 1 ? 3.2 : 1.8} y={0.95} pitch={16} />
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
    <color attach="background" args={[night ? '#141a33' : '#bfe3f7']} />
    <hemisphereLight args={[look.sky, look.ground, look.hemiIntensity * (night ? 0.75 : 1)]} />
    <directionalLight position={[-20, 40, 30]} intensity={look.sunIntensity * (night ? 0.3 : 1)} color={look.sun} />
    <SkyEnv />
    {what === 'lamp' ? <Lamp /> : <Theme />}
    <Export />
  </Canvas>,
)
