import { memo, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { SharedShapes } from './sharedShapes'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3, type Group, type Mesh } from 'three'
import type { Body, BuildingDef, Finish, SkinnedSlot, Panels } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { Batch } from './Batch'
import { Tint } from './CityTint'
import type { ColorTheme } from '../game/cityLook'
import { Grounded } from './ServiceVehicles'
import { CarModel } from './CarModel'
import { HatModel } from './CarHat'
import { hatPaint, type HatFit } from '../game/hats'
import { SEASON } from './season'
import { frame, seat, type Bounds } from './fit'
import { reduceMotionOn } from '../lib/prefs'
import { quietShaders } from './warm'
import { chooseFocus, copyThumbs, nextMounts, pickThumbs, spinsFor, type Slot } from './thumbCopy'
import type { Trim } from '../game/trim'

// Shop, showroom and garage thumbnails are live 3D renders. One hidden WebGL
// canvas renders every on-screen model into a shared atlas, then copies each one
// onto that thumbnail's own small 2D canvas. The 2D canvases sit in the page like
// pictures, so they scroll without lag, and the spin is a real rotation rather
// than baked frames.
const SPIN_MS = 8000
// The arcade cards' own animations draw at this rate. Turning thumbnails (see Slot in
// thumbCopy.ts) draw at up to SPIN_FPS each (at 24 a big car's turn looked choppy), sharing
// BUDGET_MS of drawing a frame, so a page of them stays smooth on a phone.
const FPS = 24
const SPIN_FPS = 60
const BUDGET_MS = 6
// The turn a held floating model shows.
const REST = 0.12
// With reduced motion they stand still, so they're redrawn only when something changes.
let dirty = true
const DPR = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)

// Each model is measured once it's mounted and the camera is fitted to it, so
// tall towers, wide lots and long trucks all fill their box whole.
// A scene (an arcade card) instead stands still under a fixed camera and moves itself.
// `stand`: the model sits on the ground, seen from lower down, filling its box (the Car Packs cards).
type Item = { key: string; model: () => ReactNode; view?: SceneView; stand?: boolean }

// A camera looking at `at` from direction `dir`, backed off until a box halfW wide and
// halfH tall round `at` fits whatever shape the picture is. `rise` lifts the subject up
// the picture (0 = middle, 0.5 = half way to the top), clear of text drawn over the bottom.
export type SceneView = { dir: [number, number, number]; at: [number, number, number]; halfW: number; halfH: number; rise?: number; fov?: number }

// `theme`: the colour theme the building wears in town, so the thumb matches it.
function buildingItem(def: BuildingDef, level?: number, theme?: ColorTheme | null): Item {
  return {
    key: `b|${def.id}|${level ?? 1}|${SEASON}|${theme?.id ?? ''}`,
    // Merged like the town (Batch): a detailed building is dozens of small meshes, and a page of
    // them turning drew thousands of pieces a second, enough to make the Build grid lag.
    model: () => <Batch version={1}><Grounded.Provider value><Tint theme={theme ?? null}><BuildingModel def={def} level={level} /></Tint></Grounded.Provider></Batch>,
  }
}

type CarLook = { body: Body; model?: string; color: string; finish?: Finish | null; skin?: string | null; modSkin?: Partial<Record<SkinnedSlot, string>> | null; panels?: Panels | null; stripe?: string | null; rusty?: boolean; mods?: string[] | null; trim?: Trim | null; hat?: HatFit | null }

function carItem(c: CarLook, stand?: boolean): Item {
  return {
    stand,
    key: `${stand ? 's' : ''}c|${c.body}|${c.model ?? ''}|${c.color}|${c.finish ?? ''}|${c.skin ?? ''}|${JSON.stringify(c.modSkin ?? {})}|${c.stripe ?? ''}|${c.rusty ? 1 : 0}|${c.rusty ? '' : (c.mods ?? []).join(',')}|${c.panels ? JSON.stringify(c.panels) : ''}|${c.trim ? JSON.stringify(c.trim) : ''}|${c.hat && !c.rusty ? JSON.stringify(c.hat) : ''}`,
    model: () => <CarModel body={c.body} model={c.model} color={c.color} finish={c.finish} skin={c.skin} modSkin={c.modSkin} panels={c.panels} trim={c.trim} stripe={c.stripe} rusty={c.rusty} mods={c.mods} hat={c.hat} />,
  }
}

