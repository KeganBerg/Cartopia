import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { raceCarOf } from '../game/raceCar'
import { dayPhase, nightAmount } from '../game/clock'
import { SEASON } from '../scene/season'
import { runSkinPaint } from '../lib/skinPaint'
import './loading.css'
import type React from 'react'

// Tall screens get the town's centre crop (town.mjs), the same pick as the splash.
const townCrop = () => (innerWidth < innerHeight * 0.7 ? '-p' : '')

// Loading states drawn like the link-preview cards and the reload splash
// (scripts/splash/build.mjs), from the same renders in public/splash/: the
// player's own race car in their paint, the town in the real season and time
// of day. LoadingBand sits in a panel while a list loads; LoadingScene covers a
// full-screen scene until its first frame has drawn.

function timeOfDay() {
  const n = nightAmount(dayPhase())
  return n > 0.7 ? 'night' : n > 0.08 ? 'dusk' : 'day'
}

function usePlayerCar() {
  const car = useGame((s) => raceCarOf(s.cars, s.raceCar))
  return { model: car?.model ?? 'hotshot', color: car?.color ?? '#d32f2f', skin: car?.skin }
}

// The car render tinted with the player's paint through its paint mask, or
// wearing their animated skin (lib/skinPaint.ts) when the car has one. A car
// with no render yet (a brand-new model) falls back to the Hot Shot.
export function PaintedCar({ kind, model, color, skin }: { kind: 'car' | 'hero'; model: string; color: string; skin?: string | null }) {
  const [missing, setMissing] = useState<string | null>(null)
  const id = missing === model ? 'hotshot' : model
  const mask = `url(/splash/${kind}-${id}-mask.webp)`
  const canvas = useRef<HTMLCanvasElement>(null)
  const [skinOn, setSkinOn] = useState(false)
  useEffect(() => {
    const stop = skin && canvas.current ? runSkinPaint(canvas.current, skin, color) : null
    setSkinOn(!!stop)
    return () => stop?.()
  }, [skin, color])
  return (
    <div className="pc-body">
      <img src={`/splash/${kind}-${id}.webp`} alt="" draggable={false} onError={() => setMissing(model)} />
      {skin && <canvas ref={canvas} className="pc-paint pc-skin" data-skin={skin} style={{ WebkitMaskImage: mask, maskImage: mask, opacity: skinOn ? 1 : 0 }} />}
      {!skinOn && <div className="pc-paint" style={{ background: color, WebkitMaskImage: mask, maskImage: mask }} />}
    </div>
  )
}

// A little Main Street with the player's car cruising down it, for panels.
export function LoadingBand({ label = 'Loading' }: { label?: string }) {
  const { model, color, skin } = usePlayerCar()
  const tod = timeOfDay()
  const street = `/splash/street-${SEASON}-${tod === 'night' ? 'night' : 'day'}.webp`
  return (
    <div className={`load-band ${tod}`} role="status" aria-live="polite">
      <div className="lb-scene" aria-hidden="true">
        <div className="lb-street"><img src={street} alt="" /><img src={street} alt="" /></div>
        <div className="lb-road" />
        <div className="lb-car"><PaintedCar kind="car" model={model} color={color} skin={skin} /></div>
      </div>
      <span className="lb-label"><span className="lb-tire" />{label}…</span>
    </div>
  )
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation()

// Covers a full-screen scene while its canvas builds and compiles: the town,
// a sunburst and the player's car, like the reload splash. Pass `ready` when the
// scene knows; otherwise it waits for a canvas next to it to draw a few frames
// (the first one compiles every shader, which is what leaves a blank screen).
// Never stays longer than `max` ms; `onReady` says when it starts to lift.
export function LoadingScene({ ready, label, max = 6000, onReady, onClose }: { ready?: boolean; label: string; max?: number; onReady?: () => void; onClose?: () => void }) {
  const { model, color, skin } = usePlayerCar()
  const [tod] = useState(timeOfDay)
  const el = useRef<HTMLDivElement>(null)
  const [drawn, setDrawn] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [gone, setGone] = useState(false)
  const done = (ready ?? drawn) || timedOut
  useEffect(() => {
    if (max === Infinity) return
    const t = setTimeout(() => setTimedOut(true), max)
    return () => clearTimeout(t)
  }, [max])
  useEffect(() => {
    if (ready !== undefined) return
    // R3F draws inside requestAnimationFrame, so a few frames after its canvas
    // is in the page and sized, the first (slow) frame has been drawn.
    let id = 0
    let n = 0
    const tick = () => {
      const c = el.current?.parentElement?.querySelector('canvas')
      if (c && c.width > 0 && ++n >= 3) return setDrawn(true)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [ready])
  const cb = useRef(onReady)
  useEffect(() => void (cb.current = onReady))
  useEffect(() => {
    if (!done) return
    cb.current?.()
    const t = setTimeout(() => setGone(true), 450)
    return () => clearTimeout(t)
  }, [done])
  if (gone) return null
  return (
    // Taps on the cover don't reach the game underneath (swipes, tap to skip).
    <div ref={el} className={`load-scene ${tod}${done ? ' out' : ''}`} role="status" aria-live="polite"
      onPointerDown={stop} onPointerUp={stop} onClick={stop}>
      <div className="ls-town" style={{ backgroundImage: `url(/splash/town-${SEASON}-${tod}${townCrop()}.webp)` }} />
      <div className="ls-sun" />
      <div className="ls-car"><PaintedCar kind="hero" model={model} color={color} skin={skin} /></div>
      <span className="ls-pill"><span className="lb-tire" />{label}…</span>
      {onClose && <button className="close ls-close" onClick={onClose} aria-label="Close">✕</button>}
    </div>
  )
}
