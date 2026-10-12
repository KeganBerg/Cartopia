// The club at night, lit by the cues an offline render of its music reported
// (audio.ts), on a script-driven clock. window.load(cues) then window.at(ms)
// draws what's on screen `ms` into the track.
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { NeutralToneMapping } from 'three'
import { BUILDINGS, TILE } from '../../src/game/data'
import { BuildingModel } from '../../src/scene/BuildingModel'
import { DayNight } from '../../src/scene/DayNight'
import { LAYER } from '../../src/scene/layers'
import { paverTex } from '../../src/scene/textures'
import { clubHit, type CueKind } from '../../src/lib/clubBeat'
import { GROOVES } from '../../src/lib/clubGrooves'
import { SHOWN_MS } from '../../src/scene/clubLeds'
import { BAR_MS, decksAt, SIXTEENTH_MS } from '../../src/lib/clubSet'

const q = new URLSearchParams(location.search)
const def = BUILDINGS.find((d) => d.id === 'club')!
const at: [number, number, number] = [-0.5, 1.6, 0.3]
const START = 100000
const bar = Number(q.get('bar') ?? 0)
const label = document.getElementById('label')!

let cues: [number, CueKind, number, number][] = []
let fed = 0
let invalidate = () => {}
function Cam() {
  const s = useThree()
  invalidate = s.invalidate
  useLayoutEffect(() => {
    s.camera.position.set(at[0] + 75, at[1] + 80, at[2] + 75)
    s.camera.lookAt(...at)
    s.camera.updateProjectionMatrix()
  }, [s.camera])
  return null
}

const w = window as unknown as { load: (c: typeof cues) => void; at: (ms: number) => void; __fake: number }
w.load = (c) => {
  cues = c
  fed = 0
}
w.at = (ms) => {
  // The game draws a frame about SHOWN_MS before it reaches the screen; a
  // capture shows it the moment it's drawn, so draw it that much later.
  const now = START + ms - SHOWN_MS
  w.__fake = now
  while (fed < cues.length && START + cues[fed][0] * 1000 <= now + 500) {
    const [t, kind, amt, g] = cues[fed]
    clubHit(START + t * 1000, kind, amt, g)
    fed++
  }
  // What the set is playing: one groove, or the mix from one into the next.
  const d = decksAt(Math.floor((bar * BAR_MS + ms) / SIXTEENTH_MS))
  label.textContent = d.map((x) => GROOVES[x.groove].name + (x.lows ? '' : x.bar >= 48 && x.bar < 56 ? ' (breakdown)' : ' (highs)')).join('  →  ')
  invalidate()
}

createRoot(document.getElementById('root')!).render(
  <Canvas frameloop="demand" orthographic camera={{ zoom: 82, near: 1, far: 320 }} dpr={1} gl={{ toneMapping: NeutralToneMapping, preserveDrawingBuffer: true }}>
    <Cam />
    <DayNight small={false} />
    <mesh rotation-x={-Math.PI / 2} position-y={LAYER.land}>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#3a5f2b" />
    </mesh>
    <mesh rotation-x={-Math.PI / 2} position-y={LAYER.lot}>
      <planeGeometry args={[def.w * TILE - 0.1, def.h * TILE - 0.1]} />
      <meshStandardMaterial map={paverTex(def.w, def.h)} />
    </mesh>
    <BuildingModel def={def} level={7} />
  </Canvas>,
)
