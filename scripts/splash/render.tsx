// Renders the loading screen's pictures from the real game models (see shoot.mjs).
// ?what=street&night=0|1  a row of Main Street buildings, side on, on a clear background
// ?what=car&model=<id>&mask=0|1  a car side on in white paint, or its paint mask
//   &yaw=<deg> turns it (the hero shot is three quarters on, from above)
import { createRoot } from 'react-dom/client'
import { useLayoutEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MeshBasicMaterial, NeutralToneMapping, type Group, type Mesh, type OrthographicCamera } from 'three'
import { BuildingModel } from '../../src/scene/BuildingModel'
import { CarModel } from '../../src/scene/CarModel'
import { SkyEnv } from '../../src/scene/SkyEnv'
import { Grounded } from '../../src/scene/ServiceVehicles'
import { applyNight } from '../../src/scene/dayNight'
import { paverTex } from '../../src/scene/textures'
import { LAYER } from '../../src/scene/layers'
import { lookFor } from '../../src/scene/look'
import { CARS, TILE, buildingDef, carDef } from '../../src/game/data'

const q = new URLSearchParams(location.search)
const what = q.get('what') ?? 'street'
const night = q.get('night') === '1'
const PITCH = (+(q.get('pitch') ?? 14) * Math.PI) / 180
const LOOK_Y = +(q.get('y') ?? 0)
const look = lookFor(night ? 1 : 0, 0)
applyNight(night ? 1 : 0)

// The street, left to right: building id and level. Props stand on the
// pavement in front, at a fraction of the way along the street.
const ROW = (q.get('row') ?? 'donut:2,rescue:3,diner:2,offices:5,pizza:2,burger:3,gas:3,coffee:2,carwash:2,cinema:3,market:2,police:2,firehouse:2,bowling:3')
  .split(',').map((s) => { const [id, l] = s.split(':'); return [id, +l] as [string, number] })
const PROPS = (q.get('props') ?? 'lamp,tree,lamp,busstop,tree,lamp,hotdog,tree,lamp,bench,tree,lamp,flowers,tree')
  .split(',')
const GAP = +(q.get('gap') ?? 0.15)
// Sidewalk depth in front of the lots; the props stand on it at TILE * 0.6.
const WALK = TILE * 0.85

function Frame({ width }: { width: number }) {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    const c = camera as OrthographicCamera
    const d = 60
    c.position.set(0, Math.sin(PITCH) * d, Math.cos(PITCH) * d)
    c.position.y += LOOK_Y
    c.lookAt(0, LOOK_Y, 0)
    c.zoom = size.width / width
    c.updateProjectionMatrix()
  }, [camera, size, width])
  return null
}

function Street() {
  let x = 0
  const ends: number[] = []
  const items = ROW.map(([id, level], i) => {
    const def = buildingDef(id)
    const w = def.w * TILE
    const at = x + w / 2
    x += w + GAP * TILE
    ends.push(x - (GAP * TILE) / 2)
    return <group key={i} position={[at, 0, -(def.h * TILE) / 2]}><Grounded.Provider value><BuildingModel def={def} level={level} /></Grounded.Provider></group>
  })
  // Nothing on the last seam, so the strip repeats without cutting a tree in half.
  const props = PROPS.slice(0, ends.length - 1).map((id, i) => (
    <group key={'p' + i} position={[ends[i % ends.length], 0, TILE * 0.6]}><Grounded.Provider value><BuildingModel def={buildingDef(id)} /></Grounded.Provider></group>
  ))
  // The ground everything stands on: paving from the back of the deepest lot to a
  // sidewalk out front with a kerb, so the lots, the gaps between them and the
  // props all sit on one surface and the strip's bottom edge is the kerb, which
  // lines up with the road the loaders draw under it. Without it each lot was a
  // slab hanging over clear background, and the buildings looked like they floated.
  const back = Math.max(...ROW.map(([id]) => buildingDef(id).h)) * TILE
  const front = WALK
  const depth = back + front
  return (
    <>
      <group position={[-x / 2, 0, 0]}>{items}{props}</group>
      <mesh position={[0, LAYER.lot - 0.004 - 0.06, (front - back) / 2]}>
        <boxGeometry args={[x + 2, 0.12, depth]} />
        <meshStandardMaterial map={paverTex((x + 2) / 2, depth / 2)} />
      </mesh>
      <mesh position={[0, LAYER.lot - 0.06, front - 0.04]}>
        <boxGeometry args={[x + 2, 0.14, 0.08]} />
        <meshStandardMaterial color="#cfd8dc" />
      </mesh>
      <Frame width={x} />
    </>
  )
}