// Every thumbnail on the page (see Slot in thumbCopy.ts), and the models they need mounted.
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
  dirty = true
  listeners.forEach((fn) => fn())
}

let watcher: IntersectionObserver | undefined
let sizer: ResizeObserver | undefined
const byCanvas = new Map<Element, Slot>()
const wasSeen = new WeakMap<HTMLCanvasElement, boolean>()
// For tests: how many thumbnails are mounted, and how many of them are counted as on screen.
export const thumbsSeen = () => [slots.size, [...slots].filter((s) => s.seen).length]

function fit(slot: Slot, w: number, h: number) {
  const pw = Math.max(1, Math.round(w * DPR))
  const ph = Math.max(1, Math.round(h * DPR))
  // A resized canvas comes back blank, so it's redrawn on the next frame.
  if (slot.canvas.width === pw && slot.canvas.height === ph) return
  slot.canvas.width = pw
  slot.canvas.height = ph
  slot.fresh = true
  dirty = true
}

function attach(item: Item, canvas: HTMLCanvasElement, still: boolean) {
  // A thumb that swaps model (the Grand Prix prize box cycles cars) re-attaches the same canvas. The
  // observer doesn't always report a target that's unobserved and observed again, so it keeps
  // whether it was on screen; otherwise the new car never draws and the box stays blank.
  // Held, a standing car shows its front three quarters, a floating model the three quarters view.
  const slot: Slot = { key: item.key, canvas, ctx: canvas.getContext('2d'), seen: typeof IntersectionObserver === 'undefined' || wasSeen.get(canvas) === true, still, scene: !!item.view, angle: item.stand ? 0 : REST, at: -Infinity, fresh: true }
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
          if (!s || s.seen === e.isIntersecting) continue
          s.seen = e.isIntersecting
          dirty = true
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
    wasSeen.set(canvas, slot.seen)
    slots.delete(slot)
    byCanvas.delete(canvas)
    watcher?.unobserve(canvas)
    sizer?.unobserve(canvas)
    const n = models.get(item.key)
    if (n) n.uses--
    // Scenes animate every frame while mounted, so they go as soon as nothing shows them.
    if (n && n.uses <= 0 && n.item.view) models.delete(item.key)
    const idle = [...models].filter(([, v]) => v.uses <= 0)
    for (const [k] of idle.slice(0, Math.max(0, idle.length - KEEP_IDLE))) models.delete(k)
    changed()
  }
}

// A held thumbnail (Shop > Upgrades) turns while the mouse is over it, and holds where it got to.
let hover: Slot | null = null
export function spinThumb(canvas: Element | null | undefined, on: boolean) {
  const s = canvas && byCanvas.get(canvas)
  if (!s) return
  if (on) hover = s
  else if (hover === s) hover = null
  dirty = true
}

// The atlas grows to fit whatever is on screen and never shrinks; rows wrap at this width.
const MAX_W = 2048
// The view comes from above and to the side, as in town; the model bobs between these heights.
const VIEW = new Vector3(1, 0.8, 1)
const aim = new Vector3()
const back = new Vector3()
const LO = 0.19
const HI = 0.31
// Its bob height at a given turn (middle at REST).
const liftAt = (angle: number) => (LO + HI) / 2 + Math.sin((angle - REST) * Math.PI * 4) * ((HI - LO) / 2)
// A standing model is seen lower down, so it fills a wide box without bobbing.
const STAND = new Vector3(1, 0.42, 1)

function aimScene(c: PerspectiveCamera, v: SceneView) {
  c.fov = v.fov ?? 30
  const t = Math.tan((c.fov * Math.PI) / 360)
  const d = Math.max(v.halfH / t, v.halfW / (t * c.aspect))
  aim.set(...v.at)
  back.set(...v.dir).normalize()
  c.position.copy(aim).addScaledVector(back, d)
  c.up.set(0, 1, 0)
  c.lookAt(aim)
  c.near = Math.max(0.1, d * 0.1)
  c.far = d * 6
  c.updateProjectionMatrix()
  // Shifts the whole picture down, so the subject sits higher than the middle.
  c.projectionMatrix.elements[9] -= v.rise ?? 0
  c.projectionMatrixInverse.copy(c.projectionMatrix).invert()
}

