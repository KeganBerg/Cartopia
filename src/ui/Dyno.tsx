import { useEffect, useMemo, useRef, useState } from 'react'
import { dynoPull, type Racer } from '../game/race'
import type { DynoFeed } from '../scene/CarPreview'
import { EngineVoice } from '../lib/engineAudio'
import { loadEngineWorklet } from '../lib/engineWorklet'
import { audioContext, audioOut, isMuted, onMuteChange } from '../lib/sound'

// One dyno run after an upgrade or a new part: the PI it had and has now.
export type DynoRun = { id: number; car: string; model: string; mods?: string[]; before: number; after: number }

// How long the pull takes on screen, and how long the result stays up after it.
const PULL = 2.4
const HOLD = 1.8

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// The engine for a dyno run, through the same synth as races. Quiet if muted.
function dynoEngine(model: string, mods?: string[]) {
  const a = audioContext()
  const dest = audioOut()
  let voice: EngineVoice | null = null
  let trim: GainNode | null = null
  let done = false
  if (a && dest) {
    loadEngineWorklet(a).then(() => {
      if (done) return
      trim = a.createGain()
      trim.gain.value = 0.22
      trim.connect(dest)
      voice = new EngineVoice(a, trim, { model, mods })
    }).catch(() => {})
  }
  const stop = (fade: number) => {
    if (done) return
    done = true
    off()
    voice?.stop(fade)
    const t = trim
    setTimeout(() => t?.disconnect(), fade * 1000 + 400)
  }
  const off = onMuteChange(() => { if (isMuted()) stop(0.1) })
  return {
    drive: (rpm: number, gear: number) => voice?.drive(rpm, gear),
    shift: () => voice?.shift(),
    coast: () => voice?.coast(),
    stop,
  }
}

// Replays the pull at its recorded pace, squeezed into PULL seconds.
function usePull(run: DynoRun, feed: DynoFeed, onEnd: () => void) {
  const time = useMemo(() => dynoPull(run.after), [run.after])
  const frames = useMemo(() => {
    const f: Pick<Racer, 'rpm' | 'gear' | 'speed'>[] = []
    dynoPull(run.after, (r) => f.push({ rpm: r.rpm, gear: r.gear, speed: r.speed }))
    return f
  }, [run.after])
  const [shown, setShown] = useState({ rpm: 0, gear: 0, t: 0, done: REDUCED })
  const end = useRef(onEnd)
  end.current = onEnd
  useEffect(() => {
    if (REDUCED) {
      const id = setTimeout(() => end.current(), HOLD * 1000)
      return () => clearTimeout(id)
    }
    const engine = dynoEngine(run.model, run.mods)
    const start = performance.now()
    let gear = 0
    let raf = 0
    let hold = 0
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / 1000 / PULL))
      const fr = frames[Math.min(frames.length - 1, Math.floor(k * (frames.length - 1)))]
      feed.rpm = Math.min(1, fr.rpm)
      feed.speed = fr.speed
      if (fr.gear !== gear) {
        gear = fr.gear
        engine.shift()
      }
      engine.drive(fr.rpm, fr.gear)
      setShown({ rpm: fr.rpm, gear: fr.gear, t: time * k, done: k >= 1 })
      if (k < 1) {
        raf = requestAnimationFrame(tick)
        return
      }
      engine.coast()
      feed.speed = 0
      feed.rpm = 0
      hold = window.setTimeout(() => end.current(), HOLD * 1000)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(hold)
      engine.stop(0.5)
    }
  }, [run.id, run.model, run.mods, frames, time, feed])
  return { ...shown, time }
}

// Rev counter: the needle sweeps from idle to the red.
function Gauge({ rpm, gear }: { rpm: number; gear: number }) {
  const a = -120 + Math.min(1.05, rpm) * 228
  return (
    <svg className="dyno-gauge" viewBox="-50 -50 100 100" aria-hidden>
      <circle r="47" className="dg-face" />
      <path d="M -36.4 21 A 42 42 0 1 1 36.4 21" className="dg-arc" />
      <path d="M 40.4 -11.5 A 42 42 0 0 1 36.4 21" className="dg-red" />
      {Array.from({ length: 9 }, (_, i) => {
        const t = ((-120 + i * 28.5) * Math.PI) / 180
        return <line key={i} x1={Math.sin(t) * 36} y1={-Math.cos(t) * 36} x2={Math.sin(t) * 42} y2={-Math.cos(t) * 42} className="dg-tick" />
      })}
      <text y="30" className="dg-gear">{gear + 1}</text>
      <g style={{ transform: `rotate(${a}deg)` }}>
        <path d="M -2.5 6 L 0 -38 L 2.5 6 Z" className="dg-needle" />
      </g>
      <circle r="5" className="dg-hub" />
    </svg>
  )
}

const secs = (t: number) => `${t.toFixed(2)}s`

// What goes over the garage preview while the car is on the dyno. Tap to skip.
export function DynoOverlay({ run, feed, onDone }: { run: DynoRun; feed: DynoFeed; onDone: () => void }) {
  const before = useMemo(() => dynoPull(run.before), [run.before])
  const p = usePull(run, feed, onDone)
  const gain = run.after - run.before
  const pi = p.done ? run.after : Math.round(run.before + gain * Math.min(1, p.t / p.time))
  const saved = before - p.time
  return (
    <button className={p.done ? 'dyno done' : 'dyno'} onClick={onDone} aria-label="Dyno result, tap to close">
      <span className="dyno-tag">DYNO</span>
      <span className="dyno-skip">Skip ✕</span>
      <Gauge rpm={p.rpm} gear={p.gear} />
      <span className="dyno-read">
        <span className="dr-row old"><small>Before</small><b>{secs(before)}</b><i>PI {run.before}</i></span>
        <span className="dr-row new"><small>Now</small><b>{p.done ? secs(p.time) : secs(p.t)}</b><i>PI {pi}</i></span>
        <span className={p.done ? 'dr-gain show' : 'dr-gain'}>
          {saved > 0.004 ? `−${saved.toFixed(2)}s` : 'Same time'}{gain > 0 && ` · +${gain} PI`}
        </span>
      </span>
    </button>
  )
}
