// Side-by-side check of the Roblox building export: ?side=web draws the game's own model,
// ?side=roblox draws the parts BuildingBuilder.luau made (window.__parts, in studs) the way
// Roblox shapes them. scripts/roblox/check.mjs shoots both from the same views.
import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Box3, BoxGeometry, CanvasTexture, Color, CylinderGeometry, Matrix4, MeshStandardMaterial, NeutralToneMapping, RepeatWrapping, SRGBColorSpace, SphereGeometry, TextureLoader, Vector3, type BufferGeometry, type Group, type Material, type PerspectiveCamera, type Texture } from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { BUILDINGS } from '../../src/game/data'
import { BuildingModel } from '../../src/scene/BuildingModel'
import { KeepShapes } from '../../src/scene/mergeScale'
import { limitFor } from '../../src/scene/keepShape'
import { SharedShapes } from '../../src/scene/sharedShapes'

type Tex = { face: string; img: string; u: number; v: number; color: string }
type Gui = { face: string; text: string; bg: string; fg: string }
type Part = { shape: string; p: number[]; r: number[]; size: number[]; color: string; mat: string; alpha: number; mesh?: string; meshId?: string; meshTex?: string; tint?: number[]; tex: Tex[]; gui: Gui[] }
type W = Window & { __parts: Part[]; __objs: Record<string, string>; __k: number; shoot?: unknown; frame?: () => number[]; ready?: boolean }
const w = window as unknown as W
const q = new URLSearchParams(location.search)
const VIEWS = [{ az: 35, el: 28 }, { az: 325, el: 28 }, { az: 145, el: 28 }, { az: 0, el: 8 }]

const box = new BoxGeometry(1, 1, 1)
const ball = new SphereGeometry(0.5, 24, 16)
const cyl = new CylinderGeometry(0.5, 0.5, 1, 24).rotateZ(-Math.PI / 2) // Roblox cylinders run along X
const loader = new OBJLoader()
const objs = new Map<string, BufferGeometry>()
function obj(key: string) {
  if (!objs.has(key)) {
    const g = loader.parse(w.__objs[key] ?? '').children[0] as unknown as { geometry: BufferGeometry } | undefined
    objs.set(key, g?.geometry ?? box)
  }
  return objs.get(key)!
}

// Roblox faces in three's box order (+x, -x, +y, -y, +z, -z), and each face's U, V sizes.
const FACES = ['Right', 'Left', 'Top', 'Bottom', 'Back', 'Front']
const faceSize = (s: number[], f: string) => (f === 'Top' || f === 'Bottom' ? [s[0], s[2]] : f === 'Right' || f === 'Left' ? [s[2], s[1]] : [s[0], s[1]])
const images = new Map<string, Texture>()
function image(key: string) {
  if (!images.has(key)) {
    const t = new TextureLoader().load(w.__objs['img:' + key])
    t.colorSpace = SRGBColorSpace
    t.wrapS = t.wrapT = RepeatWrapping
    images.set(key, t)
  }
  return images.get(key)!
}
function sign(g: Gui, u: number, v: number) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = Math.max(16, Math.round((512 * v) / u))
  const x = c.getContext('2d')!
  x.fillStyle = g.bg
  x.fillRect(0, 0, c.width, c.height)
  x.fillStyle = g.fg
  let size = c.height * 0.8
  x.font = `900 ${size}px sans-serif`
  while (x.measureText(g.text).width > c.width * 0.95 && size > 6) x.font = `900 ${(size -= 2)}px sans-serif`
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(g.text, c.width / 2, c.height / 2)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}
// What Roblox shows on each face: the part's colour, with a Texture or SurfaceGui laid on top.
function materials(p: Part): Material | Material[] {
  const base = { transparent: p.alpha > 0, opacity: 1 - p.alpha, metalness: p.mat === 'Metal' ? 0.6 : 0, roughness: p.mat === 'SmoothPlastic' || p.mat === 'Metal' ? 0.5 : 0.9, emissive: new Color(p.mat === 'Neon' ? p.color : '#000') }
  const plain = new MeshStandardMaterial({ ...base, color: p.color })
  // SpecialMesh.TextureId: the image on the mesh's own UVs, tinted by VertexColor.
  if (p.meshTex) return new MeshStandardMaterial({ ...base, color: new Color(...(p.tint as [number, number, number])), map: image(p.meshTex) })
  if (p.shape !== 'Block' || p.mesh || (!p.tex.length && !p.gui.length)) return plain
  return FACES.map((f) => {
    const g = p.gui.find((x) => x.face === f)
    const [u, v] = faceSize(p.size, f)
    if (g) return new MeshStandardMaterial({ ...base, map: sign(g, u, v) })
    const t = p.tex.find((x) => x.face === f)
    if (!t) return plain
    const map = image(t.img).clone()
    map.repeat.set(u / t.u, v / t.v)
    map.needsUpdate = true
    return new MeshStandardMaterial({ ...base, color: t.color, map })
  })
}