function Car() {
  const model = q.get('model') ?? 'hotshot'
  const mask = q.get('mask') === '1'
  const g = useRef<Group>(null)
  useLayoutEffect(() => {
    if (!mask || !g.current) return
    const white = new MeshBasicMaterial({ color: '#ffffff' })
    const black = new MeshBasicMaterial({ color: '#000000' })
    g.current.traverse((o) => {
      const m = o as Mesh
      if (!m.isMesh) return
      const mat = Array.isArray(m.material) ? m.material[0] : m.material
      const c = (mat as { color?: { r: number; g: number; b: number } }).color
      m.material = c && c.r > 0.95 && c.g < 0.05 && c.b > 0.95 ? white : black
    })
  })
  const width = +(q.get('w') ?? 3)
  return (
    <>
      <group ref={g} rotation-y={Math.PI / 2 + (+(q.get('yaw') ?? 0) * Math.PI) / 180}>
        <CarModel body={carDef(model).body} model={model} color={mask ? '#ff00ff' : '#ffffff'} />
      </group>
      <Frame width={width} />
    </>
  )
}

// After the scene settles, crops the frame to what was drawn (full width for
// the street, so it tiles) and hands it to shoot.mjs as WebP.
function Export() {
  const n = useRef(0)
  const gl = useThree((t) => t.gl)
  useFrame(() => {
    if (++n.current !== 40) return
    const src = gl.domElement
    const W = src.width, H = src.height
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const x = c.getContext('2d')!
    x.drawImage(src, 0, 0)
    const px = x.getImageData(0, 0, W, H)
    const d = px.data
    let x0 = W, y0 = H, x1 = 0, y1 = 0
    for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) if (d[(y * W + i) * 4 + 3] > 8) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
    if (what === 'street') { x0 = 0; x1 = W - 1 }
    // The paint mask is cut to the same box as its car so the two line up.
    const crop = q.get('crop')?.split(',').map(Number)
    if (crop) [x0, y0, x1, y1] = crop
    if (q.get('mask') === '1') {
      // Paint coverage goes in the alpha channel, so CSS can use it as a mask.
      for (let i = 0; i < d.length; i += 4) { d[i + 3] = Math.round((d[i] * d[i + 3]) / 255); d[i] = d[i + 1] = d[i + 2] = 255 }
      x.putImageData(px, 0, 0)
    }
    const o = document.createElement('canvas')
    o.width = x1 - x0 + 1
    o.height = y1 - y0 + 1
    o.getContext('2d')!.drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height)
    ;(window as unknown as { __out: unknown }).__out = { data: o.toDataURL('image/webp', +(q.get('q') ?? 0.82)), w: o.width, h: o.height, box: [x0, y0, x1, y1].join(',') }
  })
  return null
}

if (what === 'list') (window as unknown as { __out: unknown }).__out = CARS.map((c) => c.id)
else createRoot(document.getElementById('root')!).render(
  <Canvas orthographic gl={{ toneMapping: NeutralToneMapping, alpha: true, preserveDrawingBuffer: true }} dpr={1} camera={{ near: 1, far: 200 }}>
    <hemisphereLight args={[look.sky, look.ground, look.hemiIntensity * (night ? 0.55 : 1)]} />
    <directionalLight position={[-20, 40, 30]} intensity={look.sunIntensity * (night ? 0.4 : 1)} color={look.sun} />
    <SkyEnv />
    {what === 'car' ? <Car /> : <Street />}
    <Export />
  </Canvas>,
)
