import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { SharedShapes } from './sharedShapes'
import { createPortal } from 'react-dom'
import { Canvas, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, NeutralToneMapping, PCFSoftShadowMap, type PerspectiveCamera, type ToneMapping, type WebGLRenderer } from 'three'
import { pinPrograms, quietShaders, warmShaders } from './warm'
import { useCanvasDpr } from '../lib/prefs'
import { FrameCap } from './frameCap'
import { CountFrames } from '../ui/FpsMeter'
import { create } from 'zustand'

// The race (and the Crate Depot) draws in its own full-screen canvas. Building a fresh canvas for every race
// meant a new WebGL context and every shader compiled again from scratch, all on the
// tap that starts the race: the game froze before the countdown, worst on Windows.
// So the race canvas is made once and kept: between races it waits, parked and idle,
// and the next race just moves it into place with its shaders already compiled.
// Each race's scene is compiled in the background (compileAsync) before its first
// frame; `ready` says when that's done so the countdown can wait for it.
// The arcade games and the crew battle share it too. The small turntables (garage car,
// upgrade preview, full-screen car look) share a second one, `Preview`, so one can sit
// over a full-screen view (the restored car over Rusty's yard) without taking its canvas.

// shadows: the view draws shadows (the crate depot's work lamp); races don't.
// dpr: the sharpest the view draws (the full-screen car look goes up to 2).
type Cam = { position: [number, number, number]; fov: number; near: number; far: number; shadows?: boolean; dpr?: number }
type StageState = { node: ReactNode; slot: HTMLElement | null; cam: Cam; run: number; ready: number; used: boolean; gen: number }
// A view that's open, under the one on top (a turntable opened over another one).
type Entry = { run: number; el: HTMLElement; cam: Cam; node: ReactNode; through?: boolean }

let runs = 0

