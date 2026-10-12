import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useThree } from '@react-three/fiber'
import { NeutralToneMapping, PCFSoftShadowMap, type PerspectiveCamera, type WebGLProgram, type WebGLRenderer } from 'three'
import { warmShaders } from './warm'
import { useCanvasDpr } from '../lib/prefs'
import { create } from 'zustand'

// The race (and the Crate Depot) draws in its own full-screen canvas. Building a fresh canvas for every race
// meant a new WebGL context and every shader compiled again from scratch, all on the
// tap that starts the race: the game froze before the countdown, worst on Windows.
// So the race canvas is made once and kept: between races it waits, parked and idle,
// and the next race just moves it into place with its shaders already compiled.
// Each race's scene is compiled in the background (compileAsync) before its first
// frame; `ready` says when that's done so the countdown can wait for it.

// shadows: the view draws shadows (the crate depot's work lamp); races don't.
type Cam = { position: [number, number, number]; fov: number; near: number; far: number; shadows?: boolean }
type StageState = { node: ReactNode; slot: HTMLElement | null; cam: Cam; run: number; ready: number; used: boolean; gen: number }
const useStage = create<StageState>(() => ({ node: null, slot: null, cam: { position: [0, 2, -4], fov: 55, near: 0.3, far: 150 }, run: 0, ready: -1, used: false, gen: 0 }))

// The canvas lives in a div of its own that moves between a race's slot and a
// hidden parking spot, so React never sees it change parents.
let host: HTMLDivElement | null = null
function hostDiv() {
  if (!host) {
    host = document.createElement('div')
    host.className = 'stage-host'
    park()
  }
  return host
}
function park() {
  if (!host) return
  Object.assign(host.style, { position: 'fixed', left: '-10px', top: '0', width: '2px', height: '2px', visibility: 'hidden', pointerEvents: 'none' })
  document.body.appendChild(host)
}

// Make the shared canvas early (the race menu calls this), so even the first race
// doesn't pay for creating it on the tap that starts it.
export function warmStage() {
  if (useStage.getState().used) return
  const go = () => useStage.setState({ used: true })
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 })
  else setTimeout(go, 300)
}

// Mounted once in App. Renders nothing until the first race (or warmStage).
export function StageCanvas() {
  const { node, used, slot, run, ready, gen } = useStage()
  const dpr = useCanvasDpr()
  if (!used) return null
  return createPortal(
    <Canvas
      key={gen}
      className="rf-canvas"
      camera={{ position: [0, 2, -4], fov: 55, near: 0.3, far: 150 }}
      dpr={dpr}
      gl={{ toneMapping: NeutralToneMapping }}
      frameloop={slot && node && ready === run ? 'always' : 'never'}
      onCreated={({ gl }) => {
        // A phone can take the context back while the canvas waits between races;
        // if it isn't restored, build a fresh canvas (and recompile next race).
        let t = 0
        gl.domElement.addEventListener('webglcontextlost', () => {
          t = window.setTimeout(() => useStage.setState((s) => ({ gen: s.gen + 1, ready: -1 })), 2000)
        })
        gl.domElement.addEventListener('webglcontextrestored', () => clearTimeout(t))
      }}
    >
      <Rig run={run} />
      <StageRun run={run}>{node}</StageRun>
    </Canvas>,
    hostDiv(),
  )
}

// Three frees a shader program once no material uses it, and every race's materials
// go when it ends, so the next race would compile them all again. Holding one extra use
// of each program keeps them for the canvas's lifetime (a few dozen, one per look).
let renderer: WebGLRenderer | null = null
function pinPrograms() {
  for (const p of (renderer?.info.programs ?? []) as (WebGLProgram & { usedTimes: number; pinned?: boolean })[]) {
    if (p.pinned) continue
    p.pinned = true
    p.usedTimes++
  }
}

// Each race starts from the same camera, and compiles its shaders before its first frame.
function Rig({ run }: { run: number }) {
  const { camera, gl, scene, get } = useThree()
  useEffect(() => void (renderer = gl), [gl])
  useLayoutEffect(() => {
    const { cam } = useStage.getState()
    const c = camera as PerspectiveCamera
    c.position.set(...cam.position)
    c.fov = cam.fov
    c.near = cam.near
    c.far = cam.far
    c.lookAt(0, 0, 0)
    c.updateProjectionMatrix()
    gl.shadowMap.enabled = !!cam.shadows
    gl.shadowMap.type = PCFSoftShadowMap
  }, [run, camera, gl])
  useEffect(() => {
    if (!run) return
    let live = true
    // Drawing waits until the shaders are ready (rendering first would compile them all
    // at once, freezing the page), but never for long.
    const done = () => {
      if (!live) return
      live = false
      useStage.setState({ ready: run })
    }
    const t = setTimeout(done, 4000)
    // A tick later, once the scene's own effects have run (its sky reflections, fog).
    const c = setTimeout(() => warmShaders(gl, scene, camera, get().internal.priority > 0).then(done, done))
    return () => {
      live = false
      clearTimeout(t)
      clearTimeout(c)
    }
  }, [run, gl, scene, camera, get])
  return null
}

// Each race gets a fresh scene. The next race's scene arrives in the same commit as the
// last one leaves (Retry, Next), so without the key React would hand the old scene the
// new props and its per-race state would carry over: the finish replay stayed finished,
// and every race after the first lost its slow-motion and photo finish.
export function StageRun({ run, children }: { run: number; children: ReactNode }) {
  return <Fragment key={run}>{children}</Fragment>
}

let runs = 0
// Takes the place of a <Canvas> in a full-screen view: the shared canvas moves in here
// and draws `children`. Returns whether this run's scene is compiled and drawing.
export function StageSlot({ cam, children }: { cam: Cam; children: ReactNode }) {
  const slot = useRef<HTMLDivElement>(null)
  const [run] = useState(() => ++runs)
  useLayoutEffect(() => {
    const el = slot.current!
    const h = hostDiv()
    // Hidden until this race's first frame, so the last race's picture never shows.
    Object.assign(h.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', visibility: 'hidden', pointerEvents: '' })
    el.appendChild(h)
    useStage.setState({ slot: el, cam, run, used: true, ready: -1 })
    return () => {
      pinPrograms()
      useStage.setState((s) => (s.run === run ? { slot: null, node: null } : s))
      park()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The scene follows the view's renders, as it would inside its own canvas (pass a
  // memoised element: a new one every frame re-renders the whole scene every frame).
  useLayoutEffect(() => {
    if (useStage.getState().node !== children) useStage.setState({ node: children })
  })
  const ready = useStage((s) => s.ready === run)
  useEffect(() => {
    if (!ready) return
    // One frame to draw this race's picture before showing the canvas.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (hostDiv().parentElement === slot.current) hostDiv().style.visibility = ''
    }))
    return () => cancelAnimationFrame(id)
  }, [ready])
  return <div ref={slot} className="rf-canvas stage-slot" data-ready={ready ? 1 : 0} />
}

export const useStageReady = () => useStage((s) => s.ready === s.run && s.run > 0)
