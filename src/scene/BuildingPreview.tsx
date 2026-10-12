import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3, type Group, type Mesh } from 'three'
import type { Body, BuildingDef, Finish, SkinnedSlot } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { Grounded } from './ServiceVehicles'
import { CarModel } from './CarModel'
import { SEASON } from './season'
import { frame, seat, type Bounds } from './fit'
import { reduceMotionOn } from '../lib/prefs'

// Shop, showroom and garage thumbnails are live 3D renders, drawn every display
// frame. One hidden WebGL canvas renders every on-screen model into a shared
// atlas, then copies each one onto that thumbnail's own small 2D canvas. The 2D
// canvases sit in the page like pictures, so they scroll without lag, and the
// spin is a real rotation at the screen's refresh rate rather than baked frames.
const SPIN_MS = 8000
const DPR = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)

// Each model is measured once it's mounted and the camera is fitted to it, so
// tall towers, wide lots and long trucks all fill their box whole.
type Item = { key: string; model: () => ReactNode }

function buildingItem(def: BuildingDef, level?: number): Item {
  return { key: `b|${def.id}|${level ?? 1}|${SEASON}`, model: () => <Grounded.Provider value><BuildingModel def={def} level={level} /></Grounded.Provider> }
}

type CarLook = { body: Body; model?: string; color: string; finish?: Finish | null; skin?: string | null; modSkin?: Partial<Record<SkinnedSlot, string>> | null; stripe?: string | null; rusty?: boolean; mods?: string[] | null }

function carItem(c: CarLook): Item {
  return {
    key: `c|${c.body}|${c.model ?? ''}|${c.color}|${c.finish ?? ''}|${c.skin ?? ''}|${JSON.stringify(c.modSkin ?? {})}|${c.stripe ?? ''}|${c.rusty ? 1 : 0}|${c.rusty ? '' : (c.mods ?? []).join(',')}`,
    model: () => <CarModel body={c.body} model={c.model} color={c.color} finish={c.finish} skin={c.skin} modSkin={c.modSkin} stripe={c.stripe} rusty={c.rusty} mods={c.mods} />,
  }
}

// Every thumbnail on the page, and the models they need mounted.
type Slot = { key: string; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; seen: boolean }
const slots = new Set<Slot>()
const models = new Map<string, { item: Item; uses: number }>()
// Models stay mounted after their thumbnail goes, so reopening the Shop reuses
// compiled shaders and geometry; past this many unused ones, the oldest go.
const KEEP_IDLE = 80
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
    if (n) n.uses--
    const idle = [...models].filter(([, v]) => v.uses <= 0)
    for (const [k] of idle.slice(0, Math.max(0, idle.length - KEEP_IDLE))) models.delete(k)
    changed()
  }
}

// The atlas grows to fit whatever is on screen and never shrinks; rows wrap at this width.
const MAX_W = 2048
// The view comes from above and to the side, as in town; the model bobs between these heights.
const VIEW = new Vector3(1, 0.8, 1)
const LO = 0.19
const HI = 0.31

function Renderer() {
  const { gl, scene } = useThree()
  const groups = useRef(new Map<string, Group>())
  // Each model's size, measured the first time it's drawn.
  const sizes = useRef(new WeakMap<Group, Bounds>())
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

    const turn = reduceMotionOn() ? 0.12 : (performance.now() % SPIN_MS) / SPIN_MS
    const lift = (LO + HI) / 2 + Math.sin(turn * Math.PI * 4) * ((HI - LO) / 2)
    for (const g of groups.current.values()) g.visible = false
    gl.setScissorTest(true)
    gl.setClearColor(0x000000, 0)
    for (const [key, n] of need) {
      const g = groups.current.get(key)!
      let b = sizes.current.get(g)
      if (!b) {
        b = seat(g.children[0], g)
        sizes.current.set(g, b)
      }
      g.visible = true
      g.rotation.y = turn * Math.PI * 2
      g.position.y = lift
      shadow.current?.scale.setScalar(b.r * 0.8 * (1 - lift * 0.5))
      const c = cam.current
      c.aspect = n.w / n.h
      frame(c, b, VIEW, { lo: LO, hi: HI, floor: b.r * 0.8 })
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
          <group>{item.model()}</group>
        </group>
      ))}
    </>
  )
}

// One hidden canvas for the whole app. It's created the first time a thumbnail
// shows and then kept, so opening the Shop again doesn't build a fresh WebGL
// context (phones cap how many they allow). It only animates while a thumbnail
// is on the page.
let started = false
export function ThumbRenderer() {
  const used = useSyncExternalStore(subscribe, () => (started ||= models.size > 0))
  const active = useSyncExternalStore(subscribe, () => slots.size > 0)
  // Bumped to rebuild the canvas when the phone drops its context and doesn't give it back.
  const [gen, setGen] = useState(0)
  if (!used) return null
  return (
    <Canvas
      key={gen}
      className="preview-renderer"
      dpr={1}
      frameloop={active ? 'always' : 'never'}
      gl={{ alpha: true, antialias: true }}
      style={{ width: 1, height: 1 }}
      onCreated={({ gl }) => {
        let t = 0
        // three keeps the canvas restorable; if the browser never restores it, start over.
        gl.domElement.addEventListener('webglcontextlost', () => {
          t = window.setTimeout(() => setGen((g) => g + 1), 2000)
        })
        gl.domElement.addEventListener('webglcontextrestored', () => clearTimeout(t))
      }}
    >
      <Renderer />
    </Canvas>
  )
}

type Size = 'xs' | 'sm' | 'lg'

function Thumb({ item, size }: { item: Item; size?: Size }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const latest = useRef(item)
  useEffect(() => {
    latest.current = item
  })
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
export function BuildingThumb({ def, level }: { def: BuildingDef; level?: number }) {
  return <Thumb item={buildingItem(def, level)} />
}

// A car floating and turning. Rusty finds show the real model in dull, rusted paint.
export function CarThumb({ size, ...look }: CarLook & { size?: Size }) {
  return <Thumb item={carItem(look)} size={size} />
}