// The models in the scene so far (see nextMounts).
const inScene = new Set<string>()

// Each model renders once when it goes in, not again every time a thumbnail comes or goes.
const Model = memo(function Model({ item }: { item: Item }) {
  return <group>{item.model()}</group>
})

function Renderer() {
  const { gl, scene } = useThree()
  const groups = useRef(new Map<string, Group>())
  const [, mounted] = useState(0)
  // A rebuilt canvas (the phone dropped the old one) starts with an empty scene.
  useEffect(() => () => inScene.clear(), [])
  // Each model's size, measured the first time it's drawn.
  const sizes = useRef(new WeakMap<Group, Bounds>())
  const shadow = useRef<Mesh>(null)
  const cam = useRef(new PerspectiveCamera(30, 1, 0.5, 40))
  useSyncExternalStore(subscribe, () => version)

  const last = useRef(-Infinity)
  const lastScene = useRef(-Infinity)
  const focus = useRef<{ slot: Slot | null; at: number }>({ slot: null, at: -Infinity })
  // What one turning thumbnail has been costing to draw (ms), to size the next frame's share.
  const cost = useRef(2)
  // Priority 1 takes over rendering from the default loop.
  useFrame(() => {
    for (const k of inScene) if (!models.has(k)) inScene.delete(k)
    const add = nextMounts(slots, (k) => models.has(k), inScene)
    if (add.length) {
      for (const k of add) inScene.add(k)
      mounted((v) => v + 1)
    }
    const now = performance.now()
    const still = reduceMotionOn()
    const over = hover && slots.has(hover) ? hover : null
    // The hero, drawn every frame, looked for a few times a second (it reads places on the page).
    const f = focus.current
    if (still) f.slot = null
    else if (dirty || now - f.at > 250 || (f.slot && !slots.has(f.slot))) {
      f.at = now
      const cands: { slot: Slot; box: DOMRect }[] = []
      for (const s of slots) if (s.seen && !s.still && !s.scene) cands.push({ slot: s, box: s.canvas.getBoundingClientRect() })
      f.slot = chooseFocus(cands, window.innerWidth, window.innerHeight)
    }
    let turning = false
    if (!still) for (const s of slots) if (s.seen && !s.scene && (!s.still || s === over)) { turning = true; break }
    const scenes = !still && now - lastScene.current >= 1000 / FPS - 4
    const due = turning && now - last.current >= 1000 / SPIN_FPS - 4
    if (!dirty && !due && !scenes) return
    last.current = now
    if (scenes) lastScene.current = now
    dirty = false
    const { need, waiting } = pickThumbs(slots, (k) => groups.current.has(k), { focus: f.slot, hover: over, scenes, still, now, gap: 1000 / SPIN_FPS - 4, spins: spinsFor(BUDGET_MS, cost.current) })
    if (waiting) dirty = true
    if (!need.size) return
    // Each turning one goes round with the clock, however long since it last drew (a long wait, a
    // page that has only just shown it, moves it no more than a quarter second's worth).
    let spun = 0
    for (const n of need.values()) {
      if (!n.spin || models.get(n.key)?.item.view) continue
      spun++
      for (const s of n.slots) s.angle = (s.angle + (Number.isFinite(s.at) ? Math.min(now - s.at, 250) : 0) / SPIN_MS) % 1
      n.angle = n.slots[0].angle
    }
    const t0 = performance.now()

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

    for (const g of groups.current.values()) g.visible = false
    gl.setScissorTest(true)
    gl.setClearColor(0x000000, 0)
    for (const n of need.values()) {
      const { key } = n
      const g = groups.current.get(key)!
      const c = cam.current
      c.aspect = n.w / n.h
      const view = models.get(key)?.item.view
      if (view) {
        g.visible = true
        if (shadow.current) shadow.current.visible = false
        aimScene(c, view)
      } else {
        let b = sizes.current.get(g)
        if (!b) {
          b = seat(g.children[0], g)
          sizes.current.set(g, b)
        }
        const stand = models.get(key)?.item.stand
        g.visible = true
        const lift = stand ? 0 : liftAt(n.angle)
        g.rotation.y = n.angle * Math.PI * 2
        g.position.y = lift
        if (shadow.current) {
          shadow.current.visible = true
          shadow.current.scale.setScalar(b.r * 0.8 * (1 - lift * 0.5))
        }
        c.fov = 30
        if (stand) frame(c, b, STAND, { floor: b.r * 0.8, pad: 0.04 })
        else frame(c, b, VIEW, { lo: LO, hi: HI, floor: b.r * 0.8 })
      }
      // WebGL counts rows from the bottom; the atlas is laid out from the top.
      gl.setViewport(n.x, ah - n.y - n.h, n.w, n.h)
      gl.setScissor(n.x, ah - n.y - n.h, n.w, n.h)
      gl.clear()
      gl.render(scene, c)
      g.visible = false
    }
    gl.setScissorTest(false)

    // Copy in the same frame, before the browser discards the drawing buffer.
    copyThumbs(src, width, height, need.values())
    if (spun) cost.current = cost.current * 0.8 + ((performance.now() - t0) / need.size) * 0.2
    for (const n of need.values()) for (const s of n.slots) {
      s.fresh = false
      s.at = now
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
      {[...models.values()].filter(({ item }) => inScene.has(item.key)).map(({ item }) => (
        <group
          key={item.key}
          visible={false}
          ref={(g) => {
            if (g) groups.current.set(item.key, g)
            else groups.current.delete(item.key)
          }}
        >
          <Model item={item} />
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
        quietShaders(gl)
        let t = 0
        // three keeps the canvas restorable; if the browser never restores it, start over.
        gl.domElement.addEventListener('webglcontextlost', () => {
          t = window.setTimeout(() => setGen((g) => g + 1), 2000)
        })
        gl.domElement.addEventListener('webglcontextrestored', () => clearTimeout(t))
      }}
    >
      <SharedShapes />
      <Renderer />
    </Canvas>
  )
}

type Size = 'xs' | 'sm' | 'lg'

function Thumb({ item, size, className, still = false }: { item: Item; size?: Size; className?: string; still?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const latest = useRef(item)
  useEffect(() => {
    latest.current = item
  })
  const key = item.key
  useEffect(() => {
    const canvas = ref.current
    if (canvas && key) return attach(latest.current, canvas, still)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return (
    <div className={className ?? (size ? `thumb3d ${size}` : 'thumb3d')}>
      <canvas ref={ref} className="thumb-view" />
    </div>
  )
}

// A building or decoration floating and turning, exactly as it looks in town.
// `still`: drawn once and held (see Slot), for pages with lots of them.
export function BuildingThumb({ def, level, theme, still }: { def: BuildingDef; level?: number; theme?: ColorTheme | null; still?: boolean }) {
  return <Thumb item={buildingItem(def, level, theme)} still={still} />
}

// Scaled up to about a car's size, so it floats and frames like the other thumbs.
function hatItem(h: HatFit): Item {
  return { key: `h|${h.id}|${hatPaint(h).join(',')}`, model: () => <group><group scale={6}><HatModel hat={h} /></group></group> }
}

// A hat on its own, floating and turning.
export function HatThumb({ hat, size }: { hat: HatFit; size?: Size }) {
  return <Thumb item={hatItem(hat)} size={size} />
}

// A car floating and turning. Rusty finds show the real model in dull, rusted paint.
export function CarThumb({ size, stand, ...look }: CarLook & { size?: Size; stand?: boolean }) {
  return <Thumb item={carItem(look, stand)} size={size} />
}

// A little scene that animates itself under a fixed camera (the arcade cards).
export function SceneThumb({ id, view, className, children }: { id: string; view: SceneView; className?: string; children: () => ReactNode }) {
  return <Thumb item={{ key: `s|${id}`, model: children, view }} className={className} />
}
