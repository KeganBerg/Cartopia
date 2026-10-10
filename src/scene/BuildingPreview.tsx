import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerspectiveCamera as Cam, type Group, type Mesh } from 'three'
import { BUILDINGS, TILE, type BuildingDef } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { SEASON } from './season'

// Shop thumbnails are baked once into strips of frames (one full turn with a
// gentle bob) and played back as plain images. They scroll with the page like
// any picture, so they never jitter, and cost no GPU time after baking.
const FW = 132
const FH = 104
const FRAMES = 20
const DPR = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)

const strips = new Map<string, string>()
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn))
const stripKey = (id: string) => `${id}|${SEASON}`

function Baker({ queue, onDone }: { queue: BuildingDef[]; onDone: () => void }) {
  const { gl, scene } = useThree()
  const holder = useRef<Group>(null)
  const shadow = useRef<Mesh>(null)
  const [i, setI] = useState(0)
  const def = queue[i]

  useEffect(() => {
    if (!def) return onDone()
    const g = holder.current
    if (!g) return
    const size = Math.max(def.w, def.h) * TILE
    const d = 2 + size * 1.2
    const cam = new Cam(30, FW / FH, 0.1, 100)
    cam.position.set(d, d * 0.8, d)
    cam.lookAt(0, 0.7 + size * 0.1, 0)
    if (shadow.current) shadow.current.scale.setScalar(size * 0.5)

    const w = Math.round(FW * DPR)
    const h = Math.round(FH * DPR)
    const strip = document.createElement('canvas')
    strip.width = w * FRAMES
    strip.height = h
    const ctx = strip.getContext('2d')!
    for (let f = 0; f < FRAMES; f++) {
      const turn = f / FRAMES
      const lift = 0.25 + Math.sin(turn * Math.PI * 4) * 0.12
      g.rotation.y = turn * Math.PI * 2
      g.position.y = lift
      shadow.current?.scale.setScalar(size * 0.5 * (1 - lift * 0.5))
      gl.render(scene, cam)
      // Card backdrop baked in, so the strip can be a small JPEG.
      const bg = ctx.createRadialGradient(f * w + w / 2, h * 0.7, 0, f * w + w / 2, h * 0.7, w * 0.75)
      bg.addColorStop(0, '#ffffff')
      bg.addColorStop(0.45, '#ffffff')
      bg.addColorStop(1, '#e3f2fd')
      ctx.fillStyle = bg
      ctx.fillRect(f * w, 0, w, h)
      ctx.drawImage(gl.domElement, f * w, 0, w, h)
    }
    strips.set(stripKey(def.id), strip.toDataURL('image/jpeg', 0.85))
    listeners.forEach((fn) => fn())
    // Hand the browser a frame before baking the next one.
    const t = setTimeout(() => setI((n) => n + 1), 16)
    return () => clearTimeout(t)
  }, [def, gl, scene, onDone])

  return (
    <>
      <hemisphereLight args={['#ffffff', '#8d9ba3', 1.1]} />
      <directionalLight position={[4, 8, 3]} intensity={1.5} />
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position-y={0.01}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <group ref={holder}>{def && <BuildingModel key={def.id} def={def} />}</group>
    </>
  )
}

// Bakes any shop strips not made yet, then removes its own WebGL context.
// Pass `defs` to bake just those (the level-up splash only needs a few).
export function PreviewCanvas({ defs }: { defs?: BuildingDef[] }) {
  const [queue] = useState(() => (defs ?? BUILDINGS.filter((b) => b.unlockLevel < 99)).filter((b) => !strips.has(stripKey(b.id))))
  const [done, setDone] = useState(queue.length === 0)
  if (done) return null
  return (
    <Canvas
      className="preview-baker"
      frameloop="never"
      dpr={DPR}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      style={{ width: FW, height: FH }}
    >
      <Baker queue={queue} onDone={() => setDone(true)} />
    </Canvas>
  )
}

// A building or decoration floating and turning, exactly as it looks in town.
export function BuildingThumb({ def }: { def: BuildingDef }) {
  const src = useSyncExternalStore(subscribe, () => strips.get(stripKey(def.id)))
  return (
    <div className="thumb3d">
      {src && <div className="thumb-strip" style={{ backgroundImage: `url(${src})` }} />}
    </div>
  )
}
