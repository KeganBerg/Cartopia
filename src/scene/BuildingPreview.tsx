import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, type Group, type Mesh } from 'three'
import { TILE, type Body, type BuildingDef } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { CarModel } from './CarModel'
import { SEASON } from './season'

// Shop, showroom and garage thumbnails are live 3D renders, drawn every display
// frame. One hidden WebGL canvas renders every on-screen model into a shared
// atlas, then copies each one onto that thumbnail's own small 2D canvas. The 2D
// canvases sit in the page like pictures, so they scroll without lag, and the
// spin is a real rotation at the screen's refresh rate rather than baked frames.
const SPIN_MS = 8000
const DPR = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

type Item = {
  key: string
  // Camera distance and the height it looks at; the shadow's radius.
  dist: number
  look: number
  shadow: number
  model: () => ReactNode
}

function buildingItem(def: BuildingDef): Item {
  const size = Math.max(def.w, def.h) * TILE
  return { key: `b|${def.id}|${SEASON}`, dist: 2 + size * 1.2, look: 0.7 + size * 0.1, shadow: size * 0.5, model: () => <BuildingModel def={def} /> }
}

type CarLook = { body: Body; color: string; stripe?: string | null; rusty?: boolean; mods?: string[] | null }

function carItem(c: CarLook): Item {
  return {
    key: `c|${c.body}|${c.color}|${c.stripe ?? ''}|${c.rusty ? 1 : 0}|${c.rusty ? '' : (c.mods ?? []).join(',')}`,
    dist: 2.55,
    look: 0.4,
    shadow: 0.65,
    model: () => <group scale={1.25}><CarModel body={c.body} color={c.color} stripe={c.stripe} rusty={c.rusty} mods={c.mods} /></group>,
  }
}

// Every thumbnail on the page, and the models they need mounted.
type Slot = { key: string; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; seen: boolean }
const slots = new Set<Slot>()
const models = new Map<string, { item: Item; uses: number }>()
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn))
let version = 0
const changed = () => {
  version++
  listeners.forEach((fn) => fn())
}

let watcher: IntersectionObserver | undefined
let sizer: ResizeObserver | undefined
const byCanvas = new Map<Element, Slot>()

function fit(slot: Slot, w: number, h: number) {
  const pw = Math.max(1, Math.round(w * DPR))
  const ph = Math.max(1, Math.round(h * DPR))
  if (slot.canvas.width !== pw) slot.canvas.width = pw
  if (slot.canvas.height !== ph) slot.canvas.height = ph
}

function attach(item: Item, canvas: HTMLCanvasElement) {
  const slot: Slot = { key: item.key, canvas, ctx: canvas.getContext('2d'), seen: typeof IntersectionObserver === 'undefined' }
  slots.add(slot)
  byCanvas.set(canvas, slot)
  const m = models.get(item.key)
  if (m) m.uses++
  else models.set(item.key, { item, uses: 1 })
  if (typeof IntersectionObserver !== 'undefined') {
    watcher ??= new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const s = byCanvas.get(e.target)
          if (s) s.seen = e.isIntersecting
        }
      },
      { rootMargin: '40px' },
    )
    watcher.observe(canvas)
  }
  if (typeof ResizeObserver !== 'undefined') {
    sizer ??= new ResizeObserver((entries) => {
      for (const e of entries) {
        const s = byCanvas.get(e.target)
        if (s) fit(s, e.contentRect.width, e.contentRect.height)
      }
    })
    sizer.observe(canvas)
  }
  fit(slot, canvas.clientWidth, canvas.clientHeight)
  changed()
  return () => {
    slots.delete(slot)
    byCanvas.delete(canvas)
    watcher?.unobserve(canvas)
    sizer?.unobserve(canvas)
    const n = models.get(item.key)
    if (n && --n.uses <= 0) models.delete(item.key)
    changed()
  }
}

// The atlas grows to fit whatever is on screen and never shrinks; rows wrap at this width.
const MAX_W = 2048