// `cap`: the most frames a second the view draws (none: every screen refresh, for races).
function makeStage(tone: ToneMapping, view: string, cap?: number) {
  const useStage = create<StageState>(() => ({ node: null, slot: null, cam: { position: [0, 2, -4], fov: 55, near: 0.3, far: 150 }, run: 0, ready: -1, used: false, gen: 0 }))
  const open: Entry[] = []

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
  // `through`: taps and drags go past the canvas to the view's own elements. The canvas is a
  // React portal from App, so React handlers on the view (round the slot) never see events
  // that land on the canvas itself.
  function moveTo(el: HTMLElement, through = false) {
    const h = hostDiv()
    // Hidden until this race's first frame, so the last race's picture never shows.
    Object.assign(h.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', visibility: 'hidden', pointerEvents: '' })
    // The canvas's own wrapper sets pointer-events itself, so a class turns off the lot (index.css).
    h.classList.toggle('stage-through', through)
    el.appendChild(h)
  }

  // Make the shared canvas early (the race menu calls this), so even the first race
  // doesn't pay for creating it on the tap that starts it.
  function warmStage() {
    if (useStage.getState().used) return
    const go = () => useStage.setState({ used: true })
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 })
    else setTimeout(go, 300)
  }

  // Every race's materials go when it ends; pinning keeps their shaders for the next one.
  let renderer: WebGLRenderer | null = null
  const pinStage = () => pinPrograms(renderer)

  // A picture of what the canvas shows right now (the snapshot button after a win).
  let snap: (() => Promise<Blob | null>) | null = null
  const stageSnapshot = () => (snap && useStage.getState().slot ? snap() : Promise.resolve(null))

  // Mounted once in App. Renders nothing until the first race (or warmStage).
  function StageCanvas() {
    const { node, used, slot, run, ready, gen, cam } = useStage()
    const dpr = useCanvasDpr(cam.dpr)
    if (!used) return null
    const live = !!(slot && node && ready === run)
    return createPortal(
      <Canvas
        key={gen}
        className="rf-canvas"
        camera={{ position: [0, 2, -4], fov: 55, near: 0.3, far: 150 }}
        dpr={dpr}
        // Measure the layout size, not the drawn one: a menu sliding in is scaled down, and the
        // canvas used to keep that smaller size until the window next changed.
        resize={{ offsetSize: true }}
        gl={{ toneMapping: tone }}
        frameloop={!live ? 'never' : cap ? 'demand' : 'always'}
        onCreated={({ gl }) => {
          quietShaders(gl)
          // A phone can take the context back while the canvas waits between races;
          // if it isn't restored, build a fresh canvas (and recompile next race).
          let t = 0
          gl.domElement.addEventListener('webglcontextlost', () => {
            t = window.setTimeout(() => useStage.setState((s) => ({ gen: s.gen + 1, ready: -1 })), 2000)
          })
          gl.domElement.addEventListener('webglcontextrestored', () => clearTimeout(t))
        }}
      >
        <SharedShapes />
        <CountFrames view={view} />
        {cap ? <FrameCap fps={cap} paused={!live} /> : null}
        <Rig run={run} />
        <StageRun run={run}>{node}</StageRun>
      </Canvas>,
      hostDiv(),
    )
  }

  // Each race starts from the same camera, and compiles its shaders before its first frame.
  function Rig({ run }: { run: number }) {
    const { camera, gl, scene, get } = useThree()
    useEffect(() => void (renderer = gl), [gl])
    useEffect(() => {
      snap = () => {
        // Draw a fresh frame and copy it straight away, before the browser clears it.
        gl.render(scene, camera)
        return new Promise((done) => gl.domElement.toBlob(done, 'image/jpeg', 0.9))
      }
      return () => void (snap = null)
    }, [gl, scene, camera])
    useLayoutEffect(() => {
      const { cam } = useStage.getState()
      const c = camera as PerspectiveCamera
      // Parking Pro turns the camera's up on wide screens; the next game must not start on its side.
      c.up.set(0, 1, 0)
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

  // Takes the place of a <Canvas>: the shared canvas moves in here and draws `children`.
  // A view opened over another takes the canvas, and gives it back when it closes.
  function StageSlot({ cam, children, through = false }: { cam: Cam; children: ReactNode; through?: boolean }) {
    const slot = useRef<HTMLDivElement>(null)
    const [run] = useState(() => ++runs)
    const [entry] = useState<Entry>(() => ({ run, el: null!, cam, node: children, through }))
    useLayoutEffect(() => {
      entry.el = slot.current!
      open.push(entry)
      moveTo(entry.el, entry.through)
      useStage.setState({ slot: entry.el, cam, run, used: true, ready: -1, node: children })
      return () => {
        pinStage()
        open.splice(open.indexOf(entry), 1)
        if (useStage.getState().run !== run) return
        const back = open[open.length - 1]
        if (back) {
          moveTo(back.el, back.through)
          useStage.setState({ slot: back.el, cam: back.cam, run: back.run, ready: -1, node: back.node })
        } else {
          useStage.setState({ slot: null, node: null })
          park()
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    // The scene follows the view's renders, as it would inside its own canvas (pass a
    // memoised element: a new one every frame re-renders the whole scene every frame).
    useLayoutEffect(() => {
      entry.node = children
      const s = useStage.getState()
      if (s.run === run && s.node !== children) useStage.setState({ node: children })
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

  const useStageReady = () => useStage((s) => s.ready === s.run && s.run > 0)

  return { StageCanvas, StageSlot, useStageReady, warmStage, stageSnapshot }
}

// Each race gets a fresh scene. The next race's scene arrives in the same commit as the
// last one leaves (Retry, Next), so without the key React would hand the old scene the
// new props and its per-race state would carry over: the finish replay stayed finished,
// and every race after the first lost its slow-motion and photo finish.
export function StageRun({ run, children }: { run: number; children: ReactNode }) {
  return <Fragment key={run}>{children}</Fragment>
}

// The full-screen views: races, crates, Rusty's yard, the prize wheel, arcade, crew battle.
export const { StageCanvas, StageSlot, useStageReady, warmStage, stageSnapshot } = makeStage(NeutralToneMapping, 'race')

// The small turntables (they've always drawn with three's filmic look, so they keep it).
export const Preview = makeStage(ACESFilmicToneMapping, 'preview', 60)
