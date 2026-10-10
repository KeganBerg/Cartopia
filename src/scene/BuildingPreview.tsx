import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerspectiveCamera as Cam, type Group, type Mesh } from 'three'
import { BUILDINGS, TILE, type Body, type BuildingDef } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { CarModel } from './CarModel'
import { SEASON } from './season'

// Shop, showroom and garage thumbnails are baked once into strips of frames
// (one full turn with a gentle bob) and played back as plain images. They
// scroll with the page like any picture, so they never jitter, and cost no GPU
// time after baking.
export const FW = 132
export const FH = 104
export const FRAMES = 30
const DPR = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)

type Item = {
  key: string
  // Camera distance and the height it looks at; the shadow's radius.
  dist: number
  look: number
  shadow: number
  model: () => ReactNode
}

const strips = new Map<string, string>()
const queue: Item[] = []
const queued = new Set<string>()
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn))
const notify = () => listeners.forEach((fn) => fn())
let version = 0

function request(item: Item) {
  if (strips.has(item.key) || queued.has(item.key)) return
  queued.add(item.key)
  queue.push(item)
  version++
  notify()
}

function buildingItem(def: BuildingDef): Item {
  const size = Math.max(def.w, def.h) * TILE
  return { key: `b|${def.id}|${SEASON}`, dist: 2 + size * 1.2, look: 0.7 + size * 0.1, shadow: size * 0.5, model: () => <BuildingModel def={def} /> }
}

type CarLook = { body: Body; color: string; stripe?: string | null; rusty?: boolean }

function carItem(c: CarLook): Item {
  return {
    key: `c|${c.body}|${c.color}|${c.stripe ?? ''}|${c.rusty ? 1 : 0}`,
    dist: 2.55,
    look: 0.4,
    shadow: 0.65,
    model: () => <group scale={1.25}><CarModel body={c.body} color={c.color} stripe={c.stripe} rusty={c.rusty} /></group>,
  }
}

function Baker() {
  const { gl, scene } = useThree()
  const holder = useRef<Group>(null)
  const shadow = useRef<Mesh>(null)
  const [item, setItem] = useState<Item | undefined>(() => queue[0])

  useEffect(() => {
    if (!item) return
    const g = holder.current
    if (!g) return
    const cam = new Cam(30, FW / FH, 0.1, 100)
    cam.position.set(item.dist, item.dist * 0.8, item.dist)
    cam.lookAt(0, item.look, 0)

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
      shadow.current?.scale.setScalar(item.shadow * (1 - lift * 0.5))
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
    strips.set(item.key, strip.toDataURL('image/jpeg', 0.85))
    queue.shift()
    queued.delete(item.key)
    notify()
    // Hand the browser a frame before baking the next one.
    const t = setTimeout(() => setItem(queue[0]), 16)
    return () => clearTimeout(t)
  }, [item, gl, scene])

  // A request that arrives after the queue ran dry restarts the baker.
  useSyncExternalStore(subscribe, () => version)
  useEffect(() => {
    if (!item && queue[0]) setItem(queue[0])
  })

  return (
    <>
      <hemisphereLight args={['#ffffff', '#8d9ba3', 1.1]} />
      <directionalLight position={[4, 8, 3]} intensity={1.5} />
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position-y={0.01}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <group ref={holder}>{item && <group key={item.key}>{item.model()}</group>}</group>
    </>
  )
}

// One hidden canvas for the whole app. It exists only while there is something to bake.
export function ThumbBaker() {
  const busy = useSyncExternalStore(subscribe, () => queue.length > 0)
  if (!busy) return null
  return (
    <Canvas
      className="preview-baker"
      frameloop="never"
      dpr={DPR}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      style={{ width: FW, height: FH }}
    >
      <Baker />
    </Canvas>
  )
}

// Opening the Shop bakes every building up front so the list fills in quickly.
export function preloadBuildings() {
  for (const b of BUILDINGS) if (b.unlockLevel < 99) request(buildingItem(b))
}

type Size = 'xs' | 'sm' | 'lg'

function Thumb({ item, size }: { item: Item; size?: Size }) {
  useEffect(() => request(item))
  const src = useSyncExternalStore(subscribe, () => strips.get(item.key))
  return (
    <div className={size ? `thumb3d ${size}` : 'thumb3d'}>
      {src && <div className="thumb-strip" style={{ backgroundImage: `url(${src})` }} />}
    </div>
  )
}

// A building or decoration floating and turning, exactly as it looks in town.
export function BuildingThumb({ def }: { def: BuildingDef }) {
  return <Thumb item={buildingItem(def)} />
}

// A car floating and turning. Rusty finds show the real model in dull, rusted paint.
export function CarThumb({ size, ...look }: CarLook & { size?: Size }) {
  return <Thumb item={carItem(look)} size={size} />
}