function Renderer() {
  const { gl, scene } = useThree()
  const groups = useRef(new Map<string, Group>())
  const shadow = useRef<Mesh>(null)
  const cam = useRef(new PerspectiveCamera(30, 1, 0.5, 40))
  useSyncExternalStore(subscribe, () => version)

  // Priority 1 takes over rendering from the default loop.
  useFrame(() => {
    // Largest on-screen size per model; the same car in two sizes renders once.
    const need = new Map<string, { w: number; h: number; x: number; y: number; slots: Slot[] }>()
    for (const s of slots) {
      if (!s.seen || !s.ctx || s.canvas.width < 2) continue
      const n = need.get(s.key)
      if (n) {
        n.w = Math.max(n.w, s.canvas.width)
        n.h = Math.max(n.h, s.canvas.height)
        n.slots.push(s)
      } else if (groups.current.has(s.key)) {
        need.set(s.key, { w: s.canvas.width, h: s.canvas.height, x: 0, y: 0, slots: [s] })
      }
    }
    if (!need.size) return

    // Lay the models out in rows across the atlas.
    let x = 0
    let y = 0
    let row = 0
    let width = 0
    for (const n of need.values()) {
      if (x + n.w > MAX_W && x > 0) {
        x = 0
        y += row
        row = 0
      }
      n.x = x
      n.y = y
      x += n.w
      row = Math.max(row, n.h)
      width = Math.max(width, x)
    }
    const height = y + row
    // Checked against the canvas itself, in case the renderer resized it.
    const src = gl.domElement
    if (width > src.width || height > src.height) gl.setSize(Math.max(src.width, width), Math.max(src.height, height), false)
    const ah = src.height

    const turn = still ? 0.12 : (performance.now() % SPIN_MS) / SPIN_MS
    const lift = 0.25 + Math.sin(turn * Math.PI * 4) * 0.06
    for (const g of groups.current.values()) g.visible = false
    gl.setScissorTest(true)
    gl.setClearColor(0x000000, 0)
    for (const [key, n] of need) {
      const g = groups.current.get(key)!
      const { item } = models.get(key)!
      g.visible = true
      g.rotation.y = turn * Math.PI * 2
      g.position.y = lift
      shadow.current?.scale.setScalar(item.shadow * (1 - lift * 0.5))
      const c = cam.current
      c.aspect = n.w / n.h
      c.updateProjectionMatrix()
      c.position.set(item.dist, item.dist * 0.8, item.dist)
      c.lookAt(0, item.look, 0)
      // WebGL counts rows from the bottom; the atlas is laid out from the top.
      gl.setViewport(n.x, ah - n.y - n.h, n.w, n.h)
      gl.setScissor(n.x, ah - n.y - n.h, n.w, n.h)
      gl.clear()
      gl.render(scene, c)
      g.visible = false
    }
    gl.setScissorTest(false)

    // Copy in the same frame, before the browser discards the drawing buffer.
    for (const n of need.values()) {
      for (const s of n.slots) {
        const ctx = s.ctx!
        ctx.clearRect(0, 0, s.canvas.width, s.canvas.height)
        ctx.drawImage(src, n.x, n.y, n.w, n.h, 0, 0, s.canvas.width, s.canvas.height)
      }
    }
  }, 1)

  return (
    <>
      <hemisphereLight args={['#ffffff', '#8d9ba3', 1.1]} />
      <directionalLight position={[4, 8, 3]} intensity={1.5} />
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position-y={0.01}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {[...models.values()].map(({ item }) => (
        <group
          key={item.key}
          visible={false}
          ref={(g) => {
            if (g) groups.current.set(item.key, g)
            else groups.current.delete(item.key)
          }}
        >
          {item.model()}
        </group>
      ))}
    </>
  )
}

// One hidden canvas for the whole app. It exists only while a thumbnail is mounted.
export function ThumbRenderer() {
  const busy = useSyncExternalStore(subscribe, () => models.size > 0)
  if (!busy) return null
  return (
    <Canvas className="preview-renderer" dpr={1} gl={{ alpha: true, antialias: true }} style={{ width: 1, height: 1 }}>
      <Renderer />
    </Canvas>
  )
}

type Size = 'xs' | 'sm' | 'lg'

function Thumb({ item, size }: { item: Item; size?: Size }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const latest = useRef(item)
  latest.current = item
  const key = item.key
  useEffect(() => {
    const canvas = ref.current
    if (canvas && key) return attach(latest.current, canvas)
  }, [key])
  return (
    <div className={size ? `thumb3d ${size}` : 'thumb3d'}>
      <canvas ref={ref} className="thumb-view" />
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