function RobloxParts() {
  const k = w.__k
  const list = useMemo(() => w.__parts.map((p) => {
    const geo = p.mesh === 'FileMesh' ? obj(p.meshId!) : p.mesh === 'Sphere' || p.shape === 'Ball' ? ball : p.shape === 'Cylinder' ? cyl : box
    const r = p.r
    const m = new Matrix4().set(r[0], r[1], r[2], p.p[0] / k, r[3], r[4], r[5], p.p[1] / k, r[6], r[7], r[8], p.p[2] / k, 0, 0, 0, 1)
    m.multiply(new Matrix4().makeScale(p.size[0] / k, p.size[1] / k, p.size[2] / k))
    return { geo, m, p }
  }), [k])
  return (
    <>
      {list.map(({ geo, m, p }, i) => (
        <mesh key={i} geometry={geo} matrix={m} matrixAutoUpdate={false} material={materials(p)} castShadow receiveShadow />
      ))}
    </>
  )
}

function Shooter({ root }: { root: React.RefObject<Group | null> }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    w.shoot = (frame?: number[]) => VIEWS.map((v) => {
      const b = frame ? new Box3(new Vector3(frame[0], frame[1], frame[2]), new Vector3(frame[3], frame[4], frame[5])) : new Box3().setFromObject(root.current!)
      const size = b.getSize(new Vector3())
      const look = b.getCenter(new Vector3()).setY(b.min.y + size.y * 0.4)
      const dist = (Math.max(size.x, size.y, size.z) / 2) * 2.6
      const az = (v.az * Math.PI) / 180
      const el = (v.el * Math.PI) / 180
      const cam = camera as PerspectiveCamera
      cam.position.set(look.x + Math.sin(az) * Math.cos(el) * dist, look.y + Math.sin(el) * dist, look.z + Math.cos(az) * Math.cos(el) * dist)
      cam.lookAt(look)
      cam.updateProjectionMatrix()
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/png')
    })
    w.frame = () => { const b = new Box3().setFromObject(root.current!); return [...b.min.toArray(), ...b.max.toArray()] }
    w.ready = true
  }, [gl, scene, camera, root])
  return null
}

function App() {
  const root = useRef<Group>(null)
  const def = BUILDINGS.find((d) => d.id === q.get('id'))!
  return (
    <Canvas shadows frameloop="demand" dpr={1} camera={{ fov: 35 }} gl={{ toneMapping: NeutralToneMapping, preserveDrawingBuffer: true }}>
      <SharedShapes />
      <color attach="background" args={['#a9bfcc']} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#dfefff', '#5d6b4a', 0.7]} />
      <directionalLight position={[8, 16, 6]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-0.0004} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow><planeGeometry args={[80, 80]} /><meshStandardMaterial color="#6f8f5a" /></mesh>
      <group ref={root}>
        {q.get('side') === 'roblox' ? <RobloxParts /> : (
          <KeepShapes limit={limitFor(def)}><BuildingModel def={def} level={Number(q.get('level') ?? 1)} /></KeepShapes>
        )}
      </group>
      <Shooter root={root} />
    </Canvas>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
